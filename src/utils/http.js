'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

const { DEFAULT_USER_AGENT, DEFAULT_TIMEOUTS } = require('../constants');
const {
  createProxyDispatcher,
  createHttpsAgent,
  normalizeProxyUrl,
  getUndici,
} = require('./proxy');

function httpRequest(urlStr, options = {}) {
  const method = options.method || 'GET';
  const headers = {
    'User-Agent': options.userAgent || DEFAULT_USER_AGENT,
    ...options.headers,
  };
  const timeoutMs = options.timeout || DEFAULT_TIMEOUTS.httpRequest;

  let dispatcher = null;
  let httpsAgent = null;

  if (options.proxy) {
    const proxyUrl = normalizeProxyUrl(options.proxy);

    if (getUndici() && getUndici().ProxyAgent) {
      dispatcher = createProxyDispatcher(
        proxyUrl,
        options.connectTimeout || DEFAULT_TIMEOUTS.proxyConnect
      );
    }

    httpsAgent = createHttpsAgent(proxyUrl);
  }

  if (typeof fetch === 'function') {
    const fetchOptions = {
      method,
      headers,
      body: options.body,
      redirect: options.redirect || 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    };

    if (dispatcher) {
      fetchOptions.dispatcher = dispatcher;
    }

    return fetch(urlStr, fetchOptions).then((res) => {
      if (options.manualRedirect && [301, 302, 307, 308].includes(res.status)) {
        return {
          status: res.status,
          headers: res.headers,
          location: res.headers.get('location'),
          data: '',
        };
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        return res
          .json()
          .catch(() => null)
          .then((data) => ({
            status: res.status,
            headers: res.headers,
            location: res.headers.get('location'),
            data,
          }));
      }

      return res
        .text()
        .catch(() => '')
        .then((data) => ({
          status: res.status,
          headers: res.headers,
          location: res.headers.get('location'),
          data,
        }));
    });
  }

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const reqOptions = {
      method,
      headers,
      timeout: timeoutMs,
    };

    if (httpsAgent && parsedUrl.protocol === 'https:') {
      reqOptions.agent = httpsAgent;
    }

    const req = client.request(parsedUrl, reqOptions, (res) => {
      if (options.manualRedirect && [301, 302, 307, 308].includes(res.statusCode)) {
        return resolve({
          status: res.statusCode,
          headers: res.headers,
          location: res.headers.location,
          data: '',
        });
      }

      let body = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        let parsedData = body;
        try {
          parsedData = JSON.parse(body);
        } catch (e) {}

        resolve({
          status: res.statusCode,
          headers: res.headers,
          location: res.headers.location,
          data: parsedData,
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

module.exports = { httpRequest };
