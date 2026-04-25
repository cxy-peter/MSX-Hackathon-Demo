# MSX Guided Investing Hub

A static hackathon demo that reframes MSX as more than a trading venue.

## Core idea

MSX already presents tokenized stock trading, perpetuals, and a small wealth-products shelf. This demo adds the missing middle layer:

- Web2/Web3 split onboarding
- learn-and-earn quest ladder
- paper investing before real trading
- explainable wealth-style product cards
- admin-side RWA intake scoring

## Why this concept

The existing public MSX and MSX Finance pages emphasize trading access and list a small number of wealth products, but they do not yet present a strong beginner flow, suitability routing, or paper-trading layer.

## Included pages

- Hero / thesis
- Entry routing
- Learn & Earn quests
- Discover products
- Paper investing lab
- Explainable analyzer
- Exchange watchlist
- New listing intake simulator

## Run locally

Use the React/Vite app instead of opening `index.html` directly:

```powershell
cd "D:\NYU\web3\msx-risklens-demo"
.\start-local.ps1
```

Or manually:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev -- --host 127.0.0.1 --port 4173
```

## Sepolia welcome badge

The welcome page now includes a real testnet mint path for a `Welcome badge`.

You do not need a contract address in advance. The intended flow is:

- deploy the badge contract once on Sepolia
- copy the deployed contract address into `.env.local`
- restart the local frontend
- connect MetaMask and mint the badge from the welcome page

### 1. Frontend env

Create `.env.local`:

```bash
VITE_BADGE_CONTRACT_ADDRESS=0xYourSepoliaBadgeContract
VITE_BADGE_METADATA_URI=ipfs://your-badge-metadata
```

### 2. Deploy env

Create `.env`:

```bash
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
DEPLOYER_PRIVATE_KEY=0xYourTestWalletPrivateKey
```

Use a dedicated test wallet only. Do not put a main wallet private key here.

### 3. Deploy the contract

Windows shortcut:

```powershell
cd "D:\NYU\web3\msx-risklens-demo"
.\deploy-badge.ps1
```

If deployment succeeds, the terminal will print:

- deployer wallet address
- `MSXWelcomeBadge deployed to: 0x...`

Copy that `0x...` address into `VITE_BADGE_CONTRACT_ADDRESS`, then restart the frontend.

Mint flow expectations:

- User connects MetaMask
- User switches to `Sepolia`
- User clicks `Mint welcome badge on Sepolia`
- MetaMask prompts for transaction approval
- After confirmation, the mint quest becomes completed

Sepolia test ETH faucets:

- [Alchemy Sepolia Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)
- [Chainlink Faucets](https://faucets.chain.link/)

## Deploy to GitHub Pages

Run:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run build
```

Then deploy the generated `dist/` folder to GitHub Pages.

## Notes

This demo now uses a React/Vite frontend with MetaMask connection and Sepolia-ready badge mint UI. For production use, replace the placeholder badge contract configuration with a deployed ERC-721 or ERC-1155 contract.
