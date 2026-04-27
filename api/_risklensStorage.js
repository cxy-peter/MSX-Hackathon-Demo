import crypto from 'node:crypto';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

const memoryStore = globalThis.__risklensApiMemoryStore || new Map();
globalThis.__risklensApiMemoryStore = memoryStore;

const kvStatus = globalThis.__risklensApiKvStatus || { lastError: '' };
globalThis.__risklensApiKvStatus = kvStatus;

function getKvConfig() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''
  };
}

async function kvCommand(command, ...args) {
  const { url, token } = getKvConfig();
  if (!url || !token) {
    kvStatus.lastError = '';
    return { ok: false, result: null, configured: false };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([command, ...args])
    });

    if (!response.ok) {
      const error = `KV ${command} failed with ${response.status}`;
      kvStatus.lastError = error;
      return { ok: false, result: null, configured: true, error };
    }

    const payload = await response.json().catch(() => ({}));
    kvStatus.lastError = '';
    return { ok: true, result: payload?.result ?? null, configured: true };
  } catch (error) {
    kvStatus.lastError = error.message || `KV ${command} request failed`;
    return { ok: false, result: null, configured: true, error: kvStatus.lastError };
  }
}

export function applyCors(req, res) {
  const allowOrigin = process.env.RISKLENS_API_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

export function sendJson(res, statusCode, payload) {
  Object.entries(JSON_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  res.status(statusCode).json(payload);
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function getHttpErrorStatus(error, fallback = 500) {
  const statusCode = Number(error?.statusCode || error?.status || fallback);
  return Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : fallback;
}

export async function readRequestJson(req, { maxBytes = 128 * 1024 } = {}) {
  if (Buffer.isBuffer(req.body)) {
    const rawBody = req.body.toString('utf8').trim();
    if (!rawBody) return {};
    try {
      return JSON.parse(rawBody);
    } catch {
      throw httpError('Invalid JSON request body.', 400);
    }
  }
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      throw httpError('Invalid JSON request body.', 400);
    }
  }
  if (!req || typeof req[Symbol.asyncIterator] !== 'function') {
    return {};
  }

  const chunks = [];
  let receivedBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.length;
    if (receivedBytes > maxBytes) {
      throw httpError('JSON request body is too large.', 413);
    }
    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    throw httpError('Invalid JSON request body.', 400);
  }
}

export async function readJson(key, fallback) {
  const kvValue = await kvCommand('GET', key);
  if (kvValue.ok && kvValue.result !== null && kvValue.result !== undefined) {
    if (typeof kvValue.result === 'string') {
      try {
        return JSON.parse(kvValue.result);
      } catch {
        return fallback;
      }
    }
    return kvValue.result;
  }

  return memoryStore.has(key) ? memoryStore.get(key) : fallback;
}

export async function writeJson(key, value) {
  const serialized = JSON.stringify(value);
  const kvResult = await kvCommand('SET', key, serialized);
  memoryStore.set(key, value);
  return {
    mode: kvResult.ok ? 'vercel-kv' : 'memory-fallback',
    persisted: kvResult.ok,
    warning: kvResult.error || ''
  };
}

export function getStorageDescriptor(writeResult = null) {
  const { url, token } = getKvConfig();
  const kvReady = Boolean(url && token && !kvStatus.lastError);
  const persisted = writeResult ? Boolean(writeResult.persisted) : kvReady;
  const warning = writeResult?.warning || kvStatus.lastError || '';
  return {
    mode: writeResult?.mode || (kvReady ? 'vercel-kv' : 'memory-fallback'),
    persisted,
    ...(warning ? { warning } : {}),
    userDataPolicy: 'Leaderboard rows store public metrics plus decentralized profile pointers only; raw wallet profiles stay off this API.'
  };
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

export function hashJson(value) {
  return sha256Hex(JSON.stringify(value ?? null));
}

export function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

export function roundNumber(value, digits = 2) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
}
