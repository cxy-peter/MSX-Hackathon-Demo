import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  WagmiProvider,
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useReadContracts,
  useSignMessage,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi';
import { isAddress } from 'viem';

import {
  BADGE_REWARD_TOKENS,
  MIN_PAPER_TRADE,
  PAPER_LANE_OPTIONS,
  PAPER_PRODUCTS,
  STARTING_PAPER_TOKENS,
  buildDefaultReplaySession,
  buildFallbackBars,
  getProductById,
  getRangeConfig,
  getRangeOptionsForInterval
} from './paperTradingConfig';
import { canUseRemoteReplay, fetchRemoteReplayBars, getReplayFallbackLabel } from './paperTradingData';
import { PAPER_PRODUCT_INSIGHTS } from './productInsightMeta';
import { buildDiligenceReport } from './diligence/report';
import { LanguageToggle, useDomTranslation, useUiLanguage } from './uiLanguage';
import {
  getWalletDisplayName,
  normalizeWalletNickname,
  readWalletNickname,
  WALLET_NICKNAME_MAX_LENGTH,
  writeWalletNickname
} from './walletNickname';
import { queryClient, wagmiConfig } from './wagmiSetup';
import {
  getWealthSpendableCash,
  getWalletProfilePointerKey,
  getWalletProfileSummary,
  readRecoveredPaperState,
  readWalletProfile,
  signAndStoreProfilePointer,
  writeWalletProfilePatch
} from './walletProfileStore';
import ReplayChartPanel from './ReplayChartPanel';

const SEPOLIA_CHAIN_ID = 11155111;
const BADGE_TYPES = {
  welcome: 1,
  wallet: 2,
  risk: 3,
  quiz: 4,
  paper: 5
};
const BADGE_CONTRACT_ADDRESS = import.meta.env.VITE_BADGE_CONTRACT_ADDRESS || '';
const REPLAY_BADGE_CONTRACT_ADDRESS = import.meta.env.VITE_REPLAY_BADGE_CONTRACT_ADDRESS || '';
const badgeContractConfigured = isAddress(BADGE_CONTRACT_ADDRESS);
const replayBadgeContractConfigured = isAddress(REPLAY_BADGE_CONTRACT_ADDRESS);
const PROFILE_BACKUP_POINTER_STORAGE_PREFIX = 'msx-wallet-profile-pointer-';
const REPLAY_BADGE_TYPES = {
  baseCheck: 6,
  leaderboard: 7,
  spotLoop: 8,
  perpLeverage: 9,
  protectiveHedge: 10
};
const REPLAY_ACHIEVEMENT_IDS = Object.values(REPLAY_BADGE_TYPES);
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REPLAY_PLAYBACK_MS = 700;
const REPLAY_SCORE_DAILY_LIMIT = 3;
const REPLAY_DEVELOPER_MODE =
  import.meta.env.DEV || String(import.meta.env.VITE_REPLAY_DEVELOPER_MODE || '').toLowerCase() === 'true';
const DEV_MODE_USERNAME = 'msxadmin';
const DEV_MODE_PASSWORD = 'msx2026';
const DEV_AUTH_STORAGE_KEY = 'msx-dev-auth';
const ADMIN_UNLOCK_STORAGE_PREFIX = 'msx-admin-unlock';
const PAPER_SHELF_PAGE_SIZE = 4;
const PAPER_REPLAY_FILLS_PAGE_SIZE = 5;
const DEFAULT_PAPER_WORKSPACE_HEIGHT = 920;
const PAPER_WORKSPACE_HEIGHT_MIN = 760;
const PAPER_WORKSPACE_HEIGHT_MAX = 1560;
const PAPER_WORKSPACE_HEIGHT_STORAGE_KEY = 'msx.paperWorkspaceHeightPx';
// Keep the left-column split on the last approved values from local storage,
// but do not expose the old tuning sliders anymore.
const DEFAULT_PAPER_SHELF_HEIGHT = 620;
const PAPER_SHELF_HEIGHT_MIN = 480;
const PAPER_SHELF_HEIGHT_MAX = 760;
const PAPER_SHELF_HEIGHT_STORAGE_KEY = 'msx.paperShelfHeightPx.v2';
const DEFAULT_PAPER_SHELF_SPLIT_OFFSET = 0;
const PAPER_SHELF_SPLIT_OFFSET_MIN = 0;
const PAPER_SHELF_SPLIT_OFFSET_MAX = 220;
const PAPER_SHELF_SPLIT_OFFSET_STORAGE_KEY = 'msx.paperShelfSplitOffsetPx.v3';
const PAPER_LEFT_COLUMN_GAP = 18;
const PAPER_TUTORIAL_PATH_MIN_HEIGHT = 180;
const PRODUCT_LEADERBOARD_FLOAT_STORAGE_KEY = 'msx.paperProductLeaderboardFloat';
const STRATEGY_TEMPLATE_LEADERBOARD_STORAGE_KEY = 'msx.paperStrategyTemplateLeaderboard.v1';
const AUTO_SELL_DOCK_STORAGE_KEY = 'msx.paperAutoSellDockOpen';
const AUTO_SELL_DOCK_FLOAT_STORAGE_KEY = 'msx.paperAutoSellDockFloat';
const PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP = 18;
const PRODUCT_LEADERBOARD_FLOAT_MIN_WIDTH = 320;
const PRODUCT_LEADERBOARD_FLOAT_MAX_WIDTH = 760;
const PRODUCT_LEADERBOARD_FLOAT_MIN_HEIGHT = 280;
const PRODUCT_LEADERBOARD_FLOAT_MAX_HEIGHT = 820;
const TRADE_OUTCOME_HISTORY_STORAGE_KEY = 'msx.paperTradeOutcomeHistory';
const TRADE_RECOVERY_GRANT_AMOUNT = 10000;
const TRADE_RECOVERY_GRANT_TRIGGER = 1000;
const TRADE_FIREWORK_BURST_COUNT = 18;
const TRADE_FIREWORK_LIFETIME_MS = 1800;
const PAPER_RISK_FILTERS = [
  { id: 'all', label: 'All risk' },
  { id: 'conservative', label: 'Low risk' },
  { id: 'balanced', label: 'Medium risk' },
  { id: 'aggressive', label: 'High risk' }
];
const PAPER_LOCKUP_FILTERS = [
  { id: 'all', label: 'All lockup' },
  { id: 'flex', label: 'Flexible exit' },
  { id: 'lockup', label: 'Can lock' }
];
const HIDDEN_REPLAY_PRODUCT_LANES = new Set(['yield', 'strategy', 'ai']);
const HIDDEN_REPLAY_LANE_TAB_IDS = new Set([]);
const HIDDEN_LEARNING_ROUTE_IDS = new Set(['routing', 'lending']);
const HIDDEN_PERP_FOCUS_IDS = new Set([]);
const DEFAULT_STRATEGY_AI_PROMPT =
  'Protect a BTC sleeve with a collar when volatility expands, keep upside capped, and exit if drawdown breaks 8%.';
const STRATEGY_AI_TEMPLATE_VARIANTS = [
  {
    id: 'balanced-guardrail',
    label: 'Balanced guardrail',
    shortLabel: 'Balanced',
    promptHint: 'Add position sizing, drawdown guardrails, and a defined rebalance or unwind rule.',
    featureIds: ['risk', 'exit', 'trend'],
    winRateShift: 4,
    expectedReturnShift: 0.6,
    maxDrawdownShift: -2.8,
    scoreShift: 5
  },
  {
    id: 'momentum-breakout',
    label: 'Momentum breakout',
    shortLabel: 'Momentum',
    promptHint: 'Favor trend confirmation, breakout entry, momentum continuation, and a trailing stop.',
    featureIds: ['trend', 'exit', 'risk'],
    winRateShift: -1,
    expectedReturnShift: 4.2,
    maxDrawdownShift: 3.4,
    scoreShift: 1
  },
  {
    id: 'income-carry',
    label: 'Income carry',
    shortLabel: 'Carry',
    promptHint: 'Focus on premium income, carry, funding spread, yield capture, and slow rebalance.',
    featureIds: ['carry', 'risk', 'exit'],
    winRateShift: 6,
    expectedReturnShift: 1.4,
    maxDrawdownShift: -4.6,
    scoreShift: 4
  },
  {
    id: 'options-defined-risk',
    label: 'Defined-risk options',
    shortLabel: 'Options',
    promptHint: 'Express the idea with option strikes, cap, floor, collar, premium, and payoff bands.',
    featureIds: ['options', 'risk', 'exit'],
    winRateShift: 2,
    expectedReturnShift: -0.4,
    maxDrawdownShift: -5.2,
    scoreShift: 3
  },
  {
    id: 'event-hedged',
    label: 'Event hedge',
    shortLabel: 'Event hedge',
    promptHint: 'Treat the setup as an event window with a hedge leg, stop loss, and post-event unwind.',
    featureIds: ['risk', 'leverage', 'exit'],
    winRateShift: 1,
    expectedReturnShift: 2.4,
    maxDrawdownShift: 1.8,
    scoreShift: 0
  }
];
const PORTFOLIO_COMBO_PRODUCT_IDS = ['aaplx', 'nvdax', 'msftx', 'googlx', 'tslax-public', 'spyx', 'qqqx'];
const PORTFOLIO_COMBO_DEFAULT_SELECTED_IDS = ['googlx', 'nvdax', 'spyx'];
const PORTFOLIO_COMBO_DEFAULT_WEIGHTS = {
  googlx: 45,
  nvdax: 25,
  spyx: 30
};
const PORTFOLIO_COMBO_DEFAULT_START_DATE = '2025-04-21';
const PORTFOLIO_COMBO_DEFAULT_END_DATE = '2026-04-21';
const PORTFOLIO_COMBO_WEIGHT_STEP = 10;
const PORTFOLIO_COMBO_MAX_SUGGESTION_ASSETS = 4;
const REPLAY_PRACTICE_CASE_CACHE_LIMIT = 96;
const REPLAY_PRACTICE_PREVIEW_SIZE_QUANTUM = 2500;
const REPLAY_PRACTICE_PREVIEW_RATE_QUANTUM = 0.5;
const REPLAY_PRACTICE_SCENARIO_CACHE_LIMIT = 96;
const REPLAY_PRACTICE_FAST_WINDOW_TARGET = 36;
const replayPracticeBarsSignatureCache = new WeakMap();
const replayPracticeCaseCache = new Map();
const replayPracticeScenarioCache = new Map();
const replayPracticeSafeBarsCache = new WeakMap();
const replayWindowScorecardCache = new WeakMap();
const portfolioComboBaseResultCache = new Map();
const portfolioComboWindowResultCache = new Map();
const portfolioComboLatestResultByName = new Map();
const PORTFOLIO_COMBO_RESULT_CACHE_LIMIT = 160;
const HEDGE_PROTECTION_EFFECTIVENESS = {
  direct: 1,
  basket: 0.75,
  proxy: 0.55,
  exit: 0.35,
  auto: 0.7
};
const HEDGE_TYPE_OPTIONS = [
  {
    id: 'auto',
    label: 'Auto type',
    shortLabel: 'Auto',
    tool: 'Product-default hedge',
    copy: 'Let the product layer choose the closest realistic hedge lane.',
    hint: 'Good when the user should learn the route before choosing hedge taxonomy.'
  },
  {
    id: 'direct',
    label: 'Direct hedge',
    shortLabel: 'Direct',
    tool: 'Short same wrapper / perp',
    copy: 'Use the same listed name, ETF, or closest liquid contract when the wrapper is publicly traded.',
    hint: 'Best for public wrappers where the price mark is continuous and the short instrument is liquid.'
  },
  {
    id: 'proxy',
    label: 'Proxy hedge',
    shortLabel: 'Proxy',
    tool: 'Short proxy ETF / beta basket',
    copy: 'Use a liquid proxy when the protected sleeve is private or cannot be shorted directly.',
    hint: 'Best when direct shorting is impossible; it softens broad beta but leaves basis risk.'
  },
  {
    id: 'exit',
    label: 'Exit hedge',
    shortLabel: 'Exit',
    tool: 'Redemption / staged sell plan',
    copy: 'Use cash, redemption, or liquidity planning to reduce forced-sale risk instead of pretending a perfect short exists.',
    hint: 'Best for treasury, cash, or redemption-led sleeves where the honest hedge is lowering exposure.'
  },
  {
    id: 'basket',
    label: 'Basket hedge',
    shortLabel: 'Basket',
    tool: 'Factor basket overlay',
    copy: 'Use a basket or factor overlay when the protected exposure is a strategy rather than one ticker.',
    hint: 'Best for strategy sleeves where the risk is a blend of factors, not one underlying ticker.'
  }
];
const HEDGE_TYPE_LABELS = Object.fromEntries(HEDGE_TYPE_OPTIONS.map((option) => [option.id, option.label]));
const OPTION_STRATEGY_DEFAULTS = {
  collar: {
    downsidePct: 12,
    profitHarvestPct: 35,
    upsideCapPct: 18,
    premiumPct: 1.2,
    strikePct: 10
  },
  'bear-collar': {
    downsidePct: 8,
    profitHarvestPct: 20,
    upsideCapPct: 6,
    premiumPct: 1.6,
    strikePct: 5
  },
  covered: {
    downsidePct: 50,
    profitHarvestPct: 70,
    upsideCapPct: 12,
    premiumPct: 2.4,
    strikePct: 12
  },
  'short-put': {
    downsidePct: 16,
    profitHarvestPct: 65,
    upsideCapPct: 60,
    premiumPct: 2.8,
    strikePct: 8
  },
  'protective-put': {
    downsidePct: 10,
    profitHarvestPct: 0,
    upsideCapPct: 60,
    premiumPct: 2.1,
    strikePct: 10
  }
};
const OPTION_STRATEGY_LABELS = {
  collar: 'Protected Growth',
  'bear-collar': 'Bear Collar',
  covered: 'Premium Income',
  'short-put': 'Short Put',
  'protective-put': 'Auto Hedge / Downside Floor'
};
const OPTION_STRATEGY_PARAMETER_LABELS = {
  default: {
    downside: 'Downside floor',
    harvest: 'Profit harvest',
    cap: 'Upside cap',
    premium: 'Option premium',
    strike: 'Strike OTM'
  },
  'bear-collar': {
    downside: 'Put floor',
    harvest: 'Call credit',
    cap: 'Call cap',
    premium: 'Net premium',
    strike: 'Call distance'
  },
  covered: {
    downside: 'Stress floor',
    harvest: 'Premium kept',
    cap: 'Call cap',
    premium: 'Call premium',
    strike: 'Call OTM'
  },
  'short-put': {
    downside: 'Stress floor',
    harvest: 'Premium kept',
    cap: 'Payoff cap',
    premium: 'Put premium',
    strike: 'Put OTM'
  },
  'protective-put': {
    downside: 'Put floor',
    harvest: 'Profit harvest',
    cap: 'Upside kept',
    premium: 'Put premium',
    strike: 'Put OTM'
  }
};
const WEALTH_SURFACE_REPLAY_PRODUCT_IDS = new Set(['msx-income-ladder']);
const REPLAY_PRODUCTS = PAPER_PRODUCTS.filter(
  (product) => !WEALTH_SURFACE_REPLAY_PRODUCT_IDS.has(product.id) && !HIDDEN_REPLAY_PRODUCT_LANES.has(product.lane)
);
const REPLAY_LANE_OPTIONS = PAPER_LANE_OPTIONS.filter(
  (lane) => !HIDDEN_REPLAY_LANE_TAB_IDS.has(lane.id) && (lane.id === 'all' || REPLAY_PRODUCTS.some((product) => product.lane === lane.id))
);
const DEFAULT_REPLAY_PRODUCT = REPLAY_PRODUCTS.find((product) => product.lane === 'spot') || REPLAY_PRODUCTS[0] || null;
const SEC_SECTION31_DOLLARS_PER_MILLION = 20.6;
const FINRA_TAF_EQUITY_PER_SHARE = 0.000195;
const FINRA_TAF_EQUITY_MAX_PER_TRADE = 9.79;
const KRAKEN_PERP_APP_TAKER_FEE_RATE = 0.0025;
const KRAKEN_PERP_FUNDING_RATE_PER_8H = 0.0001;
const REPLAY_SPOT_MANAGEMENT_FEE_FALLBACK_RATE = 0.004;
const REPLAY_STRATEGY_MANAGEMENT_FEE_RATE = 0.006;
const REPLAY_PERP_MANAGEMENT_FEE_RATE = 0.0075;
const REPLAY_PRACTICE_DRAWDOWN_PENALTY_FACTOR = 0.45;
const AAVE_FLASH_LOAN_PREMIUM_RATE = 0.0009;
const PERP_MAINTENANCE_MARGIN_FLOOR_RATE = 0.01;
const FLASH_LIQUIDITY_QUOTE_LANE_META = [
  {
    id: 'ticket',
    label: 'Ticket-bound flash top-up',
    purpose: 'Attested venue route'
  },
  {
    id: 'general',
    label: 'Broad flash credit',
    purpose: 'Unrestricted use'
  }
];
const FLASH_TICKET_ATTESTED_SURCHARGE_RATE = 0.00035;
const FLASH_LEVERAGE_INTENT_SURCHARGE_RATE = 0.00075;
const FLASH_TICKET_RESERVE_RATE = 0.025;
const FLASH_GENERAL_SURCHARGE_RATE = 0.0018;
const FLASH_SIZE_SURCHARGE_BUCKETS = [
  { maxNotional: 2500, surchargeRate: 0 },
  { maxNotional: 10000, surchargeRate: 0.0004 },
  { maxNotional: Infinity, surchargeRate: 0.0009 }
];
const PERP_MARGIN_BUFFER_BUCKETS = [
  { maxNotional: 2500, extraRate: 0 },
  { maxNotional: 10000, extraRate: 0.01 },
  { maxNotional: Infinity, extraRate: 0.02 }
];
const FLASH_COLLATERAL_PLEDGE_SUPPORT = 750;
const FLASH_COLLATERAL_BORROW_HAIRCUT = 0.5;
const FLASH_ATTESTED_SUPPORT_MULTIPLIER = 1.15;
const FLASH_GENERAL_SUPPORT_MULTIPLIER = 0.55;
const DEFAULT_COST_MODEL = {
  makerFeeBps: 8,
  takerFeeBps: 10,
  tradeFeeBps: 10,
  spreadBps: 8,
  fxBps: 0,
  channelBps: 0,
  annualCarryBps: 0,
  regulatoryClass: 'none',
  secFeeDollarsPerMillion: SEC_SECTION31_DOLLARS_PER_MILLION,
  tafPerShare: FINRA_TAF_EQUITY_PER_SHARE,
  tafMaxPerTrade: FINRA_TAF_EQUITY_MAX_PER_TRADE,
  shortTermTaxRate: 0.24,
  longTermTaxRate: 0.15,
  incomeTaxRate: 0.24,
  taxTreatment: 'capital-gains'
};

const welcomeBadgeAbi = [
  {
    type: 'function',
    name: 'hasMinted',
    stateMutability: 'view',
    inputs: [{ name: 'holder', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'hasMintedTask',
    stateMutability: 'view',
    inputs: [
      { name: 'holder', type: 'address' },
      { name: 'badgeType', type: 'uint8' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
];

const replayAchievementAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'achievementId', type: 'uint256' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'submitScore',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'netPnl', type: 'int256' },
      { name: 'accountValue', type: 'uint256' },
      { name: 'tradeCount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'hasSubmittedScore',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  }
];

function shortAddress(address) {
  if (!address) return 'Not connected';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortAddressWithNickname(address) {
  return getWalletDisplayName(address, readWalletNickname(address), shortAddress);
}

function profileBackupTimeValue(value) {
  const time = new Date(value || '').getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatProfileBackupSignedAt(value) {
  const time = profileBackupTimeValue(value);
  return time ? new Date(time).toLocaleString() : 'unsaved time';
}

function listProfileBackupAccounts() {
  if (typeof window === 'undefined' || !window.localStorage) return [];

  const accounts = [];
  const seen = new Set();
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(PROFILE_BACKUP_POINTER_STORAGE_PREFIX)) continue;

    const record = readStorageJson(key, null);
    const recordAddress = String(record?.address || record?.profile?.address || key.slice(PROFILE_BACKUP_POINTER_STORAGE_PREFIX.length) || '').toLowerCase();
    if (!recordAddress || recordAddress === 'guest' || seen.has(recordAddress) || !record?.profile) continue;

    const summary = getWalletProfileSummary(record.profile);
    const nickname = readWalletNickname(recordAddress);
    const signedAt = record.createdAt || record.profile?.storage?.signedAt || '';
    seen.add(recordAddress);
    accounts.push({
      address: recordAddress,
      label: getWalletDisplayName(recordAddress, nickname, shortAddress),
      signedAt,
      signedLabel: formatProfileBackupSignedAt(signedAt),
      availablePT: summary.availablePT
    });
  }

  return accounts.sort((left, right) => profileBackupTimeValue(right.signedAt) - profileBackupTimeValue(left.signedAt));
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function useDebouncedValue(value, delayMs = 120) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      startTransition(() => setDebouncedValue(value));
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}

function getFlashSizeSurchargeRate(notional = 0) {
  const safeNotional = Math.max(0, Number(notional || 0));
  return FLASH_SIZE_SURCHARGE_BUCKETS.find((bucket) => safeNotional <= bucket.maxNotional)?.surchargeRate || 0;
}

function getPerpMarginBufferRate(notional = 0, leverage = 1) {
  const safeLeverage = Math.max(1, Number(leverage || 1));
  if (safeLeverage <= 1) return 0;

  const bucketRate = PERP_MARGIN_BUFFER_BUCKETS.find((bucket) => Math.max(0, Number(notional || 0)) <= bucket.maxNotional)?.extraRate || 0;
  return roundNumber(bucketRate + Math.max(0, safeLeverage - 1) * 0.0025, 4);
}

function getPerpInitialMarginRate(notional = 0, leverage = 1) {
  const safeLeverage = Math.max(1, Number(leverage || 1));
  if (safeLeverage <= 1) return 1;
  return roundNumber(Math.min(1, 1 / safeLeverage + getPerpMarginBufferRate(notional, safeLeverage)), 4);
}

function getWalletBackedPerpNotionalCap(availableCash = 0, leverage = 1) {
  const safeCash = Math.max(0, Number(availableCash || 0));
  const safeLeverage = Math.max(1, Number(leverage || 1));
  if (safeLeverage <= 1) return roundNumber(safeCash, 2);

  for (const bucket of PERP_MARGIN_BUFFER_BUCKETS) {
    const initialMarginRate = roundNumber(
      Math.min(1, 1 / safeLeverage + Number(bucket.extraRate || 0) + Math.max(0, safeLeverage - 1) * 0.0025),
      4
    );
    if (initialMarginRate <= 0) continue;
    const candidate = roundNumber(safeCash / initialMarginRate, 2);
    if (candidate <= Number(bucket.maxNotional || 0) || bucket.maxNotional === Infinity) {
      return candidate;
    }
  }

  return roundNumber(safeCash, 2);
}

function getWalletAndFlashPerpNotionalCap({
  availableCash = 0,
  initialMarginRate = 0,
  flashBudget = 0,
  reserveRate = 0,
  reserveBackingValue = availableCash
}) {
  const safeCash = Math.max(0, Number(availableCash || 0));
  const safeInitialRate = Math.max(0, Number(initialMarginRate || 0));
  const safeReserveRate = Math.max(0, Number(reserveRate || 0));
  const safeReserveBacking = Math.max(0, Number(reserveBackingValue || 0));
  const usableFlash = roundNumber(
    Math.min(
      Math.max(0, Number(flashBudget || 0)),
      safeReserveRate > 0 ? safeReserveBacking / safeReserveRate : Math.max(0, Number(flashBudget || 0))
    ),
    2
  );
  const nonCashReserveSupport = Math.max(0, safeReserveBacking - safeCash);
  const cashReserveUse = Math.max(0, usableFlash * safeReserveRate - nonCashReserveSupport);
  const cashAfterFlashReserve = roundNumber(Math.max(0, safeCash - cashReserveUse), 2);
  const walletNotional = safeInitialRate > 0 ? cashAfterFlashReserve / safeInitialRate : cashAfterFlashReserve;

  return roundNumber(usableFlash + walletNotional, 2);
}

function buildFlashLiquidityQuoteRows({
  leverageMultiple = 1,
  tradeAmount = 0,
  routeBaseNotional = 0,
  availableCash = 0,
  reserveBackingValue = availableCash,
  extraCollateralSupport = 0,
  reservedNotionalById = {},
  reservedTotalNotional = 0,
  wealthDeskState = {},
  draftQuotes = {},
  appliedQuotes = {}
}) {
  const safeLeverage = Math.max(1, Number(leverageMultiple || 1));
  const safeTradeAmount = Math.max(0, Number(tradeAmount || 0));
  const safeBaseNotional = Math.max(0, Number(routeBaseNotional || 0));
  const wealthCash = Math.max(0, Number(wealthDeskState?.wealthCash || 0));
  const pledgedProducts = Math.max(0, Number(wealthDeskState?.pledgedProducts || 0));
  const collateralBorrowed = Math.max(0, Number(wealthDeskState?.collateralBorrowed || 0));
  const collateralSupport = roundNumber(
    Math.max(
      0,
      Number(availableCash || 0) +
        Number(extraCollateralSupport || 0) +
        wealthCash * 0.12 +
        pledgedProducts * FLASH_COLLATERAL_PLEDGE_SUPPORT -
        collateralBorrowed * FLASH_COLLATERAL_BORROW_HAIRCUT
    ),
    2
  );
  const leverageIntentRate = safeLeverage > 1 ? FLASH_LEVERAGE_INTENT_SURCHARGE_RATE : 0;
  const reserveBackedCap = roundNumber(
    FLASH_TICKET_RESERVE_RATE > 0 ? Math.max(0, Number(reserveBackingValue || 0)) / FLASH_TICKET_RESERVE_RATE : safeTradeAmount,
    2
  );
  const effectiveReserveBackedCap = roundNumber(Math.max(0, reserveBackedCap - Number(reservedTotalNotional || 0)), 2);
  const ticketSupportCap = roundNumber(
    Math.max(0, collateralSupport * Math.max(1, safeLeverage * FLASH_ATTESTED_SUPPORT_MULTIPLIER)),
    2
  );
  const generalSupportCap = roundNumber(
    Math.max(0, collateralSupport * FLASH_GENERAL_SUPPORT_MULTIPLIER),
    2
  );
  const ticketCap = roundNumber(
    Math.min(
      effectiveReserveBackedCap,
      ticketSupportCap
    ),
    2
  );
  const generalCap = roundNumber(
    Math.min(effectiveReserveBackedCap, generalSupportCap),
    2
  );

  return FLASH_LIQUIDITY_QUOTE_LANE_META.map((lane) => {
    const reservedLaneNotional = roundNumber(Math.max(0, Number(reservedNotionalById?.[lane.id] || 0)), 2);
    const laneReserveCap = lane.id === 'ticket' ? ticketCap : generalCap;
    const rawSupportCap = lane.id === 'ticket' ? ticketSupportCap : generalSupportCap;
    const maxAvailableNotional = roundNumber(Math.max(0, Math.min(laneReserveCap, rawSupportCap - reservedLaneNotional)), 2);
    const draftNotional = roundNumber(Math.min(Math.max(0, Number(draftQuotes?.[lane.id] || 0)), maxAvailableNotional), 2);
    const appliedNotional = roundNumber(Math.min(Math.max(0, Number(appliedQuotes?.[lane.id] || 0)), maxAvailableNotional), 2);
    const sizeReferenceNotional = Math.max(draftNotional, appliedNotional);
    const sizeSurcharge = getFlashSizeSurchargeRate(sizeReferenceNotional);
    const baseRate =
      lane.id === 'ticket'
        ? AAVE_FLASH_LOAN_PREMIUM_RATE + FLASH_TICKET_ATTESTED_SURCHARGE_RATE + leverageIntentRate
        : AAVE_FLASH_LOAN_PREMIUM_RATE + FLASH_GENERAL_SURCHARGE_RATE + leverageIntentRate;
    const rate = roundNumber(baseRate + sizeSurcharge, 5);
    const supportCap = roundNumber(Math.max(0, rawSupportCap - reservedLaneNotional), 2);
    const copy =
      lane.id === 'ticket'
        ? safeLeverage > 1
          ? 'Purpose is bound to this exchange route and signed leverage intent, so the credit can still be used across eligible products when the venue proves they serve the same leverage or hedge objective.'
          : 'Purpose is bound to this exchange route and signed order intent, so the route can use the lower attested premium across eligible same-purpose products.'
        : 'This credit is not restricted to the provable exchange route. It may be reused elsewhere, so it stays more expensive until a contract or restricted subaccount can prove the same purpose.';

    return {
      ...lane,
      rate,
      baseRate,
      sizeSurcharge,
      draftNotional,
      appliedNotional,
      draftPremium: roundNumber(draftNotional * rate, 2),
      appliedPremium: roundNumber(appliedNotional * rate, 2),
      maxAvailableNotional,
      reserveBackedCap: effectiveReserveBackedCap,
      grossReserveBackedCap: reserveBackedCap,
      supportCap,
      grossSupportCap: rawSupportCap,
      reservedLaneNotional,
      reservedTotalNotional,
      collateralSupport,
      copy
    };
  });
}

function getFlashLiquidityTotalBudget(laneRows = []) {
  if (!laneRows.length) return 0;

  const reserveBudget = Math.max(0, ...laneRows.map((row) => Number(row.reserveBackedCap || 0)));
  const laneSupportBudget = laneRows.reduce((sum, row) => sum + Number(row.maxAvailableNotional || 0), 0);
  return roundNumber(Math.min(reserveBudget, laneSupportBudget), 2);
}

function getFlashTopUpRequiredForTarget({
  targetNotional = 0,
  availableCash = 0,
  initialMarginRate = 0,
  reserveRate = 0,
  reserveBackingValue = availableCash
}) {
  const safeTarget = Math.max(0, Number(targetNotional || 0));
  const safeCash = Math.max(0, Number(availableCash || 0));
  const safeInitialRate = Math.max(0, Number(initialMarginRate || 0));
  const safeReserveRate = Math.max(0, Number(reserveRate || 0));
  const nonCashReserveSupport = Math.max(0, Number(reserveBackingValue || 0) - safeCash);
  const walletOnlyMargin = safeTarget * safeInitialRate;

  if (safeTarget <= 0 || walletOnlyMargin <= safeCash) return 0;

  if (safeInitialRate <= 0) return safeTarget;

  const noCashReserveCandidate = roundNumber(Math.min(safeTarget, Math.max(0, safeTarget - safeCash / safeInitialRate)), 2);
  if (noCashReserveCandidate * safeReserveRate <= nonCashReserveSupport + 0.01) {
    return noCashReserveCandidate;
  }

  if (safeInitialRate <= safeReserveRate) return safeTarget;

  return roundNumber(Math.min(safeTarget, Math.max(0, (walletOnlyMargin - nonCashReserveSupport - safeCash) / (safeInitialRate - safeReserveRate))), 2);
}

function allocateFlashQuotesByRate(requestedById = {}, maxTotal = 0, laneRows = [], maxById = {}) {
  const cappedTotal = Math.max(0, Number(maxTotal || 0));
  let remaining = cappedTotal;
  const next = {};

  [...laneRows]
    .sort((left, right) => left.rate - right.rate)
    .forEach((lane) => {
      const requested = Math.max(0, Number(requestedById?.[lane.id] || 0));
      const laneCap = Math.max(0, Number(maxById?.[lane.id] ?? lane.maxAvailableNotional ?? cappedTotal));
      const applied = roundNumber(Math.min(requested, remaining, laneCap), 2);
      next[lane.id] = applied;
      remaining = roundNumber(Math.max(0, remaining - applied), 2);
    });

  return next;
}

function getProductLeaderboardViewport() {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900 };
  }

  return {
    width: Math.max(1080, Number(window.innerWidth || 1440)),
    height: Math.max(720, Number(window.innerHeight || 900))
  };
}

function buildDefaultProductLeaderboardFloat(viewport = getProductLeaderboardViewport()) {
  const maxWidth = Math.max(
    PRODUCT_LEADERBOARD_FLOAT_MIN_WIDTH,
    Math.min(PRODUCT_LEADERBOARD_FLOAT_MAX_WIDTH, viewport.width - PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP * 2)
  );
  const maxHeight = Math.max(
    PRODUCT_LEADERBOARD_FLOAT_MIN_HEIGHT,
    Math.min(PRODUCT_LEADERBOARD_FLOAT_MAX_HEIGHT, viewport.height - PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP * 2 - 48)
  );
  const width = clampNumber(420, PRODUCT_LEADERBOARD_FLOAT_MIN_WIDTH, maxWidth);
  const height = clampNumber(540, PRODUCT_LEADERBOARD_FLOAT_MIN_HEIGHT, maxHeight);

  return {
    isCollapsed: false,
    left: Math.max(PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP, viewport.width - width - 28),
    top: clampNumber(180, 72, Math.max(72, viewport.height - height - PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP)),
    width,
    height,
    arrowSide: 'right',
    arrowTop: clampNumber(280, 72, Math.max(72, viewport.height - 72))
  };
}

function getCollapsedProductLeaderboardAnchor(layout, viewport = getProductLeaderboardViewport()) {
  const side = layout.left + layout.width / 2 <= viewport.width / 2 ? 'left' : 'right';
  return {
    arrowSide: side,
    arrowTop: clampNumber(layout.top + Math.min(48, layout.height / 2), 72, Math.max(72, viewport.height - 72))
  };
}

function normalizeProductLeaderboardFloat(payload, viewport = getProductLeaderboardViewport()) {
  const fallback = buildDefaultProductLeaderboardFloat(viewport);
  const maxWidth = Math.max(
    PRODUCT_LEADERBOARD_FLOAT_MIN_WIDTH,
    Math.min(PRODUCT_LEADERBOARD_FLOAT_MAX_WIDTH, viewport.width - PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP * 2)
  );
  const maxHeight = Math.max(
    PRODUCT_LEADERBOARD_FLOAT_MIN_HEIGHT,
    Math.min(PRODUCT_LEADERBOARD_FLOAT_MAX_HEIGHT, viewport.height - PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP * 2 - 48)
  );
  const widthCandidate = Number(payload?.width);
  const heightCandidate = Number(payload?.height);
  const width = Number.isFinite(widthCandidate)
    ? clampNumber(widthCandidate, PRODUCT_LEADERBOARD_FLOAT_MIN_WIDTH, maxWidth)
    : fallback.width;
  const height = Number.isFinite(heightCandidate)
    ? clampNumber(heightCandidate, PRODUCT_LEADERBOARD_FLOAT_MIN_HEIGHT, maxHeight)
    : fallback.height;
  const maxLeft = Math.max(PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP, viewport.width - width - PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP);
  const maxTop = Math.max(72, viewport.height - height - PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP);
  const leftCandidate = Number(payload?.left);
  const topCandidate = Number(payload?.top);
  const arrowTopCandidate = Number(payload?.arrowTop);

  return {
    isCollapsed: Boolean(payload?.isCollapsed),
    left: Number.isFinite(leftCandidate)
      ? clampNumber(leftCandidate, PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP, maxLeft)
      : fallback.left,
    top: Number.isFinite(topCandidate)
      ? clampNumber(topCandidate, 72, maxTop)
      : fallback.top,
    width,
    height,
    arrowSide: payload?.arrowSide === 'left' ? 'left' : 'right',
    arrowTop: Number.isFinite(arrowTopCandidate)
      ? clampNumber(arrowTopCandidate, 72, Math.max(72, viewport.height - 72))
      : fallback.arrowTop
  };
}

function buildDefaultAutoSellDockFloat(viewport = getProductLeaderboardViewport()) {
  const base = buildDefaultProductLeaderboardFloat(viewport);
  const width = clampNumber(455, PRODUCT_LEADERBOARD_FLOAT_MIN_WIDTH, Math.min(PRODUCT_LEADERBOARD_FLOAT_MAX_WIDTH, viewport.width - PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP * 2));
  const height = clampNumber(580, PRODUCT_LEADERBOARD_FLOAT_MIN_HEIGHT, Math.min(PRODUCT_LEADERBOARD_FLOAT_MAX_HEIGHT, viewport.height - PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP * 2 - 48));

  return {
    ...base,
    width,
    height,
    left: Math.max(PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP, viewport.width - width - 28),
    top: clampNumber(180, 72, Math.max(72, viewport.height - height - PRODUCT_LEADERBOARD_FLOAT_EDGE_GAP)),
    arrowSide: 'right',
    arrowTop: clampNumber(300, 72, Math.max(72, viewport.height - 72))
  };
}

function normalizeAutoSellDockFloat(payload, viewport = getProductLeaderboardViewport()) {
  const fallback = buildDefaultAutoSellDockFloat(viewport);
  return normalizeProductLeaderboardFloat(
    {
      ...fallback,
      ...(payload || {})
    },
    viewport
  );
}

function readStorageJson(key, fallback) {
  if (typeof window === 'undefined' || !key) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorageJson(key, value) {
  if (typeof window === 'undefined' || !key) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function detectMetaMaskProvider() {
  if (typeof window === 'undefined') return null;

  const { ethereum } = window;
  if (!ethereum) return null;

  if (ethereum.providers?.length) {
    return ethereum.providers.find((provider) => provider?.isMetaMask) || null;
  }

  return ethereum.isMetaMask ? ethereum : null;
}

function MetaMaskIcon({ className = '' }) {
  return (
    <div className={`metamask-icon ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 212 189" role="img">
        <polygon points="50,10 106,52 80,112 38,100" fill="#e17726" />
        <polygon points="162,10 106,52 132,112 174,100" fill="#e27625" />
        <polygon points="68,118 96,142 72,166 48,136" fill="#e27625" />
        <polygon points="144,118 116,142 140,166 164,136" fill="#e27625" />
        <polygon points="82,118 106,96 130,118 106,136" fill="#d7c1b3" />
        <polygon points="80,112 106,96 132,112 106,124" fill="#f6851b" />
        <polygon points="58,64 80,112 106,96 86,82" fill="#763d16" />
        <polygon points="154,64 132,112 106,96 126,82" fill="#763d16" />
      </svg>
    </div>
  );
}

function WalletModal({
  open,
  onClose,
  onConnect,
  onDisconnect,
  onSaveNickname,
  isPending,
  isConnected,
  address,
  walletDisplayName,
  nicknameDraft,
  onNicknameDraftChange,
  nicknameFeedback,
  errorText,
  hasMetaMaskInstalled,
  isProfileSigning = false,
  profileBackupAccounts = [],
  selectedProfileBackupAddress = '',
  onSelectedProfileBackupAddressChange,
  onSignProfileBackup,
  onRecoverSelectedProfileBackup,
  profileBackupSummaryText
}) {
  if (!open) return null;

  return (
    <div className="wallet-modal-backdrop" onClick={(event) => event.target === event.currentTarget && !isPending && onClose()}>
      <div className="wallet-modal">
        <button className="wallet-modal-close" onClick={onClose} disabled={isPending} aria-label="Close wallet modal">
          X
        </button>
        <div className="wallet-modal-pane wallet-modal-sidebar">
          <div className="wallet-modal-title">RiskLens Wallet Access</div>
          <div className="wallet-modal-subtitle">Replay Layer</div>
          <button
            className={`wallet-option ${isConnected ? 'connected' : ''} ${isPending || (!isConnected && !hasMetaMaskInstalled) ? 'disabled' : ''}`}
            onClick={isConnected ? onDisconnect : onConnect}
            disabled={isPending || (!isConnected && !hasMetaMaskInstalled)}
          >
            <MetaMaskIcon className="wallet-option-icon" />
            <div>
              <div className="wallet-option-title">{isConnected ? 'MetaMask connected' : 'MetaMask'}</div>
              <div className="wallet-option-copy">
                {isConnected
                  ? `Wallet connected ${walletDisplayName}. Click again to disconnect.`
                  : !hasMetaMaskInstalled
                    ? 'Install browser extension first'
                    : isPending
                      ? 'Waiting for wallet approval'
                      : 'Connect browser wallet'}
              </div>
            </div>
          </button>
          {!hasMetaMaskInstalled ? (
            <div className="wallet-install-card">
              <div className="wallet-install-title">MetaMask not detected</div>
              <div className="wallet-install-copy">
                Go to the official MetaMask website, install the browser extension, add it to your browser extensions, and pin it to the toolbar before any connection, permission, or mint action.
              </div>
              <a
                className="secondary-btn wallet-install-btn"
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
              >
                Open MetaMask official site
              </a>
            </div>
          ) : null}
        </div>
        <div className={`wallet-modal-pane wallet-modal-main ${isConnected ? 'wallet-modal-main-connected' : ''}`}>
          <MetaMaskIcon className="wallet-modal-hero wallet-modal-hero-metamask" />
          <div className="wallet-modal-status">
            {isConnected
              ? 'Wallet connected'
              : !hasMetaMaskInstalled
                ? 'Install MetaMask first'
                : isPending
                  ? 'Confirm connection in MetaMask'
                  : 'Connect with MetaMask'}
          </div>
          <div className="wallet-modal-copy">
            {isConnected
              ? `This replay page is now authenticated with wallet ${walletDisplayName}.`
              : !hasMetaMaskInstalled
                ? 'This browser has not exposed a MetaMask wallet yet. Open the official MetaMask website, install the browser extension, pin it in the browser toolbar, then reopen this wallet panel and connect again.'
                : isPending
                  ? 'A real wallet connection request was sent. Approve it in the MetaMask extension popup, then this page will update automatically.'
                  : 'Select MetaMask to trigger a real wallet approval flow, like the live RiskLens platform experience.'}
          </div>
          {hasMetaMaskInstalled ? (
            <div className="wallet-nickname-panel">
              <label className="wallet-nickname-label">
                Wallet nickname
                <input
                  value={nicknameDraft}
                  onChange={(event) => onNicknameDraftChange(event.target.value)}
                  placeholder={isConnected ? 'Rename this wallet' : 'Set a nickname before connect'}
                  maxLength={WALLET_NICKNAME_MAX_LENGTH}
                />
              </label>
              <div className="wallet-nickname-help">
                {isConnected
                  ? 'Saved locally on this device and reused anywhere this wallet is recognized.'
                  : 'Optional. If you connect now, this nickname will replace the short wallet address.'}
              </div>
              {isConnected ? (
                <button className="ghost-btn compact" onClick={onSaveNickname} disabled={isPending}>
                  Save nickname
                </button>
              ) : null}
            </div>
          ) : null}
          {isConnected || profileBackupAccounts.length ? (
            <div className="wallet-modal-backup-card wealth-profile-storage-card profile-backup-card">
              <div className="profile-backup-main">
                <div className="eyebrow">Wallet backup + recovery</div>
                <div className="wealth-profile-storage-title">Keep replay progress recoverable</div>
                <div className="muted">
                  Sign a local snapshot for this wallet, or pick a historical backup and connect the matching MetaMask account before recovery.
                </div>
                {profileBackupSummaryText ? <div className="wealth-inline-note wallet-modal-backup-note">{profileBackupSummaryText}</div> : null}
              </div>
              <div className="profile-backup-side">
                <div className="wallet-modal-backup-actions profile-backup-actions">
                  <button type="button" className="ghost-btn compact" onClick={() => onSignProfileBackup?.()} disabled={!isConnected || isPending || isProfileSigning}>
                    {isProfileSigning ? 'Await wallet' : 'Sign optional backup'}
                  </button>
                </div>
                <div className="profile-backup-history">
                  <label>
                    Historical account login
                    <select
                      value={selectedProfileBackupAddress}
                      onChange={(event) => onSelectedProfileBackupAddressChange?.(event.target.value)}
                      disabled={!profileBackupAccounts.length}
                    >
                      {profileBackupAccounts.length ? (
                        profileBackupAccounts.map((account) => (
                          <option key={account.address} value={account.address}>
                            {account.label} - {account.signedLabel}
                          </option>
                        ))
                      ) : (
                        <option value="">No saved backup on this device yet</option>
                      )}
                    </select>
                  </label>
                  <div className="profile-backup-history-copy">
                    Backup stores demo state only. It does not recover keys, so MetaMask still needs to connect this session.
                  </div>
                  <button
                    type="button"
                    className="secondary-btn compact"
                    onClick={() => onRecoverSelectedProfileBackup?.()}
                    disabled={!selectedProfileBackupAddress || !isConnected || isPending}
                  >
                    Use selected backup
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {!hasMetaMaskInstalled ? (
            <div className="wallet-install-steps">
              <div className="wallet-install-step">1. Open the official MetaMask website and install the browser extension.</div>
              <div className="wallet-install-step">2. Add MetaMask to your browser extensions and pin it to the toolbar so it is easy to open.</div>
              <div className="wallet-install-step">3. Before any trade, permission request, or mint, open the extension and keep it ready in the browser.</div>
            </div>
          ) : (
            <div className="wallet-install-steps">
              <div className="wallet-install-step">Tip: pin MetaMask to the browser toolbar.</div>
              <div className="wallet-install-step">When you connect, claim, or submit score, open the extension popup so the request is visible right away.</div>
            </div>
          )}
          {isConnected ? (
            <button className="secondary-btn" onClick={onDisconnect}>
              Disconnect wallet
            </button>
          ) : null}
          {nicknameFeedback ? <div className="env-hint" style={{ maxWidth: 360 }}>{nicknameFeedback}</div> : null}
          {errorText ? <div className="env-hint" style={{ maxWidth: 360 }}>{errorText}</div> : null}
        </div>
      </div>
    </div>
  );
}

function DeveloperModeModal({
  open,
  onClose,
  isAuthed,
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onLogin,
  onLogout,
  errorText,
  noticeText,
  isConnected,
  walletDisplayName,
  remainingPt
}) {
  if (!open) return null;

  return (
    <div className="wallet-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="wallet-modal developer-modal">
        <button className="wallet-modal-close" onClick={onClose} aria-label="Close developer mode">
          X
        </button>
        <div className="wallet-modal-pane wallet-modal-sidebar">
          <div className="wallet-modal-title">Developer Mode</div>
          <div className="wallet-modal-subtitle">Replay controls</div>
          <div className="wallet-install-copy">
            Browser-local admin access for the replay lab. Sign in for the current use to open the old unlimited PT and advanced route overrides; the form asks again next time.
          </div>
          <button className="secondary-btn" onClick={onClose}>
            Keep reviewing
          </button>
          {isAuthed ? (
            <button className="ghost-btn compact" onClick={onLogout}>
              Sign out of developer mode
            </button>
          ) : null}
        </div>
        <div className="wallet-modal-pane wallet-modal-main developer-modal-main">
          {!isAuthed ? (
            <div className="developer-auth-form">
              <div className="wallet-modal-status">Developer sign in</div>
              <div className="env-hint">
                Demo-only admin access. Use <strong>{DEV_MODE_USERNAME}</strong> / <strong>{DEV_MODE_PASSWORD}</strong>; no saved login is reused.
              </div>
              <label>
                Username
                <input value={username} onChange={(event) => onUsernameChange(event.target.value)} />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} />
              </label>
              <button className="primary-btn" onClick={onLogin}>
                Open admin controls
              </button>
              {errorText ? <div className="env-hint">{errorText}</div> : null}
            </div>
          ) : (
            <div className="developer-analytics">
              <div className="wallet-modal-status">Developer override active</div>
              <div className="paper-balance-strip">
                <div className="paper-balance-box">
                  <div className="label">Browser override</div>
                  <div className="value">On</div>
                </div>
                <div className="paper-balance-box">
                  <div className="label">Wallet</div>
                  <div className="value">{isConnected ? walletDisplayName : 'Not connected'}</div>
                </div>
                <div className="paper-balance-box">
                  <div className="label">Remaining PT</div>
                  <div className="value">{Number(remainingPt || 0).toLocaleString()} PT</div>
                </div>
              </div>
              <div className="wealth-inline-note">
                Replay routes, wallet-linked state, and local leaderboard storage are unlocked for this signed-in developer use. This is the quick way to inspect advanced tutorial gates without losing the wallet context.
              </div>
              <div className="toolbar">
                <button className="secondary-btn" onClick={onClose}>
                  Close panel
                </button>
                <button className="ghost-btn compact" onClick={onLogout}>
                  Turn off developer mode
                </button>
              </div>
              {noticeText ? <div className="env-hint">{noticeText}</div> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaperPurchaseGuideCards({ feeRows, yieldRows, deskSimulation, selectedProductGuide, className = 'paper-inline-support-grid' }) {
  return (
    <div className={className}>
      <div className="paper-inline-support-card">
        <div className="paper-inline-support-head">
          <div className="paper-inline-support-head-row">
            <div className="entry-title">Fee drag after purchase</div>
            <div className="paper-inline-help-pill">
              <span>What is this?</span>
              <div className="paper-inline-cash-tooltip">
                Subscription fee, management fee, custody fee, performance share, early redemption fee, slippage, gas, and tax are split out here.
              </div>
            </div>
          </div>
        </div>
        <div className="paper-inline-support-list">
          {feeRows.map((row) => (
            <div className="paper-inline-support-row" key={row.label}>
              <span>{row.label}</span>
              <strong>{formatNotional(row.amount)} PT</strong>
            </div>
          ))}
          <div className="paper-inline-support-row total">
            <span>Estimated tax</span>
            <strong>{formatNotional(deskSimulation.estimatedTax)} PT</strong>
          </div>
        </div>
      </div>

      <div className="paper-inline-support-card">
        <div className="paper-inline-support-head">
          <div className="paper-inline-support-head-row">
            <div className="entry-title">Source of return</div>
            <div className="paper-inline-help-pill">
              <span>What changes it?</span>
              <div className="paper-inline-cash-tooltip">
                Base yield, subsidy, token incentive, and route choice all matter. Net result is not the same as headline APY.
              </div>
            </div>
          </div>
        </div>
        <div className="paper-inline-support-list">
          {yieldRows.map((row) => (
            <div className="paper-inline-support-row" key={row.label}>
              <span>{row.label}</span>
              <strong>{formatSignedPercent(row.rate * 100)}</strong>
            </div>
          ))}
          <div className="paper-inline-support-row total">
            <span>Target annual yield</span>
            <strong>{formatSignedPercent(selectedProductGuide.targetYieldRate * 100)}</strong>
          </div>
        </div>
      </div>

      <div className="paper-inline-support-card">
        <div className="paper-inline-support-head">
          <div className="paper-inline-support-head-row">
            <div className="entry-title">Exit rules and liquidity</div>
            <div className="paper-inline-help-pill">
              <span>How to read</span>
              <div className="paper-inline-cash-tooltip">
                The desk keeps T+0 / T+1 / T+N, early redemption loss, transfer-only windows, and issuer-vs-platform exit path visible.
              </div>
            </div>
          </div>
        </div>
        <div className="paper-inline-support-list">
          <div className="paper-inline-support-row">
            <span>Redemption window</span>
            <strong>{selectedProductGuide.redemptionWindow}</strong>
          </div>
          <div className="paper-inline-support-row">
            <span>Exit channel</span>
            <strong>{selectedProductGuide.exitChannel}</strong>
          </div>
          <div className="paper-inline-support-row">
            <span>Liquidity status</span>
            <strong>{deskSimulation.liquidityStatus}</strong>
          </div>
          <div className="paper-inline-support-row">
            <span>Volatility fit</span>
            <strong>{deskSimulation.volatilityStatus}</strong>
          </div>
        </div>
      </div>

      <div className="paper-inline-support-card">
        <div className="paper-inline-support-head">
          <div className="paper-inline-support-head-row">
            <div className="entry-title">Purchase risk checks</div>
            <div className="paper-inline-help-pill">
              <span>Why these?</span>
              <div className="paper-inline-cash-tooltip">
                These are the stress assumptions the buy screen now checks before showing the projected take-home outcome.
              </div>
            </div>
          </div>
        </div>
        <div className="paper-inline-support-list">
          {selectedProductGuide.stressScenarios.map((scenario) => (
            <div className="paper-inline-support-row" key={scenario.label}>
              <span>{scenario.label}</span>
              <strong>{scenario.impact}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PaperBuyPrimerModal({
  open,
  product,
  onClose,
  onConfirm,
  feeRows,
  yieldRows,
  deskSimulation,
  selectedProductGuide,
  isSigning = false
}) {
  if (!open || !product) return null;

  return (
    <div className="paper-buy-primer-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="paper-buy-primer-card">
        <div className="section-head wealth-modal-head">
          <div>
            <div className="eyebrow">Confirm trade</div>
            <h2>{product.name}</h2>
            <div className="paper-buy-primer-copy">
              Review costs, return source, exit rules, and stress checks before confirming this paper buy. After you confirm here, the wallet will ask for a replay-trade signature before the buy is written into the ledger.
            </div>
          </div>
          <div className="paper-buy-primer-actions">
            <button type="button" className="ghost-btn compact" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={onConfirm} disabled={isSigning}>
              {isSigning ? 'Await wallet' : 'Confirm buy'}
            </button>
          </div>
        </div>

        <PaperPurchaseGuideCards
          feeRows={feeRows}
          yieldRows={yieldRows}
          deskSimulation={deskSimulation}
          selectedProductGuide={selectedProductGuide}
          className="paper-buy-primer-grid"
        />

      </div>
    </div>
  );
}

function ReplayRouteTradeConfirmModal({
  open,
  product,
  action = 'open',
  direction = 'long',
  tradeAmount = 0,
  leverageLabel = 'No leverage',
  anchorLabel = '--',
  flashModeLabel = 'Wallet only',
  focusId = 'leverage',
  focusLabel = 'Leverage',
  customCopy = '',
  onClose,
  onConfirm,
  isSigning = false
}) {
  if (!open || !product) return null;
  const actionVerb = action === 'close' ? 'Close' : 'Open';
  const isHedge = focusId === 'hedge';
  const flowCopy =
    customCopy ||
    action === 'close'
      ? 'Confirm the leveraged close first. This is the manual close step after you have picked the target bar, either by replay playback and pause or by staying on the current replay anchor.'
      : 'Confirm the leverage ticket first. After this screen, the route will ask for any required flash quote steps and then request the wallet signature.';

  return (
    <div className="paper-float-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="paper-float-modal-card paper-float-modal-card-mini">
        <button type="button" className="paper-float-modal-close" onClick={onClose} aria-label="Close route trade confirmation">
          X
        </button>
        <div className="section-head wealth-modal-head">
          <div>
            <div className="eyebrow">Confirm trade</div>
            <h2>{actionVerb} {direction} {isHedge ? 'hedge on ' : ''}{product.ticker}?</h2>
            <div className="paper-float-modal-copy">
              {flowCopy}
            </div>
          </div>
          <div className="paper-float-modal-actions">
            <button type="button" className="ghost-btn compact" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={onConfirm} disabled={isSigning}>
              {isSigning ? 'Await wallet' : 'Confirm trade'}
            </button>
          </div>
        </div>

        <div className="paper-float-modal-stat-grid">
          <div className="paper-inline-desk-metric tall">
            <div className="k">Entry anchor</div>
            <div className="v">{anchorLabel}</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Paper notional</div>
            <div className="v">{formatNotional(tradeAmount)} PT</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Leverage</div>
            <div className="v">{leverageLabel}</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Credit lane</div>
            <div className="v">{flashModeLabel}</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Route focus</div>
            <div className="v">{focusLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReplayRouteRiskConfirmModal({
  open,
  product,
  action = 'open',
  direction = 'long',
  tradeAmount = 0,
  leverageLabel = 'No leverage',
  flashAmount = 0,
  focusId = 'leverage',
  focusLabel = 'Leverage',
  customCopy = '',
  onClose,
  onConfirm
}) {
  if (!open || !product) return null;

  const isClose = action === 'close';
  const isHedge = focusId === 'hedge';
  const title = isClose
    ? `Confirm ${direction} risk exit`
    : isHedge
      ? `Confirm ${direction} hedge risk`
      : `Confirm ${direction} route risk`;
  const copy = customCopy || (isClose
    ? `This close will unwind the ${direction} leg, repay any route-bound flash first, and return whatever margin is left after funding and fee drag.`
    : flashAmount > 0
      ? 'This ticket uses leverage plus route-bound flash. The route can prove the flash is for this leveraged trade, but liquidation, funding, reserve, and close drag still stay real.'
      : leverageLabel !== 'No leverage'
        ? 'This ticket uses leverage on wallet-backed notional only. The core risk is liquidation buffer, funding drag, and how quickly the mark can move against the leg.'
        : 'This ticket uses no extra leverage, but it still opens inside the contract-style replay route rather than plain spot.');

  return (
    <div className="paper-float-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="paper-float-modal-card paper-float-modal-card-mini">
        <button type="button" className="paper-float-modal-close" onClick={onClose} aria-label="Close route risk confirmation">
          X
        </button>
        <div className="section-head wealth-modal-head">
          <div>
            <div className="eyebrow">Confirm risk trade</div>
            <h2>{title}</h2>
            <div className="paper-float-modal-copy">{copy}</div>
          </div>
          <div className="paper-float-modal-actions">
            <button type="button" className="ghost-btn compact" onClick={onClose}>
              Back
            </button>
            <button type="button" className="primary-btn" onClick={onConfirm}>
              Continue to wallet
            </button>
          </div>
        </div>

        <div className="paper-float-modal-stat-grid">
          <div className="paper-inline-desk-metric tall">
            <div className="k">Target notional</div>
            <div className="v">{formatNotional(tradeAmount)} PT</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Leverage</div>
            <div className="v">{leverageLabel}</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Flash attached</div>
            <div className="v">{formatNotional(flashAmount)} PT</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Route</div>
            <div className="v">{focusLabel} / {direction}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductLearnMoreModal({ open, product, productGuide, onClose }) {
  if (!open || !product || !productGuide) return null;

  const detailRows = [
    { label: 'Why this exists', value: product.whyItMatters },
    { label: 'Source of return', value: product.returnSource },
    { label: 'Worst case', value: product.worstCase },
    { label: 'Best fit', value: product.fit },
    { label: 'Liquidity', value: productGuide.redemptionWindow },
    { label: 'Underlying asset type', value: productGuide.underlyingAssetType }
  ];

  return (
    <div className="paper-float-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="paper-float-modal-card paper-float-modal-card-learn">
        <button type="button" className="paper-float-modal-close" onClick={onClose} aria-label="Close product learn more modal">
          X
        </button>
        <div className="section-head wealth-modal-head">
          <div>
            <div className="eyebrow">Product explainer</div>
            <h2>{product.name}</h2>
            <div className="paper-float-modal-copy">
              {product.humanSummary} {product.technicalSummary}
            </div>
          </div>
          <span className={`pill ${riskClass(product.risk)}`}>{productGuide.structureLabel}</span>
        </div>

        <div className="paper-float-modal-grid">
          {detailRows.map((row) => (
            <div key={row.label} className="paper-keyword-tile">
              <div className="k">{row.label}</div>
              <div className="v">{row.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AutoSellPreviewModal({
  open,
  product,
  anchorLabel,
  targetLabel,
  sellUnits,
  sellSizeLabel = '',
  holdingDays,
  estimatedValue,
  estimatedPnl,
  venueNotes,
  closeMode = false,
  onClose,
  onConfirm
}) {
  if (!open || !product) return null;

  const actionLabel = closeMode ? 'Auto-close' : 'Auto-sell';
  const actionLabelLower = closeMode ? 'auto-close' : 'auto-sell';
  const plannedSizeLabel = closeMode ? 'Planned close size' : 'Planned sell size';
  const targetBarLabel = closeMode ? 'Auto-close bar' : 'Auto-sell bar';

  return (
    <div className="paper-float-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="paper-float-modal-card paper-float-modal-card-autosell">
        <button type="button" className="paper-float-modal-close" onClick={onClose} aria-label="Close timed exit preview modal">
          X
        </button>
        <div className="section-head wealth-modal-head">
          <div>
            <div className="eyebrow">{closeMode ? 'Confirm close' : 'Timed exit preview'}</div>
            <h2>{actionLabel} {product.ticker}</h2>
            <div className="paper-float-modal-copy">
              Review the {closeMode ? 'close' : 'sell'} size, target bar, and venue mechanics before the replay jumps forward and confirms this closing action.
            </div>
          </div>
          <div className="paper-float-modal-actions">
            <button type="button" className="ghost-btn compact" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={onConfirm}>
              Confirm {actionLabelLower}
            </button>
          </div>
        </div>

        <div className="paper-float-modal-stat-grid">
          <div className="paper-inline-desk-metric tall">
            <div className="k">Entry anchor</div>
            <div className="v">{anchorLabel}</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">{targetBarLabel}</div>
            <div className="v">{targetLabel}</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">{plannedSizeLabel}</div>
            <div className="v">{sellSizeLabel || `${formatUnits(sellUnits)} units`}</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Hold period</div>
            <div className="v">{holdingDays}D</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Est. take-home value</div>
            <div className="v">{formatNotional(estimatedValue)} PT</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Est. take-home PnL</div>
            <div className={`v ${estimatedPnl >= 0 ? 'risk-low' : 'risk-high'}`}>{formatSigned(estimatedPnl)} PT</div>
          </div>
        </div>

        <div className="paper-float-modal-note-grid">
          {venueNotes.map((note) => (
            <div key={note.title} className="paper-inline-support-card">
              <div className="paper-inline-support-head">
                <div className="entry-title">{note.title}</div>
              </div>
              <div className="paper-inline-support-list">
                <div className="paper-inline-support-row">
                  <span>{note.copy}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TradeOutcomeModal({ open, outcome, onClose }) {
  if (!open || !outcome) return null;

  const isPositive = outcome.tone === 'positive';
  const title = isPositive ? 'Congrats!' : "Don't give up";
  const copy = isPositive
    ? `${outcome.actionLabel} ${outcome.productTicker} finished in the green. Keep the replay notes and size discipline that got this one home.`
    : outcome.compensationGranted > 0
      ? `This close was rough, but the desk added ${formatNotional(outcome.compensationGranted)} PT once for today so you can reset and come back stronger.`
      : Math.abs(outcome.pnl) >= TRADE_RECOVERY_GRANT_TRIGGER
        ? 'This trade hit hard, and the daily recovery grant was already used today. Step back, read the drag stack, and come back with a calmer setup.'
        : 'This one closed red, but it is still a small enough hit to learn from. Do not give up.';

  return (
    <div className="paper-float-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`paper-float-modal-card paper-float-modal-card-mini paper-trade-outcome-card ${isPositive ? 'positive' : 'negative'}`}>
        <button type="button" className="paper-float-modal-close" onClick={onClose} aria-label="Close trade outcome modal">
          X
        </button>
        <div className="section-head wealth-modal-head">
          <div>
            <div className="eyebrow">Replay result</div>
            <h2>{title}</h2>
            <div className="paper-float-modal-copy paper-trade-outcome-copy">{copy}</div>
          </div>
          <div className={`paper-trade-outcome-badge ${isPositive ? 'positive' : 'negative'}`}>
            <div>{outcome.productTicker}</div>
            <strong>{formatSigned(outcome.pnl)} PT</strong>
          </div>
        </div>

        <div className="paper-float-modal-stat-grid">
          <div className="paper-inline-desk-metric tall">
            <div className="k">Trade</div>
            <div className="v">{outcome.actionLabel}</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Product</div>
            <div className="v">{outcome.productName}</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Close date</div>
            <div className="v">{outcome.dateLabel}</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">This trade</div>
            <div className={`v ${outcome.pnl >= 0 ? 'risk-low' : 'risk-high'}`}>{formatSigned(outcome.pnl)} PT</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">{outcome.takeHomeLabel}</div>
            <div className="v">{formatNotional(outcome.exitValue)} PT</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Today closed PnL</div>
            <div className={`v ${outcome.todayClosedPnl >= 0 ? 'risk-low' : 'risk-high'}`}>{formatSigned(outcome.todayClosedPnl)} PT</div>
          </div>
          {outcome.todayRecoveryGrant > 0 ? (
            <div className="paper-inline-desk-metric tall">
              <div className="k">Today recovery grant</div>
              <div className="v risk-low">+{formatNotional(outcome.todayRecoveryGrant)} PT</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FlashLoanQuoteModal({
  open,
  product,
  baseNotional,
  targetNotional,
  maxBorrowNotional,
  freeReserveCash,
  requiredMargin,
  postedMargin,
  marginShortfall,
  quoteRows,
  totalDraftNotional,
  totalPremiumValue,
  onQuoteChange,
  onQuoteMax,
  onClose,
  onClear,
  onConfirm
}) {
  if (!open || !product) return null;
  const totalAvailableNotional = roundNumber(Math.max(0, Number(maxBorrowNotional || 0)), 2);
  const hasAnyQuoteCapacity = totalAvailableNotional > 0;
  const ticketLane = quoteRows.find((row) => row.id === 'ticket') || quoteRows[0];
  const generalLane = quoteRows.find((row) => row.id === 'general') || quoteRows[1];

  return (
    <div className="paper-float-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="paper-float-modal-card paper-float-modal-card-compact">
        <button type="button" className="paper-float-modal-close" onClick={onClose} aria-label="Close flash loan quote modal">
          X
        </button>
        <div className="section-head wealth-modal-head">
          <div>
            <div className="eyebrow">Flash liquidity quote</div>
            <h2>{product.ticker} flash notional</h2>
            <div className="paper-float-modal-copy paper-float-modal-copy-flash">
              Normal venue credit usually cannot tell whether borrowed notional is truly opening leverage or just becoming reusable cash, so it has to price in more risk.
              <br />
              In this replay desk, <strong>ticket-bound flash</strong> stays attached to an attested exchange route, so eligible same-purpose products can still prove the borrow is being used for the current leverage or hedge objective. Because the use is provable, the risk lane is lower and the fee can be lower too.
              <br />
              <strong>Broad flash</strong> is not restricted to the provable route. It may be used away from this exchange or outside the signed purpose, so it keeps the higher surcharge.
            </div>
          </div>
          <div className="paper-float-modal-actions">
            <button type="button" className="ghost-btn compact" onClick={onClear}>
              Clear
            </button>
            <button type="button" className="ghost-btn compact" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={onConfirm}>
              Confirm quote
            </button>
          </div>
        </div>

        <div className="paper-float-modal-stat-grid">
          <div className="paper-inline-desk-metric tall">
            <div className="k">Wallet-backed notional</div>
            <div className="v">{formatNotional(baseNotional)} PT</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Ticket target</div>
            <div className="v">{formatNotional(targetNotional)} PT</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Margin needed</div>
            <div className="v">{formatNotional(requiredMargin)} PT</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Wallet-posted margin</div>
            <div className="v">{formatNotional(postedMargin)} PT</div>
          </div>
        </div>

        <div className="paper-float-modal-note-grid">
          {!hasAnyQuoteCapacity ? (
            <div className="paper-inline-support-card">
              <div className="paper-inline-support-head">
                <div className="entry-title">Why the quote is 0 right now</div>
              </div>
              <div className="paper-inline-support-list">
                <div className="paper-inline-support-row">
                  <span>
                    This route can still stage the ticket without flash, but the initial margin already leaves only {formatNotional(
                      freeReserveCash
                    )} PT free for the opening reserve. Right now the ticket lane is capped by reserve at {formatNotional(
                      ticketLane?.reserveBackedCap || 0
                    )} PT and by support at {formatNotional(ticketLane?.supportCap || 0)} PT; the general lane is capped by reserve at {formatNotional(
                      generalLane?.reserveBackedCap || 0
                    )} PT and by support at {formatNotional(generalLane?.supportCap || 0)} PT. The smaller cap wins in each lane, and both lanes share the same total reserve-backed flash budget.
                  </span>
                </div>
              </div>
            </div>
          ) : null}
          {quoteRows.map((row) => (
            <div key={row.id} className="paper-inline-support-card">
              <div className="paper-inline-support-head">
                <div className="entry-title">{row.label}</div>
                <span className="pill">{row.purpose}</span>
              </div>
              <div className="paper-inline-support-list">
                <div className="paper-inline-support-row">
                  <span>Rate</span>
                  <strong>{formatPercent(row.rate, 2)}</strong>
                </div>
                <div className="paper-inline-support-row">
                  <span>Max available</span>
                  <strong>{formatNotional(row.maxAvailableNotional)} PT</strong>
                </div>
                <div className="paper-inline-support-row">
                  <span>Reserve-backed cap</span>
                  <strong>{formatNotional(row.reserveBackedCap)} PT</strong>
                </div>
                <div className="paper-inline-support-row">
                  <span>Support cap</span>
                  <strong>{formatNotional(row.supportCap)} PT</strong>
                </div>
                <div className="paper-inline-support-row">
                  <span>Applied now</span>
                  <strong>{formatNotional(row.appliedNotional)} PT</strong>
                </div>
                <div className="paper-inline-support-row">
                  <span>Premium est.</span>
                  <strong className="risk-high">-{formatNotional(row.draftPremium)} PT</strong>
                </div>
                <label className="wealth-field paper-inline-desk-field compact">
                  Quote amount
                  <div className="paper-inline-quote-input-row">
                    <button
                      type="button"
                      className="ghost-btn compact paper-inline-quote-max"
                      onClick={() => onQuoteMax(row.id, row.maxAvailableNotional)}
                    >
                      Max
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={row.draftNotional}
                      onChange={(event) => onQuoteChange(row.id, event.target.value)}
                    />
                  </div>
                </label>
                <div className="paper-inline-support-row">
                  <span>{row.copy}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="paper-inline-support-card">
            <div className="paper-inline-support-head">
              <div className="entry-title">What this changes</div>
            </div>
            <div className="paper-inline-support-list">
              <div className="paper-inline-support-row">
                <span>Total premium est.</span>
                <strong className="risk-high">-{formatNotional(totalPremiumValue)} PT</strong>
              </div>
              <div className="paper-inline-support-row">
                <span>Remaining margin gap</span>
                <strong>{formatNotional(marginShortfall)} PT</strong>
              </div>
              <div className="paper-inline-support-row">
                <span>Wallet cash</span>
                <strong>Unchanged</strong>
              </div>
              <div className="paper-inline-support-row">
                <span>Route effect</span>
                <strong>Boosts this ticket only</strong>
              </div>
              <div className="paper-inline-support-row">
                <span>Risk acknowledgement</span>
                <strong>Requested when the long or short opens</strong>
              </div>
              <div className="paper-inline-support-row">
                <span>Extra flash ceiling</span>
                <strong>{formatNotional(maxBorrowNotional)} PT</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlashLoanTicketConfirmModal({
  open,
  product,
  tradeAmount,
  leverageLabel,
  onClose,
  onConfirm
}) {
  if (!open || !product) return null;

  return (
    <div className="paper-float-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="paper-float-modal-card paper-float-modal-card-mini">
        <button type="button" className="paper-float-modal-close" onClick={onClose} aria-label="Close flash loan confirmation">
          X
        </button>
        <div className="section-head wealth-modal-head">
          <div>
            <div className="eyebrow">Confirm ticket first</div>
            <h2>Open flash quote for this ticket?</h2>
            <div className="paper-float-modal-copy">
              Flash credit should quote against the exact paper notional you want to stage. Confirm this ticket first, then the loan quote will open on top of it.
            </div>
          </div>
          <div className="paper-float-modal-actions">
            <button type="button" className="ghost-btn compact" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={onConfirm}>
              Confirm and quote
            </button>
          </div>
        </div>

        <div className="paper-float-modal-stat-grid">
          <div className="paper-inline-desk-metric tall">
            <div className="k">Product</div>
            <div className="v">{product.ticker}</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Paper notional</div>
            <div className="v">{formatNotional(tradeAmount)} PT</div>
          </div>
          <div className="paper-inline-desk-metric tall">
            <div className="k">Leverage</div>
            <div className="v">{leverageLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getProgressStorageKey(address) {
  return address ? `msx-progress-${address.toLowerCase()}` : 'msx-progress-guest';
}

function getAdminUnlockStorageKey(address) {
  return address ? `${ADMIN_UNLOCK_STORAGE_PREFIX}-${address.toLowerCase()}` : '';
}

function getPaperStateKey(address) {
  return address ? `msx-paper-replay-state-${address.toLowerCase()}` : 'msx-paper-replay-state-guest';
}

function getReplaySessionKey(address) {
  return address ? `msx-paper-replay-session-${address.toLowerCase()}` : 'msx-paper-replay-session-guest';
}

function getReplayScoreLogKey(address) {
  return address ? `msx-paper-replay-score-log-${address.toLowerCase()}` : 'msx-paper-replay-score-log-guest';
}

function getReplayClaimCacheKey(address) {
  return address ? `msx-paper-replay-claim-cache-${address.toLowerCase()}` : 'msx-paper-replay-claim-cache-guest';
}

function getReplayBuyGuidePrefsKey(address) {
  return address ? `msx-paper-replay-buy-guide-prefs-${address.toLowerCase()}` : 'msx-paper-replay-buy-guide-prefs-guest';
}

function getTradeOutcomeHistoryKey(address) {
  return address ? `${TRADE_OUTCOME_HISTORY_STORAGE_KEY}-${address.toLowerCase()}` : `${TRADE_OUTCOME_HISTORY_STORAGE_KEY}-guest`;
}

function riskClass(risk) {
  return risk === 'Low' ? 'risk-low' : risk === 'Medium' ? 'risk-medium' : 'risk-high';
}

function getPaperAssetLayer(product = {}) {
  if (product.lane === 'spot') return 'spot';
  if (product.lane === 'funding') return 'cash';
  if (product.lane === 'private') return 'private';
  return 'listed';
}

function getPaperAssetLayerLabel(product = {}) {
  const layer = getPaperAssetLayer(product);
  if (layer === 'spot') return 'Spot';
  if (layer === 'cash') return 'Cash & Treasury';
  if (layer === 'private') return 'Private';
  return product.productType === 'Commodity wrapper' ? 'Public wrapper' : 'Listed / xStocks';
}

function getDefaultHedgeTypeForProduct(product = {}) {
  if (product.lane === 'private') return 'proxy';
  if (product.lane === 'funding' || product.lane === 'yield') return 'exit';
  if (product.lane === 'strategy' || product.lane === 'ai') return 'basket';
  return 'direct';
}

const SHELF_TAGS_TO_DEEMPHASIZE = new Set(['Tokenized', 'Permissioned']);

function getShelfStructureTags(product = {}) {
  const tags = Array.isArray(product.structureTags) ? product.structureTags.filter(Boolean) : [];
  if (!tags.length) return [];
  const trimmed = tags.filter((tag) => !SHELF_TAGS_TO_DEEMPHASIZE.has(tag));
  return (trimmed.length ? trimmed : tags).slice(0, 1);
}

function getPaperProductDisclosureRows(product = {}, guide = {}, routeId = 'spot') {
  const assetLayer = getPaperAssetLayer(product);
  const isPerpRoute = routeId === 'perp';
  const isPrivate = assetLayer === 'private';
  const isCash = assetLayer === 'cash';
  const isSpot = assetLayer === 'spot';
  const isCommodity = product.productType === 'Commodity wrapper';

  return [
    {
      label: 'Asset layer',
      value: getPaperAssetLayerLabel(product),
      copy: isSpot
        ? 'Plain spot replay: no separate leverage route is attached to the product tab.'
        : assetLayer === 'listed'
        ? isCommodity
          ? 'Public wrapper, not an xStocks equity claim.'
          : 'Only listed equities and ETF-style beta belong in xStocks.'
        : assetLayer === 'cash'
          ? 'Reserve, treasury, repo, or cash-management sleeve.'
          : 'Pre-IPO, SPV, or late-stage private-share access.'
    },
    {
      label: 'Own vs Synthetic',
      value: isPerpRoute ? 'Synthetic contract' : isPrivate ? 'Allocation / wrapper claim' : isSpot ? 'Direct spot exposure' : 'Wrapper exposure',
      copy: isPerpRoute
        ? 'Margin creates long / short exposure; it does not transfer the underlying asset.'
        : isPrivate
          ? 'You hold a transfer-limited claim, not exchange-style common shares.'
          : isSpot
            ? 'Spot buys and exits the underlying market exposure directly in the replay.'
            : 'Spot buys the wrapper or receipt exposure, then exits through the wrapper route.'
    },
    {
      label: 'Rights',
      value: isPerpRoute ? 'No voting / dividends' : isCash ? 'NAV / redemption terms' : isPrivate ? 'Transfer + event rights' : isSpot ? 'Market exposure' : 'Tracker / wrapper rights',
      copy: isPerpRoute
        ? 'Funding and liquidation replace shareholder-style rights.'
        : guide.tokenRights || (isPrivate ? 'Rights depend on SPV and transfer documents.' : 'Economic exposure can differ from full shareholder rights.')
    },
    {
      label: 'Liquidity',
      value: isPerpRoute ? 'Close contract' : guide.redemptionWindow || 'Venue-dependent exit',
      copy: isPerpRoute
        ? 'Liquidity depends on contract venue, funding, and maintenance margin.'
        : guide.exitChannel || 'Spot exit can still face spread, queue, and off-hours pricing.'
    },
    {
      label: 'Can Auto-Act',
      value: isPerpRoute ? 'Alerts + close rules' : 'Alerts / DCA / rebalance',
      copy: isPerpRoute
        ? 'Bots can warn or stage a close; they should pause around liquidation or stale pricing risk.'
        : 'Automation is a rules layer, not the product itself.'
    }
  ];
}

function inferHoldingRisk(product, holding = {}) {
  if (holding.risk) return holding.risk;

  const source = `${holding.name || ''} ${holding.role || ''}`.toLowerCase();
  if (
    /option|leveraged|leverage|barrier|perp|liquidation|private share|late-stage|high-beta|directional|structured|knockout/.test(
      source
    )
  ) {
    return 'High';
  }

  if (
    /credit|spread|term|model|wrapper|money market notes|dealer|hedge|spv|feeder|execution reserve|override|yield pickup/.test(
      source
    )
  ) {
    return 'Medium';
  }

  if (
    /t-bill|treasury|repo|reverse repo|reserve|cash|buffer|stable|settlement|liquidity anchor|demand deposits|government/.test(
      source
    )
  ) {
    return 'Low';
  }

  return product?.risk || 'Medium';
}

function roundNumber(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function formatNotional(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: value >= 1000 ? 0 : 2
  });
}

function formatPrice(value) {
  if (!Number.isFinite(Number(value))) return '--';
  const numericValue = Number(value);
  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: numericValue >= 100 ? 2 : numericValue >= 10 ? 2 : 4,
    maximumFractionDigits: numericValue >= 100 ? 2 : numericValue >= 10 ? 2 : 4
  });
}

function formatSigned(value) {
  const numericValue = Number(value || 0);
  const prefix = numericValue > 0 ? '+' : numericValue < 0 ? '-' : '';
  return `${prefix}${Math.abs(numericValue).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatUnits(value) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
  });
}

function formatReplayDate(timestamp, intervalId) {
  if (!timestamp) return '--';
  const date = new Date(timestamp);
  if (intervalId === '1D') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatPercent(value, digits = 2) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

function formatSignedPercent(value, digits = 2) {
  const numericValue = Number(value || 0);
  const prefix = numericValue > 0 ? '+' : numericValue < 0 ? '-' : '';
  return `${prefix}${Math.abs(numericValue).toFixed(digits)}%`;
}

function formatReplayBadgeTimestamp(timestamp) {
  if (!timestamp) return 'No replay timestamp yet';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getReplayDayKey(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function defaultReplayScoreLog() {
  return {
    submissions: []
  };
}

function getWalletCacheAddress(address) {
  return address ? String(address).toLowerCase() : 'guest';
}

function defaultReplayClaimCache(address = '') {
  return {
    walletAddress: getWalletCacheAddress(address),
    claimedIds: []
  };
}

function defaultTradeOutcomeHistory() {
  return {
    entries: []
  };
}

function normalizeTradeOutcomeHistory(payload) {
  return {
    entries: Array.isArray(payload?.entries)
      ? payload.entries
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => ({
            id: entry.id || `trade-outcome-${entry.ts || 'unknown'}`,
            ts: entry.ts || '',
            dayKey: entry.dayKey || getReplayDayKey(entry.ts),
            productId: entry.productId || '',
            productName: entry.productName || '',
            productTicker: entry.productTicker || '',
            routeId: entry.routeId || 'spot',
            actionLabel: entry.actionLabel || 'Close',
            exitValue: roundNumber(Number(entry.exitValue || 0), 2),
            pnl: roundNumber(Number(entry.pnl || 0), 2),
            compensationGranted: roundNumber(Number(entry.compensationGranted || 0), 2)
          }))
      : []
  };
}

function normalizePaperState(payload) {
  const safePositions =
    payload?.positions && typeof payload.positions === 'object' && !Array.isArray(payload.positions)
      ? Object.fromEntries(
          Object.entries(payload.positions).map(([productId, position]) => [
            productId,
            {
              units: roundNumber(Number(position?.units || 0), 6),
              principal: roundNumber(Number(position?.principal || 0), 2),
              avgEntry: roundNumber(Number(position?.avgEntry || 0), 4),
              carryPaid: roundNumber(Number(position?.carryPaid || 0), 2),
              grossNotional: roundNumber(Number(position?.grossNotional || 0), 2),
              entryFeePaid: roundNumber(Number(position?.entryFeePaid || 0), 2),
              principalLoan: roundNumber(Number(position?.principalLoan || 0), 2),
              entryTs: position?.entryTs || ''
            }
          ])
        )
      : {};

  const safeTrades = Array.isArray(payload?.trades)
    ? payload.trades
        .filter((trade) => trade && typeof trade === 'object')
        .map((trade) => ({
          ...trade,
          notional: roundNumber(Number(trade.notional || 0), 2),
          units: roundNumber(Number(trade.units || 0), 6),
          price: roundNumber(Number(trade.price || 0), 6),
          feeTotal: roundNumber(Number(trade.feeTotal || 0), 2),
          taxTotal: roundNumber(Number(trade.taxTotal || 0), 2),
          carryTotal: roundNumber(Number(trade.carryTotal || 0), 2),
          managementFeeTotal: roundNumber(Number(trade.managementFeeTotal || 0), 2),
          loanApplied: roundNumber(Number(trade.loanApplied || 0), 2),
          loanRepaid: roundNumber(Number(trade.loanRepaid || 0), 2),
          realizedPnl: roundNumber(Number(trade.realizedPnl || 0), 2)
        }))
    : [];

  const derivedRealizedPnl = roundNumber(
    safeTrades.reduce((sum, trade) => sum + (trade.side === 'sell' ? Number(trade.realizedPnl || 0) : 0), 0),
    2
  );

  return {
    cash: roundNumber(Number(payload?.cash ?? STARTING_PAPER_TOKENS), 2),
    positions: safePositions,
    trades: safeTrades,
    realizedPnl: roundNumber(Number(payload?.realizedPnl ?? derivedRealizedPnl), 2)
  };
}

const REPLAY_SCORE_LOG_VERSION = 3;
const REPLAY_LEADERBOARD_ARCHIVE_KEY = 'msx-paper-replay-leaderboard-archive';

function normalizeReplayScoreSubmission(payload, fallbackWalletAddress = '') {
  if (!payload || typeof payload !== 'object') return null;

  const walletAddress = String(payload.walletAddress || fallbackWalletAddress || '').toLowerCase();
  if (!walletAddress) return null;

  const submittedAtTimestamp = payload.submittedAt ? new Date(payload.submittedAt).getTime() : NaN;
  const submittedAt = Number.isFinite(submittedAtTimestamp)
    ? new Date(submittedAtTimestamp).toISOString()
    : new Date(0).toISOString();
  const status = payload.status === 'pending' ? 'pending' : 'confirmed';

  return {
    version: Math.max(1, Number(payload.version || 1)),
    submittedAt,
    netPnl: roundNumber(Number(payload.netPnl || 0), 2),
    pnlPercent: roundNumber(Number(payload.pnlPercent || 0), 2),
    accountValue: roundNumber(Number(payload.accountValue || 0), 2),
    walletAddress,
    tradeCount: Math.max(0, Number(payload.tradeCount || 0)),
    tradeLabel: payload.tradeLabel || 'Replay score submitted',
    tradeShortLabel: payload.tradeShortLabel || 'Replay submit',
    tradeTimestamp: payload.tradeTimestamp || '',
    productLabel: payload.productLabel || 'Replay desk',
    status,
    txHash: String(payload.txHash || ''),
    hallOfFame: Boolean(payload.hallOfFame)
  };
}

function replaySubmissionStatusRank(status) {
  return status === 'confirmed' ? 2 : status === 'pending' ? 1 : 0;
}

function pickBetterReplaySubmission(current, candidate) {
  if (!current) return candidate;
  if (!candidate) return current;

  if (candidate.pnlPercent !== current.pnlPercent) {
    return candidate.pnlPercent > current.pnlPercent ? candidate : current;
  }

  const candidateStatusRank = replaySubmissionStatusRank(candidate.status);
  const currentStatusRank = replaySubmissionStatusRank(current.status);
  if (candidateStatusRank !== currentStatusRank) {
    return candidateStatusRank > currentStatusRank ? candidate : current;
  }

  const candidateArchiveRank = Number(Boolean(candidate.hallOfFame));
  const currentArchiveRank = Number(Boolean(current.hallOfFame));
  if (candidateArchiveRank !== currentArchiveRank) {
    return candidateArchiveRank > currentArchiveRank ? candidate : current;
  }

  return new Date(candidate.submittedAt).getTime() > new Date(current.submittedAt).getTime() ? candidate : current;
}

function mergeReplayLeaderboardSubmissions(...groups) {
  const bestByWallet = new Map();

  groups
    .flat()
    .filter(Boolean)
    .forEach((submission) => {
      const normalized = normalizeReplayScoreSubmission(submission, submission?.walletAddress);
      if (!normalized) return;

      const walletAddress = normalized.walletAddress;
      bestByWallet.set(walletAddress, pickBetterReplaySubmission(bestByWallet.get(walletAddress), normalized));
    });

  return Array.from(bestByWallet.values()).sort((left, right) => {
    if (right.pnlPercent !== left.pnlPercent) return right.pnlPercent - left.pnlPercent;

    const rightStatusRank = replaySubmissionStatusRank(right.status);
    const leftStatusRank = replaySubmissionStatusRank(left.status);
    if (rightStatusRank !== leftStatusRank) return rightStatusRank - leftStatusRank;

    if (Number(Boolean(right.hallOfFame)) !== Number(Boolean(left.hallOfFame))) {
      return Number(Boolean(right.hallOfFame)) - Number(Boolean(left.hallOfFame));
    }

    return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
  });
}

function replaySubmissionListsMatch(left = [], right = []) {
  if (left.length !== right.length) return false;

  return left.every((entry, index) => {
    const other = right[index];
    if (!other) return false;

    return (
      entry.walletAddress === other.walletAddress &&
      entry.submittedAt === other.submittedAt &&
      entry.pnlPercent === other.pnlPercent &&
      entry.netPnl === other.netPnl &&
      entry.status === other.status &&
      entry.txHash === other.txHash &&
      Boolean(entry.hallOfFame) === Boolean(other.hallOfFame)
    );
  });
}

function normalizeReplayScoreLog(payload, fallbackWalletAddress = '') {
  const submissions = Array.isArray(payload?.submissions)
    ? payload.submissions
        .map((submission) => normalizeReplayScoreSubmission(submission, fallbackWalletAddress))
        .filter(Boolean)
    : [];

  return {
    submissions
  };
}

function defaultReplayLeaderboardArchive() {
  return {
    entries: []
  };
}

function normalizeReplayLeaderboardArchive(payload) {
  const entries = Array.isArray(payload?.entries)
    ? mergeReplayLeaderboardSubmissions(
        payload.entries
          .map((entry) => normalizeReplayScoreSubmission(entry))
          .filter(Boolean)
          .map((entry) => ({
            ...entry,
            hallOfFame: true,
            status: 'confirmed'
          }))
      )
    : [];

  return {
    entries
  };
}

function normalizeReplayClaimCache(payload, address = '') {
  const claimedIds = Array.isArray(payload?.claimedIds)
    ? Array.from(
        new Set(
          payload.claimedIds
            .map((claimId) => Number(claimId))
            .filter((claimId) => REPLAY_ACHIEVEMENT_IDS.includes(claimId))
        )
      )
    : [];

  return {
    walletAddress: getWalletCacheAddress(address || payload?.walletAddress),
    claimedIds
  };
}

function readAllReplayScoreLogs() {
  if (typeof window === 'undefined' || !window.localStorage) return [];

  const submissions = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith('msx-paper-replay-score-log-')) continue;

    const walletAddress = key.replace('msx-paper-replay-score-log-', '');
    const payload = normalizeReplayScoreLog(readStorageJson(key, defaultReplayScoreLog()), walletAddress);
    payload.submissions.forEach((submission) => {
      submissions.push(submission);
    });
  }

  return submissions;
}

function buildStoredReplayLeaderboardArchive() {
  const normalizedArchive = normalizeReplayLeaderboardArchive(
    readStorageJson(REPLAY_LEADERBOARD_ARCHIVE_KEY, defaultReplayLeaderboardArchive())
  );

  return {
    entries: mergeReplayLeaderboardSubmissions(
      normalizedArchive.entries,
      readAllReplayScoreLogs()
        .filter((submission) => submission.status === 'confirmed')
        .map((submission) => ({
          ...submission,
          hallOfFame: true,
          status: 'confirmed'
        }))
    )
  };
}

function buildReplayTradeSummary(trade) {
  if (!trade) {
    return {
      label: 'No replay fill yet',
      shortLabel: 'No fill',
      timestamp: '',
      productLabel: 'Replay desk',
      countLabel: '0 fills'
    };
  }

  const product = getProductById(trade.productId);
  const sideLabel = trade.side === 'buy' ? 'BUY' : 'SELL';
  const productLabel = product?.ticker || trade.productId;

  return {
    label: `${sideLabel} ${productLabel} @ ${formatPrice(trade.price)}`,
    shortLabel: `${sideLabel} ${productLabel}`,
    timestamp: trade.ts,
    productLabel,
    countLabel: '1 fill'
  };
}

function buildReplayScoreSnapshot({ trades, netPnl, accountValue, walletAddress, status = 'confirmed', txHash = '' }) {
  const latestTrade = trades[0] || null;
  const tradeSummary = buildReplayTradeSummary(latestTrade);
  const pnlPercent = STARTING_PAPER_TOKENS > 0 ? roundNumber((Number(netPnl || 0) / STARTING_PAPER_TOKENS) * 100, 2) : 0;

  return {
    version: REPLAY_SCORE_LOG_VERSION,
    submittedAt: new Date().toISOString(),
    netPnl: roundNumber(Number(netPnl || 0), 2),
    pnlPercent,
    accountValue: roundNumber(Number(accountValue || 0), 2),
    walletAddress: walletAddress ? walletAddress.toLowerCase() : '',
    tradeCount: trades.length,
    tradeLabel: tradeSummary.label,
    tradeShortLabel: tradeSummary.shortLabel,
    tradeTimestamp: tradeSummary.timestamp,
    productLabel: tradeSummary.productLabel,
    status,
    txHash
  };
}

function getCostModel(product) {
  return {
    ...DEFAULT_COST_MODEL,
    ...(product.costModel || {})
  };
}

function getHoldingDays(entryTs, currentTs) {
  if (!entryTs || !currentTs) return 0;
  const diff = new Date(currentTs).getTime() - new Date(entryTs).getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return diff / DAY_MS;
}

function getEstimatedTaxRate(costModel, holdingDays) {
  if (costModel.taxTreatment === 'yield-income') return costModel.incomeTaxRate;
  if (costModel.taxTreatment === 'mixed-income') {
    return holdingDays >= 365 ? Math.min(costModel.longTermTaxRate + 0.03, 0.2) : costModel.incomeTaxRate;
  }
  return holdingDays >= 365 ? costModel.longTermTaxRate : costModel.shortTermTaxRate;
}

function calculateTradeCosts({ product, side, notional, gain = 0, holdingDays = 0, units = 0, marketable = true }) {
  const costModel = getCostModel(product);
  const feeBps = marketable
    ? Number(costModel.takerFeeBps ?? costModel.tradeFeeBps ?? 0)
    : Number(costModel.makerFeeBps ?? costModel.tradeFeeBps ?? 0);
  const tradeFee = roundNumber(notional * (feeBps / 10000), 2);
  const spreadCost = roundNumber(notional * ((Number(costModel.spreadBps || 0) / 10000) * 0.5), 2);
  const fxCost = roundNumber(notional * (costModel.fxBps / 10000), 2);
  const channelCost = roundNumber(notional * (costModel.channelBps / 10000), 2);
  let secFee = 0;
  let tafFee = 0;

  if (side === 'sell' && costModel.regulatoryClass === 'equity') {
    secFee = roundNumber(
      notional * (Number(costModel.secFeeDollarsPerMillion || SEC_SECTION31_DOLLARS_PER_MILLION) / 1000000),
      2
    );
    tafFee = roundNumber(
      Math.min(
        Number(costModel.tafMaxPerTrade || FINRA_TAF_EQUITY_MAX_PER_TRADE),
        Math.max(0, Number(units || 0)) * Number(costModel.tafPerShare || FINRA_TAF_EQUITY_PER_SHARE)
      ),
      2
    );
  }

  const regulatoryFee = roundNumber(secFee + tafFee, 2);
  const nonTaxCost = roundNumber(tradeFee + spreadCost + fxCost + channelCost + regulatoryFee, 2);
  const taxRate = getEstimatedTaxRate(costModel, holdingDays);
  const estimatedTax = side === 'sell' && gain > 0 ? roundNumber(gain * taxRate, 2) : 0;

  return {
    tradeFee,
    spreadCost,
    fxCost,
    channelCost,
    regulatoryFee,
    secFee,
    tafFee,
    nonTaxCost,
    estimatedTax,
    taxRate
  };
}

function getReplayAnnualManagementFeeRate(product, fallbackRate = REPLAY_SPOT_MANAGEMENT_FEE_FALLBACK_RATE) {
  const guide = product ? getReplayProductGuide(product) : null;
  const guideAnnualRate = sumRates((guide?.feeBlueprint || []).filter((row) => row.type === 'annual'));
  const resolvedRate = guideAnnualRate > 0 ? guideAnnualRate : fallbackRate;
  return Math.max(0, Number(resolvedRate || 0));
}

function calculateReplayManagementFee({ product, notional = 0, holdingDays = 0, fallbackRate = REPLAY_SPOT_MANAGEMENT_FEE_FALLBACK_RATE }) {
  const safeNotional = Math.max(0, Number(notional || 0));
  const safeHoldingDays = Math.max(0, Number(holdingDays || 0));
  const annualRate = getReplayAnnualManagementFeeRate(product, fallbackRate);
  return roundNumber(safeNotional * annualRate * (safeHoldingDays / 365), 2);
}

function normalizeFeeDisclosureRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      label: row?.label || 'Fee',
      amount: roundNumber(Number(row?.amount || 0), 2)
    }))
    .filter((row) => row.amount > 0);
}

function formatFeeDisclosureLines(rows = []) {
  return normalizeFeeDisclosureRows(rows).map((row) => `${row.label}: ${formatNotional(row.amount)} PT`);
}

function getFeeDisclosureTotal(rows = []) {
  return roundNumber(normalizeFeeDisclosureRows(rows).reduce((sum, row) => sum + Number(row.amount || 0), 0), 2);
}

function buildSpotSettlementFeeRows(snapshot = {}) {
  const rows = [
    { label: 'Exit trading / spread / channel fees', amount: Number(snapshot.exitCosts?.nonTaxCost || 0) },
    { label: 'Estimated tax holdback', amount: Number(snapshot.exitCosts?.estimatedTax || 0) },
    { label: 'Carry accrual', amount: Number(snapshot.unpaidCarry || 0) },
    { label: 'Management fee', amount: Number(snapshot.managementFee || 0) },
    { label: 'Principal loan repayment', amount: Number(snapshot.principalLoan || 0) }
  ];
  return normalizeFeeDisclosureRows(rows);
}

function buildLeveragedSettlementFeeRows(snapshot = {}, flashReserveCapital = 0) {
  const rows = [
    { label: 'Entry taker fee', amount: Number(snapshot.entryFee || 0) },
    { label: 'Exit taker fee', amount: Number(snapshot.exitFee || 0) },
    { label: 'Funding cost', amount: Number(snapshot.fundingCost || 0) },
    { label: 'Flash premium', amount: Number(snapshot.flashLoanFee || 0) },
    { label: 'Management fee', amount: Number(snapshot.managementFee || 0) },
    { label: 'Released flash reserve offset', amount: -Math.max(0, Number(flashReserveCapital || 0)) }
  ];
  return normalizeFeeDisclosureRows(rows.filter((row) => row.amount > 0));
}

function buildHistoricalPositionFromTrades(trades, productId, currentTs) {
  const emptyPosition = {
    units: 0,
    principal: 0,
    avgEntry: 0,
    carryPaid: 0,
    grossNotional: 0,
    entryFeePaid: 0,
    principalLoan: 0,
    entryTs: ''
  };

  if (!Array.isArray(trades) || !productId || !currentTs) return emptyPosition;

  const cutoffTime = new Date(currentTs).getTime();
  if (!Number.isFinite(cutoffTime)) return emptyPosition;

  return trades
    .filter((trade) => {
      if (trade.productId !== productId) return false;
      const tradeTime = new Date(trade.ts).getTime();
      return Number.isFinite(tradeTime) && tradeTime <= cutoffTime;
    })
    .slice()
    .reverse()
    .reduce((position, trade) => {
      if (trade.side === 'buy') {
        const units = Number(trade.units || 0);
        const incomingNotional = roundNumber(Number(trade.notional || 0), 2);
        const incomingFee = roundNumber(Number(trade.feeTotal || 0), 2);
        const incomingPrincipal = roundNumber(incomingNotional + incomingFee, 2);
        const nextUnits = roundNumber(position.units + units, 6);
        const nextPrincipal = roundNumber(position.principal + incomingPrincipal, 2);
        const nextAvgEntry = nextUnits > 0 ? roundNumber(nextPrincipal / nextUnits, 4) : 0;
        const existingWeight = position.principal || 0;
        const incomingWeight = incomingPrincipal;
        const weightedEntryMs =
          existingWeight + incomingWeight > 0
            ? Math.round(
                ((position.entryTs ? new Date(position.entryTs).getTime() : new Date(trade.ts).getTime()) * existingWeight +
                  new Date(trade.ts).getTime() * incomingWeight) /
                  (existingWeight + incomingWeight)
              )
            : new Date(trade.ts).getTime();

        return {
          units: nextUnits,
          principal: nextPrincipal,
          avgEntry: nextAvgEntry,
          carryPaid: roundNumber(position.carryPaid || 0, 2),
          grossNotional: roundNumber((position.grossNotional || 0) + incomingNotional, 2),
          entryFeePaid: roundNumber((position.entryFeePaid || 0) + incomingFee, 2),
          principalLoan: roundNumber(Number(position.principalLoan || 0) + Number(trade.loanApplied || 0), 2),
          entryTs: new Date(weightedEntryMs).toISOString()
        };
      }

      const unitsToSell = roundNumber(Math.min(position.units, Number(trade.units || 0)), 6);
      if (unitsToSell <= 0) return position;

      const remainingUnits = roundNumber(Math.max(0, position.units - unitsToSell), 6);
      const principalReduction = roundNumber(unitsToSell * position.avgEntry, 2);
      const remainingPrincipal = roundNumber(Math.max(0, position.principal - principalReduction), 2);
      const nextCarryPaid = roundNumber((position.carryPaid || 0) + Number(trade.carryTotal || 0), 2);
      const ratio = position.units > 0 ? Math.min(1, unitsToSell / position.units) : 0;
      const remainingGrossNotional = roundNumber(Math.max(0, (position.grossNotional || 0) * (1 - ratio)), 2);
      const remainingEntryFeePaid = roundNumber(Math.max(0, (position.entryFeePaid || 0) * (1 - ratio)), 2);
      const loanRepaid = roundNumber(
        Math.min(
          Math.max(0, Number(position.principalLoan || 0)),
          Number(trade.loanRepaid || 0) > 0
            ? Number(trade.loanRepaid || 0)
            : Math.max(0, Number(position.principalLoan || 0)) * ratio
        ),
        2
      );
      const remainingPrincipalLoan = roundNumber(Math.max(0, Number(position.principalLoan || 0) - loanRepaid), 2);

      if (remainingUnits <= 0) {
        return emptyPosition;
      }

      return {
        units: remainingUnits,
        principal: remainingPrincipal,
        avgEntry: roundNumber(remainingPrincipal / remainingUnits, 4),
        carryPaid: nextCarryPaid,
        grossNotional: remainingGrossNotional,
        entryFeePaid: remainingEntryFeePaid,
        principalLoan: remainingPrincipalLoan,
        entryTs: position.entryTs
      };
    }, emptyPosition);
}

function buildPositionSnapshot(product, position, markPrice, currentTs) {
  const grossValue = roundNumber((position.units || 0) * markPrice, 2);
  const holdingDays = getHoldingDays(position.entryTs, currentTs);
  const annualCarryRate = getCostModel(product).annualCarryBps / 10000;
  const totalCarryAccrued = roundNumber((position.principal || 0) * annualCarryRate * (holdingDays / 365), 2);
  const unpaidCarry = roundNumber(Math.max(0, totalCarryAccrued - Number(position.carryPaid || 0)), 2);
  const principalLoan = roundNumber(Math.max(0, Number(position.principalLoan || 0)), 2);
  const walletPrincipal = roundNumber(Math.max(0, Number(position.principal || 0) - principalLoan), 2);
  const grossNotional = roundNumber(
    Number(position.grossNotional || Math.max(0, Number(position.principal || 0) - Number(position.entryFeePaid || 0))),
    2
  );
  const entryFeeRemaining = roundNumber(
    Number(position.entryFeePaid || Math.max(0, Number(position.principal || 0) - grossNotional)),
    2
  );
  const marketMovePnl = roundNumber(grossValue - grossNotional, 2);
  const managementFee = calculateReplayManagementFee({
    product,
    notional: grossNotional || Number(position.principal || 0),
    holdingDays
  });
  const grossGainAfterCarry = roundNumber(Math.max(0, grossValue - position.principal - unpaidCarry - managementFee), 2);
  const exitCosts = calculateTradeCosts({
    product,
    side: 'sell',
    notional: grossValue,
    gain: grossGainAfterCarry,
    holdingDays,
    units: Number(position.units || 0)
  });
  const netExitBeforeLoan = roundNumber(
    Math.max(0, grossValue - unpaidCarry - managementFee - exitCosts.nonTaxCost - exitCosts.estimatedTax),
    2
  );
  const netExitValue = roundNumber(Math.max(0, netExitBeforeLoan - principalLoan), 2);
  const grossPnl = roundNumber(grossValue - position.principal, 2);
  const netPnl = roundNumber(netExitValue - walletPrincipal, 2);

  return {
    grossValue,
    holdingDays,
    grossNotional,
    entryFeeRemaining,
    marketMovePnl,
    unpaidCarry,
    managementFee,
    exitCosts,
    netExitValue,
    principalLoan,
    walletPrincipal,
    grossPnl,
    netPnl
  };
}

function getMaxBuyNotionalForFunding(product, cash = 0, principalLoanBudget = 0) {
  const safeCash = Math.max(0, Number(cash || 0));
  const safeLoanBudget = Math.max(0, Number(principalLoanBudget || 0));
  if (!product || (safeCash <= 0 && safeLoanBudget <= 0)) return 0;

  let low = 0;
  let high = safeCash + safeLoanBudget;
  for (let index = 0; index < 28; index += 1) {
    const mid = (low + high) / 2;
    const costs = calculateTradeCosts({ product, side: 'buy', notional: mid });
    const cashRequired = Math.max(0, mid - safeLoanBudget) + Number(costs.nonTaxCost || 0);
    if (cashRequired <= safeCash + 0.01) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return roundNumber(low, 2);
}

function getPrincipalLoanForBuy({ product, notional = 0, cash = 0, principalLoanBudget = 0 }) {
  const safeNotional = Math.max(0, Number(notional || 0));
  const safeCash = Math.max(0, Number(cash || 0));
  const safeLoanBudget = Math.max(0, Number(principalLoanBudget || 0));
  if (!product || safeNotional <= 0 || safeLoanBudget <= 0) return 0;

  const costs = calculateTradeCosts({ product, side: 'buy', notional: safeNotional });
  const cashAfterUpfrontDrag = Math.max(0, safeCash - Number(costs.nonTaxCost || 0));
  return roundNumber(Math.min(safeLoanBudget, safeNotional, Math.max(0, safeNotional - cashAfterUpfrontDrag)), 2);
}

function buildLeveragedReplaySnapshot({
  direction = 'long',
  marginCapital,
  leverage = 1,
  entryBar,
  targetBar,
  holdingDays = 0,
  targetNotional = 0,
  flashLoanAmount = 0,
  flashLoanFee = 0,
  managementFeeRate = REPLAY_PERP_MANAGEMENT_FEE_RATE
}) {
  const entryPrice = Number(entryBar?.close || 0);
  const exitPrice = Number(targetBar?.close || 0);
  const safeMargin = Math.max(0, Number(marginCapital || 0));
  const safeLeverage = Math.max(1, Number(leverage || 1));
  const safeFlashLoanAmount = roundNumber(Math.max(0, Number(flashLoanAmount || 0)), 2);

  if (!safeMargin || !entryPrice || !exitPrice) return null;

  const directionMultiplier = direction === 'short' ? -1 : 1;
  const baseNotional = roundNumber(safeMargin * safeLeverage, 2);
  const desiredNotional = roundNumber(Math.max(0, Number(targetNotional || 0)), 2);
  const flashedNotional = roundNumber(baseNotional + safeFlashLoanAmount, 2);
  const exposureNotional = roundNumber(Math.max(baseNotional, desiredNotional, flashedNotional), 2);
  const effectiveFlashLoanAmount = roundNumber(Math.max(0, exposureNotional - baseNotional), 2);
  const effectiveHoldingDays = Math.max(0, Number(holdingDays || 0));
  const priceMoveRate = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * directionMultiplier : 0;
  const priceMovePnl = roundNumber(exposureNotional * priceMoveRate, 2);
  const moveFive = roundNumber(exposureNotional * 0.05, 2);
  const entryFee = roundNumber(exposureNotional * KRAKEN_PERP_APP_TAKER_FEE_RATE, 2);
  const exitFeeBase = Math.max(0, roundNumber(exposureNotional + priceMovePnl, 2));
  const exitFee = roundNumber(exitFeeBase * KRAKEN_PERP_APP_TAKER_FEE_RATE, 2);
  const fundingWindows = effectiveHoldingDays > 0 ? effectiveHoldingDays * 3 : 0;
  const fundingCost = roundNumber(exposureNotional * KRAKEN_PERP_FUNDING_RATE_PER_8H * fundingWindows, 2);
  const effectiveFlashLoanFee =
    Number(flashLoanFee || 0) > 0
      ? roundNumber(Math.max(0, Number(flashLoanFee || 0)), 2)
      : roundNumber(effectiveFlashLoanAmount * AAVE_FLASH_LOAN_PREMIUM_RATE, 2);
  const managementFee = roundNumber(
    exposureNotional * Math.max(0, Number(managementFeeRate || 0)) * (effectiveHoldingDays / 365),
    2
  );
  const initialMarginRate = 1 / safeLeverage;
  const maintenanceMarginRate = Math.max(PERP_MAINTENANCE_MARGIN_FLOOR_RATE, initialMarginRate * 0.2);
  const maintenanceMargin = roundNumber(exposureNotional * maintenanceMarginRate, 2);
  const liquidationLossBudget = roundNumber(Math.max(0, safeMargin - maintenanceMargin), 2);
  const liquidationMoveRate = exposureNotional > 0 ? liquidationLossBudget / exposureNotional : 0;
  const liquidationPrice =
    direction === 'short'
      ? roundNumber(entryPrice * (1 + liquidationMoveRate), 2)
      : roundNumber(Math.max(0, entryPrice * (1 - liquidationMoveRate)), 2);
  const netExitValue = roundNumber(
    Math.max(0, safeMargin + priceMovePnl - entryFee - exitFee - fundingCost - effectiveFlashLoanFee - managementFee),
    2
  );
  const netPnl = roundNumber(netExitValue - safeMargin, 2);

  return {
    direction,
    marginCapital: safeMargin,
    leverage: safeLeverage,
    baseNotional,
    desiredNotional,
    exposureNotional,
    flashLoanAmount: effectiveFlashLoanAmount,
    effectiveHoldingDays,
    priceMoveRate,
    priceMovePnl,
    moveFive,
    entryFee,
    exitFee,
    fundingCost,
    flashLoanFee: effectiveFlashLoanFee,
    managementFee,
    initialMarginRate,
    maintenanceMarginRate,
    maintenanceMargin,
    liquidationPrice,
    netExitValue,
    netPnl
  };
}

function getWealthStateKey(address) {
  return address ? `msx-wealth-state-${address.toLowerCase()}` : '';
}

function buildDefaultWealthDeskState() {
  return {
    paperCash: 0,
    wealthCash: 0,
    collateralBorrowed: 0,
    pledgedProducts: 0,
    collateralAnnualCarry: 0,
    collateralAverageApy: 0,
    fixedPledgeProducts: 0,
    flexiblePledgeProducts: 0
  };
}

function readStoredWealthDeskState(address) {
  if (!address) return buildDefaultWealthDeskState();

  const wealthState = readStorageJson(getWealthStateKey(address), {
    cash: 0,
    collateral: {}
  });
  const collateralEntries = Object.values(wealthState?.collateral || {});
  const collateralBorrowed = collateralEntries.reduce((sum, entry) => sum + Number(entry?.borrowedAmount || 0), 0);
  const collateralAnnualCarry = collateralEntries.reduce(
    (sum, entry) => sum + Number(entry?.borrowedAmount || 0) * Number(entry?.apy || 0),
    0
  );
  const fixedPledgeProducts = collateralEntries.filter((entry) => entry?.termMode === 'fixed').length;
  const flexiblePledgeProducts = collateralEntries.filter((entry) => entry?.termMode !== 'fixed').length;

  return {
    paperCash: 0,
    wealthCash: getWealthSpendableCash(wealthState),
    collateralBorrowed: roundNumber(collateralBorrowed, 2),
    pledgedProducts: collateralEntries.length,
    collateralAnnualCarry: roundNumber(collateralAnnualCarry, 2),
    collateralAverageApy: collateralBorrowed > 0 ? collateralAnnualCarry / collateralBorrowed : 0,
    fixedPledgeProducts,
    flexiblePledgeProducts
  };
}

function readStoredPaperState(address) {
  const storedState = normalizePaperState(readStorageJson(getPaperStateKey(address), defaultPaperState()));
  return normalizePaperState(readRecoveredPaperState(address, storedState));
}

function readStoredTradeOutcomeHistory(address) {
  const stored = normalizeTradeOutcomeHistory(readStorageJson(getTradeOutcomeHistoryKey(address), defaultTradeOutcomeHistory()));
  if (stored.entries.length || !address) return stored;

  return normalizeTradeOutcomeHistory(readWalletProfile(address)?.paper?.tradeOutcomeHistory || defaultTradeOutcomeHistory());
}

function readStoredReplaySession(address) {
  return buildProductViewsFromSession(readStorageJson(getReplaySessionKey(address), buildDefaultReplaySession()));
}

function sumTradeOutcomePnlForDay(entries = [], dayKey = '') {
  if (!dayKey) return 0;
  return roundNumber(
    entries.reduce((sum, entry) => (entry?.dayKey === dayKey ? sum + Number(entry?.pnl || 0) : sum), 0),
    2
  );
}

function sumTradeOutcomeGrantForDay(entries = [], dayKey = '') {
  if (!dayKey) return 0;
  return roundNumber(
    entries.reduce(
      (sum, entry) => (entry?.dayKey === dayKey ? sum + Number(entry?.compensationGranted || 0) : sum),
      0
    ),
    2
  );
}

function sumRates(rows = []) {
  return rows.reduce((sum, row) => sum + Number(row?.rate || 0), 0);
}

function getReplayProductGuide(product) {
  return {
    ...(REPLAY_LANE_GUIDES[product.lane] || REPLAY_LANE_GUIDES.public),
    ...(PRODUCT_GUIDE_OVERRIDES[product.id] || {})
  };
}

function buildFallbackProductInsight(product) {
  const common = {
    diligenceScore: product.risk === 'Low' ? 88 : product.risk === 'Medium' ? 82 : 76,
    holdings: [],
    feeStack: [],
    earningsBridge: [],
    investorWorries: [],
    cexMath: [],
    automation: [],
    tokenRights: []
  };

  switch (product.lane) {
    case 'funding':
      return {
        ...common,
        holdings: [
          { name: 'Underlying treasury / cash sleeve', weight: '72%', role: 'Primary NAV anchor' },
          { name: 'Wrapper liquidity reserve', weight: '18%', role: 'Supports subscriptions and redemptions' },
          { name: 'Operational cash buffer', weight: '10%', role: 'Handles transfers and settlement timing' }
        ],
        feeStack: [
          'Most drag comes from wrapper spread, FX, and redemption plumbing rather than from a visible ticket fee.',
          'Yield products in this lane should be read as net of reserve management and route friction, not as raw Treasury carry.'
        ],
        earningsBridge: [
          `Return is mainly tied to ${product.returnSource.toLowerCase()}.`,
          'The real lesson is how a stable-looking chart can still hide access, routing, and redemption assumptions.'
        ],
        investorWorries: [
          'How quickly can I get money out if the route gets crowded?',
          'Is the wrapper really exposing me to the underlying reserve sleeve I think I own?'
        ],
        cexMath: [
          'A cash rail should separate gross yield, route drag, and final user net instead of collapsing them into one APY.'
        ],
        automation: [
          'Reserve and redemption monitors should pause new flow before liquidity pressure turns into a user surprise.'
        ],
        tokenRights: [
          'The receipt should disclose whether the user owns fund shares, a note claim, or a tracker certificate.'
        ]
      };
    case 'yield':
      return {
        ...common,
        holdings: [
          { name: 'Income-producing strategy sleeve', weight: '64%', role: 'Primary payout driver' },
          { name: 'Collateral / reserve sleeve', weight: '22%', role: 'Buffers liquidity and execution timing' },
          { name: 'Operational turnover buffer', weight: '14%', role: 'Absorbs route and rebalance drag' }
        ],
        feeStack: [
          'Headline yield usually mixes real income with turnover drag, wrapper cost, and tax complexity.',
          'If the route sells volatility or premium, the payout should never be read as guaranteed income.'
        ],
        earningsBridge: [
          `Return is mainly tied to ${product.returnSource.toLowerCase()}.`,
          'A higher distribution rate often means more structure, path dependence, or capped upside.'
        ],
        investorWorries: [
          'What part of the payout is real carry versus option or strategy risk?',
          'Does the final take-home still look attractive after fees, taxes, and path dependence?'
        ],
        cexMath: [
          'Yield routes should show gross source-of-return, wrapper drag, and net-to-user value as separate numbers.'
        ],
        automation: [
          'Term, rollover, or strategy monitors should disclose when the route is changing its behavior under the hood.'
        ],
        tokenRights: [
          'Users should see whether they own a passive receipt, an actively managed sleeve, or a structured claim.'
        ]
      };
    case 'public':
      return {
        ...common,
        holdings: [
          { name: 'Underlying listed asset exposure', weight: '92%', role: 'Primary economic driver' },
          { name: 'Wrapper inventory and reserve', weight: '5%', role: 'Supports quoting and routing' },
          { name: 'Operational balance', weight: '3%', role: 'Handles transfers and corporate actions' }
        ],
        feeStack: [
          'Public wrappers should show the underlying move separately from spread, funding route, and tax drag.',
          'A familiar ticker can still have unfamiliar rights and liquidity conditions once a token wrapper sits on top.'
        ],
        earningsBridge: [
          `Return is mainly tied to ${product.returnSource.toLowerCase()}.`,
          'The wrapper adds convenience and composability, but it can also add friction or rights differences.'
        ],
        investorWorries: [
          'Do I really have the same rights as the underlying stock, ETF, or commodity wrapper?',
          'How much spread and routing drag do I pay before I even start comparing performance?'
        ],
        cexMath: [
          'Tokenized public assets should show wrapper drag explicitly instead of pretending the chart is the whole story.'
        ],
        automation: [
          'Quote monitors and corporate-action watchers should update the wrapper before users discover the mismatch themselves.'
        ],
        tokenRights: [
          'Rights should clarify whether voting, dividends, redemptions, or passthrough events reach the wallet holder.'
        ]
      };
    case 'private':
      return {
        ...common,
        holdings: [
          { name: 'Late-stage private share exposure', weight: '80%', role: 'Main valuation driver' },
          { name: 'SPV or feeder layer', weight: '12%', role: 'Defines legal path and transfer rights' },
          { name: 'Admin and legal reserve', weight: '8%', role: 'Covers servicing and transaction overhead' }
        ],
        feeStack: [
          'Private routes usually hide their biggest drag in legal, transfer, and secondary-exit friction rather than in a ticket fee.',
          'A private mark can stay stale for months and still fail to represent a real exit.'
        ],
        earningsBridge: [
          `Return is mainly tied to ${product.returnSource.toLowerCase()}.`,
          'The chart is educational, not a live tape, because private transfer markets do not publish a clean public series.'
        ],
        investorWorries: [
          'What exactly do I own through the SPV or feeder?',
          'Can I actually exit, or am I just watching a mark change on paper?'
        ],
        cexMath: [
          'Private products should explain rights, transferability, and event timing before showing any valuation path.'
        ],
        automation: [
          'Eligibility, tender windows, and stale-mark checks matter more than speed or order type automation here.'
        ],
        tokenRights: [
          'Transfer restrictions, lockups, and legal claim hierarchy belong in plain English near the product surface.'
        ]
      };
    case 'leverage':
      return {
        ...common,
        holdings: [
          { name: 'Underlying directional exposure', weight: '74%', role: 'Base market driver' },
          { name: 'Leverage / funding layer', weight: '16%', role: 'Adds carry and reset drag' },
          { name: 'Risk buffer or margin reserve', weight: '10%', role: 'Shapes liquidation and exit path' }
        ],
        feeStack: [
          'Leverage routes need spread, funding, and reset drag visible next to PnL, not hidden under price performance.',
          'The same move can feel very different once leverage and daily reset math sit on top.'
        ],
        earningsBridge: [
          `Return is mainly tied to ${product.returnSource.toLowerCase()}.`,
          'What matters is path dependence, not just whether the final direction was right.'
        ],
        investorWorries: [
          'How much of my gross move survives after funding, reset drag, and turnover?',
          'Am I buying a hedge or a product that decays if I hold it too long?'
        ],
        cexMath: [
          'Leverage products need margin-style explanation even when they are packaged as listed ETFs or simple perp tutorials.'
        ],
        automation: [
          'Risk engines should warn before users hit the liquidation or decay zone, not after.'
        ],
        tokenRights: [
          'The practical rights here are venue and risk-engine rules, not classic issuer rights.'
        ]
      };
    case 'strategy':
      return {
        ...common,
        holdings: [
          { name: 'Underlying market sleeve', weight: '58%', role: 'Reference asset path' },
          { name: 'Option or structured payoff layer', weight: '30%', role: 'Creates the distribution and cap profile' },
          { name: 'Servicing reserve', weight: '12%', role: 'Covers issuer, dealer, or ETF route drag' }
        ],
        feeStack: [
          'Strategy products often convert upside into income, so the key drag is hidden in the payoff formula, not just in fees.',
          'Users need the route logic, not only the chart.'
        ],
        earningsBridge: [
          `Return is mainly tied to ${product.returnSource.toLowerCase()}.`,
          'A high distribution rate does not remove path dependence, downside, or early-exit risk.'
        ],
        investorWorries: [
          'What exactly is capped, sold, buffered, or transformed in the payoff?',
          'Does the yield compensate for the option or structure risk I am taking?'
        ],
        cexMath: [
          'Structured-yield routes should show settlement logic and downside cases before they show headline income.'
        ],
        automation: [
          'Barrier, maturity, or rebalance events should be surfaced as first-class product behavior.'
        ],
        tokenRights: [
          'Users should know whether they own a note claim, an ETF share, or a transferable structured wrapper.'
        ]
      };
    case 'ai':
      return {
        ...common,
        holdings: [
          { name: 'Model-led allocation sleeve', weight: '68%', role: 'Main performance driver' },
          { name: 'Execution reserve', weight: '18%', role: 'Absorbs turnover and slippage' },
          { name: 'Override buffer', weight: '14%', role: 'Lets humans pause or correct the route' }
        ],
        feeStack: [
          'Automation routes should separate model fee, turnover drag, and execution cost instead of burying them in one number.'
        ],
        earningsBridge: [
          `Return is mainly tied to ${product.returnSource.toLowerCase()}.`,
          'The model matters only if signal quality survives live execution.'
        ],
        investorWorries: [
          'Who can override the model and when?',
          'How stale can the data get before the route should pause itself?'
        ],
        cexMath: [
          'Automation is a route choice, not a guarantee of better execution.'
        ],
        automation: [
          'Signal freshness, kill-switches, and override rules should stay visible on the product surface.'
        ],
        tokenRights: [
          'If a strategy receipt exists, it should disclose governance, action logs, and override rules.'
        ]
      };
    default:
      return common;
  }
}

function getPaperDiligenceBucket(lane) {
  if (lane === 'funding') return 'starter';
  if (lane === 'yield') return 'fixed';
  if (lane === 'private') return 'strategy';
  if (lane === 'strategy') return 'structured';
  return 'strategy';
}

function buildPaperDiligenceProduct(product, insight, guide) {
  const holdingsCopy = (insight?.holdings || [])
    .slice(0, 4)
    .map((holding) => `${holding.name} ${holding.weight || ''} ${holding.role || ''}`)
    .join('; ');
  const feeCopy = (insight?.feeStack || []).join(' ');
  const returnCopy = (insight?.earningsBridge || []).join(' ') || guide?.fundingLine || '';
  const stressCopy = (guide?.stressScenarios || [])
    .map((scenario) => `${scenario.label}: ${scenario.impact}`)
    .join(' ');

  return {
    id: product?.id,
    name: product?.name,
    shortName: product?.ticker || product?.shortName || product?.name,
    bucket: getPaperDiligenceBucket(product?.lane),
    risk: product?.risk,
    productType: guide?.structureLabel || product?.type || product?.lane,
    status: product?.status || 'Bundled replay product',
    liveTieIn: product?.liveTieIn || guide?.fundingLine || 'Local replay evidence bundled with the demo.',
    marketSource: product?.marketSource || guide?.marketCapValue || 'Proxy replay series',
    apyRange: guide?.targetYieldRate ? `${formatSignedPercent(guide.targetYieldRate * 100)} target route yield` : product?.priceLabel,
    annualYieldBasis: guide?.targetYieldRate ? 'Replay route target yield' : 'Replay price path',
    underlying: holdingsCopy || product?.description || product?.ticker,
    yieldSource: returnCopy || product?.description,
    redemption: `${guide?.redemptionWindow || 'Replay window'} / ${guide?.exitChannel || 'paper close route'}`,
    suitableFor: guide?.summary || product?.description || 'Paper-trading learner testing product mechanics before execution.',
    worstCase: stressCopy || 'The user misreads payoff, liquidity, or route drag before placing the paper ticket.',
    shareToken: product?.ticker || product?.id,
    minSubscription: MIN_PAPER_TRADE,
    fees: {
      management: feeCopy || 'Route drag and spread are shown in the paper ticket.'
    },
    shareRights: insight?.tokenRights || [],
    automation: insight?.automation || [],
    diligenceChecks: [
      {
        id: `${product?.id || 'paper'}-structure`,
        dimensionId: 'structure',
        label: 'Simulation structure',
        status: 'Pass',
        detail: guide?.structureLabel || 'The paper route explains the product structure before execution.'
      },
      {
        id: `${product?.id || 'paper'}-pricing`,
        dimensionId: 'pricing',
        label: 'Replay pricing',
        status: String(product?.marketSource || '').toLowerCase().includes('proxy') ? 'Review' : 'Pass',
        detail: product?.marketSource || 'The replay uses a bundled price path or local product proxy.'
      },
      {
        id: `${product?.id || 'paper'}-liquidity`,
        dimensionId: 'liquidity',
        label: 'Exit route',
        status: String(guide?.redemptionWindow || '').toLowerCase().includes('lock') ? 'Watch' : 'Review',
        detail: `${guide?.redemptionWindow || 'Replay window'} / ${guide?.exitChannel || 'paper close route'}`
      }
    ]
  };
}

function getDeskToolOptions(product) {
  return REPLAY_ROUTE_TOOL_BY_LANE[product.lane] || ['single'];
}

function getBarsTimeSpanDays(bars = []) {
  if (!bars.length) return 0;
  const start = new Date(bars[0].ts).getTime();
  const end = new Date(bars[bars.length - 1].ts).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, (end - start) / DAY_MS);
}

function annualizeReturn(totalReturn, days) {
  if (!Number.isFinite(totalReturn) || !Number.isFinite(days) || days <= 0) return 0;
  if (totalReturn <= -0.9999) return -1;
  return Math.pow(1 + totalReturn, 365 / days) - 1;
}

function getMaxDrawdownFromBars(bars = []) {
  if (!bars.length) return 0;
  let peak = Number(bars[0].close || 0);
  let maxDrawdown = 0;

  bars.forEach((bar) => {
    const close = Number(bar.close || 0);
    if (!Number.isFinite(close) || close <= 0) return;
    if (close > peak) peak = close;
    const drawdown = peak > 0 ? (close - peak) / peak : 0;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  return maxDrawdown;
}

function getReplayWindowScorecard(view) {
  const bars = view?.bars || [];
  if (!bars.length) {
    return {
      label: '7D',
      sampleDays: 7,
      returnRate: 0,
      annualizedRate: 0,
      drawdownRate: 0,
      startBar: null,
      endBar: null
    };
  }

  const cacheKey = Array.isArray(bars) ? bars : null;
  if (cacheKey && replayWindowScorecardCache.has(cacheKey)) {
    return replayWindowScorecardCache.get(cacheKey);
  }

  const endTime = new Date(bars[bars.length - 1].ts).getTime();
  const targetDays = getBarsTimeSpanDays(bars) >= 90 ? 90 : 7;
  const cutoff = endTime - targetDays * DAY_MS;
  let startIndex = bars.findIndex((bar) => new Date(bar.ts).getTime() >= cutoff);
  if (startIndex < 0) {
    startIndex = Math.max(0, bars.length - (targetDays >= 90 ? 90 : 7));
  }
  const sample = bars.slice(startIndex);
  const startBar = sample[0] || bars[0];
  const endBar = sample[sample.length - 1] || bars[bars.length - 1];
  const startClose = Number(startBar?.close || 0);
  const endClose = Number(endBar?.close || 0);
  const sampleDays = Math.max(1, getBarsTimeSpanDays(sample));
  const returnRate = startClose > 0 ? endClose / startClose - 1 : 0;

  const scorecard = {
    label: targetDays >= 90 ? '3M' : '7D',
    sampleDays,
    returnRate,
    annualizedRate: annualizeReturn(returnRate, sampleDays),
    drawdownRate: getMaxDrawdownFromBars(sample),
    startBar,
    endBar
  };

  if (cacheKey) {
    replayWindowScorecardCache.set(cacheKey, scorecard);
  }

  return scorecard;
}

function hasReliableReplayWindow(product, view) {
  const bars = view?.bars || [];
  const hasExternalHistory = product.sourceType !== 'local' || Boolean(product.csvPath);
  return hasExternalHistory && bars.length >= 7;
}

function formatMarketCapLabel(value) {
  return value || '--';
}

function getReplaySevenDayBars(bars = []) {
  if (bars.length < 2) return bars;
  const lastTimestamp = new Date(bars[bars.length - 1].ts).getTime();
  const cutoff = lastTimestamp - 7 * DAY_MS;
  const rangeBars = bars.filter((bar) => new Date(bar.ts).getTime() >= cutoff);
  return rangeBars.length >= 2 ? rangeBars : bars.slice(Math.max(0, bars.length - 7));
}

function getReplaySevenDayChangePercent(bars = []) {
  const rangeBars = getReplaySevenDayBars(bars);
  if (rangeBars.length < 2) return 0;
  const start = Number(rangeBars[0]?.open || rangeBars[0]?.close || 0);
  const end = Number(rangeBars[rangeBars.length - 1]?.close || 0);
  if (!Number.isFinite(start) || start === 0 || !Number.isFinite(end)) return 0;
  return ((end - start) / start) * 100;
}

function getReplayRiskFit(product) {
  if (product.risk === 'Low') return 'conservative';
  if (product.risk === 'Medium') return 'balanced';
  return 'aggressive';
}

function getReplayLockupFit(guide) {
  return Number(guide?.lockupDays || 0) > 0 ? 'lockup' : 'flex';
}

function getReplayVolatilityFit(product) {
  if (product.risk === 'High' || ['public', 'leverage', 'strategy'].includes(product.lane)) return 'high';
  return 'low';
}

function buildRouteStructureOptions(product, guide, routeId = 'spot') {
  const toolIds = getDeskToolOptions(product);
  if (routeId === 'lending') {
    const options = [
      {
        id: 'single',
        label: 'Base sleeve',
        copy: 'Keep one earn sleeve readable first so carry source, fees, and withdrawal rules stay visible.'
      }
    ];

    if (toolIds.includes('collateral')) {
      options.push({
        id: 'collateral',
        label: 'Collateral recycle',
        copy: 'Use a calmer sleeve as collateral, then inspect whether the borrowed leg still adds net yield after drag.'
      });
    }

    if (guide.allowEarlyRedeem === false) {
      options.push({
        id: 'maturity',
        label: 'Hold to maturity',
        copy: 'Closed-ended yield sleeves settle by maturity or transfer instead of instant issuer redemption.'
      });
    }

    return options;
  }

  if (routeId === 'borrow') {
    const options = [
      {
        id: 'single',
        label: 'Base template',
        copy: 'Start with one clean payoff card before you layer in extra sleeves or borrowed legs.'
      }
    ];

    if (toolIds.includes('combo')) {
      options.push({
        id: 'combo',
        label: 'Basket overlay',
        copy: 'Blend the current idea with an anchor sleeve so diversification and blended drag stay visible.'
      });
    }

    if (toolIds.includes('collateral')) {
      options.push({
        id: 'collateral',
        label: 'Collateral loop',
        copy: 'Use a lower-vol sleeve as collateral, open a route support line, then let the active template read that support without counting it as new wallet cash.'
      });
    }

    if (guide.allowEarlyRedeem === false) {
      options.push({
        id: 'maturity',
        label: 'Structured exit',
        copy: 'Closed-ended sleeves should teach settlement and payoff timing before live execution details.'
      });
    }

    return options;
  }

  if (routeId === 'routing') {
    return [
      {
        id: 'single',
        label: 'Rule preview',
        copy: 'Keep one automation rule visible first so cadence, guardrails, and override logic stay easy to read.'
      }
    ];
  }

  const options = [
    {
      id: 'single',
      label: 'Base ticket',
      copy: 'Use one product only so entry, fee drag, tax, and exit path stay easy to read.'
    },
    {
      id: 'dca',
      label: 'DCA plan',
      copy: 'Split the entry into several smaller buys so you can compare smoother timing against extra fee drag.'
    }
  ];

  if (toolIds.includes('combo')) {
    options.push({
      id: 'combo',
      label: 'Anchor + active basket',
      copy: 'Blend the current product with a calmer anchor sleeve so diversification and blended drag stay visible.'
    });
  }

  if (toolIds.includes('collateral')) {
    options.push({
      id: 'collateral',
      label: 'Collateral route',
      copy: 'Use a lower-vol sleeve as collateral, open a route support line, then let the active ticket read that support without counting it as new wallet cash.'
    });
  }

  if (toolIds.includes('flash')) {
    options.push({
      id: 'flash',
      label: 'Flash route',
      copy: 'Check whether same-path liquidity, spread edge, and one-block unwind conditions are strong enough.'
    });
  }

  if (guide.allowEarlyRedeem === false) {
    options.push({
      id: 'maturity',
      label: 'Maturity path',
      copy: 'Closed-ended sleeves settle by maturity or transfer, not by instant issuer redemption.'
    });
  }

  return options;
}

function buildFundingBreakdown(availableCash, rewardCredit, wealthDeskState) {
  const wealthReceiptSupport = Number(wealthDeskState?.collateralBorrowed || 0);
  const wealthReceiptSupportAnnualCarry = Number(wealthDeskState?.collateralAnnualCarry || 0);
  const corePaperCash = Math.max(0, Number(availableCash || 0) - Number(rewardCredit || 0));
  return {
    corePaperCash,
    rewardCredit: Number(rewardCredit || 0),
    wealthReceiptSupport,
    wealthReceiptSupportAnnualCarry,
    wealthReceiptSupportApy: wealthReceiptSupport > 0 ? wealthReceiptSupportAnnualCarry / wealthReceiptSupport : 0
  };
}

function buildDeskSimulation({
  product,
  guide,
  routeId,
  structureMode,
  amount,
  holdingDays,
  riskPreference,
  allowLockup,
  acceptVolatility,
  routeLeverage,
  routeBufferRatio,
  routeSettlementMode,
  focusBar,
  selectedView,
  rewardCredit,
  wealthDeskState
}) {
  const notional = Math.max(MIN_PAPER_TRADE, Number(amount || 0));
  const windowScorecard = getReplayWindowScorecard(selectedView);
  const grossYieldRate = Math.max(0, guide.targetYieldRate ?? windowScorecard.annualizedRate);
  const feeBlueprint = guide.feeBlueprint || [];
  const entryRate = sumRates(feeBlueprint.filter((row) => row.type === 'entry'));
  const annualFeeRate = sumRates(feeBlueprint.filter((row) => row.type === 'annual'));
  const performanceFeeRate = sumRates(feeBlueprint.filter((row) => row.type === 'performance'));
  const conditionalPenaltyRate = sumRates(feeBlueprint.filter((row) => row.type === 'conditional'));
  const routeMultiplier =
    routeId === 'perp'
      ? Math.max(1, Number(routeLeverage || 1))
      : routeId === 'borrow'
        ? 1 + Math.max(0.2, Number(routeBufferRatio || 0.5)) * 0.24
        : routeId === 'routing'
          ? routeSettlementMode === 'T+N'
            ? 0.88
            : routeSettlementMode === 'T+1'
              ? 0.94
              : 0.98
          : routeId === 'lending'
            ? 0.88
            : 1;
  const structureMultiplier =
    structureMode === 'combo'
      ? 0.74
      : structureMode === 'dca'
        ? 0.88
      : structureMode === 'collateral'
        ? 1.12
          : structureMode === 'flash'
            ? 0.42
          : structureMode === 'maturity'
            ? 0.92
            : 1;
  const grossAnnualRate = grossYieldRate * routeMultiplier * structureMultiplier;
  const grossPeriodRate = grossAnnualRate * (holdingDays / 365);
  const entryCost = roundNumber(notional * entryRate * (structureMode === 'dca' ? 1.38 : 1), 2);
  const ongoingCost = roundNumber(notional * annualFeeRate * (holdingDays / 365), 2);
  const rawGrossGain = roundNumber(notional * grossPeriodRate, 2);
  const performanceFee = rawGrossGain > 0 ? roundNumber(rawGrossGain * performanceFeeRate, 2) : 0;
  const earlyPenaltyApplies = holdingDays < Math.max(guide.lockupDays || 0, guide.settlementLagDays || 0) && guide.allowEarlyRedeem !== false;
  const earlyRedemptionFee = earlyPenaltyApplies ? roundNumber(notional * conditionalPenaltyRate, 2) : 0;
  const grossGainAfterFees = roundNumber(rawGrossGain - ongoingCost - performanceFee, 2);
  const costModel = getCostModel(product);
  const taxRate = getEstimatedTaxRate(costModel, holdingDays);
  const estimatedTax = grossGainAfterFees > 0 ? roundNumber(grossGainAfterFees * taxRate, 2) : 0;
  const modeledSlip = structureMode === 'flash' ? roundNumber(notional * 0.0024, 2) : 0;
  const fundingBreakdown = buildFundingBreakdown(Number(wealthDeskState?.paperCash || 0), rewardCredit, wealthDeskState);
  const pledgeCarryCost = roundNumber(fundingBreakdown.wealthReceiptSupportAnnualCarry * (holdingDays / 365), 2);
  const netGain = roundNumber(
    rawGrossGain - entryCost - ongoingCost - performanceFee - earlyRedemptionFee - estimatedTax - modeledSlip - pledgeCarryCost,
    2
  );
  const exitValue = roundNumber(notional + netGain, 2);
  const breakevenDays = rawGrossGain > 0 ? Math.max(1, Math.round(((entryCost + ongoingCost) / rawGrossGain) * holdingDays)) : null;
  const maxDrawdownRate = Math.min(-0.01, windowScorecard.drawdownRate * (structureMode === 'dca' ? 0.8 : structureMultiplier));
  const worstRate = Math.max(-0.5, maxDrawdownRate * (routeId === 'perp' ? 1.45 : 1.2));
  const baseRate = notional > 0 ? netGain / notional : 0;
  const bestRate = Math.max(baseRate + 0.08, baseRate * 1.7);
  const expectedNav = roundNumber(Number(focusBar?.close || 0) * (1 + baseRate), 4);
  const annualizedNetRate = annualizeReturn(baseRate, Math.max(1, holdingDays));
  const closedEnded = guide.allowEarlyRedeem === false;
  const liquidityStatus =
    closedEnded && !allowLockup
      ? 'Mismatch: this sleeve needs a lockup-friendly buyer.'
      : earlyPenaltyApplies
        ? 'Early redemption is possible, but the desk applies a penalty and settlement lag.'
        : guide.allowEarlyRedeem === false
          ? 'Closed-ended: no issuer redemption before maturity.'
          : `Open-ended: ${guide.redemptionWindow} exit path if reserves stay healthy.`;
  const volatilityStatus =
    acceptVolatility || ['funding', 'yield'].includes(product.lane)
      ? 'Volatility preference matches this route.'
      : 'This route still allows principal swings, so the desk shows a drawdown warning.';

  return {
    windowScorecard,
    grossAnnualRate,
    annualizedNetRate,
    expectedNav,
    exitValue,
    breakevenDays,
    netGain,
    worstRate,
    baseRate,
    bestRate,
    maxDrawdownRate,
    estimatedTax,
    entryCost,
    ongoingCost,
    performanceFee,
    earlyRedemptionFee,
    modeledSlip,
    pledgeCarryCost,
    grossGain: rawGrossGain,
    liquidityStatus,
    volatilityStatus,
    fundingBreakdown,
    closedEnded,
    cashflowPath:
      structureMode === 'dca'
        ? `Split into 4 entries across ${holdingDays}D -> average into one cost basis -> exit through ${guide.redemptionWindow.toLowerCase()} / ${guide.exitChannel.toLowerCase()}.`
      : closedEnded
        ? `Buy -> hold through ${Math.max(guide.lockupDays || 0, holdingDays)}D -> settle by ${guide.exitChannel.toLowerCase()}.`
        : `Buy -> accrue carry / route PnL -> redeem via ${guide.redemptionWindow} window -> settle through ${guide.exitChannel.toLowerCase()}.`,
    takeawayCopy:
      riskPreference === 'conservative' && !['funding', 'yield'].includes(product.lane)
        ? 'This route is richer than the stated risk preference, so the desk assumes smaller size and heavier tax/fee caution.'
        : structureMode === 'dca'
          ? 'DCA smooths entry timing, but repeated entries still add fee drag and do not remove product or liquidity risk.'
        : structureMode === 'collateral'
          ? 'Part of the ticket is funded by collateralized PT, so net return must outrun borrow carry and liquidation buffer loss.'
          : structureMode === 'flash'
            ? 'Flash-style routing is only illustrative here. The edge must exceed spread, gas, and one-block execution risk.'
            : guide.fundingLine
  };
}

function defaultPaperState() {
  return normalizePaperState({
    cash: STARTING_PAPER_TOKENS,
    positions: {},
    trades: [],
    realizedPnl: 0
  });
}

const ADVANCED_REPLAY_ROUTES = [
  {
    id: 'spot',
    label: 'Low-buy / high-sell',
    shortLabel: 'Spot',
    requiresBaseMint: false,
    description: 'Start with low buy / high sell and keep the first lesson focused on entries, exits, and fee drag.',
    lessons: [
      'Pick an entry bar first, then size the ticket only after the chart gives you a reason.',
      'Use replay buys and sells to compare gross PnL with take-home net value after route costs.',
      'Spot replay is the clean base path before layering leverage, borrow cost, or automation.'
    ]
  },
  {
    id: 'perp',
    label: 'Leverage & hedging',
    shortLabel: 'Leverage',
    requiresBaseMint: true,
    description: 'Use the same replay chart, but teach leverage, long / short direction, liquidation buffer, and hedge math.',
    lessons: [
      'Leverage magnifies both the move you want and the move that liquidates you.',
      'Funding, maintenance margin, and forced close logic matter more than headline PnL.',
      'Use this route as a tutorial sandbox before pretending it is a live venue engine.'
    ]
  },
  {
    id: 'lending',
    label: 'Earn & yield',
    shortLabel: 'Yield',
    requiresBaseMint: true,
    description: 'Frame the route around supply APY, carry source, and why yield is not free just because it looks stable.',
    lessons: [
      'Supply APY changes with utilization, token incentives, and counterparty quality.',
      'Yield needs a source: borrowers, basis traders, or a protocol reward stream.',
      'Look-through and take-home math matter more here than price direction.'
    ]
  },
  {
    id: 'borrow',
    label: 'Options / strategy',
    shortLabel: 'Options',
    requiresBaseMint: true,
    description: 'Use payoff templates, option-income wrappers, and structured legs to compare capped upside, downside protection, and drag.',
    lessons: [
      'Strategies are payoff shapes, not simple yield products.',
      'Users should see max gain, max loss, breakeven, and premium before execution.',
      'Multi-leg routes should be built as templates before exposing advanced controls.'
    ]
  },
  {
    id: 'strategy-ai',
    label: 'AI strategy template',
    shortLabel: 'AI Template',
    requiresBaseMint: true,
    description: 'Turn the selected payoff template into an explainable local AI template, then upload the metrics to the strategy board.',
    lessons: [
      'AI templates should explain the signal, payoff shape, risk guardrail, and exit rule before ranking anything.',
      'The result needs paper win rate, expected return, max drawdown, and a template score on separate readable lines.',
      'Uploads stay local and deterministic so the leaderboard is auditable during the demo.'
    ]
  },
  {
    id: 'routing',
    label: 'Automation / AI',
    shortLabel: 'AI',
    requiresBaseMint: true,
    description: 'Compare venue routing, automation, and the rule layer that sits on top of the same underlying asset.',
    lessons: [
      'Bridge, custody, rights, and venue rules can change the same trade into different products.',
      'Automation should show what it is allowed to do, what it cannot do, and when it pauses.',
      'Good routing explains not only where the trade goes, but why that path is worth the cost.'
    ]
  }
];

const REPLAY_ROUTE_UI = {
  spot: {
    glyph: 'SP',
    actionTag: 'BUY -> SELL',
    helperLabel: 'Low-buy / high-sell',
    walkthrough: [
      {
        label: '1. Click a chart bar',
        detail: 'Pick the entry date on the replay chart before changing size.'
      },
      {
        label: '2. Type PT notional',
        detail: 'Set how much paper cash to risk, then press Buy.'
      },
      {
        label: '3. Buy and try auto-sell / play mode and sell',
        detail: 'Buy first, then compare timed exit, replay playback, and a manual sell inside the current window before moving on to more advanced route templates.'
      }
    ]
  },
  perp: {
    glyph: 'PP',
    actionTag: 'OPEN / CLOSE',
    helperLabel: 'Leverage & hedging',
    walkthrough: [
      {
        label: '1. Click a chart bar',
        detail: 'Lock the replay on the date you want to study first, because entry, hold, and close all anchor to that bar.'
      },
      {
        label: '2. Set notional + optional flash / leverage',
        detail: 'Size the ticket first, then decide whether to keep it wallet-backed or add flash and leverage before the leg opens.'
      },
      {
        label: '3. Open long / short + confirm trade',
        detail: 'Open the long or short leg only after the ticket is sized. Beginners should use Play replay after opening so the close decision has a real bar to react to.'
      },
      {
        label: '4. Pick a close date',
        detail: 'Either use auto-close from a holding period, or play replay manually, pause on the target bar, and then confirm Close long / Close short there.'
      }
    ]
  },
  lending: {
    glyph: 'LN',
    actionTag: 'SUPPLY / WITHDRAW',
    helperLabel: 'Earn & yield',
    walkthrough: [
      {
        label: '1. Choose DeFi lending',
        detail: 'This route is for supply APY, not directional trading.'
      },
      {
        label: '2. Pick holding period',
        detail: 'The right-side preview annualizes carry over the days you choose.'
      },
      {
        label: '3. Simulate supply then withdraw',
        detail: 'Advanced DeFi actions unlock only after Task 1 and Task 2 are both completed.'
      }
    ]
  },
  borrow: {
    glyph: 'OP',
    actionTag: 'PAYOFF / LEGS',
    helperLabel: 'Options / strategy',
    walkthrough: [
      {
        label: '1. Choose payoff template',
        detail: 'Start from Protected Growth, Bear Collar, Premium Income, Short Put, or Auto Hedge / Downside Floor before touching advanced legs.'
      },
      {
        label: '2. Read payoff preview',
        detail: 'Check capped upside, downside floor, premium, and breakeven so the strategy is a shape, not a slogan.'
      },
      {
        label: '3. Build or stress strategy',
        detail: 'Only build the paper strategy after the preview shows what each leg contributes and what risk remains.'
      }
    ]
  },
  'strategy-ai': {
    glyph: 'AI',
    actionTag: 'AI / RANK',
    helperLabel: 'AI strategy template',
    walkthrough: [
      {
        label: '1. Keep the strategy shape',
        detail: 'The AI template reads the current payoff template and replay outcome instead of inventing an unrelated score.'
      },
      {
        label: '2. Pick a variant',
        detail: 'Choose the local template variant that best explains signal, payoff, guardrail, and exit rule.'
      },
      {
        label: '3. Upload result',
        detail: 'Send the win rate, expected return, max drawdown, and score to the local strategy leaderboard.'
      }
    ]
  },
  routing: {
    glyph: 'RT',
    actionTag: 'REVIEW / AUTOMATE',
    helperLabel: 'Automation / AI',
    walkthrough: [
      {
        label: '1. Compare route choices',
        detail: 'This route explains venue path, settlement timing, and token rights.'
      },
      {
        label: '2. Review route first',
        detail: 'Open route to inspect the path before trying to exit through it.'
      },
      {
        label: '3. Use automation templates carefully',
        detail: 'Settlement and advanced routing templates only open once both replay tasks are completed.'
      }
    ]
  }
};

const REPLAY_ROUTE_FOCUS_OPTIONS = {
  perp: [
    {
      id: 'leverage',
      label: 'Leverage',
      panelTitle: 'Directional leverage route',
      summary: 'Keep the first pass purely directional: open long or short, watch maintenance margin, and read funding plus close drag before treating the move as real PnL.',
      lessons: [
        'This path is for directional conviction first, not for protecting a separate spot bag.',
        'Notional, leverage, funding, and liquidation buffer must all stay readable together.',
        'If the edge is small, fee drag and funding can erase the headline move quickly.'
      ],
      walkthrough: [
        { number: '1', title: 'Click a chart bar', detail: 'Pick the replay bar that will anchor entry mark, hold period, and close preview.' },
        { number: '2', title: 'Set notional + optional flash / leverage', detail: 'Size the ticket first, then decide whether it stays wallet-backed or adds flash and extra leverage.' },
        { number: '3', title: 'Open long / short + confirm trade', detail: 'Directional leverage still walks through trade confirm, risk confirm, and wallet signature before the leg opens.' },
        { number: '4', title: 'Use auto-close or manual close', detail: 'Pause replay on a target bar or use holding period auto-close to compare mark move versus take-home.' }
      ]
    },
    {
      id: 'hedge',
      label: 'Protect a sleeve',
      panelTitle: 'Protective hedge route',
      summary: 'Begin with a real sleeve, then add a hedge only when the replay moves into a risk window. The goal is smoother downside and a clean unwind, not a second bet.',
      lessons: [
        'A hedge starts after there is something to protect: buy or define the sleeve first.',
        'Smaller leverage and clearer exit rules matter more than chasing a larger gross move.',
        'Funding can still hurt a hedge if you leave it on longer than the risk window.'
      ],
      walkthrough: [
        { number: '1', title: 'Buy the sleeve first', detail: 'Use the same chart to open the spot or wrapper exposure that needs protection.' },
        { number: '2', title: 'Play replay into risk', detail: 'Let the replay move forward. Pause when the sleeve starts looking weak, crowded, or event-risky.' },
        { number: '3', title: 'Open hedge', detail: 'Size the hedge as a percent of principal, quote any top-up, then open the protective short leg.' },
        { number: '4', title: 'Close hedge, then sleeve', detail: 'Unwind the hedge when the risk window passes. If the thesis is over, close the underlying sleeve too.' }
      ]
    },
    {
      id: 'combo',
      label: 'Combo',
      panelTitle: 'Portfolio combo lab route',
      summary: 'Build and compare a multi-product replay combo on the right rail. The live ticket can stay simple; the combo lab owns allocation, backtest, and leaderboard upload.',
      lessons: [
        'Combo mode is about product mix and allocation, not opening a separate hedge ticket.',
        'A combo setup is only better if return, drawdown, and winning days improve after weights are normalized.',
        'Use the lab result as the strategy-board artifact before turning it into a real execution plan.'
      ],
      walkthrough: [
        { number: '1', title: 'Pick the combo window', detail: 'Use the right-side lab to choose start and end dates across the replay series.' },
        { number: '2', title: 'Select products', detail: 'Choose at least two replay products and let the lab reuse cached signatures when the data has not changed.' },
        { number: '3', title: 'Adjust weights', detail: 'Edit manual weights or apply a suggested allocation, then compare return, drawdown, Sharpe, and winning days.' },
        { number: '4', title: 'Upload the combo', detail: 'Send the manual or suggested combo to the strategy board with its cached result summary.' }
      ]
    }
  ],
  lending: [
    {
      id: 'treasury',
      label: 'Treasury yield',
      panelTitle: 'Treasury yield route',
      summary: 'Best for tokenized treasury and MMF sleeves where users care about stable carry, redemption path, and net yield after wrapper drag.',
      lessons: [
        'Headline yield is only useful if the reserve path and redemption rules are also visible.',
        'Treasury routes should feel closer to cash management than to directional trading.',
        'Duration, wrapper fee, and settlement lag matter more than candle volatility here.'
      ]
    },
    {
      id: 'lending',
      label: 'Lending yield',
      panelTitle: 'Supply lending route',
      summary: 'Use this for Aave / Morpho style supply APY, where the user supplies assets, earns borrow interest, and may optionally enable collateral later.',
      lessons: [
        'Supply APY comes from borrowers, utilization, and sometimes rewards, not from magic.',
        'The same asset can be passive income one day and collateral the next.',
        'Withdrawal liquidity and caps matter as much as the quoted APY.'
      ]
    },
    {
      id: 'collateral',
      label: 'Collateral lending',
      panelTitle: 'Collateral lending route',
      summary: 'Frame the route around pledging a tokenized asset, borrowing against it, and deciding whether the borrow efficiency is worth the liquidation risk.',
      lessons: [
        'Collateral quality decides borrowing power, but also determines how fragile the route becomes in stress.',
        'Borrow efficiency is not free income if the asset can gap or lose collateral status.',
        'This is one of the most RiskLens-like yield paths because it connects RWA holdings to onchain liquidity.'
      ]
    },
    {
      id: 'carry',
      label: 'Cash-and-carry',
      panelTitle: 'Cash-and-carry route',
      summary: 'This is the carry sleeve: spot or treasury-like collateral on one side, futures / perp / funding or basis income on the other side.',
      lessons: [
        'Carry should be taught as spread capture, not as low-risk yield without conditions.',
        'Basis and funding can compress faster than most users expect.',
        'The right comparison is net spread after borrow, execution, and rebalance drag.'
      ]
    },
    {
      id: 'points',
      label: 'Points-enhanced yield',
      panelTitle: 'Points-enhanced yield route',
      summary: 'Use campaign rewards, points, or launch-style emissions as the extra layer on top of a base yield route, not as the only reason the route works.',
      lessons: [
        'Points are subsidies and campaigns, not durable base yield.',
        'The route only makes sense if the user still likes the carry after incentives fade.',
        'This is the clean place for launchpool, campaign rewards, and similar crypto-native boosts.'
      ]
    }
  ],
  borrow: [
    {
      id: 'collar',
      label: 'Protected Growth',
      panelTitle: 'Protected Growth route',
      summary: 'Hold the underlying, sell some upside, and buy downside protection so the payoff is visibly smoother but capped.',
      lessons: [
        'A collar is the natural next step after a protective hedge.',
        'The user gives up part of the upside to help fund downside protection.',
        'Show cap, floor, premium, and breakeven before any advanced option controls.'
      ]
    },
    {
      id: 'covered',
      label: 'Premium Income',
      panelTitle: 'Premium Income route',
      summary: 'Hold the underlying and sell upside for premium. Income is real, but upside is capped and downside remains.',
      lessons: [
        'Covered-call income is option premium, not free yield.',
        'Users must see capped upside and still-real downside together.',
        'This belongs in Options / strategy instead of Earn & yield.'
      ]
    },
    {
      id: 'bear-collar',
      label: 'Bear Collar',
      panelTitle: 'Bear Collar route',
      summary: 'Hold a defensive collar, sell a closer call, and keep a tighter downside floor when the user expects sideways-to-down movement.',
      lessons: [
        'Bear collars are not bullish tickets; they trade upside away to make the downside boundary more visible.',
        'The call cap, put floor, and net premium must be read together.',
        'Good for teaching how a cautious holder can define a range instead of guessing the exact bottom.'
      ]
    },
    {
      id: 'short-put',
      label: 'Short Put',
      panelTitle: 'Short Put route',
      summary: 'Sell downside insurance for premium and accept assignment risk if the replay settles below the selected strike.',
      lessons: [
        'Short-put income is compensation for taking downside exposure.',
        'The strike sets when assignment starts to matter; premium only softens the loss.',
        'This is useful when the user would be willing to buy the asset lower, not when they want unlimited protection.'
      ]
    },
    {
      id: 'protective-put',
      label: 'Auto Hedge / Downside Floor',
      panelTitle: 'Auto Hedge / Downside Floor route',
      summary: 'Hold the underlying and buy downside insurance. The cost is premium drag.',
      lessons: [
        'A protective put is the cleanest option version of insurance.',
        'Premium drag is the price paid for a more visible downside floor.',
        'The preview should show how much protection remains after cost.'
      ]
    }
  ],
  routing: [
    {
      id: 'dca',
      label: 'DCA plan',
      panelTitle: 'DCA automation route',
      summary: 'DCA is an execution rule, not a yield source. Use it inside automation so the user sees cadence, guardrails, and override conditions.',
      lessons: [
        'DCA is about pacing entry, not changing the asset itself.',
        'Automation should disclose cadence, stop rules, and whether humans can interrupt.',
        'This is where recurring buy belongs, not inside Earn & yield.'
      ]
    },
    {
      id: 'recurring',
      label: 'Recurring buy',
      panelTitle: 'Recurring-buy route',
      summary: 'Use a simpler recurring order lens when the user wants consistency more than adaptive logic.',
      lessons: [
        'Recurring buy is the low-friction automation path.',
        'It should still show schedule, guardrails, and cash availability constraints.',
        'The goal is operational clarity, not strategy complexity.'
      ]
    },
    {
      id: 'rebalance',
      label: 'Rebalance bot',
      panelTitle: 'Rebalance route',
      summary: 'Teach automation around target weights, drift bands, and rebalance triggers instead of treating rebalance like a manual strategy card.',
      lessons: [
        'Rebalance should say when it fires and how much drift it tolerates.',
        'The user needs to see trade-off between tighter targets and extra execution drag.',
        'This is the natural automation layer for basket and barbell strategies.'
      ]
    },
    {
      id: 'alerts',
      label: 'Watchlist / alerts',
      panelTitle: 'Watchlist agent route',
      summary: 'Use alerts, earnings reminders, or pre-IPO watchlist logic when the value is better timing and interpretation, not automatic execution.',
      lessons: [
        'Alerts are often more useful than blind execution.',
        'This route should explain what the agent watches, when it notifies, and what it never does automatically.',
        'Pre-IPO and event-driven products fit here better than in leverage.'
      ]
    },
    {
      id: 'yield-optimizer',
      label: 'Yield optimizer',
      panelTitle: 'Yield optimizer route',
      summary: 'Use an AI-style optimizer only when it can compare carry, liquidity, and risk guardrails across multiple yield sleeves.',
      lessons: [
        'Optimizer routes should show what gets ranked, what gets filtered, and who can override the recommendation.',
        'The point is not mystery alpha; it is disciplined switching between yield routes.',
        'This is the right home for AI copilots that compare treasury, lending, and campaign yield paths.'
      ]
    }
  ]
};

function getReplayRouteUi(routeId) {
  return REPLAY_ROUTE_UI[routeId] || REPLAY_ROUTE_UI.spot;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function findReplayIndexAfterDays(bars, startIndex, days) {
  if (!Array.isArray(bars) || !bars.length) return 0;

  const safeStartIndex = clamp(startIndex ?? 0, 0, bars.length - 1);
  const baseTs = new Date(bars[safeStartIndex]?.ts || '').getTime();
  if (!Number.isFinite(baseTs)) return safeStartIndex;

  const targetTs = baseTs + Math.max(0, Number(days || 0)) * DAY_MS;
  const nextIndex = bars.findIndex((bar, index) => {
    if (index < safeStartIndex) return false;
    const barTs = new Date(bar.ts).getTime();
    return Number.isFinite(barTs) && barTs >= targetTs;
  });

  return nextIndex === -1 ? bars.length - 1 : nextIndex;
}

function getReplayMaxHoldingDays(bars, startIndex) {
  if (!Array.isArray(bars) || bars.length < 2) return 1;

  const safeStartIndex = clamp(startIndex ?? 0, 0, bars.length - 1);
  const baseTs = new Date(bars[safeStartIndex]?.ts || '').getTime();
  const lastTs = new Date(bars[bars.length - 1]?.ts || '').getTime();

  if (!Number.isFinite(baseTs) || !Number.isFinite(lastTs) || lastTs <= baseTs) {
    return 1;
  }

  return Math.max(1, Math.floor((lastTs - baseTs) / DAY_MS));
}

function getReplayCaseHoldingDays(startBar, endBar) {
  return Math.max(1, Math.round(getHoldingDays(startBar?.ts, endBar?.ts)));
}

function getBarCloseValue(bar) {
  return Number(bar?.close ?? bar?.closeValue ?? 0);
}

function getHedgePracticeTriggerBar(caseBars = [], startBar, endBar) {
  const safeCaseBars = Array.isArray(caseBars) ? caseBars.filter(Boolean) : [];
  const startClose = getBarCloseValue(startBar || safeCaseBars[0]);

  if (safeCaseBars.length <= 2) {
    return safeCaseBars[1] || endBar || startBar || null;
  }

  const stressTrigger = safeCaseBars.find((bar, index) => {
    if (index <= 0 || index >= safeCaseBars.length - 1 || startClose <= 0) return false;
    return getBarCloseValue(bar) / startClose - 1 <= -0.025;
  });

  if (stressTrigger) return stressTrigger;

  return safeCaseBars[Math.min(safeCaseBars.length - 2, Math.max(1, Math.floor(safeCaseBars.length / 2)))] || endBar || null;
}

function getHedgeSettlementModeLabel(mode) {
  return mode === 'hedge-plus-sleeve' ? 'close hedge + sleeve' : 'close hedge only';
}

function estimateSpotPracticeOutcome({ product, startBar, endBar, notional = MIN_PAPER_TRADE }) {
  const startPrice = getBarCloseValue(startBar);
  const endPrice = getBarCloseValue(endBar);
  const safeNotional = Math.max(MIN_PAPER_TRADE, Number(notional || 0));

  if (!product || startPrice <= 0 || endPrice <= 0) {
    return null;
  }

  const holdingDays = getReplayCaseHoldingDays(startBar, endBar);
  const units = safeNotional / startPrice;
  const buyCosts = calculateTradeCosts({
    product,
    side: 'buy',
    notional: safeNotional
  });
  const principal = roundNumber(safeNotional + buyCosts.nonTaxCost, 2);
  const grossProceeds = roundNumber(units * endPrice, 2);
  const annualCarryRate = Number(getCostModel(product).annualCarryBps || 0) / 10000;
  const carry = roundNumber(principal * annualCarryRate * (holdingDays / 365), 2);
  const managementFee = calculateReplayManagementFee({
    product,
    notional: safeNotional,
    holdingDays
  });
  const preTaxGain = roundNumber(Math.max(0, grossProceeds - principal - carry - managementFee), 2);
  const sellCosts = calculateTradeCosts({
    product,
    side: 'sell',
    notional: grossProceeds,
    gain: preTaxGain,
    holdingDays,
    units
  });
  const exitDrag = roundNumber(sellCosts.nonTaxCost + sellCosts.estimatedTax + carry + managementFee, 2);
  const totalDrag = roundNumber(buyCosts.nonTaxCost + exitDrag, 2);
  const netExitValue = roundNumber(Math.max(0, grossProceeds - exitDrag), 2);
  const netPnl = roundNumber(netExitValue - principal, 2);
  const grossReturnRate = safeNotional > 0 ? endPrice / startPrice - 1 : 0;
  const netReturnRate = principal > 0 ? netPnl / principal : 0;

  return {
    notional: safeNotional,
    holdingDays,
    units: roundNumber(units, 6),
    principal,
    grossProceeds,
    grossReturnRate,
    netExitValue,
    netPnl,
    netReturnRate,
    entryDrag: buyCosts.nonTaxCost,
    exitDrag,
    carry,
    managementFee,
    totalDrag,
    exitCosts: sellCosts
  };
}

function estimateLeveragePracticeOutcome({
  startBar,
  endBar,
  direction = 'long',
  marginCapital = 0,
  leverage = 1,
  notional = MIN_PAPER_TRADE,
  flashLoanAmount = 0,
  flashLoanFee = 0
}) {
  const safeNotional = Math.max(MIN_PAPER_TRADE, Number(notional || 0));
  const safeLeverage = Math.max(1, Number(leverage || 1));
  const inferredMargin = safeLeverage > 0 ? safeNotional / safeLeverage : safeNotional;
  const safeMarginCapital = Math.max(0, Number(marginCapital || 0), inferredMargin);
  const entryPrice = getBarCloseValue(startBar);
  const exitPrice = getBarCloseValue(endBar);

  return buildLeveragedReplaySnapshot({
    direction,
    marginCapital: safeMarginCapital,
    leverage: safeLeverage,
    entryBar: { ...(startBar || {}), close: entryPrice },
    targetBar: { ...(endBar || {}), close: exitPrice },
    holdingDays: getReplayCaseHoldingDays(startBar, endBar),
    targetNotional: safeNotional,
    flashLoanAmount,
    flashLoanFee
  });
}

function estimateHedgePracticeOutcome({
  product,
  startBar,
  hedgeStartBar,
  endBar,
  sleeveNotional = MIN_PAPER_TRADE,
  hedgeTicketNotional = 0,
  hedgeMarginCapital = 0,
  hedgeLeverage = 1,
  flashLoanAmount = 0,
  flashLoanFee = 0
}) {
  const sleeveOutcome = estimateSpotPracticeOutcome({
    product,
    startBar,
    endBar,
    notional: sleeveNotional
  });
  const safeHedgeTicketNotional = Math.max(0, Number(hedgeTicketNotional || 0));
  const hedgeEntryBar = hedgeStartBar || startBar;
  const hedgeOutcome =
    safeHedgeTicketNotional > 0
      ? estimateLeveragePracticeOutcome({
          startBar: hedgeEntryBar,
          endBar,
          direction: 'short',
          marginCapital: hedgeMarginCapital,
          leverage: hedgeLeverage,
          notional: safeHedgeTicketNotional,
          flashLoanAmount,
          flashLoanFee
        })
      : null;
  const sleevePnl = Number(sleeveOutcome?.netPnl || 0);
  const hedgePnl = Number(hedgeOutcome?.netPnl || 0);
  const hedgeOnlyPnl = roundNumber(hedgePnl, 2);
  const hedgePlusSleevePnl = roundNumber(sleevePnl + hedgePnl, 2);
  const netPnl = Math.max(hedgeOnlyPnl, hedgePlusSleevePnl);
  const settlementMode = hedgePlusSleevePnl >= hedgeOnlyPnl ? 'hedge-plus-sleeve' : 'hedge-only';
  const returnBase = Math.max(1, Number(sleeveOutcome?.principal || sleeveNotional || 0));

  return {
    sleeveOutcome,
    hedgeOutcome,
    netPnl,
    netReturnRate: roundNumber(netPnl / returnBase, 4),
    sleevePnl,
    hedgePnl,
    hedgeOnlyPnl,
    hedgePlusSleevePnl,
    settlementMode,
    hedgeStartBar: hedgeEntryBar,
    hedgeTicketNotional: safeHedgeTicketNotional
  };
}

function getDrawdownMagnitude(drawdownRate = 0) {
  return Math.abs(Math.min(0, Number(drawdownRate || 0)));
}

function formatPracticeDrawdownRatio(drawdownRate = 0) {
  return formatPercent(getDrawdownMagnitude(drawdownRate), 1);
}

function buildMaxDrawdownRateFromValues(values = []) {
  const safeValues = values
    .map((value) => Number(value || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (safeValues.length < 2) return 0;

  let peak = safeValues[0];
  let maxDrawdown = 0;
  safeValues.forEach((value) => {
    if (value > peak) peak = value;
    const drawdown = peak > 0 ? (value - peak) / peak : 0;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  });

  return maxDrawdown;
}

function getPracticeCapitalBase({
  mode = 'spot',
  notional = MIN_PAPER_TRADE,
  marginCapital = 0,
  leverage = 1,
  hedgeSleeveNotional = notional
} = {}) {
  if (mode === 'leverage') {
    const inferredMargin = Number(leverage || 1) > 0 ? Number(notional || 0) / Math.max(1, Number(leverage || 1)) : Number(notional || 0);
    return Math.max(1, Number(marginCapital || 0), inferredMargin);
  }

  if (mode === 'hedge') {
    return Math.max(1, Number(hedgeSleeveNotional || notional || MIN_PAPER_TRADE));
  }

  return Math.max(1, Number(notional || MIN_PAPER_TRADE));
}

function estimatePracticePathMaxDrawdownRate({
  mode = 'spot',
  product,
  caseBars = [],
  startBar,
  hedgeStartBar,
  notional = MIN_PAPER_TRADE,
  leverage = 1,
  marginCapital = 0,
  flashLoanAmount = 0,
  flashLoanFee = 0,
  hedgeSleeveNotional = notional,
  hedgeTicketNotional = notional,
  hedgeMarginCapital = marginCapital,
  hedgeLeverage = leverage,
  strategyTemplateId = 'collar',
  strategyControls = {}
} = {}) {
  const safeCaseBars = Array.isArray(caseBars) ? caseBars.filter(Boolean) : [];
  if (safeCaseBars.length < 2) return 0;

  if (mode === 'leverage') {
    const safeNotional = Math.max(MIN_PAPER_TRADE, Number(notional || 0));
    const safeLeverage = Math.max(1, Number(leverage || 1));
    const inferredMargin = safeNotional / safeLeverage;
    const safeMarginCapital = Math.max(0, Number(marginCapital || 0), inferredMargin);
    const values = [
      safeMarginCapital,
      ...safeCaseBars.map((bar) => {
        const snapshot = estimateLeveragePracticeOutcome({
          startBar,
          endBar: bar,
          direction: 'long',
          marginCapital: safeMarginCapital,
          leverage: safeLeverage,
          notional: safeNotional,
          flashLoanAmount,
          flashLoanFee
        });
        return snapshot?.netExitValue || safeMarginCapital;
      })
    ];
    return buildMaxDrawdownRateFromValues(values);
  }

  if (mode === 'hedge') {
    const startPrice = getBarCloseValue(startBar);
    const hedgePrice = getBarCloseValue(hedgeStartBar);
    const hedgeStartIndex = Number.isInteger(hedgeStartBar?.index)
      ? hedgeStartBar.index
      : safeCaseBars.findIndex((bar) => bar?.ts === hedgeStartBar?.ts);
    const safeSleeveNotional = Math.max(MIN_PAPER_TRADE, Number(hedgeSleeveNotional || notional || MIN_PAPER_TRADE));
    const safeHedgeTicketNotional = Math.max(0, Number(hedgeTicketNotional || 0));

    if (startPrice <= 0) return getMaxDrawdownFromBars(safeCaseBars);

    const values = safeCaseBars.map((bar, index) => {
      const price = getBarCloseValue(bar);
      const sleevePnl = price > 0 ? safeSleeveNotional * (price / startPrice - 1) : 0;
      const hedgeActive =
        safeHedgeTicketNotional > 0 &&
        hedgePrice > 0 &&
        (Number.isInteger(hedgeStartBar?.index)
          ? Number(bar?.index ?? index) >= hedgeStartIndex
          : index >= Math.max(0, hedgeStartIndex));
      const hedgePnl = hedgeActive ? safeHedgeTicketNotional * ((hedgePrice - price) / hedgePrice) : 0;
      return Math.max(0.01, safeSleeveNotional + sleevePnl + hedgePnl);
    });

    return buildMaxDrawdownRateFromValues(values);
  }

  if (mode === 'strategy') {
    const safeNotional = Math.max(MIN_PAPER_TRADE, Number(notional || 0));
    const values = [
      safeNotional,
      ...safeCaseBars.map((bar) => {
        const outcome = estimateOptionStrategyPracticeOutcome({
          product,
          startBar,
          endBar: bar,
          notional: safeNotional,
          templateId: strategyTemplateId,
          controls: strategyControls
        });
        return outcome?.exitValue || safeNotional;
      })
    ];
    return buildMaxDrawdownRateFromValues(values);
  }

  return getMaxDrawdownFromBars(safeCaseBars);
}

function getDrawdownAdjustedPracticeScore({ rawReturnScore = 0, maxDrawdownRate = 0, spanBonus = 0 } = {}) {
  return Number(rawReturnScore || 0) - getDrawdownMagnitude(maxDrawdownRate) * REPLAY_PRACTICE_DRAWDOWN_PENALTY_FACTOR + Number(spanBonus || 0);
}

function findBestHedgePracticeTrigger({
  product,
  caseBars = [],
  startBar,
  endBar,
  sleeveNotional = MIN_PAPER_TRADE,
  hedgeTicketNotional = 0,
  hedgeMarginCapital = 0,
  hedgeLeverage = 1,
  flashLoanAmount = 0,
  flashLoanFee = 0
}) {
  const fallbackBar = getHedgePracticeTriggerBar(caseBars, startBar, endBar);
  const safeCaseBars = Array.isArray(caseBars) ? caseBars.filter(Boolean) : [];

  if (safeCaseBars.length <= 2) {
    const outcome = estimateHedgePracticeOutcome({
      product,
      startBar,
      hedgeStartBar: fallbackBar,
      endBar,
      sleeveNotional,
      hedgeTicketNotional,
      hedgeMarginCapital,
      hedgeLeverage,
      flashLoanAmount,
      flashLoanFee
    });
    return { bar: fallbackBar, outcome };
  }

  let best = null;
  for (let index = 1; index < safeCaseBars.length - 1; index += 1) {
    const hedgeStartBar = safeCaseBars[index];
    const outcome = estimateHedgePracticeOutcome({
      product,
      startBar,
      hedgeStartBar,
      endBar,
      sleeveNotional,
      hedgeTicketNotional,
      hedgeMarginCapital,
      hedgeLeverage,
      flashLoanAmount,
      flashLoanFee
    });
    if (!outcome) continue;

    const maxDrawdownRate = estimatePracticePathMaxDrawdownRate({
      mode: 'hedge',
      product,
      caseBars: safeCaseBars,
      startBar,
      hedgeStartBar,
      endBar,
      notional: sleeveNotional,
      hedgeSleeveNotional: sleeveNotional,
      hedgeTicketNotional,
      hedgeMarginCapital,
      hedgeLeverage,
      flashLoanAmount,
      flashLoanFee
    });
    const base = getPracticeCapitalBase({
      mode: 'hedge',
      notional: sleeveNotional,
      hedgeSleeveNotional: sleeveNotional
    });
    const timingBonus = index / Math.max(1, safeCaseBars.length - 1) * 0.0001;
    const score = Number(outcome.netPnl || 0) - base * getDrawdownMagnitude(maxDrawdownRate) * REPLAY_PRACTICE_DRAWDOWN_PENALTY_FACTOR + timingBonus;
    if (!best || score > best.score) {
      best = {
        bar: hedgeStartBar,
        outcome,
        maxDrawdownRate,
        score
      };
    }
  }

  if (best) return best;

  return {
    bar: fallbackBar,
    outcome: estimateHedgePracticeOutcome({
      product,
      startBar,
      hedgeStartBar: fallbackBar,
      endBar,
      sleeveNotional,
      hedgeTicketNotional,
      hedgeMarginCapital,
      hedgeLeverage,
      flashLoanAmount,
      flashLoanFee
    })
  };
}

const STRATEGY_AI_FEATURE_DEFINITIONS = [
  {
    id: 'risk',
    label: 'Risk guardrail',
    value: 'Drawdown boundary',
    patterns: [/hedge|protect|drawdown|stop|floor|collar|insurance|de-risk|risk|liquidation|\u5bf9\u51b2|\u4fdd\u62a4|\u56de\u64a4|\u6b62\u635f/],
    copy: 'The idea names how downside is bounded before the payoff is published.'
  },
  {
    id: 'trend',
    label: 'Signal type',
    value: 'Trend / breakout',
    patterns: [/trend|momentum|breakout|higher high|moving average|rally|volatility expands|\u8d8b\u52bf|\u7a81\u7834|\u52a8\u91cf|\u6ce2\u52a8/],
    copy: 'Entry depends on a directional move or volatility expansion.'
  },
  {
    id: 'mean-reversion',
    label: 'Signal type',
    value: 'Mean reversion',
    patterns: [/mean reversion|oversold|support|range|pullback|discount|\u5747\u503c|\u8d85\u8dcc|\u652f\u6491|\u56de\u843d/],
    copy: 'Entry waits for a stretched move to normalize instead of chasing the first print.'
  },
  {
    id: 'carry',
    label: 'Return source',
    value: 'Carry / funding',
    patterns: [/carry|funding|basis|yield|premium income|cash and carry|\u5957\u5229|\u6536\u76ca|\u8d44\u91d1\u8d39|\u57fa\u5dee/],
    copy: 'The template separates income capture from pure price direction.'
  },
  {
    id: 'options',
    label: 'Payoff layer',
    value: 'Option structure',
    patterns: [/option|call|put|collar|covered|strike|premium|cap|floor|\u671f\u6743|\u770b\u6da8|\u770b\u8dcc|\u884c\u6743|\u6743\u5229\u91d1/],
    copy: 'The strategy has a payoff shape with visible cap, floor, premium, or strike logic.'
  },
  {
    id: 'leverage',
    label: 'Sizing',
    value: 'Levered leg',
    patterns: [/leverage|perp|margin|short|long|borrow|flash|\u6760\u6746|\u6c38\u7eed|\u4fdd\u8bc1\u91d1|\u501f/],
    copy: 'The idea uses borrowed or synthetic notional, so margin and liquidation deserve a separate check.'
  },
  {
    id: 'exit',
    label: 'Exit rule',
    value: 'Defined unwind',
    patterns: [/exit|unwind|settle|rebalance|take profit|stop loss|time stop|\u9000\u51fa|\u5e73\u4ed3|\u6b62\u76c8|\u518d\u5e73\u8861/],
    copy: 'The prompt includes a clear condition for closing or rebalancing the template.'
  }
];

function getStrategyIdeaTitle(prompt, fallbackLabel = 'Strategy') {
  const firstLine = String(prompt || '')
    .split(/\n|\.|;|\u3002/)
    .map((part) => part.trim())
    .find(Boolean);
  if (!firstLine) return `${fallbackLabel} AI template`;
  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}...` : firstLine;
}

function buildStrategyAiTemplateAnalysis({
  prompt,
  product,
  strategyLabel = 'Strategy',
  strategyOutcome = null
} = {}) {
  const cleanPrompt = String(prompt || '').trim() || DEFAULT_STRATEGY_AI_PROMPT;
  const lowerPrompt = cleanPrompt.toLowerCase();
  const matchedFeatures = STRATEGY_AI_FEATURE_DEFINITIONS.filter((definition) =>
    definition.patterns.some((pattern) => pattern.test(lowerPrompt))
  );
  const fallbackFeatures = STRATEGY_AI_FEATURE_DEFINITIONS.filter(
    (definition) => !matchedFeatures.some((feature) => feature.id === definition.id)
  );
  const features = [...matchedFeatures, ...fallbackFeatures.slice(0, Math.max(0, 4 - matchedFeatures.length))].slice(0, 5);
  const featureIds = new Set(features.map((feature) => feature.id));
  const hasRiskGuardrail = featureIds.has('risk') || featureIds.has('options');
  const hasExitRule = featureIds.has('exit');
  const hasLeverage = featureIds.has('leverage');
  const previewReturnPct = Number(strategyOutcome?.netReturnRate || 0) * 100;
  const promptSpecificity = clampNumber(Math.floor(cleanPrompt.length / 34), 0, 8);
  const winRate = clampNumber(
    Math.round(
      47 +
        matchedFeatures.length * 4.2 +
        promptSpecificity +
        (hasRiskGuardrail ? 5 : 0) +
        (hasExitRule ? 4 : 0) +
        (featureIds.has('carry') ? 2 : 0) -
        (hasLeverage ? 3 : 0)
    ),
    38,
    82
  );
  const maxDrawdownPct = clampNumber(
    roundNumber(17 + (hasLeverage ? 7 : 0) - (hasRiskGuardrail ? 5 : 0) - (hasExitRule ? 3 : 0) - (featureIds.has('carry') ? 1.5 : 0), 1),
    4,
    36
  );
  const expectedReturnPct = clampNumber(
    roundNumber(4 + previewReturnPct * 0.42 + (winRate - 50) * 0.28 + (featureIds.has('trend') ? 2 : 0) + (featureIds.has('carry') ? 1.5 : 0), 1),
    -12,
    34
  );
  const templateScore = clamp(
    Math.round(winRate * 0.62 + Math.max(-8, expectedReturnPct) * 1.15 - maxDrawdownPct * 0.5 + (hasExitRule ? 4 : 0)),
    0,
    100
  );

  return {
    title: getStrategyIdeaTitle(cleanPrompt, strategyLabel),
    prompt: cleanPrompt,
    productLabel: product?.ticker || product?.name || 'Replay product',
    strategyLabel,
    features,
    winRate,
    expectedReturnPct,
    maxDrawdownPct,
    templateScore
  };
}

function buildStrategyAiTemplateVariants({
  prompt,
  product,
  strategyLabel = 'Strategy',
  strategyOutcome = null
} = {}) {
  const cleanPrompt = String(prompt || '').trim() || DEFAULT_STRATEGY_AI_PROMPT;
  const featureById = new Map(STRATEGY_AI_FEATURE_DEFINITIONS.map((feature) => [feature.id, feature]));

  return STRATEGY_AI_TEMPLATE_VARIANTS.map((variant) => {
    const base = buildStrategyAiTemplateAnalysis({
      prompt: `${cleanPrompt}\n${variant.promptHint}`,
      product,
      strategyLabel,
      strategyOutcome
    });
    const pinnedFeatures = (variant.featureIds || [])
      .map((featureId) => featureById.get(featureId))
      .filter(Boolean);
    const pinnedFeatureIds = new Set(pinnedFeatures.map((feature) => feature.id));
    const features = [
      ...pinnedFeatures,
      ...base.features.filter((feature) => !pinnedFeatureIds.has(feature.id))
    ].slice(0, 5);
    const winRate = clampNumber(Math.round(base.winRate + Number(variant.winRateShift || 0)), 34, 88);
    const expectedReturnPct = clampNumber(
      roundNumber(base.expectedReturnPct + Number(variant.expectedReturnShift || 0), 1),
      -16,
      42
    );
    const maxDrawdownPct = clampNumber(
      roundNumber(base.maxDrawdownPct + Number(variant.maxDrawdownShift || 0), 1),
      3,
      42
    );
    const templateScore = clamp(
      Math.round(
        winRate * 0.62 +
          Math.max(-8, expectedReturnPct) * 1.15 -
          maxDrawdownPct * 0.5 +
          Number(variant.scoreShift || 0) +
          (features.some((feature) => feature.id === 'exit') ? 4 : 0)
      ),
      0,
      100
    );

    return {
      ...base,
      id: variant.id,
      variantId: variant.id,
      variantLabel: variant.label,
      title: `${variant.shortLabel}: ${getStrategyIdeaTitle(cleanPrompt, strategyLabel)}`,
      prompt: cleanPrompt,
      features,
      winRate,
      expectedReturnPct,
      maxDrawdownPct,
      templateScore
    };
  });
}

function normalizePortfolioComboDateKey(timestamp) {
  const direct = String(timestamp || '').match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];

  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function isPortfolioComboDateInRange(dateKey, startDate, endDate) {
  if (!dateKey) return false;
  const safeStartDate = String(startDate || '').trim();
  const safeEndDate = String(endDate || '').trim();
  if (safeStartDate && dateKey < safeStartDate) return false;
  if (safeEndDate && dateKey > safeEndDate) return false;
  return true;
}

function normalizePortfolioComboWeightMap(productIds = [], weightMap = {}) {
  const safeProductIds = productIds.filter(Boolean);
  if (!safeProductIds.length) return {};

  const rawWeights = safeProductIds.map((productId) => {
    const numericWeight = Number(weightMap?.[productId] ?? 0);

    return {
      productId,
      value: Number.isFinite(numericWeight) ? Math.max(0, numericWeight) : 0
    };
  });
  const totalWeight = rawWeights.reduce((sum, row) => sum + row.value, 0);

  if (totalWeight <= 0) {
    const equalWeight = roundNumber(100 / safeProductIds.length, 2);
    return Object.fromEntries(safeProductIds.map((productId) => [productId, equalWeight]));
  }

  return Object.fromEntries(
    rawWeights.map((row) => [row.productId, roundNumber((row.value / totalWeight) * 100, 2)])
  );
}

function getPortfolioComboWeightPercentTotal(productIds = [], weightMap = {}) {
  const safeProductIds = productIds.filter(Boolean);

  return safeProductIds.reduce((sum, productId) => sum + Number(weightMap?.[productId] || 0), 0);
}

function getPortfolioComboWeightsValidation({
  productIds = [],
  weightMap = {},
  allocation = null,
  tolerance = 0.25
} = {}) {
  const totalPercent = Array.isArray(allocation) && allocation.length
    ? allocation.reduce((sum, row) => sum + Number(row?.weightPct || 0), 0)
    : getPortfolioComboWeightPercentTotal(productIds, weightMap);

  const safeTotalPercent = roundNumber(totalPercent, 4);
  return {
    totalPercent: safeTotalPercent,
    isValid: Number.isFinite(safeTotalPercent) && Math.abs(safeTotalPercent - 100) <= tolerance
  };
}

function rememberLimitedCacheEntry(cache, key, value, limit) {
  cache.set(key, value);

  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  return value;
}

function readLimitedCacheEntry(cache, key) {
  if (!cache.has(key)) return null;
  const cachedValue = cache.get(key);
  cache.delete(key);
  cache.set(key, cachedValue);
  return cachedValue;
}

function getReplayBarsDataSignature(bars = []) {
  if (!Array.isArray(bars)) return 'no-bars';
  if (replayPracticeBarsSignatureCache.has(bars)) {
    return replayPracticeBarsSignatureCache.get(bars);
  }

  let tsHash = 0;
  let closeHash = 0;
  bars.forEach((bar, index) => {
    const timestamp = String(bar?.ts || bar?.date || '');
    for (let cursor = 0; cursor < timestamp.length; cursor += 1) {
      tsHash = (tsHash * 33 + timestamp.charCodeAt(cursor) + index) % 1000000007;
    }

    const close = getBarCloseValue(bar);
    const quantizedClose = Number.isFinite(close) ? Math.round(close * 10000) : 0;
    closeHash = (closeHash * 131 + quantizedClose + index * 17) % 1000000007;
  });

  const firstBar = bars[0];
  const lastBar = bars[bars.length - 1];
  const signature = [
    'bars-v2',
    bars.length,
    firstBar?.ts || '',
    roundNumber(getBarCloseValue(firstBar), 4),
    lastBar?.ts || '',
    roundNumber(getBarCloseValue(lastBar), 4),
    tsHash,
    closeHash
  ].join(':');

  replayPracticeBarsSignatureCache.set(bars, signature);
  return signature;
}

function getPortfolioComboProductNameKey(productId, product = {}) {
  return String(product?.ticker || product?.symbol || product?.name || productId || 'unknown')
    .trim()
    .toLowerCase();
}

function getPortfolioComboDateSignature(dates = []) {
  if (!Array.isArray(dates) || !dates.length) return 'no-window';
  return `${dates.length}:${dates[0] || ''}:${dates[dates.length - 1] || ''}`;
}

function buildPortfolioComboBaseRow(productId, productMap = {}, productViews = {}) {
  const product = productMap[productId];
  const bars = Array.isArray(productViews[productId]?.bars) ? productViews[productId].bars : [];
  const dataSignature = getReplayBarsDataSignature(bars);
  const nameKey = getPortfolioComboProductNameKey(productId, product);
  const cacheKey = `${productId}:${nameKey}:${dataSignature}`;
  const cachedRow = readLimitedCacheEntry(portfolioComboBaseResultCache, cacheKey);

  if (cachedRow) {
    return {
      ...cachedRow,
      cacheState: 'reused'
    };
  }

  const dateMap = new Map();
  bars.forEach((bar) => {
    const dateKey = normalizePortfolioComboDateKey(bar.ts);
    const close = getBarCloseValue(bar);
    if (!dateKey || !Number.isFinite(close) || close <= 0) return;
    dateMap.set(dateKey, close);
  });

  const row = {
    id: productId,
    product,
    ticker: product?.ticker || product?.symbol || productId,
    name: product?.name || productId,
    nameKey,
    dataSignature,
    cacheKey,
    dateMap,
    loaded: dateMap.size >= 2,
    cacheState: 'computed'
  };

  rememberLimitedCacheEntry(portfolioComboBaseResultCache, cacheKey, row, PORTFOLIO_COMBO_RESULT_CACHE_LIMIT);
  return row;
}

function buildPortfolioComboWindowResult(row, commonDates = [], closes = []) {
  const dateSignature = getPortfolioComboDateSignature(commonDates);
  const resultCacheKey = `${row.cacheKey}:${dateSignature}`;
  const cachedResult = readLimitedCacheEntry(portfolioComboWindowResultCache, resultCacheKey);

  if (cachedResult) {
    const reusedResult = {
      ...cachedResult,
      cacheState: 'reused'
    };
    portfolioComboLatestResultByName.set(row.nameKey, reusedResult);
    return reusedResult;
  }

  let value = 1;
  let peakValue = 1;
  let maxDrawdownRate = 0;
  const dailyReturns = [];

  for (let index = 1; index < closes.length; index += 1) {
    const previousClose = Number(closes[index - 1] || 0);
    const currentClose = Number(closes[index] || 0);
    if (previousClose <= 0 || currentClose <= 0) continue;
    const dailyReturn = currentClose / previousClose - 1;
    value *= 1 + dailyReturn;
    peakValue = Math.max(peakValue, value);
    maxDrawdownRate = Math.min(maxDrawdownRate, value / peakValue - 1);
    dailyReturns.push(dailyReturn);
  }

  const previousResult = portfolioComboLatestResultByName.get(row.nameKey);
  const totalReturnPct = (value - 1) * 100;
  const result = {
    status: 'ready',
    productId: row.id,
    ticker: row.ticker,
    name: row.name,
    nameKey: row.nameKey,
    dataSignature: row.dataSignature,
    dateSignature,
    startDate: commonDates[0] || '',
    endDate: commonDates[commonDates.length - 1] || '',
    days: commonDates.length,
    startClose: roundNumber(Number(closes[0] || 0), 4),
    endClose: roundNumber(Number(closes[closes.length - 1] || 0), 4),
    totalReturnPct: roundNumber(totalReturnPct, 2),
    maxDrawdownPct: roundNumber(Math.abs(maxDrawdownRate) * 100, 2),
    winRate: dailyReturns.length
      ? roundNumber((dailyReturns.filter((dailyReturn) => dailyReturn > 0).length / dailyReturns.length) * 100, 1)
      : 0,
    cacheState: 'computed',
    calculatedAt: new Date().toISOString()
  };

  if (previousResult && previousResult.dateSignature !== dateSignature) {
    result.comparison = {
      previousStartDate: previousResult.startDate,
      previousEndDate: previousResult.endDate,
      previousReturnPct: previousResult.totalReturnPct,
      deltaReturnPct: roundNumber(result.totalReturnPct - Number(previousResult.totalReturnPct || 0), 2),
      reason: previousResult.dataSignature === result.dataSignature ? 'date-window' : 'data-refresh'
    };
  }

  rememberLimitedCacheEntry(portfolioComboWindowResultCache, resultCacheKey, result, PORTFOLIO_COMBO_RESULT_CACHE_LIMIT);
  portfolioComboLatestResultByName.set(row.nameKey, result);
  return result;
}

function buildPortfolioComboResultSummary(rows = [], dates = [], status = 'ready') {
  const productResults = rows.map((row) => row.result).filter(Boolean);

  return {
    status,
    dateSignature: getPortfolioComboDateSignature(dates),
    startDate: dates[0] || '',
    endDate: dates[dates.length - 1] || '',
    days: dates.length,
    productResults,
    computedCount: productResults.filter((result) => result.cacheState === 'computed').length,
    reusedCount: productResults.filter((result) => result.cacheState === 'reused').length,
    comparisonCount: productResults.filter((result) => result.comparison).length
  };
}

function collectPortfolioComboSeries({
  productIds = [],
  productMap = {},
  productViews = {},
  startDate = '',
  endDate = ''
} = {}) {
  const selectedIds = [...new Set(productIds.filter(Boolean))];

  if (selectedIds.length < 2) {
    return {
      status: 'select-more',
      message: 'Select at least two replay products for a portfolio combo.',
      rows: [],
      dates: [],
      result: buildPortfolioComboResultSummary([], [], 'select-more')
    };
  }

  const rows = selectedIds.map((productId) => buildPortfolioComboBaseRow(productId, productMap, productViews));
  const loadedRows = rows.filter((row) => row.loaded);

  if (loadedRows.length < 2) {
    return {
      status: 'loading',
      message: 'Loading bundled replay bars for the selected stocks. The combo optimizer appears once at least two series are ready.',
      rows: loadedRows,
      dates: [],
      result: buildPortfolioComboResultSummary(
        loadedRows.map((row) => ({
          ...row,
          result: {
            status: row.loaded ? 'loaded' : 'waiting',
            productId: row.id,
            ticker: row.ticker,
            name: row.name,
            nameKey: row.nameKey,
            dataSignature: row.dataSignature,
            cacheState: row.cacheState
          }
        })),
        [],
        'loading'
      )
    };
  }

  const commonDates = [...loadedRows[0].dateMap.keys()]
    .filter((dateKey) => loadedRows.every((row) => row.dateMap.has(dateKey)))
    .filter((dateKey) => isPortfolioComboDateInRange(dateKey, startDate, endDate))
    .sort();

  if (commonDates.length < 2) {
    return {
      status: 'range-empty',
      message: 'The selected date window has too little overlapping history. Widen the start/end dates or select a different basket.',
      rows: loadedRows,
      dates: commonDates,
      result: buildPortfolioComboResultSummary(
        loadedRows.map((row) => ({
          ...row,
          result: {
            status: 'range-empty',
            productId: row.id,
            ticker: row.ticker,
            name: row.name,
            nameKey: row.nameKey,
            dataSignature: row.dataSignature,
            cacheState: row.cacheState
          }
        })),
        commonDates,
        'range-empty'
      )
    };
  }

  const resultRows = loadedRows.map((row) => {
    const closes = commonDates.map((dateKey) => row.dateMap.get(dateKey));

    return {
      ...row,
      closes,
      result: buildPortfolioComboWindowResult(row, commonDates, closes)
    };
  });

  return {
    status: 'ready',
    message: '',
    rows: resultRows,
    dates: commonDates,
    result: buildPortfolioComboResultSummary(resultRows, commonDates, 'ready')
  };
}

function evaluatePortfolioComboSeries(series, weightMap = {}, label = 'Manual weights') {
  if (!series || series.status !== 'ready' || !Array.isArray(series.rows) || series.rows.length < 1 || series.dates.length < 2) {
    return null;
  }

  const productIds = series.rows.map((row) => row.id);
  const normalizedWeights = normalizePortfolioComboWeightMap(productIds, weightMap);
  let value = 1;
  let peakValue = 1;
  let maxDrawdownRate = 0;
  const dailyReturns = [];

  for (let index = 1; index < series.dates.length; index += 1) {
    const dailyReturn = series.rows.reduce((sum, row) => {
      const previousClose = Number(row.closes[index - 1] || 0);
      const currentClose = Number(row.closes[index] || 0);
      if (previousClose <= 0 || currentClose <= 0) return sum;
      return sum + (Number(normalizedWeights[row.id] || 0) / 100) * (currentClose / previousClose - 1);
    }, 0);

    value *= 1 + dailyReturn;
    peakValue = Math.max(peakValue, value);
    maxDrawdownRate = Math.min(maxDrawdownRate, value / peakValue - 1);
    dailyReturns.push(dailyReturn);
  }

  const totalReturnPct = (value - 1) * 100;
  const averageDailyReturn = dailyReturns.reduce((sum, row) => sum + row, 0) / Math.max(1, dailyReturns.length);
  const variance =
    dailyReturns.reduce((sum, row) => sum + (row - averageDailyReturn) ** 2, 0) / Math.max(1, dailyReturns.length);
  const annualVolPct = Math.sqrt(variance) * Math.sqrt(252) * 100;
  const sharpe = annualVolPct > 0 ? (averageDailyReturn * 252) / (annualVolPct / 100) : totalReturnPct > 0 ? 9.99 : 0;
  const winRate = dailyReturns.length
    ? (dailyReturns.filter((row) => row > 0).length / dailyReturns.length) * 100
    : 0;
  const maxDrawdownPct = Math.abs(maxDrawdownRate) * 100;
  const riskAdjustedScore = totalReturnPct - maxDrawdownPct * 0.85 + sharpe * 4 - annualVolPct * 0.15;
  const templateScore = clampNumber(
    Math.round(50 + totalReturnPct * 0.3 - maxDrawdownPct * 0.55 + sharpe * 4 - annualVolPct * 0.08 + winRate * 0.12),
    0,
    100
  );
  const allocation = series.rows
    .map((row) => ({
      productId: row.id,
      ticker: row.ticker,
      name: row.name,
      weightPct: Number(normalizedWeights[row.id] || 0)
    }))
    .filter((row) => row.weightPct > 0.01)
    .sort((left, right) => right.weightPct - left.weightPct);

  return {
    label,
    startDate: series.dates[0],
    endDate: series.dates[series.dates.length - 1],
    days: series.dates.length,
    totalReturnPct: roundNumber(totalReturnPct, 2),
    maxDrawdownPct: roundNumber(maxDrawdownPct, 2),
    annualVolPct: roundNumber(annualVolPct, 2),
    sharpe: roundNumber(sharpe, 2),
    winRate: roundNumber(winRate, 1),
    riskAdjustedScore: roundNumber(riskAdjustedScore, 2),
    templateScore,
    normalizedWeights,
    allocation
  };
}

function generatePortfolioComboWeightCandidates(productIds = []) {
  const safeProductIds = productIds.slice(0, PORTFOLIO_COMBO_PRODUCT_IDS.length);
  const totalUnits = Math.round(100 / PORTFOLIO_COMBO_WEIGHT_STEP);
  const candidates = [];

  function visit(index, remainingUnits, current) {
    if (index === safeProductIds.length - 1) {
      const finalCandidate = {
        ...current,
        [safeProductIds[index]]: remainingUnits * PORTFOLIO_COMBO_WEIGHT_STEP
      };
      const nonZeroCount = Object.values(finalCandidate).filter((value) => Number(value || 0) > 0).length;
      if (nonZeroCount >= 2 && nonZeroCount <= PORTFOLIO_COMBO_MAX_SUGGESTION_ASSETS) {
        candidates.push(finalCandidate);
      }
      return;
    }

    for (let units = 0; units <= remainingUnits; units += 1) {
      visit(index + 1, remainingUnits - units, {
        ...current,
        [safeProductIds[index]]: units * PORTFOLIO_COMBO_WEIGHT_STEP
      });
    }
  }

  if (safeProductIds.length >= 2) {
    visit(0, totalUnits, {});
  }

  return candidates;
}

function getPortfolioComboAllocationKey(metrics) {
  return (metrics?.allocation || [])
    .map((row) => `${row.productId}:${roundNumber(row.weightPct, 1)}`)
    .join('|');
}

function buildPortfolioComboSuggestions(series) {
  if (!series || series.status !== 'ready') return [];

  const candidateWeightMaps = generatePortfolioComboWeightCandidates(series.rows.map((row) => row.id));
  const evaluatedCandidates = candidateWeightMaps
    .map((weightMap) => evaluatePortfolioComboSeries(series, weightMap, 'Suggested combo'))
    .filter(Boolean);

  if (!evaluatedCandidates.length) return [];

  const sortedByReturn = [...evaluatedCandidates].sort((left, right) => {
    if (right.totalReturnPct !== left.totalReturnPct) return right.totalReturnPct - left.totalReturnPct;
    return left.maxDrawdownPct - right.maxDrawdownPct;
  });
  const sortedByDrawdown = [...evaluatedCandidates]
    .filter((row) => row.totalReturnPct > 0)
    .sort((left, right) => {
      if (left.maxDrawdownPct !== right.maxDrawdownPct) return left.maxDrawdownPct - right.maxDrawdownPct;
      return right.totalReturnPct - left.totalReturnPct;
    });
  const sortedByBalanced = [...evaluatedCandidates].sort((left, right) => {
    if (right.riskAdjustedScore !== left.riskAdjustedScore) return right.riskAdjustedScore - left.riskAdjustedScore;
    return right.totalReturnPct - left.totalReturnPct;
  });
  const sortedBySharpe = [...evaluatedCandidates].sort((left, right) => {
    if (right.sharpe !== left.sharpe) return right.sharpe - left.sharpe;
    return right.totalReturnPct - left.totalReturnPct;
  });
  const rawSuggestions = [
    { id: 'max-return', label: 'Best return', copy: 'Highest total return in the selected window.', metrics: sortedByReturn[0] },
    { id: 'min-drawdown', label: 'Smallest drawdown', copy: 'Lowest max drawdown while still ending positive.', metrics: sortedByDrawdown[0] || sortedByBalanced[0] },
    { id: 'balanced', label: 'Balanced', copy: 'Best return after drawdown, volatility, and Sharpe penalties.', metrics: sortedByBalanced[0] },
    { id: 'best-sharpe', label: 'Best Sharpe', copy: 'Highest annualized return per unit of daily volatility.', metrics: sortedBySharpe[0] }
  ];
  const usedKeys = new Set();

  return rawSuggestions.filter((suggestion) => {
    if (!suggestion.metrics) return false;
    const key = getPortfolioComboAllocationKey(suggestion.metrics);
    if (usedKeys.has(key)) return false;
    usedKeys.add(key);
    return true;
  });
}

function buildPortfolioComboAnalysis({
  productIds,
  productMap,
  productViews,
  weightMap,
  startDate,
  endDate
} = {}) {
  const series = collectPortfolioComboSeries({
    productIds,
    productMap,
    productViews,
    startDate,
    endDate
  });

  if (series.status !== 'ready') {
    return {
      ...series,
      manual: null,
      suggestions: [],
      topSingles: [],
      result: {
        ...(series.result || {}),
        manual: null,
        suggestions: [],
        topSingles: []
      }
    };
  }

  const manual = evaluatePortfolioComboSeries(series, weightMap, 'Manual weights');
  const topSingles = series.rows
    .map((row) => evaluatePortfolioComboSeries(series, { [row.id]: 100 }, row.ticker))
    .filter(Boolean)
    .sort((left, right) => right.totalReturnPct - left.totalReturnPct);
  const suggestions = buildPortfolioComboSuggestions(series);

  return {
    ...series,
    manual,
    suggestions,
    topSingles,
    result: {
      ...(series.result || {}),
      manual,
      suggestions,
      topSingles
    }
  };
}

function normalizeStrategyTemplateLeaderboardEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const submittedAt = entry.submittedAt || new Date().toISOString();
  const features = Array.isArray(entry.features)
    ? entry.features
        .map((feature) => ({
          id: String(feature?.id || feature?.label || '').trim(),
          label: String(feature?.label || 'Feature').trim(),
          value: String(feature?.value || '').trim(),
          copy: String(feature?.copy || '').trim()
        }))
        .filter((feature) => feature.label && feature.value)
    : [];
  const allocation = Array.isArray(entry.allocation)
    ? entry.allocation
        .map((row) => ({
          productId: String(row?.productId || '').trim(),
          ticker: String(row?.ticker || row?.productId || '').trim(),
          name: String(row?.name || '').trim(),
          weightPct: clampNumber(Number(row?.weightPct || 0), 0, 100)
        }))
        .filter((row) => row.productId && row.weightPct > 0)
    : [];

  return {
    id: String(entry.id || `${entry.walletAddress || 'guest'}-${submittedAt}-${entry.title || 'strategy'}`),
    title: String(entry.title || 'Strategy template').trim(),
    prompt: String(entry.prompt || '').trim(),
    productLabel: String(entry.productLabel || 'Replay product').trim(),
    strategyLabel: String(entry.strategyLabel || 'Strategy').trim(),
    entryType: String(entry.entryType || 'ai-template').trim(),
    variantId: String(entry.variantId || '').trim(),
    variantLabel: String(entry.variantLabel || '').trim(),
    dateRange: String(entry.dateRange || '').trim(),
    walletAddress: String(entry.walletAddress || 'guest').toLowerCase(),
    submittedAt,
    features,
    allocation,
    winRate: clampNumber(Number(entry.winRate || 0), 0, 100),
    expectedReturnPct: clampNumber(Number(entry.expectedReturnPct || 0), -100, 200),
    maxDrawdownPct: clampNumber(Number(entry.maxDrawdownPct || 0), 0, 100),
    templateScore: clampNumber(Number(entry.templateScore || 0), 0, 100)
  };
}

function normalizeStrategyTemplateLeaderboard(payload) {
  const byId = new Map();
  const rawEntries = Array.isArray(payload?.entries) ? payload.entries : [];
  rawEntries.forEach((entry) => {
    const normalized = normalizeStrategyTemplateLeaderboardEntry(entry);
    if (!normalized) return;
    byId.set(normalized.id, normalized);
  });

  return {
    entries: [...byId.values()]
      .sort((left, right) => {
        if (right.templateScore !== left.templateScore) return right.templateScore - left.templateScore;
        if (right.expectedReturnPct !== left.expectedReturnPct) return right.expectedReturnPct - left.expectedReturnPct;
        if (left.maxDrawdownPct !== right.maxDrawdownPct) return left.maxDrawdownPct - right.maxDrawdownPct;
        return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
      })
      .slice(0, 12)
  };
}

function readStoredStrategyTemplateLeaderboard() {
  return normalizeStrategyTemplateLeaderboard(readStorageJson(STRATEGY_TEMPLATE_LEADERBOARD_STORAGE_KEY, { entries: [] }));
}

function getOptionStrategyDefaults(templateId = 'collar') {
  return OPTION_STRATEGY_DEFAULTS[templateId] || OPTION_STRATEGY_DEFAULTS.collar;
}

function normalizeOptionStrategyControls(rawControls = {}, templateId = 'collar') {
  const defaults = getOptionStrategyDefaults(templateId);

  return {
    downsidePct: clampNumber(Number(rawControls.downsidePct ?? defaults.downsidePct), 0, 100),
    profitHarvestPct: clampNumber(Number(rawControls.profitHarvestPct ?? defaults.profitHarvestPct), 0, 100),
    upsideCapPct: clampNumber(Number(rawControls.upsideCapPct ?? defaults.upsideCapPct), 1, 100),
    premiumPct: clampNumber(Number(rawControls.premiumPct ?? defaults.premiumPct), 0, 25),
    strikePct: clampNumber(Number(rawControls.strikePct ?? defaults.strikePct), 0, 60)
  };
}

function estimateOptionStrategyPracticeOutcome({
  product,
  startBar,
  endBar,
  notional = MIN_PAPER_TRADE,
  templateId = 'collar',
  controls = {}
}) {
  const startPrice = getBarCloseValue(startBar);
  const endPrice = getBarCloseValue(endBar);
  const safeNotional = Math.max(MIN_PAPER_TRADE, Number(notional || 0));

  if (startPrice <= 0 || endPrice <= 0) {
    return null;
  }

  const normalizedControls = normalizeOptionStrategyControls(controls, templateId);
  const grossMoveRate = endPrice / startPrice - 1;
  const floorRate = -normalizedControls.downsidePct / 100;
  const capRate = normalizedControls.upsideCapPct / 100;
  const premiumRate = normalizedControls.premiumPct / 100;
  const strikeRate = normalizedControls.strikePct / 100;
  const harvestRate = normalizedControls.profitHarvestPct / 100;
  let netReturnRate = grossMoveRate;
  let maxUpsideLabel = 'Open';
  let maxDownsideLabel = 'Equity-like';
  let premiumLabel = 'No premium';
  let breakevenRate = 0;
  let copy = 'Historical replay applies the selected payoff template to the same start and settlement bars.';
  let legs = ['Hold underlying sleeve'];
  let nodes = [
    { label: 'Entry', value: formatPrice(startPrice), copy: 'Open the template on the selected replay bar.' },
    { label: 'Settlement', value: formatPrice(endPrice), copy: 'Close the template on the holding-period bar.' }
  ];

  if (templateId === 'covered') {
    const cappedMoveRate = Math.min(grossMoveRate, capRate);
    const harvestedPremiumRate = premiumRate * Math.max(0.2, harvestRate);
    netReturnRate = cappedMoveRate + harvestedPremiumRate;
    maxUpsideLabel = `Capped near ${formatSignedPercent((capRate + harvestedPremiumRate) * 100, 1)}`;
    maxDownsideLabel = `Underlying downside, softened by ${formatSignedPercent(harvestedPremiumRate * 100, 1)}`;
    premiumLabel = `+${formatNotional(safeNotional * harvestedPremiumRate)} PT income`;
    breakevenRate = -harvestedPremiumRate;
    copy = 'Covered-call replay keeps the sleeve, harvests option premium, and caps gains above the selected upside level.';
    legs = ['Hold underlying sleeve', `Sell call near +${normalizedControls.upsideCapPct.toFixed(0)}%`, 'Keep premium if settlement stays below strike'];
    nodes = [
      { label: 'Entry', value: formatPrice(startPrice), copy: 'Hold the underlying sleeve before selling upside.' },
      { label: 'Call cap', value: `+${normalizedControls.upsideCapPct.toFixed(0)}% / ${formatPrice(startPrice * (1 + capRate))}`, copy: 'Upside above this node is exchanged for option income.' },
      { label: 'Settlement', value: formatPrice(endPrice), copy: 'Replay close combines capped move plus harvested premium.' }
    ];
  } else if (templateId === 'bear-collar') {
    const bearCapRate = Math.min(capRate, Math.max(0.02, strikeRate + 0.015));
    const protectedMoveRate = clamp(grossMoveRate, floorRate, bearCapRate);
    const callCreditRate = premiumRate * Math.max(0.2, harvestRate) * 0.45;
    const putDebitRate = premiumRate * 0.35;
    const netPremiumRate = putDebitRate - callCreditRate;
    netReturnRate = protectedMoveRate - netPremiumRate;
    maxUpsideLabel = `Tight cap near ${formatSignedPercent((bearCapRate - netPremiumRate) * 100, 1)}`;
    maxDownsideLabel = `Floor near ${formatSignedPercent((floorRate - netPremiumRate) * 100, 1)}`;
    premiumLabel =
      netPremiumRate > 0
        ? `-${formatNotional(safeNotional * netPremiumRate)} PT net cost`
        : `+${formatNotional(safeNotional * Math.abs(netPremiumRate))} PT net credit`;
    breakevenRate = netPremiumRate;
    copy = 'Bear-collar replay uses a tighter call cap and a visible put floor for sideways-to-down scenarios.';
    legs = [
      'Hold or trim underlying sleeve',
      `Buy put floor at -${normalizedControls.downsidePct.toFixed(0)}%`,
      `Sell call cap near +${(bearCapRate * 100).toFixed(0)}%`
    ];
    nodes = [
      { label: 'Entry', value: formatPrice(startPrice), copy: 'Start from the current sleeve instead of opening leverage.' },
      { label: 'Floor', value: `-${normalizedControls.downsidePct.toFixed(0)}% / ${formatPrice(startPrice * (1 + floorRate))}`, copy: 'Downside is modeled to stop around this protection node.' },
      { label: 'Cap', value: `+${(bearCapRate * 100).toFixed(0)}% / ${formatPrice(startPrice * (1 + bearCapRate))}`, copy: 'A closer short call funds the defensive put.' },
      { label: 'Settlement', value: formatPrice(endPrice), copy: 'Replay close applies the floor, cap, and net premium.' }
    ];
  } else if (templateId === 'protective-put') {
    const protectedMoveRate = Math.max(grossMoveRate, floorRate);
    netReturnRate = protectedMoveRate - premiumRate;
    maxUpsideLabel = `Open after -${normalizedControls.premiumPct.toFixed(1)}% premium`;
    maxDownsideLabel = `Floored near ${formatSignedPercent((floorRate - premiumRate) * 100, 1)}`;
    premiumLabel = `-${formatNotional(safeNotional * premiumRate)} PT insurance`;
    breakevenRate = premiumRate;
    copy = 'Protective-put replay pays premium up front so settlement cannot fall past the selected downside floor.';
    legs = ['Hold underlying sleeve', `Buy put floor at -${normalizedControls.downsidePct.toFixed(0)}%`, 'Keep upside after premium drag'];
    nodes = [
      { label: 'Entry', value: formatPrice(startPrice), copy: 'Open the protective overlay from the selected bar.' },
      { label: 'Put floor', value: `-${normalizedControls.downsidePct.toFixed(0)}% / ${formatPrice(startPrice * (1 + floorRate))}`, copy: 'Loss is modeled to stop near this floor after premium.' },
      { label: 'Settlement', value: formatPrice(endPrice), copy: 'Replay close keeps upside but subtracts insurance cost.' }
    ];
  } else if (templateId === 'short-put') {
    const harvestedPremiumRate = premiumRate * Math.max(0.25, harvestRate);
    const assignmentLossRate = grossMoveRate < -strikeRate ? Math.max(floorRate, grossMoveRate + strikeRate) : 0;
    netReturnRate = harvestedPremiumRate + assignmentLossRate;
    maxUpsideLabel = `Premium only ${formatSignedPercent(harvestedPremiumRate * 100, 1)}`;
    maxDownsideLabel = `Assigned below -${normalizedControls.strikePct.toFixed(0)}%, stress floor ${formatSignedPercent(floorRate * 100, 1)}`;
    premiumLabel = `+${formatNotional(safeNotional * harvestedPremiumRate)} PT premium`;
    breakevenRate = -strikeRate - harvestedPremiumRate;
    copy = 'Short-put replay sells downside insurance: premium is earned first, then assignment loss appears if settlement drops below strike.';
    legs = [
      `Sell put strike -${normalizedControls.strikePct.toFixed(0)}%`,
      `Collect ${normalizedControls.premiumPct.toFixed(1)}% gross premium`,
      'Accept assignment risk below strike'
    ];
    nodes = [
      { label: 'Entry', value: formatPrice(startPrice), copy: 'Sell the put from the selected replay bar.' },
      { label: 'Strike', value: `-${normalizedControls.strikePct.toFixed(0)}% / ${formatPrice(startPrice * (1 - strikeRate))}`, copy: 'Below this node, the replay models assignment-style loss.' },
      { label: 'Stress floor', value: `-${normalizedControls.downsidePct.toFixed(0)}% / ${formatPrice(startPrice * (1 + floorRate))}`, copy: 'Slider-defined stress boundary for the paper exercise.' },
      { label: 'Settlement', value: formatPrice(endPrice), copy: 'Replay close keeps premium if price stays above strike.' }
    ];
  } else {
    const protectedMoveRate = clamp(grossMoveRate, floorRate, capRate);
    const harvestCreditRate = Math.max(0, Math.min(grossMoveRate, capRate)) * harvestRate * 0.15;
    const collarNetPremiumRate = premiumRate * 0.25;
    netReturnRate = protectedMoveRate + harvestCreditRate - collarNetPremiumRate;
    maxUpsideLabel = `Capped near ${formatSignedPercent((capRate + harvestCreditRate - collarNetPremiumRate) * 100, 1)}`;
    maxDownsideLabel = `Floored near ${formatSignedPercent((floorRate - collarNetPremiumRate) * 100, 1)}`;
    premiumLabel =
      collarNetPremiumRate > 0
        ? `-${formatNotional(safeNotional * collarNetPremiumRate)} PT net cost`
        : 'Call sale funds the put';
    breakevenRate = collarNetPremiumRate - harvestCreditRate;
    copy = 'Collar replay sells part of the upside, buys a downside floor, and lets the user choose how much profit is harvested.';
    legs = [
      'Hold underlying sleeve',
      `Buy put floor at -${normalizedControls.downsidePct.toFixed(0)}%`,
      `Sell call cap near +${normalizedControls.upsideCapPct.toFixed(0)}%`
    ];
    nodes = [
      { label: 'Entry', value: formatPrice(startPrice), copy: 'Open the protected-growth sleeve.' },
      { label: 'Floor', value: `-${normalizedControls.downsidePct.toFixed(0)}% / ${formatPrice(startPrice * (1 + floorRate))}`, copy: 'Downside protection begins around this node.' },
      { label: 'Cap', value: `+${normalizedControls.upsideCapPct.toFixed(0)}% / ${formatPrice(startPrice * (1 + capRate))}`, copy: 'Upside above this node helps pay for protection.' },
      { label: 'Settlement', value: formatPrice(endPrice), copy: 'Replay close applies the selected floor, cap, and harvest rate.' }
    ];
  }

  const holdingDays = getReplayCaseHoldingDays(startBar, endBar);
  const managementFee = calculateReplayManagementFee({
    product,
    notional: safeNotional,
    holdingDays,
    fallbackRate: REPLAY_STRATEGY_MANAGEMENT_FEE_RATE
  });
  const netPnl = roundNumber(safeNotional * netReturnRate - managementFee, 2);
  const exitValue = roundNumber(Math.max(0, safeNotional + netPnl), 2);
  const netReturnRateAfterFees = safeNotional > 0 ? netPnl / safeNotional : netReturnRate;

  return {
    templateId,
    title: `${OPTION_STRATEGY_LABELS[templateId] || OPTION_STRATEGY_LABELS.collar} preview`,
    copy,
    notional: safeNotional,
    holdingDays,
    controls: normalizedControls,
    grossMoveRate: roundNumber(grossMoveRate, 4),
    netReturnRate: roundNumber(netReturnRateAfterFees, 4),
    managementFee,
    netPnl,
    exitValue,
    rows: [
      { label: 'Historical move', value: formatSignedPercent(grossMoveRate * 100, 1) },
      { label: 'Strategy payoff', value: `${formatSigned(netPnl)} PT` },
      { label: 'Management fee', value: `${formatNotional(managementFee)} PT` },
      { label: 'Max upside', value: maxUpsideLabel },
      { label: 'Max downside', value: maxDownsideLabel },
      { label: 'Premium', value: premiumLabel },
      { label: 'Breakeven', value: formatSignedPercent(breakevenRate * 100, 1) }
    ],
    nodes,
    legs
  };
}

function getPracticeCaseOutcomePnl(practiceCase) {
  const rawValue =
    practiceCase?.outcomePnl ??
    practiceCase?.spotOutcome?.netPnl ??
    practiceCase?.leveragedOutcome?.netPnl ??
    practiceCase?.hedgeOutcome?.netPnl ??
    practiceCase?.strategyOutcome?.netPnl;

  if (rawValue === null || rawValue === undefined || rawValue === '') return null;

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getPracticeCaseOutcomeRate(practiceCase) {
  const rawValue =
    practiceCase?.outcomeReturnRate ??
    practiceCase?.netReturnRate ??
    practiceCase?.spotOutcome?.netReturnRate ??
    practiceCase?.leveragedOutcome?.priceMoveRate ??
    practiceCase?.hedgeOutcome?.netReturnRate ??
    practiceCase?.strategyOutcome?.netReturnRate ??
    practiceCase?.returnRate;

  if (rawValue === null || rawValue === undefined || rawValue === '') return 0;

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatPracticeCaseOutcome(practiceCase) {
  const outcomePnl = getPracticeCaseOutcomePnl(practiceCase);
  if (outcomePnl !== null) return `${formatSigned(outcomePnl)} PT`;

  return formatSignedPercent(getPracticeCaseOutcomeRate(practiceCase) * 100);
}

function formatPracticeCaseOutcomeWithDrawdown(practiceCase) {
  const maxDrawdownRate = Number(practiceCase?.maxDrawdownRate || 0);
  return `${formatPracticeCaseOutcome(practiceCase)} / DD ${formatPracticeDrawdownRatio(maxDrawdownRate)}`;
}

function getSafeReplayPracticeBars(bars = []) {
  if (!Array.isArray(bars)) return [];
  if (replayPracticeSafeBarsCache.has(bars)) {
    return replayPracticeSafeBarsCache.get(bars);
  }

  const safeBars = bars
    .map((bar, index) => ({
      ...bar,
      index,
      closeValue: Number(bar?.close || 0)
    }))
    .filter((bar) => Number.isFinite(bar.closeValue) && bar.closeValue > 0);

  replayPracticeSafeBarsCache.set(bars, safeBars);
  return safeBars;
}

function quantizeReplayPreviewSize(value, quantum = REPLAY_PRACTICE_PREVIEW_SIZE_QUANTUM, minimum = MIN_PAPER_TRADE) {
  const safeValue = Math.max(0, Number(value || 0));
  const safeQuantum = Math.max(1, Number(quantum || 1));
  const safeMinimum = Math.max(0, Number(minimum || 0));
  if (safeValue <= safeMinimum) return roundNumber(safeMinimum, 2);
  return Math.max(safeMinimum, roundNumber(Math.round(safeValue / safeQuantum) * safeQuantum, 2));
}

function quantizeReplayPreviewRate(value, quantum = REPLAY_PRACTICE_PREVIEW_RATE_QUANTUM) {
  if (value === null || value === undefined || value === '') return undefined;
  const safeValue = Number(value || 0);
  const safeQuantum = Math.max(0.1, Number(quantum || 0.5));
  return roundNumber(Math.round(safeValue / safeQuantum) * safeQuantum, 2);
}

function getReplayPracticePreviewOptions(options = {}) {
  const controls = options?.strategyControls || {};

  return {
    ...options,
    previewMode: true,
    notional: roundNumber(Math.max(MIN_PAPER_TRADE, Number(options?.notional || 0)), 2),
    marginCapital: quantizeReplayPreviewSize(options?.marginCapital, REPLAY_PRACTICE_PREVIEW_SIZE_QUANTUM, 0),
    flashLoanAmount: quantizeReplayPreviewSize(options?.flashLoanAmount, REPLAY_PRACTICE_PREVIEW_SIZE_QUANTUM, 0),
    flashLoanFee: quantizeReplayPreviewSize(options?.flashLoanFee, 100, 0),
    hedgeSleeveNotional: quantizeReplayPreviewSize(options?.hedgeSleeveNotional ?? options?.notional),
    hedgeTicketNotional: quantizeReplayPreviewSize(options?.hedgeTicketNotional ?? options?.notional),
    hedgeMarginCapital: quantizeReplayPreviewSize(
      options?.hedgeMarginCapital ?? options?.marginCapital,
      REPLAY_PRACTICE_PREVIEW_SIZE_QUANTUM,
      0
    ),
    hedgeLeverage: roundNumber(Number(options?.hedgeLeverage || options?.leverage || 1), 2),
    leverage: roundNumber(Number(options?.leverage || 1), 2),
    strategyControls: {
      ...controls,
      downsidePct: quantizeReplayPreviewRate(controls.downsidePct),
      profitHarvestPct: quantizeReplayPreviewRate(controls.profitHarvestPct),
      upsideCapPct: quantizeReplayPreviewRate(controls.upsideCapPct),
      premiumPct: quantizeReplayPreviewRate(controls.premiumPct, 0.25),
      strikePct: quantizeReplayPreviewRate(controls.strikePct)
    }
  };
}

function getReplayPracticeScenarioCacheKey(bars = [], mode = 'spot', options = {}) {
  const previewOptions = getReplayPracticePreviewOptions(options);
  const controls = previewOptions?.strategyControls || {};
  const strategyControlKey = [
    controls.downsidePct,
    controls.profitHarvestPct,
    controls.upsideCapPct,
    controls.premiumPct,
    controls.strikePct
  ]
    .map((value) => quantizeReplayPreviewRate(value) ?? 'default')
    .join(',');

  return [
    getReplayPracticeBarsCacheId(bars),
    'scenario-v6',
    mode,
    previewOptions?.product?.id || '',
    roundNumber(Number(previewOptions?.notional || 0), 2),
    roundNumber(Number(previewOptions?.marginCapital || 0), 2),
    roundNumber(Number(previewOptions?.flashLoanAmount || 0), 2),
    roundNumber(Number(previewOptions?.flashLoanFee || 0), 2),
    roundNumber(Number(previewOptions?.hedgeSleeveNotional || 0), 2),
    roundNumber(Number(previewOptions?.hedgeTicketNotional || 0), 2),
    roundNumber(Number(previewOptions?.hedgeMarginCapital || 0), 2),
    roundNumber(Number(previewOptions?.hedgeLeverage || 1), 1),
    roundNumber(Number(previewOptions?.leverage || 1), 1),
    previewOptions?.strategyTemplateId || '',
    strategyControlKey
  ].join('|');
}

function stripReplayPracticeCandidateForReuse(candidate) {
  if (!candidate) return null;

  return {
    startSafeIndex: candidate.startSafeIndex,
    endSafeIndex: candidate.endSafeIndex,
    startIndex: candidate.startIndex,
    endIndex: candidate.endIndex,
    hedgeStartIndex: candidate.hedgeStartIndex ?? null,
    returnRate: Number(candidate.returnRate || 0),
    maxDrawdownRate: candidate.maxDrawdownRate,
    score: candidate.score,
    scenario: candidate.scenario,
    scenarioLabel: candidate.scenarioLabel,
    scenarioRank: candidate.scenarioRank
  };
}

function getFastStrategyScenarioScore({ templateId = 'collar', grossReturnRate = 0, netReturnRate = 0 }) {
  const gross = Number(grossReturnRate || 0);
  const net = Number(netReturnRate || 0);
  const downsideStress = Math.max(0, -gross);
  const upsideMove = Math.max(0, gross);
  const sidewaysFit = Math.max(0, 0.08 - Math.abs(gross));

  if (templateId === 'bear-collar') {
    return net + downsideStress * 0.65 + sidewaysFit * 0.15 - upsideMove * 0.2;
  }

  if (templateId === 'covered') {
    return net + Math.min(upsideMove, 0.12) * 0.45 + sidewaysFit * 0.25 - downsideStress * 0.35;
  }

  if (templateId === 'short-put') {
    return net + sidewaysFit * 0.55 + Math.min(upsideMove, 0.06) * 0.2 - Math.max(0, downsideStress - 0.06) * 0.75;
  }

  if (templateId === 'protective-put') {
    return net + downsideStress * 0.8 - upsideMove * 0.08;
  }

  return net + downsideStress * 0.25 + Math.min(upsideMove, 0.18) * 0.15;
}

function getStrategyFastScenarioBucket(templateId = 'collar', candidates = []) {
  if (templateId === 'bear-collar' || templateId === 'protective-put') {
    const downsideCandidates = candidates.filter((candidate) => candidate.returnRate <= -0.02);
    return downsideCandidates.length ? downsideCandidates : candidates.filter((candidate) => candidate.returnRate < 0);
  }

  if (templateId === 'covered') {
    const incomeCandidates = candidates.filter((candidate) => candidate.returnRate >= -0.02 && candidate.returnRate <= 0.16);
    return incomeCandidates.length ? incomeCandidates : candidates.filter((candidate) => candidate.returnRate >= -0.04);
  }

  if (templateId === 'short-put') {
    const rangeCandidates = candidates.filter((candidate) => candidate.returnRate >= -0.03 && candidate.returnRate <= 0.08);
    return rangeCandidates.length ? rangeCandidates : candidates.filter((candidate) => candidate.returnRate >= -0.04);
  }

  if (templateId === 'collar') {
    const balancedCandidates = candidates.filter((candidate) => candidate.returnRate >= -0.18 && candidate.returnRate <= 0.22);
    return balancedCandidates.length ? balancedCandidates : candidates;
  }

  return candidates;
}

function buildReplayFastWindowCandidates(safeBars = [], mode = 'spot', options = {}) {
  if (!Array.isArray(safeBars) || safeBars.length < 2) return [];

  const maxLookahead = Math.max(2, Math.min(safeBars.length - 1, safeBars.length >= 120 ? 42 : safeBars.length >= 45 ? 21 : 10));
  const sampleStep = Math.max(1, Math.floor(safeBars.length / REPLAY_PRACTICE_FAST_WINDOW_TARGET));
  const offsetSet = new Set([
    1,
    Math.max(2, Math.round(maxLookahead * 0.25)),
    Math.max(2, Math.round(maxLookahead * 0.5)),
    maxLookahead
  ]);
  const candidates = [];
  const seen = new Set();
  const addCandidate = (startSafeIndex, endSafeIndex) => {
    if (startSafeIndex < 0 || endSafeIndex <= startSafeIndex || endSafeIndex >= safeBars.length) return;
    const key = `${startSafeIndex}-${endSafeIndex}`;
    if (seen.has(key)) return;
    seen.add(key);
    const startBar = safeBars[startSafeIndex];
    const endBar = safeBars[endSafeIndex];
    const returnRate = endBar.closeValue / startBar.closeValue - 1;
    let modeScore = returnRate;

    if (mode === 'leverage') {
      modeScore = returnRate * Math.max(1, Number(options?.leverage || 1));
    } else if (mode === 'hedge') {
      const hedgeFit = HEDGE_PROTECTION_EFFECTIVENESS[options?.product?.hedgeType || 'auto'] || HEDGE_PROTECTION_EFFECTIVENESS.auto;
      modeScore = -returnRate * hedgeFit;
    } else if (mode === 'strategy') {
      const strategyOutcome = estimateOptionStrategyPracticeOutcome({
        product: options?.product,
        startBar,
        endBar,
        notional: options?.notional,
        templateId: options?.strategyTemplateId,
        controls: options?.strategyControls
      });
      modeScore = getFastStrategyScenarioScore({
        templateId: options?.strategyTemplateId,
        grossReturnRate: returnRate,
        netReturnRate: strategyOutcome?.netReturnRate ?? returnRate
      });
    }

    candidates.push({
      startSafeIndex,
      endSafeIndex,
      startIndex: startBar.index,
      endIndex: endBar.index,
      returnRate,
      score: modeScore,
      cacheState: 'computed'
    });
  };

  for (let startSafeIndex = 0; startSafeIndex < safeBars.length - 1; startSafeIndex += sampleStep) {
    offsetSet.forEach((offset) => addCandidate(startSafeIndex, Math.min(safeBars.length - 1, startSafeIndex + offset)));
  }

  [0, 0.25, 0.5, 0.75].forEach((ratio) => {
    const startSafeIndex = Math.min(safeBars.length - 2, Math.max(0, Math.floor((safeBars.length - 1) * ratio)));
    offsetSet.forEach((offset) => addCandidate(startSafeIndex, Math.min(safeBars.length - 1, startSafeIndex + offset)));
  });

  return candidates;
}

function buildReplayPracticeCasesFast(bars = [], mode = 'spot', options = {}) {
  const safeBars = getSafeReplayPracticeBars(bars);
  if (safeBars.length < 2) return [];

  const candidates = buildReplayFastWindowCandidates(safeBars, mode, options);
  if (!candidates.length) return [];

  const selected = [];
  const selectedKeys = new Set();
  const diversityGap = Math.max(1, Math.floor(safeBars.length * 0.06));
  const hasNearbyStart = (candidate) => selected.some((existing) => Math.abs(existing.startSafeIndex - candidate.startSafeIndex) < diversityGap);
  const addCandidate = (candidate, scenario, scenarioLabel, scenarioRank, allowNearbyStart = false) => {
    if (!candidate || selected.length >= 3) return;
    const key = `${candidate.startSafeIndex}-${candidate.endSafeIndex}`;
    if (selectedKeys.has(key)) return;
    if (!allowNearbyStart && selected.length > 0 && hasNearbyStart(candidate)) return;
    selectedKeys.add(key);
    selected.push({ ...candidate, scenario, scenarioLabel, scenarioRank, cacheState: 'computed' });
  };
  const scoreOf = (candidate) => Number(candidate?.score || 0);

  if (mode === 'strategy') {
    const templateCandidates = getStrategyFastScenarioBucket(options?.strategyTemplateId, candidates);
    const ranked = [...(templateCandidates.length ? templateCandidates : candidates)].sort(
      (left, right) => scoreOf(right) - scoreOf(left) || Math.abs(right.returnRate) - Math.abs(left.returnRate)
    );
    const positiveRanked = ranked.filter((candidate) => scoreOf(candidate) > 0);
    const displayCandidates = positiveRanked.length ? positiveRanked : ranked;
    const templateLabel = OPTION_STRATEGY_LABELS[options?.strategyTemplateId] || 'Strategy';
    addCandidate(displayCandidates[0], 'best-payoff', `${templateLabel} preview #1`, 1, true);
    displayCandidates.slice(1).forEach((candidate) => {
      if (selected.length < 2) addCandidate(candidate, 'best-payoff', `Best preview #${selected.length + 1}`, selected.length + 1);
    });
    const downside = candidates.filter((candidate) => candidate.returnRate < 0).sort((left, right) => scoreOf(right) - scoreOf(left))[0];
    addCandidate(downside, 'stress-test', 'Downside test', 3, true);
  } else {
    const rankedPositive = candidates.filter((candidate) => scoreOf(candidate) > 0).sort((left, right) => scoreOf(right) - scoreOf(left));
    addCandidate(rankedPositive[0], 'up-most', 'Best preview #1', 1, true);
    rankedPositive.slice(1).forEach((candidate) => {
      if (selected.length < 2) addCandidate(candidate, 'up-most', `Best preview #${selected.length + 1}`, selected.length + 1);
    });
    const smallLoss = candidates.filter((candidate) => scoreOf(candidate) < 0).sort((left, right) => Math.abs(scoreOf(left)) - Math.abs(scoreOf(right)))[0];
    addCandidate(smallLoss, 'small-loss', 'Small loss', 3, true);
  }

  if (selected.length < 3) {
    [...candidates].sort((left, right) => scoreOf(right) - scoreOf(left)).forEach((candidate) => {
      if (selected.length >= 3) return;
      addCandidate(
        candidate,
        scoreOf(candidate) < 0 ? 'small-loss' : 'up-most',
        scoreOf(candidate) < 0 ? 'Small loss' : `Best preview #${selected.length + 1}`,
        selected.length + 1,
        true
      );
    });
  }

  return selected
    .slice(0, 3)
    .map((candidate) => buildReplayPracticeCaseFromCandidate(bars, safeBars, candidate, mode, options))
    .filter(Boolean);
}

function buildReplayPracticeCasesPreviewCached(bars = [], mode = 'spot', options = {}) {
  const previewOptions = getReplayPracticePreviewOptions(options);
  const scenarioKey = getReplayPracticeScenarioCacheKey(bars, mode, previewOptions);
  const safeBars = getSafeReplayPracticeBars(bars);
  const cachedDescriptors = readLimitedCacheEntry(replayPracticeScenarioCache, scenarioKey);

  if (cachedDescriptors?.length) {
    return cachedDescriptors
      .map((descriptor) =>
        buildReplayPracticeCaseFromCandidate(bars, safeBars, { ...descriptor, cacheState: 'reused' }, mode, previewOptions)
      )
      .filter(Boolean);
  }

  const fastCases = buildReplayPracticeCasesFast(bars, mode, previewOptions);
  const descriptors = fastCases
    .map((practiceCase) => {
      const startSafeIndex = safeBars.findIndex((bar) => bar.index === practiceCase.startIndex);
      const endSafeIndex = safeBars.findIndex((bar) => bar.index === practiceCase.endIndex);
      if (startSafeIndex < 0 || endSafeIndex < 0) return null;

      return stripReplayPracticeCandidateForReuse({
        startSafeIndex,
        endSafeIndex,
        startIndex: practiceCase.startIndex,
        endIndex: practiceCase.endIndex,
        hedgeStartIndex: practiceCase.mode === 'hedge' ? practiceCase.triggerIndex : null,
        returnRate: practiceCase.grossReturnRate ?? practiceCase.returnRate,
        maxDrawdownRate: practiceCase.maxDrawdownRate,
        score: practiceCase.drawdownAdjustedReturnRate ?? practiceCase.outcomeReturnRate ?? practiceCase.returnRate,
        scenario: practiceCase.scenario,
        scenarioLabel: practiceCase.scenarioLabel,
        scenarioRank: practiceCase.scenarioRank
      });
    })
    .filter(Boolean);

  if (descriptors.length) {
    rememberLimitedCacheEntry(replayPracticeScenarioCache, scenarioKey, descriptors, REPLAY_PRACTICE_SCENARIO_CACHE_LIMIT);
  }

  return fastCases;
}

function buildReplayPracticeCandidatePool(bars = [], mode = 'spot', options = {}) {
  const {
    product,
    notional = MIN_PAPER_TRADE,
    leverage = 1,
    marginCapital = 0,
    flashLoanAmount = 0,
    flashLoanFee = 0,
    hedgeSleeveNotional = notional,
    hedgeTicketNotional = notional,
    hedgeMarginCapital = marginCapital,
    hedgeLeverage = leverage,
    strategyTemplateId = 'collar',
    strategyControls = {}
  } = options || {};
  if (!Array.isArray(bars) || bars.length < 2) {
    return { safeBars: [], candidates: [] };
  }

  const safeBars = getSafeReplayPracticeBars(bars);

  if (safeBars.length < 2) {
    return { safeBars, candidates: [] };
  }

  const maxLookahead = Math.max(2, Math.min(safeBars.length - 1, safeBars.length >= 120 ? 42 : safeBars.length >= 45 ? 21 : 10));
  const candidates = [];

  for (let startSafeIndex = 0; startSafeIndex < safeBars.length - 1; startSafeIndex += 1) {
    const startBar = safeBars[startSafeIndex];
    const endLimit = Math.min(safeBars.length - 1, startSafeIndex + maxLookahead);

    for (let endSafeIndex = startSafeIndex + 1; endSafeIndex <= endLimit; endSafeIndex += 1) {
      const endBar = safeBars[endSafeIndex];
      const returnRate = endBar.closeValue / startBar.closeValue - 1;
      const absoluteMove = Math.abs(returnRate);
      const spanBonus = ((endSafeIndex - startSafeIndex) / maxLookahead) * 0.01;
      const caseBars = safeBars.slice(startSafeIndex, endSafeIndex + 1);
      const hedgeCaseBars = mode === 'hedge' ? caseBars : [];
      const optimizedHedgeTrigger =
        mode === 'hedge'
          ? findBestHedgePracticeTrigger({
              product,
              caseBars: hedgeCaseBars,
              startBar,
              endBar,
              sleeveNotional: hedgeSleeveNotional,
              hedgeTicketNotional,
              hedgeMarginCapital,
              hedgeLeverage,
              flashLoanAmount,
              flashLoanFee
            })
          : null;
      const hedgeStartBar = optimizedHedgeTrigger?.bar || null;
      const spotOutcome =
        mode === 'spot'
          ? estimateSpotPracticeOutcome({
              product,
              startBar,
              endBar,
              notional
            })
          : null;
      const leveragedOutcome =
        mode === 'leverage'
          ? estimateLeveragePracticeOutcome({
              startBar,
              endBar,
              direction: 'long',
              marginCapital,
              leverage,
              notional,
              flashLoanAmount,
              flashLoanFee
            })
          : null;
      const hedgeOutcome =
        mode === 'hedge'
          ? optimizedHedgeTrigger?.outcome ||
            estimateHedgePracticeOutcome({
                product,
                startBar,
                hedgeStartBar,
                endBar,
                sleeveNotional: hedgeSleeveNotional,
                hedgeTicketNotional,
                hedgeMarginCapital,
                hedgeLeverage,
                flashLoanAmount,
                flashLoanFee
              })
          : null;
      const strategyOutcome =
        mode === 'strategy'
          ? estimateOptionStrategyPracticeOutcome({
              product,
              startBar,
              endBar,
              notional,
              templateId: strategyTemplateId,
              controls: strategyControls
            })
          : null;
      const modeOutcomePnl = spotOutcome?.netPnl ?? leveragedOutcome?.netPnl ?? hedgeOutcome?.netPnl ?? strategyOutcome?.netPnl ?? null;
      const modeOutcomeReturnRate =
        spotOutcome?.netReturnRate ??
        (leveragedOutcome && notional > 0 ? leveragedOutcome.netPnl / Math.max(1, Number(notional || 0)) : null) ??
        hedgeOutcome?.netReturnRate ??
        strategyOutcome?.netReturnRate ??
        returnRate;
      const spotScoreReturn = spotOutcome?.netReturnRate ?? returnRate;
      const maxDrawdownRate =
        mode === 'hedge' && optimizedHedgeTrigger?.maxDrawdownRate !== undefined
          ? optimizedHedgeTrigger.maxDrawdownRate
          : estimatePracticePathMaxDrawdownRate({
              mode,
              product,
              caseBars,
              startBar,
              hedgeStartBar,
              endBar,
              notional,
              leverage,
              marginCapital,
              flashLoanAmount,
              flashLoanFee,
              hedgeSleeveNotional,
              hedgeTicketNotional,
              hedgeMarginCapital,
              hedgeLeverage,
              strategyTemplateId,
              strategyControls
            });
      const capitalBase = getPracticeCapitalBase({
        mode,
        notional,
        marginCapital,
        leverage,
        hedgeSleeveNotional
      });
      const rawReturnScore =
        modeOutcomePnl !== null && Number.isFinite(Number(modeOutcomePnl))
          ? Number(modeOutcomePnl) / capitalBase
          : mode === 'hedge'
            ? -returnRate
            : mode === 'leverage'
              ? absoluteMove
              : mode === 'spot'
                ? spotScoreReturn
                : modeOutcomeReturnRate;
      const score = getDrawdownAdjustedPracticeScore({
        rawReturnScore,
        maxDrawdownRate,
        spanBonus
      });
      const riskAdjustedPnl =
        modeOutcomePnl !== null && Number.isFinite(Number(modeOutcomePnl))
          ? roundNumber(Number(modeOutcomePnl) - capitalBase * getDrawdownMagnitude(maxDrawdownRate) * REPLAY_PRACTICE_DRAWDOWN_PENALTY_FACTOR, 2)
          : null;

      candidates.push({
        startSafeIndex,
        endSafeIndex,
        startIndex: startBar.index,
        endIndex: endBar.index,
        returnRate,
        spotOutcome,
        leveragedOutcome,
        hedgeOutcome,
        hedgeStartIndex: hedgeStartBar?.index ?? null,
        strategyOutcome,
        modeOutcomePnl,
        modeOutcomeReturnRate,
        maxDrawdownRate,
        maxDrawdownPnl: roundNumber(capitalBase * getDrawdownMagnitude(maxDrawdownRate), 2),
        riskAdjustedPnl,
        riskAdjustedReturnRate: roundNumber(score, 4),
        score
      });
    }
  }

  if (!candidates.length) {
    const fallbackMaxDrawdownRate = estimatePracticePathMaxDrawdownRate({
      mode,
      product,
      caseBars: safeBars,
      startBar: safeBars[0],
      endBar: safeBars[safeBars.length - 1],
      notional,
      leverage,
      marginCapital,
      flashLoanAmount,
      flashLoanFee,
      hedgeSleeveNotional,
      hedgeTicketNotional,
      hedgeMarginCapital,
      hedgeLeverage,
      strategyTemplateId,
      strategyControls
    });
    const fallbackCapitalBase = getPracticeCapitalBase({
      mode,
      notional,
      marginCapital,
      leverage,
      hedgeSleeveNotional
    });
    candidates.push({
      startSafeIndex: 0,
      endSafeIndex: safeBars.length - 1,
      startIndex: safeBars[0].index,
      endIndex: safeBars[safeBars.length - 1].index,
      returnRate: safeBars[safeBars.length - 1].closeValue / safeBars[0].closeValue - 1,
      spotOutcome:
        mode === 'spot'
          ? estimateSpotPracticeOutcome({
              product,
              startBar: safeBars[0],
              endBar: safeBars[safeBars.length - 1],
              notional
            })
          : null,
      strategyOutcome:
        mode === 'strategy'
          ? estimateOptionStrategyPracticeOutcome({
              product,
              startBar: safeBars[0],
              endBar: safeBars[safeBars.length - 1],
              notional,
              templateId: strategyTemplateId,
              controls: strategyControls
            })
          : null,
      maxDrawdownRate: fallbackMaxDrawdownRate,
      maxDrawdownPnl: roundNumber(fallbackCapitalBase * getDrawdownMagnitude(fallbackMaxDrawdownRate), 2),
      score: 0
    });
  }

  return { safeBars, candidates };
}

function buildReplayPracticeCaseFromCandidate(bars = [], safeBars = [], candidate, mode = 'spot', options = {}) {
  if (!candidate) return null;

  const {
    product,
    notional = MIN_PAPER_TRADE,
    leverage = 1,
    marginCapital = 0,
    flashLoanAmount = 0,
    flashLoanFee = 0,
    hedgeSleeveNotional = notional,
    hedgeTicketNotional = notional,
    hedgeMarginCapital = marginCapital,
    hedgeLeverage = leverage,
    strategyTemplateId = 'collar',
    strategyControls = {}
  } = options || {};
  const startBar = bars[candidate.startIndex] || safeBars[candidate.startSafeIndex];
  const endBar = bars[candidate.endIndex] || safeBars[candidate.endSafeIndex];
  const caseBars = safeBars.slice(candidate.startSafeIndex, candidate.endSafeIndex + 1);
  const fallbackTriggerBar = caseBars[Math.max(1, Math.floor(caseBars.length / 2))] || caseBars[caseBars.length - 1] || endBar;
  const optimizedTriggerBar =
    mode === 'hedge' && Number.isInteger(candidate.hedgeStartIndex)
      ? bars[candidate.hedgeStartIndex] || safeBars.find((bar) => bar.index === candidate.hedgeStartIndex) || null
      : null;
  const triggerBar = mode === 'hedge' ? optimizedTriggerBar || getHedgePracticeTriggerBar(caseBars, startBar, endBar) : fallbackTriggerBar;
  const triggerIndex = Math.min(Math.max(triggerBar.index, candidate.startIndex + 1), candidate.endIndex);
  const holdingDays = getReplayCaseHoldingDays(startBar, endBar);
  const triggerDays = getReplayCaseHoldingDays(startBar, bars[triggerIndex]);
  const direction = mode === 'hedge' ? 'short' : mode === 'leverage' ? 'long' : mode === 'strategy' ? 'strategy' : candidate.returnRate < 0 ? 'short' : 'long';
  const spotOutcome =
    mode === 'spot'
      ? candidate.spotOutcome ||
        estimateSpotPracticeOutcome({
          product,
          startBar,
          endBar,
          notional
        })
      : null;
  const leveragedOutcome =
    mode === 'leverage'
      ? candidate.leveragedOutcome ||
        estimateLeveragePracticeOutcome({
          startBar,
          endBar,
          direction,
          marginCapital,
          leverage,
          notional,
          flashLoanAmount,
          flashLoanFee
        })
      : null;
  const hedgeOutcome =
    mode === 'hedge'
      ? candidate.hedgeOutcome ||
        estimateHedgePracticeOutcome({
          product,
          startBar,
          hedgeStartBar: triggerBar,
          endBar,
          sleeveNotional: hedgeSleeveNotional,
          hedgeTicketNotional,
          hedgeMarginCapital,
          hedgeLeverage,
          flashLoanAmount,
          flashLoanFee
        })
      : null;
  const strategyOutcome =
    mode === 'strategy'
      ? candidate.strategyOutcome ||
        estimateOptionStrategyPracticeOutcome({
          product,
          startBar,
          endBar,
          notional,
          templateId: strategyTemplateId,
          controls: strategyControls
        })
      : null;
  const outcomePnl = spotOutcome?.netPnl ?? leveragedOutcome?.netPnl ?? hedgeOutcome?.netPnl ?? strategyOutcome?.netPnl ?? null;
  const outcomeReturnRate =
    spotOutcome?.netReturnRate ??
    (leveragedOutcome && notional > 0 ? leveragedOutcome.netPnl / Math.max(1, Number(notional || 0)) : null) ??
    hedgeOutcome?.netReturnRate ??
    strategyOutcome?.netReturnRate ??
    candidate.returnRate;
  const displayReturnRate = outcomeReturnRate;
  const maxDrawdownRate =
    candidate.maxDrawdownRate !== undefined
      ? Number(candidate.maxDrawdownRate || 0)
      : estimatePracticePathMaxDrawdownRate({
          mode,
          product,
          caseBars,
          startBar,
          hedgeStartBar: triggerBar,
          endBar,
          notional,
          leverage,
          marginCapital,
          flashLoanAmount,
          flashLoanFee,
          hedgeSleeveNotional,
          hedgeTicketNotional,
          hedgeMarginCapital,
          hedgeLeverage,
          strategyTemplateId,
          strategyControls
        });
  const capitalBase = getPracticeCapitalBase({
    mode,
    notional,
    marginCapital,
    leverage,
    hedgeSleeveNotional
  });
  const maxDrawdownPnl =
    candidate.maxDrawdownPnl !== undefined
      ? roundNumber(Number(candidate.maxDrawdownPnl || 0), 2)
      : roundNumber(capitalBase * getDrawdownMagnitude(maxDrawdownRate), 2);
  const drawdownAdjustedPnl =
    candidate.riskAdjustedPnl !== null && candidate.riskAdjustedPnl !== undefined
      ? roundNumber(Number(candidate.riskAdjustedPnl || 0), 2)
      : outcomePnl !== null
        ? roundNumber(Number(outcomePnl || 0) - maxDrawdownPnl * REPLAY_PRACTICE_DRAWDOWN_PENALTY_FACTOR, 2)
        : null;
  const resultCacheState = options?.previewMode ? candidate.cacheState || 'computed' : 'exact';
  const resultDateSignature = `${startBar?.ts || ''}:${triggerBar?.ts || ''}:${endBar?.ts || ''}`;

  return {
    mode,
    startIndex: candidate.startIndex,
    triggerIndex,
    endIndex: candidate.endIndex,
    holdingDays,
    triggerDays,
    direction,
    returnRate: roundNumber(displayReturnRate, 4),
    grossReturnRate: roundNumber(candidate.returnRate, 4),
    netReturnRate: outcomeReturnRate !== null ? roundNumber(outcomeReturnRate, 4) : null,
    outcomeReturnRate: outcomeReturnRate !== null ? roundNumber(outcomeReturnRate, 4) : null,
    outcomePnl: outcomePnl !== null ? roundNumber(outcomePnl, 2) : null,
    maxDrawdownRate: roundNumber(maxDrawdownRate, 4),
    maxDrawdownPnl,
    drawdownAdjustedPnl,
    drawdownAdjustedReturnRate: roundNumber(Number(candidate.riskAdjustedReturnRate ?? candidate.score ?? 0), 4),
    spotOutcome,
    leveragedOutcome,
    hedgeOutcome,
    strategyOutcome,
    scenario: candidate.scenario || 'best',
    scenarioLabel: candidate.scenarioLabel || 'Best case',
    scenarioRank: candidate.scenarioRank || 1,
    result: {
      status: 'ready',
      cacheState: resultCacheState,
      productId: product?.id || '',
      ticker: product?.ticker || product?.symbol || '',
      mode,
      dataSignature: getReplayPracticeBarsCacheId(bars),
      dateSignature: resultDateSignature,
      startIndex: candidate.startIndex,
      triggerIndex,
      endIndex: candidate.endIndex,
      startDate: startBar?.ts || '',
      triggerDate: triggerBar?.ts || '',
      endDate: endBar?.ts || '',
      outcomePnl: outcomePnl !== null ? roundNumber(outcomePnl, 2) : null,
      outcomeReturnRate: outcomeReturnRate !== null ? roundNumber(outcomeReturnRate, 4) : null,
      maxDrawdownRate: roundNumber(maxDrawdownRate, 4),
      hedgeStartIndex: mode === 'hedge' ? triggerIndex : null,
      strategyTemplateId
    },
    startBar,
    triggerBar: bars[triggerIndex],
    endBar
  };
}

function buildReplayPracticeCases(bars = [], mode = 'spot', options = {}) {
  const { safeBars, candidates } = buildReplayPracticeCandidatePool(bars, mode, options);
  if (!candidates.length) return [];

  const selected = [];
  const selectedKeys = new Set();
  const startDiversityGap = Math.max(2, Math.floor((safeBars.length || bars.length || 1) * 0.08));
  const hasNearbySelectedStart = (candidate) =>
    selected.some((existing) => Math.abs(Number(existing.startIndex || 0) - Number(candidate?.startIndex || 0)) < startDiversityGap);
  const addCandidate = (candidate, scenario, scenarioLabel, scenarioRank, { allowNearbyStart = false } = {}) => {
    if (!candidate || selected.length >= 3) return;
    const key = `${candidate.startIndex}-${candidate.endIndex}`;
    if (selectedKeys.has(key)) return;
    if (!allowNearbyStart && selected.length > 0 && hasNearbySelectedStart(candidate)) return;
    selectedKeys.add(key);
    selected.push({
      ...candidate,
      scenario,
      scenarioLabel,
      scenarioRank
    });
  };
  const getModeOutcomeScore = (candidate) => {
    const orderedValues = [
      candidate?.riskAdjustedPnl,
      candidate?.riskAdjustedReturnRate,
      candidate?.score,
      candidate?.modeOutcomePnl,
      candidate?.returnRate
    ];
    const nextValue = orderedValues.find((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
    return Number(nextValue || 0);
  };
  const isPositiveOutcome = (candidate) => getModeOutcomeScore(candidate) > 0;
  const isNegativeOutcome = (candidate) => getModeOutcomeScore(candidate) < 0;

  if (mode === 'strategy') {
    const rankedStrategyCandidates = [...candidates].sort(
      (left, right) => getModeOutcomeScore(right) - getModeOutcomeScore(left) || Math.abs(right.returnRate) - Math.abs(left.returnRate)
    );
    const positiveRankedStrategyCandidates = rankedStrategyCandidates.filter((candidate) => getModeOutcomeScore(candidate) > 0);
    const displayPriorityCandidates = positiveRankedStrategyCandidates.length ? positiveRankedStrategyCandidates : rankedStrategyCandidates;
    addCandidate(displayPriorityCandidates[0], 'best-payoff', 'Best net/DD #1', 1, { allowNearbyStart: true });
    displayPriorityCandidates.slice(1).forEach((candidate) => {
      if (selected.length >= 2) return;
      addCandidate(candidate, 'best-payoff', `Best net/DD #${selected.length + 1}`, selected.length + 1);
    });

    const stressCandidate = candidates
      .filter((candidate) => candidate.returnRate < 0)
      .sort((left, right) => getModeOutcomeScore(right) - getModeOutcomeScore(left) || right.returnRate - left.returnRate)[0];
    addCandidate(stressCandidate, 'stress-test', 'Downside test', 3);

    rankedStrategyCandidates.forEach((candidate) => {
      const nextRank = selected.length + 1;
      addCandidate(candidate, candidate.returnRate < 0 ? 'stress-test' : 'best-payoff', candidate.returnRate < 0 ? 'Downside test' : `Best net/DD #${nextRank}`, nextRank);
    });
    rankedStrategyCandidates.forEach((candidate) => {
      const nextRank = selected.length + 1;
      addCandidate(candidate, candidate.returnRate < 0 ? 'stress-test' : 'best-payoff', candidate.returnRate < 0 ? 'Downside test' : `Best net/DD #${nextRank}`, nextRank, { allowNearbyStart: true });
    });

    return selected
      .slice(0, 3)
      .map((candidate) => buildReplayPracticeCaseFromCandidate(bars, safeBars, candidate, mode, options))
      .filter(Boolean);
  }

  const upsideCandidates = candidates
    .filter(isPositiveOutcome)
    .sort((left, right) => getModeOutcomeScore(right) - getModeOutcomeScore(left) || right.returnRate - left.returnRate);
  addCandidate(upsideCandidates[0], 'up-most', 'Best net/DD #1', 1, { allowNearbyStart: true });
  upsideCandidates.slice(1).forEach((candidate) => {
    if (selected.length >= 2) return;
    addCandidate(candidate, 'up-most', `Best net/DD #${selected.length + 1}`, selected.length + 1);
  });

  const smallLossCandidate = candidates
    .filter(isNegativeOutcome)
    .sort(
      (left, right) =>
        Math.abs(getModeOutcomeScore(left)) - Math.abs(getModeOutcomeScore(right)) || Math.abs(left.returnRate) - Math.abs(right.returnRate)
    )[0];
  addCandidate(smallLossCandidate, 'small-loss', 'Small loss', 3);

  const fallbackCandidates = [...candidates].sort((left, right) => right.score - left.score);
  fallbackCandidates.forEach((candidate) => {
    const nextRank = selected.length + 1;
    addCandidate(
      candidate,
      isNegativeOutcome(candidate) ? 'small-loss' : 'up-most',
      isNegativeOutcome(candidate) ? 'Small loss' : `Best net/DD #${nextRank}`,
      nextRank
    );
  });
  fallbackCandidates.forEach((candidate) => {
    const nextRank = selected.length + 1;
    addCandidate(
      candidate,
      isNegativeOutcome(candidate) ? 'small-loss' : 'up-most',
      isNegativeOutcome(candidate) ? 'Small loss' : `Best net/DD #${nextRank}`,
      nextRank,
      { allowNearbyStart: true }
    );
  });

  return selected
    .slice(0, 3)
    .map((candidate) => buildReplayPracticeCaseFromCandidate(bars, safeBars, candidate, mode, options))
    .filter(Boolean);
}

function getReplayPracticeBarsCacheId(bars = []) {
  return getReplayBarsDataSignature(bars);
}

function getReplayPracticeCaseCacheKey(bars = [], mode = 'spot', options = {}) {
  const controls = options?.strategyControls || {};
  const strategyControlKey = [
    controls.downsidePct,
    controls.profitHarvestPct,
    controls.upsideCapPct,
    controls.premiumPct,
    controls.strikePct
  ]
    .map((value) => roundNumber(Number(value || 0), 4))
    .join(',');

  return [
    getReplayPracticeBarsCacheId(bars),
    mode,
    options?.product?.id || '',
    roundNumber(Number(options?.notional || 0), 2),
    roundNumber(Number(options?.leverage || 1), 4),
    roundNumber(Number(options?.marginCapital || 0), 2),
    roundNumber(Number(options?.flashLoanAmount || 0), 2),
    roundNumber(Number(options?.flashLoanFee || 0), 2),
    roundNumber(Number(options?.hedgeSleeveNotional || 0), 2),
    roundNumber(Number(options?.hedgeTicketNotional || 0), 2),
    roundNumber(Number(options?.hedgeMarginCapital || 0), 2),
    roundNumber(Number(options?.hedgeLeverage || 1), 4),
    options?.strategyTemplateId || '',
    strategyControlKey
  ].join('|');
}

function buildReplayPracticeCasesCached(bars = [], mode = 'spot', options = {}) {
  if (options?.previewMode) {
    return buildReplayPracticeCasesPreviewCached(bars, mode, options);
  }

  const cacheKey = getReplayPracticeCaseCacheKey(bars, mode, options);
  if (replayPracticeCaseCache.has(cacheKey)) {
    const cachedValue = replayPracticeCaseCache.get(cacheKey);
    replayPracticeCaseCache.delete(cacheKey);
    replayPracticeCaseCache.set(cacheKey, cachedValue);
    return cachedValue;
  }

  const nextValue = buildReplayPracticeCases(bars, mode, options);
  replayPracticeCaseCache.set(cacheKey, nextValue);

  while (replayPracticeCaseCache.size > REPLAY_PRACTICE_CASE_CACHE_LIMIT) {
    const oldestKey = replayPracticeCaseCache.keys().next().value;
    replayPracticeCaseCache.delete(oldestKey);
  }

  return nextValue;
}

function buildReplayPracticeCase(bars = [], mode = 'spot', options = {}) {
  return buildReplayPracticeCasesCached(bars, mode, options)[0] || null;
}

function formatHoldingPresetLabel(days) {
  const safeDays = Math.max(1, Math.round(Number(days || 1)));
  if (safeDays % 7 === 0 && safeDays >= 14) {
    return `${safeDays / 7}W`;
  }

  return `${safeDays}D`;
}

function getSuggestedHoldingDays(product = {}, guide = {}, routeId = 'spot', maxDays = 90) {
  const safeMaxDays = Math.max(1, Math.round(Number(maxDays || 1)));
  const lockupDays = Number(guide?.lockupDays || 0);
  const settlementLagDays = Number(guide?.settlementLagDays || 0);
  const baseSuggestion =
    routeId === 'borrow'
      ? 30
      : routeId === 'perp'
        ? 14
        : product?.lane === 'private'
          ? 90
          : product?.lane === 'funding'
            ? 30
            : Math.max(14, lockupDays || settlementLagDays || 30);

  return clampNumber(Math.round(baseSuggestion), 1, safeMaxDays);
}

function getSuggestedTicketRatio(product = {}, routeId = 'spot') {
  if (routeId === 'perp') return 0.18;
  const risk = String(product?.risk || '').toLowerCase();
  if (risk.includes('low')) return 0.35;
  if (risk.includes('high')) return 0.18;
  return 0.25;
}

const PRODUCT_ROUTE_PLAYBOOKS = {
  spot: {
    defaultRoute: 'spot',
    routes: ['spot', 'perp', 'borrow', 'strategy-ai'],
    summary: 'Spot products keep the first action simple: buy, sell, replay settlement, then add leverage, hedge, or options-style payoff templates only when the user wants structure.'
  },
  funding: {
    defaultRoute: 'spot',
    routes: ['spot', 'perp', 'borrow', 'strategy-ai', 'routing', 'lending'],
    summary: 'Funding rails start with calm entry and exit, then move into routing cost and reserve-backed yield logic.'
  },
  public: {
    defaultRoute: 'spot',
    routes: ['spot', 'perp', 'borrow', 'strategy-ai'],
    summary:
      'xStock and listed wrappers should start with spot-style replay, then move into leverage, hedge, or options templates when the user wants a payoff shape.'
  },
  private: {
    defaultRoute: 'spot',
    routes: ['spot', 'perp', 'borrow', 'strategy-ai', 'routing'],
    summary: 'Private markets / pre-IPO should feel like allocation, subscription, watchlist, and exit-path learning, not like one-click listed spot trading.'
  },
  leverage: {
    defaultRoute: 'perp',
    routes: ['spot', 'perp', 'borrow', 'strategy-ai'],
    summary: 'Leverage & hedging is a play layer: use it to teach long / short direction, hedge logic, and liquidation risk on top of public exposures.'
  },
  yield: {
    defaultRoute: 'lending',
    routes: ['spot', 'perp', 'borrow', 'strategy-ai', 'lending', 'routing'],
    summary: 'Earn & yield is about carry source, collateral use, and payout sustainability, not just price direction.'
  },
  strategy: {
    defaultRoute: 'borrow',
    routes: ['spot', 'perp', 'borrow', 'strategy-ai', 'routing'],
    summary: 'Options / strategy routes should read like reusable templates or payoff cards, with the structure and thesis explained before the user worries about execution.'
  },
  ai: {
    defaultRoute: 'routing',
    routes: ['spot', 'perp', 'borrow', 'strategy-ai', 'routing'],
    summary: 'Automation / AI is the execution-and-explanation layer: DCA, alerts, rebalance rules, and risk copilots should say who decides and when humans can override.'
  }
};

const REPLAY_ROUTE_TOOL_BY_LANE = {
  spot: ['single'],
  funding: ['single', 'combo', 'collateral'],
  yield: ['single', 'combo', 'collateral'],
  public: ['single', 'combo', 'flash'],
  leverage: ['single', 'collateral', 'flash'],
  private: ['single', 'combo'],
  strategy: ['single', 'combo', 'flash'],
  ai: ['single', 'combo', 'collateral']
};

function getDefaultPerpFocusForLane(laneId) {
  return laneId === 'public' || laneId === 'leverage' ? 'leverage' : 'hedge';
}

const REPLAY_LANE_GUIDES = {
  spot: {
    structureLabel: 'Direct market replay',
    targetYieldRate: 0,
    settlementLagDays: 0,
    redemptionWindow: 'T+0',
    liquidityLabel: 'Spot market liquidity',
    exitChannel: 'Replay buy / sell through the spot desk',
    allowEarlyRedeem: true,
    earlyRedemptionFeeBps: 0,
    lockupDays: 0,
    principalProtected: 'No',
    underlyingAssetType: 'Crypto spot benchmark',
    currencyOptions: ['PT', 'USDC', 'USDT'],
    marketCapValue: '$1T+ spot market',
    fundingLine: 'Best for learning price path, entry timing, exit timing, and route drag before adding structured payoff logic.',
    yieldSources: [
      { label: 'Underlying price move', rate: 0 },
      { label: 'No embedded yield', rate: 0 }
    ],
    feeBlueprint: [
      { label: 'Trading spread / slippage', rate: 0.0012, type: 'entry' },
      { label: 'Venue fee', rate: 0.0015, type: 'entry' },
      { label: 'Gas / channel cost', rate: 0.00025, type: 'entry' }
    ],
    stressScenarios: [
      { label: 'Underlying drawdown', impact: '-20%' },
      { label: 'Liquidity gap', impact: 'Spread widens' },
      { label: 'Stablecoin funding slip', impact: '3% slip' },
      { label: 'Price update delay', impact: '24h stale mark' }
    ]
  },
  funding: {
    structureLabel: 'Open-ended income sleeve',
    targetYieldRate: 0.054,
    settlementLagDays: 0,
    redemptionWindow: 'T+0',
    liquidityLabel: 'Same-day issuer window',
    exitChannel: 'Issuer redemption with reserve buffer',
    allowEarlyRedeem: true,
    earlyRedemptionFeeBps: 0,
    lockupDays: 0,
    principalProtected: 'No, but low-volatility and reserve-backed',
    underlyingAssetType: 'Short-duration bills, repo, and reserve cash',
    currencyOptions: ['PT', 'USDC', 'USDT'],
    marketCapValue: '$180M reserve basket',
    fundingLine: 'Best for cash parking, treasury carry, and replaying how reserve drag affects take-home yield.',
    yieldSources: [
      { label: 'Underlying coupon / carry', rate: 0.036 },
      { label: 'Platform subsidy', rate: 0.005 },
      { label: 'Token incentive', rate: 0.004 }
    ],
    feeBlueprint: [
      { label: 'Subscription fee', rate: 0.0004, type: 'entry' },
      { label: 'Management fee', rate: 0.0045, type: 'annual' },
      { label: 'Custody / channel fee', rate: 0.0012, type: 'annual' },
      { label: 'Gas / onchain cost', rate: 0.0002, type: 'entry' }
    ],
    stressScenarios: [
      { label: 'Underlying default rate', impact: '+2.0%' },
      { label: 'Token reward price shock', impact: '-50%' },
      { label: 'Rates move higher', impact: '+100bp' },
      { label: 'Early redemption spike', impact: 'Queue widens' },
      { label: 'Stablecoin depeg check', impact: '3% slip' },
      { label: 'Price update delay', impact: '24h stale mark' }
    ]
  },
  yield: {
    structureLabel: 'Open-ended yield sleeve',
    targetYieldRate: 0.062,
    settlementLagDays: 1,
    redemptionWindow: 'T+1',
    liquidityLabel: 'Queued same-week liquidity',
    exitChannel: 'Issuer redemption first, dealer window if pressure spikes',
    allowEarlyRedeem: true,
    earlyRedemptionFeeBps: 35,
    lockupDays: 30,
    principalProtected: 'Not principal-protected',
    underlyingAssetType: 'Treasury ladder and short-duration spread sleeves',
    currencyOptions: ['PT', 'USDC', 'USDY'],
    marketCapValue: '$240M ladder sleeve',
    fundingLine: 'Best for users comparing flexible cash against term carry and redemption timing trade-offs.',
    yieldSources: [
      { label: 'Underlying coupon / spread', rate: 0.045 },
      { label: 'Platform subsidy', rate: 0.006 },
      { label: 'Token incentive', rate: 0.004 }
    ],
    feeBlueprint: [
      { label: 'Subscription fee', rate: 0.0008, type: 'entry' },
      { label: 'Management fee', rate: 0.0065, type: 'annual' },
      { label: 'Custody / trustee fee', rate: 0.0018, type: 'annual' },
      { label: 'Early redemption fee', rate: 0.0035, type: 'conditional' },
      { label: 'Gas / onchain cost', rate: 0.00025, type: 'entry' }
    ],
    stressScenarios: [
      { label: 'Underlying default rate', impact: '+2.0%' },
      { label: 'Token reward price shock', impact: '-50%' },
      { label: 'Rates move higher', impact: '+100bp' },
      { label: 'Early redemption spike', impact: 'Haircut risk' },
      { label: 'Stablecoin depeg check', impact: '3% slip' },
      { label: 'Price update delay', impact: '24h stale mark' }
    ]
  },
  public: {
    structureLabel: 'Open-ended market sleeve',
    targetYieldRate: 0.108,
    settlementLagDays: 1,
    redemptionWindow: 'T+1',
    liquidityLabel: 'Market hours + wrapper spread',
    exitChannel: 'Platform routing and wrapper liquidity',
    allowEarlyRedeem: true,
    earlyRedemptionFeeBps: 0,
    lockupDays: 0,
    principalProtected: 'No',
    underlyingAssetType: 'Tokenized stocks / ETFs, crypto spot, tokenized treasuries, or other listed wrappers',
    currencyOptions: ['PT', 'USDC', 'USDT'],
    marketCapValue: '$2.3B wrapper depth',
    fundingLine: 'Best for users who need to compare wrapper drag, spread, and tax against a familiar market chart.',
    yieldSources: [
      { label: 'Underlying price move', rate: 0.102 },
      { label: 'Token incentive', rate: 0.01 }
    ],
    feeBlueprint: [
      { label: 'Entry spread / slippage', rate: 0.0018, type: 'entry' },
      { label: 'Management / wrapper fee', rate: 0.0025, type: 'annual' },
      { label: 'Custody / channel fee', rate: 0.0009, type: 'annual' },
      { label: 'Gas / onchain cost', rate: 0.00035, type: 'entry' }
    ],
    stressScenarios: [
      { label: 'Underlying default rate', impact: 'N/A' },
      { label: 'Token reward price shock', impact: '-50%' },
      { label: 'Rates move higher', impact: 'Valuation reset' },
      { label: 'Early redemption spike', impact: 'Spread widens' },
      { label: 'Stablecoin depeg check', impact: '3% funding slip' },
      { label: 'Price update delay', impact: '24h stale mark' }
    ]
  },
  leverage: {
    structureLabel: 'Perp / collateral route',
    targetYieldRate: 0.145,
    settlementLagDays: 0,
    redemptionWindow: 'T+0',
    liquidityLabel: 'Venue liquidity if margin holds',
    exitChannel: 'Venue close-out or liquidation engine',
    allowEarlyRedeem: true,
    earlyRedemptionFeeBps: 0,
    lockupDays: 0,
    principalProtected: 'No',
    underlyingAssetType: 'Leveraged directional exposure',
    currencyOptions: ['PT', 'USDC'],
    marketCapValue: '$5.4B venue OI',
    fundingLine: 'Best for teaching that equity, margin, and liquidation price are different risk numbers.',
    yieldSources: [
      { label: 'Directional price move', rate: 0.16 },
      { label: 'Funding edge', rate: 0.012 }
    ],
    feeBlueprint: [
      { label: 'Entry spread / slippage', rate: 0.0022, type: 'entry' },
      { label: 'Borrow / funding cost', rate: 0.028, type: 'annual' },
      { label: 'Management / venue fee', rate: 0.0014, type: 'annual' },
      { label: 'Gas / onchain cost', rate: 0.00035, type: 'entry' }
    ],
    stressScenarios: [
      { label: 'Underlying default rate', impact: 'N/A' },
      { label: 'Token reward price shock', impact: '-50%' },
      { label: 'Rates move higher', impact: 'Funding drag' },
      { label: 'Early redemption spike', impact: 'Route unavailable' },
      { label: 'Stablecoin depeg check', impact: '3% margin slip' },
      { label: 'Price update delay', impact: '24h stale mark' }
    ]
  },
  private: {
    structureLabel: 'Closed-ended private sleeve',
    targetYieldRate: 0.12,
    settlementLagDays: 30,
    redemptionWindow: 'T+N / transfer-only before exit',
    liquidityLabel: 'Transfer-only before liquidity event',
    exitChannel: 'Platform matching, tender, or issuer event',
    allowEarlyRedeem: false,
    earlyRedemptionFeeBps: 0,
    lockupDays: 365,
    principalProtected: 'No',
    underlyingAssetType: 'Late-stage private equity / feeder claims',
    currencyOptions: ['PT', 'USDC'],
    marketCapValue: '$900M indicated access pool',
    fundingLine: 'Best for users learning that valuation marks and transfer limits matter more than daily chart noise.',
    yieldSources: [
      { label: 'Valuation rerate / exit optionality', rate: 0.12 }
    ],
    feeBlueprint: [
      { label: 'Subscription fee', rate: 0.005, type: 'entry' },
      { label: 'Management fee', rate: 0.012, type: 'annual' },
      { label: 'Custody / SPV fee', rate: 0.004, type: 'annual' },
      { label: 'Performance fee', rate: 0.1, type: 'performance' },
      { label: 'Gas / onchain cost', rate: 0.0003, type: 'entry' }
    ],
    stressScenarios: [
      { label: 'Underlying default rate', impact: '+2.0%' },
      { label: 'Token reward price shock', impact: 'N/A' },
      { label: 'Rates move higher', impact: 'Valuation reset' },
      { label: 'Early redemption spike', impact: 'No issuer window' },
      { label: 'Stablecoin depeg check', impact: '3% funding slip' },
      { label: 'Price update delay', impact: '24h stale mark' }
    ]
  },
  strategy: {
    structureLabel: 'Closed-ended structured sleeve',
    targetYieldRate: 0.14,
    settlementLagDays: 5,
    redemptionWindow: 'Maturity or dealer unwind',
    liquidityLabel: 'Dealer bid only before maturity',
    exitChannel: 'Dealer unwind or maturity settlement',
    allowEarlyRedeem: true,
    earlyRedemptionFeeBps: 150,
    lockupDays: 90,
    principalProtected: 'No, payoff depends on note terms',
    underlyingAssetType: 'Option-premium and range-payoff structure',
    currencyOptions: ['PT', 'USDC'],
    marketCapValue: '$120M structured notional',
    fundingLine: 'Best for teaching why headline coupon is not the same thing as guaranteed income.',
    yieldSources: [
      { label: 'Option premium / vol selling', rate: 0.11 },
      { label: 'Platform subsidy', rate: 0.01 },
      { label: 'Token incentive', rate: 0.008 }
    ],
    feeBlueprint: [
      { label: 'Subscription fee', rate: 0.0022, type: 'entry' },
      { label: 'Management fee', rate: 0.0055, type: 'annual' },
      { label: 'Custody / trustee fee', rate: 0.0025, type: 'annual' },
      { label: 'Performance fee', rate: 0.12, type: 'performance' },
      { label: 'Early redemption fee', rate: 0.015, type: 'conditional' },
      { label: 'Gas / onchain cost', rate: 0.00035, type: 'entry' }
    ],
    stressScenarios: [
      { label: 'Underlying default rate', impact: 'N/A' },
      { label: 'Token reward price shock', impact: '-50%' },
      { label: 'Rates move higher', impact: 'Vol repricing' },
      { label: 'Early redemption spike', impact: 'Dealer bid widens' },
      { label: 'Stablecoin depeg check', impact: '3% funding slip' },
      { label: 'Price update delay', impact: '24h stale mark' }
    ]
  },
  ai: {
    structureLabel: 'Open-ended automated sleeve',
    targetYieldRate: 0.092,
    settlementLagDays: 1,
    redemptionWindow: 'T+1',
    liquidityLabel: 'Model window plus routed exit',
    exitChannel: 'Platform rebalance engine and routed unwind',
    allowEarlyRedeem: true,
    earlyRedemptionFeeBps: 20,
    lockupDays: 0,
    principalProtected: 'No',
    underlyingAssetType: 'Model-led allocation sleeves',
    currencyOptions: ['PT', 'USDC', 'USDT'],
    marketCapValue: '$140M managed basket',
    fundingLine: 'Best for teaching where automation helps, where it stops, and how costs hide inside turnover.',
    yieldSources: [
      { label: 'Underlying basket alpha', rate: 0.074 },
      { label: 'Platform subsidy', rate: 0.006 },
      { label: 'Token incentive', rate: 0.01 }
    ],
    feeBlueprint: [
      { label: 'Subscription fee', rate: 0.001, type: 'entry' },
      { label: 'Management fee', rate: 0.007, type: 'annual' },
      { label: 'Custody / channel fee', rate: 0.0016, type: 'annual' },
      { label: 'Performance fee', rate: 0.08, type: 'performance' },
      { label: 'Gas / onchain cost', rate: 0.00025, type: 'entry' }
    ],
    stressScenarios: [
      { label: 'Underlying default rate', impact: 'N/A' },
      { label: 'Token reward price shock', impact: '-50%' },
      { label: 'Rates move higher', impact: 'Model rebalance drag' },
      { label: 'Early redemption spike', impact: 'Queue widens' },
      { label: 'Stablecoin depeg check', impact: '3% funding slip' },
      { label: 'Price update delay', impact: '24h stale mark' }
    ]
  }
};

function getHedgeSuggestion(product) {
  const ticker = String(product?.ticker || '').toUpperCase();
  switch (ticker) {
    case 'AAPLX':
      return 'Direct short on the same wrapper or a QQQ beta hedge.';
    case 'NVDAX':
      return 'Direct short if available, otherwise use SOXX / QQQ as the clean proxy.';
    case 'TSLAX':
      return 'Use a direct short first, then fall back to QQQ or an EV beta basket only if liquidity thins.';
    case 'SPYX':
      return 'This is already broad beta, so a direct index hedge is the cleanest version.';
    case 'QQQX':
      return 'Use a Nasdaq beta hedge rather than trying to overfit single-name proxies.';
    case 'GLDX':
      return 'Treat gold as a macro sleeve: short the same wrapper or use a broad risk-off proxy.';
    case 'SPACEX':
      return 'Proxy only: TSLA / RKLB / QQQ style comps, not a direct short on SpaceX itself.';
    case 'OPENAI':
      return 'Proxy only: AI leaders basket or QQQ-style growth beta.';
    case 'ANTHROPIC':
      return 'Proxy only: AI infrastructure basket or Nasdaq growth beta.';
    case 'STRIPE':
      return 'Proxy only: PYPL / fintech basket rather than pretending this is directly hedgeable.';
    case 'DATABRICKS':
      return 'Proxy only: cloud / data infrastructure basket plus broad growth beta.';
    case 'BYTEDANCE':
      return 'Proxy only: consumer internet comps plus broad growth beta.';
    default:
      return 'Use the closest liquid listed proxy first, then size down if the proxy fit is weak.';
  }
}

function buildHedgeRouteProfile(product, insight, guide) {
  if (!product) return null;

  const lane = product.lane || 'public';
  const diligenceBase = clampNumber(Math.round(Number(insight?.diligenceScore || 72)), 35, 96);
  const holdingsCount = Math.max(1, Number(insight?.holdings?.length || 1));
  const isPublicLike = lane === 'public' || lane === 'leverage';
  const isPrivateLike = lane === 'private';
  const isRwaLike = lane === 'funding' || lane === 'yield';
  const isStrategyLike = lane === 'strategy';
  const mode = isPublicLike ? 'direct' : isPrivateLike ? 'proxy' : isRwaLike ? 'exit' : isStrategyLike ? 'basket' : 'monitor';

  const sharedAutoLabels = {
    autoTitle: 'Auto-unwind hedge window',
    holdingLabel: 'Hedge window',
    targetLabel: 'Auto-unwind bar',
    sizeLabel: 'Hedge size'
  };

  if (isPublicLike) {
    const hedgeabilityScore = clampNumber(diligenceBase + 4, 68, 94);
    const exitLiquidityScore = clampNumber(72 + holdingsCount * 3, 68, 92);
    const protectionScore = clampNumber(74 + (String(product.risk || '').toLowerCase() === 'low' ? 6 : 0), 64, 90);

    return {
      mode,
      panelTitle: 'Public-market hedge route',
      summary:
        'Use hedge mode to protect a listed or tokenized public-market sleeve first. Here the hedge can be more direct, but wrapper spread, venue risk, and liquidity still stay visible.',
      lessons: [
        'A public-market hedge is strongest when the underlying mark is continuous and the proxy is liquid.',
        'The goal is lower net exposure and smaller drawdown, not a hidden second directional bet.',
        'Wrapper drag, funding, and exit spread still survive even after a clean hedge is opened.'
      ],
      walkthrough: [
        { number: '1', title: 'Click the risk window bar', detail: 'Anchor the hedge at the replay bar where the existing listed sleeve starts to look vulnerable.' },
        { number: '2', title: 'Set hedge size and ratio', detail: 'Decide how much of the sleeve to protect before you worry about extra leverage.' },
        { number: '3', title: 'Open the hedge leg + confirm trade', detail: 'The hedge still walks through trade confirm, risk confirm, and wallet signature before it opens.' },
        { number: '4', title: 'Auto-unwind or close manually', detail: 'Use the hedge window to unwind protection once the event or drawdown risk passes.' }
      ],
      tradeConfirmCopy:
        'Confirm the hedge ticket first. This public-market hedge is a protection leg for an existing sleeve, not a replacement for smaller sizing. Any flash quote steps happen next, then the wallet signature.',
      riskConfirmCopy:
        'This hedge can offset listed market beta more directly than private sleeves can, but it still cannot remove wrapper spread, venue liquidity risk, or platform risk from the protected asset.',
      setupRows: [
        { label: 'Protected sleeve', value: `${product.ticker} listed wrapper / public beta sleeve` },
        { label: 'Hedge mode', value: 'Direct hedge' },
        { label: 'Suggested hedge', value: getHedgeSuggestion(product) },
        { label: 'Settlement mode', value: 'Onchain spot holding + cash-settled hedge' },
        { label: 'Main residual risk', value: 'Wrapper spread, venue liquidity, and platform risk remain.' }
      ],
      statCards: [
        { label: 'Hedgeability', value: `${hedgeabilityScore}/100`, copy: 'Direct hedge tools are available because price discovery is relatively continuous here.' },
        { label: 'Exit liquidity', value: `${exitLiquidityScore}/100`, copy: 'The user can usually hedge faster here than on private or redemption-only sleeves.' },
        { label: 'Expected haircut', value: '0.4% to 1.8%', copy: 'Most pain comes from spread and wrapper drag, not a forced private-market discount.' },
        { label: 'Protection after drag', value: `${protectionScore}/100`, copy: 'Funding and close drag still matter if the hedge stays on longer than the event window.' }
      ],
      diligence: {
        eyebrow: '05 Hedgeability & exit risk',
        title: 'What can really be hedged here?',
        pillLabel: 'Direct hedge',
        bullets: [],
        footer: ''
      },
      ideaCopy:
        'Public-market sleeves can support a more direct hedge. Keep the spot or tokenized stock on, then short the same wrapper or a broad listed proxy to soften drawdown while the sleeve stays live.',
      feeSummary:
        'Use hedge mode to ask whether this leg really softens downside after funding and close drag, not whether it prints the biggest gross directional PnL.',
      ...sharedAutoLabels
    };
  }

  if (isPrivateLike) {
    const hedgeabilityScore = clampNumber(diligenceBase - 30, 24, 58);
    const exitLiquidityScore = clampNumber(28 + holdingsCount * 3, 22, 48);
    const protectionScore = clampNumber(36 + holdingsCount * 2, 28, 54);
    const haircutBand = Number(guide?.lockupDays || 0) >= 180 ? '8% to 18%' : '5% to 10%';

    return {
      mode,
      panelTitle: 'Proxy hedge route for private exposure',
      summary:
        'Private / pre-IPO hedge mode is mostly about proxy hedges and exit uncertainty. The bigger risk is often stale pricing or transfer-only liquidity, not intraday volatility alone.',
      lessons: [
        'No direct hedge exists for most private sleeves, so any hedge here is proxy-only.',
        'Exit uncertainty and valuation lag usually matter more than headline beta.',
        'Sizing down is often more honest than pretending this route is perfectly hedgeable.'
      ],
      walkthrough: [
        { number: '1', title: 'Click the stress bar', detail: 'Anchor the hedge window where you think private marks could lag or exit risk could widen.' },
        { number: '2', title: 'Set proxy size first', detail: 'Size the proxy hedge to soften broad beta before you assume company-specific protection exists.' },
        { number: '3', title: 'Open the proxy hedge + confirm trade', detail: 'The route still opens one live leg, but it must be read as a proxy rather than a direct offset.' },
        { number: '4', title: 'Watch exit and haircut risk', detail: 'Use the hedge window to compare proxy benefit against likely transfer-only discount or tender friction.' }
      ],
      tradeConfirmCopy:
        'Confirm the proxy hedge first. This route is not creating a direct offset on the private asset; it is only placing a liquid public proxy around an illiquid sleeve before the wallet signature.',
      riskConfirmCopy:
        'This private-market hedge is proxy-only. It may reduce broad growth beta, but it cannot remove stale pricing, transfer-only liquidity, or exit uncertainty from the protected sleeve.',
      setupRows: [
        { label: 'Protected sleeve', value: `${product.ticker} private / pre-IPO sleeve` },
        { label: 'Hedge mode', value: 'Proxy only' },
        { label: 'Suggested hedge', value: getHedgeSuggestion(product) },
        { label: 'Settlement mode', value: 'Transfer-only sleeve + cash proxy hedge' },
        { label: 'Main residual risk', value: 'Exit uncertainty, stale pricing, and lock-up still dominate.' }
      ],
      statCards: [
        { label: 'Hedgeability', value: `${hedgeabilityScore}/100`, copy: 'There is no direct hedge here; any protection is only through comps or market beta.' },
        { label: 'Proxy fit', value: 'Proxy only', copy: 'The hedge can soften market beta, but company-specific downside still leaks through.' },
        { label: 'Expected haircut', value: haircutBand, copy: 'Stress often shows up as discount-to-exit rather than a smooth quoted spread.' },
        { label: 'Protection after drag', value: `${protectionScore}/100`, copy: 'Use this as drawdown softening, not as a promise of precise risk cancellation.' }
      ],
      diligence: {
        eyebrow: '05 Hedgeability & exit risk',
        title: 'How weak is the hedge here?',
        pillLabel: 'Proxy only',
        bullets: [
          'No direct hedge exists for most private sleeves such as SpaceX or OpenAI style exposure.',
          'Use comps or broad beta only if they are clearly more liquid than the protected sleeve itself.',
          'The bigger stress is often that the user cannot exit quickly, or must accept a transfer discount.',
          'This is usually a sizing and exit-discipline problem first, hedge problem second.'
        ],
        footer:
          'Private-market hedge mode is mainly a risk-discussion layer. It should never pretend to be a perfect offset.'
      },
      ideaCopy:
        'Treat private hedges as proxy wrappers around the sleeve. Think TSLA / RKLB / QQQ style beta guardrails, not a real short on the private company itself.',
      riskBanner:
        'You are managing proxy risk here, not creating a true one-for-one hedge.',
      feeSummary:
        'Use hedge mode here to compare proxy help versus likely haircut, liquidity discount, and stale pricing. The honest answer is often to size smaller.',
      ...sharedAutoLabels
    };
  }

  if (isRwaLike) {
    const hedgeabilityScore = clampNumber(diligenceBase - 18, 34, 72);
    const exitLiquidityScore = clampNumber(54 + holdingsCount * 4, 48, 84);
    const protectionScore = clampNumber(48 + holdingsCount * 3, 42, 76);
    const haircutBand =
      lane === 'funding'
        ? /ib01/i.test(product.id) || /etf tracker/i.test(String(product.productType || '').toLowerCase())
          ? '0.4% to 1.8%'
          : '0.2% to 1.2%'
        : '0.8% to 3.2%';

    return {
      mode,
      panelTitle: 'Exit and liquidity hedge route',
      summary:
        'RWA-style hedge mode is mostly about redemption windows, discount monitoring, and rate or credit proxies. Liquidity risk still cannot be perfectly hedged away.',
      lessons: [
        'The core question is how the user exits, not how perfectly the asset can be shorted.',
        'A rate or credit proxy may reduce market sensitivity, but it will not force redemptions to clear.',
        'Haircut monitoring and liquidity discipline matter more here than headline leverage.'
      ],
      walkthrough: [
        { number: '1', title: 'Click the stress bar', detail: 'Anchor the hedge window where redemption pressure or NAV discount would matter most.' },
        { number: '2', title: 'Set the sleeve size first', detail: 'Size the protected route before you look at rate or carry proxies.' },
        { number: '3', title: 'Review the proxy hedge + confirm trade', detail: 'Use the live leg as a teaching proxy around rates, basis, or collateral stress rather than as a direct short.' },
        { number: '4', title: 'Watch exit and redemption drag', detail: 'Use the hedge window to compare proxy benefit versus queue, haircut, and redemption friction.' }
      ],
      tradeConfirmCopy:
        'Confirm the hedge route first. For treasury, MMF, or carry sleeves this trade is mainly a proxy around rate, carry, or liquidity stress before the wallet signature.',
      riskConfirmCopy:
        'This route can reduce some market or carry sensitivity, but it cannot guarantee redemption capacity, remove haircut risk, or solve an issuer-side liquidity bottleneck.',
      setupRows: [
        { label: 'Protected sleeve', value: `${product.ticker} reserve / income sleeve` },
        { label: 'Hedge mode', value: 'Exit + proxy hedge' },
        { label: 'Suggested hedge', value: 'Rate, basis, or credit proxy depending on the sleeve' },
        { label: 'Settlement mode', value: `${guide?.redemptionWindow || 'Windowed'} redemption / transfer path` },
        { label: 'Main residual risk', value: 'Liquidity and haircut risk cannot be perfectly hedged.' }
      ],
      statCards: [
        { label: 'Hedgeability', value: `${hedgeabilityScore}/100`, copy: 'This is mostly a proxy or liquidity-management route, not a clean direct short hedge.' },
        { label: 'Exit liquidity', value: `${exitLiquidityScore}/100`, copy: 'Redemption path and queue depth matter more than a single intraday price mark.' },
        { label: 'Expected haircut', value: haircutBand, copy: 'Haircuts show up when exits queue, dealer liquidity thins, or redemption windows tighten.' },
        { label: 'Protection after drag', value: `${protectionScore}/100`, copy: 'A proxy can help on rates or carry, but it may do little if the sleeve simply cannot exit.' }
      ],
      diligence: {
        eyebrow: '05 Hedgeability & exit risk',
        title: 'What still cannot be hedged?',
        pillLabel: 'Exit-led',
        bullets: [],
        footer: ''
      },
      ideaCopy:
        'RWA sleeves need exit and haircut thinking first. Use a proxy only to soften rates, carry, or credit sensitivity, not to pretend liquidity risk has disappeared.',
      riskBanner:
        'You are managing exit and discount risk here, not building a perfect short hedge.',
      feeSummary:
        'Use hedge mode here to test whether a proxy actually improves the net exit path after redemption lag, haircut, and wrapper drag.',
      ...sharedAutoLabels
    };
  }

  const hedgeabilityScore = clampNumber(diligenceBase - 10, 40, 84);
  const exitLiquidityScore = clampNumber(50 + holdingsCount * 4, 44, 82);
  const protectionScore = clampNumber(56 + holdingsCount * 3, 48, 86);

  return {
    mode,
    panelTitle: 'Basket-aware hedge route',
    summary:
      'Treat hedge mode here as a basket or allocation overlay. The point is to explain what part of the sleeve is being protected and what still leaks through after drag.',
    lessons: [
      'The right hedge for a basket is often another basket or beta layer, not a single perfect offset.',
      'Rebalance drag and concentration still matter even when the route looks diversified.',
      'Use hedge mode to compare net exposure, not just gross upside.'
    ],
    walkthrough: [
      { number: '1', title: 'Click the stress bar', detail: 'Anchor the replay window around the drawdown or rebalance event you want to test.' },
      { number: '2', title: 'Set basket protection size', detail: 'Protect the sleeve at the basket level before chasing single-name precision.' },
      { number: '3', title: 'Confirm the hedge leg', detail: 'The route still opens one live leg, but it should be read as a basket overlay rather than a one-name short.' },
      { number: '4', title: 'Review net exposure after drag', detail: 'Use the unwind window to compare how much downside was really softened after costs.' }
    ],
    tradeConfirmCopy:
      'Confirm the hedge overlay first. This route is teaching basket or allocation protection, not just another directional trade before the wallet signature.',
    riskConfirmCopy:
      'This hedge softens some basket or allocation risk, but concentration, rebalance drag, and model mismatch can still leave real downside behind.',
    setupRows: [
      { label: 'Protected sleeve', value: `${product.ticker} basket / allocation sleeve` },
      { label: 'Hedge mode', value: 'Basket hedge' },
      { label: 'Suggested hedge', value: 'Index, sector, or allocation proxy rather than a single-name short' },
      { label: 'Settlement mode', value: 'Overlay hedge with routed unwind' },
      { label: 'Main residual risk', value: 'Concentration and rebalance drag remain.' }
    ],
    statCards: [
      { label: 'Hedgeability', value: `${hedgeabilityScore}/100`, copy: 'Basket hedges work best at the exposure layer, not as a perfect name-by-name offset.' },
      { label: 'Exit liquidity', value: `${exitLiquidityScore}/100`, copy: 'The hedge can usually be exited faster than the underlying basket can be rebalanced.' },
      { label: 'Expected haircut', value: '0.8% to 4.0%', copy: 'Drag shows up through rebalance, spread, and route complexity rather than only one ticket fee.' },
      { label: 'Protection after drag', value: `${protectionScore}/100`, copy: 'Judge this route by net exposure after drag, not by the biggest gross move.' }
    ],
    diligence: {
      eyebrow: '05 Hedgeability & exit risk',
      title: 'How usable is the hedge overlay?',
      pillLabel: 'Overlay hedge',
      bullets: [
        'This route is hedgeable at the basket or beta layer, not as a perfect single-name offset.',
        'The more sleeves or templates you combine, the more rebalance drag and mismatch matter.',
        'A hedge can soften drawdown while still leaving concentration and implementation risk behind.',
        'This is why strategy hedges should stay explanation-first before they become execution-heavy.'
      ],
      footer:
        'Basket hedges are best read as overlays on top of a thesis card, not as magic cancellation of every sleeve in the basket.'
    },
    ideaCopy:
      'Use hedge mode here as an overlay: reduce net exposure at the basket level, then decide whether the extra complexity still survives after drag.',
    riskBanner:
      'You are managing basket or overlay risk here, not creating a perfect offset for every sleeve.',
    feeSummary:
      'Use hedge mode here to ask whether the overlay still improves downside after spread, rebalance drag, and route complexity.',
    ...sharedAutoLabels
  };
}

const PRODUCT_GUIDE_OVERRIDES = {
  'msx-stable-income': {
    marketCapValue: '$821M AUM / tokenized treasury fund',
    redemptionWindow: 'Market-day liquidity',
    liquidityLabel: 'Market-day liquidity',
    targetYieldRate: 0.0342,
    fundingLine: 'Treat this like tokenized T-bill cash parking: low-vol NAV, reserve-style liquidity, and small but real exit friction.'
  },
  'msx-income-ladder': {
    marketCapValue: '$259M AUM / tokenized carry fund',
    redemptionWindow: 'Market-day subscriptions & redemptions',
    liquidityLabel: 'Daily liquidity, strategy risk under the hood',
    lockupDays: 0,
    targetYieldRate: 0.0414,
    fundingLine: 'Treat this as a carry strategy fund: the NAV is real, but the yield comes from basis and treasury support rather than plain cash.'
  },
  aaplx: {
    marketCapValue: '$4.05T underlying / token wrapper',
    targetYieldRate: 0.118,
    principalProtected: 'No',
    currencyOptions: ['PT', 'USDC', 'USDT'],
    fundingLine: 'Treat this as tokenized Apple exposure inside public markets: familiar listed beta, but with wrapper rights, spread, and routing cost layered on top.'
  },
  nvdax: {
    marketCapValue: 'Large-cap semiconductor equity / token wrapper',
    targetYieldRate: 0.142,
    principalProtected: 'No',
    currencyOptions: ['PT', 'USDC', 'USDT'],
    fundingLine: 'Treat this as tokenized NVIDIA exposure: very liquid public-market beta first, then wrapper drag and route choice second.'
  },
  'tslax-public': {
    marketCapValue: 'High-beta EV equity / token wrapper',
    targetYieldRate: 0.155,
    principalProtected: 'No',
    currencyOptions: ['PT', 'USDC', 'USDT'],
    fundingLine: 'Treat this as tokenized Tesla exposure: the chart matters, but the real lesson is how wrapper spread and execution path change take-home PnL.'
  },
  spyx: {
    marketCapValue: 'Broad U.S. equity beta / token wrapper',
    targetYieldRate: 0.094,
    principalProtected: 'No',
    currencyOptions: ['PT', 'USDC', 'USDT'],
    fundingLine: 'Treat this as a public-market beta sleeve rather than a single-name stock. It is the cleanest route for learning index-style tokenized exposure.'
  },
  qqqx: {
    marketCapValue: 'Nasdaq growth basket / token wrapper',
    targetYieldRate: 0.112,
    principalProtected: 'No',
    currencyOptions: ['PT', 'USDC', 'USDT'],
    fundingLine: 'Treat this as a growth-heavy public basket: faster upside and faster drag than a treasury-like sleeve, with token wrapper friction still visible.'
  },
  gldx: {
    marketCapValue: 'Gold benchmark / token wrapper',
    targetYieldRate: 0.061,
    principalProtected: 'No',
    currencyOptions: ['PT', 'USDC', 'USDT'],
    fundingLine: 'Treat this as tokenized gold exposure inside public markets: the role is diversification and hedge behavior, not only equity beta.'
  },
  'eth-usd': {
    marketCapValue: '$430B spot benchmark',
    targetYieldRate: 0.134,
    fundingLine: 'Use ETH as the clean benchmark route before comparing structured or leverage overlays.'
  },
  'btc-usd': {
    marketCapValue: '$1.4T perp reference',
    targetYieldRate: 0.162,
    currencyOptions: ['PT', 'USDC']
  },
  'preipo-window': {
    marketCapValue: 'Late-stage private allocation window',
    redemptionWindow: 'Transfer-only before liquidity event',
    exitChannel: 'Platform matching or issuer event',
    allowEarlyRedeem: false,
    lockupDays: 365,
    principalProtected: 'No',
    fundingLine: 'Treat this like a late-stage private allocation card: access, lockup, and transferability matter more than trying to trade it like listed spot.'
  },
  'openai-access': {
    marketCapValue: 'Late-stage private AI allocation window',
    redemptionWindow: 'Transfer-only before liquidity event',
    exitChannel: 'Platform matching or issuer event',
    allowEarlyRedeem: false,
    lockupDays: 365,
    principalProtected: 'No',
    fundingLine: 'Treat this like a private watchlist or subscription card. The key questions are access, transfer rules, and eventual liquidity, not intraday order-book tactics.'
  },
  'anthropic-secondary': {
    marketCapValue: 'Late-stage private AI secondary window',
    redemptionWindow: 'Transfer-only before liquidity event',
    exitChannel: 'Platform matching or issuer event',
    allowEarlyRedeem: false,
    lockupDays: 365,
    principalProtected: 'No',
    fundingLine: 'Treat this as a private secondary access card where the spread between allocation mark and true exit path matters more than any daily candle.'
  },
  'stripe-secondary': {
    marketCapValue: 'Late-stage fintech allocation window',
    redemptionWindow: 'Transfer-only before liquidity event',
    exitChannel: 'Platform matching or issuer event',
    allowEarlyRedeem: false,
    lockupDays: 270,
    principalProtected: 'No',
    fundingLine: 'Treat this as a private fintech allocation. The replay is a teaching surface for lockup, transfer rights, and exit optionality rather than listed-market execution.'
  },
  'databricks-secondary': {
    marketCapValue: 'Late-stage data / infra allocation window',
    redemptionWindow: 'Transfer-only before liquidity event',
    exitChannel: 'Platform matching or issuer event',
    allowEarlyRedeem: false,
    lockupDays: 270,
    principalProtected: 'No',
    fundingLine: 'Treat this as a late-stage infrastructure name in private markets: basket fit and eligibility matter more than rapid route changes.'
  },
  'ripple-secondary': {
    marketCapValue: 'Late-stage platform allocation window',
    redemptionWindow: 'Transfer-only before liquidity event',
    exitChannel: 'Platform matching or issuer event',
    allowEarlyRedeem: false,
    lockupDays: 270,
    principalProtected: 'No',
    fundingLine: 'Treat this like a private platform allocation card. The point is to compare private-market access profiles, not to imply exchange-style spot trading.'
  },
  tslax: {
    redemptionWindow: 'Maturity only or dealer unwind',
    exitChannel: 'Issuer or dealer settlement',
    allowEarlyRedeem: true,
    earlyRedemptionFeeBps: 175,
    lockupDays: 90
  },
  'ai-rotation': {
    marketCapValue: '$145M managed basket',
    targetYieldRate: 0.094
  }
};

function buildReplayAchievements({
  onboardingReady,
  replayTradeUsed,
  leaderboardUsed,
  scoreReady,
  spotLoopUsed,
  leverageRouteUsed,
  hedgeRouteUsed,
  leverageHedgeTrainingUsed,
  strategyRouteUsed,
  spotBuySeen
}) {
  return [
    {
      id: REPLAY_BADGE_TYPES.baseCheck,
      taskNumber: 1,
      title: 'Base Check',
      contractId: 'Replay badge #6',
      activityLabel: 'Buy / sell usage',
      coverCopy: 'Paper usage verified',
      requirement:
        'Use the same wallet that already completed onboarding, then finish at least one buy or sell replay trade in Paper Trading.',
      reward: 'Confirms that the same wallet passed onboarding and actually used replay trading instead of only opening the page.',
      inherited: onboardingReady,
      unlocked: onboardingReady && replayTradeUsed,
      detail: onboardingReady && replayTradeUsed
        ? 'This wallet already passed the inherited onboarding checks and has at least one replay buy or sell in the ledger.'
        : onboardingReady
          ? 'The home-page wallet and risk review already carried into Paper Trading. Place one replay buy or sell to finish Base Check.'
          : 'Base Check should only unlock after the same wallet carries the home-page wallet and risk-review gate into replay mode, then records its first replay trade.'
    },
    {
      id: REPLAY_BADGE_TYPES.leaderboard,
      taskNumber: 2,
      title: 'Leaderboard',
      contractId: 'Replay badge #7',
      activityLabel: 'Leaderboard usage',
      coverCopy: 'Leaderboard route verified',
      requirement: 'Finish a positive closed loop and use the leaderboard submit action once.',
      reward: 'Separates local replay profit from a real leaderboard interaction by proving that a score was actually submitted onchain.',
      unlocked: leaderboardUsed,
      detail: leaderboardUsed
        ? 'This wallet has already used the leaderboard route on Sepolia, so the leaderboard badge can be self-claimed.'
        : scoreReady
          ? 'The score is ready. Submit it on Sepolia first, then claim the leaderboard badge.'
          : 'Close at least one replay loop, stay net positive, then use the leaderboard submit action before claiming this badge.'
    },
    {
      id: REPLAY_BADGE_TYPES.spotLoop,
      taskNumber: 3,
      title: 'Spot Loop',
      contractId: 'Replay badge #8',
      activityLabel: 'Low-buy / high-sell',
      coverCopy: 'Spot path learned',
      requirement: 'Complete one spot buy and one spot sell so the user sees entry, exit, spread, and net take-home.',
      reward: 'Marks that the beginner can use the BUY -> SELL path before touching synthetic exposure.',
      unlocked: onboardingReady && spotLoopUsed,
      detail: spotLoopUsed
        ? 'A spot buy and sell loop is already recorded locally, so the user has practiced ownership-style exposure.'
        : 'Buy a listed, private, or cash wrapper in replay, then sell it after moving the cursor to another bar.'
    },
    {
      id: REPLAY_BADGE_TYPES.perpLeverage,
      taskNumber: 4,
      title: 'Leverage + Hedge Drill',
      contractId: 'Replay badge #9',
      activityLabel: 'Training combo trade',
      coverCopy: 'Combo drill learned',
      requirement:
        'Run one guided leverage + hedge practice trade: buy the sleeve, open the levered hedge leg, then review notional, margin, funding, liquidation, and residual exposure.',
      reward:
        'Turns leverage and hedge into one training trade so the user sees the active notional, the protection sleeve, and the funding drag together.',
      unlocked: onboardingReady && (leverageHedgeTrainingUsed || leverageRouteUsed || hedgeRouteUsed),
      detail: leverageHedgeTrainingUsed || leverageRouteUsed || hedgeRouteUsed
        ? 'The wallet has opened the guided leverage + hedge route and inspected how the hedge changes residual exposure after margin and funding drag.'
        : 'Open the Leverage + Hedge route from Tutorial path, load a practice example, buy the sleeve, open the protective levered leg, and inspect notional, margin, funding, liquidation, and residual exposure before claiming.'
    },
    {
      id: REPLAY_BADGE_TYPES.protectiveHedge,
      taskNumber: 5,
      title: 'AI Strategy Template',
      contractId: 'Replay badge #10',
      activityLabel: 'Strategy example',
      coverCopy: 'Strategy template shipped',
      requirement:
        'Build one strategy example or portfolio combo, review the payoff or backtest details, generate/select an AI-marked template, then upload return and drawdown metrics to the strategy leaderboard.',
      reward:
        'Makes the strategy route feel product-ready: the example has payoff nodes or combo weights, AI feature tags, estimated win rate, expected return, max drawdown, and a leaderboard submission path.',
      unlocked: onboardingReady && strategyRouteUsed,
      detail: strategyRouteUsed
        ? 'The wallet has built a strategy example or portfolio combo, generated an AI feature template, and uploaded metrics to the local strategy board.'
        : 'Open Options / strategy for AI templates, or open Leverage + Hedge combo for portfolio combo. Review return, drawdown, and feature tags, then upload the result.'
    }
  ];
}

function getReplayAchievementClaimMeta({ achievement, replayBadgeConfigured, onchainClaimed }) {
  if (onchainClaimed) {
      return {
        claimStatusLabel: 'Already claimed',
        claimTone: 'risk-low',
        detailStepCopy: 'Claim completed on Sepolia',
        actionLabel: 'Already claimed',
      actionDisabled: true
    };
  }

  if (!achievement.unlocked) {
    return {
      claimStatusLabel: 'Complete task first',
      claimTone: 'risk-medium',
      detailStepCopy: 'Complete requirement first',
      actionLabel: 'Complete task first',
      actionDisabled: true
    };
  }

  if (!replayBadgeConfigured) {
    return {
      claimStatusLabel: 'Reward route offline',
      claimTone: 'risk-medium',
      detailStepCopy: 'Project owner still needs to turn on replay badges',
      actionLabel: 'Waiting for demo setup',
      actionDisabled: true
    };
  }

  return {
    claimStatusLabel: 'Wait to be minted',
    claimTone: 'risk-low',
    detailStepCopy: 'Wait to be minted on Sepolia',
    actionLabel: 'Claim on Sepolia',
    actionDisabled: false
  };
}

function getReplayAchievementTileStatus(achievement) {
  if (achievement.onchainClaimed) {
    return {
      tone: 'done',
      text: 'Completed'
    };
  }

  if (achievement.claimStatusLabel === 'Reward route offline') {
    return {
      tone: 'ready',
      text: 'Route offline'
    };
  }

  if (achievement.canClaimOnchain || achievement.claimStatusLabel === 'Wait to be minted' || achievement.unlocked) {
    return {
      tone: 'ready',
      text: 'Wait to be minted'
    };
  }

  if (achievement.inherited) {
    return {
      tone: 'ready',
      text: 'Inherited'
    };
  }

  return {
    tone: 'todo',
    text: 'To do'
  };
}

function ReplayCollectibleCover({ accent = 'green', kicker, title, subtitle, footerLines = [], stamp }) {
  return (
    <div className={`unlock-box-banner paper-reward-cover accent-${accent}`}>
      <div className="unlock-box-banner-grid"></div>
      <div className="unlock-box-banner-content">
        <div className="unlock-box-banner-kicker">{kicker}</div>
        <div className="unlock-box-banner-title">{title}</div>
        <div className="unlock-box-banner-subtitle">{subtitle}</div>
      </div>
      {footerLines.length ? (
        <div className="paper-reward-cover-footer">
          {footerLines.map((line, index) => (
            <div key={`${stamp || kicker}-${index}`} className="paper-reward-cover-meta">
              {line}
            </div>
          ))}
        </div>
      ) : null}
      {stamp ? <div className="paper-reward-cover-stamp">{stamp}</div> : null}
    </div>
  );
}

function ReplayTaskPendingCover({ taskNumber, title, requirement }) {
  return (
    <div className="unlock-box-banner paper-reward-cover paper-reward-cover-pending">
      <div className="unlock-box-banner-grid"></div>
      <div className="unlock-box-banner-content">
        <div className="unlock-box-banner-kicker">{`Task ${taskNumber}`}</div>
        <div className="unlock-box-banner-title">BADGE LOCKED</div>
        <div className="unlock-box-banner-subtitle">{title}</div>
      </div>
      <div className="paper-reward-cover-footer">
        <div className="paper-reward-cover-meta">Badge only appears after the task is complete.</div>
        <div className="paper-reward-cover-meta">{requirement}</div>
      </div>
    </div>
  );
}

function buildProductViewsFromSession(session) {
  return Object.fromEntries(
    REPLAY_PRODUCTS.map((product) => {
      const stored = session?.[product.id] || {};
      const interval = product.intervalOptions.includes(stored.interval) ? stored.interval : product.defaultInterval;
      const rangeOptions = getRangeOptionsForInterval(interval);
      const range = rangeOptions.some((option) => option.id === stored.range) ? stored.range : product.defaultRange;
      const bars = product.csvPath ? [] : buildFallbackBars(product, interval, range);
      const cursor = Math.max(0, Math.min(Number(stored.cursor || 0), Math.max(0, bars.length - 1)));
      const replayStarted = Boolean(stored.replayStarted);

      return [
        product.id,
        {
          interval,
          range,
          cursor,
          replayStarted,
          bars,
          status: product.csvPath ? 'loading' : product.sourceType === 'local' ? 'ready' : 'fallback',
          sourceLabel: product.sourceType === 'local' || product.csvPath ? product.sourceLabel : getReplayFallbackLabel(product),
          error: '',
          remoteSignature: ''
        }
      ];
    })
  );
}

function serializeProductViews(productViews) {
  return Object.fromEntries(
    Object.entries(productViews).map(([productId, view]) => [
      productId,
      {
        interval: view.interval,
        range: view.range,
        cursor: view.cursor,
        replayStarted: Boolean(view.replayStarted)
      }
    ])
  );
}

function PaperTradingInner() {
  const { uiLanguage, setUiLanguage, t } = useUiLanguage();
  useDomTranslation(uiLanguage, ['.app-shell', '.wallet-modal-backdrop']);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending, error, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync, isPending: isRiskSigning } = useSignMessage();
  const [selectedLane, setSelectedLane] = useState(DEFAULT_REPLAY_PRODUCT?.lane || REPLAY_LANE_OPTIONS[0]?.id || 'spot');
  const [selectedProductId, setSelectedProductId] = useState(DEFAULT_REPLAY_PRODUCT?.id || REPLAY_PRODUCTS[0]?.id);
  const [selectedPracticeCaseIndex, setSelectedPracticeCaseIndex] = useState(0);
  const [paperShelfPage, setPaperShelfPage] = useState(1);
  const [replayFillsPage, setReplayFillsPage] = useState(1);
  const [productRiskFilter, setProductRiskFilter] = useState('all');
  const [productLockupFilter, setProductLockupFilter] = useState('all');
  const [paperWorkspaceHeightPx, setPaperWorkspaceHeightPx] = useState(() => {
    const stored = Number(readStorageJson(PAPER_WORKSPACE_HEIGHT_STORAGE_KEY, DEFAULT_PAPER_WORKSPACE_HEIGHT));
    return Number.isFinite(stored)
      ? clampNumber(stored, PAPER_WORKSPACE_HEIGHT_MIN, PAPER_WORKSPACE_HEIGHT_MAX)
      : DEFAULT_PAPER_WORKSPACE_HEIGHT;
  });
  const [paperShelfHeightPx, setPaperShelfHeightPx] = useState(() => {
    const stored = Number(readStorageJson(PAPER_SHELF_HEIGHT_STORAGE_KEY, DEFAULT_PAPER_SHELF_HEIGHT));
    return Number.isFinite(stored)
      ? clampNumber(stored, PAPER_SHELF_HEIGHT_MIN, PAPER_SHELF_HEIGHT_MAX)
      : DEFAULT_PAPER_SHELF_HEIGHT;
  });
  const [paperShelfSplitOffsetPx, setPaperShelfSplitOffsetPx] = useState(() => {
    const stored = Number(readStorageJson(PAPER_SHELF_SPLIT_OFFSET_STORAGE_KEY, DEFAULT_PAPER_SHELF_SPLIT_OFFSET));
    return Number.isFinite(stored)
      ? clampNumber(stored, PAPER_SHELF_SPLIT_OFFSET_MIN, PAPER_SHELF_SPLIT_OFFSET_MAX)
      : DEFAULT_PAPER_SHELF_SPLIT_OFFSET;
  });
  const [tradeAmount, setTradeAmount] = useState(2500);
  const [tradeAmountInput, setTradeAmountInput] = useState('2500');
  const [tradeAmountMaxMode, setTradeAmountMaxMode] = useState('wallet');
  const [tradeAmountMaxApplied, setTradeAmountMaxApplied] = useState(false);
  const debouncedTradeAmount = useDebouncedValue(tradeAmount, 90);
  const simulationTradeAmount = useDeferredValue(debouncedTradeAmount);
  const [feedback, setFeedback] = useState('');
  const [replayDeskToast, setReplayDeskToast] = useState(null);
  const [claimFeedback, setClaimFeedback] = useState('');
  const [scoreFeedback, setScoreFeedback] = useState('');
  const [pendingBuyTrade, setPendingBuyTrade] = useState(null);
  const [hedgeSleeveReadyByProduct, setHedgeSleeveReadyByProduct] = useState({});
  const [pendingPerpTradeConfirm, setPendingPerpTradeConfirm] = useState(null);
  const [pendingPerpRiskConfirm, setPendingPerpRiskConfirm] = useState(null);
  const [tradeOutcomeModal, setTradeOutcomeModal] = useState(null);
  const [tradeOutcomeBursts, setTradeOutcomeBursts] = useState([]);
  const [autoSellPreviewOpen, setAutoSellPreviewOpen] = useState(false);
  const [autoSellTargetProductId, setAutoSellTargetProductId] = useState('');
  const [autoSellPreviewProductId, setAutoSellPreviewProductId] = useState('');
  const [flashLoanTicketConfirmOpen, setFlashLoanTicketConfirmOpen] = useState(false);
  const [flashLoanQuoteOpen, setFlashLoanQuoteOpen] = useState(false);
  const [flashLoanDraftQuotes, setFlashLoanDraftQuotes] = useState({});
  const [flashLoanAppliedQuotes, setFlashLoanAppliedQuotes] = useState({});
  const [pendingPerpDirectionAfterQuote, setPendingPerpDirectionAfterQuote] = useState(null);
  const flashLoanQuoteContextRef = useRef('');
  const tradeAmountBeforeMaxRef = useRef({ input: '2500', amount: 2500 });
  const tradeAmountSliderFrameRef = useRef(null);
  const tradeAmountSliderPendingRef = useRef(null);
  const hedgeSleeveSliderFrameRef = useRef(null);
  const hedgeSleeveSliderPendingRef = useRef(null);
  const hedgeFocusSyncedRef = useRef(false);
  const replayFillsCountRef = useRef(0);
  const [hoveredReplayIndex, setHoveredReplayIndex] = useState(null);
  const hoveredReplayIndexFrameRef = useRef(null);
  const hoveredReplayIndexPendingRef = useRef(null);
  const hoveredReplayIndexValueRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedReplayPanel, setSelectedReplayPanel] = useState('desk');
  const [diligencePagerIndex, setDiligencePagerIndex] = useState(0);
  const [hedgeRatio, setHedgeRatio] = useState(0.5);
  const hedgeTypeOverride = 'auto';
  const [hedgePrincipalFlashEnabled, setHedgePrincipalFlashEnabled] = useState(false);
  const [hedgePrincipalLoanApproval, setHedgePrincipalLoanApproval] = useState({
    key: '',
    signature: '',
    signedAt: '',
    maxNotional: 0
  });
  const [hedgePreviewSleeveNotional, setHedgePreviewSleeveNotional] = useState(2500);
  const [hedgePreviewSleeveInput, setHedgePreviewSleeveInput] = useState('2500');
  const [hedgeDiligencePulse, setHedgeDiligencePulse] = useState(false);
  const [learnMoreProductId, setLearnMoreProductId] = useState(null);
  const [selectedRewardTaskId, setSelectedRewardTaskId] = useState(REPLAY_BADGE_TYPES.baseCheck);
  const [claimingAchievementId, setClaimingAchievementId] = useState(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [walletNickname, setWalletNickname] = useState('');
  const [walletNicknameDraft, setWalletNicknameDraft] = useState('');
  const [pendingWalletNickname, setPendingWalletNickname] = useState(null);
  const [walletNicknameFeedback, setWalletNicknameFeedback] = useState('');
  const [profileBackupStatus, setProfileBackupStatus] = useState('');
  const [selectedProfileBackupAddress, setSelectedProfileBackupAddress] = useState('');
  const [devModeOpen, setDevModeOpen] = useState(false);
  const [devModeAuthed, setDevModeAuthed] = useState(false);
  const [devModeUsername, setDevModeUsername] = useState('');
  const [devModePassword, setDevModePassword] = useState('');
  const [devModeError, setDevModeError] = useState('');
  const [devModeNotice, setDevModeNotice] = useState('');
  const [hasMetaMaskInstalled, setHasMetaMaskInstalled] = useState(false);
  const [selectedAdvancedRoute, setSelectedAdvancedRoute] = useState('spot');
  const [selectedRouteFocusByRoute, setSelectedRouteFocusByRoute] = useState(() =>
    Object.fromEntries(
      Object.entries(REPLAY_ROUTE_FOCUS_OPTIONS).map(([routeId, options]) => [routeId, options[0]?.id || 'default'])
    )
  );
  const [deskStructureMode, setDeskStructureMode] = useState('single');
  const [simulationHoldingDays, setSimulationHoldingDays] = useState(30);
  const [simulationHoldingDaysInput, setSimulationHoldingDaysInput] = useState('30');
  const [timedExitRangeToast, setTimedExitRangeToast] = useState('');
  const [showAdvancedDeskControls, setShowAdvancedDeskControls] = useState(false);
  const [routeSettlementMode, setRouteSettlementMode] = useState('T+0');
  const [routeBufferRatio, setRouteBufferRatio] = useState(0.5);
  const [strategyDownsidePct, setStrategyDownsidePct] = useState(12);
  const [strategyProfitHarvestPct, setStrategyProfitHarvestPct] = useState(35);
  const [strategyUpsideCapPct, setStrategyUpsideCapPct] = useState(18);
  const [strategyPremiumPct, setStrategyPremiumPct] = useState(1.2);
  const [strategyStrikePct, setStrategyStrikePct] = useState(8);
  const [selectedOptionStrategyTemplateId, setSelectedOptionStrategyTemplateId] = useState('collar');
  const [strategyAiPrompt, setStrategyAiPrompt] = useState(DEFAULT_STRATEGY_AI_PROMPT);
  const [selectedStrategyAiVariantId, setSelectedStrategyAiVariantId] = useState(STRATEGY_AI_TEMPLATE_VARIANTS[0]?.id || 'balanced-guardrail');
  const [strategyAiTemplateGenerated, setStrategyAiTemplateGenerated] = useState(false);
  const [strategyTemplateLeaderboard, setStrategyTemplateLeaderboard] = useState(() => readStoredStrategyTemplateLeaderboard());
  const [portfolioComboStartDate, setPortfolioComboStartDate] = useState(PORTFOLIO_COMBO_DEFAULT_START_DATE);
  const [portfolioComboEndDate, setPortfolioComboEndDate] = useState(PORTFOLIO_COMBO_DEFAULT_END_DATE);
  const [portfolioComboSelectedIds, setPortfolioComboSelectedIds] = useState(PORTFOLIO_COMBO_DEFAULT_SELECTED_IDS);
  const [portfolioComboWeights, setPortfolioComboWeights] = useState(() => PORTFOLIO_COMBO_DEFAULT_WEIGHTS);
  const [contractDirection, setContractDirection] = useState('long');
  const [activePerpLeg, setActivePerpLeg] = useState(null);
  const [activePerpPurpose, setActivePerpPurpose] = useState(null);
  const [activePerpEntry, setActivePerpEntry] = useState(null);
  const [contractLeverage, setContractLeverage] = useState(3);
  const [perpRiskApproval, setPerpRiskApproval] = useState({
    key: '',
    signature: '',
    signedAt: ''
  });
  const [productLeaderboardFloat, setProductLeaderboardFloat] = useState(() =>
    normalizeProductLeaderboardFloat(readStorageJson(PRODUCT_LEADERBOARD_FLOAT_STORAGE_KEY, null))
  );
  const [autoSellDockOpen, setAutoSellDockOpen] = useState(() =>
    readStorageJson(AUTO_SELL_DOCK_STORAGE_KEY, false) === true
  );
  const [autoSellDockFloat, setAutoSellDockFloat] = useState(() =>
    normalizeAutoSellDockFloat(readStorageJson(AUTO_SELL_DOCK_FLOAT_STORAGE_KEY, null))
  );
  const [productLeaderboardGesture, setProductLeaderboardGesture] = useState(null);
  const [autoSellDockGesture, setAutoSellDockGesture] = useState(null);
  const [developerOverride, setDeveloperOverride] = useState(false);
  const hoverDebugEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('hoverDebug') === '1';
  }, []);
  const [paperState, setPaperState] = useState(() => readStoredPaperState(address));
  const [tradeOutcomeHistory, setTradeOutcomeHistory] = useState(() => readStoredTradeOutcomeHistory(address));
  const [productViews, setProductViews] = useState(() => readStoredReplaySession(address));
  const [replayClaimCache, setReplayClaimCache] = useState(() => defaultReplayClaimCache(address));
  const [scoreSubmissionLog, setScoreSubmissionLog] = useState(defaultReplayScoreLog());
  const [replayLeaderboardArchive, setReplayLeaderboardArchive] = useState(defaultReplayLeaderboardArchive());
  const [wealthDeskState, setWealthDeskState] = useState(() => readStoredWealthDeskState(address));
  const walletAnchorRef = useRef(null);
  const productLanesRef = useRef(null);
  const tradeDeskRef = useRef(null);
  const tradeAmountInputRef = useRef(null);
  const paperShelfScrollAreaRef = useRef(null);
  const leaderboardRouteRef = useRef(null);
  const pendingScoreSnapshotRef = useRef(null);
  const tradeOutcomeHistoryRef = useRef(readStoredTradeOutcomeHistory(address));
  const tradeOutcomeBurstTimerRef = useRef(null);
  const [progressState, setProgressState] = useState({
    viewedRiskCards: [],
    guideCompleted: false,
    quizCompleted: false,
    paperTradesCompleted: 0,
    homeOnboardingCompleted: false,
    paperUnlocked: false,
    adminUnlocked: false,
    spotLessonCompleted: false,
    leverageLessonCompleted: false,
    hedgeLessonCompleted: false,
    hedgeSizingCompleted: false,
    hedgePositiveCloseCompleted: false,
    strategyLessonCompleted: false,
    strategyExampleCompleted: false,
    strategyAiTemplateCompleted: false,
    strategyLeaderboardUploaded: false
  });

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      if (tradeAmountSliderFrameRef.current !== null) {
        window.cancelAnimationFrame(tradeAmountSliderFrameRef.current);
      }
      if (hedgeSleeveSliderFrameRef.current !== null) {
        window.cancelAnimationFrame(hedgeSleeveSliderFrameRef.current);
      }
      if (hoveredReplayIndexFrameRef.current !== null) {
        window.cancelAnimationFrame(hoveredReplayIndexFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    hoveredReplayIndexValueRef.current = hoveredReplayIndex;
  }, [hoveredReplayIndex]);

  const metaMaskConnector = useMemo(
    () => connectors.find((connector) => connector.name.toLowerCase().includes('metamask')) || connectors[0],
    [connectors]
  );
  const effectivePaperShelfHeightMax = Math.max(
    PAPER_SHELF_HEIGHT_MIN,
    paperWorkspaceHeightPx - PAPER_LEFT_COLUMN_GAP - PAPER_TUTORIAL_PATH_MIN_HEIGHT
  );
  const effectivePaperShelfHeightPx = clampNumber(
    paperShelfHeightPx,
    PAPER_SHELF_HEIGHT_MIN,
    effectivePaperShelfHeightMax
  );
  const effectiveTutorialBottomInsetMax = Math.max(
    PAPER_SHELF_SPLIT_OFFSET_MIN,
    Math.min(
      PAPER_SHELF_SPLIT_OFFSET_MAX,
      paperWorkspaceHeightPx - PAPER_LEFT_COLUMN_GAP - effectivePaperShelfHeightPx - PAPER_TUTORIAL_PATH_MIN_HEIGHT
    )
  );
  const effectiveTutorialBottomInsetPx = clampNumber(
    paperShelfSplitOffsetPx,
    PAPER_SHELF_SPLIT_OFFSET_MIN,
    effectiveTutorialBottomInsetMax
  );
  const effectivePaperTutorialHeightPx = Math.max(
    PAPER_TUTORIAL_PATH_MIN_HEIGHT,
    paperWorkspaceHeightPx - PAPER_LEFT_COLUMN_GAP - effectivePaperShelfHeightPx - effectiveTutorialBottomInsetPx
  );
  const paperWorkspaceStyle = useMemo(
    () => ({
      '--paper-main-stage-height': `${paperWorkspaceHeightPx}px`,
      '--paper-shelf-height': `${effectivePaperShelfHeightPx}px`,
      '--paper-shelf-learning-panel-height': `${effectivePaperTutorialHeightPx}px`
    }),
    [effectivePaperShelfHeightPx, effectivePaperTutorialHeightPx, paperWorkspaceHeightPx]
  );
  const walletDisplayName = useMemo(
    () => getWalletDisplayName(address, walletNickname, shortAddress),
    [address, walletNickname]
  );
  const connectedAddressKey = useMemo(() => (address ? address.toLowerCase() : ''), [address]);
  const profileBackupAccounts = useMemo(
    () => listProfileBackupAccounts(),
    [connectedAddressKey, profileBackupStatus, walletNickname]
  );
  const { data: sepoliaBalance } = useBalance({
    address,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address)
    }
  });

  function openWalletModal() {
    setWalletModalOpen(true);
    setWalletError('');
  }

  useEffect(() => {
    writeStorageJson(PAPER_WORKSPACE_HEIGHT_STORAGE_KEY, paperWorkspaceHeightPx);
  }, [paperWorkspaceHeightPx]);

  useEffect(() => {
    writeStorageJson(PAPER_SHELF_HEIGHT_STORAGE_KEY, paperShelfHeightPx);
  }, [paperShelfHeightPx]);

  useEffect(() => {
    writeStorageJson(PAPER_SHELF_SPLIT_OFFSET_STORAGE_KEY, paperShelfSplitOffsetPx);
  }, [paperShelfSplitOffsetPx]);

  useEffect(() => {
    writeStorageJson(PRODUCT_LEADERBOARD_FLOAT_STORAGE_KEY, productLeaderboardFloat);
  }, [productLeaderboardFloat]);

  useEffect(() => {
    writeStorageJson(AUTO_SELL_DOCK_STORAGE_KEY, autoSellDockOpen);
  }, [autoSellDockOpen]);

  useEffect(() => {
    writeStorageJson(AUTO_SELL_DOCK_FLOAT_STORAGE_KEY, autoSellDockFloat);
  }, [autoSellDockFloat]);

  useEffect(() => {
    function handleWindowResize() {
      setProductLeaderboardFloat((current) => normalizeProductLeaderboardFloat(current));
      setAutoSellDockFloat((current) => normalizeAutoSellDockFloat(current));
    }

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  useEffect(() => {
    if (!productLeaderboardGesture) return undefined;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = productLeaderboardGesture.type === 'resize' ? 'nwse-resize' : 'grabbing';

    function handlePointerMove(event) {
      const viewport = getProductLeaderboardViewport();
      const deltaX = event.clientX - productLeaderboardGesture.startX;
      const deltaY = event.clientY - productLeaderboardGesture.startY;

      if (productLeaderboardGesture.type === 'drag') {
        setProductLeaderboardFloat((current) =>
          normalizeProductLeaderboardFloat(
            {
              ...current,
              left: productLeaderboardGesture.left + deltaX,
              top: productLeaderboardGesture.top + deltaY
            },
            viewport
          )
        );
        return;
      }

      if (productLeaderboardGesture.type === 'resize') {
        setProductLeaderboardFloat((current) =>
          normalizeProductLeaderboardFloat(
            {
              ...current,
              width: productLeaderboardGesture.width + deltaX,
              height: productLeaderboardGesture.height + deltaY
            },
            viewport
          )
        );
        return;
      }

      setProductLeaderboardFloat((current) =>
        normalizeProductLeaderboardFloat(
          {
            ...current,
            arrowSide: event.clientX <= viewport.width / 2 ? 'left' : 'right',
            arrowTop: productLeaderboardGesture.arrowTop + deltaY
          },
          viewport
        )
      );
    }

    function finishPointerGesture(event) {
      if (productLeaderboardGesture.type === 'arrow') {
        const deltaX = event.clientX - productLeaderboardGesture.startX;
        const deltaY = event.clientY - productLeaderboardGesture.startY;
        if (Math.abs(deltaX) + Math.abs(deltaY) < 8) {
          setProductLeaderboardFloat((current) =>
            normalizeProductLeaderboardFloat({
              ...current,
              isCollapsed: false
            })
          );
        }
      }

      setProductLeaderboardGesture(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishPointerGesture);
    window.addEventListener('pointercancel', finishPointerGesture);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishPointerGesture);
      window.removeEventListener('pointercancel', finishPointerGesture);
    };
  }, [productLeaderboardGesture]);

  useEffect(() => {
    if (!autoSellDockGesture) return undefined;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    function handlePointerMove(event) {
      const viewport = getProductLeaderboardViewport();
      const deltaX = event.clientX - autoSellDockGesture.startX;
      const deltaY = event.clientY - autoSellDockGesture.startY;

      if (autoSellDockGesture.type === 'drag') {
        setAutoSellDockFloat((current) =>
          normalizeAutoSellDockFloat(
            {
              ...current,
              left: autoSellDockGesture.left + deltaX,
              top: autoSellDockGesture.top + deltaY
            },
            viewport
          )
        );
        return;
      }

      setAutoSellDockFloat((current) =>
        normalizeAutoSellDockFloat(
          {
            ...current,
            arrowSide: event.clientX <= viewport.width / 2 ? 'left' : 'right',
            arrowTop: autoSellDockGesture.arrowTop + deltaY
          },
          viewport
        )
      );
    }

    function finishPointerGesture(event) {
      if (autoSellDockGesture.type === 'arrow') {
        const deltaX = event.clientX - autoSellDockGesture.startX;
        const deltaY = event.clientY - autoSellDockGesture.startY;
        if (Math.abs(deltaX) + Math.abs(deltaY) < 8) {
          setAutoSellDockFloat((current) =>
            normalizeAutoSellDockFloat({
              ...current,
              isCollapsed: false
            })
          );
          setAutoSellDockOpen(true);
        }
      }

      setAutoSellDockGesture(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishPointerGesture);
    window.addEventListener('pointercancel', finishPointerGesture);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishPointerGesture);
      window.removeEventListener('pointercancel', finishPointerGesture);
    };
  }, [autoSellDockGesture]);

  function scrollToRef(targetRef, options = {}) {
    const targetNode = targetRef.current;
    if (!targetNode) return;

    targetNode.scrollIntoView({ behavior: 'smooth', block: options.block || 'center' });

    if (options.highlightClass) {
      targetNode.classList.remove(options.highlightClass);
      void targetNode.offsetWidth;
      targetNode.classList.add(options.highlightClass);
      window.setTimeout(() => {
        targetNode.classList.remove(options.highlightClass);
      }, 1800);
    }
  }

  function focusLeaderboardRouteCard() {
    scrollToRef(leaderboardRouteRef, {
      block: 'center',
      highlightClass: 'paper-route-jump-highlight'
    });
  }

  const productMap = useMemo(
    () => Object.fromEntries(REPLAY_PRODUCTS.map((product) => [product.id, product])),
    []
  );

  const { data: hasMintedBadgeOnchain } = useReadContract({
    address: badgeContractConfigured ? BADGE_CONTRACT_ADDRESS : undefined,
    abi: welcomeBadgeAbi,
    functionName: 'hasMinted',
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address) && badgeContractConfigured
    }
  });

  const { data: riskBadgeOnchain } = useReadContract({
    address: badgeContractConfigured ? BADGE_CONTRACT_ADDRESS : undefined,
    abi: welcomeBadgeAbi,
    functionName: 'hasMintedTask',
    args: address ? [address, BADGE_TYPES.risk] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address) && badgeContractConfigured
    }
  });

  const replayClaimContracts = useMemo(() => {
    if (!address || !replayBadgeContractConfigured) return [];

    return REPLAY_ACHIEVEMENT_IDS.map((achievementId) => ({
      address: REPLAY_BADGE_CONTRACT_ADDRESS,
      abi: replayAchievementAbi,
      functionName: 'balanceOf',
      args: [address, achievementId],
      chainId: SEPOLIA_CHAIN_ID
    }));
  }, [address, replayBadgeContractConfigured]);

  const { data: replayClaimReadData, refetch: refetchReplayClaimReadData } = useReadContracts({
    contracts: replayClaimContracts,
    allowFailure: true,
    query: {
      enabled: replayClaimContracts.length > 0,
      placeholderData: []
    }
  });

  const { data: hasSubmittedReplayScoreOnchain, refetch: refetchReplayScoreState } = useReadContract({
    address: replayBadgeContractConfigured ? REPLAY_BADGE_CONTRACT_ADDRESS : undefined,
    abi: replayAchievementAbi,
    functionName: 'hasSubmittedScore',
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address) && replayBadgeContractConfigured
    }
  });

  const {
    data: claimHash,
    error: claimWriteError,
    isPending: isClaimSubmitting,
    writeContract: writeReplayClaim
  } = useWriteContract();

  const {
    data: scoreHash,
    error: scoreWriteError,
    isPending: isScoreSubmitting,
    writeContract: writeReplayScore
  } = useWriteContract();

  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } = useWaitForTransactionReceipt({
    hash: claimHash,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(claimHash)
    }
  });

  const { isLoading: isScoreConfirming, isSuccess: isScoreConfirmed } = useWaitForTransactionReceipt({
    hash: scoreHash,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(scoreHash)
    }
  });

  const paperStateKey = getPaperStateKey(address);
  const replaySessionKey = getReplaySessionKey(address);
  const progressStorageKey = getProgressStorageKey(address);
  const replayClaimCacheKey = getReplayClaimCacheKey(address);
  const replayScoreLogKey = getReplayScoreLogKey(address);
  const tradeOutcomeHistoryKey = getTradeOutcomeHistoryKey(address);

  useEffect(() => {
    setPaperState(readStoredPaperState(address));
    const nextTradeOutcomeHistory = readStoredTradeOutcomeHistory(address);
    setTradeOutcomeHistory(nextTradeOutcomeHistory);
    tradeOutcomeHistoryRef.current = nextTradeOutcomeHistory;
    setProductViews(readStoredReplaySession(address));
  }, [paperStateKey, replaySessionKey]);

  useEffect(() => {
    if (!address) {
      setWealthDeskState(buildDefaultWealthDeskState());
      return;
    }

    setWealthDeskState(readStoredWealthDeskState(address));
  }, [address]);

  useEffect(() => {
    const storedProgress = readStorageJson(progressStorageKey, {
      viewedRiskCards: [],
      guideCompleted: false,
      quizCompleted: false,
      paperTradesCompleted: 0,
      homeOnboardingCompleted: false,
      paperUnlocked: false,
      adminUnlocked: false,
      spotLessonCompleted: false,
      leverageLessonCompleted: false,
      hedgeLessonCompleted: false,
      hedgeSizingCompleted: false,
      hedgePositiveCloseCompleted: false,
      strategyLessonCompleted: false,
      strategyExampleCompleted: false,
      strategyAiTemplateCompleted: false,
      strategyLeaderboardUploaded: false
    });
    const profileProgress = readWalletProfile(address).progress;
    setProgressState({
      ...storedProgress,
      viewedRiskCards: storedProgress.viewedRiskCards?.length ? storedProgress.viewedRiskCards : profileProgress.viewedRiskCards || [],
      guideCompleted: Boolean(storedProgress.guideCompleted || profileProgress.guideCompleted),
      quizCompleted: Boolean(storedProgress.quizCompleted || profileProgress.quizCompleted),
      paperTradesCompleted: Math.max(Number(storedProgress.paperTradesCompleted || 0), Number(profileProgress.paperTradesCompleted || 0)),
      homeOnboardingCompleted: Boolean(storedProgress.homeOnboardingCompleted || profileProgress.homeOnboardingCompleted),
      paperUnlocked: Boolean(storedProgress.paperUnlocked || profileProgress.paperUnlocked),
      adminUnlocked: Boolean(storedProgress.adminUnlocked || profileProgress.adminUnlocked || readStorageJson(getAdminUnlockStorageKey(address), false)),
      spotLessonCompleted: Boolean(storedProgress.spotLessonCompleted || profileProgress.spotLessonCompleted),
      leverageLessonCompleted: Boolean(storedProgress.leverageLessonCompleted || profileProgress.leverageLessonCompleted),
      hedgeLessonCompleted: Boolean(storedProgress.hedgeLessonCompleted || profileProgress.hedgeLessonCompleted),
      hedgeSizingCompleted: Boolean(storedProgress.hedgeSizingCompleted || profileProgress.hedgeSizingCompleted),
      hedgePositiveCloseCompleted: Boolean(storedProgress.hedgePositiveCloseCompleted || profileProgress.hedgePositiveCloseCompleted),
      strategyLessonCompleted: Boolean(storedProgress.strategyLessonCompleted || profileProgress.strategyLessonCompleted),
      strategyExampleCompleted: Boolean(storedProgress.strategyExampleCompleted || profileProgress.strategyExampleCompleted),
      strategyAiTemplateCompleted: Boolean(storedProgress.strategyAiTemplateCompleted || profileProgress.strategyAiTemplateCompleted),
      strategyLeaderboardUploaded: Boolean(storedProgress.strategyLeaderboardUploaded || profileProgress.strategyLeaderboardUploaded)
    });
  }, [address, progressStorageKey]);

  useEffect(() => {
    function refreshDeveloperOverride() {
      setDeveloperOverride(Boolean(readStorageJson(getAdminUnlockStorageKey(address), false)));
    }

    refreshDeveloperOverride();
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('storage', refreshDeveloperOverride);
    return () => window.removeEventListener('storage', refreshDeveloperOverride);
  }, [address]);

  useEffect(() => {
    const normalizedClaimCache = normalizeReplayClaimCache(
      readStorageJson(replayClaimCacheKey, defaultReplayClaimCache(address)),
      address
    );
    setReplayClaimCache(normalizedClaimCache);
    writeStorageJson(replayClaimCacheKey, normalizedClaimCache);
  }, [address, replayClaimCacheKey]);

  useEffect(() => {
    if (!address) {
      setWalletNickname('');
      setWalletNicknameDraft('');
      return;
    }

    const storedNickname = readWalletNickname(address);
    setWalletNickname(storedNickname);
    setWalletNicknameDraft(storedNickname);
  }, [address]);

  useEffect(() => {
    setProfileBackupStatus('');
  }, [connectedAddressKey]);

  useEffect(() => {
    if (!profileBackupAccounts.length) {
      setSelectedProfileBackupAddress('');
      return;
    }

    setSelectedProfileBackupAddress((current) => {
      const currentStillExists = current && profileBackupAccounts.some((account) => account.address === current);
      if (currentStillExists) return current;

      const currentWalletBackup = connectedAddressKey
        ? profileBackupAccounts.find((account) => account.address === connectedAddressKey)
        : null;
      return currentWalletBackup?.address || profileBackupAccounts[0].address;
    });
  }, [connectedAddressKey, profileBackupAccounts]);

  useEffect(() => {
    if (!address || pendingWalletNickname === null) return;

    const savedNickname = writeWalletNickname(address, pendingWalletNickname);
    setWalletNickname(savedNickname);
    setWalletNicknameDraft(savedNickname);
    setWalletNicknameFeedback(savedNickname ? `Nickname saved as ${savedNickname}.` : 'Nickname cleared.');
    setPendingWalletNickname(null);
  }, [address, pendingWalletNickname]);

  useEffect(() => {
    const mergedArchive = buildStoredReplayLeaderboardArchive();
    setReplayLeaderboardArchive(mergedArchive);
    writeStorageJson(REPLAY_LEADERBOARD_ARCHIVE_KEY, mergedArchive);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function refreshReplayLeaderboardFromStorage(event) {
      if (
        event?.key &&
        event.key !== REPLAY_LEADERBOARD_ARCHIVE_KEY &&
        !event.key.startsWith('msx-paper-replay-score-log-')
      ) {
        return;
      }

      const mergedArchive = buildStoredReplayLeaderboardArchive();
      setReplayLeaderboardArchive(mergedArchive);

      const normalizedLog = normalizeReplayScoreLog(
        readStorageJson(replayScoreLogKey, defaultReplayScoreLog()),
        address ? address.toLowerCase() : 'guest'
      );
      setScoreSubmissionLog(normalizedLog);
    }

    window.addEventListener('storage', refreshReplayLeaderboardFromStorage);
    return () => window.removeEventListener('storage', refreshReplayLeaderboardFromStorage);
  }, [address, replayScoreLogKey]);

  useEffect(() => {
    const normalizedLog = normalizeReplayScoreLog(
      readStorageJson(replayScoreLogKey, defaultReplayScoreLog()),
      address ? address.toLowerCase() : 'guest'
    );
    setScoreSubmissionLog(normalizedLog);
    writeStorageJson(replayScoreLogKey, normalizedLog);
  }, [address, replayScoreLogKey]);

  useEffect(() => {
    const normalizedPaperState = normalizePaperState(paperState);
    writeStorageJson(paperStateKey, normalizedPaperState);
    if (address) {
      writeWalletProfilePatch(address, {
        progress: progressState,
        paper: {
          state: normalizedPaperState,
          tradeOutcomeHistory: normalizeTradeOutcomeHistory(tradeOutcomeHistory)
        }
      });
    }
  }, [address, paperState, paperStateKey, progressState, tradeOutcomeHistory]);

  useEffect(() => {
    tradeOutcomeHistoryRef.current = tradeOutcomeHistory;
    writeStorageJson(tradeOutcomeHistoryKey, normalizeTradeOutcomeHistory(tradeOutcomeHistory));
  }, [tradeOutcomeHistory, tradeOutcomeHistoryKey]);

  useEffect(() => {
    writeStorageJson(replaySessionKey, serializeProductViews(productViews));
  }, [productViews, replaySessionKey]);

  useEffect(() => () => {
    if (tradeOutcomeBurstTimerRef.current) {
      clearTimeout(tradeOutcomeBurstTimerRef.current);
    }
  }, []);

  useEffect(() => {
    writeStorageJson(replayClaimCacheKey, normalizeReplayClaimCache(replayClaimCache, address));
  }, [address, replayClaimCache, replayClaimCacheKey]);

  useEffect(() => {
    writeStorageJson(replayScoreLogKey, scoreSubmissionLog);
  }, [replayScoreLogKey, scoreSubmissionLog]);

  useEffect(() => {
    const confirmedSubmissions = scoreSubmissionLog.submissions
      .map((submission) => normalizeReplayScoreSubmission(submission, address))
      .filter((submission) => submission && submission.status === 'confirmed')
      .map((submission) => ({
        ...submission,
        hallOfFame: true,
        status: 'confirmed'
      }));

    if (!confirmedSubmissions.length) return;

    setReplayLeaderboardArchive((current) => {
      const nextEntries = mergeReplayLeaderboardSubmissions(current.entries, confirmedSubmissions);
      return replaySubmissionListsMatch(current.entries, nextEntries) ? current : { entries: nextEntries };
    });
  }, [address, scoreSubmissionLog]);

  useEffect(() => {
    writeStorageJson(REPLAY_LEADERBOARD_ARCHIVE_KEY, replayLeaderboardArchive);
  }, [replayLeaderboardArchive]);

  const selectedProduct = productMap[selectedProductId] || REPLAY_PRODUCTS[0];
  const selectedView = productViews[selectedProductId];
  const selectedRangeOptions = getRangeOptionsForInterval(selectedView?.interval || selectedProduct.defaultInterval);
  const learnMoreProduct = learnMoreProductId ? productMap[learnMoreProductId] || getProductById(learnMoreProductId) : null;
  const learnMoreProductGuide = useMemo(
    () => (learnMoreProduct ? getReplayProductGuide(learnMoreProduct) : null),
    [learnMoreProduct]
  );
  const selectedInsight = useMemo(
    () => PAPER_PRODUCT_INSIGHTS[selectedProductId] || buildFallbackProductInsight(selectedProduct),
    [selectedProduct, selectedProductId]
  );
  const selectedProductGuide = useMemo(() => getReplayProductGuide(selectedProduct), [selectedProduct]);
  const selectedPaperDiligenceProduct = useMemo(
    () => buildPaperDiligenceProduct(selectedProduct, selectedInsight, selectedProductGuide),
    [selectedProduct, selectedInsight, selectedProductGuide]
  );
  const selectedPaperDiligenceReport = useMemo(
    () => buildDiligenceReport({ product: selectedPaperDiligenceProduct, context: 'paper' }),
    [selectedPaperDiligenceProduct]
  );

  function ensureReplayProductViewLoaded(productId, product, view) {
    if (!view) return;
    if (!canUseRemoteReplay(product)) return;

    const remoteSignature = `${view.interval}-${view.range}`;
    if (
      view.remoteSignature === remoteSignature &&
      (view.status === 'fetching' || (Array.isArray(view.bars) && view.bars.length) || Boolean(view.error))
    ) {
      return;
    }

    setProductViews((current) => {
      const currentView = current[productId];
      if (!currentView) return current;

      const nextSignature = `${currentView.interval}-${currentView.range}`;
      if (
        currentView.remoteSignature === nextSignature &&
        (currentView.status === 'fetching' || (Array.isArray(currentView.bars) && currentView.bars.length) || Boolean(currentView.error))
      ) {
        return current;
      }

      return {
        ...current,
        [productId]: {
          ...currentView,
          status: 'fetching',
          error: '',
          remoteSignature: nextSignature
        }
      };
    });

    fetchRemoteReplayBars(product, view.interval, view.range)
      .then(({ bars, sourceLabel }) => {
        setProductViews((current) => {
          const currentView = current[productId];
          const expectedSignature = `${view.interval}-${view.range}`;

          if (!currentView || currentView.remoteSignature !== expectedSignature) {
            return current;
          }

          const cursor = Math.min(currentView.cursor, Math.max(0, bars.length - 1));

          return {
            ...current,
            [productId]: {
              ...currentView,
              bars,
              cursor,
              status: 'ready',
              sourceLabel,
              error: '',
              remoteSignature: expectedSignature
            }
          };
        });
      })
      .catch((error) => {
        setProductViews((current) => {
          const currentView = current[productId];
          const expectedSignature = `${view.interval}-${view.range}`;

          if (!currentView || currentView.remoteSignature !== expectedSignature) {
            return current;
          }

          return {
            ...current,
            [productId]: {
              ...currentView,
              status: product.sourceType === 'local' ? 'ready' : 'fallback',
              error: error.message,
              sourceLabel: getReplayFallbackLabel(product),
              remoteSignature: expectedSignature
            }
          };
        });
      });
  }

  useEffect(() => {
    if (!selectedView) return;
    ensureReplayProductViewLoaded(selectedProductId, selectedProduct, selectedView);
  }, [selectedProduct, selectedProductId, selectedView]);

  useEffect(() => {
    if (!selectedView || !isPlaying || !selectedView.replayStarted) return;

    if (selectedView.cursor >= selectedView.bars.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setProductViews((current) => ({
        ...current,
        [selectedProductId]: {
          ...current[selectedProductId],
          cursor: Math.min(current[selectedProductId].cursor + 1, current[selectedProductId].bars.length - 1)
        }
      }));
    }, DEFAULT_REPLAY_PLAYBACK_MS);

    return () => window.clearTimeout(timer);
  }, [isPlaying, selectedProductId, selectedView]);

  const localDeveloperOverride = Boolean(developerOverride || progressState.adminUnlocked);
  const welcomeGateCompleted = localDeveloperOverride || (badgeContractConfigured ? Boolean(hasMintedBadgeOnchain) : Boolean(isConnected));
  const completedRewards = [
    isConnected,
    welcomeGateCompleted,
    progressState.guideCompleted,
    progressState.quizCompleted,
    progressState.paperTradesCompleted > 0
  ].filter(Boolean).length;
  const rewardCredit = completedRewards * BADGE_REWARD_TOKENS;
  const availableCash = paperState.cash + rewardCredit;
  const walletProfileSummary = getWalletProfileSummary({
    ...readWalletProfile(address),
    progress: progressState,
    paper: {
      state: paperState,
      tradeOutcomeHistory
    }
  });
  const remainingPaperTokens = walletProfileSummary.remainingPT;
  const simulationRiskPreference = productRiskFilter === 'all' ? 'balanced' : productRiskFilter;
  const allowLockup = productLockupFilter !== 'flex';
  const acceptPrincipalVolatility = true;

  const filteredProducts = useMemo(
    () =>
      REPLAY_PRODUCTS.filter((product) => {
        if (product.lane !== selectedLane) return false;
        const guide = getReplayProductGuide(product);
        if (productRiskFilter !== 'all' && getReplayRiskFit(product) !== productRiskFilter) return false;
        if (productLockupFilter !== 'all' && getReplayLockupFit(guide) !== productLockupFilter) return false;
        return true;
      }),
    [productLockupFilter, productRiskFilter, selectedLane]
  );
  const selectedLaneLabel = REPLAY_LANE_OPTIONS.find((lane) => lane.id === selectedLane)?.label || 'Products';
  const paperShelfPageCount = Math.max(1, Math.ceil(filteredProducts.length / PAPER_SHELF_PAGE_SIZE));
  const paperShelfHasMultiplePages = paperShelfPageCount >= 2;
  const paperShelfPageEnd = Math.min(filteredProducts.length, paperShelfPage * PAPER_SHELF_PAGE_SIZE);
  const paperShelfRemainingCount = Math.max(0, filteredProducts.length - paperShelfPageEnd);
  const paperShelfNextCount = paperShelfPage < paperShelfPageCount ? Math.min(PAPER_SHELF_PAGE_SIZE, paperShelfRemainingCount) : 0;
  const pagedProducts = filteredProducts.slice(
    (paperShelfPage - 1) * PAPER_SHELF_PAGE_SIZE,
    paperShelfPage * PAPER_SHELF_PAGE_SIZE
  );
  const replayFillsPageCount = Math.max(1, Math.ceil(paperState.trades.length / PAPER_REPLAY_FILLS_PAGE_SIZE));
  const replayFillsHasMultiplePages = replayFillsPageCount >= 2;
  const replayFillsPageStart = (replayFillsPage - 1) * PAPER_REPLAY_FILLS_PAGE_SIZE;
  const replayFillsPageEnd = Math.min(paperState.trades.length, replayFillsPage * PAPER_REPLAY_FILLS_PAGE_SIZE);
  const replayFillsRemainingCount = Math.max(0, paperState.trades.length - replayFillsPageEnd);
  const replayFillsNextCount =
    replayFillsPage < replayFillsPageCount ? Math.min(PAPER_REPLAY_FILLS_PAGE_SIZE, replayFillsRemainingCount) : 0;
  const pagedReplayFills = paperState.trades.slice(replayFillsPageStart, replayFillsPageEnd);
  const shelfLeaderboardRows = useMemo(() => {
    const baseRows = filteredProducts.map((product) => {
      const guide = getReplayProductGuide(product);
      const insight = PAPER_PRODUCT_INSIGHTS[product.id] || buildFallbackProductInsight(product);
      const diligenceReport = buildDiligenceReport({
        product: buildPaperDiligenceProduct(product, insight, guide),
        context: 'paper'
      });
      const aiScore = clamp(Math.round(Number(diligenceReport.productQuality.score || insight.diligenceScore || 0)), 0, 100);
      const earnRate = Math.max(0, Number(guide.targetYieldRate ?? sumRates(guide.yieldSources || [])));
      const annualDragRate = Math.max(
        0,
        sumRates((guide.feeBlueprint || []).filter((row) => row.type === 'annual'))
      );
      const netEarnRate = Math.max(0, earnRate - annualDragRate);

      return {
        product,
        guide,
        aiScore,
        earnRate,
        annualDragRate,
        netEarnRate
      };
    });

    if (!baseRows.length) return [];

    const maxNetEarnRate = Math.max(...baseRows.map((row) => row.netEarnRate));
    const minNetEarnRate = Math.min(...baseRows.map((row) => row.netEarnRate));

    return baseRows
      .map((row) => {
        const earnScore =
          maxNetEarnRate === minNetEarnRate
            ? 78
            : Math.round(60 + ((row.netEarnRate - minNetEarnRate) / Math.max(0.0001, maxNetEarnRate - minNetEarnRate)) * 35);
        const combinedScore = Math.round(row.aiScore * 0.62 + earnScore * 0.38);

        return {
          ...row,
          earnScore: clamp(earnScore, 0, 100),
          combinedScore
        };
      })
      .sort((left, right) => {
        if (right.combinedScore !== left.combinedScore) return right.combinedScore - left.combinedScore;
        if (right.aiScore !== left.aiScore) return right.aiScore - left.aiScore;
        if (right.netEarnRate !== left.netEarnRate) return right.netEarnRate - left.netEarnRate;
        return left.product.name.localeCompare(right.product.name);
      });
  }, [filteredProducts]);

  useEffect(() => {
    pagedProducts.forEach((product) => {
      const view = productViews[product.id];
      ensureReplayProductViewLoaded(product.id, product, view);
    });
  }, [pagedProducts, productViews]);

  useEffect(() => {
    Object.keys(paperState.positions || {}).forEach((productId) => {
      const product = productMap[productId];
      if (!product) return;
      ensureReplayProductViewLoaded(productId, product, productViews[productId]);
    });
  }, [paperState.positions, productMap, productViews]);

  useEffect(() => {
    if (!filteredProducts.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(filteredProducts[0]?.id || REPLAY_PRODUCTS[0].id);
    }
  }, [filteredProducts, selectedProductId]);

  useEffect(() => {
    if (paperShelfPage > paperShelfPageCount) {
      setPaperShelfPage(paperShelfPageCount);
    }
  }, [paperShelfPage, paperShelfPageCount]);

  useEffect(() => {
    const tradeCount = paperState.trades.length;

    if (tradeCount > replayFillsCountRef.current) {
      setReplayFillsPage(replayFillsPageCount);
    } else if (replayFillsPage > replayFillsPageCount) {
      setReplayFillsPage(replayFillsPageCount);
    }

    replayFillsCountRef.current = tradeCount;
  }, [paperState.trades.length, replayFillsPage, replayFillsPageCount]);

  useEffect(() => {
    if (!pagedProducts.length) return;
    if (!pagedProducts.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(pagedProducts[0].id);
    }
  }, [pagedProducts, selectedProductId]);

  useEffect(() => {
    setPaperShelfPage(1);
  }, [selectedLane, productRiskFilter, productLockupFilter]);

  useEffect(() => {
    if (!timedExitRangeToast) return undefined;
    const timer = window.setTimeout(() => setTimedExitRangeToast(''), 1800);
    return () => window.clearTimeout(timer);
  }, [timedExitRangeToast]);

  useEffect(() => {
    if (!replayDeskToast?.message) return undefined;
    const timer = window.setTimeout(() => setReplayDeskToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [replayDeskToast]);

  function showReplayDeskToast(message) {
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) return;
    setReplayDeskToast({
      id: Date.now(),
      message: cleanMessage
    });
  }

  const portfolioRows = useMemo(
    () =>
      Object.entries(paperState.positions)
        .map(([productId, position]) => {
          const product = productMap[productId];
          if (!product) return null;

          const view = productViews[productId];
          const markPrice =
            view?.bars?.[Math.min(view.cursor, Math.max(0, (view.bars?.length || 1) - 1))]?.close ||
            position.avgEntry ||
            product.fallback.price;
          const currentTs = view?.bars?.[Math.min(view.cursor, Math.max(0, (view.bars?.length || 1) - 1))]?.ts;
          const snapshot = buildPositionSnapshot(product, position, markPrice, currentTs);

          return {
            ...product,
            ...position,
            markPrice,
            marketValue: snapshot.grossValue,
            unrealizedPnl: snapshot.grossPnl,
            netExitValue: snapshot.netExitValue,
            netPnl: snapshot.netPnl,
            holdingDays: snapshot.holdingDays,
            unpaidCarry: snapshot.unpaidCarry,
            managementFee: snapshot.managementFee,
            exitCosts: snapshot.exitCosts
          };
        })
        .filter(Boolean),
    [paperState.positions, productMap, productViews]
  );

  const totalMarketValue = portfolioRows.reduce((sum, row) => sum + row.marketValue, 0);
  const totalUnrealizedPnl = portfolioRows.reduce((sum, row) => sum + row.unrealizedPnl, 0);
  const totalNetExitValue = portfolioRows.reduce((sum, row) => sum + row.netExitValue, 0);
  const totalNetPnl = portfolioRows.reduce((sum, row) => sum + row.netPnl, 0);
  const totalRealizedPnl = roundNumber(Number(paperState.realizedPnl || 0), 2);
  const linkedWalletCash = isConnected ? roundNumber(Number(wealthDeskState.wealthCash || 0), 2) : 0;
  const strategyAccountValue = roundNumber(STARTING_PAPER_TOKENS + totalRealizedPnl + totalNetPnl, 2);
  const accountValue = roundNumber(availableCash + totalNetExitValue + linkedWalletCash, 2);
  const guideReady =
    Boolean(progressState.guideCompleted) ||
    (progressState.viewedRiskCards?.length || 0) >= 3 ||
    Boolean(riskBadgeOnchain);
  const walletIdentityInherited = Boolean(isConnected && address);
  const homeOnboardingInherited = Boolean(
    progressState.homeOnboardingCompleted ||
      progressState.paperUnlocked ||
      localDeveloperOverride
  );
  const onboardingReady =
    isConnected &&
    (homeOnboardingInherited || (welcomeGateCompleted && guideReady));
  const closedTradeCount = paperState.trades.filter((trade) => trade.side === 'sell').length;
  const replayScoreValue = roundNumber(totalRealizedPnl + totalNetPnl, 2);
  const replayScorePercent = STARTING_PAPER_TOKENS > 0 ? roundNumber((replayScoreValue / STARTING_PAPER_TOKENS) * 100, 2) : 0;
  const replayTradeUsedLocally = Number(progressState.paperTradesCompleted || 0) > 0 || paperState.trades.length > 0;
  const scoreReadyLocally = closedTradeCount > 0 && replayScoreValue > 0;
  const positiveHedgeCloseSeen = tradeOutcomeHistory.entries.some(
    (entry) =>
      (entry.routeId === 'hedge' || String(entry.actionLabel || '').toLowerCase().includes('hedge')) &&
      Number(entry.pnl || 0) > 0
  );
  const leaderboardUsedLocally = Boolean(hasSubmittedReplayScoreOnchain) || isScoreConfirmed;
  const firstReplayTrade = paperState.trades[paperState.trades.length - 1] || null;
  const latestScoreSubmission = scoreSubmissionLog.submissions?.[0] || null;
  const scoreSubmissionsToday = scoreSubmissionLog.submissions.filter(
    (submission) => getReplayDayKey(submission.submittedAt) === getReplayDayKey(new Date().toISOString())
  ).length;
  const scoreSubmissionSlotsLeft = Math.max(0, REPLAY_SCORE_DAILY_LIMIT - scoreSubmissionsToday);
  const onSepolia = chainId === SEPOLIA_CHAIN_ID;
  const hasSepoliaGas = Boolean(sepoliaBalance?.value && sepoliaBalance.value > 0n);
  const replayOnchainStateById = useMemo(() => {
    const currentWalletCacheAddress = getWalletCacheAddress(address);
    const cacheMatchesWallet = replayClaimCache.walletAddress === currentWalletCacheAddress;
    const cachedClaimedIds = new Set(cacheMatchesWallet ? replayClaimCache.claimedIds || [] : []);
    const defaultState = Object.fromEntries(
      REPLAY_ACHIEVEMENT_IDS.map((achievementId) => [
        achievementId,
        {
          onchainClaimed: cachedClaimedIds.has(achievementId)
        }
      ])
    );

    if (!replayClaimReadData?.length) return defaultState;

    REPLAY_ACHIEVEMENT_IDS.forEach((achievementId, index) => {
      const balanceResult = replayClaimReadData[index]?.result;

      defaultState[achievementId] = {
        onchainClaimed: Number(balanceResult || 0n) > 0 || cachedClaimedIds.has(achievementId)
      };
    });

    return defaultState;
  }, [address, replayClaimCache, replayClaimReadData]);
  const baseReplayClaimed = Boolean(replayOnchainStateById[REPLAY_BADGE_TYPES.baseCheck]?.onchainClaimed);
  const leaderboardReplayClaimed = Boolean(replayOnchainStateById[REPLAY_BADGE_TYPES.leaderboard]?.onchainClaimed);
  const replayTradeUsed = replayTradeUsedLocally || baseReplayClaimed || leaderboardReplayClaimed;
  const scoreReady = scoreReadyLocally || leaderboardReplayClaimed;
  const leaderboardUsed = leaderboardUsedLocally || leaderboardReplayClaimed;
  const spotBuySeen = paperState.trades.some((trade) => trade.side === 'buy');
  const spotSellSeen = paperState.trades.some((trade) => trade.side === 'sell');
  const spotLoopUsed = Boolean(progressState.spotLessonCompleted) || (spotBuySeen && spotSellSeen);
  const leverageRouteUsed =
    Boolean(progressState.leverageLessonCompleted) ||
    Boolean(replayOnchainStateById[REPLAY_BADGE_TYPES.perpLeverage]?.onchainClaimed);
  const hedgeRouteUsed =
    (Boolean(progressState.hedgeLessonCompleted) && Boolean(progressState.hedgeSizingCompleted)) ||
    Boolean(progressState.hedgePositiveCloseCompleted) ||
    positiveHedgeCloseSeen;
  const strategyTemplateClaimed = Boolean(replayOnchainStateById[REPLAY_BADGE_TYPES.protectiveHedge]?.onchainClaimed);
  const leverageHedgeTrainingUsed =
    Boolean(progressState.leverageLessonCompleted && progressState.hedgeLessonCompleted) ||
    Boolean(progressState.hedgeLessonCompleted && progressState.hedgeSizingCompleted);
  const strategyExampleSeen = tradeOutcomeHistory.entries.some((entry) =>
    String(entry.actionLabel || '').toLowerCase().includes('settle')
  );
  const strategyBoardHasCurrentWallet = (strategyTemplateLeaderboard.entries || []).some((entry) => {
    const normalizedEntryWallet = String(entry.walletAddress || '').toLowerCase();
    const normalizedCurrentWallet = address ? address.toLowerCase() : 'guest';
    return normalizedEntryWallet === normalizedCurrentWallet;
  });
  const strategyRouteUsed =
    strategyTemplateClaimed ||
    (Boolean(progressState.strategyExampleCompleted || strategyExampleSeen) &&
      Boolean(progressState.strategyAiTemplateCompleted || strategyBoardHasCurrentWallet) &&
      Boolean(progressState.strategyLeaderboardUploaded || strategyBoardHasCurrentWallet));
  const wealthReceiptPledged = Number(wealthDeskState?.pledgedProducts || 0) > 0;
  const settleOrPledgeUsed = spotSellSeen || wealthReceiptPledged || hedgeRouteUsed;
  const replayAccountLeaderboardRows = useMemo(() => {
    return mergeReplayLeaderboardSubmissions(
      readAllReplayScoreLogs(),
      replayLeaderboardArchive.entries
    ).map((submission) => ({
      walletAddress: submission.walletAddress,
      displayAddress: shortAddressWithNickname(submission.walletAddress),
      submittedAt: submission.submittedAt,
      netPnl: submission.netPnl,
      pnlPercent: submission.pnlPercent,
      accountValue: submission.accountValue,
      tradeCount: submission.tradeCount,
      tradeLabel: submission.tradeLabel,
      tradeShortLabel: submission.tradeShortLabel,
      status: submission.status,
      hallOfFame: Boolean(submission.hallOfFame)
    }));
  }, [address, replayLeaderboardArchive, scoreSubmissionLog, walletNickname]);
  const topReplayAccountLeaderboardRows = replayAccountLeaderboardRows.slice(0, 8);
  const baseTradeSummary = buildReplayTradeSummary(firstReplayTrade);
  const leaderboardCoverSnapshot = latestScoreSubmission || buildReplayScoreSnapshot({
    trades: paperState.trades,
    netPnl: replayScoreValue,
    accountValue: strategyAccountValue,
    walletAddress: address
  });
  const selectedProductRoutePlaybook = PRODUCT_ROUTE_PLAYBOOKS[selectedProduct.lane] || PRODUCT_ROUTE_PLAYBOOKS.public;
  const selectedProductDisclosureRows = getPaperProductDisclosureRows(selectedProduct, selectedProductGuide, selectedAdvancedRoute);
  const selectedAssetLayerLabel = getPaperAssetLayerLabel(selectedProduct);
  const availableReplayRoutes = ADVANCED_REPLAY_ROUTES.filter((route) =>
    selectedProductRoutePlaybook.routes.includes(route.id) && !HIDDEN_LEARNING_ROUTE_IDS.has(route.id)
  );
  const selectedAdvancedRouteConfig =
    availableReplayRoutes.find((route) => route.id === selectedAdvancedRoute) || availableReplayRoutes[0] || ADVANCED_REPLAY_ROUTES[0];
  const selectedRouteUi = getReplayRouteUi(selectedAdvancedRouteConfig?.id || selectedAdvancedRoute);
  const visiblePerpFocusOptions = (REPLAY_ROUTE_FOCUS_OPTIONS.perp || []).filter((option) => !HIDDEN_PERP_FOCUS_IDS.has(option.id));
  const selectedRouteFocusOptions =
    selectedAdvancedRoute === 'perp'
      ? visiblePerpFocusOptions
      : REPLAY_ROUTE_FOCUS_OPTIONS[selectedAdvancedRoute] || [];
  const selectedRouteFocusConfig =
    selectedRouteFocusOptions.find((option) => option.id === selectedRouteFocusByRoute[selectedAdvancedRoute]) ||
    selectedRouteFocusOptions[0] ||
    null;
  const strategyRouteActive = selectedAdvancedRoute === 'borrow';
  const strategyAiRouteActive = selectedAdvancedRoute === 'strategy-ai';
  const strategyWorkspaceRouteActive = strategyRouteActive || strategyAiRouteActive;
  const comboFocusActive = selectedAdvancedRoute === 'perp' && selectedRouteFocusConfig?.id === 'combo';
  const selectedPerpFocusId = selectedRouteFocusConfig?.id || visiblePerpFocusOptions[0]?.id || 'leverage';
  const hedgeFocusActive =
    selectedAdvancedRoute === 'perp' &&
    selectedRouteFocusConfig?.id === 'hedge';
  const hedgeFocusProfile =
    hedgeFocusActive
      ? buildHedgeRouteProfile(selectedProduct, selectedInsight, selectedProductGuide)
      : null;
  const activeRouteFocusConfig = hedgeFocusProfile
    ? {
        ...selectedRouteFocusConfig,
        ...hedgeFocusProfile
      }
    : selectedRouteFocusConfig;

  useEffect(() => {
    if (!comboFocusActive) return;

    PORTFOLIO_COMBO_PRODUCT_IDS.forEach((productId) => {
      const product = productMap[productId];
      const view = productViews[productId];
      if (!product || !view) return;
      ensureReplayProductViewLoaded(productId, product, view);
    });
  }, [comboFocusActive, productMap, productViews]);
  const selectedStrategyTemplateId = OPTION_STRATEGY_DEFAULTS[selectedOptionStrategyTemplateId]
    ? selectedOptionStrategyTemplateId
    : 'collar';
  const strategyControlValues = useMemo(
    () =>
      normalizeOptionStrategyControls(
        {
          downsidePct: strategyDownsidePct,
          profitHarvestPct: strategyProfitHarvestPct,
          upsideCapPct: strategyUpsideCapPct,
          premiumPct: strategyPremiumPct,
          strikePct: strategyStrikePct
        },
        selectedStrategyTemplateId
      ),
    [selectedStrategyTemplateId, strategyDownsidePct, strategyPremiumPct, strategyProfitHarvestPct, strategyStrikePct, strategyUpsideCapPct]
  );
  const strategyParameterLabels =
    OPTION_STRATEGY_PARAMETER_LABELS[selectedStrategyTemplateId] || OPTION_STRATEGY_PARAMETER_LABELS.default;
  const selectedRouteLessonLines = activeRouteFocusConfig?.lessons?.length
    ? activeRouteFocusConfig.lessons
    : selectedAdvancedRouteConfig.lessons;
  const replayTaskGateOpen = onboardingReady && spotBuySeen;
  const replayDeveloperModeActive = REPLAY_DEVELOPER_MODE || localDeveloperOverride;
  const advancedRoutesUnlocked = replayDeveloperModeActive || replayTaskGateOpen;
  const advancedActivityEnabled = replayDeveloperModeActive || replayTaskGateOpen;
  const isReplayRouteLocked = (routeId) => routeId !== 'spot' && !advancedRoutesUnlocked;
  const learningRouteOptions = availableReplayRoutes.flatMap((route) => {
    const actionLocked = isReplayRouteLocked(route.id);
    const routeUi = getReplayRouteUi(route.id);

    if (route.id === 'perp') {
      return visiblePerpFocusOptions.map((focus) => ({
        value: `perp:${focus.id}`,
        routeId: route.id,
        focusId: focus.id,
        label: focus.label,
        helperLabel: focus.label,
        glyph: routeUi.glyph,
        actionTag: routeUi.actionTag,
        actionLocked
      }));
    }

    return [
      {
        value: route.id,
        routeId: route.id,
        focusId: null,
        label: route.label,
        helperLabel: routeUi.helperLabel,
        glyph: routeUi.glyph,
        actionTag: routeUi.actionTag,
        actionLocked
      }
    ];
  });
  const selectedLearningRouteValue = selectedAdvancedRoute === 'perp' ? `perp:${selectedPerpFocusId}` : selectedAdvancedRoute;
  const selectedLearningRouteOption =
    learningRouteOptions.find((option) => option.value === selectedLearningRouteValue) ||
    learningRouteOptions[0] ||
    null;
  const selectedRouteHelperLabel =
    selectedAdvancedRoute === 'perp'
      ? selectedRouteFocusConfig?.label || selectedRouteUi.helperLabel
      : selectedLearningRouteOption?.helperLabel || selectedRouteUi.helperLabel;
  const advancedRouteUnlockCopy = replayDeveloperModeActive
    ? 'Developer mode is on, so advanced replay tutorials stay open without replay task gating.'
    : advancedRoutesUnlocked
      ? 'Task 1 and Task 2 are both completed, so leverage, hedge, and options / strategy tutorials are now open.'
      : 'Complete and mint Task 1 plus Task 2 first. Until then the replay desk keeps only the simple spot low-buy / high-sell route open.';
  const advancedActivityUnlockCopy = replayDeveloperModeActive
    ? 'Developer mode is on, so timed exits, route templates, and advanced route actions stay available.'
    : advancedActivityEnabled
      ? 'Task 1 and Task 2 are both completed, so timed exits, hedge tickets, option templates, and guided short setup are available.'
      : 'Complete and mint Task 1 plus Task 2 first. Until then the desk keeps only the simple chart -> Buy -> Sell replay path open.';
  const routeAccessHint = `${selectedProductRoutePlaybook.summary} ${advancedRouteUnlockCopy}`;
  const replayLearningChecklist = selectedAdvancedRoute === 'spot'
    ? [
        {
          id: 'wallet',
          title: 'Use the same wallet route',
          copy: 'Carry the onboarding wallet into replay before you size the first spot trade.',
          done: walletIdentityInherited
        },
        {
          id: 'trade',
          title: 'Complete one replay buy or sell',
          copy: 'Low-buy / high-sell starts with one real replay fill, not just opening the page.',
          done: replayTradeUsed
        },
        {
          id: 'loop',
          title: 'Close one positive spot loop',
          copy: 'Use the first profitable loop to see the gap between gross and take-home net value.',
          done: scoreReady
        },
        {
          id: 'unlock',
          title: 'Unlock advanced tutorials',
          copy: replayDeveloperModeActive
            ? 'Developer mode keeps advanced routes open while the replay lab is still being built.'
            : 'Mint Task 1 and Task 2 first so the advanced product routes below stay tied to replay task completion.',
          done: advancedRoutesUnlocked
        }
      ]
    : [
        {
          id: 'wallet',
          title: 'Keep the same wallet identity',
          copy: 'Advanced labs still inherit the same wallet route and proof flow from onboarding.',
          done: walletIdentityInherited
        },
        {
          id: 'route-unlock',
          title: 'Route availability',
          copy: replayDeveloperModeActive
            ? 'Developer mode is open, so this route is available without replay task gating.'
            : isReplayRouteLocked(selectedAdvancedRoute)
              ? 'This route still needs Task 1 plus Task 2 to be completed and minted for this wallet.'
              : 'This route is already open for this wallet.',
          done: !isReplayRouteLocked(selectedAdvancedRoute)
        },
        {
          id: 'route',
          title: `Select ${selectedAdvancedRouteConfig.label}`,
          copy: `${activeRouteFocusConfig?.summary || selectedAdvancedRouteConfig.description} ${selectedProductRoutePlaybook.summary}`,
          done: !isReplayRouteLocked(selectedAdvancedRoute)
        },
        {
          id: 'lesson',
          title: 'Review the route lesson points',
          copy: selectedRouteLessonLines[0],
          done: !isReplayRouteLocked(selectedAdvancedRoute)
        },
        {
          id: 'tasks',
          title: replayDeveloperModeActive ? 'Developer override is active' : 'Task gate is active',
          copy: replayDeveloperModeActive
            ? 'This lab instance is in developer mode, so route gating is bypassed while the teaching flow is being built.'
            : 'Higher-risk replay routes now stay locked until this wallet has minted both replay collectibles for Task 1 and Task 2.',
          done: advancedActivityEnabled
        }
      ];

  const leaderboardWalletLabel = shortAddressWithNickname(leaderboardCoverSnapshot.walletAddress || address);

  const replayAchievements = useMemo(
    () =>
      buildReplayAchievements({
        onboardingReady,
        replayTradeUsed,
        leaderboardUsed,
        scoreReady,
        spotLoopUsed,
        leverageRouteUsed,
        hedgeRouteUsed,
        leverageHedgeTrainingUsed,
        strategyRouteUsed,
        spotBuySeen,
        settleOrPledgeUsed
      }).map((achievement) => {
        const onchainState = replayOnchainStateById[achievement.id] || {
          onchainClaimed: false
        };
        const effectiveUnlocked =
          achievement.unlocked ||
          onchainState.onchainClaimed ||
          (achievement.id === REPLAY_BADGE_TYPES.baseCheck && leaderboardReplayClaimed);
        const effectiveInherited =
          Boolean(achievement.inherited) ||
          effectiveUnlocked ||
          onchainState.onchainClaimed;
        const resolvedAchievement = {
          ...achievement,
          inherited: effectiveInherited,
          unlocked: effectiveUnlocked,
          ...onchainState
        };
        const claimMeta = getReplayAchievementClaimMeta({
          achievement: resolvedAchievement,
          replayBadgeConfigured: replayBadgeContractConfigured,
          ...onchainState
        });
        const coverMeta =
          achievement.id === REPLAY_BADGE_TYPES.baseCheck
            ? {
                coverAccent: 'green',
                coverKicker: 'RiskLens Replay Usage',
                coverTitle: effectiveUnlocked || onchainState.onchainClaimed ? 'PAPER USAGE VERIFIED' : 'HOME GATE INHERITED',
                coverSubtitle: effectiveUnlocked || onchainState.onchainClaimed
                  ? baseTradeSummary.timestamp
                    ? `${formatReplayBadgeTimestamp(baseTradeSummary.timestamp)} / ${baseTradeSummary.shortLabel}`
                    : 'Use the same wallet and record the first replay fill.'
                  : 'Record one replay buy or sell to finish Base Check.',
                coverFooterLines: [
                  effectiveInherited ? 'Wallet route carried over' : 'Wallet route pending',
                  replayTradeUsed || onchainState.onchainClaimed
                    ? `${paperState.trades.length} replay fill${paperState.trades.length === 1 ? '' : 's'} recorded`
                    : 'No replay fill recorded yet',
                  baseTradeSummary.label
                ],
                coverStamp: 'R6'
              }
            : achievement.id === REPLAY_BADGE_TYPES.leaderboard
              ? {
                  coverAccent: 'teal',
                  coverKicker: 'RiskLens Leaderboard Score',
                  coverTitle: 'SCORE ROUTE VERIFIED',
                  coverSubtitle: leaderboardCoverSnapshot.submittedAt
                    ? `${formatReplayBadgeTimestamp(leaderboardCoverSnapshot.submittedAt)} / ${leaderboardWalletLabel}`
                    : 'Submit a positive replay score on Sepolia to stamp this collectible.',
                  coverFooterLines: [
                    `${formatSignedPercent(
                      Number.isFinite(leaderboardCoverSnapshot.pnlPercent) ? leaderboardCoverSnapshot.pnlPercent : replayScorePercent
                    )} replay PnL`,
                    `${leaderboardCoverSnapshot.tradeCount || paperState.trades.length} replay fill${
                      (leaderboardCoverSnapshot.tradeCount || paperState.trades.length) === 1 ? '' : 's'
                    }`,
                    `Wallet ${leaderboardWalletLabel}`
                  ],
                  coverStamp: 'R7'
                }
              : {
                  coverAccent:
                    achievement.id === REPLAY_BADGE_TYPES.spotLoop
                      ? 'green'
                      : achievement.id === REPLAY_BADGE_TYPES.perpLeverage
                        ? 'teal'
                        : 'gold',
                  coverKicker: `RiskLens Tutorial Task ${achievement.taskNumber}`,
                  coverTitle: achievement.coverCopy.toUpperCase(),
                  coverSubtitle: achievement.requirement,
                  coverFooterLines: [
                    effectiveUnlocked ? 'Tutorial action completed' : 'Tutorial action pending',
                    achievement.activityLabel,
                    selectedAssetLayerLabel
                  ],
                  coverStamp: `R${achievement.id}`
                };

        return {
          ...resolvedAchievement,
          ...coverMeta,
          ...claimMeta,
          canClaimOnchain: effectiveUnlocked && replayBadgeContractConfigured && !onchainState.onchainClaimed
        };
      }),
    [
      baseTradeSummary.label,
      baseTradeSummary.shortLabel,
      baseTradeSummary.timestamp,
      leaderboardCoverSnapshot.walletAddress,
      leaderboardCoverSnapshot.pnlPercent,
      leaderboardCoverSnapshot.submittedAt,
      leaderboardCoverSnapshot.tradeCount,
      leaderboardWalletLabel,
      leaderboardUsed,
      address,
      onboardingReady,
      paperState.trades.length,
      leaderboardReplayClaimed,
      replayBadgeContractConfigured,
      replayOnchainStateById,
      replayScorePercent,
      replayTradeUsed,
      scoreReady,
      selectedAssetLayerLabel,
      settleOrPledgeUsed,
      spotLoopUsed,
      spotBuySeen,
      leverageRouteUsed,
      hedgeRouteUsed,
      leverageHedgeTrainingUsed,
      strategyRouteUsed
    ]
  );
  const selectedRewardTask = replayAchievements.find((achievement) => achievement.id === selectedRewardTaskId) || null;
  const selectedRewardTaskChecklistItems = selectedRewardTask
    ? selectedRewardTask.id === REPLAY_BADGE_TYPES.baseCheck
      ? [
          {
            id: 'onboarding',
            title: 'Home-page onboarding inherited',
            statusText: walletIdentityInherited || selectedRewardTask.onchainClaimed ? 'Completed' : 'To do',
            statusTone: walletIdentityInherited || selectedRewardTask.onchainClaimed ? 'done' : 'todo',
            indicator: walletIdentityInherited || selectedRewardTask.onchainClaimed ? 'OK' : 'HOME',
            interactive: true,
            onClick: openWalletModal,
            copy:
              walletIdentityInherited || selectedRewardTask.onchainClaimed
                ? 'This wallet already matches the wallet task from the Home page, so the inheritance check is complete here.'
                : 'Connect the same wallet you used on the Home page. Once the wallet task is done there, this row completes automatically here.'
          },
          {
            id: 'usage',
            title: 'Replay buy / sell usage',
            statusText: replayTradeUsed || selectedRewardTask.onchainClaimed ? 'Completed' : 'To do',
            statusTone: replayTradeUsed || selectedRewardTask.onchainClaimed ? 'done' : 'todo',
            indicator: replayTradeUsed || selectedRewardTask.onchainClaimed ? 'USED' : 'TRADE',
            interactive: true,
            onClick: () => scrollToRef(productLanesRef),
            copy:
              replayTradeUsed || selectedRewardTask.onchainClaimed
                ? 'This wallet already used at least one replay buy or sell action, so the replay surface is recognized as completed.'
                : 'Place at least one replay buy or sell so the wallet proves it used the replay trading surface.'
          }
        ]
      : selectedRewardTask.id === REPLAY_BADGE_TYPES.leaderboard
        ? [
            {
              id: 'positive-loop',
              title: 'Positive replay result',
              statusText: scoreReady || leaderboardUsed || selectedRewardTask.onchainClaimed ? 'Completed' : 'To do',
              statusTone: scoreReady || leaderboardUsed || selectedRewardTask.onchainClaimed ? 'done' : 'todo',
              indicator: scoreReady || leaderboardUsed || selectedRewardTask.onchainClaimed ? 'GAIN' : 'TRADE',
              interactive: true,
              onClick: () => scrollToRef(productLanesRef),
              copy:
                scoreReady || leaderboardUsed || selectedRewardTask.onchainClaimed
                  ? 'A positive closed replay result already exists for this wallet.'
                  : 'Finish one positive replay trade loop before using the leaderboard route.'
            },
            {
              id: 'leaderboard',
              title: 'Leaderboard operation',
              statusText: leaderboardUsed || selectedRewardTask.onchainClaimed ? 'Completed' : 'To do',
              statusTone: leaderboardUsed || selectedRewardTask.onchainClaimed ? 'done' : 'todo',
              indicator: leaderboardUsed || selectedRewardTask.onchainClaimed ? 'USED' : 'LB',
              interactive: true,
              onClick: focusLeaderboardRouteCard,
              copy:
                leaderboardUsed || selectedRewardTask.onchainClaimed
                  ? 'This wallet already used the leaderboard submit action on Sepolia.'
                  : 'Submit the current replay score once on Sepolia so this badge represents a real leaderboard action.'
            }
          ]
        : selectedRewardTask.id === REPLAY_BADGE_TYPES.spotLoop
          ? [
              {
                id: 'spot-buy',
                title: 'Spot buy placed',
                statusText: spotBuySeen || selectedRewardTask.onchainClaimed ? 'Completed' : 'To do',
                statusTone: spotBuySeen || selectedRewardTask.onchainClaimed ? 'done' : 'todo',
                indicator: spotBuySeen || selectedRewardTask.onchainClaimed ? 'BUY' : 'BUY',
                interactive: true,
                onClick: () => scrollToRef(tradeDeskRef),
                copy: 'Click a replay bar, size a spot ticket, and press Buy so ownership-style wrapper exposure is created.'
              },
              {
                id: 'spot-sell',
                title: 'Spot sell placed',
                statusText: spotLoopUsed || selectedRewardTask.onchainClaimed ? 'Completed' : 'To do',
                statusTone: spotLoopUsed || selectedRewardTask.onchainClaimed ? 'done' : 'todo',
                indicator: spotLoopUsed || selectedRewardTask.onchainClaimed ? 'SELL' : 'SELL',
                interactive: true,
                onClick: () => scrollToRef(tradeDeskRef),
                copy: 'Move the replay cursor to a later bar and sell so the net PnL and take-home math appear.'
              }
            ]
          : selectedRewardTask.id === REPLAY_BADGE_TYPES.perpLeverage
            ? [
                {
                  id: 'combo-route-selected',
                  title: 'Leverage + hedge route opened',
                  statusText:
                    comboFocusActive || leverageHedgeTrainingUsed || selectedRewardTask.onchainClaimed
                      ? 'Completed'
                      : 'To do',
                  statusTone:
                    comboFocusActive || leverageHedgeTrainingUsed || selectedRewardTask.onchainClaimed
                      ? 'done'
                      : 'todo',
                  indicator:
                    comboFocusActive || leverageHedgeTrainingUsed || selectedRewardTask.onchainClaimed
                      ? 'COMBO'
                      : 'COMBO',
                  interactive: true,
                  onClick: () => handleSelectLearningRoute('perp:combo'),
                  copy:
                    comboFocusActive || leverageHedgeTrainingUsed || selectedRewardTask.onchainClaimed
                      ? 'The tutorial path is already on the leverage + hedge training route.'
                      : 'Open the Leverage + Hedge training route before treating leverage as a protected workflow.'
                },
                {
                  id: 'combo-sleeve',
                  title: 'Training sleeve defined',
                  statusText:
                    leverageHedgeTrainingUsed ||
                    progressState.hedgeLessonCompleted ||
                    comboFocusActive ||
                    selectedRewardTask.onchainClaimed
                      ? 'Completed'
                      : 'To do',
                  statusTone:
                    leverageHedgeTrainingUsed ||
                    progressState.hedgeLessonCompleted ||
                    comboFocusActive ||
                    selectedRewardTask.onchainClaimed
                      ? 'done'
                      : 'todo',
                  indicator: 'SLEEVE',
                  interactive: true,
                  onClick: () => handleSelectLearningRoute('perp:combo'),
                  copy:
                    'Load a practice example, click Start case, and buy or define the sleeve before opening the levered hedge.'
                },
                {
                  id: 'combo-hedge-leg',
                  title: 'Levered hedge leg opened',
                  statusText: leverageHedgeTrainingUsed || hedgeRouteUsed || selectedRewardTask.onchainClaimed ? 'Completed' : 'To do',
                  statusTone: leverageHedgeTrainingUsed || hedgeRouteUsed || selectedRewardTask.onchainClaimed ? 'done' : 'todo',
                  indicator: 'HEDGE',
                  interactive: true,
                  onClick: () => handleSelectLearningRoute('perp:combo'),
                  copy:
                    'Use Hedge day, set ratio, then open the short or perp hedge so the app records a levered protection leg.'
                },
                {
                  id: 'combo-math-viewed',
                  title: 'Margin, funding, liquidation, residual exposure reviewed',
                  statusText: leverageHedgeTrainingUsed || hedgeRouteUsed || selectedRewardTask.onchainClaimed ? 'Completed' : 'To do',
                  statusTone: leverageHedgeTrainingUsed || hedgeRouteUsed || selectedRewardTask.onchainClaimed ? 'done' : 'todo',
                  indicator: 'MATH',
                  interactive: true,
                  onClick: () => handleSelectLearningRoute('perp:combo'),
                  copy:
                    'Read the detail cards below the route: active notional, posted margin, funding drag, liquidation marker, hedge ratio, and net sleeve left.'
                }
              ]
            : [
                {
                  id: 'strategy-route',
                  title: 'Strategy route opened',
                  statusText:
                    strategyWorkspaceRouteActive ||
                    progressState.strategyLessonCompleted ||
                    strategyRouteUsed ||
                    selectedRewardTask.onchainClaimed
                      ? 'Completed'
                      : 'To do',
                  statusTone:
                    strategyWorkspaceRouteActive ||
                    progressState.strategyLessonCompleted ||
                    strategyRouteUsed ||
                    selectedRewardTask.onchainClaimed
                      ? 'done'
                      : 'todo',
                  indicator: 'STRAT',
                  interactive: true,
                  onClick: () => handleSelectLearningRoute('borrow'),
                  copy:
                    'Open Options / strategy so the practice examples and payoff templates are visible in the replay desk.'
                },
                {
                  id: 'strategy-example',
                  title: 'Practice example built and settled',
                  statusText:
                    progressState.strategyExampleCompleted || strategyExampleSeen || strategyRouteUsed || selectedRewardTask.onchainClaimed
                      ? 'Completed'
                      : 'To do',
                  statusTone:
                    progressState.strategyExampleCompleted || strategyExampleSeen || strategyRouteUsed || selectedRewardTask.onchainClaimed
                      ? 'done'
                      : 'todo',
                  indicator: 'EX',
                  interactive: true,
                  onClick: () => handleSelectLearningRoute('borrow'),
                  copy:
                    'Use the practice example: Start case, Build paper strategy, tune the controls, then Settle strategy to write the payoff into the ledger.'
                },
                {
                  id: 'ai-template',
                  title: 'AI template feature points generated',
                  statusText:
                    progressState.strategyAiTemplateCompleted || strategyRouteUsed || selectedRewardTask.onchainClaimed
                      ? 'Completed'
                      : 'To do',
                  statusTone:
                    progressState.strategyAiTemplateCompleted || strategyRouteUsed || selectedRewardTask.onchainClaimed
                      ? 'done'
                      : 'todo',
                  indicator: 'AI',
                  interactive: true,
                  onClick: () => handleSelectLearningRoute('strategy-ai'),
                  copy:
                    'Type a strategy idea in the AI template box so the app marks signal, payoff, risk guardrail, exit rule, paper win rate, return, and drawdown.'
                },
                {
                  id: 'strategy-board',
                  title: 'Uploaded to strategy leaderboard',
                  statusText: strategyRouteUsed || selectedRewardTask.onchainClaimed ? 'Completed' : 'To do',
                  statusTone: strategyRouteUsed || selectedRewardTask.onchainClaimed ? 'done' : 'todo',
                  indicator: 'RANK',
                  interactive: true,
                  onClick: () => handleSelectLearningRoute('strategy-ai'),
                  copy:
                    'Upload the generated template so the strategy board shows paper win rate, expected return, and max drawdown.'
                }
              ]
    : [];
  const selectedRewardTaskCompletedChecklistCount = selectedRewardTaskChecklistItems.filter((item) => item.statusTone === 'done').length;
  const selectedRewardTaskChecklistTotal = selectedRewardTaskChecklistItems.length;
  const selectedRewardTaskBadgeStatus = !selectedRewardTask
    ? null
    : selectedRewardTask.onchainClaimed
      ? {
          text: 'Completed',
          tone: 'done',
          copy: 'All core checks were already recognized and this wallet has already claimed the replay badge on Sepolia.'
        }
      : selectedRewardTask.claimStatusLabel === 'Wait to be minted'
        ? {
            text: 'Wait to be minted',
            tone: 'ready',
            copy: 'All core checks above are already recognized for this wallet, so the replay badge is now ready to be minted.'
          }
        : selectedRewardTask.claimStatusLabel === 'Reward route offline'
          ? {
              text: 'Reward route offline',
              tone: 'ready',
              copy: 'The wallet already satisfied the task, but the replay reward route is not configured yet.'
            }
          : selectedRewardTask.id === REPLAY_BADGE_TYPES.baseCheck && selectedRewardTask.inherited
            ? {
                text: 'Inherited',
                tone: 'ready',
                copy: 'Home-page wallet and risk progress are already inherited here. Place one replay buy or sell to finish Base Check.'
              }
            : {
                text: 'To do',
                tone: 'todo',
                copy: `This wallet has ${selectedRewardTaskCompletedChecklistCount}/${selectedRewardTaskChecklistTotal} core checks completed. Finish the required To do rows for this guided replay task.`
              };
  const unlockedReplayAchievementCount = replayAchievements.filter((achievement) => achievement.unlocked).length;
  const claimReadyReplayAchievementCount = replayAchievements.filter((achievement) => achievement.canClaimOnchain).length;
  const claimedReplayAchievementCount = replayAchievements.filter((achievement) => achievement.onchainClaimed).length;
  const nextReplayAchievement = replayAchievements.find((achievement) => !achievement.unlocked) || null;
  const selectedPosition = paperState.positions[selectedProductId] || {
    units: 0,
    principal: 0,
    avgEntry: 0,
    carryPaid: 0,
    grossNotional: 0,
    entryFeePaid: 0,
    entryTs: ''
  };
  const replayFocus = useMemo(() => {
    const barCount = selectedView?.bars?.length || 0;
    const lockedIndex = barCount ? Math.max(0, Math.min(selectedView?.cursor || 0, barCount - 1)) : 0;
    const hoverIndex =
      hoveredReplayIndex == null || !barCount ? null : Math.max(0, Math.min(hoveredReplayIndex, barCount - 1));
    const lockedBar = barCount ? selectedView.bars[lockedIndex] || null : null;
    const hoveredBar = hoverIndex == null || !barCount ? null : selectedView.bars[hoverIndex] || null;
    const bar = hoveredBar || lockedBar;
    const index = hoveredBar ? hoverIndex : lockedIndex;
    const hoverActive = Boolean(hoveredBar && hoveredBar.ts !== lockedBar?.ts);
    const positionAtBar = buildHistoricalPositionFromTrades(paperState.trades, selectedProductId, bar?.ts);
    const snapshotAtBar = buildPositionSnapshot(
      selectedProduct,
      positionAtBar,
      Number(bar?.close || 0),
      bar?.ts
    );
    const barTime = new Date(bar?.ts || '').getTime();
    const realizedPnlAtBar = roundNumber(
      paperState.trades.reduce((sum, trade) => {
        const tradeTime = new Date(trade.ts).getTime();
        if (
          trade.productId !== selectedProductId ||
          trade.side !== 'sell' ||
          !Number.isFinite(tradeTime) ||
          !Number.isFinite(barTime) ||
          tradeTime > barTime
        ) {
          return sum;
        }

        return sum + Number(trade.realizedPnl || 0);
      }, 0),
      2
    );

    return {
      lockedIndex,
      hoverIndex,
      index,
      lockedBar,
      hoveredBar,
      bar,
      hoverActive,
      positionAtBar,
      snapshotAtBar,
      realizedPnlAtBar,
      totalPnlAtBar: roundNumber(realizedPnlAtBar + snapshotAtBar.netPnl, 2),
      openLabel: formatPrice(bar?.open),
      volumeLabel: Number(bar?.volume || 0).toLocaleString('en-US'),
      barDateLabel: formatReplayDate(bar?.ts, selectedView?.interval),
      lockedDateLabel: formatReplayDate(lockedBar?.ts, selectedView?.interval),
      closeLabel: formatPrice(bar?.close)
    };
  }, [hoveredReplayIndex, paperState.trades, selectedProduct, selectedProductId, selectedView]);
  const selectedPositionSnapshot = buildPositionSnapshot(
    selectedProduct,
    selectedPosition,
    Number(replayFocus.lockedBar?.close || 0),
    replayFocus.lockedBar?.ts
  );
  const latestSelectedTrade = paperState.trades.find((trade) => trade.productId === selectedProductId) || null;
  const selectedMarketValue = selectedPositionSnapshot.grossValue;
  const selectedUnrealizedPnl = selectedPositionSnapshot.grossPnl;
  const selectedNetExitValue = selectedPositionSnapshot.netExitValue;
  const selectedNetPnl = selectedPositionSnapshot.netPnl;
  const selectedCostModel = getCostModel(selectedProduct);
  const selectedTaxRate = getEstimatedTaxRate(selectedCostModel, selectedPositionSnapshot.holdingDays);
  const selectedActivePerpEntry =
    activePerpEntry?.productId === selectedProductId ? activePerpEntry : null;
  const selectedActivePerpEntryIndex =
    selectedActivePerpEntry?.entryTs && selectedView?.bars?.length
      ? selectedView.bars.findIndex((bar) => bar.ts === selectedActivePerpEntry.entryTs)
      : -1;
  const replayCursorIndex = Math.max(0, Math.min(selectedView?.cursor || 0, Math.max(0, (selectedView?.bars?.length || 1) - 1)));
  const timedExitAnchorIndex =
    selectedAdvancedRoute === 'perp' && activePerpLeg && selectedActivePerpEntryIndex >= 0
      ? selectedActivePerpEntryIndex
      : replayCursorIndex;
  const timedExitAnchorBar = selectedView?.bars?.[timedExitAnchorIndex] || null;
  const timedExitMaxHoldingDays = getReplayMaxHoldingDays(selectedView?.bars || [], timedExitAnchorIndex);
  const timedExitRequestedDays = Math.max(0, Math.round(Number(simulationHoldingDays || 0)));
  const timedExitRequestedExceedsWindow = timedExitRequestedDays > timedExitMaxHoldingDays;
  const timedExitTargetIndex = selectedView?.bars?.length && !timedExitRequestedExceedsWindow
    ? findReplayIndexAfterDays(selectedView.bars, timedExitAnchorIndex, timedExitRequestedDays)
    : null;
  const timedExitHasForwardBar = timedExitTargetIndex !== null && timedExitTargetIndex > timedExitAnchorIndex;
  const timedExitTargetBar =
    timedExitTargetIndex !== null && selectedView?.bars?.length ? selectedView.bars[timedExitTargetIndex] : null;
  const timedExitActualHoldingDays =
    timedExitAnchorBar && timedExitTargetBar
      ? Math.max(1, Math.round(getHoldingDays(timedExitAnchorBar.ts, timedExitTargetBar.ts)))
      : timedExitRequestedDays;
  const timedExitPresetDays = [...new Set([7, 14, 30, 90, timedExitMaxHoldingDays].filter((days) => days <= timedExitMaxHoldingDays))]
    .sort((left, right) => left - right);
  const entryCostPreview = calculateTradeCosts({
    product: selectedProduct,
    side: 'buy',
    notional: Number(tradeAmount || 0)
  });
  const selectedWindowScorecard = getReplayWindowScorecard(selectedView);
  const selectedWindowMetricsAvailable = hasReliableReplayWindow(selectedProduct, selectedView);
  const selectedMarketCapValue = formatMarketCapLabel(selectedProductGuide.marketCapValue);
  const chartHoverDiagnosticRows = [
    ['Locked index', String(replayFocus.lockedIndex ?? '--')],
    ['Hovered index', hoveredReplayIndex == null ? '--' : String(hoveredReplayIndex)],
    ['Display index', String(replayFocus.index ?? '--')],
    ['Locked date', replayFocus.lockedDateLabel],
    ['Focus date', replayFocus.barDateLabel],
    ['Display close', replayFocus.closeLabel]
  ];
  const routeStructureOptions = buildRouteStructureOptions(selectedProduct, selectedProductGuide, selectedAdvancedRoute);
  const leverageRouteActive = selectedAdvancedRoute === 'perp';
  const effectiveDeskStructureMode =
    !advancedActivityEnabled || leverageRouteActive
      ? 'single'
      : routeStructureOptions.some((option) => option.id === deskStructureMode)
        ? deskStructureMode
        : routeStructureOptions[0]?.id || 'single';
  const leverageDirection = activePerpLeg || contractDirection;
  const routeLeverageMultiple = clampNumber(Math.max(1, Number(contractLeverage || 1)), 1, 10);
  const routeRequestedTicketNotional = roundNumber(Math.max(0, Number(tradeAmount || 0)), 2);
  const principalFlashBaseRows = useMemo(
    () =>
      leverageRouteActive && hedgeFocusActive
        ? buildFlashLiquidityQuoteRows({
            leverageMultiple: routeLeverageMultiple,
            tradeAmount: 0,
            routeBaseNotional: 0,
            availableCash: Number(availableCash || 0),
            reserveBackingValue: Number(availableCash || 0),
            wealthDeskState,
            draftQuotes: {},
            appliedQuotes: {}
          })
        : [],
    [availableCash, hedgeFocusActive, leverageRouteActive, routeLeverageMultiple, wealthDeskState]
  );
  const principalFlashBaseCaps = useMemo(
    () => Object.fromEntries(principalFlashBaseRows.map((row) => [row.id, row.maxAvailableNotional])),
    [principalFlashBaseRows]
  );
  const principalFlashTotalBudget = leverageRouteActive && hedgeFocusActive
    ? getFlashLiquidityTotalBudget(principalFlashBaseRows)
    : 0;
  const hedgeHasLiveSleeveForFunding = hedgeFocusActive && selectedPosition.units > 0 && Number(selectedMarketValue || 0) >= 1;
  const hedgeExistingPrincipalFundingBase = hedgeHasLiveSleeveForFunding ? roundNumber(Number(selectedMarketValue || 0), 2) : 0;
  const hedgeExistingPrincipalLoan = hedgeHasLiveSleeveForFunding
    ? roundNumber(Math.max(0, Number(selectedPosition.principalLoan || 0)), 2)
    : 0;
  const hedgePrincipalLoanApprovalKey = [
    selectedProductId,
    selectedAdvancedRoute,
    routeLeverageMultiple,
    roundNumber(Number(availableCash || 0), 2),
    roundNumber(principalFlashTotalBudget, 2)
  ].join('|');
  const hedgePrincipalLoanApprovalValid =
    hedgePrincipalLoanApproval.key === hedgePrincipalLoanApprovalKey &&
    Number(hedgePrincipalLoanApproval.maxNotional || 0) > 0 &&
    principalFlashTotalBudget > 0;
  const hedgePrincipalSignedLoanBudget = hedgePrincipalLoanApprovalValid
    ? roundNumber(Math.min(Number(hedgePrincipalLoanApproval.maxNotional || 0), principalFlashTotalBudget), 2)
    : 0;
  const hedgePrincipalCommittedLoanBudget = roundNumber(
    Math.max(hedgeExistingPrincipalLoan, hedgePrincipalFlashEnabled ? hedgePrincipalSignedLoanBudget : 0),
    2
  );
  const hedgePrincipalLoanRemainingForFunding = leverageRouteActive && hedgeFocusActive
    ? roundNumber(Math.max(0, hedgePrincipalCommittedLoanBudget - hedgeExistingPrincipalLoan), 2)
    : 0;
  const hedgePrincipalWalletIncrementMax = hedgeFocusActive
    ? getMaxBuyNotionalForFunding(selectedProduct, availableCash, 0)
    : 0;
  const hedgePrincipalLoanIncrementMax = hedgeFocusActive
    ? getMaxBuyNotionalForFunding(selectedProduct, availableCash, hedgePrincipalLoanRemainingForFunding)
    : 0;
  const hedgePrincipalWalletMaxForFunding = hedgeFocusActive
    ? roundNumber(hedgeExistingPrincipalFundingBase + hedgePrincipalWalletIncrementMax, 2)
    : 0;
  const hedgePrincipalPreviewMaxForFunding = hedgeFocusActive
    ? roundNumber(
        hedgeExistingPrincipalFundingBase +
          (hedgePrincipalFlashEnabled ? hedgePrincipalLoanIncrementMax : hedgePrincipalWalletIncrementMax),
        2
      )
    : 0;
  const hedgePrincipalPreviewNotional = hedgeFocusActive
    ? roundNumber(Math.min(Math.max(0, Number(hedgePreviewSleeveNotional || 0)), hedgePrincipalPreviewMaxForFunding), 2)
    : 0;
  const hedgePrincipalIncrementalNeed = hedgeFocusActive
    ? roundNumber(Math.max(0, hedgePrincipalPreviewNotional - hedgeExistingPrincipalFundingBase), 2)
    : 0;
  const hedgePrincipalUpfrontCost = hedgeFocusActive
    ? roundNumber(
        calculateTradeCosts({
          product: selectedProduct,
          side: 'buy',
          notional: hedgePrincipalIncrementalNeed
        }).nonTaxCost,
        2
      )
    : 0;
  const hedgePrincipalCashReserved = hedgeFocusActive
    ? roundNumber(Math.min(Math.max(0, Number(availableCash || 0) - hedgePrincipalUpfrontCost), hedgePrincipalIncrementalNeed), 2)
    : 0;
  const hedgePrincipalFlashNotional = hedgeFocusActive
    ? roundNumber(Math.min(hedgePrincipalLoanRemainingForFunding, Math.max(0, hedgePrincipalIncrementalNeed - hedgePrincipalCashReserved)), 2)
    : 0;
  const hedgePrincipalFlashReservedNotional = hedgeFocusActive
    ? roundNumber(hedgeExistingPrincipalLoan + hedgePrincipalFlashNotional, 2)
    : 0;
  const hedgePrincipalFlashAllocatedByLane = useMemo(() => {
    if (!hedgeFocusActive || hedgePrincipalFlashReservedNotional <= 0) return {};

    const requestedById = Object.fromEntries(principalFlashBaseRows.map((row) => [row.id, hedgePrincipalFlashReservedNotional]));
    return allocateFlashQuotesByRate(
      requestedById,
      hedgePrincipalFlashReservedNotional,
      principalFlashBaseRows,
      principalFlashBaseCaps
    );
  }, [
    hedgeFocusActive,
    hedgePrincipalFlashReservedNotional,
    principalFlashBaseCaps,
    principalFlashBaseRows
  ]);
  const routeFundingCashAvailable = leverageRouteActive
    ? roundNumber(Math.max(0, Number(availableCash || 0) - hedgePrincipalCashReserved), 2)
    : Number(availableCash || 0);
  const flashLoanAppliedInputNotional = leverageRouteActive
    ? roundNumber(Object.values(flashLoanAppliedQuotes).reduce((sum, value) => sum + Number(value || 0), 0), 2)
    : 0;
  const routeFlashExtensionNotional = leverageRouteActive && !hedgeFocusActive ? flashLoanAppliedInputNotional : 0;
  const routeSizingTargetNotional = leverageRouteActive
    ? roundNumber(routeRequestedTicketNotional + routeFlashExtensionNotional, 2)
    : routeRequestedTicketNotional;
  const routeTotalFlashNotional = leverageRouteActive
    ? roundNumber(hedgePrincipalFlashReservedNotional + flashLoanAppliedInputNotional, 2)
    : 0;
  const routeMarginBufferRate = getPerpMarginBufferRate(routeSizingTargetNotional, routeLeverageMultiple);
  const routeInitialMarginRate = getPerpInitialMarginRate(routeSizingTargetNotional, routeLeverageMultiple);
  const routeFlashReserveCapital = leverageRouteActive
    ? roundNumber(routeTotalFlashNotional * FLASH_TICKET_RESERVE_RATE, 2)
    : 0;
  const routeFlashReserveCashUse = leverageRouteActive
    ? roundNumber(Math.min(routeFundingCashAvailable, routeFlashReserveCapital), 2)
    : 0;
  const routeCashAvailableForBaseMargin = leverageRouteActive
    ? roundNumber(Math.max(0, routeFundingCashAvailable - routeFlashReserveCashUse), 2)
    : Number(availableCash || 0);
  const routeWalletTargetNotional = leverageRouteActive
    ? hedgeFocusActive
      ? roundNumber(Math.max(0, routeRequestedTicketNotional - flashLoanAppliedInputNotional), 2)
      : routeRequestedTicketNotional
    : routeRequestedTicketNotional;
  const routeMaxWalletBackedNotional =
    leverageRouteActive
      ? getWalletBackedPerpNotionalCap(routeFundingCashAvailable, routeLeverageMultiple)
      : roundNumber(Math.max(0, Number(availableCash || 0)), 2);
  const routeRequiredBaseMarginCapital = roundNumber(Math.max(0, routeWalletTargetNotional * routeInitialMarginRate), 2);
  const routePostedBaseMarginCapital = leverageRouteActive
    ? roundNumber(Math.min(routeCashAvailableForBaseMargin, routeRequiredBaseMarginCapital), 2)
    : routeRequiredBaseMarginCapital;
  const routeBaseNotional =
    leverageRouteActive && routeInitialMarginRate > 0
      ? roundNumber(routePostedBaseMarginCapital / routeInitialMarginRate, 2)
      : routeRequestedTicketNotional;
  const routeNotionalShortfall = leverageRouteActive
    ? roundNumber(
        Math.max(
          0,
          routeRequestedTicketNotional - (routeBaseNotional + (hedgeFocusActive ? flashLoanAppliedInputNotional : 0))
        ),
        2
      )
    : 0;
  const routeMarginWalletFreeCashBeforeFlash = roundNumber(
    Math.max(0, routeFundingCashAvailable - (leverageRouteActive ? routePostedBaseMarginCapital : 0)),
    2
  );
  const routeFlashReserveBackingValue = leverageRouteActive
    ? Number(availableCash || 0)
    : routeFundingCashAvailable;
  const flashLoanQuoteRows = useMemo(
    () =>
      leverageRouteActive
        ? buildFlashLiquidityQuoteRows({
            leverageMultiple: routeLeverageMultiple,
            tradeAmount: routeRequestedTicketNotional,
            routeBaseNotional,
            availableCash: Number(availableCash || 0),
            reserveBackingValue: routeFlashReserveBackingValue,
            reservedNotionalById: hedgePrincipalFlashAllocatedByLane,
            reservedTotalNotional: hedgePrincipalFlashReservedNotional,
            wealthDeskState,
            draftQuotes: flashLoanDraftQuotes,
            appliedQuotes: flashLoanAppliedQuotes
          })
        : [],
    [
      flashLoanAppliedQuotes,
      flashLoanDraftQuotes,
      hedgePrincipalFlashAllocatedByLane,
      hedgePrincipalFlashReservedNotional,
      availableCash,
      leverageRouteActive,
      routeBaseNotional,
      routeFlashReserveBackingValue,
      routeLeverageMultiple,
      routeRequestedTicketNotional,
      wealthDeskState
    ]
  );
  const flashLoanDisplayRows = useMemo(
    () =>
      leverageRouteActive
        ? buildFlashLiquidityQuoteRows({
            leverageMultiple: routeLeverageMultiple,
            tradeAmount: 0,
            routeBaseNotional: 0,
            availableCash: Number(availableCash || 0),
            reserveBackingValue: routeFlashReserveBackingValue,
            reservedNotionalById: hedgePrincipalFlashAllocatedByLane,
            reservedTotalNotional: hedgePrincipalFlashReservedNotional,
            wealthDeskState,
            draftQuotes: {},
            appliedQuotes: {}
          })
        : [],
    [
      hedgePrincipalFlashAllocatedByLane,
      hedgePrincipalFlashReservedNotional,
      availableCash,
      leverageRouteActive,
      routeLeverageMultiple,
      routeFlashReserveBackingValue,
      wealthDeskState
    ]
  );
  const flashLoanQuoteCaps = useMemo(
    () => Object.fromEntries(flashLoanQuoteRows.map((row) => [row.id, row.maxAvailableNotional])),
    [flashLoanQuoteRows]
  );
  const ticketFlashLane = flashLoanQuoteRows.find((row) => row.id === 'ticket');
  const generalFlashLane = flashLoanQuoteRows.find((row) => row.id === 'general');
  const displayTicketFlashLane = flashLoanDisplayRows.find((row) => row.id === 'ticket');
  const displayGeneralFlashLane = flashLoanDisplayRows.find((row) => row.id === 'general');
  const flashLoanQuoteMaxNotional = leverageRouteActive
    ? getFlashLiquidityTotalBudget(flashLoanQuoteRows)
    : 0;
  const flashLoanDisplayMaxNotional = leverageRouteActive
    ? getFlashLiquidityTotalBudget(flashLoanDisplayRows)
    : 0;
  const hedgeFlashTopUpRequiredNotional = leverageRouteActive && hedgeFocusActive
    ? getFlashTopUpRequiredForTarget({
        targetNotional: routeRequestedTicketNotional,
        availableCash: routeFundingCashAvailable,
        initialMarginRate: routeInitialMarginRate,
        reserveRate: FLASH_TICKET_RESERVE_RATE,
        reserveBackingValue: routeFlashReserveBackingValue
      })
    : 0;
  const flashLoanDraftTotalNotional = leverageRouteActive
    ? roundNumber(flashLoanQuoteRows.reduce((sum, row) => sum + row.draftNotional, 0), 2)
    : 0;
  const flashLoanAppliedTicketNotional = leverageRouteActive
    ? roundNumber(flashLoanQuoteRows.reduce((sum, row) => sum + row.appliedNotional, 0), 2)
    : 0;
  const flashLoanRemainingShortfall = leverageRouteActive
    ? roundNumber(
        Math.max(
          0,
          routeRequestedTicketNotional - (routeBaseNotional + (hedgeFocusActive ? flashLoanAppliedTicketNotional : 0))
        ),
        2
      )
    : 0;
  const flashLoanCurrentTicketTopUpCap = leverageRouteActive && !hedgeFocusActive
    ? roundNumber(flashLoanQuoteMaxNotional, 2)
    : 0;
  const flashLoanAttachableMaxNotional = leverageRouteActive
    ? roundNumber(
        Math.min(
          flashLoanQuoteMaxNotional,
          hedgeFocusActive ? hedgeFlashTopUpRequiredNotional : flashLoanCurrentTicketTopUpCap
        ),
        2
      )
    : 0;
  const hasFlashLoanQuoteState =
    flashLoanQuoteOpen ||
    Object.keys(flashLoanDraftQuotes).length > 0 ||
    Object.values(flashLoanAppliedQuotes).some((value) => Number(value || 0) > 0);
  const routeEffectiveTicketNotional = leverageRouteActive
    ? roundNumber(
        hedgeFocusActive
          ? Math.min(routeRequestedTicketNotional, routeBaseNotional + flashLoanAppliedTicketNotional)
          : routeBaseNotional + flashLoanAppliedTicketNotional,
        2
      )
    : routeRequestedTicketNotional;
  const flashLoanDraftPremiumEstimate = leverageRouteActive
    ? roundNumber(flashLoanQuoteRows.reduce((sum, row) => sum + row.draftPremium, 0), 2)
    : 0;
  const flashLoanPremiumEstimate = leverageRouteActive
    ? roundNumber(flashLoanQuoteRows.reduce((sum, row) => sum + row.appliedPremium, 0), 2)
    : 0;
  const routeSliderStagedFlashNotional = leverageRouteActive && !hedgeFocusActive
    ? roundNumber(
        Math.min(
          flashLoanAttachableMaxNotional,
          Math.max(0, routeRequestedTicketNotional - routeBaseNotional)
        ),
        2
      )
    : 0;
  const routePreviewFlashNotional = leverageRouteActive
    ? roundNumber(
        hedgeFocusActive
          ? flashLoanAppliedTicketNotional
          : Math.max(
              flashLoanAppliedTicketNotional,
              flashLoanDraftTotalNotional,
              routeSliderStagedFlashNotional
            ),
        2
      )
    : 0;
  const routePreviewFlashQuoteMap = routePreviewFlashNotional > flashLoanAppliedTicketNotional + 0.01
    ? allocateFlashQuotesByRate(
        Object.fromEntries(flashLoanQuoteRows.map((row) => [row.id, routePreviewFlashNotional])),
        routePreviewFlashNotional,
        flashLoanQuoteRows,
        flashLoanQuoteCaps
      )
    : flashLoanAppliedQuotes;
  const routePreviewFlashPremiumEstimate = leverageRouteActive
    ? roundNumber(
        routePreviewFlashNotional > flashLoanAppliedTicketNotional + 0.01
          ? flashLoanQuoteRows.reduce(
              (sum, row) => sum + Number(routePreviewFlashQuoteMap[row.id] || 0) * Number(row.rate || 0),
              0
            )
          : flashLoanPremiumEstimate,
        2
      )
    : 0;
  const routePreviewTicketNotional = leverageRouteActive
    ? roundNumber(
        hedgeFocusActive
          ? routeEffectiveTicketNotional
          : Math.max(
              routeEffectiveTicketNotional,
              routeRequestedTicketNotional,
              routeBaseNotional + routePreviewFlashNotional
            ),
        2
      )
    : routeRequestedTicketNotional;
  const routePostedFlashReserveCapital = leverageRouteActive
    ? roundNumber(Math.min(routeMarginWalletFreeCashBeforeFlash, routeFlashReserveCapital), 2)
    : 0;
  const routeRequiredMarginCapital = roundNumber(routeRequiredBaseMarginCapital + routeFlashReserveCapital, 2);
  const routeMarginCapital = roundNumber(routePostedBaseMarginCapital + routePostedFlashReserveCapital, 2);
  const routeCashPostedMarginCapital = roundNumber(
    routePostedBaseMarginCapital + routePostedFlashReserveCapital,
    2
  );
  const routeMarginShortfall = roundNumber(Math.max(0, routeRequiredMarginCapital - routeMarginCapital), 2);
  const routeMarginWalletFreeCash = roundNumber(
    Math.max(0, routeFundingCashAvailable - (leverageRouteActive ? routeCashPostedMarginCapital : 0)),
    2
  );
  const routeMaxAttestedNotional = leverageRouteActive
    ? getWalletAndFlashPerpNotionalCap({
        availableCash: routeFundingCashAvailable,
        initialMarginRate: routeInitialMarginRate,
        flashBudget: Number(displayTicketFlashLane?.maxAvailableNotional || 0),
        reserveRate: FLASH_TICKET_RESERVE_RATE,
        reserveBackingValue: routeFlashReserveBackingValue
      })
    : routeMaxWalletBackedNotional;
  const routeMaxVenueNotional = leverageRouteActive
    ? getWalletAndFlashPerpNotionalCap({
        availableCash: routeFundingCashAvailable,
        initialMarginRate: routeInitialMarginRate,
        flashBudget: flashLoanDisplayMaxNotional,
        reserveRate: FLASH_TICKET_RESERVE_RATE,
        reserveBackingValue: routeFlashReserveBackingValue
      })
    : routeMaxWalletBackedNotional;
  const hedgePrincipalFlashBudgetLeft = leverageRouteActive && hedgeFocusActive
    ? roundNumber(Math.max(0, principalFlashTotalBudget - hedgePrincipalFlashReservedNotional), 2)
    : 0;
  const hedgeLoanBudgetUsed = leverageRouteActive && hedgeFocusActive
    ? roundNumber(hedgePrincipalFlashReservedNotional + flashLoanAppliedInputNotional, 2)
    : flashLoanAppliedInputNotional;
  const hedgeLoanBudgetLeftAfterApplied = leverageRouteActive && hedgeFocusActive
    ? roundNumber(Math.max(0, principalFlashTotalBudget - hedgeLoanBudgetUsed), 2)
    : 0;
  const hedgePrincipalFundingModeLabel = hedgePrincipalFlashReservedNotional > 0 ? 'Principal loan on' : 'Wallet principal only';
  const hedgePrincipalFundingCopy = hedgePrincipalFlashEnabled
    ? `${selectedProduct.ticker} sleeve uses wallet PT first and uses the signed principal-loan agreement only for the extra principal, so the later hedge can still borrow only what remains.`
    : `${selectedProduct.ticker} sleeve uses wallet PT only. Want more opens a wallet-signed principal-loan agreement before the sleeve can borrow.`;
  const hedgeLoanCapacityCopy =
    flashLoanQuoteMaxNotional <= 0
      ? 'No hedge loan left after sleeve principal. Lower principal, lower hedge size, or turn off principal loan.'
      : `Hedge can still borrow up to ${formatNotional(flashLoanQuoteMaxNotional)} PT after the ${selectedProduct.ticker} sleeve principal.`;
  const routeWalletBackedSetupMarginRate =
    leverageRouteActive && routeMaxWalletBackedNotional > 0
      ? roundNumber(Math.max(0, routeFundingCashAvailable) / routeMaxWalletBackedNotional, 4)
      : routeInitialMarginRate;
  const tradeAmountMaxOptions = leverageRouteActive
    ? hedgeFocusActive
      ? [{ id: 'hedge', label: 'Hedge funding cap', value: routeMaxVenueNotional }]
      : [
          { id: 'wallet', label: 'Wallet only', value: routeMaxWalletBackedNotional },
          { id: 'ticket', label: '+ attested flash', value: routeMaxAttestedNotional },
          { id: 'venue', label: '+ broad flash', value: routeMaxVenueNotional }
        ]
    : [{ id: 'wallet', label: 'Available cash only', value: routeMaxWalletBackedNotional }];
  const selectedTradeAmountMaxOption = tradeAmountMaxOptions.find((option) => option.id === tradeAmountMaxMode) || tradeAmountMaxOptions[0];
  const selectedTradeAmountMaxRawValue = roundNumber(
    Math.max(0, Number(selectedTradeAmountMaxOption?.value || routeMaxWalletBackedNotional || 0)),
    2
  );
  const selectedTradeAmountMaxLabel = leverageRouteActive
    ? hedgeFocusActive
      ? 'Hedge funding cap'
      : tradeAmountMaxMode === 'ticket'
      ? 'Attested flash max'
      : tradeAmountMaxMode === 'venue'
        ? 'Broad flash max'
        : 'Wallet-only max'
    : 'Available cash';
  const tradeAmountFieldLabel = hedgeFocusActive ? 'Hedge ticket notional' : 'Paper notional';
  const hedgeHasMeaningfulOpenSleeve = hedgeFocusActive && selectedPosition.units > 0 && Number(selectedMarketValue || 0) >= 1;
  const hedgeLiveSleeveNotional = hedgeHasMeaningfulOpenSleeve
    ? roundNumber(Math.max(0, Number(selectedMarketValue || 0)), 2)
    : 0;
  const hedgePreviewSleeveMax = roundNumber(
    Math.max(0, hedgePrincipalPreviewMaxForFunding),
    2
  );
  const hedgeHasPaperNotionalBase =
    hedgeFocusActive &&
    Boolean(replayFocus.lockedBar || replayFocus.bar) &&
    Number(hedgePrincipalPreviewNotional || 0) >= MIN_PAPER_TRADE;
  const hedgeSizingReady = hedgeHasMeaningfulOpenSleeve || hedgeHasPaperNotionalBase;
  const hedgePlannedTicketNotional = hedgeFocusActive
    ? roundNumber(Math.max(0, Number(tradeAmount || 0)), 2)
    : 0;
  const hedgeStagedTicketNotional = hedgeFocusActive
    ? roundNumber(routeEffectiveTicketNotional, 2)
    : 0;
  const hedgeWalletBackedTicketNotional = hedgeFocusActive
    ? roundNumber(Math.min(hedgePlannedTicketNotional, routeBaseNotional), 2)
    : 0;
  const hedgeFlashTopUpNotional = hedgeFocusActive
    ? roundNumber(Math.max(0, hedgeStagedTicketNotional - hedgeWalletBackedTicketNotional), 2)
    : 0;
  const hedgeFlashTopUpNeed = hedgeFocusActive
    ? roundNumber(Math.max(0, hedgeFlashTopUpRequiredNotional), 2)
    : 0;
  const hedgeFlashTopUpRemaining = hedgeFocusActive
    ? roundNumber(Math.max(0, hedgeFlashTopUpNeed - flashLoanAppliedTicketNotional), 2)
    : 0;
  const hedgeFlashQuoteButtonLabel = flashLoanAppliedTicketNotional > 0
    ? hedgeFlashTopUpRemaining > 0
      ? 'Top up quote'
      : 'Edit flash'
    : 'Quote top-up';
  const hedgeFlashTopUpLabel = flashLoanAppliedTicketNotional > 0
    ? hedgeFlashTopUpRemaining > 0
      ? `${formatNotional(flashLoanAppliedTicketNotional)} PT applied, ${formatNotional(hedgeFlashTopUpRemaining)} PT left`
      : `${formatNotional(flashLoanAppliedTicketNotional)} PT applied`
    : hedgeFlashTopUpNeed > 0
      ? `${formatNotional(hedgeFlashTopUpNeed)} PT needed`
      : 'No top-up needed';
  const hedgeProtectedSleeveNotional = hedgeHasPaperNotionalBase
    ? roundNumber(Math.max(0, Number(hedgePrincipalPreviewNotional || 0)), 2)
    : hedgeLiveSleeveNotional;
  const hedgeTargetCap = hedgeSizingReady
    ? roundNumber(Math.max(0, hedgeProtectedSleeveNotional), 2)
    : 0;
  const selectedTradeAmountMaxValue = roundNumber(
    Math.max(
      0,
      selectedTradeAmountMaxRawValue
    ),
    2
  );
  const selectedTradeAmountDisplayLabel = leverageRouteActive
    ? hedgeFocusActive
      ? 'Hedge funding cap'
      : hedgeSizingReady
      ? tradeAmountMaxMode === 'ticket'
        ? 'Attested cap'
        : tradeAmountMaxMode === 'venue'
          ? 'Broad cap'
          : 'Wallet cap'
      : selectedTradeAmountMaxLabel
    : 'Available cash';
  const selectedTradeAmountCapSummaryLabel = leverageRouteActive
    ? hedgeFocusActive
      ? 'Hedge funding cap'
      : tradeAmountMaxMode === 'ticket'
      ? 'Attested cap'
      : tradeAmountMaxMode === 'venue'
        ? 'Broad cap'
        : 'Wallet cap'
    : 'Available cash';
  const tradeAmountSliderLabel = leverageRouteActive
    ? hedgeFocusActive
      ? `${selectedTradeAmountDisplayLabel} range`
      : `${selectedTradeAmountDisplayLabel} range`
    : 'Available cash range';
  const hedgeMaxFundableTicketNotional = hedgeFocusActive && hedgeSizingReady
    ? roundNumber(Math.min(selectedTradeAmountMaxValue, hedgeTargetCap), 2)
    : selectedTradeAmountMaxValue;
  const hedgeMaxFundableRatio = hedgeFocusActive && hedgeSizingReady && hedgeProtectedSleeveNotional > 0
    ? roundNumber(clampNumber(hedgeMaxFundableTicketNotional / hedgeProtectedSleeveNotional, 0, 1), 4)
    : 1;
  const hedgeFullCoverageFundingGap = hedgeFocusActive && hedgeSizingReady
    ? roundNumber(Math.max(0, hedgeTargetCap - hedgeMaxFundableTicketNotional), 2)
    : 0;
  const tradeAmountSliderMax = hedgeFocusActive && hedgeSizingReady
    ? hedgeMaxFundableTicketNotional
    : selectedTradeAmountMaxValue;
  const tradeAmountSliderValue = roundNumber(
    Math.min(Math.max(0, Number(tradeAmount || 0)), Math.max(0, tradeAmountSliderMax)),
    2
  );
  const routeSuggestedTicketRatio = getSuggestedTicketRatio(selectedProduct, selectedAdvancedRoute);
  const tradeAmountSuggestedValue = hedgeFocusActive
    ? hedgeSizingReady
      ? roundNumber(Math.min(Math.max(0, hedgeProtectedSleeveNotional * Number(hedgeRatio || 0)), tradeAmountSliderMax), 2)
      : 0
    : roundNumber(
        Math.min(
          Math.max(0, tradeAmountSliderMax),
          Math.max(MIN_PAPER_TRADE, Math.max(0, tradeAmountSliderMax) * routeSuggestedTicketRatio)
        ),
        2
      );
  const tradeAmountSuggestedPercent =
    tradeAmountSliderMax > 0 ? clampNumber((tradeAmountSuggestedValue / tradeAmountSliderMax) * 100, 0, 100) : 0;
  const tradeAmountWalletSegmentEnd = roundNumber(Math.min(tradeAmountSliderMax, routeMaxWalletBackedNotional), 2);
  const tradeAmountAttestedSegmentEnd = roundNumber(Math.min(tradeAmountSliderMax, routeMaxAttestedNotional), 2);
  const tradeAmountWalletSegmentPercent =
    tradeAmountSliderMax > 0 ? roundNumber((tradeAmountWalletSegmentEnd / tradeAmountSliderMax) * 100, 2) : 0;
  const tradeAmountAttestedSegmentPercent =
    tradeAmountSliderMax > 0
      ? roundNumber((Math.max(0, tradeAmountAttestedSegmentEnd - tradeAmountWalletSegmentEnd) / tradeAmountSliderMax) * 100, 2)
      : 0;
  const tradeAmountBroadSegmentPercent =
    tradeAmountSliderMax > 0
      ? roundNumber(
          (Math.max(0, tradeAmountSliderMax - Math.max(tradeAmountWalletSegmentEnd, tradeAmountAttestedSegmentEnd)) / tradeAmountSliderMax) * 100,
          2
        )
      : 0;
  const tradeAmountExceedsSelectedMax = Number(tradeAmount || 0) > tradeAmountSliderMax + 0.01;
  const hedgeSuggestedNotional = hedgeSizingReady
    ? roundNumber(Math.max(0, hedgeProtectedSleeveNotional * Number(hedgeRatio || 0)), 2)
    : 0;
  const hedgeFundableSuggestedNotional = hedgeFocusActive && hedgeSizingReady
    ? roundNumber(Math.min(hedgeSuggestedNotional, tradeAmountSliderMax), 2)
    : hedgeSuggestedNotional;
  const hedgeSuggestedFundingGap = hedgeFocusActive && hedgeSizingReady
    ? roundNumber(Math.max(0, hedgeSuggestedNotional - tradeAmountSliderMax), 2)
    : 0;
  const hedgeDisplayedLoanNeed = hedgeFocusActive
    ? roundNumber(Math.max(hedgeFlashTopUpNeed, hedgeSuggestedFundingGap), 2)
    : 0;
  const hedgeFundingZoneReference = hedgeFocusActive && hedgeSizingReady
    ? roundNumber(Math.max(hedgeTargetCap, tradeAmountSliderMax), 2)
    : tradeAmountSliderMax;
  const hedgeFundingCoveredEnd = roundNumber(Math.min(hedgeFundingZoneReference, tradeAmountSliderMax), 2);
  const hedgeFundingWalletSegmentEnd = roundNumber(Math.min(hedgeFundingCoveredEnd, routeMaxWalletBackedNotional), 2);
  const hedgeFundingAttestedSegmentEnd = roundNumber(Math.min(hedgeFundingCoveredEnd, routeMaxAttestedNotional), 2);
  const hedgeFundingWalletSegmentPercent =
    hedgeFundingZoneReference > 0 ? roundNumber((hedgeFundingWalletSegmentEnd / hedgeFundingZoneReference) * 100, 2) : 0;
  const hedgeFundingAttestedSegmentPercent =
    hedgeFundingZoneReference > 0
      ? roundNumber(
          (Math.max(0, hedgeFundingAttestedSegmentEnd - hedgeFundingWalletSegmentEnd) / hedgeFundingZoneReference) * 100,
          2
        )
      : 0;
  const hedgeFundingBroadSegmentPercent =
    hedgeFundingZoneReference > 0
      ? roundNumber(
          (Math.max(0, hedgeFundingCoveredEnd - Math.max(hedgeFundingWalletSegmentEnd, hedgeFundingAttestedSegmentEnd)) / hedgeFundingZoneReference) * 100,
          2
        )
      : 0;
  const hedgeFundingUncoveredSegmentPercent =
    hedgeFundingZoneReference > 0
      ? roundNumber((Math.max(0, hedgeFundingZoneReference - hedgeFundingCoveredEnd) / hedgeFundingZoneReference) * 100, 2)
      : 0;
  const displayWalletSegmentPercent = hedgeFocusActive ? hedgeFundingWalletSegmentPercent : tradeAmountWalletSegmentPercent;
  const displayAttestedSegmentPercent = hedgeFocusActive ? hedgeFundingAttestedSegmentPercent : tradeAmountAttestedSegmentPercent;
  const displayBroadSegmentPercent = hedgeFocusActive ? hedgeFundingBroadSegmentPercent : tradeAmountBroadSegmentPercent;
  const displayUncoveredSegmentPercent = hedgeFocusActive ? hedgeFundingUncoveredSegmentPercent : 0;
  const hedgeRatioBasePresets = [0.25, 0.5, 0.75, 1];
  const hedgeVisibleRatioPresets = hedgeRatioBasePresets.filter(
    (ratio) => !hedgeSizingReady || ratio <= hedgeMaxFundableRatio + 0.0001
  );
  const hedgeNeedsCustomMaxRatio =
    hedgeFocusActive &&
    hedgeSizingReady &&
    hedgeMaxFundableRatio > 0 &&
    hedgeMaxFundableRatio < 1 - 0.0001 &&
    !hedgeVisibleRatioPresets.some((ratio) => Math.abs(ratio - hedgeMaxFundableRatio) <= 0.005);
  const hedgeRatioOptions = hedgeNeedsCustomMaxRatio
    ? [...hedgeVisibleRatioPresets, hedgeMaxFundableRatio]
    : hedgeVisibleRatioPresets;
  const hedgeLiveTicketNotional = hedgeFocusActive && activePerpLeg
    ? roundNumber(routeEffectiveTicketNotional, 2)
    : 0;
  const hedgeActiveTicketNotional = activePerpLeg ? hedgeLiveTicketNotional : hedgeStagedTicketNotional;
  const hedgePlannedRatio = hedgeSizingReady && hedgeProtectedSleeveNotional > 0
    ? roundNumber(hedgeStagedTicketNotional / hedgeProtectedSleeveNotional, 4)
    : 0;
  const hedgeActualRatio = hedgeSizingReady && hedgeProtectedSleeveNotional > 0 && hedgeLiveTicketNotional > 0
    ? roundNumber(hedgeLiveTicketNotional / hedgeProtectedSleeveNotional, 4)
    : 0;
  const hedgeTargetProgressPct = hedgeSizingReady && hedgeSuggestedNotional > 0
    ? roundNumber((hedgeStagedTicketNotional / hedgeSuggestedNotional) * 100, 1)
    : 0;
  const hedgeGapToTarget = hedgeSizingReady
    ? roundNumber(Math.max(0, hedgeSuggestedNotional - hedgeActiveTicketNotional), 2)
    : 0;
  const hedgeResidualExposureValue = hedgeSizingReady
    ? roundNumber(Math.max(0, hedgeProtectedSleeveNotional - hedgeLiveTicketNotional), 2)
    : 0;
  const hedgeExcessNotionalValue = hedgeSizingReady
    ? roundNumber(Math.max(0, hedgeActiveTicketNotional - hedgeSuggestedNotional), 2)
    : 0;
  const hedgeTargetTolerance = Math.max(25, hedgeSuggestedNotional * 0.05);
  const hedgeTicketOnTarget =
    hedgeSizingReady &&
    hedgeSuggestedNotional > 0 &&
    Math.abs(hedgeActiveTicketNotional - hedgeSuggestedNotional) <= hedgeTargetTolerance;
  const hedgeStatus = !hedgeFocusActive
    ? 'Hedge off'
    : !hedgeSizingReady
      ? 'Pick anchor first'
      : hedgeSuggestedNotional <= 0
        ? 'No hedge target'
        : hedgeActiveTicketNotional <= 0
          ? 'Stage ticket'
          : hedgeTicketOnTarget
            ? activePerpLeg
              ? 'On target'
              : 'Ready to open'
            : hedgeActiveTicketNotional < hedgeSuggestedNotional
              ? activePerpLeg
                ? 'Under-hedged'
                : 'Under-staged'
              : activePerpLeg
                ? 'Over-hedged'
                : 'Over-staged';
  const hedgeProtectedSleeveLabel = hedgeFocusActive
    ? hedgeHasPaperNotionalBase
      ? hedgeHasMeaningfulOpenSleeve
        ? 'Paper notional override for the live sleeve'
        : 'Anchor bar + paper notional base'
      : hedgeHasMeaningfulOpenSleeve
        ? `${formatUnits(selectedPosition.units)} spot units already open`
        : 'Pick anchor + set protected sleeve'
    : '';
  const hedgeSleeveUnitsLabel = hedgeHasMeaningfulOpenSleeve
    ? formatUnits(selectedPosition.units)
    : '--';
  const hedgeRatioDisplayLabel = hedgeHasPaperNotionalBase
    ? 'Hedge size vs principal'
    : hedgeHasMeaningfulOpenSleeve
      ? 'Actual hedge size'
      : 'Preview hedge size';
  const hedgeSuggestedTool =
    hedgeFocusProfile?.setupRows?.find((row) => row.label === 'Suggested hedge')?.value || '--';
  const hedgeSettlementMode =
    hedgeFocusProfile?.setupRows?.find((row) => row.label === 'Settlement mode')?.value || '--';
  const effectiveHedgeType = hedgeTypeOverride === 'auto' ? getDefaultHedgeTypeForProduct(selectedProduct) : hedgeTypeOverride;
  const effectiveHedgeTypeOption = HEDGE_TYPE_OPTIONS.find((option) => option.id === effectiveHedgeType) || HEDGE_TYPE_OPTIONS[0];
  const hedgeTypeToolLabel = effectiveHedgeTypeOption?.tool || HEDGE_TYPE_LABELS[effectiveHedgeType] || 'Hedge tool';
  const hedgeTypeHintCopy =
    hedgeTypeOverride === 'auto'
      ? `Auto selected ${effectiveHedgeTypeOption?.label || 'the product-default hedge'}: ${effectiveHedgeTypeOption?.hint || effectiveHedgeTypeOption?.copy || ''}`
      : effectiveHedgeTypeOption?.hint || effectiveHedgeTypeOption?.copy || 'Choose the protection style that matches what can actually be traded.';
  const hedgeProtectionEffectiveness = Number(HEDGE_PROTECTION_EFFECTIVENESS[effectiveHedgeType] || 0.7);
  const hedgeProtectionRatio = hedgeSizingReady && hedgeProtectedSleeveNotional > 0
    ? roundNumber(Math.min(1, (hedgeActiveTicketNotional / hedgeProtectedSleeveNotional) * hedgeProtectionEffectiveness), 4)
    : 0;
  const hedgeProtectionTargetRatio = hedgeSizingReady && hedgeProtectedSleeveNotional > 0
    ? roundNumber(Math.min(1, (hedgeSuggestedNotional / hedgeProtectedSleeveNotional) * hedgeProtectionEffectiveness), 4)
    : 0;
  const hedgeAfterPreviewExposureValue = hedgeSizingReady
    ? roundNumber(Math.max(0, hedgeProtectedSleeveNotional - Math.min(hedgeProtectedSleeveNotional, hedgeStagedTicketNotional || hedgeSuggestedNotional)), 2)
    : 0;
  const hedgeDisplayedResidualExposureValue = activePerpLeg ? hedgeResidualExposureValue : hedgeAfterPreviewExposureValue;
  const hedgeResidualPreviewRatio = hedgeSizingReady && hedgeProtectedSleeveNotional > 0
    ? roundNumber(hedgeAfterPreviewExposureValue / hedgeProtectedSleeveNotional, 4)
    : 0;
  const hedgeResidualLiveRatio = hedgeSizingReady && hedgeProtectedSleeveNotional > 0
    ? roundNumber(hedgeResidualExposureValue / hedgeProtectedSleeveNotional, 4)
    : 0;
  const hedgeExposureCards = hedgeSizingReady
    ? [
        {
          label: 'Before hedge net exposure',
          value: `${formatNotional(hedgeProtectedSleeveNotional)} PT`,
          copy: 'This is the sleeve you are trying to protect before any short / perp offset.',
          tone: ''
        },
        {
          label: 'After hedge net exposure',
          value: `${formatNotional(activePerpLeg ? hedgeResidualExposureValue : hedgeAfterPreviewExposureValue)} PT`,
          copy: activePerpLeg
            ? 'Uses the currently open hedge ticket.'
            : 'Preview uses the staged ticket. Hedge size buttons fill the target; Use suggested is still available as a reset.',
          tone: activePerpLeg ? 'risk-low' : 'risk-medium'
        },
        {
          label: 'Residual exposure',
          value: formatPercent(activePerpLeg ? hedgeResidualLiveRatio : hedgeResidualPreviewRatio, 1),
          copy: activePerpLeg
            ? 'What remains exposed after the live hedge.'
            : 'What would remain exposed if the staged hedge is opened.',
          tone: hedgeStatus === 'Over-hedged' ? 'risk-high' : hedgeStatus === 'On target' ? 'risk-low' : 'risk-medium'
        }
      ]
    : [];
  const hedgeGapTone =
    hedgeStatus === 'Over-hedged' || hedgeStatus === 'Over-staged'
      ? 'risk-high'
      : hedgeGapToTarget <= hedgeTargetTolerance
        ? 'risk-low'
        : 'risk-medium';
  const hedgeStatusTone =
    hedgeStatus === 'On target' || hedgeStatus === 'Ready to open'
      ? 'risk-low'
      : hedgeStatus === 'Over-hedged' || hedgeStatus === 'Over-staged'
        ? 'risk-high'
        : hedgeStatus === 'Hedge off'
          ? ''
          : 'risk-medium';
  const hedgeExposureSuggestedPct = hedgeProtectedSleeveNotional > 0
    ? clampNumber((hedgeSuggestedNotional / hedgeProtectedSleeveNotional) * 100, 0, 100)
    : 0;
  const hedgeExposureCurrentPct = hedgeProtectedSleeveNotional > 0
    ? clampNumber((hedgeActiveTicketNotional / hedgeProtectedSleeveNotional) * 100, 0, 100)
    : 0;
  const hedgeFormulaCopy = hedgeSizingReady
    ? hedgeFullCoverageFundingGap > 0
      ? `Principal ${formatNotional(hedgeProtectedSleeveNotional)} PT cannot reach a 100% funded hedge here. Max fundable size is ${formatPercent(hedgeMaxFundableRatio, 0)} = ${formatNotional(tradeAmountSliderMax)} PT; uncovered at 100% target is ${formatNotional(hedgeFullCoverageFundingGap)} PT.`
      : `Principal ${formatNotional(hedgeProtectedSleeveNotional)} PT x hedge size ${formatPercent(Number(hedgeRatio || 0), 0)} = ${formatNotional(hedgeSuggestedNotional)} PT hedge ticket. Est. protection ${formatPercent(hedgeProtectionTargetRatio, 0)} after hedge fit.`
    : 'Pick a replay bar and set principal notional before staging the hedge ticket.';
  const hedgeSummaryRows = hedgeSizingReady
    ? [
        {
          label: 'Principal',
          value: `${formatNotional(hedgeProtectedSleeveNotional)} PT`
        },
        {
          label: 'Hedge ticket',
          value: `${formatNotional(hedgeSuggestedNotional)} PT`
        },
        {
          label: 'Protection est',
          value: formatPercent(hedgeProtectionRatio || hedgeProtectionTargetRatio, 0),
          tone: hedgeProtectionRatio > 0 ? 'risk-low' : ''
        },
        {
          label: 'Wallet hedge',
          value: `${formatNotional(hedgeWalletBackedTicketNotional)} PT`
        },
        {
          label: hedgeFlashTopUpNotional > 0 ? 'Flash top-up' : 'Flash needed',
          value: `${formatNotional(hedgeFlashTopUpNotional > 0 ? hedgeFlashTopUpNotional : hedgeFlashTopUpNeed)} PT`,
          tone: hedgeFlashTopUpNotional > 0 || hedgeFlashTopUpNeed > 0 ? 'risk-medium' : ''
        },
        {
          label: activePerpLeg ? 'Live hedge' : 'Staged hedge',
          value: `${formatNotional(hedgeActiveTicketNotional)} PT`
        },
        {
          label: hedgeExcessNotionalValue > 0 ? 'Excess' : 'Gap',
          value: `${formatNotional(hedgeExcessNotionalValue > 0 ? hedgeExcessNotionalValue : hedgeGapToTarget)} PT`,
          tone: hedgeGapTone
        }
      ]
    : [];
  const hedgeRiskRows = hedgeSizingReady
    ? [
        {
          label: 'Hedge tool',
          value: hedgeTypeToolLabel
        },
        {
          label: 'Hedge size',
          value: formatPercent(Number(hedgeRatio || 0), 0)
        },
        {
          label: 'Initial margin',
          value: `${formatNotional(routePostedBaseMarginCapital)} PT`
        },
        {
          label: 'Flash reserve',
          value: `${formatNotional(routePostedFlashReserveCapital)} PT`
        },
        {
          label: 'Leverage',
          value: routeLeverageMultiple === 1 ? 'No leverage' : `${routeLeverageMultiple}x`
        },
        {
          label: 'Net sleeve left',
          value: `${formatNotional(hedgeDisplayedResidualExposureValue)} PT`
        },
        {
          label: 'Status',
          value: hedgeStatus,
          tone: hedgeStatusTone
        }
      ]
    : [];
  const hedgeSetupCards = [
    { label: 'Suggested hedge', value: hedgeSuggestedTool },
    { label: 'Settlement mode', value: hedgeSettlementMode },
    { label: 'Suggested ticket', value: hedgeSizingReady ? `${formatNotional(hedgeSuggestedNotional)} PT` : '--' }
  ];
  const hedgeWorkflowCards = [
    {
      step: '1',
      title: 'Principal notional',
      value: hedgeSizingReady ? `${formatNotional(hedgeProtectedSleeveNotional)} PT` : selectedProduct.ticker,
      copy: 'Wallet and upfront drag first. Want more requires a signed principal-loan agreement before this sleeve can borrow.'
    },
    {
      step: '2',
      title: 'Hedge size',
      value: formatPercent(Number(hedgeRatio || 0), 0),
      copy: '25% means hedge ticket = 25% of principal, not 25% protection quality.'
    },
    {
      step: '3',
      title: 'Protection estimate',
      value: hedgeSizingReady ? formatPercent(hedgeProtectionRatio || hedgeProtectionTargetRatio, 0) : '--',
      copy: 'This adjusts the hedge size by direct/proxy/exit fit, so proxy hedges do not pretend to be perfect.'
    },
    {
      step: '4',
      title: 'Flash top-up',
      value: hedgeSizingReady ? `${formatNotional(hedgeFlashTopUpNotional > 0 ? hedgeFlashTopUpNotional : hedgeFlashTopUpNeed)} PT` : '--',
      copy: hedgeFlashTopUpNotional > 0
        ? 'This is the hedge loan after any principal loan has already reserved capacity.'
        : 'Only appears when the hedge ticket is larger than remaining hedge cash.'
    }
  ];
  const hedgeSecondaryMetricCards = hedgeSizingReady
    ? [
        { label: activePerpLeg ? 'Open hedge ticket' : 'Staged hedge ticket', value: `${formatNotional(hedgeActiveTicketNotional)} PT` },
        { label: 'Suggested size', value: `${formatNotional(hedgeSuggestedNotional)} PT` },
        { label: 'Initial margin', value: `${formatNotional(routePostedBaseMarginCapital)} PT` },
        { label: 'Leverage', value: routeLeverageMultiple === 1 ? 'No leverage' : `${routeLeverageMultiple}x` },
        {
          label: 'Status',
          value: hedgeStatus,
          valueClassName:
            hedgeStatus === 'On target'
              ? 'risk-low'
              : hedgeStatus === 'Over-hedged'
                ? 'risk-high'
                : hedgeStatus === 'Under-hedged'
                ? 'risk-medium'
                  : ''
        },
        {
          label: hedgeStatus === 'Over-hedged' ? 'Excess hedge' : activePerpLeg ? 'Live gap to suggested' : 'Staged gap to suggested',
          value: `${formatNotional(hedgeStatus === 'Over-hedged' ? hedgeExcessNotionalValue : hedgeGapToTarget)} PT`
        }
      ]
    : [];
  const currentFlashLoanContextKey = [
    selectedProductId,
    selectedAdvancedRoute,
    routeLeverageMultiple,
    roundNumber(Number(tradeAmount || 0), 2),
    roundNumber(Number(availableCash || 0), 2),
    roundNumber(hedgePrincipalFlashReservedNotional, 2),
    roundNumber(hedgeFlashTopUpRequiredNotional, 2)
  ].join('|');
  const flashLoanCollateralSupport = flashLoanQuoteRows[0]?.collateralSupport || 0;
  const activePerpEntryBar =
    selectedActivePerpEntry?.entryBar ||
    (selectedActivePerpEntryIndex >= 0 && selectedView?.bars?.length ? selectedView.bars[selectedActivePerpEntryIndex] : null);
  const activePerpSnapshotMarginCapital = roundNumber(
    Number(selectedActivePerpEntry?.marginCapital ?? routePostedBaseMarginCapital),
    2
  );
  const activePerpSnapshotLeverage = Number(selectedActivePerpEntry?.leverage || routeLeverageMultiple);
  const activePerpSnapshotTargetNotional = roundNumber(
    Number(selectedActivePerpEntry?.targetNotional ?? routePreviewTicketNotional),
    2
  );
  const activePerpSnapshotFlashLoanAmount = roundNumber(
    Number(selectedActivePerpEntry?.flashLoanAmount ?? routePreviewFlashNotional),
    2
  );
  const activePerpSnapshotFlashLoanFee = roundNumber(
    Number(selectedActivePerpEntry?.flashLoanFee ?? routePreviewFlashPremiumEstimate),
    2
  );
  const activePerpSnapshotFlashReserveCapital = roundNumber(
    Number(selectedActivePerpEntry?.flashReserveCapital ?? routePostedFlashReserveCapital),
    2
  );
  const activePerpSnapshotRouteMarginCapital = roundNumber(
    Number(selectedActivePerpEntry?.routeMarginCapital ?? routeMarginCapital),
    2
  );
  const timedExitLeverageEntryBar = activePerpEntryBar || timedExitAnchorBar;
  const timedExitLeverageHoldingDays =
    timedExitLeverageEntryBar && timedExitTargetBar
      ? Math.max(1, Math.round(getHoldingDays(timedExitLeverageEntryBar.ts, timedExitTargetBar.ts)))
      : timedExitActualHoldingDays;
  const timedExitLeveragedSnapshot = buildLeveragedReplaySnapshot({
    direction: leverageDirection,
    marginCapital: activePerpLeg ? activePerpSnapshotMarginCapital : routePostedBaseMarginCapital,
    leverage: activePerpLeg ? activePerpSnapshotLeverage : routeLeverageMultiple,
    entryBar: timedExitLeverageEntryBar,
    targetBar: timedExitTargetBar,
    holdingDays: timedExitLeverageHoldingDays,
    targetNotional: activePerpLeg ? activePerpSnapshotTargetNotional : routePreviewTicketNotional,
    flashLoanAmount: activePerpLeg ? activePerpSnapshotFlashLoanAmount : routePreviewFlashNotional,
    flashLoanFee: activePerpLeg ? activePerpSnapshotFlashLoanFee : routePreviewFlashPremiumEstimate
  });
  const replayFocusLeverageEntryBar = activePerpEntryBar || replayFocus.lockedBar || replayFocus.bar;
  const replayFocusLeverageHoldingDays =
    replayFocusLeverageEntryBar?.ts && replayFocus.bar?.ts
      ? Math.max(0, getHoldingDays(replayFocusLeverageEntryBar.ts, replayFocus.bar.ts))
      : 0;
  const replayFocusLeveragedSnapshot = buildLeveragedReplaySnapshot({
    direction: leverageDirection,
    marginCapital: activePerpLeg ? activePerpSnapshotMarginCapital : routePostedBaseMarginCapital,
    leverage: activePerpLeg ? activePerpSnapshotLeverage : routeLeverageMultiple,
    entryBar: replayFocusLeverageEntryBar,
    targetBar: replayFocus.bar,
    holdingDays: replayFocusLeverageHoldingDays,
    targetNotional: activePerpLeg ? activePerpSnapshotTargetNotional : routePreviewTicketNotional,
    flashLoanAmount: activePerpLeg ? activePerpSnapshotFlashLoanAmount : routePreviewFlashNotional,
    flashLoanFee: activePerpLeg ? activePerpSnapshotFlashLoanFee : routePreviewFlashPremiumEstimate
  });
  const deskSimulation = useMemo(
    () =>
      buildDeskSimulation({
        product: selectedProduct,
        guide: selectedProductGuide,
        routeId: selectedAdvancedRoute,
        structureMode: effectiveDeskStructureMode,
        amount: Number(simulationTradeAmount || 0),
        holdingDays: timedExitRequestedDays,
        riskPreference: simulationRiskPreference,
        allowLockup,
        acceptVolatility: acceptPrincipalVolatility,
        routeLeverage: contractLeverage,
        routeBufferRatio,
        routeSettlementMode,
        focusBar: replayFocus.bar,
        selectedView,
        rewardCredit,
        wealthDeskState: {
          ...wealthDeskState,
          paperCash: availableCash
        }
      }),
    [
      acceptPrincipalVolatility,
      allowLockup,
      availableCash,
      contractLeverage,
      effectiveDeskStructureMode,
      replayFocus.bar,
      rewardCredit,
      routeBufferRatio,
      routeSettlementMode,
      selectedAdvancedRoute,
      selectedProduct,
      selectedProductGuide,
      selectedView,
      simulationRiskPreference,
      timedExitRequestedDays,
      simulationTradeAmount,
      wealthDeskState
    ]
  );
  const takeHomeGuideBullets = [
    `Base case net result is ${formatSignedPercent(deskSimulation.baseRate * 100)} over ${timedExitRequestedDays}D, which would return about ${formatNotional(
      deskSimulation.exitValue
    )} PT from a ${formatNotional(Number(simulationTradeAmount || 0))} PT ticket.`,
    `This already includes entry drag ${formatNotional(deskSimulation.entryCost)} PT, ongoing fees ${formatNotional(
      deskSimulation.ongoingCost
    )} PT${deskSimulation.pledgeCarryCost > 0 ? `, pledge carry ${formatNotional(deskSimulation.pledgeCarryCost)} PT` : ''}${
      deskSimulation.estimatedTax > 0 ? `, and estimated tax ${formatNotional(deskSimulation.estimatedTax)} PT` : ''
    }.`,
    deskSimulation.earlyRedemptionFee > 0
      ? `If the position exits before the route clears ${selectedProductGuide.redemptionWindow} / lockup rules, the desk also applies about ${formatNotional(
          deskSimulation.earlyRedemptionFee
        )} PT in early-exit penalty.`
      : deskSimulation.modeledSlip > 0
        ? `This route also includes about ${formatNotional(
            deskSimulation.modeledSlip
          )} PT of modeled execution slip, so flash-style or routed exits need edge beyond the headline APY.`
        : deskSimulation.takeawayCopy,
    `Always read it next to the ${formatSignedPercent(deskSimulation.worstRate * 100)} to ${formatSignedPercent(
      deskSimulation.bestRate * 100
    )} range and this liquidity note: ${deskSimulation.liquidityStatus}`
  ];
  const feeRows = useMemo(() => {
    const rows = selectedProductGuide.feeBlueprint.map((row) => {
      let amount = 0;
      if (row.type === 'entry') amount = simulationTradeAmount * row.rate;
      if (row.type === 'annual') amount = simulationTradeAmount * row.rate * (timedExitRequestedDays / 365);
      if (row.type === 'performance') amount = deskSimulation.performanceFee;
      if (row.type === 'conditional') amount = deskSimulation.earlyRedemptionFee;

      return {
        ...row,
        amount: roundNumber(amount, 2)
      };
    });

    if (deskSimulation.pledgeCarryCost > 0) {
      rows.push({
        label: 'Wealth pledge carry',
        rate: deskSimulation.fundingBreakdown.wealthReceiptSupportApy,
        type: 'annual',
        amount: deskSimulation.pledgeCarryCost
      });
    }

    return rows;
  }, [
    deskSimulation.earlyRedemptionFee,
    deskSimulation.fundingBreakdown.wealthReceiptSupportApy,
    deskSimulation.performanceFee,
    deskSimulation.pledgeCarryCost,
    selectedProductGuide.feeBlueprint,
    timedExitRequestedDays,
    simulationTradeAmount
  ]);
  const yieldRows = useMemo(
    () =>
      selectedProductGuide.yieldSources.map((row) => ({
        ...row,
        amount: roundNumber(simulationTradeAmount * row.rate * (timedExitRequestedDays / 365), 2)
      })),
    [selectedProductGuide.yieldSources, timedExitRequestedDays, simulationTradeAmount]
  );
  const contractPreview = useMemo(() => {
    if (!replayFocus.bar || routeMarginCapital <= 0) return null;
    const previewEntryBar = activePerpLeg ? replayFocusLeverageEntryBar : replayFocus.bar;
    const snapshot = buildLeveragedReplaySnapshot({
      direction: leverageDirection,
      marginCapital: activePerpLeg ? activePerpSnapshotMarginCapital : routePostedBaseMarginCapital,
      leverage: activePerpLeg ? activePerpSnapshotLeverage : routeLeverageMultiple,
      entryBar: previewEntryBar,
      targetBar: timedExitTargetBar || replayFocus.bar,
      holdingDays:
        previewEntryBar?.ts && (timedExitTargetBar || replayFocus.bar)?.ts
          ? Math.max(0, getHoldingDays(previewEntryBar.ts, (timedExitTargetBar || replayFocus.bar).ts))
          : timedExitActualHoldingDays,
      targetNotional: activePerpLeg ? activePerpSnapshotTargetNotional : routePreviewTicketNotional,
      flashLoanAmount: activePerpLeg ? activePerpSnapshotFlashLoanAmount : routePreviewFlashNotional,
      flashLoanFee: activePerpLeg ? activePerpSnapshotFlashLoanFee : routePreviewFlashPremiumEstimate
    });

    if (!snapshot) return null;

    return {
      ...snapshot,
      freeCash: routeMarginWalletFreeCash
    };
  }, [
    activePerpLeg,
    activePerpSnapshotFlashLoanAmount,
    activePerpSnapshotFlashLoanFee,
    activePerpSnapshotLeverage,
    activePerpSnapshotMarginCapital,
    activePerpSnapshotTargetNotional,
    leverageDirection,
    replayFocus.bar,
    replayFocusLeverageEntryBar,
    routeLeverageMultiple,
    routePreviewFlashNotional,
    routePreviewFlashPremiumEstimate,
    routePreviewTicketNotional,
    routePostedBaseMarginCapital,
    routeMarginWalletFreeCash,
    timedExitActualHoldingDays,
    timedExitTargetBar
  ]);
  const contractAvailable = ['public', 'leverage', 'strategy'].includes(selectedProduct.lane);
  function buildPerpRiskIntentKey({
    direction = leverageDirection,
    flashNotional = flashLoanAppliedTicketNotional
  } = {}) {
    const safeFlashNotional = roundNumber(Math.max(0, Number(flashNotional || 0)), 2);
    const proposedFlashReserveCapital = roundNumber(safeFlashNotional * FLASH_TICKET_RESERVE_RATE, 2);
    const proposedRouteMarginCapital = roundNumber(
      routePostedBaseMarginCapital + Math.min(routeMarginWalletFreeCashBeforeFlash, proposedFlashReserveCapital),
      2
    );
    return [
      selectedProductId,
      direction,
      routeLeverageMultiple,
      roundNumber(Number(tradeAmount || 0), 2),
      roundNumber(routeRequiredBaseMarginCapital + proposedFlashReserveCapital, 2),
      roundNumber(proposedRouteMarginCapital, 2),
      safeFlashNotional
    ].join('|');
  }

  const currentPerpRiskIntentKey = buildPerpRiskIntentKey();
  const hasPerpRiskApproval = Boolean(perpRiskApproval.signature) && perpRiskApproval.key === currentPerpRiskIntentKey;

  async function ensurePerpRiskApproval({
    direction = leverageDirection,
    flashNotional = flashLoanAppliedTicketNotional,
    reason = 'confirm this leverage route'
  } = {}) {
    const safeFlashNotional = roundNumber(Math.max(0, Number(flashNotional || 0)), 2);
    const proposedFlashReserveCapital = roundNumber(safeFlashNotional * FLASH_TICKET_RESERVE_RATE, 2);
    const proposedRouteRequiredMarginCapital = roundNumber(routeRequiredBaseMarginCapital + proposedFlashReserveCapital, 2);
    const proposedRouteMarginCapital = roundNumber(
      routePostedBaseMarginCapital + Math.min(routeMarginWalletFreeCashBeforeFlash, proposedFlashReserveCapital),
      2
    );
    const needsRiskAck = routeLeverageMultiple > 1 || safeFlashNotional > 0;

    if (!needsRiskAck) return true;

    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so this wallet can sign the leverage-risk acknowledgement.');
      return false;
    }

    const intentKey = buildPerpRiskIntentKey({
      direction,
      flashNotional: safeFlashNotional
    });

    if (perpRiskApproval.key === intentKey && perpRiskApproval.signature) {
      return true;
    }

    try {
      const signature = await signMessageAsync({
        message: [
          'RiskLens replay leverage risk acknowledgement',
          `Wallet: ${address}`,
          `Product: ${selectedProduct.ticker}`,
          `Direction: ${direction}`,
          `Wallet-backed ticket: ${formatNotional(routeBaseNotional)} PT`,
          `Flash-attached notional: ${formatNotional(safeFlashNotional)} PT`,
          `Effective ticket notional: ${formatNotional(routeBaseNotional + safeFlashNotional)} PT`,
          `Leverage: ${routeLeverageMultiple === 1 ? 'No leverage' : `${routeLeverageMultiple}x`}`,
          `Initial margin required: ${formatNotional(routeRequiredBaseMarginCapital)} PT`,
          `Flash reserve required: ${formatNotional(proposedFlashReserveCapital)} PT`,
          `Total margin required: ${formatNotional(proposedRouteRequiredMarginCapital)} PT`,
          `Wallet-posted margin: ${formatNotional(proposedRouteMarginCapital)} PT`,
          `Flash attached: ${formatNotional(safeFlashNotional)} PT`,
          `Reason: ${reason}`,
          'If credit stays bound to a contract-attested exchange route, it can cover eligible same-purpose products in this venue while still justifying the lower fee lane. Broad flash credit stays more expensive because its final use is not restricted or proven.',
          'I understand liquidation, funding, fee drag, flash premium, and flash reserve risk inside this replay route.'
        ].join('\n')
      });

      setPerpRiskApproval({
        key: intentKey,
        signature,
        signedAt: new Date().toISOString()
      });
      setFeedback(
        `${selectedProduct.ticker} leverage risk signed. This wallet can now ${reason.toLowerCase()} with the current margin, leverage, and flash setup.`
      );
      return true;
    } catch (riskError) {
      const riskMessage = String(riskError?.shortMessage || riskError?.message || '');
      setFeedback(
        riskMessage.toLowerCase().includes('rejected')
          ? 'Risk acknowledgement was rejected in MetaMask, so the leverage route stayed unchanged.'
          : riskMessage || 'MetaMask could not sign the leverage-risk acknowledgement.'
      );
      return false;
    }
  }

  async function ensureReplayTradeSignature({
    side = 'buy',
    tradeBar = replayFocus.bar,
    tradeInterval = selectedView?.interval,
    notional = tradeAmount,
    unitsPreview = 0,
    feeBreakdown = []
  } = {}) {
    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so this wallet can sign the replay trade.');
      return false;
    }

    try {
      const feeLines = formatFeeDisclosureLines(feeBreakdown);
      const feeTotal = getFeeDisclosureTotal(feeBreakdown);
      await signMessageAsync({
        message: [
          'RiskLens replay trade confirmation',
          `Wallet: ${address}`,
          `Product: ${selectedProduct.ticker}`,
          `Side: ${side}`,
          `Anchor: ${formatReplayDate(tradeBar?.ts, tradeInterval)}`,
          `Mark: ${formatPrice(tradeBar?.close)}`,
          `Paper notional: ${formatNotional(notional)} PT`,
          `Estimated units: ${formatUnits(unitsPreview)}`,
          ...(feeLines.length
            ? [
                'Fee deduction summary:',
                ...feeLines,
                `Total listed deductions: ${formatNotional(feeTotal)} PT`
              ]
            : []),
          'This confirms a replay-only ledger update and does not send a live market order.'
        ].join('\n')
      });

      return true;
    } catch (tradeError) {
      const tradeMessage = String(tradeError?.shortMessage || tradeError?.message || '');
      setFeedback(
        tradeMessage.toLowerCase().includes('rejected')
          ? 'Replay trade signature was rejected in MetaMask, so the ticket stayed unchanged.'
          : tradeMessage || 'MetaMask could not sign this replay trade.'
      );
      return false;
    }
  }

  async function ensurePerpTradeSignature({
    direction = leverageDirection,
    action = 'open',
    flashNotional = flashLoanAppliedTicketNotional,
    reason = action === 'close' ? 'close this leveraged leg' : `open a ${direction} leveraged leg`,
    feeBreakdown = []
  } = {}) {
    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so this wallet can sign the leveraged replay trade.');
      return false;
    }

    try {
      const feeLines = formatFeeDisclosureLines(feeBreakdown);
      const feeTotal = getFeeDisclosureTotal(feeBreakdown);
      await signMessageAsync({
        message: [
          'RiskLens replay leverage trade confirmation',
          `Wallet: ${address}`,
          `Product: ${selectedProduct.ticker}`,
          `Action: ${action} ${direction}`,
          `Anchor: ${formatReplayDate(replayFocus.lockedBar?.ts || replayFocus.bar?.ts, selectedView?.interval)}`,
          `Wallet-backed ticket: ${formatNotional(routeBaseNotional)} PT`,
          `Flash-attached notional: ${formatNotional(Math.max(0, Number(flashNotional || 0)))} PT`,
          `Effective ticket notional: ${formatNotional(routeBaseNotional + Math.max(0, Number(flashNotional || 0)))} PT`,
          `Leverage: ${routeLeverageMultiple === 1 ? 'No leverage' : `${routeLeverageMultiple}x`}`,
          `Initial margin required: ${formatNotional(routeRequiredBaseMarginCapital)} PT`,
          `Route-posted margin: ${formatNotional(routeMarginCapital)} PT`,
          `Credit lane: ${selectedTradeAmountMaxLabel}`,
          `Reason: ${reason}`,
          ...(feeLines.length
            ? [
                'Final settlement deductions:',
                ...feeLines,
                `Total listed deductions: ${formatNotional(feeTotal)} PT`
              ]
            : []),
          'This confirms a replay-only leverage route. It does not submit a live exchange order.'
        ].join('\n')
      });

      return true;
    } catch (tradeError) {
      const tradeMessage = String(tradeError?.shortMessage || tradeError?.message || '');
      setFeedback(
        tradeMessage.toLowerCase().includes('rejected')
          ? 'Leverage trade signature was rejected in MetaMask, so the route stayed unchanged.'
          : tradeMessage || 'MetaMask could not sign this leverage trade.'
      );
      return false;
    }
  }

  const replayPanels = useMemo(() => {
    return [
      {
        id: 'desk',
        title: 'Replay desk',
        description: 'Choose a start point, size the ticket, and move through the historical path from there.'
      },
      {
        id: 'lookthrough',
        title: 'Underlying look-through',
        description: 'See what sleeve or exposure the user is effectively buying.'
      },
      {
        id: 'math',
        title: 'Take-home math',
        description: 'Show fee drag, tax lens, and why gross return differs from net.'
      },
      {
        id: 'diligence',
        title: 'AI diligence',
        description: 'Keep trust questions and investor worries visible before trading.'
      },
      {
        id: 'automation',
        title: 'Automation and rights',
        description: 'Show strategy automation, token rights, and venue logic in one place.'
      },
      {
        id: 'contract',
        title: 'Contract and DeFi lab',
        description: 'Unlock perp, lending, borrow, and routing lessons once the base collectible is claimed.'
      }
    ];
  }, []);
  useEffect(() => {
    if (selectedReplayPanel && !replayPanels.some((panel) => panel.id === selectedReplayPanel)) {
      setSelectedReplayPanel(replayPanels[0]?.id || 'desk');
    }
  }, [replayPanels, selectedReplayPanel]);

  useEffect(() => {
    if (!isPlaying || hoveredReplayIndex == null) return;
    setHoveredReplayIndex(null);
  }, [hoveredReplayIndex, isPlaying]);

  useEffect(() => {
    if (selectedRewardTaskId == null) return;
    if (!replayAchievements.some((achievement) => achievement.id === selectedRewardTaskId)) {
      setSelectedRewardTaskId(replayAchievements[0]?.id || null);
    }
  }, [replayAchievements, selectedRewardTaskId]);

  useEffect(() => {
    if (!availableReplayRoutes.some((route) => route.id === selectedAdvancedRoute)) {
      setSelectedAdvancedRoute(selectedProductRoutePlaybook.defaultRoute);
    }
  }, [advancedRoutesUnlocked, availableReplayRoutes, selectedAdvancedRoute, selectedProductRoutePlaybook.defaultRoute]);

  useEffect(() => {
    if (!hedgeFocusActive) {
      setHedgeDiligencePulse(false);
      return;
    }
    setDiligencePagerIndex(0);
    setHedgeDiligencePulse(true);
    const timeoutId = window.setTimeout(() => setHedgeDiligencePulse(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [hedgeFocusActive]);

  useEffect(() => {
    const nextOptions = buildRouteStructureOptions(selectedProduct, selectedProductGuide, selectedAdvancedRoute);
    if (!nextOptions.some((option) => option.id === deskStructureMode)) {
      setDeskStructureMode(nextOptions[0]?.id || 'single');
    }
  }, [deskStructureMode, selectedAdvancedRoute, selectedProduct, selectedProductGuide]);

  useEffect(() => {
    const nextOptions = REPLAY_ROUTE_FOCUS_OPTIONS[selectedAdvancedRoute] || [];
    if (!nextOptions.length) return;
    const currentFocus = selectedRouteFocusByRoute[selectedAdvancedRoute];
    if (!nextOptions.some((option) => option.id === currentFocus)) {
      setSelectedRouteFocusByRoute((current) => ({
        ...current,
        [selectedAdvancedRoute]: nextOptions[0].id
      }));
    }
  }, [selectedAdvancedRoute, selectedRouteFocusByRoute, visiblePerpFocusOptions]);

  useEffect(() => {
    if (selectedAdvancedRoute !== 'borrow') return;
    const defaults = getOptionStrategyDefaults(selectedStrategyTemplateId);
    setStrategyDownsidePct(defaults.downsidePct);
    setStrategyProfitHarvestPct(defaults.profitHarvestPct);
    setStrategyUpsideCapPct(defaults.upsideCapPct);
    setStrategyPremiumPct(defaults.premiumPct);
    setStrategyStrikePct(defaults.strikePct);
  }, [selectedAdvancedRoute, selectedStrategyTemplateId]);

  useEffect(() => {
    if (REPLAY_LANE_OPTIONS.some((lane) => lane.id === selectedLane)) return;
    setSelectedLane(REPLAY_LANE_OPTIONS[0]?.id || 'spot');
  }, [selectedLane]);

  useEffect(() => {
    setActivePerpLeg(null);
    setActivePerpPurpose(null);
    setActivePerpEntry(null);
  }, [selectedAdvancedRoute, selectedProductId]);

  useEffect(() => {
    if (!activePerpLeg && activePerpPurpose) {
      setActivePerpPurpose(null);
    }
    if (!activePerpLeg && activePerpEntry) {
      setActivePerpEntry(null);
    }
  }, [activePerpEntry, activePerpLeg, activePerpPurpose]);

  useEffect(() => {
    const nextPreview = Math.max(0, roundNumber(Math.min(2500, Number(routeMaxWalletBackedNotional || availableCash || 2500)), 2));
    setHedgePreviewSleeveNotional(nextPreview);
    setHedgePreviewSleeveInput(String(nextPreview));
  }, [selectedProductId]);

  useEffect(() => {
    setTradeAmountMaxApplied(false);
    if (leverageRouteActive && hedgeFocusActive) {
      setTradeAmountMaxMode('hedge');
      return;
    }

    if (!leverageRouteActive || tradeAmountMaxMode === 'hedge') {
      setTradeAmountMaxMode('wallet');
    }
  }, [hedgeFocusActive, leverageRouteActive, selectedProductId, tradeAmountMaxMode]);

  useEffect(() => {
    if (!hedgeFocusActive || !hedgeSizingReady) return;
    if (Number(tradeAmount || 0) <= tradeAmountSliderMax + 0.01) return;
    const clampedAmount = Math.max(0, roundNumber(tradeAmountSliderMax, 2));
    setTradeAmount(clampedAmount);
    setTradeAmountInput(String(clampedAmount));
    setTradeAmountMaxApplied(false);
  }, [hedgeFocusActive, hedgeSizingReady, tradeAmount, tradeAmountSliderMax]);

  useEffect(() => {
    if (!hedgeFocusActive || !hedgeSizingReady) return;
    const cappedRatio = roundNumber(Math.max(0, Number(hedgeMaxFundableRatio || 0)), 4);
    if (Number(hedgeRatio || 0) <= cappedRatio + 0.0001) return;
    setHedgeRatio(cappedRatio);
  }, [hedgeFocusActive, hedgeMaxFundableRatio, hedgeRatio, hedgeSizingReady]);

  useEffect(() => {
    if (!hedgeFocusActive) {
      hedgeFocusSyncedRef.current = false;
      return;
    }

    if (hedgeFocusSyncedRef.current || !hedgeSizingReady || hedgeSuggestedNotional <= 0) return;

    const nextSuggested = roundNumber(
      Math.min(
        hedgeSuggestedNotional,
        Math.max(0, tradeAmountSliderMax || hedgeTargetCap || hedgeSuggestedNotional)
      ),
      2
    );
    setTradeAmountMaxApplied(false);
    setTradeAmount(nextSuggested);
    setTradeAmountInput(String(nextSuggested));
    hedgeFocusSyncedRef.current = true;
  }, [hedgeFocusActive, hedgeSizingReady, hedgeSuggestedNotional, hedgeTargetCap, tradeAmountSliderMax]);

  useEffect(() => {
    setFlashLoanQuoteOpen(false);
    setFlashLoanTicketConfirmOpen(false);
    setFlashLoanDraftQuotes({});
    setFlashLoanAppliedQuotes({});
    setPendingPerpDirectionAfterQuote(null);
    setPendingPerpTradeConfirm(null);
    setPendingPerpRiskConfirm(null);
    setPendingBuyTrade(null);
    setHedgePrincipalFlashEnabled(false);
    setHedgePrincipalLoanApproval({
      key: '',
      signature: '',
      signedAt: '',
      maxNotional: 0
    });
    flashLoanQuoteContextRef.current = '';
    setPerpRiskApproval({
      key: '',
      signature: '',
      signedAt: ''
    });
  }, [selectedProductId]);

  useEffect(() => {
    if (!leverageRouteActive) {
      setFlashLoanTicketConfirmOpen(false);
      setFlashLoanQuoteOpen(false);
      setFlashLoanDraftQuotes({});
      setFlashLoanAppliedQuotes({});
      setPendingPerpDirectionAfterQuote(null);
      setPendingPerpTradeConfirm(null);
      setPendingPerpRiskConfirm(null);
      setHedgePrincipalFlashEnabled(false);
      setHedgePrincipalLoanApproval({
        key: '',
        signature: '',
        signedAt: '',
        maxNotional: 0
      });
      flashLoanQuoteContextRef.current = '';
      setPerpRiskApproval({
        key: '',
        signature: '',
        signedAt: ''
      });
      return;
    }

    if (flashLoanAttachableMaxNotional <= 0) {
      setFlashLoanAppliedQuotes({});
      setFlashLoanDraftQuotes({});
      flashLoanQuoteContextRef.current = '';
      setFlashLoanTicketConfirmOpen(false);
      if (flashLoanQuoteOpen) {
        setFlashLoanQuoteOpen(false);
      }
    } else if (
      flashLoanAppliedTicketNotional > flashLoanAttachableMaxNotional ||
      flashLoanAppliedInputNotional > flashLoanAppliedTicketNotional + 0.01
    ) {
      const nextApplied = allocateFlashQuotesByRate(
        flashLoanAppliedQuotes,
        flashLoanAttachableMaxNotional,
        flashLoanQuoteRows,
        flashLoanQuoteCaps
      );
      setFlashLoanAppliedQuotes(nextApplied);
      setFlashLoanDraftQuotes(nextApplied);
    }
  }, [
    flashLoanAppliedQuotes,
    flashLoanAppliedInputNotional,
    flashLoanAppliedTicketNotional,
    flashLoanAttachableMaxNotional,
    flashLoanQuoteMaxNotional,
    flashLoanQuoteCaps,
    flashLoanQuoteRows,
    flashLoanQuoteOpen,
    leverageRouteActive
  ]);

  useEffect(() => {
    if (!flashLoanQuoteContextRef.current) return;
    if (flashLoanQuoteContextRef.current === currentFlashLoanContextKey) return;

    if (!hasFlashLoanQuoteState) {
      flashLoanQuoteContextRef.current = '';
      return;
    }

    setFlashLoanAppliedQuotes({});
    setFlashLoanDraftQuotes({});
    setFlashLoanQuoteOpen(false);
    setFlashLoanTicketConfirmOpen(false);
    flashLoanQuoteContextRef.current = '';
    setFeedback('Principal, hedge ticket, or leverage changed. Flash quote was cleared, so please requote for this hedge ticket.');
  }, [currentFlashLoanContextKey, hasFlashLoanQuoteState]);

  useEffect(() => {
    if (!hedgePrincipalFlashEnabled) return;
    if (hedgePrincipalLoanApprovalValid) return;

    setHedgePrincipalFlashEnabled(false);
    setHedgePrincipalLoanApproval({
      key: '',
      signature: '',
      signedAt: '',
      maxNotional: 0
    });
  }, [hedgePrincipalFlashEnabled, hedgePrincipalLoanApprovalValid]);

  useEffect(() => {
    if (!perpRiskApproval.key) return;
    if (perpRiskApproval.key !== currentPerpRiskIntentKey) {
      setPerpRiskApproval({
        key: '',
        signature: '',
        signedAt: ''
      });
    }
  }, [currentPerpRiskIntentKey, perpRiskApproval.key]);

  function updateSimulationHoldingDays(nextDays, { showToast = true } = {}) {
    const numericDays = Number(nextDays);
    const requestedDays = Math.max(0, Math.round(Number.isFinite(numericDays) ? numericDays : 0));
    setSimulationHoldingDays(requestedDays);
    setSimulationHoldingDaysInput(String(requestedDays));

    if (showToast && requestedDays > timedExitMaxHoldingDays) {
      setTimedExitRangeToast(`Exit day exceeds the visible replay window. This chart only shows about ${timedExitMaxHoldingDays}D ahead.`);
    }
  }

  function handleSimulationHoldingDaysInputChange(nextValue, { showToast = true } = {}) {
    const rawValue = String(nextValue ?? '');
    setSimulationHoldingDaysInput(rawValue);

    if (rawValue === '') {
      setSimulationHoldingDays(0);
      return;
    }

    const numericDays = Number(rawValue);
    const requestedDays = Math.max(0, Math.round(Number.isFinite(numericDays) ? numericDays : 0));
    setSimulationHoldingDays(requestedDays);

    if (showToast && requestedDays > timedExitMaxHoldingDays) {
      setTimedExitRangeToast(`Exit day exceeds the visible replay window. This chart only shows about ${timedExitMaxHoldingDays}D ahead.`);
    }
  }

  function handleSimulationHoldingDaysBlur() {
    if (simulationHoldingDaysInput === '') {
      setSimulationHoldingDays(0);
      setSimulationHoldingDaysInput('0');
      return;
    }

    const normalizedDays = Math.max(0, Math.round(Number(simulationHoldingDaysInput || 0)));
    setSimulationHoldingDays(normalizedDays);
    setSimulationHoldingDaysInput(String(normalizedDays));
  }

  function cancelPendingTradeAmountSliderCommit() {
    tradeAmountSliderPendingRef.current = null;
    if (typeof window === 'undefined' || tradeAmountSliderFrameRef.current === null) return;
    window.cancelAnimationFrame(tradeAmountSliderFrameRef.current);
    tradeAmountSliderFrameRef.current = null;
  }

  function commitTradeAmountValue(nextAmount) {
    setTradeAmountMaxApplied(false);
    setTradeAmount(nextAmount);
    setTradeAmountInput(String(nextAmount));
  }

  function scheduleTradeAmountSliderCommit(nextAmount) {
    tradeAmountSliderPendingRef.current = nextAmount;

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      const pendingAmount = tradeAmountSliderPendingRef.current;
      tradeAmountSliderPendingRef.current = null;
      commitTradeAmountValue(pendingAmount);
      return;
    }

    if (tradeAmountSliderFrameRef.current !== null) return;

    tradeAmountSliderFrameRef.current = window.requestAnimationFrame(() => {
      tradeAmountSliderFrameRef.current = null;
      const pendingAmount = tradeAmountSliderPendingRef.current;
      tradeAmountSliderPendingRef.current = null;
      commitTradeAmountValue(pendingAmount);
    });
  }

  const cancelPendingHoveredReplayIndexCommit = useCallback(() => {
    hoveredReplayIndexPendingRef.current = null;
    if (typeof window === 'undefined' || hoveredReplayIndexFrameRef.current === null) return;
    window.cancelAnimationFrame(hoveredReplayIndexFrameRef.current);
    hoveredReplayIndexFrameRef.current = null;
  }, []);

  const commitHoveredReplayIndexValue = useCallback((nextIndex) => {
    const normalizedIndex = nextIndex === null || nextIndex === undefined ? null : Number(nextIndex);
    const safeIndex = Number.isFinite(normalizedIndex) ? normalizedIndex : null;
    if (hoveredReplayIndexValueRef.current === safeIndex) return;
    hoveredReplayIndexValueRef.current = safeIndex;
    setHoveredReplayIndex(safeIndex);
  }, []);

  const scheduleHoveredReplayIndexChange = useCallback(
    (nextIndex) => {
      const normalizedIndex = nextIndex === null || nextIndex === undefined ? null : Number(nextIndex);
      hoveredReplayIndexPendingRef.current = Number.isFinite(normalizedIndex) ? normalizedIndex : null;

      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        const pendingIndex = hoveredReplayIndexPendingRef.current;
        hoveredReplayIndexPendingRef.current = null;
        commitHoveredReplayIndexValue(pendingIndex);
        return;
      }

      if (hoveredReplayIndexFrameRef.current !== null) return;

      hoveredReplayIndexFrameRef.current = window.requestAnimationFrame(() => {
        hoveredReplayIndexFrameRef.current = null;
        const pendingIndex = hoveredReplayIndexPendingRef.current;
        hoveredReplayIndexPendingRef.current = null;
        commitHoveredReplayIndexValue(pendingIndex);
      });
    },
    [commitHoveredReplayIndexValue]
  );

  function cancelPendingHedgeSleeveSliderCommit() {
    hedgeSleeveSliderPendingRef.current = null;
    if (typeof window === 'undefined' || hedgeSleeveSliderFrameRef.current === null) return;
    window.cancelAnimationFrame(hedgeSleeveSliderFrameRef.current);
    hedgeSleeveSliderFrameRef.current = null;
  }

  function commitHedgeSleeveValue(nextAmount) {
    setHedgePreviewSleeveNotional(nextAmount);
    setHedgePreviewSleeveInput(String(nextAmount));
  }

  function scheduleHedgeSleeveSliderCommit(nextAmount) {
    hedgeSleeveSliderPendingRef.current = nextAmount;

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      const pendingAmount = hedgeSleeveSliderPendingRef.current;
      hedgeSleeveSliderPendingRef.current = null;
      commitHedgeSleeveValue(pendingAmount);
      return;
    }

    if (hedgeSleeveSliderFrameRef.current !== null) return;

    hedgeSleeveSliderFrameRef.current = window.requestAnimationFrame(() => {
      hedgeSleeveSliderFrameRef.current = null;
      const pendingAmount = hedgeSleeveSliderPendingRef.current;
      hedgeSleeveSliderPendingRef.current = null;
      commitHedgeSleeveValue(pendingAmount);
    });
  }

  function handleTradeAmountInputChange(nextValue) {
    cancelPendingTradeAmountSliderCommit();
    const rawValue = String(nextValue ?? '');
    setTradeAmountMaxApplied(false);
    setTradeAmountInput(rawValue);

    if (rawValue === '') {
      setTradeAmount(0);
      return;
    }

    const numericAmount = Number(rawValue);
    const requestedAmount = Math.max(0, roundNumber(Number.isFinite(numericAmount) ? numericAmount : 0, 2));
    setTradeAmount(requestedAmount);
  }

  function handleHedgePreviewSleeveInputChange(nextValue) {
    cancelPendingHedgeSleeveSliderCommit();
    const rawValue = String(nextValue ?? '');
    setHedgePreviewSleeveInput(rawValue);

    if (rawValue === '') {
      setHedgePreviewSleeveNotional(0);
      return;
    }

    const numericAmount = Number(rawValue);
    const requestedAmount = Math.max(0, roundNumber(Number.isFinite(numericAmount) ? numericAmount : 0, 2));
    setHedgePreviewSleeveNotional(requestedAmount);
  }

  function handleHedgePreviewSleeveSliderChange(nextValue) {
    const nextAmount = Math.max(0, roundNumber(Number(nextValue || 0), 2));
    scheduleHedgeSleeveSliderCommit(nextAmount);
  }

  async function handleToggleHedgePrincipalFlash() {
    setTradeAmountMaxApplied(false);

    if (!hedgePrincipalFlashEnabled && hedgePrincipalLoanApprovalValid && hedgePrincipalSignedLoanBudget > hedgeExistingPrincipalLoan + 0.01) {
      setHedgePrincipalFlashEnabled(true);
      setFeedback(
        `Principal loan is on under the signed agreement. The sleeve can borrow up to ${formatNotional(
          hedgePrincipalSignedLoanBudget
        )} PT from the fixed pool before the hedge quote uses the remainder.`
      );
      return;
    }

    if (!hedgePrincipalFlashEnabled) {
      if (!advancedActivityEnabled) {
        setFeedback(advancedActivityUnlockCopy);
        return;
      }

      if (principalFlashTotalBudget <= hedgeExistingPrincipalLoan + 0.01) {
        setFeedback('The fixed loan pool has no unused capacity for sleeve principal. Lower the sleeve or close existing borrowed principal first.');
        return;
      }

      if (!isConnected || !address) {
        setFeedback('Connect MetaMask first so the principal-loan agreement can be signed before Want more increases sleeve size.');
        return;
      }

      const maxPrincipalLoan = roundNumber(Math.max(0, principalFlashTotalBudget), 2);
      const requestedPrincipalLoan = roundNumber(
        Math.min(
          maxPrincipalLoan,
          Math.max(0, Number(hedgePreviewSleeveNotional || 0) - hedgePrincipalWalletMaxForFunding)
        ),
        2
      );

      try {
        const signature = await signMessageAsync({
          message: [
            'RiskLens hedge sleeve principal-loan agreement',
            `Wallet: ${address}`,
            `Product: ${selectedProduct.ticker}`,
            `Sleeve principal target: ${formatNotional(hedgePreviewSleeveNotional)} PT`,
            `Wallet sleeve max after upfront drag: ${formatNotional(hedgePrincipalWalletMaxForFunding)} PT`,
            `Requested principal loan now: ${formatNotional(requestedPrincipalLoan)} PT`,
            `Maximum signed principal loan: ${formatNotional(maxPrincipalLoan)} PT`,
            `Fixed loan pool shared with hedge top-up: ${formatNotional(principalFlashTotalBudget)} PT`,
            'This is a replay-only agreement. It lets sleeve principal borrow from the fixed pool, and the later hedge can only borrow what remains.'
          ].join('\n')
        });

        setHedgePrincipalLoanApproval({
          key: hedgePrincipalLoanApprovalKey,
          signature,
          signedAt: new Date().toISOString(),
          maxNotional: maxPrincipalLoan
        });
        setHedgePrincipalFlashEnabled(true);
        setFeedback(
          `Principal-loan agreement signed. Sleeve principal can now borrow up to ${formatNotional(
            maxPrincipalLoan
          )} PT from the fixed pool; the hedge top-up will be capped by what remains.`
        );
      } catch (loanError) {
        const loanMessage = String(loanError?.shortMessage || loanError?.message || '');
        setHedgePrincipalFlashEnabled(false);
        setFeedback(
          loanMessage.toLowerCase().includes('rejected')
            ? 'Principal-loan agreement was rejected in MetaMask, so Want more stayed off.'
            : loanMessage || 'MetaMask could not sign the principal-loan agreement.'
        );
      }
      return;
    }

    setHedgePrincipalFlashEnabled(false);

    const walletOnlyPrincipal = roundNumber(
      Math.min(
        Math.max(0, Number(hedgePreviewSleeveNotional || 0)),
        Math.max(0, Number(hedgePrincipalWalletMaxForFunding || 0))
      ),
      2
    );
    setHedgePreviewSleeveNotional(walletOnlyPrincipal);
    setHedgePreviewSleeveInput(String(walletOnlyPrincipal));
    setFeedback('Principal is back to wallet PT only. The fixed loan pool is reserved for the hedge leg again.');
  }

  function handleHedgePreviewSleeveBlur() {
    cancelPendingHedgeSleeveSliderCommit();
    if (hedgePreviewSleeveInput === '') {
      setHedgePreviewSleeveNotional(0);
      setHedgePreviewSleeveInput('0');
      return;
    }

    const normalizedAmount = roundNumber(
      Math.min(Math.max(0, Number(hedgePreviewSleeveInput || 0)), Math.max(0, hedgePreviewSleeveMax)),
      2
    );
    setHedgePreviewSleeveNotional(normalizedAmount);
    setHedgePreviewSleeveInput(String(normalizedAmount));
  }

  function handleTradeAmountSliderChange(nextValue) {
    const nextAmount = Math.max(0, roundNumber(Number(nextValue || 0), 2));
    scheduleTradeAmountSliderCommit(nextAmount);
  }

  function handleTradeAmountPreset(ratio) {
    cancelPendingTradeAmountSliderCommit();
    if (!Number.isFinite(Number(ratio)) || Number(ratio) <= 0) return;
    const nextAmount = roundNumber(Math.max(0, tradeAmountSliderMax * Number(ratio)), 2);
    commitTradeAmountValue(nextAmount);
  }

  function handleApplySuggestedTradeAmount() {
    cancelPendingTradeAmountSliderCommit();
    if (tradeAmountSuggestedValue <= 0) return;
    commitTradeAmountValue(tradeAmountSuggestedValue);
  }

  function handleApplySuggestedStrategyControls() {
    const suggested = getOptionStrategyDefaults(selectedStrategyTemplateId);
    setStrategyDownsidePct(suggested.downsidePct);
    setStrategyProfitHarvestPct(suggested.profitHarvestPct);
    setStrategyUpsideCapPct(suggested.upsideCapPct);
    setStrategyPremiumPct(suggested.premiumPct);
    setStrategyStrikePct(suggested.strikePct);
  }

  function handleSelectStrategyTemplate(templateId) {
    const safeTemplateId = OPTION_STRATEGY_DEFAULTS[templateId] ? templateId : 'collar';
    setSelectedOptionStrategyTemplateId(safeTemplateId);
    setSelectedRouteFocusByRoute((current) => ({
      ...current,
      borrow: safeTemplateId
    }));
    setSelectedPracticeCaseIndex(0);
    setStrategyAiTemplateGenerated(false);
    setFeedback(`${OPTION_STRATEGY_LABELS[safeTemplateId] || 'Strategy'} template selected.`);
  }

  function handleApplyHedgeSuggestedSize() {
    cancelPendingTradeAmountSliderCommit();
    if (!hedgeFocusActive || !hedgeSizingReady || hedgeFundableSuggestedNotional <= 0) return;
    commitTradeAmountValue(hedgeFundableSuggestedNotional);
    if (leverageRouteActive && hedgeFundableSuggestedNotional > routeMaxWalletBackedNotional + 0.01) {
      setTradeAmountMaxMode(hedgeFocusActive ? 'hedge' : 'ticket');
    }
    mergeProgressUpdate({ hedgeSizingCompleted: true });
  }

  function handleHedgeRatioPreset(ratio) {
    cancelPendingTradeAmountSliderCommit();
    const safeRatio = Number(ratio);
    if (!Number.isFinite(safeRatio) || safeRatio <= 0) return;

    setHedgeRatio(safeRatio);

    if (!hedgeFocusActive || !hedgeSizingReady) return;

    const cappedRatio = roundNumber(Math.min(safeRatio, Math.max(0, Number(hedgeMaxFundableRatio || 0))), 4);
    const nextSuggested = roundNumber(Math.min(Math.max(0, hedgeProtectedSleeveNotional * cappedRatio), tradeAmountSliderMax), 2);
    if (cappedRatio !== safeRatio) {
      setHedgeRatio(cappedRatio);
    }
    commitTradeAmountValue(nextSuggested);
    if (leverageRouteActive && nextSuggested > routeMaxWalletBackedNotional + 0.01) {
      setTradeAmountMaxMode(hedgeFocusActive ? 'hedge' : 'ticket');
    }
    mergeProgressUpdate({ hedgeSizingCompleted: true });
  }

  function handleTradeAmountBlur() {
    cancelPendingTradeAmountSliderCommit();
    setTradeAmountMaxApplied(false);
    if (tradeAmountInput === '') {
      setTradeAmount(0);
      setTradeAmountInput('0');
      return;
    }

    const normalizedAmount = Math.max(0, roundNumber(Number(tradeAmountInput || 0), 2));
    setTradeAmount(normalizedAmount);
    setTradeAmountInput(String(normalizedAmount));
  }

  function handleTradeAmountMax() {
    cancelPendingTradeAmountSliderCommit();
    if (tradeAmountMaxApplied) {
      const restoreInput = tradeAmountBeforeMaxRef.current?.input ?? '2500';
      const restoreAmount = Math.max(0, roundNumber(Number(tradeAmountBeforeMaxRef.current?.amount || 2500), 2));
      setTradeAmount(restoreAmount);
      setTradeAmountInput(String(restoreInput));
      setTradeAmountMaxApplied(false);
      return;
    }

    tradeAmountBeforeMaxRef.current = {
      input: tradeAmountInput === '' ? '2500' : tradeAmountInput,
      amount: tradeAmountInput === '' ? 2500 : Math.max(0, roundNumber(Number(tradeAmountInput || 0), 2))
    };
    const nextMax = roundNumber(Math.max(0, Number(hedgeFocusActive ? tradeAmountSliderMax : selectedTradeAmountMaxValue || 0)), 2);
    setTradeAmount(nextMax);
    setTradeAmountInput(String(nextMax));
    setTradeAmountMaxApplied(true);
  }

  function handleTradeAmountMaxModeChange(nextMode) {
    cancelPendingTradeAmountSliderCommit();
    setTradeAmountMaxMode(nextMode);
    setTradeAmountMaxApplied(false);
    if (leverageRouteActive && nextMode !== 'wallet') {
      setFeedback(
        nextMode === 'ticket'
          ? 'Attested flash range selected. The quote can support eligible same-purpose products inside this exchange route, not only the exact same stock.'
          : 'Broad flash range selected. This lane is priced higher because the credit is not restricted to a provable exchange route.'
      );
    }
  }

  useEffect(() => {
    if (selectedAdvancedRoute === 'routing' && !['T+0', 'T+1', 'T+N'].includes(routeSettlementMode)) {
      setRouteSettlementMode('T+0');
    }
  }, [routeSettlementMode, selectedAdvancedRoute]);

  useEffect(() => {
    setHasMetaMaskInstalled(Boolean(detectMetaMaskProvider()));
  }, []);

  useEffect(() => {
    if (isConnected) {
      setWalletModalOpen(false);
      setWalletError('');
    }
  }, [isConnected]);

  useEffect(() => {
    setAutoSellPreviewOpen(false);
    setAutoSellPreviewProductId('');
  }, [selectedProductId, selectedView?.cursor]);

  useEffect(() => {
    if (!error) return;

    const message = String(error.message || '');
    if (message.toLowerCase().includes('already processing')) {
      setWalletError('MetaMask already has a pending request open. Approve it in the extension first.');
      return;
    }
    if (message.toLowerCase().includes('rejected')) {
      setWalletError('The connection request reached MetaMask, but it was rejected. You can retry anytime.');
      return;
    }
    setWalletError(message);
  }, [error]);

  useEffect(() => {
    if (!claimWriteError) return;

    setClaimFeedback(claimWriteError.shortMessage || claimWriteError.message || 'Replay achievement claim failed.');
    setClaimingAchievementId(null);
  }, [claimWriteError]);

  useEffect(() => {
    if (!scoreWriteError) return;

    setScoreFeedback(scoreWriteError.shortMessage || scoreWriteError.message || 'Replay score submission failed.');
    if (pendingScoreSnapshotRef.current?.txHash) {
      const pendingHash = pendingScoreSnapshotRef.current.txHash;
      setScoreSubmissionLog((current) => ({
        submissions: current.submissions.filter((submission) => submission.txHash !== pendingHash)
      }));
    }
    pendingScoreSnapshotRef.current = null;
  }, [scoreWriteError]);

  useEffect(() => {
    if (!claimHash || claimingAchievementId == null) return;

    const activeAchievement = replayAchievements.find((achievement) => achievement.id === claimingAchievementId);
    setClaimFeedback(`${activeAchievement?.title || 'Replay achievement'} submitted. Waiting for Sepolia confirmation.`);
  }, [claimHash, claimingAchievementId, replayAchievements]);

  useEffect(() => {
    if (!scoreHash) return;
    setScoreFeedback('Replay score submitted. Waiting for Sepolia confirmation.');
    if (!pendingScoreSnapshotRef.current) return;

    const pendingSnapshot = {
      ...pendingScoreSnapshotRef.current,
      txHash: scoreHash,
      status: 'pending'
    };
    pendingScoreSnapshotRef.current = pendingSnapshot;
    setScoreSubmissionLog((current) => {
      const nextSubmissions = current.submissions.filter((submission) => submission.txHash !== scoreHash);
      return {
        submissions: [pendingSnapshot, ...nextSubmissions].slice(0, 12)
      };
    });
  }, [scoreHash]);

  useEffect(() => {
    if (!isClaimConfirmed || claimingAchievementId == null) return;

    const claimedAchievement = replayAchievements.find((achievement) => achievement.id === claimingAchievementId);
    setReplayClaimCache((current) =>
      normalizeReplayClaimCache({
        walletAddress: getWalletCacheAddress(address),
        claimedIds: [...(current.claimedIds || []), claimingAchievementId]
      }, address)
    );
    setClaimFeedback(`${claimedAchievement?.title || 'Replay achievement'} claimed on Sepolia for ${shortAddress(address)}.`);
    setClaimingAchievementId(null);
    void refetchReplayClaimReadData();
  }, [address, claimingAchievementId, isClaimConfirmed, refetchReplayClaimReadData, replayAchievements]);

  useEffect(() => {
    if (!isScoreConfirmed) return;
    setScoreFeedback(`Replay score anchored on Sepolia for ${shortAddress(address)}.`);
    if (pendingScoreSnapshotRef.current) {
      const nextSnapshot = {
        ...pendingScoreSnapshotRef.current,
        status: 'confirmed'
      };
      setScoreSubmissionLog((current) => ({
        submissions: [
          nextSnapshot,
          ...current.submissions.filter((submission) => submission.txHash !== nextSnapshot.txHash)
        ].slice(0, 12)
      }));
      pendingScoreSnapshotRef.current = null;
    }
    void refetchReplayScoreState();
  }, [address, isScoreConfirmed, refetchReplayScoreState]);

  function handleConnect() {
    if (!hasMetaMaskInstalled) {
      setWalletError('MetaMask is not installed in this browser yet. Install the extension, pin it to the toolbar, and reopen this wallet panel.');
      return;
    }
    if (!metaMaskConnector) {
      setWalletError('MetaMask was not exposed as a usable wallet connector in this browser session.');
      return;
    }
    setWalletError('');
    setWalletNicknameFeedback('');
    setPendingWalletNickname(normalizeWalletNickname(walletNicknameDraft) || null);
    connect({ connector: metaMaskConnector });
  }

  function handleWalletDisconnect() {
    setWalletError('');
    setWalletNicknameFeedback('');
    setProfileBackupStatus('Wallet disconnected. Replay backups stay on this device; reconnect the same MetaMask account to recover them.');
    disconnect();
  }

  async function handleSignProfileBackup() {
    if (!isConnected || !address) {
      setProfileBackupStatus('Connect MetaMask first so the replay backup can be tied to the current account.');
      return;
    }

    setProfileBackupStatus('Opening MetaMask signature for this replay profile...');
    try {
      const record = await signAndStoreProfilePointer(
        address,
        {
          ...readWalletProfile(address),
          progress: progressState,
          paper: paperState
        },
        signMessageAsync
      );
      setProfileBackupStatus(`Replay profile backup signed for ${shortAddress(address)}. Content hash ${record.contentHash.slice(0, 12)}...`);
    } catch (error) {
      setProfileBackupStatus(String(error?.message || 'Replay profile backup signature was cancelled.'));
    }
  }

  function handleRecoverSelectedProfileBackup() {
    if (!selectedProfileBackupAddress) {
      setProfileBackupStatus('No historical replay backup is selected on this device yet.');
      return;
    }

    if (!isConnected || !address) {
      setProfileBackupStatus('Connect MetaMask first. A backup can identify a historical account, but the wallet still has to approve this session.');
      return;
    }

    if (selectedProfileBackupAddress !== connectedAddressKey) {
      setProfileBackupStatus(`Selected backup belongs to ${shortAddress(selectedProfileBackupAddress)}. Switch MetaMask to that account, reconnect, then recover it here.`);
      return;
    }

    const pointerRecord = readStorageJson(getWalletProfilePointerKey(selectedProfileBackupAddress), null);
    if (!pointerRecord?.profile) {
      setProfileBackupStatus(`No signed backup was found for ${shortAddress(selectedProfileBackupAddress)} on this device yet.`);
      return;
    }

    const recoveredProfile = pointerRecord.profile;
    writeWalletProfilePatch(selectedProfileBackupAddress, {
      ...recoveredProfile,
      storage: {
        ...(recoveredProfile.storage || {}),
        contentHash: pointerRecord.contentHash || recoveredProfile.storage?.contentHash || '',
        cidReadyPointer: pointerRecord.cidReadyPointer || recoveredProfile.storage?.cidReadyPointer || '',
        signedAt: pointerRecord.createdAt || recoveredProfile.storage?.signedAt || '',
        hasSignature: Boolean(pointerRecord.signature || recoveredProfile.storage?.hasSignature),
        lastRecoveredAt: new Date().toISOString()
      }
    });
    setProgressState((current) => ({
      ...current,
      ...(recoveredProfile.progress || {})
    }));
    setPaperState(readRecoveredPaperState(selectedProfileBackupAddress));
    setProfileBackupStatus(`Saved replay state restored for ${shortAddress(selectedProfileBackupAddress)}. Paper cash, progress, and wallet-linked history are back on this device.`);
  }

  function openDeveloperMode() {
    setDevModeAuthed(false);
    setDevModeUsername('');
    setDevModePassword('');
    setDevModeOpen(true);
    setDevModeError('');
    setDevModeNotice('');
  }

  function handleDeveloperLogin() {
    if (devModeUsername.trim() === DEV_MODE_USERNAME && devModePassword.trim() === DEV_MODE_PASSWORD) {
      setDevModeAuthed(true);
      setDeveloperOverride(true);
      setDevModeError('');
      setDevModeNotice('Developer controls are open for this use. Reloading or reopening asks for the account again.');
      return;
    }

    setDevModeError('Incorrect developer credentials.');
    setDevModeNotice('');
  }

  function handleDeveloperLogout() {
    setDevModeAuthed(false);
    setDevModeUsername('');
    setDevModePassword('');
    setDeveloperOverride(Boolean(readStorageJson(getAdminUnlockStorageKey(address), false)));
    setDevModeError('');
    setDevModeNotice('Developer controls are closed for this browser.');
  }

  function handleSaveWalletNickname() {
    if (!address) {
      setWalletNicknameFeedback('Connect the wallet first, then save a nickname for it.');
      return;
    }

    const savedNickname = writeWalletNickname(address, walletNicknameDraft);
    setWalletNickname(savedNickname);
    setWalletNicknameDraft(savedNickname);
    setWalletNicknameFeedback(savedNickname ? `Nickname saved as ${savedNickname}.` : 'Nickname cleared. The short wallet address will show again.');
  }

  function handleClaimReplayAchievement(achievement) {
    if (!achievement) return;

    if (!isConnected || !address) {
      setClaimFeedback('Connect MetaMask first so the replay badge can be claimed by the same wallet that finished the task.');
      return;
    }

    if (!replayBadgeContractConfigured) {
      setClaimFeedback('Replay badges are not switched on in this demo yet. Users do not need to write code here; the project owner still needs to connect the replay badge contract.');
      return;
    }

    if (!achievement.unlocked) {
      setClaimFeedback('Finish this replay task locally before trying to claim its onchain achievement.');
      return;
    }

    if (achievement.onchainClaimed) {
      setClaimFeedback(`${achievement.title} is already claimed onchain for ${shortAddress(address)}.`);
      return;
    }

    setClaimingAchievementId(achievement.id);
    setClaimFeedback(`Opening MetaMask to self-claim ${achievement.title} on Sepolia...`);
    writeReplayClaim({
      address: REPLAY_BADGE_CONTRACT_ADDRESS,
      abi: replayAchievementAbi,
      functionName: 'claim',
      args: [achievement.id],
      chainId: SEPOLIA_CHAIN_ID
    });
  }

  function handleSubmitReplayScore() {
    if (!isConnected || !address) {
      setScoreFeedback('Connect MetaMask first so the replay score stays tied to the same wallet.');
      return;
    }

    if (!replayBadgeContractConfigured) {
      setScoreFeedback('Onchain replay score submission is not switched on in this demo yet. Users do not need to write code; the project owner still needs to connect the replay badge contract.');
      return;
    }

    if (!scoreReady) {
      setScoreFeedback('Finish a closed replay loop and get net replay PnL above zero before anchoring a score.');
      return;
    }

    if (scoreSubmissionsToday >= REPLAY_SCORE_DAILY_LIMIT) {
      setScoreFeedback(`This wallet already used all ${REPLAY_SCORE_DAILY_LIMIT} score submissions for today. Come back after the daily reset.`);
      return;
    }

    pendingScoreSnapshotRef.current = buildReplayScoreSnapshot({
      trades: paperState.trades,
      netPnl: replayScoreValue,
      accountValue: strategyAccountValue,
      walletAddress: address
    });
    setScoreFeedback('Opening MetaMask to submit the current replay score on Sepolia...');
    writeReplayScore({
      address: REPLAY_BADGE_CONTRACT_ADDRESS,
      abi: replayAchievementAbi,
      functionName: 'submitScore',
      args: [BigInt(Math.round(replayScoreValue)), BigInt(Math.round(strategyAccountValue)), BigInt(paperState.trades.length)],
      chainId: SEPOLIA_CHAIN_ID
    });
  }

  function mergeProgressUpdate(patch) {
    setProgressState((current) => {
      const next = { ...current, ...patch };
      writeStorageJson(progressStorageKey, next);
      return next;
    });
  }

  function updateProgressAfterTrade() {
    mergeProgressUpdate({
      paperTradesCompleted: Math.max(1, Number(progressState.paperTradesCompleted || 0)),
      spotLessonCompleted: true
    });
  }

  function triggerTradeFireworks() {
    if (tradeOutcomeBurstTimerRef.current) {
      clearTimeout(tradeOutcomeBurstTimerRef.current);
    }

    const nextBursts = Array.from({ length: TRADE_FIREWORK_BURST_COUNT }, (_, index) => ({
      id: `burst-${Date.now()}-${index}`,
      left: roundNumber(8 + Math.random() * 84, 2),
      top: roundNumber(12 + Math.random() * 52, 2),
      angle: roundNumber(Math.random() * 360, 2),
      distance: roundNumber(58 + Math.random() * 88, 2),
      delay: roundNumber(Math.random() * 0.22, 2),
      hue: Math.round(38 + Math.random() * 112)
    }));

    setTradeOutcomeBursts(nextBursts);
    tradeOutcomeBurstTimerRef.current = window.setTimeout(() => {
      setTradeOutcomeBursts([]);
      tradeOutcomeBurstTimerRef.current = null;
    }, TRADE_FIREWORK_LIFETIME_MS);
  }

  function finalizeTradeOutcome({
    product,
    routeId = 'spot',
    actionLabel,
    tradeTs,
    pnl,
    exitValue,
    paperCashDelta = 0,
    realizedPnlDelta = 0
  }) {
    const safePnl = roundNumber(Number(pnl || 0), 2);
    const safeExitValue = roundNumber(Number(exitValue || 0), 2);
    const resolvedTradeTs = tradeTs || new Date().toISOString();
    const tradeDayKey = getReplayDayKey(resolvedTradeTs) || getReplayDayKey(new Date().toISOString());
    const existingEntries = normalizeTradeOutcomeHistory(tradeOutcomeHistoryRef.current).entries;
    const hasRecoveryGrantToday = existingEntries.some(
      (entry) => entry.dayKey === tradeDayKey && Number(entry.compensationGranted || 0) > 0
    );
    const compensationGranted =
      safePnl <= -TRADE_RECOVERY_GRANT_TRIGGER && !hasRecoveryGrantToday ? TRADE_RECOVERY_GRANT_AMOUNT : 0;

    const nextEntry = {
      id: `${product?.id || 'product'}-${routeId}-${resolvedTradeTs}-${Date.now()}`,
      ts: resolvedTradeTs,
      dayKey: tradeDayKey,
      productId: product?.id || '',
      productName: product?.name || product?.ticker || 'Replay product',
      productTicker: product?.ticker || product?.name || 'Replay product',
      routeId,
      actionLabel,
      exitValue: safeExitValue,
      pnl: safePnl,
      compensationGranted
    };
    const nextHistory = normalizeTradeOutcomeHistory({
      entries: [nextEntry, ...existingEntries].slice(0, 240)
    });
    const todayClosedPnl = sumTradeOutcomePnlForDay(nextHistory.entries, tradeDayKey);
    const todayRecoveryGrant = sumTradeOutcomeGrantForDay(nextHistory.entries, tradeDayKey);

    tradeOutcomeHistoryRef.current = nextHistory;
    setTradeOutcomeHistory(nextHistory);

    const accountCashDelta = roundNumber(Number(paperCashDelta || 0) + compensationGranted, 2);
    const accountRealizedDelta = roundNumber(Number(realizedPnlDelta || 0), 2);

    if (accountCashDelta !== 0 || accountRealizedDelta !== 0) {
      setPaperState((current) => ({
        ...current,
        cash: roundNumber(Math.max(0, current.cash + accountCashDelta), 2),
        realizedPnl: roundNumber(Number(current.realizedPnl || 0) + accountRealizedDelta, 2)
      }));
    }

    if (safePnl > 0) {
      triggerTradeFireworks();
    }

    setTradeOutcomeModal({
      tone: safePnl > 0 ? 'positive' : 'negative',
      productName: product?.name || product?.ticker || 'Replay product',
      productTicker: product?.ticker || product?.name || 'Replay product',
      actionLabel,
      dateLabel: formatReplayDate(resolvedTradeTs, selectedView?.interval),
      pnl: safePnl,
      exitValue: safeExitValue,
      todayClosedPnl,
      todayRecoveryGrant,
      compensationGranted,
      takeHomeLabel: 'Take-home value'
    });

    return {
      compensationGranted,
      todayClosedPnl,
      todayRecoveryGrant
    };
  }

  function executeReplayTrade({
    side,
    tradeBar = replayFocus.lockedBar,
    tradeInterval = selectedView?.interval,
    notionalOverride,
    forceSellAll = false,
    customFeedback,
    outcomeActionLabel,
    outcomeOverride = null
  }) {
    if (!tradeBar) {
      setFeedback('Replay bars are still loading for this product.');
      return false;
    }

    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so the replay ledger stays tied to a wallet.');
      return false;
    }

    const requestedNotional = Number.isFinite(Number(notionalOverride)) ? Number(notionalOverride) : Number(tradeAmount);
    if (side === 'buy' && (!Number.isFinite(requestedNotional) || requestedNotional < MIN_PAPER_TRADE)) {
      setFeedback(`Minimum replay trade is ${MIN_PAPER_TRADE.toLocaleString()} PT.`);
      return false;
    }

    const price = Number(tradeBar.close);
    const currentPosition = paperState.positions[selectedProductId] || {
      units: 0,
      principal: 0,
      avgEntry: 0,
      carryPaid: 0,
      grossNotional: 0,
      entryFeePaid: 0,
      principalLoan: 0,
      entryTs: ''
    };

    if (side === 'sell' && currentPosition.units <= 0) {
      setFeedback('No open replay position is available to sell for this product.');
      return false;
    }

    if (side === 'sell') {
      setIsPlaying(false);
      setHoveredReplayIndex(null);
    }

    const maxSellValue = roundNumber(currentPosition.units * price, 2);
    const fillNotional =
      side === 'buy'
        ? requestedNotional
        : forceSellAll
          ? maxSellValue
          : Math.min(requestedNotional, maxSellValue);
    const filledUnits = side === 'sell' && forceSellAll
      ? roundNumber(currentPosition.units, 6)
      : roundNumber(fillNotional / price, 6);
    const closesSelectedPosition =
      side === 'sell' && (forceSellAll || filledUnits >= Math.max(0, Number(currentPosition.units || 0)) - 0.000001);

    if (filledUnits <= 0) {
      setFeedback('The selected order is too small to create a replay fill.');
      return false;
    }

    let buyCostsForExecution = null;
    let sleevePrincipalLoanAppliedForExecution = 0;
    let walletCashRequiredForExecution = 0;
    if (side === 'buy') {
      buyCostsForExecution = calculateTradeCosts({
        product: selectedProduct,
        side: 'buy',
        notional: fillNotional
      });
      sleevePrincipalLoanAppliedForExecution =
        hedgeFocusActive && hedgePrincipalFlashEnabled && hedgePrincipalLoanApprovalValid
          ? getPrincipalLoanForBuy({
              product: selectedProduct,
              notional: fillNotional,
              cash: availableCash,
              principalLoanBudget: hedgePrincipalLoanRemainingForFunding
            })
          : 0;
      walletCashRequiredForExecution = roundNumber(
        Math.max(0, fillNotional - sleevePrincipalLoanAppliedForExecution) + buyCostsForExecution.nonTaxCost,
        2
      );

      if (walletCashRequiredForExecution > availableCash + 0.01) {
        const sleeveMessage = hedgeFocusActive
          ? `The sleeve did not open because ${formatNotional(fillNotional)} PT plus about ${formatNotional(
              buyCostsForExecution.nonTaxCost
            )} PT of upfront drag needs ${formatNotional(walletCashRequiredForExecution)} PT of wallet cash after the signed principal loan. Lower the sleeve notional or sign Want more before opening the hedge.`
          : 'Not enough replay buying power after fees and routing drag.';
        if (hedgeFocusActive) {
          showReplayDeskToast(sleeveMessage);
          setFeedback('');
        } else {
          setFeedback(sleeveMessage);
        }
        return false;
      }
    }

    let sellOutcomeSummary = null;
    if (side === 'sell') {
      const unitsToSell = forceSellAll ? currentPosition.units : Math.min(currentPosition.units, filledUnits);
      const principalReduction = roundNumber(unitsToSell * currentPosition.avgEntry, 2);
      const holdingDays = getHoldingDays(currentPosition.entryTs, tradeBar.ts);
      const annualCarryRate = getCostModel(selectedProduct).annualCarryBps / 10000;
      const totalCarryAccrued = roundNumber(currentPosition.principal * annualCarryRate * (holdingDays / 365), 2);
      const unpaidCarry = roundNumber(Math.max(0, totalCarryAccrued - Number(currentPosition.carryPaid || 0)), 2);
      const ratio = currentPosition.units > 0 ? Math.min(1, unitsToSell / currentPosition.units) : 0;
      const loanRepayment = roundNumber(Math.max(0, Number(currentPosition.principalLoan || 0)) * ratio, 2);
      const carryAllocated = roundNumber(unpaidCarry * ratio, 2);
      const managementFeeAllocated = calculateReplayManagementFee({
        product: selectedProduct,
        notional: roundNumber(Math.max(0, Number(currentPosition.grossNotional || principalReduction)) * ratio, 2),
        holdingDays
      });
      const grossProceeds = roundNumber(unitsToSell * price, 2);
      const preTaxGain = roundNumber(Math.max(0, grossProceeds - principalReduction - carryAllocated - managementFeeAllocated), 2);
      const sellCosts = calculateTradeCosts({
        product: selectedProduct,
        side: 'sell',
        notional: grossProceeds,
        gain: preTaxGain,
        holdingDays,
        units: unitsToSell
      });
      const netProceedsBeforeLoan = roundNumber(
        grossProceeds - carryAllocated - managementFeeAllocated - sellCosts.nonTaxCost - sellCosts.estimatedTax,
        2
      );
      const netProceeds = roundNumber(Math.max(0, netProceedsBeforeLoan - loanRepayment), 2);
      const equityPrincipalReduction = roundNumber(Math.max(0, principalReduction - loanRepayment), 2);
      const realizedPnl = roundNumber(netProceeds - equityPrincipalReduction, 2);
      const overridePnl = Number(outcomeOverride?.pnl);
      const overrideExitValue = Number(outcomeOverride?.exitValue);

      sellOutcomeSummary = {
        pnl: Number.isFinite(overridePnl) ? roundNumber(overridePnl, 2) : realizedPnl,
        exitValue: Number.isFinite(overrideExitValue) ? roundNumber(overrideExitValue, 2) : netProceeds,
        actionLabel: outcomeOverride?.actionLabel || outcomeActionLabel || (forceSellAll ? 'Full exit' : 'Sell'),
        ts: outcomeOverride?.ts || tradeBar.ts
      };
    }

    setPaperState((current) => {
      const livePosition = current.positions[selectedProductId] || {
        units: 0,
        principal: 0,
        avgEntry: 0,
        carryPaid: 0,
        grossNotional: 0,
        entryFeePaid: 0,
        principalLoan: 0,
        entryTs: ''
      };

      if (side === 'buy') {
        const buyCosts = buyCostsForExecution || calculateTradeCosts({
          product: selectedProduct,
          side: 'buy',
          notional: fillNotional
        });
        const sleevePrincipalLoanApplied = sleevePrincipalLoanAppliedForExecution;
        const walletCashSpent = roundNumber(Math.max(0, fillNotional - sleevePrincipalLoanApplied) + buyCosts.nonTaxCost, 2);
        const nextUnits = roundNumber(livePosition.units + filledUnits, 6);
        const nextPrincipal = roundNumber(livePosition.principal + fillNotional + buyCosts.nonTaxCost, 2);
        const nextAvgEntry = nextUnits > 0 ? roundNumber(nextPrincipal / nextUnits, 4) : 0;
        const nextGrossNotional = roundNumber((livePosition.grossNotional || 0) + fillNotional, 2);
        const nextEntryFeePaid = roundNumber((livePosition.entryFeePaid || 0) + buyCosts.nonTaxCost, 2);
        const nextPrincipalLoan = roundNumber(Math.max(0, Number(livePosition.principalLoan || 0)) + sleevePrincipalLoanApplied, 2);
        const existingWeight = livePosition.principal || 0;
        const incomingWeight = fillNotional + buyCosts.nonTaxCost;
        const weightedEntryMs =
          existingWeight + incomingWeight > 0
            ? Math.round(
                ((livePosition.entryTs ? new Date(livePosition.entryTs).getTime() : new Date(tradeBar.ts).getTime()) * existingWeight +
                  new Date(tradeBar.ts).getTime() * incomingWeight) /
                  (existingWeight + incomingWeight)
              )
            : new Date(tradeBar.ts).getTime();

        return {
          ...current,
          cash: roundNumber(Math.max(0, current.cash - walletCashSpent), 2),
          positions: {
            ...current.positions,
            [selectedProductId]: {
              units: nextUnits,
              principal: nextPrincipal,
              avgEntry: nextAvgEntry,
              carryPaid: roundNumber(livePosition.carryPaid || 0, 2),
              grossNotional: nextGrossNotional,
              entryFeePaid: nextEntryFeePaid,
              principalLoan: nextPrincipalLoan,
              entryTs: new Date(weightedEntryMs).toISOString()
            }
          },
          trades: [
            {
              id: `${selectedProductId}-${tradeBar.ts}-buy-${current.trades.length}`,
              productId: selectedProductId,
              side,
              notional: fillNotional,
              units: filledUnits,
              price,
              ts: tradeBar.ts,
              interval: tradeInterval,
              feeTotal: buyCosts.nonTaxCost,
              taxTotal: 0,
              carryTotal: 0,
              loanApplied: sleevePrincipalLoanApplied
            },
            ...current.trades
          ]
        };
      }

      const unitsToSell = forceSellAll ? livePosition.units : Math.min(livePosition.units, filledUnits);
      const remainingUnits = forceSellAll ? 0 : roundNumber(Math.max(0, livePosition.units - unitsToSell), 6);
      const principalReduction = roundNumber(unitsToSell * livePosition.avgEntry, 2);
      const remainingPrincipal = roundNumber(Math.max(0, livePosition.principal - principalReduction), 2);
      const holdingDays = getHoldingDays(livePosition.entryTs, tradeBar.ts);
      const annualCarryRate = getCostModel(selectedProduct).annualCarryBps / 10000;
      const totalCarryAccrued = roundNumber(livePosition.principal * annualCarryRate * (holdingDays / 365), 2);
      const unpaidCarry = roundNumber(Math.max(0, totalCarryAccrued - Number(livePosition.carryPaid || 0)), 2);
      const ratio = livePosition.units > 0 ? Math.min(1, unitsToSell / livePosition.units) : 0;
      const remainingGrossNotional = roundNumber(Math.max(0, (livePosition.grossNotional || 0) * (1 - ratio)), 2);
      const remainingEntryFeePaid = roundNumber(Math.max(0, (livePosition.entryFeePaid || 0) * (1 - ratio)), 2);
      const loanRepayment = roundNumber(Math.max(0, Number(livePosition.principalLoan || 0)) * ratio, 2);
      const remainingPrincipalLoan = roundNumber(Math.max(0, Number(livePosition.principalLoan || 0) - loanRepayment), 2);
      const carryAllocated = roundNumber(unpaidCarry * ratio, 2);
      const managementFeeAllocated = calculateReplayManagementFee({
        product: selectedProduct,
        notional: roundNumber(Math.max(0, Number(livePosition.grossNotional || principalReduction)) * ratio, 2),
        holdingDays
      });
      const grossProceeds = roundNumber(unitsToSell * price, 2);
      const preTaxGain = roundNumber(Math.max(0, grossProceeds - principalReduction - carryAllocated - managementFeeAllocated), 2);
      const sellCosts = calculateTradeCosts({
        product: selectedProduct,
        side: 'sell',
        notional: grossProceeds,
        gain: preTaxGain,
        holdingDays,
        units: unitsToSell
      });
      const netProceedsBeforeLoan = roundNumber(
        grossProceeds - carryAllocated - managementFeeAllocated - sellCosts.nonTaxCost - sellCosts.estimatedTax,
        2
      );
      const netProceeds = roundNumber(Math.max(0, netProceedsBeforeLoan - loanRepayment), 2);
      const equityPrincipalReduction = roundNumber(Math.max(0, principalReduction - loanRepayment), 2);
      const realizedPnl = roundNumber(netProceeds - equityPrincipalReduction, 2);
      const nextPositions = { ...current.positions };

      if (remainingUnits <= 0) {
        delete nextPositions[selectedProductId];
      } else {
        nextPositions[selectedProductId] = {
          units: remainingUnits,
          principal: remainingPrincipal,
          avgEntry: livePosition.avgEntry,
          carryPaid: roundNumber((livePosition.carryPaid || 0) + carryAllocated, 2),
          grossNotional: remainingGrossNotional,
          entryFeePaid: remainingEntryFeePaid,
          principalLoan: remainingPrincipalLoan,
          entryTs: livePosition.entryTs
        };
      }

      const overridePnl = Number(outcomeOverride?.pnl);
      const overrideExitValue = Number(outcomeOverride?.exitValue);
      const overrideManagementFee = Number(outcomeOverride?.managementFee);
      const overrideAppliesToLedger = Boolean(outcomeOverride?.applyToLedger);
      const ledgerNetProceeds =
        overrideAppliesToLedger && Number.isFinite(overrideExitValue) ? roundNumber(overrideExitValue, 2) : netProceeds;
      const ledgerRealizedPnl =
        overrideAppliesToLedger && Number.isFinite(overridePnl) ? roundNumber(overridePnl, 2) : realizedPnl;
      sellOutcomeSummary = {
        pnl: Number.isFinite(overridePnl) ? roundNumber(overridePnl, 2) : realizedPnl,
        exitValue: Number.isFinite(overrideExitValue) ? roundNumber(overrideExitValue, 2) : netProceeds,
        actionLabel: outcomeOverride?.actionLabel || outcomeActionLabel || (forceSellAll ? 'Auto-sell' : 'Sell'),
        ts: outcomeOverride?.ts || tradeBar.ts
      };

      return {
        ...current,
        cash: roundNumber(current.cash + ledgerNetProceeds, 2),
        realizedPnl: roundNumber(current.realizedPnl + ledgerRealizedPnl, 2),
        positions: nextPositions,
        trades: [
          {
            id: `${selectedProductId}-${tradeBar.ts}-sell-${current.trades.length}`,
            productId: selectedProductId,
            side,
            notional: overrideAppliesToLedger ? ledgerNetProceeds : grossProceeds,
            units: unitsToSell,
            price,
            ts: tradeBar.ts,
            interval: tradeInterval,
            realizedPnl: ledgerRealizedPnl,
            feeTotal: sellCosts.nonTaxCost,
            taxTotal: sellCosts.estimatedTax,
            carryTotal: carryAllocated,
            managementFeeTotal: Number.isFinite(overrideManagementFee)
              ? roundNumber(overrideManagementFee, 2)
              : managementFeeAllocated,
            loanRepaid: loanRepayment
          },
          ...current.trades
        ]
      };
    });

    const finalizedOutcome =
      side === 'sell' && sellOutcomeSummary
        ? finalizeTradeOutcome({
            product: selectedProduct,
            routeId: 'spot',
            actionLabel: sellOutcomeSummary.actionLabel,
            tradeTs: sellOutcomeSummary.ts,
            pnl: sellOutcomeSummary.pnl,
            exitValue: sellOutcomeSummary.exitValue
          })
        : null;

    updateProgressAfterTrade();
    if (side === 'buy') {
      if (hedgeFocusActive) {
        setHedgeSleeveReadyByProduct((current) => ({
          ...current,
          [selectedProductId]: true
        }));
      }
    } else if (closesSelectedPosition) {
      setHedgeSleeveReadyByProduct((current) => {
        if (!current[selectedProductId]) return current;
        const next = { ...current };
        delete next[selectedProductId];
        return next;
      });
    }
    setFeedback(
      customFeedback ||
        (side === 'buy'
          ? `Replay buy filled at ${formatPrice(price)} for ${filledUnits.toLocaleString()} units of ${selectedProduct.ticker}, with about ${formatNotional(calculateTradeCosts({ product: selectedProduct, side: 'buy', notional: fillNotional }).nonTaxCost)} PT in upfront drag.`
          : forceSellAll
            ? `${outcomeActionLabel || 'Full exit'} sold ${filledUnits.toLocaleString()} units of ${selectedProduct.ticker} at ${formatPrice(price)} on ${formatReplayDate(tradeBar.ts, tradeInterval)}.`
            : `Replay sell filled at ${formatPrice(price)} for ${filledUnits.toLocaleString()} units of ${selectedProduct.ticker}, net of route costs and estimated tax.`) +
            (finalizedOutcome?.compensationGranted
              ? ` Daily recovery grant +${formatNotional(finalizedOutcome.compensationGranted)} PT was added after the close.`
              : '')
    );
    return true;
  }

  function closeBuyGuideModal() {
    setPendingBuyTrade(null);
  }

  async function confirmBuyGuideModal() {
    if (!pendingBuyTrade) return;

    const nextTrade = pendingBuyTrade;
    setIsPlaying(false);
    setHoveredReplayIndex(null);
    setSelectedReplayPanel('desk');
    updateSelectedReplay({
      cursor: nextTrade.tradeIndex,
      replayStarted: false
    });

    const tradeSigned = await ensureReplayTradeSignature({
      side: nextTrade.side,
      tradeBar: nextTrade.tradeBar,
      tradeInterval: nextTrade.tradeInterval,
      notional: nextTrade.requestedNotional,
      unitsPreview: nextTrade.unitsPreview
    });

    if (!tradeSigned) return;

    closeBuyGuideModal();
    executeReplayTrade({
      side: nextTrade.side,
      tradeBar: nextTrade.tradeBar,
      tradeInterval: nextTrade.tradeInterval,
      notionalOverride: nextTrade.requestedNotional,
      customFeedback: nextTrade.customFeedback
    });
  }

  async function handlePlaceTrade(side, options = {}) {
    const focusedTradeBar = replayFocus.bar;
    const focusedTradeIndex =
      hoveredReplayIndex == null
        ? Math.max(0, Math.min(selectedView?.cursor || 0, Math.max(0, (selectedView?.bars?.length || 1) - 1)))
        : Math.max(0, Math.min(hoveredReplayIndex, Math.max(0, (selectedView?.bars?.length || 1) - 1)));
    const requestedNotionalOverride = Number(options.notionalOverride);
    const requestedTradeNotional = Number.isFinite(requestedNotionalOverride)
      ? requestedNotionalOverride
      : Number(tradeAmount || 0);

    if (focusedTradeBar && selectedView && focusedTradeIndex !== (selectedView.cursor || 0)) {
      setIsPlaying(false);
      updateSelectedReplay({
        cursor: focusedTradeIndex,
        replayStarted: false
      });
    }

    const focusedPrice = Number(focusedTradeBar?.close || 0);
    const focusedUnitsPreview = focusedPrice > 0 ? roundNumber(requestedTradeNotional / focusedPrice, 6) : 0;
    const customFeedback =
      options.customFeedback ||
      (focusedTradeBar
        ? side === 'buy'
          ? `Buy confirmed on ${formatReplayDate(focusedTradeBar.ts, selectedView?.interval)} at ${formatPrice(
              focusedPrice
            )}. Ticket ${formatNotional(requestedTradeNotional)} PT is about ${formatUnits(focusedUnitsPreview)} units before route costs.`
          : `Sell confirmed on ${formatReplayDate(focusedTradeBar.ts, selectedView?.interval)} at ${formatPrice(
              focusedPrice
            )}. The desk will unwind only the units this wallet currently holds.`
        : undefined);

    if (side === 'buy' && !focusedTradeBar) {
      setFeedback('Replay bars are still loading for this product.');
      return;
    }

    if (side === 'sell' && !focusedTradeBar) {
      setFeedback('Replay bars are still loading for this product.');
      return;
    }

    if (side === 'buy' && (!Number.isFinite(requestedTradeNotional) || requestedTradeNotional < MIN_PAPER_TRADE)) {
      setFeedback(`Minimum replay trade is ${MIN_PAPER_TRADE.toLocaleString()} PT.`);
      return;
    }

    if (side === 'buy') {
      const buyCostsPreview = calculateTradeCosts({
        product: selectedProduct,
        side: 'buy',
        notional: requestedTradeNotional
      });
      const previewPrincipalLoan =
        hedgeFocusActive && hedgePrincipalFlashEnabled && hedgePrincipalLoanApprovalValid
          ? getPrincipalLoanForBuy({
              product: selectedProduct,
              notional: requestedTradeNotional,
              cash: availableCash,
              principalLoanBudget: hedgePrincipalLoanRemainingForFunding
            })
          : 0;
      const previewWalletCashRequired = roundNumber(
        Math.max(0, requestedTradeNotional - previewPrincipalLoan) + buyCostsPreview.nonTaxCost,
        2
      );

      if (previewWalletCashRequired > availableCash + 0.01) {
        if (hedgeFocusActive) {
          showReplayDeskToast(
            `The sleeve did not open because ${formatNotional(requestedTradeNotional)} PT plus about ${formatNotional(
              buyCostsPreview.nonTaxCost
            )} PT of upfront drag needs ${formatNotional(
              previewWalletCashRequired
            )} PT of wallet cash after the signed principal loan. Lower the sleeve notional, then buy it before opening the hedge.`
          );
          setFeedback('');
        } else {
          setFeedback('Not enough replay buying power after fees and routing drag.');
        }
        return;
      }
    }

    if (side === 'buy') {
      setPendingBuyTrade({
        productId: selectedProductId,
        side,
        tradeBar: focusedTradeBar,
        tradeIndex: focusedTradeIndex,
        tradeInterval: selectedView?.interval,
        requestedNotional: requestedTradeNotional,
        unitsPreview: focusedUnitsPreview,
        customFeedback
      });
      return;
    }

    const currentPosition = paperState.positions[selectedProductId] || { units: 0 };
    if (currentPosition.units <= 0) {
      setFeedback('No open replay position is available to sell for this product.');
      return;
    }

    const sellNotional = focusedPrice > 0 ? roundNumber((currentPosition.units || 0) * focusedPrice, 2) : 0;
    setIsPlaying(false);
    setHoveredReplayIndex(null);
    updateSelectedReplay({
      cursor: focusedTradeIndex,
      replayStarted: false
    });
    const sellFeePreview = buildPositionSnapshot(selectedProduct, currentPosition, focusedPrice, focusedTradeBar.ts);
    const sellSigned = await ensureReplayTradeSignature({
      side,
      tradeBar: focusedTradeBar,
      tradeInterval: selectedView?.interval,
      notional: options.forceSellAll
        ? sellNotional
        : Math.min(requestedTradeNotional, sellNotional || requestedTradeNotional),
      unitsPreview: currentPosition.units || 0,
      feeBreakdown: buildSpotSettlementFeeRows(sellFeePreview)
    });

    if (!sellSigned) return;

    executeReplayTrade({
      side,
      tradeBar: focusedTradeBar,
      tradeInterval: selectedView?.interval,
      customFeedback,
      forceSellAll: Boolean(options.forceSellAll),
      outcomeActionLabel: options.outcomeActionLabel,
      outcomeOverride: options.outcomeOverride
    });
  }

  async function handleSettleOptionStrategy() {
    if (!advancedActivityEnabled || selectedAdvancedRoute !== 'borrow') {
      setFeedback(advancedActivityUnlockCopy);
      return;
    }

    const bars = selectedView?.bars || [];
    const currentPosition = paperState.positions[selectedProductId] || { units: 0, principal: 0, entryTs: '' };
    if (!bars.length) {
      setFeedback('Replay bars are still loading for this product.');
      return;
    }

    if (currentPosition.units <= 0) {
      setFeedback('Build the paper strategy first so there is a ticket to settle.');
      return;
    }

    const entryIndexFromTs = currentPosition.entryTs ? bars.findIndex((bar) => bar.ts === currentPosition.entryTs) : -1;
    const entryIndex = entryIndexFromTs >= 0 ? entryIndexFromTs : Math.max(0, Math.min(selectedView.cursor || 0, bars.length - 1));
    const targetIndex = findReplayIndexAfterDays(bars, entryIndex, simulationHoldingDays);
    const entryBar = bars[entryIndex];
    const targetBar = bars[targetIndex];

    if (!entryBar || !targetBar || targetIndex <= entryIndex) {
      setFeedback('The selected holding period does not reach a later settlement bar for this chart.');
      return;
    }

    const strategyOutcome = estimateOptionStrategyPracticeOutcome({
      product: selectedProduct,
      startBar: entryBar,
      endBar: targetBar,
      notional: Math.max(MIN_PAPER_TRADE, Number(currentPosition.principal || tradeAmount || MIN_PAPER_TRADE)),
      templateId: selectedStrategyTemplateId,
      controls: strategyControlValues
    });

    if (!strategyOutcome) {
      setFeedback('The option payoff could not be calculated from the selected replay bars.');
      return;
    }

    setIsPlaying(false);
    setHoveredReplayIndex(null);
    updateSelectedReplay({
      cursor: targetIndex,
      replayStarted: false
    });

    const settleSigned = await ensureReplayTradeSignature({
      side: `settle ${OPTION_STRATEGY_LABELS[selectedStrategyTemplateId] || 'strategy'}`,
      tradeBar: targetBar,
      tradeInterval: selectedView?.interval,
      notional: strategyOutcome.exitValue,
      unitsPreview: currentPosition.units || 0,
      feeBreakdown: normalizeFeeDisclosureRows([
        { label: 'Management fee', amount: strategyOutcome.managementFee || 0 }
      ])
    });

    if (!settleSigned) return;

    executeReplayTrade({
      side: 'sell',
      tradeBar: targetBar,
      tradeInterval: selectedView?.interval,
      forceSellAll: true,
      outcomeActionLabel: `Settle ${OPTION_STRATEGY_LABELS[selectedStrategyTemplateId] || 'strategy'}`,
      outcomeOverride: {
        applyToLedger: true,
        actionLabel: `Settle ${OPTION_STRATEGY_LABELS[selectedStrategyTemplateId] || 'strategy'}`,
        pnl: strategyOutcome.netPnl,
        exitValue: strategyOutcome.exitValue,
        managementFee: strategyOutcome.managementFee,
        ts: targetBar.ts
      },
      customFeedback: `${OPTION_STRATEGY_LABELS[selectedStrategyTemplateId] || 'Strategy'} settled on ${formatReplayDate(
        targetBar.ts,
        selectedView?.interval
      )}. Historical move ${formatSignedPercent(strategyOutcome.grossMoveRate * 100, 1)} became ${formatSigned(
        strategyOutcome.netPnl
      )} PT after the selected payoff controls.`
    });
    mergeProgressUpdate({ strategyLessonCompleted: true, strategyExampleCompleted: true });
  }

  async function executeTimedSpotExit(productId = selectedProductId) {
    const product = productMap[productId];
    const view = productViews[productId];
    const currentPosition = paperState.positions[productId] || { units: 0 };

    if (!product || !view?.bars?.length) {
      setFeedback('Replay bars are still loading for this product.');
      return false;
    }

    if (currentPosition.units <= 0) {
      setFeedback(`Buy ${product.ticker || product.name} first so the timed exit button has units to unwind.`);
      return false;
    }

    const anchorIndex = Math.max(0, Math.min(view.cursor || 0, view.bars.length - 1));
    const anchorBar = view.bars[anchorIndex];
    const targetIndex = findReplayIndexAfterDays(view.bars, anchorIndex, simulationHoldingDays);
    if (targetIndex <= anchorIndex) {
      setFeedback(`The ${product.ticker || product.name} row is locked until a later replay bar. Pick a longer window or move its cursor earlier before auto-selling.`);
      return false;
    }

    const targetBar = view.bars[targetIndex];
    const targetSnapshot = buildPositionSnapshot(product, currentPosition, Number(targetBar?.close || 0), targetBar?.ts);
    const executedHoldingDays = Math.max(1, Math.round(getHoldingDays(anchorBar?.ts, targetBar?.ts)));
    const autoSellSigned = await ensureReplayTradeSignature({
      side: 'auto-sell',
      tradeBar: targetBar,
      tradeInterval: view.interval,
      notional: targetSnapshot.netExitValue,
      unitsPreview: currentPosition.units,
      feeBreakdown: buildSpotSettlementFeeRows(targetSnapshot)
    });

    if (!autoSellSigned) return false;

    setIsPlaying(false);
    setHoveredReplayIndex(null);
    updateReplayForProduct(productId, {
      cursor: targetIndex,
      replayStarted: false
    });

    setPaperState((current) => {
      const livePosition = current.positions[productId] || currentPosition;
      if (!livePosition.units) return current;

      const liveSnapshot = buildPositionSnapshot(product, livePosition, Number(targetBar?.close || 0), targetBar?.ts);
      const nextPositions = { ...current.positions };
      delete nextPositions[productId];

      return {
        ...current,
        cash: roundNumber(current.cash + liveSnapshot.netExitValue, 2),
        realizedPnl: roundNumber(Number(current.realizedPnl || 0) + liveSnapshot.netPnl, 2),
        positions: nextPositions,
        trades: [
          {
            id: `${productId}-${targetBar.ts}-sell-${current.trades.length}`,
            productId,
            side: 'sell',
            notional: liveSnapshot.grossValue,
            units: livePosition.units,
            price: Number(targetBar?.close || 0),
            ts: targetBar.ts,
            interval: view.interval,
            realizedPnl: liveSnapshot.netPnl,
            feeTotal: liveSnapshot.exitCosts.nonTaxCost,
            taxTotal: liveSnapshot.exitCosts.estimatedTax,
            carryTotal: liveSnapshot.unpaidCarry,
            managementFeeTotal: liveSnapshot.managementFee,
            loanRepaid: liveSnapshot.principalLoan
          },
          ...current.trades
        ]
      };
    });

    const finalizedOutcome = finalizeTradeOutcome({
      product,
      routeId: 'spot',
      actionLabel: 'Auto-sell',
      tradeTs: targetBar.ts,
      pnl: targetSnapshot.netPnl,
      exitValue: targetSnapshot.netExitValue
    });

    updateProgressAfterTrade();
    setHedgeSleeveReadyByProduct((current) => {
      if (!current[productId]) return current;
      const next = { ...current };
      delete next[productId];
      return next;
    });
    setFeedback(
      `Auto-sell executed for ${product.ticker || product.name} after about ${executedHoldingDays}D: ${formatReplayDate(
        anchorBar?.ts,
        view.interval
      )} -> ${formatReplayDate(targetBar?.ts, view.interval)}. Sold ${formatUnits(currentPosition.units)} units at ${formatPrice(
        targetBar?.close
      )} for about ${formatSigned(targetSnapshot.netPnl)} PT take-home PnL.` +
        (finalizedOutcome?.compensationGranted
          ? ` Daily recovery grant +${formatNotional(finalizedOutcome.compensationGranted)} PT was added after the close.`
          : '')
    );
    return true;
  }

  async function handleTimedExitReplay(productId = selectedProductId) {
    if (productId !== selectedProductId) {
      await executeTimedSpotExit(productId);
      return;
    }

    const timedExitAllowed = leverageRouteActive ? advancedActivityEnabled : selectedAdvancedRoute === 'spot' || routeActionsLocked || advancedActivityEnabled;

    if (!timedExitAllowed) {
      setFeedback(advancedActivityUnlockCopy);
      return;
    }

    if (!selectedView?.bars?.length) {
      setFeedback('Replay bars are still loading for this product.');
      return;
    }

    if (selectedAdvancedRoute === 'perp' && productId === selectedProductId && activePerpLeg) {
      if (!activePerpLeg) {
        setFeedback(
          hedgeFocusActive
            ? 'Buy the sleeve first, play replay into a risk day, then open the hedge before trying to unwind it.'
            : 'Open long or open short first so the leverage route has a live leg to close.'
        );
        return;
      }
      const closingPurpose = activePerpPurpose || (hedgeFocusActive ? 'hedge' : 'leverage');

      const anchorIndex =
        selectedActivePerpEntryIndex >= 0
          ? selectedActivePerpEntryIndex
          : Math.max(0, Math.min(selectedView.cursor || 0, selectedView.bars.length - 1));
      const anchorBar = selectedView.bars[anchorIndex];
      const targetIndex = findReplayIndexAfterDays(selectedView.bars, anchorIndex, simulationHoldingDays);
      if (targetIndex <= anchorIndex) {
        setFeedback('Choose an earlier replay bar first so holding period can jump forward before closing the leveraged leg.');
        return;
      }

      const targetBar = selectedView.bars[targetIndex];
      const leveragedSnapshot = buildLeveragedReplaySnapshot({
        direction: activePerpLeg,
        marginCapital: activePerpSnapshotMarginCapital,
        leverage: activePerpSnapshotLeverage,
        entryBar: anchorBar,
        targetBar,
        holdingDays: Math.max(1, Math.round(getHoldingDays(anchorBar?.ts, targetBar?.ts))),
        targetNotional: activePerpSnapshotTargetNotional,
        flashLoanAmount: activePerpSnapshotFlashLoanAmount,
        flashLoanFee: activePerpSnapshotFlashLoanFee
      });

      if (!leveragedSnapshot) {
        setFeedback('Margin and leverage need to be valid before the desk can preview a timed close.');
        return;
      }

      const closeSigned = await ensurePerpTradeSignature({
        direction: activePerpLeg,
        action: 'auto-close',
        flashNotional: 0,
        reason:
          closingPurpose === 'hedge'
            ? `auto-unwind the ${activePerpLeg} hedge leg after about ${simulationHoldingDays}D`
            : `auto-close the ${activePerpLeg} leveraged leg after about ${simulationHoldingDays}D`,
        feeBreakdown: buildLeveragedSettlementFeeRows(leveragedSnapshot, activePerpSnapshotFlashReserveCapital)
      });

      if (!closeSigned) return;

      const executedHoldingDays = Math.max(1, Math.round(getHoldingDays(anchorBar?.ts, targetBar?.ts)));
      const customFeedback = `${closingPurpose === 'hedge' ? 'Auto-unwind hedge' : `Auto-close ${activePerpLeg}`} after about ${executedHoldingDays}D: ${formatReplayDate(
        anchorBar?.ts,
        selectedView.interval
      )} -> ${formatReplayDate(targetBar?.ts, selectedView.interval)}. ${formatNotional(
        leveragedSnapshot.exposureNotional
      )} PT notional on ${formatNotional(leveragedSnapshot.marginCapital)} PT margin returned about ${formatSigned(
        leveragedSnapshot.netPnl
      )} PT take-home PnL.`;

      setIsPlaying(false);
      setHoveredReplayIndex(null);
      updateSelectedReplay({
        cursor: targetIndex,
        replayStarted: false
      });
      setActivePerpLeg(null);
      setActivePerpPurpose(null);
      setActivePerpEntry(null);
      setFlashLoanAppliedQuotes({});
      setFlashLoanDraftQuotes({});
      flashLoanQuoteContextRef.current = '';
      const leveragedTradeOutcome = finalizeTradeOutcome({
        product: selectedProduct,
        routeId: closingPurpose === 'hedge' ? 'hedge' : 'perp',
        actionLabel: closingPurpose === 'hedge' ? `Auto-unwind ${activePerpLeg} hedge` : `Auto-close ${activePerpLeg}`,
        tradeTs: targetBar?.ts,
        pnl: leveragedSnapshot.netPnl,
        exitValue: roundNumber((leveragedSnapshot.netExitValue || 0) + activePerpSnapshotFlashReserveCapital, 2),
        paperCashDelta: leveragedSnapshot.netPnl,
        realizedPnlDelta: leveragedSnapshot.netPnl
      });
      if (closingPurpose === 'hedge' && Number(leveragedSnapshot.netPnl || 0) > 0) {
        mergeProgressUpdate({ hedgePositiveCloseCompleted: true });
      }
      setFeedback(customFeedback);
      if (leveragedTradeOutcome?.compensationGranted) {
        setFeedback(
          `${customFeedback} Daily recovery grant +${formatNotional(leveragedTradeOutcome.compensationGranted)} PT was added after the close.`
        );
      }
      return;
    }

    await executeTimedSpotExit(productId);
  }

  function handleOpenFlashLoanConfirm() {
    if (!advancedActivityEnabled) {
      setFeedback(advancedActivityUnlockCopy);
      return;
    }

    if (!leverageRouteActive) {
      setFeedback('Flash notional quotes only show inside the leverage route.');
      return;
    }

    if (!Number.isFinite(Number(tradeAmount)) || Number(tradeAmount) <= 0) {
      setFeedback('Set a hedge ticket above 0 PT first, then confirm that ticket before quoting flash liquidity.');
      return;
    }

    if (flashLoanQuoteMaxNotional <= 0) {
      setFeedback('The current wallet and collateral state leaves 0 PT flash capacity for this route.');
      return;
    }

    if (flashLoanAttachableMaxNotional <= 0) {
      setFeedback(
        hedgeFocusActive
          ? hedgeFlashTopUpRemaining > 0
            ? 'This hedge needs more flash top-up, but the current margin reserve leaves 0 PT of attachable flash capacity.'
            : 'This hedge ticket is already wallet-backed. Increase the hedge ticket size above the wallet-backed route before quoting a flash top-up.'
          : 'This wallet and collateral state leaves 0 PT of route-bound flash capacity for the leverage leg. Add cash, pledge wealth collateral, or lower the current route reserve first.'
      );
      return;
    }

    setFlashLoanTicketConfirmOpen(true);
  }

  function handleFlashLoanPreview() {
    setFlashLoanTicketConfirmOpen(false);

    if (!Object.keys(flashLoanDraftQuotes).length) {
      const suggestedLeverageBoost = hedgeFocusActive
        ? hedgeFlashTopUpNeed
        : Math.min(
            flashLoanAttachableMaxNotional,
            Math.max(
              flashLoanRemainingShortfall,
              flashLoanAppliedTicketNotional,
              routeRequestedTicketNotional > 0 ? routeRequestedTicketNotional * 0.25 : flashLoanAttachableMaxNotional
            )
          );
      const defaultDesiredBoost = roundNumber(
        Math.max(
          suggestedLeverageBoost,
          Math.min(flashLoanAppliedTicketNotional, flashLoanAttachableMaxNotional)
        ),
        2
      );
      const seededRequestedById = Object.fromEntries(flashLoanQuoteRows.map((row) => [row.id, defaultDesiredBoost]));
      setFlashLoanDraftQuotes(allocateFlashQuotesByRate(seededRequestedById, defaultDesiredBoost, flashLoanQuoteRows, flashLoanQuoteCaps));
    }
    flashLoanQuoteContextRef.current = currentFlashLoanContextKey;
    setFlashLoanQuoteOpen(true);
    setFeedback(
      Number(flashLoanQuoteCaps.ticket || 0) > 0 || Number(flashLoanQuoteCaps.general || 0) > 0
        ? hedgeFocusActive && flashLoanAppliedTicketNotional > 0 && hedgeFlashTopUpRemaining > 0
          ? `Flash quote opened for the remaining ${formatNotional(hedgeFlashTopUpRemaining)} PT top-up.`
          : hedgeFocusActive
            ? 'Flash quote opened. It can top up the hedge ticket after the sleeve has consumed wallet PT and loan pool capacity.'
            : 'Flash quote opened. In leverage mode, confirmed flash now stacks on top of the wallet-backed route exposure, so changing the flash amount changes modeled take-home.'
        : 'Flash quote opened. The current wallet shows 0 available flash capacity, so the modal will explain what reserve or collateral support is missing.'
    );
  }

  function handleFlashLoanQuoteChange(laneId, nextValue) {
    const laneCap = Math.min(
      Number(flashLoanQuoteCaps?.[laneId] || flashLoanAttachableMaxNotional || 0),
      Number(flashLoanAttachableMaxNotional || 0)
    );
    setFlashLoanDraftQuotes((current) => ({
      ...current,
      [laneId]:
        nextValue === ''
          ? ''
          : roundNumber(Math.max(0, Math.min(Number(nextValue || 0), laneCap)), 2)
    }));
  }

  function handleFlashLoanQuoteMax(laneId, maxValue) {
    handleFlashLoanQuoteChange(laneId, roundNumber(Math.min(Math.max(0, Number(maxValue || 0)), flashLoanAttachableMaxNotional), 2));
  }

  async function handleConfirmFlashLoanQuote() {
    const nextApplied = allocateFlashQuotesByRate(
      flashLoanDraftQuotes,
      flashLoanAttachableMaxNotional,
      flashLoanQuoteRows,
      flashLoanQuoteCaps
    );
    const totalApplied = roundNumber(Object.values(nextApplied).reduce((sum, value) => sum + Number(value || 0), 0), 2);

    if (totalApplied <= 0) {
      setFlashLoanAppliedQuotes({});
      setFlashLoanQuoteOpen(false);
      flashLoanQuoteContextRef.current = '';
      setPendingPerpDirectionAfterQuote(null);
      setFeedback('Flash quote cleared. This ticket is back to wallet-backed sizing only.');
      return;
    }

    setFlashLoanAppliedQuotes(nextApplied);
    setFlashLoanDraftQuotes(nextApplied);
    setFlashLoanQuoteOpen(false);
    flashLoanQuoteContextRef.current = currentFlashLoanContextKey;
    setFeedback(
      hedgeFocusActive
        ? `Flash quote attached: ${formatNotional(totalApplied)} PT notional. In hedge mode it tops up the staged hedge ticket only, so it stays capped by the hedge size you are trying to open.`
        : `Flash quote attached: ${formatNotional(totalApplied)} PT notional. Attested route credit prices first because eligible same-purpose products inside this exchange can be proven by the signed route. Broad flash keeps the higher surcharge because the use is not restricted or proven. In leverage mode this flash now adds route-bound exposure on top of the wallet-backed leg, so the modeled take-home updates with the attached amount.`
    );

    if (pendingPerpDirectionAfterQuote) {
      const queuedDirection = pendingPerpDirectionAfterQuote;
      setPendingPerpDirectionAfterQuote(null);
      setPendingPerpRiskConfirm({
        direction: queuedDirection,
        action: 'open',
        tradeAmount: Number(tradeAmount || 0),
        leverageLabel: routeLeverageMultiple === 1 ? 'No leverage' : `${routeLeverageMultiple}x leverage`,
        flashAmount: totalApplied
      });
    }
  }

  function handleClearFlashLoanQuote() {
    setFlashLoanAppliedQuotes({});
    setFlashLoanDraftQuotes({});
    setFlashLoanQuoteOpen(false);
    flashLoanQuoteContextRef.current = '';
    setPendingPerpDirectionAfterQuote(null);
    setFeedback('Flash quote removed from this ticket.');
  }

  function handleLaneChange(nextLane) {
    setSelectedLane(nextLane);
    const nextProduct = REPLAY_PRODUCTS.find((product) => product.lane === nextLane);
    if (nextProduct) {
      setSelectedProductId(nextProduct.id);
      setIsPlaying(false);
      setHoveredReplayIndex(null);
      setSelectedReplayPanel('desk');
    }
  }

  function handleShelfPageChange(nextPage) {
    const clampedPage = clamp(nextPage, 1, paperShelfPageCount);
    setPaperShelfPage(clampedPage);
    if (paperShelfScrollAreaRef.current) {
      paperShelfScrollAreaRef.current.scrollTop = 0;
    }
    const nextPageStart = (clampedPage - 1) * PAPER_SHELF_PAGE_SIZE;
    const nextPageProduct = filteredProducts[nextPageStart];
    if (nextPageProduct) {
      setSelectedProductId(nextPageProduct.id);
    }
  }

  function handleReplayFillsPageChange(nextPage) {
    setReplayFillsPage(clamp(nextPage, 1, replayFillsPageCount));
  }

  function handleSelectProduct(productId) {
    const nextIndex = filteredProducts.findIndex((product) => product.id === productId);
    if (nextIndex >= 0) {
      setPaperShelfPage(Math.floor(nextIndex / PAPER_SHELF_PAGE_SIZE) + 1);
    }
    setSelectedProductId(productId);
    setIsPlaying(false);
    setHoveredReplayIndex(null);
    setSelectedReplayPanel('desk');
    setFeedback('');
  }

  function beginProductLeaderboardDrag(event) {
    if (event.button !== 0) return;
    if (event.target.closest('button')) return;
    event.preventDefault();
    setProductLeaderboardGesture({
      type: 'drag',
      startX: event.clientX,
      startY: event.clientY,
      left: productLeaderboardFloat.left,
      top: productLeaderboardFloat.top
    });
  }

  function beginProductLeaderboardResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    setProductLeaderboardGesture({
      type: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      width: productLeaderboardFloat.width,
      height: productLeaderboardFloat.height
    });
  }

  function beginProductLeaderboardArrowGesture(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    setProductLeaderboardGesture({
      type: 'arrow',
      startX: event.clientX,
      startY: event.clientY,
      arrowTop: productLeaderboardFloat.arrowTop
    });
  }

  function handleCollapseProductLeaderboard() {
    const anchor = getCollapsedProductLeaderboardAnchor(productLeaderboardFloat);
    setProductLeaderboardFloat((current) =>
      normalizeProductLeaderboardFloat({
        ...current,
        isCollapsed: true,
        arrowSide: anchor.arrowSide,
        arrowTop: anchor.arrowTop
      })
    );
  }

  function handleExpandProductLeaderboard() {
    setProductLeaderboardFloat((current) =>
      normalizeProductLeaderboardFloat({
        ...current,
        isCollapsed: false
      })
    );
  }

  function beginAutoSellDockDrag(event) {
    if (event.button !== 0) return;
    if (event.target?.closest?.('button, input, select, textarea, a, label')) return;
    event.preventDefault();
    setAutoSellDockGesture({
      type: 'drag',
      startX: event.clientX,
      startY: event.clientY,
      left: autoSellDockFloat.left,
      top: autoSellDockFloat.top
    });
  }

  function beginAutoSellDockArrowGesture(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    setAutoSellDockGesture({
      type: 'arrow',
      startX: event.clientX,
      startY: event.clientY,
      arrowTop: autoSellDockFloat.arrowTop
    });
  }

  function handleCollapseAutoSellDock() {
    const anchor = getCollapsedProductLeaderboardAnchor(autoSellDockFloat);
    setAutoSellDockFloat((current) =>
      normalizeAutoSellDockFloat({
        ...current,
        isCollapsed: true,
        arrowSide: anchor.arrowSide,
        arrowTop: anchor.arrowTop
      })
    );
    setAutoSellDockOpen(false);
  }

  function handleExpandAutoSellDock() {
    setAutoSellDockFloat((current) =>
      normalizeAutoSellDockFloat({
        ...current,
        isCollapsed: false
      })
    );
    setAutoSellDockOpen(true);
  }

  function handleSelectLearningRoute(nextValue) {
    const [routeIdRaw, focusIdRaw] = String(nextValue || '').split(':');
    const routeId = routeIdRaw || 'spot';
    const focusId = routeId === 'perp' ? focusIdRaw || getDefaultPerpFocusForLane(selectedProduct.lane) : null;
    const nextRoute = availableReplayRoutes.find((route) => route.id === routeId) || availableReplayRoutes[0] || ADVANCED_REPLAY_ROUTES[0];

    let nextRouteFeedbackLabel = nextRoute.label;
    const nextFocusOptions = routeId === 'perp' ? visiblePerpFocusOptions : [];
    const nextFocus = routeId === 'perp'
      ? nextFocusOptions.find((option) => option.id === focusId) || nextFocusOptions[0]
      : null;
    if (routeId === 'perp') {
      nextRouteFeedbackLabel = nextFocus?.label || nextRoute.label;
    }
    const nextRouteActionsLocked = isReplayRouteLocked(nextRoute.id);
    setSelectedAdvancedRoute(nextRoute.id);
    if (routeId === 'perp') {
      setSelectedRouteFocusByRoute((current) => ({
        ...current,
        perp: nextFocus?.id || getDefaultPerpFocusForLane(selectedProduct.lane)
      }));
    }
    startTransition(() => {
      setHoveredReplayIndex(null);
      setSelectedReplayPanel(nextRoute.id === 'perp' ? 'contract' : 'desk');
    });
    setFeedback(
      nextRouteActionsLocked
        ? `${nextRouteFeedbackLabel} preview is open. Advanced trade actions still need Task 1 + Task 2, but the tutorial route can be inspected now.`
        : `${nextRouteFeedbackLabel} is now selected as the replay learning path.`
    );
  }

  function handleSelectDeskStructureMode(modeId) {
    if (!advancedActivityEnabled && modeId !== 'single') {
      setFeedback(advancedActivityUnlockCopy);
      return;
    }

    setDeskStructureMode(modeId);
    if (modeId === 'flash') {
      setFeedback('Flash route preview is illustrative only. The edge must exceed spread, gas, and same-block unwind risk before it is usable.');
    } else if (modeId === 'collateral') {
      setFeedback('Collateral loop preview is active. The desk now models route support, support carry, and the need to release collateral before normal redemption.');
    } else if (modeId === 'combo') {
      setFeedback('Anchor + active preview is active. The desk now blends the current route with a calmer anchor so diversification and blended drag stay readable.');
    } else if (modeId === 'dca') {
      setFeedback('DCA ladder preview is active. The desk now splits the entry across several smaller buys so you can compare smoother timing against extra fees.');
    } else if (modeId === 'maturity') {
      setFeedback('Maturity path preview is active. This route now focuses on hold-to-maturity proceeds instead of instant issuer redemption.');
    } else {
      setFeedback('One-ticket preview restored.');
    }
  }

  async function completePerpShortcut(direction) {
    const nextLeg = activePerpLeg === direction ? null : direction;
    const closingPurpose = activePerpPurpose || (hedgeFocusActive ? 'hedge' : 'leverage');
    const closingSnapshot = !nextLeg ? replayFocusLeveragedSnapshot : null;
    const openingPurpose = hedgeFocusActive ? 'hedge' : 'leverage';
    const openingBar = replayFocus.bar || replayFocus.lockedBar;
    const openingIndex = replayFocus.index ?? replayCursorIndex;
    const openingFlashNotional = hedgeFocusActive ? flashLoanAppliedTicketNotional : routePreviewFlashNotional;
    const openingFlashPremium = hedgeFocusActive ? flashLoanPremiumEstimate : routePreviewFlashPremiumEstimate;
    const openingTicketNotional = hedgeFocusActive ? routeEffectiveTicketNotional : routePreviewTicketNotional;
    const closingFeeBreakdown = closingSnapshot
      ? buildLeveragedSettlementFeeRows(closingSnapshot, activePerpSnapshotFlashReserveCapital)
      : [];
    const tradeSigned = await ensurePerpTradeSignature({
      direction,
      action: nextLeg ? 'open' : 'close',
      flashNotional: nextLeg ? openingFlashNotional : 0,
      reason: nextLeg
        ? hedgeFocusActive
          ? `open a ${direction} protective hedge leg`
          : `open a ${direction} leveraged leg`
        : closingPurpose === 'hedge'
          ? `close the ${direction} hedge leg`
          : `close the ${direction} leveraged leg`,
      feeBreakdown: nextLeg ? [] : closingFeeBreakdown
    });

    if (!tradeSigned) {
      return false;
    }

    if (!nextLeg) {
      setIsPlaying(false);
      setHoveredReplayIndex(null);
      updateSelectedReplay({
        cursor: Math.max(0, Math.min(selectedView?.cursor || 0, Math.max(0, (selectedView?.bars?.length || 1) - 1))),
        replayStarted: false
      });
    }

    setSelectedAdvancedRoute('perp');
    setSelectedReplayPanel('contract');
    setContractDirection(direction);
    setShowAdvancedDeskControls(true);
    setActivePerpLeg(nextLeg);
    setActivePerpPurpose(nextLeg ? (hedgeFocusActive ? 'hedge' : 'leverage') : null);
    setActivePerpEntry(
      nextLeg
        ? {
            productId: selectedProductId,
            direction,
            purpose: openingPurpose,
            entryIndex: openingIndex,
            entryTs: openingBar?.ts || '',
            entryBar: openingBar,
            marginCapital: routePostedBaseMarginCapital,
            routeMarginCapital,
            leverage: routeLeverageMultiple,
            targetNotional: openingTicketNotional,
            flashLoanAmount: openingFlashNotional,
            flashLoanFee: openingFlashPremium,
            flashReserveCapital: routePostedFlashReserveCapital
          }
        : null
    );
    if (nextLeg) {
      mergeProgressUpdate(
        hedgeFocusActive
          ? { hedgeLessonCompleted: true, hedgeSizingCompleted: true }
          : { leverageLessonCompleted: true }
      );
    }
    const leveragedTradeOutcome =
      !nextLeg && closingSnapshot
        ? finalizeTradeOutcome({
            product: selectedProduct,
            routeId: closingPurpose === 'hedge' ? 'hedge' : 'perp',
            actionLabel: closingPurpose === 'hedge' ? `Close ${direction} hedge` : `Close ${direction}`,
            tradeTs: replayFocus.bar?.ts || replayFocus.lockedBar?.ts,
            pnl: closingSnapshot.netPnl,
            exitValue: roundNumber((closingSnapshot.netExitValue || 0) + activePerpSnapshotFlashReserveCapital, 2),
            paperCashDelta: closingSnapshot.netPnl,
            realizedPnlDelta: closingSnapshot.netPnl
          })
        : null;
    if (!nextLeg) {
      setFlashLoanAppliedQuotes({});
      setFlashLoanDraftQuotes({});
      flashLoanQuoteContextRef.current = '';
    }
    if (!nextLeg && closingPurpose === 'hedge' && closingSnapshot && Number(closingSnapshot.netPnl || 0) > 0) {
      mergeProgressUpdate({ hedgePositiveCloseCompleted: true });
    }
    setFeedback(
      nextLeg
        ? hedgeFocusActive
          ? `Perp ${direction} hedge is now active. Review hedgeability, exit haircut, and funding drag below before treating it like a clean offset.`
          : `Perp ${direction} tutorial is now active. Review leverage, liquidation marker, and fee drag below before treating it like a live short or long.`
        : `${closingPurpose === 'hedge' ? `Perp ${direction} hedge is now closed.` : `Perp ${direction} tutorial is now closed.`} You can reopen it or switch direction any time.` +
            (leveragedTradeOutcome?.compensationGranted
              ? ` Daily recovery grant +${formatNotional(leveragedTradeOutcome.compensationGranted)} PT was added after the close.`
              : '')
    );
    return true;
  }

  async function handlePerpShortcut(direction, options = {}) {
    if (!advancedActivityEnabled) {
      setFeedback(advancedActivityUnlockCopy);
      setSelectedReplayPanel('desk');
      return;
    }
    const nextLeg = activePerpLeg === direction ? null : direction;
    if (hedgeFocusActive && nextLeg && !hedgeSizingReady) {
      setFeedback('Lock a replay bar and set principal first so hedge mode can size the protective leg before the hedge opens.');
      return;
    }
    setPendingPerpTradeConfirm({
      direction,
      action: nextLeg ? 'open' : 'close',
      tradeAmount: Number(tradeAmount || 0),
      leverageLabel: routeLeverageMultiple === 1 ? 'No leverage' : `${routeLeverageMultiple}x leverage`,
      anchorLabel: formatReplayDate(replayFocus.lockedBar?.ts || replayFocus.bar?.ts, selectedView?.interval),
      flashModeLabel: selectedTradeAmountMaxLabel,
      focusId: selectedRouteFocusConfig?.id || 'leverage',
      focusLabel: activeRouteFocusConfig?.label || selectedRouteFocusConfig?.label || 'Leverage',
      customCopy: hedgeFocusActive ? hedgeFocusProfile?.tradeConfirmCopy : '',
      closeSleeveAfterHedge: Boolean(options.closeSleeveAfterHedge)
    });
  }

  async function confirmPerpTradeModal() {
    if (!pendingPerpTradeConfirm) return;

    const queuedTrade = pendingPerpTradeConfirm;
    const needsFlashQuoteBeforeOpen =
      queuedTrade.action === 'open' &&
      (hedgeFocusActive
        ? hedgeFlashTopUpRemaining > 0.01
        : routePreviewFlashNotional > flashLoanAppliedTicketNotional + 0.01) &&
      flashLoanAttachableMaxNotional > 0;

    setPendingPerpTradeConfirm(null);

    if (needsFlashQuoteBeforeOpen) {
      setPendingPerpDirectionAfterQuote(queuedTrade.direction);
      setContractDirection(queuedTrade.direction);
      setShowAdvancedDeskControls(true);
      setFeedback(
        tradeAmountMaxMode === 'ticket' || hedgeFocusActive
          ? hedgeFocusActive
            ? 'Hedge confirmed. Stage the attested flash quote next, then MetaMask will ask for the hedge signature before the leg opens.'
            : 'Trade confirmed. Stage the attested flash quote next, then MetaMask will ask for the leverage signature before the long or short opens.'
          : hedgeFocusActive
            ? 'Hedge confirmed. Stage the broad flash quote next, then MetaMask will ask for the hedge signature before the leg opens.'
            : 'Trade confirmed. Stage the broad flash quote next, then MetaMask will ask for the leverage signature before the long or short opens.'
      );
      handleOpenFlashLoanConfirm();
      return;
    }

    setPendingPerpDirectionAfterQuote(null);
    setPendingPerpRiskConfirm({
      direction: queuedTrade.direction,
      action: queuedTrade.action,
      tradeAmount: queuedTrade.tradeAmount,
      leverageLabel: queuedTrade.leverageLabel,
      flashAmount: queuedTrade.action === 'open' ? routePreviewFlashNotional : 0,
      focusId: queuedTrade.focusId || 'leverage',
      focusLabel: queuedTrade.focusLabel || 'Leverage',
      customCopy: hedgeFocusActive ? hedgeFocusProfile?.riskConfirmCopy : '',
      closeSleeveAfterHedge: Boolean(queuedTrade.closeSleeveAfterHedge)
    });
  }

  function closePerpRiskModal() {
    const shouldClearQuotedFlash =
      pendingPerpRiskConfirm?.action === 'open' &&
      leverageRouteActive &&
      flashLoanAppliedTicketNotional > 0 &&
      !activePerpLeg;

    setPendingPerpRiskConfirm(null);
    setPendingPerpDirectionAfterQuote(null);
    if (shouldClearQuotedFlash) {
      setFlashLoanAppliedQuotes({});
      setFlashLoanDraftQuotes({});
      flashLoanQuoteContextRef.current = '';
    }
  }

  async function confirmPerpRiskModal() {
    if (!pendingPerpRiskConfirm) return;

    const queuedTrade = pendingPerpRiskConfirm;
    const completed = await completePerpShortcut(queuedTrade.direction);
    setPendingPerpRiskConfirm(null);

    if (completed && queuedTrade.closeSleeveAfterHedge) {
      await handlePlaceTrade('sell', {
        forceSellAll: true,
        outcomeActionLabel: 'Protected sleeve close',
        outcomeOverride: {
          actionLabel: 'Protected sleeve close',
          pnl: timedExitEstimatedPnl,
          exitValue: timedExitEstimatedValue
        },
        customFeedback: `Protected sleeve settled with the guided estimate: about ${formatNotional(
          timedExitEstimatedValue
        )} PT value / ${formatSigned(timedExitEstimatedPnl)} PT net.`
      });
      return;
    }

    if (!completed && queuedTrade.action === 'open' && queuedTrade.flashAmount > 0 && !activePerpLeg) {
      setFlashLoanAppliedQuotes({});
      setFlashLoanDraftQuotes({});
      flashLoanQuoteContextRef.current = '';
    }
  }

  function updateSelectedReplay(patch) {
    updateReplayForProduct(selectedProductId, patch);
  }

  function updateReplayForProduct(productId, patch) {
    if (!productId) return;
    setProductViews((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        ...patch
      }
    }));
  }

  function handleReplayCursor(direction) {
    if (!selectedView) return;

    setIsPlaying(false);
    setHoveredReplayIndex(null);
    updateSelectedReplay({
      cursor: Math.max(0, Math.min(selectedView.cursor + direction, selectedView.bars.length - 1)),
      replayStarted: false
    });
  }

  function handleChangeInterval(nextInterval) {
    const rangeOptions = getRangeOptionsForInterval(nextInterval);
    const nextRange = rangeOptions.some((option) => option.id === selectedView.range) ? selectedView.range : rangeOptions[0].id;
    setIsPlaying(false);
    setHoveredReplayIndex(null);
    updateSelectedReplay({
      interval: nextInterval,
      range: nextRange,
      cursor: 0,
      replayStarted: false,
      bars: selectedProduct.csvPath ? [] : buildFallbackBars(selectedProduct, nextInterval, nextRange),
      status: selectedProduct.csvPath ? 'loading' : selectedProduct.sourceType === 'local' ? 'ready' : 'fallback',
      sourceLabel: selectedProduct.csvPath ? selectedProduct.sourceLabel : getReplayFallbackLabel(selectedProduct),
      error: '',
      remoteSignature: ''
    });
  }

  function handleChangeRange(nextRange) {
    setIsPlaying(false);
    setHoveredReplayIndex(null);
    updateSelectedReplay({
      range: nextRange,
      cursor: 0,
      replayStarted: false,
      bars: selectedProduct.csvPath ? [] : buildFallbackBars(selectedProduct, selectedView.interval, nextRange),
      status: selectedProduct.csvPath ? 'loading' : selectedProduct.sourceType === 'local' ? 'ready' : 'fallback',
      sourceLabel: selectedProduct.csvPath ? selectedProduct.sourceLabel : getReplayFallbackLabel(selectedProduct),
      error: '',
      remoteSignature: ''
    });
  }

  const handleSelectReplayIndex = useCallback((nextIndex) => {
    if (!selectedView) return;

    setIsPlaying(false);
    cancelPendingHoveredReplayIndexCommit();
    commitHoveredReplayIndexValue(null);
    setSelectedReplayPanel('desk');
    setProductViews((current) => ({
      ...current,
      [selectedProductId]: {
        ...current[selectedProductId],
        cursor: Math.max(0, Math.min(nextIndex, selectedView.bars.length - 1)),
        replayStarted: false
      }
    }));
  }, [cancelPendingHoveredReplayIndexCommit, commitHoveredReplayIndexValue, selectedProductId, selectedView]);

  function handleToggleReplayPlayback() {
    if (!selectedView?.bars?.length) return;

    if (isPlaying) {
      setIsPlaying(false);
      setFeedback(
        leverageRouteActive && activePerpLeg
          ? hedgeFocusActive
            ? `Replay paused at ${replayFocus.lockedDateLabel}. You can now use this bar as the manual hedge-unwind anchor and confirm Close ${activePerpLeg} hedge.`
            : `Replay paused at ${replayFocus.lockedDateLabel}. You can now use this bar as the manual close anchor and confirm Close ${activePerpLeg}.`
          : `Replay paused at ${replayFocus.lockedDateLabel}.`
      );
      return;
    }

    const playbackStartIndex =
      hoveredReplayIndex == null
        ? Math.max(0, Math.min(selectedView.cursor || 0, selectedView.bars.length - 1))
        : Math.max(0, Math.min(hoveredReplayIndex, selectedView.bars.length - 1));

    if (playbackStartIndex >= selectedView.bars.length - 1) {
      setFeedback('Choose an earlier replay bar first, then start the replay from there.');
      return;
    }

    setHoveredReplayIndex(null);
    updateSelectedReplay({
      cursor: playbackStartIndex,
      replayStarted: true
    });
    setIsPlaying(true);
    setFeedback(`Replay playing from ${formatReplayDate(selectedView.bars[playbackStartIndex]?.ts, selectedView.interval)}.`);
  }

  function handleToggleReplayPanel(panelId) {
    setSelectedReplayPanel((current) => (current === panelId ? null : panelId));
  }

  function handleToggleRewardTask(taskId) {
    setSelectedRewardTaskId((current) => (current === taskId ? null : taskId));
  }

  function handleResetLab() {
    setIsPlaying(false);
    setActivePerpLeg(null);
    setActivePerpPurpose(null);
    setActivePerpEntry(null);
    setFlashLoanDraftQuotes({});
    setFlashLoanAppliedQuotes({});
    flashLoanQuoteContextRef.current = '';
    setHedgeSleeveReadyByProduct({});
    setPaperState(defaultPaperState());
    setProductViews(buildProductViewsFromSession(buildDefaultReplaySession()));
    pendingScoreSnapshotRef.current = null;
    setFeedback('Replay lab reset. Starting cash, positions, and replay cursors were restored.');
  }

  function renderReplayPanel(panelId = selectedReplayPanel) {
    switch (panelId) {
      case 'desk':
        return (
          <div className="paper-desk-grid" ref={tradeDeskRef}>
            <div className="paper-desk-pane">
              <div className="paper-panel-pill-row">
                <span className={`pill ${selectedView?.replayStarted ? 'risk-high' : 'risk-low'}`}>
                  {selectedView?.replayStarted ? 'Replay running' : 'Select entry first'}
                </span>
              </div>

              <label className="wealth-field">
                Paper notional
                <input
                  type="number"
                  min="0"
                  step="250"
                  value={tradeAmountInput}
                  onChange={(event) => handleTradeAmountInputChange(event.target.value)}
                  onBlur={handleTradeAmountBlur}
                />
              </label>

              <div className="paper-balance-strip wealth-balance-strip">
                <div className="paper-balance-box">
                  <div className="label">Available cash</div>
                  <div className="value">{formatNotional(availableCash)} PT</div>
                </div>
                <div className="paper-balance-box">
                  <div className="label">Focus marked value</div>
                  <div className="value">{formatNotional(replayFocus.snapshotAtBar.grossValue)} PT</div>
                </div>
                <div className="paper-balance-box">
                  <div className="label">Average entry</div>
                  <div className="value">{replayFocus.positionAtBar.units ? formatPrice(replayFocus.positionAtBar.avgEntry) : '--'}</div>
                </div>
              </div>

              <div className="paper-ticket-grid">
                <div className="guide-chip">
                  <div className="k">Focus replay close</div>
                  <div className="v">{replayFocus.closeLabel}</div>
                  <div className="muted">
                    {replayFocus.hoverActive
                      ? 'Hover is previewing this bar. Click any bar in the chart to move the locked start point.'
                      : 'Click any bar in the chart to move the locked start point.'}
                  </div>
                </div>
                <div className="guide-chip">
                  <div className="k">Entry drag preview</div>
                  <div className="v">{formatNotional(entryCostPreview.nonTaxCost)} PT</div>
                  <div className="muted">
                    Venue {formatNotional(entryCostPreview.tradeFee)} / spread {formatNotional(entryCostPreview.spreadCost)} / FX{' '}
                    {formatNotional(entryCostPreview.fxCost)} / routing {formatNotional(entryCostPreview.channelCost)}
                  </div>
                </div>
              </div>

              <div className="toolbar">
                <button className="primary-btn" onClick={() => handlePlaceTrade('buy')}>
                  Buy at replay close
                </button>
                <button className="secondary-btn" onClick={() => handlePlaceTrade('sell')}>
                  Sell at replay close
                </button>
              </div>
            </div>

            <div className="paper-desk-pane paper-desk-pane-controls">
              <div className="guide-chip">
                <div className="k">Locked start bar</div>
                <div className="v">{replayFocus.lockedDateLabel}</div>
                <div className="muted">
                  {selectedView?.replayStarted
                    ? 'Replay is now advancing from the selected start point.'
                    : 'The chart stays in full overview mode until you press play.'}
                </div>
              </div>

              <div className="toolbar">
                <button className="secondary-btn" onClick={() => handleReplayCursor(-1)} disabled={(selectedView?.cursor || 0) <= 0}>
                  Previous bar
                </button>
                <button
                  className="primary-btn"
                  onClick={handleToggleReplayPlayback}
                  disabled={(selectedView?.cursor || 0) >= (selectedView?.bars?.length || 1) - 1}
                >
                  {isPlaying ? 'Pause replay' : 'Play replay'}
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => handleReplayCursor(1)}
                  disabled={(selectedView?.cursor || 0) >= (selectedView?.bars?.length || 1) - 1}
                >
                  Next bar
                </button>
              </div>

              <div className="env-hint">
                <strong>Replay speed.</strong> This version keeps one fixed pace so route buttons can stay focused on product mechanics instead of speed controls.
              </div>

              <div className="env-hint">
                <strong>Replay mechanic.</strong> The overview chart stays fully visible until play starts. Once replay begins, the chart switches
                into a guided path from the selected bar forward.
              </div>
            </div>

            <div className="paper-desk-pane paper-desk-pane-routes">
              <div className="guide-chip">
                <div className="k">Learning route</div>
                <div className="paper-route-chip-main">
                  <span className="paper-route-chip-glyph">{selectedLearningRouteOption?.glyph || selectedRouteUi.glyph}</span>
                  <div>
                    <div className="v">{selectedLearningRouteOption?.label || selectedAdvancedRouteConfig.label}</div>
                    <div className="paper-route-chip-note">
                      {selectedLearningRouteOption?.actionTag || selectedRouteUi.actionTag} / {selectedRouteHelperLabel}
                    </div>
                  </div>
                </div>
                <div className="muted">
                  {routeAccessHint}
                </div>
              </div>

              <div className="paper-route-selector">
                {learningRouteOptions.map((route) => {
                  return (
                    <button
                      key={route.value}
                      type="button"
                      className={`paper-route-pill ${selectedLearningRouteValue === route.value ? 'active' : ''} ${route.actionLocked ? 'locked' : ''}`}
                      onClick={() => handleSelectLearningRoute(route.value)}
                    >
                      <span className="paper-route-pill-glyph">{route.glyph}</span>
                      <span className="paper-route-pill-copy">
                        <strong>{route.label}</strong>
                        <small>{route.actionTag}</small>
                      </span>
                      <span className="paper-route-lock">{route.actionLocked ? 'Preview' : route.helperLabel}</span>
                    </button>
                  );
                })}
              </div>

              <div className="wealth-inline-note paper-inline-note">
                Start with spot low-buy / high-sell first. After Task 1 and Task 2 are both minted, the replay desk can branch into
                Leverage & hedging and Options / strategy tutorials without pretending they are already live execution tools.
              </div>
            </div>

            {selectedView?.error ? <div className="env-hint">{selectedView.error}</div> : null}
            {feedback ? <div className="env-hint">{feedback}</div> : null}
          </div>
        );
      case 'lookthrough':
        return (
          <div className="paper-asset-list">
            {selectedInsight.holdings.map((holding) => (
              <div className="paper-asset-row paper-side-row-wide" key={holding.name}>
                <div className="paper-side-row-title">{holding.name}</div>
                <div className="paper-side-row-meta">
                  <strong>{holding.weight}</strong>
                  <span className={`pill paper-side-risk-pill ${riskClass(inferHoldingRisk(selectedProduct, holding))}`}>
                    {inferHoldingRisk(selectedProduct, holding)} risk
                  </span>
                </div>
                <div className="entry-copy paper-side-row-copy">{holding.role}</div>
              </div>
            ))}
          </div>
        );
      case 'math':
        return (
          <>
            <div className="starter-reasons">
              {selectedInsight.earningsBridge.map((line) => (
                <div className="reason-card" key={line}>
                  <div className="entry-copy">{line}</div>
                </div>
              ))}
            </div>

            <div className="paper-cost-stack">
              {selectedInsight.feeStack.map((line) => (
                <div className="wealth-inline-note paper-inline-note" key={line}>
                  {line}
                </div>
              ))}
            </div>
          </>
        );
      case 'diligence':
        return (
          <>
            <div className="paper-panel-pill-row">
              <span className="pill risk-low">Quality {selectedPaperDiligenceReport.productQuality.score}/100</span>
              <span className={`pill ${selectedPaperDiligenceReport.suitability.tone}`}>{selectedPaperDiligenceReport.suitability.label}</span>
            </div>

            <div className="starter-reasons">
              {selectedPaperDiligenceReport.evidenceMatrix.map((row) => (
                <div className="reason-card" key={row.id}>
                  <div className="entry-title">{row.question}</div>
                  <div className="entry-copy">{row.finding}</div>
                  <div className="muted">{row.confidence}</div>
                </div>
              ))}
            </div>

            <div className="starter-reasons">
              {(selectedPaperDiligenceReport.redFlags.length ? selectedPaperDiligenceReport.redFlags : selectedProductGuide.stressScenarios.map((scenario) => ({
                id: scenario.label,
                title: scenario.label,
                detail: scenario.impact
              }))).slice(0, 4).map((flag) => (
                <div className="reason-card" key={flag.id || flag.title}>
                  <div className="entry-title">{flag.title}</div>
                  <div className="entry-copy">{flag.detail}</div>
                </div>
              ))}
            </div>

            <div className="wealth-inline-note paper-inline-note">
              {selectedPaperDiligenceReport.memo.summary}
            </div>
          </>
        );
      case 'automation':
        return (
          <div className="starter-reasons">
            {selectedInsight.automation.map((line) => (
              <div className="reason-card" key={line}>
                <div className="entry-title">Automation</div>
                <div className="entry-copy">{line}</div>
              </div>
            ))}
            {selectedInsight.tokenRights.map((line) => (
              <div className="reason-card" key={line}>
                <div className="entry-title">Token right</div>
                <div className="entry-copy">{line}</div>
              </div>
            ))}
            {selectedInsight.cexMath.map((line) => (
              <div className="reason-card" key={line}>
                <div className="entry-title">CEX reference</div>
                <div className="entry-copy">{line}</div>
              </div>
            ))}
          </div>
        );
      case 'contract':
        return (
          <>
            <div className="paper-panel-pill-row">
              <span className={`pill ${advancedRoutesUnlocked ? 'risk-low' : 'risk-medium'}`}>
                {replayDeveloperModeActive
                  ? 'Developer mode override'
                  : advancedRoutesUnlocked
                    ? 'Task routes unlocked'
                    : 'Task completion required'}
              </span>
            </div>

            <div className="starter-reasons">
              {selectedRouteLessonLines.map((line) => (
                <div className="reason-card" key={line}>
                  <div className="entry-title">{activeRouteFocusConfig?.label || selectedAdvancedRouteConfig.label}</div>
                  <div className="entry-copy">{line}</div>
                </div>
              ))}
            </div>

            {!advancedRoutesUnlocked ? (
              <div className="wealth-inline-note paper-inline-note">
                {advancedRouteUnlockCopy}
              </div>
            ) : selectedAdvancedRoute === 'perp' && !advancedActivityEnabled ? (
              <div className="wealth-inline-note paper-inline-note">
                {advancedActivityUnlockCopy}
              </div>
            ) : selectedAdvancedRoute === 'perp' && contractAvailable ? (
              <>
                <div className="paper-contract-grid">
                  <label className="wealth-field">
                    Direction
                    <select value={contractDirection} onChange={(event) => setContractDirection(event.target.value)}>
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                  </label>
                  <label className="wealth-field">
                    Leverage
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="1"
                      value={contractLeverage}
                      onChange={(event) => setContractLeverage(clampNumber(Number(event.target.value || 1), 1, 10))}
                    />
                  </label>
                  <div className="guide-chip">
                    <div className="k">Margin required</div>
                    <div className="v">{formatNotional(routeRequiredMarginCapital)} PT</div>
                    <div className="muted">
                      {routeMarginShortfall > 0
                        ? `${formatNotional(routeMarginCapital)} PT can be posted now, leaving ${formatNotional(routeMarginShortfall)} PT uncovered.`
                        : `Fully covered by this wallet at ${routeLeverageMultiple === 1 ? 'no leverage' : `${routeLeverageMultiple}x`}.`}
                    </div>
                  </div>
                </div>

                {contractPreview ? (
                  <div className="paper-ticket-grid">
                    <div className="guide-chip">
                      <div className="k">Contract notional</div>
                      <div className="v">{formatNotional(contractPreview.exposureNotional)} PT</div>
                      <div className="muted">
                        {leverageDirection} at {routeLeverageMultiple === 1 ? 'No leverage' : `${routeLeverageMultiple}x`}
                      </div>
                    </div>
                    <div className="guide-chip">
                      <div className="k">5% move impact</div>
                      <div className={`v ${leverageDirection === 'long' ? 'risk-low' : 'risk-high'}`}>{formatSigned(contractPreview.moveFive)} PT</div>
                      <div className="muted">Same magnitude works against you on the other side.</div>
                    </div>
                    <div className="guide-chip">
                      <div className="k">Margin wallet free cash</div>
                      <div className="v">{formatNotional(contractPreview.freeCash)} PT</div>
                      <div className="muted">Initial margin is set aside from the paper wallet while the leg stays open.</div>
                    </div>
                    <div className="guide-chip">
                      <div className="k">Maintenance margin</div>
                      <div className="v">{formatNotional(contractPreview.maintenanceMargin)} PT</div>
                      <div className="muted">If equity falls through this buffer, the route is in liquidation territory.</div>
                    </div>
                    <div className="guide-chip">
                      <div className="k">Funding on hold</div>
                      <div className="v">{formatNotional(contractPreview.fundingCost)} PT</div>
                      <div className="muted">Funding is modeled across the current holding period and hits net take-home directly.</div>
                    </div>
                    {flashLoanAppliedTicketNotional > 0 ? (
                      <div className="guide-chip">
                        <div className="k">Flash top-up</div>
                        <div className="v">{formatNotional(flashLoanAppliedTicketNotional)} PT</div>
                        <div className="muted">
                          Premium about {formatNotional(flashLoanPremiumEstimate)} PT. This boosts the current ticket notional directly, but it still stays route-bound instead of becoming wallet cash.
                        </div>
                      </div>
                    ) : null}
                    <div className="guide-chip">
                      <div className="k">Tutorial liquidation marker</div>
                      <div className="v">{formatPrice(contractPreview.liquidationPrice)}</div>
                      <div className="muted">Approximate only. Real venues add maintenance margin and funding logic.</div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="wealth-inline-note paper-inline-note">
                {selectedAdvancedRoute === 'spot'
                  ? 'Spot is the base route. Finish and mint Task 1 plus Task 2 if you want to branch into leveraged or DeFi-specific lessons.'
                  : 'This selected route is currently kept in teaching mode first. Use the checklist below before turning it into a deeper badge flow.'}
              </div>
            )}
          </>
        );
      default:
        return null;
    }
  }

  function renderCompactReplayCard(panelId) {
    if (panelId === 'diligence') {
      const paperDiligenceReport = selectedPaperDiligenceReport;
      const rawDiligenceBreakdown = (paperDiligenceReport?.productQuality?.rows || [])
        .filter((item) => ['structure', 'underlying', 'pricing', 'liquidity'].includes(item.dimensionId))
        .slice(0, 4);
      const diligenceAverageScore =
        rawDiligenceBreakdown.length > 0
          ? Math.round(
              rawDiligenceBreakdown.reduce((sum, item) => sum + Math.round(Number(item.weightedPoints || 0)), 0) /
                rawDiligenceBreakdown.length
            )
          : 0;
      const diligenceBreakdown = rawDiligenceBreakdown
        .map((item) => ({
          label: item.title,
          score: Math.round(item.weightedPoints),
          copy: item.detail
        }))
        .map((item) => {
          const delta = item.score - diligenceAverageScore;
          return {
            ...item,
            benchmark:
              Math.abs(delta) <= 1
                ? 'Near avg'
                : delta > 0
                  ? `${delta} above avg`
                  : `${Math.abs(delta)} below avg`,
            benchmarkTone: delta > 0 ? 'risk-low' : delta < 0 ? 'risk-medium' : ''
          };
        });
      const paperEvidenceRows = (paperDiligenceReport?.evidenceMatrix || []).slice(0, 3);
      const paperWarningLine =
        paperDiligenceReport?.redFlags?.[0]?.detail ||
        paperDiligenceReport?.memo?.summary ||
        'The AI diligence report did not find a major pre-trade blocker in the bundled evidence.';
      const diligencePages = [
        ...(hedgeFocusProfile
          ? [
              {
                id: 'hedgeability',
                eyebrow: '01 Hedgeability & exit risk',
                title: hedgeFocusProfile.diligence.title,
                pill: <span className="pill risk-medium">{hedgeFocusProfile.diligence.pillLabel}</span>,
                body: (
                  <>
                    <div className="paper-side-score-grid">
                      {hedgeFocusProfile.statCards.map((item) => (
                        <div className="paper-side-score-card" key={item.label}>
                          <div className="paper-side-score-top">
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                          </div>
                          <div className="paper-side-score-copy">{item.copy}</div>
                        </div>
                      ))}
                    </div>

                    {hedgeFocusProfile.diligence.bullets?.length ? (
                      <div className="paper-asset-list">
                        {hedgeFocusProfile.diligence.bullets.map((line) => (
                          <div className="paper-asset-row paper-side-row-wide" key={line}>
                            <div className="entry-copy paper-side-row-copy">{line}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {hedgeFocusProfile.diligence.footer ? (
                      <div className="paper-side-score">{hedgeFocusProfile.diligence.footer}</div>
                    ) : null}
                  </>
                )
              }
            ]
          : []),
        {
          id: 'diligence',
          eyebrow: hedgeFocusProfile ? '02 AI diligence' : '04 AI diligence',
          title: 'Evidence before trade',
          pill: <span className="pill risk-low">Quality {paperDiligenceReport.productQuality.score}/100</span>,
          body: (
            <>
              <div className="paper-side-score-grid">
                {diligenceBreakdown.map((item) => (
                  <div className="paper-side-score-card" key={item.label}>
                    <div className="paper-side-score-top">
                      <span>{item.label}</span>
                      <div className="paper-side-score-value">
                        <strong>{item.score}</strong>
                        <em className={item.benchmarkTone}>{item.benchmark}</em>
                      </div>
                    </div>
                    <div className="paper-side-score-copy">{item.copy}</div>
                  </div>
                ))}
              </div>

              {paperEvidenceRows.length ? (
                <div className="paper-asset-list">
                  {paperEvidenceRows.map((row) => (
                    <div className="paper-asset-row paper-side-row-wide" key={row.id}>
                      <div className="paper-side-row-title">{row.question}</div>
                      <div className="paper-side-row-meta">
                        <strong>{row.confidence}</strong>
                      </div>
                      <div className="entry-copy paper-side-row-copy">{row.finding}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="paper-side-score">
                Before trade: {paperWarningLine}
              </div>
            </>
          )
        },
        {
          id: 'lookthrough',
          eyebrow: hedgeFocusProfile ? '03 Underlying look-through' : '02 Underlying look-through',
          title: 'What this user is really buying',
          pill: <span className="pill risk-low">{selectedInsight.holdings.length} sleeves</span>,
          body: (
            <div className="paper-asset-list">
              {selectedInsight.holdings.slice(0, 4).map((holding) => (
                <div className="paper-asset-row paper-side-row-wide" key={holding.name}>
                  <div className="paper-side-row-title">{holding.name}</div>
                  <div className="paper-side-row-meta">
                    <strong>{holding.weight}</strong>
                    <span className={`pill paper-side-risk-pill ${riskClass(inferHoldingRisk(selectedProduct, holding))}`}>
                      {inferHoldingRisk(selectedProduct, holding)} risk
                    </span>
                  </div>
                  <div className="entry-copy paper-side-row-copy">{holding.role}</div>
                </div>
              ))}
            </div>
          )
        }
      ];
      const activeDiligencePage = diligencePages[diligencePagerIndex] || diligencePages[0];
      const canGoBack = diligencePagerIndex > 0;
      const canGoForward = diligencePagerIndex < diligencePages.length - 1;

      return (
        <div
          key={`${panelId}-${selectedProductId}`}
          className={`paper-side-card ${hedgeFocusActive && hedgeDiligencePulse ? 'paper-side-card-hedge-pulse' : ''}`.trim()}
        >
          <div className="paper-side-card-head">
            <div>
              <div className="eyebrow">{activeDiligencePage.eyebrow}</div>
              <h3>{activeDiligencePage.title}</h3>
            </div>
            <div className="paper-side-card-toolbar">
              {activeDiligencePage.pill}
              <div className="paper-side-card-pager" aria-label="AI diligence pages">
                <button
                  type="button"
                  className="ghost-btn compact paper-side-card-pager-btn"
                  onClick={() => canGoBack && setDiligencePagerIndex((current) => Math.max(0, current - 1))}
                  disabled={!canGoBack}
                  aria-label="Previous AI diligence page"
                >
                  {'<'}
                </button>
                <span>
                  {diligencePagerIndex + 1} / {diligencePages.length}
                </span>
                <button
                  type="button"
                  className="ghost-btn compact paper-side-card-pager-btn"
                  onClick={() =>
                    canGoForward && setDiligencePagerIndex((current) => Math.min(diligencePages.length - 1, current + 1))
                  }
                  disabled={!canGoForward}
                  aria-label="Next AI diligence page"
                >
                  {'>'}
                </button>
              </div>
            </div>
          </div>

          <div className="paper-side-card-body">{activeDiligencePage.body}</div>
        </div>
      );
    }

    return null;
  }

  const hedgeSleeveReady =
    hedgeFocusActive && (selectedPosition.units > 0 || Boolean(hedgeSleeveReadyByProduct[selectedProductId]));
  const hedgePrimaryOpenLabel = hedgeSleeveReady ? 'Open hedge' : 'Buy sleeve first';
  const hedgeSecondaryOpenLabel = activePerpLeg
    ? hedgeSleeveReady
      ? 'Close hedge + sleeve'
      : 'Close hedge'
    : hedgeSleeveReady
      ? 'Close sleeve'
      : isPlaying
        ? 'Pause replay'
        : 'Play replay first';
  const routeActionCopy =
    selectedAdvancedRoute === 'perp'
      ? {
          title: activeRouteFocusConfig?.panelTitle || 'Leverage & hedging route',
          primary: hedgeFocusActive ? hedgePrimaryOpenLabel : 'Open long',
          secondary: hedgeFocusActive ? hedgeSecondaryOpenLabel : 'Open short',
          copy: activeRouteFocusConfig?.summary || 'Use the same replay bar, but frame the route around margin, liquidation, and funding drag.'
        }
      : selectedAdvancedRoute === 'lending'
        ? {
            title: activeRouteFocusConfig?.panelTitle || 'Earn & yield route',
            primary: 'Simulate supply',
            secondary: 'Simulate withdraw',
            copy: activeRouteFocusConfig?.summary || 'Switch the desk into supply / withdraw teaching so the action matches reserve-backed earn logic.'
          }
        : selectedAdvancedRoute === 'borrow'
          ? {
              title: activeRouteFocusConfig?.panelTitle || 'Options / strategy route',
              primary: 'Build paper strategy',
              secondary: 'Settle strategy',
              copy: activeRouteFocusConfig?.summary || 'Preview capped upside, downside protection, premium, breakeven, and why each leg exists before execution.'
            }
          : selectedAdvancedRoute === 'strategy-ai'
            ? {
                title: 'AI strategy template route',
                primary: 'Generate template',
                secondary: 'Upload template',
                copy: 'Use the current strategy payoff as context, then generate explainable AI metrics and upload the result to the local leaderboard.'
              }
          : selectedAdvancedRoute === 'routing'
            ? {
                title: activeRouteFocusConfig?.panelTitle || 'Automation / AI route',
                primary: 'Review route',
                secondary: 'Exit route',
                copy: activeRouteFocusConfig?.summary || 'Focus on venue logic, rights, and whether the route is good enough after fees, liquidity, and taxes.'
              }
            : {
                title: 'Low-buy / high-sell route',
                primary: 'Buy',
                secondary: 'Sell',
                copy: 'Choose the entry bar, size the ticket, and practice low-buy / high-sell with the net result kept visible.'
              };
  const routeActionsLocked = selectedAdvancedRoute !== 'spot' && !advancedActivityEnabled;
  const spotTimedExitAllowed = !leverageRouteActive && (selectedAdvancedRoute === 'spot' || routeActionsLocked || advancedActivityEnabled);
  const routeTimedExitAllowed = leverageRouteActive ? advancedActivityEnabled : spotTimedExitAllowed;
  const routeCopy = routeActionsLocked
    ? `${routeActionCopy.copy} Advanced route actions stay locked until this wallet completes and mints Task 1 plus Task 2.`
    : routeActionCopy.copy;
  const hedgeRouteGuideSteps = [
    {
      number: '1',
      title: 'Buy sleeve first',
      detail: 'Open the spot or wrapper position first. Hedge mode should protect something that already exists, not start with a short.'
    },
    {
      number: '2',
      title: 'Play into risk day',
      detail: 'Use Play replay, then pause when the sleeve starts to look weak or the event window arrives.'
    },
    {
      number: '3',
      title: 'Open hedge',
      detail: 'Pick 25%, 50%, 75%, or the max fundable ratio. This means hedge ticket = that percent of principal.'
    },
    {
      number: '4',
      title: 'Close hedge + sleeve',
      detail: 'When the risk window ends, close the hedge. If the original sleeve should be gone too, use the bundle close path.'
    }
  ];
  const routeGuideSteps =
    hedgeFocusActive && !comboFocusActive
      ? hedgeRouteGuideSteps
      : activeRouteFocusConfig?.walkthrough?.length
      ? activeRouteFocusConfig.walkthrough
      : selectedRouteUi.walkthrough.map((step, index) => {
          const matched = step.label.match(/^(\d+)\.\s*(.*)$/);

          return {
            number: matched?.[1] || String(index + 1),
            title: matched?.[2] || step.label,
            detail: step.detail
          };
        });
  const routePracticeMode = strategyWorkspaceRouteActive ? 'strategy' : hedgeFocusActive ? 'hedge' : leverageRouteActive ? 'leverage' : 'spot';
  const routePracticeFlashNotional = routePreviewFlashNotional;
  const routePracticeFlashPremiumEstimate = routePreviewFlashPremiumEstimate;
  const routePracticePreviewTicketNotional = routePreviewTicketNotional;
  const routePracticeNotional = leverageRouteActive
    ? Math.max(MIN_PAPER_TRADE, Number(routePracticePreviewTicketNotional || tradeAmount || MIN_PAPER_TRADE))
    : Math.max(MIN_PAPER_TRADE, Number(tradeAmount || MIN_PAPER_TRADE));
  const routePracticeHedgeSleeveNotional = hedgeFocusActive
    ? Math.max(
        MIN_PAPER_TRADE,
        Number(hedgeProtectedSleeveNotional || hedgePrincipalPreviewNotional || tradeAmount || MIN_PAPER_TRADE)
      )
    : routePracticeNotional;
  const routePracticeHedgeTicketNotional = hedgeFocusActive
    ? Math.max(
        MIN_PAPER_TRADE,
        Number(hedgeStagedTicketNotional || hedgePlannedTicketNotional || routeEffectiveTicketNotional || tradeAmount || MIN_PAPER_TRADE)
      )
    : routePracticeNotional;
  const debouncedRoutePracticeFlashNotional = useDebouncedValue(routePracticeFlashNotional, 140);
  const debouncedRoutePracticeFlashPremiumEstimate = useDebouncedValue(routePracticeFlashPremiumEstimate, 140);
  const debouncedRoutePracticeNotional = useDebouncedValue(routePracticeNotional, 140);
  const debouncedRoutePracticeHedgeSleeveNotional = useDebouncedValue(routePracticeHedgeSleeveNotional, 140);
  const debouncedRoutePracticeHedgeTicketNotional = useDebouncedValue(routePracticeHedgeTicketNotional, 140);
  const debouncedStrategyControlValues = useDebouncedValue(strategyControlValues, 140);
  const deferredRoutePracticeFlashNotional = useDeferredValue(debouncedRoutePracticeFlashNotional);
  const deferredRoutePracticeFlashPremiumEstimate = useDeferredValue(debouncedRoutePracticeFlashPremiumEstimate);
  const deferredRoutePracticeNotional = useDeferredValue(debouncedRoutePracticeNotional);
  const deferredRoutePracticeHedgeSleeveNotional = useDeferredValue(debouncedRoutePracticeHedgeSleeveNotional);
  const deferredRoutePracticeHedgeTicketNotional = useDeferredValue(debouncedRoutePracticeHedgeTicketNotional);
  const deferredStrategyControlValues = useDeferredValue(debouncedStrategyControlValues);
  const routePracticeCases = useMemo(
    () =>
      buildReplayPracticeCasesCached(selectedView?.bars || [], routePracticeMode, {
        product: selectedProduct,
        notional: deferredRoutePracticeNotional,
        leverage: routeLeverageMultiple,
        marginCapital: routePostedBaseMarginCapital,
        flashLoanAmount: deferredRoutePracticeFlashNotional,
        flashLoanFee: deferredRoutePracticeFlashPremiumEstimate,
        hedgeSleeveNotional: deferredRoutePracticeHedgeSleeveNotional,
        hedgeTicketNotional: deferredRoutePracticeHedgeTicketNotional,
        hedgeMarginCapital: routePostedBaseMarginCapital,
        hedgeLeverage: routeLeverageMultiple,
        strategyTemplateId: selectedStrategyTemplateId,
        strategyControls: deferredStrategyControlValues,
        previewMode: true
      }),
    [
      deferredRoutePracticeFlashNotional,
      deferredRoutePracticeFlashPremiumEstimate,
      routeLeverageMultiple,
      routePostedBaseMarginCapital,
      deferredRoutePracticeHedgeSleeveNotional,
      deferredRoutePracticeHedgeTicketNotional,
      deferredRoutePracticeNotional,
      routePracticeMode,
      selectedStrategyTemplateId,
      selectedProduct,
      selectedView?.bars,
      deferredStrategyControlValues
    ]
  );
  useEffect(() => {
    setSelectedPracticeCaseIndex(0);
  }, [
    routePracticeMode,
    selectedAdvancedRoute,
    selectedProductId,
    selectedStrategyTemplateId
  ]);
  const selectedPracticeCaseSafeIndex = Math.max(
    0,
    Math.min(selectedPracticeCaseIndex, Math.max(0, routePracticeCases.length - 1))
  );
  const routePracticeCase = routePracticeCases[selectedPracticeCaseSafeIndex] || null;
  const routePracticeTicker = selectedProduct?.ticker || 'this product';
  const routePracticeGrossMoveLabel = routePracticeCase
    ? formatSignedPercent((routePracticeCase.grossReturnRate ?? routePracticeCase.returnRate) * 100)
    : '';
  const routePracticeOutcomePnl = getPracticeCaseOutcomePnl(routePracticeCase);
  const routePracticeOutcomeRate = getPracticeCaseOutcomeRate(routePracticeCase);
  const routePracticeOutcomeToneValue = routePracticeOutcomePnl !== null ? routePracticeOutcomePnl : routePracticeOutcomeRate;
  const routePracticeOutcomeWithDrawdownLabel = routePracticeCase ? formatPracticeCaseOutcomeWithDrawdown(routePracticeCase) : '';
  const routePracticeMaxDrawdownLabel = routePracticeCase ? formatPracticeDrawdownRatio(routePracticeCase.maxDrawdownRate) : '';
  const routePracticeStrategyControls =
    routePracticeCase?.mode === 'strategy'
      ? routePracticeCase.strategyOutcome?.controls || strategyControlValues
      : null;
  const routePracticeStrategySliderRows = routePracticeStrategyControls
    ? [
        {
          label: strategyParameterLabels.downside || 'Floor',
          value: `-${Number(routePracticeStrategyControls.downsidePct || 0).toFixed(0)}%`
        },
        {
          label: strategyParameterLabels.harvest || 'Harvest',
          value: `${Number(routePracticeStrategyControls.profitHarvestPct || 0).toFixed(0)}%`
        },
        {
          label: strategyParameterLabels.cap || 'Cap',
          value: `+${Number(routePracticeStrategyControls.upsideCapPct || 0).toFixed(0)}%`
        },
        {
          label: strategyParameterLabels.premium || 'Premium',
          value: `${Number(routePracticeStrategyControls.premiumPct || 0).toFixed(1)}%`
        },
        {
          label: strategyParameterLabels.strike || 'Strike',
          value: `+${Number(routePracticeStrategyControls.strikePct || 0).toFixed(0)}%`
        }
      ]
    : [];
  const routePracticeHedgeOutcome = routePracticeCase?.hedgeOutcome || null;
  const routePracticeHedgeSettlementCopy = routePracticeHedgeOutcome
    ? `Best final settlement is ${routePracticeOutcomeWithDrawdownLabel} via ${getHedgeSettlementModeLabel(
        routePracticeHedgeOutcome.settlementMode
      )}. Hedge-only ${formatSigned(routePracticeHedgeOutcome.hedgeOnlyPnl)} PT; hedge + sleeve ${formatSigned(
        routePracticeHedgeOutcome.hedgePlusSleevePnl
      )} PT.`
    : `Current sleeve plus hedge ticket models ${routePracticeOutcomeWithDrawdownLabel}.`;
  const routePracticeBadgeCopy = routePracticeCase
    ? routePracticeCase.mode === 'spot'
      ? `net ${formatPracticeCaseOutcomeWithDrawdown(routePracticeCase)}`
      : routePracticeCase.mode === 'hedge'
        ? `hedged ${formatPracticeCaseOutcomeWithDrawdown(routePracticeCase)}`
        : routePracticeCase.mode === 'strategy'
          ? `payoff ${formatPracticeCaseOutcomeWithDrawdown(routePracticeCase)}`
          : `${routePracticeCase.direction} ${formatPracticeCaseOutcomeWithDrawdown(routePracticeCase)}`
    : '';
  const routePracticeCaseCopy = routePracticeCase
    ? routePracticeCase.mode === 'hedge'
      ? comboFocusActive
        ? `Guided ${routePracticeTicker} leverage + hedge drill: click "Start case", buy the training sleeve, then click "Hedge day" at ${formatReplayDate(
            routePracticeCase.triggerBar?.ts,
            selectedView?.interval
          )} and open the levered hedge. ${routePracticeHedgeSettlementCopy} Finish with "Stop day" at ${formatReplayDate(routePracticeCase.endBar?.ts, selectedView?.interval)}.`
        : `Guided ${routePracticeTicker} sleeve drill: click "Start case", buy the sleeve, then click "Hedge day" at ${formatReplayDate(
            routePracticeCase.triggerBar?.ts,
            selectedView?.interval
          )} and press "Open hedge". ${routePracticeHedgeSettlementCopy} Finish with "Stop day" at ${formatReplayDate(routePracticeCase.endBar?.ts, selectedView?.interval)}.`
      : routePracticeCase.mode === 'leverage'
        ? `Guided ${routePracticeTicker} leverage drill: click "Start case", press "Open ${routePracticeCase.direction}", then click "Stop day" at ${formatReplayDate(
            routePracticeCase.endBar?.ts,
            selectedView?.interval
          )} and close the leg. Current principal plus flash setup models ${routePracticeOutcomeWithDrawdownLabel} after funding, close drag, and path drawdown.`
        : routePracticeCase.mode === 'strategy'
          ? `Guided ${routePracticeTicker} option drill: click "Start case", press "Build paper strategy", then use "Settle day" at ${formatReplayDate(
              routePracticeCase.endBar?.ts,
              selectedView?.interval
            )}. Historical move is ${routePracticeGrossMoveLabel}; selected ${OPTION_STRATEGY_LABELS[selectedStrategyTemplateId] || 'strategy'} payoff models ${routePracticeOutcomeWithDrawdownLabel}.`
          : `Guided ${routePracticeTicker} buy/sell drill: click "Start case", press "Buy", then use "Stop day" at ${formatReplayDate(
              routePracticeCase.endBar?.ts,
              selectedView?.interval
            )} or the ${formatHoldingPresetLabel(routePracticeCase.holdingDays)} dock preset. Gross move ${routePracticeGrossMoveLabel}; modeled route drag ${
              routePracticeCase.spotOutcome ? formatNotional(routePracticeCase.spotOutcome.totalDrag) : '0'
            } PT.`
    : 'Replay bars are still loading. The case guide will appear once the chart has enough history.';
  const routePracticeStepRows = routePracticeCase
    ? routePracticeCase.mode === 'hedge'
      ? [
          {
            label: '1',
            title: 'Click "Start case"',
            copy: comboFocusActive
              ? `Chart jumps to ${formatReplayDate(routePracticeCase.startBar?.ts, selectedView?.interval)}. Press "Buy sleeve first" to create the ${routePracticeTicker} training sleeve before leverage is added.`
              : `Chart jumps to ${formatReplayDate(routePracticeCase.startBar?.ts, selectedView?.interval)}. Press "Buy sleeve first" to open the ${routePracticeTicker} exposure you want to protect.`
          },
          {
            label: '2',
            title: 'Click "Hedge day"',
            copy: comboFocusActive
              ? `Chart jumps to ${formatReplayDate(routePracticeCase.triggerBar?.ts, selectedView?.interval)} and the dock window becomes ${routePracticeCase.triggerDays}D. Pick a hedge ratio, read margin and liquidation, then press "Open hedge".`
              : `Chart jumps to ${formatReplayDate(routePracticeCase.triggerBar?.ts, selectedView?.interval)} and the dock window becomes ${routePracticeCase.triggerDays}D. Pick 25% / 50% / 75% / Max, then press "Open hedge".`
          },
          {
            label: '3',
            title: 'Click "Stop day"',
            copy: comboFocusActive
              ? `Chart jumps to ${formatReplayDate(routePracticeCase.endBar?.ts, selectedView?.interval)} and the shared dock window becomes ${routePracticeCase.holdingDays}D. Close the hedge and compare hedge-only PnL with sleeve plus hedge.`
              : `Chart jumps to ${formatReplayDate(routePracticeCase.endBar?.ts, selectedView?.interval)} and the shared dock window becomes ${routePracticeCase.holdingDays}D. Press "Close hedge"; this case currently models ${routePracticeOutcomeWithDrawdownLabel} for sleeve plus hedge.`
          }
        ]
      : routePracticeCase.mode === 'leverage'
        ? [
            {
              label: '1',
              title: 'Click "Start case"',
              copy: `Chart jumps to ${formatReplayDate(routePracticeCase.startBar?.ts, selectedView?.interval)}. Press "Open ${routePracticeCase.direction}" for the selected ${routePracticeTicker} route.`
            },
            {
              label: '2',
              title: 'Click "Stop day"',
              copy: `Chart jumps to ${formatReplayDate(routePracticeCase.endBar?.ts, selectedView?.interval)} and the floating dock moves every timed estimate to ${routePracticeCase.holdingDays}D.`
            },
          {
            label: '3',
            title: `Press "Close ${routePracticeCase.direction}"`,
            copy: `The replay pauses automatically before the close signature. With current principal and flash, this case models ${routePracticeOutcomeWithDrawdownLabel} after funding, taker, flash premium, and drawdown drag.`
          }
        ]
        : routePracticeCase.mode === 'strategy'
          ? [
              {
                label: '1',
                title: 'Click "Start case"',
                copy: `Chart jumps to ${formatReplayDate(routePracticeCase.startBar?.ts, selectedView?.interval)}. Press "Build paper strategy" to stage the selected ${OPTION_STRATEGY_LABELS[selectedStrategyTemplateId] || 'strategy'} template.`
              },
              {
                label: '2',
                title: 'Tune payoff controls',
                copy: `Set downside floor, profit harvest, cap, premium, or strike. The preview re-scans the same historical windows with those controls.`
              },
              {
                label: '3',
                title: 'Click "Settle day"',
                copy: `Chart jumps to ${formatReplayDate(routePracticeCase.endBar?.ts, selectedView?.interval)}. Press "Settle strategy"; this case currently models ${routePracticeOutcomeWithDrawdownLabel}.`
              }
            ]
        : [
            {
              label: '1',
              title: 'Click "Start case"',
              copy: `Chart jumps to ${formatReplayDate(routePracticeCase.startBar?.ts, selectedView?.interval)}. Press "Buy" for ${routePracticeTicker} at about ${formatPrice(
                getBarCloseValue(routePracticeCase.startBar)
              )}.`
            },
            {
              label: '2',
              title: 'Click "Stop day" or the dock preset',
              copy: `Stop day is ${formatReplayDate(routePracticeCase.endBar?.ts, selectedView?.interval)}. The dock window becomes ${routePracticeCase.holdingDays}D, so multiple open products move together.`
            },
            {
              label: '3',
              title: 'Press "Sell" or "Auto-sell"',
              copy: routePracticeCase.spotOutcome
                ? `Net result is modeled at ${formatSigned(routePracticeCase.spotOutcome.netPnl)} PT after ${formatNotional(routePracticeCase.spotOutcome.totalDrag)} PT of entry, exit, tax, and carry drag.`
                : 'The replay pauses automatically and compares headline price move with net wallet take-home.'
            }
          ]
    : [];
  const routeLearningStepRows =
    comboFocusActive && routePracticeStepRows.length
      ? [
          ...routePracticeStepRows,
          {
            label: '4',
            title: 'Build portfolio combo',
            copy: 'Pick a date window, choose several tokenized stocks, compare manual weights with suggested best-return, drawdown, and balanced baskets, then upload one result to the strategy board.'
          }
        ]
      : routePracticeStepRows;

  function handleApplyRoutePracticeCase(step = 'start') {
    if (!routePracticeCase || !selectedView?.bars?.length) {
      setFeedback('Replay bars are still loading, so the practice case cannot be placed on the chart yet.');
      return;
    }

    const targetIndex =
      step === 'risk'
        ? routePracticeCase.triggerIndex
        : step === 'end'
          ? routePracticeCase.endIndex
          : routePracticeCase.startIndex;
    const clampedIndex = Math.max(0, Math.min(targetIndex, selectedView.bars.length - 1));
    const targetBar = selectedView.bars[clampedIndex];
    setIsPlaying(false);
    setHoveredReplayIndex(null);
    updateSelectedReplay({
      cursor: clampedIndex,
      replayStarted: false
    });

    if (step === 'start') {
      updateSimulationHoldingDays(routePracticeCase.holdingDays, { showToast: false });
    } else if (step === 'risk' && routePracticeCase.triggerDays > 0) {
      updateSimulationHoldingDays(routePracticeCase.triggerDays, { showToast: false });
    } else if (step === 'end') {
      updateSimulationHoldingDays(routePracticeCase.holdingDays, { showToast: false });
    }

    setFeedback(
      step === 'risk'
        ? `Case moved to the hedge decision day: ${formatReplayDate(targetBar?.ts, selectedView?.interval)}. Size the hedge, then press "Open hedge".`
        : step === 'end'
          ? routePracticeCase.mode === 'strategy'
            ? `Case moved to the strategy settlement day: ${formatReplayDate(targetBar?.ts, selectedView?.interval)}. Press "Settle strategy" here to write the option payoff into the paper ledger.`
            : `Case moved to the planned close day: ${formatReplayDate(targetBar?.ts, selectedView?.interval)}. Press the close button here; replay is paused for the exit.`
          : `Case loaded at ${formatReplayDate(targetBar?.ts, selectedView?.interval)}. ${
              routePracticeCase.mode === 'hedge'
                ? 'Press "Buy sleeve first", then use "Hedge day".'
                : routePracticeCase.mode === 'leverage'
                  ? `Press "Open ${routePracticeCase.direction}", then use "Stop day".`
                  : routePracticeCase.mode === 'strategy'
                    ? 'Press "Build paper strategy", tune controls if needed, then use "Settle day".'
                    : 'Press "Buy", then use "Stop day" or the floating dock preset.'
            }`
    );
  }

  function handleApplyPracticeStrategyControls() {
    if (!routePracticeStrategyControls) return;

    setStrategyDownsidePct(routePracticeStrategyControls.downsidePct);
    setStrategyProfitHarvestPct(routePracticeStrategyControls.profitHarvestPct);
    setStrategyUpsideCapPct(routePracticeStrategyControls.upsideCapPct);
    setStrategyPremiumPct(routePracticeStrategyControls.premiumPct);
    setStrategyStrikePct(routePracticeStrategyControls.strikePct);
    setFeedback('Practice example sliders applied to the strategy controls.');
  }

  const strategyPreviewAnchorBar = strategyWorkspaceRouteActive
    ? selectedPosition.entryTs
      ? selectedView?.bars?.find((bar) => bar.ts === selectedPosition.entryTs) || replayFocus.lockedBar
      : replayFocus.lockedBar || routePracticeCase?.startBar
    : null;
  const strategyPreviewTargetBar =
    strategyWorkspaceRouteActive
      ? timedExitTargetBar || routePracticeCase?.endBar || replayFocus.bar
      : null;
  const optionStrategyPreview = useMemo(() => {
    if (!strategyWorkspaceRouteActive) return null;
    const cachedStrategyOutcome =
      routePracticeCase?.strategyOutcome?.templateId === selectedStrategyTemplateId
        ? routePracticeCase.strategyOutcome
        : null;

    return cachedStrategyOutcome ||
      estimateOptionStrategyPracticeOutcome({
        product: selectedProduct,
        startBar: strategyPreviewAnchorBar,
        endBar: strategyPreviewTargetBar,
        notional: Math.max(MIN_PAPER_TRADE, Number(selectedPosition.principal || deferredRoutePracticeNotional || tradeAmount || MIN_PAPER_TRADE)),
        templateId: selectedStrategyTemplateId,
        controls: deferredStrategyControlValues
      });
  }, [
    deferredRoutePracticeNotional,
    deferredStrategyControlValues,
    routePracticeCase?.strategyOutcome,
    strategyWorkspaceRouteActive,
    selectedPosition.principal,
    selectedProduct,
    selectedStrategyTemplateId,
    strategyPreviewAnchorBar,
    strategyPreviewTargetBar,
    tradeAmount
  ]);
  const strategyAiTemplateOptions = useMemo(
    () =>
      buildStrategyAiTemplateVariants({
        prompt: strategyAiPrompt,
        product: selectedProduct,
        strategyLabel: OPTION_STRATEGY_LABELS[selectedStrategyTemplateId] || 'Strategy',
        strategyOutcome: optionStrategyPreview
      }),
    [optionStrategyPreview, selectedProduct, selectedStrategyTemplateId, strategyAiPrompt]
  );
  const strategyAiTemplate =
    strategyAiTemplateOptions.find((template) => template.variantId === selectedStrategyAiVariantId) ||
    strategyAiTemplateOptions[0] ||
    buildStrategyAiTemplateAnalysis({
      prompt: strategyAiPrompt,
      product: selectedProduct,
      strategyLabel: OPTION_STRATEGY_LABELS[selectedStrategyTemplateId] || 'Strategy',
      strategyOutcome: optionStrategyPreview
    });
  const portfolioComboCandidates = useMemo(
    () => PORTFOLIO_COMBO_PRODUCT_IDS.map((productId) => productMap[productId]).filter(Boolean),
    [productMap]
  );
  const portfolioComboBarsSignature = portfolioComboSelectedIds
    .map((productId) => {
      const bars = Array.isArray(productViews[productId]?.bars) ? productViews[productId].bars : [];
      return `${productId}:${getReplayBarsDataSignature(bars)}`;
    })
    .join('|');
  const portfolioComboAnalysis = useMemo(
    () => {
      if (!comboFocusActive) {
        return {
          status: 'idle',
          message: '',
          rows: [],
          dates: [],
          manual: null,
          suggestions: [],
          topSingles: []
        };
      }

      return buildPortfolioComboAnalysis({
        productIds: portfolioComboSelectedIds,
        productMap,
        productViews,
        weightMap: portfolioComboWeights,
        startDate: portfolioComboStartDate,
        endDate: portfolioComboEndDate
      });
    },
    [
      comboFocusActive,
      portfolioComboBarsSignature,
      portfolioComboEndDate,
      portfolioComboSelectedIds,
      portfolioComboStartDate,
      portfolioComboWeights,
      productMap
    ]
  );
  const portfolioComboManualMetrics = portfolioComboAnalysis.manual;
  const portfolioComboResult = portfolioComboAnalysis.result || {};
  const portfolioComboComparisonRows = (portfolioComboResult.productResults || []).filter((result) => result?.comparison);
  const strategyTemplateLeaderboardRows = strategyTemplateLeaderboard.entries || [];
  const strategyTemplateUploadedForCurrentPrompt = strategyTemplateLeaderboardRows.some(
    (entry) =>
      entry.prompt === strategyAiTemplate.prompt &&
      entry.productLabel === strategyAiTemplate.productLabel &&
      entry.strategyLabel === strategyAiTemplate.strategyLabel &&
      entry.variantId === strategyAiTemplate.variantId
  );

  function getLeaderboardStrategyTemplateId(strategyLabel = '') {
    const targetLabel = String(strategyLabel || '').trim().toLowerCase();
    if (!targetLabel) return '';

    const exactMatch = Object.entries(OPTION_STRATEGY_LABELS).find(([, label]) => String(label || '').trim().toLowerCase() === targetLabel);
    if (exactMatch) return exactMatch[0];

    const containsMatch = Object.entries(OPTION_STRATEGY_LABELS).find(([, label]) => targetLabel.includes(String(label || '').trim().toLowerCase()));
    return containsMatch ? containsMatch[0] : '';
  }

  function handleApplyStrategyTemplateLeaderboardEntry(entry = {}) {
    const safeType = String(entry?.entryType || 'ai-template');

    if (safeType === 'portfolio-combo') {
      const allocation = Array.isArray(entry.allocation) ? entry.allocation : [];
      if (!allocation.length) {
        setFeedback('This combo entry has no allocation to copy.');
        return;
      }

      const uniqueAllocation = [];
      const nextWeights = {};
      const nextSelectedIds = [];
      allocation.forEach((row) => {
        const productId = String(row?.productId || '').trim();
        if (!productId) return;

        const weightPct = Number(row?.weightPct || 0);
        const normalizedWeight = roundNumber(weightPct, 1);
        nextWeights[productId] = normalizedWeight;
        nextSelectedIds.push(productId);
        uniqueAllocation.push({
          ticker: row?.ticker || productId,
          weightPct: normalizedWeight
        });
      });

      const validation = getPortfolioComboWeightsValidation({ allocation: uniqueAllocation });
      if (!validation.isValid) {
        setFeedback(
          `Please fix combo weights first. Current total is ${validation.totalPercent.toFixed(1)}%, and it should be 100%.`
        );
        return;
      }

      if (nextSelectedIds.length < 2) {
        setFeedback('Select at least two products before applying this combo.');
        return;
      }

      setPortfolioComboSelectedIds(Array.from(new Set(nextSelectedIds)));
      setPortfolioComboWeights(nextWeights);
      setFeedback(`Applied "${entry.title || 'portfolio combo'}" to combo manual weights.`);
      return;
    }

    const safePrompt = String(entry.prompt || entry.title || strategyAiPrompt).trim();
    if (!safePrompt) {
      setFeedback('This template has no prompt to copy.');
      return;
    }

    const templateIdFromLabel = getLeaderboardStrategyTemplateId(entry.strategyLabel);
    const safeVariantId = STRATEGY_AI_TEMPLATE_VARIANTS.some((variant) => variant.id === entry.variantId)
      ? entry.variantId
      : STRATEGY_AI_TEMPLATE_VARIANTS[0]?.id || 'balanced-guardrail';

    if (templateIdFromLabel) {
      setSelectedOptionStrategyTemplateId(templateIdFromLabel);
    }
    setStrategyAiPrompt(safePrompt);
    setSelectedStrategyAiVariantId(safeVariantId);
    setStrategyAiTemplateGenerated(true);
    setFeedback(`Copied "${entry.title || 'AI template'}" into the AI strategy template controls.`);
  }

  function handleGenerateStrategyAiTemplate() {
    setStrategyAiTemplateGenerated(true);
    mergeProgressUpdate({ strategyAiTemplateCompleted: true });
    setFeedback(
      `${strategyAiTemplate.variantLabel || 'AI template'} marked ${strategyAiTemplate.features.length} features for ${strategyAiTemplate.strategyLabel}: ${strategyAiTemplate.winRate}% paper win rate, ${formatSignedPercent(
        strategyAiTemplate.expectedReturnPct,
        1
      )} expected return, -${strategyAiTemplate.maxDrawdownPct.toFixed(1)}% max drawdown.`
    );
  }

  function handleUploadStrategyTemplate() {
    const submittedAt = new Date().toISOString();
    const entry = normalizeStrategyTemplateLeaderboardEntry({
      ...strategyAiTemplate,
      entryType: 'ai-template',
      id: `${address || 'guest'}-${submittedAt}-${strategyAiTemplate.title}`,
      walletAddress: address || 'guest',
      submittedAt
    });
    if (!entry) return;

    setStrategyAiTemplateGenerated(true);
    setStrategyTemplateLeaderboard((current) => {
      const next = normalizeStrategyTemplateLeaderboard({
        entries: [entry, ...(current.entries || [])]
      });
      writeStorageJson(STRATEGY_TEMPLATE_LEADERBOARD_STORAGE_KEY, next);
      return next;
    });
    mergeProgressUpdate({
      strategyLessonCompleted: true,
      ...(strategyRouteActive && optionStrategyPreview
        ? { strategyExampleCompleted: true }
        : {}),
      strategyAiTemplateCompleted: true,
      strategyLeaderboardUploaded: true
    });
    setFeedback(
      `Uploaded "${entry.title}" to the local strategy / combo leaderboard with ${entry.winRate}% paper win rate, ${formatSignedPercent(
        entry.expectedReturnPct,
        1
      )} expected return, and -${entry.maxDrawdownPct.toFixed(1)}% max drawdown.`
    );
  }

  function handleTogglePortfolioComboProduct(productId) {
    const isSelected = portfolioComboSelectedIds.includes(productId);

    if (isSelected && portfolioComboSelectedIds.length <= 2) {
      setFeedback('Keep at least two stocks selected so the combo stays diversified.');
      return;
    }

    if (isSelected) {
      setPortfolioComboSelectedIds((current) => current.filter((id) => id !== productId));
    } else {
      setPortfolioComboWeights((weights) => ({
        ...weights,
        [productId]: weights[productId] ?? 10
      }));
      setPortfolioComboSelectedIds((current) => [...current, productId]);
    }
  }

  function handlePortfolioComboWeightChange(productId, nextValue) {
    const numericValue = Number(nextValue || 0);

    setPortfolioComboWeights((current) => ({
      ...current,
      [productId]: Number.isFinite(numericValue) ? clampNumber(numericValue, 0, 100) : 0
    }));
  }

  function handleApplyPortfolioComboSuggestion(suggestion) {
    const metrics = suggestion?.metrics;
    if (!metrics?.allocation?.length) return;

    setPortfolioComboSelectedIds(metrics.allocation.map((row) => row.productId));
    setPortfolioComboWeights(Object.fromEntries(metrics.allocation.map((row) => [row.productId, roundNumber(row.weightPct, 1)])));
    setFeedback(
      `Applied ${suggestion.label}: ${metrics.allocation
        .map((row) => `${row.ticker} ${row.weightPct.toFixed(0)}%`)
        .join(' / ')}.`
    );
  }

  function handleUploadPortfolioComboToStrategyBoard(suggestion = null) {
    const metrics = suggestion?.metrics || portfolioComboManualMetrics;
    if (!metrics?.allocation?.length) {
      setFeedback(portfolioComboAnalysis.message || 'Load at least two replay series before uploading a portfolio combo.');
      return;
    }

    const uploadWeightValidation = getPortfolioComboWeightsValidation({
      allocation: suggestion?.metrics?.allocation,
      productIds: portfolioComboSelectedIds,
      weightMap: portfolioComboWeights
    });
    if (!uploadWeightValidation.isValid) {
      setFeedback(
        `Please fix combo weights before upload. Current total is ${uploadWeightValidation.totalPercent.toFixed(1)}%, but 100% is required.`
      );
      return;
    }

    const submittedAt = new Date().toISOString();
    const allocationLabel = metrics.allocation.map((row) => `${row.ticker} ${row.weightPct.toFixed(0)}%`).join(' / ');
    const entry = normalizeStrategyTemplateLeaderboardEntry({
      id: `${address || 'guest'}-${submittedAt}-portfolio-combo-${getPortfolioComboAllocationKey(metrics)}`,
      entryType: 'portfolio-combo',
      title: `${suggestion?.label || 'Manual combo'}: ${allocationLabel}`,
      prompt: `Portfolio combo ${metrics.startDate} to ${metrics.endDate}: ${allocationLabel}.`,
      productLabel: 'Portfolio Combo',
      strategyLabel: suggestion?.label || 'Manual weights',
      variantId: suggestion?.id || 'manual-combo',
      variantLabel: suggestion?.label || 'Manual combo',
      dateRange: `${metrics.startDate} -> ${metrics.endDate}`,
      walletAddress: address || 'guest',
      submittedAt,
      allocation: metrics.allocation,
      features: [
        {
          id: 'basket',
          label: 'Basket',
          value: `${metrics.allocation.length} assets`,
          copy: `Weights: ${allocationLabel}.`
        },
        {
          id: 'window',
          label: 'Backtest window',
          value: `${metrics.days} bars`,
          copy: `${metrics.startDate} to ${metrics.endDate} on overlapping daily replay history.`
        },
        {
          id: 'return',
          label: 'Return',
          value: formatSignedPercent(metrics.totalReturnPct, 1),
          copy: 'Total return from daily rebalanced weights over the selected window.'
        },
        {
          id: 'drawdown',
          label: 'Drawdown',
          value: `-${metrics.maxDrawdownPct.toFixed(1)}%`,
          copy: 'Worst peak-to-trough move in the combo path.'
        }
      ],
      winRate: metrics.winRate,
      expectedReturnPct: metrics.totalReturnPct,
      maxDrawdownPct: metrics.maxDrawdownPct,
      templateScore: metrics.templateScore
    });
    if (!entry) return;

    setStrategyTemplateLeaderboard((current) => {
      const next = normalizeStrategyTemplateLeaderboard({
        entries: [entry, ...(current.entries || [])]
      });
      writeStorageJson(STRATEGY_TEMPLATE_LEADERBOARD_STORAGE_KEY, next);
      return next;
    });
    mergeProgressUpdate({
      strategyLessonCompleted: true,
      strategyExampleCompleted: true,
      strategyAiTemplateCompleted: true,
      strategyLeaderboardUploaded: true
    });
    setFeedback(
      `Uploaded ${suggestion?.label || 'manual portfolio combo'} to the strategy / combo leaderboard: ${formatSignedPercent(
        metrics.totalReturnPct,
        1
      )} return, -${metrics.maxDrawdownPct.toFixed(1)}% max drawdown, ${metrics.winRate.toFixed(1)}% winning days.`
    );
  }
  const timedExitSpotSnapshot =
    timedExitTargetBar && selectedPosition.units > 0
      ? buildPositionSnapshot(selectedProduct, selectedPosition, Number(timedExitTargetBar.close || 0), timedExitTargetBar.ts)
      : null;
  const timedExitPortfolioRows = useMemo(
    () =>
      portfolioRows.map((row) => {
        const product = productMap[row.id];
        const view = productViews[row.id];
        const bars = Array.isArray(view?.bars) ? view.bars : [];
        const anchorIndex = bars.length
          ? Math.max(0, Math.min(Number(view?.cursor || 0), bars.length - 1))
          : 0;
        const anchorBar = bars[anchorIndex] || null;
        const maxHoldingDays = getReplayMaxHoldingDays(bars, anchorIndex);
        const targetIndex =
          bars.length && timedExitRequestedDays <= maxHoldingDays
            ? findReplayIndexAfterDays(bars, anchorIndex, timedExitRequestedDays)
            : null;
        const targetBar = targetIndex !== null && targetIndex > anchorIndex ? bars[targetIndex] : null;
        const projectedSnapshot =
          product && targetBar
            ? buildPositionSnapshot(product, row, Number(targetBar.close || 0), targetBar.ts)
            : null;
        const currentValue = Number(row.netExitValue || 0);
        const currentPnl = Number(row.netPnl || 0);

        return {
          ...row,
          anchorBar,
          targetBar,
          maxHoldingDays,
          ready: Boolean(projectedSnapshot && timedExitRequestedDays > 0),
          actualHoldingDays:
            anchorBar && targetBar
              ? Math.max(1, Math.round(getHoldingDays(anchorBar.ts, targetBar.ts)))
              : timedExitRequestedDays,
          projectedValue: projectedSnapshot?.netExitValue ?? currentValue,
          projectedPnl: projectedSnapshot?.netPnl ?? currentPnl,
          projectedGrossPnl: projectedSnapshot?.grossPnl ?? Number(row.unrealizedPnl || 0),
          projectedDelta: roundNumber((projectedSnapshot?.netPnl ?? currentPnl) - currentPnl, 2)
        };
      }),
    [portfolioRows, productMap, productViews, timedExitRequestedDays]
  );
  const timedExitPortfolioReady = routeTimedExitAllowed && !leverageRouteActive && timedExitPortfolioRows.some((row) => row.ready);
  const timedExitPortfolioNetExitValue = roundNumber(
    timedExitPortfolioRows.reduce((sum, row) => sum + Number(row.projectedValue || 0), 0),
    2
  );
  const timedExitPortfolioNetPnl = roundNumber(
    timedExitPortfolioRows.reduce((sum, row) => sum + Number(row.projectedPnl || 0), 0),
    2
  );
  const timedExitPortfolioGrossPnl = roundNumber(
    timedExitPortfolioRows.reduce((sum, row) => sum + Number(row.projectedGrossPnl || 0), 0),
    2
  );
  const timedExitPortfolioDelta = roundNumber(timedExitPortfolioNetPnl - totalNetPnl, 2);
  const timedExitPortfolioAccountValue = roundNumber(availableCash + linkedWalletCash + timedExitPortfolioNetExitValue, 2);
  const timedExitEstimatedValue = leverageRouteActive ? timedExitLeveragedSnapshot?.netExitValue || 0 : timedExitSpotSnapshot?.netExitValue || 0;
  const timedExitEstimatedPnl = leverageRouteActive ? timedExitLeveragedSnapshot?.netPnl || 0 : timedExitSpotSnapshot?.netPnl || 0;
  const currentLeverageExitReturn =
    leverageRouteActive && activePerpLeg && replayFocusLeveragedSnapshot
      ? roundNumber((replayFocusLeveragedSnapshot.netExitValue || 0) + activePerpSnapshotFlashReserveCapital, 2)
      : 0;
  const projectedLeverageExitReturn =
    leverageRouteActive && activePerpLeg && timedExitLeveragedSnapshot
      ? roundNumber((timedExitLeveragedSnapshot.netExitValue || 0) + activePerpSnapshotFlashReserveCapital, 2)
      : 0;
  const currentLeverageAccountAdjustment =
    leverageRouteActive && activePerpLeg && replayFocusLeveragedSnapshot
      ? roundNumber(currentLeverageExitReturn - activePerpSnapshotRouteMarginCapital, 2)
      : 0;
  const projectedLeverageAccountAdjustment =
    leverageRouteActive && activePerpLeg && timedExitLeveragedSnapshot
      ? roundNumber(projectedLeverageExitReturn - activePerpSnapshotRouteMarginCapital, 2)
      : 0;
  const useTimedExitSummary =
    routeTimedExitAllowed &&
    !timedExitRequestedExceedsWindow &&
    Boolean(timedExitTargetBar) &&
    (leverageRouteActive ? Boolean(activePerpLeg && timedExitLeveragedSnapshot) : Boolean(timedExitSpotSnapshot));
  const displayGrossOpenPnl = roundNumber(
    leverageRouteActive
      ? totalUnrealizedPnl +
          (useTimedExitSummary
            ? timedExitLeveragedSnapshot?.priceMovePnl || 0
            : activePerpLeg && replayFocusLeveragedSnapshot
              ? replayFocusLeveragedSnapshot.priceMovePnl
              : 0)
      : timedExitPortfolioReady
        ? timedExitPortfolioGrossPnl
      : useTimedExitSummary && timedExitSpotSnapshot
        ? totalUnrealizedPnl - selectedUnrealizedPnl + timedExitSpotSnapshot.grossPnl
        : totalUnrealizedPnl,
    2
  );
  const displayNetOpenPnl = roundNumber(
    leverageRouteActive
      ? totalNetPnl +
          (useTimedExitSummary
            ? timedExitLeveragedSnapshot?.netPnl || 0
            : activePerpLeg && replayFocusLeveragedSnapshot
              ? replayFocusLeveragedSnapshot.netPnl
              : 0)
      : timedExitPortfolioReady
        ? timedExitPortfolioNetPnl
      : useTimedExitSummary && timedExitSpotSnapshot
        ? totalNetPnl - selectedNetPnl + timedExitSpotSnapshot.netPnl
        : totalNetPnl,
    2
  );
  const displayEstimatedAccountValue = roundNumber(
    leverageRouteActive
      ? availableCash +
          linkedWalletCash +
          totalNetExitValue +
          (useTimedExitSummary ? projectedLeverageAccountAdjustment : currentLeverageAccountAdjustment)
      : timedExitPortfolioReady
        ? timedExitPortfolioAccountValue
      : useTimedExitSummary && timedExitSpotSnapshot
        ? availableCash + linkedWalletCash + totalNetExitValue - selectedNetExitValue + timedExitSpotSnapshot.netExitValue
        : accountValue,
    2
  );
  useEffect(() => {
    if (!address) return;

    writeWalletProfilePatch(address, {
      paper: {
        summary: {
          remainingPT: remainingPaperTokens,
          accountValue: displayEstimatedAccountValue,
          grossOpenPnl: displayGrossOpenPnl,
          netOpenPnl: displayNetOpenPnl,
          updatedAt: new Date().toISOString()
        }
      }
    });
  }, [address, displayEstimatedAccountValue, displayGrossOpenPnl, displayNetOpenPnl, remainingPaperTokens]);
  const timedExitCostParts =
    leverageRouteActive && timedExitLeveragedSnapshot
      ? [
          timedExitLeveragedSnapshot.entryFee > 0 ? `entry taker ${formatNotional(timedExitLeveragedSnapshot.entryFee)} PT` : null,
          timedExitLeveragedSnapshot.exitFee > 0 ? `exit taker ${formatNotional(timedExitLeveragedSnapshot.exitFee)} PT` : null,
          timedExitLeveragedSnapshot.fundingCost > 0 ? `funding ${formatNotional(timedExitLeveragedSnapshot.fundingCost)} PT` : null,
          timedExitLeveragedSnapshot.flashLoanFee > 0
            ? `flash loan premium ${formatNotional(timedExitLeveragedSnapshot.flashLoanFee)} PT`
            : null,
          timedExitLeveragedSnapshot.managementFee > 0
            ? `management ${formatNotional(timedExitLeveragedSnapshot.managementFee)} PT`
            : null
        ].filter(Boolean)
      : timedExitSpotSnapshot
        ? [
            timedExitSpotSnapshot.exitCosts.tradeFee > 0 ? `venue ${formatNotional(timedExitSpotSnapshot.exitCosts.tradeFee)} PT` : null,
            timedExitSpotSnapshot.exitCosts.spreadCost > 0 ? `spread ${formatNotional(timedExitSpotSnapshot.exitCosts.spreadCost)} PT` : null,
            timedExitSpotSnapshot.exitCosts.fxCost > 0 ? `FX ${formatNotional(timedExitSpotSnapshot.exitCosts.fxCost)} PT` : null,
            timedExitSpotSnapshot.exitCosts.channelCost > 0 ? `routing ${formatNotional(timedExitSpotSnapshot.exitCosts.channelCost)} PT` : null,
            timedExitSpotSnapshot.exitCosts.regulatoryFee > 0
              ? `reg ${formatNotional(timedExitSpotSnapshot.exitCosts.regulatoryFee)} PT`
              : null,
            timedExitSpotSnapshot.managementFee > 0 ? `management ${formatNotional(timedExitSpotSnapshot.managementFee)} PT` : null
          ].filter(Boolean)
        : [];
  const routeLearningFeeRows =
    selectedAdvancedRoute === 'perp'
      ? [
          {
            label: hedgeFocusActive ? 'Hedge open fee' : 'Open fee',
            value: timedExitLeveragedSnapshot?.entryFee || 0,
            isCost: true,
            copy: hedgeFocusActive
              ? 'Taker fee paid when the hedge leg opens from the replay bar.'
              : 'Taker fee paid when the leveraged leg opens from the replay bar.'
          },
          {
            label: hedgeFocusActive ? 'Funding while hedge stays on' : 'Funding on hold',
            value: timedExitLeveragedSnapshot?.fundingCost || 0,
            isCost: true,
            copy: `Modeled across about ${timedExitActualHoldingDays || 0}D before the timed ${hedgeFocusActive ? 'unwind' : 'close'}.`
          },
          {
            label: 'Flash premium',
            value: timedExitLeveragedSnapshot?.flashLoanFee || 0,
            isCost: true,
            copy: flashLoanAppliedTicketNotional > 0 ? 'Charged upfront when extra ticket notional is attached.' : 'Optional until a flash top-up is attached.'
          },
          {
            label: 'Management fee',
            value: timedExitLeveragedSnapshot?.managementFee || 0,
            isCost: true,
            copy: `Route management accrues over about ${timedExitActualHoldingDays || 0}D and is included in the final close signature.`
          },
          {
            label: hedgeFocusActive ? 'Unwind fee' : 'Close fee',
            value: timedExitLeveragedSnapshot?.exitFee || 0,
            isCost: true,
            copy: hedgeFocusActive
              ? 'Applied when the hedge leg is unwound, whether by timer or manual close.'
              : 'Applied when auto-sell closes the long or short leg.'
          },
          {
            label: hedgeFocusActive ? 'Protection after drag' : 'Est. take-home',
            value: timedExitEstimatedPnl,
            isCost: false,
            copy: hedgeFocusActive
              ? `Net preview after the current hedge window, around ${formatNotional(timedExitEstimatedValue)} PT after drag.`
              : `Net preview after the current timed close path, around ${formatNotional(timedExitEstimatedValue)} PT value.`
          }
        ]
      : [
          {
            label: 'Buy entry drag',
            value: roundNumber(
              entryCostPreview.tradeFee + entryCostPreview.spreadCost + entryCostPreview.fxCost + entryCostPreview.channelCost,
              2
            ),
            isCost: true,
            copy: 'Venue, spread, FX, and routing cost paid when the base ticket opens.'
          },
          {
            label: 'Carry while holding',
            value: timedExitSpotSnapshot?.unpaidCarry || 0,
            isCost: true,
            copy: `Carry accumulates over about ${timedExitActualHoldingDays || 0}D before auto-sell.`
          },
          {
            label: 'Management fee',
            value: timedExitSpotSnapshot?.managementFee || 0,
            isCost: true,
            copy: 'Accrued route management fee is deducted from net exit and shown again in the sell signature.'
          },
          {
            label: 'Auto-sell drag',
            value: timedExitSpotSnapshot
              ? roundNumber(
                  timedExitSpotSnapshot.exitCosts.tradeFee +
                    timedExitSpotSnapshot.exitCosts.spreadCost +
                    timedExitSpotSnapshot.exitCosts.fxCost +
                    timedExitSpotSnapshot.exitCosts.channelCost +
                    timedExitSpotSnapshot.exitCosts.regulatoryFee,
                  2
                )
              : 0,
            isCost: true,
            copy: timedExitCostParts.length ? `Current exit stack: ${timedExitCostParts.join(' / ')}.` : 'Shows once the replay has a forward exit bar.'
          },
          {
            label: 'Est. take-home',
            value: timedExitEstimatedPnl,
            isCost: false,
            copy: `Net preview after the current timed exit path, around ${formatNotional(timedExitEstimatedValue)} PT value.`
          }
        ];
  const routeLearningSummaryCopy =
    selectedAdvancedRoute === 'perp'
      ? hedgeFocusActive
        ? activeRouteFocusConfig?.feeSummary ||
          'Use hedge mode to ask whether the leg actually softens downside after funding and close drag, not whether it produces the highest gross directional PnL.'
        : comboFocusActive
          ? 'Combo mode should explain which part is the active view and which part is the protection layer before it tries to sell extra complexity.'
          : flashLoanAppliedTicketNotional > 0
            ? `Flash is adding ${formatNotional(flashLoanAppliedTicketNotional)} PT of route-bound exposure on top of the wallet-backed leg. The preview now moves with that flash amount, after premium and reserve drag.`
            : `If flash quote is 0, the current paper notional is wallet-backed or the route has no attachable flash yet. With only ${formatNotional(
                routeMarginWalletFreeCashBeforeFlash
              )} PT left before flash reserve, use + attested flash or + broad flash to attach extra route-bound exposure.`
      : selectedAdvancedRoute === 'lending'
        ? `${activeRouteFocusConfig?.summary || 'Yield routes should keep source-of-return visible.'} This route is about carry source and take-home math, not directional candles.`
        : selectedAdvancedRoute === 'borrow'
          ? `${activeRouteFocusConfig?.summary || 'Option routes should read like payoff cards.'} Keep the thesis, drag stack, and downside style visible before execution details.`
          : selectedAdvancedRoute === 'routing'
            ? `${activeRouteFocusConfig?.summary || 'Automation routes should explain who decides and when.'} Use this layer to show cadence, guardrails, and override rules.`
            : 'Auto-sell is the cleanest way to compare headline price move versus real take-home after route drag.';
  const timedExitCardTitle = hedgeFocusActive
    ? activeRouteFocusConfig?.autoTitle || 'Auto-unwind hedge window'
    : selectedAdvancedRoute === 'borrow'
      ? 'Auto-settle strategy'
      : leverageRouteActive
      ? 'Auto-close after hold'
      : 'Auto-sell after hold';
  const timedExitHoldingLabel = hedgeFocusActive
    ? activeRouteFocusConfig?.holdingLabel || 'Hedge window'
    : 'Holding period';
  const timedExitTargetLabel = hedgeFocusActive
    ? activeRouteFocusConfig?.targetLabel || 'Auto-unwind bar'
    : selectedAdvancedRoute === 'borrow'
      ? 'Settle bar'
      : leverageRouteActive
      ? 'Auto-close bar'
      : 'Auto-sell bar';
  const timedExitSizeLabel = hedgeFocusActive
    ? activeRouteFocusConfig?.sizeLabel || 'Hedge size'
    : selectedAdvancedRoute === 'borrow'
      ? 'Strategy ticket'
    : 'Sell size';
  const timedExitActionLabel = leverageRouteActive && !activePerpLeg
    ? hedgeFocusActive
      ? hedgeSizingReady
        ? 'Open hedge first'
        : 'Pick anchor first'
      : 'Open perp first'
    : selectedPosition.units <= 0 && !leverageRouteActive
      ? selectedAdvancedRoute === 'borrow'
        ? 'Build strategy first'
        : 'Buy first for timed exit'
      : simulationHoldingDays <= 0
        ? 'Set hold first'
        : hedgeFocusActive
          ? `Unwind in ${timedExitRequestedDays}D`
          : selectedAdvancedRoute === 'borrow'
            ? `Settle in ${timedExitRequestedDays}D`
            : leverageRouteActive
              ? `Close in ${timedExitRequestedDays}D`
              : `Auto-sell in ${timedExitRequestedDays}D`;
  const hedgeStatCards = hedgeFocusProfile?.statCards || [];

  function renderRoutePracticeCaseCard(extraClassName = '') {
    return (
      <div className={`paper-shelf-learning-case-card paper-desk-practice-case-card ${routePracticeCase ? '' : 'locked'} ${extraClassName}`.trim()}>
        <div className="paper-shelf-learning-case-head">
          <div>
            <div className="paper-shelf-learning-subhead">Practice examples</div>
            <div className="paper-shelf-learning-case-copy">{routePracticeCaseCopy}</div>
          </div>
          {routePracticeCase ? (
            <span className={`pill ${routePracticeOutcomeToneValue >= 0 ? 'risk-low' : 'risk-high'}`}>
              {routePracticeBadgeCopy}
            </span>
          ) : null}
        </div>
        {routePracticeCase ? (
          <>
            {routePracticeCases.length > 1 ? (
              <div className="paper-practice-example-strip">
                {routePracticeCases.map((practiceCase, index) => {
                  const practiceOutcomePnl = getPracticeCaseOutcomePnl(practiceCase);
                  const practiceOutcomeRate = getPracticeCaseOutcomeRate(practiceCase);
                  const practiceToneValue = practiceOutcomePnl !== null ? practiceOutcomePnl : practiceOutcomeRate;
                  return (
                    <button
                      key={`${practiceCase.scenarioLabel}-${practiceCase.startIndex}-${practiceCase.endIndex}`}
                      type="button"
                      className={`paper-practice-example-chip ${selectedPracticeCaseSafeIndex === index ? 'active' : ''}`.trim()}
                      onClick={() => setSelectedPracticeCaseIndex(index)}
                    >
                      <span>{practiceCase.scenarioLabel}</span>
                      <strong className={practiceToneValue >= 0 ? 'risk-low' : 'risk-high'}>
                        {formatPracticeCaseOutcomeWithDrawdown(practiceCase)}
                      </strong>
                      <p>
                        {formatReplayDate(practiceCase.startBar?.ts, selectedView?.interval)} to {formatReplayDate(practiceCase.endBar?.ts, selectedView?.interval)}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="paper-shelf-learning-case-grid">
              <div>
                <span>Start</span>
                <strong>{formatReplayDate(routePracticeCase.startBar?.ts, selectedView?.interval)}</strong>
              </div>
              {hedgeFocusActive ? (
                <div>
                  <span>Hedge day</span>
                  <strong>{formatReplayDate(routePracticeCase.triggerBar?.ts, selectedView?.interval)}</strong>
                </div>
              ) : null}
              <div>
                <span>{routePracticeCase.mode === 'strategy' ? 'Settle' : 'Stop'}</span>
                <strong>{formatReplayDate(routePracticeCase.endBar?.ts, selectedView?.interval)}</strong>
              </div>
              <div>
                <span>Case days</span>
                <strong>{routePracticeCase.holdingDays}D</strong>
              </div>
              <div>
                <span>Max DD</span>
                <strong>{routePracticeMaxDrawdownLabel}</strong>
              </div>
            </div>
            {routePracticeStrategySliderRows.length ? (
              <div className="paper-practice-strategy-slider-card">
                <div className="paper-practice-strategy-slider-head">
                  <div>
                    <span>Profitable slider setup</span>
                    <strong>{routePracticeCase.strategyOutcome?.netPnl >= 0 ? 'Use this case' : 'Current case'}</strong>
                  </div>
                  <button type="button" className="ghost-btn compact" onClick={handleApplyPracticeStrategyControls}>
                    Apply sliders
                  </button>
                </div>
                <div className="paper-practice-strategy-slider-grid">
                  {routePracticeStrategySliderRows.map((row) => (
                    <div key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="paper-shelf-learning-case-actions">
              <button type="button" className="ghost-btn compact" onClick={() => handleApplyRoutePracticeCase('start')}>
                Start case
              </button>
              {hedgeFocusActive ? (
                <button type="button" className="ghost-btn compact" onClick={() => handleApplyRoutePracticeCase('risk')}>
                  Hedge day
                </button>
              ) : null}
              <button type="button" className="ghost-btn compact" onClick={() => handleApplyRoutePracticeCase('end')}>
                {routePracticeCase.mode === 'strategy' ? 'Settle day' : 'Stop day'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  function renderReplayDeskCompact() {
    const primaryPerpDirection = hedgeFocusActive ? 'short' : 'long';
    const secondaryPerpDirection = hedgeFocusActive ? 'long' : 'short';
    const hedgeSleeveOpen = hedgeSleeveReady;
    const getPerpActionLabel = (direction) => {
      if (hedgeFocusActive) {
        if (activePerpLeg === direction || (activePerpLeg && direction === 'short')) {
          return 'Close hedge';
        }
        return hedgeSleeveOpen ? 'Open hedge' : 'Buy sleeve first';
      }

      if (activePerpLeg === direction) {
        return `Close ${direction}`;
      }

      return `Open ${direction}`;
    };
    const primaryActionLabel = routeActionsLocked
      ? 'Buy'
      : selectedAdvancedRoute === 'perp'
        ? getPerpActionLabel(primaryPerpDirection)
        : routeActionCopy.primary;
    const secondaryActionLabel = routeActionsLocked
      ? 'Sell'
      : selectedAdvancedRoute === 'perp'
        ? hedgeFocusActive
          ? hedgeSecondaryOpenLabel
          : getPerpActionLabel(secondaryPerpDirection)
        : routeActionCopy.secondary;
    const primaryActionButtonClass =
      selectedAdvancedRoute === 'perp'
        ? `primary-btn ${activePerpLeg === primaryPerpDirection ? 'paper-inline-route-action-active' : ''}`.trim()
        : 'primary-btn';
    const secondaryActionButtonClass =
      selectedAdvancedRoute === 'perp'
        ? `${hedgeFocusActive ? 'secondary-btn' : 'primary-btn'} ${activePerpLeg === secondaryPerpDirection && !hedgeFocusActive ? 'paper-inline-route-action-active' : ''}`.trim()
        : 'secondary-btn';
    const handlePrimaryRouteAction = () => {
      if (routeActionsLocked) {
        handlePlaceTrade('buy');
        return;
      }

      if (selectedAdvancedRoute === 'perp') {
        if (hedgeFocusActive && !hedgeSleeveOpen && !activePerpLeg) {
          handlePlaceTrade('buy', {
            notionalOverride: hedgeProtectedSleeveNotional || hedgePrincipalPreviewNotional || Number(tradeAmount || 0)
          });
          return;
        }
        handlePerpShortcut(hedgeFocusActive && activePerpLeg ? activePerpLeg : primaryPerpDirection);
        return;
      }

      if (selectedAdvancedRoute === 'borrow') {
        handlePlaceTrade('buy', {
          customFeedback: `${OPTION_STRATEGY_LABELS[selectedStrategyTemplateId] || 'Strategy'} ticket staged at ${formatReplayDate(
            replayFocus.bar?.ts,
            selectedView?.interval
          )}. Tune the payoff controls, then use "Settle strategy" to apply the historical payoff at the selected holding period.`
        });
        mergeProgressUpdate({ strategyLessonCompleted: true });
        return;
      }

      handlePlaceTrade('buy');
    };
    const handleSecondaryRouteAction = () => {
      if (routeActionsLocked) {
        handlePlaceTrade('sell');
        return;
      }

      if (selectedAdvancedRoute === 'perp') {
        if (hedgeFocusActive) {
          if (activePerpLeg) {
            handlePerpShortcut(activePerpLeg, { closeSleeveAfterHedge: hedgeSleeveOpen });
            return;
          }

          if (hedgeSleeveOpen) {
            handlePlaceTrade('sell', { forceSellAll: true });
            return;
          }

          handleToggleReplayPlayback();
          return;
        }

        handlePerpShortcut(secondaryPerpDirection);
        return;
      }

      if (selectedAdvancedRoute === 'borrow') {
        handleSettleOptionStrategy();
        return;
      }

      if (selectedAdvancedRoute === 'spot') {
        handlePlaceTrade('sell', {
          forceSellAll: true,
          outcomeActionLabel: 'Sell high'
        });
        return;
      }

      handlePlaceTrade('sell');
    };
    const showAdvancedTools = selectedAdvancedRoute !== 'spot';
    const timedExitLosingRows =
      leverageRouteActive && timedExitLeveragedSnapshot && timedExitEstimatedPnl < 0
        ? [
            `Price move to the close bar: ${formatSigned(timedExitLeveragedSnapshot.priceMovePnl)} PT on ${formatNotional(
              timedExitLeveragedSnapshot.exposureNotional
            )} PT notional.`,
            timedExitCostParts.length
              ? `Route drag on this leveraged leg: -${formatNotional(
                  timedExitLeveragedSnapshot.entryFee +
                    timedExitLeveragedSnapshot.exitFee +
                    timedExitLeveragedSnapshot.fundingCost +
                    timedExitLeveragedSnapshot.flashLoanFee +
                    timedExitLeveragedSnapshot.managementFee
                )} PT (${timedExitCostParts.join(' / ')}).`
              : null,
            `Net margin account take-home stays ${formatSigned(timedExitEstimatedPnl)} PT.`
          ].filter(Boolean)
        : timedExitSpotSnapshot && timedExitEstimatedPnl < 0
        ? [
            `Price move to the auto-sell bar: ${formatSigned(timedExitSpotSnapshot.marketMovePnl)} PT.`,
            timedExitSpotSnapshot.entryFeeRemaining > 0
              ? `Entry drag already embedded in the open position: -${formatNotional(timedExitSpotSnapshot.entryFeeRemaining)} PT.`
              : null,
            timedExitCostParts.length
              ? `Exit drag on this sell: -${formatNotional(
                  timedExitSpotSnapshot.exitCosts.nonTaxCost + timedExitSpotSnapshot.managementFee
                )} PT (${timedExitCostParts.join(' / ')}).`
              : null,
            timedExitSpotSnapshot.unpaidCarry > 0
              ? `Carry accrued during the hold: -${formatNotional(timedExitSpotSnapshot.unpaidCarry)} PT.`
              : null,
            timedExitSpotSnapshot.managementFee > 0
              ? `Management fee accrued during the hold: -${formatNotional(timedExitSpotSnapshot.managementFee)} PT.`
              : null,
            timedExitSpotSnapshot.exitCosts.estimatedTax > 0
              ? `Estimated tax on the positive gain slice: -${formatNotional(timedExitSpotSnapshot.exitCosts.estimatedTax)} PT.`
              : null,
            `Net take-home stays ${formatSigned(timedExitEstimatedPnl)} PT.`
          ].filter(Boolean)
        : [];
    const timedExitReady =
      leverageRouteActive
        ? routeTimedExitAllowed &&
          Boolean(activePerpLeg) &&
          routeMarginCapital > 0 &&
          timedExitRequestedDays > 0 &&
          Boolean(timedExitTargetBar) &&
          timedExitHasForwardBar
        : routeTimedExitAllowed &&
          selectedPosition.units > 0 &&
          timedExitRequestedDays > 0 &&
          Boolean(timedExitTargetBar) &&
          timedExitHasForwardBar;
  const timedExitStatus = simulationHoldingDays <= 0
    ? { label: 'Invalid', tone: 'risk-medium' }
    : hedgeFocusActive && !hedgeSizingReady
      ? { label: 'Pick anchor first', tone: 'risk-medium' }
      : leverageRouteActive && !activePerpLeg
        ? { label: 'Open first', tone: 'risk-medium' }
      : selectedPosition.units <= 0 && !leverageRouteActive
        ? { label: selectedAdvancedRoute === 'borrow' ? 'Build first' : 'Buy first', tone: 'risk-medium' }
      : timedExitRequestedExceedsWindow
          ? { label: 'Too long', tone: 'risk-medium' }
          : !routeTimedExitAllowed
            ? { label: 'Lock', tone: 'risk-medium' }
            : timedExitReady
              ? { label: 'Ready', tone: 'risk-low' }
              : { label: 'Lock', tone: 'risk-medium' };
    const timedExitSummary = !routeTimedExitAllowed
      ? advancedActivityUnlockCopy
        : simulationHoldingDays <= 0
          ? hedgeFocusActive
            ? 'Set a valid hedge window above 0D first, then the replay can map the auto-unwind bar for you.'
            : 'Set a valid holding period above 0D first, then the replay can map the auto-sell bar for you.'
        : leverageRouteActive && !activePerpLeg
          ? hedgeFocusActive
            ? 'Open the hedge leg first. Then the replay can jump forward and unwind that protection against the chosen hedge window.'
            : 'Open long or open short first. Then the replay can jump forward and close that leveraged leg against the chosen holding period.'
        : leverageRouteActive && routeMarginCapital <= 0
          ? 'This wallet cannot post any initial margin right now. Add paper cash or reduce the ticket size first.'
        : leverageRouteActive && timedExitRequestedExceedsWindow
          ? `This chart only shows about ${timedExitMaxHoldingDays}D ahead from the locked bar. Enter a shorter exit horizon or widen the replay window first.`
        : leverageRouteActive && !timedExitHasForwardBar
          ? hedgeFocusActive
            ? 'Choose an earlier replay bar first so the hedge route can actually move forward before unwinding.'
            : 'Choose an earlier replay bar first so the leverage route can actually move forward before closing.'
        : leverageRouteActive && timedExitLeveragedSnapshot
          ? `${formatReplayDate(timedExitAnchorBar?.ts, selectedView?.interval)} -> hold about ${timedExitActualHoldingDays}D -> ${
              hedgeFocusActive ? 'unwind hedge on' : 'close'
            } ${leverageDirection} ${formatNotional(timedExitLeveragedSnapshot.exposureNotional)} PT notional (${routeLeverageMultiple}x on ${formatNotional(
              routeMarginCapital
            )} PT margin)${
              flashLoanAppliedTicketNotional > 0
                ? `. Flash top-up ${formatNotional(flashLoanAppliedTicketNotional)} PT is already included in that leveraged notional, with about ${formatNotional(
                    flashLoanPremiumEstimate
                  )} PT premium charged upfront.`
                : ''
            } -> ${hedgeFocusActive ? 'est. protection after drag' : 'est. take-home'} ${formatNotional(timedExitEstimatedValue)} PT / ${formatSigned(
                timedExitEstimatedPnl
              )} PT`
          : selectedPosition.units <= 0
            ? 'Open a base replay buy first, then timed exit can jump forward and sell the full position for you.'
          : timedExitRequestedExceedsWindow
          ? `This chart only shows about ${timedExitMaxHoldingDays}D ahead from the locked bar. Enter a shorter exit horizon or widen the replay window first.`
          : !timedExitHasForwardBar
          ? 'Choose an earlier replay bar first so the hold can actually move forward before auto-selling.'
          : timedExitTargetBar
          ? `${formatReplayDate(timedExitAnchorBar?.ts, selectedView?.interval)} -> hold about ${timedExitActualHoldingDays}D -> ${formatReplayDate(
              timedExitTargetBar.ts,
              selectedView?.interval
            )} auto-sell ${formatUnits(selectedPosition.units)} units -> est. take-home ${formatNotional(timedExitEstimatedValue)} PT / ${formatSigned(
              timedExitEstimatedPnl
            )} PT`
          : 'Replay bars are still loading for this product.';
    const autoSellVenueNotes =
      leverageRouteActive
        ? [
            {
              title: 'Margin and leverage',
              copy: 'Kraken documents that perp positions are opened on initial margin and can be liquidated once equity falls below maintenance margin. This replay treats your margin input as the capital at risk and sizes notional from leverage on top.'
            },
            {
              title: 'Funding and hold',
              copy: 'Perps can stay open without expiry, but funding keeps accruing while the leg stays open. The replay therefore applies funding drag across the chosen holding period before showing take-home.'
            },
            {
              title: 'Hedging idea',
              copy: 'A simple hedge is to keep the spot sleeve or tokenized stock exposure, then open a short perp on the same underlying for part or all of that delta. Holding period matters because funding and basis drag continue while the hedge stays live.'
            },
            {
              title: 'Flash loan boundary',
              copy: 'Aave-style flash liquidity is atomic: borrow, route, unwind, and repay inside one transaction. It can support same-block refinancing or collateral swaps, but not a multi-day leveraged hold.'
            }
          ]
      : selectedProduct.id === 'aaplx'
        ? [
            {
              title: 'Size handling',
              copy: 'Replay keeps decimal units. Kraken says xStocks can be purchased fractionally from $1, so this route does not force whole-share sells by default.'
            },
            {
              title: 'Session hours',
              copy: 'Kraken documents xStocks trading across a 24/5 window. Overnight, pre-market, and after-hours liquidity can be thinner, so spreads and volatility can widen.'
            },
            {
              title: 'Order styles',
              copy: 'Kraken Pro lists Market, Limit, Stop Loss, and Stop Loss Limit for xStocks. That trigger logic lives in the venue order engine, not in Solidity by default.'
            },
            {
              title: 'If you want onchain automation',
              copy: 'A self-custodied stop or limit route would usually need a smart contract plus a keeper or intent relayer to watch prices and submit the exit.'
            }
          ]
        : selectedProduct.lane === 'funding' || selectedProduct.lane === 'yield'
          ? [
              {
                title: 'Size handling',
                copy: 'Replay keeps decimal units because tokenized fund shares and cash-rail balances are usually fractional. Issuer redemptions can still have minimum lot or allowlist rules.'
              },
              {
                title: 'Session hours',
                copy: 'These products usually do not have a true overnight order book. What matters more is market-day NAV strike timing, subscription cutoffs, and redemption windows.'
              },
              {
                title: 'Order styles',
                copy: 'Limit and stop behavior here is closer to a platform workflow around the issuer window than a CEX-style matching engine.'
              },
              {
                title: 'If you want onchain automation',
                copy: 'Solidity only becomes useful if you want trustless trigger logic, escrow, or a keeper-driven auto-redeem flow onchain.'
              }
            ]
          : selectedProduct.lane === 'private'
            ? [
                {
                  title: 'Size handling',
                  copy: 'Replay still shows decimal units, but real private windows often settle through SPVs, transfer approvals, or minimum lot sizes rather than a continuous exchange book.'
                },
                {
                  title: 'Session hours',
                  copy: 'There is usually no meaningful overnight trading tape. Exit depends on tenders, matched transfers, or issuer events instead of after-hours liquidity.'
                },
                {
                  title: 'Order styles',
                  copy: 'A limit or stop on a private window is normally an offchain workflow, not a native exchange order waiting in a public book.'
                },
                {
                  title: 'If you want onchain automation',
                  copy: 'A Solidity contract could hold transfer logic or escrow, but it cannot create liquidity by itself. The hard part is legal transferability and the actual buyer path.'
              }
            ]
          : [
                {
                  title: 'Size handling',
                  copy: 'Replay keeps quantity-based sizing because major CEX and broker routes usually accept fractional or decimal quantity, not only whole units.'
                },
                {
                  title: 'Session hours',
                  copy: 'For broker-style routes, overnight trading depends on the venue. IBKR notes that extended-hours behavior is separate from regular-session routing and liquidity is typically thinner.'
                },
                {
                  title: 'Order styles',
                  copy: 'Limit, stop, and stop-limit are usually order-management-system features. IBKR and major venues can simulate or route these instructions without needing a smart contract.'
                },
                {
                  title: 'If you want onchain automation',
                  copy: 'Smart contracts matter when you want self-custodied triggers, keeper execution, or transparent onchain settlement instead of broker-managed order logic.'
                }
              ];
    function renderAutoSellTimelineDock() {
      const autoSellRows = timedExitPortfolioRows.filter((row) => Number(row.units || 0) > 0);
      const autoSellGlobalMaxHoldingDays = Math.max(
        1,
        timedExitMaxHoldingDays || 1,
        ...autoSellRows.map((row) => Number(row.maxHoldingDays || 1))
      );
      const autoSellSuggestedHoldingDays = getSuggestedHoldingDays(selectedProduct, selectedProductGuide, selectedAdvancedRoute, autoSellGlobalMaxHoldingDays);
      const autoSellPresetDays = [...new Set([7, 14, 30, 90, autoSellGlobalMaxHoldingDays].filter((days) => days <= autoSellGlobalMaxHoldingDays))]
        .sort((left, right) => left - right);
      const targetRowExists = autoSellRows.some((row) => row.id === autoSellTargetProductId);
      const selectedAutoSellProductId =
        targetRowExists
          ? autoSellTargetProductId
          : autoSellRows.some((row) => row.id === selectedProductId)
            ? selectedProductId
            : autoSellRows[0]?.id || '';
      const selectedAutoSellRow = autoSellRows.find((row) => row.id === selectedAutoSellProductId) || null;
      const selectedAutoSellReady = Boolean(selectedAutoSellRow?.ready);
      const activeLeverageCloseContribution = leverageRouteActive && activePerpLeg && timedExitReady ? timedExitEstimatedPnl : 0;
      const activeLeverageCloseValue = leverageRouteActive && activePerpLeg && timedExitReady ? timedExitEstimatedValue : 0;
      const topDelta = roundNumber(timedExitPortfolioDelta + activeLeverageCloseContribution, 2);
      const topValue = roundNumber(timedExitPortfolioNetExitValue + activeLeverageCloseValue, 2);
      const autoSellDockAvailable = true;
      const openAutoSellPreviewForProduct = (productId) => {
        if (!productId) return;
        setAutoSellTargetProductId(productId);
        setAutoSellPreviewProductId(productId);
        setAutoSellPreviewOpen(true);
      };

      if (!autoSellDockAvailable) return null;

      if (!autoSellDockOpen || autoSellDockFloat.isCollapsed) {
        const collapsedStyle =
          autoSellDockFloat.arrowSide === 'left'
            ? { top: `${autoSellDockFloat.arrowTop}px`, left: '10px', right: 'auto', bottom: 'auto' }
            : { top: `${autoSellDockFloat.arrowTop}px`, right: '10px', left: 'auto', bottom: 'auto' };

        return (
          <div
            className={`paper-floating-leaderboard-toggle ${autoSellDockFloat.arrowSide} paper-floating-auto-sell-collapse-toggle`}
            style={collapsedStyle}
            role="button"
            tabIndex={0}
            aria-label="Open auto-sell timeline"
            onPointerDown={beginAutoSellDockArrowGesture}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              handleExpandAutoSellDock();
            }}
          >
            <span>{autoSellDockFloat.arrowSide === 'left' ? '>' : '<'}</span>
            <small>{leverageRouteActive ? 'Close' : 'Exit'}</small>
          </div>
        );
      }

      return (
        <aside
          className="wealth-floating-timeline paper-floating-auto-sell"
          aria-label="Auto-sell timeline simulator"
          style={{
            left: `${autoSellDockFloat.left}px`,
            top: `${autoSellDockFloat.top}px`,
            right: 'auto',
            bottom: 'auto',
            width: `${autoSellDockFloat.width}px`,
            height: `${autoSellDockFloat.height}px`
          }}
        >
          <div className="paper-floating-product-leaderboard-head" onPointerDown={beginAutoSellDockDrag}>
            <div>
              <div className="eyebrow">Auto-sell timeline</div>
              <h3>{leverageRouteActive ? 'Timed close' : 'Multi-position exit'}</h3>
            </div>
            <button
              className="ghost-btn compact paper-floating-product-leaderboard-close"
              aria-label="Collapse auto-sell timeline"
              onClick={handleCollapseAutoSellDock}
            >
              X
            </button>
          </div>

          <div className="paper-floating-product-leaderboard-copy">
            One holding window drives every open spot position. Pick a row to inspect that product; the total change only lives in the top summary.
          </div>

          <div className="wealth-floating-timeline-body paper-floating-auto-sell-body">
            <div className="paper-floating-auto-sell-total">
              <div>
                <span>Total projected change</span>
                <strong className={topDelta >= 0 ? 'risk-low' : 'risk-high'}>{formatSigned(topDelta)} PT</strong>
              </div>
              <div>
                <span>Payoff / est. take-home</span>
                <strong>{formatNotional(topValue)} PT</strong>
              </div>
            </div>

            <label className="wealth-field compact paper-floating-auto-sell-slider">
              Global hold window: {timedExitRequestedDays}D / suggested {autoSellSuggestedHoldingDays}D
              <input
                type="range"
                min="0"
                max={autoSellGlobalMaxHoldingDays}
                step="1"
                value={Math.min(timedExitRequestedDays, autoSellGlobalMaxHoldingDays)}
                onChange={(event) => updateSimulationHoldingDays(Number(event.target.value), { showToast: false })}
              />
              <div className="paper-range-suggestion-row">
                <span
                  className="paper-range-suggestion-marker"
                  style={{ left: `${autoSellGlobalMaxHoldingDays > 0 ? clampNumber((autoSellSuggestedHoldingDays / autoSellGlobalMaxHoldingDays) * 100, 0, 100) : 0}%` }}
                />
                <span>Suggested {formatHoldingPresetLabel(autoSellSuggestedHoldingDays)}</span>
              </div>
            </label>

            <div className="paper-floating-auto-sell-presets">
              <button
                type="button"
                className={`ghost-btn compact ${simulationHoldingDays === autoSellSuggestedHoldingDays ? 'active-toggle' : ''}`}
                onClick={() => updateSimulationHoldingDays(autoSellSuggestedHoldingDays, { showToast: false })}
              >
                Suggested
              </button>
              {autoSellPresetDays.map((days) => (
                <button
                  key={days}
                  type="button"
                  className={`ghost-btn compact ${simulationHoldingDays === days ? 'active-toggle' : ''}`}
                  onClick={() => updateSimulationHoldingDays(days, { showToast: false })}
                >
                  {formatHoldingPresetLabel(days)}
                </button>
              ))}
            </div>

            {timedExitRangeToast ? <div className="paper-inline-toast paper-inline-toast-inline">{timedExitRangeToast}</div> : null}

            <div className="wealth-floating-timeline-list paper-floating-auto-sell-list">
              {autoSellRows.length ? (
                autoSellRows.map((row) => (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    className={`wealth-floating-timeline-row paper-floating-auto-sell-row ${selectedAutoSellProductId === row.id ? 'active' : ''} ${row.ready ? '' : 'locked'}`.trim()}
                    onClick={() => {
                      setAutoSellTargetProductId(row.id);
                      handleSelectProduct(row.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setAutoSellTargetProductId(row.id);
                      handleSelectProduct(row.id);
                    }}
                  >
                    <div>
                      <div className="product-title">{row.ticker || row.name}</div>
                      <div className="muted">
                        {row.ready
                          ? `Locked until ${formatReplayDate(row.targetBar?.ts, productViews[row.id]?.interval)} / ${row.actualHoldingDays}D / ${formatUnits(row.units)} units`
                          : `Locked. Needs a shorter window or earlier cursor. Max visible ${row.maxHoldingDays}D.`}
                      </div>
                    </div>
                    <div className="wealth-leader-move">
                      <strong className={row.projectedPnl >= 0 ? 'risk-low' : 'risk-high'}>{formatSigned(row.projectedPnl)} PT</strong>
                      <div className={`wealth-leader-subtext ${row.projectedDelta >= 0 ? 'risk-low' : 'risk-high'}`}>
                        {formatSigned(row.projectedDelta)} vs now
                      </div>
                      <button
                        type="button"
                        className="ghost-btn compact paper-floating-auto-sell-row-action"
                        disabled={!row.ready}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openAutoSellPreviewForProduct(row.id);
                        }}
                      >
                        {row.ready ? 'Settle' : 'Locked'}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="paper-floating-auto-sell-empty">
                  Buy the selected product first. After the wallet signature, this dock will list every open replay position on the same time slider.
                </div>
              )}
            </div>

            <button
              type="button"
              className="primary-btn paper-floating-auto-sell-action"
              onClick={() => openAutoSellPreviewForProduct(selectedAutoSellProductId)}
              disabled={!selectedAutoSellReady}
            >
              {selectedAutoSellReady && selectedAutoSellRow ? `Settle ${selectedAutoSellRow.ticker || selectedAutoSellRow.name}` : 'Select a ready position'}
            </button>
          </div>
        </aside>
      );
    }

    const focusedTradeBar = replayFocus.bar;
    const focusedTradeDate = formatReplayDate(focusedTradeBar?.ts, selectedView?.interval);
    const focusedTradePrice = Number(focusedTradeBar?.close || 0);
    const focusedTradeUnitsPreview = focusedTradePrice > 0 ? roundNumber(Number(tradeAmount || 0) / focusedTradePrice, 6) : 0;
    const routeDisplayAvailableCash = leverageRouteActive ? routeMarginWalletFreeCash : availableCash;
    const routeCashLabel = leverageRouteActive ? (hedgeFocusActive ? 'Max hedge ticket' : selectedTradeAmountDisplayLabel) : 'Available cash';
    const routeCashDisplayValue = leverageRouteActive ? (hedgeFocusActive ? tradeAmountSliderMax : selectedTradeAmountMaxValue) : routeDisplayAvailableCash;
    const ticketRouteNotional = roundNumber(routeEffectiveTicketNotional, 2);
    const flashLoanAppliedSummaryLabel = flashLoanQuoteRows
      .filter((row) => row.appliedNotional > 0)
      .sort((left, right) => left.rate - right.rate)
      .map((row) => `${row.label} ${formatNotional(row.appliedNotional)} PT @ ${formatPercent(row.rate, 2)}`)
      .join(' + ');
    const currentTicketNotionalLabel = leverageRouteActive
      ? flashLoanAppliedTicketNotional > 0
        ? `${formatNotional(ticketRouteNotional)} PT target (${formatNotional(routeBaseNotional)} PT margin route + ${formatNotional(
            hedgeFocusActive ? hedgeFlashTopUpNotional : flashLoanAppliedTicketNotional
          )} PT flash)`
        : `${formatNotional(routeBaseNotional)} PT backed now / ${formatNotional(tradeAmount)} PT target (${
            routeLeverageMultiple === 1 ? 'No leverage' : `${routeLeverageMultiple}x leverage`
          })`
      : `${formatNotional(tradeAmount)} PT`;
    const currentTicketSizeLabel = leverageRouteActive
      ? `${formatNotional(routeMarginCapital)} PT posted / ${formatNotional(routeRequiredMarginCapital)} PT req.${
          routeFlashReserveCapital > 0 ? ` (${formatNotional(routeFlashReserveCapital)} PT flash reserve)` : ''
        }`
      : `${formatUnits(focusedTradeUnitsPreview)} units`;
    const currentTicketOpenLabel = leverageRouteActive
      ? activePerpLeg
        ? `${activePerpLeg} / ${formatNotional(routeEffectiveTicketNotional)} PT`
        : flashLoanAppliedTicketNotional > 0
          ? hedgeFocusActive
            ? 'No hedge leg / flash ready'
            : 'No open leg / flash ready'
          : hedgeFocusActive
            ? 'No hedge leg'
            : 'No open leg'
      : `${formatUnits(selectedPosition.units)} units`;
  const focusedTradeModeCopy =
      replayFocus.hoverActive
        ? hedgeFocusActive
          ? 'The white-dot bar is now the hedge anchor. Use this date to stage protection for the selected sleeve rather than to chase a second speculative punt.'
          : 'The white-dot bar is now the active trade focus. Buy or Sell will confirm against this hovered replay date and price.'
        : comboFocusActive
          ? 'The locked replay cursor is now the combo anchor. Treat the live leg as the active side of a leverage + hedge template until you move the white dot again.'
          : 'Buy or Sell currently uses the locked replay cursor. Move the white dot to another bar if you want a different trade date.';
    const fundingBreakdown = deskSimulation.fundingBreakdown;
    const autoSellPreviewResolvedProductId = autoSellPreviewProductId || selectedProductId;
    const autoSellPreviewProduct = productMap[autoSellPreviewResolvedProductId] || selectedProduct;
    const autoSellPreviewRow = timedExitPortfolioRows.find((row) => row.id === autoSellPreviewResolvedProductId) || null;
    const autoSellPreviewView = productViews[autoSellPreviewResolvedProductId];
    const autoSellPreviewIsLeverage =
      leverageRouteActive &&
      activePerpLeg &&
      autoSellPreviewResolvedProductId === selectedProductId &&
      !autoSellPreviewRow;
    const autoSellPreviewAnchorLabel = autoSellPreviewIsLeverage
      ? formatReplayDate(timedExitAnchorBar?.ts, selectedView?.interval)
      : formatReplayDate(autoSellPreviewRow?.anchorBar?.ts || timedExitAnchorBar?.ts, autoSellPreviewView?.interval || selectedView?.interval);
    const autoSellPreviewTargetLabel = autoSellPreviewIsLeverage
      ? formatReplayDate(timedExitTargetBar?.ts, selectedView?.interval)
      : formatReplayDate(autoSellPreviewRow?.targetBar?.ts || timedExitTargetBar?.ts, autoSellPreviewView?.interval || selectedView?.interval);
    const autoSellPreviewSellUnits = autoSellPreviewIsLeverage && timedExitLeveragedSnapshot
      ? timedExitLeveragedSnapshot.exposureNotional
      : autoSellPreviewRow?.units ?? selectedPosition.units;
    const autoSellPreviewSellSizeLabel =
      autoSellPreviewIsLeverage && timedExitLeveragedSnapshot
        ? `Close ${leverageDirection} ${formatNotional(timedExitLeveragedSnapshot.exposureNotional)} PT notional (${routeLeverageMultiple}x)`
        : '';
    const autoSellPreviewHoldingDays = autoSellPreviewIsLeverage
      ? timedExitActualHoldingDays
      : autoSellPreviewRow?.actualHoldingDays || timedExitActualHoldingDays;
    const autoSellPreviewEstimatedValue = autoSellPreviewIsLeverage
      ? timedExitEstimatedValue
      : autoSellPreviewRow?.projectedValue ?? timedExitEstimatedValue;
    const autoSellPreviewEstimatedPnl = autoSellPreviewIsLeverage
      ? timedExitEstimatedPnl
      : autoSellPreviewRow?.projectedPnl ?? timedExitEstimatedPnl;

    return (
      <div
        key={`desk-${selectedProductId}`}
        className="paper-inline-desk"
        ref={tradeDeskRef}
      >
        <div className="paper-inline-desk-route">
          <div className="paper-inline-desk-route-main">
            <div className="paper-inline-desk-route-headline">
              <div>
                <div className="eyebrow">Replay desk</div>
                <div className="paper-inline-desk-route-title">{routeActionCopy.title}</div>
                <div className="paper-inline-route-helper-row">
                  <span className="paper-inline-route-helper">{selectedRouteHelperLabel}</span>
                  <span className="paper-inline-route-tag">{selectedRouteUi.actionTag}</span>
                  <span className={`pill ${advancedActivityEnabled ? 'risk-low' : 'risk-medium'}`}>
                    {advancedActivityEnabled ? 'Advanced on' : selectedAdvancedRoute === 'spot' ? 'Spot only' : 'Preview mode'}
                  </span>
                </div>
              </div>

              <div className="paper-route-selector">
                <label className={`paper-route-select-wrap ${advancedActivityEnabled ? '' : 'locked'}`.trim()}>
                  <span>Learning route</span>
                  <select
                    value={selectedLearningRouteValue}
                    onChange={(event) => handleSelectLearningRoute(event.target.value)}
                  >
                    {learningRouteOptions.map((route) => {
                      return (
                        <option key={route.value} value={route.value}>
                          {route.actionLocked ? `${route.label} (Preview; actions locked)` : route.label}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
            </div>

            <div className="paper-inline-desk-copy-row">
              <div className="paper-inline-desk-copy">{routeCopy}</div>
              <div className="paper-inline-desk-copy-actions">
                <div className="paper-inline-help-pill">
                  <span>Route notes</span>
                  <div className="paper-inline-cash-tooltip">
                    {activeRouteFocusConfig?.summary || selectedAdvancedRouteConfig.description} {selectedProductRoutePlaybook.summary}
                  </div>
                </div>
                {!advancedActivityEnabled ? (
                  <div className="paper-inline-help-pill">
                    <span>Unlock rules</span>
                    <div className="paper-inline-cash-tooltip">{advancedActivityUnlockCopy}</div>
                  </div>
                ) : null}
              </div>
            </div>

            {strategyRouteActive && selectedRouteFocusOptions.length ? (
              <div className="paper-strategy-template-strip paper-strategy-template-strip-desk">
                <span>Choose template</span>
                <div className="paper-inline-structure-strip paper-inline-structure-strip-compact">
                  {selectedRouteFocusOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`ghost-btn compact ${selectedStrategyTemplateId === option.id ? 'active-toggle' : ''}`}
                      onClick={() => handleSelectStrategyTemplate(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {renderRoutePracticeCaseCard('paper-desk-practice-case-card-inline')}
            {comboFocusActive ? renderPortfolioComboLab('paper-portfolio-combo-card paper-portfolio-combo-card-desk') : null}
          </div>
        </div>

        <div className="paper-inline-desk-grid paper-inline-desk-grid-expanded">
          <div className="paper-inline-desk-panel">
            {replayDeskToast?.message ? (
              <div key={replayDeskToast.id} className="paper-replay-desk-center-toast">
                {replayDeskToast.message}
              </div>
            ) : null}
            <div className="paper-inline-desk-controls">
              <div className="paper-inline-desk-top-stack">
                {hedgeFocusActive ? (
                  <div className="paper-inline-route-paper-notional paper-inline-route-paper-notional-inline">
                    <div className="paper-inline-route-paper-notional-head">
                      <span>Sleeve notional to protect</span>
                      <div className="paper-inline-route-principal-actions">
                        <strong>{formatNotional(hedgePrincipalPreviewNotional)} PT</strong>
                        <button
                          type="button"
                          className={`ghost-btn compact ${
                            hedgePrincipalFlashEnabled || hedgePrincipalFlashReservedNotional > 0 ? 'active-toggle' : ''
                          }`.trim()}
                          onClick={handleToggleHedgePrincipalFlash}
                          disabled={isRiskSigning}
                        >
                          {isRiskSigning
                            ? 'Await wallet'
                            : hedgePrincipalFlashEnabled || hedgePrincipalFlashReservedNotional > 0
                              ? 'Loan on'
                              : 'Want more?'}
                        </button>
                      </div>
                    </div>
                    <div className="paper-inline-route-paper-notional-row">
                      <input
                        type="number"
                        min="0"
                        step="250"
                        value={hedgePreviewSleeveInput}
                        onChange={(event) => handleHedgePreviewSleeveInputChange(event.target.value)}
                        onBlur={handleHedgePreviewSleeveBlur}
                      />
                      <div className="paper-inline-route-paper-notional-cap">
                        <span>{hedgePrincipalFlashEnabled ? 'Wallet + loan sleeve max' : 'Wallet sleeve max'}</span>
                        <strong>{formatNotional(hedgePreviewSleeveMax)} PT</strong>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, hedgePreviewSleeveMax)}
                      step="0.01"
                      value={Math.min(Math.max(0, Number(hedgePrincipalPreviewNotional || 0)), Math.max(0, hedgePreviewSleeveMax))}
                      onChange={(event) => handleHedgePreviewSleeveSliderChange(event.target.value)}
                      disabled={hedgePreviewSleeveMax <= 0}
                    />
                    <div className="paper-inline-route-paper-notional-copy">
                      {hedgeHasMeaningfulOpenSleeve
                        ? `Live sleeve mark: ${formatNotional(hedgeLiveSleeveNotional)} PT. ${hedgePrincipalFundingCopy}`
                        : hedgePrincipalFundingCopy}
                      {' '}Close sleeve removes this {selectedProduct.ticker} exposure; it is not just a label change.
                    </div>
                    <div className="paper-inline-route-flash-card">
                      <div className="paper-inline-route-flash-top">
                        <div>
                          <span>Fixed loan pool</span>
                          <strong>{formatNotional(hedgeLoanBudgetUsed)} / {formatNotional(principalFlashTotalBudget)} PT used</strong>
                        </div>
                        <button
                          type="button"
                          className="ghost-btn compact"
                          onClick={handleOpenFlashLoanConfirm}
                          disabled={!hedgeSizingReady}
                        >
                          {hedgeFlashQuoteButtonLabel}
                        </button>
                      </div>
                      <div className="paper-inline-route-flash-meta">
                        <span>{hedgePrincipalFundingModeLabel}</span>
                        <span>Sleeve wallet {formatNotional(hedgePrincipalCashReserved)} PT</span>
                        <span>Sleeve loan {formatNotional(hedgePrincipalFlashReservedNotional)} PT</span>
                        <span>Hedge loan cap {formatNotional(flashLoanQuoteMaxNotional)} PT</span>
                        <span>Left after quote {formatNotional(hedgeLoanBudgetLeftAfterApplied)} PT</span>
                        <span>Hedge need {formatNotional(hedgeDisplayedLoanNeed)} PT</span>
                        {hedgeFlashTopUpRemaining > 0 && flashLoanAppliedTicketNotional > 0 ? <span>Top-up left {formatNotional(hedgeFlashTopUpRemaining)} PT</span> : null}
                        {hedgeSuggestedFundingGap > 0 ? <span>Suggested gap {formatNotional(hedgeSuggestedFundingGap)} PT</span> : null}
                        {hedgeFullCoverageFundingGap > 0 ? <span>100% uncovered {formatNotional(hedgeFullCoverageFundingGap)} PT</span> : null}
                      </div>
                    </div>
                  </div>
                ) : null}
                {!strategyAiRouteActive ? (
                <label className="wealth-field paper-inline-desk-field">
                  <div className="paper-inline-desk-label-row">
                    <span className="paper-inline-desk-label-tight">{tradeAmountFieldLabel}</span>
                    <div className="paper-inline-cash-pill paper-inline-cash-pill-compact">
                      <span>{routeCashLabel} {formatNotional(routeCashDisplayValue)} PT</span>
                      <div className="paper-inline-cash-tooltip">
                        {leverageRouteActive ? (
                          <div>
                            <strong>{selectedTradeAmountDisplayLabel}</strong>: {formatNotional(selectedTradeAmountMaxValue)} PT
                            {hedgeFocusActive && hedgeSizingReady
                              ? `; max hedge ticket ${formatNotional(tradeAmountSliderMax)} PT (${formatPercent(hedgeMaxFundableRatio, 0)} of principal).`
                              : ''}
                          </div>
                        ) : null}
                        {hedgeFocusActive ? (
                          <>
                            <div>
                              PT source = core paper cash {formatNotional(fundingBreakdown.corePaperCash)} + quest rewards {formatNotional(fundingBreakdown.rewardCredit)} = wallet PT {formatNotional(availableCash)}.
                            </div>
                            <div>
                              Wealth receipt support {formatNotional(fundingBreakdown.wealthReceiptSupport)} PT is separate: it can raise certain route caps after a pledge, but it is not added to wallet cash and it should not flow into Wealth PnL.
                            </div>
                            <div>
                              Principal uses wallet {formatNotional(hedgePrincipalCashReserved)} PT after upfront drag, then loan {formatNotional(hedgePrincipalFlashNotional)} PT if a principal-loan agreement is signed.
                            </div>
                            <div>
                              Hedge cash left {formatNotional(routeFundingCashAvailable)} PT gives wallet ticket cap {formatNotional(routeMaxWalletBackedNotional)} PT at the current margin setup.
                            </div>
                            <div>
                              Fixed loan pool {formatNotional(principalFlashTotalBudget)} PT - principal loan {formatNotional(hedgePrincipalFlashReservedNotional)} PT = {formatNotional(hedgePrincipalFlashBudgetLeft)} PT raw pool left; usable hedge loan cap is {formatNotional(flashLoanQuoteMaxNotional)} PT after lane support.
                            </div>
                            <div>
                              Hedge funding cap solves wallet ticket + remaining loan under this margin/reserve rule: {formatNotional(selectedTradeAmountMaxValue)} PT.
                            </div>
                            {hedgeFullCoverageFundingGap > 0 ? (
                              <div>100% hedge cannot be funded here. Maximum fundable hedge is {formatPercent(hedgeMaxFundableRatio, 0)} of principal; uncovered at 100% target is {formatNotional(hedgeFullCoverageFundingGap)} PT.</div>
                            ) : null}
                            {hedgeSizingReady ? (
                              <div>Suggested hedge ticket = principal {formatNotional(hedgeProtectedSleeveNotional)} PT x hedge size {formatPercent(Number(hedgeRatio || 0), 0)}.</div>
                            ) : null}
                            {hedgeSuggestedFundingGap > 0 ? (
                              <div>Cannot fund the suggested ticket yet: it is {formatNotional(hedgeSuggestedFundingGap)} PT above the current hedge funding cap.</div>
                            ) : null}
                            <div>{hedgeLoanCapacityCopy}</div>
                          </>
                        ) : null}
                        {leverageRouteActive && !hedgeFocusActive && tradeAmountMaxMode === 'wallet' ? (
                          <>
                            <div>Raw wallet-only hedge max is solved from hedge cash left after principal, against the current leverage + margin-buffer schedule.</div>
                            <div>Hedge cash {formatNotional(routeFundingCashAvailable)} PT / setup margin rate {formatPercent(routeWalletBackedSetupMarginRate, 2)}</div>
                          </>
                        ) : null}
                        {leverageRouteActive && !hedgeFocusActive && tradeAmountMaxMode === 'ticket' ? (
                          <>
                            <div>Attested flash now stacks on top of the wallet-backed leverage leg. It stays bound to the signed venue route, so the lower fee is justified by provable use.</div>
                            <div>
                              Ticket cap = min(reserve-backed {formatNotional(displayTicketFlashLane?.reserveBackedCap || 0)} PT, attested support {formatNotional(displayTicketFlashLane?.supportCap || 0)} PT)
                            </div>
                          </>
                        ) : null}
                        {leverageRouteActive && !hedgeFocusActive && tradeAmountMaxMode === 'venue' ? (
                          <>
                            <div>Broad flash can also add route-bound leverage exposure, but it is priced higher because the final use is less provable than the attested venue lane.</div>
                            <div>
                              Broad cap = min(reserve-backed {formatNotional(displayGeneralFlashLane?.reserveBackedCap || 0)} PT, broad support {formatNotional(displayGeneralFlashLane?.supportCap || 0)} PT)
                            </div>
                          </>
                        ) : null}
                        {leverageRouteActive && !hedgeFocusActive ? <div>Hedge cash after posted margin: {formatNotional(routeDisplayAvailableCash)} PT</div> : null}
                        {leverageRouteActive ? <div>Current slider range: 0 - {formatNotional(tradeAmountSliderMax)} PT</div> : null}
                        {!hedgeFocusActive ? (
                          <>
                            {leverageRouteActive ? <div>Wallet cash total: {formatNotional(availableCash)} PT</div> : null}
                            <div>Core paper cash: {formatNotional(fundingBreakdown.corePaperCash)} PT</div>
                            <div>Quest rewards: {formatNotional(fundingBreakdown.rewardCredit)} PT</div>
                            <div>Wealth receipt support: {formatNotional(fundingBreakdown.wealthReceiptSupport)} PT</div>
                            {leverageRouteActive ? <div>Initial margin posted: {formatNotional(routePostedBaseMarginCapital)} PT</div> : null}
                            {leverageRouteActive && routeFlashReserveCapital > 0 ? <div>Flash reserve posted: {formatNotional(routePostedFlashReserveCapital)} PT</div> : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className={`paper-inline-trade-amount-row ${leverageRouteActive && !hedgeFocusActive ? 'with-mode' : ''}`.trim()}>
                    {leverageRouteActive && !hedgeFocusActive ? (
                      <div className="paper-inline-trade-amount-control">
                        <button
                          type="button"
                          className={`ghost-btn compact paper-inline-quote-max ${tradeAmountMaxApplied ? 'active' : ''}`.trim()}
                          onClick={handleTradeAmountMax}
                        >
                          Max
                        </button>
                        <select value={tradeAmountMaxMode} onChange={(event) => handleTradeAmountMaxModeChange(event.target.value)}>
                          {tradeAmountMaxOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`ghost-btn compact paper-inline-quote-max ${tradeAmountMaxApplied ? 'active' : ''}`.trim()}
                        onClick={handleTradeAmountMax}
                      >
                        Max
                      </button>
                    )}
                    <input
                      ref={tradeAmountInputRef}
                      type="number"
                      min="0"
                      step="250"
                      value={tradeAmountInput}
                      onChange={(event) => handleTradeAmountInputChange(event.target.value)}
                      onBlur={handleTradeAmountBlur}
                    />
                  </div>
                  <div className="paper-inline-trade-amount-slider">
                    <div className="paper-inline-trade-amount-slider-head">
                      <span>{tradeAmountSliderLabel}</span>
                      <strong>Suggested {formatNotional(tradeAmountSuggestedValue)} PT / max {formatNotional(tradeAmountSliderMax)} PT</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, tradeAmountSliderMax)}
                      step="0.01"
                      value={tradeAmountSliderValue}
                      onChange={(event) => handleTradeAmountSliderChange(event.target.value)}
                      disabled={tradeAmountSliderMax <= 0}
                    />
                    {tradeAmountSliderMax > 0 && tradeAmountSuggestedValue > 0 ? (
                      <div className="paper-range-suggestion-row">
                        <span className="paper-range-suggestion-marker" style={{ left: `${tradeAmountSuggestedPercent}%` }} />
                        <span>Suggested {formatNotional(tradeAmountSuggestedValue)} PT</span>
                      </div>
                    ) : null}
                    {leverageRouteActive ? (
                      <div className="paper-inline-trade-amount-zone-bar" aria-hidden="true">
                        {displayWalletSegmentPercent > 0 ? (
                          <div className="paper-inline-trade-amount-zone wallet" style={{ width: `${displayWalletSegmentPercent}%` }}>
                            {hedgeFocusActive ? 'Wallet ticket' : 'Wallet-backed'}
                          </div>
                        ) : null}
                        {displayAttestedSegmentPercent > 0 ? (
                          <div className="paper-inline-trade-amount-zone ticket" style={{ width: `${displayAttestedSegmentPercent}%` }}>
                            {hedgeFocusActive ? 'Loan cap' : 'Attested flash'}
                          </div>
                        ) : null}
                        {displayBroadSegmentPercent > 0 ? (
                          <div className="paper-inline-trade-amount-zone venue" style={{ width: `${displayBroadSegmentPercent}%` }}>
                            {hedgeFocusActive ? 'Extra loan' : 'Broad flash'}
                          </div>
                        ) : null}
                        {displayUncoveredSegmentPercent > 0 ? (
                          <div className="paper-inline-trade-amount-zone uncovered" style={{ width: `${displayUncoveredSegmentPercent}%` }}>
                            Uncovered {formatNotional(hedgeFullCoverageFundingGap)} PT
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {hedgeFocusActive && hedgeFullCoverageFundingGap > 0 ? (
                      <div className="paper-inline-trade-amount-slider-copy">
                        Max protectable hedge is {formatPercent(hedgeMaxFundableRatio, 0)} of principal. The remaining {formatNotional(hedgeFullCoverageFundingGap)} PT cannot be covered without lowering principal or adding capacity.
                      </div>
                    ) : null}
                    {hedgeFocusActive ? (
                      <div className="paper-inline-hedge-ticket-tools">
                        <div className="paper-inline-hedge-tool-caption">
                          <span>Hedge size = % of principal</span>
                          <strong>
                            {hedgeSizingReady
                              ? hedgeFullCoverageFundingGap > 0
                                ? `Max ${formatPercent(hedgeMaxFundableRatio, 0)} = ${formatNotional(tradeAmountSliderMax)} PT; ${formatNotional(hedgeFullCoverageFundingGap)} PT uncovered`
                                : `${formatNotional(hedgeFundableSuggestedNotional)} PT ticket / ${formatPercent(hedgeProtectionTargetRatio, 0)} est. protection`
                              : 'Set principal first'}
                          </strong>
                        </div>
                        <div className="paper-inline-structure-strip paper-inline-structure-strip-compact paper-inline-holding-presets paper-inline-hedge-ratio-strip">
                          {hedgeRatioOptions.map((ratio) => (
                            <button
                              key={ratio}
                              type="button"
                              className={`ghost-btn compact ${Math.abs(Number(hedgeRatio || 0) - ratio) <= 0.005 ? 'active-toggle' : ''}`}
                              onClick={() => handleHedgeRatioPreset(ratio)}
                            >
                              {hedgeNeedsCustomMaxRatio && Math.abs(ratio - hedgeMaxFundableRatio) <= 0.005
                                ? `Max ${formatPercent(ratio, 0)}`
                                : `${Math.round(ratio * 100)}%`}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="ghost-btn compact"
                            onClick={handleApplyHedgeSuggestedSize}
                            disabled={!hedgeSizingReady || hedgeFundableSuggestedNotional <= 0}
                          >
                            Use suggested
                          </button>
                        </div>
                        <div className="paper-inline-hedge-type-row">
                          <div className="paper-inline-hedge-type-hint paper-inline-hedge-type-static">
                            <strong>{hedgeTypeToolLabel}</strong>
                            <span>
                              Auto hedge: {effectiveHedgeTypeOption?.shortLabel || effectiveHedgeTypeOption?.label || 'Product default'}.
                              {' '}
                              {effectiveHedgeTypeOption?.hint || effectiveHedgeTypeOption?.copy}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="paper-inline-trade-amount-presets">
                        <button type="button" className="ghost-btn compact" onClick={handleApplySuggestedTradeAmount}>
                          Suggested
                        </button>
                        <button type="button" className="ghost-btn compact" onClick={() => handleTradeAmountPreset(0.25)}>
                          1/4 size
                        </button>
                        <button type="button" className="ghost-btn compact" onClick={() => handleTradeAmountPreset(0.5)}>
                          Half size
                        </button>
                      </div>
                    )}
                  </div>
                  {leverageRouteActive && flashLoanAppliedTicketNotional > 0 ? (
                    <div className="paper-inline-note-box paper-inline-route-capacity-note paper-inline-route-capacity-note-applied">
                      Flash stack: {flashLoanAppliedSummaryLabel}. Premium est. <strong className="risk-high">-{formatNotional(flashLoanPremiumEstimate)} PT</strong>. Extra opening reserve posted <strong className="risk-high">-{formatNotional(routeFlashReserveCapital)} PT</strong>. Flash notional stays route-bound instead of becoming spendable paper cash, and the reserve stays posted while the route is staged.
                      <button type="button" className="ghost-btn compact" onClick={handleClearFlashLoanQuote}>
                        Remove
                      </button>
                    </div>
                  ) : null}
                </label>
                ) : (
                  <div className="paper-inline-action-card paper-inline-action-card-compact paper-strategy-ai-route-summary">
                    <div className="paper-inline-action-head">
                      <div>
                        <div className="k">AI template result</div>
                        <div className="muted">
                          Uses {OPTION_STRATEGY_LABELS[selectedStrategyTemplateId] || 'the selected strategy'} on the current replay example.
                        </div>
                      </div>
                      <span className={`pill ${strategyAiTemplate.templateScore >= 70 ? 'risk-low' : 'risk-medium'}`}>
                        {Math.round(strategyAiTemplate.templateScore)}/100
                      </span>
                    </div>
                    <div className="paper-strategy-ai-metric-grid paper-strategy-ai-result-list">
                      <div>
                        <span>Paper win rate</span>
                        <strong>{strategyAiTemplate.winRate}%</strong>
                      </div>
                      <div>
                        <span>Expected return</span>
                        <strong className={strategyAiTemplate.expectedReturnPct >= 0 ? 'risk-low' : 'risk-high'}>
                          {formatSignedPercent(strategyAiTemplate.expectedReturnPct, 1)}
                        </strong>
                      </div>
                      <div>
                        <span>Max drawdown</span>
                        <strong className="risk-high">-{strategyAiTemplate.maxDrawdownPct.toFixed(1)}%</strong>
                      </div>
                      <div>
                        <span>Template score</span>
                        <strong>{Math.round(strategyAiTemplate.templateScore)}/100</strong>
                      </div>
                    </div>
                  </div>
                )}

                {strategyRouteActive ? (
                  <div className="paper-inline-action-card paper-inline-action-card-compact paper-strategy-control-card">
                    <div className="paper-inline-action-head">
                      <div>
                        <div className="k">Strategy controls</div>
                        <div className="muted">
                          {OPTION_STRATEGY_LABELS[selectedStrategyTemplateId] || 'Strategy'} uses the current historical window, then settles by holding period.
                        </div>
                      </div>
                      <div className="paper-inline-action-head-tools">
                        <button type="button" className="ghost-btn compact" onClick={handleApplySuggestedStrategyControls}>
                          Suggested
                        </button>
                        <span className={`pill ${optionStrategyPreview?.netPnl >= 0 ? 'risk-low' : 'risk-high'}`}>
                          {optionStrategyPreview ? `${formatSigned(optionStrategyPreview.netPnl)} PT` : 'No payoff yet'}
                        </span>
                      </div>
                    </div>
                    <div className="paper-strategy-parameter-grid">
                      <label className="paper-strategy-parameter-field">
                        <span>{strategyParameterLabels.downside}</span>
                        <strong>-{strategyControlValues.downsidePct.toFixed(0)}%</strong>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          step="1"
                          value={strategyControlValues.downsidePct}
                          onChange={(event) => setStrategyDownsidePct(Number(event.target.value))}
                        />
                      </label>
                      <label className="paper-strategy-parameter-field">
                        <span>{strategyParameterLabels.harvest}</span>
                        <strong>{strategyControlValues.profitHarvestPct.toFixed(0)}%</strong>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={strategyControlValues.profitHarvestPct}
                          onChange={(event) => setStrategyProfitHarvestPct(Number(event.target.value))}
                        />
                      </label>
                      <label className="paper-strategy-parameter-field">
                        <span>{strategyParameterLabels.cap}</span>
                        <strong>+{strategyControlValues.upsideCapPct.toFixed(0)}%</strong>
                        <input
                          type="range"
                          min="1"
                          max="60"
                          step="1"
                          value={strategyControlValues.upsideCapPct}
                          onChange={(event) => setStrategyUpsideCapPct(Number(event.target.value))}
                        />
                      </label>
                      <label className="paper-strategy-parameter-field">
                        <span>{strategyParameterLabels.premium}</span>
                        <strong>{strategyControlValues.premiumPct.toFixed(1)}%</strong>
                        <input
                          type="range"
                          min="0"
                          max="15"
                          step="0.1"
                          value={strategyControlValues.premiumPct}
                          onChange={(event) => setStrategyPremiumPct(Number(event.target.value))}
                        />
                      </label>
                      <label className="paper-strategy-parameter-field">
                        <span>{strategyParameterLabels.strike}</span>
                        <strong>+{strategyControlValues.strikePct.toFixed(0)}%</strong>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          step="1"
                          value={strategyControlValues.strikePct}
                          onChange={(event) => setStrategyStrikePct(Number(event.target.value))}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                {!hedgeFocusActive && !strategyAiRouteActive ? (
                  <div
                    className={`paper-inline-action-card paper-inline-action-card-compact paper-inline-timed-exit-card ${
                      timedExitReady ? 'ready' : 'locked'
                    } ${hedgeFocusActive && !activePerpLeg ? 'paper-inline-hedge-unwind-card' : ''}`.trim()}
                  >
                  <div className="paper-inline-action-head">
                    <div className="k">{timedExitCardTitle}</div>
                    <span className={`pill ${timedExitStatus.tone}`}>
                      {timedExitStatus.label}
                    </span>
                  </div>
                  {hedgeFocusActive && !activePerpLeg ? (
                    <>
                      {timedExitRangeToast ? <div className="paper-inline-toast paper-inline-toast-inline">{timedExitRangeToast}</div> : null}
                      <div className="paper-inline-hedge-unwind-row">
                        <span>Unwind window</span>
                        <div className="paper-inline-structure-strip paper-inline-structure-strip-compact paper-inline-holding-presets">
                          {timedExitPresetDays.map((days) => (
                            <button
                              key={days}
                              type="button"
                              className={`ghost-btn compact ${simulationHoldingDays === days ? 'active-toggle' : ''}`}
                              onClick={() => updateSimulationHoldingDays(days, { showToast: false })}
                            >
                              {formatHoldingPresetLabel(days)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="paper-inline-muted-help">
                        Open the protective hedge first; the full close preview appears after a live hedge leg exists.
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="wealth-field paper-inline-desk-field compact">
                        {timedExitHoldingLabel}
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={simulationHoldingDaysInput}
                          onChange={(event) => handleSimulationHoldingDaysInputChange(event.target.value)}
                          onBlur={handleSimulationHoldingDaysBlur}
                        />
                      </label>
                      {timedExitRangeToast ? <div className="paper-inline-toast paper-inline-toast-inline">{timedExitRangeToast}</div> : null}
                      <div className="paper-inline-muted-help">
                        Use the floating auto-sell timeline for the shared slider, 7D / 14D / 30D presets, and multi-position estimates.
                      </div>
                      <div className="paper-inline-action-metric-grid">
                        <div className="paper-inline-action-metric">
                          <span>Entry anchor</span>
                          <strong>{formatReplayDate(timedExitAnchorBar?.ts, selectedView?.interval)}</strong>
                        </div>
                        <div className="paper-inline-action-metric">
                          <span>{timedExitTargetLabel}</span>
                          <strong>{formatReplayDate(timedExitTargetBar?.ts, selectedView?.interval)}</strong>
                        </div>
                        <div className="paper-inline-action-metric">
                          <span>{timedExitSizeLabel}</span>
                          <strong>
                            {selectedAdvancedRoute === 'borrow' && optionStrategyPreview
                              ? `${formatNotional(optionStrategyPreview.notional)} PT`
                              : leverageRouteActive && timedExitLeveragedSnapshot
                              ? `${formatNotional(timedExitLeveragedSnapshot.exposureNotional)} PT`
                              : `${formatUnits(selectedPosition.units)} units`}
                          </strong>
                        </div>
                        <div className="paper-inline-action-metric">
                          <span>Est. take-home</span>
                          <strong className={(selectedAdvancedRoute === 'borrow' && optionStrategyPreview ? optionStrategyPreview.netPnl : timedExitEstimatedPnl) >= 0 ? 'risk-low' : 'risk-high'}>
                            {formatSigned(selectedAdvancedRoute === 'borrow' && optionStrategyPreview ? optionStrategyPreview.netPnl : timedExitEstimatedPnl)} PT
                          </strong>
                        </div>
                      </div>
                      <div className="paper-inline-action-row paper-inline-action-row-stacked paper-inline-action-row-inline paper-inline-action-row-popover-host">
                        <button
                          type="button"
                          className="ghost-btn compact paper-inline-action-button"
                          onClick={
                            selectedAdvancedRoute === 'borrow'
                              ? handleSettleOptionStrategy
                              : () => {
                                  setAutoSellPreviewProductId(selectedProductId);
                                  setAutoSellTargetProductId(selectedProductId);
                                  setAutoSellPreviewOpen(true);
                                }
                          }
                          disabled={!timedExitReady}
                        >
                          {timedExitActionLabel}
                        </button>
                        <div className="paper-inline-help-pill paper-inline-help-pill-left paper-inline-help-pill-wide paper-inline-help-pill-anchor-row">
                          <span>What happens?</span>
                          <div className="paper-inline-cash-tooltip paper-inline-cash-tooltip-row">
                            {selectedAdvancedRoute === 'borrow' && optionStrategyPreview
                              ? `${optionStrategyPreview.copy} Settlement uses the selected holding period and writes ${formatSigned(optionStrategyPreview.netPnl)} PT into the paper ledger.`
                              : timedExitSummary}
                          </div>
                        </div>
                        {timedExitLosingRows.length ? (
                          <div className="paper-inline-help-pill paper-inline-help-pill-left paper-inline-help-pill-wide paper-inline-help-pill-warning paper-inline-help-pill-anchor-row">
                            <span>Why I'm losing?</span>
                            <div className="paper-inline-cash-tooltip paper-inline-tooltip-list paper-inline-cash-tooltip-row">
                              {timedExitLosingRows.map((line) => (
                                <div key={line} className="paper-inline-tooltip-bullet">
                                  <span className="paper-inline-tooltip-dot" />
                                  <span>{line}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                  </div>
                ) : null}
              </div>

            </div>
          </div>

          <div className="paper-inline-preview-panel paper-inline-trade-panel">
            {comboFocusActive ? (
              <div className="paper-inline-action-card paper-inline-action-card-compact paper-combo-side-note">
                <div className="paper-inline-action-head">
                  <div>
                    <div className="k">Combo lab moved</div>
                    <div className="muted">
                      Allocation, cached results, suggestions, and the combo leaderboard now sit inside the Replay desk so this rail no longer shows a hedge ticket.
                    </div>
                  </div>
                  <span className="pill risk-low">Desk first</span>
                </div>
              </div>
            ) : null}

            {hedgeFocusActive ? (
              <div className={`paper-inline-action-card paper-inline-action-card-compact paper-inline-hedge-compact-card ${hedgeSizingReady ? 'ready' : 'locked'}`.trim()}>
                <div className="paper-inline-action-head">
                  <div>
                    <div className="k">Protect this sleeve</div>
                    <div className="muted">
                      {hedgeFormulaCopy}
                    </div>
                  </div>
                  <span className={`pill ${hedgeStatusTone || 'risk-medium'}`}>{hedgeStatus}</span>
                </div>
                {hedgeSizingReady ? (
                  <>
                    <div className="paper-inline-hedge-summary-strip">
                      {hedgeSummaryRows.map((row) => (
                        <div key={row.label} className="paper-inline-hedge-summary-cell">
                          <span>{row.label}</span>
                          <strong className={row.tone || ''}>{row.value}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="paper-inline-hedge-progress paper-inline-hedge-progress-compact">
                      <div className="paper-inline-hedge-progress-head">
                        <span>Exposure bar</span>
                        <strong>{formatNotional(hedgeDisplayedResidualExposureValue)} PT net sleeve left</strong>
                      </div>
                      <div className="paper-inline-hedge-progress-bar" aria-hidden="true">
                        <div className="paper-inline-hedge-progress-track" />
                        <div className="paper-inline-hedge-progress-fill suggested" style={{ width: `${hedgeExposureSuggestedPct}%` }} />
                        <div className="paper-inline-hedge-progress-fill current" style={{ width: `${hedgeExposureCurrentPct}%` }} />
                      </div>
                      <div className="paper-inline-hedge-progress-legend">
                        <span><i className="suggested" />Suggested hedge</span>
                        <span><i className="current" />Staged / live hedge</span>
                      </div>
                    </div>
                    <div className="paper-inline-support-list compact paper-inline-hedge-risk-list">
                      {hedgeRiskRows.map((row) => (
                        <div key={row.label} className="paper-inline-support-row">
                          <span>{row.label}</span>
                          <strong className={row.tone || ''}>{row.value}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="paper-inline-note-box paper-inline-route-capacity-note">
                    Pick an anchor bar and set principal notional. Then this card will show hedge ticket, protection estimate, flash top-up, net sleeve left, and status in one place.
                  </div>
                )}
              </div>
            ) : null}

            {strategyRouteActive && optionStrategyPreview ? (
              <div className="paper-inline-action-card paper-inline-action-card-compact paper-inline-option-preview-card">
                <div className="paper-inline-action-head">
                  <div>
                    <div className="k">{optionStrategyPreview.title}</div>
                    <div className="muted">{optionStrategyPreview.copy}</div>
                  </div>
                </div>
                {optionStrategyPreview.nodes?.length ? (
                  <div className="paper-strategy-node-grid">
                    {optionStrategyPreview.nodes.slice(0, 3).map((node) => (
                      <div key={`${node.label}-${node.value}`} className="paper-strategy-node-card">
                        <span>{node.label}</span>
                        <strong>{node.value}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="paper-inline-hedge-summary-strip">
                  {optionStrategyPreview.rows
                    .filter((row) => ['Historical move', 'Strategy payoff', 'Max upside', 'Max downside'].includes(row.label))
                    .map((row) => (
                    <div key={row.label} className="paper-inline-hedge-summary-cell">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="paper-inline-note-box paper-inline-route-capacity-note paper-inline-option-leg-summary">
                  {optionStrategyPreview.legs.slice(0, 3).join(' / ')}
                </div>
              </div>
            ) : null}

            {strategyAiRouteActive ? (
              <div className="paper-inline-action-card paper-inline-action-card-compact paper-strategy-ai-card">
                <div className="paper-inline-action-head">
                  <div>
                    <div className="k">AI strategy template</div>
                    <div className="muted">
                      Type a strategy idea; the local AI template offers five variants, marks feature points, and turns one choice into board-ready paper metrics.
                    </div>
                  </div>
                  <span className={`pill ${strategyAiTemplateGenerated || progressState.strategyAiTemplateCompleted ? 'risk-low' : 'risk-medium'}`}>
                    {strategyAiTemplateGenerated || progressState.strategyAiTemplateCompleted ? 'Generated' : 'Draft'}
                  </span>
                </div>

                <label className="paper-strategy-ai-input">
                  <span>Strategy idea</span>
                  <textarea
                    value={strategyAiPrompt}
                    rows={3}
                    onChange={(event) => {
                      setStrategyAiPrompt(event.target.value);
                      setStrategyAiTemplateGenerated(false);
                    }}
                  />
                </label>

                <div className="paper-strategy-ai-template-grid">
                  {strategyAiTemplateOptions.map((template) => (
                    <button
                      key={template.variantId}
                      type="button"
                      className={`paper-strategy-ai-template-card ${template.variantId === strategyAiTemplate.variantId ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedStrategyAiVariantId(template.variantId);
                        setStrategyAiTemplateGenerated(false);
                      }}
                    >
                      <span>{template.variantLabel}</span>
                      <strong>{template.winRate}% win</strong>
                      <small>
                        {formatSignedPercent(template.expectedReturnPct, 1)} / -{template.maxDrawdownPct.toFixed(1)}% DD
                      </small>
                    </button>
                  ))}
                </div>

                <div className="paper-strategy-ai-metric-grid paper-strategy-ai-result-list">
                  <div>
                    <span>Paper win rate</span>
                    <strong>{strategyAiTemplate.winRate}%</strong>
                  </div>
                  <div>
                    <span>Expected return</span>
                    <strong className={strategyAiTemplate.expectedReturnPct >= 0 ? 'risk-low' : 'risk-high'}>
                      {formatSignedPercent(strategyAiTemplate.expectedReturnPct, 1)}
                    </strong>
                  </div>
                  <div>
                    <span>Max drawdown</span>
                    <strong className="risk-high">-{strategyAiTemplate.maxDrawdownPct.toFixed(1)}%</strong>
                  </div>
                  <div>
                    <span>Template score</span>
                    <strong>{Math.round(strategyAiTemplate.templateScore)}/100</strong>
                  </div>
                </div>

                <div className="paper-strategy-ai-feature-grid">
                  {strategyAiTemplate.features.map((feature) => (
                    <div key={feature.id} className="paper-strategy-ai-feature-card">
                      <span>{feature.label}</span>
                      <strong>{feature.value}</strong>
                      <p>{feature.copy}</p>
                    </div>
                  ))}
                </div>

                <div className="paper-strategy-ai-actions">
                  <button type="button" className="ghost-btn compact" onClick={handleGenerateStrategyAiTemplate}>
                    Generate AI template
                  </button>
                  <button
                    type="button"
                    className="primary-btn compact"
                    onClick={handleUploadStrategyTemplate}
                    disabled={!strategyAiPrompt.trim()}
                  >
                    {strategyTemplateUploadedForCurrentPrompt ? 'Upload again' : 'Upload to strategy board'}
                  </button>
                </div>

                <div className="paper-strategy-board">
                  <div className="paper-strategy-board-head">
                    <span>Strategy / combo leaderboard</span>
                    <strong>{strategyTemplateLeaderboardRows.length} entr{strategyTemplateLeaderboardRows.length === 1 ? 'y' : 'ies'}</strong>
                  </div>
                  {strategyTemplateLeaderboardRows.length ? (
                    <div className="paper-strategy-board-list">
                    {strategyTemplateLeaderboardRows.slice(0, 4).map((entry, index) => (
                        <div
                          key={entry.id}
                          className="paper-strategy-board-row"
                          role="button"
                          tabIndex={0}
                          title="Copy this leaderboard entry to the strategy template board"
                          onClick={() => handleApplyStrategyTemplateLeaderboardEntry(entry)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleApplyStrategyTemplateLeaderboardEntry(entry);
                            }
                          }}
                        >
                          <div className="paper-strategy-board-rank">#{index + 1}</div>
                          <div className="paper-strategy-board-main">
                            <strong>
                              <span className="paper-strategy-board-type">
                                {entry.entryType === 'portfolio-combo' ? 'Combo' : 'AI'}
                              </span>
                              {entry.title}
                            </strong>
                            <span>
                              {entry.entryType === 'portfolio-combo'
                                ? `${entry.productLabel} / ${entry.dateRange || entry.strategyLabel}`
                                : `${entry.productLabel} / ${entry.variantLabel || entry.strategyLabel}`}
                            </span>
                          </div>
                          <div className="paper-strategy-board-metrics">
                            <span>{entry.winRate}% win</span>
                            <span>{formatSignedPercent(entry.expectedReturnPct, 1)} return</span>
                            <span>-{entry.maxDrawdownPct.toFixed(1)}% DD</span>
                            <span>{Math.round(entry.templateScore)}/100 score</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="paper-inline-note-box paper-inline-route-capacity-note">
                      No strategy or combo entries uploaded yet. Generate an AI template or upload a portfolio combo to rank by score, expected return, and drawdown.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {!comboFocusActive && !strategyAiRouteActive ? (
              <>
            <div className="paper-inline-desk-button-strip compact">
              <button
                type="button"
                className={primaryActionButtonClass}
                onClick={handlePrimaryRouteAction}
                disabled={selectedAdvancedRoute === 'perp' && isRiskSigning}
              >
                {primaryActionLabel}
              </button>
              <button
                type="button"
                className={secondaryActionButtonClass}
                onClick={handleSecondaryRouteAction}
                disabled={selectedAdvancedRoute === 'perp' && isRiskSigning}
              >
                {secondaryActionLabel}
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => handleReplayCursor(-1)}
                disabled={(selectedView?.cursor || 0) <= 0}
              >
                Prev
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => handleReplayCursor(1)}
                disabled={(selectedView?.cursor || 0) >= (selectedView?.bars?.length || 1) - 1}
              >
                Next
              </button>
              <button
                type="button"
                className={`primary-btn paper-inline-playback-btn ${isPlaying ? 'is-playing' : ''}`.trim()}
                onClick={handleToggleReplayPlayback}
                disabled={(selectedView?.cursor || 0) >= (selectedView?.bars?.length || 1) - 1}
                aria-pressed={isPlaying}
              >
                {isPlaying ? 'Pause replay' : 'Play replay'}
              </button>
            </div>

            {showAdvancedTools && selectedAdvancedRoute === 'perp' ? (
              <>
                <div className="paper-inline-structure-strip">
                  {(hedgeFocusActive ? [1, 2, 3, 5] : [1, 2, 3, 5, 10]).map((multiple) => (
                    <button
                      key={multiple}
                      type="button"
                      className={`ghost-btn compact ${contractLeverage === multiple ? 'active-toggle' : ''}`}
                      onClick={() => setContractLeverage(multiple)}
                    >
                      {multiple === 1 ? 'No leverage' : `${multiple}x leverage`}
                    </button>
                  ))}
                </div>
                {comboFocusActive ? (
                  <div className="wealth-inline-note paper-inline-note">
                    Combo mode is handled by the portfolio lab on the right. This ticket stays optional and does not size a separate hedge leg.
                  </div>
                ) : null}
              </>
            ) : null}

            {showAdvancedTools && selectedAdvancedRoute === 'borrow' ? (
              <div className="paper-inline-note-box paper-inline-route-capacity-note">
                Strategy route is template-first: pick the payoff above, then compare cap, floor, premium, breakeven, and leg drag before any option-chain controls.
              </div>
            ) : null}

            {!hedgeFocusActive ? (
              <div className="paper-inline-order-preview paper-inline-order-preview-compact">
                <div className="paper-inline-support-head">
                  <div className="paper-inline-support-head-row">
                    <div className="entry-title">Current replay ticket</div>
                    <div className="paper-inline-help-pill">
                      <span>Trade focus</span>
                      <div className="paper-inline-cash-tooltip">{focusedTradeModeCopy}</div>
                    </div>
                  </div>
                </div>
                <div className="paper-inline-support-list paper-inline-ticket-grid">
                  <div className="paper-inline-support-row">
                    <span>Trade date</span>
                    <strong>{focusedTradeDate}</strong>
                  </div>
                  <div className="paper-inline-support-row">
                    <span>{leverageRouteActive ? 'Entry mark' : 'Trade price'}</span>
                    <strong>{formatPrice(focusedTradePrice)}</strong>
                  </div>
                  <div className="paper-inline-support-row">
                    <span>{leverageRouteActive ? 'Position notional' : 'Ticket notional'}</span>
                    <strong>{currentTicketNotionalLabel}</strong>
                  </div>
                  <div className="paper-inline-support-row">
                    <span>{leverageRouteActive ? 'Posted / req. margin' : 'Estimated buy size'}</span>
                    <strong>{currentTicketSizeLabel}</strong>
                  </div>
                  <div className="paper-inline-support-row">
                    <span>{leverageRouteActive ? 'Open leg now' : 'Open position now'}</span>
                    <strong>{currentTicketOpenLabel}</strong>
                  </div>
                </div>
              </div>
            ) : null}

            {hedgeFocusActive ? null : (
              <div className="paper-chart-stat-grid paper-inline-chart-stats">
                <>
                  <div className="guide-chip">
                    <div className="k">Position at bar</div>
                    <div className="v">
                      {leverageRouteActive
                        ? activePerpLeg && replayFocusLeveragedSnapshot
                          ? `${replayFocusLeveragedSnapshot.direction} / ${formatNotional(replayFocusLeveragedSnapshot.exposureNotional)} PT`
                          : 'No leveraged leg'
                        : `${formatUnits(replayFocus.positionAtBar.units)} units`}
                    </div>
                  </div>
                  <div className="guide-chip">
                    <div className="k">
                      {useTimedExitSummary
                        ? leverageRouteActive
                          ? 'Auto-close take-home'
                          : selectedAdvancedRoute === 'borrow'
                            ? 'Strategy settle take-home'
                            : 'Auto-sell take-home'
                        : 'Trade exit value'}
                    </div>
                    <div className="v">
                      {formatNotional(
                        useTimedExitSummary
                          ? timedExitEstimatedValue
                          : leverageRouteActive
                            ? activePerpLeg
                              ? replayFocusLeveragedSnapshot?.netExitValue || 0
                              : 0
                            : selectedPosition.units > 0
                              ? selectedNetExitValue
                              : latestSelectedTrade?.side === 'sell'
                                ? roundNumber(
                                    Number(latestSelectedTrade.notional || 0) -
                                      Number(latestSelectedTrade.feeTotal || 0) -
                                      Number(latestSelectedTrade.taxTotal || 0) -
                                      Number(latestSelectedTrade.carryTotal || 0),
                                    2
                                  )
                                : replayFocus.snapshotAtBar.netExitValue
                      )} PT
                    </div>
                  </div>
                  <div className="guide-chip">
                    <div className="k">Trade realized PnL</div>
                    <div
                      className={`v ${
                        (leverageRouteActive
                          ? 0
                          : latestSelectedTrade?.side === 'sell'
                            ? roundNumber(Number(latestSelectedTrade.realizedPnl || 0), 2)
                            : 0) >= 0
                          ? 'risk-low'
                          : 'risk-high'
                      }`}
                    >
                      {formatSigned(
                        leverageRouteActive
                          ? 0
                          : latestSelectedTrade?.side === 'sell'
                            ? roundNumber(Number(latestSelectedTrade.realizedPnl || 0), 2)
                            : 0
                      )} PT
                    </div>
                  </div>
                  <div className="guide-chip">
                    <div className="k">
                      {useTimedExitSummary
                        ? leverageRouteActive
                          ? 'Auto-close est. PnL'
                          : selectedAdvancedRoute === 'borrow'
                            ? 'Strategy settle est. PnL'
                            : 'Auto-sell est. PnL'
                        : 'Trade net PnL'}
                    </div>
                    <div
                      className={`v ${
                        (useTimedExitSummary
                          ? timedExitEstimatedPnl
                          : leverageRouteActive
                            ? activePerpLeg
                              ? replayFocusLeveragedSnapshot?.netPnl || 0
                              : 0
                            : selectedPosition.units > 0
                              ? selectedNetPnl
                              : latestSelectedTrade?.side === 'sell'
                                ? roundNumber(Number(latestSelectedTrade.realizedPnl || 0), 2)
                                : 0) >= 0
                          ? 'risk-low'
                          : 'risk-high'
                      }`}
                    >
                      {formatSigned(
                        useTimedExitSummary
                          ? timedExitEstimatedPnl
                          : leverageRouteActive
                            ? activePerpLeg
                              ? replayFocusLeveragedSnapshot?.netPnl || 0
                              : 0
                            : selectedPosition.units > 0
                              ? selectedNetPnl
                              : latestSelectedTrade?.side === 'sell'
                                ? roundNumber(Number(latestSelectedTrade.realizedPnl || 0), 2)
                                : 0
                      )} PT
                    </div>
                  </div>
                </>
              </div>
            )}
              </>
            ) : null}
          </div>
        </div>

        <FlashLoanTicketConfirmModal
          open={flashLoanTicketConfirmOpen}
          product={selectedProduct}
          tradeAmount={Math.max(0, Number(tradeAmount || 0))}
          leverageLabel={routeLeverageMultiple === 1 ? 'No leverage' : `${routeLeverageMultiple}x leverage`}
          onClose={() => {
            setFlashLoanTicketConfirmOpen(false);
            setPendingPerpDirectionAfterQuote(null);
          }}
          onConfirm={handleFlashLoanPreview}
        />

        <FlashLoanQuoteModal
          open={flashLoanQuoteOpen}
          product={selectedProduct}
          baseNotional={routeBaseNotional}
          targetNotional={Math.max(Number(tradeAmount || 0), routeEffectiveTicketNotional)}
          maxBorrowNotional={flashLoanAttachableMaxNotional}
          freeReserveCash={routeMarginWalletFreeCashBeforeFlash}
          requiredMargin={routeRequiredMarginCapital}
          postedMargin={routeMarginCapital}
          marginShortfall={routeMarginShortfall}
          quoteRows={flashLoanQuoteRows}
          totalDraftNotional={flashLoanDraftTotalNotional}
          totalPremiumValue={flashLoanDraftPremiumEstimate}
          onQuoteChange={handleFlashLoanQuoteChange}
          onQuoteMax={handleFlashLoanQuoteMax}
          onClose={() => {
            setFlashLoanQuoteOpen(false);
            setPendingPerpDirectionAfterQuote(null);
          }}
          onClear={handleClearFlashLoanQuote}
          onConfirm={handleConfirmFlashLoanQuote}
        />

        {renderAutoSellTimelineDock()}

        <AutoSellPreviewModal
          open={autoSellPreviewOpen}
          product={autoSellPreviewProduct}
          anchorLabel={autoSellPreviewAnchorLabel}
          targetLabel={autoSellPreviewTargetLabel}
          sellUnits={autoSellPreviewSellUnits}
          sellSizeLabel={autoSellPreviewSellSizeLabel}
          holdingDays={autoSellPreviewHoldingDays}
          estimatedValue={autoSellPreviewEstimatedValue}
          estimatedPnl={autoSellPreviewEstimatedPnl}
          venueNotes={autoSellVenueNotes}
          closeMode={autoSellPreviewIsLeverage}
          onClose={() => {
            setAutoSellPreviewOpen(false);
            setAutoSellPreviewProductId('');
          }}
          onConfirm={() => {
            setAutoSellPreviewOpen(false);
            const productIdToSettle = autoSellPreviewResolvedProductId;
            setAutoSellPreviewProductId('');
            handleTimedExitReplay(productIdToSettle);
          }}
        />

        {selectedView?.error ? <div className="env-hint">{selectedView.error}</div> : null}
        {feedback ? <div className="env-hint">{feedback}</div> : null}
      </div>
    );
  }

  function renderReplayLeaderboardCard(compact = false) {
    const rows = compact ? topReplayAccountLeaderboardRows.slice(0, 4) : topReplayAccountLeaderboardRows;

    return (
      <div className={`paper-replay-leaderboard-card ${compact ? 'compact' : ''}`}>
        <div className="section-head">
          <div>
            <div className="eyebrow">收益排行榜</div>
            <h2>{compact ? 'Replay leaderboard' : 'Replay return leaderboard'}</h2>
          </div>
          {!compact ? <span className="pill risk-low">{rows.length} wallet{rows.length === 1 ? '' : 's'}</span> : null}
        </div>

        {!compact ? (
          <div className="paper-leaderboard-copy">
            Ranked by total replay return. Each wallet appears once using its best recorded result, and every confirmed local submission is merged into a device-local archive so other wallets stay on this board.
          </div>
        ) : null}

        <div className="paper-replay-leaderboard-list">
          {rows.length ? (
            rows.map((row, index) => (
              <div
                key={row.walletAddress}
                className={`paper-replay-leader-row ${address && row.walletAddress === address.toLowerCase() ? 'active' : ''}`}
              >
                <div className="paper-replay-leader-rank">#{index + 1}</div>
                <div className="paper-replay-leader-main">
                  <div className="paper-replay-leader-title">
                    <div className="paper-replay-leader-heading">
                      <strong>{row.displayAddress}</strong>
                      {row.status === 'pending' ? (
                        <span className="paper-replay-leader-badge pending">Pending</span>
                      ) : row.hallOfFame ? (
                        <span className="paper-replay-leader-badge">Hall of fame</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="paper-replay-leader-meta">
                    {formatReplayBadgeTimestamp(row.submittedAt)}
                    {row.tradeShortLabel ? ` / ${row.tradeShortLabel}` : ''}
                    {row.status === 'pending' ? ' / pending Sepolia confirmation' : ' / permanently saved on this device'}
                  </div>
                </div>
                <div className={`paper-replay-leader-gain ${row.pnlPercent >= 0 ? 'risk-low' : 'risk-high'}`}>
                  <div>{formatSignedPercent(row.pnlPercent)}</div>
                  <span>{formatSigned(row.netPnl)} PT</span>
                </div>
              </div>
            ))
          ) : (
            <div className="reason-card paper-empty-leaderboard">
              <div className="entry-title">No submitted replay scores yet</div>
              <div className="entry-copy">
                Finish one positive replay loop and submit the score on Sepolia to bring the leaderboard back to life.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderProductFloatingLeaderboard() {
    if (!filteredProducts.length) return null;

    if (productLeaderboardFloat.isCollapsed) {
      const collapsedStyle =
        productLeaderboardFloat.arrowSide === 'left'
          ? { top: `${productLeaderboardFloat.arrowTop}px`, left: '10px' }
          : { top: `${productLeaderboardFloat.arrowTop}px`, right: '10px' };

      return (
        <div
          className={`paper-floating-leaderboard-toggle ${productLeaderboardFloat.arrowSide}`}
          style={collapsedStyle}
          role="button"
          tabIndex={0}
          aria-label="Open product ranking"
          onPointerDown={beginProductLeaderboardArrowGesture}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            handleExpandProductLeaderboard();
          }}
        >
          <span>{productLeaderboardFloat.arrowSide === 'left' ? '>' : '<'}</span>
        </div>
      );
    }

    return (
      <aside
        className="paper-floating-leaderboard paper-floating-product-leaderboard"
        style={{
          left: `${productLeaderboardFloat.left}px`,
          top: `${productLeaderboardFloat.top}px`,
          width: `${productLeaderboardFloat.width}px`,
          height: `${productLeaderboardFloat.height}px`
        }}
      >
        <div className="paper-floating-product-leaderboard-head" onPointerDown={beginProductLeaderboardDrag}>
          <div>
            <div className="eyebrow">Product ranking</div>
            <h3>AI + earn leaderboard</h3>
          </div>
          <div className="paper-floating-product-leaderboard-tools">
            <span className="pill risk-low">{shelfLeaderboardRows.length} ranked</span>
            <button
              type="button"
              className="ghost-btn compact paper-floating-product-leaderboard-close"
              aria-label="Collapse product ranking"
              onClick={handleCollapseProductLeaderboard}
            >
              X
            </button>
          </div>
        </div>

        <div className="paper-floating-product-leaderboard-copy">
          Current rank blends AI diligence with net earn after annual drag. Risk stays visible on every row.
        </div>

        <div className="paper-floating-product-leaderboard-body">
          <div className="paper-shelf-leaderboard-list">
            {shelfLeaderboardRows.map((row, index) => (
              <button
                key={row.product.id}
                type="button"
                className={`paper-shelf-leaderboard-row ${selectedProductId === row.product.id ? 'active' : ''}`}
                onClick={() => handleSelectProduct(row.product.id)}
              >
                <div className="paper-shelf-leaderboard-rank">#{index + 1}</div>
                <div className="paper-shelf-leaderboard-main">
                  <div className="paper-shelf-leaderboard-heading">
                    <div className="paper-shelf-leaderboard-name">{row.product.name}</div>
                    <span className={`pill paper-shelf-risk-pill ${riskClass(row.product.risk)}`}>{row.product.risk} risk</span>
                  </div>
                  <div className="muted paper-shelf-leaderboard-meta">
                    {row.product.productType} / {row.product.ticker}
                  </div>
                  <div className="paper-shelf-leaderboard-score-row">
                    <span className="paper-shelf-score-chip">AI diligence {row.aiScore}</span>
                    <span className="paper-shelf-score-chip">Net earn {row.earnScore}</span>
                    <span className="paper-shelf-score-chip">Yield {formatPercent(row.earnRate, 1)}</span>
                  </div>
                </div>
                <div className="paper-shelf-leaderboard-total">
                  <strong>{row.combinedScore}</strong>
                  <span>Combined</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div
          className="paper-floating-product-leaderboard-resize"
          aria-hidden="true"
          onPointerDown={beginProductLeaderboardResize}
        />
      </aside>
    );
  }

  function renderLeaderboardScoreRouteCard() {
    return (
      <>
        <div className="mint-action-box inline-mint-action task-badge-mint-box paper-leaderboard-route-card" ref={leaderboardRouteRef}>
          <div>
            <div className="product-title">Leaderboard score route</div>
            <div className="muted">
              Replay score is now tied to the same PnL bridge used in the desk: cumulative realized PnL from closed sells plus current open net PnL from any remaining positions.
            </div>
            <div className="paper-reward-contract-meta">
              <div className="muted">Realized closed PnL: {formatSigned(totalRealizedPnl)} PT</div>
              <div className="muted">Open net PnL: {formatSigned(totalNetPnl)} PT</div>
              <div className="muted">Replay score: {formatSigned(replayScoreValue)} PT / {formatSignedPercent(replayScorePercent)}</div>
              <div className="muted">Strategy value: {formatNotional(strategyAccountValue)} PT</div>
              <div className="muted">Closed trades: {closedTradeCount}</div>
              <div className="muted">Daily submit usage: {scoreSubmissionsToday}/{REPLAY_SCORE_DAILY_LIMIT}</div>
              {scoreHash ? <div className="muted">Latest score tx: {scoreHash}</div> : null}
            </div>
          </div>
          <div className="mint-status-stack">
            <button
              className="primary-btn"
              onClick={handleSubmitReplayScore}
              disabled={!scoreReady || isScoreSubmitting || isScoreConfirming || scoreSubmissionSlotsLeft <= 0}
            >
              {isScoreSubmitting || isScoreConfirming
                ? 'Submitting score...'
                : scoreSubmissionSlotsLeft <= 0
                  ? 'Daily limit reached'
                  : 'Submit score on Sepolia'}
            </button>
          </div>
        </div>

        {scoreFeedback ? <div className="env-hint paper-claim-hint">{scoreFeedback}</div> : null}
      </>
    );
  }

  function renderPortfolioComboLab(className = 'paper-portfolio-combo-card') {
    if (!comboFocusActive) return null;

    return (
      <div className={className}>
        <div className="paper-portfolio-combo-head">
          <div>
            <div className="paper-shelf-learning-subhead">Portfolio combo lab</div>
            <div className="paper-portfolio-combo-copy">
              Build a diversified stock combo from the local daily replay series. Set the window, choose stocks, edit weights, then compare manual results with suggested allocations.
            </div>
          </div>
          <span className={`pill ${portfolioComboAnalysis.status === 'ready' ? 'risk-low' : 'risk-medium'}`}>
            {portfolioComboAnalysis.status === 'ready' ? `${portfolioComboAnalysis.dates.length} bars` : 'Loading'}
          </span>
        </div>

        <div className="paper-portfolio-combo-date-grid">
          <label>
            <span>Start date</span>
            <input
              type="date"
              value={portfolioComboStartDate}
              onChange={(event) => setPortfolioComboStartDate(event.target.value)}
            />
          </label>
          <label>
            <span>End date</span>
            <input
              type="date"
              value={portfolioComboEndDate}
              onChange={(event) => setPortfolioComboEndDate(event.target.value)}
            />
          </label>
        </div>

        <div className="paper-portfolio-combo-chip-grid">
          {portfolioComboCandidates.map((product) => {
            const active = portfolioComboSelectedIds.includes(product.id);
            const ready = Array.isArray(productViews[product.id]?.bars) && productViews[product.id].bars.length >= 2;

            return (
              <button
                key={product.id}
                type="button"
                className={`paper-portfolio-combo-chip ${active ? 'active' : ''}`}
                onClick={() => handleTogglePortfolioComboProduct(product.id)}
              >
                <strong>{product.ticker}</strong>
                <span>{ready ? 'ready' : 'loading'}</span>
              </button>
            );
          })}
        </div>

        <div className="paper-portfolio-combo-weight-grid">
          {portfolioComboSelectedIds.map((productId) => {
            const product = productMap[productId];
            const normalizedWeight = portfolioComboManualMetrics?.allocation?.find((row) => row.productId === productId)?.weightPct;

            return (
              <label key={productId}>
                <span>{product?.ticker || productId}</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={portfolioComboWeights[productId] ?? 0}
                  onChange={(event) => handlePortfolioComboWeightChange(productId, event.target.value)}
                />
                <small>{Number.isFinite(normalizedWeight) ? `${normalizedWeight.toFixed(1)}% normalized` : 'waiting for bars'}</small>
              </label>
            );
          })}
        </div>

        {portfolioComboResult.productResults?.length ? (
          <div className="paper-inline-note-box paper-inline-route-capacity-note">
            <strong>Result cache.</strong>{' '}
            {Number(portfolioComboResult.computedCount || 0)} recalculated / {Number(portfolioComboResult.reusedCount || 0)} reused for this window.
            {portfolioComboComparisonRows.length
              ? ` ${portfolioComboComparisonRows[0].ticker} changed ${formatSignedPercent(
                  Number(portfolioComboComparisonRows[0].comparison.deltaReturnPct || 0),
                  1
                )} versus its previous ${portfolioComboComparisonRows[0].comparison.reason === 'date-window' ? 'date window' : 'data refresh'}.`
              : ' Same product signatures reuse the saved result; only a changed product or window recalculates.'}
          </div>
        ) : null}

        {portfolioComboManualMetrics ? (
          <>
            <div className="paper-portfolio-combo-metric-grid">
              <div>
                <span>Manual return</span>
                <strong className={portfolioComboManualMetrics.totalReturnPct >= 0 ? 'risk-low' : 'risk-high'}>
                  {formatSignedPercent(portfolioComboManualMetrics.totalReturnPct, 1)}
                </strong>
              </div>
              <div>
                <span>Max drawdown</span>
                <strong className="risk-high">-{portfolioComboManualMetrics.maxDrawdownPct.toFixed(1)}%</strong>
              </div>
              <div>
                <span>Sharpe</span>
                <strong>{portfolioComboManualMetrics.sharpe.toFixed(2)}</strong>
              </div>
              <div>
                <span>Winning days</span>
                <strong>{portfolioComboManualMetrics.winRate.toFixed(1)}%</strong>
              </div>
            </div>
            <div className="paper-portfolio-combo-actions">
              <button type="button" className="ghost-btn compact" onClick={() => handleUploadPortfolioComboToStrategyBoard()}>
                Upload manual combo
              </button>
            </div>
          </>
        ) : (
          <div className="paper-inline-note-box paper-inline-route-capacity-note">
            {portfolioComboAnalysis.message || 'Select at least two products and wait for replay bars to load.'}
          </div>
        )}

        {portfolioComboAnalysis.suggestions.length ? (
          <div className="paper-portfolio-combo-suggestion-grid">
            {portfolioComboAnalysis.suggestions.map((suggestion) => {
              const metrics = suggestion.metrics;

              return (
                <div key={suggestion.id} className="paper-portfolio-combo-suggestion-card">
                  <div className="paper-portfolio-combo-suggestion-head">
                    <div>
                      <strong>{suggestion.label}</strong>
                      <span>{suggestion.copy}</span>
                    </div>
                    <span className="pill risk-low">{metrics.templateScore}/100</span>
                  </div>
                  <div className="paper-portfolio-combo-allocation">
                    {metrics.allocation.map((row) => (
                      <span key={`${suggestion.id}-${row.productId}`}>
                        {row.ticker} {row.weightPct.toFixed(0)}%
                      </span>
                    ))}
                  </div>
                  <div className="paper-portfolio-combo-mini-metrics">
                    <span>{formatSignedPercent(metrics.totalReturnPct, 1)} return</span>
                    <span>-{metrics.maxDrawdownPct.toFixed(1)}% DD</span>
                    <span>{metrics.sharpe.toFixed(2)} Sharpe</span>
                  </div>
                  <div className="paper-portfolio-combo-actions">
                    <button type="button" className="ghost-btn compact" onClick={() => handleApplyPortfolioComboSuggestion(suggestion)}>
                      Apply weights
                    </button>
                    <button type="button" className="primary-btn compact" onClick={() => handleUploadPortfolioComboToStrategyBoard(suggestion)}>
                      Upload
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="paper-strategy-board paper-strategy-board-combo">
          <div className="paper-strategy-board-head">
            <span>Combo / AI leaderboard</span>
            <strong>{strategyTemplateLeaderboardRows.length} entr{strategyTemplateLeaderboardRows.length === 1 ? 'y' : 'ies'}</strong>
          </div>
          {strategyTemplateLeaderboardRows.length ? (
            <div className="paper-strategy-board-list">
              {strategyTemplateLeaderboardRows.slice(0, 3).map((entry, index) => (
                <div
                  key={`combo-board-${entry.id}`}
                  className="paper-strategy-board-row"
                  role="button"
                  tabIndex={0}
                  title="Copy this leaderboard entry to combo or AI template controls"
                  onClick={() => handleApplyStrategyTemplateLeaderboardEntry(entry)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleApplyStrategyTemplateLeaderboardEntry(entry);
                    }
                  }}
                >
                  <div className="paper-strategy-board-rank">#{index + 1}</div>
                  <div className="paper-strategy-board-main">
                    <strong>
                      <span className="paper-strategy-board-type">
                        {entry.entryType === 'portfolio-combo' ? 'Combo' : 'AI'}
                      </span>
                      {entry.title}
                    </strong>
                    <span>
                      {entry.entryType === 'portfolio-combo'
                        ? `${entry.productLabel} / ${entry.dateRange || entry.strategyLabel}`
                        : `${entry.productLabel} / ${entry.variantLabel || entry.strategyLabel}`}
                    </span>
                  </div>
                  <div className="paper-strategy-board-metrics">
                    <span>{entry.winRate}% win</span>
                    <span>{formatSignedPercent(entry.expectedReturnPct, 1)} return</span>
                    <span>-{entry.maxDrawdownPct.toFixed(1)}% DD</span>
                    <span>{Math.round(entry.templateScore)}/100 score</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="paper-inline-note-box paper-inline-route-capacity-note">
              Upload a suggested combo or AI template to start the board.
            </div>
          )}
        </div>

        {portfolioComboAnalysis.topSingles.length ? (
          <div className="paper-portfolio-combo-single-strip">
            {portfolioComboAnalysis.topSingles.slice(0, 3).map((row) => (
              <div key={`single-${row.allocation[0]?.productId || row.label}`}>
                <span>{row.allocation[0]?.ticker || row.label}</span>
                <strong>{formatSignedPercent(row.totalReturnPct, 1)}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderShelfLearningCard() {
    return (
      <section className="paper-shelf-learning-card">
        <div className="paper-shelf-learning-head">
          <div>
            <div className="eyebrow">Tutorial path</div>
            <div className="paper-shelf-learning-title">
              {activeRouteFocusConfig?.panelTitle || selectedAdvancedRouteConfig.label}
            </div>
          </div>
          <span className="pill risk-low">{selectedRouteUi.actionTag}</span>
        </div>

        <div className="paper-shelf-learning-case-plan paper-shelf-learning-case-plan-sidebar">
          {(routeLearningStepRows.length
            ? routeLearningStepRows
            : routeGuideSteps.map((step) => ({
                label: step.number,
                title: step.title,
                copy: step.detail
              }))
          ).map((row) => (
            <div key={`${row.label}-${row.title}`} className="paper-shelf-learning-case-plan-row">
              <span>{row.label}</span>
              <div>
                <strong>{row.title}</strong>
                <p>{row.copy}</p>
              </div>
            </div>
          ))}
        </div>

        {hedgeFocusActive ? (
          <div className="paper-shelf-learning-hedge-block">
            <div className="paper-shelf-learning-hedge-head">
              <div className="paper-shelf-learning-subhead">Protective hedge formula</div>
              <div className="paper-shelf-learning-hedge-copy">
                {hedgeFormulaCopy}
              </div>
            </div>

            {hedgeSizingReady ? (
              <>
                <div className="paper-inline-hedge-summary-strip paper-inline-hedge-summary-strip-learning">
                  {hedgeSummaryRows.slice(0, 4).map((row) => (
                    <div key={row.label} className="paper-inline-hedge-summary-cell">
                      <span>{row.label}</span>
                      <strong className={row.tone || ''}>{row.value}</strong>
                    </div>
                  ))}
                </div>

                <details className="paper-shelf-learning-details">
                  <summary>
                    This is a {effectiveHedgeTypeOption?.shortLabel || 'Direct'} hedge. Details
                  </summary>
                  <div className="paper-inline-hedge-flow-grid">
                    {hedgeWorkflowCards.map((card) => (
                      <div key={card.step} className="paper-inline-hedge-flow-card">
                        <div className="paper-inline-hedge-step">{card.step}</div>
                        <div className="paper-inline-hedge-flow-copy">
                          <span>{card.title}</span>
                          <strong>{card.value}</strong>
                          <p>{card.copy}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="paper-inline-hedge-exposure-grid">
                    {hedgeExposureCards.map((card) => (
                      <div key={card.label} className="paper-inline-hedge-exposure-card">
                        <span>{card.label}</span>
                        <strong className={card.tone || ''}>{card.value}</strong>
                        <p>{card.copy}</p>
                      </div>
                    ))}
                  </div>
                  <div className="paper-inline-preview-grid paper-inline-hedge-setup-grid">
                    {hedgeSetupCards.map((card) => (
                      <div key={card.label} className="paper-inline-hedge-setup-card">
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                      </div>
                    ))}
                  </div>
                </details>
              </>
            ) : (
              <div className="paper-inline-note-box paper-inline-route-capacity-note">
                Lock a replay bar first. Then set the protected sleeve amount separately from the hedge ticket so the route can show before / after / residual exposure in one screen.
              </div>
            )}
          </div>
        ) : null}

        <div className="paper-shelf-learning-costs">
          <div className="paper-shelf-learning-subhead">
            {hedgeFocusActive ? 'Fees to auto-unwind' : leverageRouteActive ? 'Fees to auto-close' : 'Fees to auto-sell'}
          </div>
          {routeLearningFeeRows.map((row) => (
            <div key={row.label} className="paper-shelf-learning-cost-row">
              <div>
                <div className="paper-shelf-learning-cost-label">{row.label}</div>
                <div className="paper-shelf-learning-cost-copy">{row.copy}</div>
              </div>
              <strong className={row.isCost || row.value < 0 ? 'risk-high' : ''}>
                {row.isCost ? `-${formatNotional(row.value)} PT` : formatSigned(row.value)}
              </strong>
            </div>
          ))}
        </div>

        <div className="paper-shelf-learning-note">{routeLearningSummaryCopy}</div>
      </section>
    );
  }

  return (
    <div className="app-shell paper-trading-shell">
      <div className="noise"></div>
      <header className="site-header">
        <div className="brand-wrap">
          <div className="brand-dot"></div>
          <div>
            <div className="eyebrow">RiskLens Guided Investing Hub</div>
            <div className="brand-name">{t('RiskLens Paper Trading Replay Lab', 'RiskLens 模拟交易回放实验室')}</div>
          </div>
        </div>

        <div className="wealth-header-language-center">
          <LanguageToggle uiLanguage={uiLanguage} setUiLanguage={setUiLanguage} compact />
        </div>

        <div className="header-actions" ref={walletAnchorRef}>
          <a className="ghost-btn compact" href="./index.html#paperTrading">
            {t('Back to welcome', '返回主页')}
          </a>

          <div className="paper-token-pill">
            <div className="paper-token-label">{t('Remaining paper tokens', '剩余模拟代币')}</div>
            <div className="paper-token-value">{formatNotional(remainingPaperTokens)} PT</div>
            <div className="paper-token-tooltip">
              <div className="paper-token-tooltip-title">{t('How buying power works', '购买力说明')}</div>
              <div>
                {t(
                  `Core paper cash starts at ${STARTING_PAPER_TOKENS.toLocaleString()} PT. Each completed onboarding milestone adds ${BADGE_REWARD_TOKENS.toLocaleString()} PT of replay credit.`,
                  `基础模拟资金从 ${STARTING_PAPER_TOKENS.toLocaleString()} PT 开始，每完成一个 onboarding 里程碑会增加 ${BADGE_REWARD_TOKENS.toLocaleString()} PT 的回放额度。`
                )}
              </div>
              <div>
                Unified wallet memory: policy {walletProfileSummary.availablePT.toLocaleString()} PT,
                remaining {walletProfileSummary.remainingPT.toLocaleString()} PT,
                paper cash {walletProfileSummary.paperCash.toLocaleString()} PT,
                wealth cash {walletProfileSummary.wealthCash.toLocaleString()} PT.
              </div>
            </div>
          </div>

          {isConnected ? (
            <button type="button" className="ghost-btn wallet-header-btn connected" onClick={openWalletModal}>
              {t(`Wallet connected ${walletDisplayName}`, `钱包已连接 ${walletDisplayName}`)}
            </button>
          ) : (
            <button type="button" className="ghost-btn wallet-header-btn" onClick={openWalletModal} disabled={isPending}>
              {isPending ? t('Connecting to MetaMask...', '正在连接 MetaMask...') : t('Connect MetaMask', '连接 MetaMask')}
            </button>
          )}

          <div className="header-admin-row">
            <button type="button" className="ghost-btn compact" onClick={openDeveloperMode}>
              {t('Developer mode', '开发者模式')}
            </button>
          </div>
        </div>
      </header>

      <div className="demo-only-banner">
        <strong>Demo only.</strong> Receipt balances, PT cash, subscriptions, pledges, and settlement actions on this page stay in local demo or testnet-style state. No real stablecoin or live-fund transfer happens here.
      </div>

      <main>
        <section className="card wealth-hero-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t('Replay-first paper trading', '回放优先的模拟交易')}</div>
              <h1 style={{ maxWidth: 1020 }}>{t('Practice RiskLens-style product decisions against historical replay bars before any live action.', '在任何真实操作之前，先用历史回放练习 RiskLens 风格的产品决策。')}</h1>
            </div>

            <button className="ghost-btn compact" onClick={handleResetLab}>
              {t('Reset replay lab', '重置回放实验室')}
            </button>
          </div>

          <p className="hero-text">
            {t(
              'This version turns paper trading into an explainable replay lab. You can compare RiskLens starter RWAs, common crypto assets, and perp tutorials inside one wallet-linked simulation surface, then step through history bar by bar to see what your decision would have done next.',
              '这个版本把模拟交易做成了一个可解释的回放实验室。你可以在同一个绑定钱包的模拟界面里，对比 RiskLens 入门 RWA、常见加密资产以及永续合约教学，然后逐根回放历史 K 线，看看你的决策接下来会发生什么。'
            )}
          </p>

          <div className="hero-points">
            <span className="pill risk-low">{t('Historical replay', '历史回放')}</span>
            <span className="pill risk-low">{t('Wallet-linked ledger', '钱包绑定账本')}</span>
            <span className="pill risk-medium">{t('RiskLens vs CEX comparison', 'RiskLens 与 CEX 对比')}</span>
            <span className="pill risk-medium">{t('Human / protocol explainers', '人话 / 协议解释')}</span>
          </div>

            <div className="wealth-summary-grid">
              <div className="wealth-summary-block">
                <div className="label">{t('Estimated account value', '预估账户价值')}</div>
                <div className="wealth-summary-value">{formatNotional(displayEstimatedAccountValue)} PT</div>
                <div className="muted">{t('Available cash plus estimated net exit value after carry drag, fees, and tax holdback.', '可用现金加上扣除持有成本、手续费和预估税费后的净退出价值。')}</div>
                <div className="muted">
                  {t(
                    `Wallet record keeps ${formatNotional(remainingPaperTokens)} PT remaining. Gross open PnL ${formatSigned(displayGrossOpenPnl)} PT. Net open PnL ${formatSigned(displayNetOpenPnl)} PT.`,
                    `钱包记录当前剩余 ${formatNotional(remainingPaperTokens)} PT；未实现毛收益 ${formatSigned(displayGrossOpenPnl)} PT；未实现净收益 ${formatSigned(displayNetOpenPnl)} PT。`
                  )}
                </div>
                {linkedWalletCash > 0 || useTimedExitSummary ? (
                  <div className="muted">
                    {[
                      linkedWalletCash > 0 ? `Linked wallet cash ${formatNotional(linkedWalletCash)} PT included.` : null,
                      useTimedExitSummary ? 'Focused auto-sell preview is applied here.' : null
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </div>
                ) : null}
              </div>

              <div className="wealth-summary-block">
                <div className="label">{t('Gross open PnL', '未实现毛收益')}</div>
                <div className={`wealth-summary-value ${displayGrossOpenPnl >= 0 ? 'risk-low' : 'risk-high'}`}>
                  {formatSigned(displayGrossOpenPnl)} PT
                </div>
                <div className="muted">{t('Pure price move before carry drag, fees, and estimated tax.', '仅看价格变化，不含持有成本、手续费和预估税费。')}</div>
              </div>

              <div className="wealth-summary-block">
                <div className="label">{t('Net open PnL', '未实现净收益')}</div>
                <div className={`wealth-summary-value ${displayNetOpenPnl >= 0 ? 'risk-low' : 'risk-high'}`}>
                  {formatSigned(displayNetOpenPnl)} PT
                </div>
                <div className="muted">{t('Estimated net value if every open position exited at the current replay cursor.', '如果所有持仓都在当前回放位置卖出后的预估净值。')}</div>
              </div>
          </div>
        </section>

        <section className="card">
          {renderReplayLeaderboardCard(false)}
          {renderLeaderboardScoreRouteCard()}
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t('Replay quests', '回放任务')}</div>
              <h2>{t('Home-page onboarding is inherited by wallet, then replay starts from its own task ladder.', '主页 onboarding 会由钱包继承，之后回放模式再走自己的任务阶梯。')}</h2>
            </div>
            <span className="pill risk-low">{unlockedReplayAchievementCount}/{replayAchievements.length} unlocked</span>
          </div>

          <div className="env-hint" style={{ marginBottom: 18 }}>
            <strong>{t('How this works.', '说明。')}</strong> {t('Users only need to connect the same wallet, finish the local replay condition, switch MetaMask to Sepolia, and press the claim button. If replay badges are still offline, no code is required from the user; the project owner simply has not connected the replay badge contract yet.', '用户只需要连接同一个钱包、完成本地回放条件、把 MetaMask 切到 Sepolia，然后点击领取按钮。如果回放徽章路线仍未上线，也不需要用户写代码，只是项目方还没有把 replay badge contract 接进来。')}
          </div>

          <div className="paper-balance-strip wealth-balance-strip">
            <div className="paper-balance-box">
              <div className="label">Unlocked tasks</div>
              <div className="value">{unlockedReplayAchievementCount}</div>
            </div>
            <div className="paper-balance-box">
              <div className="label">Claim-ready</div>
              <div className="value">{claimReadyReplayAchievementCount}</div>
            </div>
            <div className="paper-balance-box">
              <div className="label">Claimed onchain</div>
              <div className="value">{claimedReplayAchievementCount}</div>
            </div>
              <div className="paper-balance-box">
                <div className="label">Onchain anchor</div>
                <div className="value">
                  {replayBadgeContractConfigured ? shortAddress(REPLAY_BADGE_CONTRACT_ADDRESS) : 'Set env var'}
                </div>
                <div className="muted">
                  {nextReplayAchievement ? `Next replay task: ${nextReplayAchievement.title}` : 'All local replay tasks are complete.'}
                </div>
              </div>
            </div>

          <div className="learn-quest-optional-row paper-reward-task-row" style={{ marginTop: 18 }}>
            {replayAchievements.map((achievement) => (
              (() => {
                return (
                  <button
                    key={achievement.id}
                    className={`learn-quest-tile ${selectedRewardTaskId === achievement.id ? 'active' : ''} ${
                      achievement.unlocked || achievement.onchainClaimed || achievement.inherited ? 'done' : ''
                    }`}
                    onClick={() => handleToggleRewardTask(achievement.id)}
                  >
                <div className="learn-quest-ribbon">Task {achievement.taskNumber}</div>
                <div className="quest-inline-status-card paper-task-cover-summary">
                  <span className={`checklist-status-badge ${achievement.unlocked || achievement.onchainClaimed || achievement.inherited ? 'done' : 'todo'}`}>
                    {achievement.unlocked || achievement.onchainClaimed || achievement.inherited ? 'Complete' : 'To do'}
                  </span>
                </div>
                <div className="learn-quest-pills">
                  <span className="badge">{achievement.activityLabel}</span>
                </div>
                <div className="learn-quest-tile-title">{achievement.title}</div>
                <div className="learn-quest-tile-copy">{achievement.requirement}</div>
                  </button>
                );
              })()
            ))}
          </div>

          <div className={`learn-quest-detail-shell ${selectedRewardTask ? 'open' : 'closed'} paper-reward-detail-shell`}>
            {selectedRewardTask ? (
              <div key={selectedRewardTask.id} className="learn-quest-detail card paper-reward-detail">
                <div className="learn-quest-detail-top">
                  <div>
                    <div className="eyebrow">Task detail</div>
                    <h3>{`Task ${selectedRewardTask.taskNumber}: ${selectedRewardTask.title}`}</h3>
                  </div>
                  <div className="learn-quest-step-pill">
                    {selectedRewardTask.detailStepCopy}
                  </div>
                </div>

                <div className="quest-detail-panel">
                  <div className="quest-side-panel">
                    <div className="quest-panel-title">Why this task exists</div>
                    <div className="muted">{selectedRewardTask.detail}</div>

                    <div className={`quest-inline-status-card paper-task-checklist-summary ${selectedRewardTaskBadgeStatus?.tone || 'todo'}`}>
                      <div>
                        <div className="quest-panel-title">Core progress</div>
                        <div className="muted">{selectedRewardTaskBadgeStatus?.copy}</div>
                      </div>
                      <div className="paper-task-checklist-summary-meta">
                        <div className="paper-task-checklist-summary-count">
                          {selectedRewardTaskCompletedChecklistCount}/{selectedRewardTaskChecklistTotal} completed
                        </div>
                        <span className={`checklist-status-badge ${selectedRewardTaskBadgeStatus?.tone || 'todo'}`}>
                          {selectedRewardTaskBadgeStatus?.text || 'To do'}
                        </span>
                      </div>
                    </div>

                    <div className="checklist-list">
                      {selectedRewardTaskChecklistItems.map((item) => (
                        <div
                          key={item.id}
                          className={`checklist-item ${item.statusTone} ${item.interactive ? 'checklist-item-interactive' : ''}`.trim()}
                          onClick={item.interactive ? item.onClick : undefined}
                        >
                          <div className="check-indicator">{item.indicator}</div>
                          <div className="checklist-copy checklist-copy-with-status">
                            <div>
                              <div className="check-title">{item.title}</div>
                              <div className="muted">{item.copy}</div>
                            </div>
                            <span className={`checklist-status-badge ${item.statusTone}`}>{item.statusText}</span>
                          </div>
                        </div>
                      ))}
                      {selectedRewardTask.id === REPLAY_BADGE_TYPES.baseCheck ? (
                        <div className="mint-action-box inline-mint-action task-badge-mint-box">
                          <div>
                            <div className="product-title">Replay badge</div>
                            <div className="muted">
                              This collectible unlocks as soon as every core checklist row above is completed for the same wallet.
                            </div>
                            <div className="paper-reward-contract-meta">
                              {claimHash ? <div className="muted">Latest claim tx: {claimHash}</div> : null}
                            </div>
                          </div>
                          <div className="mint-status-stack">
                            {!selectedRewardTask.onchainClaimed ? (
                              <span className={`pill ${selectedRewardTask.claimTone}`}>
                                {selectedRewardTask.claimStatusLabel}
                              </span>
                            ) : null}
                            <button
                              className="primary-btn"
                              onClick={() => handleClaimReplayAchievement(selectedRewardTask)}
                              disabled={
                                selectedRewardTask.actionDisabled ||
                                (claimingAchievementId === selectedRewardTask.id && (isClaimSubmitting || isClaimConfirming))
                              }
                            >
                              {claimingAchievementId === selectedRewardTask.id && (isClaimSubmitting || isClaimConfirming)
                                ? 'Claiming on Sepolia...'
                                : selectedRewardTask.actionLabel}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mint-action-box inline-mint-action task-badge-mint-box-minimal">
                          <div className="mint-status-stack">
                            {!selectedRewardTask.onchainClaimed ? (
                              <span className={`pill ${selectedRewardTask.claimTone}`}>
                                {selectedRewardTask.claimStatusLabel}
                              </span>
                            ) : null}
                            <button
                              className="primary-btn"
                              onClick={() => handleClaimReplayAchievement(selectedRewardTask)}
                              disabled={
                                selectedRewardTask.actionDisabled ||
                                (claimingAchievementId === selectedRewardTask.id && (isClaimSubmitting || isClaimConfirming))
                              }
                            >
                              {claimingAchievementId === selectedRewardTask.id && (isClaimSubmitting || isClaimConfirming)
                                ? 'Claiming on Sepolia...'
                                : selectedRewardTask.actionLabel}
                            </button>
                          </div>
                        </div>
                      )}
                      {selectedRewardTask.onchainClaimed ? (
                        <div className="checklist-item done">
                          <div className="check-indicator">ID</div>
                          <div className="checklist-copy">
                            <div>
                              <div className="check-title">Onchain badge id</div>
                              <div className="muted">{selectedRewardTask.contractId} in the replay achievement contract.</div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {claimFeedback ? <div className="env-hint paper-claim-hint">{claimFeedback}</div> : null}

                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="card" ref={productLanesRef}>
          <div className="section-head">
            <div>
              <div className="eyebrow">Product lanes</div>
              <h2>Start from the asset layer, then move into the play layer</h2>
            </div>
          </div>

          <div className="paper-shelf-tabs">
            {REPLAY_LANE_OPTIONS.map((lane) => (
              <button
                key={lane.id}
                className={`risk-card-tab ${selectedLane === lane.id ? 'active' : ''}`}
                onClick={() => handleLaneChange(lane.id)}
              >
                {lane.label}
              </button>
            ))}
          </div>

          <div className="wealth-filter-row paper-product-filter-row">
            {PAPER_RISK_FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={`risk-card-tab ${productRiskFilter === filter.id ? 'active' : ''}`}
                onClick={() => setProductRiskFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="wealth-filter-row paper-product-filter-row">
            {PAPER_LOCKUP_FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={`risk-card-tab ${productLockupFilter === filter.id ? 'active' : ''}`}
                onClick={() => setProductLockupFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

        </section>

        <section className="paper-lab-grid" style={paperWorkspaceStyle}>
          <div className="paper-shelf-column">
            <section className="card paper-shelf-card" onWheelCapture={(event) => event.stopPropagation()}>
              <div className="section-head">
                <div>
                  <div className="eyebrow">Replay shelf</div>
                  <h2>{selectedLaneLabel}</h2>
                </div>
                <span className="pill risk-low">{filteredProducts.length} products</span>
              </div>

              {filteredProducts.length ? (
                  <div className="paper-shelf-scroll-area" ref={paperShelfScrollAreaRef}>
                  <div className="wealth-product-list paper-shelf-product-list">
                    {pagedProducts.map((product) => {
                      const view = productViews[product.id];
                      const cardGuide = getReplayProductGuide(product);
                      const sevenDayMove = view?.bars?.length ? getReplaySevenDayChangePercent(view.bars) : null;
                      const shelfStructureTags = getShelfStructureTags(product);

                      return (
                        <button
                          key={product.id}
                          className={`product-card wealth-product-card ${selectedProductId === product.id ? 'active' : ''}`}
                          aria-current={selectedProductId === product.id ? 'true' : undefined}
                          onClick={() => handleSelectProduct(product.id)}
                        >
                          <div className="product-top paper-shelf-product-top">
                            <div className="paper-shelf-product-heading">
                              <div className="product-title">{product.name}</div>
                            </div>
                            <span className={`pill paper-shelf-risk-pill ${riskClass(product.risk)}`}>{product.risk} risk</span>
                            <span
                              className="paper-shelf-learn-link"
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setLearnMoreProductId(product.id);
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                event.preventDefault();
                                event.stopPropagation();
                                setLearnMoreProductId(product.id);
                              }}
                            >
                              Want to learn more?
                            </span>
                            <div className="muted paper-shelf-product-meta">
                              {product.productType} / {product.ticker}
                            </div>
                            <div className="paper-shelf-layer-row">
                              <span className="paper-product-tag">{getPaperAssetLayerLabel(product)}</span>
                              <span className="paper-product-tag">{getDefaultHedgeTypeForProduct(product).toUpperCase()} hedge default</span>
                            </div>
                            {shelfStructureTags.length ? (
                              <div className="paper-product-tag-row">
                                {shelfStructureTags.map((tag) => (
                                  <span key={tag} className="paper-product-tag">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {selectedProductId === product.id ? (
                              <div className="muted paper-shelf-product-state">Active on replay desk</div>
                            ) : null}
                          </div>

                          <div className="kv paper-shelf-kv">
                            <div className="paper-shelf-kv-card paper-shelf-kv-card-move">
                              <div className="k">7D move</div>
                              <div className={`v ${sevenDayMove == null ? '' : sevenDayMove >= 0 ? 'risk-low' : 'risk-high'}`}>
                                {sevenDayMove == null ? '--' : `${sevenDayMove >= 0 ? '+' : ''}${sevenDayMove.toFixed(2)}%`}
                              </div>
                            </div>
                            <div className="paper-shelf-kv-card">
                              <div className="k">Exit / lockup</div>
                              <div className="v">
                                {Number(cardGuide.lockupDays || 0) > 0 ? `${cardGuide.lockupDays}D term` : 'Flexible'}
                              </div>
                            </div>
                          </div>

                          <div className="muted">
                            {cardGuide.redemptionWindow} / {cardGuide.structureLabel}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="wealth-pagination paper-shelf-pagination">
                    <div className="paper-shelf-pagination-controls">
                      {paperShelfHasMultiplePages ? (
                        <>
                          <button
                            className="ghost-btn compact"
                            onClick={() => handleShelfPageChange(paperShelfPage - 1)}
                            disabled={paperShelfPage <= 1}
                          >
                            Previous
                          </button>
                          <button
                            className="ghost-btn compact"
                            onClick={() => handleShelfPageChange(paperShelfPage + 1)}
                            disabled={paperShelfPage >= paperShelfPageCount}
                          >
                            Next {paperShelfNextCount}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="reason-card">
                  <div className="entry-title">No products matched these filters</div>
                  <div className="entry-copy">
                    Try relaxing the risk, lockup, or volatility filters to reopen more replay products.
                  </div>
                </div>
              )}
            </section>

            <div className="paper-shelf-learning-slot">{renderShelfLearningCard()}</div>
          </div>

          <div className="paper-main-stage">
            <ReplayChartPanel
              key={`chart-stage-${selectedProductId}`}
              selectedProductId={selectedProductId}
              selectedProduct={selectedProduct}
              selectedProductDisclosureRows={selectedProductDisclosureRows}
              selectedView={selectedView}
              selectedRangeOptions={selectedRangeOptions}
              selectedMarketCapValue={selectedMarketCapValue}
              replayFocus={replayFocus}
              hoveredReplayIndex={hoveredReplayIndex}
              onChangeInterval={handleChangeInterval}
              onChangeRange={handleChangeRange}
              onSelectReplayIndex={handleSelectReplayIndex}
              onHoverReplayIndexChange={scheduleHoveredReplayIndexChange}
              hoverDebugEnabled={hoverDebugEnabled}
              chartHoverDiagnosticRows={chartHoverDiagnosticRows}
              renderReplayDeskCompact={renderReplayDeskCompact}
            />
          </div>

          <aside
            className="paper-side-rail"
          >
                {renderCompactReplayCard('diligence')}
          </aside>
        </section>

        {renderProductFloatingLeaderboard()}

        <section className="paper-replay-ledger-stack">
          <section className="card">
            <div className="section-head">
              <div>
                <div className="eyebrow">Open positions</div>
                <h2>Wallet-linked replay holdings</h2>
              </div>
            </div>

            {portfolioRows.length === 0 ? (
              <div className="reason-card">
                <div className="entry-title">No replay positions yet</div>
                <div className="entry-copy">
                  Start with Public markets if you want the clearest first replay, then compare Private markets / pre-IPO,
                  Leverage & hedging, or Options / strategy once the mechanics feel familiar.
                </div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Units</th>
                      <th>Avg entry</th>
                      <th>Mark</th>
                      <th>Gross value</th>
                      <th>Holding days</th>
                      <th>Carry drag</th>
                      <th>Mgmt fee</th>
                      <th>Net exit</th>
                      <th>Gross PnL</th>
                      <th>Net PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioRows.map((row) => (
                      <tr key={row.id} onClick={() => handleSelectProduct(row.id)}>
                        <td>
                          <strong>{row.ticker}</strong>
                          <div className="tiny">{row.productType}</div>
                        </td>
                        <td>{formatUnits(row.units)}</td>
                        <td>{formatPrice(row.avgEntry)}</td>
                        <td>{formatPrice(row.markPrice)}</td>
                        <td>{formatNotional(row.marketValue)} PT</td>
                        <td>{row.holdingDays.toFixed(1)}d</td>
                        <td>{formatNotional(row.unpaidCarry)} PT</td>
                        <td>{formatNotional(row.managementFee)} PT</td>
                        <td>{formatNotional(row.netExitValue)} PT</td>
                        <td className={row.unrealizedPnl >= 0 ? 'risk-low' : 'risk-high'}>
                          {formatSigned(row.unrealizedPnl)} PT
                        </td>
                        <td className={row.netPnl >= 0 ? 'risk-low' : 'risk-high'}>{formatSigned(row.netPnl)} PT</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <div className="eyebrow">Trade log</div>
                <h2>Replay fills</h2>
              </div>
            </div>

            {paperState.trades.length === 0 ? (
              <div className="reason-card">
                <div className="entry-title">No replay fills yet</div>
                <div className="entry-copy">
                  The first buy or sell will create a replay log entry with the product, timestamp, interval, fill price,
                  and realized PnL where relevant.
                </div>
              </div>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Product</th>
                        <th>Side</th>
                        <th>Units</th>
                        <th>Price</th>
                        <th>Notional</th>
                        <th>Fees</th>
                        <th>Tax</th>
                        <th>Carry</th>
                        <th>Mgmt</th>
                        <th>Realized</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedReplayFills.map((trade) => {
                        const product = getProductById(trade.productId);
                        return (
                          <tr key={trade.id}>
                            <td>
                              <div>{formatReplayDate(trade.ts, trade.interval)}</div>
                              <div className="tiny">{trade.interval}</div>
                            </td>
                            <td>{product.ticker}</td>
                            <td className={trade.side === 'buy' ? 'risk-low' : 'risk-high'}>
                              {trade.side === 'buy' ? 'Buy' : 'Sell'}
                            </td>
                            <td>{formatUnits(trade.units)}</td>
                            <td>{formatPrice(trade.price)}</td>
                            <td>{formatNotional(trade.notional)} PT</td>
                            <td>{trade.feeTotal ? `${formatNotional(trade.feeTotal)} PT` : '--'}</td>
                            <td>{trade.taxTotal ? `${formatNotional(trade.taxTotal)} PT` : '--'}</td>
                            <td>{trade.carryTotal ? `${formatNotional(trade.carryTotal)} PT` : '--'}</td>
                            <td>{trade.managementFeeTotal ? `${formatNotional(trade.managementFeeTotal)} PT` : '--'}</td>
                            <td className={trade.realizedPnl >= 0 ? 'risk-low' : trade.realizedPnl < 0 ? 'risk-high' : ''}>
                              {trade.realizedPnl ? `${formatSigned(trade.realizedPnl)} PT` : '--'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {replayFillsHasMultiplePages ? (
                  <div className="paper-shelf-pagination">
                    <div className="paper-shelf-pagination-controls">
                      <button
                        type="button"
                        className="ghost-btn compact"
                        onClick={() => handleReplayFillsPageChange(replayFillsPage - 1)}
                        disabled={replayFillsPage <= 1}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="ghost-btn compact"
                        onClick={() => handleReplayFillsPageChange(replayFillsPage + 1)}
                        disabled={replayFillsPage >= replayFillsPageCount}
                      >
                        Next {replayFillsNextCount}
                      </button>
                    </div>
                    <div className="muted paper-shelf-page-status">
                      Page {replayFillsPage} / {replayFillsPageCount} | Showing {replayFillsPageStart + 1}-{replayFillsPageEnd} of{' '}
                      {paperState.trades.length} fills
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </section>
      </main>

      <PaperBuyPrimerModal
        open={Boolean(pendingBuyTrade)}
        product={pendingBuyTrade ? productMap[pendingBuyTrade.productId] || selectedProduct : null}
        onClose={closeBuyGuideModal}
        onConfirm={confirmBuyGuideModal}
        feeRows={feeRows}
        yieldRows={yieldRows}
        deskSimulation={deskSimulation}
        selectedProductGuide={selectedProductGuide}
        isSigning={isRiskSigning}
      />

      <ReplayRouteTradeConfirmModal
        open={Boolean(pendingPerpTradeConfirm)}
        product={selectedProduct}
        action={pendingPerpTradeConfirm?.action || 'open'}
        direction={pendingPerpTradeConfirm?.direction || contractDirection}
        tradeAmount={pendingPerpTradeConfirm?.tradeAmount || 0}
        leverageLabel={pendingPerpTradeConfirm?.leverageLabel || (routeLeverageMultiple === 1 ? 'No leverage' : `${routeLeverageMultiple}x leverage`)}
        anchorLabel={pendingPerpTradeConfirm?.anchorLabel || formatReplayDate(replayFocus.lockedBar?.ts || replayFocus.bar?.ts, selectedView?.interval)}
        flashModeLabel={pendingPerpTradeConfirm?.flashModeLabel || selectedTradeAmountMaxLabel}
        focusId={pendingPerpTradeConfirm?.focusId || selectedRouteFocusConfig?.id || 'leverage'}
        focusLabel={pendingPerpTradeConfirm?.focusLabel || activeRouteFocusConfig?.label || selectedRouteFocusConfig?.label || 'Leverage'}
        customCopy={pendingPerpTradeConfirm?.customCopy || ''}
        onClose={() => setPendingPerpTradeConfirm(null)}
        onConfirm={confirmPerpTradeModal}
        isSigning={isRiskSigning}
      />

      <ReplayRouteRiskConfirmModal
        open={Boolean(pendingPerpRiskConfirm)}
        product={selectedProduct}
        action={pendingPerpRiskConfirm?.action || 'open'}
        direction={pendingPerpRiskConfirm?.direction || contractDirection}
        tradeAmount={pendingPerpRiskConfirm?.tradeAmount || 0}
        leverageLabel={pendingPerpRiskConfirm?.leverageLabel || (routeLeverageMultiple === 1 ? 'No leverage' : `${routeLeverageMultiple}x leverage`)}
        flashAmount={pendingPerpRiskConfirm?.flashAmount || 0}
        focusId={pendingPerpRiskConfirm?.focusId || selectedRouteFocusConfig?.id || 'leverage'}
        focusLabel={pendingPerpRiskConfirm?.focusLabel || activeRouteFocusConfig?.label || selectedRouteFocusConfig?.label || 'Leverage'}
        customCopy={pendingPerpRiskConfirm?.customCopy || ''}
        onClose={closePerpRiskModal}
        onConfirm={confirmPerpRiskModal}
      />

      <ProductLearnMoreModal
        open={Boolean(learnMoreProduct)}
        product={learnMoreProduct}
        productGuide={learnMoreProductGuide}
        onClose={() => setLearnMoreProductId(null)}
      />

      {tradeOutcomeBursts.length ? (
        <div className="paper-trade-fireworks" aria-hidden="true">
          {tradeOutcomeBursts.map((burst) => (
            <span
              key={burst.id}
              className="paper-trade-firework"
              style={{
                '--paper-firework-left': `${burst.left}%`,
                '--paper-firework-top': `${burst.top}%`,
                '--paper-firework-angle': `${burst.angle}deg`,
                '--paper-firework-distance': `${burst.distance}px`,
                '--paper-firework-delay': `${burst.delay}s`,
                '--paper-firework-hue': burst.hue
              }}
            />
          ))}
        </div>
      ) : null}

      <TradeOutcomeModal
        open={Boolean(tradeOutcomeModal)}
        outcome={tradeOutcomeModal}
        onClose={() => setTradeOutcomeModal(null)}
      />

      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnect={handleConnect}
        onDisconnect={handleWalletDisconnect}
        onSaveNickname={handleSaveWalletNickname}
        isPending={isPending && pendingConnector?.name?.toLowerCase().includes('metamask')}
        isConnected={isConnected}
        address={address}
        walletDisplayName={walletDisplayName}
        nicknameDraft={walletNicknameDraft}
        onNicknameDraftChange={(value) => {
          setWalletNicknameDraft(value.slice(0, WALLET_NICKNAME_MAX_LENGTH));
          setWalletNicknameFeedback('');
        }}
        nicknameFeedback={walletNicknameFeedback}
        errorText={walletError}
        hasMetaMaskInstalled={hasMetaMaskInstalled}
        isProfileSigning={isRiskSigning}
        profileBackupAccounts={profileBackupAccounts}
        selectedProfileBackupAddress={selectedProfileBackupAddress}
        onSelectedProfileBackupAddressChange={setSelectedProfileBackupAddress}
        onSignProfileBackup={handleSignProfileBackup}
        onRecoverSelectedProfileBackup={handleRecoverSelectedProfileBackup}
        profileBackupSummaryText={profileBackupStatus || (
          isConnected
            ? `Connected as ${walletDisplayName}. Sign a replay backup, or recover a saved snapshot for this same wallet.`
            : profileBackupAccounts.length
              ? `${profileBackupAccounts.length} historical backup${profileBackupAccounts.length === 1 ? '' : 's'} found on this device. Connect the matching MetaMask account before recovery.`
              : 'Connect MetaMask to create or recover a signed replay profile backup.'
        )}
      />
      <DeveloperModeModal
        open={devModeOpen}
        onClose={() => setDevModeOpen(false)}
        isAuthed={devModeAuthed}
        username={devModeUsername}
        password={devModePassword}
        onUsernameChange={setDevModeUsername}
        onPasswordChange={setDevModePassword}
        onLogin={handleDeveloperLogin}
        onLogout={handleDeveloperLogout}
        errorText={devModeError}
        noticeText={devModeNotice}
        isConnected={isConnected}
        walletDisplayName={walletDisplayName}
        remainingPt={remainingPaperTokens}
      />
    </div>
  );
}

export default function PaperTradingApp() {
  return (
    <React.StrictMode>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <PaperTradingInner />
        </QueryClientProvider>
      </WagmiProvider>
    </React.StrictMode>
  );
}
