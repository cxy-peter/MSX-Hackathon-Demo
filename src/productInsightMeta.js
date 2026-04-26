export const PAPER_PRODUCT_INSIGHTS = {
  'msx-stable-income': {
    diligenceScore: 91,
    holdings: [
      { name: 'Short-duration U.S. Treasury sleeve', weight: '61%', role: 'Primary NAV anchor' },
      { name: 'Government cash buffer', weight: '17%', role: 'Supports market-day liquidity' },
      { name: 'Repo and settlement reserve', weight: '12%', role: 'Keeps mint / redeem plumbing smooth' },
      { name: 'Operational cash', weight: '10%', role: 'Handles subscriptions, redemptions, and transfers' }
    ],
    feeStack: [
      'USTB management fee is shown publicly at 0.15% or less and is accrued into NAV rather than charged upfront.',
      'Route drag mainly comes from spread, fiat/stable conversion, and settlement plumbing rather than a visible trading commission.',
      'Tax treatment is usually closer to ordinary yield income than pure capital gains, depending on jurisdiction.'
    ],
    earningsBridge: [
      'Most of the return comes from treasury carry and repo spread, not from market beta.',
      'The product earns because short-duration government collateral is lent or rolled repeatedly.',
      'If short rates fall, the carry compresses and the same capital stack earns less.'
    ],
    investorWorries: [
      'Can I get money out quickly if redemptions spike?',
      'Is the reserve basket really there and is it audited often enough?',
      'How much of the stated APY disappears after fees, FX slippage, and taxes?'
    ],
    cexMath: [
      'OKX Simple Earn Flexible says hourly return is lent amount x APR / 365 / 24 x 85%, meaning a 15% platform share is taken from return, not principal.',
      'Binance Earn groups flexible, locked, dual investment, and on-chain yield under one surface, but product terms and lockups differ by lane.',
      'This RiskLens replay should therefore show gross yield, fee drag, and likely net-to-user value separately instead of one headline rate.'
    ],
    automation: [
      'Reserve monitor checks drift, buffer ratio, and attestation freshness every few hours.',
      'Rebalancer moves idle stable balances back into treasury sleeves when liquidity pressure drops.',
      'If proof freshness goes stale, new subscriptions should pause before redemptions do.'
    ],
    tokenRights: [
      'Receipt token should prove proportional claim on vault NAV, not promise a fixed dollar redemption.',
      'Wallet record should track entry date so tax holding period and fee accrual can be explained.',
      'Future updates could add proof-of-reserve attestation hashes to the receipt history.'
    ]
  },
  'msx-income-ladder': {
    diligenceScore: 88,
    holdings: [
      { name: 'Crypto cash-and-carry basis sleeve', weight: '46%', role: 'Main strategy return driver' },
      { name: 'USTB reserve sleeve', weight: '18%', role: 'Treasury-backed capital base' },
      { name: 'Staked SOL / ETH sleeves', weight: '17%', role: 'Supplemental carry and collateral' },
      { name: 'USD collateral pool', weight: '19%', role: 'Supports liquidity and margin operations' }
    ],
    feeStack: [
      'USCC shows a 0.75% management fee, accrued daily into NAV rather than charged as a ticket fee.',
      'The bigger risk is strategy slippage or basis compression, not just a visible wrapper charge.',
      'Tax treatment is usually mixed because carry income and realized gains can be treated differently.'
    ],
    earningsBridge: [
      'The ladder earns because users give up some liquidity and allow assets to stay in fixed term buckets.',
      'The extra yield is mostly term premium, not magic leverage.',
      'If users exit early, the discount window can erase a meaningful part of the extra carry.'
    ],
    investorWorries: [
      'What if I need liquidity before maturity?',
      'Is the incremental yield worth the lockup and potential haircut?',
      'How much of the final quoted yield survives after income tax and wrapper fees?'
    ],
    cexMath: [
      'OKX Dual Investment terms define term rate as APY / 365 x term, then settle in different currencies depending on target price and expiry price.',
      'Structured or term products should therefore always show settlement path, currency path, and expiry formula before showing headline APR.',
      'A term ladder on RiskLens should likewise separate hold-to-maturity value from early-exit value.'
    ],
    automation: [
      'Maturity engine can auto-roll or return cash depending on product policy.',
      'Discount windows widen when queue depth grows faster than reserve liquidity.',
      'Compliance engine should freeze new subscriptions if bucket mapping or reserve proof becomes stale.'
    ],
    tokenRights: [
      'Receipt token needs bucket, term, and maturity metadata tied to each subscription.',
      'Secondary transfer should never hide the fact that early exits can settle below book value.',
      'A later upgrade could surface estimated maturity proceeds directly from the token record.'
    ]
  },
  aaplx: {
    diligenceScore: 84,
    holdings: [
      { name: 'AAPL common share exposure', weight: '94%', role: 'Primary economic driver' },
      { name: 'Wrapper reserve cash', weight: '3%', role: 'Corporate action and custody friction buffer' },
      { name: 'Venue liquidity inventory', weight: '3%', role: 'Helps quote tokenized stock spreads' }
    ],
    feeStack: [
      'Kraken says buying xStocks with USD or USDG has no additional trading fee, but the execution price includes a market price plus a 1.0% spread.',
      'Wrapper / custody cost still matters because this is economic exposure through a token, not direct registered stock ownership.',
      'Channel drag and FX loss can still appear when funding starts in a stablecoin route rather than clean USD cash.',
      'Tax treatment looks more like equity capital gains, with short-term and long-term outcomes often differing.'
    ],
    earningsBridge: [
      'The token earns because the underlying share price rises, not because the wrapper itself manufactures yield.',
      'Any extra wrapper friction should be shown as drag against the underlying move.',
      'The right mental model is stock return minus wrapper cost minus tax, not stock return plus token story.'
    ],
    investorWorries: [
      'Do I really have the same rights as the underlying share?',
      'How wide can the spread get relative to the stock?',
      'How much does USDT funding and channel cost reduce my final net return?'
    ],
    cexMath: [
      'Coinbase states staking APY is shown after Coinbase commission and can still have extra fees like 1% instant unstake, which is a good reminder that display yield is often net of platform take.',
      'For tokenized equities, RiskLens should show wrapper drag explicitly instead of pretending the token always tracks the stock one-for-one after costs.',
      'Users should see both gross stock move and estimated net wrapper outcome.'
    ],
    automation: [
      'Corporate action watcher should map splits, dividends, and suspensions into the token wrapper.',
      'Liquidity bands should widen when the underlying market is closed or thin.',
      'Risk engine should warn when wrapper spread diverges too far from underlying reference price.'
    ],
    tokenRights: [
      'Token rights should clearly say whether voting, dividends, and corporate actions pass through or not.',
      'Wallet record should distinguish economic exposure from full legal shareholder rights.',
      'If dividend passthrough changes, that update belongs in the rights panel, not hidden in terms.'
    ]
  },
  tslax: {
    diligenceScore: 79,
    holdings: [
      { name: 'TSLA-linked option sleeve', weight: '52%', role: 'Primary payoff driver around the note range' },
      { name: 'Capital-protection reserve', weight: '28%', role: 'Buffers part of downside until note terms break' },
      { name: 'Dealer hedge inventory', weight: '12%', role: 'Supports barrier and delta management' },
      { name: 'Servicing and issuance reserve', weight: '8%', role: 'Pays note admin and settlement costs' }
    ],
    feeStack: [
      'Structuring spread: a meaningful part of the quoted yield is effectively option premium kept by the issuer or dealer.',
      'Channel, servicing, and issuance cost can easily exceed simple spot trading fees because this is a term product.',
      'Stablecoin-to-fiat funding still creates route drag before the note is even live.',
      'Tax treatment can be mixed because coupon-like income and final payoff do not always map cleanly to equity gains.'
    ],
    earningsBridge: [
      'Return comes from the payoff diagram, not from simply owning TSLA and waiting.',
      'The note earns because someone is effectively short or long optionality inside the structure.',
      'A headline coupon can coexist with capped upside, barrier risk, or weak downside protection.'
    ],
    investorWorries: [
      'What exactly happens if the underlying leaves the target range or hits a barrier?',
      'Is the yield really income, or am I just being paid to take hidden downside?',
      'Can I exit early without giving back most of the quoted advantage?'
    ],
    cexMath: [
      'Bybit Dual Asset and Binance Dual Investment both show why payoff conditions matter more than a single APR number.',
      'A structured lane on RiskLens should therefore separate headline coupon, payoff path, and final settlement asset before talking about return.',
      'The user needs the term sheet logic, not just a price chart.'
    ],
    automation: [
      'Barrier monitor should alert when the underlying approaches a knockout or conversion trigger.',
      'Note engine should surface early-exit value separately from maturity value.',
      'Term-sheet parser must flag when a structured note is being presented like a plain yield product.'
    ],
    tokenRights: [
      'The receipt token should say clearly whether the user owns a note claim, an SPV interest, or just platform exposure.',
      'Rights should disclose settlement date, early redemption rules, and barrier logic in plain English.',
      'If the payoff formula changes, the user should see a dated rights update rather than hidden legalese.'
    ]
  },
  'btc-usd': {
    diligenceScore: 83,
    holdings: [
      { name: 'BTC reference price', weight: '74%', role: 'Base directional driver for the perp tutorial' },
      { name: 'Perp funding and fee layer', weight: '16%', role: 'Represents carry and venue drag' },
      { name: 'Liquidation buffer reserve', weight: '10%', role: 'Shows how margin logic changes take-home value' }
    ],
    feeStack: [
      'Trading fee plus spread now matters more because the user is not just buying spot; they are entering and exiting a leveraged route.',
      'Funding and borrow style drag can flip sign over time, so carry is not always friendly.',
      'Liquidation can crystalize losses long before the underlying market would have forced a spot seller out.',
      'Short-term capital gains still matter because active directional trading often increases turnover.'
    ],
    earningsBridge: [
      'Perp-style PnL comes from the underlying move, but leverage changes how fast gains and losses hit equity.',
      'The same BTC move can produce very different outcomes once fees, funding, and liquidation rules get layered on top.',
      'The tutorial should teach path dependence, not just directional conviction.'
    ],
    investorWorries: [
      'How close am I to liquidation if BTC makes a routine move against me?',
      'Does positive gross PnL survive after fees and funding?',
      'Am I treating a leveraged route like it is just another spot chart?'
    ],
    cexMath: [
      'Mainstream CEX futures surfaces separate margin, funding, liquidation, and insurance logic because the product is a risk engine, not a spot ticket.',
      'RiskLens should keep leverage math visible so users see why notional, margin, and equity are different numbers.',
      'A good tutorial always shows liquidation marker, fee drag, and net exit value together.'
    ],
    automation: [
      'Risk engine should react before the liquidation zone is hit, not after.',
      'Funding monitor should explain whether carry is helping or hurting the position.',
      'Venue logic can later compare isolated and cross-margin outcomes inside the same replay.'
    ],
    tokenRights: [
      'The user does not gain issuer rights here; the practical rights are venue rules around custody, margin, and liquidation handling.',
      'If margin rules or risk limits change, that should appear like a product-rights update because it changes the route materially.'
    ]
  },
  'preipo-window': {
    diligenceScore: 76,
    holdings: [
      { name: 'Late-stage private share exposure', weight: '82%', role: 'Main valuation and exit driver' },
      { name: 'SPV or feeder structure', weight: '10%', role: 'Holds the private allocation and defines investor rights' },
      { name: 'Administrative reserve', weight: '8%', role: 'Supports legal, transfer, and servicing costs' }
    ],
    feeStack: [
      'SPV or feeder administration usually takes a meaningful annual and event-driven fee share.',
      'Transfer, legal, and compliance overhead is materially higher than a listed public wrapper.',
      'Secondary exit discounts can matter more than ticket fees because real liquidity is episodic.',
      'Tax outcomes can diverge sharply depending on jurisdiction and how the feeder is structured.'
    ],
    earningsBridge: [
      'Return comes from valuation rerates or eventual liquidity events such as IPOs, tenders, or acquisitions.',
      'There is no reliable daily public market to rescue the user if sentiment changes tomorrow.',
      'A private mark can stay flat for months and then move suddenly when a real transaction happens.'
    ],
    investorWorries: [
      'Will this company ever actually list or create a liquid exit?',
      'What exactly do I own through the feeder or SPV?',
      'Could the mark stay stale while the real risk has already changed?'
    ],
    cexMath: [
      'Private products should not inherit spot-market language because spread, mark, and liquidity are different in kind, not just in degree.',
      'RiskLens should show valuation logic, transfer limits, and exit tree instead of pretending this behaves like a listed chart.',
      'The educational focus is on rights, liquidity, and event risk.'
    ],
    automation: [
      'Eligibility and transfer restrictions should be checked before any subscription flow opens.',
      'Valuation update monitors should warn when the mark has gone stale relative to corporate events.',
      'Exit-tree automation can remind users that IPO, tender, acquisition, and no-exit scenarios are distinct paths.'
    ],
    tokenRights: [
      'The token or receipt should disclose whether the user owns an SPV claim, feeder interest, or direct share entitlement.',
      'Transfer restrictions, lockups, and eligibility gates belong in the rights panel, not buried in docs.',
      'If rights or transfer rules change, the product detail should surface a dated update.'
    ]
  },
  'ai-rotation': {
    diligenceScore: 81,
    holdings: [
      { name: 'Model-led risk-on sleeve', weight: '42%', role: 'Higher-beta allocation when signals are strong' },
      { name: 'Defensive carry sleeve', weight: '31%', role: 'Stabilizes the basket when conviction drops' },
      { name: 'Execution reserve', weight: '15%', role: 'Handles rebalance timing and slippage' },
      { name: 'Override buffer', weight: '12%', role: 'Lets humans step in when the model is stale or wrong' }
    ],
    feeStack: [
      'Strategy cost should separate model fee, execution cost, and any advisor or platform spread.',
      'Frequent rebalances can create invisible drag even when the headline performance looks smooth.',
      'Users still eat slippage, turnover, and tax friction if the basket moves around too often.',
      'If AI recommendations are packaged as a product, the user should see what extra layer they are paying for.'
    ],
    earningsBridge: [
      'Return comes from allocation timing and rebalance discipline, not from the existence of AI alone.',
      'A model can help smooth outcomes, but a late signal or stale dataset can quickly erase that edge.',
      'The basket earns only if the signal quality survives live execution and regime shifts.'
    ],
    investorWorries: [
      'What exactly is the model allowed to change without me noticing?',
      'How stale is the data feeding the strategy?',
      'When does a human override the model and how do I know?'
    ],
    cexMath: [
      'Automation routes on major venues are usually sold as convenience layers, but the investor still owns the execution outcome and the slippage.',
      'RiskLens should explain model scope, data freshness, and kill-switch behavior before showing any performance number.',
      'A strategy product needs governance disclosure as much as it needs a chart.'
    ],
    automation: [
      'Signal monitor should surface last model refresh, current confidence, and any stale-data warning.',
      'Human override and pause rules should be visible so users know when the system stops trusting itself.',
      'Turnover limits help keep a smart-looking basket from bleeding itself through cost drag.'
    ],
    tokenRights: [
      'If the user owns a strategy receipt, the rights should say whether it grants access, fee tier changes, or governance input.',
      'Rights should also say what data and action history are recorded for the wallet.',
      'A model update that changes portfolio behavior should show up as a dated rights or policy change.'
    ]
  },
  'eth-usd': {
    diligenceScore: 82,
    holdings: [
      { name: 'ETH spot inventory', weight: '100%', role: 'Single-asset reference exposure' }
    ],
    feeStack: [
      'Spot taker fee: assume about 10 bps per side before rebates.',
      'Spread and slippage: often 4 to 10 bps depending on venue depth and volatility.',
      'Gas or withdrawal cost matters only when moving on-chain, but tutorial users often confuse that with trading cost.',
      'Tax treatment is usually capital gains based, with active trading pushing more gains into short-term buckets.'
    ],
    earningsBridge: [
      'ETH spot earns through price appreciation only; staking or earn wrappers are separate layers.',
      'If the product also stakes or lends ETH, the user should see that source of yield separately from spot beta.',
      'Net outcome should combine market move, venue cost, and tax treatment.'
    ],
    investorWorries: [
      'How much is price exposure and how much is wrapper or staking exposure?',
      'What do I really keep after tax if I trade around large swings?',
      'Are on-chain costs relevant to this route or am I paying only exchange trading cost?'
    ],
    cexMath: [
      'Coinbase explains staking APY as recent network payouts net of Coinbase commission, then converted from APR to APY using standard compounding.',
      'That is a good model for RiskLens tutorials: show gross network or market return first, then show platform take and user net.',
      'Do not collapse price return, wrapper return, and staking return into one unexplained number.'
    ],
    automation: [
      'If ETH is paired with staking or earn routes later, reward accrual and unstake windows need separate monitors.',
      'Venue monitor should distinguish spot liquidity from any staked wrapper liquidity.',
      'Contract practice can later reuse the same ETH spot reference with leverage and liquidation bands.'
    ],
    tokenRights: [
      'Spot ETH itself has no issuer rights, but staking wrappers create queue, commission, and withdrawal policy rights.',
      'If RiskLens adds a wrapper, rights should disclose whether the user is exposed to staking queue risk or not.'
    ]
  }
};

export const WEALTH_PRODUCT_INSIGHTS = {
  'superstate-ustb': {
    holdings: [
      { name: 'Short-dated U.S. Treasury Bills', weight: '78%' },
      { name: 'Cash and sweep balances', weight: '12%' },
      { name: 'Operational reserve', weight: '6%' },
      { name: 'Other fund assets', weight: '4%' }
    ],
    feeStack: [
      'Management fee up to 0.15% / year',
      'Bank wire or gas costs sit outside the published management fee',
      'Stablecoin-to-fiat routing can still shave a few basis points off take-home value',
      'Tax view is usually closer to yield income than simple capital gains'
    ],
    whyEarns: 'USTB mostly earns from the same short-duration Treasury bill carry a conservative cash manager would expect.',
    worryCopy: 'Investors mainly worry about whether the token behaves like a real fund share, how fast it redeems, and how much of the gross yield survives after route drag and taxes.'
  },
  'ondo-usdy': {
    holdings: [
      { name: 'Short-term U.S. Treasuries', weight: '54%' },
      { name: 'Short treasury ETF sleeve', weight: '21%' },
      { name: 'Bank demand deposits', weight: '15%' },
      { name: 'Cash buffer', weight: '10%' }
    ],
    feeStack: [
      'Issuer spread is embedded inside the net yield rather than shown as a clear ticket fee',
      'Stablecoin and bank-transfer routing costs can still matter',
      'Users should check whether rebasing versus price accrual changes their reporting and tax treatment',
      'Tax view depends on local treatment of note income rather than plain stablecoin gains'
    ],
    whyEarns: 'USDY earns by passing through treasury-linked dollar yield from the collateral basket after issuer spread and expenses.',
    worryCopy: 'Users mostly worry about whether the token is really cash-like, how redemption works, and whether the wrapper rules are stricter than the UI suggests.'
  },
  'franklin-fobxx': {
    holdings: [
      { name: 'U.S. government securities', weight: '64%' },
      { name: 'Repo collateralized by govies', weight: '23%' },
      { name: 'Cash and near-cash', weight: '13%' }
    ],
    feeStack: [
      'Net expense ratio around 0.20%',
      'Access-channel fees can differ from the official fund expense ratio',
      'Stable-NAV presentation reduces visible price move but not the underlying fee stack',
      'Tax view is usually money-market style income rather than equity-style gain'
    ],
    whyEarns: 'FOBXX earns like a classic government money-market fund, with the token layer mainly changing recordkeeping and access.',
    worryCopy: 'Investors care about whether the stable-NAV framing hides complexity, which channel they need to use, and how much yield remains after expenses.'
  },
  'ondo-ousg': {
    holdings: [
      { name: 'BlackRock and other treasury fund sleeves', weight: '52%' },
      { name: 'Government-sponsored enterprise exposure', weight: '18%' },
      { name: 'USDC and bank deposits for liquidity', weight: '16%' },
      { name: 'Treasury cash buffer', weight: '14%' }
    ],
    feeStack: [
      'Management fee 0.15% / year, waived until July 1, 2026 per official docs',
      'Instant mint and redeem paths can carry extra fees',
      'Stablecoin routing still creates small but real FX / channel drag',
      'Tax view is partnership-like pass-through, not a simple token-capital-gains story'
    ],
    whyEarns: 'OUSG earns from short-term treasury exposure and liquidity management inside Ondo’s qualified-access fund structure.',
    worryCopy: 'The biggest questions are who can access it, how expensive instant liquidity really is, and what taxes or reporting arrive with the fund wrapper.'
  },
  'hashnote-usyc': {
    holdings: [
      { name: 'Short-term U.S. Treasury Bills', weight: '57%' },
      { name: 'Repo and reverse-repo sleeves', weight: '28%' },
      { name: 'Cash and collateral buffer', weight: '15%' }
    ],
    feeStack: [
      'Service, management, and redemption fees are disclosed in the docs rather than shown as a simple ticket fee',
      'Custom private-liquidity arrangements can add incremental cost',
      'Stablecoin routing and wallet operations still create small but real drag',
      'Tax view is usually closer to fund income than to simple token trading gain'
    ],
    whyEarns: 'USYC earns from short-term T-bills and repo activity designed to track short-term Fed-rate style return.',
    worryCopy: 'Investors mostly worry about the non-U.S. institutional onboarding gate, whether USDC liquidity is really available when needed, and how much of the gross rate survives after service drag.'
  },
  'openeden-tbill': {
    holdings: [
      { name: 'Short-dated U.S. Treasury Bills', weight: '84%' },
      { name: 'USD settlement balances', weight: '11%' },
      { name: 'Vault operating reserve', weight: '5%' }
    ],
    feeStack: [
      'Total expense ratio 0.30% / year',
      'Transaction fee 5 bps on subscription and redemption',
      'Stablecoin route and gas costs sit on top of the TER',
      'Tax view depends on jurisdiction and whether the wrapper is treated like fund income'
    ],
    whyEarns: 'TBILL earns mostly from short-dated Treasury bills, but the docs also make the vault fee and redemption mechanics visible.',
    worryCopy: 'Users mainly worry about whitelist restrictions, next-business-day queue timing, and whether stablecoin route drag eats too much of the treasury yield.'
  },
  'blackrock-buidl': {
    holdings: [
      { name: 'Cash and cash-equivalent balances', weight: '41%' },
      { name: 'U.S. Treasury Bills', weight: '37%' },
      { name: 'Repo and secured liquidity assets', weight: '22%' }
    ],
    feeStack: [
      'Institutional fund and distribution fees apply even if the token itself targets stable value',
      'Stablecoin conversion and transfer-agent workflow can create additional friction',
      'Dividend handling can make the net user experience look simpler than the underlying fee stack really is',
      'Tax treatment is closer to fund income and dividends than to plain stablecoin appreciation'
    ],
    whyEarns: 'BUIDL earns from short-duration government and cash-equivalent exposure inside an institutional liquidity-fund wrapper.',
    worryCopy: 'The main user concern is that BUIDL feels simple in screenshots while the real experience still depends on qualified access, a very high minimum, and institutional settlement rails.'
  },
  'superstate-uscc': {
    holdings: [
      { name: 'USD collateral', weight: '31%' },
      { name: 'USTB collateral sleeve', weight: '12%' },
      { name: 'Staked SOL and liquid staking', weight: '20%' },
      { name: 'weETH sleeve', weight: '16%' },
      { name: 'XRP custody', weight: '15%' },
      { name: 'CME futures hedges', weight: '6%' }
    ],
    feeStack: [
      'Management fee 0.75% / year',
      'Basis slippage and execution cost are economically real even if they do not show up as a simple ticket fee',
      'Staking, borrow, and exchange funding effects can change net carry materially',
      'Tax view is usually more complex because the product mixes trading, staking, and collateral income'
    ],
    whyEarns: 'USCC earns when basis spreads, staking yield, and Treasury collateral together outweigh hedging and execution drag.',
    worryCopy: 'Investors worry that basis can disappear quickly, that strategy risk is being hidden behind a fund wrapper, and that taxes will be messier than the headline yield implies.'
  },
  'hamilton-scope': {
    holdings: [
      { name: 'Senior secured private loans', weight: '44%' },
      { name: 'Middle-market credit sleeves', weight: '28%' },
      { name: 'Cash and liquidity reserve', weight: '14%' },
      { name: 'Opportunistic credit positions', weight: '14%' }
    ],
    feeStack: [
      'Fund-level management and servicing fees apply',
      'Distribution and transfer-agent drag can sit above the core credit spread',
      'On-demand redemption language should not be mistaken for instant cash-out economics',
      'Tax treatment often follows private-fund income rules rather than plain bond-tax intuition'
    ],
    whyEarns: 'SCOPE earns because the underlying manager is taking senior-credit and underwriting risk that treasuries do not have.',
    worryCopy: 'Users mostly worry about default risk, private-fund fees, and whether tokenization makes a less-liquid credit sleeve look too easy to exit.'
  },
  'apollo-acred': {
    holdings: [
      { name: 'Diversified private credit book', weight: '46%' },
      { name: 'Floating-rate lending exposure', weight: '24%' },
      { name: 'Structured credit reserve', weight: '16%' },
      { name: 'Cash and treasury buffer', weight: '14%' }
    ],
    feeStack: [
      'Fund-level management and servicing fees apply',
      'Tokenization lowers distribution friction, not underlying credit underwriting cost',
      'Stablecoin or channel routing can still clip a few more basis points',
      'Tax view can be meaningfully different from a treasury or stable-yield product'
    ],
    whyEarns: 'ACRED earns by taking diversified private-credit exposure where borrower spread and manager sourcing generate the extra income.',
    worryCopy: 'Investors want to know why the yield is higher, how much credit risk they are really underwriting, and what net value remains after fees, taxes, and route drag.'
  },
  'smart-entry-note': {
    holdings: [
      { name: 'BTC-linked payoff leg', weight: '46%' },
      { name: 'ETH-linked payoff leg', weight: '34%' },
      { name: 'TSLA-linked payoff leg', weight: '20%' }
    ],
    feeStack: [
      'Pricing spread is embedded into the note rather than shown as a ticket fee',
      'Unwind discount can be material before maturity',
      'Channel cost and collateral routing still create hidden drag',
      'Tax view depends on whether the jurisdiction treats it as derivative income or capital result'
    ],
    whyEarns: 'The note earns because the user is selling flexibility and accepting conditional settlement in exchange for a higher coupon.',
    worryCopy: 'The biggest fear is ending with the wrong asset at the wrong time while still paying hidden structuring drag.'
  }
};

export const GLOBAL_TOKEN_RIGHTS_NOTES = [
  'Receipt tokens should record wallet ownership, entry date, and the route used to arrive at the position.',
  'If rights, passthrough policy, or redemption handling changes, that update belongs in a visible dated changelog.',
  'For teaching, the user should always see whether the token grants economic exposure, legal ownership, or only a platform claim.'
];
