# Paper Trading Proposal

## 1. Current project status

This repo already has two useful pieces:

- `src/WealthApp.jsx`: a strong "goal -> shelf -> detail -> position" product structure.
- `src/PaperTradingApp.jsx`: a wallet-linked demo ledger with localStorage persistence, but it still uses hardcoded prices and a very simple buy/sell flow.

So the shortest path is not to build a full exchange simulator from scratch.
The shortest path is to turn the current paper trading page into a **historical replay simulator** with the same explainable product language as the wealth page.

## 2. Product goal

The new paper trading page should answer three beginner questions clearly:

1. What am I trading?
2. What would have happened if I bought here?
3. Why is this different from a wealth product or a live CEX order flow?

That keeps the feature aligned with the project's value:

- help users understand MSX-style tokenized products before live trading
- show the difference between RWA / wealth / tokenized stock / crypto perps
- reduce the jump from "discover" to "real trading"

## 3. Recommended feature shape

### A. Replay-first trading mode

Core interaction:

- User chooses an asset or product
- User chooses a historical window
- User enters replay mode from the first candle of that window
- User can step bar-by-bar or play forward
- User places simulated buy/sell orders against the current replay candle
- System updates position, average cost, realized PnL, unrealized PnL, and trade log

This is easier to understand than a fake live market because the user can immediately see "if I did this on that day, what happened next."

### B. Three product lanes

Keep the page visually simple by splitting the universe into three lanes:

1. `MSX Starter / RWA`
   - OUSG-like
   - USDY-like
   - stable income / treasury style products

2. `MSX Equity / Tokenized Stock`
   - TSLA-style wrapper
   - NVDA / AAPL / SPY style names
   - explained as "price tracks the underlying, but the wrapper is still a platform product"

3. `CEX / Crypto`
   - BTC
   - ETH
   - SOL
   - optional BTC or ETH perpetual view

This keeps the learning path obvious:

- start with lower-complexity products
- then move into tokenized equities
- finally compare with common CEX assets

### C. Easy-to-read page layout

Reuse the wealth page style and information density.

Suggested layout:

- Top hero:
  - Replay account value
  - Cash
  - Unrealized PnL
  - Realized PnL
  - Replay date / speed

- Left column:
  - Goal tabs or asset-lane tabs
  - Product shelf cards
  - Quick filters: `RWA`, `Stock Token`, `Crypto`, `Beginner`, `Advanced`

- Center column:
  - Candlestick chart
  - Play / pause / next bar / previous bar
  - Date picker and interval selector
  - Order ticket

- Right column:
  - "Human mode" explanation
  - "Protocol mode" explanation
  - Why this product exists on MSX
  - Worst case / volatility note / liquidity note

- Bottom area:
  - Open positions
  - Filled trade log
  - What changed after this trade

## 4. Data strategy

### Best practical split

Do not force one data source to cover everything.

- `Crypto spot / perp`: use public CEX candles
- `Tokenized stocks`: use the underlying equity candles as the replay source
- `MSX wealth / RWA products`: use internal demo NAV series JSON first

Reason:

- CEX candle APIs are easy and usually free for market data
- tokenized stock price education is mainly about direction, timing, and wrapper explanation, so underlying equity replay is good enough for MVP
- MSX-specific RWA shelves likely need curated NAV / scenario data anyway because public historical APIs are not obvious

### Recommended source matrix

#### 1. Crypto market data

Use official public market data endpoints first:

- Binance `klines` / `uiKlines`
- OKX `candles` / `history-candles`
- Bybit `market/kline`
- Coinbase public candles as backup

These are ideal for:

- BTC / ETH / SOL spot replay
- optional mark-price replay for perps
- public demo without paid data

#### 2. Equity / tokenized stock reference data

For MVP, map tokenized stock products to underlying equity data:

- `TSLAX` -> `TSLA`
- `NVDAX` -> `NVDA`
- `AAPLX` -> `AAPL`
- `SPYX` -> `SPY`

Use one of these:

- Alpha Vantage: simple and cheap/free to start
- Twelve Data: cleaner multi-asset developer experience
- Polygon: stronger product if later you want better coverage, but not the cheapest long-term choice for a hackathon demo

#### 3. MSX-native wealth/RWA replay data

Start with repo-local JSON instead of live fetch:

- `src/demoFeeds/msxStableIncome.json`
- `src/demoFeeds/msxIncomeLadder.json`
- `src/demoFeeds/msxQuantSelect.json`

Each series can be daily bars or daily NAV points:

```json
[
  { "ts": "2026-01-02", "open": 1.012, "high": 1.013, "low": 1.011, "close": 1.013, "volume": 0 },
  { "ts": "2026-01-03", "open": 1.013, "high": 1.014, "low": 1.012, "close": 1.014, "volume": 0 }
]
```

That makes the product believable without blocking on external APIs.

## 5. Recommended system design

### Data model

Normalize every source into one candle shape:

```ts
type ReplayBar = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};
```

And one product config shape:

```ts
type ReplayProduct = {
  id: string;
  name: string;
  lane: 'rwa' | 'stock-token' | 'crypto';
  symbol: string;
  source: 'binance' | 'okx' | 'bybit' | 'coinbase' | 'alphavantage' | 'twelvedata' | 'local';
  intervalOptions: string[];
  explanation: {
    human: string;
    technical: string;
    returnSource: string;
    worstCase: string;
  };
};
```

### State model

Keep it local-first like the existing demo:

- `cash`
- `positions`
- `orders`
- `fills`
- `selectedProduct`
- `selectedRange`
- `currentBarIndex`
- `playbackSpeed`

Persist per wallet in localStorage first.
Only add backend storage later if you need cross-device sync or leaderboards.

### Execution model

For MVP, keep execution simple and transparent:

- Market buy fills at current bar close
- Market sell fills at current bar close
- Optional "better realism" mode later:
  - buy fills at next bar open
  - slippage based on lane
  - wider spread for tokenized stocks / low-liquidity products

This is enough to teach users without overwhelming them.

## 6. What to reuse from the current repo

### Reuse directly

- wealth-style card layout and summary blocks
- `Human mode / Protocol mode` toggle
- wallet-linked localStorage model
- risk pills and explanation blocks

### Refactor next

- move product config out of `PaperTradingApp.jsx`
- add a dedicated replay data adapter layer
- separate chart / ticket / ledger into smaller components

Suggested file split:

- `src/paperTrading/products.js`
- `src/paperTrading/dataSources.js`
- `src/paperTrading/replayEngine.js`
- `src/paperTrading/useReplayState.js`
- `src/paperTrading/PaperTradingChart.jsx`
- `src/paperTrading/PaperTradingTicket.jsx`
- `src/paperTrading/PaperTradingLedger.jsx`

## 7. MVP scope

If you want this to land quickly, keep MVP to:

1. 6 products total
   - 2 RWA
   - 2 tokenized stocks
   - 2 crypto

2. 3 data source modes
   - local JSON for RWA
   - one equity provider for stock tokens
   - one CEX provider for crypto

3. 4 actions
   - buy
   - sell
   - next bar
   - autoplay

4. 4 outputs
   - chart
   - open positions
   - trade log
   - explanation panel

## 8. Why this version is valuable

This design makes the tool useful in a way a normal exchange UI is not:

- It explains product differences, not just price moves
- It gives MSX a "practice before live" layer
- It connects wealth-style education with trading-style interaction
- It lets users compare tokenized stocks, RWAs, and crypto inside one learning surface

In short:

This page should feel like **"an explainable replay lab"**, not just **"a fake exchange."**
