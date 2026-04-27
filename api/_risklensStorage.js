import crypto from 'node:crypto';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

const memoryStore = globalThis.__risklensApiMemoryStore || new Map();
globalThis.__risklensApiMemoryStore = memoryStore;

function getKvConfig() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''
  };
}

async function kvCommand(command, ...args) {
  const { url, token } = getKvConfig();
  if (!url || !token) return null;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([command, ...args])
  });

  if (!response.ok) {
    throw new Error(`KV ${command} failed with ${response.status}`);
  }

  const payload = await response.json().catch(() => ({}));
  return payload?.result ?? null;
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

export async function readRequestJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body);
  }
  return {};
}

export async function readJson(key, fallback) {
  const kvValue = await kvCommand('GET', key);
  if (kvValue !== null && kvValue !== undefined) {
    if (typeof kvValue === 'string') {
      try {
        return JSON.parse(kvValue);
      } catch {
        return fallback;
      }
    }
    return kvValue;
  }

  return memoryStore.has(key) ? memoryStore.get(key) : fallback;
}

export async function writeJson(key, value) {
  const serialized = JSON.stringify(value);
  const kvResult = await kvCommand('SET', key, serialized);
  memoryStore.set(key, value);
  return {
    mode: kvResult === null ? 'memory-fallback' : 'vercel-kv',
    persisted: kvResult !== null
  };
}

export function getStorageDescriptor(writeResult = null) {
  const { url, token } = getKvConfig();
  return {
    mode: writeResult?.mode || (url && token ? 'vercel-kv' : 'memory-fallback'),
    persisted: Boolean(writeResult?.persisted || (url && token)),
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
