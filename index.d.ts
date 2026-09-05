/// <reference types="node" />

export interface GofileOptions {
  userAgent?: string;
  token?: string;
  useProxy?: boolean;
  proxyManager?: ProxyManager;
  proxyOptions?: ProxyManagerOptions;
  maxRetries?: number;
  retryDelay?: number;
  concurrency?: number;
}

export interface ProxyManagerOptions {
  minFetchIntervalMs?: number;
  concurrency?: number;
  testTarget?: string;
  userAgent?: string;
}

export interface DownloadProgress {
  received: number;
  total: number;
}

export interface FileInfo {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  downloadUrl: string;
}

export interface GofileInfo {
  id: string;
  name: string;
  type: string;
  pageUrl: string;
  fileCount: number;
  totalSize: number;
  totalSizeFormatted: string;
  files: FileInfo[];
}

export interface DownloadResult {
  success: boolean;
  path?: string;
  name?: string;
  size?: number;
  sizeFormatted?: string;
  avgSpeed?: string;
  elapsed?: string;
  elapsedSeconds?: number;
  error?: string;
}

export interface MultiFileProgress {
  fileName: string;
  received: number;
  total: number;
  index: number;
  totalFiles: number;
}

export declare class ProxyManager {
  constructor(options?: ProxyManagerOptions);
  fetchProxies(): Promise<string[]>;
  addProxies(list: string | string[]): number;
  next(): string | null;
  getValidProxy(): Promise<string | null>;
  testProxy(proxy: string): Promise<string | null>;
  markBad(proxy: string): void;
  clearBad(): void;
  readonly count: number;
  readonly availableCount: number;
}

export declare class Gofile {
  constructor(options?: GofileOptions);
  getGuestToken(): Promise<string | null>;
  getContents(fileId: string): Promise<any>;
  getDownloadUrl(fileId: string): Promise<{ url: string | null; name: string | null; size: number | null; files: any[] }>;
  resolveDirectLink(fileLink: string, proxy?: string | null): Promise<string>;
  download(fileId: string, outputDir?: string, options?: {
    onProgress?: (received: number, total: number) => void;
    proxy?: string;
  }): Promise<DownloadResult[]>;
  getInfo(fileId: string): Promise<GofileInfo>;
}

export function extractId(urlOrId: string): string | null;
export function isValidId(urlOrId: string): boolean;
export function buildDownloadPage(id: string): string;
export function formatBytes(bytes: number, decimals?: number): string;
export function formatSpeed(bytesPerSec: number): string;
export function formatDuration(seconds: number): string;
export function sleep(ms: number): Promise<void>;
export function normalizeProxyUrl(proxy: string): string | null;
export function parseProxyList(input: string | string[]): string[];
export function generateFallbackToken(userAgent: string, language: string, accountToken: string): string;
export function loadWtGenerator(userAgent: string, proxy?: string | null): Promise<((...args: any[]) => string) | null>;
export function httpRequest(url: string, options?: any): Promise<any>;

export const constants: {
  DEFAULT_USER_AGENT: string;
  API_BASE_URL: string;
  WEB_BASE_URL: string;
  PROXY_SOURCES: string[];
  WT_WINDOW_SECONDS: number;
  WT_SALT_FALLBACK: string;
  ID_REGEX: RegExp;
  ID_URL_REGEX: RegExp;
  DEFAULT_TIMEOUTS: Record<string, number>;
  PROXY_TEST_TARGET: string;
};
