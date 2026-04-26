# MSX RiskLens Guided Investing Hub

## 1) Project purpose

This is a React + Vite hackathon demo focused on **Web2-to-Web3 onboarding, explainable product discovery, paper trading education, and lightweight on-chain badge interaction**.

The project is intentionally a product prototype, not a full exchange engine. Its core objective is to test whether users can:

1. Understand the product first
2. Simulate risk in a paper environment
3. Move to higher complexity only after clarity is built

The judge-facing value is:

- A clear beginner flow, instead of an immediate jump to live trading.
- Product information that is comparable and explainable, not only numerical.
- A locally runnable demo with reproducible user-path behavior.

## 2) Architecture and entry points

All pages are built as part of a multi-page Vite app.

- `index.html` + `src/main.jsx` + `src/App.jsx`
  - Welcome route and guided onboarding entry
- `wealth.html` + `src/wealth.jsx` + `src/WealthApp.jsx`
  - Wealth shelf, product detail, timeline actions, and suitability-focused UI
- `paper-trading.html` + `src/paperTrading.jsx` + `src/PaperTradingApp.jsx`
  - Paper trading simulation, replay workflow, position and PnL updates
- `chart-hover-demo.html` + `src/chartHoverDemo.jsx`
  - Standalone chart interaction demo
- `app.js`
  - Legacy static app data source kept for reference, not the main runtime entry
- `dist/`
  - Build output folder for local preview or static hosting

`vite.config.js` is configured with the following multi-page inputs:

- `index.html`
- `wealth.html`
- `paper-trading.html`
- `chart-hover-demo.html`

## 3) Tech stack

- React + Vite
- Wagmi + Viem + ethers for wallet/chain interactions
- Hardhat for optional contract deployment scripts
- React Query for state utilities
- Node.js scripts for local data updates and lightweight profile storage

## 4) Prerequisites

- Node.js 20+
- npm (on Windows: `C:\Program Files\nodejs\npm.cmd`)
- Chrome + MetaMask for wallet interaction
- Local port 4173 available

## 5) Run locally

```powershell
cd "D:\NYU\web3\msx-risklens-demo"
npm install
.\start-local.ps1
```

Then open:

- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4173/wealth.html`
- `http://127.0.0.1:4173/paper-trading.html`
- `http://127.0.0.1:4173/chart-hover-demo.html`

Note: use the local server URL, not `file://`.

## 6) Configuration (out of the box)

This repo is designed to start without manual environment customization for local review.

- `.env.example` and `.env.local` already define starter values.
- Local run does not require additional contract addresses to be set.
- If you want on-chain main functionality for Sepolia, you can update env values later based on your testing needs.

## 7) What this repo shows (judge-friendly summary)

- A guided onboarding path from beginner mode to trader mode.
- A structured wealth flow with explicit product fit and disclosure signals.
- A paper trading flow with replay and exposure-aware actions.
- Minimal, realistic demo data path suitable for grading and iteration.

## 8) Notes

This project is designed as a demo and learning flow prototype.  
Displayed metrics, scenario outputs, and tokenized product assumptions are for demonstration and education purposes and should not be treated as investment advice.
