import hre from 'hardhat';

const WEALTH_RECEIPT_LABELS = [
  'Superstate USTB',
  'Ondo USDY',
  'Franklin FOBXX / BENJI',
  'Ondo OUSG',
  'Hashnote USYC',
  'OpenEden TBILL',
  'BlackRock BUIDL',
  'Superstate USCC',
  'Hamilton Lane SCOPE',
  'Apollo ACRED',
  'RiskLens Quant Fund #1',
  'RiskLens Quant Fund #2',
  'xStocks Public Holdings',
  'Private Watchlist / SPV Access',
  'SpaceX Secondary Window',
  'Stripe Pre-IPO Window',
  'ByteDance Private Growth',
  'Databricks Secondary Window',
  'OpenAI Private Growth',
  'RiskLens ETH Protected Growth',
  'RiskLens BTC Premium Income',
  'RiskLens BTC/USDC Dual Investment',
  'RiskLens ETH/USDC Dual Investment',
  'RiskLens SOL/USDT Dual Investment',
  'RiskLens Index Auto-Call Yield'
];

const WEALTH_RECEIPT_DETAILS = [
  'Market-day liquidity; T+1-style fund settlement window',
  'Market-day liquidity; tokenized cash equivalent route',
  'Market fund wrapper; broker or transfer-agent style settlement',
  'Tokenized Treasury fund; subscription and redemption windows apply',
  '24/7 USDC route for onboarded users',
  'Treasury bill receipt; settlement depends on issuer window',
  'Qualified-investor fund share; gated subscription route',
  'Yield and carry receipt; settlement depends on fund terms',
  'Private credit interval fund; queue and eligibility controls apply',
  'Private credit receipt; term and redemption constraints apply',
  'Quant sleeve receipt; manager execution and pause controls apply',
  'Quant sleeve receipt; term and rebalance constraints apply',
  'Public wrapper basket; market-day settlement',
  'Private SPV access receipt; eligibility and transfer restrictions apply',
  'Secondary window receipt; transfer restrictions and pricing windows apply',
  'Pre-IPO secondary window; transfer restrictions apply',
  'Private growth receipt; NAV and transfer windows apply',
  'Secondary window receipt; eligibility and transfer restrictions apply',
  'Private growth receipt; NAV and transfer windows apply',
  'Defined-outcome ETH receipt; observation and maturity rules apply',
  'Monthly premium-income BTC receipt; option cycle settlement applies',
  'BTC/USDC dual investment; target-price settlement applies',
  'ETH/USDC dual investment; target-price settlement applies',
  'SOL/USDT dual investment; target-price settlement applies',
  'Auto-call receipt; observation dates and coupon barriers apply'
];

async function main() {
  const connection = await hre.network.connect('sepolia');
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();
  const baseUri = process.env.UNIFIED_DEMO_BASE_URI || '';

  if (!deployer) {
    throw new Error('No deployer signer available. Check DEPLOYER_PRIVATE_KEY in your environment.');
  }

  console.log(`Deploying MSXUnifiedDemoHub with wallet: ${deployer.address}`);

  const Hub = await ethers.getContractFactory('MSXUnifiedDemoHub');
  const hub = await Hub.deploy(baseUri);
  await hub.waitForDeployment();

  const address = await hub.getAddress();
  console.log(`MSXUnifiedDemoHub deployed to: ${address}`);

  for (let index = 0; index < WEALTH_RECEIPT_LABELS.length; index += 1) {
    const productId = index + 1;
    const tx = await hub.setProductReceiptLabel(productId, WEALTH_RECEIPT_LABELS[index]);
    await tx.wait();
    const detailTx = await hub.setProductReceiptDetail(productId, WEALTH_RECEIPT_DETAILS[index] || 'RiskLens Wealth receipt detail');
    await detailTx.wait();
  }
  console.log(`Configured ${WEALTH_RECEIPT_LABELS.length} Wealth receipt labels and details.`);

  console.log('');
  console.log('Use the same address for the public Vite env vars:');
  console.log(`VITE_BADGE_CONTRACT_ADDRESS=${address}`);
  console.log(`VITE_REPLAY_BADGE_CONTRACT_ADDRESS=${address}`);
  console.log(`VITE_WEALTH_VAULT_ADDRESS=${address}`);
  console.log(`WEALTH_VAULT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
