import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  WagmiProvider,
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSignMessage,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { isAddress } from 'viem';

import { queryClient, wagmiConfig } from './wagmiSetup';
import {
  CATEGORY_OPTIONS,
  GOAL_OPTIONS,
  WEALTH_MILESTONE_BONUS,
  WEALTH_MIN_SUBSCRIPTION,
  WEALTH_PRODUCTS,
  WEALTH_STARTING_CASH,
  getGoalById
} from './wealthDemoData';
import { GLOBAL_TOKEN_RIGHTS_NOTES, WEALTH_PRODUCT_INSIGHTS } from './productInsightMeta';
import { buildLiveWealthProducts } from './wealthLiveData';
import { buildDiligenceModel, fetchDay1BriefSnapshot } from './day1BriefAdapter';
import { LanguageToggle, useDomTranslation, useUiLanguage } from './uiLanguage';
import {
  getWalletDisplayName,
  normalizeWalletNickname,
  readWalletNickname,
  WALLET_NICKNAME_MAX_LENGTH,
  writeWalletNickname
} from './walletNickname';
import {
  getWealthSpendableCash,
  getWalletProfilePointerKey,
  getWalletProfileSummary,
  readRecoveredPaperState,
  readRecoveredWealthState,
  readWalletProfile,
  signAndStoreProfilePointer,
  writeWalletProfilePatch
} from './walletProfileStore';

const SEPOLIA_CHAIN_ID = 11155111;
const BADGE_CONTRACT_ADDRESS = import.meta.env.VITE_BADGE_CONTRACT_ADDRESS || '';
const WEALTH_VAULT_ADDRESS = import.meta.env.VITE_WEALTH_VAULT_ADDRESS || '';
const badgeContractConfigured = isAddress(BADGE_CONTRACT_ADDRESS);
const wealthVaultConfigured = isAddress(WEALTH_VAULT_ADDRESS);
const PROFILE_BACKUP_POINTER_STORAGE_PREFIX = 'msx-wallet-profile-pointer-';
const DAY_MS = 24 * 60 * 60 * 1000;
const BADGE_TYPES = {
  welcome: 1,
  wallet: 2,
  risk: 3,
  quiz: 4,
  paper: 5
};
const NAV_PERIOD_OPTIONS = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' }
];
const FAST_FORWARD_OPTIONS = [
  { id: 'today', label: 'Today', days: 0, description: 'Current wallet value at today NAV.' },
  { id: '30d', label: '+30D', days: 30, description: 'Quick carry preview one month forward.' },
  { id: '90d', label: '+90D', days: 90, description: 'Quarterly carry preview without waiting.' },
  { id: '1y', label: '+1Y', days: 365, description: 'One-year carry preview for demo review.' }
];
const LEADERBOARD_LIMIT = 10;
const MAX_COMPARE_PRODUCTS = 4;
const DEFAULT_WEALTH_PRODUCT_ID = 'ondo-usdy';
const WEALTH_SETTLEMENT_ACTIVITY_TYPES = ['settlement', 'redeem', 'collateral', 'collateral-release'];
const DEFAULT_COMPARE_PRODUCT_IDS_BY_CATEGORY = {
  all: ['superstate-ustb', 'msx-protected-growth-eth', 'spacex-secondary', 'stripe-secondary'],
  cash: ['superstate-ustb', 'ondo-ousg', 'blackrock-buidl', 'hashnote-usyc'],
  public: ['private-watchlist', 'spacex-secondary', 'stripe-secondary', 'bytedance-secondary'],
  private: ['private-watchlist', 'spacex-secondary', 'stripe-secondary', 'databricks-secondary'],
  auto: ['msx-quant-fund-1', 'msx-quant-fund-2', 'superstate-ustb', 'superstate-uscc'],
  earn: ['hashnote-usyc', 'openeden-tbill', 'superstate-uscc', 'apollo-acred'],
  dual: ['msx-dual-btc-usdt', 'msx-dual-btc-usdc', 'msx-dual-eth-usdt', 'msx-dual-eth-usdc'],
  protected: ['msx-protected-growth-eth', 'msx-premium-income-btc', 'msx-autocall-index', 'superstate-uscc'],
  growth: ['private-watchlist', 'spacex-secondary', 'stripe-secondary', 'bytedance-secondary'],
  protectedGrowth: ['msx-protected-growth-eth', 'msx-premium-income-btc', 'superstate-ustb', 'msx-autocall-index'],
  premiumIncome: ['msx-premium-income-btc', 'msx-protected-growth-eth', 'msx-autocall-index', 'superstate-uscc'],
  autoCall: ['msx-autocall-index', 'msx-premium-income-btc', 'msx-protected-growth-eth', 'superstate-uscc'],
  privateCredit: ['apollo-acred', 'hamilton-scope', 'private-watchlist', 'msx-quant-fund-1']
};
const COMPARE_LINE_COLORS = ['#226d40', '#7aa6ff', '#f06a7f', '#ffd166'];
const WEALTH_LIVE_CACHE_KEY = 'msx-wealth-live-products-cache-v1';
const DAY1_BRIEF_CACHE_KEY = 'msx-day1-brief-cache-v1';
const WEALTH_VAULT_LEGACY_ASSET_SCALE = 10 ** 6;
const DEFAULT_COLLATERAL_ADVANCE_RATE = 0.55;
const COLLATERAL_WARNING_LTV = 0.85;
const WEALTH_ACTIVITY_LIMIT = 12;
const DEV_MODE_USERNAME = 'msxadmin';
const DEV_MODE_PASSWORD = 'msx2026';
const DEV_AUTH_STORAGE_KEY = 'msx-dev-auth';
const WEALTH_TASK_TOKEN_OFFSET = 200;
const WEALTH_RECEIPT_TOKEN_OFFSET = 1000;
const SETTLEMENT_ACTION_OPTIONS = [
  { id: 'roll', label: 'Roll into next term', helper: 'Settle the current receipt at the projected NAV, then reopen the same product with a new basis. This is the demo rollover path.' },
  { id: 'transfer', label: 'Transfer into another product', helper: 'Settle this receipt first, then remint the released value into the transfer target you pick below.' },
  { id: 'exit', label: 'Settle into PT cash', helper: 'End this receipt and return the free value to spendable PT cash in the Wealth wallet.' },
  { id: 'preview', label: 'Preview only', helper: 'Mark the future value without changing the wallet ledger.' }
];
const DUAL_CURRENCY_PAIR_OPTIONS = [
  { id: 'BTC/USDT', base: 'BTC', quote: 'USDT', referencePrice: 77548.79 },
  { id: 'BTC/USDC', base: 'BTC', quote: 'USDC', referencePrice: 77548.79 },
  { id: 'ETH/USDT', base: 'ETH', quote: 'USDT', referencePrice: 3140.42 },
  { id: 'ETH/USDC', base: 'ETH', quote: 'USDC', referencePrice: 3140.42 }
];
const DUAL_CURRENCY_DIRECTION_OPTIONS = [
  { id: 'buy-low', label: 'Buy low', copy: 'User earns premium but may settle into the base asset if price finishes below target.' },
  { id: 'sell-high', label: 'Sell high', copy: 'User earns premium but may sell the base asset into quote if price finishes above target.' }
];
const DUAL_PT_REWARD_MULTIPLIER = 1000;
const DETAIL_TOPIC_OPTIONS = [
  { id: 'flow', label: 'Buy / settle / pledge', helper: 'Buy, settlement, rollover, transfer, and pledge live in the same product action row.' },
  { id: 'snapshot', label: 'Overview', helper: 'Read the compact one-screen summary: what the product is, what it earns from, and how difficult it is.' },
  { id: 'nav', label: 'Timeline', helper: 'Check the NAV path and time-window result without duplicating the order controls.' },
  { id: 'diligence', label: 'AI Diligence', helper: 'Use this before buying: compact fit, key evidence, and the AI memo without opening a long checklist.' },
  { id: 'onchain', label: 'Onchain', helper: 'Show allowance, vault, and wallet-signing mechanics as a detail page rather than inline clutter.' }
];
const DETAIL_TOPIC_IDS = new Set(DETAIL_TOPIC_OPTIONS.map((topic) => topic.id));

function normalizeDetailTopicId(topicId, fallback = 'flow') {
  if (DETAIL_TOPIC_IDS.has(topicId)) return topicId;
  if (fallback && DETAIL_TOPIC_IDS.has(fallback)) return fallback;
  return '';
}

const WEALTH_HOME_SURFACE_NOTES = {
  parkCash: {
    layer: 'Cash & Treasury',
    owns: 'Treasury, money-fund, cash-management, or reserve-fund wrapper',
    earn: 'Short-duration treasury / repo / cash carry',
    liquidity: 'Market-day liquidity or fund redemption window',
    rights: 'NAV / share-token / redemption terms',
    auto: 'Alerts, rebalance, idle-cash sweep'
  },
  earn: {
    layer: 'Earn & Yield',
    owns: 'Yield sleeve, carry fund, credit fund, or income route',
    earn: 'Carry, basis, credit spread, manager execution, or term premium',
    liquidity: 'Flexible, term, or queue depending on the route',
    rights: 'Receipt plus product-specific payout terms',
    auto: 'Yield optimizer with pause rules'
  },
  public: {
    layer: 'Pre-IPO Growth',
    owns: 'Late-stage private-company allocation, SPV economics, or transfer-window claim',
    earn: 'Event-driven marks, tenders, IPO, or acquisition',
    liquidity: 'Transfer window, tender, IPO, acquisition, or matched secondary buyer',
    rights: 'SPV / transfer / document rights',
    auto: 'Watchlist and alerts; auto-buy normally disabled'
  },
  private: {
    layer: 'Private',
    owns: 'Pre-IPO, SPV, late-stage private-share, or transfer-window claim',
    earn: 'Event-driven marks, tenders, IPO, or acquisition',
    liquidity: 'Transfer window, queue, or liquidity event',
    rights: 'SPV / transfer / document rights',
    auto: 'Watchlist and alerts; auto-buy normally disabled'
  },
  auto: {
    layer: 'Managed Strategy',
    owns: 'A permissioned rule or managed strategy layered on assets',
    earn: 'Depends on the underlying sleeve and strategy rules',
    liquidity: 'Must inherit the underlying product liquidity',
    rights: 'Rule permissions, override rights, and pause conditions',
    auto: 'Recurring buy, rebalance, watchlist, yield optimizer, risk copilot'
  },
  protected: {
    layer: 'Protected',
    owns: 'Defined-outcome, buffer, premium-income, or barrier receipt',
    earn: 'Option package, capped upside, conditional coupon, or premium',
    liquidity: 'Usually term, observation, or maturity driven',
    rights: 'Payoff rule, issuer or strategy terms, and settlement constraints',
    auto: 'Maturity alerts, barrier monitoring, and settlement previews'
  },
  growth: {
    layer: 'Growth',
    owns: 'Pre-IPO, late-stage private-company, SPV, or transfer-window claim',
    earn: 'Event-driven private marks and liquidity events',
    liquidity: 'Secondary window, tender, IPO, acquisition, or transfer approval',
    rights: 'SPV / private-share / document rights',
    auto: 'Watchlist, evidence alerts, and next-question tracking'
  }
};

const WEALTH_OPPORTUNITY_TYPES = [
  {
    id: 'protected-growth',
    label: 'Protected Growth Vault',
    tradFi: 'Buffer ETF / Defined Outcome ETF',
    lane: 'Wealth / Protect & Grow',
    priority: 'MVP 1',
    placement: 'wealth',
    filterCategory: 'protected',
    goalId: 'public',
    productIds: ['msx-protected-growth-eth'],
    why: 'Shows downside buffer and upside cap as an outcome range instead of a high APR promise.',
    userCopy: 'For users who want BTC / ETH or index upside but want the first loss band explained before buying.'
  },
  {
    id: 'growth-access',
    label: 'Growth Access',
    tradFi: 'Pre-IPO / late-stage private allocation',
    lane: 'Wealth / Growth',
    priority: 'MVP 1',
    placement: 'wealth',
    filterCategory: 'growth',
    goalId: 'public',
    productIds: ['private-watchlist', 'spacex-secondary', 'stripe-secondary', 'bytedance-secondary', 'databricks-secondary'],
    why: 'Makes recognizable private names usable without pretending they are listed wrappers: rights, allocation path, and liquidity events come first.',
    userCopy: 'For users who want private-growth exposure and need eligibility, documents, concentration, and exit timing explained before sizing.'
  },
  {
    id: 'premium-income',
    label: 'Premium Income Vault',
    tradFi: 'Covered Call ETF / Option Income ETF',
    lane: 'Wealth / Income',
    priority: 'MVP 2',
    placement: 'wealth',
    filterCategory: 'premiumIncome',
    goalId: 'earn',
    productIds: ['msx-premium-income-btc'],
    why: 'Turns option premium, covered-call, and put-write logic into monthly income language.',
    userCopy: 'Best for holders who accept capped upside or conversion risk in exchange for recurring income.'
  },
  {
    id: 'autocall',
    label: 'Auto-Call Yield Plan',
    tradFi: 'Autocallable / Snowball note',
    lane: 'Wealth advanced + paper payoff sim',
    priority: 'Advanced',
    placement: 'both',
    filterCategory: 'autoCall',
    goalId: 'auto',
    productIds: ['msx-autocall-index'],
    why: 'Observation dates, coupon barriers, and knock-in rules need a timeline payoff view before subscription.',
    userCopy: 'Use wealth for the receipt and suitability gate; use paper trading to rehearse barrier outcomes.'
  },
  {
    id: 'enhanced-yield',
    label: 'Enhanced Yield / Buy-the-Dip',
    tradFi: 'Reverse Convertible / ELN / Dual Currency Deposit',
    lane: 'Wealth / Structured',
    priority: 'MVP 2',
    placement: 'wealth',
    filterCategory: 'dual',
    goalId: 'earn',
    productIds: ['msx-dual-btc-usdt', 'msx-dual-btc-usdc', 'msx-dual-eth-usdt', 'msx-dual-eth-usdc'],
    why: 'Extends Dual Investment into buy-the-dip, take-profit, and barrier enhanced-yield plans.',
    userCopy: 'The product must show whether the user may receive original asset, converted asset, or reduced value.'
  },
  {
    id: 'cash-ladder',
    label: 'Cash Reserve / T-bill Ladder',
    tradFi: 'T-bill ladder / Money market sweep',
    lane: 'Wealth / Cash',
    priority: 'MVP 3',
    placement: 'wealth',
    filterCategory: 'cashManagement',
    goalId: 'parkCash',
    productIds: ['superstate-ustb', 'ondo-ousg', 'hashnote-usyc', 'openeden-tbill', 'blackrock-buidl'],
    why: 'Transforms tokenized treasuries from single products into a cash-management account experience.',
    userCopy: 'Best for idle cash, staged entry, liquidity reserve, and treasury ladder education.'
  },
  {
    id: 'private-credit',
    label: 'Pre-IPO / Private Credit',
    tradFi: 'Pre-IPO-style private allocation',
    lane: 'Wealth / Alternatives',
    priority: 'Careful',
    placement: 'wealth',
    filterCategory: 'privateCredit',
    goalId: 'private',
    productIds: ['hamilton-scope', 'apollo-acred'],
    why: 'Keep it in Wealth as a private allocation: redemption gates, NAV cadence, borrower concentration, and valuation disclosure matter more than trade replay.',
    userCopy: 'Show it like a pre-IPO/private-market allocation: documents, liquidity window, valuation logic, and downside disclosure before any yield number.'
  },
  {
    id: 'wallet-optimizer',
    label: 'Tax-aware Wallet Optimizer',
    tradFi: 'Direct indexing / Tax-loss harvesting / SMA',
    lane: 'Wealth / Plan',
    priority: 'Platform feature',
    placement: 'both',
    filterCategory: 'taxOptimizer',
    goalId: 'auto',
    productIds: ['spacex-secondary', 'stripe-secondary', 'msx-quant-fund-1', 'msx-quant-fund-2'],
    why: 'This is more of a wallet-level advisor than a single fund: cost basis, concentration, harvest, and rebalance.',
    userCopy: 'Wealth should recommend actions; paper trading can test rebalance and harvest timing before signing.'
  },
  {
    id: 'model-portfolio',
    label: 'Model Portfolio / Managed Account',
    tradFi: 'Model portfolio / SMA',
    lane: 'Wealth / Plan',
    priority: 'Core IA',
    placement: 'wealth',
    filterCategory: 'modelPortfolio',
    goalId: 'auto',
    productIds: ['superstate-ustb', 'hashnote-usyc', 'spacex-secondary', 'stripe-secondary', 'msx-quant-fund-1'],
    why: 'Moves the page from a vault shelf to goal-based conservative, balanced, growth, and income portfolios.',
    userCopy: 'Use this when the user wants a goal first and product selection second.'
  },
  {
    id: 'protected-income',
    label: 'Protected Income Plan',
    tradFi: 'RILA / Indexed annuity',
    lane: 'Wealth later',
    priority: 'Later',
    placement: 'wealth-later',
    filterCategory: 'protectedIncome',
    goalId: 'earn',
    productIds: ['superstate-ustb', 'hashnote-usyc', 'apollo-acred', 'superstate-uscc'],
    why: 'Long-term income and protection is powerful, but the guarantee language needs regulated backing.',
    userCopy: 'Keep as a planning concept until the issuer, guarantee, withdrawal, and disclosure model are clear.'
  },
  {
    id: 'prediction-market',
    label: 'Prediction Market / Event-linked Yield',
    tradFi: 'Event contract / binary outcome note',
    lane: 'Paper trading first',
    priority: 'Lab',
    placement: 'paper',
    filterCategory: 'predictionMarket',
    goalId: 'public',
    productIds: ['private-watchlist', 'spacex-secondary', 'stripe-secondary', 'msx-quant-fund-1'],
    why: 'The payoff is event-probability driven, so users should rehearse outcome settlement before it appears as wealth.',
    userCopy: 'Good for paper simulations, conditional close rules, and event settlement education; not a default beginner wealth shelf.'
  }
];

const WEALTH_OPPORTUNITY_CATEGORY_OPTIONS = [
  { id: 'protectedGrowth', label: 'Protected Growth' },
  { id: 'premiumIncome', label: 'Premium Income' },
  { id: 'autoCall', label: 'Auto-Call' },
  { id: 'cashManagement', label: 'Cash Ladder' },
  { id: 'privateCredit', label: 'Pre-IPO / Private Credit' },
  { id: 'taxOptimizer', label: 'Tax / Wallet Optimizer' },
  { id: 'modelPortfolio', label: 'Model Portfolio' },
  { id: 'protectedIncome', label: 'Protected Income' },
  { id: 'predictionMarket', label: 'Prediction Market' }
];

const WEALTH_OPPORTUNITY_PRODUCT_IDS = WEALTH_OPPORTUNITY_TYPES.reduce((acc, item) => {
  if (!item.filterCategory) return acc;
  acc[item.filterCategory] = new Set(item.productIds || []);
  return acc;
}, {});

const FEATURED_WEALTH_OPPORTUNITY_IDS = new Set(['protected-growth', 'growth-access']);
const FEATURED_WEALTH_OPPORTUNITIES = WEALTH_OPPORTUNITY_TYPES.filter((type) => FEATURED_WEALTH_OPPORTUNITY_IDS.has(type.id));
const WEALTH_PRODUCT_TYPE_GROUPS = [
  {
    id: 'wrapper',
    label: '',
    options: [
      { id: 'all', label: 'All' },
      { id: 'cash', label: 'Cash & Treasury' },
      { id: 'public', label: 'Pre-IPO / Private' },
      { id: 'dual', label: 'Dual Investment' }
    ]
  },
  {
    id: 'productType',
    label: '',
    options: [
      { id: 'all', label: 'All' },
      { id: 'protected', label: 'Protected' },
      { id: 'growth', label: 'Growth' }
    ]
  }
];
const WEALTH_PRODUCT_TYPE_FILTERS = [
  ...new Map(WEALTH_PRODUCT_TYPE_GROUPS.flatMap((group) => group.options).map((category) => [category.id, category])).values()
];
const DEFAULT_RISK_RECOMMENDATION_BUCKETS = [
  { risk: 'Low', ids: ['superstate-ustb', 'ondo-usdy', 'blackrock-buidl', 'hashnote-usyc'] },
  { risk: 'Medium', ids: ['msx-protected-growth-eth', 'superstate-uscc', 'hamilton-scope', 'apollo-acred'] },
  { risk: 'High', ids: ['msx-dual-btc-usdt', 'msx-dual-eth-usdt', 'private-watchlist', 'msx-quant-fund-1'] }
];
const AI_RECOMMENDATION_LANES = [
  { id: 'dual', label: 'Dual Investment' },
  { id: 'private', label: 'Private / Growth' },
  { id: 'cash', label: 'Cash & Treasury' }
];
const WEALTH_TIMELINE_FLOAT_STORAGE_KEY = 'msx.wealthTimelineFloat';
const WEALTH_TIMELINE_FLOAT_EDGE_GAP = 18;
const WEALTH_TIMELINE_FLOAT_MIN_WIDTH = 340;
const WEALTH_TIMELINE_FLOAT_MAX_WIDTH = 560;
const WEALTH_TIMELINE_FLOAT_MIN_HEIGHT = 360;
const WEALTH_TIMELINE_FLOAT_MAX_HEIGHT = 760;

function getFloatingTimelineViewport() {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900 };
  }

  return {
    width: Math.max(1080, Number(window.innerWidth || 1440)),
    height: Math.max(720, Number(window.innerHeight || 900))
  };
}

function buildDefaultWealthTimelineFloat(viewport = getFloatingTimelineViewport()) {
  const maxWidth = Math.max(
    WEALTH_TIMELINE_FLOAT_MIN_WIDTH,
    Math.min(WEALTH_TIMELINE_FLOAT_MAX_WIDTH, viewport.width - WEALTH_TIMELINE_FLOAT_EDGE_GAP * 2)
  );
  const maxHeight = Math.max(
    WEALTH_TIMELINE_FLOAT_MIN_HEIGHT,
    Math.min(WEALTH_TIMELINE_FLOAT_MAX_HEIGHT, viewport.height - WEALTH_TIMELINE_FLOAT_EDGE_GAP * 2 - 48)
  );
  const width = clamp(430, WEALTH_TIMELINE_FLOAT_MIN_WIDTH, maxWidth);
  const height = clamp(560, WEALTH_TIMELINE_FLOAT_MIN_HEIGHT, maxHeight);

  return {
    isCollapsed: false,
    left: Math.max(WEALTH_TIMELINE_FLOAT_EDGE_GAP, viewport.width - width - 28),
    top: clamp(180, 72, Math.max(72, viewport.height - height - WEALTH_TIMELINE_FLOAT_EDGE_GAP)),
    width,
    height,
    arrowSide: 'right',
    arrowTop: clamp(280, 72, Math.max(72, viewport.height - 72))
  };
}

function getCollapsedWealthTimelineAnchor(layout, viewport = getFloatingTimelineViewport()) {
  const side = layout.left + layout.width / 2 <= viewport.width / 2 ? 'left' : 'right';
  return {
    arrowSide: side,
    arrowTop: clamp(layout.top + Math.min(48, layout.height / 2), 72, Math.max(72, viewport.height - 72))
  };
}

function normalizeWealthTimelineFloat(payload, viewport = getFloatingTimelineViewport()) {
  const fallback = buildDefaultWealthTimelineFloat(viewport);
  const maxWidth = Math.max(
    WEALTH_TIMELINE_FLOAT_MIN_WIDTH,
    Math.min(WEALTH_TIMELINE_FLOAT_MAX_WIDTH, viewport.width - WEALTH_TIMELINE_FLOAT_EDGE_GAP * 2)
  );
  const maxHeight = Math.max(
    WEALTH_TIMELINE_FLOAT_MIN_HEIGHT,
    Math.min(WEALTH_TIMELINE_FLOAT_MAX_HEIGHT, viewport.height - WEALTH_TIMELINE_FLOAT_EDGE_GAP * 2 - 48)
  );
  const widthCandidate = Number(payload?.width);
  const heightCandidate = Number(payload?.height);
  const width = Number.isFinite(widthCandidate) ? clamp(widthCandidate, WEALTH_TIMELINE_FLOAT_MIN_WIDTH, maxWidth) : fallback.width;
  const height = Number.isFinite(heightCandidate) ? clamp(heightCandidate, WEALTH_TIMELINE_FLOAT_MIN_HEIGHT, maxHeight) : fallback.height;
  const maxLeft = Math.max(WEALTH_TIMELINE_FLOAT_EDGE_GAP, viewport.width - width - WEALTH_TIMELINE_FLOAT_EDGE_GAP);
  const maxTop = Math.max(72, viewport.height - height - WEALTH_TIMELINE_FLOAT_EDGE_GAP);
  const leftCandidate = Number(payload?.left);
  const topCandidate = Number(payload?.top);
  const arrowTopCandidate = Number(payload?.arrowTop);

  return {
    isCollapsed: Boolean(payload?.isCollapsed),
    left: Number.isFinite(leftCandidate) ? clamp(leftCandidate, WEALTH_TIMELINE_FLOAT_EDGE_GAP, maxLeft) : fallback.left,
    top: Number.isFinite(topCandidate) ? clamp(topCandidate, 72, maxTop) : fallback.top,
    width,
    height,
    arrowSide: payload?.arrowSide === 'left' ? 'left' : 'right',
    arrowTop: Number.isFinite(arrowTopCandidate) ? clamp(arrowTopCandidate, 72, Math.max(72, viewport.height - 72)) : fallback.arrowTop
  };
}

const WEALTH_TASK_BADGES = { subscribe: 'W1', settlement: 'W2' };
const WEALTH_TASK_TYPES = { subscribe: 1, settlement: 2 };
const WEALTH_TASK_TOKEN_IDS = {
  subscribe: WEALTH_TASK_TOKEN_OFFSET + WEALTH_TASK_TYPES.subscribe,
  settlement: WEALTH_TASK_TOKEN_OFFSET + WEALTH_TASK_TYPES.settlement
};
const WEALTH_RECEIPT_PRODUCT_IDS = {
  'superstate-ustb': 1,
  'ondo-usdy': 2,
  'franklin-fobxx': 3,
  'ondo-ousg': 4,
  'hashnote-usyc': 5,
  'openeden-tbill': 6,
  'blackrock-buidl': 7,
  'superstate-uscc': 8,
  'hamilton-scope': 9,
  'apollo-acred': 10,
  'msx-quant-fund-1': 11,
  'msx-quant-fund-2': 12,
  'xstocks-public-holdings': 13,
  'private-watchlist': 14,
  'spacex-secondary': 15,
  'stripe-secondary': 16,
  'bytedance-secondary': 17,
  'databricks-secondary': 18,
  'openai-secondary': 19,
  'msx-protected-growth-eth': 20,
  'msx-premium-income-btc': 21,
  'msx-dual-btc-usdt': 22,
  'msx-dual-btc-usdc': 23,
  'msx-dual-eth-usdt': 24,
  'msx-dual-eth-usdc': 25,
  'msx-autocall-index': 26
};
const WEALTH_AMOUNT_PRESET_VALUES = [1000, 5000, 10000, 25000, 50000, 100000];
const WEALTH_SETTLEMENT_POLICIES = {
  'superstate-ustb': {
    label: 'Market-day liquidity',
    timing: 'Market-day',
    tone: 'risk-low',
    redeemable: true,
    detail: 'Continuous NAV/S with supported cash or stablecoin rails. Not a 24/7 stablecoin withdrawal; market-day processing still applies.'
  },
  'ondo-usdy': {
    label: 'Business-day route',
    timing: 'Business day / T+1 style',
    tone: 'risk-medium',
    redeemable: true,
    detail: 'Mint and redeem are business-day style and depend on onboarding, transferability, jurisdiction, and the product version.'
  },
  'franklin-fobxx': {
    label: 'Daily fund channel',
    timing: 'Daily / channel-specific',
    tone: 'risk-medium',
    redeemable: true,
    detail: 'Daily money-fund mechanics are shown through supported channels; settlement is not the same as an instant token swap.'
  },
  'ondo-ousg': {
    label: '24/7 with thresholds',
    timing: 'Instant / non-instant tiers',
    tone: 'risk-low',
    redeemable: true,
    detail: 'Eligible users may see 24/7 tokenized subscription and redemption, but instant versus non-instant handling can differ by size and route.'
  },
  'hashnote-usyc': {
    label: '24/7 USDC route',
    timing: '24/7/365 for onboarded users',
    tone: 'risk-low',
    redeemable: true,
    detail: 'USDC mint and redeem can run continuously for onboarded investors, while custom liquidity and fee treatment still need to be disclosed.'
  },
  'openeden-tbill': {
    label: 'T+1 queue',
    timing: 'Next U.S. business day',
    tone: 'risk-medium',
    redeemable: true,
    detail: 'Redemptions are queue-based and typically processed on the next U.S. business day, net of the disclosed transaction fee.'
  },
  'blackrock-buidl': {
    label: 'Institutional channel',
    timing: 'Supported channel only',
    tone: 'risk-medium',
    redeemable: true,
    detail: 'Mint, redeem, and transfer depend on institutional Securitize-supported channels. Do not present it as retail instant cash.'
  },
  'superstate-uscc': {
    label: 'Market-day fund route',
    timing: 'Market-day',
    tone: 'risk-medium',
    redeemable: true,
    detail: 'Market-day liquidity is available for eligible users, while carry strategy marks and redemption windows should stay visible.'
  },
  'hamilton-scope': {
    label: 'Fund window',
    timing: 'Fund-style dealing window',
    tone: 'risk-medium',
    redeemable: true,
    detail: 'Private-credit liquidity depends on fund dealing terms, underlying credit liquidity, valuation cadence, and redemption windows.'
  },
  'apollo-acred': {
    label: 'Fund window',
    timing: 'Fund-style dealing window',
    tone: 'risk-medium',
    redeemable: true,
    detail: 'Flexible access still follows private-credit fund terms; it should not be shown as always-on stablecoin redemption.'
  },
  'msx-quant-fund-1': {
    label: 'No early redeem',
    timing: '12-month maturity',
    tone: 'risk-high',
    redeemable: false,
    detail: 'Term quant sleeve. No investor redemption before maturity in this demo; use maturity preview or settlement simulation instead.'
  },
  'msx-quant-fund-2': {
    label: 'No early redeem',
    timing: '12-month maturity',
    tone: 'risk-high',
    redeemable: false,
    detail: 'Higher-volatility term quant sleeve. Receipt remains visible until maturity; no on-demand redemption path should be shown.'
  },
  'xstocks-public-holdings': {
    label: 'Secondary + market-day',
    timing: '24/7 secondary / market-day primary',
    tone: 'risk-medium',
    redeemable: true,
    detail: 'Secondary trading may run 24/7 where supported, but primary mint/redeem and corporate-action processing follow venue and market-day rules.'
  },
  'private-watchlist': {
    label: 'Transfer-only',
    timing: 'Liquidity event / transfer window',
    tone: 'risk-high',
    redeemable: false,
    detail: 'Private watchlist exposure is not continuously redeemable. Exit depends on transfer windows, tender events, issuer actions, or a liquidity event.'
  },
  'msx-protected-growth-eth': {
    label: 'Term outcome',
    timing: '90-day maturity',
    tone: 'risk-medium',
    redeemable: false,
    detail: 'Defined-outcome receipt is evaluated at maturity. Users should not expect intraday redemption while the option package is outstanding.'
  },
  'msx-premium-income-btc': {
    label: 'Monthly cycle',
    timing: 'Monthly option cycle',
    tone: 'risk-medium',
    redeemable: true,
    detail: 'Premium-income receipts should settle around scheduled option cycles; redemption is routed, not instant, because open option exposure can remain outstanding.'
  },
  'msx-dual-btc-usdt': {
    label: 'Settlement only',
    timing: '7-day target-price settlement',
    tone: 'risk-high',
    redeemable: false,
    detail: 'Dual Investment is settled at the target-price observation. The user may receive BTC or USDT; there is no ordinary yield-style redeem button before settlement.'
  },
  'msx-dual-btc-usdc': {
    label: 'Settlement only',
    timing: '7-day target-price settlement',
    tone: 'risk-high',
    redeemable: false,
    detail: 'Dual Investment is settled at the target-price observation. The user may receive BTC or USDC; there is no ordinary yield-style redeem button before settlement.'
  },
  'msx-dual-eth-usdt': {
    label: 'Settlement only',
    timing: '7-day target-price settlement',
    tone: 'risk-high',
    redeemable: false,
    detail: 'Dual Investment is settled at the target-price observation. The user may receive ETH or USDT; there is no ordinary yield-style redeem button before settlement.'
  },
  'msx-dual-eth-usdc': {
    label: 'Settlement only',
    timing: '7-day target-price settlement',
    tone: 'risk-high',
    redeemable: false,
    detail: 'Dual Investment is settled at the target-price observation. The user may receive ETH or USDC; there is no ordinary yield-style redeem button before settlement.'
  },
  'msx-autocall-index': {
    label: 'Observation dates',
    timing: 'Monthly observation / 12-month max term',
    tone: 'risk-high',
    redeemable: false,
    detail: 'Auto-call products resolve through observation dates, coupon barriers, and maturity. No free redeem path should appear before the note calls or matures.'
  }
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

const wealthVaultAbi = [
  {
    type: 'function',
    name: 'navBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'strategyStatus',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    type: 'function',
    name: 'lastAttestedAt',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'latestAttestationRoot',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'subscriptionsPaused',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'minSubscription',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'eligibleInvestor',
    stateMutability: 'view',
    inputs: [{ name: 'investor', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'riskTier',
    stateMutability: 'view',
    inputs: [{ name: 'investor', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    type: 'function',
    name: 'canAccessAdvancedShelf',
    stateMutability: 'view',
    inputs: [{ name: 'investor', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'hasWealthTask',
    stateMutability: 'view',
    inputs: [
      { name: 'holder', type: 'address' },
      { name: 'taskId', type: 'uint8' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
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
    name: 'receiptTokenId',
    stateMutability: 'view',
    inputs: [{ name: 'productId', type: 'uint16' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'subscribeProduct',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'productId', type: 'uint16' },
      { name: 'assetAmount', type: 'uint256' }
    ],
    outputs: [{ name: 'shareAmount', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'redeemProduct',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'productId', type: 'uint16' },
      { name: 'shareAmount', type: 'uint256' }
    ],
    outputs: [{ name: 'assetAmount', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'settleProduct',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'fromProductId', type: 'uint16' },
      { name: 'toProductId', type: 'uint16' },
      { name: 'burnAmount', type: 'uint256' },
      { name: 'mintAmount', type: 'uint256' }
    ],
    outputs: [
      { name: 'assetAmount', type: 'uint256' },
      { name: 'mintedAmount', type: 'uint256' }
    ]
  },
  {
    type: 'function',
    name: 'markWealthTask',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'taskId', type: 'uint8' }],
    outputs: []
  }
];

function shortAddress(address) {
  if (!address) return 'Not connected';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(value) {
  if (!value || /^0x0+$/.test(value)) return 'No attestation root yet';
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function hasPositiveOnchainBalance(value) {
  if (value === null || value === undefined) return false;

  try {
    return BigInt(value) > 0n;
  } catch {
    return false;
  }
}

function getWealthReceiptProductId(product) {
  return WEALTH_RECEIPT_PRODUCT_IDS[product?.id] || 1;
}

function getWealthReceiptTokenId(product) {
  return WEALTH_RECEIPT_TOKEN_OFFSET + getWealthReceiptProductId(product);
}

function toVaultUnitAmount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0n;
  return BigInt(Math.max(0, Math.round(numericValue)));
}

function fromVaultUnitAmount(value) {
  const numericValue = Number(value || 0n);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  if (
    numericValue >= WEALTH_VAULT_LEGACY_ASSET_SCALE &&
    numericValue % WEALTH_VAULT_LEGACY_ASSET_SCALE === 0
  ) {
    return numericValue / WEALTH_VAULT_LEGACY_ASSET_SCALE;
  }
  return numericValue;
}

function buildLocalReceiptProof({ address, product, amount, shares, receiptMode, purchasedAt, productDetail }) {
  const payload = JSON.stringify({
    kind: 'risklens.wealth-receipt-proof.v1',
    address: String(address || '').toLowerCase(),
    productId: product?.id || '',
    productName: product?.name || '',
    shareToken: product?.shareToken || '',
    amount: roundNumber(amount, 2),
    shares: roundNumber(shares, 6),
    receiptMode,
    purchasedAt,
    productDetail
  });
  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = (hash << 5) - hash + payload.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

function formatOnchainTimestamp(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return 'No attestation published yet';

  return new Date(seconds * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function riskClass(risk) {
  return risk === 'Low' ? 'risk-low' : risk === 'Medium' ? 'risk-medium' : 'risk-high';
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

function isProductSnapshotList(value) {
  return Array.isArray(value) && value.every((item) => item?.id && Number.isFinite(Number(item?.nav)));
}

function getInitialLiveProducts() {
  const cached = readStorageJson(WEALTH_LIVE_CACHE_KEY, null);
  return isProductSnapshotList(cached?.products) ? cached.products : WEALTH_PRODUCTS;
}

function getInitialLiveSnapshotState() {
  const cached = readStorageJson(WEALTH_LIVE_CACHE_KEY, null);
  return isProductSnapshotList(cached?.products) ? 'cached' : 'loading';
}

function getInitialDay1BriefState() {
  const cached = readStorageJson(DAY1_BRIEF_CACHE_KEY, null);

  if (cached?.data?.timestamp) {
    return {
      status: 'cached',
      data: cached.data,
      sourceLabel: cached.sourceLabel || cached.data?._sourceLabel || 'Cached Day1 snapshot',
      note: cached.note || 'Cached market overlay loaded first to reduce layout shift while the live brief refreshes.'
    };
  }

  return {
    status: 'loading',
    data: null,
    sourceLabel: '',
    note: ''
  };
}

function liveProductsEqual(currentProducts = [], nextProducts = []) {
  if (currentProducts.length !== nextProducts.length) return false;

  return currentProducts.every((product, index) => {
    const nextProduct = nextProducts[index];
    return (
      product.id === nextProduct?.id &&
      Number(product.nav) === Number(nextProduct?.nav) &&
      product.asOfLabel === nextProduct?.asOfLabel &&
      product.marketSource === nextProduct?.marketSource
    );
  });
}

function day1SnapshotsEqual(currentSnapshot, nextSnapshot) {
  if (!currentSnapshot && !nextSnapshot) return true;
  if (!currentSnapshot || !nextSnapshot) return false;

  return (
    currentSnapshot.timestamp === nextSnapshot.timestamp &&
    currentSnapshot._sourceLabel === nextSnapshot._sourceLabel
  );
}

function getProgressStorageKey(address) {
  return address ? `msx-progress-${address.toLowerCase()}` : '';
}

function getPaperReplayStateKey(address) {
  return address ? `msx-paper-replay-state-${address.toLowerCase()}` : '';
}

function getWealthStateKey(address) {
  return address ? `msx-wealth-state-${address.toLowerCase()}` : '';
}

function defaultWealthState() {
  return {
    cash: WEALTH_STARTING_CASH,
    positions: {},
    collateral: {},
    activityLog: []
  };
}

function normalizeWealthTaskClaims(value = {}) {
  const claims = value && typeof value === 'object' ? value : {};
  return {
    subscribe: Boolean(claims.subscribe),
    settlement: Boolean(claims.settlement)
  };
}

function normalizeWealthState(value) {
  const rawPositions = value?.positions && typeof value.positions === 'object' ? value.positions : {};
  const positions = Object.fromEntries(
    Object.entries(rawPositions)
      .map(([productId, position]) => {
        const shares = Number(position?.shares || 0);
        const principal = Number(position?.principal || 0);

        if (!Number.isFinite(shares) || shares <= 0) return null;

        return [
          productId,
          {
            shares: roundNumber(shares, 6),
            principal: roundNumber(Number.isFinite(principal) ? principal : 0, 2),
            entryNav: Number(position?.entryNav || 0),
            entryTs: position?.entryTs || '',
            lastActivityTs: position?.lastActivityTs || position?.lastSubscribeTs || position?.entryTs || ''
          }
        ];
      })
      .filter(Boolean)
  );
  const rawCollateral = value?.collateral && typeof value.collateral === 'object' ? value.collateral : {};
  const collateral = Object.fromEntries(
    Object.entries(rawCollateral)
      .map(([productId, entry]) => {
        const pledgedShares = Number(entry?.pledgedShares || 0);
        const borrowedAmount = Number(entry?.borrowedAmount || 0);

        if (!Number.isFinite(pledgedShares) || pledgedShares <= 0) return null;

        return [
          productId,
          {
            pledgedShares: roundNumber(pledgedShares, 6),
            borrowedAmount: roundNumber(Number.isFinite(borrowedAmount) ? borrowedAmount : 0, 2),
            advanceRate: Number(entry?.advanceRate || 0),
            termMode: entry?.termMode || 'flex',
            apy: Number(entry?.apy || 0),
            updatedAt: entry?.updatedAt || '',
            supportOnly: Boolean(entry?.supportOnly)
          }
        ];
      })
      .filter(Boolean)
  );

  return {
    cash: getWealthSpendableCash(value),
    positions,
    collateral,
    activityLog: Array.isArray(value?.activityLog) ? value.activityLog.slice(0, WEALTH_ACTIVITY_LIMIT) : []
  };
}

function roundNumber(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function getProductByIdFrom(products, productId) {
  return products.find((product) => product.id === productId) || products[0] || null;
}

function formatValue(value, hidden, digits = 0, suffix = ' PT') {
  if (hidden) return `---${suffix}`;
  return `${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}${suffix}`;
}

function formatSignedValue(value, hidden, digits = 0, suffix = ' PT') {
  if (hidden) return `---${suffix}`;
  const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${prefix}${Math.abs(Number(value || 0)).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}${suffix}`;
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

  return accounts
    .sort((left, right) => profileBackupTimeValue(right.signedAt) - profileBackupTimeValue(left.signedAt))
    .slice(0, 3);
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

function WealthWalletModal({
  open,
  onClose,
  onConnect,
  onDisconnect,
  onSaveNickname,
  isPending,
  isConnected,
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
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);

  useEffect(() => {
    setDisconnectConfirmOpen(false);
  }, [isConnected, open]);

  if (!open) return null;

  function requestDisconnect() {
    setDisconnectConfirmOpen(true);
  }

  function confirmDisconnect() {
    setDisconnectConfirmOpen(false);
    onDisconnect?.();
  }

  return (
    <div className="wallet-modal-backdrop" onClick={(event) => event.target === event.currentTarget && !isPending && onClose()}>
      <div className="wallet-modal">
        <button className="wallet-modal-close" onClick={onClose} disabled={isPending} aria-label="Close wallet modal">
          X
        </button>
        <div className="wallet-modal-pane wallet-modal-sidebar">
          <div className="wallet-modal-title">RiskLens Wallet</div>
          <div className="wallet-modal-subtitle">Wealth wallet access</div>
          <button
            className={`wallet-option ${isConnected ? 'connected' : ''} ${isPending || (!isConnected && !hasMetaMaskInstalled) ? 'disabled' : ''}`}
            onClick={isConnected ? requestDisconnect : onConnect}
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
          {isConnected && disconnectConfirmOpen ? (
            <div className="wallet-disconnect-confirm">
              <div className="wallet-disconnect-confirm-copy">
                Disconnect this browser session? Your nickname and signed backups stay saved for the wallet address.
              </div>
              <div className="toolbar">
                <button type="button" className="ghost-btn compact" onClick={() => setDisconnectConfirmOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="secondary-btn compact" onClick={confirmDisconnect}>
                  Confirm disconnect
                </button>
              </div>
            </div>
          ) : null}
          {!hasMetaMaskInstalled ? (
            <div className="wallet-install-card">
              <div className="wallet-install-title">MetaMask not detected</div>
              <div className="wallet-install-copy">
                Install and pin the official MetaMask browser extension, then reopen this wallet panel before connecting.
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
        <div className={`wallet-modal-pane wallet-modal-main ${isConnected ? 'wallet-modal-main-connected' : ''} ${profileBackupAccounts.length ? 'wallet-modal-main-has-backup' : ''}`}>
          <MetaMaskIcon className="wallet-modal-hero wallet-modal-hero-metamask" />
          <div className="wallet-modal-status">
            {isConnected
              ? 'Wallet connected'
              : !hasMetaMaskInstalled
                ? 'Install MetaMask first'
                : isPending
                  ? 'Confirm connection in MetaMask'
                  : 'Connect MetaMask'}
          </div>
          <div className="wallet-modal-copy">
            {isConnected
              ? `This Wealth page is using wallet ${walletDisplayName}. The wallet-linked positions, receipt balances, and remaining PT all follow this connected address.`
              : 'Connect MetaMask to keep the Wealth ledger, receipt balances, and Paper carry-over tied to the same wallet on this device.'}
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
                <div className="wealth-profile-storage-title">Keep Wealth state recoverable</div>
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
                    Historical account login (latest 3)
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
                    Backup is a local signed snapshot now. Its content hash is decentralized-storage-ready for IPFS, Filecoin, Ceramic, or Arweave, but it is not uploaded automatically.
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
          {!isConnected && hasMetaMaskInstalled ? (
            <button className="primary-btn" onClick={onConnect} disabled={isPending}>
              {isPending ? 'Connecting...' : 'Connect MetaMask'}
            </button>
          ) : null}
          {isConnected ? (
            <button className="secondary-btn" onClick={requestDisconnect}>
              Disconnect wallet
            </button>
          ) : null}
          {errorText ? <div className="env-hint" style={{ maxWidth: 360 }}>{errorText}</div> : null}
          {nicknameFeedback ? <div className="env-hint" style={{ maxWidth: 360 }}>{nicknameFeedback}</div> : null}
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
  remainingPt,
  walletProfilePanel
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
          <div className="wallet-modal-subtitle">Wealth controls</div>
          <div className="wallet-install-copy">
            Browser-local admin access for the Wealth page. Sign in for the current use; the panel does not reuse a saved developer login.
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
                Wealth developer review is open for this signed-in use, so you can inspect wallet-linked cash, holdings, and routing behavior without making the page default to admin mode.
              </div>
              {walletProfilePanel ? (
                <div className="developer-wallet-profile-panel">
                  {walletProfilePanel}
                </div>
              ) : null}
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

function formatShareBalance(value, hidden) {
  if (hidden) return '---';
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  });
}

function formatSignedScore(value) {
  const numericValue = Number(value || 0);
  return `${numericValue > 0 ? '+' : ''}${numericValue}`;
}

function formatSignedDollar(value, digits = 1) {
  const numericValue = Number(value || 0);
  return `${numericValue >= 0 ? '+' : '-'}$${Math.abs(numericValue).toFixed(digits)}`;
}

function getAnnualYieldRate(product) {
  const explicitRate = Number(product?.annualYieldRate);
  if (Number.isFinite(explicitRate) && explicitRate > 0) return explicitRate;

  const dailyRate = Number(product?.dailyYieldRate || 0);
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) return 0;

  return Math.pow(1 + dailyRate, 365) - 1;
}

function formatYieldPercent(rate, hidden = false, digits = 2) {
  if (hidden) return '---%';
  return `${(Number(rate || 0) * 100).toFixed(digits)}%`;
}

function getAnnualYieldBasis(product) {
  return product?.annualYieldBasis || 'Modeled annualized carry';
}

function getAnnualYieldSource(product) {
  return product?.annualYieldSource || 'RiskLens tutorial annualized carry assumption.';
}

function getReturnMetricLabels(product = {}) {
  const text = `${product.productType || ''} ${product.name || ''}`.toLowerCase();

  if (/dual investment|dual currency/.test(text)) {
    return { metric: 'Payoff range', basis: 'Range basis', subtext: 'no floor / capped premium' };
  }
  if (/protected growth|defined outcome|buffer/.test(text)) {
    return { metric: 'Outcome cap', basis: 'Outcome basis', subtext: 'cap' };
  }
  if (/premium income|covered call|option premium/.test(text)) {
    return { metric: 'Modeled income', basis: 'Income basis', subtext: 'income' };
  }
  if (/auto-call|autocall/.test(text)) {
    return { metric: 'Conditional coupon', basis: 'Coupon basis', subtext: 'coupon' };
  }

  return { metric: 'Annual yield', basis: 'Yield basis', subtext: 'annual' };
}

function parsePercentRange(text = '') {
  return [...`${text}`.matchAll(/(\d+(?:\.\d+)?)%/g)]
    .map((match) => Number(match[1]) / 100)
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function getDualInvestmentTermDays(product = {}) {
  const text = `${product.redemption || ''} ${product.annualYieldSource || ''} ${product.fees?.lockup || ''}`;
  const match = text.match(/(\d+)\s*(?:-|\s)?\s*(?:day|days|d)\b/i);
  const days = Number(match?.[1] || 7);
  return Number.isFinite(days) && days > 0 ? days : 7;
}

function getDualInvestmentPayoffRange(product = {}, hidden = false) {
  const days = getDualInvestmentTermDays(product);
  const aprRange = parsePercentRange(product.apyRange || product.annualYieldBasis || product.annualYieldSource);
  const modeledApr = Math.max(0, Number(product.annualYieldRate || 0));
  const lowerApr = aprRange[0] ?? modeledApr * 0.6;
  const upperApr = aprRange[1] ?? Math.max(modeledApr, lowerApr) * 1.35;
  const lowerPremium = lowerApr * (days / 365);
  const upperPremium = Math.max(lowerPremium, upperApr * (days / 365));
  const premiumRange = hidden
    ? '---% to ---%'
    : `+${(lowerPremium * 100).toFixed(2)}% to +${(upperPremium * 100).toFixed(2)}%`;

  return {
    metric: 'Payoff range',
    value: hidden ? '---' : `No fixed floor - +${(upperPremium * 100).toFixed(2)}% cap`,
    basis: `${days}D premium quote ${premiumRange}; not annual yield`,
    cap: hidden ? 'Upper cap hidden' : `Upper cap +${(upperPremium * 100).toFixed(2)}% term premium`,
    floor: 'Lower bound: no fixed floor because settlement can convert into the less desired asset.',
    subtext: 'no floor / capped premium',
    tone: 'risk-medium',
    sortRate: upperApr
  };
}

function getProductReturnMetricDisplay(product = {}, hidden = false) {
  if (isDualInvestmentProduct(product)) {
    return getDualInvestmentPayoffRange(product, hidden);
  }

  const labels = getReturnMetricLabels(product);
  const annualYieldRate = getAnnualYieldRate(product);

  return {
    metric: labels.metric,
    value: formatYieldPercent(annualYieldRate, hidden),
    basis: getAnnualYieldBasis(product),
    subtext: labels.subtext,
    tone: annualYieldRate >= 0 ? 'risk-low' : 'risk-high',
    sortRate: annualYieldRate
  };
}

function isClosedEndProduct(product) {
  return product?.termType === 'closed';
}

function isCollateralPilotProduct(product) {
  return Boolean(product?.id && product?.shareToken && Number(product?.nav) > 0);
}

function getCollateralAdvanceRate(product) {
  const surface = getWealthProductSurface(product);
  const bucket = product?.bucket;

  if (surface === 'cash') return 0.72;
  if (surface === 'earn') return 0.58;
  if (surface === 'public') return 0.5;
  if (surface === 'private') return 0.25;
  if (surface === 'auto' || bucket === 'strategy') return 0.38;
  if (isClosedEndProduct(product)) return 0.35;

  return DEFAULT_COLLATERAL_ADVANCE_RATE;
}

function getCollateralApy(product, termMode = 'flex') {
  const difficulty = getProductDifficulty(product);
  const baseRate = difficulty.id === 'easy' ? 0.032 : difficulty.id === 'medium' ? 0.052 : 0.082;
  return termMode === 'fixed' ? baseRate + 0.018 : baseRate;
}

function appendWealthActivity(state, entry) {
  const activityLog = Array.isArray(state.activityLog) ? state.activityLog : [];

  return {
    ...state,
    activityLog: [
      {
        id: `${Date.now()}-${entry.type || 'activity'}`,
        ts: new Date().toISOString(),
        ...entry
      },
      ...activityLog
    ].slice(0, WEALTH_ACTIVITY_LIMIT)
  };
}

function getActivityTypeSet(wealthState) {
  return new Set((wealthState?.activityLog || []).map((entry) => entry?.type).filter(Boolean));
}

function getLatestWealthActivity(wealthState, types = [], productId = '') {
  const acceptedTypes = new Set(Array.isArray(types) ? types : [types]);
  return (wealthState?.activityLog || []).find((entry) => {
    if (!entry || !acceptedTypes.has(entry.type)) return false;
    return !productId || entry.productId === productId;
  }) || null;
}

function hasWealthActivity(wealthState, types = [], productId = '') {
  return Boolean(getLatestWealthActivity(wealthState, types, productId));
}

function getDualCurrencyFit(product = {}) {
  const surface = getWealthProductSurface(product);
  const text = `${product.name || ''} ${product.shortName || ''} ${product.productType || ''} ${product.underlying || ''} ${product.yieldSource || ''}`.toLowerCase();

  if (surface === 'public' || /xstocks|listed|btc|eth|crypto|quant/.test(text)) {
    return {
      label: 'Good structured overlay',
      tone: 'risk-low',
      copy: 'Dual-currency logic can sit on top of this as target-price income: the user earns a premium and accepts settlement into cash or the reference asset.'
    };
  }

  if (surface === 'cash' || /treasury|money fund|cash|usdc|usdt|stable/.test(text)) {
    return {
      label: 'Settlement leg only',
      tone: 'risk-medium',
      copy: 'This can provide the quote/stablecoin side, but the dual-currency risk should still reference a liquid asset such as BTC, ETH, or a listed wrapper.'
    };
  }

  if (surface === 'private') {
    return {
      label: 'Poor fit',
      tone: 'risk-high',
      copy: 'Private or transfer-window products lack continuous target-price settlement, so dual-currency mechanics would be misleading here.'
    };
  }

  return {
    label: 'Review fit',
    tone: 'risk-medium',
    copy: 'This can be shown as an advanced structured route only if the reference price, settlement asset, and downside ownership are explicit.'
  };
}

function getProductDifficulty(product = {}) {
  const surface = getWealthProductSurface(product);
  const risk = `${product.risk || ''}`.toLowerCase();

  if (surface === 'private' || product.bucket === 'strategy' || isClosedEndProduct(product) || risk === 'high') {
    return { id: 'hard', label: 'Hard', tone: 'risk-high', copy: 'Needs comfort with lockups, marks, and exit uncertainty.' };
  }

  if (risk === 'medium' || surface === 'public' || surface === 'earn') {
    return { id: 'medium', label: 'Medium', tone: 'risk-medium', copy: 'Good after the user understands NAV movement and settlement timing.' };
  }

  return { id: 'easy', label: 'Easy', tone: 'risk-low', copy: 'Best first step: clearer cash flow, simpler receipt, and easier exit framing.' };
}

function getWealthProductSurface(product = {}) {
  const text = `${product.id || ''} ${product.bucket || ''} ${product.productType || ''} ${product.underlying || ''} ${product.yieldSource || ''}`.toLowerCase();

  if (/dual investment|dual currency|protected growth|defined outcome|premium income|covered call|auto-call|autocall|structured note/.test(text)) return 'structured';
  if (/private-watchlist|pre-ipo|private-growth|spv|private share|late-stage|private credit|secondary window|private growth/.test(text)) return 'private';
  if (/listed equity|etf-style/.test(text)) return 'public';
  if (/quant|managed|strategy|auto|closed-end quant/.test(text)) return 'auto';
  if (/treasury|t-bill|money fund|liquidity fund|cash management|reserve|repo|buidl|ustb|usdy|ousg|usyc|tbill|franklin/.test(text)) return 'cash';
  if (/carry|yield|income|basis|credit spread|term premium/.test(text)) return 'earn';

  return 'earn';
}

function getDisplayProductTypeLabel(product = {}) {
  const surface = getWealthProductSurface(product);

  return surface === 'cash' ? 'Cash & Treasury' : product.productType || getTermTypeLabel(product);
}

function getRiskBalancedRecommendedProducts(products = []) {
  const usedProductIds = new Set();

  return DEFAULT_RISK_RECOMMENDATION_BUCKETS.map((bucket) => {
    const preferredProduct = bucket.ids
      .map((productId) => products.find((product) => product.id === productId))
      .find((product) => product && !usedProductIds.has(product.id));
    const fallbackProduct = products.find(
      (product) =>
        !usedProductIds.has(product.id) &&
        String(product.risk || '').toLowerCase() === bucket.risk.toLowerCase()
    );
    const selectedProduct = preferredProduct || fallbackProduct;

    if (selectedProduct) {
      usedProductIds.add(selectedProduct.id);
    }

    return selectedProduct;
  }).filter(Boolean);
}

function getStableHash(value = '') {
  return Array.from(String(value)).reduce((hash, char) => {
    const nextHash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return nextHash >>> 0;
  }, 2166136261);
}

function getStableRandomValue(seed = '', key = '') {
  return getStableHash(`${seed}:${key}`) / 4294967295;
}

function getProductRecommendationScore(product = {}, day1Data = null) {
  const model = buildDiligenceModel(product, day1Data);
  const returnMetric = getProductReturnMetricDisplay(product);
  const annualYieldRate = Number.isFinite(Number(returnMetric.sortRate))
    ? Number(returnMetric.sortRate)
    : getAnnualYieldRate(product);
  const cappedYieldScore = Math.max(0, Math.min(1.2, annualYieldRate)) * 100;

  return (model.finalScore || product.diligenceScore || 0) + cappedYieldScore;
}

function getRandomizedTopRecommendedProducts(products = [], { day1Data = null, seed = '', limit = 3 } = {}) {
  const rankedRows = products
    .filter(Boolean)
    .map((product) => ({
      product,
      score: getProductRecommendationScore(product, day1Data),
      random: getStableRandomValue(seed, product.id || product.name)
    }))
    .sort((left, right) => right.score - left.score || left.product.name.localeCompare(right.product.name));
  const candidatePool = rankedRows.slice(0, Math.max(limit, Math.min(6, rankedRows.length)));

  return candidatePool
    .sort((left, right) => right.random - left.random || right.score - left.score)
    .slice(0, limit)
    .map((row) => row.product);
}

function productMatchesWealthGoal(product, goalId) {
  if (!goalId) return true;
  if (product.goals?.includes(goalId)) return true;
  const surface = getWealthProductSurface(product);

  if (goalId === 'parkCash') return surface === 'cash';
  if (goalId === 'earn') return surface === 'earn' || surface === 'cash';
  if (goalId === 'public') return surface === 'public' || (surface === 'private' && /pre-ipo|private-growth|late-stage|secondary window|private growth/i.test(`${product.id || ''} ${product.productType || ''} ${product.name || ''} ${product.underlying || ''}`));
  if (goalId === 'private') return surface === 'private';
  if (goalId === 'auto') return surface === 'auto';

  return product.goals?.includes(goalId);
}

function productMatchesWealthCategory(product, categoryId) {
  if (!categoryId || categoryId === 'all') return true;
  const surface = getWealthProductSurface(product);
  const text = `${product.id || ''} ${product.productType || ''} ${product.name || ''} ${product.yieldSource || ''}`.toLowerCase();

  if (categoryId === 'public') return surface === 'public' || surface === 'private' || /pre-ipo|private-growth|late-stage|private share|secondary window|private growth|spv access/.test(text);
  if (categoryId === 'private') return surface === 'private' || /pre-ipo|private-growth|late-stage|private share|secondary window|private growth|spv access/.test(text);
  if (categoryId === 'dual') return isDualInvestmentProduct(product);
  if (isDualInvestmentProduct(product) && categoryId !== 'growth') return false;
  if (categoryId === 'protected') {
    const risk = String(product.risk || '').toLowerCase();
    return (
      surface === 'cash' ||
      (risk === 'low' && surface !== 'private' && surface !== 'public') ||
      /protected growth|defined outcome|buffer|premium income|covered call|option premium|auto-call|autocall|snowball/.test(text) ||
      WEALTH_OPPORTUNITY_PRODUCT_IDS.protected?.has(product.id) ||
      WEALTH_OPPORTUNITY_PRODUCT_IDS.protectedGrowth?.has(product.id) ||
      WEALTH_OPPORTUNITY_PRODUCT_IDS.premiumIncome?.has(product.id) ||
      WEALTH_OPPORTUNITY_PRODUCT_IDS.autoCall?.has(product.id)
    );
  }
  if (categoryId === 'growth') {
    return (
      surface === 'private' ||
      surface === 'public' ||
      surface === 'auto' ||
      String(product.risk || '').toLowerCase() === 'high' ||
      product.goals?.some((goalId) => ['bullish', 'highYield', 'public', 'private'].includes(goalId)) ||
      /pre-ipo|private-growth|late-stage|private share|secondary window|private growth|spv access/.test(text) ||
      WEALTH_OPPORTUNITY_PRODUCT_IDS.growth?.has(product.id)
    );
  }
  if (categoryId === 'protectedGrowth') return /protected growth|defined outcome|buffer/.test(text) || WEALTH_OPPORTUNITY_PRODUCT_IDS[categoryId]?.has(product.id);
  if (categoryId === 'premiumIncome') return /premium income|covered call|option premium|put-write/.test(text) || WEALTH_OPPORTUNITY_PRODUCT_IDS[categoryId]?.has(product.id);
  if (categoryId === 'autoCall') return /auto-call|autocall|snowball/.test(text) || WEALTH_OPPORTUNITY_PRODUCT_IDS[categoryId]?.has(product.id);
  if (categoryId === 'privateCredit') return /private credit|credit fund/.test(text) || WEALTH_OPPORTUNITY_PRODUCT_IDS[categoryId]?.has(product.id);
  if (WEALTH_OPPORTUNITY_PRODUCT_IDS[categoryId]) {
    return WEALTH_OPPORTUNITY_PRODUCT_IDS[categoryId].has(product.id);
  }
  return surface === categoryId || product.termType === categoryId;
}

function getActiveWealthProductFilterIds(wrapperCategoryId = 'all', productTypeCategoryId = 'all') {
  return [wrapperCategoryId, productTypeCategoryId].filter((categoryId) => categoryId && categoryId !== 'all');
}

function getPrimaryWealthProductFilterId(wrapperCategoryId = 'all', productTypeCategoryId = 'all') {
  if (productTypeCategoryId && productTypeCategoryId !== 'all') return productTypeCategoryId;
  if (wrapperCategoryId && wrapperCategoryId !== 'all') return wrapperCategoryId;
  return 'all';
}

function productMatchesWealthProductFilters(product, categoryIds = []) {
  return !categoryIds.length || categoryIds.every((categoryId) => productMatchesWealthCategory(product, categoryId));
}

function getGoalIdForProduct(product) {
  const surface = getWealthProductSurface(product);

  if (surface === 'cash') return 'parkCash';
  if (surface === 'public') return 'public';
  if (surface === 'private') return 'private';
  if (surface === 'auto') return 'auto';
  return 'earn';
}

function getCategoryIdForProduct(product) {
  const surface = getWealthProductSurface(product);
  const text = `${product.productType || ''} ${product.name || ''} ${product.id || ''}`.toLowerCase();

  if (/dual investment|dual currency/.test(text)) return 'dual';
  if (/protected growth|defined outcome|premium income|covered call|auto-call|autocall/.test(text)) return 'protected';
  if (/pre-ipo|private-growth|late-stage|private share|secondary window|private growth|spv access/.test(text)) return 'growth';
  if (/premium income|covered call/.test(text)) return 'premiumIncome';
  if (/auto-call|autocall/.test(text)) return 'autoCall';
  if (/private credit|credit fund/.test(text)) return 'privateCredit';
  if (surface === 'private') return 'growth';
  if (surface === 'earn') return 'all';
  return ['cash', 'public', 'auto'].includes(surface) ? surface : 'all';
}

function isDualInvestmentProduct(product = {}) {
  const text = `${product.id || ''} ${product.productType || ''} ${product.name || ''} ${product.shortName || ''} ${product.underlying || ''} ${product.yieldSource || ''}`.toLowerCase();
  return /dual investment|dual currency|dual-btc|buy-the-dip|reverse convertible/.test(text);
}

function productMatchesAiRecommendationLane(product = {}, laneId = '') {
  const surface = getWealthProductSurface(product);

  if (laneId === 'dual') return isDualInvestmentProduct(product);
  if (laneId === 'private') return surface === 'private' || productMatchesWealthCategory(product, 'private');
  if (laneId === 'cash') return surface === 'cash';
  return true;
}

function getAiRecommendationBenefitReason(product = {}, walletProfileLevel = 'starter') {
  const surface = getWealthProductSurface(product);
  const returnMetric = getProductReturnMetricDisplay(product);
  const returnCopy = returnMetric?.value && returnMetric.value !== 'N/A' ? `${returnMetric.value} modeled return` : 'clearer carry';

  if (isDualInvestmentProduct(product)) {
    return `${returnCopy} can be attractive for premium income, but risk is high because settlement can convert into the paired asset.`;
  }

  if (surface === 'private') {
    return `private-market upside can be higher than treasury carry, with higher liquidity and valuation risk.`;
  }

  if (surface === 'cash') {
    return `${returnCopy} with simpler redemption and lower strategy complexity than growth products.`;
  }

  if (walletProfileLevel === 'advanced') {
    return `${returnCopy} fits a wallet that can compare higher return potential against more complex exit terms.`;
  }

  return `${returnCopy} is easier to evaluate because the return source, risk level, and exit terms stay visible.`;
}

function walletLearningProfileCopy({
  walletProfileLevel = 'starter',
  isConnected = false,
  guideTaskDone = false,
  quizTaskDone = false,
  paperTaskDone = false,
  paperFlashSignal = false
} = {}) {
  if (!isConnected) {
    return 'No wallet is connected yet, so Wealth should keep the first click focused on wallet connection and simple cash-style product education.';
  }

  if (walletProfileLevel === 'advanced') {
    return paperFlashSignal
      ? 'This wallet has paper-trading and leverage or flash-loan signals, so AI can surface structured or strategy products as long as diligence and monitor controls stay visible.'
      : 'This wallet has enough receipt, paper, collateral, or settlement history to handle more complex wealth products with a full detail review first.';
  }

  if (walletProfileLevel === 'intermediate') {
    return 'This wallet has learning or quiz progress, so AI can recommend a yield or structured-next-step product while keeping NAV, lockup, and exit terms explicit.';
  }

  if (guideTaskDone || quizTaskDone || paperTaskDone) {
    return 'This wallet has started the guided path but still needs simple ownership, return-source, and exit framing before a complex product is pushed.';
  }

  return 'This wallet is still a starter profile; recommend a clear receipt and a low-complexity product before asking for any subscription action.';
}

function getWealthProductTypeTooltip(category = {}) {
  if (category.id === 'all') return 'Show every productized wealth receipt in the current shelf.';
  if (category.id === 'dual') {
    return 'Dual Investment packages a target-price buy-low or sell-high rule with option-like premium and conversion risk.';
  }

  const homeNote = WEALTH_HOME_SURFACE_NOTES[category.id];
  if (homeNote) {
    return `${homeNote.layer}: own ${homeNote.owns}; earn from ${homeNote.earn}; liquidity is ${homeNote.liquidity}. Rights: ${homeNote.rights}.`;
  }

  const opportunity = WEALTH_OPPORTUNITY_TYPES.find((type) => type.filterCategory === category.id);
  if (opportunity) {
    return `${opportunity.tradFi}: ${opportunity.why} ${opportunity.userCopy}`;
  }

  return category.label || 'Product type';
}

function getWealthProductFactRows(product = {}) {
  const surface = getWealthProductSurface(product);
  const settlementPolicy = getSettlementPolicy(product);
  const returnDisplay = getProductReturnMetricDisplay(product);
  const surfaceNote =
    surface === 'cash'
      ? 'Cash & Treasury'
      : surface === 'public'
        ? 'Listed equity'
        : surface === 'private'
          ? 'Pre-IPO Growth'
          : surface === 'auto'
            ? 'Managed Strategy'
            : 'Earn / Yield';
  const productTypeText = `${product.productType || ''}`.toLowerCase();
  const earnLabel = productTypeText.includes('dual')
    ? returnDisplay.value
    : productTypeText.includes('protected growth')
      ? 'Capped upside'
      : productTypeText.includes('premium income')
        ? 'Option premium'
        : getAnnualYieldRate(product) > 0
          ? formatYieldPercent(getAnnualYieldRate(product))
          : 'No fixed yield';

  return [
    { label: 'What you own', value: `${surfaceNote} receipt`, copy: product.baseAsset || product.shareToken || 'Product wrapper exposure' },
    { label: 'Return source', value: earnLabel, copy: isDualInvestmentProduct(product) ? `${returnDisplay.basis}. ${returnDisplay.floor}` : product.yieldSource || 'Return source must be disclosed before subscription.' },
    { label: 'Liquidity', value: settlementPolicy.label, copy: settlementPolicy.detail || product.redemption || 'Liquidity depends on the product route.' },
    { label: 'Main risk', value: product.risk || 'Review', copy: product.worstCase || product.riskNote || 'Downside and execution risk must remain visible.' },
    { label: 'Rights', value: product.shareToken || 'Receipt', copy: product.shareRights?.[0] || 'Rights depend on wrapper, token, and issuer terms.' }
  ];
}

function getTermTypeLabel(product) {
  return isClosedEndProduct(product) ? 'Term / maturity' : 'Flexible redeem';
}

function getSettlementPolicy(product = {}) {
  if (product?.id && WEALTH_SETTLEMENT_POLICIES[product.id]) {
    return WEALTH_SETTLEMENT_POLICIES[product.id];
  }

  const redemption = `${product?.redemption || ''}`.toLowerCase();
  if (isClosedEndProduct(product) || /no investor redemption|no early|closed-end|maturity|transfer-only|liquidity event/.test(redemption)) {
    return {
      label: 'No early redeem',
      timing: 'Maturity or event only',
      tone: 'risk-high',
      redeemable: false,
      detail: product?.redemption || 'This sleeve should not expose an always-on redeem button.'
    };
  }

  if (/t\+1|next.*business|business-day|business day|queue/.test(redemption)) {
    return {
      label: 'T+1 / queue',
      timing: 'Next business day style',
      tone: 'risk-medium',
      redeemable: true,
      detail: product?.redemption || 'Redemption uses a routed business-day or queue process.'
    };
  }

  if (/24\/7|24\/7\/365|instant|continuous/.test(redemption)) {
    return {
      label: 'Continuous route',
      timing: '24/7 or continuous where eligible',
      tone: 'risk-low',
      redeemable: true,
      detail: product?.redemption || 'Continuous redemption still depends on route, eligibility, and thresholds.'
    };
  }

  if (/market-day|daily|fund-style|channel/.test(redemption)) {
    return {
      label: 'Market-day route',
      timing: 'Market-day / fund channel',
      tone: 'risk-medium',
      redeemable: true,
      detail: product?.redemption || 'Redemption depends on product channel and market-day processing.'
    };
  }

  return {
    label: 'Review timing',
    timing: 'Read product terms',
    tone: 'risk-medium',
    redeemable: true,
    detail: product?.redemption || 'Settlement timing is product-specific and should stay visible before purchase.'
  };
}

function isRedeemableProduct(product = {}) {
  return Boolean(getSettlementPolicy(product).redeemable);
}

function getWealthLockDays(product = {}) {
  const policy = getSettlementPolicy(product);
  const text = `${policy.timing || ''} ${policy.detail || ''} ${product?.fees?.lockup || ''} ${product?.redemption || ''}`.toLowerCase();

  if (/7-day|7 day|weekly/.test(text)) return 7;
  if (/90-day|90 day|quarter/.test(text)) return 90;
  if (/12-month|12 month|1-year|1 year|annual/.test(text)) return 365;
  if (/monthly|30-day|30 day/.test(text)) return 30;
  if (/maturity|closed-end|no early|transfer-only|liquidity event/.test(text)) return 180;
  return 0;
}

function getWealthPositionHoldingDays(position = {}) {
  const entryTime = new Date(position?.entryTs || '').getTime();
  if (!Number.isFinite(entryTime)) return 0;
  return Math.max(0, Math.floor((Date.now() - entryTime) / DAY_MS));
}

function getWealthLockStatus(product = {}, position = {}, forwardDays = 0) {
  const lockDays = getWealthLockDays(product);
  const holdingDays = getWealthPositionHoldingDays(position);
  const totalDays = holdingDays + Math.max(0, Number(forwardDays || 0));
  const daysLeft = Math.max(0, lockDays - totalDays);
  const earlyHaircutRate = lockDays > 0 ? Math.min(0.18, 0.025 + daysLeft / Math.max(1, lockDays) * 0.075) : 0;

  return {
    lockDays,
    holdingDays,
    totalDays,
    daysLeft: Math.ceil(daysLeft),
    isLocked: lockDays > 0 && daysLeft > 0,
    isMature: lockDays > 0 && daysLeft <= 0,
    earlyHaircutRate
  };
}

function getPledgeLockStatus(product = {}, collateral = {}, selectedMode = 'flex', forwardDays = 0) {
  const termMode = collateral?.termMode || selectedMode || 'flex';
  const lockDays = termMode === 'fixed' ? Math.max(30, getWealthLockDays(product) || 30) : 0;
  const updatedTime = new Date(collateral?.updatedAt || '').getTime();
  const activeDays = Number.isFinite(updatedTime) ? Math.max(0, Math.floor((Date.now() - updatedTime) / DAY_MS)) : 0;
  const totalDays = activeDays + Math.max(0, Number(forwardDays || 0));
  const daysLeft = Math.max(0, lockDays - totalDays);

  return {
    termMode,
    lockDays,
    activeDays,
    totalDays,
    daysLeft: Math.ceil(daysLeft),
    isFixed: termMode === 'fixed',
    isLocked: termMode === 'fixed' && daysLeft > 0,
    isMature: termMode === 'fixed' && lockDays > 0 && daysLeft <= 0
  };
}

function getAmountPresetRows({ minimumTicket = WEALTH_MIN_SUBSCRIPTION, availableCash = 0, currentAmount = 0 } = {}) {
  const min = Math.max(WEALTH_MIN_SUBSCRIPTION, Number(minimumTicket || 0));
  const max = Math.max(0, Math.floor(Number(availableCash || 0)));
  const fixedPresets = WEALTH_AMOUNT_PRESET_VALUES.filter((value) => value >= min && value <= Math.max(max, min));
  const rows = fixedPresets.map((value) => ({
    id: `amount-${value}`,
    label: value >= 10000 ? `${value / 1000}k` : value.toLocaleString(),
    value
  }));

  if (max > 0) {
    rows.push({ id: 'amount-max', label: 'Max', value: max, isMax: true });
  }

  const seenPresetKeys = new Set();
  return rows
    .filter((row) => {
      const key = row.isMax ? 'max' : row.value;
      if (seenPresetKeys.has(key)) return false;
      seenPresetKeys.add(key);
      return true;
    })
    .map((row) => ({ ...row, active: Number(currentAmount || 0) === row.value, disabled: row.value <= 0 }));
}

function getForwardProjectedNav(product, days) {
  if (!Number.isFinite(days) || days <= 0) return Number(product?.nav || 0);
  return Number((Number(product?.nav || 0) * Math.pow(1 + getAnnualYieldRate(product), days / 365)).toFixed(3));
}

function getUnlockCopy(product, progressState) {
  if (product.bucket === 'strategy' && !progressState.guideCompleted) {
    return 'Review 4 product briefings first to unlock the managed-strategy shelf.';
  }

  if (isClosedEndProduct(product) && !progressState.quizCompleted && !(progressState.paperTradesCompleted > 0)) {
    return 'Pass the product quiz or complete one paper trade before allocating to term sleeves.';
  }

  return '';
}

function sortProductsWithOwnedFirst(products = [], positions = {}) {
  const ownedProductIds = new Set(
    Object.entries(positions || {})
      .filter(([, position]) => Number(position?.shares || 0) > 0 || Number(position?.principal || 0) > 0)
      .map(([productId]) => productId)
  );
  const activityRank = (productId) => {
    const position = positions?.[productId] || {};
    const timestamp = position.lastActivityTs || position.lastSubscribeTs || position.entryTs || '';
    const parsed = timestamp ? Date.parse(timestamp) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return [...products].sort((left, right) => {
    const ownedDelta = Number(ownedProductIds.has(right.id)) - Number(ownedProductIds.has(left.id));
    if (ownedDelta !== 0) return ownedDelta;
    if (ownedProductIds.has(left.id) && ownedProductIds.has(right.id)) {
      return activityRank(right.id) - activityRank(left.id);
    }
    return 0;
  });
}

function getSubscriptionError({
  isConnected,
  address,
  isLocked,
  unlockCopy,
  requestedAmount,
  minimumTicket,
  availableCash
}) {
  if (!isConnected || !address) {
    return 'Connect MetaMask first so subscriptions and share-token receipts stay attached to a wallet.';
  }

  if (isLocked) return unlockCopy;

  if (!Number.isFinite(requestedAmount) || requestedAmount < minimumTicket) {
    return `Subscribe amount is below this product's min ticket. Enter at least ${minimumTicket.toLocaleString()} PT.`;
  }

  if (requestedAmount > availableCash) {
    return 'Not enough available subscribe cash in the demo wallet for this allocation.';
  }

  return '';
}

function getAccessChecklist(product, progress) {
  const items = [
    {
      label: 'Wallet session',
      done: progress.isConnected,
      detail: progress.isConnected
        ? 'This wallet can hold the simulated share receipt and wealth state.'
        : 'Connect the same wallet you used on the onboarding page.'
    }
  ];

  if (product.bucket === 'strategy') {
    items.push({
      label: 'Risk guide',
      done: progress.guideTaskDone,
      detail: progress.guideTaskDone
        ? 'Product-briefing review is already linked to this wallet.'
        : 'Review the 4 product briefings first to unlock the managed sleeve.'
    });
  } else {
    items.push({
      label: 'Starter access',
      done: true,
      detail: 'This shelf does not require an extra risk or quiz gate beyond wallet connection.'
    });
  }

  if (isClosedEndProduct(product)) {
    items.push({
      label: 'Term-sleeve pass',
      done: progress.quizTaskDone || progress.paperTaskDone,
      detail:
        progress.quizTaskDone || progress.paperTaskDone
          ? 'Quiz or paper-trade progress is already mapped to this wallet.'
          : 'Pass the quiz or finish one paper trade to access term sleeves.'
    });
  } else {
    items.push({
      label: 'Product comprehension',
      done: progress.quizTaskDone || progress.paperTaskDone || !isClosedEndProduct(product),
      detail:
        isClosedEndProduct(product)
          ? progress.quizTaskDone || progress.paperTaskDone
            ? 'This wallet already has enough progress to show term product suitability.'
            : 'Recommended next: complete the quiz or one paper trade before increasing complexity.'
          : 'Flexible shelves stay available without a separate term-sleeve pass.'
    });
  }

  return items;
}

function getLifecycleNotes(product) {
  if (isClosedEndProduct(product)) {
    return [
      'Subscription settles into a term bucket and tracks maturity value instead of instant withdrawals.',
      'This demo treats the sleeve as non-redeemable before maturity, so the wallet keeps the receipt until term end.',
      'Receipt tokens stay wallet-linked so maturity and exit state can be displayed onchain later.'
    ];
  }

  if (product.bucket === 'strategy') {
    return [
      'Shares track a managed sleeve with scheduled dealing windows and automated rebalancing.',
      'Redeem requests can queue during volatility spikes instead of forcing stale NAV assumptions.',
      'The receipt token is meant to anchor PnL, reporting, and future strategy attestations.'
    ];
  }

  return [
    'Subscriptions mint a wallet-linked receipt and show the latest simulated NAV immediately.',
    'Redemption previews are flexible, but settlement copy still makes timing and reserve mechanics visible.',
    'The receipt token is the cleanest demo of tokenized ownership without pretending funds move onchain today.'
  ];
}

function getFirstInvestWalkthrough(product, context) {
  const requestedAmount = Number(context.requestedAmount || 0);
  const exactApprovalAmount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : context.minimumTicket;
  const vaultWalletLine = context.vaultSnapshot?.configured
    ? context.vaultSnapshot.eligibleInvestor
      ? ` Onchain vault status also reads ${context.vaultSnapshot.walletStatus.toLowerCase()}.`
      : ' The onchain vault gate is still separate from the local unlock path, so both layers should stay visible.'
    : '';

  return [
    {
      label: 'Map the wallet to the wealth ledger',
      status: context.isConnected ? 'done' : 'current',
      detail: context.isConnected
        ? `Wallet ${shortAddress(context.address)} can receive ${product.shareToken} and keep its simulated wealth state in sync.`
        : 'Connect the same wallet used on onboarding so unlock progress and receipts stay attached to one identity.'
    },
    {
      label: 'Clear the suitability and unlock gate',
      status: context.isConnected ? (context.isLocked ? 'current' : 'done') : 'next',
      detail: context.isLocked
        ? context.unlockCopy
        : `This product is already unlocked for this wallet, so the next step is the order and rights review.${vaultWalletLine}`
    },
    {
      label: 'Set an exact approval before subscribe',
      status: context.isConnected && !context.isLocked ? 'current' : 'next',
      detail: `Prefer a one-time approval for ${formatValue(exactApprovalAmount, false)} instead of an unlimited allowance. That is the cleanest first-deposit teaching flow.`
    },
    {
      label: 'Subscribe and mint the receipt token',
      status: context.validationMessage ? 'next' : 'current',
      detail: `A ${formatValue(exactApprovalAmount, false)} subscription would preview about ${formatShareBalance(
        context.estimatedShares,
        false
      )} ${product.shareToken} at NAV ${product.nav.toFixed(3)}.${context.vaultSnapshot?.configured ? ` Keeper ratio currently reads ${context.vaultSnapshot.navLabel}.` : ''}`
    },
    {
      label: 'Track NAV, then redeem or wait for maturity',
      status: context.existingShares > 0 ? 'done' : 'next',
      detail:
        isClosedEndProduct(product)
          ? 'Term products settle through maturity or a qualified exit queue, so the receipt stays visible until the payoff resolves.'
          : 'Flexible shelves can preview redemptions earlier, but the receipt should still explain fee drag, route drag, and settlement timing.'
    }
  ];
}

function getPreInvestChecks(product, context) {
  const requestedAmount = Number(context.requestedAmount || 0);
  const checkedAmount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : context.minimumTicket;
  const vaultSnapshot = context.vaultSnapshot;
  const stanceTone =
    context.researchView?.stance?.tone === 'risk-high'
      ? 'watch'
      : context.researchView?.stance?.tone === 'risk-medium'
      ? 'review'
      : 'pass';

  return [
    {
      label: 'Contract surface',
      tone: vaultSnapshot?.configured ? 'pass' : 'review',
      title: vaultSnapshot?.configured ? 'Live receipt vault is connected' : 'Receipt vault pattern is modeled but not wired',
      detail: vaultSnapshot?.configured
        ? `Reading ${shortAddress(vaultSnapshot.address)} on Sepolia. Strategy status is ${vaultSnapshot.strategyStatus}.`
        : 'Modeled on RiskLensWealthReceiptVault: owner can pause subscriptions, update NAV, record attestation roots, and map investor eligibility before a live rollout.'
    },
    {
      label: 'Approval scope',
      tone: Number.isFinite(requestedAmount) && requestedAmount >= context.minimumTicket ? 'pass' : 'review',
      title: 'Exact allowance is recommended',
      detail: `First deposit should approve only ${formatValue(checkedAmount, false)} once. The demo avoids encouraging an unlimited approval habit.`
    },
    {
      label: 'Wallet eligibility',
      tone: vaultSnapshot?.configured
        ? vaultSnapshot.eligibleInvestor && !context.isLocked
          ? 'pass'
          : 'review'
        : context.isLocked
        ? 'review'
        : 'pass',
      title: vaultSnapshot?.configured
        ? vaultSnapshot.walletStatus
        : context.isLocked
        ? 'Unlock gate still matters'
        : 'Wallet already clears the gate',
      detail: vaultSnapshot?.configured
        ? `${vaultSnapshot.walletDetail}${context.isLocked ? ` Local unlock note: ${context.unlockCopy}` : ''}`
        : context.isLocked
        ? context.unlockCopy
        : 'Guide, quiz, and paper-trading progress from the onboarding wallet are already mapped into this shelf.'
    },
    {
      label: 'Settlement path',
      tone: isClosedEndProduct(product) ? 'review' : product.bucket === 'strategy' ? 'review' : 'pass',
      title: `${isClosedEndProduct(product) ? 'Term' : 'Flexible'} redemption mechanics`,
      detail: `${product.redemption} Lockup and dealing terms: ${product.fees.lockup}.`
    },
    {
      label: 'Data and attestation',
      tone: vaultSnapshot?.configured ? (vaultSnapshot.attestationFresh ? 'pass' : 'review') : context.snapshotTone,
      title: vaultSnapshot?.configured
        ? vaultSnapshot.attestationFresh
          ? 'Attestation root looks fresh'
          : 'Attestation root should be refreshed'
        : context.snapshotTone === 'pass'
        ? 'Latest shelf snapshot looks current'
        : 'Snapshot should be reviewed before live use',
      detail: vaultSnapshot?.configured
        ? `Last attested ${vaultSnapshot.lastAttestedLabel}. Root ${vaultSnapshot.attestationRootLabel}. Offchain shelf data still comes from ${context.marketSource}.`
        : `Source: ${context.marketSource}. As of: ${context.asOfLabel}.`
    },
    {
      label: 'AI stance',
      tone: stanceTone,
      title: context.researchView?.stance?.label || 'Hold',
      detail: context.researchView?.stance?.rationale || 'Research overlay is unavailable, so only the base product rubric is visible.'
    }
  ];
}

function getOnchainMechanics(product, context) {
  const requestedAmount = Number(context.requestedAmount || 0);
  const orderAmount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : context.minimumTicket;
  const vaultSnapshot = context.vaultSnapshot;

  return [
    {
      title: '1. Approve exact amount',
      copy: `Future live flow should request ${formatValue(orderAmount, false)} once, not an unlimited allowance, before subscribe is enabled.`
    },
    {
      title: '2. Eligibility and attestation stay visible',
      copy: vaultSnapshot?.configured
        ? `Risk tier, investor eligibility, and the attestation root are now readable from ${shortAddress(vaultSnapshot.address)}. Latest root: ${vaultSnapshot.attestationRootLabel}.`
        : 'Risk tier, investor eligibility, approved underlying hashes, and the latest attestation root belong in the same vault surface as the order preview.'
    }
  ];
}

function getScaledScenarioText(text, scale = 1) {
  const parsed = parseScenarioValue(text, Number.NaN);
  if (!Number.isFinite(parsed)) return text;

  const digits = scale === 1 ? 0 : 1;
  return `${(parsed * scale).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })} PT`;
}

function getFlowPreviewCards(product, context) {
  const requestedAmount = Number(context.requestedAmount || 0);
  const previewOrderAmount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : context.minimumTicket;
  const previewShares =
    Number.isFinite(Number(context.estimatedShares)) && Number(context.estimatedShares) > 0
      ? Number(context.estimatedShares)
      : roundNumber(previewOrderAmount / product.nav, 6);
  const postSubscribeCash = roundNumber(Math.max(0, context.availableCash - previewOrderAmount), 2);
  const projectedShares = roundNumber((context.existingShares || 0) + previewShares, 6);
  const canReviewSubscribe = !context.validationMessage;
  const cards = [
    {
      step: 'Step 1',
      title: 'Approve preview',
      statusLabel: context.isConnected && !context.isLocked ? 'Exact allowance' : 'Needs wallet check',
      tone: context.isConnected && !context.isLocked ? 'pass' : 'review',
      primary: formatValue(previewOrderAmount, context.hidden),
      secondary: context.isConnected && !context.isLocked ? 'Single-use allowance recommended' : 'Connect and clear unlock gates first',
      copy:
        'The future live path should default to a one-time exact approval, not unlimited spending rights, before the vault subscribe call is exposed.'
    },
    {
      step: 'Step 2',
      title: 'Subscribe preview',
      statusLabel: canReviewSubscribe ? 'Ready to record receipt' : 'Review requirements',
      tone: canReviewSubscribe ? 'pass' : 'review',
      primary: `${formatShareBalance(previewShares, context.hidden)} ${product.shareToken}`,
      secondary: `Cash after subscribe ${formatValue(postSubscribeCash, context.hidden)} / total receipt balance ${formatShareBalance(projectedShares, context.hidden)}`,
      copy: `At NAV ${product.nav.toFixed(3)}, this order would create wallet-linked receipt shares instead of pretending the user directly holds idle cash.`
    }
  ];

  if (!isRedeemableProduct(product)) {
    const scale = previewOrderAmount / 1000;
    cards.push({
      step: 'Step 3',
      title: 'Maturity preview',
      statusLabel: 'Term settlement',
      tone: 'review',
      primary: getScaledScenarioText(product.scenario.base, scale),
      secondary: `Conservative ${getScaledScenarioText(product.scenario.conservative, scale)} / pressure ${getScaledScenarioText(
        product.scenario.pressure,
        scale
      )}`,
      copy: 'The receipt stays outstanding until maturity because this term sleeve is not redeemable on demand in the current flow.'
    });
  } else {
    const redeemValue = context.existingShares > 0 ? roundNumber(Math.min(previewOrderAmount, context.positionValue), 2) : 0;
    const sharesToBurn = context.existingShares > 0 ? roundNumber(redeemValue / product.nav, 6) : 0;
    const remainingShares = context.existingShares > 0
      ? roundNumber(Math.max(0, context.existingShares - sharesToBurn), 6)
      : 0;
    const cashAfterRedeem = context.existingShares > 0
      ? roundNumber(context.availableCash + redeemValue, 2)
      : context.availableCash;

    cards.push({
      step: 'Step 3',
      title: 'Redeem preview',
      statusLabel: context.existingShares > 0 ? 'Receipt ready to settle' : 'Subscribe first',
      tone: context.existingShares > 0 ? 'pass' : 'review',
      primary: context.existingShares > 0 ? formatValue(redeemValue, context.hidden) : `${formatShareBalance(previewShares, context.hidden)} next receipt`,
      secondary: context.existingShares > 0
        ? `${formatShareBalance(sharesToBurn, context.hidden)} settle / ${formatShareBalance(remainingShares, context.hidden)} remaining / cash after redeem ${formatValue(
            cashAfterRedeem,
            context.hidden
          )}`
        : 'Once shares exist in the wallet, redemption can preview the cash leg before confirmation.',
      copy: 'Flexible products should show the cash-out path before settlement so the user sees timing, route drag, and the post-redeem wallet state.'
    });
  }

  return cards;
}

function getFundingRailCopy(product) {
  const baseAsset = `${product?.baseAsset || ''}`.toLowerCase();

  if (baseAsset.includes('usdc') && baseAsset.includes('usd')) {
    return 'USDC or USD funding rail';
  }
  if (baseAsset.includes('usdc')) return 'USDC funding rail';
  if (baseAsset.includes('usdt')) return 'USDT funding rail';
  if (baseAsset.includes('stable')) return 'Stablecoin funding rail';
  if (baseAsset.includes('usd')) return 'USD funding rail';
  return 'Approved funding rail';
}

function getModeledCallCards(product, context) {
  const requestedAmount = Number(context.requestedAmount || 0);
  const previewOrderAmount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : context.minimumTicket;
  const previewShares =
    Number.isFinite(Number(context.estimatedShares)) && Number(context.estimatedShares) > 0
      ? Number(context.estimatedShares)
      : roundNumber(previewOrderAmount / product.nav, 6);
  const redeemValue = context.existingShares > 0 ? roundNumber(Math.min(previewOrderAmount, context.positionValue), 2) : 0;
  const sharesToBurn = context.existingShares > 0 ? roundNumber(redeemValue / product.nav, 6) : 0;
  const receiptVaultLabel = `${product.shortName || product.shareToken} Receipt Vault`;
  const settlementLabel = `${product.shortName || product.shareToken} Maturity Manager`;
  const fundingRail = getFundingRailCopy(product);

  return [
    {
      phase: 'Tx 1',
      title: 'Allowance approval',
      tone: context.isConnected && !context.isLocked ? 'pass' : 'review',
      functionName: 'approve(spender, assetAmount)',
      target: `${fundingRail} token contract`,
      args: [
        `spender: ${receiptVaultLabel}`,
        `assetAmount: ${formatValue(previewOrderAmount, context.hidden)}`,
        'approval mode: exact amount only'
      ],
      walletPrompt: 'Wallet popup should show one spender and one bounded amount, never an unlimited approval by default.',
      stateChange: 'Vault becomes authorized to pull this exact amount for the next subscribe call.'
    },
    {
      phase: 'Tx 2',
      title: 'Receipt subscribe',
      tone: context.validationMessage ? 'review' : 'pass',
      functionName: 'subscribe(assetAmount)',
      target: receiptVaultLabel,
      args: [
        `assetAmount: ${formatValue(previewOrderAmount, context.hidden)}`,
        `receiver: ${context.shortAddress}`,
        `preview shares: ${formatShareBalance(previewShares, context.hidden)} ${product.shareToken}`
      ],
      walletPrompt: 'This is the core vault interaction: the wallet signs one subscribe call after the approval succeeds.',
      stateChange: `${product.shareToken} receipt exposure is recorded and the funding asset leaves the wallet rail.`
    },
    !isRedeemableProduct(product)
      ? {
          phase: 'Tx 3',
          title: 'Maturity settlement',
          tone: 'review',
          functionName: 'settleAtMaturity(receiptAmount)',
          target: settlementLabel,
          args: [
            `receiptAmount: ${formatShareBalance(context.existingShares > 0 ? context.existingShares : previewShares, context.hidden)} ${product.shareToken}`,
            'settlement rail: maturity cash distribution',
            `status: ${product.redemption}`
          ],
          walletPrompt: 'Users should not expect an always-open redeem call on term buckets.',
          stateChange: 'Receipt stays outstanding until the maturity manager confirms settlement.'
        }
      : {
          phase: 'Tx 3',
          title: 'Flexible redeem',
          tone: context.existingShares > 0 ? 'pass' : 'review',
          functionName: 'redeem(shareAmount)',
          target: receiptVaultLabel,
          args: [
            `shareAmount: ${formatShareBalance(context.existingShares > 0 ? sharesToBurn : previewShares, context.hidden)} ${product.shareToken}`,
            `cash preview: ${context.existingShares > 0 ? formatValue(redeemValue, context.hidden) : 'Subscribe first'}`,
            `receiver: ${context.shortAddress}`
          ],
          walletPrompt: 'Redeem should preview the settlement amount and the expected cash leg before the user signs the transaction.',
          stateChange: 'Receipt shares settle and the funding rail returns cash or stablecoin to the wallet.'
        }
  ];
}

function FlowPreviewGrid({ cards = [], compact = false }) {
  if (!cards.length) return null;

  return (
    <div className={`wealth-flow-preview-grid ${compact ? 'compact' : ''}`}>
      {cards.map((card) => (
        <div className={`paper-mode-card wealth-flow-preview-card ${compact ? 'compact' : ''}`} key={`${card.step}-${card.title}`}>
          <div className="wealth-flow-preview-head">
            <div className="eyebrow">{card.step}</div>
            <span className={`pill ${card.tone === 'pass' ? 'risk-low' : card.tone === 'review' ? 'risk-medium' : 'risk-high'}`}>
              {card.statusLabel}
            </span>
          </div>
          <div className="product-title">{card.title}</div>
          <div className="wealth-flow-preview-primary">{card.primary}</div>
          <div className="wealth-flow-preview-secondary">{card.secondary}</div>
          <div className="entry-copy">{card.copy}</div>
        </div>
      ))}
    </div>
  );
}

function ModeledCallGrid({ cards = [], compact = false }) {
  if (!cards.length) return null;

  return (
    <div className={`wealth-call-preview-grid ${compact ? 'compact' : ''}`}>
      {cards.map((card) => (
        <div className={`paper-mode-card wealth-call-card ${compact ? 'compact' : ''}`} key={`${card.phase}-${card.title}`}>
          <div className="wealth-call-head">
            <div className="eyebrow">{card.phase}</div>
            <span className={`pill ${card.tone === 'pass' ? 'risk-low' : card.tone === 'review' ? 'risk-medium' : 'risk-high'}`}>
              {card.title}
            </span>
          </div>
          <div className="wealth-call-signature">{card.functionName}</div>
          <div className="wealth-call-target">Target: {card.target}</div>
          <div className="wealth-call-kv">
            {card.args.map((line) => (
              <div className="wealth-call-kv-row" key={line}>
                <span>{line}</span>
              </div>
            ))}
          </div>
          <div className="wealth-call-copy">
            <strong>Wallet prompt.</strong> {card.walletPrompt}
          </div>
          <div className="wealth-call-copy">
            <strong>State change.</strong> {card.stateChange}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReceiptLifecycleDiagram({ product, compact = false }) {
  const settlementPolicy = getSettlementPolicy(product);

  return (
    <div className={`wealth-lifecycle-map ${compact ? 'compact' : ''}`}>
      <div className="wealth-lifecycle-node">
        <span>1</span>
        <strong>Buy one receipt</strong>
        <small>PT subscription records {product.shareToken} exposure</small>
      </div>
      <div className="wealth-lifecycle-link">-&gt;</div>
      <div className="wealth-lifecycle-node">
        <span>2</span>
        <strong>Hold the receipt</strong>
        <small>NAV, yield source, and risk stay visible</small>
      </div>
      <div className="wealth-lifecycle-link">-&gt;</div>
      <div className="wealth-lifecycle-node">
        <span>3</span>
        <strong>Settle or pledge</strong>
        <small>{settlementPolicy.timing}</small>
      </div>
    </div>
  );
}

function DualInvestmentVisual({ product }) {
  if (!isDualInvestmentProduct(product)) return null;

  return (
    <div className="wealth-dual-visual">
      <div className="wealth-dual-visual-main">
        <div className="wealth-dual-step">
          <span>Deposit</span>
          <strong>Quote asset</strong>
          <small>Example: USDC principal enters the 7-day receipt.</small>
        </div>
        <div className="wealth-lifecycle-link">-&gt;</div>
        <div className="wealth-dual-step focus">
          <span>Observe</span>
          <strong>Target price</strong>
          <small>At settlement, the final BTC price decides the payout asset.</small>
        </div>
      </div>
      <div className="wealth-dual-branch-grid">
        <div className="reason-card">
          <div className="entry-title">Target not triggered</div>
          <div className="entry-copy">User keeps the original currency and earns the modeled premium.</div>
        </div>
        <div className="reason-card">
          <div className="entry-title">Target triggered</div>
          <div className="entry-copy">User receives the other asset at the target-price rule, plus the premium.</div>
        </div>
      </div>
    </div>
  );
}

function buildDualSettlementScenario({ direction, referencePrice, targetPrice, settlementMovePct, quotePayout }) {
  const cappedTarget = Math.max(1, Number(targetPrice || 0));
  const targetFactor = cappedTarget / Math.max(1, Number(referencePrice || 1));
  const settleFactor = Math.max(0.2, 1 + Number(settlementMovePct || 0) / 100);
  let quoteEquivalent = quotePayout;

  if (direction === 'buy-low') {
    quoteEquivalent = settleFactor > targetFactor ? quotePayout : quotePayout * (settleFactor / targetFactor);
  } else {
    quoteEquivalent = settleFactor < targetFactor ? quotePayout : quotePayout * (targetFactor / settleFactor);
  }

  const pnl = roundNumber(quoteEquivalent - 1000, 2);
  const tone = pnl > 12 ? 'risk-low' : pnl < -12 ? 'risk-high' : 'risk-medium';
  const label = pnl > 12 ? 'Profit zone' : pnl < -12 ? 'Loss zone' : 'Flat zone';

  return {
    settlementMovePct,
    quoteEquivalent: roundNumber(quoteEquivalent, 2),
    pnl,
    tone,
    label
  };
}

function DualOutcomeSimulator({
  pair,
  direction,
  targetPrice,
  targetPct,
  apr,
  settlementDays,
  settlementMovePct,
  onSettlementMoveChange,
  showSettlementSlider = true,
  className = ''
}) {
  const quotePayout = roundNumber(1000 + 1000 * apr * (Math.max(1, Number(settlementDays || 1)) / 365), 2);
  const chartPoints = [-12, -8, -4, 0, 4, 8, 12].map((move) =>
    buildDualSettlementScenario({
      direction,
      referencePrice: pair.referencePrice,
      targetPrice,
      settlementMovePct: move,
      quotePayout
    })
  );
  const simulated = buildDualSettlementScenario({
    direction,
    referencePrice: pair.referencePrice,
    targetPrice,
    settlementMovePct,
    quotePayout
  });
  const sampleMoves = direction === 'buy-low' ? [6, Number(targetPct || 0) - 1, -10] : [-6, Number(targetPct || 0) + 1, 10];
  const sampleLabels = ['Profit', 'Flat', 'Loss'];
  const sampleRows = sampleMoves.map((move, index) => ({
    ...buildDualSettlementScenario({
      direction,
      referencePrice: pair.referencePrice,
      targetPrice,
      settlementMovePct: move,
      quotePayout
    }),
    title: sampleLabels[index],
    subtitle:
      index === 0
        ? 'Target stays favorable and premium is kept.'
        : index === 1
          ? 'Near the strike, the premium mostly offsets the conversion drag.'
          : 'Settlement flips into the less desired asset and the mark moves through the strike.'
  }));
  const minValue = Math.min(...chartPoints.map((point) => point.quoteEquivalent), simulated.quoteEquivalent);
  const maxValue = Math.max(...chartPoints.map((point) => point.quoteEquivalent), simulated.quoteEquivalent);
  const chartHeight = 168;
  const chartWidth = 520;
  const xForMove = (move) => ((move + 12) / 24) * chartWidth;
  const yForValue = (value) => {
    if (maxValue === minValue) return chartHeight / 2;
    return chartHeight - ((value - minValue) / (maxValue - minValue)) * (chartHeight - 28) - 14;
  };
  const path = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xForMove(point.settlementMovePct).toFixed(1)} ${yForValue(point.quoteEquivalent).toFixed(1)}`)
    .join(' ');
  const simulatedX = xForMove(Number(settlementMovePct || 0));
  const simulatedY = yForValue(simulated.quoteEquivalent);
  const targetX = xForMove(Number(targetPct || 0));

  return (
    <div className={`wealth-dual-simulator ${className}`.trim()}>
      <div className="wealth-dual-simulator-head">
        <div>
          <div className="eyebrow">Profit / flat / loss map</div>
          <div className="product-title">
            {pair.id} / {direction === 'buy-low' ? 'buy-low path' : 'sell-high path'}
          </div>
        </div>
        <div className={`pill ${simulated.tone}`}>{simulated.label}</div>
      </div>

      <div className="wealth-dual-simulator-chart">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Dual investment settlement simulation">
          <line x1="0" y1={chartHeight - 14} x2={chartWidth} y2={chartHeight - 14} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
          <line x1="0" y1="14" x2="0" y2={chartHeight - 14} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <line x1={targetX} y1="10" x2={targetX} y2={chartHeight - 14} stroke="rgba(164,255,47,0.28)" strokeDasharray="5 5" strokeWidth="1.5" />
          <path d={path} fill="none" stroke="#7aa6ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={simulatedX} cy={simulatedY} r="7" fill="#a4ff2f" stroke="#0d1422" strokeWidth="3" />
        </svg>
        <div className="wealth-dual-chart-axis">
          <span>Far below target</span>
          <span>Near target</span>
          <span>Far above target</span>
        </div>
      </div>

      {showSettlementSlider ? (
        <label className="wealth-field compact wealth-dual-sim-slider">
          Simulated settlement move: {Number(settlementMovePct || 0).toFixed(0)}%
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={settlementMovePct}
            onChange={(event) => onSettlementMoveChange(Number(event.target.value))}
          />
        </label>
      ) : null}

      <div className="wealth-dual-sim-strip">
        <div className="paper-balance-box">
          <div className="label">Target price</div>
          <div className="value">{targetPrice.toLocaleString()}</div>
        </div>
        <div className="paper-balance-box">
          <div className="label">Simulated settle</div>
          <div className="value">{(pair.referencePrice * (1 + Number(settlementMovePct || 0) / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="paper-balance-box">
          <div className="label">Take-home x1000</div>
          <div className={`value ${simulated.tone}`}>{formatValue(simulated.quoteEquivalent * DUAL_PT_REWARD_MULTIPLIER)}</div>
        </div>
        <div className="paper-balance-box">
          <div className="label">PnL x1000</div>
          <div className={`value ${simulated.tone}`}>{formatSignedValue(simulated.pnl * DUAL_PT_REWARD_MULTIPLIER)}</div>
        </div>
      </div>

      <div className="wealth-dual-sample-grid">
        {sampleRows.map((row) => (
          <div className="reason-card" key={`${row.title}-${row.settlementMovePct}`}>
            <div className="entry-title">{row.title}</div>
            <div className="entry-copy">{row.subtitle}</div>
            <div className="wealth-dual-sample-value">
              <strong className={row.tone}>{formatValue(row.quoteEquivalent * DUAL_PT_REWARD_MULTIPLIER)}</strong>
              <span>{formatSignedValue(row.pnl * DUAL_PT_REWARD_MULTIPLIER)} / settle move {row.settlementMovePct >= 0 ? '+' : ''}{row.settlementMovePct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnchainVaultGrid({ snapshot, product }) {
  if (!snapshot?.configured) {
    return (
      <div className="wealth-judge-grid">
        <div className="guide-chip">
          <div className="k">Vault wiring</div>
          <div className="v">Not configured</div>
          <div className="muted">Set `VITE_WEALTH_VAULT_ADDRESS` to expose live receipt-vault state in this shelf.</div>
        </div>
        <div className="guide-chip">
          <div className="k">Attestation layer</div>
          <div className="v">Ready to add</div>
          <div className="muted">This panel is ready for keeper-updated NAV, strategy status, and attestation root reads.</div>
        </div>
        <div className="guide-chip">
          <div className="k">Wallet gate</div>
          <div className="v">Wallet-specific</div>
          <div className="muted">When configured, eligibility, risk tier, and advanced-shelf access will be read for the connected wallet.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="wealth-judge-grid">
      <div className="guide-chip">
        <div className="k">Vault address</div>
        <div className="v">{shortAddress(snapshot.address)}</div>
        <div className="muted">{snapshot.address}</div>
      </div>
      <div className="guide-chip">
        <div className="k">Strategy status</div>
        <div className={`v ${snapshot.subscriptionsPaused ? 'risk-high' : 'risk-low'}`}>{snapshot.strategyStatus}</div>
        <div className="muted">
          {snapshot.subscriptionsPaused
            ? 'Subscriptions are paused onchain until the operator or keeper resumes the vault.'
            : 'Subscriptions are currently open in the demo receipt vault.'}
        </div>
      </div>
      <div className="guide-chip">
        <div className="k">Keeper NAV ratio</div>
        <div className="v">{snapshot.navLabel}</div>
        <div className="muted">
          Onchain NAV comes from `navBps`; shelf-level product NAV for {product?.shortName || product?.shareToken || 'this product'} still teaches the richer product-specific path.
        </div>
      </div>
      <div className="guide-chip">
        <div className="k">Attestation freshness</div>
        <div className={`v ${snapshot.attestationTone}`}>{snapshot.attestationStatus}</div>
        <div className="muted">
          {snapshot.lastAttestedLabel} / root {snapshot.attestationRootLabel}
        </div>
      </div>
      <div className="guide-chip">
        <div className="k">Wallet eligibility</div>
        <div className={`v ${snapshot.eligibleInvestor ? 'risk-low' : 'risk-medium'}`}>{snapshot.walletStatus}</div>
        <div className="muted">{snapshot.walletDetail}</div>
      </div>
      <div className="guide-chip">
        <div className="k">Minimum + advanced shelf</div>
        <div className={`v ${snapshot.advancedShelfAccess ? 'risk-low' : 'risk-medium'}`}>{snapshot.minSubscriptionLabel}</div>
        <div className="muted">
          {snapshot.advancedShelfAccess
            ? 'This wallet clears the advanced-shelf gate onchain.'
            : 'Advanced access still depends on eligibility and risk tier >= 2.'}
        </div>
      </div>
    </div>
  );
}

function buildChartPath(series, width, height) {
  if (!series?.length) return '';

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const xStep = series.length === 1 ? width : width / (series.length - 1);

  return series
    .map((value, index) => {
      const x = Number((index * xStep).toFixed(2));
      const y = Number((height - ((value - min) / range) * height).toFixed(2));
      return `${x},${y}`;
    })
    .join(' ');
}

function normalizeNavSeries(series, periodId = '30d') {
  if (!Array.isArray(series) || !series.length) return [];

  const totalDays = NAV_PERIOD_OPTIONS.find((option) => option.id === periodId)?.id === '7d'
    ? 7
    : periodId === '30d'
      ? 30
      : periodId === '3m'
        ? 90
        : 180;
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  const stepCount = Math.max(1, series.length - 1);

  return series
    .map((entry, index) => {
      if (typeof entry === 'number') {
        const offset = (stepCount - index) * (totalDays / stepCount);
        return {
          ts: new Date(endDate.getTime() - offset * DAY_MS).toISOString(),
          value: entry
        };
      }

      const value = Number(entry?.value ?? entry?.close ?? entry?.nav ?? entry);
      if (!Number.isFinite(value)) return null;
      return {
        ts: entry?.ts || new Date(endDate.getTime() - (stepCount - index) * DAY_MS).toISOString(),
        value
      };
    })
    .filter(Boolean);
}

function getNavDelta(points = []) {
  if (points.length < 2) return 0;
  return roundNumber(points[points.length - 1].value - points[0].value, 3);
}

function getNavDeltaPercent(points = []) {
  if (points.length < 2 || !points[0]?.value) return 0;
  return roundNumber(((points[points.length - 1].value - points[0].value) / points[0].value) * 100, 2);
}

function getTicketGain(points = [], ticket = 1000) {
  if (points.length < 2 || !points[0]?.value) return 0;
  return roundNumber(ticket * ((points[points.length - 1].value / points[0].value) - 1), 1);
}

function getLatestNav(points = [], fallback = 0) {
  return points.length ? roundNumber(points[points.length - 1].value, 3) : roundNumber(fallback, 3);
}

function getNavPeriodDays(periodId = '30d') {
  if (periodId === '7d') return 7;
  if (periodId === '3m') return 90;
  if (periodId === '6m') return 180;
  return 30;
}

function getDualWindowMoveLimit(periodId = '30d') {
  if (periodId === '7d') return 16;
  if (periodId === '3m') return 38;
  if (periodId === '6m') return 52;
  return 24;
}

function formatSignedPercent(value, digits = 0) {
  const numericValue = Number(value || 0);
  return `${numericValue >= 0 ? '+' : ''}${numericValue.toFixed(digits)}%`;
}

function getDualPairForProduct(product = {}, fallbackPair = DUAL_CURRENCY_PAIR_OPTIONS[0]) {
  const text = `${product.id || ''} ${product.name || ''} ${product.shortName || ''} ${product.underlying || ''} ${product.baseAsset || ''}`.toLowerCase();
  return (
    DUAL_CURRENCY_PAIR_OPTIONS.find(
      (pair) => text.includes(pair.base.toLowerCase()) && text.includes(pair.quote.toLowerCase())
    ) ||
    DUAL_CURRENCY_PAIR_OPTIONS.find((pair) => text.includes(pair.base.toLowerCase())) ||
    fallbackPair
  );
}

function getDirectionalDualTargetPct(direction = 'buy-low', targetPct = 0) {
  const numericTarget = Number(targetPct);
  if (Number.isFinite(numericTarget) && numericTarget !== 0) {
    if (direction === 'sell-high' && numericTarget > 0) return numericTarget;
    if (direction !== 'sell-high' && numericTarget < 0) return numericTarget;
  }

  return direction === 'sell-high' ? 5 : -4;
}

function buildDualPtSettlementPreview({
  pair = DUAL_CURRENCY_PAIR_OPTIONS[0],
  direction = 'buy-low',
  targetPct = -4,
  settlementMovePct = 0,
  apr = 0.36,
  termDays = 7,
  subscribedPt = 1000
} = {}) {
  const referencePrice = Math.max(0.01, Number(pair.referencePrice || 1));
  const safePrincipal = Math.max(0, Number(subscribedPt || 0));
  const safeTermDays = Math.max(1, Number(termDays || 1));
  const safeApr = Math.max(0, Number(apr || 0));
  const signedTargetPct = getDirectionalDualTargetPct(direction, targetPct);
  const safeSettlementMovePct = Number.isFinite(Number(settlementMovePct)) ? Number(settlementMovePct) : 0;
  const targetPrice = Math.max(0.01, referencePrice * (1 + signedTargetPct / 100));
  const settlementPrice = Math.max(0.01, referencePrice * (1 + safeSettlementMovePct / 100));
  const triggered = direction === 'sell-high' ? settlementPrice >= targetPrice : settlementPrice <= targetPrice;
  const distanceFromTarget = triggered ? Math.abs(settlementPrice / targetPrice - 1) : 0;
  const basePremiumRaw = safePrincipal * safeApr * (safeTermDays / 365);
  const smallConversionPenaltyRaw = triggered ? safePrincipal * Math.min(0.012, distanceFromTarget * 0.35) : 0;
  const conversionPenaltyRaw = triggered ? safePrincipal * Math.min(0.04, distanceFromTarget * 0.65) : 0;
  const slippagePenaltyRaw = triggered && distanceFromTarget > 0.025
    ? safePrincipal * Math.min(0.035, (distanceFromTarget - 0.025) * 0.9)
    : 0;
  const outcomeAdjustmentRaw = -(smallConversionPenaltyRaw + conversionPenaltyRaw + slippagePenaltyRaw);
  const finalRaw = safePrincipal + basePremiumRaw + outcomeAdjustmentRaw;
  const outcomeLabel = !triggered
    ? 'Target not triggered'
    : distanceFromTarget <= 0.018
      ? 'Triggered near target'
      : 'Triggered adverse';
  const outcomeTone = !triggered ? 'risk-low' : distanceFromTarget <= 0.018 ? 'risk-medium' : 'risk-high';

  return {
    targetPct: signedTargetPct,
    targetPrice,
    settlementPrice,
    settlementMovePct: safeSettlementMovePct,
    triggered,
    distanceFromTarget,
    outcomeLabel,
    outcomeTone,
    principalPt: safePrincipal * DUAL_PT_REWARD_MULTIPLIER,
    basePremiumPt: basePremiumRaw * DUAL_PT_REWARD_MULTIPLIER,
    outcomeAdjustmentPt: outcomeAdjustmentRaw * DUAL_PT_REWARD_MULTIPLIER,
    finalPt: finalRaw * DUAL_PT_REWARD_MULTIPLIER,
    basePremiumRaw,
    outcomeAdjustmentRaw
  };
}

function getDualWindowReturnPreview({
  product = {},
  pair = DUAL_CURRENCY_PAIR_OPTIONS[0],
  direction = 'buy-low',
  targetPct = -4,
  priceMovePct = 0,
  navPoints = [],
  periodId = '30d',
  principal = 1000
} = {}) {
  const periodDays = getNavPeriodDays(periodId);
  const startNav = Number(navPoints[0]?.value || product.nav || 1);
  const endNav = Number(navPoints[navPoints.length - 1]?.value || product.nav || startNav);
  const navRatio = startNav > 0 ? endNav / startNav : 1;
  const navMarkedValue = principal * navRatio;
  const navGain = navMarkedValue - principal;
  const annualPremiumRate = Math.max(0.01, Number(product.annualYieldRate || getAnnualYieldRate(product) || 0));
  const targetDistanceBoost = Math.abs(Number(targetPct || 0)) / 100;
  const termPremiumRate = annualPremiumRate * (1 + targetDistanceBoost * 0.4) * (periodDays / 365);
  const premiumValue = principal * termPremiumRate;
  const referencePrice = Math.max(0.01, Number(pair.referencePrice || 1));
  const targetPrice = Math.max(0.01, referencePrice * (1 + Number(targetPct || 0) / 100));
  const settlementPrice = Math.max(0.01, referencePrice * (1 + Number(priceMovePct || 0) / 100));
  let quoteEquivalent = navMarkedValue + premiumValue;
  let settlementAsset = pair.quote;
  let settlementAmount = quoteEquivalent;
  let triggered = false;

  if (direction === 'sell-high') {
    const markedBaseAmount = navMarkedValue / referencePrice;
    triggered = settlementPrice >= targetPrice;
    settlementAsset = triggered ? pair.quote : pair.base;
    quoteEquivalent = triggered
      ? markedBaseAmount * targetPrice + premiumValue
      : markedBaseAmount * settlementPrice + premiumValue;
    settlementAmount = triggered ? quoteEquivalent : markedBaseAmount;
  } else {
    triggered = settlementPrice <= targetPrice;
    settlementAsset = triggered ? pair.base : pair.quote;
    quoteEquivalent = triggered
      ? ((navMarkedValue + premiumValue) / targetPrice) * settlementPrice
      : navMarkedValue + premiumValue;
    settlementAmount = triggered ? (navMarkedValue + premiumValue) / targetPrice : quoteEquivalent;
  }

  const pnl = quoteEquivalent - principal;
  const returnPct = principal > 0 ? (pnl / principal) * 100 : 0;
  const tone = pnl > 15 ? 'risk-low' : pnl < -15 ? 'risk-high' : 'risk-medium';

  return {
    periodDays,
    startNav: roundNumber(startNav, 3),
    endNav: roundNumber(endNav, 3),
    navMarkedValue: roundNumber(navMarkedValue, 2),
    navGain: roundNumber(navGain, 2),
    premiumValue: roundNumber(premiumValue, 2),
    termPremiumRate,
    referencePrice: roundNumber(referencePrice, 2),
    targetPrice: roundNumber(targetPrice, 2),
    settlementPrice: roundNumber(settlementPrice, 2),
    priceMovePct: roundNumber(priceMovePct, 1),
    quoteEquivalent: roundNumber(quoteEquivalent, 2),
    settlementAmount: roundNumber(settlementAmount, 6),
    settlementAsset,
    pnl: roundNumber(pnl, 2),
    returnPct: roundNumber(returnPct, 2),
    triggered,
    tone,
    outcomeLabel: triggered ? 'Target triggered' : 'Target not triggered',
    directionLabel: direction === 'sell-high' ? 'Sell-high' : 'Buy-low'
  };
}

function parseScenarioValue(text, fallback = 1000) {
  const match = String(text || '').match(/([\d,]+)\s*PT/i);
  return match ? Number(match[1].replace(/,/g, '')) : fallback;
}

function getTutorialNetPreview(product) {
  const grossValue = parseScenarioValue(product?.scenario?.base, 1000);
  const assumptionsByBucket = {
    starter: { feeDrag: 4.5, routeDrag: 1.4, taxRate: 0.24 },
    fixed: { feeDrag: 6.8, routeDrag: 2.1, taxRate: 0.24 },
    strategy: { feeDrag: 12.5, routeDrag: 3.6, taxRate: 0.2 },
    structured: { feeDrag: 10.2, routeDrag: 4.4, taxRate: 0.22 }
  };
  const assumptions = assumptionsByBucket[product?.bucket] || assumptionsByBucket.starter;
  const taxableGain = Math.max(0, grossValue - 1000 - assumptions.feeDrag - assumptions.routeDrag);
  const taxHoldback = roundNumber(taxableGain * assumptions.taxRate, 2);
  const netValue = roundNumber(grossValue - assumptions.feeDrag - assumptions.routeDrag - taxHoldback, 2);

  return {
    grossValue,
    feeDrag: assumptions.feeDrag,
    routeDrag: assumptions.routeDrag,
    taxHoldback,
    netValue
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(99, Math.round(Number(value || 0))));
}

function getTransparencyScore(product) {
  let score = 58;
  const marketSource = `${product?.marketSource || ''} ${product?.liveTieIn || ''}`.toLowerCase();
  const managementCopy = `${product?.fees?.management || ''}`.toLowerCase();

  if (product?.bucket === 'starter') score += 14;
  if (product?.bucket === 'fixed') score += 10;
  if (product?.bucket === 'strategy') score += 2;
  if (product?.bucket === 'structured') score -= 8;

  if (marketSource.includes('official')) score += 10;
  if (marketSource.includes('public nav history')) score += 12;
  if (marketSource.includes('proxy')) score -= 6;
  if (managementCopy && !managementCopy.includes('see fund docs')) score += 6;
  if ((product?.shareRights || []).length >= 3) score += 4;
  if ((product?.diligenceChecks || []).filter((check) => check.status === 'Pass').length >= 2) score += 5;

  return clampScore(score);
}

function getLiquidityScore(product) {
  let score = 52;
  const redemptionCopy = `${product?.redemption || ''}`.toLowerCase();
  const baseAsset = `${product?.baseAsset || ''}`.toLowerCase();

  if (product?.bucket === 'starter') score += 18;
  if (product?.bucket === 'fixed') score += 10;
  if (product?.bucket === 'strategy') score += 4;
  if (product?.bucket === 'structured') score -= 12;

  if (redemptionCopy.includes('24/7')) score += 14;
  if (redemptionCopy.includes('same-day') || redemptionCopy.includes('same day')) score += 10;
  if (redemptionCopy.includes('market-day') || redemptionCopy.includes('market day')) score += 6;
  if (redemptionCopy.includes('next business day') || redemptionCopy.includes('next u.s. business day')) score += 2;
  if (redemptionCopy.includes('queue')) score -= 12;
  if (redemptionCopy.includes('maturity')) score -= 18;
  if (redemptionCopy.includes('qualified') || redemptionCopy.includes('eligible')) score -= 6;
  if (baseAsset.includes('usdc')) score += 4;

  if (product?.minSubscription >= 5000000) score -= 20;
  else if (product?.minSubscription >= 100000) score -= 12;
  else if (product?.minSubscription >= 10000) score -= 6;

  return clampScore(score);
}

function MiniNavChart({ series = [], tone = 'neutral' }) {
  const values = series.map((entry) => (typeof entry === 'number' ? entry : entry.value));
  const path = buildChartPath(values, 180, 58);

  return (
    <div className={`mini-nav-chart tone-${tone}`}>
      <svg viewBox="0 0 180 58" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={path} />
      </svg>
    </div>
  );
}

function formatWealthDate(timestamp, pointCount) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatSettlementTimelineDate(daysForward = 0) {
  const days = Math.max(0, Number(daysForward || 0));
  return formatWealthDate(new Date(Date.now() + days * DAY_MS).toISOString());
}

function formatWealthDateTime(timestamp) {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function DetailNavChart({ series = [] }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const points = normalizeNavSeries(series);
  if (!points.length) {
    return (
      <div className="detail-nav-chart">
        <div className="detail-nav-hover-panel static">
          <span>NAV detail</span>
          <strong>No NAV points</strong>
        </div>
      </div>
    );
  }

  const width = 620;
  const height = 280;
  const padding = { top: 20, right: 74, bottom: 28, left: 16 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => point.value);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const range = high - low || 1;
  const chartPoints = points.map((point, index) => ({
    x: padding.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * plotWidth),
    y: padding.top + ((high - point.value) / range) * plotHeight
  }));
  const activeIndex = hoverIndex == null ? Math.max(0, points.length - 1) : clamp(hoverIndex, 0, Math.max(0, points.length - 1));
  const activePoint = chartPoints[activeIndex];
  const activeEntry = points[activeIndex];
  const activeDelta = points.length > 1 ? activeEntry.value - points[0].value : 0;
  const activeDeltaPercent = points.length > 1 && points[0].value ? (activeDelta / points[0].value) * 100 : 0;
  const activeMoveLabel = `${activeDelta >= 0 ? '+' : ''}${activeDelta.toFixed(3)} / ${activeDeltaPercent >= 0 ? '+' : ''}${activeDeltaPercent.toFixed(2)}%`;
  const yTicks = Array.from({ length: 4 }, (_, index) => low + (range * index) / 3);

  function handlePointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !points.length) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const clamped = clamp(svgX, padding.left, padding.left + plotWidth);
    const ratio = plotWidth === 0 ? 0 : (clamped - padding.left) / plotWidth;
    setHoverIndex(Math.round(ratio * Math.max(0, points.length - 1)));
  }

  return (
    <div className="detail-nav-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="NAV detail chart"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {yTicks.map((tick) => {
          const y = padding.top + ((high - tick) / range) * plotHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={padding.left + plotWidth} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" />
              <text x={padding.left + plotWidth + 8} y={y + 4} fill="rgba(156,171,190,0.92)" fontSize="11">
                {tick.toFixed(3)}
              </text>
            </g>
          );
        })}

        {chartPoints.slice(0, -1).map((point, index) => {
          const nextPoint = chartPoints[index + 1];
          const rising = points[index + 1].value >= points[index].value;
          return (
            <line
              key={`${points[index].ts}-${points[index + 1].ts}`}
              x1={point.x}
              y1={point.y}
              x2={nextPoint.x}
              y2={nextPoint.y}
              stroke={rising ? '#f06a7f' : '#5f8cd7'}
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        })}

        {activePoint ? (
          <>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={padding.top}
              y2={padding.top + plotHeight}
              stroke="rgba(243,246,253,0.48)"
              strokeDasharray="6 6"
            />
            <line
              x1={padding.left}
              x2={padding.left + plotWidth}
              y1={activePoint.y}
              y2={activePoint.y}
              stroke="rgba(243,246,253,0.34)"
              strokeDasharray="6 6"
            />
            <g transform={`translate(${padding.left + plotWidth + 6}, ${activePoint.y - 12})`}>
              <rect width="62" height="24" rx="12" fill="rgba(11,17,28,0.96)" stroke="rgba(34,109,64,0.28)" />
              <text x="31" y="16" fill="#f3f6fd" fontSize="11" textAnchor="middle">
                {activeEntry.value.toFixed(3)}
              </text>
            </g>
            <g transform={`translate(${clamp(activePoint.x + 16, padding.left + 8, width - 186)}, ${Math.max(padding.top + 8, activePoint.y - 52)})`}>
              <rect width="170" height="58" rx="14" fill="rgba(10,16,27,0.96)" stroke="rgba(34,109,64,0.24)" />
              <text x="14" y="20" fill="#f3f6fd" fontSize="12" fontWeight="700">
                {formatWealthDate(activeEntry.ts, points.length)}
              </text>
              <text x="14" y="35" fill="rgba(156,171,190,0.92)" fontSize="11">
                NAV {activeEntry.value.toFixed(3)}
              </text>
              <text x="14" y="49" fill={activeDelta >= 0 ? '#81dca0' : '#7aa6ff'} fontSize="11" fontWeight="700">
                {activeMoveLabel}
              </text>
            </g>
            <g transform={`translate(${clamp(activePoint.x - 44, padding.left, padding.left + plotWidth - 88)}, ${height - 30})`}>
              <rect width="88" height="20" rx="10" fill="rgba(10,16,27,0.94)" stroke="rgba(34,109,64,0.22)" />
              <text x="44" y="14" fill="#f3f6fd" fontSize="10" textAnchor="middle">
                {formatWealthDate(activeEntry.ts, points.length)}
              </text>
            </g>
          </>
        ) : null}

        {chartPoints.map((point, index) =>
          index === activeIndex ? (
            <circle key={`${points[index].ts}-dot`} cx={point.x} cy={point.y} r="4.2" fill="#f3f6fd" />
          ) : null
        )}

        {[0, Math.floor((points.length - 1) / 2), Math.max(0, points.length - 1)].map((index) => (
          <text
            key={`${points[index]?.ts}-label`}
            x={chartPoints[index]?.x || padding.left}
            y={height - 10}
            fill="rgba(156,171,190,0.92)"
            fontSize="11"
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
          >
            {points[index] ? formatWealthDate(points[index].ts, points.length) : ''}
          </text>
        ))}
      </svg>
      <div className="detail-nav-hover-panel">
        <span>{hoverIndex == null ? 'Latest NAV' : 'Hover NAV'}</span>
        <strong>{activeEntry.value.toFixed(3)}</strong>
        <em>{formatWealthDate(activeEntry.ts, points.length)} / {activeMoveLabel}</em>
      </div>
    </div>
  );
}

function CompareNavChart({ seriesList = [], periodLabel = '30D' }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const activeSeries = seriesList.filter((series) => series.points.length > 0);

  if (!activeSeries.length) {
    return (
      <div className="wealth-compare-chart-shell">
        <div className="detail-nav-hover-panel static">
          <span>Compare NAV path</span>
          <strong>No comparable products</strong>
          <em>Select one or more products to build the compare chart.</em>
        </div>
      </div>
    );
  }

  const width = 680;
  const height = 340;
  const padding = { top: 24, right: 20, bottom: 32, left: 16 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const allValues = activeSeries.flatMap((series) => series.points.map((point) => point.value));
  const low = allValues.length ? Math.min(...allValues) : 95;
  const high = allValues.length ? Math.max(...allValues) : 105;
  const range = high - low || 1;
  const maxLength = Math.max(...activeSeries.map((series) => series.points.length));
  const referenceLength = Math.max(1, maxLength);
  const yTicks = Array.from({ length: 4 }, (_, index) => low + (range * index) / 3);
  const referenceSeries = activeSeries[0];
  const referenceLengthDenominator = Math.max(1, referenceLength - 1);
  const activeIndex = hoverIndex == null ? referenceLength - 1 : clamp(hoverIndex, 0, referenceLength - 1);
  const formatDatePoint = (ts) => formatWealthDate(ts, referenceLength);

  function valueToY(value) {
    return padding.top + ((high - value) / range) * plotHeight;
  }

  function xForPoint(index, pointCount = referenceLength) {
    const safePointCount = Math.max(1, pointCount - 1);
    return padding.left + (pointCount === 1 ? 0 : (index / safePointCount) * plotWidth);
  }

  function getPointForSeriesAtIndex(series, indexInReference) {
    if (!series.points.length) return null;
    const index = series.points.length === 1 ? 0 : Math.round((indexInReference / referenceLengthDenominator) * (series.points.length - 1));
    const point = series.points[index];
    if (!point) return null;
    return {
      ...point,
      x: xForPoint(index, series.points.length),
      y: valueToY(point.value),
      valueIndex: index
    };
  }

  const hoverXAxisX = xForPoint(activeIndex, referenceLength);
  const hoveredSeriesPoints = activeSeries
    .map((series) => {
      const match = getPointForSeriesAtIndex(series, activeIndex);
      if (!match) return null;
      const baseValue = series.points[0]?.value || 1;
      const deltaValue = match.value - baseValue;
      return {
        ...series,
        ...match,
        deltaValue,
        deltaPercent: (deltaValue / baseValue) * 100
      };
    })
    .filter(Boolean);
  const hoverTs = hoveredSeriesPoints[0]?.ts || referenceSeries.points[0]?.ts;
  const axisLineY = hoveredSeriesPoints[0]?.y || padding.top + plotHeight / 2;

  function buildPath(points) {
    if (!points.length) return '';
    return points
      .map((point, index) => {
        const x = xForPoint(index, points.length);
        const y = valueToY(point.value);
        return `${x},${y}`;
      })
      .join(' ');
  }

  function handlePointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const clamped = clamp(svgX, padding.left, padding.left + plotWidth);
    const ratio = plotWidth === 0 ? 0 : (clamped - padding.left) / plotWidth;
    setHoverIndex(Math.round(ratio * referenceLengthDenominator));
  }

  return (
    <div className="wealth-compare-chart-shell">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {yTicks.map((tick) => {
          const y = padding.top + ((high - tick) / range) * plotHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={padding.left + plotWidth} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" />
              <text x={padding.left + plotWidth + 6} y={y + 4} fill="rgba(156,171,190,0.92)" fontSize="11">
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        {hoveredSeriesPoints.length ? (
          <>
            <line x1={hoverXAxisX} x2={hoverXAxisX} y1={padding.top} y2={padding.top + plotHeight} stroke="rgba(243,246,253,0.42)" strokeDasharray="6 6" />
            <line x1={padding.left} x2={padding.left + plotWidth} y1={axisLineY} y2={axisLineY} stroke="rgba(243,246,253,0.34)" strokeDasharray="6 6" />
          </>
        ) : null}

        {activeSeries.map((series) => (
          <polyline
            key={series.id}
            points={buildPath(series.points)}
            fill="none"
            stroke={series.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {hoveredSeriesPoints.map((seriesPoint) => (
          <circle key={`${seriesPoint.id}-${seriesPoint.valueIndex}-hover`} cx={seriesPoint.x} cy={seriesPoint.y} r="4" fill="#f3f6fd" />
        ))}

        {(
          referenceLength > 1
            ? [0, Math.floor((referenceLength - 1) / 2), referenceLength - 1]
            : [0]
        ).map((index) => {
          const referenceIndex = referenceSeries.points.length === 1 ? 0 : Math.round((index / referenceLengthDenominator) * (referenceSeries.points.length - 1));
          const point = referenceSeries.points[referenceIndex];
          return (
            <text
              key={`${point?.ts || index}-label`}
              x={xForPoint(index, referenceLength)}
              y={height - 10}
              fill="rgba(156,171,190,0.92)"
              fontSize="11"
              textAnchor={index === 0 ? 'start' : index === referenceLength - 1 ? 'end' : 'middle'}
            >
              {point ? formatDatePoint(point.ts) : ''}
            </text>
          );
        })}

        <text x={padding.left} y={height - 10} fill="rgba(156,171,190,0.92)" fontSize="11">
          Start
        </text>
        <text x={padding.left + plotWidth / 2} y={height - 10} fill="rgba(156,171,190,0.92)" fontSize="11" textAnchor="middle">
          {periodLabel}
        </text>
        <text x={padding.left + plotWidth} y={height - 10} fill="rgba(156,171,190,0.92)" fontSize="11" textAnchor="end">
          Latest
        </text>
      </svg>

      <div className="detail-nav-hover-panel">
        <span>{hoverTs ? 'Compare point' : 'Latest compare view'}</span>
        <strong>{hoverTs ? formatDatePoint(hoverTs) : 'Latest point'}</strong>
        <em>{periodLabel}</em>
        {hoveredSeriesPoints.map((seriesPoint) => {
          const tone = seriesPoint.deltaValue >= 0 ? 'risk-low' : 'risk-high';
          return (
            <div className="wealth-compare-hover-row" key={seriesPoint.id}>
              <span style={{ color: seriesPoint.color, fontWeight: 800 }}>{seriesPoint.name}</span>
              <div>
                <strong>{seriesPoint.value.toFixed(1)}</strong>
                <em className={tone}>
                  {seriesPoint.deltaValue >= 0 ? '+' : ''}
                  {seriesPoint.deltaValue.toFixed(1)} ({seriesPoint.deltaPercent >= 0 ? '+' : ''}
                  {seriesPoint.deltaPercent.toFixed(2)}%)
                </em>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubscriptionPreviewModal({
  open,
  product,
  amount,
  minimumTicket,
  availableCash,
  estimatedShares,
  address,
  validationMessage,
  firstInvestSteps,
  flowPreviewCards,
  modeledCallCards,
  accessChecklist,
  preInvestChecks,
  lifecycleNotes,
  onchainMechanics,
  vaultSnapshot,
  receiptProofMode = 'local',
  onReceiptProofModeChange,
  receiptTokenId,
  receiptUnitAmount = '0',
  isSigning = false,
  onClose,
  onConfirm
}) {
  if (!open || !product) return null;
  const onchainReceiptAvailable = Boolean(vaultSnapshot?.configured);
  const wantsOnchainReceipt = receiptProofMode === 'onchain' && onchainReceiptAvailable;
  const purchaseDateLabel = new Date().toLocaleString();
  const productDetailLabel = getSettlementPolicy(product).timing;
  const productDetailCopy = getSettlementPolicy(product).detail || product.redemption || productDetailLabel;

  return (
    <div className="wealth-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="wealth-subscribe-title">
      <div className="wealth-modal-card">
        <div className="section-head wealth-modal-head">
          <div>
            <div className="eyebrow">Subscription preview</div>
            <h2 id="wealth-subscribe-title">{product.name}</h2>
            <div className="muted">
              Wallet {shortAddress(address)} / receipt token {product.shareToken}
            </div>
          </div>

          <div className="wealth-modal-actions">
            <span className={`pill ${riskClass(product.risk)}`}>{product.risk}</span>
            <button className="ghost-btn compact" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="wealth-modal-grid">
          <div className="reason-card wealth-modal-stat">
            <div className="label">Subscribe amount</div>
            <div className="value">{formatValue(amount, false)}</div>
            <div className="muted">Minimum ticket {minimumTicket.toLocaleString()} PT</div>
          </div>
          <div className="reason-card wealth-modal-stat">
            <div className="label">Estimated shares</div>
            <div className="value">{formatShareBalance(estimatedShares, false)}</div>
            <div className="muted">Minted as {product.shareToken} at NAV {product.nav.toFixed(3)}</div>
          </div>
          <div className="reason-card wealth-modal-stat">
            <div className="label">Available PT</div>
            <div className="value">{formatValue(availableCash, false)}</div>
            <div className="muted">{product.redemption}</div>
          </div>
        </div>

        <div className="paper-mode-card wealth-modal-panel wealth-receipt-proof-panel">
          <div className="product-top">
            <div>
              <div className="product-title">Receipt proof</div>
              <div className="muted">
                The local Wealth ledger always records the position. Choose whether this buy also needs the onchain collectible proof.
              </div>
            </div>
            <span className={`pill ${wantsOnchainReceipt ? 'risk-low' : 'risk-medium'}`}>
              {wantsOnchainReceipt ? `Token #${receiptTokenId}` : 'Local proof'}
            </span>
          </div>

          <div className="wealth-proof-choice-grid">
            <button
              type="button"
              className={`wealth-proof-choice ${receiptProofMode === 'local' ? 'active' : ''}`}
              onClick={() => onReceiptProofModeChange?.('local')}
            >
              <span>Local proof only</span>
              <strong>No Sepolia mint</strong>
              <em>Creates a wallet-linked receipt record and proof hash inside this demo. Best when you only want to test the purchase flow.</em>
            </button>
            <button
              type="button"
              className={`wealth-proof-choice ${wantsOnchainReceipt ? 'active' : ''}`}
              onClick={() => onchainReceiptAvailable && onReceiptProofModeChange?.('onchain')}
              disabled={!onchainReceiptAvailable}
            >
              <span>Need receipt proof</span>
              <strong>{onchainReceiptAvailable ? `${Number(receiptUnitAmount || 0).toLocaleString()} receipt units` : 'Vault not configured'}</strong>
              <em>
                Requires Sepolia mint and W1 badge together. Token #{receiptTokenId} should show +5,000 for a 5,000 PT buy, not +5,000,000,000.
              </em>
            </button>
          </div>

          <div className="wealth-proof-detail-grid">
            <div>
              <span>Product</span>
              <strong>{product.name}</strong>
            </div>
            <div>
              <span>Purchase date</span>
              <strong>{purchaseDateLabel}</strong>
            </div>
            <div>
              <span>Product detail</span>
              <strong>{productDetailLabel}</strong>
              <em>{productDetailCopy}</em>
            </div>
          </div>
        </div>

        <div className="wealth-modal-layout compact">
          <div className="paper-mode-card wealth-modal-panel">
            <div className="product-title">What this button will do</div>
            <ReceiptLifecycleDiagram product={product} compact />
            <div className="wealth-inline-note paper-inline-note">
              <strong>Settle.</strong> Finish the receipt lifecycle: close, redeem, roll, or wait for maturity so the receipt turns back into cash or the promised payoff.
            </div>
            <DualInvestmentVisual product={product} />
          </div>

          <div className="paper-mode-card wealth-modal-panel">
            <div className="product-title">Quick checks</div>
            <div className="wealth-checklist">
              {accessChecklist.slice(0, 3).map((item) => (
                <div className="wealth-check-row" key={item.label}>
                  <span className={`wealth-check-badge ${item.done ? 'done' : 'todo'}`}>{item.done ? 'Ready' : 'Pending'}</span>
                  <div>
                    <div className="entry-title">{item.label}</div>
                    <div className="entry-copy">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="product-title" style={{ marginTop: 18 }}>First deposit steps</div>
            <div className="wealth-walkthrough-list">
              {firstInvestSteps.slice(0, 3).map((step) => (
                <div className="wealth-walkthrough-step" key={step.label}>
                  <span className={`wealth-step-badge ${step.status}`}>{step.status}</span>
                  <div>
                    <div className="entry-title">{step.label}</div>
                    <div className="entry-copy">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="wealth-modal-footer">
          <div className="wealth-inline-note">
            {validationMessage ||
              (wantsOnchainReceipt
                ? `This signs the subscription, records Sepolia receipt token #${receiptTokenId}, and records the W1 badge proof for ${product.name}.`
                : `This signs the subscription and saves a local receipt proof. No Sepolia receipt or badge transaction will be submitted.`)}
          </div>
          <div className="toolbar">
            <button className="secondary-btn" onClick={onClose}>
              Keep reviewing
            </button>
            <button className="primary-btn" onClick={onConfirm} disabled={Boolean(validationMessage) || isSigning}>
              {isSigning ? 'Await wallet' : 'Confirm signed subscription'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WealthInner() {
  const { uiLanguage, setUiLanguage, t } = useUiLanguage();
  useDomTranslation(uiLanguage, ['.app-shell', '.wealth-modal-backdrop', '.wallet-modal-backdrop']);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const {
    error: wealthTaskClaimError,
    isPending: isWealthTaskClaimSubmitting,
    writeContractAsync: writeWealthTaskContractAsync
  } = useWriteContract();
  const {
    isPending: isWealthReceiptSubmitting,
    writeContractAsync: writeWealthReceiptContractAsync
  } = useWriteContract();
  const [wealthTaskClaimHash, setWealthTaskClaimHash] = useState(undefined);
  const [wealthClaimRecipientKey, setWealthClaimRecipientKey] = useState('');
  const { isLoading: isWealthTaskClaimConfirming, isSuccess: wealthTaskClaimConfirmed } =
    useWaitForTransactionReceipt({
      hash: wealthTaskClaimHash
    });
  const { signMessageAsync, isPending: isWealthSigning } = useSignMessage();
  const [walletNickname, setWalletNickname] = useState('');
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletError, setWalletError] = useState('');
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
  const [selectedGoal, setSelectedGoal] = useState('parkCash');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedWrapperCategory, setSelectedWrapperCategory] = useState('all');
  const [selectedProductTypeCategory, setSelectedProductTypeCategory] = useState('all');
  const [selectedProductId, setSelectedProductId] = useState(DEFAULT_WEALTH_PRODUCT_ID);
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [liveProducts, setLiveProducts] = useState(() => getInitialLiveProducts());
  const [liveSnapshotState, setLiveSnapshotState] = useState(() => getInitialLiveSnapshotState());
  const [day1BriefState, setDay1BriefState] = useState(() => getInitialDay1BriefState());
  const [allocationAmount, setAllocationAmount] = useState(1000);
  const [feedback, setFeedback] = useState('');
  const [hideBalances, setHideBalances] = useState(false);
  const [productNavPeriods, setProductNavPeriods] = useState(() =>
    Object.fromEntries(WEALTH_PRODUCTS.map((product) => [product.id, '30d']))
  );
  const [shelfSearchQuery, setShelfSearchQuery] = useState('');
  const [compareNavPeriod, setCompareNavPeriod] = useState('30d');
  const [compareProductIds, setCompareProductIds] = useState(DEFAULT_COMPARE_PRODUCT_IDS_BY_CATEGORY.all.slice(0, MAX_COMPARE_PRODUCTS));
  const [comparePickerValue, setComparePickerValue] = useState('');
  const [selectedDetailTopics, setSelectedDetailTopics] = useState(['flow']);
  const [activeWalletProfilePanel, setActiveWalletProfilePanel] = useState('profile');
  const [selectedWealthTaskId, setSelectedWealthTaskId] = useState(null);
  const [wealthClaimTaskId, setWealthClaimTaskId] = useState('');
  const [wealthDiligencePageIndex, setWealthDiligencePageIndex] = useState(0);
  const [fastForwardTarget, setFastForwardTarget] = useState('90d');
  const [settlementDays, setSettlementDays] = useState(0);
  const [settlementAction, setSettlementAction] = useState('roll');
  const [settlementTransferProductId, setSettlementTransferProductId] = useState('');
  const [timelineDockOpen, setTimelineDockOpen] = useState(true);
  const [timelineDockFloat, setTimelineDockFloat] = useState(() =>
    normalizeWealthTimelineFloat(readStorageJson(WEALTH_TIMELINE_FLOAT_STORAGE_KEY, null))
  );
  const [timelineDockGesture, setTimelineDockGesture] = useState(null);
  const [dualCurrencyPairId, setDualCurrencyPairId] = useState(DUAL_CURRENCY_PAIR_OPTIONS[0].id);
  const [dualCurrencyDirection, setDualCurrencyDirection] = useState('buy-low');
  const [dualCurrencyTargetPct, setDualCurrencyTargetPct] = useState(-2);
  const [dualCurrencySettlementMovePct, setDualCurrencySettlementMovePct] = useState(4);
  const [dualWindowPriceMovePct, setDualWindowPriceMovePct] = useState(0);
  const [pledgeTermMode, setPledgeTermMode] = useState('flex');
  const [collateralBorrowInput, setCollateralBorrowInput] = useState(0);
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [subscriptionReceiptProofMode, setSubscriptionReceiptProofMode] = useState('local');
  const [progressState, setProgressState] = useState({
    guideCompleted: false,
    quizCompleted: false,
    paperTradesCompleted: 0,
    wealthTaskClaims: normalizeWealthTaskClaims()
  });
  const [wealthState, setWealthState] = useState(defaultWealthState());
  const [paperProfileState, setPaperProfileState] = useState({});
  const [wealthStateAddressKey, setWealthStateAddressKey] = useState('');
  const [paperProfileAddressKey, setPaperProfileAddressKey] = useState('');
  const [pendingScrollProductId, setPendingScrollProductId] = useState(null);
  const [pendingScrollMode, setPendingScrollMode] = useState('detail');
  const [pendingFocusRequest, setPendingFocusRequest] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [recommendationShuffleSeed] = useState(() => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now()}-${Math.random()}`;
  });
  const productCardRefs = useRef(new Map());
  const productDetailRefs = useRef(new Map());
  const previousCompareCategoryRef = useRef('all');

  function findProductScrollNode(productId, mode = 'detail') {
    if (typeof document === 'undefined' || !productId) return null;
    const attrName = mode === 'detail' ? 'data-wealth-product-detail' : 'data-wealth-product-card';
    return Array.from(document.querySelectorAll(`[${attrName}]`)).find(
      (node) => node.getAttribute(attrName) === productId
    );
  }

  function scrollProductNodeIntoView(productId, mode = 'detail') {
    if (typeof window === 'undefined') return false;
    const targetNode = findProductScrollNode(productId, mode);
    if (!targetNode) return false;
    targetNode.scrollIntoView({ behavior: 'smooth', block: mode === 'detail' ? 'start' : 'nearest', inline: 'nearest' });
    return true;
  }

  function queueProductScroll(productId, mode = 'detail') {
    setPendingScrollMode(mode);
    setPendingScrollProductId(productId);

    if (typeof window === 'undefined') return;
    let attempts = 0;

    function tryScroll() {
      if (scrollProductNodeIntoView(productId, mode)) {
        setPendingScrollProductId(null);
        return;
      }
      attempts += 1;
      if (attempts < 18) {
        window.requestAnimationFrame(tryScroll);
      }
    }

    window.requestAnimationFrame(tryScroll);
  }

  const metaMaskConnector = useMemo(
    () => connectors.find((connector) => connector.name.toLowerCase().includes('metamask')) || connectors[0],
    [connectors]
  );
  const walletDisplayName = useMemo(
    () => getWalletDisplayName(address, walletNickname, shortAddress),
    [address, walletNickname]
  );
  const connectedAddressKey = useMemo(() => (address ? address.toLowerCase() : ''), [address]);
  const wealthWalletActionPending = isWealthSigning || isWealthReceiptSubmitting;
  const profileBackupAccounts = useMemo(
    () => listProfileBackupAccounts(),
    [connectedAddressKey, profileBackupStatus, walletNickname]
  );

  const progressStorageKey = useMemo(() => getProgressStorageKey(address), [address]);
  const paperReplayStateKey = useMemo(() => getPaperReplayStateKey(address), [address]);
  const wealthStorageKey = useMemo(() => getWealthStateKey(address), [address]);
  const productMap = useMemo(() => Object.fromEntries(liveProducts.map((product) => [product.id, product])), [liveProducts]);

  useEffect(() => {
    const savedNickname = readWalletNickname(address);
    setWalletNickname(savedNickname);
    setWalletNicknameDraft(savedNickname);
    setWalletNicknameFeedback('');
  }, [address]);

  useEffect(() => {
    setProfileBackupStatus('');
  }, [connectedAddressKey]);

  useEffect(() => {
    if (!wealthVaultConfigured && subscriptionReceiptProofMode !== 'local') {
      setSubscriptionReceiptProofMode('local');
    }
  }, [subscriptionReceiptProofMode]);

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
    if (typeof window === 'undefined') return undefined;

    function refreshMetaMaskState() {
      setHasMetaMaskInstalled(Boolean(window.ethereum?.isMetaMask || window.ethereum));
    }

    refreshMetaMaskState();
    window.addEventListener('ethereum#initialized', refreshMetaMaskState, { once: true });
    const timer = window.setTimeout(refreshMetaMaskState, 1000);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('ethereum#initialized', refreshMetaMaskState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function updateBackToTopVisibility() {
      const midpoint = Math.max(360, window.innerHeight * 0.55);
      setShowBackToTop(window.scrollY > midpoint);
    }

    updateBackToTopVisibility();
    window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
    window.addEventListener('resize', updateBackToTopVisibility);

    return () => {
      window.removeEventListener('scroll', updateBackToTopVisibility);
      window.removeEventListener('resize', updateBackToTopVisibility);
    };
  }, []);

  useEffect(() => {
    if (!address || pendingWalletNickname === null) return;

    const savedNickname = writeWalletNickname(address, pendingWalletNickname);
    setWalletNickname(savedNickname);
    setWalletNicknameDraft(savedNickname);
    setWalletNicknameFeedback(savedNickname ? `Nickname saved as ${savedNickname}.` : 'Nickname cleared.');
    setPendingWalletNickname(null);
  }, [address, pendingWalletNickname]);

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
  const { data: quizBadgeOnchain } = useReadContract({
    address: badgeContractConfigured ? BADGE_CONTRACT_ADDRESS : undefined,
    abi: welcomeBadgeAbi,
    functionName: 'hasMintedTask',
    args: address ? [address, BADGE_TYPES.quiz] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address) && badgeContractConfigured
    }
  });
  const { data: paperBadgeOnchain } = useReadContract({
    address: badgeContractConfigured ? BADGE_CONTRACT_ADDRESS : undefined,
    abi: welcomeBadgeAbi,
    functionName: 'hasMintedTask',
    args: address ? [address, BADGE_TYPES.paper] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address) && badgeContractConfigured
    }
  });
  const { data: vaultNavBps } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'navBps',
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured
    }
  });
  const { data: vaultStrategyStatus } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'strategyStatus',
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured
    }
  });
  const { data: vaultLastAttestedAt } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'lastAttestedAt',
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured
    }
  });
  const { data: vaultLatestAttestationRoot } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'latestAttestationRoot',
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured
    }
  });
  const { data: vaultSubscriptionsPaused } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'subscriptionsPaused',
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured
    }
  });
  const { data: vaultMinSubscription } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'minSubscription',
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured
    }
  });
  const { data: vaultEligibleInvestor } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'eligibleInvestor',
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured && Boolean(address)
    }
  });
  const { data: vaultRiskTier } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'riskTier',
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured && Boolean(address)
    }
  });
  const { data: vaultAdvancedShelfAccess } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'canAccessAdvancedShelf',
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured && Boolean(address)
    }
  });
  const { data: wealthSubscribeTaskOnchain, refetch: refetchWealthSubscribeTask } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'hasWealthTask',
    args: address ? [address, WEALTH_TASK_TYPES.subscribe] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured && Boolean(address)
    }
  });
  const {
    data: wealthSubscribeTaskCollectibleBalance,
    refetch: refetchWealthSubscribeTaskCollectible
  } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'balanceOf',
    args: address ? [address, WEALTH_TASK_TOKEN_IDS.subscribe] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured && Boolean(address)
    }
  });
  const { data: wealthSettlementTaskOnchain, refetch: refetchWealthSettlementTask } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'hasWealthTask',
    args: address ? [address, WEALTH_TASK_TYPES.settlement] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured && Boolean(address)
    }
  });
  const {
    data: wealthSettlementTaskCollectibleBalance,
    refetch: refetchWealthSettlementTaskCollectible
  } = useReadContract({
    address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : undefined,
    abi: wealthVaultAbi,
    functionName: 'balanceOf',
    args: address ? [address, WEALTH_TASK_TOKEN_IDS.settlement] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: wealthVaultConfigured && Boolean(address)
    }
  });

  useEffect(() => {
    if (!address) {
      setProgressState({
        guideCompleted: false,
        quizCompleted: false,
        paperTradesCompleted: 0,
        wealthTaskClaims: normalizeWealthTaskClaims()
      });
      return;
    }

    const storedProgress = readStorageJson(progressStorageKey, {
      guideCompleted: false,
      quizCompleted: false,
      paperTradesCompleted: 0,
      wealthTaskClaims: normalizeWealthTaskClaims()
    });
    const profileProgress = readWalletProfile(address).progress || {};
    const storedWealthTaskClaims = normalizeWealthTaskClaims(storedProgress.wealthTaskClaims);
    const profileWealthTaskClaims = normalizeWealthTaskClaims(profileProgress.wealthTaskClaims);

    setProgressState({
      guideCompleted: Boolean(storedProgress.guideCompleted || profileProgress.guideCompleted),
      quizCompleted: Boolean(storedProgress.quizCompleted || profileProgress.quizCompleted),
      paperTradesCompleted: Math.max(
        Number(storedProgress.paperTradesCompleted || 0),
        Number(profileProgress.paperTradesCompleted || 0)
      ),
      wealthTaskClaims: {
        subscribe: Boolean(storedWealthTaskClaims.subscribe || profileWealthTaskClaims.subscribe),
        settlement: Boolean(storedWealthTaskClaims.settlement || profileWealthTaskClaims.settlement)
      }
    });
  }, [address, progressStorageKey]);

  useEffect(() => {
    if (!address) {
      setWealthState(defaultWealthState());
      setWealthStateAddressKey('');
      return;
    }

    const walletAddressKey = String(address).toLowerCase();
    const storedWealthState = normalizeWealthState(readStorageJson(wealthStorageKey, defaultWealthState()));
    setWealthState(normalizeWealthState(readRecoveredWealthState(address, storedWealthState)));
    setWealthStateAddressKey(walletAddressKey);
  }, [address, wealthStorageKey]);

  useEffect(() => {
    if (!address) {
      setPaperProfileState({});
      setPaperProfileAddressKey('');
      return;
    }

    const walletAddressKey = String(address).toLowerCase();
    setPaperProfileState(readRecoveredPaperState(address, readStorageJson(paperReplayStateKey, {})));
    setPaperProfileAddressKey(walletAddressKey);
  }, [address, paperReplayStateKey]);

  useEffect(() => {
    if (!address) return;
    const walletAddressKey = String(address).toLowerCase();
    if (wealthStateAddressKey !== walletAddressKey || paperProfileAddressKey !== walletAddressKey) return;
    writeWalletProfilePatch(address, {
      wealth: {
        state: wealthState
      },
      paper: {
        state: paperProfileState
      }
    });
  }, [address, wealthState, paperProfileState, wealthStateAddressKey, paperProfileAddressKey]);

  useEffect(() => {
    if (!address) return;
    if (wealthStateAddressKey !== String(address).toLowerCase()) return;
    writeStorageJson(wealthStorageKey, wealthState);
  }, [address, wealthState, wealthStorageKey, wealthStateAddressKey]);

  useEffect(() => {
    writeStorageJson(WEALTH_TIMELINE_FLOAT_STORAGE_KEY, timelineDockFloat);
  }, [timelineDockFloat]);

  useEffect(() => {
    function handleWindowResize() {
      setTimelineDockFloat((current) => normalizeWealthTimelineFloat(current));
    }

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  useEffect(() => {
    if (!timelineDockGesture) return undefined;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    function handlePointerMove(event) {
      const viewport = getFloatingTimelineViewport();
      const deltaX = event.clientX - timelineDockGesture.startX;
      const deltaY = event.clientY - timelineDockGesture.startY;

      if (timelineDockGesture.type === 'drag') {
        setTimelineDockFloat((current) =>
          normalizeWealthTimelineFloat(
            {
              ...current,
              left: timelineDockGesture.left + deltaX,
              top: timelineDockGesture.top + deltaY
            },
            viewport
          )
        );
        return;
      }

      setTimelineDockFloat((current) =>
        normalizeWealthTimelineFloat(
          {
            ...current,
            arrowSide: event.clientX <= viewport.width / 2 ? 'left' : 'right',
            arrowTop: timelineDockGesture.arrowTop + deltaY
          },
          viewport
        )
      );
    }

    function finishPointerGesture(event) {
      if (timelineDockGesture.type === 'arrow') {
        const deltaX = event.clientX - timelineDockGesture.startX;
        const deltaY = event.clientY - timelineDockGesture.startY;
        if (Math.abs(deltaX) + Math.abs(deltaY) < 8) {
          setTimelineDockFloat((current) =>
            normalizeWealthTimelineFloat({
              ...current,
              isCollapsed: false
            })
          );
          setTimelineDockOpen(true);
        }
      }

      setTimelineDockGesture(null);
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
  }, [timelineDockGesture]);

  useEffect(() => {
    let active = true;

    buildLiveWealthProducts(WEALTH_PRODUCTS)
      .then((products) => {
        if (!active || !products.length) return;
        writeStorageJson(WEALTH_LIVE_CACHE_KEY, {
          products,
          updatedAt: new Date().toISOString()
        });
        startTransition(() => {
          setLiveProducts((current) => (liveProductsEqual(current, products) ? current : products));
          setLiveSnapshotState('ready');
        });
      })
      .catch(() => {
        if (!active) return;
        startTransition(() => {
          setLiveProducts((current) => (current.length ? current : WEALTH_PRODUCTS));
          setLiveSnapshotState((current) => (current === 'cached' ? 'cached' : 'fallback'));
        });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    fetchDay1BriefSnapshot()
      .then((result) => {
        if (!active) return;
        writeStorageJson(DAY1_BRIEF_CACHE_KEY, {
          data: result.data,
          sourceLabel: result.sourceLabel,
          note: result.note
        });
        startTransition(() => {
          setDay1BriefState((current) => {
            if (
              current.status === 'ready' &&
              day1SnapshotsEqual(current.data, result.data) &&
              current.sourceLabel === result.sourceLabel &&
              current.note === result.note
            ) {
              return current;
            }

            return {
              status: 'ready',
              data: result.data,
              sourceLabel: result.sourceLabel,
              note: result.note
            };
          });
        });
      })
      .catch((error) => {
        if (!active) return;
        startTransition(() => {
          setDay1BriefState((current) =>
            current.data
              ? {
                  ...current,
                  status: 'cached',
                  note: current.note || 'Cached market overlay is still in use because the live brief could not be refreshed.'
                }
              : {
                  status: 'fallback',
                  data: null,
                  sourceLabel: 'Unavailable',
                  note: error.message || 'Day1 overlay could not be loaded.'
                }
          );
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const currentWalletAddressKey = address ? String(address).toLowerCase() : '';
  const wealthStateReadyForWallet = !address || wealthStateAddressKey === currentWalletAddressKey;
  const displayWealthState = wealthStateReadyForWallet ? wealthState : defaultWealthState();
  const currentGoal = useMemo(() => getGoalById(selectedGoal), [selectedGoal]);
  const wealthCategoryOptions = useMemo(() => WEALTH_PRODUCT_TYPE_FILTERS, []);
  const wrapperCategoryOptions = useMemo(
    () => WEALTH_PRODUCT_TYPE_GROUPS.find((group) => group.id === 'wrapper')?.options || [],
    []
  );
  const productTypeCategoryOptions = useMemo(
    () => WEALTH_PRODUCT_TYPE_GROUPS.find((group) => group.id === 'productType')?.options || [],
    []
  );
  const selectedWrapperCategoryMeta =
    wrapperCategoryOptions.find((category) => category.id === selectedWrapperCategory) || { id: 'all', label: '' };
  const selectedProductTypeCategoryMeta =
    productTypeCategoryOptions.find((category) => category.id === selectedProductTypeCategory) || { id: 'all', label: 'All' };
  const activeProductFilterIds = useMemo(
    () => getActiveWealthProductFilterIds(selectedWrapperCategory, selectedProductTypeCategory),
    [selectedProductTypeCategory, selectedWrapperCategory]
  );
  const hasActiveProductFilter = activeProductFilterIds.length > 0;
  const effectiveShelfFilterIds = useMemo(
    () => (hasActiveProductFilter ? activeProductFilterIds : selectedCategory !== 'all' ? [selectedCategory] : []),
    [activeProductFilterIds, hasActiveProductFilter, selectedCategory]
  );
  const hasEffectiveShelfFilter = effectiveShelfFilterIds.length > 0;
  const activeProductFilterLabel = (
    [
      selectedWrapperCategoryMeta?.id !== 'all' ? selectedWrapperCategoryMeta?.label : '',
      selectedProductTypeCategoryMeta?.id !== 'all' ? selectedProductTypeCategoryMeta?.label : ''
    ].filter(Boolean).join(' / ') || 'All products'
  );
  const dualInvestmentShelfActive = effectiveShelfFilterIds.includes('dual');
  const recommendedProducts = useMemo(
    () =>
      currentGoal.recommended
        .map((productId) => getProductByIdFrom(liveProducts, productId))
        .filter(Boolean),
    [currentGoal, liveProducts]
  );
  const riskBalancedRecommendedProducts = useMemo(() => {
    const picks = getRiskBalancedRecommendedProducts(liveProducts);
    return picks.length ? picks : recommendedProducts;
  }, [liveProducts, recommendedProducts]);

  const goalFilteredProducts = useMemo(
    () => liveProducts.filter((product) => productMatchesWealthGoal(product, selectedGoal)),
    [liveProducts, selectedGoal]
  );

  const baseShelfProducts = useMemo(() => {
    const filterUniverse = hasEffectiveShelfFilter ? liveProducts : goalFilteredProducts;
    const bucketMatches = filterUniverse.filter((product) =>
      productMatchesWealthProductFilters(product, effectiveShelfFilterIds)
    );

    if (bucketMatches.length > 0 || hasEffectiveShelfFilter) return bucketMatches;

    return recommendedProducts;
  }, [effectiveShelfFilterIds, goalFilteredProducts, hasEffectiveShelfFilter, liveProducts, recommendedProducts]);
  const normalizedShelfSearchQuery = shelfSearchQuery.trim().toLowerCase();
  const searchableShelfProducts = useMemo(() => {
    if (!normalizedShelfSearchQuery || dualInvestmentShelfActive) return baseShelfProducts;

    return baseShelfProducts.filter((product) =>
      [
        product.name,
        product.shortName,
        product.productType,
        product.status,
        product.humanSummary,
        product.technicalSummary,
        product.baseAsset,
        product.underlying,
        product.shareToken,
        product.liveTieIn
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedShelfSearchQuery))
    );
  }, [baseShelfProducts, dualInvestmentShelfActive, normalizedShelfSearchQuery]);
  const shelfProducts = useMemo(() => {
    const sortedProducts = sortProductsWithOwnedFirst(searchableShelfProducts, displayWealthState.positions);
    if (!dualInvestmentShelfActive) {
      return sortedProducts;
    }
    return [...sortedProducts].sort(
      (leftProduct, rightProduct) => Number(!isDualInvestmentProduct(leftProduct)) - Number(!isDualInvestmentProduct(rightProduct))
    );
  }, [searchableShelfProducts, displayWealthState.positions, dualInvestmentShelfActive]);

  const wealthActivityTypes = getActivityTypeSet(displayWealthState);
  const latestSubscribeActivity = getLatestWealthActivity(displayWealthState, ['subscribe']);
  const latestSettlementActivity = getLatestWealthActivity(displayWealthState, WEALTH_SETTLEMENT_ACTIVITY_TYPES);
  const wealthSubscribeDetailActionDone = hasWealthActivity(displayWealthState, ['subscribe']);
  const wealthSettlementDetailActionDone = hasWealthActivity(displayWealthState, WEALTH_SETTLEMENT_ACTIVITY_TYPES);
  const localWealthTaskClaims = normalizeWealthTaskClaims(progressState.wealthTaskClaims);
  const wealthSubscribeTaskDone =
    Object.keys(displayWealthState.positions || {}).length > 0 || wealthActivityTypes.has('subscribe');
  const wealthSettlementTaskDone =
    wealthSettlementDetailActionDone ||
    Object.keys(displayWealthState.collateral || {}).length > 0;
  const wealthSubscribeTaskCollectibleOwned = hasPositiveOnchainBalance(wealthSubscribeTaskCollectibleBalance);
  const wealthSettlementTaskCollectibleOwned = hasPositiveOnchainBalance(wealthSettlementTaskCollectibleBalance);
  const wealthSubscribeTaskClaimedOnchain = Boolean(
    wealthSubscribeTaskOnchain && wealthSubscribeTaskCollectibleOwned
  );
  const wealthSettlementTaskClaimedOnchain = Boolean(
    wealthSettlementTaskOnchain && wealthSettlementTaskCollectibleOwned
  );
  const wealthSubscribeTaskClaimed = wealthVaultConfigured
    ? wealthSubscribeTaskClaimedOnchain
    : Boolean(localWealthTaskClaims.subscribe);
  const wealthSettlementTaskClaimed = wealthVaultConfigured
    ? wealthSettlementTaskClaimedOnchain
    : Boolean(localWealthTaskClaims.settlement);
  const wealthSubscribeQuestDone = Boolean(
    wealthSubscribeTaskClaimed || (isConnected && wealthSubscribeDetailActionDone && wealthSubscribeTaskDone)
  );
  const wealthSettlementQuestDone = Boolean(
    wealthSettlementTaskClaimed || (isConnected && wealthSubscribeTaskDone && wealthSettlementDetailActionDone)
  );
  const wealthQuestRows = [
    {
      id: 'subscribe',
      taskNumber: 1,
      badge: WEALTH_TASK_BADGES.subscribe,
      activityLabel: 'Receipt record',
      title: 'Buy one receipt',
      copy: 'Choose a product, open the lifecycle desk, review the buy flow, then record a local receipt balance in the wealth ledger.',
      done: wealthSubscribeTaskClaimed,
      claimed: wealthSubscribeTaskClaimed,
      readyToClaim: Boolean(wealthSubscribeQuestDone && !wealthSubscribeTaskClaimed),
      statusLabel: wealthSubscribeTaskClaimed ? 'Minted' : wealthSubscribeQuestDone ? 'Wait to be minted' : 'To do',
      statusTone: wealthSubscribeTaskClaimed ? 'done' : wealthSubscribeQuestDone ? 'ready' : 'todo'
    },
    {
      id: 'settlement',
      taskNumber: 2,
      badge: WEALTH_TASK_BADGES.settlement,
      activityLabel: 'Settle / pledge',
      title: 'Simulate settle or pledge',
      copy: 'Settle means close, redeem, roll, or mature the receipt. Pledge means locking it as route support before release.',
      done: wealthSettlementTaskClaimed,
      claimed: wealthSettlementTaskClaimed,
      readyToClaim: Boolean(wealthSettlementQuestDone && !wealthSettlementTaskClaimed),
      statusLabel: wealthSettlementTaskClaimed ? 'Minted' : wealthSettlementQuestDone ? 'Wait to be minted' : 'To do',
      statusTone: wealthSettlementTaskClaimed ? 'done' : wealthSettlementQuestDone ? 'ready' : 'todo'
    }
  ];
  const wealthTaskCompletedCount = wealthQuestRows.filter((quest) => quest.done).length;
  const nextWealthTask = wealthQuestRows.find((quest) => !quest.done) || wealthQuestRows[wealthQuestRows.length - 1];
  const selectedWealthTaskDirect = wealthQuestRows.find((quest) => quest.id === selectedWealthTaskId) || null;
  const selectedWealthTask = selectedWealthTaskDirect || nextWealthTask;
  const wealthTaskDetailOpen = Boolean(selectedWealthTaskDirect);
  const selectedCategoryMeta = wealthCategoryOptions.find((category) => category.id === selectedCategory) || wealthCategoryOptions[0];
  const selectedShelfTitle = hasActiveProductFilter
    ? activeProductFilterLabel
    : selectedCategory === 'all'
      ? currentGoal.label
      : selectedCategoryMeta.label;
  const selectedShelfSubtitle = hasActiveProductFilter
    ? 'Product type filtered shelf. Product-lane and type chips stay independent, so each row still opens its own detail flow.'
    : selectedCategory === 'all'
      ? 'Goal-filtered shelf. Use product-type chips below to jump directly into a productized lane.'
      : `${selectedCategoryMeta.label} productized as a buyable wealth receipt, not as a raw strategy terminal.`;
  const recommendedPanelTitle = hasActiveProductFilter
    ? activeProductFilterLabel
    : hasEffectiveShelfFilter
      ? selectedCategoryMeta.label
      : 'Low / Medium / High picks';
  const recommendedProductsForView = useMemo(() => {
    const filteredSource = hasEffectiveShelfFilter ? searchableShelfProducts : goalFilteredProducts;
    const unionFallback = hasEffectiveShelfFilter
      ? liveProducts.filter((product) =>
          effectiveShelfFilterIds.some((categoryId) => productMatchesWealthCategory(product, categoryId))
        )
      : riskBalancedRecommendedProducts;
    const sourceProducts =
      filteredSource.length > 0
        ? filteredSource
        : unionFallback.length > 0
          ? unionFallback
          : liveProducts;

    return getRandomizedTopRecommendedProducts(sourceProducts, {
      day1Data: day1BriefState.data,
      seed: `${recommendationShuffleSeed}-${selectedGoal}-${activeProductFilterLabel}-${normalizedShelfSearchQuery}`,
      limit: 3
    });
  }, [
    activeProductFilterLabel,
    day1BriefState.data,
    effectiveShelfFilterIds,
    goalFilteredProducts,
    hasEffectiveShelfFilter,
    liveProducts,
    normalizedShelfSearchQuery,
    recommendationShuffleSeed,
    riskBalancedRecommendedProducts,
    searchableShelfProducts,
    selectedGoal
  ]);
  const categoryCompareSeedIds = useMemo(() => {
    const defaultIds = DEFAULT_COMPARE_PRODUCT_IDS_BY_CATEGORY[selectedCategory] || DEFAULT_COMPARE_PRODUCT_IDS_BY_CATEGORY.all;
    return [...new Set([...defaultIds, selectedProductId, ...recommendedProducts.map((product) => product.id)])]
      .filter((productId) => liveProducts.some((product) => product.id === productId))
      .slice(0, MAX_COMPARE_PRODUCTS);
  }, [liveProducts, recommendedProducts, selectedCategory, selectedProductId]);
  const shelfMetricsMap = useMemo(
    () =>
      new Map(
        shelfProducts.map((product) => {
          const diligenceModel = buildDiligenceModel(product, day1BriefState.data);
          const returnDisplay = getProductReturnMetricDisplay(product);
          return [
            product.id,
            {
              score: diligenceModel.finalScore,
              baseScore: diligenceModel.baseScore,
              signalAdjustment: diligenceModel.signalAdjustment,
              annualYieldRate: getAnnualYieldRate(product),
              annualYieldBasis: getAnnualYieldBasis(product),
              returnMetric: returnDisplay.metric,
              returnValue: returnDisplay.value,
              returnBasis: returnDisplay.basis,
              returnSubtext: returnDisplay.subtext,
              returnTone: returnDisplay.tone,
              returnSortRate: returnDisplay.sortRate,
              nav: product.nav,
              risk: product.risk
            }
          ];
        })
      ),
    [day1BriefState.data, shelfProducts]
  );

  useEffect(() => {
    if (!shelfProducts.some((product) => product.id === selectedProductId)) {
      const defaultProduct = getProductByIdFrom(liveProducts, DEFAULT_WEALTH_PRODUCT_ID);
      setSelectedProductId(
        shelfProducts.find((product) => product.id === DEFAULT_WEALTH_PRODUCT_ID)?.id ||
          shelfProducts[0]?.id ||
          defaultProduct?.id ||
          liveProducts[0]?.id ||
          WEALTH_PRODUCTS[0].id
      );
    }
  }, [liveProducts, selectedProductId, shelfProducts]);

  useEffect(() => {
    if (expandedProductId && !shelfProducts.some((product) => product.id === expandedProductId)) {
      setExpandedProductId(null);
    }
  }, [expandedProductId, shelfProducts]);

  useEffect(() => {
    if (!selectedWealthTaskId) return;
    if (!wealthQuestRows.some((quest) => quest.id === selectedWealthTaskId)) {
      setSelectedWealthTaskId(null);
    }
  }, [nextWealthTask.id, selectedWealthTaskId, wealthQuestRows]);

  useEffect(() => {
    if (pendingFocusRequest || pendingScrollProductId) return;
    setPendingScrollProductId(null);
  }, [selectedGoal, selectedCategory, shelfSearchQuery, pendingFocusRequest, pendingScrollProductId]);

  useEffect(() => {
    setCompareProductIds((current) => {
      const validIds = current.filter((productId) => liveProducts.some((product) => product.id === productId));
      if (validIds.length > 0) return [...new Set(validIds)].slice(0, MAX_COMPARE_PRODUCTS);

      return categoryCompareSeedIds;
    });
  }, [categoryCompareSeedIds, liveProducts]);

  useEffect(() => {
    if (previousCompareCategoryRef.current === selectedCategory) return;
    previousCompareCategoryRef.current = selectedCategory;
    setCompareProductIds(categoryCompareSeedIds);
  }, [categoryCompareSeedIds, selectedCategory]);

  const selectedProduct = useMemo(() => getProductByIdFrom(liveProducts, selectedProductId), [liveProducts, selectedProductId]);
  const selectedProductIsDual = isDualInvestmentProduct(selectedProduct);
  const selectedReturnMetricDisplay = getProductReturnMetricDisplay(selectedProduct, hideBalances);
  useEffect(() => {
    setWealthDiligencePageIndex(0);
  }, [selectedProduct.id]);
  useEffect(() => {
    if (!isDualInvestmentProduct(selectedProduct)) return;
    const productPair = getDualPairForProduct(selectedProduct, null);
    if (!productPair?.id) return;
    setDualCurrencyPairId((current) => (current === productPair.id ? current : productPair.id));
  }, [selectedProduct.id]);
  const activeDetailTopic = selectedDetailTopics[0] || '';
  const activeDetailTopicMeta = DETAIL_TOPIC_OPTIONS.find((topic) => topic.id === activeDetailTopic) || null;
  const guideTaskDone = progressState.guideCompleted || Boolean(riskBadgeOnchain);
  const quizTaskDone = progressState.quizCompleted || Boolean(quizBadgeOnchain);
  const paperTaskDone = progressState.paperTradesCompleted > 0 || Boolean(paperBadgeOnchain);
  const selectedProductNavPeriod = productNavPeriods[selectedProduct.id] || '30d';
  const selectedNavSeries = selectedProduct.navHistory?.[selectedProductNavPeriod] || [];
  const selectedNavPoints = normalizeNavSeries(selectedNavSeries, selectedProductNavPeriod);
  const selectedNavDelta = getNavDelta(selectedNavPoints);
  const selectedNavDeltaPercent = getNavDeltaPercent(selectedNavPoints);
  const selectedTicketGain = getTicketGain(selectedNavPoints);
  const selectedWindowLabel = NAV_PERIOD_OPTIONS.find((period) => period.id === selectedProductNavPeriod)?.label || '30D';
  useEffect(() => {
    if (!isDualInvestmentProduct(selectedProduct)) return;
    const moveLimit = getDualWindowMoveLimit(selectedProductNavPeriod);
    const nextMove = clamp(Math.round(selectedNavDeltaPercent), -moveLimit, moveLimit);
    setDualWindowPriceMovePct((current) => (Number(current) === nextMove ? current : nextMove));
  }, [selectedNavDeltaPercent, selectedProduct.id, selectedProductNavPeriod]);
  const selectedPeriodComparisons = useMemo(
    () =>
      NAV_PERIOD_OPTIONS.map((period) => {
        const points = normalizeNavSeries(selectedProduct.navHistory?.[period.id] || [], period.id);
        return {
          id: period.id,
          label: period.label,
          nav: getLatestNav(points, selectedProduct.nav),
          delta: getNavDelta(points),
          deltaPercent: getNavDeltaPercent(points),
          ticketGain: getTicketGain(points)
        };
      }),
    [selectedProduct]
  );
  const compareProducts = useMemo(
    () => compareProductIds.map((productId) => getProductByIdFrom(liveProducts, productId)).filter(Boolean),
    [compareProductIds, liveProducts]
  );
  const compareWindowLabel = NAV_PERIOD_OPTIONS.find((period) => period.id === compareNavPeriod)?.label || '30D';
  const compareSeriesList = useMemo(
    () =>
      compareProducts.map((product, index) => {
        const points = normalizeNavSeries(product.navHistory?.[compareNavPeriod] || [], compareNavPeriod);
        const firstValue = points[0]?.value || product.nav || 1;
        return {
          id: product.id,
          name: product.shortName || product.name,
          color: COMPARE_LINE_COLORS[index % COMPARE_LINE_COLORS.length],
          latestNav: getLatestNav(points, product.nav),
          deltaPercent: getNavDeltaPercent(points),
          points: points.map((point) => ({
            ts: point.ts,
            value: roundNumber((point.value / firstValue) * 100, 2)
          }))
        };
      }),
    [compareNavPeriod, compareProducts]
  );
  const selectedInsight = WEALTH_PRODUCT_INSIGHTS[selectedProduct.id] || {
    holdings: [
      { name: selectedProduct.underlying || selectedProduct.baseAsset || selectedProduct.productType, weight: '100%', role: selectedProduct.productType || 'Product exposure' }
    ],
    feeStack: [selectedProduct.fees?.management || 'Fees and route drag should be reviewed in product terms.'],
    whyEarns: selectedProduct.yieldSource || selectedProduct.annualYieldSource || 'Return source depends on the product terms and payoff structure.',
    worryCopy: selectedProduct.worstCase || selectedProduct.riskNote || 'Main risk should be reviewed before subscribing.'
  };
  const selectedDiligenceModel = useMemo(
    () => buildDiligenceModel(selectedProduct, day1BriefState.data),
    [day1BriefState.data, selectedProduct]
  );
  const selectedResearchView = selectedDiligenceModel.researchView;
  const selectedDiligenceReport = selectedDiligenceModel.report;
  const tutorialNetPreview = getTutorialNetPreview(selectedProduct);
  const tutorialNetGain = roundNumber(tutorialNetPreview.netValue - 1000, 2);

  const walletProfileSnapshot = address ? readWalletProfile(address) : {};
  const walletProfileProgress = walletProfileSnapshot.progress || {};
  const walletProfileWealthTaskClaims = normalizeWealthTaskClaims(walletProfileProgress.wealthTaskClaims);
  const effectiveWealthTaskClaims = {
    subscribe: Boolean((!wealthVaultConfigured && walletProfileWealthTaskClaims.subscribe) || wealthSubscribeTaskClaimed),
    settlement: Boolean((!wealthVaultConfigured && walletProfileWealthTaskClaims.settlement) || wealthSettlementTaskClaimed)
  };
  const milestoneCount = [
    isConnected,
    Boolean(hasMintedBadgeOnchain),
    guideTaskDone,
    quizTaskDone,
    paperTaskDone,
    effectiveWealthTaskClaims.subscribe,
    effectiveWealthTaskClaims.settlement
  ].filter(Boolean).length;

  const milestoneBonus = milestoneCount * WEALTH_MILESTONE_BONUS;
  const availableCash = displayWealthState.cash + milestoneBonus;
  const walletProfileSummary = getWalletProfileSummary({
    ...walletProfileSnapshot,
    progress: {
      ...walletProfileProgress,
      guideCompleted: guideTaskDone,
      quizCompleted: quizTaskDone,
      paperTradesCompleted: Math.max(
        Number(walletProfileProgress.paperTradesCompleted || 0),
        Number(progressState.paperTradesCompleted || 0),
        paperTaskDone ? 1 : 0
      ),
      wealthTaskClaims: effectiveWealthTaskClaims
    },
    wealth: {
      state: displayWealthState
    },
    paper: {
      state: paperProfileState
    }
  });
  const remainingPaperTokens = walletProfileSummary.remainingPT;

  const portfolioRows = useMemo(
    () =>
      Object.entries(displayWealthState.positions)
        .map(([productId, position]) => {
          const product = productMap[productId];
          if (!product) return null;

          const currentValue = roundNumber(position.shares * product.nav, 2);
          const pnl = roundNumber(currentValue - position.principal, 2);

          return {
            ...product,
            shares: position.shares,
            principal: position.principal,
            entryTs: position.entryTs || '',
            entryNav: position.entryNav || product.nav,
            lastActivityTs: position.lastActivityTs || position.entryTs || '',
            currentValue,
            pnl
          };
        })
        .filter(Boolean)
        .sort((left, right) => {
          const leftTs = Date.parse(left.lastActivityTs || left.entryTs || '');
          const rightTs = Date.parse(right.lastActivityTs || right.entryTs || '');
          return (Number.isFinite(rightTs) ? rightTs : 0) - (Number.isFinite(leftTs) ? leftTs : 0);
        }),
    [productMap, displayWealthState.positions]
  );

  const totalInvested = portfolioRows.reduce((sum, row) => sum + row.principal, 0);
  const totalCurrentValue = portfolioRows.reduce((sum, row) => sum + row.currentValue, 0);
  const totalYield = roundNumber(totalCurrentValue - totalInvested, 2);
  const portfolioAnnualYieldRate =
    totalCurrentValue > 0
      ? portfolioRows.reduce((sum, row) => sum + row.currentValue * getAnnualYieldRate(row), 0) / totalCurrentValue
      : 0;
  const openEndedValue = roundNumber(
    portfolioRows
      .filter((row) => !isClosedEndProduct(row))
      .reduce((sum, row) => sum + row.currentValue, 0),
    2
  );
  const closedEndedValue = roundNumber(
    portfolioRows
      .filter((row) => isClosedEndProduct(row))
      .reduce((sum, row) => sum + row.currentValue, 0),
    2
  );
  const strategyValue = roundNumber(portfolioRows.filter((row) => row.bucket === 'strategy').reduce((sum, row) => sum + row.currentValue, 0), 2);

  const selectedPosition = displayWealthState.positions[selectedProduct.id] || { shares: 0, principal: 0 };
  const selectedTimelineNav = getForwardProjectedNav(selectedProduct, Number(settlementDays));
  const selectedPositionValue = roundNumber(selectedPosition.shares * selectedProduct.nav, 2);
  const selectedPositionPnl = roundNumber(selectedPositionValue - selectedPosition.principal, 2);
  const selectedPositionTimelineValue = roundNumber(selectedPosition.shares * selectedTimelineNav, 2);
  const selectedPositionTimelinePnl = roundNumber(selectedPositionTimelineValue - selectedPosition.principal, 2);
  const selectedCollateralState = displayWealthState.collateral?.[selectedProduct.id] || { pledgedShares: 0, borrowedAmount: 0 };
  const selectedPledgedShares = roundNumber(Math.min(selectedPosition.shares || 0, selectedCollateralState.pledgedShares || 0), 6);
  const selectedBorrowedAmount = roundNumber(selectedCollateralState.borrowedAmount || 0, 2);
  const selectedFreeShares = roundNumber(Math.max(0, (selectedPosition.shares || 0) - selectedPledgedShares), 6);
  const selectedFreeValue = roundNumber(selectedFreeShares * selectedProduct.nav, 2);
  const selectedPotentialCollateralValue = roundNumber((selectedPosition.shares || 0) * selectedProduct.nav, 2);
  const selectedCollateralValue = roundNumber(selectedPledgedShares * selectedProduct.nav, 2);
  const selectedCollateralAdvanceRate = getCollateralAdvanceRate(selectedProduct);
  const selectedPledgeTermMode = selectedCollateralState.termMode || pledgeTermMode;
  const selectedCollateralApy = getCollateralApy(selectedProduct, selectedPledgeTermMode);
  const selectedPledgeLockStatus = getPledgeLockStatus(selectedProduct, selectedCollateralState, pledgeTermMode, settlementDays);
  const selectedDifficulty = getProductDifficulty(selectedProduct);
  const selectedPotentialMaxBorrowValue = roundNumber(selectedPotentialCollateralValue * selectedCollateralAdvanceRate, 2);
  const selectedRemainingBorrowCapacity = roundNumber(Math.max(0, selectedPotentialMaxBorrowValue - selectedBorrowedAmount), 2);
  const selectedCollateralLtv = selectedCollateralValue > 0 ? selectedBorrowedAmount / selectedCollateralValue : 0;
  const selectedMinimumTicket = Math.max(WEALTH_MIN_SUBSCRIPTION, selectedProduct.minSubscription);
  const selectedSettlementPolicy = getSettlementPolicy(selectedProduct);
  const selectedRedeemAllowed = isRedeemableProduct(selectedProduct);
  const selectedLockStatus = getWealthLockStatus(selectedProduct, selectedPosition, settlementDays);
  const allocationAmountNumber = Number(allocationAmount);
  const subscriptionAmountTooLow =
    !Number.isFinite(allocationAmountNumber) || allocationAmountNumber < selectedMinimumTicket;
  const subscriptionAmountWarning = subscriptionAmountTooLow
    ? `Amount is below this product's min ticket. Enter at least ${selectedMinimumTicket.toLocaleString()} PT before review.`
    : '';
  const subscriptionAmountPresets = getAmountPresetRows({
    minimumTicket: selectedMinimumTicket,
    availableCash,
    currentAmount: allocationAmountNumber
  });

  useEffect(() => {
    setCollateralBorrowInput(selectedBorrowedAmount);
  }, [selectedBorrowedAmount, selectedProduct.id]);

  useEffect(() => {
    if (!selectedBorrowedAmount || !selectedCollateralState.termMode) return;
    setPledgeTermMode(selectedCollateralState.termMode);
  }, [selectedBorrowedAmount, selectedCollateralState.termMode, selectedProduct.id]);

  const estimatedShares = Number.isFinite(allocationAmountNumber)
    ? roundNumber(allocationAmountNumber / selectedProduct.nav, 6)
    : 0;
  const simulatedTicketAmount = Number.isFinite(allocationAmountNumber) && allocationAmountNumber > 0 ? allocationAmountNumber : selectedMinimumTicket;
  const selectedFastForwardOption = FAST_FORWARD_OPTIONS.find((option) => option.id === fastForwardTarget) || FAST_FORWARD_OPTIONS[2];
  const fastForwardProjectedNav = getForwardProjectedNav(selectedProduct, selectedFastForwardOption.days);
  const fastForwardPreviewShares = roundNumber(simulatedTicketAmount / selectedProduct.nav, 6);
  const fastForwardProjectedValue = roundNumber(fastForwardPreviewShares * fastForwardProjectedNav, 2);
  const fastForwardProjectedGain = roundNumber(fastForwardProjectedValue - simulatedTicketAmount, 2);
  const historicalReplayStartNav = selectedNavPoints[0]?.value || selectedProduct.nav;
  const historicalReplayEndNav = selectedNavPoints[selectedNavPoints.length - 1]?.value || selectedProduct.nav;
  const historicalReplayShares = historicalReplayStartNav > 0 ? roundNumber(simulatedTicketAmount / historicalReplayStartNav, 6) : 0;
  const historicalReplayValue = roundNumber(historicalReplayShares * historicalReplayEndNav, 2);
  const historicalReplayGain = roundNumber(historicalReplayValue - simulatedTicketAmount, 2);
  const settlementActionMeta = SETTLEMENT_ACTION_OPTIONS.find((option) => option.id === settlementAction) || SETTLEMENT_ACTION_OPTIONS[0];
  const settlementTransferProducts = liveProducts.filter((product) => product.id !== selectedProduct.id);
  const settlementTransferProduct =
    settlementTransferProducts.find((product) => product.id === settlementTransferProductId) ||
    settlementTransferProducts[0] ||
    selectedProduct;
  const settlementProjectedNav = selectedTimelineNav;
  const settlementPreviewShares = selectedFreeShares > 0 ? selectedFreeShares : roundNumber(simulatedTicketAmount / selectedProduct.nav, 6);
  const settlementPreviewValue = roundNumber(settlementPreviewShares * settlementProjectedNav, 2);
  const settlementBasisRatio = selectedPosition.shares > 0 ? Math.min(1, settlementPreviewShares / selectedPosition.shares) : 1;
  const settlementPrincipalBasis = selectedPosition.shares > 0
    ? roundNumber(selectedPosition.principal * settlementBasisRatio, 2)
    : simulatedTicketAmount;
  const settlementPreviewGain = roundNumber(settlementPreviewValue - settlementPrincipalBasis, 2);
  const settlementTargetShares =
    settlementAction === 'transfer' && settlementTransferProduct?.nav
      ? roundNumber(settlementPreviewValue / settlementTransferProduct.nav, 6)
      : 0;
  const settlementDaysNumber = Math.max(0, Number(settlementDays || 0));
  const settlementStartDateLabel = formatSettlementTimelineDate(0);
  const settlementTargetDateLabel = formatSettlementTimelineDate(settlementDaysNumber);
  const settlementWindowLabel =
    settlementDaysNumber <= 0
      ? 'Today'
      : `${settlementDaysNumber}D forward (${settlementStartDateLabel} - ${settlementTargetDateLabel})`;
  const settlementPredictionCopy =
    settlementDaysNumber <= 0
      ? `Current value uses predicted NAV ${settlementProjectedNav.toFixed(3)} at today's timeline point.`
      : `Future value uses predicted NAV ${settlementProjectedNav.toFixed(3)} from ${settlementStartDateLabel} to ${settlementTargetDateLabel}.`;
  const suggestedSettlementDays = clamp(
    Math.max(30, selectedLockStatus.daysLeft > 0 ? selectedLockStatus.daysLeft : getWealthLockDays(selectedProduct) || 90),
    0,
    730
  );
  const dualCurrencyPair = DUAL_CURRENCY_PAIR_OPTIONS.find((pair) => pair.id === dualCurrencyPairId) || DUAL_CURRENCY_PAIR_OPTIONS[0];
  const dualCurrencyDirectionMeta =
    DUAL_CURRENCY_DIRECTION_OPTIONS.find((option) => option.id === dualCurrencyDirection) || DUAL_CURRENCY_DIRECTION_OPTIONS[0];
  const selectedDualProductPair = getDualPairForProduct(selectedProduct, dualCurrencyPair);
  const selectedDualTargetPct = getDirectionalDualTargetPct(dualCurrencyDirection, dualCurrencyTargetPct);
  const selectedDualWindowMoveLimit = getDualWindowMoveLimit(selectedProductNavPeriod);
  const selectedDualWindowPriceMovePct = clamp(
    Number(dualWindowPriceMovePct || 0),
    -selectedDualWindowMoveLimit,
    selectedDualWindowMoveLimit
  );
  const selectedDualWindowNavMovePct = clamp(
    selectedNavDeltaPercent,
    -selectedDualWindowMoveLimit,
    selectedDualWindowMoveLimit
  );
  const selectedDualWindowPreview = isDualInvestmentProduct(selectedProduct)
    ? getDualWindowReturnPreview({
        product: selectedProduct,
        pair: selectedDualProductPair,
        direction: dualCurrencyDirection,
        targetPct: selectedDualTargetPct,
        priceMovePct: selectedDualWindowPriceMovePct,
        navPoints: selectedNavPoints,
        periodId: selectedProductNavPeriod
      })
    : null;
  const selectedDualWindowSuggestedMarkerPct = selectedDualWindowMoveLimit
    ? ((selectedDualWindowNavMovePct + selectedDualWindowMoveLimit) / (selectedDualWindowMoveLimit * 2)) * 100
    : 50;
  const dualCurrencyApr = Math.max(
    0.01,
    (Math.abs(Number(dualCurrencyTargetPct || 0)) * 0.11 + 0.18) * Math.max(0.25, Math.min(1.4, 30 / Math.max(1, Number(settlementDays || 1))))
  );
  const selectedDualCurrencyFit = getDualCurrencyFit(selectedProduct);
  const dualCurrencyExamplePrincipal = 1000;
  const paperProfileText = JSON.stringify(paperProfileState || {}).toLowerCase();
  const paperFlashSignal = /flash.*[1-9]/.test(paperProfileText) || paperProfileText.includes('attested flash');
  const walletProfileScore =
    (isConnected ? 1 : 0) +
    (guideTaskDone ? 1 : 0) +
    (quizTaskDone ? 1 : 0) +
    (paperTaskDone ? 2 : 0) +
    (paperFlashSignal ? 2 : 0) +
    (Object.keys(displayWealthState.collateral || {}).length > 0 ? 2 : 0) +
    (wealthActivityTypes.has('settlement') ? 1 : 0);
  const walletProfileLevel = walletProfileScore >= 6 ? 'advanced' : walletProfileScore >= 3 ? 'intermediate' : 'starter';
  const walletProfileLabel =
    walletProfileLevel === 'advanced'
      ? 'Advanced wallet'
      : walletProfileLevel === 'intermediate'
        ? 'Builder wallet'
        : isConnected
          ? 'Starter wallet'
          : 'Web3 starter profile';
  const aiRecommendationLane = useMemo(() => {
    const availableLanes = AI_RECOMMENDATION_LANES.filter((lane) =>
      liveProducts.some((product) => productMatchesAiRecommendationLane(product, lane.id))
    );
    const lanes = availableLanes.length ? availableLanes : AI_RECOMMENDATION_LANES;
    const laneIndex = Math.floor(
      getStableRandomValue(
        `${recommendationShuffleSeed}-${currentWalletAddressKey || 'guest'}-${walletProfileLevel}`,
        'ai-recommendation-lane'
      ) * lanes.length
    );

    return lanes[Math.min(laneIndex, lanes.length - 1)] || AI_RECOMMENDATION_LANES[0];
  }, [currentWalletAddressKey, liveProducts, recommendationShuffleSeed, walletProfileLevel]);
  const aiRecommendationTopRows = useMemo(() => {
    const activityCount = displayWealthState.activityLog?.length || 0;
    const ownedCount = Object.keys(displayWealthState.positions || {}).length;
    const collateralCount = Object.keys(displayWealthState.collateral || {}).length;
    const firstRunStarter = walletProfileLevel === 'starter' && activityCount === 0 && ownedCount === 0 && collateralCount === 0;
    const currentGoalRecommendedIds = new Set(currentGoal.recommended || []);
    const laneProducts = liveProducts.filter((product) =>
      productMatchesAiRecommendationLane(product, aiRecommendationLane.id)
    );
    const candidateProducts = laneProducts.length ? laneProducts : liveProducts;

    return candidateProducts
      .map((product) => {
        const model = buildDiligenceModel(product, day1BriefState.data);
        const report = model.report;
        const surface = getWealthProductSurface(product);
        const difficulty = getProductDifficulty(product);
        const annualYieldRate = Math.max(0, Math.min(0.2, getAnnualYieldRate(product)));
        const settlementPolicy = getSettlementPolicy(product);
        const isOwned = Boolean(displayWealthState.positions?.[product.id]?.shares);
        const isCurrentGoalPick = currentGoalRecommendedIds.has(product.id);
        const isDual = isDualInvestmentProduct(product);
        const isStructured = surface === 'structured' || isDual;
        const dualPenalty =
          isDual || isStructured
            ? walletProfileLevel === 'advanced'
              ? -4
              : walletProfileLevel === 'intermediate'
                ? -16
                : -22
            : 0;
        const beginnerFit =
          walletProfileLevel === 'starter'
            ? (surface === 'cash' ? 22 : 0) +
              (difficulty.id === 'easy' ? 12 : difficulty.id === 'medium' ? 4 : -12) +
              (isDual || isStructured ? dualPenalty : 0)
            : 0;
        const starterDefaultFit = firstRunStarter && product.id === DEFAULT_WEALTH_PRODUCT_ID ? 36 : 0;
        const builderFit =
          walletProfileLevel === 'intermediate'
            ? (surface === 'cash' || surface === 'earn' ? 10 : 0) + (settlementPolicy.redeemable ? 4 : 0) + dualPenalty
            : 0;
        const advancedFit =
          walletProfileLevel === 'advanced'
            ? (surface === 'auto' ? 11 : 0) + (isStructured ? 9 : 0) + (surface === 'private' ? 5 : 0) + (product.bucket === 'strategy' ? 7 : 0)
            : 0;
        const activityFit =
          (paperTaskDone ? 3 : 0) +
          (paperFlashSignal ? (isStructured || surface === 'auto' ? 6 : 1) : 0) +
          (collateralCount ? (isCollateralPilotProduct(product) ? 7 : 2) : 0) +
          (wealthActivityTypes.has('settlement') || wealthActivityTypes.has('redeem') ? (settlementPolicy.redeemable ? 4 : 2) : 0) +
          (activityCount ? 2 : 0) +
          (ownedCount && !isOwned ? 2 : 0);
        const evidenceFit =
          (report?.productQuality?.score || model.finalScore || 0) * 0.42 +
          (report?.evidenceConfidence?.score || 0) * 0.18 +
          (report?.suitability?.tone === 'risk-low' ? 8 : report?.suitability?.tone === 'risk-medium' ? 4 : -6);
        const score =
          evidenceFit +
          beginnerFit +
          builderFit +
          advancedFit +
          activityFit +
          starterDefaultFit +
          annualYieldRate * 100 +
          (isCurrentGoalPick ? 6 : 0) +
          (isOwned ? -4 : 0);

        return {
          product,
          score,
          reason: getAiRecommendationBenefitReason(product, walletProfileLevel)
        };
      })
      .sort((left, right) => right.score - left.score || left.product.name.localeCompare(right.product.name))
      .slice(0, 3);
  }, [
    aiRecommendationLane.id,
    currentGoal.recommended,
    day1BriefState.data,
    displayWealthState.activityLog,
    displayWealthState.collateral,
    displayWealthState.positions,
    liveProducts,
    paperFlashSignal,
    paperTaskDone,
    walletProfileLevel,
    wealthActivityTypes
  ]);
  const aiRecommendedRow =
    aiRecommendationTopRows.length > 0
      ? aiRecommendationTopRows[
          Math.min(
            aiRecommendationTopRows.length - 1,
            Math.floor(
              getStableRandomValue(
                `${recommendationShuffleSeed}-${currentWalletAddressKey || 'guest'}-${walletProfileLevel}-${aiRecommendationLane.id}`,
                'ai-recommendation-pick'
              ) * aiRecommendationTopRows.length
            )
          )
        ]
      : null;
  const defaultStarterProduct = getProductByIdFrom(liveProducts, DEFAULT_WEALTH_PRODUCT_ID) || liveProducts[0] || WEALTH_PRODUCTS[0];
  const aiRecommendedProduct = aiRecommendedRow?.product || defaultStarterProduct;
  const aiRecommendationReason =
    aiRecommendedRow?.reason ||
    (walletProfileLevel === 'advanced'
      ? 'higher return potential can fit here, but the detail view keeps volatility, liquidity, and settlement risk visible'
      : walletProfileLevel === 'intermediate'
        ? 'the return source is stronger than basic cash parking while NAV movement and redemption controls stay easy to compare'
        : 'a simpler receipt keeps yield, risk, and exit timing easier to understand before taking higher-risk growth exposure');
  const aiRecommendedSurface = getWealthProductSurface(aiRecommendedProduct);
  const aiRecommendedPolicy = getSettlementPolicy(aiRecommendedProduct);
  const aiRecommendationScript = [
    `I would push ${aiRecommendedProduct.name} to this ${walletProfileLabel.toLowerCase()} because ${aiRecommendationReason}.`,
    walletProfileLevel === 'advanced'
      ? `This wallet has enough paper, pledge, or settlement history to inspect a ${aiRecommendedSurface} product, while the buy / settle / pledge row keeps the next action explicit.`
      : walletProfileLevel === 'intermediate'
        ? `Keep the recommendation as a guided next step: show ${aiRecommendedPolicy.label.toLowerCase()} terms, NAV movement, and the receipt lifecycle before subscribe.`
        : `Keep the first push simple: explain what the receipt owns, why it earns, and how the user can exit before asking for a subscription signature.`,
    `Next click should open ${aiRecommendedProduct.shortName || aiRecommendedProduct.name} detail, then use the same row for buy, settlement, and pledge decisions.`
  ];
  const walletProfileButtonRows = [
    {
      id: 'profile',
      label: 'Profile',
      value: walletProfileLabel,
      title: 'Wallet profile',
      copy: walletLearningProfileCopy({
        walletProfileLevel,
        isConnected,
        guideTaskDone,
        quizTaskDone,
        paperTaskDone,
        paperFlashSignal
      }),
      metrics: [
        { label: 'Connection', value: isConnected ? 'Connected' : 'Not connected' },
        { label: 'Learning', value: `${[guideTaskDone, quizTaskDone, paperTaskDone].filter(Boolean).length}/3 signals` },
        { label: 'Flash / hedge signal', value: paperFlashSignal ? 'Seen' : 'Not seen' }
      ]
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      value: `${portfolioRows.length} positions`,
      title: 'Wallet assets',
      copy: 'This is the current wallet-linked wealth state that recommendations should read before picking another product.',
      metrics: [
        { label: 'Spendable PT', value: formatValue(availableCash, hideBalances) },
        { label: 'Current value', value: formatValue(totalCurrentValue, hideBalances) },
        { label: 'Open positions', value: `${portfolioRows.length}` },
        { label: 'Pledged lines', value: `${Object.keys(displayWealthState.collateral || {}).length}` }
      ]
    },
    {
      id: 'activity',
      label: 'Activity',
      value: `${displayWealthState.activityLog?.length || 0} events`,
      title: 'Wallet behavior',
      copy: 'Activity pushes the user toward detail pages they have not practiced yet, instead of repeating the same buy card.',
      metrics: [
        { label: 'Receipt recorded', value: portfolioRows.length ? 'Yes' : 'No' },
        { label: 'Settlement practiced', value: wealthActivityTypes.has('settlement') || wealthActivityTypes.has('redeem') ? 'Yes' : 'No' },
        { label: 'Pledge practiced', value: Object.keys(displayWealthState.collateral || {}).length ? 'Yes' : 'No' }
      ]
    },
    {
      id: 'ai',
      label: 'AI pick',
      value: aiRecommendedProduct.shortName || aiRecommendedProduct.name,
      title: 'AI recommendation',
      copy: 'The recommendation is ranked from wallet profile, holdings, activity, goal fit, evidence confidence, product quality, suitability, and current market context.',
      metrics: [
        { label: 'Product', value: aiRecommendedProduct.name },
        { label: 'Fit score', value: `${Math.round(aiRecommendedRow?.score || 0)}` },
        { label: 'Exit terms', value: aiRecommendedPolicy.label },
        { label: 'Detail route', value: getCategoryIdForProduct(aiRecommendedProduct) }
      ],
      script: aiRecommendationScript
    }
  ];
  const activeWalletProfileDetail =
    walletProfileButtonRows.find((row) => row.id === activeWalletProfilePanel) || walletProfileButtonRows[0];
  function renderWalletProfileRouter() {
    return (
      <div className="wealth-wallet-profile-router developer-wallet-profile-router">
        <div className="wealth-wallet-profile-head">
          <div>
            <div className="eyebrow">Wallet profile</div>
            <h3>{walletProfileLabel}</h3>
          </div>
          <span className={`pill ${walletProfileLevel === 'advanced' ? 'risk-low' : walletProfileLevel === 'intermediate' ? 'risk-medium' : 'risk-high'}`}>
            {isConnected ? 'Wallet-linked' : 'Connect wallet'}
          </span>
        </div>
        <div className="wealth-wallet-profile-button-row" aria-label="Wallet profile detail buttons">
          {walletProfileButtonRows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`wealth-wallet-profile-button ${activeWalletProfilePanel === row.id ? 'active' : ''}`}
              onClick={() => setActiveWalletProfilePanel(row.id)}
            >
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </button>
          ))}
        </div>
        <div className="wealth-wallet-profile-detail">
          <div className="wealth-wallet-profile-detail-head">
            <div>
              <div className="eyebrow">{activeWalletProfileDetail.label}</div>
              <h3>{activeWalletProfileDetail.title}</h3>
            </div>
            {activeWalletProfileDetail.id === 'ai' ? <span className="pill risk-low">Profile-ranked</span> : null}
          </div>
          <p className="muted">{activeWalletProfileDetail.copy}</p>
          <div className="wealth-wallet-profile-metric-grid">
            {activeWalletProfileDetail.metrics.map((metric) => (
              <div className="wealth-wallet-profile-metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
          {activeWalletProfileDetail.script?.length ? (
            <div className="wealth-ai-script">
              {activeWalletProfileDetail.script.map((line) => (
                <div className="wealth-ai-script-line" key={line}>
                  {line}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  const collectibleHelperCopy =
    'Beginner note: when a homepage collectible is minted, look for it in the connected wallet collectibles / NFT view. Wealth keeps reading the same wallet-linked progress.';
  const firstOwnedProductId = Object.keys(displayWealthState.positions || {})[0] || '';
  const subscribeTaskProductId = latestSubscribeActivity?.productId || firstOwnedProductId || aiRecommendedProduct.id;
  const subscribeTaskProduct = getProductByIdFrom(liveProducts, subscribeTaskProductId) || aiRecommendedProduct;
  const settlementTaskProductId =
    latestSettlementActivity?.productId || firstOwnedProductId || latestSubscribeActivity?.productId || subscribeTaskProduct.id;
  const settlementTaskProduct = getProductByIdFrom(liveProducts, settlementTaskProductId) || subscribeTaskProduct;
  const subscribeTaskReceiptMinted =
    Boolean(displayWealthState.positions?.[subscribeTaskProduct.id]?.shares) || Boolean(latestSubscribeActivity);
  const settlementTaskReceiptAvailable =
    Boolean(displayWealthState.positions?.[settlementTaskProduct.id]?.shares) ||
    Boolean(latestSettlementActivity) ||
    wealthSubscribeTaskDone;
  const subscribeTaskReadyToClaim = Boolean(isConnected && wealthSubscribeDetailActionDone && subscribeTaskReceiptMinted);
  const settlementTaskReadyToClaim = Boolean(isConnected && settlementTaskReceiptAvailable && wealthSettlementDetailActionDone);
  const wealthTaskReadyToClaimById = {
    subscribe: subscribeTaskReadyToClaim,
    settlement: settlementTaskReadyToClaim
  };
  const wealthTaskDetailMap = {
    subscribe: {
      eyebrow: 'Task detail',
      title: 'Mint the first wealth receipt',
      copy: `This path starts from ${subscribeTaskProduct.name}. Open that product detail, then use the buy action inside the lifecycle desk so the receipt is detected from activity, not from a navigation click.`,
      checklistItems: [
        {
          id: 'wallet',
          title: 'Wallet connected',
          done: isConnected,
          copy: isConnected
            ? `This receipt will stay attached to ${walletDisplayName}.`
            : 'Connect the same wallet you use on Home and Paper before buying.'
        },
        {
          id: 'detail',
          title: 'Buy from product detail',
          done: wealthSubscribeDetailActionDone,
          copy: wealthSubscribeDetailActionDone
            ? `Detected a signed buy action for ${subscribeTaskProduct.name}.`
            : expandedProductId === subscribeTaskProduct.id && selectedDetailTopics.includes('flow')
              ? 'This is the right detail desk. Confirm the signed subscription here to complete the step.'
              : `Open ${subscribeTaskProduct.name} detail first; the step completes only after the buy action is signed.`,
          interactive: true,
          onClick: () =>
            focusProduct(subscribeTaskProduct.id, {
              topic: 'flow',
              categoryId: getCategoryIdForProduct(subscribeTaskProduct)
            })
        },
        {
          id: 'receipt',
          title: 'Receipt recorded',
          done: subscribeTaskReceiptMinted,
          copy: subscribeTaskReceiptMinted
            ? `A wallet-linked ${subscribeTaskProduct.shareToken} receipt is recorded in the Wealth ledger.`
            : 'Confirm a signed subscription in that product detail so Wealth can detect the receipt automatically.'
        }
      ],
      ctaLabel: 'Open product detail',
      ctaProductId: subscribeTaskProduct.id,
      ctaCategoryId: getCategoryIdForProduct(subscribeTaskProduct),
      claimTitle: 'Claim wealth receipt collectible',
      claimCopy: `Claim only after this reads 3/3 completed. The collectible claim then runs the onchain markWealthTask step when the Wealth vault is configured.`
    },
    settlement: {
      eyebrow: 'Task detail',
      title: 'Practice settle, roll, or pledge',
      copy: `After a receipt exists, use ${settlementTaskProduct.name}'s detail desk for an actual settlement, redeem, pledge, or release action. Opening the panel alone no longer clears the task.`,
      checklistItems: [
        {
          id: 'owned-receipt',
          title: 'Owned receipt found',
          done: settlementTaskReceiptAvailable,
          copy: settlementTaskReceiptAvailable
            ? `The wallet has a receipt history for ${settlementTaskProduct.name}.`
            : 'Buy one receipt first; settlement and pledge need something to act on.'
        },
        {
          id: 'lifecycle-detail',
          title: 'Use lifecycle action',
          done: wealthSettlementDetailActionDone,
          copy: wealthSettlementDetailActionDone
            ? `Detected a settle, redeem, pledge, or release action for ${settlementTaskProduct.name}.`
            : expandedProductId === settlementTaskProduct.id && selectedDetailTopics.includes('flow')
              ? 'This is the right detail desk. Use Settle, Roll, Transfer, Pledge, or Release here to complete the step.'
              : 'Open the receipt product detail, then complete one lifecycle action inside that desk.',
          interactive: true,
          onClick: () => {
            focusProduct(settlementTaskProduct.id, {
              topic: 'flow',
              categoryId: getCategoryIdForProduct(settlementTaskProduct)
            });
          }
        },
        {
          id: 'settlement-action',
          title: 'Settle or pledge practiced',
          done: wealthSettlementDetailActionDone,
          copy: wealthSettlementDetailActionDone
            ? 'Wealth detected a settlement, redeem, pledge, or release action in the wallet activity.'
            : 'Use Settle / Roll / Transfer / Pledge in the detail desk; the row turns OK from activity, not manual marking.'
        }
      ],
      ctaLabel: 'Open lifecycle desk',
      ctaProductId: settlementTaskProduct.id,
      ctaCategoryId: getCategoryIdForProduct(settlementTaskProduct),
      claimTitle: 'Claim lifecycle collectible',
      claimCopy: `Claim only after the lifecycle checklist reaches 3/3. The reward adds +${WEALTH_MILESTONE_BONUS.toLocaleString()} PT after the local or Sepolia claim is recorded.`
    }
  };
  const selectedWealthTaskDetail = wealthTaskDetailMap[selectedWealthTask.id] || wealthTaskDetailMap.subscribe;
  const selectedWealthTaskChecklistItems = selectedWealthTaskDetail.checklistItems.map((item) => {
    const statusTone = item.done ? 'done' : item.interactive ? 'ready' : 'todo';
    return {
      ...item,
      statusTone,
      indicator: item.done ? 'OK' : item.interactive ? 'GO' : 'TODO',
      statusText: item.done ? 'Done' : item.interactive ? 'Action needed' : 'To do'
    };
  });
  const selectedWealthTaskCompletedChecklistCount = selectedWealthTaskChecklistItems.filter((item) => item.done).length;
  const selectedWealthTaskChecklistTotal = selectedWealthTaskChecklistItems.length;
  const selectedWealthTaskReadyToClaim = Boolean(wealthTaskReadyToClaimById[selectedWealthTask.id]);
  const selectedWealthTaskClaimed =
    selectedWealthTask.id === 'settlement' ? wealthSettlementTaskClaimed : wealthSubscribeTaskClaimed;
  const selectedWealthTaskFlagOnchain =
    selectedWealthTask.id === 'settlement' ? Boolean(wealthSettlementTaskOnchain) : Boolean(wealthSubscribeTaskOnchain);
  const selectedWealthTaskCollectibleOwned =
    selectedWealthTask.id === 'settlement'
      ? wealthSettlementTaskCollectibleOwned
      : wealthSubscribeTaskCollectibleOwned;
  const selectedWealthTaskTokenId =
    selectedWealthTask.id === 'settlement' ? WEALTH_TASK_TOKEN_IDS.settlement : WEALTH_TASK_TOKEN_IDS.subscribe;
  const selectedWealthTaskClaimedOnchain =
    selectedWealthTask.id === 'settlement' ? wealthSettlementTaskClaimedOnchain : wealthSubscribeTaskClaimedOnchain;
  const selectedWealthTaskClaiming =
    wealthClaimTaskId === selectedWealthTask.id &&
    (isWealthTaskClaimSubmitting ||
      isWealthTaskClaimConfirming ||
      isSwitchingChain ||
      (Boolean(wealthTaskClaimHash) && wealthTaskClaimConfirmed && !selectedWealthTaskClaimedOnchain));
  const selectedWealthTaskClaimStatus = selectedWealthTaskClaimed
    ? {
        tone: 'done',
        text: 'Claimed',
        copy: selectedWealthTaskClaimedOnchain
          ? `Sepolia collectible token #${selectedWealthTaskTokenId} is confirmed in this wallet. +${WEALTH_MILESTONE_BONUS.toLocaleString()} PT is included in shared wallet buying power.`
          : `Local collectible claimed. +${WEALTH_MILESTONE_BONUS.toLocaleString()} PT is included in shared wallet buying power.`,
        actionLabel: 'Already claimed',
        actionDisabled: true
      }
    : selectedWealthTaskReadyToClaim
      ? {
          tone: 'ready',
          text: '3/3 ready',
          copy: wealthVaultConfigured
            ? `3/3 detail actions are detected. Claim submits markWealthTask on Sepolia, then Wealth waits until token #${selectedWealthTaskTokenId} appears in the wallet collectible balance.`
            : '3/3 detail actions are detected. This build can record the local reward; configure the Wealth vault address to require a Sepolia claim.',
          actionLabel: wealthVaultConfigured ? 'Claim Sepolia collectible + PT' : 'Get local collectible + PT',
          actionDisabled: selectedWealthTaskClaiming
        }
      : {
          tone: 'todo',
          text: 'To do',
          copy: 'Complete all 3 detected steps first. Wealth watches receipt, settlement, and pledge activity automatically.',
          actionLabel: 'Complete task first',
          actionDisabled: true
        };
  const selectedWealthTaskClaimSteps = [];
  const timelinePreviewRows = useMemo(() => {
    const rows = portfolioRows.length
      ? portfolioRows.map((row) => ({ ...row, previewOnly: false }))
      : [
          {
            ...selectedProduct,
            shares: roundNumber(simulatedTicketAmount / selectedProduct.nav, 6),
            principal: simulatedTicketAmount,
            currentValue: simulatedTicketAmount,
            previewOnly: true
          }
        ];

    return rows.map((row) => {
      const projectedNav = getForwardProjectedNav(row, Number(settlementDays));
      const projectedValue = roundNumber((row.shares || 0) * projectedNav, 2);
      const projectedGain = roundNumber(projectedValue - Number(row.principal || 0), 2);
      const pledgedShares = Number(displayWealthState.collateral?.[row.id]?.pledgedShares || 0);
      const lockStatus = getWealthLockStatus(row, row, settlementDays);
      const earlyHaircutValue = roundNumber(projectedValue * lockStatus.earlyHaircutRate, 2);

      return {
        ...row,
        projectedNav,
        projectedValue,
        projectedGain,
        pledgedShares,
        freeShares: roundNumber(Math.max(0, (row.shares || 0) - pledgedShares), 6),
        lockStatus,
        earlyHaircutValue,
        settlementLabel: isClosedEndProduct(row) ? 'Maturity / roll' : 'Redeem / roll'
      };
    });
  }, [portfolioRows, selectedProduct, settlementDays, simulatedTicketAmount, displayWealthState.collateral]);

  useEffect(() => {
    if (!settlementTransferProducts.length) return;
    if (settlementTransferProducts.some((product) => product.id === settlementTransferProductId)) return;
    setSettlementTransferProductId(settlementTransferProducts[0].id);
  }, [settlementTransferProductId, settlementTransferProducts]);
  const unlockProgress = {
    guideCompleted: guideTaskDone,
    quizCompleted: quizTaskDone,
    paperTradesCompleted: paperTaskDone ? 1 : 0
  };
  const selectedUnlockCopy = getUnlockCopy(selectedProduct, unlockProgress);
  const selectedProductLocked = Boolean(selectedUnlockCopy);
  const subscriptionValidationMessage = getSubscriptionError({
    isConnected,
    address,
    isLocked: selectedProductLocked,
    unlockCopy: selectedUnlockCopy,
    requestedAmount: Number(allocationAmount),
    minimumTicket: selectedMinimumTicket,
    availableCash
  });
  const accessChecklist = getAccessChecklist(selectedProduct, {
    isConnected,
    guideTaskDone,
    quizTaskDone,
    paperTaskDone
  });
  const lifecycleNotes = getLifecycleNotes(selectedProduct);
  const selectedMarketSource = selectedProduct?.marketSource || 'RiskLens demo snapshot';
  const selectedAsOfLabel = selectedProduct?.asOfLabel || 'Static demo snapshot';
  const wealthVaultSnapshot = useMemo(() => {
    const attestedAtSeconds = Number(vaultLastAttestedAt || 0n);
    const attestationAgeMs = attestedAtSeconds > 0 ? Date.now() - attestedAtSeconds * 1000 : Number.POSITIVE_INFINITY;
    const attestationFresh = Number.isFinite(attestationAgeMs) && attestationAgeMs <= 3 * DAY_MS;
    const navRatio = Number(vaultNavBps || 0n) / 10000;
    const minimumOnchainTicket = fromVaultUnitAmount(vaultMinSubscription || 0n);
    const connectedWallet = Boolean(address);
    const riskTierValue = Number(vaultRiskTier || 0);
    const eligibleInvestor = Boolean(vaultEligibleInvestor);
    const advancedShelfAccess = Boolean(vaultAdvancedShelfAccess);
    const subscriptionsPaused = Boolean(vaultSubscriptionsPaused);
    const strategyStatus = vaultStrategyStatus || (subscriptionsPaused ? 'Paused' : 'Bootstrapping');

    return {
      configured: wealthVaultConfigured,
      address: wealthVaultConfigured ? WEALTH_VAULT_ADDRESS : '',
      strategyStatus,
      subscriptionsPaused,
      navRatio,
      navLabel: navRatio > 0 ? `${navRatio.toFixed(4)}x NAV` : 'Awaiting NAV update',
      minimumOnchainTicket,
      minSubscriptionLabel: minimumOnchainTicket > 0 ? `${minimumOnchainTicket.toLocaleString()} PT min` : 'Awaiting min ticket',
      lastAttestedAt: attestedAtSeconds,
      lastAttestedLabel: formatOnchainTimestamp(attestedAtSeconds),
      latestAttestationRoot: vaultLatestAttestationRoot || '',
      attestationRootLabel: shortHash(vaultLatestAttestationRoot),
      attestationFresh,
      attestationTone: attestationFresh ? 'risk-low' : 'risk-medium',
      attestationStatus: attestationFresh ? 'Fresh attestation' : 'Refresh attestation',
      eligibleInvestor,
      riskTier: riskTierValue,
      advancedShelfAccess,
      walletStatus: !connectedWallet
        ? 'Connect wallet'
        : eligibleInvestor
        ? `Eligible / tier ${riskTierValue}`
        : 'Not allowlisted yet',
      walletDetail: !connectedWallet
        ? 'Connect the onboarding wallet to compare local unlock state with the onchain vault gate.'
        : eligibleInvestor
        ? advancedShelfAccess
          ? 'The connected wallet is allowlisted and already clears the advanced-shelf requirement.'
          : 'The wallet is allowlisted, but the onchain risk tier is still below the advanced-shelf threshold.'
        : 'The connected wallet has not been allowlisted in the demo vault yet, so subscribe should stay in review-first mode.'
    };
  }, [
    address,
    vaultAdvancedShelfAccess,
    vaultEligibleInvestor,
    vaultLastAttestedAt,
    vaultLatestAttestationRoot,
    vaultMinSubscription,
    vaultNavBps,
    vaultRiskTier,
    vaultStrategyStatus,
    vaultSubscriptionsPaused
  ]);
  const firstInvestSteps = getFirstInvestWalkthrough(selectedProduct, {
    isConnected,
    address,
    isLocked: selectedProductLocked,
    unlockCopy: selectedUnlockCopy,
    requestedAmount: Number(allocationAmount),
    minimumTicket: selectedMinimumTicket,
    estimatedShares,
    validationMessage: subscriptionValidationMessage,
    existingShares: selectedPosition.shares,
    vaultSnapshot: wealthVaultSnapshot
  });
  const preInvestChecks = getPreInvestChecks(selectedProduct, {
    minimumTicket: selectedMinimumTicket,
    requestedAmount: Number(allocationAmount),
    unlockCopy: selectedUnlockCopy,
    isLocked: selectedProductLocked,
    marketSource: selectedMarketSource,
    asOfLabel: selectedAsOfLabel,
    snapshotTone: liveSnapshotState === 'ready' || liveSnapshotState === 'cached' ? 'pass' : 'review',
    researchView: selectedResearchView,
    vaultSnapshot: wealthVaultSnapshot
  });
  const onchainMechanics = getOnchainMechanics(selectedProduct, {
    minimumTicket: selectedMinimumTicket,
    requestedAmount: Number(allocationAmount),
    estimatedShares,
    vaultSnapshot: wealthVaultSnapshot
  });
  const flowPreviewCards = getFlowPreviewCards(selectedProduct, {
    requestedAmount: Number(allocationAmount),
    minimumTicket: selectedMinimumTicket,
    estimatedShares,
    availableCash,
    existingShares: selectedPosition.shares,
    positionValue: selectedPositionValue,
    validationMessage: subscriptionValidationMessage,
    isConnected,
    isLocked: selectedProductLocked,
    hidden: hideBalances
  });
  const modeledCallCards = getModeledCallCards(selectedProduct, {
    requestedAmount: Number(allocationAmount),
    minimumTicket: selectedMinimumTicket,
    estimatedShares,
    positionValue: selectedPositionValue,
    existingShares: selectedPosition.shares,
    validationMessage: subscriptionValidationMessage,
    isConnected,
    isLocked: selectedProductLocked,
    hidden: hideBalances,
    shortAddress: shortAddress(address)
  });
  const day1Timestamp = day1BriefState.data?.timestamp
    ? formatWealthDateTime(day1BriefState.data.timestamp)
    : 'Snapshot unavailable';
  const shelfStatusCopy =
    liveSnapshotState === 'ready'
      ? 'Today-linked proxy snapshot'
      : liveSnapshotState === 'cached'
      ? 'Cached proxy snapshot refreshing in background'
      : liveSnapshotState === 'fallback'
      ? 'Static fallback snapshot'
      : 'Loading live snapshot';
  const leaderboardRows = useMemo(
    () =>
      shelfProducts
        .map((product) => {
          const metrics = shelfMetricsMap.get(product.id);
          if (!metrics) return null;
          return {
            id: product.id,
            name: product.shortName || product.name,
            score: metrics.score,
            baseScore: metrics.baseScore,
            signalAdjustment: metrics.signalAdjustment,
            annualYieldRate: metrics.annualYieldRate,
            annualYieldBasis: metrics.annualYieldBasis,
            returnMetric: metrics.returnMetric,
            returnValue: metrics.returnValue,
            returnBasis: metrics.returnBasis,
            returnSubtext: metrics.returnSubtext,
            returnTone: metrics.returnTone,
            returnSortRate: metrics.returnSortRate,
            nav: metrics.nav,
            risk: metrics.risk
          };
        })
        .filter(Boolean)
        .sort((left, right) => right.returnSortRate - left.returnSortRate || right.score - left.score)
        .slice(0, LEADERBOARD_LIMIT),
    [shelfMetricsMap, shelfProducts]
  );

  useEffect(() => {
    if (!pendingScrollProductId) return;
    const shouldScrollToDetail = pendingScrollMode === 'detail';
    let attempts = 0;
    let frameId = 0;

    const scrollWhenReady = () => {
      if (scrollProductNodeIntoView(pendingScrollProductId, pendingScrollMode)) {
        setPendingScrollProductId(null);
        return;
      }

      const targetNode = shouldScrollToDetail
        ? productDetailRefs.current.get(pendingScrollProductId)
        : productCardRefs.current.get(pendingScrollProductId);

      if (!targetNode) {
        attempts += 1;
        if (attempts < 12) {
          frameId = window.requestAnimationFrame(scrollWhenReady);
        }
        return;
      }

      targetNode.scrollIntoView({ behavior: 'smooth', block: shouldScrollToDetail ? 'start' : 'nearest', inline: 'nearest' });
      setPendingScrollProductId(null);
    };

    frameId = window.requestAnimationFrame(scrollWhenReady);
    return () => window.cancelAnimationFrame(frameId);
  }, [expandedProductId, pendingScrollMode, pendingScrollProductId, shelfProducts]);

  useEffect(() => {
    if (!wealthTaskClaimError) return;
    const message = String(wealthTaskClaimError?.shortMessage || wealthTaskClaimError?.message || wealthTaskClaimError);
    setWealthClaimTaskId('');
    setWealthTaskClaimHash(undefined);
    setWealthClaimRecipientKey('');
    setFeedback(message.toLowerCase().includes('rejected') ? 'Wealth collectible claim was cancelled in MetaMask.' : message);
  }, [wealthTaskClaimError]);

  useEffect(() => {
    if (!wealthTaskClaimConfirmed || !wealthClaimTaskId || !address || !wealthVaultConfigured) return;
    const currentAddressKey = String(address).toLowerCase();
    if (wealthClaimRecipientKey && wealthClaimRecipientKey !== currentAddressKey) {
      setFeedback('Sepolia claim confirmed for a different wallet. Reconnect that wallet before recording the reward.');
      setWealthClaimTaskId('');
      setWealthTaskClaimHash(undefined);
      setWealthClaimRecipientKey('');
      return;
    }

    const onchainCollectibleConfirmed =
      wealthClaimTaskId === 'settlement' ? wealthSettlementTaskClaimedOnchain : wealthSubscribeTaskClaimedOnchain;
    if (onchainCollectibleConfirmed) {
      recordWealthTaskClaim(wealthClaimTaskId, 'onchain');
      setWealthClaimTaskId('');
      setWealthTaskClaimHash(undefined);
      setWealthClaimRecipientKey('');
      return;
    }

    const refetchTask =
      wealthClaimTaskId === 'settlement' ? refetchWealthSettlementTask : refetchWealthSubscribeTask;
    const refetchCollectible =
      wealthClaimTaskId === 'settlement'
        ? refetchWealthSettlementTaskCollectible
        : refetchWealthSubscribeTaskCollectible;

    let cancelled = false;

    async function verifyClaimedCollectible() {
      setFeedback('Sepolia transaction confirmed. Reading the wallet collectible before marking this claim complete.');
      const [taskResult, collectibleResult] = await Promise.allSettled([
        refetchTask?.(),
        refetchCollectible?.()
      ]);

      if (cancelled) return;

      const taskFlagConfirmed = taskResult.status === 'fulfilled' ? Boolean(taskResult.value?.data) : false;
      const collectibleOwned =
        collectibleResult.status === 'fulfilled' && hasPositiveOnchainBalance(collectibleResult.value?.data);

      if (taskFlagConfirmed && collectibleOwned) {
        recordWealthTaskClaim(wealthClaimTaskId, 'onchain');
        setWealthClaimTaskId('');
        setWealthTaskClaimHash(undefined);
        setWealthClaimRecipientKey('');
        return;
      }

      setFeedback(
        taskFlagConfirmed
          ? 'Sepolia marked the task, but the wallet collectible balance is not visible yet. Refresh the Sepolia read before treating it as claimed.'
          : 'Sepolia transaction confirmed, but Wealth could not read the task collectible from the vault yet. Refresh and retry the claim only if it stays missing.'
      );
      setWealthClaimTaskId('');
      setWealthTaskClaimHash(undefined);
      setWealthClaimRecipientKey('');
    }

    void verifyClaimedCollectible();

    return () => {
      cancelled = true;
    };
  }, [
    address,
    refetchWealthSettlementTaskCollectible,
    refetchWealthSettlementTask,
    refetchWealthSubscribeTaskCollectible,
    refetchWealthSubscribeTask,
    wealthClaimRecipientKey,
    wealthClaimTaskId,
    wealthSettlementTaskClaimedOnchain,
    wealthSubscribeTaskClaimedOnchain,
    wealthTaskClaimConfirmed,
    wealthVaultConfigured
  ]);

  function recordWealthTaskClaim(taskId, sourceLabel = 'local') {
    if (!WEALTH_TASK_TYPES[taskId]) return;

    const taskClaimsPatch = { [taskId]: true };
    const taskLabel = taskId === 'settlement' ? 'settlement / pledge' : 'receipt';

    setProgressState((current) => ({
      ...current,
      wealthTaskClaims: {
        ...normalizeWealthTaskClaims(current.wealthTaskClaims),
        ...taskClaimsPatch
      }
    }));

    if (address) {
      const storedProgress = readStorageJson(progressStorageKey, {});
      const profileProgress = readWalletProfile(address).progress || {};
      const nextClaims = {
        ...normalizeWealthTaskClaims(storedProgress.wealthTaskClaims),
        ...normalizeWealthTaskClaims(profileProgress.wealthTaskClaims),
        ...taskClaimsPatch
      };
      const nextProgress = {
        ...profileProgress,
        ...storedProgress,
        guideCompleted: Boolean(storedProgress.guideCompleted || profileProgress.guideCompleted),
        quizCompleted: Boolean(storedProgress.quizCompleted || profileProgress.quizCompleted),
        paperTradesCompleted: Math.max(
          Number(storedProgress.paperTradesCompleted || 0),
          Number(profileProgress.paperTradesCompleted || 0)
        ),
        wealthTaskClaims: nextClaims
      };

      writeStorageJson(progressStorageKey, nextProgress);
      writeWalletProfilePatch(address, { progress: nextProgress });
    }

    setFeedback(
      `Wealth ${taskLabel} collectible ${sourceLabel === 'onchain' ? 'confirmed' : 'claimed'} for this wallet. +${WEALTH_MILESTONE_BONUS.toLocaleString()} PT now carries into Wealth and Paper.`
    );
  }

  function handleConnect() {
    if (!hasMetaMaskInstalled) {
      setWalletError('MetaMask is not installed in this browser yet. Install the extension, pin it to the toolbar, and reopen this wallet panel.');
      return;
    }
    if (!metaMaskConnector) {
      setWalletError('MetaMask connector is not available in this browser.');
      return;
    }
    setWalletError('');
    setWalletNicknameFeedback('');
    const pendingNickname = normalizeWalletNickname(walletNicknameDraft);
    setPendingWalletNickname(pendingNickname || null);
    if (pendingNickname) {
      setWalletNicknameFeedback(`Nickname "${pendingNickname}" will be saved to the wallet that approves this connection.`);
    }
    connect({ connector: metaMaskConnector });
  }

  function handleWalletDisconnect() {
    setWalletError('');
    setWalletNicknameFeedback('');
    setProfileBackupStatus('Wallet disconnected. Wealth backups stay on this device; reconnect the same MetaMask account to recover them.');
    disconnect();
  }

  async function handleSignProfileBackup() {
    if (!isConnected || !address) {
      setProfileBackupStatus('Connect MetaMask first so the Wealth backup can be tied to the current account.');
      return;
    }

    setProfileBackupStatus('Opening MetaMask signature for this Wealth profile...');
    try {
      const record = await signAndStoreProfilePointer(
        address,
        {
          ...readWalletProfile(address),
          progress: progressState,
          wealth: wealthState,
          paper: paperProfileState
        },
        signMessageAsync
      );
      setProfileBackupStatus(`Wealth profile backup signed for ${shortAddress(address)}. Content hash ${record.contentHash.slice(0, 12)}...`);
    } catch (error) {
      setProfileBackupStatus(String(error?.message || 'Wealth profile backup signature was cancelled.'));
    }
  }

  function handleRecoverSelectedProfileBackup() {
    if (!selectedProfileBackupAddress) {
      setProfileBackupStatus('No historical Wealth backup is selected on this device yet.');
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
    setWealthState(readRecoveredWealthState(selectedProfileBackupAddress));
    setPaperProfileState(readRecoveredPaperState(selectedProfileBackupAddress));
    setProfileBackupStatus(`Saved Wealth state restored for ${shortAddress(selectedProfileBackupAddress)}. Positions, cash, receipt history, and Paper carry context are back on this device.`);
  }

  async function handleClaimWealthTaskBadge(taskId) {
    const quest = wealthQuestRows.find((item) => item.id === taskId);
    const alreadyClaimed = taskId === 'settlement' ? wealthSettlementTaskClaimed : wealthSubscribeTaskClaimed;

    if (!quest) return;

    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so the Wealth task collectible and PT reward stay mapped to one wallet.');
      return;
    }

    if (!wealthTaskReadyToClaimById[taskId]) {
      setFeedback(
        `Finish all 3 detected steps for ${quest.title.toLowerCase()} first. Open the matching product detail, then use the real buy, settle, or pledge action there.`
      );
      return;
    }

    if (alreadyClaimed) {
      setFeedback(`${quest.badge} is already claimed for this wallet.`);
      return;
    }

    if (!wealthVaultConfigured) {
      recordWealthTaskClaim(taskId, 'local');
      return;
    }

    try {
      setFeedback(`Open MetaMask to claim Sepolia collectible token #${WEALTH_TASK_TOKEN_IDS[taskId]}.`);
      setWealthTaskClaimHash(undefined);
      setWealthClaimRecipientKey(String(address).toLowerCase());

      if (chainId !== SEPOLIA_CHAIN_ID) {
        await switchChainAsync({ chainId: SEPOLIA_CHAIN_ID });
      }

      setWealthClaimTaskId(taskId);
      const claimHash = await writeWealthTaskContractAsync({
        address: WEALTH_VAULT_ADDRESS,
        abi: wealthVaultAbi,
        functionName: 'markWealthTask',
        args: [WEALTH_TASK_TYPES[taskId]],
        chainId: SEPOLIA_CHAIN_ID,
        gas: 220000n
      });
      setWealthTaskClaimHash(claimHash);
    } catch (claimError) {
      setWealthClaimTaskId('');
      setWealthTaskClaimHash(undefined);
      setWealthClaimRecipientKey('');
      const message = String(claimError?.shortMessage || claimError?.message || claimError || '');
      setFeedback(message.toLowerCase().includes('rejected') ? 'Wealth collectible claim was cancelled in MetaMask.' : message);
    }
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
      setDevModeError('');
      setDevModeNotice('Developer controls are open for this use. Reopening this panel asks for the account again.');
      return;
    }

    setDevModeError('Incorrect developer credentials.');
    setDevModeNotice('');
  }

  function handleDeveloperLogout() {
    setDevModeAuthed(false);
    setDevModeUsername('');
    setDevModePassword('');
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
    setWalletNicknameFeedback(
      savedNickname ? `Nickname saved as ${savedNickname}.` : 'Nickname cleared. The short wallet address will show again.'
    );
  }

  function applyProductFocus(productId, topic = 'flow') {
    const nextTopic = normalizeDetailTopicId(topic);
    startTransition(() => {
      setSelectedProductId(productId);
      setExpandedProductId(productId);
      setSelectedDetailTopics(nextTopic ? [nextTopic] : []);
      queueProductScroll(productId, 'detail');
    });
  }

  function applyShelfProductFilters(wrapperCategoryId = 'all', productTypeCategoryId = 'all') {
    setSelectedWrapperCategory(wrapperCategoryId);
    setSelectedProductTypeCategory(productTypeCategoryId);
    setSelectedCategory(getPrimaryWealthProductFilterId(wrapperCategoryId, productTypeCategoryId));
  }

  function focusShelfFilterForCategory(categoryId = 'all') {
    if (!categoryId || categoryId === 'all') {
      applyShelfProductFilters('all', 'all');
      return;
    }

    const group = WEALTH_PRODUCT_TYPE_GROUPS.find((item) =>
      item.options.some((option) => option.id === categoryId)
    );

    if (group?.id === 'wrapper') {
      applyShelfProductFilters(categoryId, 'all');
      return;
    }

    if (group?.id === 'productType') {
      applyShelfProductFilters('all', categoryId);
      return;
    }

    if (categoryId && categoryId !== 'all') {
      setSelectedWrapperCategory('all');
      setSelectedProductTypeCategory('all');
      setSelectedCategory(categoryId);
      return;
    }

    applyShelfProductFilters('all', 'all');
  }

  useEffect(() => {
    if (!pendingFocusRequest) return;
    if (!shelfProducts.some((product) => product.id === pendingFocusRequest.productId)) return;
    applyProductFocus(pendingFocusRequest.productId, pendingFocusRequest.topic);
    setPendingFocusRequest(null);
  }, [pendingFocusRequest, shelfProducts]);

  function focusProduct(productId, options = {}) {
    const targetProduct = liveProducts.find((product) => product.id === productId);
    const topic = options.topic || 'flow';
    const categoryOverride = options.categoryId || (targetProduct ? getCategoryIdForProduct(targetProduct) : null);
    const targetVisible = targetProduct && shelfProducts.some((product) => product.id === productId);
    const needsCategoryJump =
      targetProduct && (options.categoryId || !targetVisible);

    if (needsCategoryJump) {
      setPendingFocusRequest({ productId, topic });
      setSelectedGoal(getGoalIdForProduct(targetProduct));
      focusShelfFilterForCategory(categoryOverride || getCategoryIdForProduct(targetProduct));
      setShelfSearchQuery('');
      applyProductFocus(productId, topic);
      return;
    }

    setPendingFocusRequest(null);
    applyProductFocus(productId, topic);
  }

  function handleProductTypeSelect(category, selectedGroupId = '') {
    const nextCategory = category?.id || 'all';
    const groupId =
      selectedGroupId ||
      WEALTH_PRODUCT_TYPE_GROUPS.find((group) => group.options.some((option) => option.id === nextCategory))?.id ||
      'wrapper';
    if (nextCategory === 'all') {
      const nextWrapperCategory = groupId === 'wrapper' ? 'all' : selectedWrapperCategory;
      const nextProductTypeCategory = groupId === 'productType' ? 'all' : selectedProductTypeCategory;
      applyShelfProductFilters(nextWrapperCategory, nextProductTypeCategory);
      setShelfSearchQuery('');
      return;
    }

    const nextWrapperCategory = groupId === 'wrapper' ? nextCategory : selectedWrapperCategory;
    const nextProductTypeCategory = groupId === 'productType' ? nextCategory : selectedProductTypeCategory;

    applyShelfProductFilters(nextWrapperCategory, nextProductTypeCategory);
    setShelfSearchQuery('');
  }

  function handleOpportunitySelect(type) {
    if (!type) return;
    setSelectedGoal(type.goalId || 'earn');
    focusShelfFilterForCategory(type.filterCategory || 'all');
    setShelfSearchQuery('');

    const firstVisibleProductId = (type.productIds || []).find((productId) =>
      liveProducts.some((product) => product.id === productId)
    );

    if (firstVisibleProductId) {
      focusProduct(firstVisibleProductId, { categoryId: type.filterCategory || 'all', topic: 'flow' });
    }
  }

  function handleToggleProduct(productId) {
    const product = getProductByIdFrom(liveProducts, productId);

    if (expandedProductId === productId && selectedProductId === productId) {
      startTransition(() => {
        setExpandedProductId(null);
        queueProductScroll(productId, 'card');
      });
      return;
    }

    focusProduct(productId, {
      topic: 'flow',
      categoryId: product ? getCategoryIdForProduct(product) : undefined
    });
  }

  function handleTimelineProductOpen(productId) {
    const product = getProductByIdFrom(liveProducts, productId);
    handleExpandWealthTimeline();
    focusProduct(productId, {
      topic: 'flow',
      categoryId: product ? getCategoryIdForProduct(product) : undefined
    });
  }

  function toggleDetailTopic(topicId) {
    const nextTopic = normalizeDetailTopicId(topicId, '');
    setSelectedDetailTopics((current) => (nextTopic && current[0] === nextTopic ? [] : nextTopic ? [nextTopic] : []));
  }

  function handleDetailTopicChange(topicId) {
    const nextTopic = normalizeDetailTopicId(topicId, '');
    setSelectedDetailTopics(nextTopic ? [nextTopic] : []);
    if (nextTopic) {
      queueProductScroll(selectedProduct.id, 'detail');
    }
  }

  function handleProductNavPeriodChange(productId, periodId) {
    setProductNavPeriods((current) => ({
      ...current,
      [productId]: periodId
    }));
  }

  function handleAddCompareProduct(productId) {
    if (!productId) return;
    setCompareProductIds((current) => {
      const next = [...new Set([...current, productId])];
      return next.slice(0, MAX_COMPARE_PRODUCTS);
    });
    setComparePickerValue('');
  }

  function handleRemoveCompareProduct(productId) {
    setCompareProductIds((current) => current.filter((id) => id !== productId));
  }

  function getProductSubscriptionValidation(product, requestedAmount) {
    const unlockCopy = getUnlockCopy(product, unlockProgress);
    return getSubscriptionError({
      isConnected,
      address,
      isLocked: Boolean(unlockCopy),
      unlockCopy,
      requestedAmount,
      minimumTicket: Math.max(WEALTH_MIN_SUBSCRIPTION, product.minSubscription),
      availableCash
    });
  }

  function handleOpenSubscribeModal(productOverride = selectedProduct, event) {
    event?.stopPropagation?.();
    const product = productOverride || selectedProduct;
    const requestedAmount = Number(allocationAmount);
    const validationMessage = getProductSubscriptionValidation(product, requestedAmount);

    setSelectedProductId(product.id);
    setExpandedProductId(product.id);
    setSelectedDetailTopics(['flow']);
    queueProductScroll(product.id, 'detail');
    setAllocationAmount(Number.isFinite(requestedAmount) ? requestedAmount : 0);

    if (validationMessage) {
      setFeedback(validationMessage);
      return;
    }

    setFeedback('');
    setIsSubscribeModalOpen(true);
  }

  async function ensureWealthActionSignature({
    action,
    product = selectedProduct,
    amount = 0,
    shares = 0,
    extraLines = []
  } = {}) {
    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so this wealth action can be signed by the wallet that owns the receipt.');
      return false;
    }

    try {
      await signMessageAsync({
        message: [
          'RiskLens wealth receipt action',
          `Wallet: ${address}`,
          `Action: ${action}`,
          `Product: ${product.name}`,
          `Receipt token: ${product.shareToken}`,
          Number.isFinite(Number(amount)) && Number(amount) > 0 ? `PT amount: ${formatValue(Number(amount), false)}` : '',
          Number.isFinite(Number(shares)) && Number(shares) > 0 ? `Receipt shares: ${formatShareBalance(Number(shares), false)}` : '',
          ...extraLines,
          wealthVaultConfigured
            ? 'This signature authorizes the demo action; a Sepolia receipt transaction may follow in MetaMask.'
            : 'This confirms a local demo ledger update and does not submit a live vault transaction.'
        ]
          .filter(Boolean)
          .join('\n')
      });

      return true;
    } catch (actionError) {
      const actionMessage = String(actionError?.shortMessage || actionError?.message || '');
      setFeedback(
        actionMessage.toLowerCase().includes('rejected')
          ? 'Wallet signature was rejected, so the wealth ledger stayed unchanged.'
          : actionMessage || 'MetaMask could not sign this wealth action.'
      );
      return false;
    }
  }

  async function submitWealthReceiptTransaction({
    functionName,
    args,
    pendingLabel,
    submittedLabel,
    confirmedLabel,
    gas = 360000n
  }) {
    if (!wealthVaultConfigured) return true;

    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so the Wealth receipt can be minted or burned on Sepolia.');
      return false;
    }

    try {
      setFeedback(`${pendingLabel} Open MetaMask to confirm the Sepolia receipt transaction.`);

      if (chainId !== SEPOLIA_CHAIN_ID) {
        await switchChainAsync({ chainId: SEPOLIA_CHAIN_ID });
      }

      const hash = await writeWealthReceiptContractAsync({
        address: WEALTH_VAULT_ADDRESS,
        abi: wealthVaultAbi,
        functionName,
        args,
        chainId: SEPOLIA_CHAIN_ID,
        gas
      });

      setFeedback(`${submittedLabel}: ${shortAddress(hash)}. Waiting for Sepolia confirmation.`);
      await waitForTransactionReceipt(wagmiConfig, {
        chainId: SEPOLIA_CHAIN_ID,
        hash
      });
      setFeedback(confirmedLabel);
      return true;
    } catch (receiptError) {
      const message = String(receiptError?.shortMessage || receiptError?.message || receiptError || '');
      setFeedback(
        message.toLowerCase().includes('rejected')
          ? 'Receipt transaction was cancelled in MetaMask, so the Wealth ledger stayed unchanged.'
          : message || 'MetaMask could not submit the Wealth receipt transaction.'
      );
      return false;
    }
  }

  async function handleConfirmSubscribe() {
    const requestedAmount = Number(allocationAmount);

    if (subscriptionValidationMessage) {
      setFeedback(subscriptionValidationMessage);
      return;
    }

    const sharesMinted = roundNumber(requestedAmount / selectedProduct.nav, 6);
    const wantsOnchainReceipt = subscriptionReceiptProofMode === 'onchain' && wealthVaultConfigured;
    const receiptProductId = getWealthReceiptProductId(selectedProduct);
    const receiptTokenId = getWealthReceiptTokenId(selectedProduct);
    const receiptUnitAmount = toVaultUnitAmount(requestedAmount);
    const receiptPurchasedAt = new Date().toISOString();
    const receiptProductDetail = selectedSettlementPolicy.timing;
    const receiptProductDetailCopy = selectedSettlementPolicy.detail || selectedProduct.redemption || selectedSettlementPolicy.label;
    const receiptProofHash = buildLocalReceiptProof({
      address,
      product: selectedProduct,
      amount: requestedAmount,
      shares: sharesMinted,
      receiptMode: wantsOnchainReceipt ? 'sepolia-receipt-and-w1-badge' : 'local-proof',
      purchasedAt: receiptPurchasedAt,
      productDetail: receiptProductDetail
    });
    const signed = await ensureWealthActionSignature({
      action: 'subscribe',
      amount: requestedAmount,
      shares: sharesMinted,
      extraLines: [
        `NAV: ${selectedProduct.nav.toFixed(3)}`,
        `Funding rail: ${getFundingRailCopy(selectedProduct)}`,
        `Receipt proof mode: ${wantsOnchainReceipt ? `Sepolia ERC-1155 receipt #${receiptTokenId} + W1 badge` : 'Local receipt proof only'}`,
        `Receipt display amount: ${requestedAmount.toLocaleString()} PT`,
        `Receipt product: ${selectedProduct.name}`,
        `Receipt purchase date: ${new Date(receiptPurchasedAt).toLocaleString()}`,
        `Receipt product detail: ${receiptProductDetail} - ${receiptProductDetailCopy}`,
        wantsOnchainReceipt ? `Onchain receipt units: ${receiptUnitAmount.toLocaleString()}` : `Local proof hash: ${receiptProofHash}`
      ]
    });

    if (!signed) return;

    const receiptMinted = wantsOnchainReceipt
      ? await submitWealthReceiptTransaction({
          functionName: 'subscribeProduct',
          args: [receiptProductId, receiptUnitAmount],
          pendingLabel: `Minting required Sepolia receipt #${receiptTokenId} and W1 badge for ${requestedAmount.toLocaleString()} PT.`,
          submittedLabel: `Receipt record submitted for ${selectedProduct.shortName || selectedProduct.name}`,
          confirmedLabel: `Sepolia receipt #${receiptTokenId} confirmed for ${selectedProduct.shortName || selectedProduct.name}.`
        })
      : true;

    if (!receiptMinted) return;

    if (wantsOnchainReceipt) {
      await Promise.allSettled([
        refetchWealthSubscribeTask?.(),
        refetchWealthSubscribeTaskCollectible?.()
      ]);
    }

    setWealthState((current) => {
      const currentPosition = current.positions[selectedProduct.id] || { shares: 0, principal: 0 };
      const nextShares = roundNumber(currentPosition.shares + sharesMinted, 6);
      const nextPrincipal = roundNumber(currentPosition.principal + requestedAmount, 2);
      const nextEntryNav = nextShares > 0 ? roundNumber(nextPrincipal / nextShares, 6) : selectedProduct.nav;
      const now = new Date().toISOString();
      const nextState = {
        ...current,
        cash: roundNumber(current.cash - requestedAmount, 2),
        positions: {
          ...current.positions,
          [selectedProduct.id]: {
            shares: nextShares,
            principal: nextPrincipal,
            entryNav: nextEntryNav,
            entryTs: currentPosition.entryTs || now,
            lastActivityTs: now
          }
        }
      };

      return appendWealthActivity(nextState, {
        type: 'subscribe',
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        amount: requestedAmount,
        shares: sharesMinted,
        receiptProofMode: wantsOnchainReceipt ? 'onchain' : 'local',
        receiptProofHash,
        receiptTokenId,
        receiptUnitAmount: receiptUnitAmount.toString(),
        receiptProductDetail,
        receiptProductDetailCopy,
        receiptPurchasedAt
      });
    });

    setFeedback(
      `Subscription placed: ${requestedAmount.toLocaleString()} PT into ${selectedProduct.name}. ${
        wantsOnchainReceipt
          ? `Sepolia receipt #${receiptTokenId} and W1 badge are the proof for ${selectedProduct.name}, purchased ${new Date(receiptPurchasedAt).toLocaleString()}, detail ${receiptProductDetail}. `
          : `Local receipt proof ${receiptProofHash.slice(0, 10)}... saved; no Sepolia receipt was minted. `
      }${sharesMinted.toLocaleString()} ${selectedProduct.shareToken} shares are now live in the demo wallet.`
    );
    setSettlementDays(0);
    setIsSubscribeModalOpen(false);
  }

  async function handleUseAsCollateral() {
    if (!isCollateralPilotProduct(selectedProduct)) {
      setFeedback('This product does not expose a receipt token that can be pledged in the demo collateral ledger.');
      return;
    }

    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so the pledged receipt and support line stay mapped to one wallet.');
      return;
    }

    if (!selectedPosition.shares) {
      setFeedback(`Buy ${selectedProduct.shortName || selectedProduct.name} first. You need wallet-linked receipt shares before they can be pledged as collateral.`);
      return;
    }

    const collateralShares = roundNumber(selectedPosition.shares, 6);
    const collateralValue = roundNumber(collateralShares * selectedProduct.nav, 2);
    const maxBorrowable = roundNumber(collateralValue * selectedCollateralAdvanceRate, 2);
    const requestedBorrowTarget = Number(collateralBorrowInput || 0);
    const defaultBorrowTarget = selectedBorrowedAmount > 0 ? selectedBorrowedAmount : Math.min(10000, maxBorrowable);
    const nextBorrowTarget = roundNumber(
      Number.isFinite(requestedBorrowTarget) && requestedBorrowTarget > 0 ? requestedBorrowTarget : defaultBorrowTarget,
      2
    );

    if (!Number.isFinite(nextBorrowTarget) || nextBorrowTarget <= 0) {
      setFeedback('Enter a positive support-line target first.');
      return;
    }

    if (nextBorrowTarget <= selectedBorrowedAmount) {
      setFeedback('This support target is not above the current line. Use Release support when you want to unwind the collateral flow.');
      return;
    }

    if (nextBorrowTarget > maxBorrowable) {
      setFeedback(
        `${selectedProduct.shortName || selectedProduct.name} can only borrow up to ${maxBorrowable.toLocaleString()} PT at the current ${(selectedCollateralAdvanceRate * 100).toFixed(0)}% advance rate.`
      );
      return;
    }

    const borrowDelta = roundNumber(nextBorrowTarget - selectedBorrowedAmount, 2);
    const signed = await ensureWealthActionSignature({
      action: 'pledge receipt support',
      amount: nextBorrowTarget,
      shares: collateralShares,
      extraLines: [
        `Collateral value: ${formatValue(collateralValue, false)}`,
        `Advance rate: ${(selectedCollateralAdvanceRate * 100).toFixed(0)}%`,
        `Pledge term: ${pledgeTermMode === 'fixed' ? 'Fixed term' : 'Flexible'}`,
        pledgeTermMode === 'fixed'
          ? `Timeline lock: ${selectedPledgeLockStatus.lockDays}D fixed pledge; release is blocked until the timeline reaches that window.`
          : 'Timeline lock: flexible pledge; release can be signed without waiting for the maturity slider.',
        `Modeled pledge APY: ${formatYieldPercent(selectedCollateralApy)}`,
        `Support delta: ${formatValue(borrowDelta, false)}`
      ]
    });

    if (!signed) return;

    setWealthState((current) => {
      const nextState = {
        ...current,
        collateral: {
          ...(current.collateral || {}),
          [selectedProduct.id]: {
            pledgedShares: collateralShares,
            borrowedAmount: nextBorrowTarget,
            advanceRate: selectedCollateralAdvanceRate,
            termMode: pledgeTermMode,
            apy: selectedCollateralApy,
            lockDays: pledgeTermMode === 'fixed' ? selectedPledgeLockStatus.lockDays : 0,
            updatedAt: new Date().toISOString(),
            supportOnly: true
          }
        }
      };

      return appendWealthActivity(nextState, {
        type: 'collateral',
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        amount: nextBorrowTarget,
        shares: collateralShares
      });
    });

    setFeedback(
      `${selectedProduct.shareToken} collateral activated: ${collateralShares.toLocaleString()} shares are now pledged. The route support line is ${nextBorrowTarget.toLocaleString()} PT, and Paper Trading can read it without adding that PT to Wealth cash.`
    );
  }

  async function handleReleaseCollateral() {
    if (!isCollateralPilotProduct(selectedProduct)) {
      setFeedback('This product does not expose a pledgeable receipt in the demo collateral ledger.');
      return;
    }

    if (!selectedPledgedShares || !selectedBorrowedAmount) {
      setFeedback(`No pledged ${selectedProduct.shareToken} receipt is active for this wallet right now.`);
      return;
    }

    if (selectedPledgeLockStatus.isLocked) {
      setFeedback(
        `This is a fixed pledge. Move the timeline at least ${selectedPledgeLockStatus.daysLeft}D forward before releasing support or redeeming the receipt.`
      );
      return;
    }

    const signed = await ensureWealthActionSignature({
      action: 'release pledged support',
      amount: selectedBorrowedAmount,
      shares: selectedPledgedShares,
      extraLines: [
        `Current LTV: ${(selectedCollateralLtv * 100).toFixed(2)}%`,
        selectedPledgeLockStatus.isFixed
          ? `Pledge lock: timeline has reached the ${selectedPledgeLockStatus.lockDays}D fixed window, so release can proceed.`
          : 'Pledge lock: flexible support can release immediately.',
        'Release removes route support and returns the receipt to the free balance before settlement.'
      ]
    });

    if (!signed) return;

    setWealthState((current) => {
      const nextCollateral = { ...(current.collateral || {}) };
      delete nextCollateral[selectedProduct.id];
      const nextState = {
        ...current,
        collateral: nextCollateral
      };

      return appendWealthActivity(nextState, {
        type: 'collateral-release',
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        amount: selectedBorrowedAmount,
        shares: selectedPledgedShares
      });
    });

    setFeedback(
      `${selectedProduct.shareToken} collateral released: removed ${selectedBorrowedAmount.toLocaleString()} PT of route support and unlocked ${selectedPledgedShares.toLocaleString()} shares for normal settlement again.${
        selectedPledgeLockStatus.isFixed
          ? ` The fixed pledge window was cleared through the timeline before release.`
          : ''
      }`
    );
  }

  async function handleRedeem() {
    const requestedAmount = Number(allocationAmount);

    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so redemptions can resolve against the wallet-linked demo state.');
      return;
    }

    if (isClosedEndProduct(selectedProduct)) {
      setFeedback('This is a term sleeve. It cannot be redeemed early in the current flow, so use the timeline maturity preview instead.');
      return;
    }

    if (!selectedPosition.shares) {
      setFeedback('No share balance is available to redeem for this product yet.');
      return;
    }

    if (selectedFreeShares <= 0) {
      setFeedback(
        selectedPledgeLockStatus.isLocked
          ? `All current shares are in a fixed pledge. Move the timeline at least ${selectedPledgeLockStatus.daysLeft}D forward before release or redeem.`
          : 'All current shares are pledged as collateral. Release the support line first before trying to settle this sleeve back to PT cash.'
      );
      return;
    }

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      setFeedback('Enter a positive redemption amount first.');
      return;
    }

    const redeemValue = Math.min(requestedAmount, selectedFreeValue);
    const sharesToBurn = roundNumber(redeemValue / selectedProduct.nav, 6);
    const remainingShares = roundNumber(Math.max(0, selectedPosition.shares - sharesToBurn), 6);
    const ratio = selectedPosition.shares > 0 ? Math.min(1, sharesToBurn / selectedPosition.shares) : 0;
    const principalReduction = roundNumber(selectedPosition.principal * ratio, 2);
    const signed = await ensureWealthActionSignature({
      action: 'redeem',
      amount: redeemValue,
      shares: sharesToBurn,
      extraLines: [
        `NAV: ${selectedProduct.nav.toFixed(3)}`,
        `Free shares before redeem: ${formatShareBalance(selectedFreeShares, false)}`
      ]
    });

    if (!signed) return;

    const receiptProductId = getWealthReceiptProductId(selectedProduct);
    const receiptTokenId = getWealthReceiptTokenId(selectedProduct);
    const receiptPrincipalToBurn = principalReduction > 0 ? principalReduction : redeemValue;
    const receiptBurned = await submitWealthReceiptTransaction({
      functionName: 'redeemProduct',
      args: [receiptProductId, toVaultUnitAmount(receiptPrincipalToBurn)],
      pendingLabel: `Burning Wealth receipt collectible #${receiptTokenId}.`,
      submittedLabel: `Receipt burn submitted for ${selectedProduct.shortName || selectedProduct.name}`,
      confirmedLabel: `Sepolia receipt #${receiptTokenId} burn confirmed for ${selectedProduct.shortName || selectedProduct.name}.`
    });

    if (!receiptBurned) return;

    setWealthState((current) => {
      const nextPositions = { ...current.positions };

      if (remainingShares <= 0) {
        delete nextPositions[selectedProduct.id];
      } else {
        const nextEntryNav = remainingShares > 0 ? roundNumber(Math.max(0, selectedPosition.principal - principalReduction) / remainingShares, 6) : selectedProduct.nav;
        nextPositions[selectedProduct.id] = {
          shares: remainingShares,
          principal: roundNumber(Math.max(0, selectedPosition.principal - principalReduction), 2),
          entryNav: nextEntryNav,
          entryTs: selectedPosition.entryTs || '',
          lastActivityTs: new Date().toISOString()
        };
      }
      const nextState = {
        ...current,
        cash: roundNumber(current.cash + redeemValue, 2),
        positions: nextPositions
      };

      return appendWealthActivity(nextState, {
        type: 'redeem',
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        amount: redeemValue,
        shares: sharesToBurn
      });
    });

    setFeedback(
      `Redemption placed: ${redeemValue.toLocaleString()} PT from ${selectedProduct.name}. ${
        wealthVaultConfigured ? `Sepolia receipt #${receiptTokenId} burned and ` : ''
      }${sharesToBurn.toLocaleString()} ${selectedProduct.shareToken} shares were burned in the demo ledger.`
    );
    setSettlementDays(0);
  }

  async function handleSimulateSettlement() {
    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so maturity, roll, transfer, or exit simulation is signed by the receipt wallet.');
      return;
    }

    if (!selectedPosition.shares) {
      setFeedback(`Buy ${selectedProduct.shortName || selectedProduct.name} first, then use the timeline presets to settle the receipt.`);
      return;
    }

    if (selectedFreeShares <= 0) {
      setFeedback(
        selectedPledgeLockStatus.isLocked
          ? `All current shares are in a fixed pledge. Move the timeline at least ${selectedPledgeLockStatus.daysLeft}D forward before release, settle, transfer, or exit.`
          : 'All current shares are pledged as collateral. Release the support line first before settling, transferring, or exiting this receipt.'
      );
      return;
    }

    if (!selectedSettlementPolicy.redeemable && settlementAction !== 'preview' && selectedLockStatus.isLocked) {
      setFeedback(
        `${selectedProduct.shareToken} is still locked for about ${selectedLockStatus.daysLeft}D. Move the timeline to the suggested maturity window before settle, roll, or transfer; early exit would be shown as a haircut, not an open settlement.`
      );
      return;
    }

    if (settlementAction === 'transfer' && !settlementTransferProduct) {
      setFeedback('Pick a transfer target before signing a receipt transfer.');
      return;
    }

    const sharesToSettle = selectedFreeShares;
    const valueToSettle = roundNumber(sharesToSettle * settlementProjectedNav, 2);
    const ratio = selectedPosition.shares > 0 ? Math.min(1, sharesToSettle / selectedPosition.shares) : 0;
    const principalReduction = roundNumber(selectedPosition.principal * ratio, 2);
    const actionLabel = settlementActionMeta.label.toLowerCase();
    const signed = await ensureWealthActionSignature({
      action: `settlement ${settlementAction}`,
      product: selectedProduct,
      amount: valueToSettle,
      shares: sharesToSettle,
      extraLines: [
        `Days forward: ${settlementDays}`,
        `Settlement window: ${settlementWindowLabel}`,
        `Predicted NAV: ${settlementProjectedNav.toFixed(3)}`,
        settlementPredictionCopy,
        settlementAction === 'transfer' && settlementTransferProduct
          ? `Transfer target: ${settlementTransferProduct.name}`
          : ''
      ]
    });

    if (!signed) return;

    const receiptProductId = getWealthReceiptProductId(selectedProduct);
    const receiptTokenId = getWealthReceiptTokenId(selectedProduct);
    const receiptPrincipalToBurn = principalReduction > 0 ? principalReduction : valueToSettle;

    if (settlementAction !== 'preview') {
      const targetProduct =
        settlementAction === 'roll'
          ? selectedProduct
          : settlementAction === 'transfer'
            ? settlementTransferProduct
            : null;
      const targetReceiptProductId = targetProduct ? getWealthReceiptProductId(targetProduct) : 0;
      const targetReceiptTokenId = targetProduct ? getWealthReceiptTokenId(targetProduct) : 0;
      const mintAmount = targetProduct ? valueToSettle : 0;
      const receiptSettled = await submitWealthReceiptTransaction({
        functionName: 'settleProduct',
        args: [
          receiptProductId,
          targetReceiptProductId,
          toVaultUnitAmount(receiptPrincipalToBurn),
          toVaultUnitAmount(mintAmount)
        ],
        pendingLabel:
          targetProduct && targetReceiptTokenId !== receiptTokenId
            ? `Settling receipt #${receiptTokenId} into receipt #${targetReceiptTokenId}.`
            : targetProduct
              ? `Rolling receipt collectible #${receiptTokenId}.`
              : `Burning settled receipt collectible #${receiptTokenId}.`,
        submittedLabel: `Receipt settlement submitted for ${selectedProduct.shortName || selectedProduct.name}`,
        confirmedLabel:
          targetProduct && targetReceiptTokenId !== receiptTokenId
            ? `Sepolia receipt #${receiptTokenId} burned and #${targetReceiptTokenId} minted.`
            : targetProduct
              ? `Sepolia receipt #${receiptTokenId} burned and reminted for the next term.`
              : `Sepolia receipt #${receiptTokenId} burned and settled.`,
        gas: 560000n
      });

      if (!receiptSettled) return;

      if (wealthVaultConfigured) {
        await Promise.allSettled([
          refetchWealthSettlementTask?.(),
          refetchWealthSettlementTaskCollectible?.()
        ]);
      }
    }

    setWealthState((current) => {
      const currentPosition = current.positions[selectedProduct.id] || selectedPosition;
      const nextPositions = { ...current.positions };
      const remainingShares = roundNumber(Math.max(0, currentPosition.shares - sharesToSettle), 6);
      const remainingPrincipal = roundNumber(Math.max(0, currentPosition.principal - principalReduction), 2);
      const now = new Date().toISOString();
      let nextCash = current.cash;

      if (settlementAction === 'preview') {
        return appendWealthActivity(current, {
          type: 'settlement',
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          action: settlementAction,
          amount: valueToSettle,
          shares: sharesToSettle
        });
      }

      if (settlementAction === 'roll') {
        const rolledShares = selectedProduct.nav > 0 ? roundNumber(valueToSettle / selectedProduct.nav, 6) : 0;
        const nextShares = roundNumber(remainingShares + rolledShares, 6);
        const nextPrincipal = roundNumber(remainingPrincipal + valueToSettle, 2);
        nextPositions[selectedProduct.id] = {
          shares: nextShares,
          principal: nextPrincipal,
          entryNav: nextShares > 0 ? roundNumber(nextPrincipal / nextShares, 6) : selectedProduct.nav,
          entryTs: now,
          lastActivityTs: now
        };
      } else if (settlementAction === 'transfer' && settlementTransferProduct) {
        if (remainingShares <= 0) {
          delete nextPositions[selectedProduct.id];
        } else {
          nextPositions[selectedProduct.id] = {
            shares: remainingShares,
            principal: remainingPrincipal,
            entryNav: remainingShares > 0 ? roundNumber(remainingPrincipal / remainingShares, 6) : selectedProduct.nav,
            entryTs: currentPosition.entryTs || '',
            lastActivityTs: now
          };
        }

        const targetPosition = current.positions[settlementTransferProduct.id] || { shares: 0, principal: 0 };
        const targetShares = roundNumber(valueToSettle / settlementTransferProduct.nav, 6);
        const nextTargetShares = roundNumber((targetPosition.shares || 0) + targetShares, 6);
        const nextTargetPrincipal = roundNumber((targetPosition.principal || 0) + valueToSettle, 2);
        nextPositions[settlementTransferProduct.id] = {
          shares: nextTargetShares,
          principal: nextTargetPrincipal,
          entryNav: nextTargetShares > 0 ? roundNumber(nextTargetPrincipal / nextTargetShares, 6) : settlementTransferProduct.nav,
          entryTs: targetPosition.entryTs || now,
          lastActivityTs: now
        };
      } else {
        if (remainingShares <= 0) {
          delete nextPositions[selectedProduct.id];
        } else {
          nextPositions[selectedProduct.id] = {
            shares: remainingShares,
            principal: remainingPrincipal,
            entryNav: remainingShares > 0 ? roundNumber(remainingPrincipal / remainingShares, 6) : selectedProduct.nav,
            entryTs: currentPosition.entryTs || '',
            lastActivityTs: now
          };
        }
        nextCash = roundNumber(current.cash + valueToSettle, 2);
      }

      return appendWealthActivity(
        {
          ...current,
          cash: nextCash,
          positions: nextPositions
        },
        {
          type: 'settlement',
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          action: settlementAction,
          amount: valueToSettle,
          shares: sharesToSettle,
          targetProductId: settlementAction === 'transfer' ? settlementTransferProduct?.id : ''
        }
      );
    });

    const receiptLifecycleCopy =
      settlementAction === 'preview'
        ? 'Receipt collectible was not changed.'
        : settlementAction === 'roll'
          ? 'The old receipt collectible was burned and reminted into the next term.'
          : settlementAction === 'transfer'
            ? `The old receipt collectible was burned and reminted as ${settlementTransferProduct?.shareToken || 'the transfer target'} receipt shares.`
            : 'The receipt collectible was burned and returned to PT cash.';

    setFeedback(
      `Signed ${actionLabel}: ${formatShareBalance(sharesToSettle, false)} ${selectedProduct.shareToken} marked to ${formatValue(
        valueToSettle,
        false
      )} across the ${settlementWindowLabel}. ${receiptLifecycleCopy}`
    );
    if (settlementAction !== 'preview') {
      setSettlementDays(0);
      setFastForwardTarget('today');
    }
  }

  function handlePreviewMaturity() {
    setFeedback(
      `Scenario preview for ${selectedProduct.name}: move the timeline to ${selectedProduct.scenario.horizon.toLowerCase()} with the presets, then sign Roll, Transfer, or End settlement to update the wallet ledger.`
    );
  }

  function handleBackToTop() {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleResetPortfolio() {
    setWealthState(defaultWealthState());
    setFeedback('Wealth demo portfolio reset for this wallet. Starter cash and empty share balances were restored.');
  }

  function handlePositionQuickAction(productId, action) {
    const product = getProductByIdFrom(liveProducts, productId);
    if (!product) return;

    handleExpandWealthTimeline();

    const nextSettlementAction =
      action === 'roll' ? 'roll' : action === 'transfer' ? 'transfer' : action === 'pledge' || action === 'preview' ? 'preview' : 'exit';
    const position = displayWealthState.positions?.[productId] || { shares: 0 };
    const maxSupport = roundNumber(Number(position.shares || 0) * Number(product.nav || 0) * getCollateralAdvanceRate(product), 2);
    const lockStatus = getWealthLockStatus(product, position, settlementDays);

    setSettlementAction(nextSettlementAction);
    if (action === 'pledge') {
      setCollateralBorrowInput(maxSupport > 0 ? Math.min(1000, maxSupport) : 0);
    }
    focusProduct(productId, {
      topic: 'flow',
      categoryId: getCategoryIdForProduct(product)
    });
    setFeedback(
      action === 'pledge'
        ? `${product.shareToken} pledge view opened. ${
            lockStatus.isLocked
              ? `This term receipt still has about ${lockStatus.daysLeft}D locked; releasing or exiting early should assume about ${(lockStatus.earlyHaircutRate * 100).toFixed(1)}% haircut risk. `
              : ''
          }Set the support target, then sign the support line if this receipt should back Paper routes.`
        : `${product.shareToken} ${nextSettlementAction} view opened. ${
            !getSettlementPolicy(product).redeemable && lockStatus.isLocked
              ? `Locked for about ${lockStatus.daysLeft}D more; use the suggested maturity window before signing settlement. `
              : ''
          }Review the settlement desk, then sign when ready.`
    );
  }

  function beginWealthTimelineDrag(event) {
    if (event.button !== 0) return;
    if (event.target?.closest?.('button, input, select, textarea, a, label')) return;
    event.preventDefault();
    setTimelineDockGesture({
      type: 'drag',
      startX: event.clientX,
      startY: event.clientY,
      left: timelineDockFloat.left,
      top: timelineDockFloat.top
    });
  }

  function beginWealthTimelineArrowGesture(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    setTimelineDockGesture({
      type: 'arrow',
      startX: event.clientX,
      startY: event.clientY,
      arrowTop: timelineDockFloat.arrowTop
    });
  }

  function handleCollapseWealthTimeline() {
    const anchor = getCollapsedWealthTimelineAnchor(timelineDockFloat);
    setTimelineDockFloat((current) =>
      normalizeWealthTimelineFloat({
        ...current,
        isCollapsed: true,
        arrowSide: anchor.arrowSide,
        arrowTop: anchor.arrowTop
      })
    );
    setTimelineDockOpen(false);
  }

  function handleExpandWealthTimeline() {
    setTimelineDockFloat((current) =>
      normalizeWealthTimelineFloat({
        ...current,
        isCollapsed: false
      })
    );
    setTimelineDockOpen(true);
  }

  function renderDualCurrencyGuideSection() {
    if (!dualInvestmentShelfActive) return null;

    return renderDualInvestmentOrderBook({ surface: 'shelf' });
  }

  function renderDualOutcomeMap({ className = '' } = {}) {
    if (!isDualInvestmentProduct(selectedProduct)) return null;
    const chartPair = selectedDualProductPair || dualCurrencyPair;
    const chartTargetPrice = roundNumber(
      chartPair.referencePrice * (1 + Number(dualCurrencyTargetPct || 0) / 100),
      chartPair.referencePrice > 1000 ? 2 : 4
    );

    return (
      <DualOutcomeSimulator
        pair={chartPair}
        direction={dualCurrencyDirection}
        targetPrice={chartTargetPrice}
        targetPct={dualCurrencyTargetPct}
        apr={dualCurrencyApr}
        settlementDays={settlementDays}
        settlementMovePct={dualCurrencySettlementMovePct}
        onSettlementMoveChange={setDualCurrencySettlementMovePct}
        className={className}
      />
    );
  }

  function renderWealthDeskDisclosure({ title, subtitle, badge = null, children }) {
    return (
      <details className="paper-mode-card wealth-subpanel-card wealth-desk-disclosure">
        <summary className="wealth-desk-summary">
          <div>
            <div className="product-title">{title}</div>
            {subtitle ? <div className="muted">{subtitle}</div> : null}
          </div>
          <span className="wealth-desk-summary-side">
            {badge ? <span className="pill risk-medium">{badge}</span> : null}
            <span className="wealth-desk-toggle-icon" aria-hidden="true" />
          </span>
        </summary>
        <div className="wealth-desk-body">{children}</div>
      </details>
    );
  }

  function renderDualInvestmentOrderBook({ surface = 'detail' } = {}) {
    const dualProducts = liveProducts.filter(isDualInvestmentProduct);
    const activeDualProduct = isDualInvestmentProduct(selectedProduct)
      ? selectedProduct
      : dualProducts[0] || selectedProduct;
    if (!activeDualProduct) return null;

    const activePair = getDualPairForProduct(activeDualProduct, dualCurrencyPair);
    const activeDirectionMeta = dualCurrencyDirectionMeta;
    const suggestedDualTermDays = getDualInvestmentTermDays(activeDualProduct);
    const termFilters = [
      { id: 'all', label: 'Suggested', days: suggestedDualTermDays },
      { id: '2d', label: '2D', days: 2 },
      { id: '7d', label: '7D', days: 7 },
      { id: '14d', label: '14D', days: 14 },
      { id: '45d', label: '45D', days: 45 },
      { id: '90d', label: '90D', days: 90 }
    ];
    const ptSubscribeAmount = Math.max(0, Number(allocationAmount) || dualCurrencyExamplePrincipal);
    const selectedDualTermDays = Math.max(1, Number(settlementDays || suggestedDualTermDays) || 1);
    const dualAmountPresetValues = [1000, 5000, 10000, 25000];
    const targetSliderMin = dualCurrencyDirection === 'sell-high' ? 1 : -12;
    const targetSliderMax = dualCurrencyDirection === 'sell-high' ? 12 : -1;
    const targetSliderValue = clamp(
      getDirectionalDualTargetPct(dualCurrencyDirection, dualCurrencyTargetPct),
      targetSliderMin,
      targetSliderMax
    );
    const targetDistanceBoost = 1 + Math.min(0.75, Math.abs(targetSliderValue) / 12);
    const termAprBoost = Math.max(0.55, Math.min(2.1, 2 / Math.sqrt(selectedDualTermDays)));
    const quotedDualApr = Math.min(2.2, Math.max(0.22, dualCurrencyApr * targetDistanceBoost * termAprBoost));
    const ptSettlementPreview = buildDualPtSettlementPreview({
      pair: activePair,
      direction: dualCurrencyDirection,
      targetPct: targetSliderValue,
      settlementMovePct: dualCurrencySettlementMovePct,
      apr: quotedDualApr,
      termDays: selectedDualTermDays,
      subscribedPt: ptSubscribeAmount
    });
    const priceDigits = activePair.referencePrice > 1000 ? 2 : 4;
    const formatPairPrice = (value) => Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: priceDigits,
      maximumFractionDigits: priceDigits
    });

    return (
      <section className={`card wealth-dual-guide-card wealth-dual-order-card ${surface === 'detail' ? 'detail' : 'shelf'}`}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{surface === 'detail' ? 'Dual Investment order board' : 'Structured wealth / Dual Investment'}</div>
            <h2>{surface === 'detail' ? 'Choose direction and term' : 'Pick a target-price receipt before buying'}</h2>
          </div>
          <span className="pill risk-medium">{activeDirectionMeta.label}</span>
        </div>

        <div className="wealth-dual-warning wealth-dual-board-intro">
          This demo uses the page reference price for quote education, but subscription and rewards settle only in PT.
        </div>

        <div className="wealth-dual-control-panel">
          <div className="wealth-dual-control-block">
            <div className="product-title">{activePair.id}</div>
            <div className="wealth-dual-control-label">Term</div>
            <div className="wealth-dual-filter-row">
              {termFilters.map((filter) => (
                <button
                  type="button"
                  key={filter.id}
                  className={`wealth-dual-filter-chip ${selectedDualTermDays === filter.days ? 'active' : ''}`}
                  onClick={() => setSettlementDays(filter.days)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {surface === 'detail' ? (
          <div className="wealth-dual-pt-quote-card">
            <div className="eyebrow wealth-dual-quote-eyebrow">PT subscription preview</div>
            <div className="wealth-dual-pt-quote-title">
              <span className="wealth-dual-coin-stack" aria-hidden="true">
                <i>{activePair.base.slice(0, 1)}</i>
                <i>PT</i>
              </span>
              <div>
                <h3>{dualCurrencyDirection === 'sell-high' ? `Sell high ${activePair.base} with PT` : `Buy low ${activePair.base} with PT`}</h3>
              </div>
            </div>
            <div className="wealth-dual-current-price wealth-dual-preview-price">
              <span className="wealth-dual-coin">{activePair.base.slice(0, 1)}</span>
              <span>{activePair.id} reference price:</span>
              <strong>{formatPairPrice(activePair.referencePrice)}</strong>
            </div>

            <div className="wealth-dual-quote-metrics">
              <div>
                <span>APR</span>
                <strong>{formatYieldPercent(quotedDualApr)}</strong>
              </div>
              <div>
                <span>Term</span>
                <strong>{selectedDualTermDays}D</strong>
              </div>
            </div>

            <div className="wealth-dual-subscribe-field">
              <label className="wealth-dual-subscribe-input">
                <span>Subscription amount</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={allocationAmount}
                  onChange={(event) => setAllocationAmount(Number(event.target.value))}
                  aria-label="Dual Investment PT subscription amount"
                />
              </label>
              <button
                type="button"
                className="wealth-dual-max-btn"
                onClick={() => {
                  setAllocationAmount(String(Math.max(0, roundNumber(availableCash, 2))));
                }}
              >
                Max
              </button>
            </div>
            <div className="wealth-amount-preset-row wealth-dual-amount-preset-row" aria-label="Dual Investment quick PT presets">
              {dualAmountPresetValues.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`ghost-btn compact ${Number(allocationAmount) === preset ? 'active-toggle' : ''}`}
                  onClick={() => setAllocationAmount(preset)}
                  disabled={availableCash > 0 && preset > availableCash}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="wealth-dual-direction-row wealth-dual-receipt-direction-row" aria-label="Dual Investment direction">
              {DUAL_CURRENCY_DIRECTION_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={`receipt-${option.id}`}
                  className={`wealth-dual-direction-chip ${dualCurrencyDirection === option.id ? 'active' : ''}`}
                  onClick={() => {
                    setDualCurrencyDirection(option.id);
                    setDualCurrencyTargetPct(option.id === 'buy-low' ? -4 : 5);
                  }}
                >
                  {option.id === 'buy-low' ? 'Buy low' : 'Sell high'}
                </button>
              ))}
            </div>

            <div className="wealth-dual-pt-settlement-card">
              <div className="product-top">
                <div>
                  <div className="product-title">PT-settled structured receipt</div>
                  <p>
                    All outcomes settle in PT for this demo. PT reward reflects the original dual-currency payoff: premium is paid for accepting target-price conversion risk, while adverse settlement reduces the final PT score.
                  </p>
                </div>
                <span className={`pill ${ptSettlementPreview.outcomeTone}`}>{ptSettlementPreview.outcomeLabel}</span>
              </div>

              <div className="wealth-dual-slider-grid">
                <label className="wealth-field compact">
                  <span>Target price rule: {formatSignedPercent(targetSliderValue, 2)} / {formatPairPrice(ptSettlementPreview.targetPrice)}</span>
                  <input
                    type="range"
                    min={targetSliderMin}
                    max={targetSliderMax}
                    step="0.25"
                    value={targetSliderValue}
                    onChange={(event) => setDualCurrencyTargetPct(Number(event.target.value))}
                  />
                </label>
                <label className="wealth-field compact">
                  <span>Settlement path: {formatSignedPercent(ptSettlementPreview.settlementMovePct, 1)} / {formatPairPrice(ptSettlementPreview.settlementPrice)}</span>
                  <input
                    type="range"
                    min="-18"
                    max="18"
                    step="0.5"
                    value={ptSettlementPreview.settlementMovePct}
                    onChange={(event) => setDualCurrencySettlementMovePct(Number(event.target.value))}
                  />
                </label>
              </div>

              <DualOutcomeSimulator
                pair={activePair}
                direction={dualCurrencyDirection}
                targetPrice={ptSettlementPreview.targetPrice}
                targetPct={targetSliderValue}
                apr={quotedDualApr}
                settlementDays={selectedDualTermDays}
                settlementMovePct={ptSettlementPreview.settlementMovePct}
                onSettlementMoveChange={setDualCurrencySettlementMovePct}
                showSettlementSlider={false}
                className="wealth-dual-receipt-map"
              />

              <div className="wealth-dual-settlement-metrics">
                <div>
                  <span>Target price</span>
                  <strong>{formatPairPrice(ptSettlementPreview.targetPrice)}</strong>
                </div>
                <div>
                  <span>Quoted APR</span>
                  <strong>{formatYieldPercent(quotedDualApr)}</strong>
                </div>
                <div>
                  <span>Base premium x1000</span>
                  <strong className="risk-low">{formatSignedValue(ptSettlementPreview.basePremiumPt, false, 0)}</strong>
                </div>
                <div>
                  <span>Outcome adjustment x1000</span>
                  <strong className={ptSettlementPreview.outcomeAdjustmentPt < 0 ? 'risk-high' : 'risk-low'}>
                    {formatSignedValue(ptSettlementPreview.outcomeAdjustmentPt, false, 0)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  function renderDualInvestmentShelfSection() {
    const dualProducts = liveProducts.filter(isDualInvestmentProduct);
    if (!dualProducts.length) return null;

    const primaryDualProduct = dualProducts[0];
    const directionCards = [
      {
        id: 'buy-low',
        title: 'Buy-low dual',
        offset: '-4%',
        copy: 'Deposit quote asset, earn premium, and accept settlement into the base asset if the target is reached.'
      },
      {
        id: 'sell-high',
        title: 'Sell-high dual',
        offset: '+5%',
        copy: 'Start from the base asset, earn premium, and accept settlement into quote asset if the take-profit target is reached.'
      }
    ];

    return (
      <section className="card wealth-dual-shelf-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">Product shelf / Dual Investment</div>
            <h2>Target-price receipts in two directions</h2>
          </div>
          <span className="pill risk-medium">{dualProducts.length} dual receipts</span>
        </div>

        <div className="wealth-dual-method-grid">
          {directionCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={`wealth-dual-method-card ${dualCurrencyDirection === card.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory('dual');
                setDualCurrencyDirection(card.id);
                setDualCurrencyTargetPct(card.id === 'buy-low' ? -4 : 5);
                focusProduct(primaryDualProduct.id, { topic: 'flow', categoryId: 'dual' });
              }}
            >
              <span>{card.offset} suggested target</span>
              <strong>{card.title}</strong>
              <p>{card.copy}</p>
            </button>
          ))}
        </div>

        <div className="wealth-recommended-strip wealth-dual-product-strip">
          {dualProducts.map((product) => {
            const returnDisplay = getProductReturnMetricDisplay(product);

            return (
              <button
                key={product.id}
                type="button"
                className="wealth-recommended-chip"
                onClick={() => focusProduct(product.id, { topic: 'flow', categoryId: 'dual' })}
              >
                <span>{returnDisplay.metric}</span>
                <strong>{product.name}</strong>
                <em>{returnDisplay.value}</em>
              </button>
            );
          })}
        </div>

        <div className="wealth-dual-action-list" aria-label="Dual Investment detail and lifecycle actions">
          {dualProducts.map((product) => {
            const productPosition = displayWealthState.positions?.[product.id] || { shares: 0, principal: 0 };
            const productReceiptValue = roundNumber(Number(productPosition.shares || 0) * Number(product.nav || 0), 2);
            const hasPosition = Number(productPosition.shares || 0) > 0;

            return (
              <div className="wealth-dual-action-row" key={`${product.id}-actions`}>
                <div>
                  <div className="product-title">{product.shortName || product.name}</div>
                  <div className="muted">
                    {hasPosition
                      ? `${formatShareBalance(productPosition.shares, hideBalances)} ${product.shareToken} / ${formatValue(productReceiptValue, hideBalances)}`
                      : `${product.shareToken} receipt not minted yet`}
                  </div>
                </div>
                <div className="toolbar wealth-action-toolbar">
                  <button className="ghost-btn compact" onClick={() => focusProduct(product.id, { topic: 'flow', categoryId: 'dual' })}>
                    Detail
                  </button>
                  <button
                    className="primary-btn compact"
                    onClick={(event) => handleOpenSubscribeModal(product, event)}
                    disabled={wealthWalletActionPending}
                  >
                    Buy
                  </button>
                  <button className="secondary-btn compact" onClick={() => handlePositionQuickAction(product.id, 'settle')} disabled={!hasPosition}>
                    Settle
                  </button>
                  <button className="ghost-btn compact" onClick={() => handlePositionQuickAction(product.id, 'pledge')} disabled={!hasPosition}>
                    Pledge
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  function renderTimelineDock() {
    if (!timelineDockOpen || timelineDockFloat.isCollapsed) {
      const collapsedStyle =
        timelineDockFloat.arrowSide === 'left'
          ? { top: `${timelineDockFloat.arrowTop}px`, left: '10px', right: 'auto', bottom: 'auto' }
          : { top: `${timelineDockFloat.arrowTop}px`, right: '10px', left: 'auto', bottom: 'auto' };

      return (
        <div
          className={`paper-floating-leaderboard-toggle wealth-floating-timeline-toggle ${timelineDockFloat.arrowSide}`}
          style={collapsedStyle}
          role="button"
          tabIndex={0}
          aria-label="Open portfolio timeline"
          onPointerDown={beginWealthTimelineArrowGesture}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            handleExpandWealthTimeline();
          }}
        >
          <span>Portfolio timeline</span>
        </div>
      );
    }

    return (
      <aside
        className="wealth-floating-timeline wealth-floating-timeline-draggable"
        aria-label="Portfolio timeline simulator"
        style={{
          left: `${timelineDockFloat.left}px`,
          top: `${timelineDockFloat.top}px`,
          right: 'auto',
          bottom: 'auto',
          width: `${timelineDockFloat.width}px`,
          height: `${timelineDockFloat.height}px`
        }}
      >
        <div className="paper-floating-product-leaderboard-head" onPointerDown={beginWealthTimelineDrag}>
          <div>
            <div className="eyebrow">Portfolio timeline</div>
            <h3>Multi-receipt settlement</h3>
          </div>
          <button className="ghost-btn compact paper-floating-product-leaderboard-close" onClick={handleCollapseWealthTimeline}>
            X
          </button>
        </div>

        <div className="paper-floating-product-leaderboard-copy">
          The timeline starts today and projects each receipt with predicted NAV. Product rows are single-click shortcuts into detail; buy, settle, transfer, and pledge stay inside the selected product flow.
        </div>

        <div className="wealth-floating-timeline-body">
          <label className="wealth-field compact">
            Global time jump: {settlementWindowLabel} / suggested {suggestedSettlementDays}D
            <input
              type="range"
              min="0"
              max="730"
              step="30"
              value={settlementDays}
              onChange={(event) => setSettlementDays(Number(event.target.value))}
            />
            <div className="paper-range-suggestion-row">
              <span className="paper-range-suggestion-marker" style={{ left: `${(suggestedSettlementDays / 730) * 100}%` }} />
              <span>Suggested {suggestedSettlementDays}D</span>
            </div>
          </label>

          <div className="paper-floating-auto-sell-presets">
            <button type="button" className="ghost-btn compact" onClick={() => setSettlementDays(suggestedSettlementDays)}>
              Suggested
            </button>
            {[30, 90, 180, 365].map((days) => (
              <button
                key={days}
                type="button"
                className={`ghost-btn compact ${settlementDays === days ? 'active-toggle' : ''}`}
                onClick={() => setSettlementDays(days)}
              >
                {days}D
              </button>
            ))}
          </div>

          <div className="wealth-floating-timeline-list">
            {timelinePreviewRows.map((row) => (
              <div
                key={`${row.id}-${row.previewOnly ? 'preview' : 'owned'}`}
                className={`wealth-floating-timeline-row ${row.lockStatus?.isLocked ? 'locked' : ''} ${row.lockStatus?.isMature ? 'mature' : ''}`.trim()}
                role="button"
                tabIndex={0}
                onClick={() => handleTimelineProductOpen(row.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  handleTimelineProductOpen(row.id);
                }}
              >
                <div>
                  <div className="product-title">{row.previewOnly ? `Preview: ${row.shortName || row.name}` : row.shortName || row.name}</div>
                  <div className="muted">
                    {row.settlementLabel} / predicted NAV {row.projectedNav.toFixed(3)} / free {formatShareBalance(row.freeShares, hideBalances)}
                  </div>
                  <div className={`wealth-timeline-lock-note ${row.lockStatus?.isLocked ? 'risk-medium' : 'risk-low'}`}>
                    {row.lockStatus?.isLocked
                      ? `Locked ${row.lockStatus.daysLeft}D more / early haircut est. ${formatValue(row.earlyHaircutValue, hideBalances)}`
                      : row.lockStatus?.isMature
                        ? 'Maturity reached / next step ready'
                        : 'Flexible settlement window'}
                  </div>
                </div>
                <div className="wealth-leader-move">
                  <strong>{formatValue(row.projectedValue, hideBalances)}</strong>
                  <div className={`wealth-leader-subtext ${row.projectedGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                    {formatSignedValue(row.projectedGain, hideBalances)}
                  </div>
                  <div className="wealth-leader-subtext">Open detail</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </aside>
    );
  }

  function renderCompareSection() {
    return (
      <section className="card wealth-compare-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">Product compare</div>
            <h2>Compare current product paths without squeezing the chart</h2>
          </div>
          <button className="ghost-btn compact" onClick={() => setCompareProductIds(categoryCompareSeedIds)}>
            Use current category set
          </button>
        </div>

        <div className="wealth-compare-toolbar">
          <label>
            <div className="muted">Compare window</div>
            <select value={compareNavPeriod} onChange={(event) => setCompareNavPeriod(event.target.value)}>
              {NAV_PERIOD_OPTIONS.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="muted">Add product</div>
            <select
              value={comparePickerValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setComparePickerValue(nextValue);
                handleAddCompareProduct(nextValue);
              }}
            >
              <option value="">Choose a product</option>
              {liveProducts
                .filter((product) => !compareProductIds.includes(product.id))
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="wealth-compare-chip-row">
          {compareProducts.map((product, index) => (
            <div className="wealth-compare-chip" key={product.id}>
              <button className="ghost-btn compact" onClick={() => handleToggleProduct(product.id)}>
                <span className="wealth-compare-chip-dot" style={{ background: COMPARE_LINE_COLORS[index % COMPARE_LINE_COLORS.length] }}></span>
                {product.shortName || product.name}
              </button>
              <button
                className="ghost-btn compact"
                onClick={() => handleRemoveCompareProduct(product.id)}
                disabled={compareProductIds.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <CompareNavChart seriesList={compareSeriesList} periodLabel={compareWindowLabel} />

        <div className="wealth-compare-legend">
          {compareSeriesList.map((series) => (
            <div className="wealth-compare-legend-item" key={series.id}>
              <div className="wealth-compare-legend-head">
                <span className="wealth-compare-chip-dot" style={{ background: series.color }}></span>
                <strong>{series.name}</strong>
              </div>
              <div className="muted">
                Rebased {series.points[series.points.length - 1]?.value?.toFixed(1) || '100.0'} / NAV {series.latestNav.toFixed(3)} / {series.deltaPercent >= 0 ? '+' : ''}
                {series.deltaPercent.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderPositionsSection() {
    return (
      <section className="card wealth-positions-priority-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">My wealth positions</div>
            <h2>Wallet-linked vault holdings</h2>
          </div>
        </div>

        {portfolioRows.length === 0 ? (
          <div className="reason-card">
            <div className="entry-title">No wealth positions yet</div>
            <div className="entry-copy">
              Buy a product from the shelf below. The position will appear here with settle, roll, and pledge controls.
            </div>
          </div>
        ) : (
          <div className="wealth-portfolio-grid compact">
            {portfolioRows.map((row) => {
              return (
                <button
                  type="button"
                  className="reason-card wealth-position-card wealth-position-card-clickable"
                  key={row.id}
                  onClick={() => handlePositionQuickAction(row.id, 'preview')}
                >
                  <div className="wealth-position-head">
                    <div>
                      <div className="product-title">{row.name}</div>
                      <div className="muted">
                        {row.productType} / {row.shareToken}
                      </div>
                    </div>
                    <span className={`pill ${riskClass(row.risk)}`}>{row.risk}</span>
                  </div>

                  <div className="wealth-position-metric-grid">
                    <div className="wealth-position-metric">
                      <div className="k">Shares</div>
                      <div className="v">{formatShareBalance(row.shares, hideBalances)}</div>
                    </div>
                    <div className="wealth-position-metric">
                      <div className="k">Principal</div>
                      <div className="v">{formatValue(row.principal, hideBalances)}</div>
                    </div>
                    <div className="wealth-position-metric">
                      <div className="k">Current value</div>
                      <div className="v">{formatValue(row.currentValue, hideBalances)}</div>
                    </div>
                    <div className="wealth-position-metric">
                      <div className="k">PnL</div>
                      <div className={`v ${row.pnl >= 0 ? 'risk-low' : 'risk-high'}`}>{formatSignedValue(row.pnl, hideBalances)}</div>
                    </div>
                  </div>

                  <div className="wealth-position-detail-hint">
                    Click once to jump down to this product detail for buy, settle, pledge, and receipt lifecycle controls
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </section>
    );
  }

  function renderDiligenceWorkspace() {
    const report = selectedDiligenceReport;
    if (!report) return null;

    const fitCards = [
      {
        label: 'Product quality',
        value: `${report.productQuality.score}/100`,
        copy: report.productQuality.label
      },
      {
        label: 'Evidence confidence',
        value: `${report.evidenceConfidence.score}/100`,
        copy: `${report.evidenceConfidence.label}: source ${report.evidenceConfidence.sourceQuality}, coverage ${report.evidenceConfidence.coverage}.`
      },
      {
        label: 'Current stance',
        value: selectedResearchView.stance.label,
        tone: selectedResearchView.stance.tone,
        copy: selectedResearchView.stance.summary
      },
      {
        label: 'Wallet fit',
        value: report.suitability.label,
        tone: report.suitability.tone,
        copy: report.suitability.reason
      }
    ];
    const evidenceRows = report.evidenceMatrix.slice(0, 3);
    const leadFlag =
      report.redFlags[0] || {
        title: 'No major blocker surfaced',
        detail: 'The bundled evidence does not currently surface a high-severity blocker.',
        severity: 'low'
      };
    const watchLines = report.whatChanged.slice(0, 2);
    const pages = [
      {
        id: 'fit',
        eyebrow: '01 Wallet fit',
        title: 'Compact suitability snapshot',
        pill: <span className={`pill ${report.suitability.tone}`}>{report.suitability.label}</span>,
        body: (
          <>
            <div className="paper-side-score-grid">
              {fitCards.map((item) => (
                <div className="paper-side-score-card" key={item.label}>
                  <div className="paper-side-score-top">
                    <span>{item.label}</span>
                    <strong className={item.tone || ''}>{item.value}</strong>
                  </div>
                  <div className="paper-side-score-copy">{item.copy}</div>
                </div>
              ))}
            </div>
            <div className="paper-side-score">{selectedResearchView.sourceLine}</div>
          </>
        )
      },
      {
        id: 'evidence',
        eyebrow: '02 Key evidence',
        title: 'What the AI checked first',
        pill: <span className="pill risk-low">{evidenceRows.length || 0} checks</span>,
        body: (
          <>
            {evidenceRows.length ? (
              <div className="paper-asset-list">
                {evidenceRows.map((row) => (
                  <div className="paper-asset-row paper-side-row-wide" key={row.id}>
                    <div className="paper-side-row-title">{row.question}</div>
                    <div className="paper-side-row-meta">
                      <strong>{row.confidence}</strong>
                    </div>
                    <div className="entry-copy paper-side-row-copy">{row.finding}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="paper-side-score">No evidence rows were bundled for this product snapshot yet.</div>
            )}
            <div className="paper-side-score">
              Macro overlay: {selectedResearchView.macroLens.value} / {selectedResearchView.assetLens.value}
            </div>
          </>
        )
      },
      {
        id: 'memo',
        eyebrow: '03 Memo & next watch',
        title: report.memo.title,
        pill: <span className={`pill ${leadFlag.severity === 'high' ? 'risk-high' : leadFlag.severity === 'medium' ? 'risk-medium' : 'risk-low'}`}>{leadFlag.severity}</span>,
        body: (
          <>
            <div className="paper-side-score">AI memo: {report.memo.summary}</div>
            <div className="paper-asset-list">
              <div className="paper-asset-row paper-side-row-wide">
                <div className="paper-side-row-title">{leadFlag.title}</div>
                <div className="paper-side-row-meta">
                  <strong>{leadFlag.severity}</strong>
                </div>
                <div className="entry-copy paper-side-row-copy">{leadFlag.detail}</div>
              </div>
              {watchLines.map((line) => (
                <div className="paper-asset-row paper-side-row-wide" key={line}>
                  <div className="entry-copy paper-side-row-copy">{line}</div>
                </div>
              ))}
            </div>
            <div className="paper-side-score">{day1BriefState.note || selectedDiligenceModel.overlayNote}</div>
          </>
        )
      }
    ];
    const activePage = pages[wealthDiligencePageIndex] || pages[0];
    const canGoBack = wealthDiligencePageIndex > 0;
    const canGoForward = wealthDiligencePageIndex < pages.length - 1;

    return (
      <div className="paper-side-card wealth-diligence-compact-card">
        <div className="paper-side-card-head">
          <div>
            <div className="eyebrow">{activePage.eyebrow}</div>
            <h3>{activePage.title}</h3>
          </div>
          <div className="paper-side-card-toolbar">
            {activePage.pill}
            <div className="paper-side-card-pager" aria-label="Wealth AI diligence pages">
              <button
                type="button"
                className="ghost-btn compact paper-side-card-pager-btn"
                onClick={() => canGoBack && setWealthDiligencePageIndex((current) => Math.max(0, current - 1))}
                disabled={!canGoBack}
                aria-label="Previous wealth AI diligence page"
              >
                {'<'}
              </button>
              <span>
                {wealthDiligencePageIndex + 1} / {pages.length}
              </span>
              <button
                type="button"
                className="ghost-btn compact paper-side-card-pager-btn"
                onClick={() => canGoForward && setWealthDiligencePageIndex((current) => Math.min(pages.length - 1, current + 1))}
                disabled={!canGoForward}
                aria-label="Next wealth AI diligence page"
              >
                {'>'}
              </button>
            </div>
          </div>
        </div>
        <div className="paper-side-card-body">{activePage.body}</div>
      </div>
    );
  }

  function renderFlowDetailSection() {
    const lifecycleGuideCards = [
      {
        title: selectedRedeemAllowed ? 'Settle into PT cash' : 'Hold to scheduled settlement',
        copy: selectedRedeemAllowed
          ? 'Use the settlement desk below with "Settle into PT cash" when you want the free receipt balance to end and return to spendable PT in Wealth.'
          : 'This sleeve does not support a casual early redeem path. The settlement desk below is where the scheduled end, roll, or transfer flow is modeled.'
      },
      {
        title: 'Roll into next term',
        copy: 'Roll means the current receipt settles at the projected NAV and immediately reopens as the same product with a refreshed basis. This is the demo rollover path.'
      },
      {
        title: isCollateralPilotProduct(selectedProduct) ? 'Pledge as route support' : 'Transfer into another sleeve',
        copy: isCollateralPilotProduct(selectedProduct)
          ? 'Pledge locks the receipt and opens a support line that Paper Trading can read for route capacity. It should not inflate Wealth cash or total PT.'
          : 'Transfer settles this receipt first, then records the released value into another product receipt.'
      }
    ];

    return (
      <div className="paper-mode-card wealth-detail-section wealth-action-card">
        <div className="product-top">
          <div>
            <div className="product-title">Receipt lifecycle desk</div>
            <div className="muted">
              Buy the receipt, then handle settlement, rollover, transfer, or pledge in one place instead of jumping between separate explanation panels.
            </div>
          </div>
          <span className={`pill ${riskClass(selectedProduct.risk)}`}>{selectedProduct.risk} risk</span>
        </div>

        {selectedProduct.riskNote ? (
          <div className="wealth-inline-note paper-inline-note">
            <strong>Risk note.</strong> {selectedProduct.riskNote}
          </div>
        ) : null}

        <label className="wealth-field">
          Subscribe amount
          <input
            type="number"
            min={Math.max(WEALTH_MIN_SUBSCRIPTION, selectedProduct.minSubscription)}
            step="100"
            value={allocationAmount}
            onChange={(event) => setAllocationAmount(Number(event.target.value))}
          />
        </label>

        <div className="wealth-amount-preset-row" aria-label="Quick subscribe amount presets">
          {subscriptionAmountPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`ghost-btn compact ${preset.active ? 'active-toggle' : ''}`}
              onClick={() => setAllocationAmount(preset.value)}
              disabled={preset.disabled}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="paper-balance-strip wealth-balance-strip">
          <div className="paper-balance-box">
            <div className="label">Current shares</div>
            <div className="value">{formatShareBalance(selectedPosition.shares, hideBalances)}</div>
          </div>
          <div className="paper-balance-box">
            <div className="label">Value @ timeline</div>
            <div className="value">{formatValue(selectedPositionTimelineValue, hideBalances)}</div>
          </div>
          <div className="paper-balance-box">
            <div className="label">PnL @ timeline</div>
            <div className={`value ${selectedPositionTimelinePnl >= 0 ? 'risk-low' : 'risk-high'}`}>
              {formatSignedValue(selectedPositionTimelinePnl, hideBalances)}
            </div>
          </div>
        </div>

        {isCollateralPilotProduct(selectedProduct) ? (
          <div className="wealth-chart-summary">
            <div>
              <div className="label">Free receipt</div>
              <div className="value">{formatShareBalance(selectedFreeShares, hideBalances)}</div>
            </div>
            <div>
              <div className="label">Pledged shares</div>
              <div className="value">{formatShareBalance(selectedPledgedShares, hideBalances)}</div>
            </div>
            <div>
              <div className="label">Route support</div>
              <div className={`value ${selectedBorrowedAmount > 0 ? 'risk-medium' : 'risk-low'}`}>
                {formatValue(selectedBorrowedAmount, hideBalances)}
              </div>
            </div>
          </div>
        ) : null}

        <div className="wealth-settlement-policy-card">
          <div>
            <div className="eyebrow">Redemption / settlement timing</div>
            <div className="product-title">{selectedSettlementPolicy.timing}</div>
            <div className="muted">{selectedSettlementPolicy.detail}</div>
          </div>
          <span className={`pill ${selectedSettlementPolicy.tone}`}>{selectedSettlementPolicy.label}</span>
        </div>

        <ReceiptLifecycleDiagram product={selectedProduct} compact />

        <div className="toolbar wealth-action-toolbar">
          <button className="primary-btn" onClick={handleOpenSubscribeModal} disabled={selectedProductLocked || wealthWalletActionPending}>
            {wealthWalletActionPending ? 'Await wallet' : 'Review and buy'}
          </button>
        </div>

        <div className="starter-reasons" style={{ marginTop: 16 }}>
          {lifecycleGuideCards.map((item) => (
            <div className="reason-card" key={item.title}>
              <div className="entry-title">{item.title}</div>
              <div className="entry-copy">{item.copy}</div>
            </div>
          ))}
        </div>

        <div className="paper-mode-card wealth-subpanel-card" style={{ marginTop: 16 }}>
          <div className="product-title">Settlement desk: settle, roll, transfer, or preview</div>
          <div className="muted">
            Choose the future window, then decide whether the free receipt balance should stay in the same product, move elsewhere, or end as PT cash.
          </div>

          <label className="wealth-field">
            Days forward: {settlementWindowLabel} / suggested {suggestedSettlementDays}D
            <input
              type="range"
              min="0"
              max="730"
              step="30"
              value={settlementDays}
              onChange={(event) => setSettlementDays(Number(event.target.value))}
            />
            <div className="paper-range-suggestion-row">
              <span className="paper-range-suggestion-marker" style={{ left: `${(suggestedSettlementDays / 730) * 100}%` }} />
              <span>Suggested {suggestedSettlementDays}D</span>
            </div>
          </label>

          <div className="wealth-amount-preset-row compact">
            <button type="button" className="ghost-btn compact" onClick={() => setSettlementDays(suggestedSettlementDays)}>
              Suggested
            </button>
          </div>

          <div className="wealth-compare-toolbar">
            <label>
              <div className="muted">Settlement action</div>
              <select value={settlementAction} onChange={(event) => setSettlementAction(event.target.value)}>
                {SETTLEMENT_ACTION_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div className="muted">Transfer target</div>
              <select
                value={settlementTransferProduct?.id || ''}
                onChange={(event) => setSettlementTransferProductId(event.target.value)}
                disabled={settlementAction !== 'transfer'}
              >
                {settlementTransferProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="wealth-chart-summary">
            <div>
              <div className="label">Projected NAV</div>
              <div className="value">{settlementProjectedNav.toFixed(3)}</div>
            </div>
            <div>
              <div className="label">Free receipt value</div>
              <div className="value">{formatValue(settlementPreviewValue, hideBalances)}</div>
            </div>
            <div>
              <div className="label">Projected gain</div>
              <div className={`value ${settlementPreviewGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                {formatSignedValue(settlementPreviewGain, hideBalances)}
              </div>
            </div>
          </div>

          {settlementAction === 'transfer' ? (
            <div className="wealth-inline-note paper-inline-note">
              Transfer preview: {formatValue(settlementPreviewValue, hideBalances)} would mint about {formatShareBalance(
                settlementTargetShares,
                hideBalances
              )}{' '}
              {settlementTransferProduct?.shareToken} at {settlementTransferProduct?.name}.
            </div>
          ) : (
            <div className="wealth-inline-note paper-inline-note">
              <strong>{settlementActionMeta.label}.</strong> {settlementActionMeta.helper}
            </div>
          )}

          <div className="toolbar">
            <button className="primary-btn" onClick={handleSimulateSettlement} disabled={wealthWalletActionPending || !selectedPosition.shares}>
              {wealthWalletActionPending ? 'Await wallet' : 'Sign settlement action'}
            </button>
          </div>
        </div>

        <div className="product-title" style={{ marginTop: 16 }}>Approve, subscribe, and exit preview</div>
        <FlowPreviewGrid cards={flowPreviewCards} />

        <div className="env-hint">
          <strong>Token mechanic.</strong> {selectedProduct.shareToken} is treated as the receipt record: subscribe creates the record, settlement closes or rolls it, and a pledge only opens route support instead of adding extra Wealth cash.
        </div>

        <div className="wealth-contract-grid" style={{ marginTop: 16 }}>
          {onchainMechanics.map((item) => (
            <div className="reason-card wealth-contract-card" key={item.title}>
              <div className="entry-title">{item.title}</div>
              <div className="entry-copy">{item.copy}</div>
            </div>
          ))}
        </div>

        <div className="wealth-rights-grid" style={{ marginTop: 16 }}>
          <div className="paper-mode-card wealth-subpanel-card">
            <div className="product-title">{selectedProduct.shareToken} rights snapshot</div>
            <div className="starter-reasons">
              {selectedProduct.shareRights.map((line) => (
                <div className="reason-card" key={line}>
                  <div className="entry-copy">{line}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="paper-mode-card wealth-subpanel-card">
            <div className="product-title">Global rights notes</div>
            <div className="starter-reasons">
              {GLOBAL_TOKEN_RIGHTS_NOTES.map((line) => (
                <div className="reason-card" key={line}>
                  <div className="entry-copy">{line}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isCollateralPilotProduct(selectedProduct) ? (
          <div className="wealth-pilot-grid">
            <div className="paper-mode-card wealth-subpanel-card">
              <div className="product-title">Use this receipt as collateral</div>
              <div className="muted">
                Pledge the receipt to open a Paper Trading support line. Flexible support can be released anytime; fixed support uses the same timeline before release.
              </div>

              <div className="wealth-pledge-mode-row" aria-label="Pledge term">
                {[
                  { id: 'flex', label: 'Flexible', copy: 'Release anytime' },
                  { id: 'fixed', label: 'Fixed term', copy: `${selectedPledgeLockStatus.lockDays || 30}D lock via timeline` }
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`wealth-pledge-mode-chip ${pledgeTermMode === option.id ? 'active' : ''}`}
                    onClick={() => setPledgeTermMode(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.copy}</span>
                  </button>
                ))}
              </div>

              <label className="wealth-field compact">
                Support target
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={collateralBorrowInput}
                  onChange={(event) => setCollateralBorrowInput(Number(event.target.value))}
                />
              </label>

              <div className="wealth-chart-summary">
                <div>
                  <div className="label">Collateral value</div>
                  <div className="value">{formatValue(selectedPotentialCollateralValue, hideBalances)}</div>
                </div>
                <div>
                  <div className="label">Max support @ {(selectedCollateralAdvanceRate * 100).toFixed(0)}%</div>
                  <div className="value">{formatValue(selectedPotentialMaxBorrowValue, hideBalances)}</div>
                </div>
                <div>
                  <div className="label">Current LTV</div>
                  <div className={`value ${selectedCollateralLtv >= COLLATERAL_WARNING_LTV ? 'risk-high' : selectedCollateralLtv > 0 ? 'risk-medium' : 'risk-low'}`}>
                    {formatYieldPercent(selectedCollateralLtv, hideBalances)}
                  </div>
                </div>
                <div>
                  <div className="label">Pledge APY</div>
                  <div className="value risk-low">{formatYieldPercent(selectedCollateralApy, hideBalances)}</div>
                </div>
              </div>

              <div className={`wealth-inline-note paper-inline-note ${selectedPledgeLockStatus.isLocked ? 'risk-high' : ''}`}>
                <strong>{selectedPledgeLockStatus.isFixed ? 'Fixed pledge.' : 'Flexible pledge.'}</strong>{' '}
                {selectedPledgeLockStatus.isLocked
                  ? `Timeline has ${selectedPledgeLockStatus.daysLeft}D left before release or redeem can proceed.`
                  : selectedPledgeLockStatus.isMature
                    ? 'Timeline has cleared the fixed pledge window; release is available.'
                    : 'Release can be signed without waiting for the timeline.'}
              </div>

              <div className="toolbar">
                <button className="primary-btn" onClick={handleUseAsCollateral} disabled={wealthWalletActionPending}>
                  {wealthWalletActionPending ? 'Await wallet' : `Open support line on ${selectedProduct.shareToken}`}
                </button>
                <button className="secondary-btn" onClick={handleReleaseCollateral} disabled={wealthWalletActionPending || selectedPledgeLockStatus.isLocked}>
                  Release support
                </button>
              </div>

              <div className="wealth-inline-note paper-inline-note">
                <strong>Wallet path.</strong> Buy PT into this product, mint the receipt, optionally pledge the receipt, let Paper read that support line for route capacity, then release the support before normal settlement if you want the receipt fully free again.
              </div>
            </div>

            <div className="paper-mode-card wealth-subpanel-card">
              <div className="product-title">Collateral guardrails</div>
              <div className="starter-reasons">
                <div className="reason-card">
                  <div className="entry-title">Redeem lock</div>
                  <div className="entry-copy">Pledged shares stay locked until the support line is released, so redemption or settlement only applies to the free balance.</div>
                </div>
                <div className="reason-card">
                  <div className="entry-title">Haircut first</div>
                  <div className="entry-copy">The line size is clipped by the advance rate, and higher LTV should be treated as a warning instead of free capacity.</div>
                </div>
                <div className="reason-card">
                  <div className="entry-title">Support, not new cash</div>
                  <div className="entry-copy">This line is modeled as route support for Paper Trading only, so Wealth PnL and total PT should not jump when it opens.</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {feedback ? <div className="env-hint">{feedback}</div> : null}
      </div>
    );
  }

  function renderSelectedProductDetail() {
    return (
      <div
        className="wealth-expanded-detail"
        data-wealth-product-detail={selectedProduct.id}
        ref={(node) => {
          if (node) {
            productDetailRefs.current.set(selectedProduct.id, node);
          } else {
            productDetailRefs.current.delete(selectedProduct.id);
          }
        }}
      >
        <div className="section-head">
          <div>
            <div className="eyebrow">Selected detail</div>
            <h2>{selectedProduct.name}</h2>
          </div>
        </div>

        <div className="wealth-detail-layout">
          <aside className="wealth-detail-side-rail">
            <div>
              <div className="eyebrow">Selected product</div>
              <div className="product-title">{selectedProduct.shortName || selectedProduct.name}</div>
              <div className="muted">{getDisplayProductTypeLabel(selectedProduct)}</div>
            </div>

            <div className="wealth-detail-side-metrics">
              {!selectedProductIsDual ? (
                <>
                  <div>
                    <span>Latest NAV</span>
                    <strong>{selectedProduct.nav.toFixed(3)}</strong>
                  </div>
                  <div>
                    <span>{selectedReturnMetricDisplay.metric}</span>
                    <strong>{selectedReturnMetricDisplay.value}</strong>
                  </div>
                </>
              ) : null}
              <div>
                <span>Min ticket</span>
                <strong>{formatValue(selectedMinimumTicket, hideBalances)}</strong>
              </div>
              <div>
                <span>Available</span>
                <strong>{formatValue(availableCash, hideBalances)}</strong>
              </div>
            </div>

            <div className="wealth-detail-topic-row wealth-detail-topic-row-side">
              {DETAIL_TOPIC_OPTIONS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={`wealth-detail-topic-chip ${selectedDetailTopics.includes(topic.id) ? 'active' : ''}`}
                  onClick={() => handleDetailTopicChange(topic.id)}
                >
                  {topic.label}
                </button>
              ))}
            </div>

            <div className="wealth-detail-topic-helper compact">
              {activeDetailTopicMeta ? (
                <>
                  <strong>What to do here.</strong> {activeDetailTopicMeta.helper}
                </>
              ) : (
                <>
                  Pick one detail block to focus this product view.
                </>
              )}
            </div>
          </aside>

          <div className="wealth-detail-main-panel">
            {selectedProductLocked ? <div className="wealth-inline-note">{selectedUnlockCopy}</div> : null}

            <div className="wealth-detail-stack">
              {selectedDetailTopics.includes('flow') && isDualInvestmentProduct(selectedProduct) ? renderDualInvestmentOrderBook({ surface: 'detail' }) : null}
          {selectedDetailTopics.includes('snapshot') ? (
            <div className="paper-mode-card wealth-detail-section">
              <div className="route-highlight wealth-detail-banner">
                <strong>{selectedProduct.status}</strong> / {selectedProduct.liveTieIn}
              </div>
              <div className="wealth-market-caption wealth-market-banner">
                {selectedAsOfLabel} / {selectedMarketSource} / {shelfStatusCopy}
              </div>
              <p className="hero-text wealth-detail-copy">{selectedProduct.humanSummary}</p>

              {!selectedProductIsDual ? (
                <div className="wealth-chart-summary">
                  <div>
                    <div className="label">Latest NAV</div>
                    <div className="value wealth-summary-nav-value">
                      <span>{selectedProduct.nav.toFixed(3)}</span>
                      <span className={selectedNavDeltaPercent >= 0 ? 'risk-low' : 'risk-high'}>
                        {selectedNavDeltaPercent >= 0 ? '+' : ''}{selectedNavDeltaPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="label">{selectedReturnMetricDisplay.metric}</div>
                    <div className={`value ${selectedReturnMetricDisplay.tone}`}>
                      {selectedReturnMetricDisplay.value}
                    </div>
                  </div>
                  <div>
                    <div className="label">{getReturnMetricLabels(selectedProduct).basis}</div>
                    <div className="value">{selectedReturnMetricDisplay.basis}</div>
                  </div>
                  <div>
                    <div className="label">Redeem timing</div>
                    <div className={`value ${selectedSettlementPolicy.tone}`}>{selectedSettlementPolicy.label}</div>
                  </div>
                </div>
              ) : null}

              <div className="kv wealth-detail-kv">
                <div>
                  <div className="k">Base asset</div>
                  <span className={`pill wealth-base-risk-pill ${selectedDifficulty.tone}`}>{selectedDifficulty.label}</span>
                  <div className="v">{selectedProduct.baseAsset}</div>
                </div>
                <div>
                  <div className="k">Return source</div>
                  <div className="v">{selectedProduct.yieldSource}</div>
                </div>
                <div>
                  <div className="k">Worst case</div>
                  <div className="v">{selectedProduct.worstCase}</div>
                </div>
                <div>
                  <div className="k">Fees and lock</div>
                  <div className="v">{selectedProduct.fees.management} / {selectedProduct.fees.lockup}</div>
                </div>
                <div>
                  <div className="k">Receipt token</div>
                  <div className="v">{selectedProduct.shareToken} / NAV {selectedProduct.nav.toFixed(3)}</div>
                </div>
              </div>

              <div className="wealth-inline-note paper-inline-note">
                <strong>Yield data source.</strong> {getAnnualYieldSource(selectedProduct)}
              </div>

              {isDualInvestmentProduct(selectedProduct) ? (
                <div className="wealth-inline-note paper-inline-note">
                  <strong>Dual payoff range.</strong> {selectedReturnMetricDisplay.cap}. {selectedReturnMetricDisplay.floor}
                </div>
              ) : null}

              <div className="wealth-chart-summary">
                <div>
                  <div className="label">Base-case gross</div>
                  <div className="value">{tutorialNetPreview.grossValue.toFixed(1)} PT</div>
                </div>
                <div>
                  <div className="label">Fee + route drag</div>
                  <div className="value">{(tutorialNetPreview.feeDrag + tutorialNetPreview.routeDrag).toFixed(1)} PT</div>
                </div>
                <div>
                  <div className="label">Estimated tax</div>
                  <div className="value">{tutorialNetPreview.taxHoldback.toFixed(1)} PT</div>
                </div>
              </div>

              <div className="wealth-inline-note paper-inline-note">
                Tutorial preview only: this net estimate includes management-fee drag, route cost, USDT-to-USD style conversion loss,
                and a simple tax holdback so the user can see what may actually remain in the wallet.
              </div>
            </div>
          ) : null}

          {selectedDetailTopics.includes('nav') ? (
            <div className="paper-mode-card wealth-detail-section wealth-scenario-card">
              <div className="product-title">NAV history and scenario ladder</div>
              <div className="muted">{selectedProduct.scenario.horizon}</div>

              {!selectedProductIsDual ? (
                <>
                  <div className="wealth-chart-summary">
                    <div>
                      <div className="label">Selected NAV window</div>
                      <div className="value">{selectedWindowLabel}</div>
                    </div>
                    <div>
                      <div className="label">1k in window</div>
                      <div className={`value ${selectedTicketGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                        {formatSignedDollar(selectedTicketGain)}
                      </div>
                    </div>
                    <div>
                      <div className="label">Window return</div>
                      <div className={`value ${selectedNavDeltaPercent >= 0 ? 'risk-low' : 'risk-high'}`}>
                        {selectedNavDeltaPercent >= 0 ? '+' : ''}{selectedNavDeltaPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="wealth-period-grid">
                    {selectedPeriodComparisons.map((period) => (
                      <button
                        key={period.id}
                        type="button"
                        className={`wealth-period-card ${period.id === selectedProductNavPeriod ? 'active' : ''}`}
                        onClick={() => handleProductNavPeriodChange(selectedProduct.id, period.id)}
                      >
                        <div className="wealth-period-card-label">{period.label}</div>
                        <div className="wealth-period-card-value">NAV {period.nav.toFixed(3)}</div>
                        <div className={`wealth-period-card-move ${period.ticketGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                          {formatSignedDollar(period.ticketGain)} / {period.deltaPercent >= 0 ? '+' : ''}{period.deltaPercent.toFixed(2)}%
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {selectedDualWindowPreview ? (
                <div className="wealth-dual-window-panel">
                  <div className="wealth-dual-simulator-head">
                    <div>
                      <div className="eyebrow">Dual return window</div>
                      <div className="product-title">
                        {selectedDualProductPair.id} price path + term premium
                      </div>
                    </div>
                    <span className={`pill ${selectedDualWindowPreview.tone}`}>
                      {selectedDualWindowPreview.outcomeLabel}
                    </span>
                  </div>

                  <label className="wealth-field compact wealth-dual-sim-slider">
                    Product price move in {selectedWindowLabel}: {formatSignedPercent(selectedDualWindowPriceMovePct)}
                    <input
                      type="range"
                      min={-selectedDualWindowMoveLimit}
                      max={selectedDualWindowMoveLimit}
                      step="1"
                      value={selectedDualWindowPriceMovePct}
                      onChange={(event) => setDualWindowPriceMovePct(Number(event.target.value))}
                    />
                    <div className="paper-range-suggestion-row">
                      <span className="paper-range-suggestion-marker" style={{ left: `${selectedDualWindowSuggestedMarkerPct}%` }} />
                      <span>Reference move {formatSignedPercent(selectedDualWindowNavMovePct, 1)}</span>
                    </div>
                  </label>

                  <div className="wealth-amount-preset-row compact">
                    <button type="button" className="ghost-btn compact" onClick={() => setDualWindowPriceMovePct(Math.round(selectedDualWindowNavMovePct))}>
                      Use reference move
                    </button>
                    <button type="button" className="ghost-btn compact" onClick={() => setDualWindowPriceMovePct(-Math.round(selectedDualWindowMoveLimit / 2))}>
                      Down range
                    </button>
                    <button type="button" className="ghost-btn compact" onClick={() => setDualWindowPriceMovePct(0)}>
                      Flat
                    </button>
                    <button type="button" className="ghost-btn compact" onClick={() => setDualWindowPriceMovePct(Math.round(selectedDualWindowMoveLimit / 2))}>
                      Up range
                    </button>
                  </div>

                  <div className="wealth-chart-summary compact wealth-dual-window-summary">
                    <div>
                      <div className="label">Receipt NAV leg</div>
                      <div className={`value ${selectedDualWindowPreview.navGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                        {formatSignedValue(selectedDualWindowPreview.navGain, hideBalances)}
                      </div>
                    </div>
                    <div>
                      <div className="label">Term premium</div>
                      <div className="value risk-medium">
                        {formatValue(selectedDualWindowPreview.premiumValue, hideBalances)}
                      </div>
                    </div>
                    <div>
                      <div className="label">Final return</div>
                      <div className={`value ${selectedDualWindowPreview.tone}`}>
                        {formatSignedValue(selectedDualWindowPreview.pnl, hideBalances)}
                      </div>
                    </div>
                  </div>

                  <div className="wealth-dual-flow-grid">
                    <div className="reason-card">
                      <div className="entry-title">NAV sets receipt value</div>
                      <div className="entry-copy">
                        Buy at NAV {selectedDualWindowPreview.startNav.toFixed(3)} and mark at {selectedDualWindowPreview.endNav.toFixed(3)} before the target-price rule resolves.
                      </div>
                    </div>
                    <div className="reason-card">
                      <div className="entry-title">Price decides payout asset</div>
                      <div className="entry-copy">
                        {selectedDualWindowPreview.directionLabel} target {selectedDualWindowPreview.targetPrice.toLocaleString()} / simulated price {selectedDualWindowPreview.settlementPrice.toLocaleString()}.
                      </div>
                    </div>
                    <div className="reason-card">
                      <div className="entry-title">Wallet result</div>
                      <div className="entry-copy">
                        Ends as {hideBalances ? '---' : selectedDualWindowPreview.settlementAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {selectedDualWindowPreview.settlementAsset}, worth {formatValue(selectedDualWindowPreview.quoteEquivalent, hideBalances)} or {formatSignedPercent(selectedDualWindowPreview.returnPct, 2)}.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {!selectedProductIsDual ? <DetailNavChart series={selectedNavPoints} /> : null}

              {isCollateralPilotProduct(selectedProduct) ? (
                <div className="wealth-pilot-grid">
                  <div className="paper-mode-card wealth-subpanel-card">
                    <div className="product-title">Fast-forward demo</div>
                    <div className="muted">
                      {isDualInvestmentProduct(selectedProduct)
                        ? 'Instead of waiting for observation, jump forward and inspect the capped premium plus the no-fixed-floor conversion risk.'
                        : 'Instead of waiting days, jump forward and inspect what this receipt could look like if the displayed annual yield carries forward.'}
                    </div>

                    <div className="wealth-nav-period-strip compact">
                      {FAST_FORWARD_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`wealth-nav-chip compact ${fastForwardTarget === option.id ? 'active' : ''}`}
                          onClick={() => setFastForwardTarget(option.id)}
                        >
                          <span>Time jump</span>
                          <strong>{option.label}</strong>
                        </button>
                      ))}
                    </div>

                    <div className="wealth-chart-summary">
                      <div>
                        <div className="label">Simulated ticket</div>
                        <div className="value">{formatValue(simulatedTicketAmount, hideBalances)}</div>
                      </div>
                      <div>
                        <div className="label">Projected NAV</div>
                        <div className="value">{fastForwardProjectedNav.toFixed(3)}</div>
                      </div>
                      <div>
                        <div className="label">Projected redeem value</div>
                        <div className={`value ${fastForwardProjectedGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                          {formatValue(fastForwardProjectedValue, hideBalances)}
                        </div>
                      </div>
                    </div>

                    <div className="wealth-inline-note paper-inline-note">
                      <strong>{selectedFastForwardOption.label} preview.</strong> {selectedFastForwardOption.description}{' '}
                      {isDualInvestmentProduct(selectedProduct)
                        ? `Dual Investment should be read as ${selectedReturnMetricDisplay.basis}, with no fixed lower bound if settlement converts into the less desired asset.`
                        : 'This uses the displayed annual yield for a fast demo path, so the point is to visualize carry without forcing the judge to wait.'}
                    </div>
                  </div>

                  {!selectedProductIsDual ? (
                    <div className="paper-mode-card wealth-subpanel-card">
                      <div className="product-title">Historical buy-at-start replay</div>
                      <div className="muted">
                        Use the selected NAV window as a replay: buy at the first point in the window, then see what the same receipt would be worth at the last point.
                      </div>

                      <div className="wealth-chart-summary">
                        <div>
                          <div className="label">{selectedWindowLabel} start NAV</div>
                          <div className="value">{historicalReplayStartNav.toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="label">{selectedWindowLabel} end NAV</div>
                          <div className="value">{historicalReplayEndNav.toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="label">Replay end value</div>
                          <div className={`value ${historicalReplayGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                            {formatValue(historicalReplayValue, hideBalances)}
                          </div>
                        </div>
                      </div>

                      <div className="wealth-inline-note paper-inline-note">
                        <strong>Replay math.</strong> Buy {formatValue(simulatedTicketAmount, hideBalances)} at NAV {historicalReplayStartNav.toFixed(3)}, mint {formatShareBalance(
                          historicalReplayShares,
                          hideBalances
                        )} {selectedProduct.shareToken}, and mark it at {historicalReplayEndNav.toFixed(3)} to get {formatSignedValue(historicalReplayGain, hideBalances)}.
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="wealth-scenario-grid">
                <div className="reason-card">
                  <div className="entry-title">Conservative</div>
                  <div className="entry-copy">{selectedProduct.scenario.conservative}</div>
                </div>
                <div className="reason-card">
                  <div className="entry-title">Base</div>
                  <div className="entry-copy">{selectedProduct.scenario.base}</div>
                </div>
                <div className="reason-card">
                  <div className="entry-title">Pressure</div>
                  <div className="entry-copy">{selectedProduct.scenario.pressure}</div>
                </div>
              </div>
            </div>
          ) : null}

          {selectedDetailTopics.includes('subscription') ? (
            <div className="paper-mode-card wealth-detail-section">
              <div className="product-title">Subscription, suitability and access</div>
              <div className="kv wealth-detail-kv">
                <div>
                  <div className="k">Minimum ticket</div>
                  <div className="v">{selectedMinimumTicket.toLocaleString()} PT</div>
                </div>
                <div>
                  <div className="k">Preview shares</div>
                  <div className="v">{formatShareBalance(estimatedShares, hideBalances)} {selectedProduct.shareToken}</div>
                </div>
                <div>
                  <div className="k">Wallet cash</div>
                  <div className="v">{formatValue(availableCash, hideBalances)}</div>
                </div>
                <div>
                  <div className="k">Settlement path</div>
                  <div className="v">{selectedProduct.redemption}</div>
                </div>
              </div>

              <div className="wealth-checklist" style={{ marginTop: 16 }}>
                {accessChecklist.map((item) => (
                  <div className="wealth-check-row compact" key={item.label}>
                    <span className={`wealth-check-badge ${item.done ? 'done' : 'todo'}`}>{item.done ? 'Ready' : 'Pending'}</span>
                    <div>
                      <div className="entry-title">{item.label}</div>
                      <div className="entry-copy">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedDetailTopics.includes('routing') ? (
            <div className="paper-mode-card wealth-detail-section">
              <div className="product-title">Why it earns, what users worry about, and lifecycle</div>
              <div className="starter-reasons">
                <div className="reason-card">
                  <div className="entry-title">Funding rail</div>
                  <div className="entry-copy">{selectedProduct.baseAsset}</div>
                </div>
                <div className="reason-card">
                  <div className="entry-title">Why it earns</div>
                  <div className="entry-copy">{selectedInsight.whyEarns}</div>
                </div>
                <div className="reason-card">
                  <div className="entry-title">What users worry about</div>
                  <div className="entry-copy">{selectedInsight.worryCopy}</div>
                </div>
              </div>

              <div className="starter-reasons" style={{ marginTop: 16 }}>
                {lifecycleNotes.map((note) => (
                  <div className="reason-card" key={note}>
                    <div className="entry-copy">{note}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedDetailTopics.includes('holdings') ? (
            <div className="paper-mode-card wealth-detail-section wealth-scenario-card">
              <div className="product-title">Top look-through holdings and fee stack</div>
              <div className="paper-asset-list">
                {selectedInsight.holdings.map((holding) => (
                  <div className="paper-asset-row" key={holding.name}>
                    <div>
                      <div className="entry-title">{holding.name}</div>
                      <div className="entry-copy">Underlying sleeve exposure inside the product.</div>
                    </div>
                    <strong>{holding.weight}</strong>
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
            </div>
          ) : null}

          {selectedDetailTopics.includes('flow') ? (
            <div className="paper-mode-card wealth-detail-section wealth-action-card">
              <div className="product-top">
                <div>
                  <div className="product-title">Buy, hold, and exit flow</div>
                  <div className="muted">
                    Start with the amount, review the buy preview, then follow the exact exit path this product allows. Open-ended sleeves can redeem later; closed-ended sleeves wait for maturity.
                  </div>
                </div>
                <span className={`pill ${riskClass(selectedProduct.risk)}`}>{selectedProduct.risk} risk</span>
              </div>

              {selectedProduct.riskNote ? (
                <div className="wealth-inline-note paper-inline-note">
                  <strong>Risk note.</strong> {selectedProduct.riskNote}
                </div>
              ) : null}

              {renderWealthDeskDisclosure({
                title: 'Buy / hold',
                subtitle: 'Set the PT amount, check the receipt preview, then use the single buy action below.',
                badge: 'Buy',
                children: (
                  <>
                    <label className="wealth-field">
                      Subscribe amount
                      <input
                        type="number"
                        min={Math.max(WEALTH_MIN_SUBSCRIPTION, selectedProduct.minSubscription)}
                        step="100"
                        value={allocationAmount}
                        onChange={(event) => setAllocationAmount(Number(event.target.value))}
                      />
                    </label>
                    {subscriptionAmountWarning ? (
                      <div className="wealth-inline-note paper-inline-note risk-medium">
                        <strong>Amount check.</strong> {subscriptionAmountWarning}
                      </div>
                    ) : null}

                    <div className="wealth-amount-preset-row" aria-label="Quick subscribe amount presets">
                      {subscriptionAmountPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`ghost-btn compact ${preset.active ? 'active-toggle' : ''}`}
                          onClick={() => setAllocationAmount(preset.value)}
                          disabled={preset.disabled}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="paper-balance-strip wealth-balance-strip">
                      <div className="paper-balance-box">
                        <div className="label">Current shares</div>
                        <div className="value">{formatShareBalance(selectedPosition.shares, hideBalances)}</div>
                      </div>
                      <div className="paper-balance-box">
                        <div className="label">Value @ predicted NAV</div>
                        <div className="value">{formatValue(selectedPositionTimelineValue, hideBalances)}</div>
                      </div>
                      <div className="paper-balance-box">
                        <div className="label">PnL @ predicted NAV</div>
                        <div className={`value ${selectedPositionTimelinePnl >= 0 ? 'risk-low' : 'risk-high'}`}>
                          {formatSignedValue(selectedPositionTimelinePnl, hideBalances)}
                        </div>
                      </div>
                    </div>

                    {isCollateralPilotProduct(selectedProduct) ? (
                      <div className="wealth-chart-summary">
                        <div>
                          <div className="label">Free to redeem</div>
                          <div className="value">{formatShareBalance(selectedFreeShares, hideBalances)}</div>
                        </div>
                        <div>
                          <div className="label">Pledged shares</div>
                          <div className="value">{formatShareBalance(selectedPledgedShares, hideBalances)}</div>
                        </div>
                        <div>
                          <div className="label">Route support</div>
                          <div className={`value ${selectedBorrowedAmount > 0 ? 'risk-medium' : 'risk-low'}`}>
                            {formatValue(selectedBorrowedAmount, hideBalances)}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="wealth-settlement-policy-card">
                      <div>
                        <div className="eyebrow">Redemption / settlement timing</div>
                        <div className="product-title">{selectedSettlementPolicy.timing}</div>
                        <div className="muted">{selectedSettlementPolicy.detail}</div>
                      </div>
                      <span className={`pill ${selectedSettlementPolicy.tone}`}>{selectedSettlementPolicy.label}</span>
                    </div>

                    <div className="toolbar wealth-action-toolbar">
                      <button className="primary-btn" onClick={() => handleOpenSubscribeModal()} disabled={selectedProductLocked || wealthWalletActionPending}>
                        {wealthWalletActionPending ? 'Await wallet' : 'Review and buy'}
                      </button>
                      <button className="ghost-btn compact" onClick={handleResetPortfolio} disabled={wealthWalletActionPending}>
                        Reset
                      </button>
                    </div>
                  </>
                )
              })}

              {renderWealthDeskDisclosure({
                title: 'Settlement desk',
                subtitle: 'Choose the future window, then settle, roll, transfer, or preview the receipt.',
                badge: settlementWindowLabel,
                children: (
                  <>

                <div className="wealth-timeline-date-card">
                  <span>Settlement timeline</span>
                  <strong>{settlementWindowLabel}</strong>
                  <em>{settlementPredictionCopy}</em>
                </div>

                <div className="wealth-amount-preset-row compact" aria-label="Settlement timeline presets">
                  <button
                    type="button"
                    className={`ghost-btn compact ${settlementDaysNumber === 0 ? 'active-toggle' : ''}`}
                    onClick={() => setSettlementDays(0)}
                  >
                    Today
                  </button>
                  <button type="button" className="ghost-btn compact" onClick={() => setSettlementDays(suggestedSettlementDays)}>
                    Suggested {suggestedSettlementDays}D
                  </button>
                  {[30, 90, 180, 365].map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={`ghost-btn compact ${settlementDaysNumber === days ? 'active-toggle' : ''}`}
                      onClick={() => setSettlementDays(days)}
                    >
                      {days}D
                    </button>
                  ))}
                </div>

                <div className="wealth-compare-toolbar">
                  <label>
                    <div className="muted">Settlement action</div>
                    <select value={settlementAction} onChange={(event) => setSettlementAction(event.target.value)}>
                      {SETTLEMENT_ACTION_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <div className="muted">Transfer target</div>
                    <select
                      value={settlementTransferProduct?.id || ''}
                      onChange={(event) => setSettlementTransferProductId(event.target.value)}
                      disabled={settlementAction !== 'transfer'}
                    >
                      {settlementTransferProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="wealth-chart-summary">
                  <div>
                    <div className="label">Predicted NAV</div>
                    <div className="value">{settlementProjectedNav.toFixed(3)}</div>
                  </div>
                  <div>
                    <div className="label">Value @ predicted NAV</div>
                    <div className="value">{formatValue(settlementPreviewValue, hideBalances)}</div>
                  </div>
                  <div>
                    <div className="label">Projected gain</div>
                    <div className={`value ${settlementPreviewGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                      {formatSignedValue(settlementPreviewGain, hideBalances)}
                    </div>
                  </div>
                </div>

                {settlementAction === 'transfer' ? (
                  <div className="wealth-inline-note paper-inline-note">
                    Transfer preview: {formatValue(settlementPreviewValue, hideBalances)} would mint about {formatShareBalance(
                      settlementTargetShares,
                      hideBalances
                    )} {settlementTransferProduct?.shareToken} at {settlementTransferProduct?.name}.
                  </div>
                ) : (
                  <div className="wealth-inline-note paper-inline-note">
                    <strong>{settlementActionMeta.label}.</strong> {settlementActionMeta.helper}
                  </div>
                )}

                <div className="toolbar">
                  <button className="primary-btn" onClick={handleSimulateSettlement} disabled={wealthWalletActionPending || !selectedPosition.shares}>
                    {wealthWalletActionPending ? 'Await wallet' : 'Sign settlement action'}
                  </button>
                </div>
                  </>
                )
              })}

              {isCollateralPilotProduct(selectedProduct) ? (
                renderWealthDeskDisclosure({
                  title: 'Pledge support',
                  subtitle: 'Flexible support can release anytime. Fixed support uses the same timeline before release.',
                  badge: pledgeTermMode === 'fixed' ? 'Fixed' : 'Flexible',
                  children: (
                    <>

                  <div className="wealth-pledge-mode-row" aria-label="Pledge term">
                    {[
                      { id: 'flex', label: 'Flexible', copy: 'Release anytime' },
                      { id: 'fixed', label: 'Fixed term', copy: `${selectedPledgeLockStatus.lockDays || 30}D lock via timeline` }
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`wealth-pledge-mode-chip ${pledgeTermMode === option.id ? 'active' : ''}`}
                        onClick={() => setPledgeTermMode(option.id)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.copy}</span>
                      </button>
                    ))}
                  </div>

                  <label className="wealth-field compact">
                    Support target
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={collateralBorrowInput}
                      onChange={(event) => setCollateralBorrowInput(Number(event.target.value))}
                    />
                  </label>

                  <div className="wealth-chart-summary">
                    <div>
                      <div className="label">Collateral value</div>
                      <div className="value">{formatValue(selectedPotentialCollateralValue, hideBalances)}</div>
                    </div>
                    <div>
                      <div className="label">Max borrow @ {(selectedCollateralAdvanceRate * 100).toFixed(0)}%</div>
                      <div className="value">{formatValue(selectedPotentialMaxBorrowValue, hideBalances)}</div>
                    </div>
                    <div>
                      <div className="label">Current LTV</div>
                      <div className={`value ${selectedCollateralLtv >= COLLATERAL_WARNING_LTV ? 'risk-high' : selectedCollateralLtv > 0 ? 'risk-medium' : 'risk-low'}`}>
                        {formatYieldPercent(selectedCollateralLtv, hideBalances)}
                      </div>
                    </div>
                    <div>
                      <div className="label">Pledge APY</div>
                      <div className="value risk-low">{formatYieldPercent(selectedCollateralApy, hideBalances)}</div>
                    </div>
                  </div>

                  <div className={`wealth-inline-note paper-inline-note ${selectedPledgeLockStatus.isLocked ? 'risk-high' : ''}`}>
                    <strong>{selectedPledgeLockStatus.isFixed ? 'Fixed pledge.' : 'Flexible pledge.'}</strong>{' '}
                    {selectedPledgeLockStatus.isLocked
                      ? `Timeline has ${selectedPledgeLockStatus.daysLeft}D left before release or redeem can proceed.`
                      : selectedPledgeLockStatus.isMature
                        ? 'Timeline has cleared the fixed pledge window; release is available.'
                        : 'Release can be signed without waiting for the timeline.'}
                  </div>

                  <div className="toolbar">
                    <button className="primary-btn" onClick={handleUseAsCollateral} disabled={wealthWalletActionPending}>
                      {wealthWalletActionPending ? 'Await wallet' : `Open support line on ${selectedProduct.shareToken}`}
                    </button>
                    <button className="secondary-btn" onClick={handleReleaseCollateral} disabled={wealthWalletActionPending || selectedPledgeLockStatus.isLocked}>
                      Release support
                    </button>
                  </div>
                    </>
                  )
                })
              ) : null}

              {feedback ? <div className="env-hint">{feedback}</div> : null}
            </div>
          ) : null}

          {selectedDetailTopics.includes('onchain') ? (
            <div className="paper-mode-card wealth-detail-section">
              <div className="product-top">
                <div>
                  <div className="eyebrow">Onchain Vault View</div>
                  <div className="product-title">Keeper status, attestation freshness, and wallet gate</div>
                  <div className="muted">
                    The research layer stays offchain, while the receipt vault surface anchors keeper state and wallet-specific access onchain.
                  </div>
                </div>
                <div className="wealth-header-pill-row">
                  <span className={`pill ${wealthVaultSnapshot.attestationTone}`}>{wealthVaultSnapshot.attestationStatus}</span>
                  <span className={`pill ${wealthVaultSnapshot.subscriptionsPaused ? 'risk-high' : 'risk-low'}`}>
                    {wealthVaultSnapshot.subscriptionsPaused ? 'Subscriptions paused' : 'Subscriptions open'}
                  </span>
                </div>
              </div>

              <OnchainVaultGrid snapshot={wealthVaultSnapshot} product={selectedProduct} />

              <div className="wealth-inline-note" style={{ marginTop: 16 }}>
                <strong>Verification boundary.</strong> Product explainability, AI research, and macro overlays stay offchain; keeper-updated NAV ratio, attestation freshness, and wallet eligibility can be verified from one vault contract.
              </div>
            </div>
          ) : null}

          {selectedDetailTopics.includes('diligence') ? (
            <div className="paper-mode-card wealth-detail-section wealth-diligence-summary-only">
              <div className="product-top">
                <div>
                  <div className="eyebrow">AI Risk + Research View</div>
                  <div className="product-title">AI diligence snapshot</div>
                  <div className="muted">
                    The compact pager below keeps the fit, key evidence, and memo in one place instead of listing every internal rubric row at once.
                  </div>
                </div>
                <div className="wealth-header-pill-row">
                  <span className={`pill ${selectedResearchView.stance.tone}`}>{selectedResearchView.stance.label}</span>
                  <span className="pill risk-low">Display score {selectedDiligenceModel.finalScore}/100</span>
                </div>
              </div>

              {renderDiligenceWorkspace()}

              <div className="wealth-judge-grid">
                <div className="guide-chip">
                  <div className="k">Product quality</div>
                  <div className="v">{selectedDiligenceModel.baseScore}/100</div>
                  <div className="muted">Evidence-backed product checks across ten diligence dimensions.</div>
                </div>
                <div className="guide-chip">
                  <div className="k">Current stance</div>
                  <div className={`v ${selectedResearchView.stance.tone}`}>{selectedResearchView.stance.label}</div>
                  <div className="muted">{selectedResearchView.stance.summary}</div>
                </div>
                <div className="guide-chip">
                  <div className="k">{selectedResearchView.macroLens.label}</div>
                  <div className={`v ${selectedResearchView.macroLens.impact >= 0 ? 'risk-low' : 'risk-high'}`}>
                    {selectedResearchView.macroLens.value}
                  </div>
                  <div className="muted">{selectedResearchView.macroLens.detail}</div>
                </div>
                <div className="guide-chip">
                  <div className="k">{selectedResearchView.assetLens.label}</div>
                  <div className={`v ${selectedResearchView.assetLens.impact >= 0 ? 'risk-low' : 'risk-high'}`}>
                    {selectedResearchView.assetLens.value}
                  </div>
                  <div className="muted">{selectedResearchView.assetLens.detail}</div>
                </div>
                <div className="guide-chip">
                  <div className="k">Day1 overlay</div>
                  <div className={`v ${selectedDiligenceModel.signalAdjustment >= 0 ? 'risk-low' : 'risk-high'}`}>
                    {formatSignedScore(selectedDiligenceModel.signalAdjustment)}
                  </div>
                  <div className="muted">{day1BriefState.sourceLabel || 'No external source loaded'} / {day1Timestamp}</div>
                </div>
                <div className="guide-chip">
                  <div className="k">Receipt-token principle</div>
                  <div className="v">{selectedProduct.shareToken}</div>
                  <div className="muted">Tokenized ownership should explain rights, cash flow, and lifecycle, not just render a wallet balance.</div>
                </div>
              </div>

              <div className="wealth-detail-grid" style={{ marginTop: 16 }}>
                <div className="paper-mode-card wealth-subpanel-card">
                  <div className="product-title">Research summary</div>
                  <div className="entry-copy">{selectedResearchView.stance.summary}</div>
                  <div className="wealth-inline-note paper-inline-note" style={{ marginTop: 16 }}>
                    {selectedResearchView.sourceLine}
                  </div>
                </div>

                <div className="paper-mode-card wealth-subpanel-card">
                  <div className="product-title">What would change the view</div>
                  <div className="starter-reasons">
                    {selectedResearchView.changeItems.map((line) => (
                      <div className="reason-card" key={line}>
                        <div className="entry-copy">{line}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="wealth-detail-grid" style={{ marginTop: 16 }}>
                <div className="paper-mode-card wealth-subpanel-card">
                  <div className="product-title">What the AI is watching</div>
                  <div className="starter-reasons">
                    {selectedResearchView.watchItems.map((line) => (
                      <div className="reason-card" key={line}>
                        <div className="entry-copy">{line}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="paper-mode-card wealth-subpanel-card">
                  <div className="product-title">Signal-to-stance bridge</div>
                  <div className="starter-reasons">
                    <div className="reason-card">
                      <div className="entry-title">Rubric first</div>
                      <div className="entry-copy">Underlying, structure, compliance, and liquidity still set the base conviction.</div>
                    </div>
                    <div className="reason-card">
                      <div className="entry-title">Overlay second</div>
                      <div className="entry-copy">Macro liquidity and asset-specific heat adjust the stance, but do not replace product diligence.</div>
                    </div>
                    <div className="reason-card">
                      <div className="entry-title">Action output</div>
                      <div className="entry-copy">The final label is a research stance for sizing and timing, not a promise of return.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="wealth-rights-grid" style={{ marginTop: 16 }}>
                {selectedDiligenceModel.breakdown.map((item) => (
                  <div className="wealth-signal-row" key={item.label}>
                    <div className="product-top">
                      <div>
                        <div className="product-title">{item.title}</div>
                        <div className="muted">{item.detail}</div>
                      </div>
                      <span className={`pill ${item.status === 'Pass' ? 'risk-low' : 'risk-medium'}`}>{item.status}</span>
                    </div>
                    <div className="wealth-judge-mini">
                      <span>Weight {item.weight}</span>
                      <strong>{item.weightedPoints} pts</strong>
                    </div>
                  </div>
                ))}
              </div>

              <div className="wealth-rights-grid" style={{ marginTop: 16 }}>
                {selectedDiligenceModel.signalRows.map((item) => (
                  <div className="wealth-signal-row" key={item.label}>
                    <div className="product-top">
                      <div>
                        <div className="product-title">{item.label}</div>
                        <div className="muted">{item.detail}</div>
                      </div>
                      <span className={`pill ${item.impact >= 0 ? 'risk-low' : 'risk-medium'}`}>{formatSignedScore(item.impact)}</span>
                    </div>
                    <div className="wealth-judge-mini">
                      <span>Observed</span>
                      <strong>{item.value}</strong>
                    </div>
                  </div>
                ))}
              </div>

              <div className="wealth-inline-note paper-inline-note" style={{ marginTop: 16 }}>
                {day1BriefState.note || selectedDiligenceModel.overlayNote}
              </div>
            </div>
          ) : null}

          {selectedDetailTopics.length === 0 ? (
            <div className="wealth-inline-note">Pick one focus chip above when you want to reopen a guided section.</div>
          ) : null}
            </div>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="noise"></div>
      <header className="site-header">
        <div className="brand-wrap">
          <div className="brand-dot"></div>
          <div>
            <div className="eyebrow">RiskLens Guided Investing Hub</div>
            <div className="brand-name">{t('RiskLens Wealth Hub', 'RiskLens Wealth Hub')}</div>
          </div>
        </div>

        <div className="wealth-header-language-center">
          <LanguageToggle uiLanguage={uiLanguage} setUiLanguage={setUiLanguage} compact />
        </div>

        <div className="header-actions">
          <a className="ghost-btn compact" href="./index.html#wealth">
            {t('Back to welcome', '\u8fd4\u56de\u6b22\u8fce\u9875')}
          </a>

          <div className="paper-token-pill wealth-pill">
            <div className="paper-token-label">{t('Remaining paper tokens', '\u5269\u4f59\u7eb8\u9762\u4ee3\u5e01')}</div>
            <div className="paper-token-value">{formatValue(remainingPaperTokens, hideBalances)}</div>
            <div className="paper-token-tooltip">
              <div className="paper-token-tooltip-title">{t('How this works', '\u8bf4\u660e')}</div>
              <div>
                {t(
                  `Demo wealth cash starts at ${WEALTH_STARTING_CASH.toLocaleString()} PT. Each completed onboarding milestone adds ${WEALTH_MILESTONE_BONUS.toLocaleString()} PT of preview buying power.`,
                  `\u6f14\u793a Wealth \u73b0\u91d1\u521d\u59cb\u4e3a ${WEALTH_STARTING_CASH.toLocaleString()} PT\u3002\u6bcf\u5b8c\u6210\u4e00\u4e2a onboarding \u91cc\u7a0b\u7891\uff0c\u4f1a\u589e\u52a0 ${WEALTH_MILESTONE_BONUS.toLocaleString()} PT \u7684\u9884\u89c8\u8d2d\u4e70\u529b\u3002`
                )}
              </div>
              <div>
                Unified wallet memory: paper cash {walletProfileSummary.paperCash.toLocaleString()} PT,
                wealth cash {walletProfileSummary.wealthCash.toLocaleString()} PT,
                remaining PT {walletProfileSummary.remainingPT.toLocaleString()} PT.
              </div>
            </div>
          </div>

          <button className="secondary-btn compact wealth-reset-top-btn" onClick={handleResetPortfolio}>
            Reset wealth demo
          </button>

          <button className={`ghost-btn wallet-header-btn ${isConnected ? 'connected' : ''}`.trim()} onClick={() => setWalletModalOpen(true)} disabled={isPending}>
            {isConnected
              ? t(`Wallet connected ${walletDisplayName}`, `闂傚倷娴囧Λ鍕暦椤掑倵鍋撻崹顐€顏堫敊韫囨稒鍤戦柛鎾茶兌椤旀洟姊?${walletDisplayName}`)
              : isPending
                ? t('Connecting to MetaMask...', '婵犳鍠楃换鎰緤閽樺鑰挎い蹇撴噺娴溿倝鏌ｉ幇顓熺稇濠?MetaMask...')
                : t('Connect MetaMask', '闂佸搫顦弲婵嬪磻閻愬灚鏆?MetaMask')}
          </button>

          <div className="header-admin-row">
            <button className="ghost-btn compact" onClick={openDeveloperMode}>
              {t('Developer mode', '\u5f00\u53d1\u8005\u6a21\u5f0f')}
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
              <div className="eyebrow">{t('Goal-first wealth', 'Goal-first wealth')}</div>
              <h1 style={{ maxWidth: 980 }}>{t('Build a clearer RWA and wealth shelf before asking users to trade.', 'Build a clearer RWA and wealth shelf before asking users to trade.')}</h1>
            </div>

            <button className="ghost-btn compact" onClick={() => setHideBalances((current) => !current)}>
              {hideBalances ? t('Show values', 'Show values') : t('Hide values', 'Hide values')}
            </button>
          </div>

          <div className="wealth-summary-grid">
            <div className="wealth-summary-block">
              <div className="label">{t('Total invested', 'Total invested')}</div>
              <div className="wealth-summary-value">{formatValue(totalInvested, hideBalances)}</div>
              <div className="muted">Approx. {formatValue(totalInvested, hideBalances, 0, ' PT')}</div>
              <div className="wealth-summary-mini">
                <div className="wealth-summary-mini-row">
                  <span>Term sleeves</span>
                  <strong>{formatValue(closedEndedValue, hideBalances, 0, ' PT')}</strong>
                </div>
                <div className="wealth-summary-mini-row">
                  <span>Flexible sleeves</span>
                  <strong>{formatValue(openEndedValue, hideBalances, 0, ' PT')}</strong>
                </div>
              </div>
            </div>

            <div className="wealth-summary-block">
              <div className="label">{t('Total return', 'Total return')}</div>
              <div className={`wealth-summary-value ${totalYield >= 0 ? 'risk-low' : 'risk-high'}`}>
                {formatSignedValue(totalYield, hideBalances)}
              </div>
              <div className="muted">Share-token NAV minus principal deployed.</div>
              <div className="wealth-summary-mini">
                <div className="wealth-summary-mini-row">
                  <span>Strategy sleeves</span>
                  <strong>{formatValue(strategyValue, hideBalances, 0, ' PT')}</strong>
                </div>
                <div className="wealth-summary-mini-row">
                  <span>Term sleeves</span>
                  <strong>{formatValue(closedEndedValue, hideBalances, 0, ' PT')}</strong>
                </div>
              </div>
            </div>

            <div className="wealth-summary-block">
              <div className="label">{t('Portfolio annual yield', 'Portfolio annual yield')}</div>
              <div className={`wealth-summary-value ${portfolioAnnualYieldRate >= 0 ? 'risk-low' : 'risk-high'}`}>
                {formatYieldPercent(portfolioAnnualYieldRate, hideBalances)}
              </div>
              <div className="muted">Weighted by current sleeve value and each product&apos;s displayed annual-yield basis.</div>
              <div className="wealth-summary-mini">
                <div className="wealth-summary-mini-row">
                  <span>Wallet milestones</span>
                  <strong>{milestoneCount} unlocked</strong>
                </div>
                <div className="wealth-summary-mini-row">
                  <span>Bonus buying power</span>
                  <strong>{formatValue(milestoneBonus, hideBalances, 0, ' PT')}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card wealth-task-guide-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t('Wealth task guide', 'Wealth task guide')}</div>
              <h2>{t('Follow one guided path, then buy every product through the same receipt flow', 'Follow one guided path, then buy every product through the same receipt flow')}</h2>
            </div>
            <span className="pill risk-low">{wealthTaskCompletedCount}/{wealthQuestRows.length} complete</span>
          </div>

          <div className="wealth-task-guide-grid">
            {wealthQuestRows.map((quest) => (
              <button
                type="button"
                key={quest.id}
                className={`wealth-task-card ${quest.done ? 'done' : ''} ${quest.readyToClaim ? 'ready' : ''} ${selectedWealthTaskId === quest.id ? 'active' : ''}`}
                onClick={() => setSelectedWealthTaskId((current) => (current === quest.id ? null : quest.id))}
              >
                <div className="wealth-task-card-head">
                  <span className="wealth-task-badge">Task {quest.taskNumber}</span>
                  <span className={`wealth-task-status ${quest.statusTone === 'done' ? 'done' : quest.statusTone === 'ready' ? 'ready' : 'todo'}`}>
                    {quest.statusLabel}
                  </span>
                </div>
                <div className="wealth-task-meta">Task {quest.taskNumber} - {quest.activityLabel}</div>
                <strong>{quest.title}</strong>
                <p>{quest.copy}</p>
              </button>
            ))}
          </div>

          {wealthTaskDetailOpen ? (
          <div className="wealth-task-detail-card">
            <div className="section-head compact">
              <div>
                <div className="eyebrow">{selectedWealthTaskDetail.eyebrow}</div>
                <h3 className="wealth-task-detail-title">
                  <span className="wealth-task-detail-title-badge">{selectedWealthTask.badge}</span>
                  <span>{selectedWealthTaskDetail.title}</span>
                </h3>
              </div>
              <span className={`pill ${selectedWealthTaskReadyToClaim || selectedWealthTaskClaimed ? 'risk-low' : 'risk-medium'}`}>
                {selectedWealthTaskClaimStatus.text}
              </span>
            </div>
            <p className="muted wealth-task-detail-copy">{selectedWealthTaskDetail.copy}</p>
            <div className="wealth-task-detail-grid">
              <div className="wealth-task-detail-panel">
                <div className="checklist-list">
                  {selectedWealthTaskChecklistItems.map((item) => (
                    <div
                      className={`checklist-item ${item.statusTone} ${item.interactive ? 'checklist-item-interactive' : ''}`.trim()}
                      key={item.id}
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
                </div>
              </div>
              <div className="wealth-task-detail-panel">
                <div className="quest-panel-title">Task collectible reward</div>
                <div className={`quest-inline-status-card paper-task-checklist-summary ${selectedWealthTaskClaimStatus.tone}`}>
                  <div>
                    <div className="quest-panel-title">Core progress</div>
                    <div className="muted">{selectedWealthTaskClaimStatus.copy}</div>
                  </div>
                  <div className="paper-task-checklist-summary-meta">
                    <div className="paper-task-checklist-summary-count">
                      {selectedWealthTaskCompletedChecklistCount}/{selectedWealthTaskChecklistTotal} completed
                    </div>
                    <span className={`checklist-status-badge ${selectedWealthTaskClaimStatus.tone}`}>
                      {selectedWealthTaskClaimStatus.text}
                    </span>
                  </div>
                </div>
                <div className="mint-action-box inline-mint-action task-badge-mint-box">
                  <div>
                    <div className="product-title">{selectedWealthTaskDetail.claimTitle}</div>
                    <div className="muted">{selectedWealthTaskDetail.claimCopy}</div>
                    {wealthTaskClaimHash ? (
                      <div className="muted">Latest claim tx: {wealthTaskClaimHash}</div>
                    ) : null}
                    {selectedWealthTaskClaimSteps.length ? (
                      <div className="wealth-task-claim-steps">
                        {selectedWealthTaskClaimSteps.map((step) => (
                          <div className={`wealth-task-claim-step ${step.done ? 'done' : ''}`} key={step.label}>
                            <span>{step.done ? 'OK' : 'TODO'}</span>
                            <div>
                              <strong>{step.label}</strong>
                              <small>{step.copy}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="mint-status-stack">
                    {!selectedWealthTaskClaimed ? (
                      <span className={`pill ${selectedWealthTaskClaimStatus.tone === 'ready' ? 'risk-low' : 'risk-medium'}`}>
                        {wealthVaultConfigured ? 'Sepolia collectible' : 'Local collectible'}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => handleClaimWealthTaskBadge(selectedWealthTask.id)}
                      disabled={selectedWealthTaskClaimStatus.actionDisabled}
                    >
                      {selectedWealthTaskClaiming
                        ? 'Claiming...'
                        : selectedWealthTaskClaimStatus.actionLabel}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : null}
        </section>

        <section className="card wealth-discovery-card">
          <div className="wealth-product-type-panel">
            <div className="wealth-product-type-heading">
              <div>
                <div className="eyebrow">Product shelf</div>
                <h3>Product type</h3>
              </div>
              <span className="pill risk-medium">Type filters</span>
            </div>
            <div className="wealth-product-type-group-stack">
              {WEALTH_PRODUCT_TYPE_GROUPS.map((group) => {
                const activeGroupCategory =
                  group.id === 'wrapper' ? selectedWrapperCategory : selectedProductTypeCategory;

                return (
                  <div className="wealth-product-type-group" key={group.id}>
                    {group.label ? <div className="wealth-product-type-group-label">{group.label}</div> : null}
                    <div className="wealth-filter-row compact wealth-product-type-chip-row">
                      {group.options.map((category) => (
                        <button
                          key={`${group.id}-${category.id}`}
                          className={`risk-card-tab wealth-product-type-chip ${activeGroupCategory === category.id ? 'active' : ''}`}
                          onClick={() => handleProductTypeSelect(category, group.id)}
                          title={getWealthProductTypeTooltip(category)}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wealth-recommended-panel">
            <div className="section-head compact">
              <div>
                <div className="eyebrow">Recommended</div>
                <h3>
                  {recommendedPanelTitle}
                </h3>
              </div>
              <span className="pill risk-low">Detail shortcut</span>
            </div>
            {recommendedProductsForView.length ? (
              <div className="wealth-recommended-strip">
                {recommendedProductsForView.slice(0, 3).map((product) => {
                  const policy = getSettlementPolicy(product);
                  const destinationCategory = getCategoryIdForProduct(product);

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className="wealth-recommended-chip"
                      onClick={() => focusProduct(product.id, { topic: 'flow', categoryId: destinationCategory })}
                    >
                      <span className="wealth-recommended-kicker">
                        <span className={`wealth-recommended-risk ${riskClass(product.risk)}`}>{product.risk} risk</span>
                        <span>{getDisplayProductTypeLabel(product)}</span>
                      </span>
                      <strong>{product.name}</strong>
                      <em>{policy.label}</em>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="route-highlight">No product matches this filter yet. Switch product type or clear search.</div>
            )}
          </div>

          <button
            type="button"
            className="wealth-ai-recommend-card wealth-ai-recommend-button"
            onClick={() => focusProduct(aiRecommendedProduct.id, { topic: 'flow', categoryId: getCategoryIdForProduct(aiRecommendedProduct) })}
          >
            <div>
              <div className="eyebrow">AI recommended / Wallet fit</div>
              <div className="wealth-ai-recommend-title">
                <span className="wealth-ai-recommend-product">{aiRecommendedProduct.name}</span>
                <span className="wealth-ai-recommend-reason">{aiRecommendationReason}</span>
              </div>
            </div>
            <span className="pill risk-low">Open detail</span>
          </button>
        </section>

        {renderPositionsSection()}

        <section className={`wealth-shelf-shell ${dualInvestmentShelfActive ? 'dual-focused' : ''}`}>
          <div className="wealth-shelf-main">
            <section className="card">
              <div className="section-head">
                <div>
                  <div className="eyebrow">Product shelf</div>
                  <h2>{selectedShelfTitle}</h2>
                  <p className="muted">{selectedShelfSubtitle}</p>
                </div>
                <span className={`pill ${liveSnapshotState === 'fallback' ? 'risk-medium' : 'risk-low'}`}>
                  {shelfProducts.length} products in view
                </span>
              </div>

              {!dualInvestmentShelfActive ? (
                <div className="wealth-search-shell">
                  <div className="wealth-search-field">
                    <span className="wealth-search-icon" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none">
                        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M12.5 12.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </span>
                    <input
                      type="search"
                      value={shelfSearchQuery}
                      onChange={(event) => setShelfSearchQuery(event.target.value)}
                      placeholder="Search any fund you know"
                      aria-label="Search product shelf"
                    />
                  </div>
                </div>
              ) : null}

              {shelfProducts.length ? (
                <div className="wealth-product-row">
                  {shelfProducts.map((product) => {
                  const unlockCopy = getUnlockCopy(product, unlockProgress);
                  const isLocked = Boolean(unlockCopy);
                  const productNavPeriod = productNavPeriods[product.id] || '30d';
                  const productWindowLabel = NAV_PERIOD_OPTIONS.find((period) => period.id === productNavPeriod)?.label || '30D';
                  const sparkSeries = normalizeNavSeries(product.navHistory?.[productNavPeriod] || [], productNavPeriod);
                  const sparkDeltaPercent = getNavDeltaPercent(sparkSeries);
                  const productReturnDisplay = getProductReturnMetricDisplay(product, hideBalances);
                  const productFactRows = getWealthProductFactRows(product);
                  const productIsDual = isDualInvestmentProduct(product);
                  const isExpanded = expandedProductId === product.id;
                  const productPosition = displayWealthState.positions?.[product.id] || { shares: 0, principal: 0 };
                  const productCollateral = displayWealthState.collateral?.[product.id] || { pledgedShares: 0, borrowedAmount: 0 };
                  const productReceiptValue = roundNumber((productPosition.shares || 0) * product.nav, 2);
                  const productDifficulty = getProductDifficulty(product);

                  return (
                    <div className="wealth-product-stack" key={product.id}>
                      <div
                        ref={(node) => {
                          if (node) {
                            productCardRefs.current.set(product.id, node);
                          } else {
                            productCardRefs.current.delete(product.id);
                          }
                        }}
                        className={`product-card wealth-product-card ${expandedProductId === product.id ? 'active' : ''}`}
                        data-wealth-product-card={product.id}
                        onClick={() => handleToggleProduct(product.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleToggleProduct(product.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                      >
                        <div className="product-top">
                          <div>
                            <div className="product-title">{product.name}</div>
                            <div className="muted">
                              {getDisplayProductTypeLabel(product)} / {getTermTypeLabel(product)} / {product.status}
                            </div>
                            <div className="wealth-market-caption">
                              {product.asOfLabel || 'Static demo snapshot'} / {product.marketSource || 'RiskLens demo snapshot'}
                            </div>
                          </div>
                          <span className={`pill ${riskClass(product.risk)}`}>{product.risk}</span>
                        </div>

                        <div className="muted wealth-product-summary">{product.humanSummary}</div>

                        <div className="wealth-product-fact-grid">
                          {productFactRows.map((row) => (
                            <div key={row.label} className="wealth-product-fact-card">
                              <span>{row.label}</span>
                              <strong>{row.value}</strong>
                              <button
                                type="button"
                                className="wealth-fact-info"
                                title={row.copy}
                                aria-label={`${row.label}: ${row.copy}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                i
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="kv wealth-card-kv">
                          <div>
                            <div className="k">{productReturnDisplay.metric}</div>
                            <div className="v">{productReturnDisplay.value}</div>
                            <div className="wealth-mini-note">{productReturnDisplay.basis}</div>
                          </div>
                          <div>
                            <div className="k">Base asset</div>
                            <span className={`pill wealth-base-risk-pill ${productDifficulty.tone}`}>{productDifficulty.label}</span>
                            <div className="v">{product.baseAsset}</div>
                          </div>
                        </div>

                        {!productIsDual ? (
                          <>
                            <div className="wealth-card-performance-row">
                              <div className="wealth-nav-period-strip compact" onClick={(event) => event.stopPropagation()}>
                                {NAV_PERIOD_OPTIONS.map((period) => (
                                  <button
                                    key={`${product.id}-${period.id}`}
                                    type="button"
                                    className={`wealth-nav-chip compact ${period.id === productNavPeriod ? 'active' : ''}`}
                                    onClick={() => handleProductNavPeriodChange(product.id, period.id)}
                                  >
                                    <span>NAV window</span>
                                    <strong>{period.label}</strong>
                                  </button>
                                ))}
                              </div>

                              <div className="wealth-card-period-row">
                                <div className="wealth-mini-stat">
                                  <span>{productReturnDisplay.metric}</span>
                                  <strong className={productReturnDisplay.tone}>
                                    {productReturnDisplay.value}
                                  </strong>
                                </div>
                                <div className="wealth-mini-stat">
                                  <span>{productWindowLabel} return</span>
                                  <strong className={sparkDeltaPercent >= 0 ? 'risk-low' : 'risk-high'}>
                                    {sparkDeltaPercent >= 0 ? '+' : ''}{sparkDeltaPercent.toFixed(2)}%
                                  </strong>
                                </div>
                              </div>
                            </div>

                            <div className="wealth-card-chart-meta">
                              <span>{productWindowLabel} NAV</span>
                              <div className="wealth-nav-value-stack">
                                <strong>{sparkSeries.length ? sparkSeries[sparkSeries.length - 1].value.toFixed(3) : product.nav.toFixed(3)}</strong>
                                <span className={sparkDeltaPercent >= 0 ? 'risk-low' : 'risk-high'}>
                                  {sparkDeltaPercent >= 0 ? '+' : ''}{sparkDeltaPercent.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                            <MiniNavChart series={sparkSeries} tone={product.risk.toLowerCase()} />
                          </>
                        ) : null}

                        <div className="wealth-inline-note paper-inline-note">
                          Click this product to view details; click it again to collapse the detail.
                        </div>

                        {productPosition.shares ? (
                          <div className="wealth-inline-note paper-inline-note">
                            Wallet owns {formatShareBalance(productPosition.shares, hideBalances)} {product.shareToken} / {formatValue(
                              productReceiptValue,
                              hideBalances
                            )}. Pledged {formatShareBalance(productCollateral.pledgedShares || 0, hideBalances)} / support {formatValue(
                              productCollateral.borrowedAmount || 0,
                              hideBalances
                            )}.
                          </div>
                        ) : null}

                        {isLocked ? <div className="wealth-inline-note">{unlockCopy}</div> : null}
                        {isExpanded ? <div className="wealth-inline-note wealth-inline-selected">Selected detail is expanded below.</div> : null}
                      </div>

                      {isExpanded && selectedProductId === product.id ? renderSelectedProductDetail() : null}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="reason-card">
                  <div className="entry-title">No products matched that keyword</div>
                  <div className="entry-copy">
                    Try a product name, ticker-style token, underlying asset, or a fund family keyword like treasury, income, credit, or structured.
                  </div>
                </div>
              )}

              {false ? (
                <div className="wealth-expanded-detail">
                  <div className="section-head">
                    <div>
                      <div className="eyebrow">Selected detail</div>
                      <h2>{selectedProduct.name}</h2>
                    </div>

                    <div className="wealth-mode-switch">
                      <button
                        className={`ghost-btn compact ${explainMode === 'human' ? 'active-toggle' : ''}`}
                        onClick={() => setExplainMode('human')}
                      >
                        Human mode
                      </button>
                      <button
                        className={`ghost-btn compact ${explainMode === 'technical' ? 'active-toggle' : ''}`}
                        onClick={() => setExplainMode('technical')}
                      >
                        Protocol mode
                      </button>
                    </div>
                  </div>

                  <div className="wealth-detail-topic-strip">
                    <div>
                      <div className="eyebrow">Detail focus</div>
                      <div className="muted">Choose which sections to read. Click the same product row again to hide the entire detail view.</div>
                    </div>
                    <div className="wealth-detail-topic-row">
                      {DETAIL_TOPIC_OPTIONS.map((topic) => (
                        <button
                          key={topic.id}
                          className={`wealth-detail-topic-chip ${selectedDetailTopics.includes(topic.id) ? 'active' : ''}`}
                          onClick={() => toggleDetailTopic(topic.id)}
                        >
                          {topic.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedProductLocked ? <div className="wealth-inline-note">{selectedUnlockCopy}</div> : null}

                  <div className="wealth-detail-stack">
                    {isDualInvestmentProduct(selectedProduct) ? renderDualInvestmentOrderBook({ surface: 'detail' }) : null}
                    {selectedDetailTopics.includes('snapshot') ? (
                      <div className="paper-mode-card wealth-detail-section">
                        <div className="route-highlight wealth-detail-banner">
                          <strong>{selectedProduct.status}</strong> / {selectedProduct.liveTieIn}
                        </div>
                        <div className="wealth-market-caption wealth-market-banner">
                          {selectedAsOfLabel} / {selectedMarketSource} / {shelfStatusCopy}
                        </div>
                        <p className="hero-text wealth-detail-copy">
                          {explainMode === 'human' ? selectedProduct.humanSummary : selectedProduct.technicalSummary}
                        </p>

                        {!selectedProductIsDual ? (
                          <div className="wealth-chart-summary">
                            <div>
                              <div className="label">Latest NAV</div>
                              <div className="value wealth-summary-nav-value">
                                <span>{selectedProduct.nav.toFixed(3)}</span>
                                <span className={selectedTicketGain >= 0 ? 'risk-low' : 'risk-high'}>
                                  {formatSignedDollar(selectedTicketGain)}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="label">{selectedWindowLabel} / 1k</div>
                              <div className={`value ${selectedTicketGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                                {formatSignedDollar(selectedTicketGain)}
                              </div>
                            </div>
                            <div>
                              <div className="label">1k est. net</div>
                              <div className={`value ${tutorialNetGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                                {formatSignedDollar(tutorialNetGain)}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="kv wealth-detail-kv">
                          <div>
                            <div className="k">Underlying</div>
                            <div className="v">{selectedProduct.underlying}</div>
                          </div>
                          <div>
                            <div className="k">Source of return</div>
                            <div className="v">{selectedProduct.yieldSource}</div>
                          </div>
                          <div>
                            <div className="k">Who it fits</div>
                            <div className="v">{selectedProduct.suitableFor}</div>
                          </div>
                          <div>
                            <div className="k">Worst case</div>
                            <div className="v">{selectedProduct.worstCase}</div>
                          </div>
                          <div>
                            <div className="k">Fees and lock</div>
                            <div className="v">{selectedProduct.fees.management} / {selectedProduct.fees.lockup}</div>
                          </div>
                          <div>
                            <div className="k">Receipt token</div>
                            <div className="v">{selectedProduct.shareToken} / NAV {selectedProduct.nav.toFixed(3)}</div>
                          </div>
                        </div>

                        <div className="wealth-chart-summary">
                          <div>
                            <div className="label">Base-case gross</div>
                            <div className="value">{tutorialNetPreview.grossValue.toFixed(1)} PT</div>
                          </div>
                          <div>
                            <div className="label">Fee + route drag</div>
                            <div className="value">{(tutorialNetPreview.feeDrag + tutorialNetPreview.routeDrag).toFixed(1)} PT</div>
                          </div>
                          <div>
                            <div className="label">Estimated tax</div>
                            <div className="value">{tutorialNetPreview.taxHoldback.toFixed(1)} PT</div>
                          </div>
                        </div>

                        <div className="wealth-inline-note paper-inline-note">
                          Tutorial preview only: this net estimate includes management-fee drag, route cost, USDT-to-USD style conversion loss,
                          and a simple tax holdback so the user can see what may actually remain in the wallet.
                        </div>
                      </div>
                    ) : null}

                    {selectedDetailTopics.includes('nav') ? (
                      <div className="paper-mode-card wealth-detail-section wealth-scenario-card">
                        <div className="product-title">NAV history and scenario ladder</div>
                        <div className="muted">{selectedProduct.scenario.horizon}</div>

                        {!selectedProductIsDual ? (
                          <div className="wealth-select-row">
                            <label>
                              <div className="muted">Detail NAV window</div>
                              <select value={detailNavPeriod} onChange={(event) => setDetailNavPeriod(event.target.value)}>
                                {NAV_PERIOD_OPTIONS.map((period) => (
                                  <option key={period.id} value={period.id}>
                                    {period.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : null}

                        {!selectedProductIsDual ? (
                          <>
                            <div className="wealth-chart-summary">
                              <div>
                                <div className="label">Selected NAV window</div>
                                <div className="value">{selectedWindowLabel}</div>
                              </div>
                              <div>
                                <div className="label">1k in window</div>
                                <div className={`value ${selectedTicketGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                                  {formatSignedDollar(selectedTicketGain)}
                                </div>
                              </div>
                              <div>
                                <div className="label">Window return</div>
                                <div className={`value ${selectedNavDeltaPercent >= 0 ? 'risk-low' : 'risk-high'}`}>
                                  {selectedNavDeltaPercent >= 0 ? '+' : ''}{selectedNavDeltaPercent.toFixed(2)}%
                                </div>
                              </div>
                            </div>

                            <div className="wealth-period-grid">
                              {selectedPeriodComparisons.map((period) => (
                                <div className={`wealth-period-card ${period.id === detailNavPeriod ? 'active' : ''}`} key={period.id}>
                                  <div className="wealth-period-card-label">{period.label}</div>
                                  <div className="wealth-period-card-value">NAV {period.nav.toFixed(3)}</div>
                                  <div className={`wealth-period-card-move ${period.ticketGain >= 0 ? 'risk-low' : 'risk-high'}`}>
                                    {formatSignedDollar(period.ticketGain)} / {period.deltaPercent >= 0 ? '+' : ''}{period.deltaPercent.toFixed(2)}%
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : null}

                        {!selectedProductIsDual ? <DetailNavChart series={selectedNavPoints} /> : null}
                        <div className="wealth-scenario-grid">
                          <div className="reason-card">
                            <div className="entry-title">Conservative</div>
                            <div className="entry-copy">{selectedProduct.scenario.conservative}</div>
                          </div>
                          <div className="reason-card">
                            <div className="entry-title">Base</div>
                            <div className="entry-copy">{selectedProduct.scenario.base}</div>
                          </div>
                          <div className="reason-card">
                            <div className="entry-title">Pressure</div>
                            <div className="entry-copy">{selectedProduct.scenario.pressure}</div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {selectedDetailTopics.includes('subscription') ? (
                      <div className="paper-mode-card wealth-detail-section">
                        <div className="product-title">Subscription, suitability and access</div>
                        <div className="kv wealth-detail-kv">
                          <div>
                            <div className="k">Minimum ticket</div>
                            <div className="v">{selectedMinimumTicket.toLocaleString()} PT</div>
                          </div>
                          <div>
                            <div className="k">Preview shares</div>
                            <div className="v">{formatShareBalance(estimatedShares, hideBalances)} {selectedProduct.shareToken}</div>
                          </div>
                          <div>
                            <div className="k">Wallet cash</div>
                            <div className="v">{formatValue(availableCash, hideBalances)}</div>
                          </div>
                          <div>
                            <div className="k">Settlement path</div>
                            <div className="v">{selectedProduct.redemption}</div>
                          </div>
                        </div>

                        <div className="wealth-checklist" style={{ marginTop: 16 }}>
                          {accessChecklist.map((item) => (
                            <div className="wealth-check-row compact" key={item.label}>
                              <span className={`wealth-check-badge ${item.done ? 'done' : 'todo'}`}>{item.done ? 'Ready' : 'Pending'}</span>
                              <div>
                                <div className="entry-title">{item.label}</div>
                                <div className="entry-copy">{item.detail}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedDetailTopics.includes('routing') ? (
                      <div className="paper-mode-card wealth-detail-section">
                        <div className="product-title">Why it earns, what users worry about, and lifecycle</div>
                        <div className="starter-reasons">
                          <div className="reason-card">
                            <div className="entry-title">Funding rail</div>
                            <div className="entry-copy">{selectedProduct.baseAsset}</div>
                          </div>
                          <div className="reason-card">
                            <div className="entry-title">Why it earns</div>
                            <div className="entry-copy">{selectedInsight.whyEarns}</div>
                          </div>
                          <div className="reason-card">
                            <div className="entry-title">What users worry about</div>
                            <div className="entry-copy">{selectedInsight.worryCopy}</div>
                          </div>
                        </div>

                        <div className="starter-reasons" style={{ marginTop: 16 }}>
                          {lifecycleNotes.map((note) => (
                            <div className="reason-card" key={note}>
                              <div className="entry-copy">{note}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedDetailTopics.includes('holdings') ? (
                      <div className="paper-mode-card wealth-detail-section wealth-scenario-card">
                        <div className="product-title">Top look-through holdings and fee stack</div>
                        <div className="paper-asset-list">
                          {selectedInsight.holdings.map((holding) => (
                            <div className="paper-asset-row" key={holding.name}>
                              <div>
                                <div className="entry-title">{holding.name}</div>
                                <div className="entry-copy">Underlying sleeve exposure inside the product.</div>
                              </div>
                              <strong>{holding.weight}</strong>
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
                      </div>
                    ) : null}

                    {selectedDetailTopics.includes('receipt') ? (
                      <div className="paper-mode-card wealth-detail-section">
                        <div className="product-top">
                          <div>
                            <div className="eyebrow">Receipt detail</div>
                            <div className="product-title">Buy one receipt, then decide how it exits</div>
                            <div className="muted">
                              A receipt is the wallet-facing proof of this product position. It can be held, settled, redeemed, rolled, or pledged depending on the product terms.
                            </div>
                          </div>
                          <span className={`pill ${selectedSettlementPolicy.tone}`}>{selectedSettlementPolicy.label}</span>
                        </div>

                        <ReceiptLifecycleDiagram product={selectedProduct} />
                        <DualInvestmentVisual product={selectedProduct} />

                        <div className="starter-reasons" style={{ marginTop: 14 }}>
                          <div className="reason-card">
                            <div className="entry-title">Buy one receipt</div>
                            <div className="entry-copy">Subscribe PT into the product. The demo records {selectedProduct.shareToken} locally so the wallet has something concrete to track.</div>
                          </div>
                          <div className="reason-card">
                            <div className="entry-title">Settle</div>
                            <div className="entry-copy">Settle means finish the lifecycle: close, redeem, roll, or wait for maturity so the receipt converts into cash, another receipt, or the promised payoff.</div>
                          </div>
                          <div className="reason-card">
                            <div className="entry-title">Pledge</div>
                            <div className="entry-copy">Pledge means lock the receipt as route support, not new wallet cash, and release that support before normal redemption or settlement.</div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {selectedDetailTopics.includes('flow') ? (
                      <div className="paper-mode-card wealth-detail-section wealth-action-card">
                        <div className="product-top">
                          <div>
                            <div className="product-title">Receipt lifecycle desk</div>
                            <div className="muted">
                              Buy the receipt first, then read settlement, rollover, transfer, or pledge as one lifecycle instead of separate mystery buttons.
                            </div>
                          </div>
                          <span className={`pill ${riskClass(selectedProduct.risk)}`}>{selectedProduct.risk} risk</span>
                        </div>

                        {selectedProduct.riskNote ? (
                          <div className="wealth-inline-note paper-inline-note">
                            <strong>Risk note.</strong> {selectedProduct.riskNote}
                          </div>
                        ) : null}

                        <label className="wealth-field">
                          Subscribe amount
                          <input
                            type="number"
                            min={Math.max(WEALTH_MIN_SUBSCRIPTION, selectedProduct.minSubscription)}
                            step="100"
                            value={allocationAmount}
                            onChange={(event) => setAllocationAmount(Number(event.target.value))}
                          />
                        </label>

                        <div className="wealth-amount-preset-row" aria-label="Quick subscribe amount presets">
                          {subscriptionAmountPresets.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              className={`ghost-btn compact ${preset.active ? 'active-toggle' : ''}`}
                              onClick={() => setAllocationAmount(preset.value)}
                              disabled={preset.disabled}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        <div className="paper-balance-strip wealth-balance-strip">
                          <div className="paper-balance-box">
                            <div className="label">Current shares</div>
                            <div className="value">{formatShareBalance(selectedPosition.shares, hideBalances)}</div>
                          </div>
                          <div className="paper-balance-box">
                            <div className="label">Value @ timeline</div>
                            <div className="value">{formatValue(selectedPositionTimelineValue, hideBalances)}</div>
                          </div>
                          <div className="paper-balance-box">
                            <div className="label">PnL @ timeline</div>
                            <div className={`value ${selectedPositionTimelinePnl >= 0 ? 'risk-low' : 'risk-high'}`}>
                              {formatSignedValue(selectedPositionTimelinePnl, hideBalances)}
                            </div>
                          </div>
                        </div>

                        <div className="wealth-settlement-policy-card">
                          <div>
                            <div className="eyebrow">Redemption / settlement timing</div>
                            <div className="product-title">{selectedSettlementPolicy.timing}</div>
                            <div className="muted">{selectedSettlementPolicy.detail}</div>
                          </div>
                          <span className={`pill ${selectedSettlementPolicy.tone}`}>{selectedSettlementPolicy.label}</span>
                        </div>

                        <ReceiptLifecycleDiagram product={selectedProduct} compact />

                        {isDualInvestmentProduct(selectedProduct) ? (
                          <>
                            <div className="wealth-dual-flow-grid">
                              <div className="reason-card">
                                <div className="entry-title">Watch the strike and payoff range</div>
                                <div className="entry-copy">
                                  This sleeve is worth opening only if you actually want the target conversion price. The premium is the payment for accepting that settlement rule.
                                </div>
                              </div>
                              <div className="reason-card">
                                <div className="entry-title">No casual early redeem path</div>
                                <div className="entry-copy">
                                  Keep the flow simple: subscribe, wait for observation, then settle, roll, or transfer after the rule resolves.
                                </div>
                              </div>
                              <div className="reason-card">
                                <div className="entry-title">Receipt stays in wallet</div>
                                <div className="entry-copy">
                                  {selectedProduct.shareToken} is the receipt. It should stay visible until maturity instead of pretending the position has already become free PT cash.
                                </div>
                              </div>
                            </div>

                            <div className="toolbar wealth-action-toolbar">
                              <button
                                className="primary-btn"
                                onClick={handleOpenSubscribeModal}
                                disabled={selectedProductLocked || wealthWalletActionPending}
                              >
                                {wealthWalletActionPending ? 'Await wallet' : 'Review and buy'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="toolbar wealth-action-toolbar">
                              <button
                                className="primary-btn"
                                onClick={handleOpenSubscribeModal}
                                disabled={selectedProductLocked || wealthWalletActionPending}
                              >
                                {wealthWalletActionPending ? 'Await wallet' : 'Review and buy'}
                              </button>
                            </div>

                            <div className="starter-reasons" style={{ marginTop: 16 }}>
                              <div className="reason-card">
                                <div className="entry-title">{selectedRedeemAllowed ? 'Settle into PT cash' : 'Scheduled settlement only'}</div>
                                <div className="entry-copy">
                                  {selectedRedeemAllowed
                                    ? 'Use the main settlement desk to end the free receipt balance and return it to spendable PT cash in Wealth.'
                                    : 'Use the main settlement desk to model the scheduled end, roll, or transfer flow for this sleeve.'}
                                </div>
                              </div>
                              <div className="reason-card">
                                <div className="entry-title">Roll or transfer</div>
                                <div className="entry-copy">Roll restarts the same receipt with a refreshed basis; transfer settles this receipt first, then records another one.</div>
                              </div>
                              <div className="reason-card">
                                <div className="entry-title">{isCollateralPilotProduct(selectedProduct) ? 'Pledge as route support' : 'Lifecycle preview'}</div>
                                <div className="entry-copy">
                                  {isCollateralPilotProduct(selectedProduct)
                                    ? 'Pledge opens support for Paper routes, but it should not inflate Wealth cash or total PT.'
                                    : 'The preview cards below show what the wallet would sign before the lifecycle changes are applied.'}
                                </div>
                              </div>
                            </div>

                            <div className="product-title" style={{ marginTop: 16 }}>Approve, subscribe, and exit preview</div>
                            <FlowPreviewGrid cards={flowPreviewCards} />

                            <div className="env-hint">
                              <strong>Token mechanic.</strong> {selectedProduct.shareToken} is treated as the receipt record: subscribe creates the record, settlement closes or rolls it, and a pledge only opens route support instead of adding extra Wealth cash.
                            </div>

                            <div className="wealth-contract-grid" style={{ marginTop: 16 }}>
                              {onchainMechanics.map((item) => (
                                <div className="reason-card wealth-contract-card" key={item.title}>
                                  <div className="entry-title">{item.title}</div>
                                  <div className="entry-copy">{item.copy}</div>
                                </div>
                              ))}
                            </div>

                            <div className="wealth-rights-grid" style={{ marginTop: 16 }}>
                              <div className="paper-mode-card wealth-subpanel-card">
                                <div className="product-title">{selectedProduct.shareToken} rights snapshot</div>
                                <div className="starter-reasons">
                                  {selectedProduct.shareRights.map((line) => (
                                    <div className="reason-card" key={line}>
                                      <div className="entry-copy">{line}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="paper-mode-card wealth-subpanel-card">
                                <div className="product-title">Global rights notes</div>
                                <div className="starter-reasons">
                                  {GLOBAL_TOKEN_RIGHTS_NOTES.map((line) => (
                                    <div className="reason-card" key={line}>
                                      <div className="entry-copy">{line}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {feedback ? <div className="env-hint">{feedback}</div> : null}
                      </div>
                    ) : null}

                    {selectedDetailTopics.includes('onchain') ? (
                      <div className="paper-mode-card wealth-detail-section">
                        <div className="product-top">
                          <div>
                            <div className="eyebrow">Onchain Vault View</div>
                            <div className="product-title">Keeper status, attestation freshness, and wallet gate</div>
                            <div className="muted">
                              The research layer stays offchain, while the receipt vault surface anchors keeper state and wallet-specific access onchain.
                            </div>
                          </div>
                          <div className="wealth-header-pill-row">
                            <span className={`pill ${wealthVaultSnapshot.attestationTone}`}>{wealthVaultSnapshot.attestationStatus}</span>
                            <span className={`pill ${wealthVaultSnapshot.subscriptionsPaused ? 'risk-high' : 'risk-low'}`}>
                              {wealthVaultSnapshot.subscriptionsPaused ? 'Subscriptions paused' : 'Subscriptions open'}
                            </span>
                          </div>
                        </div>

                        <OnchainVaultGrid snapshot={wealthVaultSnapshot} product={selectedProduct} />

                        <div className="wealth-inline-note" style={{ marginTop: 16 }}>
                          <strong>Verification boundary.</strong> Product explainability, AI research, and macro overlays stay offchain; keeper-updated NAV ratio, attestation freshness, and wallet eligibility can be verified from one vault contract.
                        </div>
                      </div>
                    ) : null}

                    {selectedDetailTopics.includes('diligence') ? (
                      <div className="paper-mode-card wealth-detail-section wealth-diligence-summary-only">
                        <div className="product-top">
                          <div>
                            <div className="eyebrow">AI Risk + Research View</div>
                            <div className="product-title">AI diligence snapshot</div>
                            <div className="muted">
                              The compact pager below keeps the fit, key evidence, and memo in one place instead of listing every internal rubric row at once.
                            </div>
                          </div>
                          <div className="wealth-header-pill-row">
                            <span className={`pill ${selectedResearchView.stance.tone}`}>{selectedResearchView.stance.label}</span>
                            <span className="pill risk-low">Display score {selectedDiligenceModel.finalScore}/100</span>
                          </div>
                        </div>

                        {renderDiligenceWorkspace()}

                        <div className="wealth-judge-grid">
                          <div className="guide-chip">
                            <div className="k">Product quality</div>
                            <div className="v">{selectedDiligenceModel.baseScore}/100</div>
                            <div className="muted">Evidence-backed product checks across ten diligence dimensions.</div>
                          </div>
                          <div className="guide-chip">
                            <div className="k">Current stance</div>
                            <div className={`v ${selectedResearchView.stance.tone}`}>{selectedResearchView.stance.label}</div>
                            <div className="muted">{selectedResearchView.stance.summary}</div>
                          </div>
                          <div className="guide-chip">
                            <div className="k">{selectedResearchView.macroLens.label}</div>
                            <div className={`v ${selectedResearchView.macroLens.impact >= 0 ? 'risk-low' : 'risk-high'}`}>
                              {selectedResearchView.macroLens.value}
                            </div>
                            <div className="muted">{selectedResearchView.macroLens.detail}</div>
                          </div>
                          <div className="guide-chip">
                            <div className="k">{selectedResearchView.assetLens.label}</div>
                            <div className={`v ${selectedResearchView.assetLens.impact >= 0 ? 'risk-low' : 'risk-high'}`}>
                              {selectedResearchView.assetLens.value}
                            </div>
                            <div className="muted">{selectedResearchView.assetLens.detail}</div>
                          </div>
                          <div className="guide-chip">
                            <div className="k">Day1 overlay</div>
                            <div className={`v ${selectedDiligenceModel.signalAdjustment >= 0 ? 'risk-low' : 'risk-high'}`}>
                              {formatSignedScore(selectedDiligenceModel.signalAdjustment)}
                            </div>
                            <div className="muted">{day1BriefState.sourceLabel || 'No external source loaded'} / {day1Timestamp}</div>
                          </div>
                          <div className="guide-chip">
                            <div className="k">Receipt-token principle</div>
                            <div className="v">{selectedProduct.shareToken}</div>
                            <div className="muted">Tokenized ownership should explain rights, cash flow, and lifecycle, not just render a wallet balance.</div>
                          </div>
                        </div>

                        <div className="wealth-detail-grid" style={{ marginTop: 16 }}>
                          <div className="paper-mode-card wealth-subpanel-card">
                            <div className="product-title">Research summary</div>
                            <div className="entry-copy">{selectedResearchView.stance.summary}</div>
                            <div className="wealth-inline-note paper-inline-note" style={{ marginTop: 16 }}>
                              {selectedResearchView.sourceLine}
                            </div>
                          </div>

                          <div className="paper-mode-card wealth-subpanel-card">
                            <div className="product-title">What would change the view</div>
                            <div className="starter-reasons">
                              {selectedResearchView.changeItems.map((line) => (
                                <div className="reason-card" key={line}>
                                  <div className="entry-copy">{line}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="wealth-detail-grid" style={{ marginTop: 16 }}>
                          <div className="paper-mode-card wealth-subpanel-card">
                            <div className="product-title">What the AI is watching</div>
                            <div className="starter-reasons">
                              {selectedResearchView.watchItems.map((line) => (
                                <div className="reason-card" key={line}>
                                  <div className="entry-copy">{line}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="paper-mode-card wealth-subpanel-card">
                            <div className="product-title">Signal-to-stance bridge</div>
                            <div className="starter-reasons">
                              <div className="reason-card">
                                <div className="entry-title">Rubric first</div>
                                <div className="entry-copy">Underlying, structure, compliance, and liquidity still set the base conviction.</div>
                              </div>
                              <div className="reason-card">
                                <div className="entry-title">Overlay second</div>
                                <div className="entry-copy">Macro liquidity and asset-specific heat adjust the stance, but do not replace product diligence.</div>
                              </div>
                              <div className="reason-card">
                                <div className="entry-title">Action output</div>
                                <div className="entry-copy">The final label is a research stance for sizing and timing, not a promise of return.</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="wealth-rights-grid" style={{ marginTop: 16 }}>
                          {selectedDiligenceModel.breakdown.map((item) => (
                            <div className="wealth-signal-row" key={item.label}>
                              <div className="product-top">
                                <div>
                                  <div className="product-title">{item.title}</div>
                                  <div className="muted">{item.detail}</div>
                                </div>
                                <span className={`pill ${item.status === 'Pass' ? 'risk-low' : 'risk-medium'}`}>{item.status}</span>
                              </div>
                              <div className="wealth-judge-mini">
                                <span>Weight {item.weight}</span>
                                <strong>{item.weightedPoints} pts</strong>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="wealth-rights-grid" style={{ marginTop: 16 }}>
                          {selectedDiligenceModel.signalRows.map((item) => (
                            <div className="wealth-signal-row" key={item.label}>
                              <div className="product-top">
                                <div>
                                  <div className="product-title">{item.label}</div>
                                  <div className="muted">{item.detail}</div>
                                </div>
                                <span className={`pill ${item.impact >= 0 ? 'risk-low' : 'risk-medium'}`}>{formatSignedScore(item.impact)}</span>
                              </div>
                              <div className="wealth-judge-mini">
                                <span>Observed</span>
                                <strong>{item.value}</strong>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="wealth-inline-note paper-inline-note" style={{ marginTop: 16 }}>
                          {day1BriefState.note || selectedDiligenceModel.overlayNote}
                        </div>
                      </div>
                    ) : null}

                    {selectedDetailTopics.includes('automation') ? (
                      <div className="paper-mode-card wealth-detail-section">
                        <div className="product-title">Automation and strategy logic</div>
                        <div className="starter-reasons">
                          {selectedProduct.automation.map((line) => (
                            <div className="reason-card" key={line}>
                              <div className="entry-copy">{line}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedDetailTopics.length === 0 ? (
                      <div className="wealth-inline-note">Select at least one detail focus chip to display the selected product section below.</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            {dualInvestmentShelfActive ? renderDualInvestmentShelfSection() : null}
          </div>

          {!dualInvestmentShelfActive ? (
          <aside className="card wealth-ranking-sidebar">
            <div className="section-head">
              <div>
                <div className="eyebrow">{dualInvestmentShelfActive ? 'Dual Investment leaderboard' : 'Leaderboard'}</div>
                <h2>{dualInvestmentShelfActive ? 'Premium leaderboard' : 'Return leaderboard'}</h2>
              </div>
            </div>

            <div className="muted">
              {dualInvestmentShelfActive
                ? 'Dual receipts rank by capped term-premium payoff and diligence context. Treat the range as target-price settlement risk, not stable deposit yield.'
                : 'Top 10 shelves by displayed yield, premium, coupon, or outcome metric. AI score stays beside each row so return never appears without diligence context.'}
            </div>

            <div className="wealth-signal-list">
              {leaderboardRows.map((row, index) => (
                <button
                  key={row.id}
                  className={`wealth-leader-row ${row.id === expandedProductId ? 'active' : ''}`}
                  onClick={() => focusProduct(row.id)}
                >
                  <div className="wealth-leader-rank">#{index + 1}</div>
                  <div className="wealth-leader-main">
                    <div className="product-title">{row.name}</div>
                    <div className="muted">
                      {row.returnBasis} / AI {row.score} / NAV {row.nav.toFixed(3)}
                    </div>
                  </div>
                  <div className={`wealth-leader-move ${row.returnTone}`}>
                    <div className={`pill ${riskClass(row.risk)}`}>{row.risk}</div>
                    <strong>{row.returnValue}</strong>
                    <div className="wealth-leader-subtext">{row.returnSubtext}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="wealth-inline-note paper-inline-note" style={{ marginTop: 18 }}>
              Click any row to open that product and jump straight to its detail section. The sidebar stays focused on the top 10 instead of paging through the shelf.
            </div>
          </aside>
          ) : null}
        </section>

        {renderCompareSection()}
      </main>

      {renderTimelineDock()}

      <button
        type="button"
        className={`wealth-back-to-top ${showBackToTop ? 'visible' : ''}`}
        onClick={handleBackToTop}
        aria-label="Back to top"
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
      >
        <span className="wealth-back-to-top-icon" aria-hidden="true">^</span>
      </button>

      <SubscriptionPreviewModal
        open={isSubscribeModalOpen}
        product={selectedProduct}
        amount={Number(allocationAmount)}
        minimumTicket={selectedMinimumTicket}
        availableCash={availableCash}
        estimatedShares={estimatedShares}
        address={address}
        validationMessage={subscriptionValidationMessage}
        firstInvestSteps={firstInvestSteps}
        flowPreviewCards={flowPreviewCards}
        modeledCallCards={modeledCallCards}
        accessChecklist={accessChecklist}
        preInvestChecks={preInvestChecks}
        lifecycleNotes={lifecycleNotes}
        onchainMechanics={onchainMechanics}
        vaultSnapshot={wealthVaultSnapshot}
        receiptProofMode={subscriptionReceiptProofMode}
        onReceiptProofModeChange={setSubscriptionReceiptProofMode}
        receiptTokenId={getWealthReceiptTokenId(selectedProduct)}
        receiptUnitAmount={toVaultUnitAmount(Number(allocationAmount)).toString()}
        isSigning={wealthWalletActionPending}
        onClose={() => setIsSubscribeModalOpen(false)}
        onConfirm={handleConfirmSubscribe}
      />

      <WealthWalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnect={handleConnect}
        onDisconnect={handleWalletDisconnect}
        onSaveNickname={handleSaveWalletNickname}
        isPending={isPending}
        isConnected={isConnected}
        walletDisplayName={walletDisplayName}
        nicknameDraft={walletNicknameDraft}
        onNicknameDraftChange={(value) => {
          setWalletNicknameDraft(value.slice(0, WALLET_NICKNAME_MAX_LENGTH));
          setWalletNicknameFeedback('');
        }}
        nicknameFeedback={walletNicknameFeedback}
        errorText={walletError}
        hasMetaMaskInstalled={hasMetaMaskInstalled}
        isProfileSigning={isWealthSigning}
        profileBackupAccounts={profileBackupAccounts}
        selectedProfileBackupAddress={selectedProfileBackupAddress}
        onSelectedProfileBackupAddressChange={setSelectedProfileBackupAddress}
        onSignProfileBackup={handleSignProfileBackup}
        onRecoverSelectedProfileBackup={handleRecoverSelectedProfileBackup}
        profileBackupSummaryText={profileBackupStatus || (
          isConnected
            ? `Connected as ${walletDisplayName}. Sign a Wealth backup, or recover a saved snapshot for this same wallet.`
            : profileBackupAccounts.length
              ? `${profileBackupAccounts.length} historical backup${profileBackupAccounts.length === 1 ? '' : 's'} found on this device. Connect the matching MetaMask account before recovery.`
              : 'Connect MetaMask to create or recover a signed Wealth profile backup.'
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
        walletProfilePanel={renderWalletProfileRouter()}
      />
    </div>
  );
}

export default function WealthApp() {
  return (
    <React.StrictMode>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <WealthInner />
        </QueryClientProvider>
      </WagmiProvider>
    </React.StrictMode>
  );
}
