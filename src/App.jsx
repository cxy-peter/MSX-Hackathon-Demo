import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useSignMessage,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import './welcomeBadgeMetadata';
import { LanguageToggle, useDomTranslation, useUiLanguage } from './uiLanguage';
import {
  getWalletDisplayName,
  normalizeWalletNickname,
  readWalletNickname,
  WALLET_NICKNAME_MAX_LENGTH,
  writeWalletNickname
} from './walletNickname';
import {
  UNIFIED_PT_MILESTONE_REWARD,
  UNIFIED_PT_STARTING_BALANCE,
  getWalletProfileKey,
  getWalletProfileSummary,
  getWalletProfilePointerKey,
  readRecoveredHomePaperBalance,
  readWalletProfile,
  signAndStoreProfilePointer,
  writeWalletProfilePatch
} from './walletProfileStore';

const RISK_REVIEW_REQUIRED = 4;

const products = [
  {
    id: 'superstate-ustb',
    ticker: 'USTB',
    name: 'Superstate USTB',
    risk: 'Low',
    summary: 'Tokenized short-duration Treasury fund with visible NAV, official yield framing, and market-day redemption controls.',
    useCase: 'Cash reserve and first RWA explanation',
    beginnerFit: 'Strong',
    sourceOfReturn: 'Short-duration Treasury bill carry inside a tokenized fund share.',
    worstCase: 'Yield resets lower, access rules matter more than expected, or users mistake a fund share for unrestricted dollars.',
    firstDisclosure: 'Explain that the user owns a fund share with NAV and redemption rails, not a bank deposit.',
    reviewPrompt: 'What should the user hear first?',
    reviewOptions: [
      {
        id: 'fund-share',
        label: 'It is a tokenized fund share with NAV and redemption rules.',
        correct: true,
        feedback: 'Right. Start with ownership and liquidity mechanics before talking about yield.'
      },
      {
        id: 'free-dollar',
        label: 'It behaves like unrestricted cash with no gating or settlement steps.',
        correct: false,
        feedback: 'Too loose. USTB is cleaner than many products, but it still has fund and redemption rules.'
      },
      {
        id: 'growth-bet',
        label: 'The main attraction is directional upside if risk assets rally.',
        correct: false,
        feedback: 'That misses the point. USTB is a reserve sleeve, not a growth trade.'
      }
    ],
    quiz: {
      summary: 'Use USTB to test whether the user can separate tokenized fund shares from cash-account language.',
      successCopy: 'Correct framing: explain the share wrapper, Treasury carry, and market-day redemption path together.',
      failureCopy: 'For USTB, the first job is to explain ownership and redemption mechanics before the yield headline.',
      questions: [
        {
          id: 'owns',
          prompt: 'What does the user actually own?',
          correct: 'fund-share',
          options: [
            { id: 'fund-share', label: 'Tokenized fund shares with NAV-based redemption rules' },
            { id: 'checking-account', label: 'A checking-account style dollar balance with no transfer rules' },
            { id: 'leveraged-note', label: 'A leveraged rate note that depends on price upside' }
          ]
        },
        {
          id: 'returnSource',
          prompt: 'What drives the return here?',
          correct: 'treasury-carry',
          options: [
            { id: 'treasury-carry', label: 'Short-duration Treasury bill carry inside the fund' },
            { id: 'token-burn', label: 'Token burns and reward emissions' },
            { id: 'equity-beta', label: 'Listed-equity upside and option premium' }
          ]
        },
        {
          id: 'firstDisclosure',
          prompt: 'Which disclosure must come first?',
          correct: 'nav-redemption',
          options: [
            { id: 'nav-redemption', label: 'NAV timing, redemption rails, and fund-share access rules' },
            { id: 'moonshot', label: 'The upside story if rates or crypto rally' },
            { id: 'gas-only', label: 'Gas fees are the only real thing users need to know' }
          ]
        }
      ]
    }
  },
  {
    id: 'ondo-ousg',
    ticker: 'OUSG',
    name: 'Ondo OUSG',
    risk: 'Low',
    summary: 'Treasury access product that looks simple on the surface but still needs wrapper and redemption explanation.',
    useCase: 'Treasury sleeve with cleaner reserve behavior than high-yield strategies',
    beginnerFit: 'Good',
    sourceOfReturn: 'Treasury bill income delivered through an onchain wrapper.',
    worstCase: 'Liquidity or eligibility assumptions break before the user expects them to.',
    firstDisclosure: 'Lead with the wrapper and exit path, not with a raw APY number.',
    reviewPrompt: 'What should the user compare first?',
    reviewOptions: [
      {
        id: 'ownership-exit',
        label: 'What is owned, how the wrapper works, and how redemption happens',
        correct: true,
        feedback: 'Yes. Treasury products stay understandable only if ownership and exit stay visible.'
      },
      {
        id: 'highest-apy',
        label: 'Whether the APY is the highest on the page',
        correct: false,
        feedback: 'That turns a reserve product into a yield chase, which is exactly what we want to avoid.'
      },
      {
        id: 'meme-beta',
        label: 'How fast it can move if the market becomes risk-on',
        correct: false,
        feedback: 'OUSG is not a beta expression. It should be framed as reserve and treasury access.'
      }
    ]
  },
  {
    id: 'hashnote-usyc',
    ticker: 'USYC',
    name: 'Hashnote USYC',
    risk: 'Low',
    summary: 'Yield-bearing dollar sleeve that only stays simple if the UI separates yield, fees, and collateral utility.',
    useCase: 'Operational cash that still earns something',
    beginnerFit: 'Good with explanation',
    sourceOfReturn: 'Short-duration Treasury and repo income after fund costs.',
    worstCase: 'Users chase the yield and miss fee drag, access rules, or collateral assumptions.',
    firstDisclosure: 'Show what part is fund yield and what part is wallet utility.',
    reviewPrompt: 'What misunderstanding should the card prevent?',
    reviewOptions: [
      {
        id: 'yield-not-cash',
        label: 'That a yield-bearing dollar sleeve is still a product with rules, not free cash interest',
        correct: true,
        feedback: 'Exactly. USYC works only if the app shows both the yield source and the wrapper assumptions.'
      },
      {
        id: 'only-stablecoin',
        label: 'That it is just another stablecoin with no product structure underneath',
        correct: false,
        feedback: 'Close to the issue, but be more explicit: the user still owns a product with yield, fees, and access terms.'
      },
      {
        id: 'private-equity',
        label: 'That it is basically a private-equity allocation',
        correct: false,
        feedback: 'That is the wrong risk lane. USYC belongs in the cash-and-yield lane.'
      }
    ]
  },
  {
    id: 'superstate-uscc',
    ticker: 'USCC',
    name: 'Superstate USCC',
    risk: 'Medium',
    summary: 'Strategy-style yield fund driven by basis, staking, and collateral management rather than simple Treasury carry.',
    useCase: 'Higher-income sleeve for users who already understand NAV and execution risk',
    beginnerFit: 'Needs context',
    sourceOfReturn: 'Basis capture, staking rewards, and Treasury collateral income.',
    worstCase: 'Headline yield hides execution, basis, and market risk.',
    firstDisclosure: 'Do not let users confuse strategy yield with cash parking.',
    reviewPrompt: 'Which explanation matters most here?',
    reviewOptions: [
      {
        id: 'strategy-yield',
        label: 'The yield comes from a managed strategy, not from simple cash interest',
        correct: true,
        feedback: 'Right. USCC should be taught as an execution product inside a fund wrapper.'
      },
      {
        id: 'same-as-treasury',
        label: 'It is basically the same as Treasury carry, just with a better headline number',
        correct: false,
        feedback: 'That is the exact mistake this card should stop.'
      },
      {
        id: 'no-nav',
        label: 'NAV and redemption controls matter less because the strategy is diversified',
        correct: false,
        feedback: 'Still wrong. Strategy products still need visible NAV and exit controls.'
      }
    ],
    quiz: {
      summary: 'Use USCC to test whether the user can tell a strategy-yield fund apart from a cash sleeve.',
      successCopy: 'Correct framing: the user owns fund shares, the return comes from basis and execution, and liquidity plus strategy risk must be disclosed together.',
      failureCopy: 'USCC should never be sold as simple cash yield. The strategy engine and redemption controls have to stay visible.',
      questions: [
        {
          id: 'owns',
          prompt: 'What does the user actually own?',
          correct: 'strategy-fund',
          options: [
            { id: 'strategy-fund', label: 'Tokenized private-fund shares around a managed strategy sleeve' },
            { id: 'spot-btc', label: 'Direct spot BTC with no wrapper assumptions' },
            { id: 'cash-account', label: 'A treasury cash account with no strategy engine' }
          ]
        },
        {
          id: 'returnSource',
          prompt: 'What drives the return here?',
          correct: 'basis-staking',
          options: [
            { id: 'basis-staking', label: 'Basis capture, staking rewards, and collateral management' },
            { id: 'simple-tbill', label: 'Only Treasury bill carry with no trading layer' },
            { id: 'stock-split', label: 'Listed-equity upside and stock splits' }
          ]
        },
        {
          id: 'firstDisclosure',
          prompt: 'Which disclosure must come first?',
          correct: 'strategy-risk',
          options: [
            { id: 'strategy-risk', label: 'This is strategy yield with execution and liquidity risk, not plain cash parking' },
            { id: 'highest-coupon', label: 'The headline yield is enough for most users to judge fit' },
            { id: 'gas-only', label: 'Only wallet gas costs matter because the fund is diversified' }
          ]
        }
      ]
    }
  },
  {
    id: 'apollo-acred',
    ticker: 'ACRED',
    name: 'Apollo ACRED',
    risk: 'Medium',
    summary: 'Tokenized private-credit fund with higher yield, slower liquidity, and real underwriting risk.',
    useCase: 'Income sleeve after the user accepts credit and liquidity trade-offs',
    beginnerFit: 'Needs strong disclosure',
    sourceOfReturn: 'Private-credit coupon income and active portfolio construction.',
    worstCase: 'Credit losses, markdowns, or redemption limits eat the extra yield.',
    firstDisclosure: 'Higher yield comes from credit and liquidity risk, not from a free lunch.',
    reviewPrompt: 'What should this card force the user to say out loud?',
    reviewOptions: [
      {
        id: 'credit-risk',
        label: 'The extra income exists because the user is underwriting credit and liquidity risk',
        correct: true,
        feedback: 'Exactly. This is where the page has to translate yield into underwriting and exit trade-offs.'
      },
      {
        id: 'same-cash',
        label: 'It is just a stronger version of a Treasury reserve sleeve',
        correct: false,
        feedback: 'No. Private credit should never be framed like Treasury cash management.'
      },
      {
        id: 'instant-liquidity',
        label: 'Liquidity is effectively the same as listed ETF or stablecoin products',
        correct: false,
        feedback: 'Wrong lane. Redemption and valuation cadence are part of the risk.'
      }
    ],
    quiz: {
      summary: 'Use ACRED to test whether the user can tie extra yield to underwriting and redemption trade-offs.',
      successCopy: 'Correct framing: ACRED is private-credit fund exposure, paid for by credit spread and slower liquidity, not by a safer cash mechanic.',
      failureCopy: 'For ACRED, the key is to connect higher yield with credit underwriting, valuation marks, and slower liquidity.',
      questions: [
        {
          id: 'owns',
          prompt: 'What does the user actually own?',
          correct: 'private-credit-fund',
          options: [
            { id: 'private-credit-fund', label: 'Tokenized private-credit fund exposure with managed lending risk' },
            { id: 'money-market', label: 'A government money-market share with same-day certainty' },
            { id: 'common-stock', label: 'Listed common stock with corporate voting rights' }
          ]
        },
        {
          id: 'returnSource',
          prompt: 'What drives the return here?',
          correct: 'credit-spread',
          options: [
            { id: 'credit-spread', label: 'Private-credit coupon income, borrower spread, and portfolio management' },
            { id: 'staking', label: 'Pure staking rewards with no borrower exposure' },
            { id: 'rate-only', label: 'Only short-duration Treasury carry with no credit work' }
          ]
        },
        {
          id: 'firstDisclosure',
          prompt: 'Which disclosure must come first?',
          correct: 'liquidity-underwriting',
          options: [
            { id: 'liquidity-underwriting', label: 'Liquidity, markdown, and underwriting risk explain why the yield is higher' },
            { id: 'yield-headline', label: 'The gross yield headline is enough if it is above Treasury products' },
            { id: 'wallet-fees', label: 'Wallet transaction fees are the main risk to mention first' }
          ]
        }
      ]
    }
  },
  {
    id: 'private-watchlist',
    ticker: 'PRIVATE',
    name: 'Private Watchlist / SPV Access',
    risk: 'High',
    summary: 'Pre-IPO and SPV-style access where transfer rules, lockups, and exit timing matter more than a price chart.',
    useCase: 'Private-market education and watchlist planning',
    beginnerFit: 'Poor',
    sourceOfReturn: 'Event-driven valuation changes, tender windows, IPO, or acquisition outcomes.',
    worstCase: 'The user can be right on the company story and still get trapped by transfer, mark, or exit uncertainty.',
    firstDisclosure: 'Teach transfer, rights, and liquidity before valuation excitement.',
    reviewPrompt: 'What is the first thing to make explicit?',
    reviewOptions: [
      {
        id: 'transfer-rights',
        label: 'Transfer restrictions, information rights, and how liquidity might actually appear',
        correct: true,
        feedback: 'Yes. Private access is a rights-and-exit problem before it is a chart problem.'
      },
      {
        id: 'daily-price',
        label: 'The daily price path and whether it beats listed beta this week',
        correct: false,
        feedback: 'That makes private access sound liquid when it is not.'
      },
      {
        id: 'gas-cost',
        label: 'Gas cost optimization for frequent trading',
        correct: false,
        feedback: 'This is not the core issue. Private access is about documents, transfer, and exit uncertainty.'
      }
    ],
    quiz: {
      summary: 'Use the private watchlist to test whether the user can shift from exchange thinking to rights-and-exit thinking.',
      successCopy: 'Correct framing: private access is about gated ownership, event-driven marks, and uncertain liquidity windows.',
      failureCopy: 'Private-market cards should lead with transfer rights and exit timing, not with pseudo-daily trading language.',
      questions: [
        {
          id: 'owns',
          prompt: 'What does the user actually own?',
          correct: 'gated-access',
          options: [
            { id: 'gated-access', label: 'A gated private-market allocation or SPV-style access route' },
            { id: 'exchange-spot', label: 'Spot shares on an exchange with continuous liquidity' },
            { id: 'cash-note', label: 'A short-duration cash note with daily redemption certainty' }
          ]
        },
        {
          id: 'returnSource',
          prompt: 'What drives the return here?',
          correct: 'event-driven',
          options: [
            { id: 'event-driven', label: 'Secondary marks, tender windows, IPO, or acquisition events' },
            { id: 'coupon-income', label: 'Recurring coupon income from borrower spread' },
            { id: 'staking-yield', label: 'Staking rewards with no transfer restrictions' }
          ]
        },
        {
          id: 'firstDisclosure',
          prompt: 'Which disclosure must come first?',
          correct: 'rights-liquidity',
          options: [
            { id: 'rights-liquidity', label: 'Transfer rights, documents, and when liquidity might actually appear' },
            { id: 'price-target', label: 'A short-term price target and weekly upside scenario' },
            { id: 'gas-only', label: 'The wallet gas budget needed for active trading' }
          ]
        }
      ]
    }
  },
  {
    id: 'xstocks-public-holdings',
    ticker: 'XSTOCKS',
    name: 'xStocks / Public Holdings',
    risk: 'Medium',
    summary: 'Listed-equity and ETF-style wrappers for users who need to learn rights, settlement, and price beta together.',
    useCase: 'Public-market wrapper baseline after reserve products',
    beginnerFit: 'Okay after reserves',
    sourceOfReturn: 'Capital gains and losses from listed-equity or ETF exposure.',
    worstCase: 'Users treat the wrapper like direct brokerage stock ownership and miss settlement or corporate-action rules.',
    firstDisclosure: 'Separate public-market beta from wrapper rights and settlement path.',
    reviewPrompt: 'What should this card keep separate?',
    reviewOptions: [
      {
        id: 'beta-vs-wrapper',
        label: 'Price beta on one side, wrapper rights and settlement mechanics on the other',
        correct: true,
        feedback: 'Correct. Public-market wrappers are easiest to teach when price exposure and ownership mechanics stay distinct.'
      },
      {
        id: 'same-as-stock',
        label: 'Treat it exactly like owning a stock in a brokerage account',
        correct: false,
        feedback: 'That hides the wrapper assumptions the user still needs to understand.'
      },
      {
        id: 'yield-first',
        label: 'Lead with the yield story because listed products usually pay the most',
        correct: false,
        feedback: 'This is not a yield lane. Start with exposure and rights instead.'
      }
    ],
    quiz: {
      summary: 'Use xStocks to test whether the user can keep wrapper mechanics separate from listed-market beta.',
      successCopy: 'Correct framing: xStocks are public-market wrappers, so the user needs both market exposure context and wrapper-rights disclosure.',
      failureCopy: 'For xStocks, do not collapse wrapper rights into simple brokerage-share language.',
      questions: [
        {
          id: 'owns',
          prompt: 'What does the user actually own?',
          correct: 'wrapped-public',
          options: [
            { id: 'wrapped-public', label: 'Wrapped listed-equity or ETF exposure with platform-specific rights' },
            { id: 'direct-brokerage', label: 'Direct registered brokerage shares with identical rights' },
            { id: 'private-credit', label: 'Private-credit fund shares with income coupons' }
          ]
        },
        {
          id: 'returnSource',
          prompt: 'What drives the return here?',
          correct: 'listed-beta',
          options: [
            { id: 'listed-beta', label: 'Listed-market price movement and any wrapper-defined economics' },
            { id: 'treasury-carry', label: 'Treasury bill carry and repo income' },
            { id: 'event-window', label: 'Tender offers and private-company exit events' }
          ]
        },
        {
          id: 'firstDisclosure',
          prompt: 'Which disclosure must come first?',
          correct: 'rights-settlement',
          options: [
            { id: 'rights-settlement', label: 'Rights, settlement path, and how the wrapper differs from direct stock ownership' },
            { id: 'highest-yield', label: 'The payout headline matters more than wrapper detail' },
            { id: 'no-risk', label: 'There is basically no product risk once it is tokenized' }
          ]
        }
      ]
    }
  }
];

const HOME_BRIEFING_PRODUCT_IDS = [
  'superstate-ustb',
  'apollo-acred',
  'private-watchlist',
  'xstocks-public-holdings'
];
const HOME_BRIEFING_PRODUCTS = HOME_BRIEFING_PRODUCT_IDS
  .map((productId) => products.find((product) => product.id === productId))
  .filter(Boolean);
const STARTER_DISCOVER_PRODUCTS = HOME_BRIEFING_PRODUCTS;
const QUIZ_PRODUCTS = HOME_BRIEFING_PRODUCTS.filter((product) => product.quiz);
const DEFAULT_QUIZ_PRODUCT_ID = QUIZ_PRODUCTS[0]?.id || products[0].id;
const HOME_PRODUCT_ID_SET = new Set(products.map((product) => product.id));

function getProductBriefingFacts(product) {
  if (!product) return [];
  return [
    { label: 'Plain-language use', value: product.useCase },
    { label: 'Source of return', value: product.sourceOfReturn },
    { label: 'Worst case', value: product.worstCase },
    { label: 'First disclosure', value: product.firstDisclosure }
  ];
}

function createEmptyQuizAnswers() {
  return {
    owns: '',
    returnSource: '',
    firstDisclosure: ''
  };
}

function getCorrectQuizAnswers(productId = DEFAULT_QUIZ_PRODUCT_ID) {
  const quizProduct = QUIZ_PRODUCTS.find((product) => product.id === productId);
  if (!quizProduct?.quiz?.questions?.length) return createEmptyQuizAnswers();

  return quizProduct.quiz.questions.reduce((accumulator, question) => {
    accumulator[question.id] = question.correct;
    return accumulator;
  }, createEmptyQuizAnswers());
}

function sanitizeViewedRiskCards(value = []) {
  return [...new Set((Array.isArray(value) ? value : []).filter((productId) => HOME_PRODUCT_ID_SET.has(productId)))];
}

function getAnalyticsEventMeta(eventName) {
  if (eventName === 'wallet_modal_open') {
    return {
      label: 'Wallet modal opened',
      section: 'Wallet onboarding',
      takeaway: 'Users opened the MetaMask entry point from the homepage.'
    };
  }
  if (eventName === 'hero_discover_click') {
    return {
      label: 'Hero -> Discover',
      section: 'Homepage hero',
      takeaway: 'The first-fold CTA pushed users into the product briefings.'
    };
  }
  if (eventName === 'hero_route_help_click') {
    return {
      label: 'Hero -> Route help',
      section: 'Homepage hero',
      takeaway: 'Users needed onboarding guidance before clicking into products.'
    };
  }
  if (eventName === 'wealth_hub_open') {
    return {
      label: 'Open wealth hub',
      section: 'Wealth routing',
      takeaway: 'Users moved from the homepage into the full wealth experience.'
    };
  }
  if (eventName === 'paper_trading_page_open') {
    return {
      label: 'Open replay lab',
      section: 'Paper trading',
      takeaway: 'The user was ready to leave homepage education and enter replay.'
    };
  }
  if (eventName === 'product_quiz_submit') {
    return {
      label: 'Submit product quiz',
      section: 'Quiz',
      takeaway: 'Users attempted the ownership-and-risk comprehension check.'
    };
  }
  if (eventName.startsWith('module_')) {
    const moduleId = eventName.replace('module_', '');
    return {
      label: `Open task detail: ${moduleId}`,
      section: 'Quest wall',
      takeaway: 'Users drilled into a specific onboarding task from the homepage quest wall.'
    };
  }
  if (eventName.startsWith('risk_card_')) {
    const productId = eventName.replace('risk_card_', '');
    const product = products.find((entry) => entry.id === productId);
    return {
      label: `Risk briefing: ${product?.ticker || productId}`,
      section: 'Risk review',
      takeaway: product
        ? `Users opened the ${product.name} briefing card to inspect fit, return source, and disclosure.`
        : 'Users opened a risk briefing from the homepage learning panel.'
    };
  }
  if (eventName.startsWith('badge_mint_')) {
    const badgeId = eventName.replace('badge_mint_', '');
    return {
      label: `Mint wallet collectible: ${badgeId}`,
      section: 'Wallet collectible actions',
      takeaway: 'The user tried to turn a finished task into a wallet collectible.'
    };
  }

  return {
    label: eventName,
    section: 'Other',
    takeaway: 'Local analytics captured this interaction but it has not been grouped yet.'
  };
}

const quests = [
  { title: 'Connect wallet', copy: 'Authenticate with a wallet before any live-style action is unlocked.', reward: 'Starter unlock' },
  { title: 'Mint welcome collectible on Sepolia', copy: 'Submit one real testnet transaction so the first reward feels onchain, not simulated.', reward: 'Collectible unlock' },
  {
    title: `Review ${RISK_REVIEW_REQUIRED} product briefings`,
    copy: 'Use the actual Wealth and Paper product lanes to explain ownership, return source, and first disclosure in plain language.',
    reward: 'Risk unlock'
  },
  {
    title: 'Pass one 3-question product briefing quiz',
    copy: 'Show that the user can identify what is owned, what drives return, and which disclosure must come first.',
    reward: 'Fee coupon'
  },
  { title: 'Complete one paper trade', copy: 'Practice before any real-money handoff happens.', reward: 'Portfolio XP' }
];

const SEPOLIA_CHAIN_ID = 11155111;
const BADGE_TYPES = {
  welcome: 1,
  wallet: 2,
  risk: 3,
  quiz: 4,
  paper: 5
};
const BADGE_CONTRACT_ADDRESS = import.meta.env.VITE_BADGE_CONTRACT_ADDRESS || '';
const badgeContractConfigured = isAddress(BADGE_CONTRACT_ADDRESS);
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
  },
  {
    type: 'function',
    name: 'mintWelcomeBadge',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'mintBadge',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'badgeType', type: 'uint8' },
      { name: 'to', type: 'address' }
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }]
  }
];

const painPointGuides = {
  newbie: {
    title: 'Start as a beginner, not as a trader',
    copy: 'RiskLens should first explain what a product is for, show a simple 1,000 USDT example, and then route users into practice instead of forcing live complexity too early.',
    nextStep: 'Review the reserve and strategy product briefings first, then try one paper trade.',
    module: 'Discover -> Paper Trading'
  },
  contracts: {
    title: 'Translate contract language into ownership language',
    copy: 'Users do not think in smart contract terms. They think in ownership, downside, and access. The UI should explain exactly what they hold and what rights they do not hold.',
    nextStep: 'Compare product cards using source of return and worst-case framing.',
    module: 'Analyzer -> Product Detail'
  },
  safer: {
    title: 'Beginner-safe means lower complexity and clearer downside',
    copy: 'Treasury-style RWAs should surface before stock wrappers because they are easier to explain, easier to compare, and less likely to confuse first-time users.',
    nextStep: 'Start with USTB or OUSG before any strategy-yield or private-market exposure.',
    module: 'Starter Shelf'
  }
};

const onboardingFlows = {
  web2: {
    title: 'Web2-style onboarding route',
    copy: 'We first learn whether this user wants a guided step-by-step route or would rather begin with simpler wealth products.',
    choices: {
      trading: {
        title: 'Show me what to do',
        copy: 'Great. We will guide this user through wallet setup, collectible tasks, and then unlock paper trading in a cleaner order.',
        primary: 'Start wallet tasks',
        primaryHref: '#learnEarn',
        secondary: 'See paper trading',
        secondaryHref: '#paperTrading'
      },
      wealth: {
        title: 'I am still a bit cautious about investing',
        copy: 'That is fine. We also provide wealth products with simpler framing, so the user can start from a calmer entry point before touching trading flows.',
        primary: 'Open wealth products',
        primaryHref: '#wealth',
        secondary: 'See paper trading',
        secondaryHref: '#paperTrading'
      }
    }
  },
  web3: {
    title: 'Web3-native fast track',
    copy: 'We can ask whether the user wants to skip beginner wallet education and jump directly into practice mode.',
    choices: {
      skip: {
        title: 'Skip beginner wallet tutorial',
        copy: 'This user already understands wallets and can go straight into simulated trading. Paper trading is immediately unlocked so they can test products before any live action.',
        primary: 'Jump to paper trading',
        primaryHref: '#paperTrading',
        secondary: 'See product discovery',
        secondaryHref: '#discover'
      },
      learn: {
        title: 'Keep the wallet explanation visible',
        copy: 'If the user is unsure what a wallet is, explain that wallet access lets them trade across venues and receive onchain rewards, then keep paper trading locked until the beginner route is complete.',
        primary: 'Open wallet tasks',
        primaryHref: '#learnEarn',
        secondary: 'See product lanes',
        secondaryHref: '#discover'
      }
    }
  }
};

const faucetLinks = [
  'https://sepolia-faucet.pk910.de/',
  'https://portal.cdp.coinbase.com/products/faucet',
  'https://console.optimism.io/faucet',
  'https://learnweb3.io/faucets/sepolia/',
  'https://faucets.chain.link/',
  'https://bwarelabs.com/faucets/base-sepolia',
  'https://getblock.io/faucet/eth-sepolia/'
];

const STARTING_PAPER_TOKENS = UNIFIED_PT_STARTING_BALANCE;
const BADGE_REWARD_TOKENS = UNIFIED_PT_MILESTONE_REWARD;
const MIN_PAPER_TRADE = 100;
const DEV_MODE_USERNAME = 'msxadmin';
const DEV_MODE_PASSWORD = 'msx2026';
const ANALYTICS_STORAGE_KEY = 'msx-click-analytics';
const WALLET_BEHAVIOR_STORAGE_PREFIX = 'msx-wallet-behavior-';
const DEV_AUTH_STORAGE_KEY = 'msx-dev-auth';
const ADMIN_UNLOCK_STORAGE_PREFIX = 'msx-admin-unlock';
const PROFILE_BACKUP_POINTER_STORAGE_PREFIX = 'msx-wallet-profile-pointer-';
const DEFAULT_ADMIN_PT_AMOUNT = 100000;

function shortAddress(address) {
  if (!address) return 'Not connected';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTokenAmount(value, decimals = 18, maxDecimals = 8) {
  try {
    const formatted = formatUnits(BigInt(value || 0), decimals);
    const [whole, fraction = ''] = formatted.split('.');
    const trimmedFraction = fraction.slice(0, maxDecimals).replace(/0+$/, '');
    return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
  } catch {
    return '0';
  }
}

function roundNumber(value, digits = 2) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
}

function getProgressStorageKey(address) {
  return address ? `msx-progress-${address.toLowerCase()}` : '';
}

function getPaperStateKey(address) {
  return address ? `msx-paper-state-${address.toLowerCase()}` : '';
}

function getPaperReplayStateKey(address) {
  return address ? `msx-paper-replay-state-${address.toLowerCase()}` : '';
}

function getAdminUnlockStorageKey(address) {
  return address ? `${ADMIN_UNLOCK_STORAGE_PREFIX}-${address.toLowerCase()}` : '';
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
      hashPreview: String(record.contentHash || record.profile?.storage?.contentHash || '').slice(0, 10),
      availablePT: summary.availablePT
    });
  }

  return accounts
    .sort((left, right) => profileBackupTimeValue(right.signedAt) - profileBackupTimeValue(left.signedAt))
    .slice(0, 3);
}

function getAddressFromStoredKey(key, prefix) {
  if (!key || !key.startsWith(prefix)) return '';
  const address = key.slice(prefix.length).replace(/^-/, '').toLowerCase();
  return isAddress(address) ? address : '';
}

function listDeveloperWalletAccounts({ connectedAddress = '', analyticsSnapshot = {}, backupAccounts = [] } = {}) {
  if (typeof window === 'undefined' || !window.localStorage) return [];

  const candidates = new Map();
  const addCandidate = (address, source) => {
    const normalized = normalizeAnalyticsWalletAddress(address);
    if (!normalized) return;
    const current = candidates.get(normalized) || { address: normalized, sources: new Set() };
    current.sources.add(source);
    candidates.set(normalized, current);
  };

  addCandidate(connectedAddress, 'connected');
  backupAccounts.forEach((account) => addCandidate(account.address, 'signed backup'));

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    addCandidate(getAddressFromStoredKey(key, 'msx-wallet-profile-'), 'profile');
    addCandidate(getAddressFromStoredKey(key, PROFILE_BACKUP_POINTER_STORAGE_PREFIX), 'signed backup');
    addCandidate(getAddressFromStoredKey(key, 'msx-progress-'), 'home progress');
    addCandidate(getAddressFromStoredKey(key, 'msx-paper-state-'), 'home PT');
    addCandidate(getAddressFromStoredKey(key, 'msx-paper-replay-state-'), 'paper replay');
    addCandidate(getAddressFromStoredKey(key, 'msx-wealth-state-'), 'wealth');
    addCandidate(getAddressFromStoredKey(key, 'msx-wallet-nickname-'), 'nickname');
    addCandidate(getAddressFromStoredKey(key, WALLET_BEHAVIOR_STORAGE_PREFIX), 'behavior');
  }

  return Array.from(candidates.values())
    .map((candidate) => {
      const profile = readWalletProfile(candidate.address);
      const summary = getWalletProfileSummary(profile);
      const pointerRecord = readStorageJson(getWalletProfilePointerKey(candidate.address), null);
      const behavior = getWalletAnalyticsBucket(analyticsSnapshot, candidate.address);
      const nickname = readWalletNickname(candidate.address);
      const latestAt = [
        profile.updatedAt,
        behavior.updatedAt,
        pointerRecord?.createdAt,
        pointerRecord?.profile?.storage?.signedAt
      ]
        .map((value) => profileBackupTimeValue(value))
        .filter(Boolean)
        .sort((left, right) => right - left)[0] || 0;

      return {
        address: candidate.address,
        label: getWalletDisplayName(candidate.address, nickname, shortAddress),
        shortLabel: shortAddress(candidate.address),
        sources: Array.from(candidate.sources),
        summary,
        behavior,
        storageMode: profile.storage?.mode || (behavior.contentHash ? 'behavior-snapshot-local' : 'local-first'),
        contentHash: pointerRecord?.contentHash || profile.storage?.contentHash || '',
        cidReadyPointer: pointerRecord?.cidReadyPointer || profile.storage?.cidReadyPointer || '',
        behaviorContentHash: behavior.contentHash || '',
        behaviorPointer: behavior.cidReadyPointer || '',
        signedAt: pointerRecord?.createdAt || profile.storage?.signedAt || '',
        updatedAt: latestAt
      };
    })
    .sort((left, right) => {
      const connectedKey = normalizeAnalyticsWalletAddress(connectedAddress);
      if (connectedKey && left.address === connectedKey) return -1;
      if (connectedKey && right.address === connectedKey) return 1;
      return right.updatedAt - left.updatedAt;
    });
}

function deleteStorageKey(key) {
  if (typeof window === 'undefined' || !key) return;
  window.localStorage.removeItem(key);
}

function getWalletBehaviorStorageKey(address) {
  return address ? `${WALLET_BEHAVIOR_STORAGE_PREFIX}${address.toLowerCase()}` : '';
}

function normalizeAnalyticsWalletAddress(address) {
  const normalized = String(address || '').toLowerCase();
  return isAddress(normalized) ? normalized : '';
}

function createEmptyWalletAnalytics() {
  return {
    total: 0,
    events: {},
    updatedAt: '',
    firstSeenAt: '',
    contentHash: '',
    cidReadyPointer: ''
  };
}

function createLocalContentHash(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || {});
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

function buildWalletBehaviorStorageRecord(address, bucket = {}) {
  const normalized = normalizeAnalyticsWalletAddress(address);
  const body = {
    kind: 'msx.wallet-behavior.v1',
    address: normalized,
    updatedAt: bucket.updatedAt || new Date().toISOString(),
    behavior: {
      total: Number(bucket.total || 0),
      events: bucket.events || {},
      firstSeenAt: bucket.firstSeenAt || '',
      updatedAt: bucket.updatedAt || ''
    }
  };
  const contentHash = createLocalContentHash(body);
  return {
    ...body,
    contentHash,
    cidReadyPointer: `local:${contentHash}`,
    storagePlan: {
      local: getWalletBehaviorStorageKey(normalized),
      recommendedNetwork: 'Pin this JSON to IPFS/Filecoin or Arweave when the demo is connected to a storage endpoint.'
    }
  };
}

function getWalletAnalyticsBucket(snapshot = {}, address = '') {
  const normalized = normalizeAnalyticsWalletAddress(address);
  if (!normalized) return createEmptyWalletAnalytics();
  const storedRecord = readStorageJson(getWalletBehaviorStorageKey(normalized), {});
  const storedBucket = storedRecord.behavior || storedRecord;
  const snapshotBucket = snapshot.byWallet?.[normalized] || {};

  return {
    ...createEmptyWalletAnalytics(),
    ...storedBucket,
    ...snapshotBucket,
    contentHash: snapshotBucket.contentHash || storedRecord.contentHash || storedBucket.contentHash || '',
    cidReadyPointer: snapshotBucket.cidReadyPointer || storedRecord.cidReadyPointer || storedBucket.cidReadyPointer || ''
  };
}

function writeWalletAnalyticsBucket(address, bucket) {
  const normalized = normalizeAnalyticsWalletAddress(address);
  if (!normalized) return null;

  const behaviorRecord = buildWalletBehaviorStorageRecord(normalized, bucket);
  const bucketWithPointer = {
    ...behaviorRecord.behavior,
    contentHash: behaviorRecord.contentHash,
    cidReadyPointer: behaviorRecord.cidReadyPointer
  };

  writeStorageJson(getWalletBehaviorStorageKey(normalized), behaviorRecord);

  const existingProfile = readStorageJson(getWalletProfileKey(normalized), null);
  if (existingProfile) {
    writeWalletProfilePatch(normalized, {
      storage: {
        ...(existingProfile.storage || {}),
        developerAnalytics: {
          total: bucketWithPointer.total,
          events: bucketWithPointer.events,
          updatedAt: bucketWithPointer.updatedAt,
          contentHash: behaviorRecord.contentHash,
          cidReadyPointer: behaviorRecord.cidReadyPointer,
          localKey: getWalletBehaviorStorageKey(normalized)
        }
      }
    });
  }

  return bucketWithPointer;
}

function trackAnalytics(eventName, walletAddress = '') {
  if (typeof window === 'undefined') return { total: 0, events: {} };
  const next = readStorageJson(ANALYTICS_STORAGE_KEY, { total: 0, events: {} });
  const normalizedWallet = normalizeAnalyticsWalletAddress(walletAddress);
  const trackedAt = new Date().toISOString();

  next.total += 1;
  next.events[eventName] = (next.events[eventName] || 0) + 1;
  next.updatedAt = trackedAt;

  if (normalizedWallet) {
    const currentBucket = getWalletAnalyticsBucket(next, normalizedWallet);
    const nextBucket = {
      ...currentBucket,
      total: Number(currentBucket.total || 0) + 1,
      events: {
        ...(currentBucket.events || {}),
        [eventName]: Number(currentBucket.events?.[eventName] || 0) + 1
      },
      firstSeenAt: currentBucket.firstSeenAt || trackedAt,
      updatedAt: trackedAt
    };
    const storedBucket = writeWalletAnalyticsBucket(normalizedWallet, nextBucket) || nextBucket;
    next.byWallet = {
      ...(next.byWallet || {}),
      [normalizedWallet]: storedBucket
    };
  }

  writeStorageJson(ANALYTICS_STORAGE_KEY, next);
  return next;
}

function chainName(chainId) {
  const names = {
    1: 'Ethereum',
    56: 'BSC',
    137: 'Polygon',
    8453: 'Base',
    11155111: 'Sepolia'
  };
  return names[chainId] || (chainId ? `Chain ${chainId}` : 'No network');
}

function riskClass(risk) {
  return risk === 'Low' ? 'risk-low' : risk === 'Medium' ? 'risk-medium' : 'risk-high';
}

function parseHexChainId(value) {
  if (typeof value !== 'string') return null;
  const parsed = Number.parseInt(value, 16);
  return Number.isFinite(parsed) ? parsed : null;
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

function OnboardingBadge({ kicker, title, subtitle, accent = 'default' }) {
  return (
    <div className={`unlock-box-banner accent-${accent}`}>
      <div className="unlock-box-banner-grid"></div>
      <div className="unlock-box-banner-content">
        <div className="unlock-box-banner-kicker">{kicker}</div>
        <div className="unlock-box-banner-title">{title}</div>
        <div className="unlock-box-banner-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}

function HomeQuestCover({ kicker, title, subtitle, accent = 'green', footerLines = [], stamp = '' }) {
  return (
    <div className="paper-reward-cover home-quest-cover">
      <OnboardingBadge kicker={kicker} title={title} subtitle={subtitle} accent={accent} />
      {footerLines.length ? (
        <div className="paper-reward-cover-footer">
          {footerLines.map((line) => (
            <div key={line} className="paper-reward-cover-meta">
              {line}
            </div>
          ))}
        </div>
      ) : null}
      {stamp ? <div className="paper-reward-cover-stamp">{stamp}</div> : null}
    </div>
  );
}

function BriefingFactGrid({ product, className = '' }) {
  const facts = getProductBriefingFacts(product);
  return (
    <div className={`home-briefing-fact-grid ${className}`.trim()}>
      {facts.map((fact) => (
        <div className="guide-chip home-briefing-fact-card" key={`${product.id}-${fact.label}`}>
          <div className="k">{fact.label}</div>
          <div className="v">{fact.value}</div>
        </div>
      ))}
    </div>
  );
}

function ProfileBackupCard({
  className = '',
  eyebrow = 'Wallet backup + recovery',
  title,
  description,
  footnote,
  accountLabel,
  summaryText,
  walletProfileSummary,
  profileBackupConfigured,
  profileBackupRecoverable,
  profileBackupAccounts = [],
  selectedProfileBackupAddress = '',
  onSelectedProfileBackupAddressChange,
  onRecoverSelectedProfileBackup,
  onSign,
  onRecover,
  isSigning = false,
  actionsDisabled = false,
  signReadyLabel = 'Update signed backup',
  signIdleLabel = 'Sign backup now'
}) {
  const statRows = [
    { label: 'Account', value: accountLabel },
    { label: 'Available PT', value: `${walletProfileSummary.availablePT.toLocaleString()} PT` },
    { label: 'Paper cash', value: `${walletProfileSummary.paperCash.toLocaleString()} PT` },
    { label: 'Wealth cash', value: `${walletProfileSummary.wealthCash.toLocaleString()} PT` }
  ];

  return (
    <div className={`wealth-profile-storage-card profile-backup-card ${className}`.trim()}>
      <div className="profile-backup-main">
        <div className="eyebrow">{eyebrow}</div>
        <div className="wealth-profile-storage-title">{title}</div>
        <div className="muted">{description}</div>
        <div className="profile-backup-stat-grid">
          {statRows.map((row) => (
            <div className="profile-backup-stat-card" key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
        <div className="profile-backup-policy-grid">
          <div className="guide-chip profile-backup-policy-card">
            <div className="k">What it saves</div>
            <div className="v">PT balance, collectible progress, replay context, and wealth state for this wallet on this device.</div>
          </div>
          <div className="guide-chip profile-backup-policy-card">
            <div className="k">What it does not save</div>
            <div className="v">MetaMask, private keys, seed phrases, or any real-money permission.</div>
          </div>
        </div>
        <div className="muted">{footnote}</div>
        {summaryText ? <div className="wealth-inline-note wallet-modal-backup-note">{summaryText}</div> : null}
      </div>
      <div className="profile-backup-side">
        <div className={`profile-backup-state ${profileBackupConfigured ? 'ready' : 'idle'}`}>
          <span className="profile-backup-state-label">{profileBackupConfigured ? 'Signed snapshot ready' : 'Snapshot not signed yet'}</span>
          <strong>{profileBackupRecoverable ? 'Recovery available on this device' : 'Recovery opens after the first signature'}</strong>
        </div>
        <div className="wallet-modal-backup-actions profile-backup-actions">
          <button type="button" className="ghost-btn compact" onClick={() => onSign?.()} disabled={isSigning || actionsDisabled}>
            {isSigning ? 'Await wallet' : profileBackupConfigured ? signReadyLabel : signIdleLabel}
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
            disabled={!selectedProfileBackupAddress || actionsDisabled}
          >
            Use selected backup
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestStatusBadge({ text, tone = 'done' }) {
  return <div className={`quest-status-badge ${tone}`}>{text}</div>;
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
  onSignProfileBackup,
  onRecoverProfileBackup,
  isPending,
  isConnected,
  address,
  walletDisplayName,
  nicknameDraft,
  onNicknameDraftChange,
  nicknameFeedback,
  errorText,
  hasMetaMaskInstalled,
  isProfileSigning,
  profileBackupConfigured,
  profileBackupRecoverable,
  profileBackupSummaryText,
  walletProfileSummary,
  profileBackupAccounts = [],
  selectedProfileBackupAddress = '',
  onSelectedProfileBackupAddressChange,
  onRecoverSelectedProfileBackup
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
          <div className="wallet-modal-title">RiskLens Wallet Access</div>
          <div className="wallet-modal-subtitle">Welcome Layer</div>
          <button
            className={`wallet-option ${isConnected ? 'connected' : ''} ${isPending || (!isConnected && !hasMetaMaskInstalled) ? 'disabled' : ''}`}
            onClick={isConnected ? requestDisconnect : onConnect}
            disabled={isPending || (!isConnected && !hasMetaMaskInstalled)}
          >
            <MetaMaskIcon className="wallet-option-icon" />
            <div>
              <div className="wallet-option-title">{isConnected ? walletDisplayName : 'MetaMask'}</div>
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
        <div className={`wallet-modal-pane wallet-modal-main ${isConnected ? 'wallet-modal-main-connected' : ''} ${profileBackupAccounts.length ? 'wallet-modal-main-has-backup' : ''}`}>
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
              ? `The welcome page is now authenticated with wallet ${walletDisplayName}.`
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
            <ProfileBackupCard
              className="wallet-modal-backup-card"
              title={isConnected ? "Keep this wallet's PT progress recoverable" : 'Recover a saved wallet profile'}
              description={isConnected
                ? 'Sign one snapshot for this account so the demo can recover PT balance, replay progress, and wealth context later.'
                : 'Pick a historical backup below, then connect the same MetaMask account before recovery.'}
              footnote={isConnected
                ? 'The signed pointer can later be pinned to IPFS, Filecoin, Ceramic, or Arweave. Recovery here restores the saved demo state for this wallet address on this device.'
                : 'Backup stores demo state only. It never stores private keys and cannot impersonate a wallet connection.'}
              accountLabel={isConnected ? walletDisplayName : 'connect first'}
              summaryText={profileBackupSummaryText}
              walletProfileSummary={walletProfileSummary}
              profileBackupConfigured={profileBackupConfigured}
              profileBackupRecoverable={profileBackupRecoverable}
              profileBackupAccounts={profileBackupAccounts}
              selectedProfileBackupAddress={selectedProfileBackupAddress}
              onSelectedProfileBackupAddressChange={onSelectedProfileBackupAddressChange}
              onRecoverSelectedProfileBackup={onRecoverSelectedProfileBackup}
              onSign={onSignProfileBackup}
              onRecover={onRecoverProfileBackup}
              isSigning={isProfileSigning}
              actionsDisabled={isPending || !isConnected}
            />
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
              <div className="wallet-install-step">When you connect, mint, or approve access, open the extension popup so the request is visible right away.</div>
            </div>
          )}
          {isConnected ? (
            <button className="secondary-btn" onClick={requestDisconnect}>
              Disconnect wallet
            </button>
          ) : null}
          {isPending ? <div className="wallet-modal-spinner" /> : null}
          {nicknameFeedback ? <div className="env-hint" style={{ maxWidth: 360 }}>{nicknameFeedback}</div> : null}
          {errorText ? <div className="env-hint" style={{ maxWidth: 360 }}>{errorText}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { uiLanguage, setUiLanguage, t } = useUiLanguage();
  useDomTranslation(uiLanguage, ['.app-shell', '.wallet-modal-backdrop', '.wealth-modal-backdrop']);
  const [painPoint, setPainPoint] = useState('newbie');
  const [userOrigin, setUserOrigin] = useState('web2');
  const [web2Intent, setWeb2Intent] = useState('trading');
  const [web3Intent, setWeb3Intent] = useState('learn');
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [walletNickname, setWalletNickname] = useState('');
  const [walletNicknameDraft, setWalletNicknameDraft] = useState('');
  const [pendingWalletNickname, setPendingWalletNickname] = useState(null);
  const [walletNicknameFeedback, setWalletNicknameFeedback] = useState('');
  const [guideCompleted, setGuideCompleted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [mintHelpOpen, setMintHelpOpen] = useState('');
  const [mintRecipient, setMintRecipient] = useState('');
  const [mintTaskKey, setMintTaskKey] = useState('welcome');
  const [viewedRiskCards, setViewedRiskCards] = useState([]);
  const [riskCheckpointAnswers, setRiskCheckpointAnswers] = useState({});
  const [selectedRiskProduct, setSelectedRiskProduct] = useState(HOME_BRIEFING_PRODUCTS[0]?.id || products[0].id);
  const [liveChainId, setLiveChainId] = useState(null);
  const [quizProductId, setQuizProductId] = useState(DEFAULT_QUIZ_PRODUCT_ID);
  const [quizAnswers, setQuizAnswers] = useState(createEmptyQuizAnswers);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [hasMetaMaskInstalled, setHasMetaMaskInstalled] = useState(false);
  const [activeCoreQuest, setActiveCoreQuest] = useState(null);
  const [activeOptionalQuest, setActiveOptionalQuest] = useState(null);
  const [optionalQuestNotice, setOptionalQuestNotice] = useState('');
  const [taskCompletionNotice, setTaskCompletionNotice] = useState('');
  const [taskCompletionNoticeTarget, setTaskCompletionNoticeTarget] = useState('core');
  const [visibleCoreQuest, setVisibleCoreQuest] = useState('wallet');
  const [visibleOptionalQuest, setVisibleOptionalQuest] = useState('risk');
  const [paperTradesCompleted, setPaperTradesCompleted] = useState(0);
  const [paperBalanceSnapshot, setPaperBalanceSnapshot] = useState(STARTING_PAPER_TOKENS);
  const [progressAccountKey, setProgressAccountKey] = useState('');
  const [devModeOpen, setDevModeOpen] = useState(false);
  const [devModeAuthed, setDevModeAuthed] = useState(false);
  const [devModeUsername, setDevModeUsername] = useState('');
  const [devModePassword, setDevModePassword] = useState('');
  const [devModeError, setDevModeError] = useState('');
  const [devModeNotice, setDevModeNotice] = useState('');
  const [devModePtAmount, setDevModePtAmount] = useState(String(DEFAULT_ADMIN_PT_AMOUNT));
  const [developerDetailTopic, setDeveloperDetailTopic] = useState('clicks');
  const [developerWalletAddress, setDeveloperWalletAddress] = useState('');
  const [analyticsSnapshot, setAnalyticsSnapshot] = useState({ total: 0, events: {} });
  const [profileBackupStatus, setProfileBackupStatus] = useState('');
  const [selectedProfileBackupAddress, setSelectedProfileBackupAddress] = useState('');
  const [developerExitPromptOpen, setDeveloperExitPromptOpen] = useState(false);
  const [developerSessionDirty, setDeveloperSessionDirty] = useState(false);
  const previousConnectionRef = useRef(false);
  const developerSessionSnapshotRef = useRef(null);
  const previousTaskCompletionRef = useRef({
    addressKey: '',
    nickname: false,
    welcome: false,
    risk: false,
    quiz: false,
    paper: false
  });

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: sepoliaBalance } = useBalance({
    address,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address)
    }
  });
  const {
    data: hasMintedBadgeOnchain,
    isFetched: welcomeBadgeFetched,
    isFetching: welcomeBadgeFetching,
    refetch: refetchWelcomeBadge
  } = useReadContract({
    address: badgeContractConfigured ? BADGE_CONTRACT_ADDRESS : undefined,
    abi: welcomeBadgeAbi,
    functionName: 'hasMinted',
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address) && badgeContractConfigured
    }
  });
  const {
    data: walletBadgeOnchain,
    isFetched: walletBadgeFetched,
    isFetching: walletBadgeFetching,
    refetch: refetchWalletBadge
  } = useReadContract({
    address: badgeContractConfigured ? BADGE_CONTRACT_ADDRESS : undefined,
    abi: welcomeBadgeAbi,
    functionName: 'hasMintedTask',
    args: address ? [address, BADGE_TYPES.wallet] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address) && badgeContractConfigured
    }
  });
  const {
    data: riskBadgeOnchain,
    isFetched: riskBadgeFetched,
    isFetching: riskBadgeFetching,
    refetch: refetchRiskBadge
  } = useReadContract({
    address: badgeContractConfigured ? BADGE_CONTRACT_ADDRESS : undefined,
    abi: welcomeBadgeAbi,
    functionName: 'hasMintedTask',
    args: address ? [address, BADGE_TYPES.risk] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address) && badgeContractConfigured
    }
  });
  const {
    data: quizBadgeOnchain,
    isFetched: quizBadgeFetched,
    isFetching: quizBadgeFetching,
    refetch: refetchQuizBadge
  } = useReadContract({
    address: badgeContractConfigured ? BADGE_CONTRACT_ADDRESS : undefined,
    abi: welcomeBadgeAbi,
    functionName: 'hasMintedTask',
    args: address ? [address, BADGE_TYPES.quiz] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address) && badgeContractConfigured
    }
  });
  const {
    data: paperBadgeOnchain,
    isFetched: paperBadgeFetched,
    isFetching: paperBadgeFetching,
    refetch: refetchPaperBadge
  } = useReadContract({
    address: badgeContractConfigured ? BADGE_CONTRACT_ADDRESS : undefined,
    abi: welcomeBadgeAbi,
    functionName: 'hasMintedTask',
    args: address ? [address, BADGE_TYPES.paper] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address) && badgeContractConfigured
    }
  });
  const { connect, connectors, isPending, error, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { data: mintHash, error: mintError, isPending: isMinting, writeContractAsync } = useWriteContract();
  const { signMessageAsync, isPending: isProfileSigning } = useSignMessage();
  const { isLoading: isConfirmingMint, isSuccess: mintConfirmed } = useWaitForTransactionReceipt({
    hash: mintHash
  });

  const metaMaskConnector = useMemo(
    () => connectors.find((connector) => connector.name.toLowerCase().includes('metamask')) || connectors[0],
    [connectors]
  );

  const selectedRiskCard = useMemo(
    () => HOME_BRIEFING_PRODUCTS.find((product) => product.id === selectedRiskProduct) || HOME_BRIEFING_PRODUCTS[0] || products[0],
    [selectedRiskProduct]
  );

  const quizProduct = useMemo(
    () => QUIZ_PRODUCTS.find((product) => product.id === quizProductId) || QUIZ_PRODUCTS[0] || products[0],
    [quizProductId]
  );
  const walletDisplayName = useMemo(
    () => getWalletDisplayName(address, walletNickname, shortAddress),
    [address, walletNickname]
  );
  const progressStorageKey = useMemo(() => getProgressStorageKey(address), [address]);
  const paperStorageKey = useMemo(() => getPaperStateKey(address), [address]);
  const connectedAddressKey = useMemo(() => (address ? address.toLowerCase() : ''), [address]);
  const mintRecipientKey = useMemo(() => (mintRecipient ? mintRecipient.toLowerCase() : ''), [mintRecipient]);
  const profileBackupAccounts = useMemo(
    () => listProfileBackupAccounts(),
    [connectedAddressKey, profileBackupStatus, walletNickname]
  );
  const developerWalletAccounts = useMemo(
    () =>
      listDeveloperWalletAccounts({
        connectedAddress: address,
        analyticsSnapshot,
        backupAccounts: profileBackupAccounts
      }),
    [
      address,
      analyticsSnapshot,
      connectedAddressKey,
      developerSessionDirty,
      devModeOpen,
      paperBalanceSnapshot,
      paperTradesCompleted,
      profileBackupAccounts,
      profileBackupStatus,
      walletNickname
    ]
  );

  useEffect(() => {
    if (isConnected) {
      setWalletError('');
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) {
      setWalletNicknameFeedback('');
      setGuideCompleted(false);
      setQuizCompleted(false);
      setMintHelpOpen('');
      setViewedRiskCards([]);
      setRiskCheckpointAnswers({});
      setQuizSubmitted(false);
      setQuizAnswers(createEmptyQuizAnswers());
      setLiveChainId(null);
      setPaperTradesCompleted(0);
      setProgressAccountKey('');
      setMintTaskKey('welcome');
      setTaskCompletionNotice('');
      setTaskCompletionNoticeTarget('core');
      setDeveloperExitPromptOpen(false);
      setDeveloperSessionDirty(false);
      developerSessionSnapshotRef.current = null;
    }
  }, [isConnected]);

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
    if (!developerWalletAccounts.length) {
      setDeveloperWalletAddress('');
      return;
    }

    setDeveloperWalletAddress((current) => {
      const normalizedCurrent = normalizeAnalyticsWalletAddress(current);
      if (normalizedCurrent && developerWalletAccounts.some((account) => account.address === normalizedCurrent)) {
        return normalizedCurrent;
      }

      const connectedAccount = connectedAddressKey
        ? developerWalletAccounts.find((account) => account.address === connectedAddressKey)
        : null;
      return connectedAccount?.address || developerWalletAccounts[0].address;
    });
  }, [connectedAddressKey, developerWalletAccounts]);

  useEffect(() => {
    setMintRecipient('');
    setMintTaskKey('welcome');
  }, [connectedAddressKey]);

  useEffect(() => {
    if (!connectedAddressKey || !badgeContractConfigured) return;

    void Promise.allSettled([
      refetchWelcomeBadge?.(),
      refetchWalletBadge?.(),
      refetchRiskBadge?.(),
      refetchQuizBadge?.(),
      refetchPaperBadge?.()
    ]);
  }, [
    connectedAddressKey,
    refetchWelcomeBadge,
    refetchWalletBadge,
    refetchRiskBadge,
    refetchQuizBadge,
    refetchPaperBadge
  ]);

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
    if (!address || pendingWalletNickname === null) return;

    const savedNickname = writeWalletNickname(address, pendingWalletNickname);
    setWalletNickname(savedNickname);
    setWalletNicknameDraft(savedNickname);
    setWalletNicknameFeedback(savedNickname ? `Nickname saved as ${savedNickname}.` : 'Nickname cleared.');
    setPendingWalletNickname(null);
  }, [address, pendingWalletNickname]);

  useEffect(() => {
    if (!address) return;
    const nextProgressAccountKey = address.toLowerCase();
    const storedProgress = readStorageJson(progressStorageKey, {
      viewedRiskCards: [],
      guideCompleted: false,
      quizCompleted: false,
      paperTradesCompleted: 0,
      homeOnboardingCompleted: false,
      paperUnlocked: false,
      adminUnlocked: false
    });
    const profileProgress = readWalletProfile(address).progress;
    const storedViewedRiskCards = sanitizeViewedRiskCards(storedProgress.viewedRiskCards);
    const profileViewedRiskCards = sanitizeViewedRiskCards(profileProgress.viewedRiskCards);
    const initialViewedRiskCards = storedViewedRiskCards.length
      ? storedViewedRiskCards
      : profileViewedRiskCards.length
        ? profileViewedRiskCards
        : selectedRiskProduct
          ? [selectedRiskProduct]
          : [];

    setViewedRiskCards(initialViewedRiskCards);
    setGuideCompleted(Boolean(storedProgress.guideCompleted || profileProgress.guideCompleted || initialViewedRiskCards.length >= RISK_REVIEW_REQUIRED));
    setQuizCompleted(Boolean(storedProgress.quizCompleted || profileProgress.quizCompleted));
    setPaperTradesCompleted(Math.max(Number(storedProgress.paperTradesCompleted || 0), Number(profileProgress.paperTradesCompleted || 0)));
    setProgressAccountKey(nextProgressAccountKey);
  }, [address, progressStorageKey, selectedRiskProduct]);

  useEffect(() => {
    if (!address || progressAccountKey !== connectedAddressKey) return;
    const existingProgress = readStorageJson(progressStorageKey, {});
    const profileProgress = readWalletProfile(address).progress;
    const nextViewedRiskCards = sanitizeViewedRiskCards(viewedRiskCards);
    const nextGuideCompleted = Boolean(guideCompleted || nextViewedRiskCards.length >= RISK_REVIEW_REQUIRED);
    const nextProgress = {
      viewedRiskCards: nextViewedRiskCards,
      guideCompleted: nextGuideCompleted,
      quizCompleted,
      paperTradesCompleted,
      homeOnboardingCompleted: Boolean(existingProgress.homeOnboardingCompleted || profileProgress.homeOnboardingCompleted),
      paperUnlocked: Boolean(existingProgress.paperUnlocked || profileProgress.paperUnlocked),
      adminUnlocked: Boolean(existingProgress.adminUnlocked || profileProgress.adminUnlocked),
      userOrigin,
      web2Intent,
      web3Intent
    };
    writeStorageJson(progressStorageKey, nextProgress);
    writeWalletProfilePatch(address, {
      progress: nextProgress,
      home: {
        paperBalanceSnapshot,
        userOrigin,
        web2Intent,
        web3Intent
      }
    });
  }, [
    address,
    connectedAddressKey,
    progressAccountKey,
    progressStorageKey,
    viewedRiskCards,
    guideCompleted,
    quizCompleted,
    paperTradesCompleted,
    paperBalanceSnapshot,
    userOrigin,
    web2Intent,
    web3Intent
  ]);

  useEffect(() => {
    if (viewedRiskCards.length >= RISK_REVIEW_REQUIRED && !guideCompleted) {
      setGuideCompleted(true);
    }
  }, [guideCompleted, viewedRiskCards]);

  useEffect(() => {
    if (!address) {
      setPaperBalanceSnapshot(STARTING_PAPER_TOKENS);
      return;
    }

    const storedPaperState = readStorageJson(paperStorageKey, {
      balance: STARTING_PAPER_TOKENS,
      positions: {}
    });

    setPaperBalanceSnapshot(readRecoveredHomePaperBalance(address, Number(storedPaperState.balance ?? STARTING_PAPER_TOKENS)));
  }, [address, paperStorageKey]);

  useEffect(() => {
    deleteStorageKey(DEV_AUTH_STORAGE_KEY);
    setDevModeAuthed(false);
    setAnalyticsSnapshot(readStorageJson(ANALYTICS_STORAGE_KEY, { total: 0, events: {} }));
  }, []);

  useEffect(() => {
    setHasMetaMaskInstalled(Boolean(detectMetaMaskProvider()));
  }, []);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) return undefined;

    let active = true;

    async function syncChainId() {
      try {
        const nextChainHex = await ethereum.request({ method: 'eth_chainId' });
        if (!active) return;
        setLiveChainId(parseHexChainId(nextChainHex));
      } catch {
        if (active) setLiveChainId(null);
      }
    }

    syncChainId();

    function handleChainChanged(nextChainHex) {
      setLiveChainId(parseHexChainId(nextChainHex));
    }

    function handleDisconnect() {
      setLiveChainId(null);
    }

    ethereum.on?.('chainChanged', handleChainChanged);
    ethereum.on?.('connect', syncChainId);
    ethereum.on?.('disconnect', handleDisconnect);
    ethereum.on?.('accountsChanged', syncChainId);

    return () => {
      active = false;
      ethereum.removeListener?.('chainChanged', handleChainChanged);
      ethereum.removeListener?.('connect', syncChainId);
      ethereum.removeListener?.('disconnect', handleDisconnect);
      ethereum.removeListener?.('accountsChanged', syncChainId);
    };
  }, []);

  useEffect(() => {
    if (chainId) {
      setLiveChainId(chainId);
    }
  }, [chainId]);

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
    if (!mintError) return;
    setWalletError(String(mintError.message || 'Mint failed.'));
  }, [mintError]);

  useEffect(() => {
    if (!mintConfirmed || !connectedAddressKey || mintRecipientKey !== connectedAddressKey || !badgeContractConfigured) return undefined;

    const refetchByTask = {
      welcome: refetchWelcomeBadge,
      wallet: refetchWalletBadge,
      risk: refetchRiskBadge,
      quiz: refetchQuizBadge,
      paper: refetchPaperBadge
    };
    const refetchMintedBadge = refetchByTask[mintTaskKey];
    let cancelled = false;

    async function refreshMintedBadge() {
      if (refetchMintedBadge) {
        await Promise.allSettled([refetchMintedBadge()]);
      }
      if (!cancelled) {
        setMintRecipient('');
        setMintTaskKey('welcome');
      }
    }

    void refreshMintedBadge();

    return () => {
      cancelled = true;
    };
  }, [
    mintConfirmed,
    connectedAddressKey,
    mintRecipientKey,
    mintTaskKey,
    refetchWelcomeBadge,
    refetchWalletBadge,
    refetchRiskBadge,
    refetchQuizBadge,
    refetchPaperBadge
  ]);

  const guide = painPointGuides[painPoint];
  const activeMintTaskKey = mintRecipientKey && mintRecipientKey === connectedAddressKey ? mintTaskKey : '';
  const mintForCurrentAccountBusy = Boolean(activeMintTaskKey) && (isMinting || isConfirmingMint || mintConfirmed);
  const badgeMintCompleted = Boolean(address) && Boolean(hasMintedBadgeOnchain);
  const walletQuestDone = isConnected;
  const nicknameTaskDone = Boolean(walletNickname);
  const welcomeGateCompleted = badgeContractConfigured ? badgeMintCompleted : walletQuestDone;
  const walletTaskBadgeMinted = Boolean(address) && Boolean(walletBadgeOnchain);
  const riskTaskBadgeMinted = Boolean(address) && Boolean(riskBadgeOnchain);
  const quizTaskBadgeMinted = Boolean(address) && Boolean(quizBadgeOnchain);
  const paperTaskBadgeMinted = Boolean(address) && Boolean(paperBadgeOnchain);
  const paperTradeCompleted = paperTradesCompleted > 0;
  const walletBadgeChecking = Boolean(address) && badgeContractConfigured && !walletBadgeFetched && walletBadgeFetching;
  const welcomeBadgeChecking = Boolean(address) && badgeContractConfigured && !welcomeBadgeFetched && welcomeBadgeFetching;
  const riskBadgeChecking = Boolean(address) && badgeContractConfigured && !riskBadgeFetched && riskBadgeFetching;
  const quizBadgeChecking = Boolean(address) && badgeContractConfigured && !quizBadgeFetched && quizBadgeFetching;
  const paperBadgeChecking = Boolean(address) && badgeContractConfigured && !paperBadgeFetched && paperBadgeFetching;
  const localProgressReady = Boolean(connectedAddressKey && progressAccountKey === connectedAddressKey);
  const riskReviewProgress = Math.min(viewedRiskCards.length, RISK_REVIEW_REQUIRED);
  const riskTaskDone = (localProgressReady && (guideCompleted || viewedRiskCards.length >= RISK_REVIEW_REQUIRED)) || riskTaskBadgeMinted;
  const quizTaskDone = (localProgressReady && quizCompleted) || quizTaskBadgeMinted;
  const selectedRiskCheckpoint = selectedRiskCard?.reviewOptions?.find(
    (option) => option.id === riskCheckpointAnswers[selectedRiskCard.id]
  ) || null;
  const riskCheckpointCorrectCount = Object.entries(riskCheckpointAnswers).reduce((count, [productId, optionId]) => {
    const product = products.find((entry) => entry.id === productId);
    return product?.reviewOptions?.some((option) => option.id === optionId && option.correct) ? count + 1 : count;
  }, 0);
  const quizQuestionRows = quizProduct?.quiz?.questions || [];
  const quizAllQuestionsAnswered = quizQuestionRows.every((question) => Boolean(quizAnswers[question.id]));
  const quizPassed = quizQuestionRows.length > 0 && quizQuestionRows.every((question) => quizAnswers[question.id] === question.correct);
  const flowConfig = onboardingFlows[userOrigin];
  const currentRoute = userOrigin === 'web2' ? flowConfig.choices[web2Intent] : flowConfig.choices[web3Intent];
  const fastTrackPaper = userOrigin === 'web3' && web3Intent === 'skip';
  const badgeRewardsEarned = [
    walletTaskBadgeMinted,
    badgeMintCompleted,
    riskTaskBadgeMinted,
    quizTaskBadgeMinted,
    paperTaskBadgeMinted
  ].filter(Boolean).length * BADGE_REWARD_TOKENS;
  const paperBalanceForCurrentAccount = localProgressReady ? paperBalanceSnapshot : STARTING_PAPER_TOKENS;
  const walletProfileSnapshot = readWalletProfile(address);
  const profileBackupRecord = address ? readStorageJson(getWalletProfilePointerKey(address), null) : null;
  const profileBackupConfigured = Boolean(profileBackupRecord?.contentHash || walletProfileSnapshot.storage?.contentHash);
  const profileBackupRecoverable = Boolean(profileBackupRecord?.profile);
  const profileBackupTimestamp = profileBackupRecord?.createdAt || walletProfileSnapshot.storage?.signedAt || '';
  const profileBackupSignedLabel =
    profileBackupTimestamp && !Number.isNaN(new Date(profileBackupTimestamp).getTime())
      ? new Date(profileBackupTimestamp).toLocaleString()
      : '';
  const profileBackupHashPreview = String(profileBackupRecord?.contentHash || walletProfileSnapshot.storage?.contentHash || '').slice(0, 12);
  const walletProfileSummary = getWalletProfileSummary({
    ...walletProfileSnapshot,
    progress: {
      viewedRiskCards: localProgressReady ? viewedRiskCards : [],
      guideCompleted: localProgressReady && guideCompleted,
      quizCompleted: localProgressReady && quizCompleted,
      paperTradesCompleted: localProgressReady ? paperTradesCompleted : 0,
      userOrigin,
      web2Intent,
      web3Intent
    },
    home: {
      paperBalanceSnapshot: paperBalanceForCurrentAccount,
      userOrigin,
      web2Intent,
      web3Intent
    }
  });
  const remainingPaperTokens = walletProfileSummary.remainingPT;
  const profileBackupSummaryText = profileBackupStatus || (
    isConnected
      ? profileBackupConfigured
        ? `Signed backup ready for ${shortAddress(address)}${profileBackupSignedLabel ? `, saved ${profileBackupSignedLabel}` : ''}${profileBackupHashPreview ? `. Hash ${profileBackupHashPreview}...` : '.'}`
        : `No signed backup yet for ${shortAddress(address)}. Sign one here so this wallet can recover PT progress, replay history, and wealth context later.`
      : profileBackupAccounts.length
        ? `${profileBackupAccounts.length} historical backup${profileBackupAccounts.length === 1 ? '' : 's'} found on this device. Connect the matching MetaMask account before recovery.`
        : 'Connect a wallet to create or recover a signed demo-state backup for this address.'
  );
  const adminUnlockedForCurrentAccount = Boolean(
    (address && readStorageJson(getAdminUnlockStorageKey(address), false)) || walletProfileSnapshot.progress?.adminUnlocked
  );
  const developerAnalyticsRows = useMemo(
    () =>
      Object.entries(analyticsSnapshot.events || {})
        .sort((left, right) => right[1] - left[1])
        .map(([name, count]) => {
          const meta = getAnalyticsEventMeta(name);
          return {
            name,
            count,
            share: analyticsSnapshot.total ? (count / analyticsSnapshot.total) * 100 : 0,
            ...meta
          };
        }),
    [analyticsSnapshot]
  );
  const developerTopAnalyticsRow = developerAnalyticsRows[0] || null;
  const developerTrackedSectionCount = new Set(developerAnalyticsRows.map((row) => row.section)).size;
  const developerOnboardingShare = analyticsSnapshot.total
    ? developerAnalyticsRows
        .filter((row) => ['Wallet onboarding', 'Quest wall', 'Risk review', 'Quiz', 'Wallet collectible actions'].includes(row.section))
        .reduce((sum, row) => sum + row.count, 0) / analyticsSnapshot.total
    : 0;
  const selectedDeveloperWalletAccount =
    developerWalletAccounts.find((account) => account.address === developerWalletAddress) || developerWalletAccounts[0] || null;
  const selectedDeveloperWalletAddress = selectedDeveloperWalletAccount?.address || '';
  const selectedDeveloperWalletProfile = useMemo(
    () => (selectedDeveloperWalletAddress ? readWalletProfile(selectedDeveloperWalletAddress) : null),
    [
      analyticsSnapshot,
      developerSessionDirty,
      devModeOpen,
      paperBalanceSnapshot,
      paperTradesCompleted,
      profileBackupStatus,
      selectedDeveloperWalletAddress
    ]
  );
  const selectedDeveloperWalletSummary = selectedDeveloperWalletProfile
    ? getWalletProfileSummary(selectedDeveloperWalletProfile)
    : null;
  const selectedDeveloperProgress = selectedDeveloperWalletProfile?.progress || {};
  const selectedDeveloperBehavior = selectedDeveloperWalletAddress
    ? getWalletAnalyticsBucket(analyticsSnapshot, selectedDeveloperWalletAddress)
    : createEmptyWalletAnalytics();
  const selectedDeveloperBackupRecord = selectedDeveloperWalletAddress
    ? readStorageJson(getWalletProfilePointerKey(selectedDeveloperWalletAddress), null)
    : null;
  const selectedDeveloperRiskCount = sanitizeViewedRiskCards(selectedDeveloperProgress.viewedRiskCards).length;
  const selectedDeveloperTaskCount = selectedDeveloperWalletSummary?.completedMilestones || 0;
  const selectedDeveloperPaperUnlocked = Boolean(
    selectedDeveloperProgress.paperUnlocked ||
      selectedDeveloperProgress.homeOnboardingCompleted ||
      selectedDeveloperProgress.adminUnlocked ||
      selectedDeveloperProgress.paperTradesCompleted > 0 ||
      selectedDeveloperWalletAddress
  );
  const selectedDeveloperOrigin =
    selectedDeveloperWalletProfile?.home?.userOrigin || selectedDeveloperProgress.userOrigin || 'unknown';
  const selectedDeveloperIntent =
    selectedDeveloperOrigin === 'web3'
      ? selectedDeveloperWalletProfile?.home?.web3Intent || selectedDeveloperProgress.web3Intent || 'learn'
      : selectedDeveloperWalletProfile?.home?.web2Intent || selectedDeveloperProgress.web2Intent || 'trading';
  const selectedDeveloperTopBehavior = Object.entries(selectedDeveloperBehavior.events || {})
    .sort((left, right) => right[1] - left[1])
    .map(([name, count]) => ({ ...getAnalyticsEventMeta(name), name, count }))[0] || null;
  const selectedDeveloperDesignTitle =
    selectedDeveloperOrigin === 'web3' && selectedDeveloperIntent === 'skip'
      ? 'Fast replay preference'
      : selectedDeveloperOrigin === 'web3'
        ? 'Wallet-native learning preference'
        : selectedDeveloperIntent === 'wealth'
          ? 'Cautious wealth-first preference'
          : 'Guided task-first preference';
  const selectedDeveloperBehaviorPointer = selectedDeveloperBehavior.contentHash || '';
  const selectedDeveloperStorageMode =
    selectedDeveloperBackupRecord?.remote?.ok || selectedDeveloperBackupRecord?.remote?.cid || selectedDeveloperBackupRecord?.remote?.url
      ? 'Signed remote pointer'
      : selectedDeveloperWalletSummary?.contentHash
        ? 'Signed content-addressed local'
        : selectedDeveloperBehaviorPointer
          ? 'Behavior content-addressed local'
          : selectedDeveloperWalletSummary?.storageMode || 'Local-first';
  const selectedDeveloperRecommendedProductId =
    selectedDeveloperOrigin === 'web3' && selectedDeveloperIntent === 'skip'
      ? 'superstate-uscc'
      : selectedDeveloperIntent === 'wealth'
        ? 'superstate-ustb'
        : selectedDeveloperProgress.quizCompleted || selectedDeveloperRiskCount >= RISK_REVIEW_REQUIRED
          ? 'ondo-ousg'
          : 'superstate-ustb';
  const selectedDeveloperRecommendedProduct =
    products.find((product) => product.id === selectedDeveloperRecommendedProductId) || products[0];
  const selectedDeveloperRecommendationCopy =
    selectedDeveloperRecommendedProduct.id === 'superstate-uscc'
      ? 'Recommend the strategy-yield sleeve only after the wallet has chosen a faster replay route, then test it in Paper first.'
      : selectedDeveloperRecommendedProduct.id === 'ondo-ousg'
        ? 'Recommend a Treasury sleeve with wrapper and exit-path explanation after the wallet has learning progress.'
        : 'Recommend the clean reserve sleeve first so the wallet sees ownership, NAV, and redemption rules before riskier products.';
  const selectedDeveloperWalletDisplayName = selectedDeveloperWalletAccount?.label || (
    selectedDeveloperWalletAddress ? shortAddress(selectedDeveloperWalletAddress) : 'No wallet selected'
  );
  const completedTaskCount = [
    walletQuestDone,
    nicknameTaskDone,
    welcomeGateCompleted,
    riskTaskDone,
    quizTaskDone,
    paperTradeCompleted,
    walletTaskBadgeMinted,
    riskTaskBadgeMinted,
    quizTaskBadgeMinted,
    paperTaskBadgeMinted
  ].filter(Boolean).length;
  const walletTaskAccessUnlocked = walletQuestDone || adminUnlockedForCurrentAccount;
  const wealthHubUnlocked = walletTaskAccessUnlocked;
  const paperTradingUnlocked = walletTaskAccessUnlocked;
  const paperTradingLockedByTutorial = !paperTradingUnlocked;
  const walletLearningProfile = !isConnected
    ? {
        title: 'No wallet connected',
        copy: 'Connect a wallet to inspect live wallet progress, PT state, and override behavior from this admin panel.'
      }
    : paperTradesCompleted > 0 || adminUnlockedForCurrentAccount || paperTradingUnlocked
      ? {
          title: 'Replay-ready wallet',
          copy: 'This wallet has crossed the guided path into replay or admin-ready behavior. PT balance, unlocks, and backups should stay consistent across Home, Wealth, and Paper.'
        }
      : quizTaskDone || riskTaskDone
        ? {
            title: 'Builder wallet',
            copy: 'This wallet already understands ownership, return source, and disclosure well enough to move beyond pure reserve products.'
          }
        : {
        title: 'Starter wallet',
        copy: 'This wallet should still be routed toward reserve sleeves, explicit ownership language, and guided explanation before strategy-heavy products.'
      };
  const getDeveloperEventCount = (eventName) => Number(analyticsSnapshot.events?.[eventName] || 0);
  const developerClickthroughRows = [
    {
      label: 'Total tracked clicks',
      value: Number(analyticsSnapshot.total || 0).toLocaleString(),
      copy: analyticsSnapshot.total
        ? `${developerTrackedSectionCount} section groups captured in this browser.`
        : 'No click-through data is stored yet.'
    },
    {
      label: 'Top click',
      value: developerTopAnalyticsRow ? developerTopAnalyticsRow.label : 'None yet',
      copy: developerTopAnalyticsRow
        ? `${developerTopAnalyticsRow.count} events in ${developerTopAnalyticsRow.section}.`
        : 'Open wallet, quest, Wealth, or Paper routes to populate this.'
    },
    {
      label: 'Guided onboarding share',
      value: `${Math.round(developerOnboardingShare * 100)}%`,
      copy: 'Share of tracked clicks tied to onboarding, quest, risk, quiz, or collectible actions.'
    }
  ];
  const developerClickthroughTiles = [
    {
      label: 'Hero CTAs',
      value: getDeveloperEventCount('hero_discover_click') + getDeveloperEventCount('hero_route_help_click'),
      copy: 'First-screen discovery and route-help clicks.'
    },
    {
      label: 'Wallet opens',
      value: getDeveloperEventCount('wallet_modal_open'),
      copy: 'MetaMask entry-point opens from the homepage.'
    },
    {
      label: 'Quest details',
      value: developerAnalyticsRows.filter((row) => row.name.startsWith('module_')).reduce((sum, row) => sum + row.count, 0),
      copy: 'Task tiles opened into their detail panels.'
    },
    {
      label: 'Product briefings',
      value: developerAnalyticsRows.filter((row) => row.name.startsWith('risk_card_')).reduce((sum, row) => sum + row.count, 0),
      copy: 'Risk cards opened before paper or wealth routing.'
    },
    {
      label: 'External modules',
      value: getDeveloperEventCount('wealth_hub_open') + getDeveloperEventCount('paper_trading_page_open'),
      copy: 'Click-through from Home into Wealth or Paper.'
    },
    {
      label: 'Collectibles',
      value: developerAnalyticsRows.filter((row) => row.name.startsWith('badge_mint_')).reduce((sum, row) => sum + row.count, 0),
      copy: 'Wallet collectible mint attempts captured locally.'
    }
  ];
  const developerClickthroughButtons = [
    ...developerClickthroughTiles,
    ...developerAnalyticsRows.slice(0, 8).map((row) => ({
      label: row.label,
      value: row.count,
      copy: `${row.section} / ${row.share.toFixed(1)}% of stored clicks.`
    }))
  ];
  const developerDetailPanels = [
    {
      id: 'clicks',
      label: 'Click-through',
      kicker: 'Analytics',
      title: 'Module click-through map',
      copy: analyticsSnapshot.total
        ? `This browser has ${analyticsSnapshot.total} tracked clicks across ${developerTrackedSectionCount} section groups.`
        : 'No click-through data is stored yet; start by opening wallet, quest, wealth, or paper flows.',
      rows: developerClickthroughRows
    },
    {
      id: 'exchange',
      label: 'Guided preference',
      kicker: selectedDeveloperWalletDisplayName,
      title: selectedDeveloperDesignTitle,
      copy: 'This view reads wallet behavior, task progress, and signed profile metadata. Feature override and PT controls live here only.',
      rows: [
        { label: 'Arrival mindset', value: selectedDeveloperOrigin === 'unknown' ? 'Unknown' : selectedDeveloperOrigin.toUpperCase(), copy: `Stored intent: ${selectedDeveloperIntent || 'not set'}.` },
        { label: 'Most common action', value: selectedDeveloperTopBehavior ? selectedDeveloperTopBehavior.label : 'No behavior yet', copy: selectedDeveloperTopBehavior ? `${selectedDeveloperTopBehavior.count} clicks in ${selectedDeveloperTopBehavior.section}.` : 'Actions will appear here after this wallet uses Home routes.' },
        { label: 'Recommended product', value: selectedDeveloperRecommendedProduct.name, copy: selectedDeveloperRecommendationCopy },
        { label: 'Replay stance', value: selectedDeveloperPaperUnlocked ? 'Open replay' : 'Guide first', copy: selectedDeveloperPaperUnlocked ? 'Paper trading can open because the wallet task or admin unlock is present.' : 'Route through the wallet task before replay.' },
        { label: 'Storage read form', value: selectedDeveloperStorageMode, copy: selectedDeveloperWalletSummary?.contentHash ? `Readable profile pointer ${selectedDeveloperWalletSummary.contentHash.slice(0, 12)}...` : selectedDeveloperBehaviorPointer ? `Readable behavior snapshot ${selectedDeveloperBehaviorPointer.slice(0, 12)}...` : 'No storage pointer yet; use this wallet once or sign a profile backup to create a readable record.' },
        { label: 'Feature override', value: adminUnlockedForCurrentAccount ? 'Already on' : 'Ready', copy: 'Enable onboarding, quiz, paper unlock, and admin override for the connected wallet.' },
        { label: 'PT amount box', value: `${Number(devModePtAmount || 0).toLocaleString()} PT`, copy: 'Add to or set the Home and Paper cash stores for the connected account.' }
      ]
    }
  ];
  const activeDeveloperDetailPanel =
    developerDetailPanels.find((panel) => panel.id === developerDetailTopic) || developerDetailPanels[0];
  const effectiveChainId = chainId ?? liveChainId ?? null;
  const onSepolia = effectiveChainId === SEPOLIA_CHAIN_ID;
  const hasSepoliaGas = Boolean(sepoliaBalance?.value && sepoliaBalance.value > 0n);
  const badgeDeploymentLabel = badgeContractConfigured
    ? `Sepolia collectible ${shortAddress(BADGE_CONTRACT_ADDRESS)}`
    : 'Demo mode - onchain collectible not connected';
  const badgeDeploymentHelper = badgeContractConfigured
    ? 'Vercel build detected the collectible contract address, so judges can mint and verify the first wallet collectible on Sepolia.'
    : 'The demo still works with wallet-based local progress. To enable judge-visible onchain minting, add VITE_BADGE_CONTRACT_ADDRESS in Vercel and redeploy.';
  const mintReady =
    isConnected &&
    onSepolia &&
    badgeContractConfigured &&
    welcomeBadgeFetched &&
    !badgeMintCompleted &&
    !mintForCurrentAccountBusy &&
    !isMinting &&
    !isConfirmingMint &&
    !isSwitchingChain;
  const remainingPaperPrereqs = [
    walletTaskAccessUnlocked ? null : 'complete the wallet task first'
  ].filter(Boolean);
  const paperUnlockChecklist = [
    {
      id: 'wallet',
      label: 'Wallet task completed',
      done: walletTaskAccessUnlocked,
      helper: walletTaskAccessUnlocked
        ? `Connected ${walletDisplayName}; Wealth and Replay can now open.`
        : 'Connect MetaMask from the wallet task first; Wealth and Replay stay preview-only until then.'
    },
    {
      id: 'learn',
      label: 'Learning tasks optional',
      done: riskTaskDone || quizTaskDone,
      helper: riskTaskDone || quizTaskDone
        ? 'Briefing or quiz progress improves recommendations, but it no longer opens Replay by itself.'
        : 'Review product briefings or pass the quiz after the wallet task for better recommendations.'
    },
    {
      id: 'mint',
      label: 'Collectible mint optional',
      done: badgeMintCompleted || walletTaskBadgeMinted || riskTaskBadgeMinted || quizTaskBadgeMinted || paperTaskBadgeMinted,
      helper: badgeMintCompleted || walletTaskBadgeMinted || riskTaskBadgeMinted || quizTaskBadgeMinted || paperTaskBadgeMinted
        ? 'A collectible exists for this wallet, but access is still keyed to the wallet task.'
        : 'Minting remains a reward step after the wallet task, not the Wealth or Replay gate.'
    }
  ];
  const mintChecklist = [
    {
      id: 'wallet',
      label: 'Wallet connected',
      done: walletQuestDone,
      helper: isConnected ? `Connected ${walletDisplayName}` : 'Connect MetaMask before minting.'
    },
    {
      id: 'nickname',
      label: 'Save nickname',
      done: nicknameTaskDone,
      helper: nicknameTaskDone
        ? `${walletNickname} is saved locally for this wallet.`
        : walletQuestDone
          ? 'Use the wallet panel to save a nickname for this account.'
          : 'Connect MetaMask before saving a wallet nickname.'
    },
    {
      id: 'network',
      label: 'On Sepolia network',
      done: onSepolia,
      helper: onSepolia
        ? 'Sepolia ETH is active in MetaMask. You still need Sepolia ETH for gas.'
        : 'In the MetaMask extension, open the network selector, then choose Sepolia ETH from the test networks or custom list.'
    },
    {
      id: 'gas',
      label: 'Sepolia ETH for gas',
      done: hasSepoliaGas,
      helper: hasSepoliaGas
        ? `Detected ${formatTokenAmount(sepoliaBalance?.value, 18, 8)} Sepolia ETH in this wallet.`
        : 'Use a faucet below to request test ETH before minting.'
    }
  ];
  const paperTaskDone = paperTaskBadgeMinted;

  function getMintTaskStatus(taskKey) {
    if (activeMintTaskKey !== taskKey) return '';
    if (isMinting) return 'Confirm mint in MetaMask';
    if (isConfirmingMint) return 'Waiting for Sepolia confirmation';
    if (mintConfirmed) return 'Refreshing collectible status';
    return '';
  }

  function getQuestStatusLabel(status) {
    if (status === 'Done') return 'Wait to be minted';
    if (status === 'Unlocked') return 'Unlocked';
    return status;
  }

  const mintStatusText = !isConnected
    ? 'Connect MetaMask first'
      : !onSepolia
        ? 'Switch to Sepolia'
      : !badgeContractConfigured
        ? 'Collectible contract not connected'
        : badgeMintCompleted
          ? 'Welcome collectible minted'
        : activeMintTaskKey === 'welcome' && mintConfirmed
          ? 'Refreshing collectible status'
        : welcomeBadgeChecking
          ? 'Checking this wallet account'
        : isSwitchingChain
          ? 'Switching network...'
          : isMinting
            ? 'Confirm mint in MetaMask'
            : isConfirmingMint
              ? 'Waiting for Sepolia confirmation'
              : 'Ready to mint on Sepolia';

  const learnQuestCards = [
    {
      id: 'wallet',
      title: walletTaskBadgeMinted ? 'Wallet task completed' : walletQuestDone ? 'Wallet connected' : 'Connect wallet',
      status: walletTaskBadgeMinted ? 'Completed' : walletQuestDone ? 'Done' : walletBadgeChecking ? 'Checking' : 'To do',
      reward: '+1000 PT',
      label: quests[0].reward,
      hint: 'Start here for the real MetaMask flow.',
      coverAccent: 'green',
      coverKicker: 'RiskLens Starter Task',
      coverTitle: walletTaskBadgeMinted ? 'Wallet task' : 'Connect wallet',
      coverSubtitle: 'Open the guided wallet path first so every later collectible and PT reward stays tied to one account.',
      coverFooterLines: [walletDisplayName, walletTaskBadgeMinted ? 'Sepolia wallet collectible' : 'Connect MetaMask first'],
      coverStamp: 'S'
    },
    {
      id: 'mint',
      title: badgeContractConfigured
        ? badgeMintCompleted
          ? 'Welcome collectible minted'
          : 'Mint welcome collectible'
        : walletQuestDone
          ? 'Wallet linked for demo'
          : 'Connect wallet for demo',
      status: badgeContractConfigured
        ? badgeMintCompleted
          ? 'Completed'
          : welcomeBadgeChecking
            ? 'Checking'
            : walletQuestDone
              ? 'To do'
              : 'Requires wallet'
        : walletQuestDone
          ? 'Demo ready'
          : 'Requires wallet',
      reward: '+1000 PT',
      label: quests[1].reward,
      hint: badgeContractConfigured
        ? walletQuestDone
          ? 'Submit one Sepolia action after connect.'
          : 'Unlocks after wallet connection.'
        : 'Onchain collectible minting is optional for this deployment; wallet connection carries the demo state.',
      coverAccent: 'teal',
      coverKicker: 'RiskLens Collectible Gate',
      coverTitle: badgeContractConfigured ? 'Welcome collectible' : 'Demo gate',
      coverSubtitle: badgeContractConfigured
        ? 'Mint one Sepolia welcome collectible so the first reward feels onchain instead of purely local.'
        : 'This deployment keeps the welcome gate in demo mode, but the same wallet still carries the unlock state.',
      coverFooterLines: [badgeMintCompleted ? 'Welcome collectible minted' : mintStatusText, `Reward +${BADGE_REWARD_TOKENS} PT`],
      coverStamp: 'S'
    },
    {
      id: 'risk',
      title: riskTaskBadgeMinted ? 'Briefing task completed' : riskTaskDone ? 'Product briefings ready to mint' : 'Review product briefings',
      status: riskTaskBadgeMinted ? 'Completed' : riskTaskDone ? 'Done' : riskBadgeChecking ? 'Checking' : 'To do',
      reward: '+1000 PT',
      label: quests[2].reward,
      hint: `Review any ${RISK_REVIEW_REQUIRED} live product briefings from the current Wealth and Paper lanes.`,
      coverAccent: 'gold',
      coverKicker: 'RiskLens Briefing Task',
      coverTitle: 'Product briefings',
      coverSubtitle: 'Use four product lanes to explain ownership, return source, and first disclosure before any trade-style action.',
      coverFooterLines: [`Reviewed ${riskReviewProgress}/${RISK_REVIEW_REQUIRED}`, riskTaskBadgeMinted ? 'Risk review collectible' : 'Briefing task'],
      coverStamp: 'S'
    },
    {
      id: 'quiz',
      title: quizTaskBadgeMinted ? 'Product quiz completed' : quizTaskDone ? 'Product quiz ready to mint' : 'Finish 3-question quiz',
      status: quizTaskBadgeMinted ? 'Completed' : quizTaskDone ? 'Done' : quizBadgeChecking ? 'Checking' : 'To do',
      reward: '+1000 PT',
      label: quests[3].reward,
      hint: 'Check ownership, return source, and first disclosure for one real product lane.',
      coverAccent: 'teal',
      coverKicker: 'RiskLens Quiz Task',
      coverTitle: 'Question quiz',
      coverSubtitle: 'Turn one product briefing into a short ownership-and-risk check before the user opens any simulated route.',
      coverFooterLines: [quizTaskDone ? 'Quiz passed' : `${quizQuestionRows.length} checks`, quizTaskBadgeMinted ? 'Product quiz collectible' : 'Ownership + downside'],
      coverStamp: 'S'
    },
    {
      id: 'paper',
      title: paperTaskBadgeMinted ? 'Paper trading preview completed' : paperTradingUnlocked ? 'Paper trading preview ready' : 'Paper trading preview',
      status: paperTaskDone ? 'Completed' : paperTradingUnlocked ? 'Done' : paperBadgeChecking ? 'Checking' : 'Wallet task first',
      reward: '+1000 PT',
      label: quests[4].reward,
      hint: paperTradingUnlocked
        ? 'Unlocked because this wallet completed the wallet task. Minting is optional.'
        : 'Complete the wallet task first. Briefings and quiz can improve fit, but they do not open Replay alone.',
      coverAccent: 'green',
      coverKicker: 'RiskLens Replay Task',
      coverTitle: 'Paper trading',
      coverSubtitle: 'Practice with replay mode after the wallet task is complete; collectibles can still be minted afterward.',
      coverFooterLines: [paperTradingUnlocked ? 'Replay mode unlocked' : 'Wallet task first', paperTaskBadgeMinted ? 'Paper preview collectible' : `Reward +${BADGE_REWARD_TOKENS} PT`],
      coverStamp: 'S'
    }
  ];
  const coreLearnQuestCards = learnQuestCards.filter((quest) => quest.id === 'wallet' || quest.id === 'mint');
  const optionalLearnQuestCards = learnQuestCards.filter((quest) => quest.id !== 'wallet' && quest.id !== 'mint');

  useEffect(() => {
    if (!address || progressAccountKey !== connectedAddressKey || !localProgressReady) return;
    if (!paperTradingUnlocked && !paperTaskDone) return;

    const existingProgress = readStorageJson(progressStorageKey, {});
    const nextProgress = {
      ...existingProgress,
      viewedRiskCards: viewedRiskCards.length ? viewedRiskCards : existingProgress.viewedRiskCards || [],
      guideCompleted: Boolean(guideCompleted || existingProgress.guideCompleted),
      quizCompleted: Boolean(quizCompleted || existingProgress.quizCompleted),
      paperTradesCompleted: Math.max(Number(paperTradesCompleted || 0), Number(existingProgress.paperTradesCompleted || 0)),
      homeOnboardingCompleted: true,
      paperUnlocked: true,
      userOrigin,
      web2Intent,
      web3Intent
    };

    writeStorageJson(progressStorageKey, nextProgress);
    writeWalletProfilePatch(address, {
      progress: nextProgress,
      home: {
        paperBalanceSnapshot,
        userOrigin,
        web2Intent,
        web3Intent
      }
    });
  }, [
    address,
    connectedAddressKey,
    progressAccountKey,
    localProgressReady,
    paperTradingUnlocked,
    paperTaskDone,
    progressStorageKey,
    viewedRiskCards,
    guideCompleted,
    quizCompleted,
    paperTradesCompleted,
    paperBalanceSnapshot,
    userOrigin,
    web2Intent,
    web3Intent
  ]);

  const firstPendingLearnQuest =
    learnQuestCards.find((item) => item.status === 'Done' || item.status === 'To do' || item.status === 'Requires wallet' || item.status === 'Checking' || item.status.includes('/3'))?.id || 'wallet';
  useEffect(() => {
    if (activeCoreQuest !== null && !['wallet', 'mint'].includes(activeCoreQuest)) {
      setActiveCoreQuest('wallet');
    }
  }, [activeCoreQuest]);

  useEffect(() => {
    if (activeCoreQuest) {
      setVisibleCoreQuest(activeCoreQuest);
    }
  }, [activeCoreQuest]);

  useEffect(() => {
    if (activeOptionalQuest !== null && !['risk', 'quiz', 'paper'].includes(activeOptionalQuest)) {
      setActiveOptionalQuest('risk');
    }
  }, [activeOptionalQuest]);

  useEffect(() => {
    if (activeOptionalQuest) {
      setVisibleOptionalQuest(activeOptionalQuest);
    }
  }, [activeOptionalQuest]);

  function scrollQuestDetailIntoView(detailId) {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      document.getElementById(detailId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 90);
  }

  function focusLearnQuest(questId) {
    if (questId === 'wallet' || questId === 'mint') {
      setActiveCoreQuest(questId);
      scrollQuestDetailIntoView('learnQuestDetail');
      return;
    }

    setActiveOptionalQuest(questId);
    scrollQuestDetailIntoView('learnOptionalQuestDetail');
  }

  function recordAnalytics(eventName) {
    setAnalyticsSnapshot(trackAnalytics(eventName, address));
  }

  function openWalletModal() {
    recordAnalytics('wallet_modal_open');
    setWalletModalOpen(true);
    setWalletError('');
  }

  function handleRiskCardSelect(productId) {
    recordAnalytics(`risk_card_${productId}`);
    setSelectedRiskProduct(productId);
    setViewedRiskCards((current) => (current.includes(productId) ? current : [...current, productId]));
  }

  function handleRiskCheckpointSelect(productId, optionId) {
    setRiskCheckpointAnswers((current) => ({
      ...current,
      [productId]: optionId
    }));
  }

  useEffect(() => {
    if (!selectedRiskProduct) return;
    setViewedRiskCards((current) => (current.includes(selectedRiskProduct) ? current : [...current, selectedRiskProduct]));
  }, [selectedRiskProduct]);

  useEffect(() => {
    setQuizAnswers(createEmptyQuizAnswers());
    setQuizSubmitted(false);
  }, [quizProductId]);

  function handleQuizChange(field, value) {
    setQuizAnswers((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleQuizSubmit() {
    recordAnalytics('product_quiz_submit');
    setQuizSubmitted(true);
    if (quizPassed) {
      setQuizCompleted(true);
    }
  }

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
    setProfileBackupStatus('Wallet disconnected. Signed backups stay on this device; reconnect the same MetaMask account to recover them.');
    disconnect();
  }

  useEffect(() => {
    if (!isConnected) {
      previousConnectionRef.current = false;
      return;
    }

    if (!previousConnectionRef.current) {
      setTaskCompletionNotice('Congrats - wallet connected. We opened the wallet task so you can keep moving toward the claim step.');
      setTaskCompletionNoticeTarget('core');
      focusLearnQuest('wallet');
    }

    previousConnectionRef.current = true;
  }, [isConnected, connectedAddressKey]);

  useEffect(() => {
    if (!isConnected) {
      previousTaskCompletionRef.current = {
        addressKey: '',
        nickname: false,
        welcome: false,
        risk: false,
        quiz: false,
        paper: false
      };
      return;
    }

    const currentStates = {
      addressKey: connectedAddressKey,
      nickname: nicknameTaskDone,
      welcome: badgeContractConfigured ? welcomeGateCompleted : false,
      risk: riskTaskDone,
      quiz: quizTaskDone,
      paper: paperTradingUnlocked || paperTaskDone
    };
    const previousStates = previousTaskCompletionRef.current;

    if (previousStates.addressKey === connectedAddressKey) {
      if (!previousStates.welcome && currentStates.welcome) {
        setTaskCompletionNotice('Congrats - welcome collectible finished. The wallet collectible mint is open now.');
        setTaskCompletionNoticeTarget('core');
        focusLearnQuest('wallet');
      } else if (!previousStates.nickname && currentStates.nickname) {
        setTaskCompletionNotice('Nickname saved. We kept it in the welcome checklist so the demo state is easier to recognize later.');
        setTaskCompletionNoticeTarget('core');
        focusLearnQuest('mint');
      } else if (!previousStates.risk && currentStates.risk) {
        setTaskCompletionNotice(
          currentStates.paper && !previousStates.paper
            ? 'Congrats - risk review completed. The risk collectible is ready to mint, and paper trading just unlocked below.'
            : 'Congrats - risk review completed. The risk collectible mint is open now.'
        );
        setTaskCompletionNoticeTarget('optional');
        focusLearnQuest('risk');
      } else if (!previousStates.quiz && currentStates.quiz) {
        setTaskCompletionNotice('Congrats - quiz completed. The quiz collectible mint is open now.');
        setTaskCompletionNoticeTarget('optional');
        focusLearnQuest('quiz');
      } else if (!previousStates.paper && currentStates.paper) {
        setTaskCompletionNotice('Congrats - paper trading is unlocked. We opened the task so you can claim it and jump into replay.');
        setTaskCompletionNoticeTarget('optional');
        focusLearnQuest('paper');
      }
    }

    previousTaskCompletionRef.current = currentStates;
  }, [
    isConnected,
    connectedAddressKey,
    nicknameTaskDone,
    welcomeGateCompleted,
    riskTaskDone,
    quizTaskDone,
    paperTradingUnlocked,
    paperTaskDone
  ]);

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

  async function handleMintBadge() {
    if (!isConnected || !address) {
      setWalletError('Connect a wallet before minting.');
      return;
    }

    try {
      setWalletError('');

      if (chainId !== SEPOLIA_CHAIN_ID) {
        await switchChainAsync({ chainId: SEPOLIA_CHAIN_ID });
      }

      if (!badgeContractConfigured) {
        setWalletError('Add VITE_BADGE_CONTRACT_ADDRESS to enable real Sepolia minting.');
        return;
      }

      setMintRecipient(address);
      setMintTaskKey('welcome');
      await writeContractAsync({
        address: BADGE_CONTRACT_ADDRESS,
        abi: welcomeBadgeAbi,
        functionName: 'mintWelcomeBadge',
        args: [address],
        chainId: SEPOLIA_CHAIN_ID,
        gas: 180000n
      });
    } catch (err) {
      setMintRecipient('');
      setMintTaskKey('welcome');
      const message = String(err?.message || err || '');
      if (message.toLowerCase().includes('rejected')) {
        setWalletError('Mint was cancelled in MetaMask.');
        return;
      }
      setWalletError(message);
    }
  }

  function openLearnQuest(questId) {
    recordAnalytics(`module_${questId}`);
    if (questId === 'wallet' || questId === 'mint') {
      if (activeCoreQuest === questId) {
        setActiveCoreQuest(null);
        setOptionalQuestNotice('');
        return;
      }
      setActiveCoreQuest(questId);
      setOptionalQuestNotice('');
      return;
    }

    if (activeOptionalQuest === questId) {
      setActiveOptionalQuest(null);
      setOptionalQuestNotice('');
      return;
    }

    setOptionalQuestNotice('');
    setActiveOptionalQuest(questId);
  }

  function captureDeveloperSessionSnapshot() {
    if (!address) return null;

    return {
      addressKey: address.toLowerCase(),
      progress: readStorageJson(progressStorageKey, {}),
      homePaperState: readStorageJson(paperStorageKey, {
        balance: STARTING_PAPER_TOKENS,
        positions: {}
      }),
      replayPaperState: readStorageJson(getPaperReplayStateKey(address), {
        cash: STARTING_PAPER_TOKENS,
        positions: {},
        trades: [],
        realizedPnl: 0
      }),
      walletProfile: readStorageJson(getWalletProfileKey(address), readWalletProfile(address)),
      adminUnlock: readStorageJson(getAdminUnlockStorageKey(address), false)
    };
  }

  function ensureDeveloperSessionSnapshot() {
    if (!address) return null;

    if (!developerSessionSnapshotRef.current || developerSessionSnapshotRef.current.addressKey !== address.toLowerCase()) {
      developerSessionSnapshotRef.current = captureDeveloperSessionSnapshot();
    }

    return developerSessionSnapshotRef.current;
  }

  function applyLocalProgressFromProfile(progress = {}, profile = {}) {
    const nextViewedRiskCards = sanitizeViewedRiskCards(progress.viewedRiskCards);
    const nextGuideCompleted = Boolean(progress.guideCompleted || nextViewedRiskCards.length >= RISK_REVIEW_REQUIRED);
    const nextQuizCompleted = Boolean(progress.quizCompleted);
    const nextPaperTradesCompleted = Math.max(0, Number(progress.paperTradesCompleted || 0));
    const nextUserOrigin = profile.home?.userOrigin || progress.userOrigin || 'web2';
    const nextWeb2Intent = profile.home?.web2Intent || progress.web2Intent || 'trading';
    const nextWeb3Intent = profile.home?.web3Intent || progress.web3Intent || 'learn';

    setViewedRiskCards(nextViewedRiskCards);
    setGuideCompleted(nextGuideCompleted);
    setQuizCompleted(nextQuizCompleted);
    setQuizSubmitted(nextQuizCompleted);
    setQuizAnswers(nextQuizCompleted ? getCorrectQuizAnswers(DEFAULT_QUIZ_PRODUCT_ID) : createEmptyQuizAnswers());
    setPaperTradesCompleted(nextPaperTradesCompleted);
    setPaperBalanceSnapshot(readRecoveredHomePaperBalance(address, Number(profile.home?.paperBalanceSnapshot ?? STARTING_PAPER_TOKENS)));
    setProgressAccountKey(address ? address.toLowerCase() : '');
    setUserOrigin(nextUserOrigin);
    setWeb2Intent(nextWeb2Intent);
    setWeb3Intent(nextWeb3Intent);
  }

  function openDeveloperMode() {
    deleteStorageKey(DEV_AUTH_STORAGE_KEY);
    setAnalyticsSnapshot(readStorageJson(ANALYTICS_STORAGE_KEY, { total: 0, events: {} }));
    developerSessionSnapshotRef.current = captureDeveloperSessionSnapshot();
    setDeveloperSessionDirty(false);
    setDeveloperExitPromptOpen(false);
    setDevModeOpen(true);
    setDevModeAuthed(false);
    setDevModeUsername('');
    setDevModePassword('');
    setDevModeError('');
    setDevModeNotice('');
    setDeveloperDetailTopic('clicks');
  }

  function handleDeveloperLogin() {
    const normalizedUsername = devModeUsername.trim();
    const normalizedPassword = devModePassword.trim();

    if (normalizedUsername === DEV_MODE_USERNAME && normalizedPassword === DEV_MODE_PASSWORD) {
      deleteStorageKey(DEV_AUTH_STORAGE_KEY);
      setDevModeAuthed(true);
      setDevModeError('');
      setDevModeNotice('Developer controls are open for this use. Close the panel and the next visit will ask for the developer account again.');
      setAnalyticsSnapshot(readStorageJson(ANALYTICS_STORAGE_KEY, { total: 0, events: {} }));
      return;
    }
    setDevModeError('Incorrect developer credentials.');
  }

  function buildDeveloperUnlockedProgress(existingProgress = {}) {
    const reviewedProducts = products.map((product) => product.id);
    const viewedCards = Array.from(new Set([...(sanitizeViewedRiskCards(existingProgress.viewedRiskCards) || []), ...reviewedProducts]));

    return {
      ...existingProgress,
      viewedRiskCards: viewedCards,
      guideCompleted: true,
      quizCompleted: true,
      paperTradesCompleted: Math.max(1, Number(existingProgress.paperTradesCompleted || 0), Number(paperTradesCompleted || 0)),
      homeOnboardingCompleted: true,
      paperUnlocked: true,
      adminUnlocked: true,
      userOrigin: 'web3',
      web2Intent,
      web3Intent: 'skip'
    };
  }

  function writeDeveloperUnlockedProgress(nextProgress, nextPaperBalance = paperBalanceSnapshot) {
    writeStorageJson(progressStorageKey, nextProgress);
    writeStorageJson(getAdminUnlockStorageKey(address), true);
    writeWalletProfilePatch(address, {
      progress: nextProgress,
      home: {
        paperBalanceSnapshot: nextPaperBalance,
        userOrigin: nextProgress.userOrigin,
        web2Intent: nextProgress.web2Intent,
        web3Intent: nextProgress.web3Intent
      }
    });
  }

  function handleDeveloperUnlockAll() {
    if (!address) {
      setDevModeError('Connect a wallet first, then the admin unlock can be written to that account.');
      return;
    }

    ensureDeveloperSessionSnapshot();
    const nextProgress = buildDeveloperUnlockedProgress(readStorageJson(progressStorageKey, {}));
    setViewedRiskCards(nextProgress.viewedRiskCards);
    setRiskCheckpointAnswers({});
    setGuideCompleted(true);
    setQuizCompleted(true);
    setQuizSubmitted(true);
    setQuizAnswers(getCorrectQuizAnswers(DEFAULT_QUIZ_PRODUCT_ID));
    setPaperTradesCompleted(nextProgress.paperTradesCompleted);
    setUserOrigin('web3');
    setWeb3Intent('skip');
    writeDeveloperUnlockedProgress(nextProgress);
    setDeveloperSessionDirty(true);
    setDevModeError('');
    setDevModeNotice(`All local onboarding and replay gates are enabled for ${shortAddress(address)}.`);
  }

  function readDeveloperPtAmount() {
    const amount = Number(devModePtAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Enter a valid PT amount of 0 or higher.');
    }
    return roundNumber(amount, 2);
  }

  function applyDeveloperPtBalance(nextBalance, actionLabel) {
    if (!address) {
      setDevModeError('Connect a wallet first, then PT can be added to that account.');
      return;
    }

    ensureDeveloperSessionSnapshot();
    const normalizedBalance = roundNumber(Math.max(0, Number(nextBalance || 0)), 2);
    const homePaperState = readStorageJson(paperStorageKey, {
      balance: STARTING_PAPER_TOKENS,
      positions: {}
    });
    const replayStateKey = getPaperReplayStateKey(address);
    const replayPaperState = readStorageJson(replayStateKey, {
      cash: STARTING_PAPER_TOKENS,
      positions: {},
      trades: [],
      realizedPnl: 0
    });
    const existingProfile = readWalletProfile(address);
    const existingProgress = readStorageJson(progressStorageKey, existingProfile.progress || {});
    const nextProgress = buildDeveloperUnlockedProgress(existingProgress);

    writeStorageJson(paperStorageKey, {
      ...homePaperState,
      balance: normalizedBalance
    });
    writeStorageJson(replayStateKey, {
      ...replayPaperState,
      cash: normalizedBalance
    });
    writeDeveloperUnlockedProgress(nextProgress, normalizedBalance);
    writeWalletProfilePatch(address, {
      progress: nextProgress,
      home: {
        ...(existingProfile.home || {}),
        paperBalanceSnapshot: normalizedBalance,
        userOrigin: nextProgress.userOrigin,
        web2Intent: nextProgress.web2Intent,
        web3Intent: nextProgress.web3Intent
      },
      paper: {
        ...(existingProfile.paper || {}),
        state: {
          ...(existingProfile.paper?.state || {}),
          cash: normalizedBalance
        }
      }
    });

    setPaperBalanceSnapshot(normalizedBalance);
    setViewedRiskCards(nextProgress.viewedRiskCards);
    setGuideCompleted(true);
    setQuizCompleted(true);
    setPaperTradesCompleted(nextProgress.paperTradesCompleted);
    setUserOrigin('web3');
    setWeb3Intent('skip');
    setDeveloperSessionDirty(true);
    setDevModeError('');
    setDevModeNotice(`${actionLabel}: ${normalizedBalance.toLocaleString()} PT is now available for ${shortAddress(address)}.`);
  }

  function finalizeDeveloperModeClose() {
    setDeveloperExitPromptOpen(false);
    setDevModeOpen(false);
    setDevModeAuthed(false);
    setDevModeUsername('');
    setDevModePassword('');
    setDevModeError('');
    deleteStorageKey(DEV_AUTH_STORAGE_KEY);
  }

  function handleDeveloperModeCloseRequest() {
    if (developerSessionDirty && developerSessionSnapshotRef.current) {
      setDeveloperExitPromptOpen(true);
      return;
    }

    finalizeDeveloperModeClose();
  }

  function handleDeveloperModeKeepChanges() {
    setDeveloperSessionDirty(false);
    developerSessionSnapshotRef.current = null;
    finalizeDeveloperModeClose();
  }

  function handleDeveloperModeRestoreSnapshot() {
    const snapshot = developerSessionSnapshotRef.current;
    if (!snapshot || !address || snapshot.addressKey !== address.toLowerCase()) {
      setDeveloperExitPromptOpen(false);
      finalizeDeveloperModeClose();
      return;
    }

    writeStorageJson(progressStorageKey, snapshot.progress);
    writeStorageJson(paperStorageKey, snapshot.homePaperState);
    writeStorageJson(getPaperReplayStateKey(address), snapshot.replayPaperState);
    writeStorageJson(getWalletProfileKey(address), snapshot.walletProfile);

    if (snapshot.adminUnlock) {
      writeStorageJson(getAdminUnlockStorageKey(address), true);
    } else {
      deleteStorageKey(getAdminUnlockStorageKey(address));
    }

    applyLocalProgressFromProfile(snapshot.progress, snapshot.walletProfile || {});
    setRiskCheckpointAnswers({});
    setTaskCompletionNotice('Developer overrides were rolled back. This wallet is back on its previous local PT and onboarding state.');
    setTaskCompletionNoticeTarget('optional');
    setDevModeNotice('Developer overrides were restored to the pre-session state.');
    setDeveloperSessionDirty(false);
    developerSessionSnapshotRef.current = null;
    finalizeDeveloperModeClose();
  }

  function handleDeveloperAddPt() {
    try {
      const amount = readDeveloperPtAmount();
      const currentBalance = Math.max(Number(paperBalanceSnapshot || 0), Number(walletProfileSummary.availablePT || 0));
      applyDeveloperPtBalance(currentBalance + amount, 'Admin PT added');
    } catch (error) {
      setDevModeError(error.message);
    }
  }

  function handleDeveloperSetPtBalance() {
    try {
      applyDeveloperPtBalance(readDeveloperPtAmount(), 'Admin PT set');
    } catch (error) {
      setDevModeError(error.message);
    }
  }

  async function handleMintTaskBadge(taskKey) {
    if (!isConnected || !address) {
      setWalletError('Connect a wallet before minting a wallet collectible.');
      return;
    }

    try {
      setWalletError('');
      recordAnalytics(`badge_mint_${taskKey}`);

      if (chainId !== SEPOLIA_CHAIN_ID) {
        await switchChainAsync({ chainId: SEPOLIA_CHAIN_ID });
      }

      if (!badgeContractConfigured) {
        setWalletError('Add VITE_BADGE_CONTRACT_ADDRESS to enable real wallet collectible minting.');
        return;
      }

      setMintTaskKey(taskKey);
      setMintRecipient(address);
      await writeContractAsync({
        address: BADGE_CONTRACT_ADDRESS,
        abi: welcomeBadgeAbi,
        functionName: 'mintBadge',
        args: [BADGE_TYPES[taskKey], address],
        chainId: SEPOLIA_CHAIN_ID,
        gas: 220000n
      });
    } catch (err) {
      setMintRecipient('');
      setMintTaskKey('welcome');
      const message = String(err?.message || err || '');
      if (message.toLowerCase().includes('rejected')) {
        setWalletError('Wallet collectible mint was cancelled in MetaMask.');
        return;
      }
      setWalletError(message);
    }
  }

  async function handleSignProfileBackup() {
    if (!isConnected || !address) {
      setProfileBackupStatus('Connect a wallet first so the optional profile backup can be tied to the current account.');
      return;
    }

    setProfileBackupStatus('Opening MetaMask signature for this account profile...');
    try {
      const record = await signAndStoreProfilePointer(
        address,
        {
          ...walletProfileSnapshot,
          progress: {
            viewedRiskCards: localProgressReady ? viewedRiskCards : [],
            guideCompleted: localProgressReady && guideCompleted,
            quizCompleted: localProgressReady && quizCompleted,
            paperTradesCompleted: localProgressReady ? paperTradesCompleted : 0,
            userOrigin,
            web2Intent,
            web3Intent
          },
          home: {
            paperBalanceSnapshot,
            userOrigin,
            web2Intent,
            web3Intent
          }
        },
        signMessageAsync
      );
      setProfileBackupStatus(`Optional profile backup signed for ${shortAddress(address)}. Content hash ${record.contentHash.slice(0, 12)}...`);
    } catch (error) {
      setProfileBackupStatus(String(error?.message || 'Profile backup signature was cancelled.'));
    }
  }

  function handleRecoverProfileBackup(targetAddress = address) {
    const recoveryAddress = String(targetAddress || address || '').toLowerCase();
    if (!isConnected || !address) {
      setProfileBackupStatus('Connect MetaMask first. A backup can identify a historical account, but the wallet still has to approve this session.');
      return;
    }

    if (recoveryAddress !== connectedAddressKey) {
      setProfileBackupStatus(`Selected backup belongs to ${shortAddress(recoveryAddress)}. Switch MetaMask to that account, reconnect, then recover it here.`);
      return;
    }

    const pointerRecord = readStorageJson(getWalletProfilePointerKey(recoveryAddress), null);
    if (!pointerRecord?.profile) {
      setProfileBackupStatus(`No signed backup was found for ${shortAddress(recoveryAddress)} on this device yet.`);
      return;
    }

    const recoveredProfile = pointerRecord.profile;
    const recoveredSummary = getWalletProfileSummary(recoveredProfile);
    const nextViewedRiskCards = sanitizeViewedRiskCards(recoveredProfile.progress?.viewedRiskCards).length
      ? sanitizeViewedRiskCards(recoveredProfile.progress?.viewedRiskCards)
      : selectedRiskProduct
        ? [selectedRiskProduct]
        : [];
    const nextGuideCompleted = Boolean(recoveredProfile.progress?.guideCompleted || nextViewedRiskCards.length >= RISK_REVIEW_REQUIRED);
    const nextQuizCompleted = Boolean(recoveredProfile.progress?.quizCompleted);
    const nextPaperTradesCompleted = Math.max(0, Number(recoveredProfile.progress?.paperTradesCompleted || 0));
    const nextUserOrigin = recoveredProfile.home?.userOrigin || recoveredProfile.progress?.userOrigin || userOrigin || 'web2';
    const nextWeb2Intent = recoveredProfile.home?.web2Intent || recoveredProfile.progress?.web2Intent || web2Intent || 'trading';
    const nextWeb3Intent = recoveredProfile.home?.web3Intent || recoveredProfile.progress?.web3Intent || web3Intent || 'learn';
    const nextPaperBalance = Math.max(
      Number(recoveredProfile.home?.paperBalanceSnapshot || 0),
      Number(recoveredSummary.availablePT || 0),
      STARTING_PAPER_TOKENS
    );
    const nextProgress = {
      viewedRiskCards: nextViewedRiskCards,
      guideCompleted: nextGuideCompleted,
      quizCompleted: nextQuizCompleted,
      paperTradesCompleted: nextPaperTradesCompleted,
      homeOnboardingCompleted: Boolean(recoveredProfile.progress?.homeOnboardingCompleted || recoveredProfile.progress?.paperUnlocked),
      paperUnlocked: Boolean(recoveredProfile.progress?.paperUnlocked),
      adminUnlocked: Boolean(recoveredProfile.progress?.adminUnlocked),
      spotLessonCompleted: Boolean(recoveredProfile.progress?.spotLessonCompleted),
      leverageLessonCompleted: Boolean(recoveredProfile.progress?.leverageLessonCompleted),
      hedgeLessonCompleted: Boolean(recoveredProfile.progress?.hedgeLessonCompleted),
      hedgeSizingCompleted: Boolean(recoveredProfile.progress?.hedgeSizingCompleted),
      hedgePositiveCloseCompleted: Boolean(recoveredProfile.progress?.hedgePositiveCloseCompleted),
      userOrigin: nextUserOrigin,
      web2Intent: nextWeb2Intent,
      web3Intent: nextWeb3Intent
    };

    writeStorageJson(progressStorageKey, nextProgress);
    writeWalletProfilePatch(recoveryAddress, {
      progress: nextProgress,
      home: {
        ...(recoveredProfile.home || {}),
        paperBalanceSnapshot: nextPaperBalance,
        userOrigin: nextUserOrigin,
        web2Intent: nextWeb2Intent,
        web3Intent: nextWeb3Intent
      },
      paper: recoveredProfile.paper || {},
      wealth: recoveredProfile.wealth || {},
      storage: {
        ...(recoveredProfile.storage || {}),
        mode: pointerRecord.remote?.ok || pointerRecord.remote?.cid || pointerRecord.remote?.url ? 'signed-remote-pointer' : 'signed-content-addressed-local',
        contentHash: pointerRecord.contentHash || recoveredProfile.storage?.contentHash || '',
        cidReadyPointer: pointerRecord.cidReadyPointer || recoveredProfile.storage?.cidReadyPointer || '',
        remote: pointerRecord.remote || recoveredProfile.storage?.remote || null,
        signedAt: pointerRecord.createdAt || recoveredProfile.storage?.signedAt || '',
        hasSignature: Boolean(pointerRecord.signature || recoveredProfile.storage?.hasSignature),
        lastRecoveredAt: new Date().toISOString()
      }
    });

    if (nextProgress.adminUnlocked) {
      writeStorageJson(getAdminUnlockStorageKey(recoveryAddress), true);
    } else {
      deleteStorageKey(getAdminUnlockStorageKey(recoveryAddress));
    }

    applyLocalProgressFromProfile(nextProgress, {
      ...(recoveredProfile || {}),
      home: {
        ...(recoveredProfile.home || {}),
        paperBalanceSnapshot: nextPaperBalance,
        userOrigin: nextUserOrigin,
        web2Intent: nextWeb2Intent,
        web3Intent: nextWeb3Intent
      }
    });
    setRiskCheckpointAnswers({});
    setProfileBackupStatus(`Saved demo state restored for ${shortAddress(recoveryAddress)}. PT balance, task progress, and wallet-linked history are back on this device.`);
  }

  function handleRecoverSelectedProfileBackup() {
    if (!selectedProfileBackupAddress) {
      setProfileBackupStatus('No historical backup is selected on this device yet.');
      return;
    }

    handleRecoverProfileBackup(selectedProfileBackupAddress);
  }

  return (
    <>
      <div className="noise"></div>
      <div className="app-shell">
        <header className="site-header home-site-header">
          <div className="brand-wrap">
            <div className="brand-dot"></div>
            <div>
              <div className="eyebrow">RiskLens Guided Investing Hub</div>
              <div className="brand-name">{t('RiskLens Guided Investing Hub', 'RiskLens 引导式投资中心')}</div>
            </div>
          </div>
          <div className="home-nav-wrap">
            <div className="home-nav-language">
              <LanguageToggle uiLanguage={uiLanguage} setUiLanguage={setUiLanguage} compact />
            </div>
            <nav className="site-nav home-site-nav">
              <a href="#welcome">{t('Welcome', '欢迎')}</a>
              <a href="#discover">{t('Discover', '发现')}</a>
              <a href="#learnEarn">{t('Learn', '学习')}</a>
              <a href="#wealth">{t('Wealth', '理财')}</a>
              <a href="#paperTrading">{t('Paper Trading', '模拟交易')}</a>
            </nav>
          </div>
          <div className="header-actions">
            <div className="header-status-row">
              <div className="header-wallet-stack">
                <div className="paper-token-pill">
                  <div className="paper-token-label">{t('Remaining paper tokens', '剩余模拟代币')}</div>
                  <div className="paper-token-value">{remainingPaperTokens.toLocaleString()} PT</div>
                  <div className="paper-token-tooltip">
                    <div className="paper-token-tooltip-title">{t('What is it?', '这是什么？')}</div>
                    <div>
                      {t(
                        'Paper trading uses demo-only tokens so users can practice buying and selling without risking real money.',
                        '模拟交易使用演示代币，用户可以在不承担真实资金风险的情况下练习买卖。'
                      )}
                    </div>
                    <div>
                      {t(
                        `You start with ${STARTING_PAPER_TOKENS} PT, each completed wallet collectible adds ${BADGE_REWARD_TOKENS} PT, and no real funds are involved.`,
                        `初始会发放 ${STARTING_PAPER_TOKENS} PT，每完成一个钱包收藏品再增加 ${BADGE_REWARD_TOKENS} PT，全程不涉及真实资金。`
                      )}
                    </div>
                    <div>
                      Wallet memory: remaining {walletProfileSummary.remainingPT.toLocaleString()} PT,
                      total policy {walletProfileSummary.availablePT.toLocaleString()} PT,
                      paper cash {walletProfileSummary.paperCash.toLocaleString()} PT,
                      wealth cash {walletProfileSummary.wealthCash.toLocaleString()} PT.
                    </div>
                  </div>
                </div>
                <button className={`ghost-btn wallet-header-btn ${isConnected ? 'connected' : ''}`} onClick={openWalletModal} disabled={isPending}>
                  {isConnected
                    ? t(`Wallet connected ${walletDisplayName}`, `钱包已连接 ${walletDisplayName}`)
                    : isPending
                      ? t('Connecting to MetaMask...', '正在连接 MetaMask...')
                      : t('Connect MetaMask', '连接 MetaMask')}
                </button>
              </div>
            </div>
            <div className="header-admin-row">
              <a
                className="ghost-btn compact github-project-link"
                href="https://github.com/cxy-peter/MSX-Hackathon-Demo"
                target="_blank"
                rel="noreferrer"
              >
                GitHub: cxy-peter/MSX-Hackathon-Demo
              </a>
              <button className="ghost-btn compact wallet-nickname-top-btn" onClick={openWalletModal}>
                {walletNickname ? `Nickname: ${walletNickname}` : 'Wallet nickname'}
              </button>
              <button className="ghost-btn compact" onClick={openDeveloperMode}>
                {t('Developer mode', '开发者模式')}
              </button>
            </div>
          </div>
        </header>

        <div className="demo-only-banner">
          <strong>Demo only.</strong> Receipt balances, PT cash, subscriptions, pledges, and settlement actions on this page stay in local demo or testnet-style state. No real stablecoin or live-fund transfer happens here.
        </div>

        <main>
          <section className="hero card" id="welcome">
            <div className="hero-copy">
              <div className="eyebrow">{t('RiskLens + AI-guided discovery + wallet-native onboarding', 'RiskLens + AI 引导发现 + 钱包原生 onboarding')}</div>
              <h1>{t('Make RWA investing understandable before it feels onchain.', '在用户真正接触链上之前，先把 RWA 投资讲明白。')}</h1>
              {false ? (
                <>
              <p className="hero-text">
                {t(
                  'This version keeps the RiskLens welcome-page aesthetic, but upgrades the wallet entry into a real MetaMask connection flow that can be deployed to GitHub Pages and tested directly by judges.',
                  '这个版本保留了 RiskLens 欢迎页的视觉风格，同时把钱包入口升级成真实的 MetaMask 连接流程，能直接部署到 GitHub Pages 并供评委现场测试。'
                )}
              </p>
              <div className="hero-points">
                <span>{t('First-time users see purpose, not jargon', '新用户先看到用途，而不是术语')}</span>
                <span>{t('Wallet connection feels like a real product flow', '钱包连接更像真实产品流程')}</span>
              </div>
                </>
              ) : null}
              <div className="cta-row">
                <button className="primary-btn" onClick={openWalletModal}>
                  {t('Connect wallet', '连接钱包')}
                </button>
                <a className="secondary-btn" href="#discover" onClick={() => recordAnalytics('hero_discover_click')}>
                  {t('Explore product lanes', '查看产品路径')}
                </a>
              </div>
              <a className="hero-helper-link" href="#route" onClick={() => recordAnalytics('hero_route_help_click')}>
                {t('No wallet? We can help you!', '还没有钱包？我们可以帮你！')}
              </a>
            </div>

            <div className="hero-panel">
              <div className="panel-topline">
                <span className="signal"></span>
                <span>{t('Onboarding helper', '入门助手')}</span>
              </div>
              <div className="guide-panel">
                <label>
                  {t('What is blocking you right now?', '你现在最大的卡点是什么？')}
                  <select value={painPoint} onChange={(event) => setPainPoint(event.target.value)}>
                    <option value="newbie">{t('I am new here and do not know where to start', '我是新手，不知道该从哪里开始')}</option>
                    <option value="contracts">{t('I do not understand contracts or onchain rights', '我不理解合约或链上权益')}</option>
                    <option value="safer">{t('I want to know which products are safer for beginners', '我想知道哪些产品更适合新手')}</option>
                  </select>
                </label>
              <div className="guide-answer">
                <div className="guide-title">{guide.title}</div>
                <div className="guide-copy">{guide.copy}</div>
                  <div className="guide-next">
                    <div className="guide-chip">
                      <div className="k">{t('Recommended next step', '推荐下一步')}</div>
                      <div className="v">{guide.nextStep}</div>
                    </div>
                    <div className="guide-chip">
                      <div className="k">{t('Best module to open', '最适合打开的模块')}</div>
                      <div className="v">{guide.module}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card routing-card" id="route">
            <div className="section-head">
              <div>
                <div className="eyebrow">{t('Arrival routing', '进入路由')}</div>
                <h2>{t('Ask one question before showing the full product stack', '在展示完整产品堆栈前，先问一个问题')}</h2>
              </div>
            </div>
            <div className="routing-layout">
              <div className="routing-panel">
                <div className="routing-question">{t('Are you coming from a Web2 or Web3 mindset?', '你现在更接近 Web2 还是 Web3 的使用心态？')}</div>
                <div className="origin-toggle">
                  <button
                    className={`entry-card origin-choice ${userOrigin === 'web2' ? 'active' : ''}`}
                    onClick={() => {
                      recordAnalytics('route_origin_web2');
                      setUserOrigin('web2');
                    }}
                  >
                    <div className="entry-title">{t('I am from Web2', '我是从 Web2 过来的')}</div>
                    <div className="entry-copy">{t('I want plain-language routes, simpler products, and simulated practice before anything feels technical.', '我想先看更直白的路径、更简单的产品，以及在任何技术内容之前先做模拟练习。')}</div>
                  </button>
                  <button
                    className={`entry-card origin-choice ${userOrigin === 'web3' ? 'active' : ''}`}
                    onClick={() => {
                      recordAnalytics('route_origin_web3');
                      setUserOrigin('web3');
                    }}
                  >
                    <div className="entry-title">{t('I am from Web3', '我是从 Web3 过来的')}</div>
                    <div className="entry-copy">{t('I already know wallets and may want to skip beginner setup if the product path is obvious enough.', '我已经了解钱包，如果产品路径足够清楚，我可能希望跳过新手设置。')}</div>
                  </button>
                </div>

                {userOrigin === 'web2' ? (
                  <div className="routing-followup">
                    <div className="routing-subquestion">Which path feels more comfortable right now?</div>
                    <div className="origin-toggle">
                      <button
                        className={`entry-card origin-choice ${web2Intent === 'trading' ? 'active' : ''}`}
                        onClick={() => {
                          recordAnalytics('route_web2_trading');
                          setWeb2Intent('trading');
                        }}
                      >
                        <div className="entry-title">OK, show me what to do</div>
                        <div className="entry-copy">Start with the guided wallet path, then unlock paper trading after the onboarding steps.</div>
                      </button>
                      <button
                        className={`entry-card origin-choice ${web2Intent === 'wealth' ? 'active' : ''}`}
                        onClick={() => {
                          recordAnalytics('route_web2_wealth');
                          setWeb2Intent('wealth');
                        }}
                      >
                        <div className="entry-title">I feel a bit cautious about investing</div>
                        <div className="entry-copy">No problem. We also provide wealth products with simpler framing before moving into more active flows.</div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="routing-followup">
                    <div className="routing-subquestion">Do you want to skip the beginner wallet tutorial?</div>
                    <div className="origin-toggle">
                      <button
                        className={`entry-card origin-choice ${web3Intent === 'skip' ? 'active' : ''}`}
                        onClick={() => {
                          recordAnalytics('route_web3_skip');
                          setWeb3Intent('skip');
                        }}
                      >
                        <div className="entry-title">Yes, skip to practice</div>
                        <div className="entry-copy">Unlock paper trading immediately and jump into simulation without the onboarding loop.</div>
                      </button>
                      <button
                        className={`entry-card origin-choice ${web3Intent === 'learn' ? 'active' : ''}`}
                        onClick={() => {
                          recordAnalytics('route_web3_learn');
                          setWeb3Intent('learn');
                        }}
                      >
                        <div className="entry-title">No, keep the wallet guide</div>
                        <div className="entry-copy">Keep paper trading locked for now, explain wallets first, and only unlock practice after the beginner route is clear.</div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="route-result card route-result-card">
                <div className="eyebrow">Current route</div>
                <h3>{currentRoute.title}</h3>
                <p className="muted">{flowConfig.copy}</p>
                <div className="route-highlight">{currentRoute.copy}</div>
                <div className="cta-row">
                  <a className="primary-btn" href={currentRoute.primaryHref}>
                    {currentRoute.primary}
                  </a>
                  <a className="secondary-btn" href={currentRoute.secondaryHref}>
                    {currentRoute.secondary}
                  </a>
                </div>
                {fastTrackPaper ? (
                  <div className="env-hint">
                    <strong>Paper trading unlock.</strong> The user can now enter simulation mode and test products before any live-style action.
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="insight-strip">
            <div className="insight-card">
              <div className="label">{t('What RiskLens already has', 'RiskLens 已经具备')}</div>
              <div className="value" style={{ fontSize: 18, lineHeight: 1.45 }}>
                {t('Tokenized stock story, stablecoin entry, and a finance-first brand shell.', '代币化股票叙事、稳定币入口，以及偏金融导向的品牌外壳。')}
              </div>
            </div>
            <div className="insight-card">
              <div className="label">{t('What we are fixing', '我们正在修正')}</div>
              <div className="value" style={{ fontSize: 18, lineHeight: 1.45 }}>
                {t('Beginner routing, clearer discovery cards, and a wallet flow that behaves like a live product.', '新手路由、更清晰的发现卡片，以及更像真实产品的钱包流程。')}
              </div>
            </div>
            <div className="insight-card">
              <div className="label">{t('Why this matters', '为什么这很重要')}</div>
              <div className="value" style={{ fontSize: 18, lineHeight: 1.45 }}>
                {t('Judges should be able to click one link and immediately feel the interaction model.', '评委应该只点开一个链接，就能立刻感受到整个交互模型。')}
              </div>
            </div>
            <div className="insight-card">
              <div className="label">{t('Current direction', '当前方向')}</div>
              <div className="value" style={{ fontSize: 18, lineHeight: 1.45 }}>
                {t('RiskLens-style welcome page with real MetaMask connection, then guided product discovery.', 'RiskLens 风格欢迎页 + 真实 MetaMask 连接，再进入引导式产品发现。')}
              </div>
            </div>
          </section>

          <section className="card" id="learnEarn">
            <div className="section-head">
              <div>
                <div className="eyebrow">{t('Learn & earn', '学习与奖励')}</div>
                <h2>{t('Wallet tutorial', '钱包教程')}</h2>
              </div>
            </div>
            <div className="learn-quest-wall">
              <div className="learn-quest-core-row">
                {coreLearnQuestCards.map((quest, index) => (
                  <button
                    key={quest.id}
                    className={`learn-quest-tile core ${activeCoreQuest === quest.id ? 'active' : ''} ${quest.status === 'Completed' ? 'done' : ''} ${quest.status === 'Done' || quest.status === 'Unlocked' ? 'ready' : ''} ${quest.status === 'Requires wallet' ? 'gated' : ''}`}
                    onClick={() => openLearnQuest(quest.id)}
                  >
                    <HomeQuestCover
                      kicker={quest.coverKicker}
                      title={quest.coverTitle}
                      subtitle={quest.coverSubtitle}
                      accent={quest.coverAccent}
                      footerLines={quest.coverFooterLines}
                      stamp={quest.coverStamp}
                    />
                    <div className="home-quest-task-summary">
                      <div>
                        <div className="quest-panel-title">{quest.title}</div>
                        <div className="muted">{quest.hint}</div>
                      </div>
                      <span className={`checklist-status-badge ${quest.status === 'Completed' ? 'done' : quest.status === 'Done' || quest.status === 'Unlocked' ? 'ready' : 'todo'}`}>
                        {getQuestStatusLabel(quest.status)}
                      </span>
                    </div>
                    <div className="learn-quest-pills">
                      <span className="badge">Step {index + 1}</span>
                      <span className="badge">{quest.label}</span>
                    </div>
                    <div className="learn-quest-tile-title">{quest.title}</div>
                    <div className="learn-quest-tile-copy">{quest.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {taskCompletionNotice && taskCompletionNoticeTarget === 'core' ? (
              <div className="wealth-inline-note learn-quest-completion-note">{taskCompletionNotice}</div>
            ) : null}

            <div className={`learn-quest-detail-shell ${activeCoreQuest ? 'open' : 'closed'}`}>
              <div className="learn-quest-detail card" id="learnQuestDetail">
                <div className="learn-quest-detail-top">
                  <div>
                    <div className="eyebrow">Quest Detail</div>
                    <h3>{learnQuestCards.find((item) => item.id === visibleCoreQuest)?.title}</h3>
                  </div>
                </div>

                {visibleCoreQuest === 'wallet' ? (
                <div className="quest-detail-panel">
                  <div className="quest-side-panel">
                    <div className="quest-panel-title">{walletTaskBadgeMinted ? 'Wallet task completed' : walletQuestDone ? 'Wallet connected' : 'Connect wallet'}</div>
                    <div className="muted">
                      Connect once with MetaMask to unlock this task. After the welcome collectible is minted in step 2, this wallet task can mint its own wallet collectible and keep the reward state.
                    </div>
                    <button className="secondary-btn" onClick={openWalletModal}>
                      {walletQuestDone ? 'Wallet connected' : 'Open MetaMask connect'}
                    </button>
                    <div className="mint-action-box inline-mint-action task-badge-mint-box">
                      <div>
                        <div className="product-title">Mint wallet collectible</div>
                        <div className="muted">
                          This wallet collectible opens only after the welcome collectible is minted. Finish step 2 first, then mint it for this account.
                        </div>
                      </div>
                      <div className="mint-status-stack">
                        <button
                          className="secondary-btn"
                          onClick={() => handleMintTaskBadge('wallet')}
                          disabled={!walletQuestDone || !badgeMintCompleted || walletTaskBadgeMinted || mintForCurrentAccountBusy}
                        >
                          {walletTaskBadgeMinted
                            ? 'Completed'
                            : mintForCurrentAccountBusy
                              ? getMintTaskStatus('wallet') || 'Finish current mint first'
                            : !walletQuestDone
                              ? 'Connect wallet first'
                              : !badgeMintCompleted
                                ? 'Finish welcome mint first'
                                : 'Mint wallet collectible'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                ) : null}

                {visibleCoreQuest === 'mint' ? (
                <div className={`quest-detail-panel ${badgeMintCompleted ? 'completed' : ''}`}>
                  <div className="quest-side-panel">
                    <div className="quest-panel-title">Mint checklist</div>
                    <div className="muted">This mint also unlocks another +{BADGE_REWARD_TOKENS} paper tokens for the simulation wallet.</div>
                    <div className="checklist-list">
                      {mintChecklist.map((item) => (
                        <div className={`checklist-item ${item.done ? 'done' : ''}`} key={item.label}>
                          <div className="check-indicator">{item.done ? 'OK' : 'TODO'}</div>
                          <div className="checklist-copy">
                            <div>
                              <div className="check-title">{item.label}</div>
                              <div className="muted">{item.helper}</div>
                            </div>
                            {item.id === 'nickname' ? (
                              <button
                                className="ghost-btn compact help-toggle-btn"
                                onClick={openWalletModal}
                                disabled={!walletQuestDone}
                              >
                                {nicknameTaskDone ? 'Edit nickname' : walletQuestDone ? 'Save nickname' : 'Connect first'}
                              </button>
                            ) : item.id === 'network' || item.id === 'gas' ? (
                              <button
                                className="ghost-btn compact help-toggle-btn"
                                onClick={() => setMintHelpOpen(mintHelpOpen === item.id ? '' : item.id)}
                              >
                                Have any trouble?
                              </button>
                            ) : null}
                          </div>
                          {mintHelpOpen === item.id ? (
                            <div className="mint-help-panel">
                              {item.id === 'network' ? (
                                <>
                                  <div className="mint-help-title">MetaMask network setup</div>
                                  <div className="muted">
                                    This status is auto-detected from the currently connected MetaMask network. In the extension, open the network selector from the main wallet view, then choose <strong>Sepolia ETH</strong>.
                                  </div>
                                  <div className="muted">
                                    If Sepolia does not appear right away, enable test networks in MetaMask settings and reopen the selector.
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="mint-help-title">Get Sepolia ETH for gas</div>
                                  <div className="muted">
                                    Minting needs test ETH for gas. Request Sepolia ETH from any faucet below, wait for it to arrive in MetaMask, then retry the mint.
                                  </div>
                                  <div className="faucet-links">
                                    {faucetLinks.map((link) => (
                                      <a key={`help-${link}`} href={link} target="_blank" rel="noreferrer">
                                        {new URL(link).hostname}
                                      </a>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <div className={`mint-action-box inline-mint-action ${badgeContractConfigured ? 'contract-live' : 'contract-demo'}`}>
                      <div>
                        <div className="product-title">{badgeContractConfigured ? 'Mint welcome collectible' : 'Demo wallet gate active'}</div>
                        <div className="muted">
                          {badgeContractConfigured
                            ? `Sepolia ETH is testnet gas only. Use a faucet, then submit one mint transaction. Minimum paper trade later is ${MIN_PAPER_TRADE} PT.`
                            : 'Onchain collectible minting is disabled in this deployment, so the connected wallet unlocks demo progress without showing judges a setup error.'}
                        </div>
                      </div>
                      <button className="secondary-btn" onClick={handleMintBadge} disabled={!walletQuestDone || !mintReady}>
                        {badgeContractConfigured
                          ? mintReady
                            ? 'Mint welcome collectible on Sepolia'
                            : mintStatusText
                          : walletQuestDone
                            ? 'Demo gate active'
                            : 'Connect wallet first'}
                      </button>
                    </div>

                    <ProfileBackupCard
                      eyebrow="Optional profile backup"
                      title="Save demo state for this wallet, not the wallet key"
                      description="This signature backs up paper cash, fills, hedge progress, and wealth context for the connected address."
                      footnote="Decentralized storage here means a signed, content-hashed snapshot that can later be pinned to IPFS, Filecoin, Ceramic, or Arweave by the project owner."
                      accountLabel={isConnected ? walletDisplayName : 'not connected'}
                      summaryText={profileBackupSummaryText}
                      walletProfileSummary={walletProfileSummary}
                      profileBackupConfigured={profileBackupConfigured}
                      profileBackupRecoverable={profileBackupRecoverable}
                      profileBackupAccounts={profileBackupAccounts}
                      selectedProfileBackupAddress={selectedProfileBackupAddress}
                      onSelectedProfileBackupAddressChange={setSelectedProfileBackupAddress}
                      onRecoverSelectedProfileBackup={handleRecoverSelectedProfileBackup}
                      onSign={handleSignProfileBackup}
                      onRecover={handleRecoverProfileBackup}
                      isSigning={isProfileSigning}
                      actionsDisabled={!isConnected}
                      signIdleLabel="Sign optional backup"
                    />

                    <div className="badge-mint-meta compact-meta">
                      <div className={`guide-chip ${badgeContractConfigured ? 'contract-live' : 'contract-demo'}`}>
                        <div className="k">Deployment</div>
                        <div className="v">{badgeDeploymentLabel}</div>
                      </div>
                      <div className="guide-chip">
                        <div className="k">Network</div>
                        <div className="v">{isConnected ? chainName(effectiveChainId) : 'Connect wallet first'}</div>
                      </div>
                      <div className="guide-chip">
                        <div className="k">Wallet collectible state</div>
                        <div className="v">
                          {badgeContractConfigured
                            ? badgeMintCompleted
                              ? 'Completed'
                              : 'Not minted yet'
                            : walletQuestDone
                              ? 'Demo gate passed'
                              : 'Waiting for wallet'}
                        </div>
                      </div>
                    </div>

                    {!badgeContractConfigured ? (
                      <div className="env-hint contract-demo">
                        <strong>Deployment note:</strong> {badgeDeploymentHelper}
                      </div>
                    ) : null}

                    {mintHash ? (
                      <div className="env-hint">
                        <strong>Sepolia transaction:</strong> {mintHash}
                      </div>
                    ) : null}
                  </div>
                </div>
                ) : null}
              </div>
            </div>

            <div className="learn-quest-optional-head">
              <div className="eyebrow">Optional modules</div>
              <div className="muted">These can be opened in any order after the core wallet path starts.</div>
            </div>

            <div className="learn-quest-optional-row">
              {optionalLearnQuestCards.map((quest) => (
                <button
                  key={quest.id}
                  className={`learn-quest-tile ${activeOptionalQuest === quest.id ? 'active' : ''} ${quest.status === 'Completed' ? 'done' : ''} ${quest.status === 'Done' || quest.status === 'Unlocked' ? 'ready' : ''} ${quest.status === 'Requires wallet' ? 'gated' : ''}`}
                  onClick={() => openLearnQuest(quest.id)}
                >
                  <HomeQuestCover
                    kicker={quest.coverKicker}
                    title={quest.coverTitle}
                    subtitle={quest.coverSubtitle}
                    accent={quest.coverAccent}
                    footerLines={quest.coverFooterLines}
                    stamp={quest.coverStamp}
                  />
                  <div className="home-quest-task-summary">
                    <div>
                      <div className="quest-panel-title">{quest.title}</div>
                      <div className="muted">{quest.hint}</div>
                    </div>
                    <span className={`checklist-status-badge ${quest.status === 'Completed' ? 'done' : quest.status === 'Done' || quest.status === 'Unlocked' ? 'ready' : 'todo'}`}>
                      {getQuestStatusLabel(quest.status)}
                    </span>
                  </div>
                  <div className="learn-quest-pills">
                    <span className="badge">{quest.label}</span>
                  </div>
                  <div className="learn-quest-tile-title">{quest.title}</div>
                  <div className="learn-quest-tile-copy">{quest.hint}</div>
                </button>
              ))}
            </div>

            {optionalQuestNotice ? <div className="env-hint" style={{ marginTop: 14 }}>{optionalQuestNotice}</div> : null}
            {taskCompletionNotice && taskCompletionNoticeTarget === 'optional' ? (
              <div className="wealth-inline-note learn-quest-completion-note">{taskCompletionNotice}</div>
            ) : null}

            <div className={`learn-quest-detail-shell ${activeOptionalQuest ? 'open' : 'closed'}`}>
              <div className="learn-quest-detail card learn-quest-optional-detail" id="learnOptionalQuestDetail">
                <div className="learn-quest-detail-top">
                  <div>
                    <div className="eyebrow">Optional Detail</div>
                    <h3>{learnQuestCards.find((item) => item.id === visibleOptionalQuest)?.title}</h3>
                  </div>
                </div>

                {visibleOptionalQuest === 'risk' ? (
                <div className="quest-detail-panel">
                  <div className="quest-side-panel">
                    <div className="muted">{quests[2].copy}</div>
                    <div className="risk-card-picker">
                      {HOME_BRIEFING_PRODUCTS.map((product) => (
                        <button
                          key={product.id}
                          className={`risk-card-tab ${selectedRiskCard.id === product.id ? 'active' : ''}`}
                          onClick={() => handleRiskCardSelect(product.id)}
                        >
                          {product.ticker}
                        </button>
                      ))}
                    </div>
                    <div className="risk-card-detail">
                      <div className="risk-card-top">
                        <div>
                          <div className="eyebrow">Briefing card</div>
                          <div className="product-title">{selectedRiskCard.ticker}</div>
                          <div className="muted">{selectedRiskCard.name}</div>
                          <div className="muted">{selectedRiskCard.summary}</div>
                        </div>
                        <div className="home-briefing-pill-row">
                          <span className={`pill ${riskClass(selectedRiskCard.risk)}`}>{selectedRiskCard.risk} risk</span>
                          <span className="pill risk-medium">{selectedRiskCard.beginnerFit}</span>
                        </div>
                      </div>
                      <BriefingFactGrid product={selectedRiskCard} />
                    </div>
                    <div className="risk-checkpoint-shell">
                      <div className="quest-panel-title">Explain-it-back checkpoint</div>
                      <div className="muted">{selectedRiskCard.reviewPrompt}</div>
                      <div className="risk-checkpoint-options">
                        {selectedRiskCard.reviewOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`risk-checkpoint-option ${riskCheckpointAnswers[selectedRiskCard.id] === option.id ? 'active' : ''}`}
                            onClick={() => handleRiskCheckpointSelect(selectedRiskCard.id, option.id)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      {selectedRiskCheckpoint ? (
                        <div className={`wealth-inline-note paper-inline-note risk-checkpoint-note ${selectedRiskCheckpoint.correct ? 'success' : ''}`}>
                          {selectedRiskCheckpoint.feedback}
                        </div>
                      ) : null}
                    </div>
                    <div className="env-hint">
                      {riskTaskBadgeMinted ? (
                        <>
                          <strong>Completed:</strong> This wallet already minted the risk collectible.
                        </>
                      ) : riskTaskDone ? (
                        <>
                          <strong>Wait to be minted:</strong> {RISK_REVIEW_REQUIRED} product briefings were already reviewed for this wallet. Mint the risk collectible for this account to complete the task.
                        </>
                      ) : (
                        <>
                          <strong>Progress:</strong> Open any {RISK_REVIEW_REQUIRED} product briefings to complete this step. Current progress: {riskReviewProgress}/{RISK_REVIEW_REQUIRED}. Checkpoint answers correct: {riskCheckpointCorrectCount}.
                        </>
                      )}
                    </div>
                    <div className="mint-action-box inline-mint-action task-badge-mint-box">
                      <div>
                        <div className="product-title">Mint risk collectible</div>
                        <div className="muted">
                          Once {RISK_REVIEW_REQUIRED} product briefings are reviewed, this task can mint its wallet collectible for the current wallet account.
                        </div>
                      </div>
                      <div className="mint-status-stack">
                        <button
                          className="secondary-btn"
                          onClick={() => handleMintTaskBadge('risk')}
                          disabled={!riskTaskDone || riskTaskBadgeMinted || mintForCurrentAccountBusy}
                        >
                          {riskTaskBadgeMinted
                            ? 'Completed'
                            : mintForCurrentAccountBusy
                              ? getMintTaskStatus('risk') || 'Finish current mint first'
                              : riskTaskDone
                                ? 'Wait to be minted'
                                : `Review ${RISK_REVIEW_REQUIRED} briefings first`}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                ) : null}

                {visibleOptionalQuest === 'quiz' ? (
                <div className="quest-detail-panel">
                  <div className="quiz-shell">
                    <label>
                      Quiz product
                      <select value={quizProductId} onChange={(event) => setQuizProductId(event.target.value)}>
                        {QUIZ_PRODUCTS.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.ticker} - {product.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="env-hint">
                      <strong>{quizProduct.ticker}</strong> {quizProduct.quiz?.summary || quizProduct.summary}
                    </div>
                    <div className="risk-card-detail quiz-briefing-card">
                      <div className="risk-card-top">
                        <div>
                          <div className="eyebrow">Question quiz</div>
                          <div className="product-title">{quizProduct.name}</div>
                          <div className="muted">{quizProduct.useCase}</div>
                        </div>
                        <div className="home-briefing-pill-row">
                          <span className={`pill ${riskClass(quizProduct.risk)}`}>{quizProduct.risk} risk</span>
                          <span className="pill risk-medium">{quizProduct.beginnerFit}</span>
                        </div>
                      </div>
                      <BriefingFactGrid product={quizProduct} />
                    </div>
                    {quizQuestionRows.map((question) => (
                      <label key={question.id}>
                        {question.prompt}
                        <select value={quizAnswers[question.id] || ''} onChange={(event) => handleQuizChange(question.id, event.target.value)}>
                          <option value="">Select one answer</option>
                          {question.options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <button className="secondary-btn" onClick={handleQuizSubmit} disabled={!quizAllQuestionsAnswered}>
                      {quizTaskBadgeMinted ? 'Quiz completed' : quizTaskDone ? 'Wait to be minted' : 'Check 3-question quiz'}
                    </button>
                    {quizSubmitted ? (
                      <div className={`env-hint ${quizPassed ? '' : 'quiz-error'}`}>
                        <strong>{quizPassed ? 'Correct framing.' : 'Try again.'}</strong>{' '}
                        {quizPassed
                          ? quizProduct.quiz?.successCopy || 'The ownership, return source, and first disclosure were all identified correctly.'
                          : quizProduct.quiz?.failureCopy || 'Recheck what is owned, where the return comes from, and which disclosure must come first.'}
                      </div>
                    ) : null}
                    <div className="mint-action-box inline-mint-action task-badge-mint-box">
                      <div>
                        <div className="product-title">Mint quiz collectible</div>
                        <div className="muted">
                          After the 3-question product briefing quiz is passed, this module can mint its wallet collectible for the connected wallet.
                        </div>
                      </div>
                      <div className="mint-status-stack">
                        <button
                          className="secondary-btn"
                          onClick={() => handleMintTaskBadge('quiz')}
                          disabled={!quizTaskDone || quizTaskBadgeMinted || mintForCurrentAccountBusy}
                        >
                          {quizTaskBadgeMinted
                            ? 'Completed'
                            : mintForCurrentAccountBusy
                              ? getMintTaskStatus('quiz') || 'Finish current mint first'
                              : quizTaskDone
                                ? 'Wait to be minted'
                                : 'Pass quiz first'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                ) : null}

                {visibleOptionalQuest === 'paper' ? (
                <div className="paper-mode-card">
                  <div className="product-top">
                    <div>
                      <div className="product-title">Paper trading preview</div>
                      <div className="muted">
                        This module opens after the wallet task is complete. Before that, the page stays preview-only.
                      </div>
                    </div>
                    <span className={`pill ${paperTaskBadgeMinted ? 'risk-low' : paperTradingUnlocked ? 'risk-low' : 'risk-medium'}`}>
                      {paperTaskBadgeMinted ? 'Completed' : paperTradingUnlocked ? 'Wait to be minted' : 'Wallet task first'}
                    </span>
                  </div>

                  <div className="quest-panel-title" style={{ marginTop: 18 }}>What unlocks paper trading</div>
                  <div className="checklist-list">
                    {[
                      {
                        id: 'wallet',
                        label: 'Wallet task',
                        done: walletTaskAccessUnlocked,
                        helper: walletTaskAccessUnlocked
                          ? 'Wallet connection is complete, so paper trading can open.'
                          : 'Connect MetaMask from the wallet task first.'
                      },
                      {
                        id: 'learn',
                        label: 'Learning task',
                        done: riskTaskDone || quizTaskDone,
                        helper: riskTaskDone || quizTaskDone
                          ? 'Briefing or quiz progress is saved, but Replay access still follows the wallet task.'
                          : 'Review briefings or pass the quiz for better recommendations after wallet access.'
                      },
                      {
                        id: 'mint',
                        label: 'Collectible mint',
                        done: welcomeGateCompleted || walletTaskBadgeMinted || riskTaskBadgeMinted || quizTaskBadgeMinted || paperTaskBadgeMinted,
                        helper: welcomeGateCompleted || walletTaskBadgeMinted || riskTaskBadgeMinted || quizTaskBadgeMinted || paperTaskBadgeMinted
                          ? 'Collectible proof exists, but the open gate is still the wallet task.'
                          : 'Optional reward after wallet access; not a separate replay gate.'
                      }
                    ].map((item) => (
                      <div className={`checklist-item ${item.done ? 'done' : ''}`} key={item.id}>
                        <div className="check-indicator">{item.done ? 'OK' : 'TODO'}</div>
                        <div className="checklist-copy">
                          <div>
                            <div className="check-title">{item.label}</div>
                            <div className="muted">{item.helper}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mint-action-box inline-mint-action task-badge-mint-box">
                    <div>
                        <div className="product-title">Mint paper trading preview collectible</div>
                        <div className="muted">
                          {paperTaskBadgeMinted
                            ? 'This wallet already minted the paper trading preview collectible.'
                            : paperTradingUnlocked
                              ? 'The wallet task is complete. Wait to be minted for this wallet to complete the paper trading preview collectible.'
                              : 'Complete the wallet task first, then mint the paper trading preview collectible if you want the onchain reward.'}
                      </div>
                    </div>
                    <div className="mint-status-stack">
                      <button
                        className="secondary-btn"
                        onClick={() => handleMintTaskBadge('paper')}
                        disabled={!paperTradingUnlocked || paperTaskBadgeMinted || mintForCurrentAccountBusy}
                      >
                        {paperTaskBadgeMinted
                          ? 'Completed'
                          : mintForCurrentAccountBusy
                            ? getMintTaskStatus('paper') || 'Finish current mint first'
                            : paperTradingUnlocked
                              ? 'Wait to be minted'
                              : 'Wallet task first'}
                      </button>
                    </div>
                  </div>

                  {paperTradingUnlocked ? (
                    <div className="mint-action-box inline-mint-action task-badge-mint-box">
                      <div>
                        <div className="product-title">Open paper trading</div>
                        <div className="muted">
                          The wallet task is complete, so the simulation page is now unlocked for this wallet.
                        </div>
                      </div>
                      <div className="mint-status-stack">
                        <a className="secondary-btn" href="./paper-trading.html">
                          Open paper trading lab
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="card" id="discover">
            <div className="section-head">
              <div>
                <div className="eyebrow">Discover</div>
                <h2>Start with the four product lanes that teach the widest difference in fit</h2>
              </div>
            </div>
            <div className="env-hint">
              We trimmed the homepage shelf to four lanes that already map cleanly into Wealth and Paper. One reserve sleeve stays up front, then private credit, private-market context, and public-market wrappers.
            </div>
            <div className="product-grid home-discover-grid">
              {STARTER_DISCOVER_PRODUCTS.map((product) => (
                <div className="product-card home-discover-card" key={product.id}>
                  <div className="product-top">
                    <div>
                      <div className="product-title">{product.ticker}</div>
                      <div className="muted">{product.name}</div>
                    </div>
                    <div className="home-briefing-pill-row">
                      <span className={`pill ${riskClass(product.risk)}`}>{product.risk} risk</span>
                      <span className="pill risk-medium">{product.beginnerFit}</span>
                    </div>
                  </div>
                  <div className="muted">{product.summary}</div>
                  <div className="home-discover-use-case">{product.useCase}</div>
                  <BriefingFactGrid product={product} />
                </div>
              ))}
            </div>
          </section>

          <section className="card" id="wealth">
            <div className="section-head">
              <div>
                <div className="eyebrow">Wealth</div>
                <h2>Goal-based wealth hub for users who need explanation before yield</h2>
              </div>
            </div>
            <div className="home-surface-hero">
              <div>
                <div className="eyebrow">Wealth path</div>
                <h3>Fit first, receipt second, diligence always visible</h3>
                <p className="muted">
                  The wealth page now behaves like a guided product surface: it starts from a user goal, keeps ownership language visible, and only then opens the signed receipt flow.
                </p>
              </div>
              <div className="home-briefing-pill-row">
                <span className="pill risk-low">Wallet-linked demo receipts</span>
                <span className="pill risk-medium">Demo only</span>
              </div>
            </div>
            <div className="home-surface-card-grid">
              <div className="home-surface-card">
                <div className="eyebrow">Routing</div>
                <div className="entry-title">Goal-first product routing</div>
                <div className="entry-copy">Start from the user goal like stable yield, steadier principal, or buy-lower exposure, then reveal the product structure only after the fit is clear.</div>
                <div className="home-surface-foot">Users see fit first, structure second.</div>
              </div>
              <div className="home-surface-card">
                <div className="eyebrow">Ownership</div>
                <div className="entry-title">Tokenized share receipts</div>
                <div className="entry-copy">Subscriptions now map to wallet-linked share tokens, so the wealth page can show ownership, redemption rights, and future reward or gating logic.</div>
              </div>
              <div className="home-surface-card">
                <div className="eyebrow">Research layer</div>
                <div className="entry-title">AI diligence and compliance layer</div>
                <div className="entry-copy">Each shelf can explain underlying assets, source of return, eligibility, liquidity stress, and disclosure posture instead of hiding behind APY alone.</div>
              </div>
            </div>
            <div className="toolbar" style={{ marginTop: 14 }}>
              <a
                className={wealthHubUnlocked ? 'primary-btn' : 'secondary-btn'}
                href="./wealth.html"
                onClick={() => recordAnalytics('wealth_hub_open')}
              >
                {wealthHubUnlocked ? 'Open wealth hub' : 'Preview wealth hub'}
              </a>
            </div>
          </section>

          <section className="card" id="paperTrading">
            <div className="section-head">
              <div>
                <div className="eyebrow">Paper trading</div>
                <h2>Simulation mode should sit directly under discovery</h2>
              </div>
            </div>
            <div className="paper-preview-shell">
              <div className="paper-preview-card">
                <div className="product-top">
                  <div>
                    <div className="product-title">Paper trading unlock</div>
                    <div className="muted">
                      {paperTradingUnlocked
                        ? 'The wallet task is complete, so the user can now enter simulation mode and test products before any live-style action.'
                        : 'This module is visible as a replay-first practice preview until the wallet task is complete.'}
                    </div>
                  </div>
                  <span className={`pill ${paperTradingUnlocked ? 'risk-low' : 'risk-medium'}`}>
                    {paperTradingUnlocked ? 'Unlocked' : 'Preview'}
                  </span>
                </div>
                <div className="paper-balance-strip home-paper-balance-strip">
                  <div className="paper-balance-box">
                    <div className="label">Remaining tokens</div>
                    <div className="value">{remainingPaperTokens.toLocaleString()} PT</div>
                  </div>
                  <div className="paper-balance-box">
                    <div className="label">Reward per collectible</div>
                    <div className="value">+{BADGE_REWARD_TOKENS} PT</div>
                  </div>
                  <div className="paper-balance-box">
                    <div className="label">Minimum trade size</div>
                    <div className="value">{MIN_PAPER_TRADE} PT</div>
                  </div>
                </div>
                <div className="home-surface-card-grid home-surface-card-grid-paper">
                  <div className="home-surface-card">
                    <div className="eyebrow">Replay entry</div>
                    <div className="entry-title">Starter simulation</div>
                    <div className="entry-copy">Practice with treasury-style or managed products before using any live wallet flow. Collectible rewards increase the available simulation budget.</div>
                    <div className="home-surface-foot">Budget expands as wallet collectibles are completed.</div>
                  </div>
                  <div className="home-surface-card">
                    <div className="eyebrow">Education state</div>
                    <div className="entry-title">{riskTaskDone ? 'Product briefings already reviewed' : 'Product briefings still open'}</div>
                    <div className="entry-copy">
                      {riskTaskDone
                        ? 'This wallet already completed a product-briefing task, so recommendations can use that context after wallet access.'
                        : `Finish ${RISK_REVIEW_REQUIRED} product briefings for product context; the open gate itself remains the wallet task.`}
                    </div>
                  </div>
                </div>
                  <div className="toolbar" style={{ marginTop: 14 }}>
                    <a
                      className={paperTradingUnlocked ? 'primary-btn' : 'secondary-btn'}
                      href="./paper-trading.html"
                      onClick={() => recordAnalytics('paper_trading_page_open')}
                    >
                      {paperTradingUnlocked ? 'Open replay lab' : 'Preview replay lab'}
                    </a>
                  </div>
                  <div className="mint-action-box inline-mint-action task-badge-mint-box">
                    <div>
                      <div className="product-title">Mint paper trading collectible</div>
                      <div className="muted">
                        After the wallet task is complete, this paper trading preview waits to be minted for the current wallet.
                      </div>
                    </div>
                    <div className="mint-status-stack">
                      <button
                        className="secondary-btn"
                        onClick={() => handleMintTaskBadge('paper')}
                        disabled={!paperTradingUnlocked || paperTaskBadgeMinted || mintForCurrentAccountBusy}
                      >
                        {paperTaskBadgeMinted
                          ? 'Completed'
                          : mintForCurrentAccountBusy
                            ? getMintTaskStatus('paper') || 'Finish current mint first'
                            : paperTradingUnlocked
                              ? 'Wait to be minted'
                              : 'Wallet task first'}
                      </button>
                    </div>
                  </div>
                {paperTradingLockedByTutorial ? (
                  <div className="paper-lock-note">
                    Complete the wallet task first. Until then, <a href="./paper-trading.html">open the preview page</a>.
                  </div>
                ) : null}
              </div>
            </div>
          </section>

        </main>
      </div>

      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnect={handleConnect}
        onDisconnect={handleWalletDisconnect}
        onSaveNickname={handleSaveWalletNickname}
        onSignProfileBackup={handleSignProfileBackup}
        onRecoverProfileBackup={handleRecoverProfileBackup}
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
        isProfileSigning={isProfileSigning}
        profileBackupConfigured={profileBackupConfigured}
        profileBackupRecoverable={profileBackupRecoverable}
        profileBackupSummaryText={profileBackupSummaryText}
        walletProfileSummary={walletProfileSummary}
        profileBackupAccounts={profileBackupAccounts}
        selectedProfileBackupAddress={selectedProfileBackupAddress}
        onSelectedProfileBackupAddressChange={setSelectedProfileBackupAddress}
        onRecoverSelectedProfileBackup={handleRecoverSelectedProfileBackup}
      />

      {devModeOpen ? (
        <div className="wallet-modal-backdrop" onClick={(event) => event.target === event.currentTarget && handleDeveloperModeCloseRequest()}>
          <div className="wallet-modal developer-modal">
            <button className="wallet-modal-close" onClick={handleDeveloperModeCloseRequest} aria-label="Close developer mode">
              X
            </button>
            <div className="wallet-modal-pane wallet-modal-sidebar">
              <div className="wallet-modal-title">Developer Mode</div>
              <div className="wallet-modal-subtitle">Analytics panel</div>
              <div className="wallet-install-copy">
                Inspect click-through activity, wallet state, and local override behavior across the homepage. Closing the panel exits developer mode for this use; if you changed live wallet settings in this session, you can keep them or restore the earlier local state on exit.
              </div>
              {devModeAuthed ? (
                <div className="developer-account-selector">
                  <div className="developer-account-selector-head">
                    <span>Wallet accounts</span>
                    <strong>{developerWalletAccounts.length}</strong>
                  </div>
                  <div className="developer-account-list">
                    {developerWalletAccounts.length ? (
                      developerWalletAccounts.map((account) => (
                        <button
                          type="button"
                          key={account.address}
                          className={`developer-account-button ${developerWalletAddress === account.address ? 'active' : ''}`.trim()}
                          onClick={() => setDeveloperWalletAddress(account.address)}
                        >
                          <span>{account.label}</span>
                          <strong>{account.shortLabel}</strong>
                          <em>
                            {Number(account.behavior?.total || 0)} events / {account.storageMode}
                          </em>
                        </button>
                      ))
                    ) : (
                      <div className="developer-account-empty">Connect or recover a wallet to populate this list.</div>
                    )}
                  </div>
                </div>
              ) : null}
              <button className="secondary-btn" onClick={handleDeveloperModeCloseRequest}>
                Close panel
              </button>
            </div>
            <div className="wallet-modal-pane wallet-modal-main developer-modal-main">
              {!devModeAuthed ? (
                <div className="developer-auth-form">
                  <div className="wallet-modal-status">Developer sign in</div>
                  <div className="env-hint">
                    Demo-only admin access. Use <strong>{DEV_MODE_USERNAME}</strong> / <strong>{DEV_MODE_PASSWORD}</strong>; the panel resets and asks again each time it is opened.
                  </div>
                  <label>
                    Username
                    <input value={devModeUsername} onChange={(event) => setDevModeUsername(event.target.value)} />
                  </label>
                  <label>
                    Password
                    <input type="password" value={devModePassword} onChange={(event) => setDevModePassword(event.target.value)} />
                  </label>
                  <button className="primary-btn" onClick={handleDeveloperLogin}>
                    Open admin controls
                  </button>
                  {devModeError ? <div className="env-hint">{devModeError}</div> : null}
                </div>
              ) : (
                <div className="developer-analytics">
                  <div className="wallet-modal-status">Admin controls</div>
                  <div className="developer-detail-tabs" aria-label="Developer detail views">
                    {developerDetailPanels.map((panel) => (
                      <button
                        key={panel.id}
                        type="button"
                        className={`developer-detail-tab ${developerDetailTopic === panel.id ? 'active' : ''}`}
                        onClick={() => setDeveloperDetailTopic(panel.id)}
                      >
                        <span>{panel.kicker}</span>
                        <strong>{panel.label}</strong>
                      </button>
                    ))}
                  </div>
                  <div className="developer-detail-panel">
                    <div className="developer-detail-panel-head">
                      <div>
                        <div className="eyebrow">{activeDeveloperDetailPanel.kicker}</div>
                        <h3>{activeDeveloperDetailPanel.title}</h3>
                      </div>
                      <span className={`pill ${devModeAuthed ? 'risk-low' : 'risk-medium'}`}>
                        {devModeAuthed ? 'Signed in' : 'Login required'}
                      </span>
                    </div>
                    {activeDeveloperDetailPanel.copy ? <p className="muted">{activeDeveloperDetailPanel.copy}</p> : null}
                    {activeDeveloperDetailPanel.rows.length ? (
                      <div className="developer-detail-grid">
                        {activeDeveloperDetailPanel.rows.map((row) => (
                          <div className="developer-detail-row" key={row.label}>
                            <span>{row.label}</span>
                            <strong>{row.value}</strong>
                            {row.copy ? <em>{row.copy}</em> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {activeDeveloperDetailPanel.id === 'clicks' ? (
                    <div className="developer-clickthrough-grid" aria-label="Click-through analytics buttons">
                      {developerClickthroughButtons.map((tile) => (
                        <button
                          type="button"
                          className="developer-clickthrough-button"
                          key={`${tile.label}-${tile.copy}`}
                          onClick={() => setDevModeNotice(`${tile.label}: ${Number(tile.value || 0).toLocaleString()} tracked locally. ${tile.copy}`)}
                        >
                          <span>{tile.label}</span>
                          <strong>{Number(tile.value || 0).toLocaleString()}</strong>
                          <em>{tile.copy}</em>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {activeDeveloperDetailPanel.id === 'exchange' ? (
                    <div className="developer-admin-grid">
                      <div className="developer-admin-card">
                        <div>
                          <div className="eyebrow">Feature override</div>
                          <div className="wealth-profile-storage-title">Enable all local onboarding and replay gates</div>
                          <div className="muted">
                            Writes completed guide, quiz, paper unlock, and admin override progress for the connected wallet. Onchain collectible minting still remains a real Sepolia action.
                          </div>
                        </div>
                        <button className="primary-btn" onClick={handleDeveloperUnlockAll}>
                          Enable all features
                        </button>
                      </div>
                      <div className="developer-admin-card">
                        <div>
                          <div className="eyebrow">PT controls</div>
                          <div className="wealth-profile-storage-title">Add or set paper PT for this wallet</div>
                          <div className="muted">
                            Updates the shared local profile plus Home and Paper cash stores, so the same wallet sees the balance across pages.
                          </div>
                        </div>
                        <label className="developer-pt-control">
                          PT amount
                          <input type="number" min="0" step="1000" value={devModePtAmount} onChange={(event) => setDevModePtAmount(event.target.value)} />
                        </label>
                        <div className="toolbar">
                          <button className="secondary-btn" onClick={handleDeveloperAddPt}>Add PT</button>
                          <button className="ghost-btn compact" onClick={handleDeveloperSetPtBalance}>Set balance</button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {devModeNotice ? <div className="env-hint">{devModeNotice}</div> : null}
                  {devModeError ? <div className="env-hint quiz-error">{devModeError}</div> : null}
                  {developerExitPromptOpen ? (
                    <div className="developer-exit-card">
                      <div className="wallet-modal-status">Leave developer mode?</div>
                      <div className="muted">
                        This session changed wallet-linked PT or onboarding state. You can keep the current override, restore the earlier local state for this wallet, or stay here and continue editing.
                      </div>
                      <div className="toolbar">
                        <button className="secondary-btn" onClick={handleDeveloperModeKeepChanges}>
                          Keep current state
                        </button>
                        <button className="ghost-btn compact" onClick={handleDeveloperModeRestoreSnapshot}>
                          Restore previous state
                        </button>
                        <button className="ghost-btn compact" onClick={() => setDeveloperExitPromptOpen(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
