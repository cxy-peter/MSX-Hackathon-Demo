const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const STARTING_PAPER_TOKENS = 100000;
export const BADGE_REWARD_TOKENS = 5000;
export const MIN_PAPER_TRADE = 100;

export const PAPER_LANE_OPTIONS = [
  { id: 'all', label: 'All assets' },
  { id: 'funding', label: 'Cash & Treasury' },
  { id: 'public', label: 'Spot & xStocks' },
  { id: 'leverage', label: 'Leveraged routes' }
];

export const PAPER_INTERVALS = {
  '1H': {
    id: '1H',
    label: '1 hour',
    ms: HOUR_MS,
    coinbaseGranularity: 'ONE_HOUR'
  },
  '6H': {
    id: '6H',
    label: '6 hour',
    ms: 6 * HOUR_MS,
    coinbaseGranularity: 'SIX_HOUR'
  },
  '1D': {
    id: '1D',
    label: '1 day',
    ms: DAY_MS,
    coinbaseGranularity: 'ONE_DAY'
  }
};

export const PAPER_RANGES_BY_INTERVAL = {
  '1H': [
    { id: '3D', label: '3 days', bars: 72 },
    { id: '1W', label: '1 week', bars: 168 },
    { id: '2W', label: '2 weeks', bars: 336 }
  ],
  '6H': [
    { id: '2W', label: '2 weeks', bars: 56 },
    { id: '1M', label: '1 month', bars: 120 },
    { id: '2M', label: '2 months', bars: 240 }
  ],
  '1D': [
    { id: '1M', label: '1 month', bars: 30 },
    { id: '3M', label: '3 months', bars: 90 },
    { id: '6M', label: '6 months', bars: 180 },
    { id: '1Y', label: '1 year', bars: 365 }
  ]
};

export const PAPER_PLAYBACK_SPEEDS = [
  { id: 'slow', label: 'Slow', ms: 1200 },
  { id: 'normal', label: 'Normal', ms: 650 },
  { id: 'fast', label: 'Fast', ms: 260 }
];

const CORE_PAPER_PRODUCTS = [
  {
    id: 'msx-stable-income',
    ticker: 'USTB',
    name: 'USTB Treasury Reserve',
    lane: 'funding',
    risk: 'Low',
    productType: 'Tokenized treasuries / cash rail',
    sourceType: 'local',
    sourceLabel: 'Bundled Superstate USTB 90D NAV history',
    csvPath: '/replay-data/USTB_1d.csv',
    csvInterval: '1D',
    defaultInterval: '1D',
    defaultRange: '3M',
    intervalOptions: ['1D'],
    costModel: {
      makerFeeBps: 0,
      takerFeeBps: 0,
      tradeFeeBps: 0,
      spreadBps: 2,
      fxBps: 4,
      channelBps: 4,
      annualCarryBps: 0,
      shortTermTaxRate: 0.24,
      longTermTaxRate: 0.15,
      incomeTaxRate: 0.24,
      taxTreatment: 'yield-income'
    },
    fallback: {
      price: 1.014,
      drift: 0.00016,
      volatility: 0.0011,
      volumeBase: 160000,
      minPrice: 0.985
    },
    fit: 'Users who first need to understand funding rails, stable balances, and low-volatility parking money.',
    humanSummary:
      'This is the low-vol treasury cash rail. The point is to show how tokenized T-bill exposure behaves when the user wants settlement, reserve parking, or collateral-like stability before moving into higher-beta products.',
    technicalSummary:
      'Replay bars use bundled recent USTB NAV history instead of a synthetic order-book path, so the line reflects tokenized short-duration government securities rather than a noisy trading chart.',
    returnSource: 'Short-duration U.S. Treasury bill exposure and daily fund accrual.',
    worstCase: 'Short rates fall, the discount to exit widens, or settlement frictions make a low-vol product feel less liquid than expected.',
    whyItMatters:
      'Users usually start with where capital sits before they decide what to buy. This rail makes tokenized treasury parking and settlement cash a first-class product.'
  },
  {
    id: 'msx-income-ladder',
    ticker: 'USCC',
    name: 'USCC Crypto Carry Fund',
    lane: 'yield',
    risk: 'Low',
    productType: 'Yield route / tokenized carry fund',
    sourceType: 'local',
    sourceLabel: 'Bundled Superstate USCC 90D NAV history',
    csvPath: '/replay-data/USCC_1d.csv',
    csvInterval: '1D',
    defaultInterval: '1D',
    defaultRange: '3M',
    intervalOptions: ['1D'],
    costModel: {
      makerFeeBps: 0,
      takerFeeBps: 0,
      tradeFeeBps: 0,
      spreadBps: 4,
      fxBps: 4,
      channelBps: 6,
      annualCarryBps: 0,
      shortTermTaxRate: 0.24,
      longTermTaxRate: 0.15,
      incomeTaxRate: 0.24,
      taxTreatment: 'mixed-income'
    },
    fallback: {
      price: 1.039,
      drift: 0.00024,
      volatility: 0.0018,
      volumeBase: 120000,
      minPrice: 0.97
    },
    fit: 'Users comparing flexible cash products against term-style treasury and yield sleeves.',
    humanSummary:
      'This lane is for an onchain carry fund. The user is not buying plain treasuries or a stock beta chart; they are buying a yield route built from cash-and-carry logic, collateral, and treasury support.',
    technicalSummary:
      'Replay bars use bundled recent USCC NAV history so the path reflects an actual tokenized fund rather than a synthetic ladder. The strategy layer still needs separate diligence because the NAV includes carry trades, treasury support, and crypto collateral dynamics.',
    returnSource: 'Crypto cash-and-carry basis plus treasury-backed cash management inside the fund.',
    worstCase: 'Basis compresses, strategy risk leaks through the wrapper, or liquidity is available but the yield edge no longer compensates for the complexity.',
    whyItMatters:
      'This teaches that higher yield usually comes from structure, basis, and strategy implementation, not from free money.'
  },
  {
    id: 'aaplx',
    ticker: 'AAPLx',
    name: 'AAPLx Tokenized Public Equity',
    lane: 'public',
    risk: 'Medium',
    productType: 'Tokenized stocks / public equities',
    sourceType: 'twelvedata',
    sourceLabel: 'Bundled Apple 1Y daily history',
    quoteSyncUrl: 'https://api.xstocks.fi/api/v2/public/assets/AAPLx/price-data',
    quoteSyncLabel: 'xStocks public quote sync',
    remoteSymbol: 'AAPL',
    csvPath: '/replay-data/AAPL_1d.csv',
    csvInterval: '1D',
    defaultInterval: '1D',
    defaultRange: '6M',
    intervalOptions: ['1D'],
    costModel: {
      makerFeeBps: 0,
      takerFeeBps: 0,
      tradeFeeBps: 0,
      spreadBps: 100,
      fxBps: 6,
      channelBps: 4,
      annualCarryBps: 15,
      regulatoryClass: 'equity',
      shortTermTaxRate: 0.24,
      longTermTaxRate: 0.15,
      incomeTaxRate: 0.24,
      taxTreatment: 'capital-gains'
    },
    fallback: {
      price: 198,
      drift: 0.0008,
      volatility: 0.022,
      volumeBase: 860000,
      minPrice: 70
    },
    fit: 'Users who already understand public equity risk and now need to inspect token wrapper terms.',
    humanSummary:
      'This is the tokenized public-asset lane. The price broadly follows Apple, but what the user really has to learn is wrapper rights, settlement path, liquidity, and corporate-action handling.',
    technicalSummary:
      'The replay uses bundled Apple history as the base path, then syncs the current display level against the public xStocks quote so the token wrapper sits closer to live market reality.',
    returnSource: 'Single-name equity exposure expressed through a tokenized wrapper.',
    worstCase: 'The stock falls, wrapper spreads widen, or the user mistakes economic tracking for direct shareholder rights.',
    whyItMatters:
      'This keeps public liquid markets separate from cash products and private deals, which is how users actually think about risk.'
  },
  {
    id: 'eth-usd',
    ticker: 'ETH-USD',
    name: 'ETH Spot Benchmark',
    lane: 'public',
    risk: 'High',
    productType: 'Crypto spot / public market benchmark',
    sourceType: 'coinbase',
    sourceLabel: 'Bundled ETH spot hourly history',
    remoteSymbol: 'ETH-USD',
    csvPath: '/replay-data/ETHUSDT_1h.csv',
    csvInterval: '1H',
    defaultInterval: '6H',
    defaultRange: '1M',
    intervalOptions: ['1H', '6H', '1D'],
    costModel: {
      makerFeeBps: 10,
      takerFeeBps: 25,
      tradeFeeBps: 25,
      spreadBps: 6,
      fxBps: 0,
      channelBps: 0,
      annualCarryBps: 0,
      shortTermTaxRate: 0.24,
      longTermTaxRate: 0.15,
      incomeTaxRate: 0.24,
      taxTreatment: 'capital-gains'
    },
    fallback: {
      price: 3600,
      drift: 0.0011,
      volatility: 0.032,
      volumeBase: 4400,
      minPrice: 600
    },
    fit: 'Users who need a recognizable liquid crypto benchmark beside tokenized assets and private deals.',
    humanSummary:
      'This is the plain crypto-spot benchmark. It exists so the user can compare a familiar liquid market against tokenized public assets, private deals, and yield products.',
    technicalSummary:
      'The replay uses bundled hourly ETH spot data and can aggregate it into longer windows. It is a reference market, not a structured or yield wrapper.',
    returnSource: 'Spot crypto direction, volatility, and sentiment shifts.',
    worstCase: 'The user over-focuses on short-term volatility and forgets that spot is not the same thing as staking, leverage, or a structured yield product.',
    whyItMatters:
      'A paper lab needs one clean crypto benchmark so every more complex wrapper can be explained against it.'
  },
  {
    id: 'preipo-window',
    ticker: 'SPACE-X',
    name: 'SpaceX Late-stage Window',
    lane: 'private',
    risk: 'High',
    productType: 'Private market / pre-IPO equity',
    sourceType: 'local',
    sourceLabel: 'Local pre-IPO replay proxy',
    defaultInterval: '1D',
    defaultRange: '1Y',
    intervalOptions: ['1D'],
    replayModel: 'private-window',
    costModel: {
      tradeFeeBps: 35,
      spreadBps: 45,
      fxBps: 15,
      channelBps: 18,
      annualCarryBps: 20,
      shortTermTaxRate: 0.24,
      longTermTaxRate: 0.15,
      incomeTaxRate: 0.24,
      taxTreatment: 'mixed-income'
    },
    fallback: {
      price: 38,
      drift: 0.00085,
      volatility: 0.021,
      volumeBase: 24000,
      minPrice: 12
    },
    fit: 'Users curious about private-market upside but who need to learn lockups, valuation opacity, and exit risk first.',
    humanSummary:
      'This lane is for late-stage private-market exposure. The point is not day trading. The point is to show how valuation, liquidity, and exit assumptions make private deals feel different from listed markets.',
    technicalSummary:
      'Replay bars are synthetic because private-market quotes are not a clean public order book. The path acts as a valuation proxy with slower information flow and sudden repricing windows.',
    returnSource: 'Company valuation rerates, funding-round marks, and eventual exit optionality.',
    worstCase: 'The company never exits, liquidity stays shut, or the mark drops sharply when a real funding event finally happens.',
    whyItMatters:
      'Pre-IPO should not sit beside listed equities as if both are the same thing. It needs its own product lane and its own teaching surface.'
  },
  {
    id: 'btc-usd',
    ticker: 'BTC-PERP',
    name: 'BTC Perpetual Tutorial',
    lane: 'leverage',
    risk: 'High',
    productType: 'Leverage / hedging / BTC perp route',
    sourceType: 'coinbase',
    sourceLabel: 'Bundled Binance hourly CSV',
    remoteSymbol: 'BTC-USD',
    csvPath: '/replay-data/BTCUSDT_1h.csv',
    csvInterval: '1H',
    defaultInterval: '1H',
    defaultRange: '1W',
    intervalOptions: ['1H', '6H', '1D'],
    costModel: {
      makerFeeBps: 10,
      takerFeeBps: 20,
      tradeFeeBps: 20,
      spreadBps: 8,
      fxBps: 0,
      channelBps: 4,
      annualCarryBps: 0,
      shortTermTaxRate: 0.24,
      longTermTaxRate: 0.15,
      incomeTaxRate: 0.24,
      taxTreatment: 'capital-gains'
    },
    fallback: {
      price: 72000,
      drift: 0.0012,
      volatility: 0.028,
      volumeBase: 3200,
      minPrice: 12000
    },
    fit: 'Users practicing directional conviction, liquidation math, and why leverage is its own product family.',
    humanSummary:
      'This lane is not plain BTC spot. It is a tutorial for leveraged thinking: liquidation bands, fee drag, and why the same market move feels different once a perp wrapper sits on top.',
    technicalSummary:
      'Replay bars use BTC spot as the price reference, but the product framing, fee assumptions, and contract sandbox teach a perpetual-style route rather than simple spot ownership.',
    returnSource: 'Directional BTC move amplified by leverage and shaped by fee and liquidation path.',
    worstCase: 'A routine move becomes a liquidation event, or fees and timing destroy an otherwise correct market call.',
    whyItMatters:
      'Leverage products need their own lane because users are buying a risk structure, not just an asset ticker.'
  },
  {
    id: 'tslax',
    ticker: 'TSLA-TWIN',
    name: 'TSLA Range Twin-Win Note',
    lane: 'strategy',
    risk: 'High',
    productType: 'Structured note / equity-linked payoff',
    sourceType: 'twelvedata',
    sourceLabel: 'Bundled Yahoo Finance daily CSV proxy',
    remoteSymbol: 'TSLA',
    csvPath: '/replay-data/TSLA_1d.csv',
    csvInterval: '1D',
    defaultInterval: '1D',
    defaultRange: '6M',
    intervalOptions: ['1D'],
    costModel: {
      tradeFeeBps: 18,
      spreadBps: 22,
      fxBps: 14,
      channelBps: 16,
      annualCarryBps: 55,
      shortTermTaxRate: 0.24,
      longTermTaxRate: 0.15,
      incomeTaxRate: 0.24,
      taxTreatment: 'mixed-income'
    },
    fallback: {
      price: 186,
      drift: 0.0011,
      volatility: 0.045,
      volumeBase: 1100000,
      minPrice: 40
    },
    fit: 'Users who need to learn that payoff diagrams, barriers, and term sheets matter more than a headline yield.',
    humanSummary:
      'This is the structured-product lane. The underlying story may be TSLA, but what the user is really buying is a payoff shape with conditions, caps, and downside rules.',
    technicalSummary:
      'The replay uses a TSLA-based proxy path to keep market behavior intuitive, while the product explanation stays focused on note structure, not direct stock ownership.',
    returnSource: 'Option premium, path dependence, and the final note settlement formula.',
    worstCase: 'The underlying moves the wrong way for the payoff, barriers trigger, and the user learns too late that headline yield came with hidden conditions.',
    whyItMatters:
      'Structured products should never sit inside plain yield. They need a separate lane because the payoff itself is the product.'
  },
  {
    id: 'ai-rotation',
    ticker: 'AI-ROT',
    name: 'AI Rotation Basket',
    lane: 'ai',
    risk: 'Medium',
    productType: 'AI / automation',
    sourceType: 'local',
    sourceLabel: 'Local AI strategy replay proxy',
    defaultInterval: '1D',
    defaultRange: '6M',
    intervalOptions: ['1D'],
    replayModel: 'ai-rotation',
    costModel: {
      tradeFeeBps: 9,
      spreadBps: 10,
      fxBps: 8,
      channelBps: 4,
      annualCarryBps: 18,
      shortTermTaxRate: 0.24,
      longTermTaxRate: 0.15,
      incomeTaxRate: 0.24,
      taxTreatment: 'capital-gains'
    },
    fallback: {
      price: 112,
      drift: 0.0007,
      volatility: 0.013,
      volumeBase: 180000,
      minPrice: 72
    },
    fit: 'Users who want model-assisted allocation but still need to see where automation ends and human responsibility starts.',
    humanSummary:
      'This lane is for AI and automation. The point is not to pretend the model is magic. The point is to show what a strategy basket does, what data it uses, and where a human still has to judge the risk.',
    technicalSummary:
      'Replay bars model a rebalanced strategy basket with smoother trend-following periods plus occasional model misses and rebalance drag.',
    returnSource: 'Model-driven allocation changes, rebalance timing, and execution quality.',
    worstCase: 'The model drifts, reacts too late, or overfits old regimes while the user treats it like guaranteed intelligence.',
    whyItMatters:
      'If AI is in the product, users need a dedicated lane that discloses model scope, failure modes, and fallback rules.'
  }
];

function createCsvReplayProduct(product) {
  return {
    sourceType: 'local',
    csvInterval: '1D',
    defaultInterval: '1D',
    defaultRange: '6M',
    intervalOptions: ['1D'],
    ...product
  };
}

function createLocalReplayProduct(product) {
  return {
    sourceType: 'local',
    defaultInterval: '1D',
    defaultRange: '1Y',
    intervalOptions: ['1D'],
    ...product
  };
}

const ADDITIONAL_PAPER_PRODUCTS = [
  ...[
    {
      id: 'benji-fobxx',
      ticker: 'BENJI',
      name: 'Franklin BENJI Cash Fund',
      lane: 'funding',
      risk: 'Low',
      productType: 'Tokenized money fund / cash rail',
      sourceLabel: 'Bundled Franklin FOBXX 1Y daily NAV history',
      csvPath: '/replay-data/FOBXX_1d.csv',
      defaultRange: '3M',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 2,
        fxBps: 4,
        channelBps: 4,
        annualCarryBps: 0,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'yield-income'
      },
      fallback: {
        price: 1,
        drift: 0.0001,
        volatility: 0.0007,
        volumeBase: 90000,
        minPrice: 0.995
      },
      fit: 'Users who want a real tokenized cash sleeve with onchain transferability and money-fund style behavior.',
      humanSummary:
        'BENJI is Franklin Templeton\'s tokenized money-fund route, so the user is learning how onchain cash behaves when the legal asset is still a traditional government money fund share.',
      technicalSummary:
        'Replay bars use bundled FOBXX daily NAV history because BENJI maps one-to-one to fund shares rather than to a continuously traded secondary market.',
      returnSource: 'Government money-market yield accrued through the underlying Franklin OnChain U.S. Government Money Fund.',
      worstCase: 'Yield falls with rates, redemption timing matters, or users mistake transferability for instant secondary liquidity.',
      whyItMatters:
        'This product shows how a tokenized cash rail can feel familiar in price but still introduce new wallet, transfer, and settlement behavior.'
    },
    {
      id: 'ondo-ousg',
      ticker: 'OUSG',
      name: 'Ondo Short-Term Treasuries',
      lane: 'funding',
      risk: 'Low',
      productType: 'Tokenized treasuries / cash rail',
      sourceLabel: 'Bundled 1Y SGOV daily proxy for Ondo OUSG',
      csvPath: '/replay-data/SGOV_1d.csv',
      defaultRange: '3M',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 3,
        fxBps: 4,
        channelBps: 5,
        annualCarryBps: 0,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'yield-income'
      },
      fallback: {
        price: 1.02,
        drift: 0.00013,
        volatility: 0.001,
        volumeBase: 70000,
        minPrice: 0.99
      },
      fit: 'Users who want tokenized T-bill exposure but still need to inspect redemption mechanics, wrappers, and eligible venue paths.',
      humanSummary:
        'OUSG is a tokenized treasury access product, so the learning goal is less about volatility and more about how the reserve sleeve, wrapper, and redemption route fit together.',
      technicalSummary:
        'Issuer-level public OHLC history is limited, so the replay uses bundled SGOV daily history as a transparent short-duration Treasury proxy for the underlying rate path.',
      returnSource: 'Short-duration U.S. Treasury exposure expressed through an onchain wrapper.',
      worstCase: 'Short rates compress, the wrapper adds friction, or funding and redemption assumptions prove stricter than the user expected.',
      whyItMatters:
        'It helps users separate treasury duration risk from token wrapper and access-path risk.'
    },
    {
      id: 'ondo-usdy',
      ticker: 'USDY',
      name: 'Ondo US Dollar Yield',
      lane: 'funding',
      risk: 'Low',
      productType: 'Yield-bearing dollar / treasury note',
      sourceLabel: 'Bundled 1Y USFR daily proxy for Ondo USDY',
      csvPath: '/replay-data/USFR_1d.csv',
      defaultRange: '3M',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 3,
        fxBps: 4,
        channelBps: 5,
        annualCarryBps: 0,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'yield-income'
      },
      fallback: {
        price: 1.08,
        drift: 0.00014,
        volatility: 0.0011,
        volumeBase: 76000,
        minPrice: 1
      },
      fit: 'Users comparing stablecoin-like UX against treasury-backed yield tokens.',
      humanSummary:
        'USDY is designed to feel closer to a yield-bearing dollar than to a trading token, which makes it a good bridge product between settlement cash and treasury wrappers.',
      technicalSummary:
        'Replay bars use bundled USFR daily history as a floating-rate treasury proxy because issuer-level candle history is not broadly distributed as an exchange-style tape.',
      returnSource: 'Treasury-backed yield that accrues into a dollar-denominated token wrapper.',
      worstCase: 'Funding friction, compliance gating, or a misunderstanding of redemption eligibility makes a stable-looking product harder to use than expected.',
      whyItMatters:
        'This teaches that a yield-bearing dollar is still a product with eligibility, route, and wrapper assumptions.'
    },
    {
      id: 'buidl-cash',
      ticker: 'BUIDL',
      name: 'BlackRock BUIDL Liquidity Fund',
      lane: 'funding',
      risk: 'Low',
      productType: 'Tokenized institutional cash fund',
      sourceLabel: 'Bundled 1Y BIL daily proxy for BlackRock BUIDL',
      csvPath: '/replay-data/BIL_1d.csv',
      defaultRange: '3M',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 2,
        fxBps: 3,
        channelBps: 5,
        annualCarryBps: 0,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'yield-income'
      },
      fallback: {
        price: 1,
        drift: 0.00011,
        volatility: 0.0009,
        volumeBase: 64000,
        minPrice: 0.997
      },
      fit: 'Users evaluating institutional-grade tokenized cash products as collateral or treasury management tools.',
      humanSummary:
        'BUIDL is a tokenized institutional liquidity sleeve, so the user is comparing an onchain fund wrapper against the simpler mental model of cash or T-bills.',
      technicalSummary:
        'Replay bars use bundled BIL daily history as a short-bill proxy so the fund path stays grounded in recent cash-equivalent market moves rather than a synthetic flat line.',
      returnSource: 'Institutional cash management and short-duration U.S. government exposure.',
      worstCase: 'Access remains institution-only, secondary liquidity is thinner than expected, or the user overestimates instant exitability.',
      whyItMatters:
        'It keeps the treasury-management side of RWA on the shelf instead of forcing every user straight into equity beta.'
    },
    {
      id: 'backed-ib01',
      ticker: 'bIB01',
      name: 'Backed IB01 Treasury Tracker',
      lane: 'funding',
      risk: 'Low',
      productType: 'Tokenized treasury ETF tracker',
      sourceLabel: 'Bundled 1Y IB01 UCITS ETF daily proxy',
      csvPath: '/replay-data/IB01_1d.csv',
      defaultRange: '3M',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 4,
        fxBps: 4,
        channelBps: 6,
        annualCarryBps: 10,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'yield-income'
      },
      fallback: {
        price: 129,
        drift: 0.00012,
        volatility: 0.0016,
        volumeBase: 48000,
        minPrice: 120
      },
      fit: 'Users who want a tokenized bond ETF tracker instead of a fund-share style cash product.',
      humanSummary:
        'bIB01 tracks a 0-1 year treasury ETF, so it sits between pure cash rails and longer-duration bond products.',
      technicalSummary:
        'Replay bars use bundled IB01 UCITS ETF history, which makes the chart a transparent underlying proxy for the tokenized tracker certificate.',
      returnSource: 'Short-duration Treasury ETF performance wrapped into a transferable token format.',
      worstCase: 'Users assume money-fund stability while the tracker still reflects ETF mark-to-market behavior and wrapper costs.',
      whyItMatters:
        'It widens the funding lane from pure cash funds into tokenized short-bond trackers.'
    }
  ].map((product) => createCsvReplayProduct(product)),
  ...[
    {
      id: 'jepi-income',
      ticker: 'JEPI',
      name: 'JEPI Equity Premium Income',
      lane: 'yield',
      risk: 'Medium',
      productType: 'Option-income ETF / yield route',
      sourceLabel: 'Bundled 1Y JEPI daily history',
      csvPath: '/replay-data/JEPI_1d.csv',
      costModel: {
        tradeFeeBps: 8,
        spreadBps: 10,
        fxBps: 4,
        channelBps: 4,
        annualCarryBps: 20,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 57,
        drift: 0.00035,
        volatility: 0.013,
        volumeBase: 260000,
        minPrice: 38
      },
      fit: 'Users who want a familiar listed yield route before moving into tokenized strategy wrappers.',
      humanSummary:
        'JEPI is a public-market income route built from equity exposure plus option premium, which makes it a good benchmark for comparing yield against capped upside.',
      technicalSummary:
        'Replay bars use bundled daily ETF history, so the chart reflects an actual listed income strategy rather than a synthetic coupon story.',
      returnSource: 'Equity exposure plus option-premium income distributed through the ETF structure.',
      worstCase: 'The market falls, option income does not offset losses, or a high distribution rate gets mistaken for principal protection.',
      whyItMatters:
        'It teaches that yield products often trade off upside, distribution stability, and path dependence.'
    },
    {
      id: 'jepq-income',
      ticker: 'JEPQ',
      name: 'JEPQ Nasdaq Premium Income',
      lane: 'yield',
      risk: 'Medium',
      productType: 'Option-income ETF / yield route',
      sourceLabel: 'Bundled 1Y JEPQ daily history',
      csvPath: '/replay-data/JEPQ_1d.csv',
      costModel: {
        tradeFeeBps: 8,
        spreadBps: 10,
        fxBps: 4,
        channelBps: 4,
        annualCarryBps: 24,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 55,
        drift: 0.00042,
        volatility: 0.015,
        volumeBase: 240000,
        minPrice: 36
      },
      fit: 'Users comparing tech-heavy income products against plain growth exposure.',
      humanSummary:
        'JEPQ wraps Nasdaq exposure with option income, which makes it a clean public benchmark for yield routes tied to a higher-beta equity basket.',
      technicalSummary:
        'Replay bars use bundled daily ETF history so the trade-off between income and growth is visible in a real market path.',
      returnSource: 'Nasdaq-linked equity exposure plus option-premium income.',
      worstCase: 'Growth underperforms, upside gets capped, or the distribution headline hides a much noisier total-return path.',
      whyItMatters:
        'It helps users compare an income route against pure beta instead of treating yield as a free overlay.'
    },
    {
      id: 'qyld-income',
      ticker: 'QYLD',
      name: 'QYLD Covered Call Route',
      lane: 'yield',
      risk: 'Medium',
      productType: 'Covered-call ETF / yield route',
      sourceLabel: 'Bundled 1Y QYLD daily history',
      csvPath: '/replay-data/QYLD_1d.csv',
      costModel: {
        tradeFeeBps: 8,
        spreadBps: 12,
        fxBps: 4,
        channelBps: 4,
        annualCarryBps: 28,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 18,
        drift: 0.00018,
        volatility: 0.012,
        volumeBase: 210000,
        minPrice: 12
      },
      fit: 'Users who want to understand high-distribution equity products without pretending the price path disappears.',
      humanSummary:
        'QYLD is a listed covered-call route, so it shows how a high payout often comes with upside limits and slower NAV recovery.',
      technicalSummary:
        'Replay bars use bundled ETF history so the yield route stays anchored to actual listed-market behavior.',
      returnSource: 'Nasdaq-100 exposure paired with systematic call selling.',
      worstCase: 'Distributions stay visible while the net asset value drifts lower and the user mistakes payout for net return.',
      whyItMatters:
        'It is one of the clearest public examples of why headline income needs a take-home lens.'
    },
    {
      id: 'xyld-income',
      ticker: 'XYLD',
      name: 'XYLD Covered Call Route',
      lane: 'yield',
      risk: 'Medium',
      productType: 'Covered-call ETF / yield route',
      sourceLabel: 'Bundled 1Y XYLD daily history',
      csvPath: '/replay-data/XYLD_1d.csv',
      costModel: {
        tradeFeeBps: 8,
        spreadBps: 11,
        fxBps: 4,
        channelBps: 4,
        annualCarryBps: 24,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 41,
        drift: 0.00024,
        volatility: 0.01,
        volumeBase: 190000,
        minPrice: 28
      },
      fit: 'Users who want a covered-call income route on large-cap equities instead of on Nasdaq growth.',
      humanSummary:
        'XYLD provides a slower, broader large-cap covered-call path that can be easier to compare against treasury and structured-yield products.',
      technicalSummary:
        'Replay bars use bundled daily ETF history, keeping the yield route tied to a real listed option-income product.',
      returnSource: 'S&P 500 equity exposure plus systematic call-writing income.',
      worstCase: 'The market regime changes and income does not fully offset lost upside or market drawdown.',
      whyItMatters:
        'It widens the yield shelf beyond treasury carry and into listed equity-income structures.'
    },
    {
      id: 'svol-income',
      ticker: 'SVOL',
      name: 'SVOL Volatility Income Route',
      lane: 'yield',
      risk: 'High',
      productType: 'Volatility-income ETF / yield route',
      sourceLabel: 'Bundled 1Y SVOL daily history',
      csvPath: '/replay-data/SVOL_1d.csv',
      costModel: {
        tradeFeeBps: 10,
        spreadBps: 14,
        fxBps: 4,
        channelBps: 5,
        annualCarryBps: 35,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 22,
        drift: 0.0003,
        volatility: 0.022,
        volumeBase: 140000,
        minPrice: 11
      },
      fit: 'Users who need a higher-volatility income route to compare against calmer carry products.',
      humanSummary:
        'SVOL turns volatility selling into a yield route, which makes it a useful contrast against treasury-backed or covered-call products.',
      technicalSummary:
        'Replay bars use bundled ETF history so the chart shows a real public volatility-income strategy rather than a notional APY promise.',
      returnSource: 'Option and volatility-risk premia.',
      worstCase: 'Volatility spikes hard, downside hedge assumptions fail, and the income trade gives back months of distributions quickly.',
      whyItMatters:
        'It shows that not all yield routes are low-risk cash substitutes just because they distribute frequently.'
    }
  ].map((product) => createCsvReplayProduct(product)),
  ...[
    {
      id: 'nvdax',
      ticker: 'NVDAx',
      name: 'NVDAx Tokenized Public Equity',
      lane: 'public',
      risk: 'High',
      productType: 'Tokenized stocks / public equities',
      sourceLabel: 'Bundled NVIDIA 1Y daily history',
      csvPath: '/replay-data/NVDA_1d.csv',
      quoteSyncUrl: 'https://api.xstocks.fi/api/v2/public/assets/NVDAx/price-data',
      quoteSyncLabel: 'xStocks public quote sync',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 100,
        fxBps: 6,
        channelBps: 4,
        annualCarryBps: 15,
        regulatoryClass: 'equity',
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 118,
        drift: 0.0012,
        volatility: 0.03,
        volumeBase: 1300000,
        minPrice: 35
      },
      fit: 'Users who want to inspect tokenized AI-equity exposure without collapsing wrapper risk into plain stock beta.',
      humanSummary:
        'NVDAx is a tokenized listed-equity route where the price story is obvious, but the user still needs to inspect rights, spread, and settlement path.',
      technicalSummary:
        'Replay bars use bundled NVIDIA daily history and can sync against the public xStocks quote path when available.',
      returnSource: 'Single-name NVIDIA equity exposure via a token wrapper.',
      worstCase: 'The stock whipsaws, wrapper spreads widen, or the user assumes direct shareholder rights that the token does not provide.',
      whyItMatters:
        'It gives the public-liquid lane a genuine high-beta tokenized equity reference beside AAPLx.'
    },
    {
      id: 'msftx',
      ticker: 'MSFTx',
      name: 'MSFTx Tokenized Public Equity',
      lane: 'public',
      risk: 'Medium',
      productType: 'Tokenized stocks / public equities',
      sourceLabel: 'Bundled Microsoft 1Y daily history',
      csvPath: '/replay-data/MSFT_1d.csv',
      quoteSyncUrl: 'https://api.xstocks.fi/api/v2/public/assets/MSFTx/price-data',
      quoteSyncLabel: 'xStocks public quote sync',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 100,
        fxBps: 6,
        channelBps: 4,
        annualCarryBps: 15,
        regulatoryClass: 'equity',
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 405,
        drift: 0.00075,
        volatility: 0.018,
        volumeBase: 860000,
        minPrice: 190
      },
      fit: 'Users who want a large-cap tokenized equity with lower realized volatility than the highest-beta names.',
      humanSummary:
        'MSFTx is a steadier tokenized equity reference that makes wrapper drag easier to inspect without the noisiest single-name path.',
      technicalSummary:
        'Replay bars use bundled Microsoft daily history and can scale toward public xStocks quotes when the sync endpoint responds.',
      returnSource: 'Single-name Microsoft equity exposure through a transferable wrapper.',
      worstCase: 'Users overlook wrapper and funding drag because the underlying looks familiar and liquid.',
      whyItMatters:
        'It broadens the public-liquid shelf beyond one tokenized tech stock.'
    },
    {
      id: 'tslax-public',
      ticker: 'TSLAx',
      name: 'TSLAx Tokenized Public Equity',
      lane: 'public',
      risk: 'High',
      productType: 'Tokenized stocks / public equities',
      sourceLabel: 'Bundled Tesla 1Y daily history',
      csvPath: '/replay-data/TSLA_1d.csv',
      quoteSyncUrl: 'https://api.xstocks.fi/api/v2/public/assets/TSLAx/price-data',
      quoteSyncLabel: 'xStocks public quote sync',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 100,
        fxBps: 6,
        channelBps: 4,
        annualCarryBps: 18,
        regulatoryClass: 'equity',
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 182,
        drift: 0.001,
        volatility: 0.038,
        volumeBase: 1180000,
        minPrice: 70
      },
      fit: 'Users comparing wrapper risk in a very high-beta listed name.',
      humanSummary:
        'TSLAx keeps the public lane honest by showing what a volatile tokenized stock feels like once wrapper spread and routing are layered in.',
      technicalSummary:
        'Replay bars use bundled Tesla daily history and can sync toward public xStocks quotes when those are available.',
      returnSource: 'Tesla equity beta expressed through a token wrapper.',
      worstCase: 'High realized volatility combines with wrapper spread so small timing mistakes become much more expensive.',
      whyItMatters:
        'It gives users a high-beta public wrapper case before they move into leverage or structured overlays.'
    },
    {
      id: 'googlx',
      ticker: 'GOOGLx',
      name: 'GOOGLx Tokenized Public Equity',
      lane: 'public',
      risk: 'Medium',
      productType: 'Tokenized stocks / public equities',
      sourceLabel: 'Bundled Alphabet 1Y daily history',
      csvPath: '/replay-data/GOOGL_1d.csv',
      quoteSyncUrl: 'https://api.xstocks.fi/api/v2/public/assets/GOOGLx/price-data',
      quoteSyncLabel: 'xStocks public quote sync',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 100,
        fxBps: 6,
        channelBps: 4,
        annualCarryBps: 15,
        regulatoryClass: 'equity',
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 166,
        drift: 0.00082,
        volatility: 0.02,
        volumeBase: 720000,
        minPrice: 80
      },
      fit: 'Users who want another liquid tokenized equity reference that is not the same as hardware or EV beta.',
      humanSummary:
        'GOOGLx gives the shelf a second mega-cap tokenized equity path with different volatility and corporate-action expectations than AAPLx or NVDAx.',
      technicalSummary:
        'Replay bars use bundled Alphabet daily history and can sync against public xStocks quote data if the endpoint responds.',
      returnSource: 'Alphabet equity exposure through a tokenized wrapper.',
      worstCase: 'The user mistakes economic exposure for direct stock ownership and underestimates wrapper-specific drag.',
      whyItMatters:
        'It fills out the tokenized-equity shelf with more than one sector profile.'
    },
    {
      id: 'spyx',
      ticker: 'SPYx',
      name: 'SPYx Tokenized Index Wrapper',
      lane: 'public',
      risk: 'Medium',
      productType: 'Tokenized ETF / index wrapper',
      sourceLabel: 'Bundled SPY 1Y daily history',
      csvPath: '/replay-data/SPY_1d.csv',
      quoteSyncUrl: 'https://api.xstocks.fi/api/v2/public/assets/SPYx/price-data',
      quoteSyncLabel: 'xStocks public quote sync',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 95,
        fxBps: 6,
        channelBps: 4,
        annualCarryBps: 12,
        regulatoryClass: 'equity',
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 510,
        drift: 0.00055,
        volatility: 0.012,
        volumeBase: 1650000,
        minPrice: 280
      },
      fit: 'Users who want a diversified public-market wrapper instead of a single-name tokenized stock.',
      humanSummary:
        'SPYx brings index-style tokenized exposure into the shelf, which is useful for users who care more about market beta than about a single issuer story.',
      technicalSummary:
        'Replay bars use bundled SPY daily history as the base path and can scale to public xStocks pricing when available.',
      returnSource: 'S&P 500 market beta through a tokenized ETF wrapper.',
      worstCase: 'Users treat diversification as a substitute for understanding wrapper terms, spread, and access restrictions.',
      whyItMatters:
        'It helps users see that tokenization can wrap diversified public beta, not just single names.'
    },
    {
      id: 'qqqx',
      ticker: 'QQQx',
      name: 'QQQx Tokenized Index Wrapper',
      lane: 'public',
      risk: 'Medium',
      productType: 'Tokenized ETF / index wrapper',
      sourceLabel: 'Bundled QQQ 1Y daily history',
      csvPath: '/replay-data/QQQ_1d.csv',
      quoteSyncUrl: 'https://api.xstocks.fi/api/v2/public/assets/QQQx/price-data',
      quoteSyncLabel: 'xStocks public quote sync',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 95,
        fxBps: 6,
        channelBps: 4,
        annualCarryBps: 12,
        regulatoryClass: 'equity',
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 443,
        drift: 0.0007,
        volatility: 0.015,
        volumeBase: 920000,
        minPrice: 240
      },
      fit: 'Users who want to compare tokenized growth-index exposure against single-name wrappers and crypto benchmarks.',
      humanSummary:
        'QQQx brings growth-heavy index exposure into the tokenized public lane, which makes wrapper drag easier to compare against tech-heavy benchmarks.',
      technicalSummary:
        'Replay bars use bundled QQQ daily history and can sync toward public xStocks quote data when available.',
      returnSource: 'Nasdaq-100 index beta through a token wrapper.',
      worstCase: 'Growth underperforms and the user still pays wrapper and funding friction on top of the market move.',
      whyItMatters:
        'It separates tokenized index beta from tokenized single-stock storytelling.'
    },
    {
      id: 'gldx',
      ticker: 'GLDx',
      name: 'GLDx Tokenized Gold Wrapper',
      lane: 'public',
      risk: 'Medium',
      productType: 'Tokenized commodity / ETF wrapper',
      sourceLabel: 'Bundled GLD 1Y daily history',
      csvPath: '/replay-data/GLD_1d.csv',
      quoteSyncUrl: 'https://api.xstocks.fi/api/v2/public/assets/GLDx/price-data',
      quoteSyncLabel: 'xStocks public quote sync',
      costModel: {
        makerFeeBps: 0,
        takerFeeBps: 0,
        tradeFeeBps: 0,
        spreadBps: 95,
        fxBps: 4,
        channelBps: 4,
        annualCarryBps: 10,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 225,
        drift: 0.00042,
        volatility: 0.011,
        volumeBase: 460000,
        minPrice: 150
      },
      fit: 'Users who want a non-equity public RWA wrapper inside the same replay surface.',
      humanSummary:
        'GLDx is a tokenized commodity-style wrapper, which helps the public lane cover more than U.S. equity beta.',
      technicalSummary:
        'Replay bars use bundled GLD daily history as a transparent gold proxy and can scale toward public xStocks quote data when available.',
      returnSource: 'Gold-linked ETF exposure through a token wrapper.',
      worstCase: 'The user expects safe-haven behavior but still pays wrapper drag and market timing costs.',
      whyItMatters:
        'It gives the RWA shelf a chartable commodity wrapper case alongside tokenized stocks and indexes.'
    }
  ].map((product) => createCsvReplayProduct(product)),
  ...[
    {
      id: 'stripe-secondary',
      ticker: 'STRIPE',
      name: 'Stripe Secondary Window',
      lane: 'private',
      risk: 'High',
      productType: 'Private market / pre-IPO equity',
      sourceLabel: 'Local late-stage secondary replay proxy',
      replayModel: 'private-window',
      costModel: {
        tradeFeeBps: 34,
        spreadBps: 42,
        fxBps: 14,
        channelBps: 18,
        annualCarryBps: 20,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 31,
        drift: 0.00072,
        volatility: 0.018,
        volumeBase: 21000,
        minPrice: 10
      },
      fit: 'Users comparing mature private-market exposure against listed payment or fintech beta.',
      humanSummary:
        'Stripe is a late-stage private-market proxy where valuation marks move slower than public comps and liquidity is event-driven.',
      technicalSummary:
        'Replay bars stay synthetic because there is no clean public tape; the path behaves like a secondary-market valuation proxy with episodic repricing.',
      returnSource: 'Secondary marks, tender windows, and eventual exit optionality.',
      worstCase: 'Valuation lags reality, transfer windows stay narrow, or a liquidity event arrives at a worse mark than expected.',
      whyItMatters:
        'It adds a fintech-flavored private-market case instead of using one generic pre-IPO card for everything.'
    },
    {
      id: 'openai-access',
      ticker: 'OPENAI',
      name: 'OpenAI Access Window',
      lane: 'private',
      risk: 'High',
      productType: 'Private market / pre-IPO equity',
      sourceLabel: 'Local late-stage secondary replay proxy',
      replayModel: 'private-window',
      costModel: {
        tradeFeeBps: 36,
        spreadBps: 44,
        fxBps: 15,
        channelBps: 18,
        annualCarryBps: 22,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 44,
        drift: 0.0009,
        volatility: 0.022,
        volumeBase: 18000,
        minPrice: 14
      },
      fit: 'Users tempted by headline private AI upside but who still need to learn transfer restrictions and valuation opacity.',
      humanSummary:
        'OpenAI access is treated as a late-stage private allocation, which means the chart is really about sparse valuation updates and uncertain exits rather than public-market trading.',
      technicalSummary:
        'Replay bars are synthetic because private transactions do not create a continuous public OHLC series. The path behaves like an indicative secondary mark.',
      returnSource: 'Tender windows, valuation rerates, and potential future liquidity events.',
      worstCase: 'The mark stays stale, transferability is limited, or a headline valuation fails to translate into real liquidity.',
      whyItMatters:
        'It gives the private lane a current AI-related case without pretending there is a real exchange tape.'
    },
    {
      id: 'databricks-secondary',
      ticker: 'DATABR',
      name: 'Databricks Secondary Window',
      lane: 'private',
      risk: 'High',
      productType: 'Private market / pre-IPO equity',
      sourceLabel: 'Local late-stage secondary replay proxy',
      replayModel: 'private-window',
      costModel: {
        tradeFeeBps: 34,
        spreadBps: 42,
        fxBps: 14,
        channelBps: 18,
        annualCarryBps: 20,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 36,
        drift: 0.00074,
        volatility: 0.019,
        volumeBase: 16000,
        minPrice: 12
      },
      fit: 'Users who want a private data-infrastructure case instead of consumer or space names.',
      humanSummary:
        'Databricks is modeled as a large private-market software allocation where valuation and eventual exit timing matter more than daily sentiment.',
      technicalSummary:
        'Replay bars are synthetic valuation proxies because private secondaries do not publish a reliable public candle series.',
      returnSource: 'Private-market valuation changes and eventual exit optionality.',
      worstCase: 'The company stays private longer than expected or the next marked valuation resets lower than secondary buyers assumed.',
      whyItMatters:
        'It broadens the private shelf beyond one famous issuer name.'
    },
    {
      id: 'anthropic-secondary',
      ticker: 'ANTH',
      name: 'Anthropic Growth Round',
      lane: 'private',
      risk: 'High',
      productType: 'Private market / pre-IPO equity',
      sourceLabel: 'Local late-stage secondary replay proxy',
      replayModel: 'private-window',
      costModel: {
        tradeFeeBps: 36,
        spreadBps: 44,
        fxBps: 15,
        channelBps: 18,
        annualCarryBps: 22,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 41,
        drift: 0.00087,
        volatility: 0.021,
        volumeBase: 15000,
        minPrice: 13
      },
      fit: 'Users who want another AI-era private-market allocation case with sparse pricing and uncertain liquidity.',
      humanSummary:
        'Anthropic is treated as a private growth-round product where the visible upside story can easily outrun real transferability.',
      technicalSummary:
        'Replay bars are synthetic by design because private rounds do not produce a clean public OHLC tape.',
      returnSource: 'Private funding-round marks and eventual exit or tender events.',
      worstCase: 'Secondary enthusiasm outruns actual liquidity and the investor discovers that a paper mark is not a tradeable exit.',
      whyItMatters:
        'It reinforces that private AI exposure is still a transfer-and-rights problem, not just a valuation story.'
    },
    {
      id: 'ripple-secondary',
      ticker: 'RIPPLE',
      name: 'Ripple Secondary Transfer',
      lane: 'private',
      risk: 'High',
      productType: 'Private market / pre-IPO equity',
      sourceLabel: 'Local late-stage secondary replay proxy',
      replayModel: 'private-window',
      costModel: {
        tradeFeeBps: 33,
        spreadBps: 41,
        fxBps: 14,
        channelBps: 17,
        annualCarryBps: 20,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 27,
        drift: 0.00068,
        volatility: 0.018,
        volumeBase: 19000,
        minPrice: 9
      },
      fit: 'Users exploring private-company exposure that already sits near crypto-market narratives and regulatory risk.',
      humanSummary:
        'Ripple is modeled as a private-company transfer window where legal and liquidity considerations matter as much as company narrative.',
      technicalSummary:
        'Replay bars stay synthetic because private-company transfers do not publish a continuous public trade series.',
      returnSource: 'Secondary transfer marks and eventual liquidity events.',
      worstCase: 'The headline story stays hot while actual transfer liquidity and legal clarity remain constrained.',
      whyItMatters:
        'It gives the private lane a case that sits closer to the crypto-native audience of this demo.'
    }
  ].map((product) => createLocalReplayProduct(product)),
  ...[
    {
      id: 'tqqq-leverage',
      ticker: 'TQQQ',
      name: 'TQQQ Leveraged Nasdaq Route',
      lane: 'leverage',
      risk: 'High',
      productType: 'Leveraged ETF / hedging route',
      sourceLabel: 'Bundled 1Y TQQQ daily history',
      csvPath: '/replay-data/TQQQ_1d.csv',
      costModel: {
        tradeFeeBps: 10,
        spreadBps: 12,
        fxBps: 4,
        channelBps: 4,
        annualCarryBps: 38,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 63,
        drift: 0.0011,
        volatility: 0.034,
        volumeBase: 840000,
        minPrice: 16
      },
      fit: 'Users learning path dependence and leverage drag in a listed, chartable structure.',
      humanSummary:
        'TQQQ is a real leveraged ETF route, which makes it a clean bridge between crypto-style leverage tutorials and listed market structure.',
      technicalSummary:
        'Replay bars use bundled daily ETF history so the user sees actual leveraged decay and trend amplification behavior.',
      returnSource: 'Leveraged Nasdaq-100 exposure.',
      worstCase: 'Volatility drag and repeated reversals destroy take-home value even when the headline trend looks favorable.',
      whyItMatters:
        'It teaches that leverage is its own product structure, even outside crypto perps.'
    },
    {
      id: 'sqqq-leverage',
      ticker: 'SQQQ',
      name: 'SQQQ Inverse Hedge Route',
      lane: 'leverage',
      risk: 'High',
      productType: 'Inverse ETF / hedging route',
      sourceLabel: 'Bundled 1Y SQQQ daily history',
      csvPath: '/replay-data/SQQQ_1d.csv',
      costModel: {
        tradeFeeBps: 10,
        spreadBps: 12,
        fxBps: 4,
        channelBps: 4,
        annualCarryBps: 40,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 9,
        drift: -0.0009,
        volatility: 0.036,
        volumeBase: 760000,
        minPrice: 4
      },
      fit: 'Users learning that inverse exposure is still path-dependent and costly to hold.',
      humanSummary:
        'SQQQ is a real inverse ETF hedge route, so it helps teach that downside protection products can still erode badly if held through the wrong path.',
      technicalSummary:
        'Replay bars use bundled daily ETF history, making inverse-decay behavior visible instead of theoretical.',
      returnSource: 'Inverse leveraged Nasdaq-100 exposure.',
      worstCase: 'The hedge is held too long, path decay compounds, and the product underdelivers relative to a naive directional view.',
      whyItMatters:
        'It turns hedging into a concrete replay path rather than a generic concept card.'
    },
    {
      id: 'tsll-leverage',
      ticker: 'TSLL',
      name: 'TSLL Leveraged Tesla Route',
      lane: 'leverage',
      risk: 'High',
      productType: 'Single-stock leveraged ETF',
      sourceLabel: 'Bundled 1Y TSLL daily history',
      csvPath: '/replay-data/TSLL_1d.csv',
      costModel: {
        tradeFeeBps: 10,
        spreadBps: 14,
        fxBps: 4,
        channelBps: 4,
        annualCarryBps: 44,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 11,
        drift: 0.0012,
        volatility: 0.05,
        volumeBase: 530000,
        minPrice: 3
      },
      fit: 'Users who want leverage math on a single high-volatility stock instead of on an index.',
      humanSummary:
        'TSLL turns Tesla beta into a leveraged route, which makes drawdown and timing risk much easier to feel than in a plain public wrapper.',
      technicalSummary:
        'Replay bars use bundled daily ETF history so the product shows actual single-stock leverage behavior.',
      returnSource: 'Leveraged Tesla exposure.',
      worstCase: 'A routine Tesla swing wipes out weeks of gains because the route is both single-name and leveraged.',
      whyItMatters:
        'It separates a tokenized stock wrapper from an outright leverage product on the same underlying theme.'
    },
    {
      id: 'nvdl-leverage',
      ticker: 'NVDL',
      name: 'NVDL Leveraged NVIDIA Route',
      lane: 'leverage',
      risk: 'High',
      productType: 'Single-stock leveraged ETF',
      sourceLabel: 'Bundled 1Y NVDL daily history',
      csvPath: '/replay-data/NVDL_1d.csv',
      costModel: {
        tradeFeeBps: 10,
        spreadBps: 14,
        fxBps: 4,
        channelBps: 4,
        annualCarryBps: 44,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 72,
        drift: 0.0013,
        volatility: 0.052,
        volumeBase: 480000,
        minPrice: 12
      },
      fit: 'Users who want to stress-test leverage on a momentum-heavy AI stock route.',
      humanSummary:
        'NVDL shows what happens when a familiar AI equity story becomes a leveraged daily-reset product.',
      technicalSummary:
        'Replay bars use bundled daily ETF history, which keeps the leverage lesson grounded in a real listed product.',
      returnSource: 'Leveraged NVIDIA exposure.',
      worstCase: 'Momentum breaks, volatility spikes, and leverage drag overwhelms the original bullish thesis.',
      whyItMatters:
        'It lets users compare NVDAx and NVDL as two very different products built on the same reference asset.'
    },
    {
      id: 'mstu-leverage',
      ticker: 'MSTU',
      name: 'MSTU Leveraged MSTR Route',
      lane: 'leverage',
      risk: 'High',
      productType: 'Single-stock leveraged ETF',
      sourceLabel: 'Bundled 1Y MSTU daily history',
      csvPath: '/replay-data/MSTU_1d.csv',
      costModel: {
        tradeFeeBps: 10,
        spreadBps: 16,
        fxBps: 4,
        channelBps: 5,
        annualCarryBps: 48,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 31,
        drift: 0.0015,
        volatility: 0.06,
        volumeBase: 420000,
        minPrice: 4
      },
      fit: 'Users who want the most aggressive listed leverage route on the shelf.',
      humanSummary:
        'MSTU is a high-volatility leveraged ETF route, which makes it a useful extreme case for explaining path dependence and fee drag.',
      technicalSummary:
        'Replay bars use bundled daily ETF history, turning the leverage lesson into a real listed-market path rather than a synthetic stress test.',
      returnSource: 'Leveraged MicroStrategy-style equity exposure.',
      worstCase: 'The product compounds losses quickly because both the underlying and the leverage overlay are extremely volatile.',
      whyItMatters:
        'It gives the leverage lane a true high-octane edge case for teaching risk.'
    }
  ].map((product) => createCsvReplayProduct(product)),
  ...[
    {
      id: 'tsly-strategy',
      ticker: 'TSLY',
      name: 'TSLY Option-Income Route',
      lane: 'strategy',
      risk: 'High',
      productType: 'Single-stock option-income ETF',
      sourceLabel: 'Bundled 1Y TSLY daily history',
      csvPath: '/replay-data/TSLY_1d.csv',
      costModel: {
        tradeFeeBps: 16,
        spreadBps: 18,
        fxBps: 12,
        channelBps: 10,
        annualCarryBps: 58,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 11,
        drift: 0.0007,
        volatility: 0.03,
        volumeBase: 260000,
        minPrice: 5
      },
      fit: 'Users who need a real listed strategy product instead of a purely illustrative term-sheet proxy.',
      humanSummary:
        'TSLY is a single-stock option-income ETF, so the user is buying a structured payoff route rather than plain TSLA spot.',
      technicalSummary:
        'Replay bars use bundled daily ETF history to keep the strategy lane grounded in an actual listed product.',
      returnSource: 'Tesla-linked option income and capped path-dependent payoff.',
      worstCase: 'Distribution headlines obscure weak total return and the downside remains much larger than a user expected.',
      whyItMatters:
        'It gives the strategy lane a real-world alternative to synthetic note examples.'
    },
    {
      id: 'nvdy-strategy',
      ticker: 'NVDY',
      name: 'NVDY Option-Income Route',
      lane: 'strategy',
      risk: 'High',
      productType: 'Single-stock option-income ETF',
      sourceLabel: 'Bundled 1Y NVDY daily history',
      csvPath: '/replay-data/NVDY_1d.csv',
      costModel: {
        tradeFeeBps: 16,
        spreadBps: 18,
        fxBps: 12,
        channelBps: 10,
        annualCarryBps: 58,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 21,
        drift: 0.00078,
        volatility: 0.032,
        volumeBase: 220000,
        minPrice: 8
      },
      fit: 'Users comparing high-distribution strategy wrappers on AI-linked equities.',
      humanSummary:
        'NVDY is a listed option-income wrapper on NVIDIA, which makes the payoff structure easier to study than a pure synthetic note example.',
      technicalSummary:
        'Replay bars use bundled daily ETF history, so the strategy chart reflects actual market behavior.',
      returnSource: 'NVIDIA-linked option-income payoff.',
      worstCase: 'Upside stays capped, downside still lands, and the income story hides a rough net path.',
      whyItMatters:
        'It lets users compare NVDAx, NVDL, and NVDY as three different wrappers on one underlying theme.'
    },
    {
      id: 'aply-strategy',
      ticker: 'APLY',
      name: 'APLY Option-Income Route',
      lane: 'strategy',
      risk: 'Medium',
      productType: 'Single-stock option-income ETF',
      sourceLabel: 'Bundled 1Y APLY daily history',
      csvPath: '/replay-data/APLY_1d.csv',
      costModel: {
        tradeFeeBps: 16,
        spreadBps: 17,
        fxBps: 12,
        channelBps: 10,
        annualCarryBps: 55,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 18,
        drift: 0.0005,
        volatility: 0.021,
        volumeBase: 180000,
        minPrice: 10
      },
      fit: 'Users who want a slightly calmer option-income wrapper than the highest-beta names.',
      humanSummary:
        'APLY shows how a single-stock income wrapper changes the experience of owning Apple-like exposure.',
      technicalSummary:
        'Replay bars use bundled daily ETF history so the strategy lane includes an actual listed option-income route.',
      returnSource: 'Apple-linked option-premium income.',
      worstCase: 'The wrapper undercaptures upside while still leaving the user with meaningful downside and tax drag.',
      whyItMatters:
        'It broadens the strategy lane beyond one underlying and one volatility profile.'
    },
    {
      id: 'amzy-strategy',
      ticker: 'AMZY',
      name: 'AMZY Option-Income Route',
      lane: 'strategy',
      risk: 'Medium',
      productType: 'Single-stock option-income ETF',
      sourceLabel: 'Bundled 1Y AMZY daily history',
      csvPath: '/replay-data/AMZY_1d.csv',
      costModel: {
        tradeFeeBps: 16,
        spreadBps: 17,
        fxBps: 12,
        channelBps: 10,
        annualCarryBps: 55,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 19,
        drift: 0.00052,
        volatility: 0.022,
        volumeBase: 170000,
        minPrice: 10
      },
      fit: 'Users who want another real listed strategy wrapper tied to a mega-cap equity.',
      humanSummary:
        'AMZY adds an Amazon-linked option-income structure so the strategy shelf does not revolve around just one issuer theme.',
      technicalSummary:
        'Replay bars use bundled daily ETF history, which keeps the product grounded in actual listed-market performance.',
      returnSource: 'Amazon-linked option-premium income.',
      worstCase: 'Investors chase distribution yield and discover the wrapper still has meaningful path dependence and capped upside.',
      whyItMatters:
        'It makes the structured shelf look like a real menu of payoff routes instead of a single demo card.'
    },
    {
      id: 'cony-strategy',
      ticker: 'CONY',
      name: 'CONY Option-Income Route',
      lane: 'strategy',
      risk: 'High',
      productType: 'Single-stock option-income ETF',
      sourceLabel: 'Bundled 1Y CONY daily history',
      csvPath: '/replay-data/CONY_1d.csv',
      costModel: {
        tradeFeeBps: 16,
        spreadBps: 19,
        fxBps: 12,
        channelBps: 10,
        annualCarryBps: 60,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 12,
        drift: 0.0008,
        volatility: 0.034,
        volumeBase: 210000,
        minPrice: 5
      },
      fit: 'Users who want a higher-volatility listed option-income structure with obvious upside-versus-yield trade-offs.',
      humanSummary:
        'CONY makes the strategy lane more explicit: this is a payoff-engine product, not direct Coinbase stock exposure.',
      technicalSummary:
        'Replay bars use bundled daily ETF history, so the chart is a real listed strategy path rather than a made-up coupon line.',
      returnSource: 'Coinbase-linked option-premium income.',
      worstCase: 'Headline yield dominates user attention while the underlying remains highly volatile and the payoff stays capped.',
      whyItMatters:
        'It shows how structured-yield wrappers can look compelling while still behaving very differently from the underlying.'
    }
  ].map((product) => createCsvReplayProduct(product)),
  ...[
    {
      id: 'rwa-basis-bot',
      ticker: 'RWA-BOT',
      name: 'RWA Basis Copilot',
      lane: 'ai',
      risk: 'Medium',
      productType: 'AI / automation',
      sourceLabel: 'Local AI strategy replay proxy',
      replayModel: 'ai-rotation',
      costModel: {
        tradeFeeBps: 10,
        spreadBps: 11,
        fxBps: 8,
        channelBps: 5,
        annualCarryBps: 18,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 109,
        drift: 0.00062,
        volatility: 0.012,
        volumeBase: 160000,
        minPrice: 70
      },
      fit: 'Users who want to study automation on top of RWA basis and treasury allocation decisions.',
      humanSummary:
        'This AI route acts like a basis-aware allocator between public beta and treasury sleeves, so the user can inspect how automation changes the trading path.',
      technicalSummary:
        'Replay bars are synthetic by design because the product is modeling a rebalance engine rather than a single listed security.',
      returnSource: 'Model-driven basis capture, treasury parking, and rebalance timing.',
      worstCase: 'The model overreacts, turnover rises, and automation adds cost instead of edge.',
      whyItMatters:
        'It turns AI from a buzzword into a visible decision policy that can be audited bar by bar.'
    },
    {
      id: 'treasury-autopilot',
      ticker: 'T-AUTO',
      name: 'Treasury Rebalance Autopilot',
      lane: 'ai',
      risk: 'Low',
      productType: 'AI / automation',
      sourceLabel: 'Local AI strategy replay proxy',
      replayModel: 'ai-rotation',
      costModel: {
        tradeFeeBps: 8,
        spreadBps: 8,
        fxBps: 6,
        channelBps: 4,
        annualCarryBps: 12,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 103,
        drift: 0.00032,
        volatility: 0.006,
        volumeBase: 120000,
        minPrice: 88
      },
      fit: 'Users who want a calmer automation route centered on treasury and cash rebalancing.',
      humanSummary:
        'This product models an autopilot that moves between treasury-like sleeves and reserve cash rather than chasing pure market beta.',
      technicalSummary:
        'Replay bars are synthetic because the point is to explain the rebalance policy and safety rails, not to mirror one exchange-traded ticker.',
      returnSource: 'Model-guided treasury rotation and idle-cash deployment.',
      worstCase: 'The automation looks safe but still leaks value through overtrading, stale rules, or wrong liquidity assumptions.',
      whyItMatters:
        'It makes automation visible in a lower-volatility setting instead of only in high-beta products.'
    },
    {
      id: 'stable-yield-os',
      ticker: 'YIELD-AI',
      name: 'Stable Yield Optimizer',
      lane: 'ai',
      risk: 'Medium',
      productType: 'AI / automation',
      sourceLabel: 'Local AI strategy replay proxy',
      replayModel: 'ai-rotation',
      costModel: {
        tradeFeeBps: 9,
        spreadBps: 9,
        fxBps: 7,
        channelBps: 4,
        annualCarryBps: 16,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'mixed-income'
      },
      fallback: {
        price: 106,
        drift: 0.00048,
        volatility: 0.009,
        volumeBase: 150000,
        minPrice: 82
      },
      fit: 'Users comparing automated yield allocation against manual route selection.',
      humanSummary:
        'This automation route models a system that moves between yield sleeves based on carry and liquidity conditions.',
      technicalSummary:
        'Replay bars are synthetic because the product is a rules engine over multiple sleeves, not a single public security.',
      returnSource: 'Model-guided yield sleeve rotation and carry capture.',
      worstCase: 'The optimizer chases stale yield and increases turnover just as the opportunity disappears.',
      whyItMatters:
        'It teaches that automation can change the source of return and the cost stack at the same time.'
    },
    {
      id: 'macro-switch-ai',
      ticker: 'MACRO-AI',
      name: 'Macro Switcher Basket',
      lane: 'ai',
      risk: 'Medium',
      productType: 'AI / automation',
      sourceLabel: 'Local AI strategy replay proxy',
      replayModel: 'ai-rotation',
      costModel: {
        tradeFeeBps: 10,
        spreadBps: 10,
        fxBps: 8,
        channelBps: 4,
        annualCarryBps: 18,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 115,
        drift: 0.00066,
        volatility: 0.013,
        volumeBase: 175000,
        minPrice: 76
      },
      fit: 'Users who want to see how a macro-allocation bot changes position timing across asset sleeves.',
      humanSummary:
        'This basket models a macro switching agent that rotates between risk-on, treasury, and hedge sleeves.',
      technicalSummary:
        'Replay bars are synthetic because the path reflects a multi-asset rebalance policy rather than a listed fund.',
      returnSource: 'Model-led macro allocation changes and rebalance timing.',
      worstCase: 'The model rotates late, raises turnover, and turns macro caution into whipsaw.',
      whyItMatters:
        'It gives the AI lane a multi-asset route that feels different from single-sleeve automation.'
    },
    {
      id: 'liquidity-router-ai',
      ticker: 'ROUTE-AI',
      name: 'Liquidity Routing Agent',
      lane: 'ai',
      risk: 'Medium',
      productType: 'AI / automation',
      sourceLabel: 'Local AI strategy replay proxy',
      replayModel: 'ai-rotation',
      costModel: {
        tradeFeeBps: 10,
        spreadBps: 10,
        fxBps: 8,
        channelBps: 5,
        annualCarryBps: 17,
        shortTermTaxRate: 0.24,
        longTermTaxRate: 0.15,
        incomeTaxRate: 0.24,
        taxTreatment: 'capital-gains'
      },
      fallback: {
        price: 111,
        drift: 0.00058,
        volatility: 0.011,
        volumeBase: 170000,
        minPrice: 74
      },
      fit: 'Users who want an automation route focused on venue selection and execution quality.',
      humanSummary:
        'This product models an agent that chooses between venues and wrapper routes instead of changing the underlying investment thesis itself.',
      technicalSummary:
        'Replay bars are synthetic because the strategy reflects execution policy, slippage, and route choice rather than one public tape.',
      returnSource: 'Execution-quality improvements and route-aware allocation.',
      worstCase: 'Routing complexity adds cost, or the user mistakes a smoother chart for a lower-risk underlying exposure.',
      whyItMatters:
        'It makes the execution side of automation visible next to the asset side.'
    }
  ].map((product) => createLocalReplayProduct(product))
];

const CURATED_EXTRA_PAPER_PRODUCTS = [
  createCsvReplayProduct({
    id: 'spuu-leverage',
    ticker: 'SPUU',
    name: 'SPUU Leveraged S&P 500 Route',
    lane: 'leverage',
    risk: 'High',
    productType: 'Listed leveraged wrapper',
    sourceLabel: 'Bundled 1Y SPUU daily history',
    csvPath: '/replay-data/SPUU_1d.csv',
    costModel: {
      tradeFeeBps: 10,
      spreadBps: 13,
      fxBps: 4,
      channelBps: 4,
      annualCarryBps: 40,
      shortTermTaxRate: 0.24,
      longTermTaxRate: 0.15,
      incomeTaxRate: 0.24,
      taxTreatment: 'capital-gains'
    },
    fallback: {
      price: 42,
      drift: 0.00082,
      volatility: 0.028,
      volumeBase: 320000,
      minPrice: 12
    },
    fit: 'Users who want a broad-market leverage case before stepping into single-name or ultra-high-vol products.',
    humanSummary:
      'SPUU is a listed leveraged S&P 500 ETF route, so it teaches broad-market leverage and hedge math without collapsing everything into one stock story.',
    technicalSummary:
      'Replay bars use bundled daily ETF history, which keeps the leverage lesson grounded in a real listed product.',
    returnSource: '2x-style broad U.S. equity beta through a leveraged ETF wrapper.',
    worstCase: 'A broad-market drawdown plus daily reset drag can still erode capital quickly.',
    whyItMatters:
      'It gives the leverage shelf one diversified listed route beside the single-name levered products.'
  })
];

const ALL_PAPER_PRODUCTS = [...CORE_PAPER_PRODUCTS, ...ADDITIONAL_PAPER_PRODUCTS, ...CURATED_EXTRA_PAPER_PRODUCTS];

const CURATED_PAPER_PRODUCT_IDS = [
  'eth-usd',
  'aaplx',
  'tslax-public',
  'tsll-leverage',
  'spyx',
  'jepi-income'
];

const CURATED_PAPER_PRODUCT_OVERRIDES = {
  'benji-fobxx': {
    ticker: 'BENJI',
    name: 'BENJI Treasury Cash',
    productType: 'Cash & Treasury',
    structureTags: ['Treasury', 'Cash management', 'Tokenized fund'],
    defaultRange: '1Y',
    humanSummary:
      'BENJI keeps the reserve sleeve grounded in a real tokenized cash product with a full bundled NAV year instead of a short synthetic window.',
    technicalSummary:
      'The replay uses bundled FOBXX daily NAV history, so the chart teaches cash parking, settlement timing, and fund-share behavior with a longer observation window.'
  },
  'backed-ib01': {
    ticker: 'bIB01',
    name: 'Backed IB01 Treasury Tracker',
    productType: 'Treasury ETF tracker',
    structureTags: ['Treasury', 'ETF tracker', 'Collateral-eligible'],
    defaultRange: '1Y',
    humanSummary:
      'IB01 sits one step above pure cash rails: it still leans defensive, but the user can now see how a short-duration treasury ETF wrapper carries mild mark-to-market movement.',
    technicalSummary:
      'Replay bars use bundled IB01 daily history across roughly one year, which is better for teaching short-duration rate moves than a short placeholder panel.'
  },
  'msx-stable-income': {
    name: 'Treasury Reserve',
    ticker: 'USTB',
    productType: 'Cash & Treasury',
    structureTags: ['Treasury', 'Cash management', 'Tokenized fund'],
    humanSummary:
      'This belongs in Cash & Treasury: a low-volatility reserve sleeve for parking paper cash before the user moves into listed, private, or perp routes.',
    technicalSummary:
      'The replay uses bundled USTB NAV history so the chart teaches treasury-style carry, cash routing, and redemption terms rather than stock beta.'
  },
  'eth-usd': {
    ticker: 'ETH-USD',
    name: 'Ethereum Spot Replay',
    productType: 'Crypto spot',
    structureTags: ['Crypto', 'Spot', '24/7 market'],
    defaultInterval: '1D',
    defaultRange: '1Y',
    humanSummary:
      'ETH is the clean spot route for teaching entry, exit, spread, and take-home without hiding the lesson behind leverage first.'
  },
  'btc-usd': {
    ticker: 'BTC-PERP',
    name: 'Bitcoin Perp Tutorial',
    productType: 'Perpetual futures tutorial',
    structureTags: ['Crypto', 'Perp', 'Leverage'],
    defaultInterval: '1D',
    defaultRange: '1Y',
    humanSummary:
      'BTC stays on the shelf as the guided perp case so margin, notional, funding, and liquidation markers all live on a liquid benchmark.'
  },
  aaplx: {
    ticker: 'AAPL.M',
    name: 'Apple',
    productType: 'Listed / xStocks',
    structureTags: ['Tokenized', 'RWA', 'Permissioned'],
    humanSummary:
      'Apple belongs in public markets: the replay follows listed Apple exposure while the real lesson is wrapper rights, settlement path, and liquidity friction.',
    technicalSummary:
      'Replay bars use bundled Apple daily history and can sync toward public tokenized-equity quote feeds when available. This is a listed-market wrapper, not a private allocation card.',
    returnSource: 'Listed Apple equity exposure through a tokenized wrapper.',
    fit: 'Start here if you want the clearest tokenized public-market example before leverage, yield overlays, or automation.',
    whyItMatters:
      'Public markets should be the default home for listed single-name, ETF, and commodity exposure.'
  },
  nvdax: {
    ticker: 'NVDA.M',
    name: 'NVIDIA',
    productType: 'Listed / xStocks',
    structureTags: ['Tokenized', 'RWA', 'Permissioned']
  },
  'tslax-public': {
    ticker: 'TSLA.M',
    name: 'Tesla',
    productType: 'Listed / xStocks',
    structureTags: ['Tokenized', 'RWA', 'Permissioned']
  },
  spyx: {
    ticker: 'SPYx',
    name: 'SPY Index Wrapper',
    productType: 'Listed index wrapper',
    structureTags: ['Tokenized', 'RWA', 'Permissioned'],
    defaultRange: '1Y',
    humanSummary:
      'This is diversified public-market beta in tokenized form, useful when the user cares more about broad U.S. equity exposure than about one issuer story.'
  },
  qqqx: {
    ticker: 'QQQ-like',
    name: 'QQQ-like exposure',
    productType: 'Listed / xStocks',
    structureTags: ['Tokenized', 'RWA', 'Permissioned']
  },
  gldx: {
    ticker: 'GOLD',
    name: 'Gold exposure',
    productType: 'Commodity wrapper',
    structureTags: ['Tokenized', 'RWA', 'Permissioned']
  },
  'preipo-window': {
    ticker: 'SPACEX',
    name: 'SpaceX',
    productType: 'Private',
    structureTags: ['RWA', 'Permissioned', 'Synthetic'],
    humanSummary:
      'SpaceX is a pre-IPO allocation card, not a plain spot ticker. The replay is about lockup, allocation, and exit path before any eventual liquidity event.',
    fit: 'Use this to learn how a late-stage private window differs from listed public markets.',
    whyItMatters:
      'Private markets should feel like allocation, transfer, and eligibility decisions, not like one-click listed-market trading.'
  },
  'openai-access': {
    ticker: 'OPENAI',
    name: 'OpenAI',
    productType: 'Private',
    structureTags: ['RWA', 'Permissioned', 'Synthetic']
  },
  'anthropic-secondary': {
    ticker: 'ANTHROPIC',
    name: 'Anthropic',
    productType: 'Private',
    structureTags: ['RWA', 'Permissioned', 'Synthetic']
  },
  'stripe-secondary': {
    ticker: 'STRIPE',
    name: 'Stripe',
    productType: 'Private',
    structureTags: ['RWA', 'Permissioned', 'Synthetic']
  },
  'databricks-secondary': {
    ticker: 'DATABRICKS',
    name: 'Databricks',
    productType: 'Private',
    structureTags: ['RWA', 'Permissioned', 'Synthetic']
  },
  'ripple-secondary': {
    ticker: 'BYTEDANCE',
    name: 'ByteDance',
    productType: 'Private',
    structureTags: ['RWA', 'Permissioned', 'Synthetic'],
    humanSummary:
      'ByteDance is modeled as a pre-IPO subscription or watchlist card where eligibility, liquidity windows, and transfer rules matter more than intraday price action.',
    technicalSummary:
      'Replay bars stay synthetic because late-stage private-company transfers do not publish a clean public OHLC tape.',
    returnSource: 'Secondary transfer marks and eventual liquidity events.',
    fit: 'Users who want a consumer-internet private-market case instead of pure AI or fintech names.',
    whyItMatters:
      'It rounds out the private shelf with a non-U.S. internet platform case that still behaves like a late-stage private allocation.'
  },
  'msx-income-ladder': {
    name: 'Treasury + basis income sleeve',
    productType: 'Earn & yield',
    structureTags: ['Yield-bearing', 'RWA', 'Collateral-eligible']
  },
  'jepi-income': {
    ticker: 'JEPI',
    name: 'JEPI Income Sleeve',
    productType: 'Earn & yield',
    structureTags: ['Yield-bearing', 'Collateral-eligible'],
    defaultRange: '1Y'
  },
  'jepq-income': {
    productType: 'Earn & yield',
    structureTags: ['Yield-bearing', 'Collateral-eligible']
  },
  'qyld-income': {
    productType: 'Earn & yield',
    structureTags: ['Yield-bearing', 'Collateral-eligible']
  },
  'xyld-income': {
    productType: 'Earn & yield',
    structureTags: ['Yield-bearing', 'Collateral-eligible']
  },
  'svol-income': {
    productType: 'Earn & yield',
    structureTags: ['Yield-bearing', 'Collateral-eligible']
  },
  'spuu-leverage': {
    ticker: 'SPUU',
    name: 'SPUU Leveraged Index Route',
    productType: 'Listed leveraged wrapper',
    structureTags: ['Leverage', 'ETF', 'Broad market'],
    defaultRange: '1Y'
  },
  'tqqq-leverage': {
    productType: 'Listed leveraged wrapper',
    structureTags: ['Collateral-eligible', 'Listed proxy']
  },
  'sqqq-leverage': {
    productType: 'Listed leveraged wrapper',
    structureTags: ['Collateral-eligible', 'Listed proxy']
  },
  'tsll-leverage': {
    productType: 'Listed leveraged wrapper',
    structureTags: ['Collateral-eligible', 'Listed proxy']
  },
  'nvdl-leverage': {
    productType: 'Listed leveraged wrapper',
    structureTags: ['Collateral-eligible', 'Listed proxy']
  },
  'mstu-leverage': {
    productType: 'Listed leveraged wrapper',
    structureTags: ['Collateral-eligible', 'Listed proxy']
  },
  tslax: {
    name: 'Mag 7 twin-win note',
    ticker: 'MAG7 NOTE',
    productType: 'Strategies',
    structureTags: ['Synthetic', 'Permissioned']
  },
  'tsly-strategy': {
    productType: 'Strategies',
    structureTags: ['Yield-bearing', 'Listed proxy']
  },
  'nvdy-strategy': {
    productType: 'Strategies',
    structureTags: ['Yield-bearing', 'Listed proxy']
  },
  'aply-strategy': {
    productType: 'Strategies',
    structureTags: ['Yield-bearing', 'Listed proxy']
  },
  'amzy-strategy': {
    productType: 'Strategies',
    structureTags: ['Yield-bearing', 'Listed proxy']
  },
  'cony-strategy': {
    productType: 'Strategies',
    structureTags: ['Yield-bearing', 'Listed proxy']
  },
  'ai-rotation': {
    name: 'DCA plan',
    ticker: 'DCA-AI',
    productType: 'Automation / AI',
    structureTags: ['Automation', 'Synthetic']
  },
  'rwa-basis-bot': {
    name: 'Recurring buy bot',
    ticker: 'RECUR-AI',
    productType: 'Automation / AI',
    structureTags: ['Automation', 'Synthetic']
  },
  'treasury-autopilot': {
    name: 'Rebalance bot',
    ticker: 'REBAL-AI',
    productType: 'Automation / AI',
    structureTags: ['Automation', 'Synthetic']
  },
  'stable-yield-os': {
    name: 'Risk copilot',
    ticker: 'RISK-AI',
    productType: 'Automation / AI',
    structureTags: ['Automation', 'Synthetic']
  },
  'macro-switch-ai': {
    name: 'Earnings alert agent',
    ticker: 'EARN-AI',
    productType: 'Automation / AI',
    structureTags: ['Automation', 'Synthetic']
  },
  'liquidity-router-ai': {
    name: 'Pre-IPO watchlist agent',
    ticker: 'WATCH-AI',
    productType: 'Automation / AI',
    structureTags: ['Automation', 'Synthetic']
  }
};

function applyCuratedPaperProductOverrides(product) {
  return {
    ...product,
    ...(CURATED_PAPER_PRODUCT_OVERRIDES[product.id] || {})
  };
}

export const PAPER_PRODUCTS = ALL_PAPER_PRODUCTS
  .filter((product) => CURATED_PAPER_PRODUCT_IDS.includes(product.id))
  .map((product) => applyCuratedPaperProductOverrides(product));

function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seedString) {
  let seed = hashString(seedString) || 1;
  return function nextRandom() {
    seed += 0x6d2b79f5;
    let result = seed;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function roundPrice(value) {
  if (value >= 1000) return Number(value.toFixed(2));
  if (value >= 10) return Number(value.toFixed(2));
  return Number(value.toFixed(4));
}

export function getRangeOptionsForInterval(intervalId) {
  return PAPER_RANGES_BY_INTERVAL[intervalId] || PAPER_RANGES_BY_INTERVAL['1D'];
}

export function getRangeConfig(intervalId, rangeId) {
  const options = getRangeOptionsForInterval(intervalId);
  return options.find((option) => option.id === rangeId) || options[0];
}

export function getProductById(productId) {
  return PAPER_PRODUCTS.find((product) => product.id === productId) || PAPER_PRODUCTS[0];
}

export function buildFallbackBars(product, intervalId, rangeId) {
  const interval = PAPER_INTERVALS[intervalId] || PAPER_INTERVALS[product.defaultInterval] || PAPER_INTERVALS['1D'];
  const range = getRangeConfig(interval.id, rangeId || product.defaultRange);
  if (product.replayModel === 'yield-vault') {
    return buildYieldVaultBars(product, interval, range);
  }
  if (product.replayModel === 'term-ladder') {
    return buildTermLadderBars(product, interval, range);
  }
  if (product.replayModel === 'private-window') {
    return buildPrivateWindowBars(product, interval, range);
  }
  if (product.replayModel === 'ai-rotation') {
    return buildAiRotationBars(product, interval, range);
  }
  const random = createSeededRandom(`${product.id}-${interval.id}-${range.id}`);
  const count = range.bars;
  const bars = [];
  const now = Date.now();
  const start = now - (count - 1) * interval.ms;
  let previousClose = product.fallback.price;

  for (let index = 0; index < count; index += 1) {
    const regimeShift = Math.sin(index / Math.max(5, count / 9)) * product.fallback.volatility * 0.45;
    const sentimentWave = Math.cos(index / Math.max(7, count / 6)) * product.fallback.drift * 1.6;
    const noisyMove = (random() - 0.5) * product.fallback.volatility * 1.75;
    const open = Math.max(product.fallback.minPrice, previousClose * (1 + (random() - 0.5) * product.fallback.volatility * 0.35));
    const move = product.fallback.drift + regimeShift + sentimentWave + noisyMove;
    const close = Math.max(product.fallback.minPrice, open * (1 + move));
    const wickBoost = product.fallback.volatility * (0.45 + random() * 0.9);
    const high = Math.max(open, close) * (1 + wickBoost);
    const low = Math.max(product.fallback.minPrice, Math.min(open, close) * (1 - wickBoost));
    const volume = Math.round(product.fallback.volumeBase * (0.8 + random() * 0.9 + Math.abs(move) * 10));

    bars.push({
      ts: new Date(start + index * interval.ms).toISOString(),
      open: roundPrice(open),
      high: roundPrice(high),
      low: roundPrice(low),
      close: roundPrice(close),
      volume
    });

    previousClose = close;
  }

  return bars;
}

function buildYieldVaultBars(product, interval, range) {
  const random = createSeededRandom(`${product.id}-${interval.id}-${range.id}-yield`);
  const count = range.bars;
  const bars = [];
  const now = Date.now();
  const start = now - (count - 1) * interval.ms;
  let previousClose = product.fallback.price * (1 - count * product.fallback.drift * 0.45);

  for (let index = 0; index < count; index += 1) {
    const carry = product.fallback.drift * (0.85 + random() * 0.3);
    const mildDrawdown =
      index % Math.max(14, Math.round(count / 7)) === 0 && index !== 0
        ? -product.fallback.volatility * (0.18 + random() * 0.12)
        : 0;
    const shock = (random() - 0.5) * product.fallback.volatility * 0.22;
    const open = previousClose;
    const close = Math.max(product.fallback.minPrice, open * (1 + carry + mildDrawdown + shock));
    const high = Math.max(open, close) * (1 + product.fallback.volatility * (0.06 + random() * 0.12));
    const low = Math.max(product.fallback.minPrice, Math.min(open, close) * (1 - product.fallback.volatility * (0.04 + random() * 0.08)));

    bars.push({
      ts: new Date(start + index * interval.ms).toISOString(),
      open: roundPrice(open),
      high: roundPrice(high),
      low: roundPrice(low),
      close: roundPrice(close),
      volume: Math.round(product.fallback.volumeBase * (0.92 + random() * 0.22))
    });

    previousClose = close;
  }

  return bars;
}

function buildTermLadderBars(product, interval, range) {
  const random = createSeededRandom(`${product.id}-${interval.id}-${range.id}-ladder`);
  const count = range.bars;
  const bars = [];
  const now = Date.now();
  const start = now - (count - 1) * interval.ms;
  let previousClose = product.fallback.price * (1 - count * product.fallback.drift * 0.52);

  for (let index = 0; index < count; index += 1) {
    const rollStep = index % 30 === 0 && index !== 0 ? product.fallback.drift * (4.5 + random()) : 0;
    const repricingDip = index % 45 === 0 && index !== 0 ? -product.fallback.volatility * (0.28 + random() * 0.16) : 0;
    const carry = product.fallback.drift * (0.95 + random() * 0.35);
    const open = previousClose * (1 + (random() - 0.5) * product.fallback.volatility * 0.08);
    const close = Math.max(product.fallback.minPrice, open * (1 + carry + rollStep + repricingDip));
    const wick = product.fallback.volatility * (0.08 + random() * 0.16);

    bars.push({
      ts: new Date(start + index * interval.ms).toISOString(),
      open: roundPrice(open),
      high: roundPrice(Math.max(open, close) * (1 + wick)),
      low: roundPrice(Math.max(product.fallback.minPrice, Math.min(open, close) * (1 - wick))),
      close: roundPrice(close),
      volume: Math.round(product.fallback.volumeBase * (0.84 + random() * 0.3 + Math.abs(repricingDip) * 90))
    });

    previousClose = close;
  }

  return bars;
}

function buildPrivateWindowBars(product, interval, range) {
  const random = createSeededRandom(`${product.id}-${interval.id}-${range.id}-private`);
  const count = range.bars;
  const bars = [];
  const now = Date.now();
  const start = now - (count - 1) * interval.ms;
  let previousClose = product.fallback.price * (1 - count * product.fallback.drift * 0.18);

  for (let index = 0; index < count; index += 1) {
    const markDrift = product.fallback.drift * (0.35 + random() * 0.45);
    const windowShock =
      index % Math.max(24, Math.round(count / 6)) === 0 && index !== 0
        ? (random() > 0.48 ? 1 : -1) * product.fallback.volatility * (0.8 + random() * 1.4)
        : 0;
    const quietNoise = (random() - 0.5) * product.fallback.volatility * 0.16;
    const open = previousClose;
    const close = Math.max(product.fallback.minPrice, open * (1 + markDrift + windowShock + quietNoise));
    const wick = product.fallback.volatility * (0.08 + random() * 0.22);

    bars.push({
      ts: new Date(start + index * interval.ms).toISOString(),
      open: roundPrice(open),
      high: roundPrice(Math.max(open, close) * (1 + wick)),
      low: roundPrice(Math.max(product.fallback.minPrice, Math.min(open, close) * (1 - wick))),
      close: roundPrice(close),
      volume: Math.round(product.fallback.volumeBase * (0.32 + random() * 0.28 + Math.abs(windowShock) * 16))
    });

    previousClose = close;
  }

  return bars;
}

function buildAiRotationBars(product, interval, range) {
  const random = createSeededRandom(`${product.id}-${interval.id}-${range.id}-ai`);
  const count = range.bars;
  const bars = [];
  const now = Date.now();
  const start = now - (count - 1) * interval.ms;
  let previousClose = product.fallback.price * (1 - count * product.fallback.drift * 0.38);

  for (let index = 0; index < count; index += 1) {
    const trend = Math.sin(index / Math.max(10, count / 10)) * product.fallback.drift * 2.8;
    const rebalanceDrag =
      index % Math.max(18, Math.round(count / 8)) === 0 && index !== 0
        ? -product.fallback.volatility * (0.2 + random() * 0.14)
        : 0;
    const shock = (random() - 0.5) * product.fallback.volatility * 0.5;
    const open = previousClose * (1 + (random() - 0.5) * product.fallback.volatility * 0.08);
    const close = Math.max(product.fallback.minPrice, open * (1 + product.fallback.drift + trend + rebalanceDrag + shock));
    const wick = product.fallback.volatility * (0.12 + random() * 0.18);

    bars.push({
      ts: new Date(start + index * interval.ms).toISOString(),
      open: roundPrice(open),
      high: roundPrice(Math.max(open, close) * (1 + wick)),
      low: roundPrice(Math.max(product.fallback.minPrice, Math.min(open, close) * (1 - wick))),
      close: roundPrice(close),
      volume: Math.round(product.fallback.volumeBase * (0.75 + random() * 0.34 + Math.abs(shock) * 14))
    });

    previousClose = close;
  }

  return bars;
}

export function buildDefaultReplaySession() {
  return Object.fromEntries(
    PAPER_PRODUCTS.map((product) => [
      product.id,
      {
        interval: product.defaultInterval,
        range: product.defaultRange,
        cursor: 0,
        replayStarted: false
      }
    ])
  );
}
