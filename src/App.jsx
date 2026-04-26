import React, { useEffect, useMemo, useState } from 'react';
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
  getWalletProfileSummary,
  readRecoveredHomePaperBalance,
  readWalletProfile,
  signAndStoreProfilePointer,
  writeWalletProfilePatch
} from './walletProfileStore';

const products = [
  {
    id: 'ousg',
    ticker: 'OUSG',
    name: 'Ondo Short-Term US Government Treasuries',
    risk: 'Low',
    summary: 'A treasury-style onchain product that feels easier for Web2 users to understand than tokenized stock wrappers.',
    useCase: 'Stable reserve and simple first RWA explanation',
    beginnerFit: 'Strong',
    sourceOfReturn: 'Short-duration treasury yield.',
    worstCase: 'Yield declines, access is gated, or liquidity becomes less convenient than expected.'
  },
  {
    id: 'usdy',
    ticker: 'USDY',
    name: 'Ondo USDY',
    risk: 'Low',
    summary: 'Feels closer to a wealth product than a raw DeFi strategy, but still needs eligibility and disclosure framing.',
    useCase: 'Steady yield for users who are not chasing equity upside',
    beginnerFit: 'Good',
    sourceOfReturn: 'Short-duration U.S. asset yield.',
    worstCase: 'Eligibility limits, lower yield than expected, or secondary liquidity friction.'
  },
  {
    id: 'msxq1',
    ticker: 'MSXQ1',
    name: 'MSX Quant AI Fund #1',
    risk: 'Medium',
    summary: 'A managed-strategy style product where plain-language explanation matters more than labels alone.',
    useCase: 'Simple on-platform wealth entry for users who prefer a managed strategy',
    beginnerFit: 'Needs stronger disclosure',
    sourceOfReturn: 'Systematic strategy performance and market regime fit.',
    worstCase: 'Model underperformance, drawdowns, or unclear return expectations.'
  },
  {
    id: 'tslax',
    ticker: 'TSLAX',
    name: 'Tokenized Tesla Wrapper',
    risk: 'High',
    summary: 'Good for paper trading demos, but the wrong first touchpoint for a confused newcomer.',
    useCase: 'High-beta stock upside with crypto-style accessibility',
    beginnerFit: 'Poor',
    sourceOfReturn: 'Single-name equity volatility.',
    worstCase: 'Fast downside, spread shock, and event-driven misunderstanding.'
  }
];

const quests = [
  { title: 'Connect wallet', copy: 'Authenticate with a wallet before any live-style action is unlocked.', reward: 'Starter badge' },
  { title: 'Mint welcome badge on Sepolia', copy: 'Submit one real testnet transaction so the first reward feels onchain, not simulated.', reward: 'Collectible unlock' },
  { title: 'Read 3 plain-language risk cards', copy: 'Translate wrappers, treasury products, and managed strategies into one-minute explanations.', reward: 'Risk unlock' },
  { title: 'Finish one product quiz', copy: 'Ask what a user actually owns and what could go wrong in a wrapper product.', reward: 'Fee coupon' },
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
    copy: 'MSX should first explain what a product is for, show a simple 1,000 USDT example, and then route users into practice instead of forcing live complexity too early.',
    nextStep: 'Review starter products first, then try one paper trade.',
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
    nextStep: 'Start with OUSG or USDY before any single-name exposure.',
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
        copy: 'Great. We will guide this user through wallet setup, badge tasks, and then unlock paper trading in a cleaner order.',
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
        secondary: 'See starter products',
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
const DEV_AUTH_STORAGE_KEY = 'msx-dev-auth';
const ADMIN_UNLOCK_STORAGE_PREFIX = 'msx-admin-unlock';
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

function trackAnalytics(eventName) {
  if (typeof window === 'undefined') return { total: 0, events: {} };
  const next = readStorageJson(ANALYTICS_STORAGE_KEY, { total: 0, events: {} });
  next.total += 1;
  next.events[eventName] = (next.events[eventName] || 0) + 1;
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
  isPending,
  isConnected,
  address,
  walletDisplayName,
  nicknameDraft,
  onNicknameDraftChange,
  nicknameFeedback,
  errorText,
  hasMetaMaskInstalled
}) {
  if (!open) return null;

  return (
    <div className="wallet-modal-backdrop" onClick={(event) => event.target === event.currentTarget && !isPending && onClose()}>
      <div className="wallet-modal">
        <button className="wallet-modal-close" onClick={onClose} disabled={isPending} aria-label="Close wallet modal">
          X
        </button>
        <div className="wallet-modal-pane wallet-modal-sidebar">
          <div className="wallet-modal-title">MSX Wallet Access</div>
          <div className="wallet-modal-subtitle">Welcome Layer</div>
          <button className={`wallet-option ${isPending || !hasMetaMaskInstalled ? 'disabled' : ''}`} onClick={onConnect} disabled={isPending || !hasMetaMaskInstalled}>
            <MetaMaskIcon className="wallet-option-icon" />
            <div>
              <div className="wallet-option-title">MetaMask</div>
              <div className="wallet-option-copy">
                {isConnected
                  ? `Wallet connected ${walletDisplayName}`
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
        <div className="wallet-modal-pane wallet-modal-main">
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
                : 'Select MetaMask to trigger a real wallet approval flow, like the live MSX platform experience.'}
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
            <button className="secondary-btn" onClick={onDisconnect}>
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
  const [selectedRiskProduct, setSelectedRiskProduct] = useState(products[0].id);
  const [liveChainId, setLiveChainId] = useState(null);
  const [quizProductId, setQuizProductId] = useState('tslax');
  const [quizAnswers, setQuizAnswers] = useState({
    owns: '',
    downside: ''
  });
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [hasMetaMaskInstalled, setHasMetaMaskInstalled] = useState(false);
  const [activeCoreQuest, setActiveCoreQuest] = useState('wallet');
  const [activeOptionalQuest, setActiveOptionalQuest] = useState('risk');
  const [optionalQuestNotice, setOptionalQuestNotice] = useState('');
  const [visibleCoreQuest, setVisibleCoreQuest] = useState('wallet');
  const [visibleOptionalQuest, setVisibleOptionalQuest] = useState('risk');
  const [paperTradesCompleted, setPaperTradesCompleted] = useState(0);
  const [paperBalanceSnapshot, setPaperBalanceSnapshot] = useState(STARTING_PAPER_TOKENS);
  const [progressAccountKey, setProgressAccountKey] = useState('');
  const [devModeOpen, setDevModeOpen] = useState(false);
  const [devModeAuthed, setDevModeAuthed] = useState(false);
  const [devModeUsername, setDevModeUsername] = useState(DEV_MODE_USERNAME);
  const [devModePassword, setDevModePassword] = useState(DEV_MODE_PASSWORD);
  const [devModeError, setDevModeError] = useState('');
  const [devModeNotice, setDevModeNotice] = useState('');
  const [devModePtAmount, setDevModePtAmount] = useState(String(DEFAULT_ADMIN_PT_AMOUNT));
  const [analyticsSnapshot, setAnalyticsSnapshot] = useState({ total: 0, events: {} });
  const [profileBackupStatus, setProfileBackupStatus] = useState('');

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
    () => products.find((product) => product.id === selectedRiskProduct) || products[0],
    [selectedRiskProduct]
  );

  const quizProduct = useMemo(
    () => products.find((product) => product.id === quizProductId) || products[3],
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

  useEffect(() => {
    if (isConnected) {
      setWalletModalOpen(false);
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
      setQuizSubmitted(false);
      setQuizAnswers({ owns: '', downside: '' });
      setLiveChainId(null);
      setPaperTradesCompleted(0);
      setProgressAccountKey('');
      setMintTaskKey('welcome');
    }
  }, [isConnected]);

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
    const initialViewedRiskCards = storedProgress.viewedRiskCards?.length
      ? storedProgress.viewedRiskCards
      : profileProgress.viewedRiskCards?.length
        ? profileProgress.viewedRiskCards
        : selectedRiskProduct
          ? [selectedRiskProduct]
          : [];

    setViewedRiskCards(initialViewedRiskCards);
    setGuideCompleted(Boolean(storedProgress.guideCompleted || profileProgress.guideCompleted || initialViewedRiskCards.length >= 3));
    setQuizCompleted(Boolean(storedProgress.quizCompleted || profileProgress.quizCompleted));
    setPaperTradesCompleted(Math.max(Number(storedProgress.paperTradesCompleted || 0), Number(profileProgress.paperTradesCompleted || 0)));
    setProgressAccountKey(nextProgressAccountKey);
  }, [address, progressStorageKey, selectedRiskProduct]);

  useEffect(() => {
    if (!address || progressAccountKey !== connectedAddressKey) return;
    const existingProgress = readStorageJson(progressStorageKey, {});
    const profileProgress = readWalletProfile(address).progress;
    const nextGuideCompleted = Boolean(guideCompleted || viewedRiskCards.length >= 3);
    const nextProgress = {
      viewedRiskCards,
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
    if (viewedRiskCards.length >= 3 && !guideCompleted) {
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
    setDevModeAuthed(Boolean(readStorageJson(DEV_AUTH_STORAGE_KEY, false)));
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
  const welcomeGateCompleted = badgeContractConfigured ? badgeMintCompleted : walletQuestDone;
  const walletTaskBadgeMinted = Boolean(address) && Boolean(walletBadgeOnchain);
  const riskTaskBadgeMinted = Boolean(address) && Boolean(riskBadgeOnchain);
  const quizTaskBadgeMinted = Boolean(address) && Boolean(quizBadgeOnchain);
  const paperTaskBadgeMinted = Boolean(address) && Boolean(paperBadgeOnchain);
  const walletBadgeChecking = Boolean(address) && badgeContractConfigured && !walletBadgeFetched && walletBadgeFetching;
  const welcomeBadgeChecking = Boolean(address) && badgeContractConfigured && !welcomeBadgeFetched && welcomeBadgeFetching;
  const riskBadgeChecking = Boolean(address) && badgeContractConfigured && !riskBadgeFetched && riskBadgeFetching;
  const quizBadgeChecking = Boolean(address) && badgeContractConfigured && !quizBadgeFetched && quizBadgeFetching;
  const paperBadgeChecking = Boolean(address) && badgeContractConfigured && !paperBadgeFetched && paperBadgeFetching;
  const localProgressReady = Boolean(connectedAddressKey && progressAccountKey === connectedAddressKey);
  const riskTaskDone = (localProgressReady && (guideCompleted || viewedRiskCards.length >= 3)) || riskTaskBadgeMinted;
  const quizTaskDone = (localProgressReady && quizCompleted) || quizTaskBadgeMinted;
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
  const paperTokenBalance = paperBalanceForCurrentAccount + badgeRewardsEarned;
  const walletProfileSummary = getWalletProfileSummary({
    ...readWalletProfile(address),
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
  const completedBoxes = [walletQuestDone, welcomeGateCompleted, riskTaskDone].filter(Boolean).length;
  const paperTradingUnlocked = completedBoxes >= 3 || fastTrackPaper;
  const paperTradingLockedByTutorial = !paperTradingUnlocked;
  const effectiveChainId = chainId ?? liveChainId ?? null;
  const onSepolia = effectiveChainId === SEPOLIA_CHAIN_ID;
  const hasSepoliaGas = Boolean(sepoliaBalance?.value && sepoliaBalance.value > 0n);
  const badgeDeploymentLabel = badgeContractConfigured
    ? `Sepolia badge ${shortAddress(BADGE_CONTRACT_ADDRESS)}`
    : 'Demo mode - onchain badge not connected';
  const badgeDeploymentHelper = badgeContractConfigured
    ? 'Vercel build detected the badge contract address, so judges can mint and verify the first badge on Sepolia.'
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
  const paperTradeCompleted = paperTradesCompleted > 0;
  const remainingPaperPrereqs = [
    walletQuestDone ? null : 'connect wallet',
    welcomeGateCompleted ? null : badgeContractConfigured ? 'mint welcome badge' : 'connect wallet',
    riskTaskDone ? null : 'review risk cards'
  ].filter(Boolean);
  const paperUnlockChecklist = [
    {
      id: 'wallet',
      label: 'Wallet connected',
      done: walletQuestDone,
      helper: walletQuestDone ? `Connected ${walletDisplayName}` : 'Connect MetaMask before opening paper trading.'
    },
    {
      id: 'mint',
      label: 'Welcome badge minted',
      done: welcomeGateCompleted,
      helper: badgeContractConfigured
        ? badgeMintCompleted
          ? 'The welcome badge is already minted for this wallet.'
          : 'Finish the Sepolia welcome mint in step 2 first.'
        : walletQuestDone
          ? 'Onchain badge minting is not connected in this deployment, so the demo uses the connected wallet as the gate.'
          : 'Connect a wallet to continue in demo mode.'
    },
    {
      id: 'risk',
      label: 'Risk cards reviewed',
      done: riskTaskDone,
      helper: riskTaskDone ? 'This wallet already completed the risk-card prerequisite.' : 'Review 3 risk cards so paper mode opens with product context.'
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
  const quizPassed =
    quizAnswers.owns === 'wrapper-rights' &&
    quizAnswers.downside === 'single-name-downside';
  const paperTaskDone = paperTaskBadgeMinted;

  function getMintTaskStatus(taskKey) {
    if (activeMintTaskKey !== taskKey) return '';
    if (isMinting) return 'Confirm mint in MetaMask';
    if (isConfirmingMint) return 'Waiting for Sepolia confirmation';
    if (mintConfirmed) return 'Refreshing badge status';
    return '';
  }

  function getQuestStatusLabel(status) {
    if (status === 'Done') return 'Wait to be minted';
    if (status === 'Unlocked') return 'Unlocked';
    return status;
  }

  const learnQuestCards = [
    {
      id: 'wallet',
      title: walletTaskBadgeMinted ? 'Wallet task completed' : walletQuestDone ? 'Wallet connected' : 'Connect wallet',
      status: walletTaskBadgeMinted ? 'Completed' : walletQuestDone ? 'Done' : walletBadgeChecking ? 'Checking' : 'To do',
      reward: '+1000 PT',
      label: quests[0].reward,
      hint: 'Start here for the real MetaMask flow.'
    },
    {
      id: 'mint',
      title: badgeContractConfigured
        ? badgeMintCompleted
          ? 'Welcome badge minted'
          : 'Mint welcome badge'
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
        : 'Onchain badge minting is optional for this deployment; wallet connection carries the demo state.'
    },
    {
      id: 'risk',
      title: riskTaskBadgeMinted ? 'Risk task completed' : riskTaskDone ? 'Risk cards ready to mint' : 'Read risk cards',
      status: riskTaskBadgeMinted ? 'Completed' : riskTaskDone ? 'Done' : riskBadgeChecking ? 'Checking' : 'To do',
      reward: '+1000 PT',
      label: quests[2].reward,
      hint: 'Can be reviewed independently.'
    },
    {
      id: 'quiz',
      title: quizTaskBadgeMinted ? 'Product quiz completed' : quizTaskDone ? 'Product quiz ready to mint' : 'Finish product quiz',
      status: quizTaskBadgeMinted ? 'Completed' : quizTaskDone ? 'Done' : quizBadgeChecking ? 'Checking' : 'To do',
      reward: '+1000 PT',
      label: quests[3].reward,
      hint: 'Can be completed independently.'
    },
    {
      id: 'paper',
      title: paperTaskBadgeMinted ? 'Paper trading preview completed' : paperTradingUnlocked ? 'Paper trading preview ready' : 'Paper trading preview',
      status: paperTaskDone ? 'Completed' : paperTradingUnlocked ? 'Done' : paperBadgeChecking ? 'Checking' : `${completedBoxes}/3 completed`,
      reward: '+1000 PT',
      label: quests[4].reward,
      hint: 'Unlock depends on wallet, mint, and risk cards.'
    }
  ];

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

  const mintStatusText = !isConnected
    ? 'Connect MetaMask first'
      : !onSepolia
        ? 'Switch to Sepolia'
      : !badgeContractConfigured
        ? 'Badge contract not connected'
        : badgeMintCompleted
          ? 'Welcome badge minted'
        : activeMintTaskKey === 'welcome' && mintConfirmed
          ? 'Refreshing badge status'
        : welcomeBadgeChecking
          ? 'Checking this wallet account'
        : isSwitchingChain
          ? 'Switching network...'
          : isMinting
            ? 'Confirm mint in MetaMask'
            : isConfirmingMint
              ? 'Waiting for Sepolia confirmation'
              : 'Ready to mint on Sepolia';

  function openWalletModal() {
    setAnalyticsSnapshot(trackAnalytics('wallet_modal_open'));
    setWalletModalOpen(true);
    setWalletError('');
  }

  function handleRiskCardSelect(productId) {
    setAnalyticsSnapshot(trackAnalytics(`risk_card_${productId}`));
    setSelectedRiskProduct(productId);
    setViewedRiskCards((current) => (current.includes(productId) ? current : [...current, productId]));
  }

  useEffect(() => {
    if (!selectedRiskProduct) return;
    setViewedRiskCards((current) => (current.includes(selectedRiskProduct) ? current : [...current, selectedRiskProduct]));
  }, [selectedRiskProduct]);

  function handleQuizChange(field, value) {
    setQuizAnswers((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleQuizSubmit() {
    setAnalyticsSnapshot(trackAnalytics('product_quiz_submit'));
    setQuizSubmitted(true);
    setQuizCompleted(quizPassed);
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
    setPendingWalletNickname(normalizeWalletNickname(walletNicknameDraft) || null);
    connect({ connector: metaMaskConnector });
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
    setAnalyticsSnapshot(trackAnalytics(`module_${questId}`));
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

  function openDeveloperMode() {
    setAnalyticsSnapshot(readStorageJson(ANALYTICS_STORAGE_KEY, { total: 0, events: {} }));
    setDevModeOpen(true);
    setDevModeError('');
  }

  function handleDeveloperLogin() {
    const normalizedUsername = devModeUsername.trim();
    const normalizedPassword = devModePassword.trim();

    if (normalizedUsername === DEV_MODE_USERNAME && normalizedPassword === DEV_MODE_PASSWORD) {
      writeStorageJson(DEV_AUTH_STORAGE_KEY, true);
      setDevModeAuthed(true);
      setDevModeError('');
      setDevModeNotice('Developer controls are open for this browser.');
      setAnalyticsSnapshot(readStorageJson(ANALYTICS_STORAGE_KEY, { total: 0, events: {} }));
      return;
    }
    setDevModeError('Incorrect developer credentials.');
  }

  function buildDeveloperUnlockedProgress(existingProgress = {}) {
    const starterRiskCards = products.slice(0, 3).map((product) => product.id);
    const viewedCards = Array.from(new Set([...(existingProgress.viewedRiskCards || []), ...starterRiskCards]));

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

    const nextProgress = buildDeveloperUnlockedProgress(readStorageJson(progressStorageKey, {}));
    setViewedRiskCards(nextProgress.viewedRiskCards);
    setGuideCompleted(true);
    setQuizCompleted(true);
    setQuizSubmitted(true);
    setQuizAnswers({ owns: 'wrapper-rights', downside: 'single-name-downside' });
    setPaperTradesCompleted(nextProgress.paperTradesCompleted);
    setUserOrigin('web3');
    setWeb3Intent('skip');
    writeDeveloperUnlockedProgress(nextProgress);
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
    setDevModeError('');
    setDevModeNotice(`${actionLabel}: ${normalizedBalance.toLocaleString()} PT is now available for ${shortAddress(address)}.`);
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
      setWalletError('Connect a wallet before minting a task badge.');
      return;
    }

    try {
      setWalletError('');
      setAnalyticsSnapshot(trackAnalytics(`badge_mint_${taskKey}`));

      if (chainId !== SEPOLIA_CHAIN_ID) {
        await switchChainAsync({ chainId: SEPOLIA_CHAIN_ID });
      }

      if (!badgeContractConfigured) {
        setWalletError('Add VITE_BADGE_CONTRACT_ADDRESS to enable real task badge minting.');
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
        setWalletError('Task badge mint was cancelled in MetaMask.');
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
          ...readWalletProfile(address),
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

  return (
    <>
      <div className="noise"></div>
      <div className="app-shell">
        <header className="site-header">
          <div className="brand-wrap">
            <div className="brand-dot"></div>
            <div>
              <div className="eyebrow">MSX Hackathon Demo</div>
              <div className="brand-name">{t('MSX Guided Investing Hub', 'MSX 引导式投资中心')}</div>
            </div>
          </div>
          <nav className="site-nav">
            <a href="#welcome">{t('Welcome', '欢迎')}</a>
            <a href="#discover">{t('Discover', '发现')}</a>
            <a href="#learnEarn">{t('Learn', '学习')}</a>
            <a href="#wealth">{t('Wealth', '理财')}</a>
            <a href="#paperTrading">{t('Paper Trading', '模拟交易')}</a>
          </nav>
          <div className="header-actions">
            <div className="header-status-row">
              <LanguageToggle uiLanguage={uiLanguage} setUiLanguage={setUiLanguage} compact />
              <div className="paper-token-pill">
                <div className="paper-token-label">{t('Remaining paper tokens', '剩余模拟代币')}</div>
                <div className="paper-token-value">{paperTokenBalance.toLocaleString()} PT</div>
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
                      `You start with ${STARTING_PAPER_TOKENS} PT, each completed badge adds ${BADGE_REWARD_TOKENS} PT, and no real funds are involved.`,
                      `初始会发放 ${STARTING_PAPER_TOKENS} PT，每完成一个徽章再增加 ${BADGE_REWARD_TOKENS} PT，全程不涉及真实资金。`
                    )}
                  </div>
                  <div>
                    Wallet memory: {walletProfileSummary.availablePT.toLocaleString()} PT available policy,
                    reserve {walletProfileSummary.reservePT.toLocaleString()} PT,
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
            <div className="header-admin-row">
              <button className="ghost-btn compact" onClick={openDeveloperMode}>
                {t('Developer mode', '开发者模式')}
              </button>
            </div>
          </div>
        </header>

        <main>
          <section className="hero card" id="welcome">
            <div className="hero-copy">
              <div className="eyebrow">{t('MSX + AI-guided discovery + wallet-native onboarding', 'MSX + AI 引导发现 + 钱包原生 onboarding')}</div>
              <h1>{t('Make RWA investing understandable before it feels onchain.', '在用户真正接触链上之前，先把 RWA 投资讲明白。')}</h1>
              <p className="hero-text">
                {t(
                  'This version keeps the MSX welcome-page aesthetic, but upgrades the wallet entry into a real MetaMask connection flow that can be deployed to GitHub Pages and tested directly by judges.',
                  '这个版本保留了 MSX 欢迎页的视觉风格，同时把钱包入口升级成真实的 MetaMask 连接流程，能直接部署到 GitHub Pages 并供评委现场测试。'
                )}
              </p>
              <div className="hero-points">
                <span>{t('First-time users see purpose, not jargon', '新用户先看到用途，而不是术语')}</span>
                <span>{t('Wallet connection feels like a real product flow', '钱包连接更像真实产品流程')}</span>
              </div>
              <div className="cta-row">
                <button className="primary-btn" onClick={openWalletModal}>
                  {t('Connect wallet', '连接钱包')}
                </button>
                <a className="secondary-btn" href="#discover" onClick={() => setAnalyticsSnapshot(trackAnalytics('hero_discover_click'))}>
                  {t('Explore starter products', '查看入门产品')}
                </a>
              </div>
              <a className="hero-helper-link" href="#route" onClick={() => setAnalyticsSnapshot(trackAnalytics('hero_route_help_click'))}>
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
                      setAnalyticsSnapshot(trackAnalytics('route_origin_web2'));
                      setUserOrigin('web2');
                    }}
                  >
                    <div className="entry-title">{t('I am from Web2', '我是从 Web2 过来的')}</div>
                    <div className="entry-copy">{t('I want plain-language routes, simpler products, and simulated practice before anything feels technical.', '我想先看更直白的路径、更简单的产品，以及在任何技术内容之前先做模拟练习。')}</div>
                  </button>
                  <button
                    className={`entry-card origin-choice ${userOrigin === 'web3' ? 'active' : ''}`}
                    onClick={() => {
                      setAnalyticsSnapshot(trackAnalytics('route_origin_web3'));
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
                          setAnalyticsSnapshot(trackAnalytics('route_web2_trading'));
                          setWeb2Intent('trading');
                        }}
                      >
                        <div className="entry-title">OK, show me what to do</div>
                        <div className="entry-copy">Start with the guided wallet path, then unlock paper trading after the onboarding steps.</div>
                      </button>
                      <button
                        className={`entry-card origin-choice ${web2Intent === 'wealth' ? 'active' : ''}`}
                        onClick={() => {
                          setAnalyticsSnapshot(trackAnalytics('route_web2_wealth'));
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
                          setAnalyticsSnapshot(trackAnalytics('route_web3_skip'));
                          setWeb3Intent('skip');
                        }}
                      >
                        <div className="entry-title">Yes, skip to practice</div>
                        <div className="entry-copy">Unlock paper trading immediately and jump into simulation without the onboarding loop.</div>
                      </button>
                      <button
                        className={`entry-card origin-choice ${web3Intent === 'learn' ? 'active' : ''}`}
                        onClick={() => {
                          setAnalyticsSnapshot(trackAnalytics('route_web3_learn'));
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
              <div className="label">{t('What MSX already has', 'MSX 已经具备')}</div>
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
                {t('MSX-style welcome page with real MetaMask connection, then guided product discovery.', 'MSX 风格欢迎页 + 真实 MetaMask 连接，再进入引导式产品发现。')}
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
                {learnQuestCards.slice(0, 2).map((quest, index) => (
                  <button
                    key={quest.id}
                    className={`learn-quest-tile core ${activeCoreQuest === quest.id ? 'active' : ''} ${quest.status === 'Completed' || quest.status === 'Done' || quest.status === 'Unlocked' ? 'done' : ''} ${quest.status === 'Requires wallet' ? 'gated' : ''}`}
                    onClick={() => openLearnQuest(quest.id)}
                  >
                    <div className={`tile-status-badge ${quest.status === 'Completed' ? 'done' : quest.status === 'Done' || quest.status === 'Unlocked' ? 'ready' : 'todo'}`}>
                      {getQuestStatusLabel(quest.status)}
                    </div>
                    <div className="learn-quest-ribbon">Step {index + 1}</div>
                    <div className="learn-quest-pills">
                      <span className="badge">{getQuestStatusLabel(quest.status)}</span>
                      <span className="badge">{quest.label}</span>
                      <span className="badge">{quest.reward}</span>
                    </div>
                    <div className="learn-quest-tile-title">{quest.title}</div>
                    <div className="learn-quest-tile-copy">{quest.hint}</div>
                  </button>
                ))}
              </div>
            </div>

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
                    <div className="quest-panel-title">{walletTaskBadgeMinted ? 'Wallet task completed' : walletQuestDone ? 'Wallet connected' : 'Connect wallet badge'}</div>
                    <div className="muted">
                      Connect once with MetaMask to unlock this task. After the welcome badge is minted in step 2, this wallet task can claim its own badge and keep the reward state.
                    </div>
                    <button className="secondary-btn" onClick={openWalletModal}>
                      {walletQuestDone ? 'Wallet connected' : 'Open MetaMask connect'}
                    </button>
                    <div className="mint-action-box inline-mint-action task-badge-mint-box">
                      <div>
                        <div className="product-title">Mint wallet task badge</div>
                        <div className="muted">
                          This task badge opens only after the welcome badge is minted. Finish step 2 first, then mint the wallet-task collectible for this account.
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
                                : 'Mint wallet task badge'}
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
                    <div className="muted">This minted badge also unlocks another +{BADGE_REWARD_TOKENS} paper tokens for the simulation wallet.</div>
                    <div className="checklist-list">
                      {mintChecklist.map((item) => (
                        <div className={`checklist-item ${item.done ? 'done' : ''}`} key={item.label}>
                          <div className="check-indicator">{item.done ? 'OK' : 'TODO'}</div>
                          <div className="checklist-copy">
                            <div>
                              <div className="check-title">{item.label}</div>
                              <div className="muted">{item.helper}</div>
                            </div>
                            {item.id === 'network' || item.id === 'gas' ? (
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
                        <div className="product-title">{badgeContractConfigured ? 'Mint Welcome Badge' : 'Demo wallet gate active'}</div>
                        <div className="muted">
                          {badgeContractConfigured
                            ? `Sepolia ETH is testnet gas only. Use a faucet, then submit one mint transaction. Minimum paper trade later is ${MIN_PAPER_TRADE} PT.`
                            : 'Onchain badge minting is disabled in this deployment, so the connected wallet unlocks demo progress without showing judges a setup error.'}
                        </div>
                      </div>
                      <button className="secondary-btn" onClick={handleMintBadge} disabled={!walletQuestDone || !mintReady}>
                        {badgeContractConfigured
                          ? mintReady
                            ? 'Mint welcome badge on Sepolia'
                            : mintStatusText
                          : walletQuestDone
                            ? 'Demo gate active'
                            : 'Connect wallet first'}
                      </button>
                    </div>

                    <div className="wealth-profile-storage-card">
                      <div>
                        <div className="eyebrow">Optional profile backup</div>
                        <div className="wealth-profile-storage-title">Save this account's PT demo state, not the wallet key</div>
                        <div className="muted">
                          This signature backs up paper cash, fills, hedge progress, and wealth context for the connected address. It cannot recover MetaMask, private keys, or seed phrases.
                        </div>
                        <div className="wealth-profile-storage-grid">
                          <span>Account {isConnected ? shortAddress(address) : 'not connected'}</span>
                          <span>Policy {walletProfileSummary.availablePT.toLocaleString()} PT</span>
                          <span>Paper cash {walletProfileSummary.paperCash.toLocaleString()} PT</span>
                          <span>Wealth cash {walletProfileSummary.wealthCash.toLocaleString()} PT</span>
                        </div>
                        <div className="muted">
                          Decentralized storage here means a signed, content-hashed snapshot that can later be pinned to IPFS/Filecoin, Ceramic, or Arweave by the project owner.
                        </div>
                        {profileBackupStatus ? <div className="wealth-inline-note paper-inline-note">{profileBackupStatus}</div> : null}
                      </div>
                      <button type="button" className="ghost-btn compact" onClick={handleSignProfileBackup} disabled={isProfileSigning}>
                        {isProfileSigning ? 'Await wallet' : 'Sign optional backup'}
                      </button>
                    </div>

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
                        <div className="k">Badge state</div>
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

                    <div className={`env-hint ${badgeContractConfigured ? 'contract-live' : 'contract-demo'}`}>
                      <strong>{badgeContractConfigured ? 'Judge signal:' : 'Deployment note:'}</strong> {badgeDeploymentHelper}
                    </div>

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
              {learnQuestCards.slice(2).map((quest) => (
                <button
                  key={quest.id}
                  className={`learn-quest-tile ${activeOptionalQuest === quest.id ? 'active' : ''} ${quest.status === 'Completed' || quest.status === 'Done' || quest.status === 'Unlocked' ? 'done' : ''} ${quest.status === 'Requires wallet' ? 'gated' : ''}`}
                  onClick={() => openLearnQuest(quest.id)}
                >
                  <div className={`tile-status-badge ${quest.status === 'Completed' ? 'done' : quest.status === 'Done' || quest.status === 'Unlocked' ? 'ready' : 'todo'}`}>
                    {getQuestStatusLabel(quest.status)}
                  </div>
                  <div className="learn-quest-pills">
                    <span className="badge">{getQuestStatusLabel(quest.status)}</span>
                    <span className="badge">{quest.label}</span>
                    <span className="badge">{quest.reward}</span>
                  </div>
                  <div className="learn-quest-tile-title">{quest.title}</div>
                  <div className="learn-quest-tile-copy">{quest.hint}</div>
                </button>
              ))}
            </div>

            {optionalQuestNotice ? <div className="env-hint" style={{ marginTop: 14 }}>{optionalQuestNotice}</div> : null}

            <div className={`learn-quest-detail-shell ${activeOptionalQuest ? 'open' : 'closed'}`}>
              <div className="learn-quest-detail card learn-quest-optional-detail">
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
                      {products.slice(0, 3).map((product) => (
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
                          <div className="product-title">{selectedRiskCard.ticker}</div>
                          <div className="muted">{selectedRiskCard.name}</div>
                        </div>
                        <span className={`pill ${riskClass(selectedRiskCard.risk)}`}>{selectedRiskCard.risk}</span>
                      </div>
                      <div className="risk-card-grid">
                        <div className="guide-chip">
                          <div className="k">Plain-language use</div>
                          <div className="v">{selectedRiskCard.useCase}</div>
                        </div>
                        <div className="guide-chip">
                          <div className="k">Source of return</div>
                          <div className="v">{selectedRiskCard.sourceOfReturn}</div>
                        </div>
                        <div className="guide-chip">
                          <div className="k">Worst case</div>
                          <div className="v">{selectedRiskCard.worstCase}</div>
                        </div>
                        <div className="guide-chip">
                          <div className="k">Beginner fit</div>
                          <div className="v">{selectedRiskCard.beginnerFit}</div>
                        </div>
                      </div>
                    </div>
                    <div className="env-hint">
                      {riskTaskBadgeMinted ? (
                        <>
                          <strong>Completed:</strong> This wallet already minted the risk task badge.
                        </>
                      ) : riskTaskDone ? (
                        <>
                          <strong>Ready:</strong> Three starter cards were already reviewed for this wallet. You can mint the risk task badge now.
                        </>
                      ) : (
                        <>
                          <strong>Progress:</strong> Open any 3 starter cards to complete this step. Current progress: {Math.min(viewedRiskCards.length, 3)}/3.
                        </>
                      )}
                    </div>
                    <div className="mint-action-box inline-mint-action task-badge-mint-box">
                      <div>
                        <div className="product-title">Mint risk task badge</div>
                        <div className="muted">
                          Once three risk cards are reviewed, this task can mint its own badge for the current wallet account.
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
                                ? 'Mint risk task badge'
                                : 'Review 3 cards first'}
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
                        <option value="tslax">TSLAX wrapper product</option>
                        <option value="msxq1">MSXQ1 managed product</option>
                        <option value="ousg">OUSG treasury product</option>
                      </select>
                    </label>
                    <div className="env-hint">
                      <strong>{quizProduct.ticker}</strong> {quizProduct.summary}
                    </div>
                    <label>
                      What does the user actually own here?
                      <select value={quizAnswers.owns} onChange={(event) => handleQuizChange('owns', event.target.value)}>
                        <option value="">Select one answer</option>
                        <option value="wrapper-rights">A wrapped product with specific access and disclosure limits</option>
                        <option value="bank-deposit">A bank deposit with principal protection</option>
                        <option value="guaranteed-upside">A guaranteed upside note with no downside</option>
                      </select>
                    </label>
                    <label>
                      What is the clearest downside to explain?
                      <select value={quizAnswers.downside} onChange={(event) => handleQuizChange('downside', event.target.value)}>
                        <option value="">Select one answer</option>
                        <option value="single-name-downside">Drawdown, access limits, or liquidity friction can still happen</option>
                        <option value="no-risk">There is basically no risk once tokenized</option>
                        <option value="only-gas">Gas fees are the only real risk</option>
                      </select>
                    </label>
                    <button className="secondary-btn" onClick={handleQuizSubmit} disabled={!quizAnswers.owns || !quizAnswers.downside}>
                      {quizTaskBadgeMinted ? 'Quiz completed' : quizTaskDone ? 'Quiz passed, mint badge' : 'Submit product quiz'}
                    </button>
                    {quizSubmitted ? (
                      <div className={`env-hint ${quizPassed ? '' : 'quiz-error'}`}>
                        <strong>{quizPassed ? 'Correct framing.' : 'Try again.'}</strong>{' '}
                        {quizPassed
                          ? 'The right answer is to explain what rights the wrapper gives and what downside or access limits still exist.'
                          : 'For beginner-safe framing, the user should understand that wrapper products are not bank deposits and can still have downside, access limits, or liquidity friction.'}
                      </div>
                    ) : null}
                    <div className="mint-action-box inline-mint-action task-badge-mint-box">
                      <div>
                        <div className="product-title">Mint quiz task badge</div>
                        <div className="muted">
                          After the ownership-and-downside quiz is passed, this module can mint its own task badge for the connected wallet.
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
                                ? 'Mint quiz task badge'
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
                        This module should only open after the three prerequisite onboarding tasks are finished. When all three are done, this task can mint its own badge.
                      </div>
                    </div>
                    <span className={`pill ${paperTaskBadgeMinted ? 'risk-low' : paperTradingUnlocked ? 'risk-low' : 'risk-medium'}`}>
                      {paperTaskBadgeMinted ? 'Completed' : paperTradingUnlocked ? 'Wait to be minted' : `${completedBoxes}/3 completed`}
                    </span>
                  </div>

                  <div className="quest-panel-title" style={{ marginTop: 18 }}>Required before paper trading</div>
                  <div className="checklist-list">
                    {[
                      {
                        id: 'wallet',
                        label: 'Step 1: Connect wallet',
                        done: walletQuestDone,
                        helper: walletQuestDone ? 'Wallet connection is already finished for this account.' : 'Complete the real MetaMask connection flow first.'
                      },
                      {
                        id: 'mint',
                        label: 'Step 2: Mint welcome badge',
                        done: welcomeGateCompleted,
                        helper: welcomeGateCompleted
                          ? badgeContractConfigured
                            ? 'The welcome badge has already been minted on Sepolia.'
                            : 'This deployment uses the connected wallet as the demo welcome gate.'
                          : 'Submit the welcome badge mint before paper trading unlocks.'
                      },
                      {
                        id: 'risk',
                        label: 'Step 3: Read risk cards',
                        done: riskTaskDone,
                        helper: riskTaskDone ? 'The risk-card review task is already complete for this wallet.' : 'Open any 3 starter risk cards before opening paper trading.'
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
                      <div className="product-title">Mint paper trading preview badge</div>
                      <div className="muted">
                        {paperTaskBadgeMinted
                          ? 'This wallet already minted the paper trading preview badge.'
                          : paperTradingUnlocked
                            ? 'All three prerequisite tasks are complete. You can now mint the paper trading preview badge for this wallet.'
                            : 'Finish the three prerequisite tasks above first, then mint the paper trading preview badge.'}
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
                              ? 'Mint paper trading badge'
                              : 'Finish 3 tasks first'}
                      </button>
                    </div>
                  </div>

                  {paperTradingUnlocked ? (
                    <div className="mint-action-box inline-mint-action task-badge-mint-box">
                      <div>
                        <div className="product-title">Open paper trading</div>
                        <div className="muted">
                          The prerequisite tasks are done, so the simulation page is now unlocked for this wallet.
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
                <h2>Starter products for a cleaner first touchpoint</h2>
              </div>
            </div>
            <div className="product-grid">
              {products.map((product) => (
                <div className="product-card" key={product.id}>
                  <div className="product-top">
                    <div>
                      <div className="product-title">{product.ticker}</div>
                      <div className="muted">{product.name}</div>
                    </div>
                    <span className={`pill ${riskClass(product.risk)}`}>{product.risk}</span>
                  </div>
                  <div className="muted">{product.summary}</div>
                  <div className="kv">
                    <div>
                      <div className="k">Best for</div>
                      <div className="v">{product.useCase}</div>
                    </div>
                    <div>
                      <div className="k">Beginner fit</div>
                      <div className="v">{product.beginnerFit}</div>
                    </div>
                    <div>
                      <div className="k">Source of return</div>
                      <div className="v">{product.sourceOfReturn}</div>
                    </div>
                    <div>
                      <div className="k">Worst case</div>
                      <div className="v">{product.worstCase}</div>
                    </div>
                  </div>
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
            <div className="entry-grid">
              <div className="entry-card active">
                <div className="entry-title">Goal-first product routing</div>
                <div className="entry-copy">Start from the user goal like stable yield, steadier principal, or buy-lower exposure, then reveal the product structure only after the fit is clear.</div>
              </div>
              <div className="entry-card active">
                <div className="entry-title">Tokenized share receipts</div>
                <div className="entry-copy">Subscriptions now map to wallet-linked share tokens, so the wealth page can show ownership, redemption rights, and future reward or gating logic.</div>
              </div>
              <div className="entry-card active">
                <div className="entry-title">AI diligence and compliance layer</div>
                <div className="entry-copy">Each shelf can explain its underlying assets, source of return, eligibility, liquidity stress, and automation policy instead of hiding behind APY alone.</div>
              </div>
            </div>
            <div className="toolbar" style={{ marginTop: 14 }}>
              <a className="primary-btn" href="./wealth.html" onClick={() => setAnalyticsSnapshot(trackAnalytics('wealth_hub_open'))}>Open wealth hub</a>
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
                        ? 'The user can now enter simulation mode and test products before any live-style action.'
                        : 'This module is visible now as a replay-first practice layer under discovery.'}
                    </div>
                  </div>
                  <span className={`pill ${paperTradingUnlocked ? 'risk-low' : 'risk-medium'}`}>
                    {paperTradingUnlocked ? 'Unlocked' : 'Preview'}
                  </span>
                </div>
                <div className="paper-balance-strip">
                  <div className="paper-balance-box">
                    <div className="label">Remaining tokens</div>
                    <div className="value">{paperTokenBalance.toLocaleString()} PT</div>
                  </div>
                  <div className="paper-balance-box">
                    <div className="label">Reward per badge</div>
                    <div className="value">+{BADGE_REWARD_TOKENS} PT</div>
                  </div>
                  <div className="paper-balance-box">
                    <div className="label">Minimum trade size</div>
                    <div className="value">{MIN_PAPER_TRADE} PT</div>
                  </div>
                </div>
                <div className="entry-grid">
                  <div className="entry-card active">
                    <div className="entry-title">Starter simulation</div>
                    <div className="entry-copy">Practice with treasury-style or managed products before using any live wallet flow. Badge rewards increase the available simulation budget.</div>
                  </div>
                  {!riskTaskDone ? (
                    <div className="entry-card active">
                      <div className="entry-title">Product comparison mode</div>
                      <div className="entry-copy">Compare downside, expected return source, and suitability before opening a real market venue.</div>
                    </div>
                  ) : (
                    <div className="entry-card active">
                      <div className="entry-title">Risk cards already reviewed</div>
                      <div className="entry-copy">This wallet already completed the risk-card prerequisite, so paper trading can focus on actual simulation instead of first-pass education.</div>
                    </div>
                  )}
                </div>
                  <div className="toolbar" style={{ marginTop: 14 }}>
                    {paperTradingUnlocked ? (
                      <a className="primary-btn" href="./paper-trading.html" onClick={() => setAnalyticsSnapshot(trackAnalytics('paper_trading_page_open'))}>Open replay lab</a>
                    ) : (
                      <button className="secondary-btn" disabled>Finish wallet tutorial to unlock</button>
                    )}
                  </div>
                  <div className="mint-action-box inline-mint-action task-badge-mint-box">
                    <div>
                      <div className="product-title">Mint paper trading task badge</div>
                      <div className="muted">
                        After the three onboarding prerequisites are finished, this paper trading preview can mint its own badge for the current wallet.
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
                              ? 'Mint paper task badge'
                              : 'Finish wallet tutorial first'}
                      </button>
                    </div>
                  </div>
                {paperTradingLockedByTutorial ? (
                  <div className="paper-lock-note">
                    Complete the wallet tutorial first. Skip? <a href="./paper-trading.html">Open the preview page</a>.
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="card" id="walletNickname">
            <div className="section-head">
              <div>
                <div className="eyebrow">Wallet nickname</div>
                <h2>Edit the local display name for this wallet</h2>
              </div>
            </div>
            {isConnected ? (
              <div className="wallet-nickname-editor">
                <div className="env-hint">
                  <strong>Current label.</strong> {walletDisplayName}
                </div>
                <label className="wallet-nickname-label">
                  Nickname
                  <input
                    value={walletNicknameDraft}
                    onChange={(event) => setWalletNicknameDraft(event.target.value.slice(0, WALLET_NICKNAME_MAX_LENGTH))}
                    placeholder="Give this wallet a short name"
                    maxLength={WALLET_NICKNAME_MAX_LENGTH}
                  />
                </label>
                <div className="wallet-nickname-help">
                  This nickname is stored locally on this device and replaces the short wallet address across the MSX demo.
                </div>
                <div className="toolbar">
                  <button className="secondary-btn" onClick={handleSaveWalletNickname}>
                    Save nickname
                  </button>
                  <button className="ghost-btn" onClick={() => {
                    setWalletNicknameDraft('');
                    const clearedNickname = writeWalletNickname(address, '');
                    setWalletNickname(clearedNickname);
                    setWalletNicknameFeedback('Nickname cleared. The short wallet address will show again.');
                  }}>
                    Clear nickname
                  </button>
                </div>
                {walletNicknameFeedback ? <div className="env-hint">{walletNicknameFeedback}</div> : null}
              </div>
            ) : (
              <div className="env-hint">
                <strong>Connect first.</strong> Open MetaMask, connect a wallet, then you can save a nickname here and reuse it across the demo.
              </div>
            )}
          </section>
        </main>
      </div>

      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnect={handleConnect}
        onDisconnect={() => disconnect()}
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
      />

      {devModeOpen ? (
        <div className="wallet-modal-backdrop" onClick={(event) => event.target === event.currentTarget && setDevModeOpen(false)}>
          <div className="wallet-modal developer-modal">
            <button className="wallet-modal-close" onClick={() => setDevModeOpen(false)} aria-label="Close developer mode">
              X
            </button>
            <div className="wallet-modal-pane wallet-modal-sidebar">
              <div className="wallet-modal-title">Developer Mode</div>
              <div className="wallet-modal-subtitle">Analytics panel</div>
              <div className="wallet-install-copy">
                Inspect click-through activity across key welcome-page modules. This is protected by a simple developer login.
              </div>
            </div>
            <div className="wallet-modal-pane wallet-modal-main developer-modal-main">
              {!devModeAuthed ? (
                <div className="developer-auth-form">
                  <div className="wallet-modal-status">Developer sign in</div>
                  <div className="env-hint">
                    Demo-only admin access. Credentials are shown here on purpose for local review: username <strong>{DEV_MODE_USERNAME}</strong>, password <strong>{DEV_MODE_PASSWORD}</strong>.
                  </div>
                  <label>
                    Username
                    <input value={devModeUsername} onChange={(event) => setDevModeUsername(event.target.value)} />
                  </label>
                  <label>
                    Password
                    <input type="text" value={devModePassword} onChange={(event) => setDevModePassword(event.target.value)} />
                  </label>
                  <button className="primary-btn" onClick={handleDeveloperLogin}>
                    Open admin controls
                  </button>
                  {devModeError ? <div className="env-hint">{devModeError}</div> : null}
                </div>
              ) : (
                <div className="developer-analytics">
                  <div className="wallet-modal-status">Admin controls</div>
                  <div className="paper-balance-strip">
                    <div className="paper-balance-box">
                      <div className="label">Tracked clicks</div>
                      <div className="value">{analyticsSnapshot.total}</div>
                    </div>
                    <div className="paper-balance-box">
                      <div className="label">Auth mode</div>
                      <div className="value">Local demo auth</div>
                    </div>
                    <div className="paper-balance-box">
                      <div className="label">Active wallet</div>
                      <div className="value">{isConnected ? walletDisplayName : 'Not connected'}</div>
                    </div>
                  </div>
                  <div className="developer-admin-grid">
                    <div className="developer-admin-card">
                      <div>
                        <div className="eyebrow">Feature override</div>
                        <div className="wealth-profile-storage-title">Enable all local onboarding and replay gates</div>
                        <div className="muted">
                          Writes completed guide, quiz, paper unlock, and admin override progress for the connected wallet. Onchain badge minting still remains a real Sepolia action.
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
                  {devModeNotice ? <div className="env-hint">{devModeNotice}</div> : null}
                  {devModeError ? <div className="env-hint quiz-error">{devModeError}</div> : null}
                  <div className="wallet-modal-status">Module click-through</div>
                  <div className="developer-table-wrap">
                    <table className="developer-table">
                      <thead>
                        <tr>
                          <th>Module</th>
                          <th>Clicks</th>
                          <th>CTR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(analyticsSnapshot.events || {})
                          .sort((a, b) => b[1] - a[1])
                          .map(([name, count]) => (
                            <tr key={name}>
                              <td>{name}</td>
                              <td>{count}</td>
                              <td>{analyticsSnapshot.total ? `${((count / analyticsSnapshot.total) * 100).toFixed(1)}%` : '0%'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
