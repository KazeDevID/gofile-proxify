'use strict';

const crypto = require('crypto');
const vm = require('vm');

const {
  DEFAULT_USER_AGENT,
  WT_WINDOW_SECONDS,
  WT_SALT_FALLBACK,
  DEFAULT_TIMEOUTS,
} = require('../constants');
const { httpRequest } = require('./http');

function generateFallbackToken(userAgent, language, accountToken) {
  const window = Math.floor(Date.now() / 1000 / WT_WINDOW_SECONDS);
  const salt = process.env.GOFILE_WT_SALT || WT_SALT_FALLBACK;

  const raw = [
    userAgent,
    language || 'en-US',
    accountToken || '',
    window,
    salt,
  ].join('::');

  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function loadWtGenerator(userAgent, proxy) {
  try {
    const wtRes = await httpRequest('https://gofile.io/js/wt.obf.js', {
      headers: { 'User-Agent': userAgent },
      timeout: DEFAULT_TIMEOUTS.wtFetch,
      proxy: proxy || null,
    });

    if (
      wtRes.status === 200 &&
      typeof wtRes.data === 'string' &&
      wtRes.data.includes('generateWT')
    ) {
      const sandbox = {
        window: {},
        document: {
          createElement: () => ({}),
          getElementsByTagName: () => [],
        },
        navigator: {
          userAgent,
          language: 'en-US',
        },
        location: { hostname: 'gofile.io' },
        console: {
          log: () => {},
          error: () => {},
        },
        setTimeout,
        clearTimeout,
      };

      sandbox.window = sandbox;

      vm.createContext(sandbox);
      vm.runInContext(wtRes.data, sandbox);

      if (typeof sandbox.generateWT === 'function') {
        return sandbox.generateWT;
      }
    }
  } catch (e) {}

  return null;
}

module.exports = {
  generateFallbackToken,
  loadWtGenerator,
};
