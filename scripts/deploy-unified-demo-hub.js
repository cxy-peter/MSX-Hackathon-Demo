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
  }
  console.log(`Configured ${WEALTH_RECEIPT_LABELS.length} Wealth receipt labels.`);

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
