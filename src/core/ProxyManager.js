'use strict';

const { httpRequest } = require('../utils/http');
const { normalizeProxyUrl, parseProxyList } = require('../utils/proxy');
const { sleep } = require('../utils/sleep');
const {
  PROXY_SOURCES,
  PROXY_TEST_TARGET,
  DEFAULT_USER_AGENT,
  DEFAULT_TIMEOUTS,
} = require('../constants');

class ProxyManager {
  constructor(options = {}) {
    this.proxies = [];
    this.index = 0;
    this.badProxies = new Set();
    this.lastFetch = 0;
    this.minFetchIntervalMs = options.minFetchIntervalMs || 30000;
    this.concurrency = options.concurrency || 12;
    this.testTarget = options.testTarget || PROXY_TEST_TARGET;
    this.userAgent = options.userAgent || DEFAULT_USER_AGENT;
  }

  async fetchProxies() {
    const now = Date.now();
    if (this.proxies.length > 0 && now - this.lastFetch < this.minFetchIntervalMs) {
      return this.proxies;
    }

    const results = await Promise.allSettled(
      PROXY_SOURCES.map((url) =>
        httpRequest(url, {
          timeout: DEFAULT_TIMEOUTS.httpRequest,
          userAgent: this.userAgent,
        })
      )
    );

    const fresh = new Set();

    results.forEach((result) => {
      if (result.status !== 'ok' || !result.value) return;
      const text = typeof result.value.data === 'string' ? result.value.data : '';
      if (!text) return;

      const lines = text.split(/\r?\n/);
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(trimmed)) {
          fresh.add(normalizeProxyUrl(trimmed));
        }
      });
    });

    if (fresh.size === 0) {
      return this.proxies;
    }

    this.proxies = Array.from(fresh);
    this.badProxies.clear();
    this.index = 0;
    this.lastFetch = Date.now();
    return this.proxies;
  }

  addProxies(list) {
    const parsed = parseProxyList(list);
    parsed.forEach((p) => {
      if (!this.proxies.includes(p)) {
        this.proxies.push(p);
      }
    });
    return this.proxies.length;
  }

  next() {
    if (this.proxies.length === 0) return null;

    let attempts = 0;
    while (attempts < this.proxies.length) {
      const proxy = this.proxies[this.index % this.proxies.length];
      this.index++;

      if (!this.badProxies.has(proxy)) {
        return proxy;
      }

      attempts++;
    }

    return null;
  }

  async getValidProxy() {
    if (this.proxies.length === 0) {
      await this.fetchProxies();
    }

    const candidates = [];
    for (let i = 0; i < this.proxies.length; i++) {
      const p = this.next();
      if (p) candidates.push(p);
      if (candidates.length >= this.concurrency) break;
    }

    if (candidates.length === 0) return null;

    const valid = await Promise.allSettled(
      candidates.map((proxy) => this.testProxy(proxy))
    );

    for (const result of valid) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }

    return null;
  }

  async testProxy(proxy) {
    const formatted = normalizeProxyUrl(proxy);

    try {
      const res = await httpRequest(this.testTarget, {
        proxy: formatted,
        timeout: DEFAULT_TIMEOUTS.proxyTest,
        connectTimeout: DEFAULT_TIMEOUTS.proxyConnect,
        userAgent: this.userAgent,
      });

      if (res.status >= 200 && res.status < 400) {
        return formatted;
      }
    } catch (e) {}

    this.badProxies.add(formatted);
    return null;
  }

  markBad(proxy) {
    if (proxy) this.badProxies.add(normalizeProxyUrl(proxy));
  }

  clearBad() {
    this.badProxies.clear();
  }

  get count() {
    return this.proxies.length;
  }

  get availableCount() {
    return this.proxies.filter((p) => !this.badProxies.has(p)).length;
  }
}

module.exports = { ProxyManager };
