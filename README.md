# RiskLens Guided Investing Hub

RiskLens Guided Investing Hub is a React + Vite hackathon prototype for wallet-native financial education, explainable wealth products, paper-token replay trading, and optional Sepolia achievement / receipt-vault flows.

The demo is not a production exchange, broker, investment adviser, or live trading system. It is designed to answer one product question: can a beginner understand a tokenized financial product, practice the decision with paper tokens, and only then move toward wallet-confirmed Web3 actions?

## Project summary

RiskLens turns a Web3 investing flow into a guided learning path instead of dropping the user directly into a trading terminal.

The app has three main surfaces:

| Surface | What it demonstrates |
| --- | --- |
| Welcome hub | Wallet connection, nickname, wallet backup / recovery, risk review, product quiz, and task badge progression. |
| Wealth | Product shelf, product detail, AI diligence, receipt lifecycle, pledge / settle flows, and a PT-only dual-investment simulator. |
| Paper Trading | Historical replay desk, paper-token positions, trade log, floating leaderboard, wallet-linked tasks, and replay achievement status. |

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
4. Open `/wealth.html`, select recommended products, and inspect the product detail tabs: Overview, Timeline, AI Diligence, and Onchain.
5. Try the dual-investment card. It uses PT only, not real stablecoins, and models subscription amount, target price, direction, term, and reward preview.
6. Open `/paper-trading.html`, choose a product route, step through replay bars, place simulated trades, and inspect the floating open-position / trade-log windows.
7. Review how leaderboard rows, wallet state, and replay achievement tasks react to the connected account.

## Web3 component

The Web3 layer is essential because the project is about wallet-native learning and verifiable progression, not just an educational dashboard.

| Component | Why it matters |
| --- | --- |
| MetaMask connection | Uses the wallet as the continuity layer across home, wealth, and paper trading. |
| Wallet nickname and backup | Keeps demo identity, preferences, and progress tied to a wallet profile rather than a generic browser session. |
| Signatures | Teach the difference between reading data, approving intent, and changing state. |
| Sepolia task badges | Let learning milestones become wallet-visible achievements when contracts are configured. |
| Replay achievement badges | Represent simulation tasks such as base replay, leaderboard, spot loop, leverage, and hedge milestones. |
| Receipt-vault model | Demonstrates why tokenized products need lifecycle state: eligibility, NAV, attestation freshness, subscription, settlement, and redemption. |

The UI still works without deployed contracts. In that mode, the app uses local wallet-linked state so judges can evaluate the product safely without real funds.

## Core features

### Wallet-first onboarding

The wallet modal is shared conceptually across home, wealth, and paper trading. It supports MetaMask connection, wallet nickname, disconnect confirmation, profile backup, recovery from historical local wallet snapshots, and per-wallet progress. The nickname is saved with the wallet profile so leaderboard and task surfaces can show a human label when available.

### Wealth product shelf

Wealth focuses on beginner-readable product understanding rather than dense exchange controls. Product cards and recommended blocks deep-link into the correct detail view. The detail surface organizes product information into Buy / settle / pledge, Overview, Timeline, AI Diligence, and Onchain views.

The dual-investment section is modeled as a PT-only learning product. Users can choose trading pair, direction, settlement bucket, target price range, and subscription amount. The output is a reward preview and scenario explanation, not a real stablecoin settlement flow.

### Paper Trading Replay Lab

Paper trading is a replay lab. Users choose products and routes, step through historical bars, simulate entries and exits, and track local positions. Open positions and trade logs are kept as right-side floating windows so the replay desk stays focused.

The replay engine tracks paper balance, position size, average cost, gross PnL, net PnL, fees, carry effects, route state, and task completion. It is designed to make the consequence of a decision visible before a user touches live trading.

### AI diligence workspace

AI Diligence is implemented as a local evidence-backed workspace instead of a generic score widget. It separates product quality, evidence confidence, market regime, suitability, red flags, memo-style explanation, and follow-up questions. This keeps the review auditable even without a backend model call.

### Wallet-linked task system

Task cards now distinguish three states:

| State | Meaning |
| --- | --- |
| To do / pending | The current wallet has not met the condition. |
| Wait to be minted | The wallet has completed the local condition, but the on-chain or collectible state has not been minted for that wallet. |
| Completed | The connected wallet has the completed / minted task state. |

This matters because a different wallet should not inherit another account's badges or leaderboard identity.

## Algorithm and engineering highlights

### Replay state and PnL accounting

The replay desk keeps multiple moving inputs aligned: selected product, route, replay cursor, ticket size, wallet-linked paper balance, open positions, trade log, fees, carry drag, and settlement state. A major challenge is avoiding stale previews when the user changes notional, product, route, or strategy controls. The current implementation treats those controls as replay-state inputs instead of cosmetic labels.

### Task gating across local and on-chain state

Task status cannot be a simple boolean. The app reconciles local progress, current wallet address, optional Sepolia reads, and contract availability. This is why a finished local action can show `Wait to be minted`, while a truly minted badge shows as completed only for the connected wallet.

### Dual-investment simulation without real stablecoins

The dual-investment flow intentionally avoids real USDC, USDT, ETH, or BTC transfer. Instead, it uses PT as the demo budget and models direction, target price, settlement window, subscription amount, APR-like reward display, and above / below outcome preview. This preserves the learning value without creating a fake live financial promise.

### Diligence as evidence, not magic scoring

The diligence layer is deterministic and local. Rather than pretending an opaque AI model has perfect judgment, it builds structured review sections from product metadata and risk signals. That makes the UI easier to audit during judging and safer for a financial education prototype.

### UI state consistency

The same wallet identity now has to appear consistently in home, wealth, paper trading, task cards, backup / recovery, leaderboard rows, and nickname controls. The difficult part was not adding a button, but making sure every surface respects the current wallet and does not accidentally show another account's completed state.

## Difficult problems solved during development

Several hard issues were resolved directly through Codex-assisted implementation inside this repo:

| Problem | Resolution |
| --- | --- |
| Vercel build failures from malformed JSX / localization strings | Cleaned corrupted fallback strings and broken template literals in `WealthApp.jsx`, then restored build-safe JSX structure. |
| Wallet state felt shared across accounts | Added wallet-linked nickname/profile behavior, backup history, recovery selection, and disconnect confirmation patterns. |
| Tasks looked completed even when only local progress existed | Reworked task status logic so local completion becomes `Wait to be minted` until the connected wallet has the minted/claimed state. |
| Paper Trading became visually crowded | Restored AI diligence cards, moved open positions and trade log into right floating windows, reduced bottom whitespace, and moved route controls to the replay desk corner. |
| Wealth product cards had too much protocol wording | Removed low-value mint/burn copy from product cards and moved lifecycle detail into the product detail flow. |
| Dual investment looked like a generic APY card | Rebuilt it around pair, direction, target price, settlement bucket, subscription amount, and PT reward preview. |
| Leaderboard and wallet identity were too address-heavy | Leaderboard display now prefers wallet nickname when one is saved, and falls back to a short address otherwise. |
| Task cards did not visually communicate status | Added right-corner status pills, yellow pulse / ripple for unfinished or wait-to-mint states, and green borders for completed tasks. |

## Architecture

```text
MSX-Hackathon-Demo/
  contracts/
    MSXQuestBadge.sol
    MSXReplayAchievementBadge.sol
    MSXUnifiedDemoHub.sol
    MSXWealthReceiptVault.sol
  scripts/
    deploy-unified-demo-hub.js
    deploy-replay-achievement-badge.js
    deploy-welcome-badge.js
    deploy-wealth-vault.js
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
| Wallet / Web3 | MetaMask, Wagmi, Viem, ethers |
| Contracts | Solidity, Hardhat, OpenZeppelin |
| State | Local storage, wallet profile store, optional profile storage gateway |
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
| `VITE_WEALTH_VAULT_ADDRESS` | Wealth receipt-vault or unified hub address. |
| `VITE_PROFILE_STORAGE_ENDPOINT` | Optional wallet profile snapshot endpoint. |
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
- Full badge, score, and receipt-vault flows require Sepolia configuration.
- The project is educational and should not be treated as investment advice.

## Why this project matters

Most beginner Web3 investing interfaces compress too many concepts into one moment: wallet connection, product risk, yield source, token rights, trade execution, and on-chain confirmation. RiskLens separates those moments. It teaches first, simulates second, and only then lets wallet-native actions appear. That structure is the core contribution of this demo.
