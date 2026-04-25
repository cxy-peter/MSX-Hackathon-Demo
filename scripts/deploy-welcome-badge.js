import hre from 'hardhat';

async function main() {
  const connection = await hre.network.connect('sepolia');
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    throw new Error('No deployer signer available. Check DEPLOYER_PRIVATE_KEY in your environment.');
  }

  console.log(`Deploying with wallet: ${deployer.address}`);

  const Badge = await ethers.getContractFactory('MSXQuestBadge');
  const badge = await Badge.deploy();
  await badge.waitForDeployment();

  const address = await badge.getAddress();
  console.log(`MSXQuestBadge deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
