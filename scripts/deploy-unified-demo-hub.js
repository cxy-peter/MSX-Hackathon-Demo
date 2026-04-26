import hre from 'hardhat';

async function main() {
  const connection = await hre.network.connect('sepolia');
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();
  const baseUri = process.env.UNIFIED_DEMO_BASE_URI || 'ipfs://msx-unified-demo/{id}.json';

  if (!deployer) {
    throw new Error('No deployer signer available. Check DEPLOYER_PRIVATE_KEY in your environment.');
  }

  console.log(`Deploying MSXUnifiedDemoHub with wallet: ${deployer.address}`);

  const Hub = await ethers.getContractFactory('MSXUnifiedDemoHub');
  const hub = await Hub.deploy(baseUri);
  await hub.waitForDeployment();

  const address = await hub.getAddress();
  console.log(`MSXUnifiedDemoHub deployed to: ${address}`);
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
