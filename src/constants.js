'use strict';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

const API_BASE_URL = 'https://api.gofile.io';
const WEB_BASE_URL = 'https://gofile.io';

const PROXY_SOURCES = [
  'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=2500&country=all&ssl=yes&anonymity=elite,anonymous',
  'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
];

const WT_WINDOW_SECONDS = 14400;
const WT_SALT_FALLBACK = '12af056dacea0b';

const ID_REGEX = /^[a-zA-Z0-9]{8,12}$/;
const ID_URL_REGEX = /gofile\.io\/d\/([a-zA-Z0-9]+)/i;

const DEFAULT_TIMEOUTS = {
  httpRequest: 12000,
  getGuestToken: 3000,
  getContents: 6500,
  proxyTest: 2500,
  proxyConnect: 2200,
  downloadConnect: 4000,
  wtFetch: 4000,
};

const PROXY_TEST_TARGET = 'https://api.gofile.io/accounts';

module.exports = {
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
};
