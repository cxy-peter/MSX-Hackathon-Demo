import {
  applyCors,
  getStorageDescriptor,
  hashJson,
  readJson,
  readRequestJson,
  sendJson,
  sha256Hex,
  writeJson
} from './_risklensStorage.js';

const PROFILE_POINTER_KEY = 'risklens:profile:pointers:v1';

function safeText(value, fallback = '', maxLength = 160) {
  return String(value || fallback || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeAddress(value) {
  const address = String(value || '').trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(address) ? address : '';
}

function sanitizePointer(body = {}) {
  const address = normalizeAddress(body.address);
  const contentHash = safeText(body.contentHash || body.hash, '', 96);
  const cid = safeText(body.cid || body.cidReadyPointer || body.pointer, contentHash ? `sha256:${contentHash}` : '', 128);
  if (!address || (!contentHash && !cid)) return null;
  if (body.profile || body.rawProfile || body.walletProfile) {
    return { error: 'Raw wallet profiles are intentionally rejected. Store the encrypted payload on IPFS/Filecoin/Arweave and submit only its pointer.' };
  }

  return {
    walletHash: sha256Hex(address),
    cid,
    contentHash,
    signatureHash: body.signature ? sha256Hex(body.signature) : safeText(body.signatureHash, '', 96),
    network: safeText(body.network || 'IPFS/Filecoin-ready pointer', '', 80),
    updatedAt: new Date().toISOString(),
    integrityHash: hashJson({ addressHash: sha256Hex(address), cid, contentHash })
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      const pointers = await readJson(PROFILE_POINTER_KEY, {});
      sendJson(res, 200, {
        ok: true,
        pointers,
        storage: getStorageDescriptor()
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readRequestJson(req);
      const pointer = sanitizePointer(body);
      if (!pointer || pointer.error) {
        sendJson(res, 400, { ok: false, error: pointer?.error || 'Invalid profile pointer.' });
        return;
      }

      const current = await readJson(PROFILE_POINTER_KEY, {});
      const next = {
        ...current,
        [pointer.walletHash]: pointer
      };
      const storage = await writeJson(PROFILE_POINTER_KEY, next);
      sendJson(res, 200, {
        ok: true,
        pointer,
        storage: getStorageDescriptor(storage)
      });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || 'Profile pointer API failed.' });
  }
}
