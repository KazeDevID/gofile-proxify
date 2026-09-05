'use strict';

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const { httpRequest } = require('../utils/http');
const { sleep } = require('../utils/sleep');
const { extractId, buildDownloadPage } = require('../utils/id');
const { formatBytes, formatSpeed, formatDuration } = require('../utils/format');
const { generateFallbackToken, loadWtGenerator } = require('../utils/token');
const { normalizeProxyUrl } = require('../utils/proxy');
const { ProxyManager } = require('./ProxyManager');

const {
  DEFAULT_USER_AGENT,
  API_BASE_URL,
  DEFAULT_TIMEOUTS,
} = require('../constants');

class Gofile {
  constructor(options = {}) {
    this.userAgent = options.userAgent || DEFAULT_USER_AGENT;
    this.token = options.token || null;
    this.useProxy = options.useProxy !== false;
    this.proxyManager = options.proxyManager || new ProxyManager({
      userAgent: this.userAgent,
      ...options.proxyOptions,
    });
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1500;
    this.concurrency = options.concurrency || 1;

    this._wtGenerator = null;
    this._wtLoaded = false;
    this._currentProxy = null;
  }

  async _getProxy() {
    if (!this.useProxy) return null;
    const proxy = await this.proxyManager.getValidProxy();
    this._currentProxy = proxy;
    return proxy;
  }

  async _markProxyBad() {
    if (this._currentProxy) {
      this.proxyManager.markBad(this._currentProxy);
      this._currentProxy = null;
    }
  }

  async _ensureWt() {
    if (this._wtLoaded) return;

    const proxy = await this._getProxy();
    this._wtGenerator = await loadWtGenerator(this.userAgent, proxy);
    this._wtLoaded = true;
  }

  async _generateWt() {
    await this._ensureWt();

    if (this._wtGenerator) {
      try {
        const wt = this._wtGenerator();
        if (wt && typeof wt === 'string') return wt;
      } catch (e) {}
    }

    return generateFallbackToken(this.userAgent, 'en-US', this.token || '');
  }

  _buildApiUrl(endpoint, params = {}) {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  }

  async getGuestToken() {
    const proxy = await this._getProxy();

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const res = await httpRequest(`${API_BASE_URL}/accounts`, {
          method: 'POST',
          timeout: DEFAULT_TIMEOUTS.getGuestToken,
          proxy,
          userAgent: this.userAgent,
        });

        if (res.status === 200 && res.data) {
          const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          if (body.status === 'ok' && body.data && body.data.token) {
            return body.data.token;
          }
        }
      } catch (e) {
        if (proxy) await this._markProxyBad();
      }

      await sleep(this.retryDelay);
    }

    return null;
  }

  async getContents(fileId) {
    const id = extractId(fileId);
    if (!id) throw new Error(`Invalid Gofile ID or URL: ${fileId}`);

    const token = this.token || (await this.getGuestToken());
    if (!token) throw new Error('Failed to obtain a Gofile access token');

    const wt = await this._generateWt();

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const proxy = await this._getProxy();

      try {
        const url = this._buildApiUrl('/contents', {
          wt,
          fuid: id,
          token,
        });

        const res = await httpRequest(url, {
          timeout: DEFAULT_TIMEOUTS.getContents,
          proxy,
          userAgent: this.userAgent,
        });

        const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;

        if (res.status === 200 && body && body.status === 'ok') {
          return body.data;
        }

        if (body && body.status === 'error-not-wt' && attempt === 0) {
          this._wtGenerator = null;
          this._wtLoaded = false;
          continue;
        }
      } catch (e) {
        if (proxy) await this._markProxyBad();
      }

      await sleep(this.retryDelay);
    }

    throw new Error(`Failed to fetch contents for ${id}`);
  }

  async getDownloadUrl(fileId) {
    const contents = await this.getContents(fileId);

    if (!contents || !contents.children) {
      throw new Error('No files found in this Gofile folder');
    }

    const files = Object.values(contents.children).filter(
      (item) => item && item.type === 'file'
    );

    if (files.length === 0) {
      throw new Error('No downloadable files found in this Gofile folder');
    }

    if (files.length === 1) {
      return {
        url: files[0].link,
        name: files[0].name,
        size: files[0].size,
        files,
      };
    }

    return {
      url: null,
      name: null,
      size: null,
      files,
    };
  }

  async resolveDirectLink(fileLink, proxy) {
    try {
      const res = await httpRequest(fileLink, {
        timeout: DEFAULT_TIMEOUTS.httpRequest,
        proxy,
        userAgent: this.userAgent,
        manualRedirect: true,
      });

      if ([301, 302, 307, 308].includes(res.status) && res.location) {
        return res.location;
      }

      if (res.status === 200 && typeof res.data === 'string') {
        const match = res.data.match(
          /https:\/\/[a-z0-9-]+\.gofile\.io\/download\/[a-zA-Z0-9_-]+\/[^"'\s<>]+/i
        );
        if (match) return match[0];
      }
    } catch (e) {}

    return fileLink;
  }

  async download(fileId, outputDir, options = {}) {
    const id = extractId(fileId);
    if (!id) throw new Error(`Invalid Gofile ID or URL: ${fileId}`);

    const destDir = outputDir || './downloads';
    fs.mkdirSync(destDir, { recursive: true });

    const result = await this.getDownloadUrl(id);

    if (result.files.length === 1) {
      const filePath = path.join(destDir, result.name || `gofile_${id}`);
      const stats = await this._downloadFile(result.url, filePath, options.onProgress, options.proxy || null);
      return [stats];
    }

    const files = result.files;
    const onProgress = options.onProgress;
    const results = [];
    const concurrency = this.concurrency || 1;

    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((file, batchIdx) => {
          const globalIdx = i + batchIdx;
          return this._downloadFile(
            file.link,
            path.join(destDir, file.name),
            onProgress
              ? (received, total) => onProgress(file.name, received, total, globalIdx, files.length)
              : undefined,
            options.proxy || null
          );
        })
      );

      batchResults.forEach((r) => {
        if (r.status === 'fulfilled') results.push(r.value);
        else results.push({ success: false, error: r.reason && r.reason.message });
      });
    }

    return results;
  }

  async _downloadFile(downloadUrl, filePath, onProgress, fixedProxy) {
    const proxy = fixedProxy || (await this._getProxy());

    let directUrl = downloadUrl;
    if (downloadUrl.includes('gofile.io/d/') || !downloadUrl.includes('/download/')) {
      directUrl = await this.resolveDirectLink(downloadUrl, proxy);
    }

    const res = await fetch(directUrl, {
      headers: { 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(0),
    });

    if (!res.ok && !res.body) {
      throw new Error(`Download failed: HTTP ${res.status}`);
    }

    const totalSize = parseInt(res.headers.get('content-length') || '0', 10);
    const fileStream = fs.createWriteStream(filePath);
    let receivedBytes = 0;
    const startTime = Date.now();
    let lastReportTime = 0;

    const reader = res.body.getReader();
    const source = new Readable({
      async read() {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          receivedBytes += value.length;

          if (onProgress) {
            const now = Date.now();
            if (now - lastReportTime > 200 || receivedBytes >= totalSize) {
              lastReportTime = now;
              onProgress(receivedBytes, totalSize);
            }
          }

          this.push(value);
        }
      },
    });

    await pipeline(source, fileStream);

    const elapsed = (Date.now() - startTime) / 1000;
    const avgSpeed = elapsed > 0 ? receivedBytes / elapsed : 0;

    return {
      success: true,
      path: filePath,
      name: path.basename(filePath),
      size: receivedBytes,
      sizeFormatted: formatBytes(receivedBytes),
      avgSpeed: formatSpeed(avgSpeed),
      elapsed: formatDuration(elapsed),
      elapsedSeconds: elapsed,
    };
  }

  async getInfo(fileId) {
    const contents = await this.getContents(fileId);
    const id = extractId(fileId);

    const files = contents && contents.children
      ? Object.values(contents.children).filter((item) => item && item.type === 'file')
      : [];

    return {
      id,
      name: contents.name || id,
      type: contents.type || 'folder',
      pageUrl: buildDownloadPage(id),
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
      totalSizeFormatted: formatBytes(files.reduce((sum, f) => sum + (f.size || 0), 0)),
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        sizeFormatted: formatBytes(f.size || 0),
        downloadUrl: f.link,
      })),
    };
  }
}

module.exports = { Gofile };
