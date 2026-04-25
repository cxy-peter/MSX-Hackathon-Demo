import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const port = Number(process.env.PROFILE_STORAGE_PORT || 8787);
const storageDir = process.env.PROFILE_STORAGE_DIR || path.join(process.cwd(), '.msx-profile-storage');
const corsOrigin = process.env.PROFILE_STORAGE_CORS_ORIGIN || '*';
const pinataJwt = process.env.PINATA_JWT || '';
const pinataPinJsonUrl = process.env.PINATA_PIN_JSON_URL || 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

function respond(response, status, payload = {}) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        request.destroy(new Error('Payload too large'));
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function computeContentHash(record) {
  const body = {
    kind: record.kind,
    address: String(record.address || '').toLowerCase(),
    createdAt: record.createdAt,
    profile: record.profile
  };
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

function safePointerName(address) {
  return String(address || 'guest')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-');
}

async function maybePinToIpfs(record) {
  if (!pinataJwt) return null;

  const response = await fetch(pinataPinJsonUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pinataMetadata: {
        name: `msx-wallet-profile-${record.address}-${record.contentHash.slice(0, 12)}`
      },
      pinataContent: record
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      provider: 'pinata-ipfs',
      status: response.status,
      message: payload?.error?.reason || payload?.message || 'Pinning request failed'
    };
  }

  return {
    ok: true,
    provider: 'pinata-ipfs',
    cid: payload.IpfsHash || '',
    url: payload.IpfsHash ? `ipfs://${payload.IpfsHash}` : '',
    size: payload.PinSize || 0,
    timestamp: payload.Timestamp || ''
  };
}

async function storeProfile(record) {
  if (record.kind !== 'msx.wallet-profile.v1') {
    return { status: 400, body: { ok: false, message: 'Unsupported profile record kind' } };
  }

  const expectedHash = computeContentHash(record);
  if (!record.contentHash || record.contentHash !== expectedHash) {
    return {
      status: 400,
      body: {
        ok: false,
        message: 'Content hash mismatch',
        expectedHash
      }
    };
  }

  const snapshotsDir = path.join(storageDir, 'snapshots');
  const pointersDir = path.join(storageDir, 'pointers');
  await mkdir(snapshotsDir, { recursive: true });
  await mkdir(pointersDir, { recursive: true });

  const snapshotPath = path.join(snapshotsDir, `${record.contentHash}.json`);
  const pointerPath = path.join(pointersDir, `${safePointerName(record.address)}.json`);
  const serialized = `${JSON.stringify(record, null, 2)}\n`;

  await writeFile(snapshotPath, serialized, 'utf8');
  await writeFile(pointerPath, serialized, 'utf8');

  const remote = await maybePinToIpfs(record);

  return {
    status: 200,
    body: {
      ok: true,
      contentHash: record.contentHash,
      cidReadyPointer: record.cidReadyPointer,
      localSnapshot: snapshotPath,
      localPointer: pointerPath,
      remote,
      cid: remote?.cid || '',
      url: remote?.url || ''
    }
  };
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    respond(response, 204);
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    respond(response, 200, { ok: true, storageDir, pinningEnabled: Boolean(pinataJwt) });
    return;
  }

  if (request.method !== 'POST' || !['/profile', '/wallet-profile'].includes(request.url || '')) {
    respond(response, 404, { ok: false, message: 'Use POST /profile for wallet profile records' });
    return;
  }

  try {
    const record = await readJsonBody(request);
    const result = await storeProfile(record);
    respond(response, result.status, result.body);
  } catch (error) {
    respond(response, 500, { ok: false, message: error?.message || 'Profile storage failed' });
  }
});

server.listen(port, () => {
  console.log(`MSX profile storage gateway listening on http://127.0.0.1:${port}/profile`);
  console.log(`Local content-addressed records: ${storageDir}`);
  console.log(pinataJwt ? 'IPFS pinning: enabled via PINATA_JWT' : 'IPFS pinning: disabled; set PINATA_JWT to pin records');
});
