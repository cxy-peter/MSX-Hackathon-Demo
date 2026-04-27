import {
  applyCors,
  clampNumber,
  getStorageDescriptor,
  hashJson,
  readJson,
  readRequestJson,
  roundNumber,
  sendJson,
  writeJson
} from './_risklensStorage.js';

const REPLAY_KEY = 'risklens:paper:leaderboard:replay:v1';
const STRATEGY_KEY = 'risklens:paper:leaderboard:strategy:v1';
const MAX_REPLAY_ROWS = 80;
const MAX_STRATEGY_ROWS = 80;

function cleanText(value, fallback = '', maxLength = 140) {
  const text = String(value || fallback || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, maxLength);
}

function normalizeWalletAddress(value) {
  const address = String(value || '').trim().toLowerCase();
  if (/^0x[a-f0-9]{40}$/.test(address)) return address;
  return address === 'guest' ? 'guest' : '';
}

function sanitizePointer(pointer = {}) {
  const contentHash = cleanText(pointer.contentHash || pointer.hash || '', '', 96);
  const cid = cleanText(pointer.cid || pointer.cidReadyPointer || pointer.pointer || '', '', 128);
  if (!contentHash && !cid) return null;

  return {
    mode: 'decentralized-pointer',
    cid: cid || `sha256:${contentHash}`,
    contentHash,
    signatureHash: pointer.signatureHash ? cleanText(pointer.signatureHash, '', 96) : '',
    network: cleanText(pointer.network || 'IPFS/Filecoin-ready pointer', '', 80)
  };
}

function sanitizeReplayEntry(entry = {}, userPointer = null) {
  const walletAddress = normalizeWalletAddress(entry.walletAddress);
  if (!walletAddress) return null;
  const submittedAt = Number.isFinite(new Date(entry.submittedAt).getTime())
    ? new Date(entry.submittedAt).toISOString()
    : new Date().toISOString();
  const txHash = cleanText(entry.txHash, '', 96);

  return {
    version: Math.max(1, Number(entry.version || 1)),
    id: cleanText(entry.id || `${walletAddress}-${submittedAt}-${entry.netPnl || 0}`, '', 160),
    submittedAt,
    netPnl: roundNumber(entry.netPnl, 2),
    pnlPercent: roundNumber(entry.pnlPercent, 2),
    accountValue: roundNumber(entry.accountValue, 2),
    walletAddress,
    walletDisplayName: cleanText(entry.walletDisplayName || entry.displayAddress || walletAddress, walletAddress, 64),
    tradeCount: Math.max(0, Math.round(Number(entry.tradeCount || 0))),
    tradeLabel: cleanText(entry.tradeLabel, 'Replay score submitted', 120),
    tradeShortLabel: cleanText(entry.tradeShortLabel, 'Replay submit', 80),
    tradeTimestamp: cleanText(entry.tradeTimestamp, '', 64),
    productLabel: cleanText(entry.productLabel, 'Replay desk', 80),
    status: entry.status === 'pending' ? 'pending' : 'confirmed',
    txHash,
    hallOfFame: true,
    userStorage: sanitizePointer(entry.userStorage || userPointer)
  };
}

function replayStatusRank(status) {
  return status === 'confirmed' ? 2 : status === 'pending' ? 1 : 0;
}

function pickBetterReplay(left, right) {
  if (!left) return right;
  if (right.pnlPercent !== left.pnlPercent) return right.pnlPercent > left.pnlPercent ? right : left;
  if (replayStatusRank(right.status) !== replayStatusRank(left.status)) {
    return replayStatusRank(right.status) > replayStatusRank(left.status) ? right : left;
  }
  return new Date(right.submittedAt).getTime() > new Date(left.submittedAt).getTime() ? right : left;
}

function mergeReplayEntries(entries = []) {
  const byWallet = new Map();
  entries.map((entry) => sanitizeReplayEntry(entry)).filter(Boolean).forEach((entry) => {
    byWallet.set(entry.walletAddress, pickBetterReplay(byWallet.get(entry.walletAddress), entry));
  });
  return [...byWallet.values()]
    .sort((left, right) => {
      if (right.pnlPercent !== left.pnlPercent) return right.pnlPercent - left.pnlPercent;
      if (right.netPnl !== left.netPnl) return right.netPnl - left.netPnl;
      return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
    })
    .slice(0, MAX_REPLAY_ROWS);
}

function sanitizeFeature(feature = {}) {
  return {
    id: cleanText(feature.id || feature.label, 'feature', 48),
    label: cleanText(feature.label, 'Feature', 64),
    value: cleanText(feature.value, '', 80),
    copy: cleanText(feature.copy, '', 180)
  };
}

function sanitizeAllocation(row = {}) {
  return {
    productId: cleanText(row.productId, '', 64),
    ticker: cleanText(row.ticker || row.productId, '', 24),
    name: cleanText(row.name, '', 80),
    weightPct: clampNumber(row.weightPct, 0, 100)
  };
}

function sanitizeStrategyEntry(entry = {}, userPointer = null) {
  const walletAddress = normalizeWalletAddress(entry.walletAddress || 'guest') || 'guest';
  const submittedAt = Number.isFinite(new Date(entry.submittedAt).getTime())
    ? new Date(entry.submittedAt).toISOString()
    : new Date().toISOString();
  const id = cleanText(entry.id || `${walletAddress}-${submittedAt}-${entry.title || 'strategy'}`, '', 180);

  return {
    id,
    title: cleanText(entry.title, 'Strategy template', 160),
    prompt: cleanText(entry.prompt, '', 360),
    productLabel: cleanText(entry.productLabel, 'Replay product', 80),
    strategyLabel: cleanText(entry.strategyLabel, 'Strategy', 80),
    entryType: cleanText(entry.entryType, 'ai-template', 48),
    variantId: cleanText(entry.variantId, '', 64),
    variantLabel: cleanText(entry.variantLabel, '', 80),
    dateRange: cleanText(entry.dateRange, '', 80),
    walletAddress,
    walletDisplayName: cleanText(entry.walletDisplayName || entry.displayAddress || walletAddress, walletAddress, 64),
    submittedAt,
    features: Array.isArray(entry.features) ? entry.features.map(sanitizeFeature).filter((feature) => feature.value).slice(0, 8) : [],
    allocation: Array.isArray(entry.allocation) ? entry.allocation.map(sanitizeAllocation).filter((row) => row.productId && row.weightPct > 0).slice(0, 8) : [],
    winRate: clampNumber(entry.winRate, 0, 100),
    expectedReturnPct: clampNumber(entry.expectedReturnPct, -100, 200),
    maxDrawdownPct: clampNumber(entry.maxDrawdownPct, 0, 100),
    templateScore: clampNumber(entry.templateScore, 0, 100),
    userStorage: sanitizePointer(entry.userStorage || userPointer)
  };
}

function mergeStrategyEntries(entries = []) {
  const byId = new Map();
  entries.map((entry) => sanitizeStrategyEntry(entry)).filter(Boolean).forEach((entry) => {
    byId.set(entry.id, entry);
  });
  return [...byId.values()]
    .sort((left, right) => {
      if (right.templateScore !== left.templateScore) return right.templateScore - left.templateScore;
      if (right.expectedReturnPct !== left.expectedReturnPct) return right.expectedReturnPct - left.expectedReturnPct;
      if (left.maxDrawdownPct !== right.maxDrawdownPct) return left.maxDrawdownPct - right.maxDrawdownPct;
      return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
    })
    .slice(0, MAX_STRATEGY_ROWS);
}

async function readBoards() {
  const replayEntries = mergeReplayEntries(await readJson(REPLAY_KEY, []));
  const strategyEntries = mergeStrategyEntries(await readJson(STRATEGY_KEY, []));
  return {
    replay: { entries: replayEntries },
    strategy: { entries: strategyEntries },
    storage: getStorageDescriptor(),
    updatedAt: new Date().toISOString()
  };
}

async function submitBoardEntry(board, entry, userPointer) {
  if (board === 'strategy') {
    const sanitized = sanitizeStrategyEntry(entry, userPointer);
    if (!sanitized) return { error: 'Invalid strategy leaderboard entry.' };
    sanitized.integrityHash = hashJson({ ...sanitized, integrityHash: undefined });
    const current = await readJson(STRATEGY_KEY, []);
    const entries = mergeStrategyEntries([sanitized, ...current]);
    const storage = await writeJson(STRATEGY_KEY, entries);
    return { board: 'strategy', entry: sanitized, entries, storage };
  }

  const sanitized = sanitizeReplayEntry(entry, userPointer);
  if (!sanitized) return { error: 'Invalid replay leaderboard entry.' };
  sanitized.integrityHash = hashJson({ ...sanitized, integrityHash: undefined });
  const current = await readJson(REPLAY_KEY, []);
  const entries = mergeReplayEntries([sanitized, ...current]);
  const storage = await writeJson(REPLAY_KEY, entries);
  return { board: 'replay', entry: sanitized, entries, storage };
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      sendJson(res, 200, await readBoards());
      return;
    }

    if (req.method === 'POST') {
      const body = await readRequestJson(req);
      const board = body.board === 'strategy' ? 'strategy' : 'replay';
      const result = await submitBoardEntry(board, body.entry || {}, body.userPointer || null);
      if (result.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return;
      }

      const boards = await readBoards();
      sendJson(res, 200, {
        ok: true,
        submitted: result.entry,
        board: result.board,
        replay: boards.replay,
        strategy: boards.strategy,
        storage: getStorageDescriptor(result.storage),
        updatedAt: boards.updatedAt
      });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || 'Paper leaderboard API failed.' });
  }
}
