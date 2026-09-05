# gofile-proxify

A Node.js library for downloading files from [Gofile.io](https://gofile.io) with built-in proxy support, automatic proxy pool rotation, and progress tracking.

## Features

- **Proxy Support** — Route all requests through HTTP proxies to bypass rate limits and IP bans.
- **Automatic Proxy Pool** — Fetches and validates free proxies from multiple public sources, automatically rotating and discarding bad ones.
- **WT Token Generation** — Loads and executes Gofile's obfuscated `wt` token generator, with a secure SHA-256 fallback if the script is unavailable.
- **Guest Account Tokens** — Automatically obtains temporary guest tokens when no account token is provided.
- **Single & Multi-File Downloads** — Handles folders with one or many files, with configurable concurrency.
- **Progress Tracking** — Real-time download progress callbacks with speed and elapsed-time reporting.
- **File Info Lookup** — Retrieve folder metadata, file lists, and sizes without downloading.
- **Modular Architecture** — Clean separation between core logic and utilities, easy to extend.
- **TypeScript Definitions** — Ships with `.d.ts` type declarations.
- **No Native Dependencies** — Pure JavaScript, works on Node.js 14+.

## Installation

```bash
npm install gofile-proxify
```

### Dependencies

The library optionally uses [`undici`](https://www.npmjs.com/package/undici) for proxy-aware HTTP requests and [`https-proxy-agent`](https://www.npmjs.com/package/https-proxy-agent) as a fallback. Both are listed as dependencies and installed automatically.

## Quick Start

### Download a File

```javascript
const { Gofile } = require('gofile-proxify');

const gofile = new Gofile({
  useProxy: true,
  maxRetries: 3,
});

async function main() {
  const results = await gofile.download('https://gofile.io/d/XXXXXXXX', './downloads', {
    onProgress: (received, total) => {
      const pct = total > 0 ? ((received / total) * 100).toFixed(1) : '?';
      process.stdout.write(`\rProgress: ${pct}%`);
    },
  });

  results.forEach((r) => {
    if (r.success) {
      console.log(`OK: ${r.name} (${r.sizeFormatted}) in ${r.elapsed} at ${r.avgSpeed}`);
    } else {
      console.log(`FAIL: ${r.error}`);
    }
  });
}

main().catch(console.error);
```

### Get File Info Without Downloading

```javascript
const { Gofile } = require('gofile-proxify');

const gofile = new Gofile();

async function main() {
  const info = await gofile.getInfo('https://gofile.io/d/XXXXXXXX');

  console.log(`Folder: ${info.name}`);
  console.log(`Files: ${info.fileCount}`);
  console.log(`Total size: ${info.totalSizeFormatted}`);

  info.files.forEach((f, i) => {
    console.log(`  [${i + 1}] ${f.name} (${f.sizeFormatted})`);
  });
}

main().catch(console.error);
```

### Download with a Fixed Proxy (No Pool)

```javascript
const { Gofile } = require('gofile-proxify');

const gofile = new Gofile({
  useProxy: false,
});

async function main() {
  const results = await gofile.download('XXXXXXXX', './downloads', {
    proxy: 'http://203.0.113.50:8080',
    onProgress: (received, total) => {
      console.log(`${received} / ${total} bytes`);
    },
  });

  console.log(results);
}

main().catch(console.error);
```

### Use Your Own Gofile Account Token

```javascript
const { Gofile } = require('gofile-proxify');

const gofile = new Gofile({
  token: 'your-gofile-account-token-here',
  useProxy: true,
});

async function main() {
  const info = await gofile.getInfo('XXXXXXXX');
  console.log(info);
}

main().catch(console.error);
```

## API Reference

### `Gofile`

Main class for interacting with Gofile.io.

#### Constructor

```javascript
new Gofile(options)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `userAgent` | `string` | Chrome UA | User-Agent string sent with all requests. |
| `token` | `string` | `null` | Gofile account token. If omitted, a guest token is auto-generated. |
| `useProxy` | `boolean` | `true` | Whether to use the proxy pool for requests. |
| `proxyManager` | `ProxyManager` | new instance | Custom `ProxyManager` instance. |
| `proxyOptions` | `object` | `{}` | Options passed to the internal `ProxyManager`. |
| `maxRetries` | `number` | `3` | Maximum retry attempts for failed API calls. |
| `retryDelay` | `number` | `1500` | Delay in ms between retries. |
| `concurrency` | `number` | `1` | Number of simultaneous downloads for multi-file folders. |

#### Methods

##### `getGuestToken()`

Creates a temporary guest account and returns its token.

```javascript
const token = await gofile.getGuestToken();
// → "abc123..."
```

##### `getContents(fileId)`

Fetches the full contents metadata for a Gofile folder.

```javascript
const data = await gofile.getContents('XXXXXXXX');
// → { name, type, children: { ... }, ... }
```

##### `getDownloadUrl(fileId)`

Resolves the download link(s) for a Gofile folder. Returns an object with `url`, `name`, `size` (for single files) and `files` (array of all files).

```javascript
const { url, name, files } = await gofile.getDownloadUrl('XXXXXXXX');
```

##### `resolveDirectLink(fileLink, proxy?)`

Follows redirects to resolve the final direct download URL from a Gofile link.

```javascript
const directUrl = await gofile.resolveDirectLink('https://gofile.io/d/XXXXXXXX');
```

##### `download(fileId, outputDir?, options?)`

Downloads all files from a Gofile folder. Returns an array of download result objects.

| Option | Type | Description |
|--------|------|-------------|
| `onProgress` | `function` | Callback `(received, total)` for single-file, or `(fileName, received, total, index, totalFiles)` for multi-file. |
| `proxy` | `string` | Use a specific proxy instead of the pool. |

```javascript
const results = await gofile.download('XXXXXXXX', './downloads', {
  onProgress: (received, total) => { ... },
});
```

##### `getInfo(fileId)`

Returns structured metadata about a Gofile folder without downloading.

```javascript
const info = await gofile.getInfo('XXXXXXXX');
// → { id, name, type, pageUrl, fileCount, totalSize, totalSizeFormatted, files: [...] }
```

---

### `ProxyManager`

Manages a pool of HTTP proxies with automatic fetching, validation, and rotation.

#### Constructor

```javascript
new ProxyManager(options)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minFetchIntervalMs` | `number` | `30000` | Minimum time between proxy list refreshes. |
| `concurrency` | `number` | `12` | Number of proxies to test in parallel. |
| `testTarget` | `string` | Gofile API | URL used to test proxy validity. |
| `userAgent` | `string` | Chrome UA | User-Agent for proxy tests. |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `fetchProxies()` | `Promise<string[]>` | Fetches fresh proxies from public sources. |
| `addProxies(list)` | `number` | Manually add proxies (string or array). Returns new count. |
| `next()` | `string \| null` | Returns the next non-bad proxy (round-robin). |
| `getValidProxy()` | `Promise<string \| null>` | Tests candidates in parallel and returns the first working one. |
| `testProxy(proxy)` | `Promise<string \| null>` | Tests a single proxy. Returns it if valid. |
| `markBad(proxy)` | `void` | Marks a proxy as bad (excluded from rotation). |
| `clearBad()` | `void` | Clears the bad proxy list. |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `count` | `number` | Total proxies in the pool. |
| `availableCount` | `number` | Proxies not marked as bad. |

---

### Utility Functions

The library also exports standalone utility functions:

| Function | Description |
|----------|-------------|
| `extractId(urlOrId)` | Extracts a Gofile ID from a URL or raw ID string. |
| `isValidId(urlOrId)` | Returns `true` if the input is a valid Gofile ID or URL. |
| `buildDownloadPage(id)` | Builds the Gofile download page URL from an ID. |
| `formatBytes(bytes, decimals?)` | Formats bytes into a human-readable string (e.g. `1.5 MB`). |
| `formatSpeed(bytesPerSec)` | Formats a speed value (e.g. `2.3 MB/s`). |
| `formatDuration(seconds)` | Formats seconds into a duration string (e.g. `1m 30s`). |
| `sleep(ms)` | Returns a Promise that resolves after `ms` milliseconds. |
| `normalizeProxyUrl(proxy)` | Ensures a proxy string has the `http://` prefix. |
| `parseProxyList(input)` | Parses a comma-separated string or array into proxy URLs. |
| `generateFallbackToken(ua, lang, token)` | Generates a SHA-256 WT fallback token. |
| `loadWtGenerator(ua, proxy?)` | Loads Gofile's obfuscated WT script and returns the generator function. |
| `httpRequest(url, options?)` | Low-level HTTP request helper with proxy support. |

## How It Works

1. **Proxy Pool**: `ProxyManager` fetches free HTTP proxies from multiple public sources, tests them against the Gofile API in parallel, and discards non-working ones. Proxies are rotated round-robin, and bad proxies are automatically excluded.

2. **WT Token**: Gofile uses an obfuscated JavaScript challenge (`wt.obf.js`) to generate a token required for API access. The library loads and executes this script in a sandboxed VM context. If the script is unavailable (e.g. blocked by proxy), a SHA-256 fallback token is generated using the same time-window logic.

3. **Guest Tokens**: If no account token is provided, the library creates a temporary guest account via the Gofile API and uses its token for subsequent requests.

4. **Downloads**: The library resolves direct download links by following redirects, then streams the file to disk with real-time progress tracking.

## Author

**KazeDevID** — [GitHub](https://github.com/KazeDevID)

## License

MIT
