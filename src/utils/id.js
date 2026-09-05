'use strict';

const { ID_REGEX, ID_URL_REGEX } = require('../constants');

function extractId(urlOrId) {
  if (!urlOrId) return null;

  const trimmed = String(urlOrId).trim();

  if (ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(ID_URL_REGEX);
  return match ? match[1] : null;
}

function isValidId(urlOrId) {
  return extractId(urlOrId) !== null;
}

function buildDownloadPage(id) {
  return `https://gofile.io/d/${id}`;
}

module.exports = {
  extractId,
  isValidId,
  buildDownloadPage,
};
