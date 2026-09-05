'use strict';

let undici;
try {
  undici = require('undici');
} catch (e) {
  undici = null;
}

let HttpsProxyAgent;
try {
  HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
} catch (e) {
  HttpsProxyAgent = null;
}

function getUndici() {
  return undici;
}

function getHttpsProxyAgent() {
  return HttpsProxyAgent;
}

function createProxyDispatcher(proxyUrl, connectTimeout) {
  if (!undici || !undici.ProxyAgent) return null;

  const formatted = normalizeProxyUrl(proxyUrl);

  try {
    return new undici.ProxyAgent({
      uri: formatted,
      connect: { timeout: connectTimeout || 2200 },
    });
  } catch (e) {
    try {
      return new undici.ProxyAgent(formatted);
    } catch (err2) {
      return null;
    }
  }
}

function createHttpsAgent(proxyUrl) {
  if (!HttpsProxyAgent) return null;

  const formatted = normalizeProxyUrl(proxyUrl);

  try {
    return new HttpsProxyAgent(formatted);
  } catch (e) {
    return null;
  }
}

function normalizeProxyUrl(proxy) {
  if (!proxy) return null;
  return proxy.startsWith('http') ? proxy : `http://${proxy}`;
}

function parseProxyList(input) {
  const result = new Set();

  if (typeof input === 'string') {
    input.split(',').forEach((p) => {
      const clean = p.trim();
      if (clean) {
        result.add(normalizeProxyUrl(clean));
      }
    });
  } else if (Array.isArray(input)) {
    input.forEach((p) => {
      if (p && typeof p === 'string') {
        const clean = p.trim();
        if (clean) {
          result.add(normalizeProxyUrl(clean));
        }
      }
    });
  }

  return Array.from(result);
}

module.exports = {
  getUndici,
  getHttpsProxyAgent,
  createProxyDispatcher,
  createHttpsAgent,
  normalizeProxyUrl,
  parseProxyList,
};
