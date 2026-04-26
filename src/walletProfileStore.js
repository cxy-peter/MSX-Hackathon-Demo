export const UNIFIED_PT_SYMBOL = 'PT';
export const UNIFIED_PT_STARTING_BALANCE = 100000;
export const UNIFIED_PT_MILESTONE_REWARD = 5000;
export const WALLET_PROFILE_VERSION = 1;

const PROFILE_KEY_PREFIX = 'msx-wallet-profile';
const PROFILE_POINTER_PREFIX = 'msx-wallet-profile-pointer';
const GUEST_ADDRESS = 'guest';
const PROFILE_STORAGE_ENDPOINT = import.meta.env.VITE_PROFILE_STORAGE_ENDPOINT || '';

function nowIso() {
  return new Date().toISOString();
}

function normalizeAddress(address) {
  return address ? String(address).toLowerCase() : GUEST_ADDRESS;
}

export function getWalletProfileKey(address) {
  return `${PROFILE_KEY_PREFIX}-${normalizeAddress(address)}`;
}

export function getWalletProfilePointerKey(address) {
  return `${PROFILE_POINTER_PREFIX}-${normalizeAddress(address)}`;
}

export function readStorageJson(key, fallback) {
  if (typeof window === 'undefined' || !key) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageJson(key, value) {
  if (typeof window === 'undefined' || !key) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function roundNumber(value, digits = 2) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
}

function safeParseStorageKey(key) {
  if (!key) return null;
  return readStorageJson(key, null);
}

function listStorageKeys() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const keys = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key) keys.push(key);
  }
  return keys;
}

function candidateAddressFromKey(key, prefix) {
  if (!key.startsWith(prefix)) return '';
  return key.slice(prefix.length).replace(/^-/, '').toLowerCase();
}

function collectCandidates(prefix, address) {
  const normalized = normalizeAddress(address);
  return listStorageKeys()
    .filter((key) => key.startsWith(prefix))
    .map((key) => ({
      key,
      address: candidateAddressFromKey(key, prefix),
      data: safeParseStorageKey(key)
    }))
    .filter((candidate) => candidate.address === normalized && isObject(candidate.data))
    .sort((left, right) => {
      const leftDirect = left.address === normalized ? 1 : 0;
      const rightDirect = right.address === normalized ? 1 : 0;
      if (leftDirect !== rightDirect) return rightDirect - leftDirect;
      return JSON.stringify(right.data).length - JSON.stringify(left.data).length;
    });
}

function pickBestCandidate(prefix, address, scoreFn) {
  const candidates = collectCandidates(prefix, address);
  if (!candidates.length) return null;
  return candidates
    .map((candidate) => ({ ...candidate, score: Number(scoreFn?.(candidate.data) || 0) }))
    .sort((left, right) => {
      const normalized = normalizeAddress(address);
      const leftDirect = left.address === normalized ? 1 : 0;
      const rightDirect = right.address === normalized ? 1 : 0;
      if (leftDirect !== rightDirect) return rightDirect - leftDirect;
      return right.score - left.score;
    })[0];
}

function scorePaperState(value) {
  const cash = Number(value?.cash ?? value?.balance ?? 0);
  const trades = Array.isArray(value?.trades) ? value.trades.length * 1000 : 0;
  const positions = isObject(value?.positions) ? Object.keys(value.positions).length * 500 : 0;
  return cash + trades + positions;
}

function scoreWealthState(value) {
  const cash = Number(value?.cash || 0);
  const positions = isObject(value?.positions)
    ? Object.values(value.positions).reduce((sum, position) => sum + Number(position?.principal || 0), 0)
    : 0;
  const activity = Array.isArray(value?.activityLog) ? value.activityLog.length * 500 : 0;
  return cash + positions + activity;
}

function normalizeProgress(value = {}) {
  return {
    viewedRiskCards: Array.isArray(value.viewedRiskCards) ? value.viewedRiskCards : [],
    guideCompleted: Boolean(value.guideCompleted),
    quizCompleted: Boolean(value.quizCompleted),
    paperTradesCompleted: Number(value.paperTradesCompleted || 0),
    homeOnboardingCompleted: Boolean(value.homeOnboardingCompleted || value.paperUnlocked),
    paperUnlocked: Boolean(value.paperUnlocked),
    adminUnlocked: Boolean(value.adminUnlocked),
    spotLessonCompleted: Boolean(value.spotLessonCompleted),
    leverageLessonCompleted: Boolean(value.leverageLessonCompleted),
    hedgeLessonCompleted: Boolean(value.hedgeLessonCompleted),
    hedgeSizingCompleted: Boolean(value.hedgeSizingCompleted),
    hedgePositiveCloseCompleted: Boolean(value.hedgePositiveCloseCompleted),
    userOrigin: value.userOrigin || '',
    web3Intent: value.web3Intent || '',
    web2Intent: value.web2Intent || ''
  };
}

function hasCrossWalletHistory(value = {}, address = '') {
  const normalized = normalizeAddress(address || value.address);
  const sourceAddresses = Array.isArray(value.history?.sourceAddresses) ? value.history.sourceAddresses : [];
  return (
    Boolean(value.history?.recoveredFromOtherWallet) ||
    sourceAddresses.some((sourceAddress) => sourceAddress && normalizeAddress(sourceAddress) !== normalized)
  );
}

function normalizeHomePaper(value = {}) {
  return {
    balance: roundNumber(Number(value.balance ?? value.cash ?? UNIFIED_PT_STARTING_BALANCE), 2),
    positions: isObject(value.positions) ? value.positions : {}
  };
}

function normalizePaperReplay(value = {}) {
  return {
    cash: roundNumber(Number(value.cash ?? UNIFIED_PT_STARTING_BALANCE), 2),
    positions: isObject(value.positions) ? value.positions : {},
    trades: Array.isArray(value.trades) ? value.trades : [],
    realizedPnl: roundNumber(Number(value.realizedPnl || 0), 2)
  };
}

function normalizeWealth(value = {}) {
  return {
    cash: roundNumber(Number(value.cash ?? UNIFIED_PT_STARTING_BALANCE), 2),
    positions: isObject(value.positions) ? value.positions : {},
    collateral: isObject(value.collateral) ? value.collateral : {},
    activityLog: Array.isArray(value.activityLog) ? value.activityLog : []
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sumPrincipal(positions = {}) {
  if (!isObject(positions)) return 0;
  return roundNumber(
    Object.values(positions).reduce((sum, position) => {
      const principal = Number(position?.principal ?? position?.grossNotional ?? 0);
      return sum + (Number.isFinite(principal) ? principal : 0);
    }, 0),
    2
  );
}

function sumBorrowed(collateral = {}) {
  if (!isObject(collateral)) return 0;
  return roundNumber(
    Object.values(collateral).reduce((sum, entry) => {
      const borrowed = Number(entry?.borrowedAmount || 0);
      return sum + (Number.isFinite(borrowed) ? borrowed : 0);
    }, 0),
    2
  );
}

export function collectLegacyWalletHistory(address) {
  const progressCandidate = pickBestCandidate('msx-progress-', address, (value) => {
    const progress = normalizeProgress(value);
    return (
      progress.viewedRiskCards.length * 300 +
      (progress.guideCompleted ? 700 : 0) +
      (progress.quizCompleted ? 700 : 0) +
      progress.paperTradesCompleted * 1000
    );
  });
  const homePaperCandidate = pickBestCandidate('msx-paper-state-', address, scorePaperState);
  const replayCandidate = pickBestCandidate('msx-paper-replay-state-', address, scorePaperState);
  const wealthCandidate = pickBestCandidate('msx-wealth-state-', address, scoreWealthState);
  const tradeHistoryCandidate = pickBestCandidate('msx.paperTradeOutcomeHistory-', address, (value) =>
    Array.isArray(value?.entries) ? value.entries.length * 1000 : 0
  );

  const sourceAddresses = unique([
    progressCandidate?.address,
    homePaperCandidate?.address,
    replayCandidate?.address,
    wealthCandidate?.address,
    tradeHistoryCandidate?.address
  ]);

  return {
    progress: normalizeProgress(progressCandidate?.data || {}),
    homePaper: normalizeHomePaper(homePaperCandidate?.data || {}),
    paperReplay: normalizePaperReplay(replayCandidate?.data || {}),
    wealth: normalizeWealth(wealthCandidate?.data || {}),
    tradeOutcomeHistory: tradeHistoryCandidate?.data || { entries: [] },
    sourceAddresses,
    recoveredFromOtherWallet: sourceAddresses.some((sourceAddress) => sourceAddress && sourceAddress !== normalizeAddress(address)),
    sourceKeys: unique([
      progressCandidate?.key,
      homePaperCandidate?.key,
      replayCandidate?.key,
      wealthCandidate?.key,
      tradeHistoryCandidate?.key
    ])
  };
}

export function normalizeWalletProfile(value = {}, address = '') {
  const normalizedAddress = normalizeAddress(address || value.address);
  const sourceAddresses = Array.isArray(value.history?.sourceAddresses)
    ? value.history.sourceAddresses
        .map((sourceAddress) => normalizeAddress(sourceAddress))
        .filter((sourceAddress) => sourceAddress === normalizedAddress)
    : [];
  const sourceKeys = Array.isArray(value.history?.sourceKeys)
    ? value.history.sourceKeys.filter((sourceKey) => String(sourceKey || '').toLowerCase().includes(normalizedAddress))
    : [];

  return {
    version: WALLET_PROFILE_VERSION,
    address: normalizedAddress,
    updatedAt: value.updatedAt || nowIso(),
    pt: {
      symbol: UNIFIED_PT_SYMBOL,
      startingBalance: UNIFIED_PT_STARTING_BALANCE,
      milestoneReward: UNIFIED_PT_MILESTONE_REWARD
    },
    progress: normalizeProgress(value.progress || {}),
    home: {
      paperBalanceSnapshot: roundNumber(Number(value.home?.paperBalanceSnapshot ?? UNIFIED_PT_STARTING_BALANCE), 2),
      userOrigin: value.home?.userOrigin || '',
      web3Intent: value.home?.web3Intent || '',
      web2Intent: value.home?.web2Intent || ''
    },
    paper: {
      state: normalizePaperReplay(value.paper?.state || {}),
      tradeOutcomeHistory: value.paper?.tradeOutcomeHistory || { entries: [] }
    },
    wealth: {
      state: normalizeWealth(value.wealth?.state || {})
    },
    storage: isObject(value.storage) ? value.storage : {},
    history: {
      sourceAddresses,
      sourceKeys,
      recoveredFromOtherWallet: false
    }
  };
}

export function readWalletProfile(address) {
  const rawExisting = readStorageJson(getWalletProfileKey(address), {});
  const existing = normalizeWalletProfile(
    hasCrossWalletHistory(rawExisting, address) ? { storage: rawExisting.storage || {} } : rawExisting,
    address
  );
  const legacy = collectLegacyWalletHistory(address);
  const merged = normalizeWalletProfile(
    {
      ...existing,
      progress: { ...legacy.progress, ...existing.progress },
      home: {
        paperBalanceSnapshot: Math.max(existing.home.paperBalanceSnapshot, legacy.homePaper.balance),
        userOrigin: existing.home.userOrigin || legacy.progress.userOrigin,
        web3Intent: existing.home.web3Intent || legacy.progress.web3Intent,
        web2Intent: existing.home.web2Intent || legacy.progress.web2Intent
      },
      paper: {
        state: scorePaperState(existing.paper.state) >= scorePaperState(legacy.paperReplay)
          ? existing.paper.state
          : legacy.paperReplay,
        tradeOutcomeHistory:
          Array.isArray(existing.paper.tradeOutcomeHistory?.entries) &&
          existing.paper.tradeOutcomeHistory.entries.length >= (legacy.tradeOutcomeHistory.entries || []).length
            ? existing.paper.tradeOutcomeHistory
            : legacy.tradeOutcomeHistory
      },
      wealth: {
        state: scoreWealthState(existing.wealth.state) >= scoreWealthState(legacy.wealth)
          ? existing.wealth.state
          : legacy.wealth
      },
      history: {
        sourceAddresses: unique([...(existing.history.sourceAddresses || []), ...legacy.sourceAddresses]),
        sourceKeys: unique([...(existing.history.sourceKeys || []), ...legacy.sourceKeys]),
        recoveredFromOtherWallet: existing.history.recoveredFromOtherWallet || legacy.recoveredFromOtherWallet
      },
      updatedAt: nowIso()
    },
    address
  );

  writeStorageJson(getWalletProfileKey(address), merged);
  return merged;
}

export function writeWalletProfilePatch(address, patch = {}) {
  const current = readWalletProfile(address);
  const next = normalizeWalletProfile(
    {
      ...current,
      ...patch,
      progress: { ...current.progress, ...(patch.progress || {}) },
      home: { ...current.home, ...(patch.home || {}) },
      paper: { ...current.paper, ...(patch.paper || {}) },
      wealth: { ...current.wealth, ...(patch.wealth || {}) },
      storage: { ...current.storage, ...(patch.storage || {}) },
      history: { ...current.history, ...(patch.history || {}) },
      updatedAt: nowIso()
    },
    address
  );
  writeStorageJson(getWalletProfileKey(address), next);
  return next;
}

export function readRecoveredHomePaperBalance(address, fallback = UNIFIED_PT_STARTING_BALANCE) {
  const profile = readWalletProfile(address);
  const summary = getWalletProfileSummary(profile);
  return roundNumber(Math.max(Number(fallback || 0), summary.availablePT), 2);
}

export function readRecoveredPaperState(address, fallback) {
  const profile = readWalletProfile(address);
  const hasPaperHistory = scorePaperState(profile.paper.state) > 0;
  const recovered = normalizePaperReplay(hasPaperHistory ? profile.paper.state : fallback);
  if (hasPaperHistory) return recovered;
  return {
    ...recovered,
    cash: roundNumber(Math.max(recovered.cash, getWalletProfileSummary(profile).availablePT), 2)
  };
}

export function readRecoveredWealthState(address, fallback) {
  const profile = readWalletProfile(address);
  const hasWealthHistory = scoreWealthState(profile.wealth.state) > 0;
  const recovered = normalizeWealth(hasWealthHistory ? profile.wealth.state : fallback);
  if (hasWealthHistory) return recovered;
  return {
    ...recovered,
    cash: roundNumber(Math.max(recovered.cash, getWalletProfileSummary(profile).availablePT), 2)
  };
}

export function getCompletedMilestoneCount(progress = {}) {
  const normalized = normalizeProgress(progress);
  return [
    true,
    normalized.guideCompleted || normalized.viewedRiskCards.length >= 3,
    normalized.quizCompleted,
    normalized.paperTradesCompleted > 0
  ].filter(Boolean).length;
}

export function getWalletProfileSummary(profile = {}) {
  const normalized = normalizeWalletProfile(profile, profile.address);
  const completedMilestones = getCompletedMilestoneCount(normalized.progress);
  const earnedPT = completedMilestones * UNIFIED_PT_MILESTONE_REWARD;
  const paperCash = roundNumber(normalized.paper.state.cash, 2);
  const wealthCash = roundNumber(normalized.wealth.state.cash, 2);
  const homePT = roundNumber(normalized.home.paperBalanceSnapshot, 2);
  const highestLocalCash = Math.max(homePT, paperCash, wealthCash);
  const availablePT = roundNumber(Math.max(UNIFIED_PT_STARTING_BALANCE + earnedPT, highestLocalCash), 2);
  const paperDeployedPT = sumPrincipal(normalized.paper.state.positions);
  const wealthDeployedPT = sumPrincipal(normalized.wealth.state.positions);
  const wealthBorrowedPT = sumBorrowed(normalized.wealth.state.collateral);
  const totalDeployedPT = roundNumber(paperDeployedPT + wealthDeployedPT, 2);
  const reservePT = roundNumber(Math.max(0, availablePT - totalDeployedPT + wealthBorrowedPT), 2);

  return {
    symbol: UNIFIED_PT_SYMBOL,
    basePT: UNIFIED_PT_STARTING_BALANCE,
    milestoneReward: UNIFIED_PT_MILESTONE_REWARD,
    completedMilestones,
    earnedPT,
    homePT,
    paperCash,
    wealthCash,
    availablePT,
    paperDeployedPT,
    wealthDeployedPT,
    wealthBorrowedPT,
    totalDeployedPT,
    reservePT,
    sourceWalletCount: normalized.history.sourceAddresses.length,
    recoveredFromOtherWallet: normalized.history.recoveredFromOtherWallet,
    updatedAt: normalized.updatedAt,
    storageMode: normalized.storage.mode || 'local-first',
    contentHash: normalized.storage.contentHash || ''
  };
}

async function sha256Hex(text) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

export async function buildProfileStorageRecord(address, profilePayload = {}, signature = '') {
  const profile = normalizeWalletProfile(profilePayload, address);
  const body = {
    kind: 'msx.wallet-profile.v1',
    address: normalizeAddress(address),
    createdAt: nowIso(),
    profile
  };
  const canonical = JSON.stringify(body);
  const contentHash = await sha256Hex(canonical);
  return {
    ...body,
    contentHash,
    cidReadyPointer: `sha256:${contentHash}`,
    signature,
    storagePlan: {
      local: getWalletProfileKey(address),
      mutablePointer: getWalletProfilePointerKey(address),
      recommendedNetwork: 'IPFS/Filecoin for active profile snapshots; Ceramic DID for mutable user profile; Arweave for permanent exports.'
    }
  };
}

export async function signAndStoreProfilePointer(address, profilePayload = {}, signMessageAsync) {
  const draft = await buildProfileStorageRecord(address, profilePayload);
  const message = [
    'MSX wallet profile backup',
    `Wallet: ${normalizeAddress(address)}`,
    `Content hash: ${draft.contentHash}`,
    `PT policy: ${UNIFIED_PT_STARTING_BALANCE} ${UNIFIED_PT_SYMBOL} base / ${UNIFIED_PT_MILESTONE_REWARD} ${UNIFIED_PT_SYMBOL} milestones`,
    'Purpose: authorize this app-state snapshot for decentralized storage. It does not recover private keys or seed phrases.'
  ].join('\n');
  const signature = signMessageAsync ? await signMessageAsync({ message }) : '';
  const record = { ...draft, signature };
  let remoteStorage = null;

  if (PROFILE_STORAGE_ENDPOINT) {
    const response = await fetch(PROFILE_STORAGE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    remoteStorage = response.ok
      ? await response.json().catch(() => ({ ok: true }))
      : { ok: false, status: response.status };
  }

  writeStorageJson(getWalletProfilePointerKey(address), record);
  writeWalletProfilePatch(address, {
    storage: {
      mode: remoteStorage?.ok || remoteStorage?.cid || remoteStorage?.url ? 'signed-remote-pointer' : 'signed-content-addressed-local',
      contentHash: record.contentHash,
      cidReadyPointer: record.cidReadyPointer,
      remote: remoteStorage,
      signedAt: record.createdAt,
      hasSignature: Boolean(signature)
    }
  });
  return { ...record, remote: remoteStorage };
}
