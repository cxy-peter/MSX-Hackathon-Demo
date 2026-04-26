export const WEALTH_STARTING_CASH = 100000;
export const WEALTH_MILESTONE_BONUS = 5000;
export const WEALTH_MIN_SUBSCRIPTION = 500;

function buildHistory(startValue, steps) {
  const values = [];
  let current = startValue;

  for (const step of steps) {
    current = Number((current + step).toFixed(3));
    values.push(current);
  }

  return values;
}

export const GOAL_OPTIONS = [
  {
    id: 'parkCash',
    label: 'Park Cash',
    description: 'Cash & Treasury first: learn what you own, how treasury-style carry accrues, and how market-day liquidity works.',
    recommended: ['superstate-ustb', 'blackrock-buidl', 'ondo-ousg']
  },
  {
    id: 'earn',
    label: 'Earn',
    description: 'Compare yield sources, fee drag, payout sustainability, and liquidity before treating APY as take-home income.',
    recommended: ['hashnote-usyc', 'openeden-tbill', 'superstate-uscc']
  },
  {
    id: 'public',
    label: 'Pre-IPO Growth',
    description: 'Late-stage private-company exposure belongs here: allocation windows, SPV rights, transfer limits, and event-driven exits.',
    recommended: ['private-watchlist', 'spacex-secondary', 'stripe-secondary', 'bytedance-secondary']
  },
  {
    id: 'private',
    label: 'Private Watchlist',
    description: 'Track pre-IPO, SPV, late-stage private-share, and transfer-window logic without pretending it is exchange-style spot.',
    recommended: ['private-watchlist', 'spacex-secondary', 'stripe-secondary', 'databricks-secondary']
  },
  {
    id: 'auto',
    label: 'Auto / Managed',
    description: 'Use recurring buy, rebalance, alerts, yield optimizer, and risk copilot as permissioned rules layered on top of assets.',
    recommended: ['msx-quant-fund-1', 'msx-quant-fund-2', 'superstate-ustb']
  }
];

export const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All product types' },
  { id: 'cash', label: 'Cash & Treasury' },
  { id: 'public', label: 'Pre-IPO Growth' },
  { id: 'private', label: 'Private' },
  { id: 'auto', label: 'Auto / Managed' },
  { id: 'earn', label: 'Earn / Yield' }
];

function buildPrivateGrowthProduct({
  id,
  name,
  shortName,
  nav,
  theme,
  base,
  pressure,
  riskNote,
  technicalSummary,
  humanSummary
}) {
  return {
    id,
    name,
    shortName,
    bucket: 'private',
    termType: 'closed',
    goals: ['private', 'public'],
    productType: 'Pre-IPO / private-growth allocation',
    status: 'Demo watchlist / gated access route',
    liveTieIn: `${name} is modeled as a RiskLens private-growth watchlist card. It is not a live order book or a claim of current availability.`,
    risk: 'High',
    apyRange: 'No fixed yield / event-driven mark',
    annualYieldRate: 0,
    annualYieldBasis: 'No fixed payout',
    annualYieldSource: 'Secondary marks, tenders, IPO, acquisition, or transfer-window events.',
    riskNote,
    baseAsset: 'USD or USDC allocation into a permissioned SPV, secondary window, or watchlist route',
    underlying: `${name} late-stage private-company exposure, represented as gated allocation education rather than listed shares.`,
    yieldSource: 'No recurring yield. Return depends on private-market marks and liquidity events.',
    redemption: 'Transfer window, issuer event, tender, IPO, or acquisition. No continuous public exchange redemption.',
    suitableFor: 'Users who can evaluate eligibility, document rights, lockup, concentration, and exit uncertainty.',
    worstCase: 'Transfer windows close, valuations fall, documents limit rights, or no liquidity event arrives.',
    shareToken: shortName,
    nav,
    minSubscription: 2500,
    dailyYieldRate: 0,
    technicalSummary,
    humanSummary,
    scenario: {
      horizon: '270 days on 1,000 PT',
      conservative: `${Math.max(600, Math.round(base * 0.82))} PT`,
      base: `${base} PT`,
      pressure: `${pressure} PT`
    },
    navHistory: {
      '7d': buildHistory(nav, [0.03, 0.02, -0.01, 0.04, 0.01, 0, 0.03]),
      '30d': buildHistory(nav * 0.96, [0.08, 0.03, -0.04, 0.06, 0.05, -0.02, 0.04, 0.01, 0.05, -0.01]),
      '3m': buildHistory(nav * 0.91, [0.1, 0.08, -0.06, 0.12, 0.05, 0.03, -0.04, 0.11, 0.07, -0.02, 0.09, 0.04]),
      '6m': buildHistory(nav * 0.84, [0.12, 0.09, -0.11, 0.16, 0.07, 0.05, -0.06, 0.13, 0.1, -0.03, 0.11, 0.06])
    },
    fees: {
      management: 'SPV / platform dependent',
      performance: 'Carry may apply by vehicle',
      lockup: 'Transfer window or liquidity event only'
    },
    shareRights: [
      'Represents a demo allocation or SPV economics, not listed common-stock ownership.',
      'Information, voting, transfer, and redemption rights depend on the private documents.',
      'Proxy hedges can reduce broad beta but cannot replicate the private-company exit path.'
    ],
    diligenceScore: 68,
    diligenceChecks: [
      { label: 'Company theme', status: 'Review', detail: theme },
      { label: 'Eligibility', status: 'Review', detail: 'Investor checks and transfer restrictions decide whether access is possible.' },
      { label: 'Liquidity', status: 'Review', detail: 'Exit depends on secondary windows, tender offers, IPO, or acquisition.' },
      { label: 'Rights', status: 'Review', detail: 'SPV rights can differ materially from direct share rights.' }
    ],
    automation: [
      'Watchlist alerts can monitor tender windows, document changes, and pricing updates.',
      'Auto-buy stays disabled until eligibility and allocation documents are confirmed.',
      'Risk copilot should flag concentration, transfer limits, and stale private marks.'
    ]
  };
}

const RAW_WEALTH_PRODUCTS = [
  {
    id: 'superstate-ustb',
    name: 'Superstate USTB',
    shortName: 'USTB',
    bucket: 'starter',
    termType: 'open',
    goals: ['capital', 'income'],
    productType: 'Tokenized private fund',
    status: 'Real product / official fund',
    liveTieIn: 'Official Superstate Short Duration US Government Securities Fund mapped into the RiskLens tutorial shelf.',
    risk: 'Low',
    apyRange: '3.46% annual yield / official 30-day yield',
    annualYieldRate: 0.0346,
    annualYieldBasis: 'Official 30-day yield',
    annualYieldSource: 'Superstate public USTB fund page, crawled in April 2026.',
    riskNote: 'Treasury risk is low, but the share token is still a fund security with eligibility and redemption rules.',
    baseAsset: 'USD or USDC subscription into tokenized fund shares',
    underlying: 'Short-duration U.S. Treasury Bills, represented as tokenized or book-entry shares of the fund.',
    yieldSource: 'Treasury bill carry designed to track current income with liquidity and stability of principal.',
    redemption: 'Continuous NAV/S with market-day liquidity through supported cash or stablecoin rails.',
    suitableFor: 'Treasury, DAO, and qualified investors who want transparent short-duration yield with modern settlement rails.',
    worstCase: 'Rates fall, the yield compresses, or settlement and eligibility friction matters more than the headline return.',
    shareToken: 'USTB',
    nav: 11.058,
    minSubscription: 1000,
    dailyYieldRate: 0.000094,
    technicalSummary:
      'USTB represents tokenized or book-entry shares in the Superstate Short Duration US Government Securities Fund. The official product supports continuous NAV/S and market-day subscriptions or redemptions after onboarding.',
    humanSummary:
      'This is a strong benchmark for a cash-management shelf: real short T-bills, low fee drag, and a tokenized share whose value climbs gradually instead of pretending to be insured cash.',
    scenario: {
      horizon: '90 days on 1,000 PT',
      conservative: '1,006 PT',
      base: '1,009 PT',
      pressure: '998 PT'
    },
    navHistory: {
      '7d': buildHistory(11.048, [0.001, 0.001, 0.002, 0.001, 0.002, 0.002, 0.002]),
      '30d': buildHistory(11.018, [0.002, 0.002, 0.003, 0.002, 0.002, 0.003, 0.002, 0.003, 0.002, 0.003]),
      '3m': buildHistory(10.982, [0.003, 0.003, 0.004, 0.004, 0.003, 0.004, 0.004, 0.004, 0.003, 0.004, 0.004, 0.004]),
      '6m': buildHistory(10.935, [0.004, 0.004, 0.004, 0.005, 0.004, 0.005, 0.004, 0.005, 0.004, 0.004, 0.005, 0.005])
    },
    fees: {
      management: '<= 0.15% / year',
      performance: '0%',
      lockup: 'Market-day liquidity'
    },
    shareRights: [
      'Represents tokenized or book-entry fund ownership rather than a platform IOU.',
      'Can be held on supported networks or offchain recordkeeping, depending on access path.',
      'Redemption value should follow official NAV/S instead of a fixed stablecoin promise.'
    ],
    diligenceScore: 95,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Pass', detail: 'The fund is explicitly tied to short-duration Treasury Bills.' },
      { label: 'Pricing transparency', status: 'Pass', detail: 'Superstate publishes continuous NAV/S and historical data on the product page.' },
      { label: 'Eligibility rule', status: 'Review', detail: 'Qualified Purchaser and jurisdiction rules still gate who can hold the official product.' },
      { label: 'Liquidity stress', status: 'Pass', detail: 'The official fund emphasizes market-day liquidity rather than an undefined queue.' }
    ],
    automation: [
      'Continuous NAV/S updates are the core mechanic and should feed both the shelf and any automation layer.',
      'Fund eligibility and allowlist checks should be surfaced before funds are routed.',
      'Treasury roll logic belongs in the product description because it is part of how the yield is maintained.'
    ]
  },
  {
    id: 'ondo-usdy',
    name: 'Ondo USDY',
    shortName: 'USDY',
    bucket: 'starter',
    termType: 'open',
    goals: ['capital', 'income', 'buydip'],
    productType: 'Yield token / note',
    status: 'Real product / official docs',
    liveTieIn: 'Official Ondo USDY mapped into the shelf so users can compare yield-bearing dollar tokens against tokenized fund shares.',
    risk: 'Low',
    apyRange: '4.29% annual yield / latest indexed public Ondo reference',
    annualYieldRate: 0.0429,
    annualYieldBasis: 'Indexed official public APY reference',
    annualYieldSource: 'Ondo official USDY blog coverage notes a monthly-updated APY; the crawled docs explain structure but do not surface a live rate on-page.',
    riskNote: 'Yield accrues into token price or rebasing supply, so users need to understand the wrapper before treating it like cash.',
    baseAsset: 'Stablecoins or USD wires into a tokenized dollar-yield note',
    underlying: 'Short-term U.S. Treasuries, short treasury ETF shares, or bank demand deposits depending on issuance date and structure.',
    yieldSource: 'Underlying treasury and cash-equivalent yield passed through after issuer spread and expenses.',
    redemption: 'Business-day mint and redeem path; transferability and eligibility vary by onboarding status and jurisdiction.',
    suitableFor: 'Non-U.S. users who want a yield-bearing dollar asset with more onchain portability than a traditional fund account.',
    worstCase: 'Yield falls, the note structure is misunderstood, or transfer restrictions matter at the wrong time.',
    shareToken: 'USDY / rUSDY',
    nav: 1.087,
    minSubscription: 1000,
    dailyYieldRate: 0.00012,
    technicalSummary:
      'USDY is a tokenized note whose yield can show up either as a rising reference price or as rebasing supply, depending on which version the user holds. The legal wrapper and eligibility rules are as important as the yield number.',
    humanSummary:
      'USDY is useful because it feels closer to an onchain savings rail, but the product only stays understandable if the page clearly explains where the yield comes from and why it is not the same thing as a bank deposit.',
    scenario: {
      horizon: '90 days on 1,000 PT',
      conservative: '1,007 PT',
      base: '1,011 PT',
      pressure: '997 PT'
    },
    navHistory: {
      '7d': buildHistory(1.081, [0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001]),
      '30d': buildHistory(1.073, [0.001, 0.001, 0.002, 0.001, 0.001, 0.002, 0.001, 0.001, 0.002, 0.001]),
      '3m': buildHistory(1.058, [0.002, 0.002, 0.002, 0.003, 0.002, 0.002, 0.003, 0.002, 0.002, 0.003, 0.002, 0.003]),
      '6m': buildHistory(1.035, [0.004, 0.003, 0.004, 0.004, 0.003, 0.004, 0.004, 0.003, 0.004, 0.004, 0.003, 0.004])
    },
    fees: {
      management: 'Issuer spread embedded in yield',
      performance: '0%',
      lockup: 'Access and transfer rules vary'
    },
    shareRights: [
      'Represents a claim through the USDY note wrapper rather than a bank account balance.',
      'Can accrue value through a higher reference price or via rebasing supply in rUSDY.',
      'Transfer and redemption rights depend on product version, onboarding, and jurisdiction.'
    ],
    diligenceScore: 88,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Pass', detail: 'Official docs tie USDY to treasury-linked and cash-equivalent collateral.' },
      { label: 'Pricing logic', status: 'Pass', detail: 'The docs clearly separate accumulating USDY from rebasing rUSDY.' },
      { label: 'Eligibility rule', status: 'Review', detail: 'The product is aimed at qualifying non-U.S. users, so access copy matters.' },
      { label: 'Liquidity stress', status: 'Review', detail: 'Users need to understand the onboarding and transfer path before treating the token as instant cash.' }
    ],
    automation: [
      'The UI should explain whether yield is arriving via price drift or via rebasing balance.',
      'Eligibility and transferability checks should trigger before routing stablecoins into the note.',
      'If stablecoin conversion is required, route drag belongs in the same preview as tax and fee estimates.'
    ]
  },
  {
    id: 'franklin-fobxx',
    name: 'Franklin FOBXX / BENJI',
    shortName: 'FOBXX',
    bucket: 'starter',
    termType: 'open',
    goals: ['capital', 'income'],
    productType: 'Onchain money fund',
    status: 'Real product / official fund',
    liveTieIn: 'Franklin OnChain U.S. Government Money Fund gives the shelf a real regulated money-market benchmark.',
    risk: 'Low',
    apyRange: '3.58% annual yield / official 7-day effective yield',
    annualYieldRate: 0.0358,
    annualYieldBasis: 'Official 7-day effective yield',
    annualYieldSource: 'Franklin Templeton FOBXX fund page, as of February 6, 2026.',
    riskNote: 'Stable NAV money-market funds still have channel, fund, and eligibility rules even if the share price targets $1.00.',
    baseAsset: 'Fund shares accessed through Franklin / Benji rails',
    underlying: 'At least 99.5% in U.S. government securities, cash, and repos collateralized by government securities or cash.',
    yieldSource: 'Government money-market income distributed through a regulated fund wrapper.',
    redemption: 'Fund-share access through Benji-style channels with daily income mechanics.',
    suitableFor: 'Users who want the cleanest tokenized money-market reference point before comparing more complex wrappers.',
    worstCase: 'Yield follows policy rates lower and users overestimate how close a fund share is to insured cash.',
    shareToken: 'BENJI / FOBXX',
    nav: 1.0,
    minSubscription: 1000,
    dailyYieldRate: 0.000098,
    technicalSummary:
      'FOBXX is a regulated fund whose transfer agent maintains the official share ownership record through a blockchain-integrated system. That makes it a useful example of where tokenization enhances recordkeeping without changing the underlying money-market mechanics.',
    humanSummary:
      'If someone already understands a money-market fund, FOBXX is one of the easiest bridges into onchain RWAs because the source of return is familiar and the token layer is mostly about access and recordkeeping.',
    scenario: {
      horizon: '90 days on 1,000 PT',
      conservative: '1,006 PT',
      base: '1,008 PT',
      pressure: '999 PT'
    },
    navHistory: {
      '7d': buildHistory(1.0, [0, 0, 0, 0, 0, 0, 0]),
      '30d': buildHistory(1.0, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      '3m': buildHistory(1.0, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      '6m': buildHistory(1.0, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    },
    fees: {
      management: '0.20% net expense ratio',
      performance: '0%',
      lockup: 'Money-market dealing rules'
    },
    shareRights: [
      'Represents a fund share recorded through the onchain-integrated Benji recordkeeping system.',
      'Economic exposure follows official fund NAV and distributions rather than a protocol-native promise.',
      'Tokenized representation does not remove the underlying fund structure or access channel constraints.'
    ],
    diligenceScore: 94,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Pass', detail: 'Official fund documents clearly define the government-securities mandate.' },
      { label: 'Pricing transparency', status: 'Pass', detail: 'Franklin publishes current NAV and money-market yield figures.' },
      { label: 'Eligibility rule', status: 'Review', detail: 'The access path remains channel-specific even though ownership records use blockchain-integrated rails.' },
      { label: 'Liquidity stress', status: 'Pass', detail: 'The fund follows money-market liquidity and maturity rules rather than opaque protocol logic.' }
    ],
    automation: [
      'The shelf should separate stable-NAV mechanics from the tokenized ownership story.',
      'Any live monitor should track the published 7-day yield and daily/weekly liquidity ratios.',
      'If channel terms change, that update belongs in token-rights style copy because it affects real access.'
    ]
  },
  {
    id: 'ondo-ousg',
    name: 'Ondo OUSG',
    shortName: 'OUSG',
    bucket: 'fixed',
    termType: 'open',
    goals: ['capital', 'income'],
    productType: 'Qualified-access treasury fund',
    status: 'Real product / official fund',
    liveTieIn: 'Official Ondo Short-Term U.S. Government Treasuries gives the shelf an institutional treasury fund reference with 24/7 tokenized flow.',
    risk: 'Low',
    apyRange: '4.81% annual yield / indexed official public APY reference',
    annualYieldRate: 0.0481,
    annualYieldBasis: 'Indexed official public APY reference',
    annualYieldSource: 'Ondo OUSG product page and recent official launch coverage surface a 4.81% APY reference, while core docs focus on structure, fees, and redemption logic.',
    riskNote: 'Qualified-purchaser access, instant flow thresholds, and tax treatment matter more here than superficial UI simplicity.',
    baseAsset: 'USD or supported stablecoins into a qualified-access treasury fund',
    underlying: 'Tokenized treasury funds, bank deposits, and USDC used to support liquid treasury exposure.',
    yieldSource: 'Short-term U.S. Treasury and GSE exposure routed through Ondo qualified-access structures.',
    redemption: '24/7 tokenized subscriptions and redemptions for eligible users, with different instant and non-instant thresholds.',
    suitableFor: 'Qualified purchasers and institutional treasury managers comparing onchain cash-management tools.',
    worstCase: 'Eligibility or redemption constraints matter at the wrong time, or treasury yields reset lower after entry.',
    shareToken: 'OUSG',
    nav: 1.094,
    minSubscription: 5000,
    dailyYieldRate: 0.000132,
    technicalSummary:
      'OUSG is a qualified-access treasury fund where the blockchain rails matter most for subscription, redemption, and collateral use. It should be taught as a regulated treasury product first and a composable token second.',
    humanSummary:
      'OUSG is a good example of why institutional tokenized treasuries are useful: the yield source is plain Treasury exposure, but the user gets much more flexible access than a normal account workflow.',
    scenario: {
      horizon: '90 days on 1,000 PT',
      conservative: '1,007 PT',
      base: '1,010 PT',
      pressure: '997 PT'
    },
    navHistory: {
      '7d': buildHistory(1.088, [0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001]),
      '30d': buildHistory(1.079, [0.001, 0.001, 0.002, 0.001, 0.002, 0.001, 0.002, 0.001, 0.002, 0.002]),
      '3m': buildHistory(1.064, [0.002, 0.002, 0.003, 0.002, 0.003, 0.002, 0.003, 0.002, 0.003, 0.002, 0.003, 0.003]),
      '6m': buildHistory(1.042, [0.004, 0.003, 0.004, 0.004, 0.003, 0.004, 0.004, 0.003, 0.004, 0.004, 0.003, 0.004])
    },
    fees: {
      management: '0.15% / year (waived until Jul 1, 2026)',
      performance: '0%',
      lockup: 'Instant and non-instant flow thresholds'
    },
    shareRights: [
      'Represents qualified-access fund ownership rather than a generalized stablecoin balance.',
      'Can support collateral and treasury workflows, but only within the official access framework.',
      'Tax and reporting treatment follow the fund wrapper, not generic token norms.'
    ],
    diligenceScore: 91,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Pass', detail: 'Official docs explicitly anchor OUSG to short-term treasury exposure.' },
      { label: 'Pricing transparency', status: 'Pass', detail: 'Ondo discloses 24/7 tokenized flow, chain support, and fee/tax notes.' },
      { label: 'Eligibility rule', status: 'Review', detail: 'Qualified-access restrictions are central and should never be hidden.' },
      { label: 'Liquidity stress', status: 'Pass', detail: 'The product makes instant versus standard mint and redeem logic explicit.' }
    ],
    automation: [
      'Routing logic should distinguish instant from non-instant transactions before showing a redemption preview.',
      'Tax and fee notices belong beside the order flow because OUSG uses a partnership-style wrapper.',
      'Collateral integrations should be surfaced as an optional extension rather than mixed into basic yield copy.'
    ]
  },
  {
    id: 'hashnote-usyc',
    name: 'Hashnote USYC',
    shortName: 'USYC',
    bucket: 'starter',
    termType: 'open',
    goals: ['capital', 'income'],
    productType: 'Cash management token',
    status: 'Real product / official docs',
    liveTieIn: 'Hashnote USYC gives the shelf a real treasury-plus-repo token meant for onchain cash management and collateral workflows.',
    risk: 'Low',
    apyRange: '4.31% annualized treasury + repo carry / modeled',
    annualYieldRate: 0.0431,
    annualYieldBasis: 'Modeled annualized treasury + repo carry',
    annualYieldSource: 'Hashnote USYC public docs describe the treasury and repo sleeve, while public crawlable pages did not expose a live current yield figure.',
    riskNote: 'The collateral and T+0 USDC flow are strong, but the product is still gated to specific non-U.S. institutional users.',
    baseAsset: 'USDC into Hashnote Short Duration Yield Fund shares',
    underlying: 'Short-term U.S. Treasury Bills plus repo and reverse-repo activity inside the Short Duration Yield Fund.',
    yieldSource: 'Short-term Fed-rate style return from T-bills and repo activity after service and fund costs.',
    redemption: 'USDC mint and redeem path available 24/7/365 for onboarded investors, with extra fees possible for custom liquidity arrangements.',
    suitableFor: 'Institutional treasuries and market participants who want a collateral-ready treasury token with same-day USDC flow.',
    worstCase: 'Yield resets lower, access is stricter than expected, or custom liquidity services add more drag than the headline yield suggests.',
    shareToken: 'USYC',
    nav: 1.103,
    minSubscription: 100000,
    dailyYieldRate: 0.000118,
    technicalSummary:
      'USYC is the onchain representation of Hashnote Short Duration Yield Fund exposure. It is a good teaching product because the docs explicitly tie the token to T-bills, repo, fees, and 24/7 USDC subscription or redemption mechanics.',
    humanSummary:
      'USYC is useful when users want a yield-bearing dollar sleeve they can also move or post in crypto workflows, but it only stays understandable if the page shows the access rules and fee drag up front.',
    scenario: {
      horizon: '90 days on 1,000 PT',
      conservative: '1,007 PT',
      base: '1,010 PT',
      pressure: '997 PT'
    },
    navHistory: {
      '7d': buildHistory(1.097, [0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001]),
      '30d': buildHistory(1.088, [0.001, 0.001, 0.002, 0.001, 0.001, 0.002, 0.001, 0.001, 0.002, 0.001]),
      '3m': buildHistory(1.072, [0.002, 0.002, 0.003, 0.002, 0.002, 0.003, 0.002, 0.002, 0.003, 0.002, 0.003, 0.003]),
      '6m': buildHistory(1.049, [0.004, 0.004, 0.004, 0.003, 0.004, 0.004, 0.003, 0.004, 0.004, 0.003, 0.004, 0.004])
    },
    fees: {
      management: 'Service, management, and redemption fees disclosed in docs',
      performance: '0%',
      lockup: '24/7 USDC flow for onboarded users; custom liquidity lines cost extra'
    },
    shareRights: [
      'Represents a claim through the USYC token wrapper on Hashnote fund exposure rather than a bank deposit.',
      'Supports onchain mint and redeem flow into USDC for approved investors.',
      'Eligibility, whitelist, and wallet controls are part of the real product rights, not optional UI details.'
    ],
    diligenceScore: 92,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Pass', detail: 'Official docs tie USYC to short-term T-bills plus repo and reverse repo activity.' },
      { label: 'Pricing logic', status: 'Pass', detail: 'The docs describe token price, oracle publication, and disclosed fees.' },
      { label: 'Eligibility rule', status: 'Review', detail: 'Access is targeted to institutions outside the U.S. with a meaningful minimum investment.' },
      { label: 'Liquidity stress', status: 'Pass', detail: 'USDC subscription and redemption logic is clearly described, including paid custom-liquidity options.' }
    ],
    automation: [
      'The routing layer should call out whether the user is using standard USDC liquidity or a paid custom-liquidity line.',
      'Because the product is meant for cash management, the take-home preview should show both yield accrual and fee drag in one place.',
      'Collateral and treasury usage can be highlighted later, but only after onboarding and rights checks pass.'
    ]
  },
  {
    id: 'openeden-tbill',
    name: 'OpenEden TBILL',
    shortName: 'TBILL',
    bucket: 'fixed',
    termType: 'open',
    goals: ['capital', 'income'],
    productType: 'Tokenized treasury fund',
    status: 'Real product / official vault',
    liveTieIn: 'Official OpenEden TBILL adds a true USDC-settled treasury vault with explicit onchain fees and queue-based redemption.',
    risk: 'Low',
    apyRange: '3.98% annualized treasury carry net of TER / modeled',
    annualYieldRate: 0.0398,
    annualYieldBasis: 'Modeled annualized treasury carry net of TER',
    annualYieldSource: 'OpenEden public docs expose TER, queue mechanics, and onchain flow; the live 7-day yield is not visible on the public crawled app page.',
    riskNote: 'Short-dated T-bill collateral helps, but whitelist rules, queue timing, and stablecoin routing still affect user outcomes.',
    baseAsset: 'USDC into the TBILL Vault',
    underlying: 'A pool of U.S. T-Bills and USD held in custody with licensed financial institutions.',
    yieldSource: 'Short-dated Treasury yield compounded inside the vault after expense ratio and transaction fees.',
    redemption: 'Redemption queue typically processed on the next U.S. business day, net of transaction fee.',
    suitableFor: 'Institutional or treasury users comfortable with KYC, whitelist rules, and USDC settlement.',
    worstCase: 'Queue timing matters, rates compress, or stablecoin route drag eats more of the yield than expected.',
    shareToken: 'TBILL',
    nav: 1.164,
    minSubscription: 1000,
    dailyYieldRate: 0.000109,
    technicalSummary:
      'OpenEden TBILL is a tokenized treasury vault with an explicit total expense ratio and onchain transaction fee schedule. It is a strong reference product because the docs make the operational drag visible instead of hiding it in marketing APY.',
    humanSummary:
      'TBILL is useful for education because it proves the point that even a very conservative RWA product still has fees, queue mechanics, and KYC rules that shape what the investor actually keeps.',
    scenario: {
      horizon: '90 days on 1,000 PT',
      conservative: '1,006 PT',
      base: '1,010 PT',
      pressure: '996 PT'
    },
    navHistory: {
      '7d': buildHistory(1.157, [0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.002]),
      '30d': buildHistory(1.147, [0.001, 0.001, 0.002, 0.001, 0.002, 0.001, 0.002, 0.001, 0.002, 0.002]),
      '3m': buildHistory(1.129, [0.002, 0.003, 0.002, 0.003, 0.002, 0.003, 0.002, 0.003, 0.002, 0.003, 0.003, 0.003]),
      '6m': buildHistory(1.101, [0.004, 0.004, 0.004, 0.005, 0.004, 0.005, 0.004, 0.005, 0.004, 0.004, 0.005, 0.005])
    },
    fees: {
      management: '0.30% / year TER',
      performance: '0%',
      lockup: 'Next business day redemption queue + 5 bps transaction fee'
    },
    shareRights: [
      'Represents vault exposure to a T-bill pool rather than a simple stablecoin balance.',
      'Subscription and redemption are mediated by whitelist rules and official vault contracts.',
      'Final withdrawal value is explicitly net of onchain transaction fees and the prevailing exchange rate.'
    ],
    diligenceScore: 90,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Pass', detail: 'Official docs tie TBILL directly to a pool of U.S. T-Bills and USD.' },
      { label: 'Pricing transparency', status: 'Pass', detail: 'OpenEden publishes fee mechanics, queue logic, and token-price formulas.' },
      { label: 'Eligibility rule', status: 'Review', detail: 'Whitelist and jurisdiction restrictions are material and should stay prominent.' },
      { label: 'Liquidity stress', status: 'Pass', detail: 'The redemption queue is clearly described rather than implied.' }
    ],
    automation: [
      'Subscription previews should show both TER drag and the 5 bps transaction fee.',
      'Queue status belongs in the detail flow because it directly changes when cash comes back.',
      'Stablecoin conversion cost should sit beside fees so the user sees the full take-home path.'
    ]
  },
  {
    id: 'blackrock-buidl',
    name: 'BlackRock BUIDL',
    shortName: 'BUIDL',
    bucket: 'fixed',
    termType: 'open',
    goals: ['capital', 'income'],
    productType: 'Tokenized liquidity fund',
    status: 'Real product / official distribution',
    liveTieIn: 'BlackRock BUIDL gives the shelf a canonical institutional tokenized liquidity fund distributed through Securitize.',
    risk: 'Low',
    apyRange: '4.02% annualized liquidity-fund income / modeled',
    annualYieldRate: 0.0402,
    annualYieldBasis: 'Modeled annualized liquidity-fund income',
    annualYieldSource: 'BlackRock / Securitize public pages describe the daily-dividend treasury sleeve, but the public crawl did not expose a live current yield figure.',
    riskNote: 'It looks cash-like, but eligibility, dividend handling, and transfer channels matter much more than a typical stablecoin flow.',
    baseAsset: 'USD or supported stablecoin rails into tokenized fund shares',
    underlying: 'Cash, U.S. Treasury Bills, and repo-style liquidity assets inside the BlackRock USD Institutional Digital Liquidity Fund.',
    yieldSource: 'Short-duration government and cash-equivalent income distributed through the fund wrapper.',
    redemption: 'Institutional mint, redeem, and transfer flow through Securitize-supported channels, with stable-value fund mechanics.',
    suitableFor: 'Qualified institutional users who want a large-scale tokenized liquidity sleeve or collateral asset.',
    worstCase: 'Yield compresses and the user mistakes a gated fund share for an unrestricted dollar token.',
    shareToken: 'BUIDL',
    nav: 1.0,
    minSubscription: 5000000,
    dailyYieldRate: 0.00011,
    technicalSummary:
      'BUIDL is best taught as an institutional liquidity fund first. The token improves settlement and transferability, but the product economics still come from a regulated short-duration liquidity portfolio rather than crypto-native yield engineering.',
    humanSummary:
      'BUIDL matters because it shows what the biggest institutions are actually comfortable putting onchain. It is not retail cash, and the page should make that visible immediately.',
    scenario: {
      horizon: '90 days on 1,000 PT',
      conservative: '1,006 PT',
      base: '1,009 PT',
      pressure: '999 PT'
    },
    navHistory: {
      '7d': buildHistory(1.0, [0, 0, 0, 0, 0, 0, 0]),
      '30d': buildHistory(0.999, [0, 0.001, 0, 0, 0.001, 0, 0, 0.001, 0, 0]),
      '3m': buildHistory(0.997, [0.001, 0, 0.001, 0, 0.001, 0, 0.001, 0, 0.001, 0, 0.001, 0]),
      '6m': buildHistory(0.994, [0.001, 0, 0.001, 0.001, 0, 0.001, 0, 0.001, 0, 0.001, 0, 0.001])
    },
    fees: {
      management: 'Institutional fund and channel fee stack applies',
      performance: '0%',
      lockup: 'Qualified access / daily liquidity mechanics'
    },
    shareRights: [
      'Represents ownership in an institutional liquidity fund distributed on token rails, not a general-purpose stablecoin.',
      'Dividend handling and transfer-agent controls are part of the real rights and workflow.',
      'Wallet portability does not remove onboarding, jurisdiction, or transfer restrictions.'
    ],
    diligenceScore: 96,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Pass', detail: 'Official distribution copy ties BUIDL to a short-duration institutional liquidity fund.' },
      { label: 'Pricing transparency', status: 'Pass', detail: 'The product emphasizes stable value with accrued dividends rather than promising unexplained token yield.' },
      { label: 'Eligibility rule', status: 'Review', detail: 'The product is clearly aimed at qualified institutional investors and uses a very high minimum ticket.' },
      { label: 'Liquidity stress', status: 'Pass', detail: 'Distribution copy frames subscriptions and redemptions as institutional fund flow, not instant retail cash-outs.' }
    ],
    automation: [
      'The shelf should surface the high minimum ticket before a user ever opens a subscription preview.',
      'Dividend accrual, transfer-agent controls, and stablecoin conversion should be shown together in the take-home math.',
      'If BUIDL is used as collateral later, the app should separate collateral utility from base fund yield.'
    ]
  },
  {
    id: 'superstate-uscc',
    name: 'Superstate USCC',
    shortName: 'USCC',
    bucket: 'strategy',
    termType: 'open',
    goals: ['income', 'bullish', 'highYield'],
    productType: 'Crypto carry fund',
    status: 'Real product / official fund',
    liveTieIn: 'Official Superstate Crypto Carry Fund used as a real example of basis-trade style yield wrapped as a tokenized private fund.',
    risk: 'Medium',
    apyRange: '4.35% annual yield / official 30-day yield',
    annualYieldRate: 0.0435,
    annualYieldBasis: 'Official 30-day yield',
    annualYieldSource: 'Superstate public USCC fund page, crawled in April 2026.',
    riskNote: 'Return comes from basis, staking, and collateral management, so there is real market and execution risk behind the headline yield.',
    baseAsset: 'USD or USDC into tokenized private fund shares',
    underlying: 'Crypto cash-and-carry trades, staking exposures, and U.S. Treasury collateral.',
    yieldSource: 'Futures basis, staking rewards, and Treasury collateral income after active risk management.',
    redemption: 'Market-day liquidity for eligible users through the fund wrapper.',
    suitableFor: 'Qualified purchasers who understand derivatives, staking, and liquidity risk better than a treasury-only buyer would.',
    worstCase: 'Basis collapses, hedge slippage rises, or crypto volatility creates more drag than the carry spread can absorb.',
    shareToken: 'USCC',
    nav: 11.541,
    minSubscription: 1000,
    dailyYieldRate: 0.000147,
    technicalSummary:
      'USCC combines cash collateral, Treasury exposure, staking, and futures hedges inside a tokenized fund format. It is a good reminder that some yield products are really execution products with a fund wrapper around them.',
    humanSummary:
      'USCC can look like a high-yield cash product if the page is lazy. It is not. The return comes from a trading strategy, so the shelf has to show basis, staking, and collateral separately.',
    scenario: {
      horizon: '90 days on 1,000 PT',
      conservative: '990 PT',
      base: '1,020 PT',
      pressure: '960 PT'
    },
    navHistory: {
      '7d': buildHistory(11.462, [-0.01, 0.014, -0.009, 0.016, -0.003, 0.012, 0.01]),
      '30d': buildHistory(11.318, [-0.028, 0.042, -0.021, 0.033, -0.017, 0.029, -0.013, 0.024, -0.011, 0.039]),
      '3m': buildHistory(11.061, [-0.056, 0.072, -0.038, 0.061, -0.029, 0.057, -0.024, 0.048, -0.021, 0.043, -0.014, 0.051]),
      '6m': buildHistory(10.786, [-0.071, 0.089, -0.048, 0.074, -0.036, 0.068, -0.031, 0.057, -0.028, 0.052, -0.019, 0.061])
    },
    fees: {
      management: '0.75% / year',
      performance: '0%',
      lockup: 'Market-day liquidity'
    },
    shareRights: [
      'Represents fund exposure to basis, staking, and collateral management rather than a passive income note.',
      'Should preserve reporting around strategy risk, not just wallet balance and NAV.',
      'Redemption and settlement still follow the fund wrapper even when the share is tokenized.'
    ],
    diligenceScore: 86,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Pass', detail: 'Superstate publishes representative holdings, including collateral and derivative sleeves.' },
      { label: 'Strategy explainability', status: 'Review', detail: 'Basis and staking are understandable, but users still need help reading the risk stack.' },
      { label: 'Eligibility rule', status: 'Review', detail: 'Qualified Purchaser access should be explicit in every subscription preview.' },
      { label: 'Liquidity stress', status: 'Review', detail: 'Market-day liquidity exists, but strategy liquidity and hedge quality still matter.' }
    ],
    automation: [
      'A real teaching flow should break out basis, staking, and Treasury collateral as separate income lines.',
      'If the spread collapses, the product card should explain why expected take-home value changed.',
      'Derivative, staking, and collateral monitors belong in diligence because they are core product mechanics.'
    ]
  },
  {
    id: 'hamilton-scope',
    name: 'Hamilton Lane SCOPE',
    shortName: 'SCOPE',
    bucket: 'strategy',
    termType: 'open',
    goals: ['income', 'highYield'],
    productType: 'Pre-IPO / private-credit allocation',
    status: 'Real product / official distribution',
    liveTieIn: 'Hamilton Lane SCOPE gives the Wealth shelf a real private-allocation benchmark with credit underwriting and redemption-window education.',
    risk: 'Medium',
    apyRange: '6.94% annualized private-credit income / modeled',
    annualYieldRate: 0.0694,
    annualYieldBasis: 'Modeled annualized private-credit income',
    annualYieldSource: 'Official product and distribution materials describe the fund structure, but a live public yield figure is not exposed on the crawlable landing pages.',
    riskNote: 'Higher yield comes from private-credit underwriting and liquidity tradeoffs, not from a cash-equivalent promise.',
    baseAsset: 'Digital subscription into Hamilton Lane senior credit fund shares',
    underlying: 'Senior secured private credit and middle-market lending exposure.',
    yieldSource: 'Private-credit coupon income, borrower spread, and portfolio construction.',
    redemption: 'Open-ended access with fund-style redemption windows through official distribution rails; liquidity still depends on credit-fund dealing terms.',
    suitableFor: 'Users comparing tokenized private credit with more liquid treasury and cash-management products.',
    worstCase: 'Credit losses rise, marks widen, or redemption flexibility proves less immediate than the UI suggests.',
    shareToken: 'SCOPE',
    nav: 10.842,
    minSubscription: 10000,
    dailyYieldRate: 0.00019,
    technicalSummary:
      'SCOPE is useful because it shows where tokenization stops being about operational efficiency alone and starts intersecting with real underwriting and liquidity risk. The product page has to explain the credit engine, not just the wallet wrapper.',
    humanSummary:
      'SCOPE can pay more than treasuries because it is doing private-credit work. That makes it a better teaching example than a generic high-yield number with no explanation underneath.',
    scenario: {
      horizon: '90 days on 1,000 PT',
      conservative: '998 PT',
      base: '1,016 PT',
      pressure: '972 PT'
    },
    navHistory: {
      '7d': buildHistory(10.828, [0.001, 0.002, 0.001, 0.002, 0.002, 0.002, 0.004]),
      '30d': buildHistory(10.774, [0.004, 0.005, 0.004, 0.006, 0.005, 0.006, 0.005, 0.006, 0.006, 0.006]),
      '3m': buildHistory(10.628, [0.01, 0.012, 0.009, 0.012, 0.011, 0.012, 0.011, 0.012, 0.011, 0.012, 0.013, 0.012]),
      '6m': buildHistory(10.382, [0.017, 0.018, 0.016, 0.019, 0.018, 0.019, 0.018, 0.019, 0.018, 0.019, 0.02, 0.02])
    },
    fees: {
      management: 'See fund docs / private-credit fee stack',
      performance: 'Fund-specific',
      lockup: 'Fund redemption windows and credit-fund liquidity terms apply'
    },
    shareRights: [
      'Represents digital fund ownership, but the economic reality is still private credit.',
      'Wallet portability does not remove credit, servicing, or valuation complexity.',
      'Redemption and reporting rights should be framed around fund docs, not token marketing.'
    ],
    diligenceScore: 84,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Pass', detail: 'Official copy ties the product to senior credit opportunities.' },
      { label: 'Liquidity framing', status: 'Review', detail: 'On-demand redemption language is helpful, but users still need plain-English liquidity caveats.' },
      { label: 'Eligibility rule', status: 'Pass', detail: 'Official distribution copy makes the private-fund access path explicit.' },
      { label: 'Credit stress', status: 'Review', detail: 'The page should explain what happens when borrower defaults or marks widen.' }
    ],
    automation: [
      'A diligence view should monitor credit quality, redemption terms, and fee drag as one package.',
      'The explain layer should translate private-credit mechanics into a plain take-home preview.',
      'Any leaderboard should reward transparency on underwriting and liquidity, not just higher yield.'
    ]
  },
  {
    id: 'apollo-acred',
    name: 'Apollo ACRED',
    shortName: 'ACRED',
    bucket: 'strategy',
    termType: 'open',
    goals: ['income', 'bullish', 'highYield'],
    productType: 'Pre-IPO / private-credit allocation',
    status: 'Real product / official distribution',
    liveTieIn: 'Apollo ACRED stays in Wealth as a private-allocation style RWA with credit underwriting, valuation, and liquidity-window education.',
    risk: 'Medium',
    apyRange: '7.48% annualized private-credit income / modeled',
    annualYieldRate: 0.0748,
    annualYieldBasis: 'Modeled annualized private-credit income',
    annualYieldSource: 'Official product and distribution materials describe the fund structure, but a live public yield figure is not exposed on the crawlable landing pages.',
    riskNote: 'The product earns by taking credit and liquidity risk inside a managed fund, so it should never be described like cash yield.',
    baseAsset: 'Tokenized access to the Apollo Diversified Credit Securitize Fund',
    underlying: 'Diversified private-credit exposures managed by Apollo.',
    yieldSource: 'Private-credit coupon income, deal sourcing, floating-rate spreads, and active portfolio management.',
    redemption: 'Open-ended access through official distribution rails, while underlying credit liquidity and notice timing remain the key constraints.',
    suitableFor: 'Users comparing institutional private credit with treasury and carry funds inside the same learning surface.',
    worstCase: 'Credit spreads widen, fund marks fall, or fees and tax drag erode the extra yield users expected to keep.',
    shareToken: 'ACRED',
    nav: 10.624,
    minSubscription: 10000,
    dailyYieldRate: 0.000205,
    technicalSummary:
      'ACRED is a good reality check for the shelf because tokenized access can make a private-credit fund feel simpler than it is. The UI has to make the credit engine, fee stack, and liquidity caveats explicit.',
    humanSummary:
      'If users are chasing yield, ACRED is the kind of product where they most need help. The extra income may be real, but so are underwriting risk, servicing drag, and slower liquidity.',
    scenario: {
      horizon: '90 days on 1,000 PT',
      conservative: '995 PT',
      base: '1,018 PT',
      pressure: '968 PT'
    },
    navHistory: {
      '7d': buildHistory(10.612, [0.001, 0.002, 0.001, 0.002, 0.002, 0.002, 0.002]),
      '30d': buildHistory(10.553, [0.005, 0.006, 0.005, 0.006, 0.006, 0.006, 0.005, 0.006, 0.007, 0.007]),
      '3m': buildHistory(10.401, [0.011, 0.013, 0.01, 0.013, 0.012, 0.013, 0.012, 0.013, 0.012, 0.013, 0.014, 0.014]),
      '6m': buildHistory(10.146, [0.018, 0.02, 0.018, 0.021, 0.019, 0.021, 0.019, 0.021, 0.019, 0.021, 0.022, 0.023])
    },
    fees: {
      management: 'Fund-level management and servicing fees apply',
      performance: 'Fund-specific',
      lockup: 'Fund redemption windows and private-credit liquidity terms apply'
    },
    shareRights: [
      'Represents tokenized fund ownership, but the economic exposure is still diversified private credit.',
      'Reporting, fee drag, and redemption behavior should be governed by fund docs rather than token folklore.',
      'Cross-chain availability does not remove the underlying credit-cycle risk.'
    ],
    diligenceScore: 82,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Pass', detail: 'Official copy anchors ACRED to diversified credit exposure.' },
      { label: 'Pricing transparency', status: 'Review', detail: 'Users still need clearer net-of-fee and net-of-tax examples than marketing pages usually provide.' },
      { label: 'Eligibility rule', status: 'Pass', detail: 'The product is clearly framed as tokenized access to a managed credit fund.' },
      { label: 'Credit stress', status: 'Review', detail: 'Default and markdown risk need plain-English explanation in the learning layer.' }
    ],
    automation: [
      'The detail view should separate gross yield from fee, route, and tax drag before showing a net estimate.',
      'Credit events and redemption terms deserve the same visibility as current NAV.',
      'Any AI diligence score should be tied to transparency and liquidity, not only to headline yield.'
    ]
  },
  {
    id: 'msx-quant-fund-1',
    name: 'RiskLens Quant Fund #1',
    shortName: 'RiskLensQ1',
    bucket: 'strategy',
    termType: 'closed',
    goals: ['bullish', 'highYield'],
    productType: 'Closed-end quant fund',
    status: 'Real product / RiskLens public listing',
    liveTieIn: 'RiskLens public shop listing shows Quant Fund #1 as a 12-month closed product with a stated 1% to 3% weekly target return band.',
    risk: 'High',
    apyRange: '104.00% target annualized payout / RiskLens weekly midpoint',
    annualYieldRate: 1.04,
    annualYieldBasis: 'RiskLens stated weekly target band, simple annualized midpoint',
    annualYieldSource: 'RiskLens public shop listing for Quant Fund #1 shows a 12-month duration and a target weekly return band of 1% to 3%.',
    riskNote: 'This is a manager-driven quant strategy with a hard term, so the headline payout target is not comparable to treasury yield.',
    baseAsset: 'Digital subscription into RiskLens closed-end quant fund shares',
    underlying: 'RiskLens-managed quantitative trading strategy exposure as described on the public listing.',
    yieldSource: 'Manager execution, active quant signals, and closed-end strategy deployment rather than cash-equivalent carry.',
    redemption: 'Closed-end structure. No investor redemption before maturity in this demo flow.',
    suitableFor: 'Users who understand that a fixed term and manager execution risk sit behind the return target.',
    worstCase: 'Strategy underperforms, the closed term removes flexibility, and users anchor on the payout target instead of strategy risk.',
    shareToken: 'RiskLensQ1',
    nav: 1.164,
    minSubscription: 1000,
    dailyYieldRate: 0.00198,
    technicalSummary:
      'RiskLens Quant Fund #1 is treated here as a real closed-end manager sleeve: the wallet still holds a receipt token, but the economics come from a 12-month quant strategy rather than an always-redeemable cash-management product.',
    humanSummary:
      'This is the opposite of a flexible treasury fund. You buy it for a manager-led term trade, then wait for maturity instead of expecting to get out whenever you want.',
    scenario: {
      horizon: '12 months on 1,000 PT',
      conservative: '1,060 PT',
      base: '1,210 PT',
      pressure: '880 PT'
    },
    navHistory: {
      '7d': buildHistory(1.145, [0.004, -0.003, 0.006, 0.002, -0.001, 0.005, 0.006]),
      '30d': buildHistory(1.101, [0.008, 0.005, -0.004, 0.01, 0.006, -0.003, 0.009, 0.007, 0.006, 0.015]),
      '3m': buildHistory(1.018, [0.018, 0.014, -0.01, 0.02, 0.016, -0.007, 0.018, 0.014, 0.013, 0.02, 0.012, 0.018]),
      '6m': buildHistory(0.932, [0.028, 0.019, -0.015, 0.031, 0.024, -0.012, 0.026, 0.021, 0.019, 0.029, 0.018, 0.024])
    },
    fees: {
      management: 'See RiskLens product terms',
      performance: 'Embedded in manager economics',
      lockup: '12-month closed term / no early redemption'
    },
    shareRights: [
      'Represents closed-end fund ownership for one specific RiskLens manager sleeve.',
      'Receipt stays visible until maturity because the product is not redeemable on demand.',
      'Token display does not remove manager risk, reporting risk, or term-lock risk.'
    ],
    diligenceScore: 74,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Review', detail: 'Public listing shows a real product, but the underlying trading book is still much less transparent than treasury funds.' },
      { label: 'Pricing transparency', status: 'Review', detail: 'The public listing exposes target return bands, but not the same live NAV transparency as fund-style treasury products.' },
      { label: 'Eligibility rule', status: 'Pass', detail: 'Closed-end term framing is explicit on the listing and should stay visible in the flow.' },
      { label: 'Liquidity stress', status: 'Review', detail: 'No early redemption means liquidity risk is structural, not a secondary UI detail.' }
    ],
    automation: [
      'Closed-end warnings should stay visible from product card through final buy review.',
      'Manager update cadence and maturity countdown should be shown beside the wallet receipt state.',
      'Yield targets should always be paired with lockup and strategy-risk language.'
    ]
  },
  {
    id: 'msx-quant-fund-2',
    name: 'RiskLens Quant Fund #2',
    shortName: 'RiskLensQ2',
    bucket: 'strategy',
    termType: 'closed',
    goals: ['bullish', 'highYield'],
    productType: 'Closed-end quant fund',
    status: 'Real product / RiskLens public listing',
    liveTieIn: 'RiskLens public shop listing shows Quant Fund #2 as a 12-month closed product with a stated 3% to 5% weekly target return band.',
    risk: 'High',
    apyRange: '208.00% target annualized payout / RiskLens weekly midpoint',
    annualYieldRate: 2.08,
    annualYieldBasis: 'RiskLens stated weekly target band, simple annualized midpoint',
    annualYieldSource: 'RiskLens public shop listing for Quant Fund #2 shows a 12-month duration and a target weekly return band of 3% to 5%.',
    riskNote: 'This is an even more aggressive closed-end manager sleeve, so the payout target should be read as a strategy target, not as stable yield.',
    baseAsset: 'Digital subscription into RiskLens closed-end quant fund shares',
    underlying: 'RiskLens-managed higher-volatility quantitative trading strategy exposure as described on the public listing.',
    yieldSource: 'Manager execution and aggressive quant deployment inside a fixed-term closed structure.',
    redemption: 'Closed-end structure. No investor redemption before maturity in this demo flow.',
    suitableFor: 'Users who can tolerate a very high-risk, high-target-return manager product with a fixed term.',
    worstCase: 'Drawdowns arrive before maturity, return targets are not realized, and the closed-end structure prevents early exit.',
    shareToken: 'RiskLensQ2',
    nav: 1.286,
    minSubscription: 1000,
    dailyYieldRate: 0.00302,
    technicalSummary:
      'RiskLens Quant Fund #2 is shown as a real but highly aggressive closed-end quant sleeve. The important teaching point is that the wallet receipt exists, but the receipt does not magically convert a manager target into a guaranteed cash product.',
    humanSummary:
      'This is the most aggressive product on the shelf. If someone only sees the return target and misses the 12-month lock, the UI has failed.',
    scenario: {
      horizon: '12 months on 1,000 PT',
      conservative: '980 PT',
      base: '1,320 PT',
      pressure: '760 PT'
    },
    navHistory: {
      '7d': buildHistory(1.248, [0.009, -0.008, 0.013, 0.004, -0.003, 0.009, 0.014]),
      '30d': buildHistory(1.176, [0.018, 0.011, -0.012, 0.022, 0.015, -0.009, 0.02, 0.014, 0.012, 0.019]),
      '3m': buildHistory(1.062, [0.03, 0.019, -0.021, 0.035, 0.024, -0.015, 0.028, 0.022, 0.02, 0.031, 0.018, 0.023]),
      '6m': buildHistory(0.918, [0.043, 0.028, -0.034, 0.049, 0.032, -0.021, 0.037, 0.03, 0.026, 0.041, 0.024, 0.029])
    },
    fees: {
      management: 'See RiskLens product terms',
      performance: 'Embedded in manager economics',
      lockup: '12-month closed term / no early redemption'
    },
    shareRights: [
      'Represents closed-end fund ownership for a higher-volatility RiskLens manager sleeve.',
      'Receipt remains wallet-visible through the full term because the product does not offer open-ended redemptions.',
      'Buying the tokenized receipt does not remove strategy risk or maturity risk.'
    ],
    diligenceScore: 68,
    diligenceChecks: [
      { label: 'Underlying asset pack', status: 'Review', detail: 'The public listing proves the product exists, but the strategy book is still less transparent than a regulated treasury fund.' },
      { label: 'Target-return framing', status: 'Review', detail: 'The payout band is very aggressive and should be read alongside the 12-month lockup.' },
      { label: 'Eligibility rule', status: 'Pass', detail: 'Closed-end term framing is public and should remain prominent in the buy flow.' },
      { label: 'Liquidity stress', status: 'Review', detail: 'This is structurally illiquid before maturity in the current demo assumptions.' }
    ],
    automation: [
      'The flow should force the closed-end warning to remain visible all the way through final confirmation.',
      'Maturity countdown and manager update cadence matter more than daily redeem previews here.',
      'AI diligence should downgrade conviction when target-return marketing is high but portfolio transparency is low.'
    ]
  }
  ,
  {
    id: 'xstocks-public-holdings',
    name: 'xStocks Public Holdings',
    shortName: 'xStocks',
    bucket: 'starter',
    termType: 'open',
    goals: ['public'],
    productType: 'Listed / xStocks',
    status: 'Demo wrapper / paper holdings',
    liveTieIn: 'Modeled RiskLens public-holdings card for listed single-name equities and ETF-style tokenized exposure.',
    risk: 'Medium',
    apyRange: 'Market beta / no fixed yield',
    annualYieldRate: 0,
    annualYieldBasis: 'No yield; price exposure only',
    annualYieldSource: 'Capital gains and losses from listed-equity or ETF-style exposure.',
    riskNote: 'xStocks-style exposure should be treated as tokenized equity or ETF exposure, not treasury yield or a private allocation.',
    baseAsset: 'USD, USDC, or venue cash routed into tokenized listed equity / ETF wrappers',
    underlying: 'Listed single-name equities and ETF-style beta such as AAPL-like, SPY-like, or QQQ-like exposure.',
    yieldSource: 'No promised income. Return comes from price movement and any wrapper-defined economic rights.',
    redemption: 'Secondary trading may be 24/7 where supported; primary mint / redeem and corporate-action processing follow venue and market-day rules.',
    suitableFor: 'Users who want public-market beta after they understand wrapper rights, off-hours spread, and venue mechanics.',
    worstCase: 'Off-hours price gaps, wide spreads, corporate-action confusion, or assuming tokenized exposure equals full shareholder rights.',
    shareToken: 'xSTOCK',
    nav: 100,
    minSubscription: 500,
    dailyYieldRate: 0,
    technicalSummary:
      'This card deliberately limits xStocks to tokenized equities and ETFs. It should not include treasury funds, carry funds, pre-IPO access, or structured yield notes.',
    humanSummary:
      'This is the public-market holdings shelf. You are learning listed equity / ETF wrapper exposure and rights, not cash yield or private-market access.',
    scenario: {
      horizon: '30 days on 1,000 PT',
      conservative: '930 PT',
      base: '1,000 PT',
      pressure: '850 PT'
    },
    navHistory: {
      '7d': buildHistory(98, [1.2, -0.8, 0.6, 1.1, -0.5, 0.9, 0.2]),
      '30d': buildHistory(94, [1.4, -1.1, 2, 0.6, -0.7, 1.2, 0.3, -0.4, 1.1, -0.2]),
      '3m': buildHistory(90, [2.1, -1.4, 1.8, 2.4, -1.2, 1.5, 0.9, -0.8, 2.2, 1.1, -0.6, 1.7]),
      '6m': buildHistory(86, [1.8, 2.2, -1.5, 2.4, 1.1, -0.9, 2.7, -1.1, 1.9, 2.3, -0.7, 1.5])
    },
    fees: {
      management: 'Wrapper / venue dependent',
      performance: '0%',
      lockup: 'Venue liquidity; primary processing follows market rules'
    },
    shareRights: [
      'Represents a tokenized claim or tracker-style exposure, not necessarily full direct shareholder ownership.',
      'Voting, dividends, redemption, and corporate actions depend on issuer and venue terms.',
      'Secondary 24/7 trading can differ from primary market-hours creation or redemption.'
    ],
    diligenceScore: 82,
    diligenceChecks: [
      { label: 'Asset classification', status: 'Pass', detail: 'Only listed equities and ETF-style exposure are grouped under xStocks.' },
      { label: 'Rights clarity', status: 'Review', detail: 'Wrapper rights need to be shown before a user treats the token like a common share.' },
      { label: 'Liquidity rule', status: 'Review', detail: 'Off-hours pricing and primary processing can diverge.' },
      { label: 'Yield framing', status: 'Pass', detail: 'The card does not market treasury or carry yield as xStocks income.' }
    ],
    automation: [
      'Recurring buy can stage orders only within allowed assets and venue rules.',
      'Rebalance bot should pause around stale pricing, corporate actions, or wide off-hours spreads.',
      'Risk copilot should explain rights gaps before allowing automated purchase permissions.'
    ]
  },
  {
    id: 'private-watchlist',
    name: 'Private Watchlist / SPV Access',
    shortName: 'PRIVATE',
    bucket: 'private',
    termType: 'closed',
    goals: ['private'],
    productType: 'Private',
    status: 'Demo watchlist / gated access route',
    liveTieIn: 'Modeled RiskLens private-market watchlist for pre-IPO, SPV, and late-stage private-share education.',
    risk: 'High',
    apyRange: 'No yield / event-driven mark',
    annualYieldRate: 0,
    annualYieldBasis: 'No fixed payout',
    annualYieldSource: 'Event-driven private-market marks, tenders, transfer windows, or liquidity events.',
    riskNote: 'Private access is about eligibility, documents, transfer restrictions, and exit timing before it is about chart trading.',
    baseAsset: 'USD or USDC subscription into a permissioned SPV or transfer window',
    underlying: 'Pre-IPO or late-stage private-company exposure represented through a gated allocation route.',
    yieldSource: 'No recurring yield. Return depends on secondary marks, corporate events, tender offers, IPO, or acquisition.',
    redemption: 'Transfer-only or issuer / platform event. No continuous exchange-style redemption in the beginner model.',
    suitableFor: 'Users who understand lockup, eligibility, allocation limits, and private-market exit uncertainty.',
    worstCase: 'No liquidity event arrives, transfer windows close, marks fall, or legal rights are weaker than expected.',
    shareToken: 'PVTLIST',
    nav: 25,
    minSubscription: 1000,
    dailyYieldRate: 0,
    technicalSummary:
      'This is a watchlist and education route, not a live order book. It teaches SPV rights, transfer limits, eligibility, and proxy hedge limitations.',
    humanSummary:
      'Private exposure is not a stock button. Start by reading what can be transferred, when liquidity might appear, and what rights the wrapper actually gives you.',
    scenario: {
      horizon: '270 days on 1,000 PT',
      conservative: '900 PT',
      base: '1,050 PT',
      pressure: '650 PT'
    },
    navHistory: {
      '7d': buildHistory(25, [0.05, 0, 0.03, -0.02, 0, 0.04, 0.01]),
      '30d': buildHistory(24.5, [0.08, 0.05, -0.03, 0.09, 0.02, 0, 0.06, -0.04, 0.05, 0.02]),
      '3m': buildHistory(23.8, [0.1, 0.08, 0, -0.06, 0.12, 0.05, 0.07, -0.04, 0.11, 0.06, 0.03, 0.08]),
      '6m': buildHistory(22.7, [0.14, 0.08, -0.12, 0.16, 0.09, 0.05, -0.06, 0.12, 0.1, 0.07, -0.04, 0.09])
    },
    fees: {
      management: 'SPV / platform dependent',
      performance: 'Carry may apply by vehicle',
      lockup: 'Transfer window or liquidity event only'
    },
    shareRights: [
      'Represents permissioned allocation or SPV economics rather than listed common stock ownership.',
      'Transfer, voting, information, and redemption rights depend on the private documents.',
      'Proxy hedges can reduce beta but cannot perfectly replicate a private-company exit.'
    ],
    diligenceScore: 70,
    diligenceChecks: [
      { label: 'Eligibility', status: 'Review', detail: 'Access depends on investor checks and transfer restrictions.' },
      { label: 'Liquidity', status: 'Review', detail: 'Exit depends on secondary windows or company events.' },
      { label: 'Rights', status: 'Review', detail: 'SPV rights can differ materially from direct share rights.' },
      { label: 'Hedge fit', status: 'Review', detail: 'Only proxy hedges are plausible for most private names.' }
    ],
    automation: [
      'Watchlist alerts can monitor tenders, new transfer windows, and document changes.',
      'Auto-buy should remain disabled until eligibility, allocation, and documents are confirmed.',
      'Risk copilot should highlight proxy-hedge mismatch and transfer limits.'
    ]
  },
  buildPrivateGrowthProduct({
    id: 'spacex-secondary',
    name: 'SpaceX Secondary Window',
    shortName: 'SPACEX',
    nav: 115,
    theme: 'Space launch, satellite internet, and defense-adjacent demand can be compelling, but valuation and transferability need careful review.',
    base: 1180,
    pressure: 690,
    riskNote: 'SpaceX-style secondary exposure is high-concentration private growth with limited transfer windows and valuation opacity.',
    technicalSummary:
      'The card models SpaceX as a private-market allocation route with event-driven liquidity, not as listed equity or a tokenized public wrapper.',
    humanSummary:
      'This is a watchlist-style growth sleeve: the key questions are access, document rights, tender timing, and whether the valuation already prices in years of execution.'
  }),
  buildPrivateGrowthProduct({
    id: 'stripe-secondary',
    name: 'Stripe Pre-IPO Window',
    shortName: 'STRIPE',
    nav: 92,
    theme: 'Payments infrastructure can compound with global commerce, but private marks and IPO timing drive the exit path.',
    base: 1125,
    pressure: 720,
    riskNote: 'Stripe exposure depends on private-share availability, transfer approvals, valuation marks, and eventual liquidity timing.',
    technicalSummary:
      'The card treats Stripe as a late-stage private-company allocation with SPV and secondary-window diligence before any subscription action.',
    humanSummary:
      'Stripe belongs in growth access, not public-stock wrappers: users should learn why document rights and exit windows matter as much as the brand.'
  }),
  buildPrivateGrowthProduct({
    id: 'bytedance-secondary',
    name: 'ByteDance Private Growth',
    shortName: 'BYTEDANCE',
    nav: 88,
    theme: 'Consumer AI, ads, and global platform scale can create upside, while jurisdiction, governance, and exit-route questions stay central.',
    base: 1100,
    pressure: 640,
    riskNote: 'ByteDance exposure carries jurisdiction, governance, transfer, and liquidity-event uncertainty beyond ordinary private-company risk.',
    technicalSummary:
      'The card models ByteDance as a gated private-growth route with suitability, provenance, and document-review steps ahead of any simulated allocation.',
    humanSummary:
      'This is the kind of name users recognize quickly, so the UI needs to slow them down around access proof, restrictions, and exit assumptions.'
  }),
  buildPrivateGrowthProduct({
    id: 'databricks-secondary',
    name: 'Databricks Secondary Window',
    shortName: 'DBRX',
    nav: 74,
    theme: 'Data and AI infrastructure demand is strong, but competitive pressure and valuation discipline matter before chasing the story.',
    base: 1090,
    pressure: 700,
    riskNote: 'Databricks-style private exposure can be attractive but still has lockup, mark, competition, and transfer-rights risk.',
    technicalSummary:
      'The card separates AI infrastructure thesis from execution rights: allocation, SPV terms, and exit path remain the investable product.',
    humanSummary:
      'Use this to teach users that a good company thesis does not automatically mean the available private wrapper is a good product.'
  }),
  buildPrivateGrowthProduct({
    id: 'openai-secondary',
    name: 'OpenAI Private Growth',
    shortName: 'OPENAI',
    nav: 120,
    theme: 'Frontier AI demand is large, but governance, structure, revenue durability, and secondary pricing are the diligence center.',
    base: 1200,
    pressure: 620,
    riskNote: 'OpenAI-style exposure has exceptional narrative risk: access route, rights, governance, and valuation marks must be verified before sizing.',
    technicalSummary:
      'The card is a watchlist-only private-growth route that emphasizes source provenance and eligibility rather than pretending live market access exists.',
    humanSummary:
      'This should feel exciting but not casual: the product is the rights package and access path, not the headline name alone.'
  }),
  {
    id: 'msx-protected-growth-eth',
    name: 'RiskLens ETH Protected Growth',
    shortName: 'ETHPG',
    bucket: 'strategy',
    termType: 'closed',
    goals: ['income', 'bullish', 'public'],
    productType: 'Protected Growth',
    status: 'Demo strategy receipt / RiskLens structured wealth',
    liveTieIn: 'RiskLens-defined outcome receipt that turns ETH upside, downside buffer, and maturity settlement into one wealth product flow.',
    risk: 'Medium',
    apyRange: '14.00% outcome cap / 90-day modeled',
    annualYieldRate: 0.14,
    annualYieldBasis: 'Modeled outcome cap',
    annualYieldSource: 'Demo option-package model for a 90-day ETH defined-outcome receipt.',
    riskNote: 'This is not a guaranteed principal product. The buffer, cap, maturity date, and issuer or strategy risk must stay visible before subscription.',
    baseAsset: 'USDC subscription into an ETH defined-outcome receipt',
    underlying: 'ETH upside exposure with a modeled first-loss buffer and capped upside over a fixed 90-day term.',
    yieldSource: 'Structured option package that gives up part of upside to fund downside buffer and defined maturity payoff.',
    redemption: '90-day maturity. No ordinary early redemption in this demo; settlement is previewed at maturity.',
    suitableFor: 'Users who want ETH-linked upside but need a bounded payoff explanation before accepting term and cap risk.',
    worstCase: 'ETH breaches the buffer, option package marks down, or the user expects instant redemption during the term.',
    shareToken: 'ETHPG',
    nav: 10,
    minSubscription: 1000,
    dailyYieldRate: 0.00036,
    technicalSummary:
      'RiskLens ETH Protected Growth is modeled as a defined-outcome receipt. The wallet receives a position token, but the economics come from a fixed-term payoff rule rather than spot ETH ownership.',
    humanSummary:
      'This is for learning a protected-growth style payoff: you can participate in some ETH upside, but you trade away flexibility and some upside for a defined outcome.',
    scenario: {
      horizon: '90 days on 1,000 PT',
      conservative: '975 PT',
      base: '1,070 PT',
      pressure: '910 PT'
    },
    navHistory: {
      '7d': buildHistory(9.96, [0.02, -0.01, 0.04, 0.01, -0.02, 0.03, 0.01]),
      '30d': buildHistory(9.78, [0.05, -0.03, 0.06, 0.02, -0.04, 0.07, 0.01, 0.03, -0.02, 0.07]),
      '3m': buildHistory(9.55, [0.08, -0.05, 0.1, 0.04, -0.07, 0.11, 0.03, 0.06, -0.04, 0.09, 0.02, 0.08]),
      '6m': buildHistory(9.3, [0.1, -0.08, 0.12, 0.06, -0.09, 0.14, 0.04, 0.08, -0.06, 0.11, 0.05, 0.09])
    },
    fees: {
      management: 'Embedded strategy spread / demo terms',
      performance: 'Embedded in payoff cap',
      lockup: '90-day maturity / no early redemption'
    },
    shareRights: [
      'Represents a fixed-term defined-outcome receipt, not direct ETH ownership.',
      'Payoff depends on maturity observation, buffer, cap, and strategy terms.',
      'Receipt can be pledged in the demo only after the user understands maturity and settlement constraints.'
    ],
    diligenceScore: 78,
    diligenceChecks: [
      { label: 'Payoff clarity', status: 'Review', detail: 'Cap, buffer, maturity date, and worst-case path must be shown before buying.' },
      { label: 'Liquidity rule', status: 'Review', detail: 'No early redeem; users should preview settlement instead of seeing a generic redeem button.' },
      { label: 'Underlying risk', status: 'Pass', detail: 'ETH reference exposure is clear, but payoff is structured and capped.' },
      { label: 'Suitability gate', status: 'Review', detail: 'Best after the user has seen a replay or structured-product example.' }
    ],
    automation: [
      'Monitor ETH reference price versus buffer and cap.',
      'Show maturity countdown beside the receipt.',
      'Trigger a settlement preview before the observation date.'
    ]
  },
  {
    id: 'msx-premium-income-btc',
    name: 'RiskLens BTC Premium Income',
    shortName: 'BTCINC',
    bucket: 'strategy',
    termType: 'open',
    goals: ['income', 'highYield'],
    productType: 'Premium Income',
    status: 'Demo strategy receipt / RiskLens structured wealth',
    liveTieIn: 'RiskLens receipt that packages BTC option-premium style income into a monthly-cycle wealth product.',
    risk: 'Medium',
    apyRange: '8.00% to 18.00% modeled income',
    annualYieldRate: 0.12,
    annualYieldBasis: 'Modeled option-premium income',
    annualYieldSource: 'Demo covered-call and put-write style premium model over BTC-linked exposure.',
    riskNote: 'Income can be capped, reduced, or offset by BTC downside. Premium is not a stablecoin yield promise.',
    baseAsset: 'USDC subscription into BTC premium-income receipt',
    underlying: 'BTC-linked option-premium strategy with monthly cycle management.',
    yieldSource: 'Option-like premium from covered-call, put-write, or collar-style exposure after strategy costs.',
    redemption: 'Monthly option-cycle settlement. Redemption is routed after open exposure is closed or rolled.',
    suitableFor: 'Users who want income from BTC volatility and understand capped upside, conversion, and cycle settlement.',
    worstCase: 'BTC falls faster than premium income, upside is capped in a rally, or open option exposure delays exit.',
    shareToken: 'BTCINC',
    nav: 10.25,
    minSubscription: 1000,
    dailyYieldRate: 0.00031,
    technicalSummary:
      'RiskLens BTC Premium Income is modeled as a strategy receipt. The UI should explain the option-premium source and monthly cycle before presenting the income number.',
    humanSummary:
      'This is not regular interest. You are earning a modeled premium for accepting capped upside, downside exposure, and monthly settlement timing.',
    scenario: {
      horizon: '30 days on 1,000 PT',
      conservative: '985 PT',
      base: '1,011 PT',
      pressure: '930 PT'
    },
    navHistory: {
      '7d': buildHistory(10.18, [0.01, 0.02, -0.04, 0.03, 0.02, -0.01, 0.04]),
      '30d': buildHistory(10.02, [0.03, 0.02, -0.06, 0.05, 0.02, -0.03, 0.04, 0.03, -0.02, 0.05]),
      '3m': buildHistory(9.82, [0.06, 0.04, -0.09, 0.08, 0.05, -0.06, 0.07, 0.04, -0.03, 0.07, 0.03, 0.06]),
      '6m': buildHistory(9.58, [0.08, 0.05, -0.12, 0.1, 0.06, -0.08, 0.09, 0.06, -0.04, 0.08, 0.04, 0.07])
    },
    fees: {
      management: 'Embedded strategy spread / demo terms',
      performance: 'Embedded in premium capture',
      lockup: 'Monthly option cycle / routed redemption'
    },
    shareRights: [
      'Represents a managed premium-income strategy receipt, not a BTC savings account.',
      'Income, upside cap, and settlement timing depend on the active option cycle.',
      'Redemption should be shown as a routed cycle exit rather than instant withdraw.'
    ],
    diligenceScore: 80,
    diligenceChecks: [
      { label: 'Yield source', status: 'Pass', detail: 'Premium source is explicitly tied to option-like exposure.' },
      { label: 'Upside cap', status: 'Review', detail: 'The user must see that income can come with capped upside or conversion risk.' },
      { label: 'Liquidity timing', status: 'Review', detail: 'Exit follows monthly cycle handling, not always-on stablecoin redemption.' },
      { label: 'Stress case', status: 'Review', detail: 'BTC drawdown can dominate collected premium.' }
    ],
    automation: [
      'Monitor BTC movement versus premium collected.',
      'Show roll, settle, or exit choices near cycle end.',
      'Warn if capped-upside tradeoff becomes material.'
    ]
  },
  {
    id: 'msx-dual-btc-usdc',
    name: 'RiskLens BTC/USDC Dual Investment',
    shortName: 'BTCDUAL',
    bucket: 'strategy',
    termType: 'closed',
    goals: ['income', 'highYield'],
    productType: 'Dual Investment',
    status: 'Demo strategy receipt / RiskLens structured wealth',
    liveTieIn: 'RiskLens dual-investment receipt that teaches target-price settlement before a user treats high APR as simple yield.',
    risk: 'High',
    apyRange: '18.00% to 42.00% modeled premium',
    annualYieldRate: 0.32,
    annualYieldBasis: 'Modeled premium basis',
    annualYieldSource: 'Demo target-price settlement premium model for a 7-day BTC/USDC dual investment.',
    riskNote: 'The user may settle into BTC or USDC depending on target-price observation. High premium is compensation for that settlement risk.',
    baseAsset: 'USDC or BTC into target-price dual-investment receipt',
    underlying: 'BTC/USDC target-price settlement with buy-low or sell-high direction.',
    yieldSource: 'Option-like premium paid for accepting conditional settlement into the base or quote asset.',
    redemption: '7-day target-price settlement. No ordinary early redemption in this beginner flow.',
    suitableFor: 'Users who understand they may receive BTC instead of USDC, or USDC instead of BTC, at the observation date.',
    worstCase: 'BTC moves sharply through the target and the user dislikes the settlement asset received.',
    shareToken: 'BTCDUAL',
    nav: 10,
    minSubscription: 1000,
    dailyYieldRate: 0.00078,
    technicalSummary:
      'RiskLens BTC/USDC Dual Investment is modeled as a fixed observation product. The detail view should explain direction, target price, settlement asset, and premium before subscription.',
    humanSummary:
      'This is closer to a conditional BTC order with premium than a savings product. The important question is what asset you may receive at settlement.',
    scenario: {
      horizon: '7 days on 1,000 PT',
      conservative: '990 PT plus BTC settlement risk',
      base: '1,006 PT premium equivalent',
      pressure: 'BTC received below target'
    },
    navHistory: {
      '7d': buildHistory(10, [0.01, 0.01, -0.02, 0.02, 0.01, -0.01, 0.02]),
      '30d': buildHistory(9.94, [0.02, 0.02, -0.04, 0.03, 0.02, -0.03, 0.04, 0.02, -0.02, 0.04]),
      '3m': buildHistory(9.82, [0.04, 0.03, -0.06, 0.05, 0.03, -0.05, 0.06, 0.03, -0.03, 0.05, 0.02, 0.04]),
      '6m': buildHistory(9.7, [0.05, 0.04, -0.08, 0.07, 0.04, -0.06, 0.07, 0.04, -0.04, 0.06, 0.03, 0.05])
    },
    fees: {
      management: 'Embedded in quoted premium',
      performance: '0%',
      lockup: '7-day target-price settlement'
    },
    shareRights: [
      'Represents a conditional-settlement receipt, not a flexible yield token.',
      'Final asset depends on target price, direction, and observation date.',
      'The buy flow must show possible settlement asset before signing.'
    ],
    diligenceScore: 72,
    diligenceChecks: [
      { label: 'Settlement asset', status: 'Review', detail: 'The final asset must be clear before the user subscribes.' },
      { label: 'Premium framing', status: 'Pass', detail: 'Return label should be modeled premium, not annual yield.' },
      { label: 'Liquidity rule', status: 'Review', detail: 'No generic redeem path before target-price settlement.' },
      { label: 'Beginner fit', status: 'Review', detail: 'Better after the paper replay bridge or a guided example.' }
    ],
    automation: [
      'Show target price and observation date in the receipt.',
      'Preview both settlement outcomes.',
      'Warn when market price approaches the target.'
    ]
  },
  {
    id: 'msx-dual-eth-usdc',
    name: 'RiskLens ETH/USDC Dual Investment',
    shortName: 'ETHDUAL',
    bucket: 'strategy',
    termType: 'closed',
    goals: ['income', 'highYield'],
    productType: 'Dual Investment',
    status: 'Demo strategy receipt / RiskLens structured wealth',
    liveTieIn: 'RiskLens dual-investment receipt for ETH target-price settlement and premium education.',
    risk: 'High',
    apyRange: '16.00% to 36.00% modeled premium',
    annualYieldRate: 0.28,
    annualYieldBasis: 'Modeled premium basis',
    annualYieldSource: 'Demo target-price settlement premium model for a 7-day ETH/USDC dual investment.',
    riskNote: 'ETH settlement can flip the user between ETH and USDC at observation, so the asset received matters more than the APR label.',
    baseAsset: 'USDC or ETH into target-price dual-investment receipt',
    underlying: 'ETH/USDC target-price settlement with buy-low or sell-high direction.',
    yieldSource: 'Option-like premium for accepting conditional ETH or USDC settlement.',
    redemption: '7-day target-price settlement. No ordinary early redemption in this beginner flow.',
    suitableFor: 'Users who already want ETH exposure or a take-profit level and can tolerate settlement into the other asset.',
    worstCase: 'ETH moves through the target and the wallet receives the asset the user did not want at that moment.',
    shareToken: 'ETHDUAL',
    nav: 10,
    minSubscription: 1000,
    dailyYieldRate: 0.00068,
    technicalSummary:
      'RiskLens ETH/USDC Dual Investment uses the same receipt mechanics as the BTC version, but the payoff examples map to ETH spot levels and conversion risk.',
    humanSummary:
      'Use this when the user understands the target price and is comfortable ending the week with either ETH or USDC.',
    scenario: {
      horizon: '7 days on 1,000 PT',
      conservative: '992 PT plus ETH settlement risk',
      base: '1,005 PT premium equivalent',
      pressure: 'ETH received below target'
    },
    navHistory: {
      '7d': buildHistory(10, [0.01, 0, -0.01, 0.02, -0.01, 0.01, 0.02]),
      '30d': buildHistory(9.96, [0.01, 0.02, -0.03, 0.02, 0.02, -0.02, 0.03, 0.01, -0.01, 0.03]),
      '3m': buildHistory(9.86, [0.03, 0.02, -0.04, 0.04, 0.02, -0.04, 0.05, 0.02, -0.02, 0.04, 0.02, 0.03]),
      '6m': buildHistory(9.74, [0.04, 0.03, -0.06, 0.05, 0.03, -0.05, 0.06, 0.03, -0.03, 0.05, 0.02, 0.04])
    },
    fees: {
      management: 'Embedded in quoted premium',
      performance: '0%',
      lockup: '7-day target-price settlement'
    },
    shareRights: [
      'Represents a conditional-settlement ETH receipt, not a flexible yield token.',
      'Final asset depends on target price, direction, and observation date.',
      'The buy flow must show possible ETH or USDC settlement before signing.'
    ],
    diligenceScore: 71,
    diligenceChecks: [
      { label: 'Settlement asset', status: 'Review', detail: 'ETH or USDC payout must be explicit.' },
      { label: 'Premium framing', status: 'Pass', detail: 'Return is modeled premium, not deposit yield.' },
      { label: 'Liquidity rule', status: 'Review', detail: 'No generic redeem path before observation.' },
      { label: 'Beginner fit', status: 'Review', detail: 'Best after spot ETH replay makes entry and exit clear.' }
    ],
    automation: [
      'Show ETH target price and observation date in the receipt.',
      'Preview USDC and ETH settlement outcomes.',
      'Warn when ETH approaches the target.'
    ]
  },
  {
    id: 'msx-dual-sol-usdt',
    name: 'RiskLens SOL/USDT Dual Investment',
    shortName: 'SOLDUAL',
    bucket: 'strategy',
    termType: 'closed',
    goals: ['income', 'highYield'],
    productType: 'Dual Investment',
    status: 'Demo strategy receipt / RiskLens structured wealth',
    liveTieIn: 'RiskLens dual-investment receipt for a higher-volatility SOL target-price case.',
    risk: 'High',
    apyRange: '22.00% to 48.00% modeled premium',
    annualYieldRate: 0.38,
    annualYieldBasis: 'Modeled premium basis',
    annualYieldSource: 'Demo target-price settlement premium model for a 7-day SOL/USDT dual investment.',
    riskNote: 'SOL pays a higher modeled premium because the settlement asset can change quickly around the target price.',
    baseAsset: 'USDT or SOL into target-price dual-investment receipt',
    underlying: 'SOL/USDT target-price settlement with buy-low or sell-high direction.',
    yieldSource: 'Higher option-like premium for accepting volatile conditional settlement.',
    redemption: '7-day target-price settlement. No ordinary early redemption in this beginner flow.',
    suitableFor: 'Users who understand SOL volatility and only want the product if the target conversion price is acceptable.',
    worstCase: 'SOL crosses the target during a volatile week and the wallet receives the less desired asset.',
    shareToken: 'SOLDUAL',
    nav: 10,
    minSubscription: 1000,
    dailyYieldRate: 0.00092,
    technicalSummary:
      'RiskLens SOL/USDT Dual Investment keeps the same receipt mechanics but uses a more volatile pair so conversion risk is easier to see.',
    humanSummary:
      'This is the higher-volatility teaching version: the premium is larger, but so is the chance that settlement asset surprises the user.',
    scenario: {
      horizon: '7 days on 1,000 PT',
      conservative: '986 PT plus SOL settlement risk',
      base: '1,007 PT premium equivalent',
      pressure: 'SOL received below target'
    },
    navHistory: {
      '7d': buildHistory(10, [0.02, -0.01, -0.02, 0.03, 0.01, -0.02, 0.03]),
      '30d': buildHistory(9.9, [0.03, 0.03, -0.05, 0.04, 0.02, -0.04, 0.06, 0.02, -0.03, 0.05]),
      '3m': buildHistory(9.76, [0.05, 0.04, -0.08, 0.06, 0.03, -0.06, 0.08, 0.04, -0.05, 0.07, 0.02, 0.05]),
      '6m': buildHistory(9.6, [0.06, 0.05, -0.1, 0.08, 0.04, -0.08, 0.1, 0.05, -0.06, 0.08, 0.03, 0.07])
    },
    fees: {
      management: 'Embedded in quoted premium',
      performance: '0%',
      lockup: '7-day target-price settlement'
    },
    shareRights: [
      'Represents a conditional-settlement SOL receipt, not a flexible yield token.',
      'Final asset depends on target price, direction, and observation date.',
      'The buy flow must show possible SOL or USDT settlement before signing.'
    ],
    diligenceScore: 67,
    diligenceChecks: [
      { label: 'Settlement asset', status: 'Review', detail: 'SOL or USDT payout must be explicit.' },
      { label: 'Premium framing', status: 'Pass', detail: 'Premium is compensation for volatility and conversion risk.' },
      { label: 'Liquidity rule', status: 'Review', detail: 'No generic redeem path before observation.' },
      { label: 'Beginner fit', status: 'Review', detail: 'Use after the user has seen lower-volatility dual examples.' }
    ],
    automation: [
      'Show SOL target price and observation date in the receipt.',
      'Preview USDT and SOL settlement outcomes.',
      'Warn when SOL approaches the target.'
    ]
  },
  {
    id: 'msx-autocall-index',
    name: 'RiskLens Index Auto-Call Yield',
    shortName: 'INDEXAC',
    bucket: 'strategy',
    termType: 'closed',
    goals: ['income', 'auto', 'highYield'],
    productType: 'Auto-Call',
    status: 'Demo strategy receipt / RiskLens structured wealth',
    liveTieIn: 'RiskLens auto-call receipt that converts barrier, coupon, and observation-date logic into a wealth product detail flow.',
    risk: 'High',
    apyRange: '9.00% conditional coupon / modeled',
    annualYieldRate: 0.09,
    annualYieldBasis: 'Modeled conditional coupon',
    annualYieldSource: 'Demo monthly observation model for a crypto index auto-call note.',
    riskNote: 'Coupons are conditional and the product can remain outstanding until call or maturity. Barrier and knock-in logic must be visible.',
    baseAsset: 'USDC subscription into crypto index auto-call receipt',
    underlying: 'RiskLens modeled BTC/ETH/index basket with monthly observation dates.',
    yieldSource: 'Conditional coupon funded by structured exposure to index level, call barrier, and maturity outcome.',
    redemption: 'Monthly observation with 12-month max term. No ordinary early redemption before call or maturity.',
    suitableFor: 'Users who can follow observation dates, coupon barriers, knock-in risk, and maturity settlement.',
    worstCase: 'Index breaches downside barrier, coupons are missed, and the note remains locked until maturity with lower value.',
    shareToken: 'INDEXAC',
    nav: 10,
    minSubscription: 2500,
    dailyYieldRate: 0.00024,
    technicalSummary:
      'RiskLens Index Auto-Call Yield is modeled as an observation-date product. It belongs in Wealth only when the UI shows call schedule, coupon condition, and maturity behavior together.',
    humanSummary:
      'This is a timeline product. You watch observation dates and coupon conditions, then settle when the note calls or matures.',
    scenario: {
      horizon: '12 months on 1,000 PT',
      conservative: '960 PT',
      base: '1,090 PT',
      pressure: '820 PT'
    },
    navHistory: {
      '7d': buildHistory(9.98, [0.01, -0.01, 0.02, 0, -0.02, 0.02, 0.01]),
      '30d': buildHistory(9.9, [0.03, -0.02, 0.04, 0.01, -0.04, 0.05, 0.01, 0.02, -0.03, 0.04]),
      '3m': buildHistory(9.76, [0.05, -0.04, 0.07, 0.02, -0.06, 0.08, 0.02, 0.04, -0.05, 0.07, 0.01, 0.06]),
      '6m': buildHistory(9.55, [0.07, -0.06, 0.09, 0.03, -0.08, 0.1, 0.03, 0.06, -0.07, 0.08, 0.02, 0.07])
    },
    fees: {
      management: 'Embedded in structured note terms',
      performance: '0%',
      lockup: 'Observation dates / 12-month max term'
    },
    shareRights: [
      'Represents conditional coupon exposure with observation-date mechanics.',
      'Call, coupon, knock-in, and maturity conditions govern the receipt.',
      'The UI should show settle or roll, not a generic daily redeem button.'
    ],
    diligenceScore: 69,
    diligenceChecks: [
      { label: 'Observation schedule', status: 'Review', detail: 'Monthly observation dates must be easy to inspect.' },
      { label: 'Coupon condition', status: 'Review', detail: 'Coupon is conditional, not fixed cash yield.' },
      { label: 'Barrier risk', status: 'Review', detail: 'Downside barrier and maturity loss path must be visible.' },
      { label: 'Beginner fit', status: 'Review', detail: 'Best paired with paper replay before live subscription.' }
    ],
    automation: [
      'Track index level versus call and downside barriers.',
      'Notify before each monthly observation date.',
      'Preview coupon, call, and maturity outcomes in the receipt flow.'
    ]
  }
];

const HIDDEN_WEALTH_PRODUCT_IDS = new Set(['franklin-fobxx', 'xstocks-public-holdings']);

export const WEALTH_PRODUCTS = RAW_WEALTH_PRODUCTS.filter((product) => !HIDDEN_WEALTH_PRODUCT_IDS.has(product.id));

export function getGoalById(goalId) {
  return GOAL_OPTIONS.find((goal) => goal.id === goalId) || GOAL_OPTIONS[0];
}

export function getProductById(productId) {
  return WEALTH_PRODUCTS.find((product) => product.id === productId) || WEALTH_PRODUCTS[0];
}
