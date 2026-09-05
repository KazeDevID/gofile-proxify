'use strict';

const { Gofile } = require('./src/core/Gofile');
const { ProxyManager } = require('./src/core/ProxyManager');

const {
  DEFAULT_USER_AGENT,
  API_BASE_URL,
  WEB_BASE_URL,
  PROXY_SOURCES,
  WT_WINDOW_SECONDS,
  WT_SALT_FALLBACK,
  ID_REGEX,
  ID_URL_REGEX,
  DEFAULT_TIMEOUTS,
  PROXY_TEST_TARGET,
} = require('./src/constants');

const {
  extractId,
  isValidId,
  buildDownloadPage,
} = require('./src/utils/id');

const {
  formatBytes,
  formatSpeed,
  formatDuration,
} = require('./src/utils/format');

const { sleep } = require('./src/utils/sleep');

const {
  normalizeProxyUrl,
  parseProxyList,
  createProxyDispatcher,
  createHttpsAgent,
} = require('./src/utils/proxy');

const { generateFallbackToken, loadWtGenerator } = require('./src/utils/token');

const { httpRequest } = require('./src/utils/http');

module.exports = {
  Gofile,
  ProxyManager,

  extractId,
  isValidId,
  buildDownloadPage,

  formatBytes,
  formatSpeed,
  formatDuration,

  sleep,

  normalizeProxyUrl,
  parseProxyList,
  createProxyDispatcher,
  createHttpsAgent,

  generateFallbackToken,
  loadWtGenerator,

  httpRequest,

  constants: {
    DEFAULT_USER_AGENT,
    API_BASE_URL,
    WEB_BASE_URL,
    PROXY_SOURCES,
    WT_WINDOW_SECONDS,
    WT_SALT_FALLBACK,
    ID_REGEX,
    ID_URL_REGEX,
    DEFAULT_TIMEOUTS,
    PROXY_TEST_TARGET,
  },
};
