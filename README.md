# MSX RiskLens Guided Investing Hub

A React + Vite hackathon prototype for Web2-to-Web3 onboarding, explainable product discovery, wallet-linked paper trading, and lightweight on-chain achievement / receipt-vault interactions.

This project is intentionally a product and education prototype, not a production exchange, broker, investment adviser, or live trading engine. The core question is: can a beginner understand a tokenized financial product, simulate the risk in a paper environment, and only then move toward more complex Web3 actions?

---

## Required before final submission

| Requirement | Status / value |
| --- | --- |
| Completed official submission form | TODO: complete in the official hackathon submission portal. |
| Name | TODO: replace with your name. |
| Email | TODO: replace with your email. |
| School or partner organization | TODO: replace with your school / partner organization. |
| Project title | **MSX RiskLens Guided Investing Hub** |
| Public GitHub repository | `https://github.com/cxy-peter/MSX-Hackathon-Demo` |
| Live demo | `https://msx-hackathon-demo-x3yc.vercel.app/paper-trading.html` |
| Short project summary | See [Project summary](#project-summary). |
| Web3 component and why it is essential | See [Web3 component](#web3-component). |
| README with setup instructions and project context | This file. |
| Clear setup and run instructions | See [Local setup](#local-setup) and [Run commands](#run-commands). |
| Enough context for asynchronous judging | See [Suggested judge review path](#suggested-judge-review-path), [Architecture](#architecture), and [Known limitations](#known-limitations). |

> Replace the TODO fields above before submitting the official form. They are left blank because the public repository does not contain reliable personal submission information.

---

## Project summary

**MSX RiskLens Guided Investing Hub** is a judge-facing demo that reframes a Web3 financial platform as a guided learning and simulation flow rather than an immediate trading venue.

The experience has three connected surfaces:

1. **Welcome / onboarding hub**: introduces wallet setup, risk review, product quiz tasks, and beginner-to-trader progression.
2. **Wealth product shelf**: helps users compare tokenized products by what they own, how return is generated, liquidity, rights, and main risk.
3. **Paper Trading Replay Lab**: lets users practice against historical replay bars with paper tokens before any live action. Users can step through history, simulate buy / sell / leverage / hedge decisions, review PnL, and see how the wallet-linked ledger changes.

The judge-facing value is that the demo makes tokenized products explainable and testable. A user does not jump straight from marketing copy to a live order. They first see the product structure, then review risks, then simulate decisions, and only then encounter on-chain badges or receipt-vault mechanics.

---

## Web3 component

The Web3 layer is not decorative. It is essential because the product is about **wallet-native financial education and verifiable progression**.

### What is on-chain or wallet-native

- **MetaMask wallet connection** ties onboarding, wealth actions, and replay progress to the same wallet identity.
- **Wallet signatures** create explicit intent boundaries for replay trades, leverage-risk acknowledgements, and profile pointer actions. Even when the trade is simulated, the user learns what a wallet-confirmed action feels like.
- **Sepolia onboarding badges** represent learning milestones such as welcome, wallet, risk review, quiz, and paper trading access.
- **Replay achievement badges** represent simulation tasks such as base check, leaderboard, spot loop, perp leverage, and protective hedge.
- **Receipt-vault / unified hub contracts** model a tokenized product surface where NAV, attestation freshness, eligibility, subscription state, and receipt-style balances can be anchored on-chain.

### Why Web3 is essential

Without Web3, the project would only be a Web2 educational dashboard. The wallet layer makes the flow portable, user-owned, and verifiable:

- A wallet address becomes the continuity layer across onboarding, wealth discovery, and paper trading.
- Badges turn educational progress into a wallet-native credential rather than a hidden app database row.
- Receipt-vault state demonstrates why tokenized products need transparent ownership, rights, and lifecycle mechanics.
- Signatures teach users the difference between reading information, approving intent, and performing a state-changing action.
- Sepolia testnet keeps the demo safe while preserving the mental model of real Web3 interactions.

---

## Live demo and main routes

Primary deployed route:

```text
https://msx-hackathon-demo-x3yc.vercel.app/paper-trading.html
```

Local routes after running the app:

```text
http://127.0.0.1:4173/
http://127.0.0.1:4173/wealth.html
http://127.0.0.1:4173/paper-trading.html
http://127.0.0.1:4173/chart-hover-demo.html
```

Route purpose:

| Route | Purpose |
| --- | --- |
| `/` / `index.html` | Welcome route, guided onboarding entry, badge tasks, product quiz, and progression into wealth or paper trading. |
| `/wealth.html` | Wealth shelf, product detail, suitability-oriented UI, tokenized product rights, lifecycle preview, and optional on-chain vault view. |
| `/paper-trading.html` | Replay-first paper trading lab with wallet-linked paper tokens, historical replay, PnL tracking, trade log, replay tasks, and achievement flow. |
| `/chart-hover-demo.html` | Standalone chart interaction demo. |

---

## Suggested judge review path

### Fast live-demo path

1. Open the deployed Paper Trading Replay Lab.
2. Review the hero section and demo-only banner.
3. Connect MetaMask if available. Sepolia is recommended for on-chain interactions.
4. Choose a product lane and product.
5. Step through or play replay bars.
6. Place a simulated trade and inspect:
   - paper-token balance,
   - open position,
   - gross / net PnL,
   - trade log,
   - human explanation,
   - protocol explanation.
7. Review replay quests and badge / score areas.
8. Open `wealth.html` and inspect product detail sections, especially ownership rights, liquidity, risk, AI diligence, and on-chain vault view.
9. Open the welcome page and inspect onboarding, risk review, and wallet badge progression.

### Local judging path

Use the setup commands below, then follow the same route order:

1. `/`
2. `/wealth.html`
3. `/paper-trading.html`
4. `/chart-hover-demo.html`

This is enough to evaluate the product asynchronously without requiring a live backend or real funds.

---

## Architecture

The repo is a multi-page Vite application with React entry points and optional Hardhat-based contracts.

```text
MSX-Hackathon-Demo/
├── contracts/
│   ├── MSXQuestBadge.sol
│   ├── MSXReplayAchievementBadge.sol
│   ├── MSXUnifiedDemoHub.sol
│   └── MSXWealthReceiptVault.sol
├── scripts/
│   ├── deploy-unified-demo-hub.js
│   ├── deploy-replay-achievement-badge.js
│   ├── deploy-welcome-badge.js
│   ├── deploy-wealth-vault.js
│   ├── update-wealth-vault-state.js
│   ├── downloadWealthRwaData.mjs
│   └── profile-storage-gateway.mjs
├── src/
│   ├── App.jsx
│   ├── WealthApp.jsx
│   ├── PaperTradingApp.jsx
│   ├── PaperTradingChart.jsx
│   ├── ReplayChartPanel.jsx
│   ├── paperTradingConfig.js
│   ├── paperTradingData.js
│   ├── walletProfileStore.js
│   ├── wagmiSetup.js
│   └── diligence/
├── index.html
├── wealth.html
├── paper-trading.html
├── chart-hover-demo.html
├── package.json
├── vite.config.js
└── .env.example
```

### Frontend

- **React + Vite** power the multi-page interface.
- **Wagmi, Viem, and ethers** handle wallet connection, reads, writes, signatures, and testnet contract calls.
- **React Query** supports state utilities around wallet / async flows.
- **Local storage** keeps the demo reviewable without a backend by persisting wallet-linked profile, paper state, and replay state.
- **Optional profile storage gateway** can write content-addressed wallet profile snapshots locally and optionally pin through Pinata / IPFS.

### Contracts

| Contract | Role |
| --- | --- |
| `MSXQuestBadge.sol` | ERC-721-style onboarding badge contract for welcome, wallet, risk, quiz, and paper milestones. |
| `MSXReplayAchievementBadge.sol` | ERC-1155 replay achievement contract with supported replay achievement IDs and score submission tracking. |
| `MSXWealthReceiptVault.sol` | ERC-20-style demo receipt vault for eligibility, risk tier, NAV, attestation, subscription, and redemption mechanics. |
| `MSXUnifiedDemoHub.sol` | Unified ERC-1155 demo contract that combines home badges, paper achievements, replay scores, wealth tasks, eligibility, NAV, attestation, and simple receipt-style subscription / redemption behavior. |

For hackathon review, `MSXUnifiedDemoHub.sol` is the simplest optional deployment path because one deployed address can be reused for the Vite variables:

```text
VITE_BADGE_CONTRACT_ADDRESS
VITE_REPLAY_BADGE_CONTRACT_ADDRESS
VITE_WEALTH_VAULT_ADDRESS
WEALTH_VAULT_ADDRESS
```

---

## Tech stack

- React
- Vite
- JavaScript / JSX
- CSS
- Wagmi
- Viem
- ethers
- React Query
- Hardhat
- Solidity
- OpenZeppelin contracts
- MetaMask
- Sepolia testnet for optional on-chain demo flows
- Vercel for static deployment

---

## Local setup

### Prerequisites

- Node.js 20+
- npm
- Chrome or another modern browser
- MetaMask for wallet flows
- Local port `4173` available

### Clone and install

```bash
git clone https://github.com/cxy-peter/MSX-Hackathon-Demo.git
cd MSX-Hackathon-Demo
npm install
```

### Environment variables

The base UI can run locally without deploying contracts. For optional testnet and data features, copy the example env file and edit values.

macOS / Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Key variables:

| Variable | Required for basic UI? | Purpose |
| --- | --- | --- |
| `VITE_BADGE_CONTRACT_ADDRESS` | No | Sepolia contract address for welcome / onboarding badges. |
| `VITE_REPLAY_BADGE_CONTRACT_ADDRESS` | No | Sepolia contract address for replay achievement badges and score submission. |
| `VITE_WEALTH_VAULT_ADDRESS` | No | Sepolia contract address for wealth receipt-vault state. |
| `VITE_TWELVE_DATA_API_KEY` | No | Optional external market / wealth data key. |
| `VITE_PROFILE_STORAGE_ENDPOINT` | No | Optional local or remote endpoint for wallet profile snapshots. |
| `VITE_REPLAY_DEVELOPER_MODE` | No | Enables replay developer-mode shortcuts when set to `true`. |
| `SEPOLIA_RPC_URL` | Only for deployment | RPC URL used by Hardhat deployment scripts. |
| `DEPLOYER_PRIVATE_KEY` | Only for deployment | Private key for deploying contracts. Never commit this value. |
| `UNIFIED_DEMO_BASE_URI` | Only for deployment | ERC-1155 metadata base URI for the unified demo hub. |
| `REPLAY_BADGE_BASE_URI` | Only for deployment | ERC-1155 metadata base URI for replay achievements. |
| `PROFILE_STORAGE_PORT` | No | Local profile gateway port, default `8787`. |
| `PROFILE_STORAGE_DIR` | No | Local directory for content-addressed profile snapshots. |
| `PINATA_JWT` | No | Optional IPFS pinning token for profile snapshots. |

---

## Run commands

### Standard development server

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

### Windows helper script

The repo includes a PowerShell helper that starts the app on port `4173` and opens the browser.

```powershell
.\start-local.ps1
```

If your npm executable is not located at `C:\Program Files\nodejs\npm.cmd`, use the standard `npm run dev` command instead.

### Production build

```bash
npm run build
```

### Preview the production build

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

---

## Optional Web3 / Sepolia setup

The app works as a static demo without on-chain configuration. Use this section only if you want the full Sepolia badge / score / vault path.

### 1. Prepare `.env.local`

```bash
cp .env.example .env.local
```

Edit:

```text
SEPOLIA_RPC_URL=...
DEPLOYER_PRIVATE_KEY=...
UNIFIED_DEMO_BASE_URI=ipfs://msx-unified-demo/{id}.json
```

Do not commit `.env.local` or any private key.

### 2. Deploy the unified demo hub

```bash
npm run deploy:unified-hub
```

The script prints a deployed address. Paste that address into:

```text
VITE_BADGE_CONTRACT_ADDRESS=0x...
VITE_REPLAY_BADGE_CONTRACT_ADDRESS=0x...
VITE_WEALTH_VAULT_ADDRESS=0x...
WEALTH_VAULT_ADDRESS=0x...
```

### 3. Restart the Vite dev server

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

### 4. Use MetaMask on Sepolia

- Connect MetaMask.
- Switch to Sepolia.
- Complete onboarding / replay conditions.
- Claim badges or submit replay scores where the UI exposes those actions.

### Optional separate deployments

The repo also includes individual scripts:

```bash
npm run deploy:badge
npm run deploy:replay-badges
npm run deploy:wealth-vault
npm run update:wealth-vault
```

Use these if you prefer separate contracts instead of the unified hub.

---

## Optional profile storage gateway

The app is local-first. If you want to test wallet profile snapshots outside browser localStorage, run:

```bash
npm run profile-storage:dev
```

Default endpoint:

```text
http://127.0.0.1:8787/profile
```

Then set:

```text
VITE_PROFILE_STORAGE_ENDPOINT=http://127.0.0.1:8787/profile
```

The gateway stores content-addressed profile records locally. If `PINATA_JWT` is set, it can also pin profile records to IPFS.

---

## Feature details

### 1. Welcome / onboarding hub

The welcome flow guides users through wallet setup, product understanding, risk framing, quiz tasks, and progression toward the paper trading lab. It is designed to make a beginner understand the difference between a product explanation, a wallet action, and a trading action.

### 2. Wealth product shelf

The wealth surface organizes tokenized products by practical user questions:

- What do I own?
- How do I earn?
- What are the liquidity rules?
- What is the main risk?
- What rights does the token or receipt represent?
- What does the lifecycle look like after subscription, settlement, roll, transfer, or pledge?

The wealth page includes AI-style diligence summaries, macro / asset overlays, receipt-token principles, lifecycle previews, and an optional on-chain vault view.

### 3. Paper Trading Replay Lab

The paper trading page is built as an explainable replay lab, not a fake live exchange.

Core interaction:

- Select a product or lane.
- Select a historical replay window.
- Step forward bar by bar or autoplay.
- Place simulated buy / sell / leverage / hedge actions.
- Sign wallet-linked replay confirmations where applicable.
- Review updated positions, average cost, realized PnL, unrealized PnL, net PnL, trade costs, carry drag, management fee assumptions, and trade log.
- Complete replay achievement tasks.
- Optionally submit scores or claim badges if testnet contracts are configured.

The goal is to teach the user what could have happened after a decision before they reach live trading.

### 4. RiskLens explanation model

The UI intentionally pairs numerical outputs with explanation blocks:

- human explanation,
- protocol explanation,
- ownership / rights framing,
- fee and cost disclosures,
- worst-case / liquidity notes,
- product fit signals,
- risk tier labels.

This makes the demo useful for product comprehension, not only order entry.

---

## Data and state model

The demo is static-first and local-first so judges can review it asynchronously.

- Product metadata and demo assumptions live in source files.
- Replay bars can use local fallback data or configured data adapters.
- Paper trades and wallet profile state are stored locally by wallet.
- Optional profile gateway can persist content-addressed snapshots.
- Optional Sepolia contracts anchor badges, scores, eligibility, NAV, and receipt-vault state.

This keeps the MVP reproducible without depending on a production account service.

---

## What judges should evaluate

1. **Product clarity**: Does the app explain ownership, yield source, risk, liquidity, and rights before encouraging action?
2. **Beginner progression**: Does the user move from onboarding to product discovery to simulation in a sensible order?
3. **Web3 relevance**: Does wallet identity, signature flow, badge state, and receipt-vault state matter to the product experience?
4. **Simulation quality**: Does the paper trading lab teach users how decisions affect positions, PnL, and risk exposure?
5. **Asynchronous reproducibility**: Can the project be run and evaluated locally without hidden services or real funds?
6. **Safety framing**: Does the demo clearly separate paper simulation and testnet interactions from live financial activity?

---

## Known limitations

- This is not a production exchange, broker, investment adviser, or custody system.
- Displayed products, market data, NAVs, PnL, fees, and scenario outputs are demo assumptions.
- The paper trading ledger is primarily local-first and not a production account ledger.
- Basic review does not require on-chain deployment; full badge / vault interactions require Sepolia configuration.
- Some anti-farming or score-attestation logic is intentionally simple for hackathon scope.
- No real stablecoin, tokenized security, or live fund transfer occurs in the demo.
- Nothing in the UI should be treated as investment advice.

---

## Troubleshooting

### The app does not open on port 4173

Use another port:

```bash
npm run dev -- --host 127.0.0.1 --port 4174
```

### MetaMask does not show on-chain actions

Check that:

- MetaMask is installed.
- The wallet is connected.
- The wallet is switched to Sepolia.
- `VITE_BADGE_CONTRACT_ADDRESS`, `VITE_REPLAY_BADGE_CONTRACT_ADDRESS`, and `VITE_WEALTH_VAULT_ADDRESS` are valid contract addresses.
- The Vite server was restarted after editing `.env.local`.

### Contract deployment fails

Check that:

- `SEPOLIA_RPC_URL` is set.
- `DEPLOYER_PRIVATE_KEY` is set locally and not committed.
- The deployer wallet has enough Sepolia ETH for gas.
- Dependencies were installed with `npm install`.

### The Windows helper script fails

The script assumes npm is at:

```text
C:\Program Files\nodejs\npm.cmd
```

If that is not true on your machine, run:

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

---

## Submission note

This README is designed to support asynchronous hackathon judging. Before final submission, complete the official submission form and replace the TODO fields in the [Required before final submission](#required-before-final-submission) table with the correct personal and organization details.
