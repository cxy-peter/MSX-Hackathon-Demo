import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useAccount, useConnect, useReadContract } from 'wagmi';
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
import { getWalletDisplayName, readWalletNickname } from './walletNickname';

const SEPOLIA_CHAIN_ID = 11155111;
const BADGE_CONTRACT_ADDRESS = import.meta.env.VITE_BADGE_CONTRACT_ADDRESS || '';
const WEALTH_VAULT_ADDRESS = import.meta.env.VITE_WEALTH_VAULT_ADDRESS || '';
const badgeContractConfigured = isAddress(BADGE_CONTRACT_ADDRESS);
const wealthVaultConfigured = isAddress(WEALTH_VAULT_ADDRESS);
const DAY_MS = 24 * 60 * 60 * 1000;
const BADGE_TYPES = {
  welcome: 0,
  wallet: 1,
  risk: 2,
  quiz: 3,
  paper: 4
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
const COMPARE_LINE_COLORS = ['#226d40', '#7aa6ff', '#f06a7f', '#ffd166'];
const WEALTH_LIVE_CACHE_KEY = 'msx-wealth-live-products-cache-v1';
const DAY1_BRIEF_CACHE_KEY = 'msx-day1-brief-cache-v1';
const WEALTH_VAULT_ASSET_SCALE = 10 ** 6;
const COLLATERAL_PILOT_PRODUCT_ID = 'superstate-ustb';
const COLLATERAL_ADVANCE_RATE = 0.7;
const COLLATERAL_WARNING_LTV = 0.85;
const DETAIL_TOPIC_OPTIONS = [
  { id: 'flow', label: 'Buy flow', helper: 'Start here. See what happens before buy, what the wallet receives, and whether this sleeve can ever be redeemed early.' },
  { id: 'snapshot', label: 'Core snapshot', helper: 'Read the one-screen summary: what the product is, what it holds, and which annual-yield basis is being shown.' },
  { id: 'nav', label: 'NAV and scenario', helper: 'Check the recent NAV path, the selected window, and the conservative/base/pressure scenarios before buying.' },
  { id: 'subscription', label: 'Subscription and access', helper: 'See the minimum ticket, wallet access rules, and whether this sleeve is open-ended or closed-ended.' },
  { id: 'routing', label: 'Why it earns', helper: 'Use this to understand the return engine in plain language before looking at the headline annual yield.' },
  { id: 'holdings', label: 'Underlying and fees', helper: 'Read the actual holdings style, fee stack, and where drag can show up.' },
  { id: 'onchain', label: 'Onchain vault', helper: 'See which pieces are read from chain today: vault status, eligibility, risk tier, and attestation freshness.' },
  { id: 'diligence', label: 'AI risk and research', helper: 'Use this when you want the investment view: score, stance, watch items, and what could change the recommendation.' },
  { id: 'automation', label: 'Automation logic', helper: 'Read how monitors or agents would watch this product after purchase.' }
];

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
    layer: 'Listed / xStocks',
    owns: 'Tokenized listed equity or ETF-style tracker exposure only',
    earn: 'Price beta; not fixed treasury yield',
    liquidity: 'Secondary venue liquidity plus market-day primary processing',
    rights: 'Tracker / wrapper rights, not always full shareholder rights',
    auto: 'DCA, alerts, rebalance with off-hours guardrails'
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
    layer: 'Auto / Managed',
    owns: 'A permissioned rule or managed strategy layered on assets',
    earn: 'Depends on the underlying sleeve and strategy rules',
    liquidity: 'Must inherit the underlying product liquidity',
    rights: 'Rule permissions, override rights, and pause conditions',
    auto: 'Recurring buy, rebalance, watchlist, yield optimizer, risk copilot'
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

function getWealthStateKey(address) {
  return address ? `msx-wealth-state-${address.toLowerCase()}` : '';
}

function defaultWealthState() {
  return {
    cash: WEALTH_STARTING_CASH,
    positions: {},
    collateral: {}
  };
}

function normalizeWealthState(value) {
  return {
    cash: Number(value?.cash ?? WEALTH_STARTING_CASH),
    positions: value?.positions && typeof value.positions === 'object' ? value.positions : {},
    collateral: value?.collateral && typeof value.collateral === 'object' ? value.collateral : {}
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
  return product?.annualYieldSource || 'MSX tutorial annualized carry assumption.';
}

function isClosedEndProduct(product) {
  return product?.termType === 'closed';
}

function isCollateralPilotProduct(product) {
  return product?.id === COLLATERAL_PILOT_PRODUCT_ID;
}

function getWealthProductSurface(product = {}) {
  const text = `${product.id || ''} ${product.bucket || ''} ${product.productType || ''} ${product.underlying || ''} ${product.yieldSource || ''}`.toLowerCase();

  if (/xstock|listed \/ xstocks|listed equity|etf-style|public holdings/.test(text)) return 'public';
  if (/private-watchlist|pre-ipo|spv|private share|late-stage|private credit/.test(text)) return 'private';
  if (/quant|managed|strategy|auto|closed-end quant/.test(text)) return 'auto';
  if (/treasury|t-bill|money fund|liquidity fund|cash management|reserve|repo|buidl|ustb|usdy|ousg|usyc|tbill|franklin/.test(text)) return 'cash';
  if (/carry|yield|income|basis|credit spread|term premium/.test(text)) return 'earn';

  return 'earn';
}

function productMatchesWealthGoal(product, goalId) {
  if (!goalId) return true;
  if (product.goals?.includes(goalId)) return true;
  const surface = getWealthProductSurface(product);

  if (goalId === 'parkCash') return surface === 'cash';
  if (goalId === 'earn') return surface === 'earn' || surface === 'cash';
  if (goalId === 'public') return surface === 'public';
  if (goalId === 'private') return surface === 'private';
  if (goalId === 'auto') return surface === 'auto';

  return product.goals?.includes(goalId);
}

function productMatchesWealthCategory(product, categoryId) {
  if (!categoryId || categoryId === 'all') return true;
  const surface = getWealthProductSurface(product);
  return surface === categoryId || product.termType === categoryId;
}

function getWealthProductFactRows(product = {}) {
  const surface = getWealthProductSurface(product);
  const surfaceNote =
    surface === 'cash'
      ? 'Cash & Treasury'
      : surface === 'public'
        ? 'Listed / xStocks'
        : surface === 'private'
          ? 'Private'
          : surface === 'auto'
            ? 'Auto / Managed'
            : 'Earn / Yield';

  return [
    { label: 'What you own', value: `${surfaceNote} receipt`, copy: product.baseAsset || product.shareToken || 'Product wrapper exposure' },
    { label: 'How you earn', value: getAnnualYieldRate(product) > 0 ? formatYieldPercent(getAnnualYieldRate(product)) : 'No fixed yield', copy: product.yieldSource || 'Return source must be disclosed before subscription.' },
    { label: 'Liquidity', value: isClosedEndProduct(product) ? 'Term / gated' : 'Open / routed', copy: product.redemption || 'Liquidity depends on the product route.' },
    { label: 'Main risk', value: product.risk || 'Review', copy: product.worstCase || product.riskNote || 'Downside and execution risk must remain visible.' },
    { label: 'Rights', value: product.shareToken || 'Receipt', copy: product.shareRights?.[0] || 'Rights depend on wrapper, token, and issuer terms.' }
  ];
}

function getTermTypeLabel(product) {
  return isClosedEndProduct(product) ? 'Closed-ended' : 'Open-ended';
}

function getForwardProjectedNav(product, days) {
  if (!Number.isFinite(days) || days <= 0) return Number(product?.nav || 0);
  return Number((Number(product?.nav || 0) * Math.pow(1 + getAnnualYieldRate(product), days / 365)).toFixed(3));
}

function getUnlockCopy(product, progressState) {
  if (product.bucket === 'strategy' && !progressState.guideCompleted) {
    return 'Review 3 risk cards first to unlock the managed-strategy shelf.';
  }

  if (isClosedEndProduct(product) && !progressState.quizCompleted && !(progressState.paperTradesCompleted > 0)) {
    return 'Pass the product quiz or complete one paper trade before allocating to closed-end sleeves.';
  }

  return '';
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
    return `Minimum subscription for this shelf is ${minimumTicket} PT.`;
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
        ? 'Risk-card review is already linked to this wallet.'
        : 'Review the 3 risk cards first to unlock the managed sleeve.'
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
      label: 'Closed-end pass',
      done: progress.quizTaskDone || progress.paperTaskDone,
      detail:
        progress.quizTaskDone || progress.paperTaskDone
          ? 'Quiz or paper-trade progress is already mapped to this wallet.'
          : 'Pass the quiz or finish one paper trade to access closed-end sleeves.'
    });
  } else {
    items.push({
      label: 'Product comprehension',
      done: progress.quizTaskDone || progress.paperTaskDone || !isClosedEndProduct(product),
      detail:
        isClosedEndProduct(product)
          ? progress.quizTaskDone || progress.paperTaskDone
            ? 'This wallet already has enough progress to show closed-end product suitability.'
            : 'Recommended next: complete the quiz or one paper trade before increasing complexity.'
          : 'Open-ended shelves stay available without a separate closed-end pass.'
    });
  }

  return items;
}

function getLifecycleNotes(product) {
  if (isClosedEndProduct(product)) {
    return [
      'Subscription settles into a closed-end bucket and tracks maturity value instead of instant withdrawals.',
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
        : 'Modeled on MSXWealthReceiptVault: owner can pause subscriptions, update NAV, record attestation roots, and map investor eligibility before a live rollout.'
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
      title: `${isClosedEndProduct(product) ? 'Closed-end' : 'Open-end'} redemption mechanics`,
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
      title: '2. Subscribe mints receipt',
      copy: `${formatShareBalance(context.estimatedShares, false)} ${product.shareToken} would mint against the current NAV instead of pretending the user holds cash.${vaultSnapshot?.configured ? ` The connected keeper ratio is ${vaultSnapshot.navLabel}.` : ''}`
    },
    {
      title: '3. Eligibility and attestation stay visible',
      copy: vaultSnapshot?.configured
        ? `Risk tier, investor eligibility, and the attestation root are now readable from ${shortAddress(vaultSnapshot.address)}. Latest root: ${vaultSnapshot.attestationRootLabel}.`
        : 'Risk tier, investor eligibility, approved underlying hashes, and the latest attestation root belong in the same vault surface as the order preview.'
    },
    {
      title: '4. Redeem or maturity burns the receipt',
      copy:
        isClosedEndProduct(product)
          ? 'Closed-end products keep the receipt in the wallet until maturity settlement resolves.'
          : 'Flexible products burn shares on redemption and show the cash preview before the wallet state updates.'
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
      statusLabel: canReviewSubscribe ? 'Ready to mint receipt' : 'Review requirements',
      tone: canReviewSubscribe ? 'pass' : 'review',
      primary: `${formatShareBalance(previewShares, context.hidden)} ${product.shareToken}`,
      secondary: `Cash after subscribe ${formatValue(postSubscribeCash, context.hidden)} / total receipt balance ${formatShareBalance(projectedShares, context.hidden)}`,
      copy: `At NAV ${product.nav.toFixed(3)}, this order would mint wallet-linked receipt shares instead of pretending the user directly holds idle cash.`
    }
  ];

  if (isClosedEndProduct(product)) {
    const scale = previewOrderAmount / 1000;
    cards.push({
      step: 'Step 3',
      title: 'Maturity preview',
      statusLabel: 'Closed-end settlement',
      tone: 'review',
      primary: getScaledScenarioText(product.scenario.base, scale),
      secondary: `Conservative ${getScaledScenarioText(product.scenario.conservative, scale)} / pressure ${getScaledScenarioText(
        product.scenario.pressure,
        scale
      )}`,
      copy: 'The receipt stays outstanding until maturity because this closed-end sleeve is not redeemable on demand in the current flow.'
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
      statusLabel: context.existingShares > 0 ? 'Burn receipt for cash' : 'Subscribe first',
      tone: context.existingShares > 0 ? 'pass' : 'review',
      primary: context.existingShares > 0 ? formatValue(redeemValue, context.hidden) : `${formatShareBalance(previewShares, context.hidden)} next receipt`,
      secondary: context.existingShares > 0
        ? `${formatShareBalance(sharesToBurn, context.hidden)} burn / ${formatShareBalance(remainingShares, context.hidden)} remaining / cash after redeem ${formatValue(
            cashAfterRedeem,
            context.hidden
          )}`
        : 'Once shares exist in the wallet, redemption can burn the receipt and preview the cash leg before confirmation.',
      copy: 'Flexible products should show the cash-out path before burning shares so the user sees settlement timing, route drag, and the post-redeem wallet state.'
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
      stateChange: `${product.shareToken} receipt balance mints and the funding asset leaves the wallet rail.`
    },
    isClosedEndProduct(product)
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
          walletPrompt: 'Users should not expect an always-open redeem call on closed-end buckets.',
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
          walletPrompt: 'Redeem should preview the burn amount and the expected cash leg before the user signs the transaction.',
          stateChange: 'Receipt shares burn and the funding rail returns cash or stablecoin to the wallet.'
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
  if (pointCount > 60) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function DetailNavChart({ series = [] }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const points = normalizeNavSeries(series);
  const width = 540;
  const height = 240;
  const padding = { top: 20, right: 74, bottom: 36, left: 16 };
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
        preserveAspectRatio="none"
        aria-hidden="true"
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
                {activeDelta >= 0 ? '+' : ''}{activeDelta.toFixed(3)} / {activeDeltaPercent >= 0 ? '+' : ''}{activeDeltaPercent.toFixed(2)}%
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
    </div>
  );
}

function CompareNavChart({ seriesList = [], periodLabel = '30D' }) {
  const width = 640;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 36, left: 16 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const allValues = seriesList.flatMap((series) => series.points.map((point) => point.value));
  const low = allValues.length ? Math.min(...allValues) : 95;
  const high = allValues.length ? Math.max(...allValues) : 105;
  const range = high - low || 1;
  const yTicks = Array.from({ length: 4 }, (_, index) => low + (range * index) / 3);

  function buildPath(points) {
    if (!points.length) return '';
    return points
      .map((point, index) => {
        const x = padding.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * plotWidth);
        const y = padding.top + ((high - point.value) / range) * plotHeight;
        return `${x},${y}`;
      })
      .join(' ');
  }

  return (
    <div className="wealth-compare-chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
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

        {seriesList.map((series) => (
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
  onClose,
  onConfirm
}) {
  if (!open || !product) return null;

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

        <div className="product-title" style={{ marginTop: 18 }}>Approve, subscribe, and exit preview</div>
        <FlowPreviewGrid cards={flowPreviewCards} compact />
        <div className="product-title" style={{ marginTop: 18 }}>Future wallet call preview</div>
        <ModeledCallGrid cards={modeledCallCards} compact />

        <div className="wealth-modal-layout">
          <div className="paper-mode-card wealth-modal-panel">
            <div className="product-title">First deposit walkthrough</div>
            <div className="wealth-walkthrough-list">
              {firstInvestSteps.map((step) => (
                <div className="wealth-walkthrough-step" key={step.label}>
                  <span className={`wealth-step-badge ${step.status}`}>{step.status}</span>
                  <div>
                    <div className="entry-title">{step.label}</div>
                    <div className="entry-copy">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="product-title">Before you continue</div>
            <div className="wealth-checklist">
              {accessChecklist.map((item) => (
                <div className="wealth-check-row" key={item.label}>
                  <span className={`wealth-check-badge ${item.done ? 'done' : 'todo'}`}>{item.done ? 'Ready' : 'Pending'}</span>
                  <div>
                    <div className="entry-title">{item.label}</div>
                    <div className="entry-copy">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="product-title" style={{ marginTop: 18 }}>Lifecycle and settlement</div>
            <div className="starter-reasons">
              {lifecycleNotes.map((note) => (
                <div className="reason-card" key={note}>
                  <div className="entry-copy">{note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="paper-mode-card wealth-modal-panel">
            <div className="product-title">Before you invest</div>
            <div className="wealth-check-card-grid">
              {preInvestChecks.map((item) => (
                <div className="reason-card wealth-check-card" key={item.label}>
                  <div className="wealth-check-card-head">
                    <span className={`pill ${item.tone === 'pass' ? 'risk-low' : item.tone === 'review' ? 'risk-medium' : 'risk-high'}`}>
                      {item.label}
                    </span>
                    <div className="entry-title">{item.title}</div>
                  </div>
                  <div className="entry-copy">{item.detail}</div>
                </div>
              ))}
            </div>

            <div className="product-title">Scenario ladder</div>
            <div className="muted">{product.scenario.horizon}</div>
            <div className="wealth-scenario-grid wealth-modal-scenarios">
              <div className="reason-card">
                <div className="entry-title">Conservative</div>
                <div className="entry-copy">{product.scenario.conservative}</div>
              </div>
              <div className="reason-card">
                <div className="entry-title">Base</div>
                <div className="entry-copy">{product.scenario.base}</div>
              </div>
              <div className="reason-card">
                <div className="entry-title">Pressure</div>
                <div className="entry-copy">{product.scenario.pressure}</div>
              </div>
            </div>

            <div className="product-title" style={{ marginTop: 18 }}>Share-token rights</div>
            <div className="starter-reasons">
              {product.shareRights.map((line) => (
                <div className="reason-card" key={line}>
                  <div className="entry-copy">{line}</div>
                </div>
              ))}
            </div>

            <div className="product-title" style={{ marginTop: 18 }}>Modeled onchain mechanics</div>
            <div className="wealth-contract-grid">
              {onchainMechanics.map((item) => (
                <div className="reason-card wealth-contract-card" key={item.title}>
                  <div className="entry-title">{item.title}</div>
                  <div className="entry-copy">{item.copy}</div>
                </div>
              ))}
            </div>

            <div className="product-title" style={{ marginTop: 18 }}>Live vault snapshot</div>
            <OnchainVaultGrid snapshot={vaultSnapshot} product={product} />
          </div>
        </div>

        <div className="wealth-modal-footer">
          <div className="wealth-inline-note">
            {validationMessage || `This confirms a simulated PT subscription and mints ${product.shareToken} in the local demo ledger only.`}
          </div>
          <div className="toolbar">
            <button className="secondary-btn" onClick={onClose}>
              Keep reviewing
            </button>
            <button className="primary-btn" onClick={onConfirm} disabled={Boolean(validationMessage)}>
              Confirm simulated subscription
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
  const { connect, connectors, isPending } = useConnect();
  const [walletNickname, setWalletNickname] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('parkCash');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProductId, setSelectedProductId] = useState(WEALTH_PRODUCTS[0].id);
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
  const [compareProductIds, setCompareProductIds] = useState(WEALTH_PRODUCTS.slice(0, 3).map((product) => product.id));
  const [comparePickerValue, setComparePickerValue] = useState('');
  const [selectedDetailTopics, setSelectedDetailTopics] = useState(['flow']);
  const [fastForwardTarget, setFastForwardTarget] = useState('90d');
  const [collateralBorrowInput, setCollateralBorrowInput] = useState(0);
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [progressState, setProgressState] = useState({
    guideCompleted: false,
    quizCompleted: false,
    paperTradesCompleted: 0
  });
  const [wealthState, setWealthState] = useState(defaultWealthState());
  const [pendingScrollProductId, setPendingScrollProductId] = useState(null);
  const productCardRefs = useRef(new Map());
  const productDetailRefs = useRef(new Map());

  const metaMaskConnector = useMemo(
    () => connectors.find((connector) => connector.name.toLowerCase().includes('metamask')) || connectors[0],
    [connectors]
  );
  const walletDisplayName = useMemo(
    () => getWalletDisplayName(address, walletNickname, shortAddress),
    [address, walletNickname]
  );

  const progressStorageKey = useMemo(() => getProgressStorageKey(address), [address]);
  const wealthStorageKey = useMemo(() => getWealthStateKey(address), [address]);
  const productMap = useMemo(() => Object.fromEntries(liveProducts.map((product) => [product.id, product])), [liveProducts]);

  useEffect(() => {
    setWalletNickname(readWalletNickname(address));
  }, [address]);

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

  useEffect(() => {
    if (!address) {
      setProgressState({
        guideCompleted: false,
        quizCompleted: false,
        paperTradesCompleted: 0
      });
      return;
    }

    const storedProgress = readStorageJson(progressStorageKey, {
      guideCompleted: false,
      quizCompleted: false,
      paperTradesCompleted: 0
    });

    setProgressState({
      guideCompleted: Boolean(storedProgress.guideCompleted),
      quizCompleted: Boolean(storedProgress.quizCompleted),
      paperTradesCompleted: Number(storedProgress.paperTradesCompleted || 0)
    });
  }, [address, progressStorageKey]);

  useEffect(() => {
    if (!address) {
      setWealthState(defaultWealthState());
      return;
    }

    setWealthState(normalizeWealthState(readStorageJson(wealthStorageKey, defaultWealthState())));
  }, [address, wealthStorageKey]);

  useEffect(() => {
    if (!address) return;
    writeStorageJson(wealthStorageKey, wealthState);
  }, [address, wealthState, wealthStorageKey]);

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

  const currentGoal = useMemo(() => getGoalById(selectedGoal), [selectedGoal]);
  const recommendedProducts = useMemo(
    () =>
      currentGoal.recommended
        .map((productId) => getProductByIdFrom(liveProducts, productId))
        .filter(Boolean),
    [currentGoal, liveProducts]
  );

  const goalFilteredProducts = useMemo(
    () => liveProducts.filter((product) => productMatchesWealthGoal(product, selectedGoal)),
    [liveProducts, selectedGoal]
  );

  const baseShelfProducts = useMemo(() => {
    const bucketMatches = goalFilteredProducts.filter((product) => productMatchesWealthCategory(product, selectedCategory));

    if (bucketMatches.length > 0) return bucketMatches;

    return recommendedProducts;
  }, [goalFilteredProducts, recommendedProducts, selectedCategory]);
  const normalizedShelfSearchQuery = shelfSearchQuery.trim().toLowerCase();
  const searchableShelfProducts = useMemo(() => {
    if (!normalizedShelfSearchQuery) return baseShelfProducts;

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
  }, [baseShelfProducts, normalizedShelfSearchQuery]);

  const wealthQuestRows = [
    {
      id: 'surface',
      title: 'Choose one wealth block',
      copy: 'Pick Park Cash, Earn, xStocks / Public, Private Watchlist, or Auto / Managed before looking at products.',
      done: Boolean(selectedGoal)
    },
    {
      id: 'type-filter',
      title: 'Use product-type filter',
      copy: 'Confirm that Cash, Public, Private, Earn, and Auto are not mixed into one flat product lane.',
      done: selectedCategory !== 'all'
    },
    {
      id: 'facts',
      title: 'Read 5 ownership lines',
      copy: 'Every product card now shows What you own, How you earn, Liquidity, Main risk, and Rights.',
      done: Boolean(expandedProductId) || selectedDetailTopics.includes('flow')
    },
    {
      id: 'automation',
      title: 'Check auto permissions',
      copy: 'Automation should say what it can do, what it cannot do, when it pauses, and who can override.',
      done: selectedGoal === 'auto' || selectedDetailTopics.includes('automation')
    },
    {
      id: 'receipt',
      title: 'Simulate one receipt',
      copy: 'Subscribe in demo mode to see the wallet receipt, rights, and liquidity framing stay linked.',
      done: Object.keys(wealthState.positions || {}).length > 0
    }
  ];
  const shelfMetricsMap = useMemo(
    () =>
      new Map(
        searchableShelfProducts.map((product) => {
          const diligenceModel = buildDiligenceModel(product, day1BriefState.data);
          return [
            product.id,
            {
              score: diligenceModel.finalScore,
              baseScore: diligenceModel.baseScore,
              signalAdjustment: diligenceModel.signalAdjustment,
              annualYieldRate: getAnnualYieldRate(product),
              annualYieldBasis: getAnnualYieldBasis(product),
              nav: product.nav,
              risk: product.risk
            }
          ];
        })
      ),
    [day1BriefState.data, searchableShelfProducts]
  );
  const shelfProducts = searchableShelfProducts;

  useEffect(() => {
    if (!shelfProducts.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(shelfProducts[0]?.id || liveProducts[0]?.id || WEALTH_PRODUCTS[0].id);
    }
  }, [liveProducts, selectedProductId, shelfProducts]);

  useEffect(() => {
    if (expandedProductId && !shelfProducts.some((product) => product.id === expandedProductId)) {
      setExpandedProductId(null);
    }
  }, [expandedProductId, shelfProducts]);

  useEffect(() => {
    setIsSubscribeModalOpen(false);
  }, [selectedProductId]);

  useEffect(() => {
    setPendingScrollProductId(null);
  }, [selectedGoal, selectedCategory, shelfSearchQuery]);

  useEffect(() => {
    setCompareProductIds((current) => {
      const validIds = current.filter((productId) => liveProducts.some((product) => product.id === productId));
      if (validIds.length > 0) return [...new Set(validIds)].slice(0, MAX_COMPARE_PRODUCTS);

      return [...new Set([selectedProductId, ...recommendedProducts.map((product) => product.id)])].slice(0, MAX_COMPARE_PRODUCTS);
    });
  }, [liveProducts, recommendedProducts, selectedProductId]);

  const selectedProduct = useMemo(() => getProductByIdFrom(liveProducts, selectedProductId), [liveProducts, selectedProductId]);
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
    holdings: [],
    feeStack: [],
    whyEarns: '',
    worryCopy: ''
  };
  const selectedDiligenceModel = useMemo(
    () => buildDiligenceModel(selectedProduct, day1BriefState.data),
    [day1BriefState.data, selectedProduct]
  );
  const selectedResearchView = selectedDiligenceModel.researchView;
  const tutorialNetPreview = getTutorialNetPreview(selectedProduct);
  const tutorialNetGain = roundNumber(tutorialNetPreview.netValue - 1000, 2);

  const milestoneCount = [
    isConnected,
    Boolean(hasMintedBadgeOnchain),
    guideTaskDone,
    quizTaskDone,
    paperTaskDone
  ].filter(Boolean).length;

  const milestoneBonus = milestoneCount * WEALTH_MILESTONE_BONUS;
  const availableCash = wealthState.cash + milestoneBonus;

  const portfolioRows = useMemo(
    () =>
      Object.entries(wealthState.positions)
        .map(([productId, position]) => {
          const product = productMap[productId];
          if (!product) return null;

          const currentValue = roundNumber(position.shares * product.nav, 2);
          const pnl = roundNumber(currentValue - position.principal, 2);

          return {
            ...product,
            shares: position.shares,
            principal: position.principal,
            currentValue,
            pnl
          };
        })
        .filter(Boolean),
    [productMap, wealthState.positions]
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

  const selectedPosition = wealthState.positions[selectedProduct.id] || { shares: 0, principal: 0 };
  const selectedPositionValue = roundNumber(selectedPosition.shares * selectedProduct.nav, 2);
  const selectedPositionPnl = roundNumber(selectedPositionValue - selectedPosition.principal, 2);
  const selectedCollateralState = wealthState.collateral?.[selectedProduct.id] || { pledgedShares: 0, borrowedAmount: 0 };
  const selectedPledgedShares = roundNumber(Math.min(selectedPosition.shares || 0, selectedCollateralState.pledgedShares || 0), 6);
  const selectedBorrowedAmount = roundNumber(selectedCollateralState.borrowedAmount || 0, 2);
  const selectedFreeShares = roundNumber(Math.max(0, (selectedPosition.shares || 0) - selectedPledgedShares), 6);
  const selectedFreeValue = roundNumber(selectedFreeShares * selectedProduct.nav, 2);
  const selectedCollateralValue = roundNumber(selectedPledgedShares * selectedProduct.nav, 2);
  const selectedMaxBorrowValue = roundNumber(selectedCollateralValue * COLLATERAL_ADVANCE_RATE, 2);
  const selectedRemainingBorrowCapacity = roundNumber(Math.max(0, selectedMaxBorrowValue - selectedBorrowedAmount), 2);
  const selectedCollateralLtv = selectedCollateralValue > 0 ? selectedBorrowedAmount / selectedCollateralValue : 0;
  const selectedMinimumTicket = Math.max(WEALTH_MIN_SUBSCRIPTION, selectedProduct.minSubscription);

  useEffect(() => {
    if (!isCollateralPilotProduct(selectedProduct)) return;
    setCollateralBorrowInput(selectedBorrowedAmount);
  }, [selectedBorrowedAmount, selectedProduct]);

  const estimatedShares = Number.isFinite(Number(allocationAmount))
    ? roundNumber(Number(allocationAmount) / selectedProduct.nav, 6)
    : 0;
  const simulatedTicketAmount = Number.isFinite(Number(allocationAmount)) && Number(allocationAmount) > 0 ? Number(allocationAmount) : selectedMinimumTicket;
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
  const selectedMarketSource = selectedProduct?.marketSource || 'MSX demo snapshot';
  const selectedAsOfLabel = selectedProduct?.asOfLabel || 'Static demo snapshot';
  const wealthVaultSnapshot = useMemo(() => {
    const attestedAtSeconds = Number(vaultLastAttestedAt || 0n);
    const attestationAgeMs = attestedAtSeconds > 0 ? Date.now() - attestedAtSeconds * 1000 : Number.POSITIVE_INFINITY;
    const attestationFresh = Number.isFinite(attestationAgeMs) && attestationAgeMs <= 3 * DAY_MS;
    const navRatio = Number(vaultNavBps || 0n) / 10000;
    const minimumOnchainTicket = Number(vaultMinSubscription || 0n) / WEALTH_VAULT_ASSET_SCALE;
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
    ? new Date(day1BriefState.data.timestamp).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
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
            nav: metrics.nav,
            risk: metrics.risk
          };
        })
        .filter(Boolean)
        .sort((left, right) => right.annualYieldRate - left.annualYieldRate || right.score - left.score)
        .slice(0, LEADERBOARD_LIMIT),
    [shelfMetricsMap, shelfProducts]
  );

  useEffect(() => {
    if (!pendingScrollProductId) return;
    const targetNode =
      productDetailRefs.current.get(pendingScrollProductId) || productCardRefs.current.get(pendingScrollProductId);
    if (!targetNode) return;
    targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPendingScrollProductId(null);
  }, [expandedProductId, pendingScrollProductId, shelfProducts]);

  function handleConnect() {
    if (!metaMaskConnector) return;
    connect({ connector: metaMaskConnector });
  }

  function focusProduct(productId) {
    if (shelfProducts.some((product) => product.id === productId)) {
      if (expandedProductId === productId) {
        setExpandedProductId(null);
        setSelectedDetailTopics([]);
        setPendingScrollProductId(null);
        return;
      }

      startTransition(() => {
        setSelectedProductId(productId);
        setExpandedProductId(productId);
        setSelectedDetailTopics(['flow']);
        setPendingScrollProductId(productId);
      });
      return;
    }

    setSelectedProductId(productId);
    setExpandedProductId(productId);
    setSelectedDetailTopics(['flow']);
    setPendingScrollProductId(productId);
  }

  function handleToggleProduct(productId) {
    if (expandedProductId === productId) {
      setExpandedProductId(null);
      setSelectedDetailTopics([]);
      setPendingScrollProductId(null);
      return;
    }

    setSelectedProductId(productId);
    setExpandedProductId(productId);
    setSelectedDetailTopics(['flow']);
    setPendingScrollProductId(productId);
  }

  function toggleDetailTopic(topicId) {
    setSelectedDetailTopics((current) => (current[0] === topicId ? [] : [topicId]));
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

  function handleOpenSubscribeModal() {
    if (subscriptionValidationMessage) {
      setFeedback(subscriptionValidationMessage);
      return;
    }

    setIsSubscribeModalOpen(true);
  }

  function handleConfirmSubscribe() {
    const requestedAmount = Number(allocationAmount);

    if (subscriptionValidationMessage) {
      setFeedback(subscriptionValidationMessage);
      return;
    }

    const sharesMinted = roundNumber(requestedAmount / selectedProduct.nav, 6);

    setWealthState((current) => {
      const currentPosition = current.positions[selectedProduct.id] || { shares: 0, principal: 0 };

      return {
        cash: roundNumber(current.cash - requestedAmount, 2),
        positions: {
          ...current.positions,
          [selectedProduct.id]: {
            shares: roundNumber(currentPosition.shares + sharesMinted, 6),
            principal: roundNumber(currentPosition.principal + requestedAmount, 2)
          }
        }
      };
    });

    setFeedback(
      `Simulated subscription placed: ${requestedAmount.toLocaleString()} PT into ${selectedProduct.name}. Demo wallet received ${sharesMinted.toLocaleString()} ${selectedProduct.shareToken} shares.`
    );
    setIsSubscribeModalOpen(false);
  }

  function handleUseAsCollateral() {
    if (!isCollateralPilotProduct(selectedProduct)) {
      setFeedback('Collateral simulation is live on the USTB pilot first. Once the flow looks right, we can expand it to more products.');
      return;
    }

    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so the pledged receipt and borrowed PT stay mapped to one wallet.');
      return;
    }

    if (!selectedPosition.shares) {
      setFeedback('Buy the USTB pilot first. You need wallet-linked receipt shares before they can be pledged as collateral.');
      return;
    }

    const nextBorrowTarget = roundNumber(Number(collateralBorrowInput || 0), 2);
    const collateralShares = roundNumber(selectedPosition.shares, 6);
    const collateralValue = roundNumber(collateralShares * selectedProduct.nav, 2);
    const maxBorrowable = roundNumber(collateralValue * COLLATERAL_ADVANCE_RATE, 2);

    if (!Number.isFinite(nextBorrowTarget) || nextBorrowTarget <= 0) {
      setFeedback('Enter a positive PT borrow target first.');
      return;
    }

    if (nextBorrowTarget <= selectedBorrowedAmount) {
      setFeedback('This borrow target is not above the current borrowed balance. Use repay and release when you want to unwind the collateral flow.');
      return;
    }

    if (nextBorrowTarget > maxBorrowable) {
      setFeedback(`This USTB pilot can only borrow up to ${maxBorrowable.toLocaleString()} PT at the current 70% advance rate.`);
      return;
    }

    const borrowDelta = roundNumber(nextBorrowTarget - selectedBorrowedAmount, 2);

    setWealthState((current) => ({
      ...current,
      cash: roundNumber(current.cash + borrowDelta, 2),
      collateral: {
        ...(current.collateral || {}),
        [selectedProduct.id]: {
          pledgedShares: collateralShares,
          borrowedAmount: nextBorrowTarget
        }
      }
    }));

    setFeedback(
      `USTB collateral activated: ${collateralShares.toLocaleString()} ${selectedProduct.shareToken} shares are now pledged. Borrowed balance is ${nextBorrowTarget.toLocaleString()} PT and can be redeployed into other sleeves.`
    );
  }

  function handleReleaseCollateral() {
    if (!isCollateralPilotProduct(selectedProduct)) {
      setFeedback('Collateral simulation is currently enabled only for the USTB pilot.');
      return;
    }

    if (!selectedPledgedShares || !selectedBorrowedAmount) {
      setFeedback('No pledged USTB receipt is active for this wallet right now.');
      return;
    }

    if (wealthState.cash < selectedBorrowedAmount) {
      setFeedback(
        `Repay ${selectedBorrowedAmount.toLocaleString()} PT first. The wallet currently has ${wealthState.cash.toLocaleString()} PT of cash before milestone bonus buying power is counted.`
      );
      return;
    }

    setWealthState((current) => {
      const nextCollateral = { ...(current.collateral || {}) };
      delete nextCollateral[selectedProduct.id];

      return {
        ...current,
        cash: roundNumber(current.cash - selectedBorrowedAmount, 2),
        collateral: nextCollateral
      };
    });

    setFeedback(
      `USTB collateral released: repaid ${selectedBorrowedAmount.toLocaleString()} PT and unlocked ${selectedPledgedShares.toLocaleString()} ${selectedProduct.shareToken} shares for normal redemption again.`
    );
  }

  function handleRedeem() {
    const requestedAmount = Number(allocationAmount);

    if (!isConnected || !address) {
      setFeedback('Connect MetaMask first so redemptions can resolve against the wallet-linked demo state.');
      return;
    }

    if (isClosedEndProduct(selectedProduct)) {
      setFeedback('This sleeve is closed-ended. It cannot be redeemed early in the current flow, so use the maturity preview instead.');
      return;
    }

    if (!selectedPosition.shares) {
      setFeedback('No share balance is available to redeem for this product yet.');
      return;
    }

    if (selectedFreeShares <= 0) {
      setFeedback('All current shares are pledged as collateral. Repay and release them before trying to redeem this sleeve.');
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

    setWealthState((current) => {
      const nextPositions = { ...current.positions };

      if (remainingShares <= 0) {
        delete nextPositions[selectedProduct.id];
      } else {
        nextPositions[selectedProduct.id] = {
          shares: remainingShares,
          principal: roundNumber(Math.max(0, selectedPosition.principal - principalReduction), 2)
        };
      }

      return {
        cash: roundNumber(current.cash + redeemValue, 2),
        positions: nextPositions
      };
    });

    setFeedback(
      `Simulated redemption placed: ${redeemValue.toLocaleString()} PT from ${selectedProduct.name}. ${sharesToBurn.toLocaleString()} ${selectedProduct.shareToken} shares were burned in the demo ledger.`
    );
  }

  function handlePreviewMaturity() {
    setFeedback(
      `Scenario preview for ${selectedProduct.name}: on ${selectedProduct.scenario.horizon.toLowerCase()}, 1,000 PT could look like ${selectedProduct.scenario.conservative} in the conservative case, ${selectedProduct.scenario.base} in the base case, or ${selectedProduct.scenario.pressure} in pressure conditions.`
    );
  }

  function handleResetPortfolio() {
    setWealthState(defaultWealthState());
    setFeedback('Wealth demo portfolio reset for this wallet. Starter cash and empty share balances were restored.');
  }

  function renderCompareSection() {
    return (
      <section className="card wealth-compare-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">Product compare</div>
            <h2>Compare rebased NAV paths before you open one detail</h2>
          </div>
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

  function renderSelectedProductDetail() {
    return (
      <div
        className="wealth-expanded-detail"
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

        <div className="wealth-detail-topic-strip">
          <div>
            <div className="eyebrow">Detail focus</div>
            <div className="muted">Pick one block at a time. Click the same block again to close it, or click the same product card again to hide the whole detail area.</div>
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
          <div className="wealth-detail-topic-helper">
            {activeDetailTopicMeta ? (
              <>
                <strong>What to do here.</strong> {activeDetailTopicMeta.helper}
              </>
            ) : (
              <>
                <strong>All detail blocks are closed.</strong> Pick one focus chip above to open a single guided section.
              </>
            )}
          </div>
        </div>

        {selectedProductLocked ? <div className="wealth-inline-note">{selectedUnlockCopy}</div> : null}

        <div className="wealth-detail-stack">
          {selectedDetailTopics.includes('snapshot') ? (
            <div className="paper-mode-card wealth-detail-section">
              <div className="route-highlight wealth-detail-banner">
                <strong>{selectedProduct.status}</strong> / {selectedProduct.liveTieIn}
              </div>
              <div className="wealth-market-caption wealth-market-banner">
                {selectedAsOfLabel} / {selectedMarketSource} / {shelfStatusCopy}
              </div>
              <p className="hero-text wealth-detail-copy">{selectedProduct.humanSummary}</p>

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
                  <div className="label">Annual yield</div>
                  <div className={`value ${getAnnualYieldRate(selectedProduct) >= 0 ? 'risk-low' : 'risk-high'}`}>
                    {formatYieldPercent(getAnnualYieldRate(selectedProduct))}
                  </div>
                </div>
                <div>
                  <div className="label">Yield basis</div>
                  <div className="value">{getAnnualYieldBasis(selectedProduct)}</div>
                </div>
              </div>

              <div className="kv wealth-detail-kv">
                <div>
                  <div className="k">Annual yield</div>
                  <div className="v">{formatYieldPercent(getAnnualYieldRate(selectedProduct))}</div>
                </div>
                <div>
                  <div className="k">Yield basis</div>
                  <div className="v">{getAnnualYieldBasis(selectedProduct)}</div>
                </div>
                <div>
                  <div className="k">Term structure</div>
                  <div className="v">{getTermTypeLabel(selectedProduct)}</div>
                </div>
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

              <div className="wealth-inline-note paper-inline-note">
                <strong>Yield data source.</strong> {getAnnualYieldSource(selectedProduct)}
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

              <DetailNavChart series={selectedNavPoints} />

              {isCollateralPilotProduct(selectedProduct) ? (
                <div className="wealth-pilot-grid">
                  <div className="paper-mode-card wealth-subpanel-card">
                    <div className="product-title">Fast-forward demo</div>
                    <div className="muted">
                      Instead of waiting days, jump forward and inspect what this open-ended USTB sleeve could look like if the displayed annual yield carries forward.
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
                      <strong>{selectedFastForwardOption.label} preview.</strong> {selectedFastForwardOption.description} This uses the displayed annual yield for a fast demo path, so the point is to visualize carry without forcing the judge to wait.
                    </div>
                  </div>

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
                <span className={`pill ${riskClass(selectedProduct.risk)}`}>{selectedProduct.riskNote}</span>
              </div>

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

              <div className="paper-balance-strip wealth-balance-strip">
                <div className="paper-balance-box">
                  <div className="label">Current shares</div>
                  <div className="value">{formatShareBalance(selectedPosition.shares, hideBalances)}</div>
                </div>
                <div className="paper-balance-box">
                  <div className="label">Current value</div>
                  <div className="value">{formatValue(selectedPositionValue, hideBalances)}</div>
                </div>
                <div className="paper-balance-box">
                  <div className="label">PnL</div>
                  <div className={`value ${selectedPositionPnl >= 0 ? 'risk-low' : 'risk-high'}`}>
                    {formatSignedValue(selectedPositionPnl, hideBalances)}
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
                    <div className="label">Borrowed PT</div>
                    <div className={`value ${selectedBorrowedAmount > 0 ? 'risk-medium' : 'risk-low'}`}>
                      {formatValue(selectedBorrowedAmount, hideBalances)}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="toolbar">
                <button className="primary-btn" onClick={handleOpenSubscribeModal} disabled={selectedProductLocked}>
                  Review and buy
                </button>
                <button
                  className="secondary-btn"
                  onClick={isClosedEndProduct(selectedProduct) ? handlePreviewMaturity : handleRedeem}
                >
                  {isClosedEndProduct(selectedProduct)
                    ? 'Preview maturity'
                    : 'Redeem selected sleeve'}
                </button>
              </div>

              <div className="product-title" style={{ marginTop: 16 }}>Approve, subscribe, and exit preview</div>
              <FlowPreviewGrid cards={flowPreviewCards} />

              <div className="product-title" style={{ marginTop: 16 }}>Future wallet call preview</div>
              <ModeledCallGrid cards={modeledCallCards} />

              <div className="env-hint">
                <strong>Token mechanic.</strong> {selectedProduct.shareToken} is treated as the receipt: subscribe mints it, redeem or maturity burns it,
                and the final net value should be explained after fee, tax, and route drag.
              </div>

              <div className="wealth-contract-grid" style={{ marginTop: 16 }}>
                {onchainMechanics.map((item) => (
                  <div className="reason-card wealth-contract-card" key={item.title}>
                    <div className="entry-title">{item.title}</div>
                    <div className="entry-copy">{item.copy}</div>
                  </div>
                ))}
              </div>

              {isCollateralPilotProduct(selectedProduct) ? (
                <div className="wealth-pilot-grid">
                  <div className="paper-mode-card wealth-subpanel-card">
                    <div className="product-title">Use this receipt as collateral</div>
                    <div className="muted">
                      Pilot flow on USTB only: buy the receipt, pledge it, borrow PT against it, then decide whether to deploy that PT elsewhere or repay and unlock the receipt.
                    </div>

                    <label className="wealth-field">
                      Borrow target
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
                        <div className="value">{formatValue(selectedCollateralValue, hideBalances)}</div>
                      </div>
                      <div>
                        <div className="label">Max borrow @ 70%</div>
                        <div className="value">{formatValue(selectedMaxBorrowValue, hideBalances)}</div>
                      </div>
                      <div>
                        <div className="label">Current LTV</div>
                        <div className={`value ${selectedCollateralLtv >= COLLATERAL_WARNING_LTV ? 'risk-high' : selectedCollateralLtv > 0 ? 'risk-medium' : 'risk-low'}`}>
                          {formatYieldPercent(selectedCollateralLtv, hideBalances)}
                        </div>
                      </div>
                    </div>

                    <div className="toolbar">
                      <button className="primary-btn" onClick={handleUseAsCollateral}>
                        Borrow PT against USTB
                      </button>
                      <button className="secondary-btn" onClick={handleReleaseCollateral}>
                        Repay and release
                      </button>
                    </div>

                    <div className="wealth-inline-note paper-inline-note">
                      <strong>Wallet path.</strong> Buy PT into USTB, mint the receipt, optionally pledge the receipt, borrow PT, invest elsewhere, then repay to unlock the receipt before normal redemption.
                    </div>
                  </div>

                  <div className="paper-mode-card wealth-subpanel-card">
                    <div className="product-title">Collateral guardrails</div>
                    <div className="starter-reasons">
                      <div className="reason-card">
                        <div className="entry-title">Redeem lock</div>
                        <div className="entry-copy">
                          Pledged receipt shares are not redeemable. Only the free share balance can burn back into PT.
                        </div>
                      </div>
                      <div className="reason-card">
                        <div className="entry-title">Borrowing power</div>
                        <div className="entry-copy">
                          Remaining borrow capacity is {formatValue(selectedRemainingBorrowCapacity, hideBalances)}. This keeps the demo close to a simple collateral ratio instead of letting leverage float invisibly.
                        </div>
                      </div>
                      <div className="reason-card">
                        <div className="entry-title">Risk line</div>
                        <div className="entry-copy">
                          Once LTV moves past {(COLLATERAL_WARNING_LTV * 100).toFixed(0)}%, the card flips into watch mode. In a live version, that is where unwind or margin-call logic would start.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

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
            <div className="paper-mode-card wealth-detail-section">
              <div className="product-top">
                <div>
                  <div className="eyebrow">AI Risk + Research View</div>
                  <div className="product-title">How the rubric, Day1 overlay, and stance fit together</div>
                  <div className="muted">
                    Product diligence stays primary, then Day1-style macro and sentiment overlays refine the current stance.
                  </div>
                </div>
                <div className="wealth-header-pill-row">
                  <span className={`pill ${selectedResearchView.stance.tone}`}>{selectedResearchView.stance.label}</span>
                  <span className="pill risk-low">Final score {selectedDiligenceModel.finalScore}/100</span>
                </div>
              </div>

              <div className="wealth-judge-grid">
                <div className="guide-chip">
                  <div className="k">Base rubric</div>
                  <div className="v">{selectedDiligenceModel.baseScore}/100</div>
                  <div className="muted">Weighted product checks plus a small bucket baseline for shelf complexity.</div>
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
            <div className="wealth-inline-note">All detail blocks are closed. Pick one focus chip above when you want to reopen a guided section.</div>
          ) : null}
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
            <div className="eyebrow">MSX Hackathon Demo</div>
            <div className="brand-name">{t('MSX Wealth Hub', 'MSX 理财中心')}</div>
          </div>
        </div>

        <div className="header-actions">
          <LanguageToggle uiLanguage={uiLanguage} setUiLanguage={setUiLanguage} compact />
          <a className="ghost-btn compact" href="./index.html#wealth">
            {t('Back to welcome', '返回主页')}
          </a>

          <div className="paper-token-pill wealth-pill">
            <div className="paper-token-label">{t('Available PT balance', '可用 PT 余额')}</div>
            <div className="paper-token-value">{formatValue(availableCash, hideBalances)}</div>
            <div className="paper-token-tooltip">
              <div className="paper-token-tooltip-title">{t('How this works', '说明')}</div>
              <div>
                {t(
                  `Demo wealth cash starts at ${WEALTH_STARTING_CASH.toLocaleString()} PT. Each completed onboarding milestone adds ${WEALTH_MILESTONE_BONUS.toLocaleString()} PT of preview buying power.`,
                  `理财页演示资金从 ${WEALTH_STARTING_CASH.toLocaleString()} PT 开始，每完成一个 onboarding 里程碑会额外增加 ${WEALTH_MILESTONE_BONUS.toLocaleString()} PT 的预览购买力。`
                )}
              </div>
            </div>
          </div>

          {isConnected ? (
            <div className="ghost-btn wallet-header-btn connected">{t(`Wallet connected ${walletDisplayName}`, `钱包已连接 ${walletDisplayName}`)}</div>
          ) : (
            <button className="ghost-btn wallet-header-btn" onClick={handleConnect} disabled={isPending}>
              {isPending ? t('Connecting to MetaMask...', '正在连接 MetaMask...') : t('Connect MetaMask', '连接 MetaMask')}
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="card wealth-hero-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t('Goal-first wealth', '目标优先的理财')}</div>
              <h1 style={{ maxWidth: 980 }}>{t('Build a clearer RWA and wealth shelf before asking users to trade.', '在要求用户交易之前，先把 RWA 与理财货架讲清楚。')}</h1>
            </div>

            <button className="ghost-btn compact" onClick={() => setHideBalances((current) => !current)}>
              {hideBalances ? t('Show values', '显示数值') : t('Hide values', '隐藏数值')}
            </button>
          </div>

          <p className="hero-text">
            {t(
              'This wealth page borrows the shelf logic from large CEX earn products, but adapts it for MSX: explain the underlying, show the source of return, attach wallet-native share receipts, and gate advanced products with risk and quiz progress instead of hiding everything behind strategy jargon.',
              '这个理财页借鉴了大型 CEX Earn 产品的货架逻辑，但针对 MSX 做了改造：解释底层资产、展示收益来源、附上钱包原生份额凭证，并用风险与测验进度来解锁高级产品，而不是把一切都藏在策略术语后面。'
            )}
          </p>

          <div className="hero-points">
            <span className="pill risk-low">{t('Goal-based routing', '基于目标的路由')}</span>
            <span className="pill risk-low">{t('RWA and quant shelves', 'RWA 与量化货架')}</span>
            <span className="pill risk-medium">{t('AI diligence layer', 'AI 尽调层')}</span>
            <span className="pill risk-medium">{t('Tokenized share receipts', '代币化份额凭证')}</span>
          </div>

          <div className="wealth-summary-grid">
            <div className="wealth-summary-block">
              <div className="label">{t('Total invested', '总投入')}</div>
              <div className="wealth-summary-value">{formatValue(totalInvested, hideBalances)}</div>
              <div className="muted">Approx. {formatValue(totalInvested, hideBalances, 0, ' PT')}</div>
              <div className="wealth-summary-mini">
                <div className="wealth-summary-mini-row">
                  <span>Closed-ended</span>
                  <strong>{formatValue(closedEndedValue, hideBalances, 0, ' PT')}</strong>
                </div>
                <div className="wealth-summary-mini-row">
                  <span>Open-ended</span>
                  <strong>{formatValue(openEndedValue, hideBalances, 0, ' PT')}</strong>
                </div>
              </div>
            </div>

            <div className="wealth-summary-block">
              <div className="label">{t('Total return', '总收益')}</div>
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
                  <span>Closed-ended sleeves</span>
                  <strong>{formatValue(closedEndedValue, hideBalances, 0, ' PT')}</strong>
                </div>
              </div>
            </div>

            <div className="wealth-summary-block">
              <div className="label">{t('Portfolio annual yield', '组合年化收益')}</div>
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

        <section className="card">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t('Entry routing', '进入路由')}</div>
              <h2>{t('Start from the outcome, then reveal ownership, yield, liquidity, rights, and automation permissions', '先从结果目标出发，再展示持有什么、怎么赚、流动性、权利和自动化权限')}</h2>
            </div>
          </div>

          <div className="wealth-surface-grid">
            {GOAL_OPTIONS.map((goal) => {
              const surfaceNote = WEALTH_HOME_SURFACE_NOTES[goal.id] || WEALTH_HOME_SURFACE_NOTES.earn;
              return (
                <button
                  key={goal.id}
                  className={`wealth-surface-card ${selectedGoal === goal.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedGoal(goal.id);
                    setSelectedCategory(goal.id === 'parkCash' ? 'cash' : goal.id === 'public' ? 'public' : goal.id === 'private' ? 'private' : goal.id === 'auto' ? 'auto' : 'earn');
                  }}
                >
                  <span>{surfaceNote.layer}</span>
                  <strong>{goal.label}</strong>
                  <p>{goal.description}</p>
                  <p><strong>What you own:</strong> {surfaceNote.owns}</p>
                  <p><strong>How you earn:</strong> {surfaceNote.earn}</p>
                  <p><strong>Liquidity:</strong> {surfaceNote.liquidity}</p>
                  <p><strong>Rights:</strong> {surfaceNote.rights}</p>
                  <p><strong>Auto:</strong> {surfaceNote.auto}</p>
                </button>
              );
            })}
          </div>

          <div className="wealth-filter-row">
            {CATEGORY_OPTIONS.map((category) => (
              <button
                key={category.id}
                className={`risk-card-tab ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>

            <div className="route-highlight" style={{ marginTop: 18 }}>
              <strong>{t('Recommended for this goal:', '这个目标下推荐：')}</strong> {recommendedProducts.map((product) => product.name).join(', ') || 'Use the matching product-type filter first.'}.
            </div>

            <div className="wealth-quest-grid" style={{ marginTop: 14 }}>
              {wealthQuestRows.map((quest) => (
                <div key={quest.id} className={`wealth-quest-card ${quest.done ? 'done' : ''}`}>
                  <span>{quest.done ? 'Done' : 'To do'}</span>
                  <strong>{quest.title}</strong>
                  <p>{quest.copy}</p>
                </div>
              ))}
            </div>
          </section>

        <section className="wealth-shelf-shell">
          <div className="wealth-shelf-main">
            <section className="card">
              <div className="section-head">
                <div>
                  <div className="eyebrow">Product shelf</div>
                  <h2>{currentGoal.label}</h2>
                </div>
                <span className={`pill ${liveSnapshotState === 'fallback' ? 'risk-medium' : 'risk-low'}`}>
                  {shelfProducts.length} products in view
                </span>
              </div>

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

              {shelfProducts.length ? (
                <div className="wealth-product-row">
                  {shelfProducts.map((product) => {
                  const unlockCopy = getUnlockCopy(product, unlockProgress);
                  const isLocked = Boolean(unlockCopy);
                  const productNavPeriod = productNavPeriods[product.id] || '30d';
                  const productWindowLabel = NAV_PERIOD_OPTIONS.find((period) => period.id === productNavPeriod)?.label || '30D';
                  const sparkSeries = normalizeNavSeries(product.navHistory?.[productNavPeriod] || [], productNavPeriod);
                  const sparkDeltaPercent = getNavDeltaPercent(sparkSeries);
                  const productAnnualYield = getAnnualYieldRate(product);
                  const productFactRows = getWealthProductFactRows(product);
                  const isExpanded = expandedProductId === product.id;

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
                        onClick={() => handleToggleProduct(product.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleToggleProduct(product.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="product-top">
                          <div>
                            <div className="product-title">{product.name}</div>
                            <div className="muted">
                              {product.productType} / {getTermTypeLabel(product)} / {product.status}
                            </div>
                            <div className="wealth-market-caption">
                              {product.asOfLabel || 'Static demo snapshot'} / {product.marketSource || 'MSX demo snapshot'}
                            </div>
                          </div>
                          <span className={`pill ${riskClass(product.risk)}`}>{product.risk}</span>
                        </div>

                        <div className="muted">{product.humanSummary}</div>

                        <div className="wealth-product-fact-grid">
                          {productFactRows.map((row) => (
                            <div key={row.label} className="wealth-product-fact-card">
                              <span>{row.label}</span>
                              <strong>{row.value}</strong>
                              <p>{row.copy}</p>
                            </div>
                          ))}
                        </div>

                        <div className="kv wealth-card-kv">
                          <div>
                            <div className="k">Annual yield</div>
                            <div className="v">{formatYieldPercent(productAnnualYield)}</div>
                            <div className="wealth-mini-note">{getAnnualYieldBasis(product)}</div>
                          </div>
                          <div>
                            <div className="k">Base asset</div>
                            <div className="v">{product.baseAsset}</div>
                          </div>
                        </div>

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
                            <span>Annual yield</span>
                            <strong className={productAnnualYield >= 0 ? 'risk-low' : 'risk-high'}>
                              {formatYieldPercent(productAnnualYield)}
                            </strong>
                          </div>
                          <div className="wealth-mini-stat">
                            <span>{productWindowLabel} return</span>
                            <strong className={sparkDeltaPercent >= 0 ? 'risk-low' : 'risk-high'}>
                              {sparkDeltaPercent >= 0 ? '+' : ''}{sparkDeltaPercent.toFixed(2)}%
                            </strong>
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

                        <DetailNavChart series={selectedNavPoints} />
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
                            <div className="product-title">Wallet share token flow and rights</div>
                            <div className="muted">
                              Simulate subscribe, mint, hold, redeem, and maturity in the same sequence a future MSX live flow would teach.
                            </div>
                          </div>
                          <span className={`pill ${riskClass(selectedProduct.risk)}`}>{selectedProduct.riskNote}</span>
                        </div>

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

                        <div className="paper-balance-strip wealth-balance-strip">
                          <div className="paper-balance-box">
                            <div className="label">Current shares</div>
                            <div className="value">{formatShareBalance(selectedPosition.shares, hideBalances)}</div>
                          </div>
                          <div className="paper-balance-box">
                            <div className="label">Current value</div>
                            <div className="value">{formatValue(selectedPositionValue, hideBalances)}</div>
                          </div>
                          <div className="paper-balance-box">
                            <div className="label">PnL</div>
                            <div className={`value ${selectedPositionPnl >= 0 ? 'risk-low' : 'risk-high'}`}>
                              {formatSignedValue(selectedPositionPnl, hideBalances)}
                            </div>
                          </div>
                        </div>

                        <div className="toolbar">
                          <button className="primary-btn" onClick={handleOpenSubscribeModal} disabled={selectedProductLocked}>
                            Review and subscribe
                          </button>
                          <button
                            className="secondary-btn"
                            onClick={selectedProduct.bucket === 'fixed' || selectedProduct.bucket === 'structured' ? handlePreviewMaturity : handleRedeem}
                          >
                            {selectedProduct.bucket === 'fixed' || selectedProduct.bucket === 'structured'
                              ? 'Preview maturity'
                              : 'Redeem selected sleeve'}
                          </button>
                        </div>

                        <div className="product-title" style={{ marginTop: 16 }}>Approve, subscribe, and exit preview</div>
                        <FlowPreviewGrid cards={flowPreviewCards} />

                        <div className="product-title" style={{ marginTop: 16 }}>Future wallet call preview</div>
                        <ModeledCallGrid cards={modeledCallCards} />

                        <div className="env-hint">
                          <strong>Token mechanic.</strong> {selectedProduct.shareToken} is treated as the receipt: subscribe mints it, redeem or maturity burns it,
                          and the final net value should be explained after fee, tax, and route drag.
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
                      <div className="paper-mode-card wealth-detail-section">
                        <div className="product-top">
                          <div>
                            <div className="eyebrow">AI Risk + Research View</div>
                            <div className="product-title">How the rubric, Day1 overlay, and stance fit together</div>
                            <div className="muted">
                              Product diligence stays primary, then Day1-style macro and sentiment overlays refine the current stance.
                            </div>
                          </div>
                          <div className="wealth-header-pill-row">
                            <span className={`pill ${selectedResearchView.stance.tone}`}>{selectedResearchView.stance.label}</span>
                            <span className="pill risk-low">Final score {selectedDiligenceModel.finalScore}/100</span>
                          </div>
                        </div>

                        <div className="wealth-judge-grid">
                          <div className="guide-chip">
                            <div className="k">Base rubric</div>
                            <div className="v">{selectedDiligenceModel.baseScore}/100</div>
                            <div className="muted">Weighted product checks plus a small bucket baseline for shelf complexity.</div>
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
          </div>

          <aside className="card wealth-ranking-sidebar">
            <div className="section-head">
              <div>
                <div className="eyebrow">Leaderboard</div>
                <h2>Annual yield leaderboard</h2>
              </div>
            </div>

            <div className="muted">
              Top 10 shelves by displayed annual yield. AI score stays beside each row so return never appears without diligence context.
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
                      {row.annualYieldBasis} / AI {row.score} / NAV {row.nav.toFixed(3)}
                    </div>
                  </div>
                  <div className={`wealth-leader-move ${row.annualYieldRate >= 0 ? 'risk-low' : 'risk-high'}`}>
                    <div className={`pill ${riskClass(row.risk)}`}>{row.risk}</div>
                    <strong>{formatYieldPercent(row.annualYieldRate, false)}</strong>
                    <div className="wealth-leader-subtext">annual</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="wealth-inline-note paper-inline-note" style={{ marginTop: 18 }}>
              Click any row to open that product and jump straight to its detail section. The sidebar stays focused on the top 10 instead of paging through the shelf.
            </div>
          </aside>
        </section>

        {renderCompareSection()}

        <section className="card">
          <div className="section-head">
            <div>
              <div className="eyebrow">My wealth positions</div>
              <h2>Wallet-linked vault holdings</h2>
            </div>

            <button className="ghost-btn compact" onClick={handleResetPortfolio}>
              Reset wealth demo
            </button>
          </div>

          {portfolioRows.length === 0 ? (
            <div className="reason-card">
              <div className="entry-title">No wealth positions yet</div>
              <div className="entry-copy">
                Start with a treasury-style shelf like USTB, FOBXX, or OUSG if you want the clearest first allocation, then move into carry or private-credit sleeves after the risk and quiz steps.
              </div>
            </div>
          ) : (
            <div className="wealth-portfolio-grid">
              {portfolioRows.map((row) => (
                <div className="reason-card wealth-position-card" key={row.id}>
                  <div className="product-top">
                    <div>
                      <div className="product-title">{row.name}</div>
                      <div className="muted">
                        {row.productType} / {row.shareToken}
                      </div>
                    </div>
                    <span className={`pill ${riskClass(row.risk)}`}>{row.risk}</span>
                  </div>

                  <div className="kv">
                    <div>
                      <div className="k">Shares</div>
                      <div className="v">{formatShareBalance(row.shares, hideBalances)}</div>
                    </div>
                    <div>
                      <div className="k">Principal</div>
                      <div className="v">{formatValue(row.principal, hideBalances)}</div>
                    </div>
                    <div>
                      <div className="k">Current value</div>
                      <div className="v">{formatValue(row.currentValue, hideBalances)}</div>
                    </div>
                    <div>
                      <div className="k">PnL</div>
                      <div className={`v ${row.pnl >= 0 ? 'risk-low' : 'risk-high'}`}>{formatSignedValue(row.pnl, hideBalances)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

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
        onClose={() => setIsSubscribeModalOpen(false)}
        onConfirm={handleConfirmSubscribe}
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
