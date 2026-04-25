const products = [
  {
    id: 'ousg',
    ticker: 'OUSG',
    name: 'Ondo Short-Term US Government Treasuries',
    group: 'Yield / Treasury',
    goal: ['capital', 'income', 'learn'],
    risk: 'Low',
    complexity: 'Low',
    platform: 'Ondo',
    useCase: 'Stable reserve and simple first RWA explanation',
    summary: 'A treasury-style onchain product that is easier for Web2 users to understand than tokenized stock wrappers.',
    whyStart: 'It gives MSX a low-drama starter card: a product that looks more like digital cash management than a trading bet.',
    sourceOfReturn: 'Short-duration treasury yield.',
    worstCase: 'Yield declines, access is gated, or liquidity becomes less convenient than expected.',
    whoFor: 'First-time users asking for something closer to a savings product than a volatile market trade.',
    beginnerFit: 'Strong',
    score: { structure: 84, transparency: 82, market: 78, access: 66, suitability: 88 },
    market: { pricingGap: 0.08, stress: 18, pulse: '+0.02 today' },
    scenario: { bull: 1058, base: 1042, stress: 997 },
    tags: ['Starter', 'Yield', 'Treasury-backed'],
    learnNote: 'Best for demonstrating how MSX can onboard Web2 users with a simpler product story.'
  },
  {
    id: 'usdy',
    ticker: 'USDY',
    name: 'Ondo USDY',
    group: 'Yield / Treasury',
    goal: ['income', 'learn'],
    risk: 'Low',
    complexity: 'Medium',
    platform: 'Ondo',
    useCase: 'Steady yield for users who are not chasing equity upside',
    summary: 'Feels closer to a wealth product than a raw DeFi strategy, but still needs eligibility and disclosure framing.',
    whyStart: 'It helps explain that not every RWA product is a stock. Some are income-like and easier to position in a starter funnel.',
    sourceOfReturn: 'Short-duration U.S. asset yield.',
    worstCase: 'Eligibility limits, lower yield than expected, or secondary liquidity friction.',
    whoFor: 'Users asking what their stablecoins can do without taking on wild volatility.',
    beginnerFit: 'Good',
    score: { structure: 78, transparency: 76, market: 74, access: 63, suitability: 84 },
    market: { pricingGap: 0.12, stress: 24, pulse: '+0.01 today' },
    scenario: { bull: 1070, base: 1050, stress: 990 },
    tags: ['Income', 'Bridge product', 'Eligibility matters'],
    learnNote: 'Useful bridge between stablecoins and “real investing” for new users.'
  },
  {
    id: 'buidl',
    ticker: 'BUIDL',
    name: 'BlackRock BUIDL',
    group: 'Yield / Treasury',
    goal: ['capital', 'income'],
    risk: 'Low',
    complexity: 'Medium',
    platform: 'Securitize / BlackRock',
    useCase: 'Institutional-grade credibility anchor',
    summary: 'Strong trust signal and brand recognition, though the user journey is still not self-explanatory.',
    whyStart: 'This is the kind of product that gives a discovery page credibility, even if not every retail user can access it directly.',
    sourceOfReturn: 'Cash-management and government securities yield.',
    worstCase: 'Restricted access, lower flexibility, or users assuming brand equals zero risk.',
    whoFor: 'Users who care more about issuer quality than about open-ended experimentation.',
    beginnerFit: 'Moderate',
    score: { structure: 86, transparency: 85, market: 81, access: 58, suitability: 79 },
    market: { pricingGap: 0.03, stress: 14, pulse: 'flat' },
    scenario: { bull: 1050, base: 1040, stress: 998 },
    tags: ['Institutional', 'Treasury', 'Brand trust'],
    learnNote: 'A strong credibility anchor, but not the only product users should see.'
  },
  {
    id: 'msxq1',
    ticker: 'MSXQ1',
    name: 'MSX Quant AI Fund #1',
    group: 'Platform Wealth Product',
    goal: ['income', 'learn'],
    risk: 'Medium',
    complexity: 'Low',
    platform: 'MSX Finance',
    useCase: 'Simple on-platform wealth entry for users who prefer a managed strategy',
    summary: 'This is where explanation matters most: users need plain-language strategy cards, expected downside, and who the product fits.',
    whyStart: 'MSX can own this page design directly because it controls the distribution surface and can improve how products are framed.',
    sourceOfReturn: 'Systematic strategy performance and market regime fit.',
    worstCase: 'Model underperformance, drawdowns, or unclear return expectations.',
    whoFor: 'Users who want “pick for me” instead of comparing wrappers manually.',
    beginnerFit: 'Needs stronger disclosure',
    score: { structure: 61, transparency: 49, market: 57, access: 75, suitability: 71 },
    market: { pricingGap: 0.0, stress: 42, pulse: 'strategy NAV pending' },
    scenario: { bull: 1120, base: 1060, stress: 920 },
    tags: ['MSX-owned UX', 'Needs explainer', 'Fund-like'],
    learnNote: 'High-priority redesign target for MSX because it can be improved without changing the core exchange.'
  },
  {
    id: 'benji',
    ticker: 'BENJI',
    name: 'Franklin Templeton BENJI',
    group: 'Yield / Treasury',
    goal: ['capital', 'income', 'learn'],
    risk: 'Low',
    complexity: 'Medium',
    platform: 'Franklin Templeton',
    useCase: 'A regulated-fund-style anchor product',
    summary: 'A useful comparator card for showing how traditional fund structures can be packaged into tokenized distribution.',
    whyStart: 'Helps users understand that some RWA products resemble familiar fund experiences more than crypto speculation.',
    sourceOfReturn: 'Government money market fund yield.',
    worstCase: 'Access friction or users assuming tokenization removes all fund constraints.',
    whoFor: 'Users who want familiar institutional framing and lower conceptual complexity.',
    beginnerFit: 'Good',
    score: { structure: 82, transparency: 80, market: 76, access: 59, suitability: 83 },
    market: { pricingGap: 0.04, stress: 17, pulse: '+0.01 today' },
    scenario: { bull: 1052, base: 1041, stress: 999 },
    tags: ['Fund-like', 'Regulated feel', 'Starter'],
    learnNote: 'Strong for side-by-side comparisons in the discovery page.'
  },
  {
    id: 'spyx',
    ticker: 'SPYX',
    name: 'Tokenized S&P 500 Wrapper',
    group: 'Tokenized Equity',
    goal: ['growth'],
    risk: 'Medium',
    complexity: 'High',
    platform: 'Example stock wrapper venue',
    useCase: 'Get U.S. equity upside in a crypto-native wrapper',
    summary: 'Attractive upside story, but exactly where users may confuse exposure with direct ownership.',
    whyStart: 'This is where paper trading and rights explanation start to matter a lot.',
    sourceOfReturn: 'Underlying equity moves plus wrapper mechanics.',
    worstCase: 'Large drawdown, widened spread, or misunderstanding of what rights are actually held.',
    whoFor: 'Users comfortable with market volatility and wrapper semantics.',
    beginnerFit: 'Not first pick',
    score: { structure: 54, transparency: 58, market: 60, access: 70, suitability: 46 },
    market: { pricingGap: 0.52, stress: 48, pulse: '+0.31 today' },
    scenario: { bull: 1180, base: 1065, stress: 860 },
    tags: ['Stock exposure', 'Higher volatility', 'Wrapper risk'],
    learnNote: 'Ideal for teaching why “stock token” does not automatically mean “beginner-safe”.'
  },
  {
    id: 'tslax',
    ticker: 'TSLAX',
    name: 'Tokenized Tesla Wrapper',
    group: 'Tokenized Equity',
    goal: ['growth'],
    risk: 'High',
    complexity: 'High',
    platform: 'Example exchange listing',
    useCase: 'High-beta stock upside with crypto-style accessibility',
    summary: 'A conversion magnet for risk-seeking users, but the wrong first touchpoint for a confused newcomer.',
    whyStart: 'Perfect example of why MSX should separate “popular” from “suitable”.',
    sourceOfReturn: 'Single-name equity volatility.',
    worstCase: 'Fast downside, spread shock, and event-driven misunderstanding.',
    whoFor: 'Experienced users only.',
    beginnerFit: 'Poor',
    score: { structure: 46, transparency: 53, market: 51, access: 68, suitability: 30 },
    market: { pricingGap: 0.68, stress: 61, pulse: '+0.42 today' },
    scenario: { bull: 1280, base: 1080, stress: 760 },
    tags: ['Single stock', 'Event risk', 'Not beginner friendly'],
    learnNote: 'A good paper-trading demo asset and a bad starter recommendation.'
  }
];

const quests = [
  { title: 'Connect wallet or create email wallet', copy: 'Give users an identity step that unlocks rewards and paper trading without dropping them into expert mode.', points: 50, reward: 'Starter badge' },
  { title: 'Read 3 plain-language risk cards', copy: 'Explain tokenized stock, treasury yield, and strategy/fund products in under one minute.', points: 30, reward: 'Risk unlock' },
  { title: 'Finish one product quiz', copy: 'Ask what a user really owns and what can go wrong in a wrapper product.', points: 40, reward: 'Fee coupon' },
  { title: 'Complete one paper trade', copy: 'Simulate a trade before live leverage or complex products are shown.', points: 60, reward: 'Portfolio XP' },
  { title: 'Graduate to live mode', copy: 'Only after the basics do you route the user toward the real venue.', points: 100, reward: 'Starter pack' }
];

const painPointGuides = {
  newbie: {
    title: 'Start as a beginner, not as a trader',
    copy: 'We first explain what each product is for, then show 1,000 USDT example outcomes, and only after that send users into paper trading. The goal is to help a Web2 user form a mental model before they see live market complexity.',
    nextStep: 'Open the dual-entry onboarding path, then review 2 starter products before touching live markets.',
    module: 'Welcome -> Discover -> Paper Trading'
  },
  contracts: {
    title: 'We translate contracts into plain-language rights',
    copy: 'Instead of dropping users into contract jargon, the analyzer explains what they actually hold, where return comes from, and what can go wrong. This is where we can later layer in AI answers tied to product rights and wrapper structure.',
    nextStep: 'Use the analyzer to compare rights, structure, and downside before selecting a product.',
    module: 'Analyzer + Selected Card'
  },
  risk: {
    title: 'Safer for beginners means lower complexity and clearer downside',
    copy: 'The discovery cards are designed to answer suitability first: who this is for, what powers the return, and what the worst case looks like. Products like treasury-style RWAs should surface before tokenized single-stock exposure.',
    nextStep: 'Filter by low risk or learning goals, then inspect beginner-friendly cards first.',
    module: 'Discover + Risk Filters'
  },
  paper: {
    title: 'Practice the click path before using real money',
    copy: 'The demo already includes a paper lab so users can simulate a 12-month outcome and feel the difference between yield products and stock wrappers. That is the right place to teach actions and consequences before a live handoff.',
    nextStep: 'Run one guided simulation with 1,000 USDT before any live product is promoted.',
    module: 'Paper Trading'
  }
};

let userMode = 'web2';
let currentId = 'ousg';
let paperBalance = 10000;
let lastMemoText = '';
let walletConnected = false;
let walletAddress = '';
let walletConnecting = false;
let walletProvider = null;
let walletModalOpen = false;
let walletChainId = '';

function isLocalhostLike() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function isFileProtocol() {
  return window.location.protocol === 'file:';
}

function clsRisk(risk) {
  return risk === 'Low' ? 'risk-low' : risk === 'Medium' ? 'risk-medium' : 'risk-high';
}

function overallScore(product) {
  return Math.round((product.score.structure + product.score.transparency + product.score.market + product.score.access + product.score.suitability) / 5);
}

function el(id) { return document.getElementById(id); }

function shortAddress() {
  if (!walletAddress) return 'Not connected';
  return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
}

function shortChainName(chainId) {
  const chainMap = {
    '0x1': 'Ethereum',
    '0xaa36a7': 'Sepolia',
    '0x89': 'Polygon',
    '0xa': 'Optimism',
    '0x2105': 'Base',
    '0x38': 'BSC',
    '0x539': 'Localhost'
  };
  return chainMap[chainId] || (chainId ? `Chain ${chainId}` : 'No network');
}

function getMetaMaskProvider() {
  if (typeof window === 'undefined') return null;
  const injected = window.ethereum;
  if (!injected) return null;

  if (Array.isArray(injected.providers) && injected.providers.length) {
    return injected.providers.find(provider => provider && provider.isMetaMask)
      || injected.providers[0]
      || null;
  }

  return injected;
}

function openWalletModal() {
  walletModalOpen = true;
  el('walletModalBackdrop')?.classList.remove('hidden');
  renderWalletModal();
}

function closeWalletModal() {
  walletModalOpen = false;
  el('walletModalBackdrop')?.classList.add('hidden');
}

function requestWalletFromWelcome() {
  openWalletModal();
  if (!walletConnected && !walletConnecting) {
    connectWallet();
  }
}

function renderWalletModal() {
  const option = el('metamaskOption');
  const optionCopy = el('metamaskOptionCopy');
  const status = el('walletModalStatus');
  const copy = el('walletModalCopy');
  const spinner = el('walletModalSpinner');
  if (!option || !optionCopy || !status || !copy || !spinner) return;

  walletProvider = getMetaMaskProvider();
  const installed = !!walletProvider;
  option.classList.toggle('disabled', false);
  option.disabled = walletConnecting;
  optionCopy.textContent = walletConnected
    ? 'Connected in browser'
    : installed
    ? walletConnecting
      ? 'Opening extension'
      : 'Ready to connect'
    : 'Open extension or MetaMask app';

  if (walletConnected) {
    status.textContent = 'Wallet connected';
    copy.textContent = `Connected address: ${shortAddress()}. Network: ${shortChainName(walletChainId)}. You can close this dialog and continue onboarding.`;
    spinner.classList.add('hidden');
    return;
  }

  if (walletConnecting) {
    status.textContent = 'Opening MetaMask...';
    copy.textContent = 'Confirm the connection in the MetaMask extension or app. After approval, the MSX welcome page will switch to connected state.';
    spinner.classList.remove('hidden');
    return;
  }

  status.textContent = 'Connect with MetaMask';
  copy.textContent = 'Select MetaMask to trigger a real wallet connection request. The approval step happens in the wallet, then this page updates automatically.';
  spinner.classList.add('hidden');
}

function renderHero() {
  const starterCount = products.filter(p => p.beginnerFit === 'Strong' || p.beginnerFit === 'Good').length;
  el('heroMetrics').innerHTML = `
    <div class="metric-card"><div class="label">Starter products in demo</div><div class="value">${starterCount}</div></div>
    <div class="metric-card"><div class="label">Quest steps before live mode</div><div class="value">${quests.length}</div></div>
    <div class="metric-card"><div class="label">Starter path</div><div class="value">3 steps</div></div>
    <div class="metric-card"><div class="label">What users get</div><div class="value">Answers first</div></div>
  `;
}

function renderOverview() {
  const items = [
    ['What MSX already has', 'Trading venue, tokenized stock story, stablecoin-based access, and a small wealth-products shelf.'],
    ['What feels missing', 'Beginner routing, suitability, paper mode, clearer product cards, and listing-side risk framing.'],
    ['Why users struggle', 'A Web2 user does not want to classify wrappers. They want a recommendation and a reason.'],
    ['What this demo adds', 'A guided funnel before trading: learn, simulate, compare, then go live.']
  ];
  el('overview').innerHTML = items.map(([label, value]) => `
    <div class="insight-card">
      <div class="label">${label}</div>
      <div class="value" style="font-size:18px;line-height:1.45">${value}</div>
    </div>
  `).join('');
}

function renderWalletState() {
  el('walletAddress').textContent = walletConnected ? shortAddress() : 'Not connected';
  el('walletBadges').innerHTML = walletConnected
    ? `<span class="badge">Quest active</span><span class="badge">${shortChainName(walletChainId)}</span>`
    : walletConnecting
      ? '<span class="badge">MetaMask prompt open</span><span class="badge">Waiting for approval</span>'
      : '<span class="badge">Connect MetaMask</span><span class="badge">Paper mode available</span>';

  const button = el('connectWalletBtn');
  button.disabled = walletConnecting;
  button.innerHTML = walletConnected
    ? `Wallet connected ${shortAddress()}`
    : walletConnecting
      ? '<span class="btn-spinner" aria-hidden="true"></span><span>Connecting to MetaMask...</span>'
      : 'Connect MetaMask';
  renderWalletModal();
}

function renderWalletEnvironmentHint() {
  const hint = el('walletEnvHint');
  if (!hint) return;

  if (walletConnected) {
    hint.innerHTML = '<strong>Wallet ready.</strong> You can now treat this as the authenticated onboarding state and continue into Discover or Paper Trading.';
    return;
  }

  if (isFileProtocol()) {
    hint.innerHTML = '<strong>Recommended:</strong> open this demo through <code>http://localhost:4173</code> instead of directly opening the HTML file. MetaMask connections are more reliable in a local web-server environment.';
    return;
  }

  if (isLocalhostLike()) {
    hint.innerHTML = '<strong>Localhost mode detected.</strong> This is the right environment for testing MetaMask connection and onboarding state changes.';
    return;
  }

  hint.innerHTML = '<strong>Browser environment detected.</strong> If wallet connection hangs, switch to a localhost-served version of the demo so MetaMask can attach more reliably.';
}

function renderPainPointGuide() {
  const key = el('painPointSelect')?.value || 'newbie';
  const guide = painPointGuides[key];
  if (!guide) return;

  el('guideAnswer').innerHTML = `
    <div class="guide-title">${guide.title}</div>
    <div class="guide-copy">${guide.copy}</div>
    <div class="guide-next">
      <div class="guide-chip">
        <div class="k">Recommended next step</div>
        <div class="v">${guide.nextStep}</div>
      </div>
      <div class="guide-chip">
        <div class="k">Best module to open</div>
        <div class="v">${guide.module}</div>
      </div>
    </div>
  `;
}

async function syncWalletState() {
  walletProvider = getMetaMaskProvider();
  if (!walletProvider) {
    walletConnected = false;
    walletAddress = '';
    walletConnecting = false;
    renderWalletState();
    renderWalletEnvironmentHint();
    el('walletBadges').innerHTML = '<span class="badge">MetaMask required</span><span class="badge">Open with browser extension</span>';
    return;
  }

  try {
    const accounts = await walletProvider.request({ method: 'eth_accounts' });
    walletChainId = await walletProvider.request({ method: 'eth_chainId' }).catch(() => '');
    walletConnected = accounts.length > 0;
    walletAddress = accounts[0] || '';
    walletConnecting = false;
    renderWalletState();
    renderWalletEnvironmentHint();
  } catch (error) {
    walletConnected = false;
    walletAddress = '';
    walletConnecting = false;
    renderWalletState();
    renderWalletEnvironmentHint();
  }
}

async function connectWallet() {
  if (walletConnecting || walletConnected) {
    return;
  }

  walletProvider = getMetaMaskProvider();
  let timeoutId = null;
  try {
    walletConnecting = true;
    renderWalletState();
    renderWalletEnvironmentHint();
    timeoutId = window.setTimeout(() => {
      walletConnecting = false;
      renderWalletState();
      renderWalletEnvironmentHint();
      el('walletBadges').innerHTML = '<span class="badge">Approval still pending</span><span class="badge">Check the MetaMask popup</span>';
    }, 15000);

    if (!walletProvider || typeof walletProvider.request !== 'function') {
      throw new Error('METAMASK_UNAVAILABLE');
    }
    const accounts = await walletProvider.request({ method: 'eth_requestAccounts' });
    walletChainId = await walletProvider.request({ method: 'eth_chainId' }).catch(() => '');
    window.clearTimeout(timeoutId);
    walletConnected = accounts.length > 0;
    walletAddress = accounts[0] || '';
    walletConnecting = false;
    renderWalletState();
    renderWalletEnvironmentHint();
    el('walletBadges').innerHTML = '<span class="badge">Wallet connected</span><span class="badge">MetaMask active</span>';
    closeWalletModal();
  } catch (error) {
    if (timeoutId) window.clearTimeout(timeoutId);
    walletConnected = false;
    walletAddress = '';
    walletConnecting = false;
    renderWalletState();
    renderWalletEnvironmentHint();
    renderWalletModal();
    const isPending = error && (error.code === -32002 || String(error.message || '').toLowerCase().includes('already pending'));
    const isRejected = error && error.code === 4001;
    const isUnavailable = error && String(error.message || '').includes('METAMASK_UNAVAILABLE');
    el('walletBadges').innerHTML = isPending
      ? '<span class="badge">MetaMask already open</span><span class="badge">Finish approval in extension</span>'
      : isRejected
        ? '<span class="badge">Connection rejected</span><span class="badge">Try again when ready</span>'
        : isUnavailable
          ? '<span class="badge">Open MetaMask</span><span class="badge">Approve from extension or app</span>'
          : '<span class="badge">Connection failed</span><span class="badge">Check MetaMask and site permissions</span>';

    if (isPending) {
      el('walletModalStatus').textContent = 'MetaMask request already open';
      el('walletModalCopy').textContent = 'A wallet approval request is already waiting inside MetaMask. Approve it there, and the MSX page will update automatically.';
    } else if (isRejected) {
      el('walletModalStatus').textContent = 'Connection was rejected';
      el('walletModalCopy').textContent = 'The wallet request reached MetaMask, but approval was rejected. Click MetaMask again whenever you want to retry.';
    } else if (isUnavailable) {
      el('walletModalStatus').textContent = 'Open MetaMask to continue';
      el('walletModalCopy').textContent = 'If you are on desktop, make sure the MetaMask extension is enabled for this browser. If you are on mobile, we tried to hand off to the MetaMask app.';
    }
  }
}

function renderMode() {
  const out = userMode === 'web2'
    ? `<strong>Web2 path:</strong> explain the opportunity in three sentences, recommend a few starter products, force one paper trade, then unlock the live venue. This keeps MSX from throwing stablecoins, leverage, and token mechanics at a user all at once.`
    : `<strong>Web3 path:</strong> skip the tutorial layer and go directly to product search, watchlists, and new listing surveillance. Same engine, fewer explanations.`;
  el('modeOutput').innerHTML = out;
  document.querySelectorAll('[data-user-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.userMode === userMode));
}

function renderQuests() {
  el('questList').innerHTML = quests.map(q => `
    <div class="quest-card">
      <div>
        <div class="product-title">${q.title}</div>
        <div class="muted">${q.copy}</div>
        <div class="quest-meta"><span class="badge">${q.reward}</span></div>
      </div>
      <div class="quest-points">+${q.points} pts</div>
    </div>
  `).join('');
}

function renderStarterReasons() {
  const reasons = [
    ['Start with purpose, not wrappers', 'Show “steady income”, “low complexity”, or “learn first” before chains and legal semantics.'],
    ['Paper first, live later', 'Tokenized equities and leverage should be earned through guided steps, not shown immediately.'],
    ['Use wealth-style cards', 'Users want a grade, a reason, and an example 1,000 USDT outcome instead of a wall of jargon.'],
    ['Upgrade MSX Finance pages', 'Strategy labels alone do not build trust. Product cards need fit, downside, and disclosure.']
  ];
  el('starterReasons').innerHTML = reasons.map(([t, b]) => `
    <div class="reason-card">
      <div class="product-title">${t}</div>
      <div class="muted">${b}</div>
    </div>
  `).join('');
}

function filteredProducts() {
  const goal = el('goalFilter')?.value || 'all';
  const risk = el('riskFilter')?.value || 'all';
  return products.filter(p => (goal === 'all' || p.goal.includes(goal)) && (risk === 'all' || p.risk === risk));
}

function renderProducts() {
  el('productGrid').innerHTML = filteredProducts().map(p => `
    <div class="product-card">
      <div class="product-top">
        <div>
          <div class="product-title">${p.ticker}</div>
          <div class="muted">${p.name}</div>
        </div>
        <span class="pill ${clsRisk(p.risk)}">${p.risk}</span>
      </div>
      <div class="badge-row">${p.tags.map(t => `<span class="badge">${t}</span>`).join('')}</div>
      <div class="muted">${p.summary}</div>
      <div class="kv">
        <div><div class="k">Best for</div><div class="v">${p.useCase}</div></div>
        <div><div class="k">Beginner fit</div><div class="v">${p.beginnerFit}</div></div>
        <div><div class="k">Source of return</div><div class="v">${p.sourceOfReturn}</div></div>
        <div><div class="k">Worst case</div><div class="v">${p.worstCase}</div></div>
      </div>
      <div class="toolbar">
        <button class="secondary-btn" onclick="selectProduct('${p.id}')">View card</button>
        <button class="primary-btn" onclick="simulateFromCard('${p.id}')">Simulate 1,000 USDT</button>
      </div>
    </div>
  `).join('');
}

function renderFinderSelects() {
  const opts = products.map(p => `<option value="${p.id}">${p.ticker} — ${p.name}</option>`).join('');
  el('finderSelect').innerHTML = opts;
  el('paperAsset').innerHTML = opts;
}

function findProduct(input) {
  const q = (input || '').trim().toLowerCase();
  return products.find(p => [p.id, p.ticker, p.name].some(v => v.toLowerCase().includes(q))) || products[0];
}

function renderAnalysis(product) {
  currentId = product.id;
  const score = overallScore(product);
  const bucket = score >= 75 ? 'Low' : score >= 55 ? 'Medium' : 'High';
  const memo = `${product.ticker} scores ${score}/100, which maps to ${bucket} risk for a retail-friendly MSX discovery layer. The core reason is ${product.whyStart.toLowerCase()} Source of return: ${product.sourceOfReturn} Biggest caution: ${product.worstCase}`;
  lastMemoText = memo;

  el('finderInput').value = product.ticker;
  el('finderSelect').value = product.id;
  el('productSummary').innerHTML = `
    <div class="product-top">
      <div>
        <div class="product-title">${product.ticker} — ${product.name}</div>
        <div class="muted">${product.group} · ${product.platform} · ${product.useCase}</div>
      </div>
      <span class="pill ${clsRisk(bucket)}">${bucket} risk · ${score}/100</span>
    </div>
    <div class="muted">${memo}</div>
  `;
  el('productScoreGrid').innerHTML = Object.entries(product.score).map(([k, v]) => `
    <div class="assessment-card"><div class="score">${v}</div><div class="label">${k}</div></div>
  `).join('');
  el('productDrivers').innerHTML = [
    `Why it exists for users: ${product.useCase}`,
    `Why it may work: ${product.sourceOfReturn}`,
    `Why it could disappoint: ${product.worstCase}`,
    `Why MSX should position it this way: ${product.learnNote}`
  ].map(t => `<div class="driver-card">${t}</div>`).join('');
  renderDetail(product);
}

function renderWatchlist() {
  el('assetTableBody').innerHTML = products.map(p => `
    <tr onclick="selectProduct('${p.id}')">
      <td><strong>${p.ticker}</strong><br><span class="muted">${p.platform}</span></td>
      <td>${p.useCase}</td>
      <td>${p.complexity}</td>
      <td>${p.market.pricingGap.toFixed(2)}%</td>
      <td>${p.market.stress}</td>
      <td class="${clsRisk(p.risk)}"><strong>${p.risk}</strong></td>
    </tr>
  `).join('');
}

function renderDetail(product) {
  el('detailName').textContent = `${product.ticker} card`;
  el('detailRiskPill').className = `pill ${clsRisk(product.risk)}`;
  el('detailRiskPill').textContent = `${product.risk} risk`;
  el('detailContent').innerHTML = `
    <div class="detail-grid">
      <div class="detail-box"><div class="k">Use case</div><div class="v">${product.useCase}</div></div>
      <div class="detail-box"><div class="k">Who it fits</div><div class="v">${product.whoFor}</div></div>
      <div class="detail-box"><div class="k">What users earn from</div><div class="v">${product.sourceOfReturn}</div></div>
      <div class="detail-box"><div class="k">Watch item</div><div class="v">${product.worstCase}</div></div>
      <div class="detail-box"><div class="k">Pricing gap</div><div class="v">${product.market.pricingGap.toFixed(2)}%</div></div>
      <div class="detail-box"><div class="k">Market stress</div><div class="v">${product.market.stress}/100</div></div>
    </div>
    <div class="driver-card">${product.whyStart}</div>
    <div class="driver-card">Illustrative 12-month outcomes for 1,000 USDT: bull ${product.scenario.bull}, base ${product.scenario.base}, stress ${product.scenario.stress}.</div>
  `;
}

function simulatePaper() {
  const product = products.find(x => x.id === el('paperAsset').value) || products[0];
  const amount = Number(el('paperAmount').value || 0);
  const scenario = el('paperScenario').value;
  const result = product.scenario[scenario];
  const multiple = result / 1000;
  const ending = Math.round(amount * multiple);
  const pnl = ending - amount;
  el('paperOutput').innerHTML = `
    <div class="assessment-summary">
      <div class="product-top">
        <div><div class="product-title">${product.ticker} paper result</div><div class="muted">${scenario} scenario over 12 months</div></div>
        <span class="pill ${pnl >= 0 ? 'risk-low' : 'risk-high'}">${pnl >= 0 ? '+' : ''}${pnl} USDT</span>
      </div>
      <div class="muted">Starting with ${amount} USDT, this path ends near ${ending} USDT. This is an educational illustration, not a forecast or promised return.</div>
    </div>
    <div class="assessment-grid">
      <div class="assessment-card"><div class="score">${amount}</div><div class="label">Start</div></div>
      <div class="assessment-card"><div class="score">${ending}</div><div class="label">End</div></div>
      <div class="assessment-card"><div class="score">${product.market.stress}</div><div class="label">Stress meter</div></div>
      <div class="assessment-card"><div class="score">${product.market.pricingGap.toFixed(2)}%</div><div class="label">Current pricing gap</div></div>
      <div class="assessment-card"><div class="score">${overallScore(product)}</div><div class="label">Product score</div></div>
      <div class="assessment-card"><div class="score">${product.risk}</div><div class="label">Risk bucket</div></div>
    </div>
    <div class="driver-card">Main lesson: ${product.learnNote}</div>
  `;
}

function scoreIntake(formData) {
  const productType = formData.get('productType');
  const rights = { clear: 85, partial: 60, weak: 35 }[formData.get('rights')];
  const backing = { strong: 85, medium: 60, weak: 30 }[formData.get('backing')];
  const access = { gated: 72, mixed: 62, open: 55 }[formData.get('access')];
  const venue = { yes: 74, partial: 58, no: 42 }[formData.get('venue')];
  const liquidity = { strong: 80, medium: 60, weak: 35 }[formData.get('liquidity')];
  const advertisedYield = Number(formData.get('yield'));
  let promise = 80 - Math.max(0, advertisedYield - 6) * 4;
  if (productType === 'stock') promise -= 8;
  if (productType === 'hybrid') promise -= 12;
  promise = Math.max(25, Math.min(90, Math.round(promise)));
  const total = Math.round((rights + backing + access + venue + liquidity + promise) / 6);
  const bucket = total >= 75 ? 'Low' : total >= 55 ? 'Medium' : 'High';

  el('intakeSummary').innerHTML = `
    <div class="product-top">
      <div>
        <div class="product-title">New listing score</div>
        <div class="muted">${productType} product routed through intake rules</div>
      </div>
      <span class="pill ${clsRisk(bucket)}">${bucket} risk · ${total}/100</span>
    </div>
    <div class="muted">This is not legal approval. It is an exchange-side first pass on what MSX should surface confidently, gate, or explain more carefully.</div>
  `;

  el('intakeScoreGrid').innerHTML = [
    ['Rights clarity', rights],
    ['Backing proof', backing],
    ['Access design', access],
    ['Venue support', venue],
    ['Liquidity support', liquidity],
    ['Promise realism', promise]
  ].map(([k, v]) => `<div class="assessment-card"><div class="score">${v}</div><div class="label">${k}</div></div>`).join('');

  const drivers = [];
  if (rights < 60) drivers.push('Weak rights disclosure is a major red flag for retail distribution.');
  if (backing < 60) drivers.push('Reserve or backing evidence is too weak for a confidence-first launch.');
  if (advertisedYield > 12) drivers.push('A high advertised return needs stronger explanation or should trigger a warning.');
  if (venue < 60) drivers.push('Lack of major venue support should reduce trust, though not decide the case alone.');
  if (liquidity < 60) drivers.push('Poor liquidity support raises the odds of spread shocks and user frustration.');
  if (!drivers.length) drivers.push('This product looks surfaceable, but it should still enter post-listing surveillance and beginner routing rules.');
  el('intakeDrivers').innerHTML = drivers.map(t => `<div class="driver-card">${t}</div>`).join('');
}

function refreshPulse() {
  products.forEach(product => {
    const gapJitter = (Math.random() - 0.5) * (product.risk === 'Low' ? 0.04 : product.risk === 'Medium' ? 0.1 : 0.16);
    const stressJitter = Math.round((Math.random() - 0.5) * (product.risk === 'Low' ? 6 : product.risk === 'Medium' ? 10 : 14));
    product.market.pricingGap = Math.max(0, +(product.market.pricingGap + gapJitter).toFixed(2));
    product.market.stress = Math.min(95, Math.max(8, product.market.stress + stressJitter));
  });
  renderProducts();
  renderWatchlist();
  renderAnalysis(products.find(product => product.id === currentId) || products[0]);
  simulatePaper();
}

function selectProduct(id) {
  const product = products.find(x => x.id === id);
  if (product) renderAnalysis(product);
}
window.selectProduct = selectProduct;
window.simulateFromCard = function(id) {
  el('paperAsset').value = id;
  el('paperAmount').value = 1000;
  el('paperScenario').value = 'base';
  simulatePaper();
  el('paperLab').scrollIntoView({ behavior: 'smooth' });
};

function init() {
  renderHero();
  renderOverview();
  renderWalletState();
  renderWalletEnvironmentHint();
  renderPainPointGuide();
  renderMode();
  renderQuests();
  renderStarterReasons();
  renderFinderSelects();
  renderProducts();
  renderWatchlist();
  renderAnalysis(products[0]);
  simulatePaper();
  scoreIntake(new FormData(el('intakeForm')));

  document.querySelectorAll('[data-user-mode]').forEach(btn => btn.addEventListener('click', () => {
    userMode = btn.dataset.userMode;
    renderMode();
  }));

  el('goalFilter').addEventListener('change', renderProducts);
  el('riskFilter').addEventListener('change', renderProducts);
  el('painPointSelect').addEventListener('change', renderPainPointGuide);
  el('connectWalletBtn').addEventListener('click', () => {
    if (walletConnected) return;
    requestWalletFromWelcome();
  });
  el('metamaskOption').addEventListener('click', () => {
    if (walletConnected) return;
    connectWallet();
  });
  el('walletModalClose').addEventListener('click', closeWalletModal);
  el('walletModalBackdrop').addEventListener('click', e => {
    if (e.target.id === 'walletModalBackdrop' && !walletConnecting) {
      closeWalletModal();
    }
  });
  el('analyzeBtn').addEventListener('click', () => renderAnalysis(findProduct(el('finderInput').value || el('finderSelect').value)));
  el('finderSelect').addEventListener('change', e => renderAnalysis(products.find(p => p.id === e.target.value) || products[0]));
  el('runPaperTrade').addEventListener('click', simulatePaper);
  el('resetPaper').addEventListener('click', () => {
    paperBalance = 10000;
    el('paperBalance').textContent = '10,000 USDT';
    simulatePaper();
  });
  el('copyMemoBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(lastMemoText); } catch (e) {}
  });
  el('intakeForm').addEventListener('submit', e => {
    e.preventDefault();
    scoreIntake(new FormData(e.target));
  });

  syncWalletState();
  renderWalletModal();
  walletProvider = getMetaMaskProvider();
  if (walletProvider && typeof walletProvider.on === 'function') {
    walletProvider.on('accountsChanged', accounts => {
      walletConnected = accounts.length > 0;
      walletAddress = accounts[0] || '';
      walletConnecting = false;
      renderWalletState();
      renderWalletEnvironmentHint();
      renderWalletModal();
    });

    walletProvider.on('connect', () => {
      walletConnecting = false;
      renderWalletState();
      renderWalletEnvironmentHint();
      renderWalletModal();
    });

    walletProvider.on('disconnect', () => {
      walletConnected = false;
      walletAddress = '';
      walletChainId = '';
      walletConnecting = false;
      renderWalletState();
      renderWalletEnvironmentHint();
      renderWalletModal();
    });

    walletProvider.on('chainChanged', chainId => {
      walletChainId = chainId || '';
      renderWalletState();
      renderWalletEnvironmentHint();
      renderWalletModal();
    });
  }
}

init();
