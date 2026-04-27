# RiskLens Guided Investing Hub

RiskLens Guided Investing Hub is a React + Vite hackathon prototype for wallet-native financial education, explainable wealth products, paper-token replay trading, and optional Sepolia achievement / receipt-vault flows.

The demo is not a production exchange, broker, investment adviser, or live trading system. It is designed to answer one product question: can a beginner understand a tokenized financial product, practice the decision with paper tokens, and only then move toward wallet-confirmed Web3 actions?

## Project summary

RiskLens turns a Web3 investing flow into a guided learning path instead of dropping the user directly into a trading terminal.

The app has three main user surfaces plus a supporting backend API layer:

| Surface | What it demonstrates |
| --- | --- |
| Welcome hub | Wallet connection, nickname, wallet backup / recovery, risk review, product quiz, and task badge progression. |
| Wealth | Product shelf, product detail, AI diligence, receipt lifecycle, min-ticket / predicted-NAV settlement, pledge / settle flows, and a PT-only dual-investment simulator. |
| Paper Trading | Historical replay desk, Spot / xStock lanes, payoff templates, portfolio combo lab, trade log, floating leaderboard, wallet-linked tasks, and replay achievement status. |
| Backend API layer | Serverless route calculations, wealth settlement previews, shared paper leaderboards, and decentralized profile-pointer storage without raw wallet profiles. |

The main design principle is progressive trust. A user first learns what a product means, then sees risk and suitability evidence, then practices with replay bars, and only then encounters signatures, badges, or receipt-vault mechanics.

## Live demo and routes

Live demo route:

```text
https://msx-hackathon-demo-x3yc.vercel.app/paper-trading.html
```

Local routes after starting Vite:

| Route | Purpose |
| --- | --- |
| `/` | Welcome hub, wallet access, nickname, backup / recovery, onboarding tasks, risk review, and product quiz. |
| `/wealth.html` | Wealth product shelf, product detail, AI diligence, receipt lifecycle, dual investment, and wallet-linked wealth tasks. |
| `/paper-trading.html` | Replay desk, historical paper trading, product lanes, open positions, trade log, leaderboard, and replay achievement tasks. |
| `/chart-hover-demo.html` | Standalone chart hover / interaction demo. |

## What judges should try

1. Open `/` and connect a wallet, or inspect the wallet access modal without connecting.
2. Set a wallet nickname and notice that identity, backup, and progress are wallet-linked.
3. Review the onboarding tasks and the difference between local completion, `Wait to be minted`, and completed on-chain state.
4. Open `/wealth.html`, select recommended products, AI picks, or timeline rows, and inspect the product detail tabs: Overview, Timeline, AI Diligence, and Onchain.
5. In Wealth, try a subscribe / settle path with a low amount to see min-ticket feedback, then use Today / Suggested / forward-date controls to review predicted NAV.
6. Try the dual-investment card. It uses PT only, not real stablecoins, and models subscription amount, target price, direction, term, payoff range, and term-premium preview.
7. Open `/paper-trading.html`, choose a Spot or xStock route, step through replay bars, place simulated trades, and inspect the floating open-position / trade-log windows.
8. Try an AI strategy template or portfolio combo, then review how the leaderboard row can be reused and how invalid combo weights are blocked instead of silently normalized.
9. Review how leaderboard rows, wallet state, and replay achievement tasks react to the connected account.
10. On the deployed Vercel demo, refresh the paper leaderboard or submit a replay / strategy score and check the backend sync text. It should describe whether rows are persisted through KV or temporarily held in API memory, while profile data remains CID-pointer only.

## Recent improvements

| Area | What changed |
| --- | --- |
| Serverless backend | Added `/api/paper-leaderboards`, `/api/profile-pointer`, `/api/tutorial-routes`, and `/api/wealth-calculations` so the demo has real API routes for shared leaderboards, route math, wealth previews, and profile-pointer registration. |
| Backend resilience | The API now uses shared CORS / no-store JSON handling, bounded request bodies, cleaner 4xx errors for bad JSON, and a KV-to-memory fallback so a demo does not fail hard when optional storage is unavailable. |
| Profile privacy | Backend writes reject raw wallet profiles and store only hashed wallet keys, CID-ready content pointers, content hashes, and signature hashes. |
| Paper trading | Spot / xStock lanes, payoff-template controls, drawdown-aware practice ranking, portfolio combo validation, reusable strategy leaderboard rows, and backend leaderboard sync are now aligned. |
| Wealth routing | Recommended chips, AI picks, positions, and timeline rows deep-link into the correct product detail instead of only changing filters or revealing lower-page content. |
| Wealth settlement | Subscribe flows now show explicit min-ticket feedback, and the settlement view starts from Today with Suggested / forward-date predicted-NAV controls. |
| Wealth claims | Wealth badge claims are driven by actual product-detail activity and, when the vault address is configured, require both Sepolia task state and ERC-1155 collectible balance checks. |
| Dual investment | Backend and UI calculations frame output as a short-term premium / target-price settlement preview rather than stable APY. |
| Documentation | README now calls out the backend routes, storage behavior, API configuration, and local vs Vercel expectations. |

## Web3 component

The Web3 layer is essential because the project is about wallet-native learning and verifiable progression, not just an educational dashboard.

| Component | Why it matters |
| --- | --- |
| MetaMask connection | Uses the wallet as the continuity layer across home, wealth, and paper trading. |
| Wallet nickname and backup | Keeps demo identity, preferences, and progress tied to a wallet profile rather than a generic browser session. |
| Signatures | Teach the difference between reading data, approving intent, and changing state. |
| Sepolia task badges | Let learning milestones become wallet-visible achievements when contracts are configured. |
| Replay achievement badges | Represent simulation tasks such as base replay, leaderboard, spot loop, leverage, and hedge milestones. |
| Receipt-vault model | Demonstrates why tokenized products need lifecycle state: eligibility, NAV, attestation freshness, subscription, settlement, redemption, and collectible / receipt ownership. |

The UI still works without deployed contracts. In that mode, the app uses local wallet-linked state so judges can evaluate the product safely without real funds.

## Core features

### Wallet-first onboarding

The wallet modal is shared conceptually across home, wealth, and paper trading. It supports MetaMask connection, wallet nickname, disconnect confirmation, profile backup, recovery from historical local wallet snapshots, and per-wallet progress. The nickname is saved with the wallet profile so leaderboard and task surfaces can show a human label when available.

### Wealth product shelf

Wealth focuses on beginner-readable product understanding rather than dense exchange controls. Product cards, recommendation chips, AI picks, positions, and timeline rows deep-link into the correct detail view. The detail surface organizes product information into Buy / settle / pledge, Overview, Timeline, AI Diligence, and Onchain views.

Subscribe flows validate product min tickets before review. Settlement starts from Today and uses Suggested / forward-date controls to show projected NAV and maturity state instead of implying that time has already passed.

The dual-investment section is modeled as a PT-only learning product. Users can choose trading pair, direction, settlement bucket, target price range, and subscription amount. The output is a payoff-range, term-premium, and scenario explanation, not a real stablecoin settlement flow.

### Paper Trading Replay Lab

Paper trading is a replay lab. Users choose products and routes, step through historical bars, simulate entries and exits, and track local positions. The shelf separates familiar Spot routes from xStock / listed-wrapper routes, then layers tutorials for leverage, hedge, strategy, automation, yield, and portfolio-combo practice.

The replay engine tracks paper balance, position size, average cost, gross PnL, net PnL, fees, carry effects, route state, drawdown, and task completion. It is designed to make the consequence of a decision visible before a user touches live trading. Open positions and trade logs are kept as right-side floating windows so the replay desk stays focused.

The strategy area is local and explainable. Users can adjust payoff templates, upload AI strategy rows, apply leaderboard templates back into the desk, or build a portfolio combo from bundled replay series. Manual combo weights must total 100% before upload / settle.

### AI diligence workspace

AI Diligence is implemented as a local evidence-backed workspace instead of a generic score widget. It separates product quality, evidence confidence, market regime, suitability, red flags, memo-style explanation, and follow-up questions. This keeps the review auditable even without a backend model call.

### Wallet-linked task system

Task cards now distinguish three states:

| State | Meaning |
| --- | --- |
| To do / pending | The current wallet has not met the condition. |
| Wait to be minted | The wallet has completed the local condition, but the on-chain or collectible state has not been minted for that wallet. |
| Completed | The connected wallet has the completed / minted task state. |

This matters because a different wallet should not inherit another account's badges or leaderboard identity. Wealth tasks are not marked ready by clicking a card alone; they come from product-detail actions such as a positive subscription / trade step, pledge desk activity, or dual-investment activity. The claim panel requires the selected task to be `3/3 ready` before a wallet can claim.

When `VITE_WEALTH_VAULT_ADDRESS` is configured, claimed Wealth status is checked against Sepolia task flags and ERC-1155 `balanceOf(...)` ownership. Without that configuration, the same flow falls back to wallet-local profile claims so the demo remains reviewable.

### Serverless backend API

The backend is intentionally small and audit-friendly. It supports shared demo state and deterministic calculations without becoming a custodial trading service.

| Endpoint | Purpose | Storage behavior |
| --- | --- | --- |
| `/api/paper-leaderboards` | Reads and writes replay-score and AI-strategy leaderboard rows. | Uses Vercel KV / Upstash REST when configured, with API memory fallback for demos. |
| `/api/profile-pointer` | Registers a wallet's decentralized profile backup pointer. | Stores hashed wallet key, CID-ready pointer, content hash, and signature hash only; raw profiles are rejected. |
| `/api/tutorial-routes` | Calculates replay route previews for spot, leverage, hedge, strategy, automation, and yield tutorial paths. | Stateless calculation; no wallet profile storage. |
| `/api/wealth-calculations` | Calculates receipt NAV settlement and dual-investment term-premium previews. | Stateless calculation; no wallet profile storage. |

The frontend client lives in `src/risklensBackendClient.js`. If the backend is unavailable during a local Vite-only run, the UI keeps working with local fallback state and shows that backend sync is offline.

## Algorithm and engineering highlights

### Replay state and PnL accounting

The replay desk keeps multiple moving inputs aligned: selected product, route, replay cursor, ticket size, wallet-linked paper balance, open positions, trade log, fees, carry drag, drawdown, combo weights, and settlement state. A major challenge is avoiding stale previews when the user changes notional, product, route, strategy controls, or combo allocation. The current implementation treats those controls as replay-state inputs instead of cosmetic labels.

### Task gating across local and on-chain state

Task status cannot be a simple boolean. The app reconciles local progress, current wallet address, optional Sepolia reads, contract availability, and collectible balance reads. This is why a finished local action can show `Wait to be minted`, while a truly minted badge shows as completed only for the connected wallet.

### Dual-investment simulation without real stablecoins

The dual-investment flow intentionally avoids real USDC, USDT, ETH, or BTC transfer. Instead, it uses PT as the demo budget and models direction, target price, settlement window, subscription amount, term premium, payoff range, and above / below outcome preview. This preserves the learning value without creating a fake live financial promise.

### Receipt settlement and ticket validation

Wealth receipt flows keep subscription, settlement, and pledge state separate. The subscribe desk blocks below-minimum ticket amounts with explicit feedback, while the timeline uses Today, Suggested, 30D, 90D, and longer forward-date controls to show predicted NAV and whether maturity / redemption conditions are ready.

### Diligence as evidence, not magic scoring

The diligence layer is deterministic and local. Rather than pretending an opaque AI model has perfect judgment, it builds structured review sections from product metadata and risk signals. That makes the UI easier to audit during judging and safer for a financial education prototype.

### Backend privacy and graceful fallback

The serverless API is designed for demo continuity, not custody. Leaderboards can persist through optional Vercel KV / Upstash REST storage, but the same routes fall back to process memory when KV is missing or temporarily unavailable. Profile backup flows send only decentralized storage pointers and hashes to the API, while the raw wallet profile stays in local, encrypted, decentralized, or on-chain-adjacent evidence flows.

### UI state consistency

The same wallet identity now has to appear consistently in home, wealth, paper trading, task cards, backup / recovery, leaderboard rows, and nickname controls. The difficult part was not adding a button, but making sure every surface respects the current wallet and does not accidentally show another account's completed state.

## Difficult problems solved during development

Several hard issues were resolved directly through Codex-assisted implementation inside this repo:

| Problem | Resolution |
| --- | --- |
| Vercel build failures from malformed JSX / localization strings | Cleaned corrupted fallback strings and broken template literals in `WealthApp.jsx`, then restored build-safe JSX structure. |
| Wallet state felt shared across accounts | Added wallet-linked nickname/profile behavior, backup history, recovery selection, and disconnect confirmation patterns. |
| Tasks looked completed even when only local progress existed | Reworked task status logic so local completion becomes `Wait to be minted` until the connected wallet has the minted/claimed state. Wealth claims also check Sepolia task flags plus ERC-1155 balance when the vault is configured. |
| Paper Trading became visually crowded | Restored AI diligence cards, moved open positions and trade log into right floating windows, reduced bottom whitespace, and moved route controls to the replay desk corner. |
| Wealth product cards had too much protocol wording | Removed low-value mint/burn copy from product cards and moved lifecycle detail into the product detail flow. |
| Dual investment looked like a generic APY card | Rebuilt it around pair, direction, target price, settlement bucket, subscription amount, payoff range, and term-premium preview. |
| Leaderboard and wallet identity were too address-heavy | Leaderboard display now prefers wallet nickname when one is saved, and falls back to a short address otherwise. |
| Wealth task cards could be completed too easily | Reworked Wealth tasks around real product-detail activity and a `3/3 ready` claim gate. |
| Settlement looked like a generic progress bar | Replaced it with Today-first date controls and predicted-NAV copy. |
| Portfolio combo weights were easy to misunderstand | Upload / apply now blocks invalid weights with explicit feedback instead of silently normalizing them. |
| Task cards did not visually communicate status | Added right-corner status pills, yellow pulse / ripple for unfinished or wait-to-mint states, and green borders for completed tasks. |
| Backend sync could fail too loudly during demos | Hardened serverless helpers so optional KV failures fall back to API memory and bad JSON / oversized bodies return clear 4xx responses. |
| Profile backup needed backend evidence without storing private user state | Added a profile-pointer API that rejects raw wallet profiles and stores only hashed wallet identifiers, CID-ready pointers, content hashes, and signature hashes. |

## Architecture

```text
MSX-Hackathon-Demo/
  api/
    _risklensStorage.js
    paper-leaderboards.js
    profile-pointer.js
    tutorial-routes.js
    wealth-calculations.js
  contracts/
    MSXCollectibleRenderer.sol
    MSXQuestBadge.sol
    MSXReplayAchievementBadge.sol
    MSXUnifiedDemoHub.sol
    MSXWealthReceiptVault.sol
  scripts/
    deploy-unified-demo-hub.js
    deploy-replay-achievement-badge.js
    deploy-welcome-badge.js
    deploy-wealth-vault.js
    downloadReplayData.mjs
    downloadWealthRwaData.mjs
    update-wealth-vault-state.js
    profile-storage-gateway.mjs
  src/
    App.jsx
    WealthApp.jsx
    PaperTradingApp.jsx
    ReplayChartPanel.jsx
    PaperTradingChart.jsx
    paperTradingConfig.js
    paperTradingData.js
    risklensBackendClient.js
    walletProfileStore.js
    wagmiSetup.js
    diligence/
      report.js
  index.html
  wealth.html
  paper-trading.html
  chart-hover-demo.html
  package.json
  vite.config.js
```

## Tech stack

| Area | Tools |
| --- | --- |
| Frontend | React, Vite, JavaScript / JSX, CSS |
| Backend | Vercel serverless functions, optional Vercel KV / Upstash REST storage, API memory fallback |
| Wallet / Web3 | MetaMask, Wagmi, Viem, ethers |
| Contracts | Solidity, Hardhat, OpenZeppelin |
| State | Local storage, wallet profile store, optional profile storage gateway, decentralized profile pointers |
| Deployment | Vercel for static frontend, Sepolia for optional contract flows |

## Local setup

Prerequisites:

- Node.js 20+
- npm
- Modern browser
- MetaMask if testing wallet flows

Install and run:

```bash
git clone https://github.com/cxy-peter/MSX-Hackathon-Demo.git
cd MSX-Hackathon-Demo
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

Windows helper:

```powershell
.\start-local.ps1
```

Backend API notes:

- The deployed Vercel app serves `/api/*` with the same project.
- A Vite-only local run is enough to review the UI. Backend-backed widgets will gracefully show local / offline fallback state if `/api/*` is not being served locally.
- To point the frontend at a separately deployed API origin, set `VITE_RISKLENS_API_BASE`.
- To test the serverless API locally, use Vercel's local runtime and keep the same routes: `/api/paper-leaderboards`, `/api/profile-pointer`, `/api/tutorial-routes`, and `/api/wealth-calculations`.

Production build:

```bash
npm run build
```

Preview build:

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

## Optional configuration

The UI can run without contract addresses. To test Sepolia flows, copy `.env.example` to `.env.local` and configure the relevant values.

| Variable | Purpose |
| --- | --- |
| `VITE_BADGE_CONTRACT_ADDRESS` | Welcome / onboarding badge contract. |
| `VITE_REPLAY_BADGE_CONTRACT_ADDRESS` | Replay achievement contract. |
| `VITE_WEALTH_VAULT_ADDRESS` | Wealth receipt-vault or unified hub address for receipt reads, wealth task flags, and ERC-1155 collectible balance checks. |
| `VITE_PROFILE_STORAGE_ENDPOINT` | Optional wallet profile snapshot endpoint. |
| `VITE_RISKLENS_API_BASE` | Optional separate backend origin. Leave empty when frontend and `/api/*` share the same Vercel project. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Optional Vercel KV REST storage for serverless leaderboard and profile-pointer APIs. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Equivalent optional Upstash REST storage variables. |
| `RISKLENS_API_ALLOW_ORIGIN` | Optional CORS origin override for API routes. |
| `SEPOLIA_RPC_URL` | RPC URL for Hardhat deployment scripts. |
| `DEPLOYER_PRIVATE_KEY` | Local deployment key. Never commit this value. |

Optional deployment commands:

```bash
npm run deploy:unified-hub
npm run deploy:badge
npm run deploy:replay-badges
npm run deploy:wealth-vault
npm run update:wealth-vault
```

Optional profile storage gateway:

```bash
npm run profile-storage:dev
```

## Current limitations

- No real stablecoin, fund share, tokenized security, or live order is transferred.
- Product data, NAVs, yields, fees, and replay outputs are demo assumptions or local fallback data unless configured otherwise.
- Paper trading state is local-first and not a production ledger.
- Serverless API memory fallback is temporary process memory; configure KV / Upstash for shared persisted leaderboard rows.
- The API is a demo backend, not a production auth, anti-abuse, or regulated trading backend.
- Full badge, score, and receipt-vault flows require Sepolia configuration.
- The project is educational and should not be treated as investment advice.

## Why this project matters

Most beginner Web3 investing interfaces compress too many concepts into one moment: wallet connection, product risk, yield source, token rights, trade execution, and on-chain confirmation. RiskLens separates those moments. It teaches first, simulates second, and only then lets wallet-native actions appear. That structure is the core contribution of this demo.
