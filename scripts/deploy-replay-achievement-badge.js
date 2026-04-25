import hre from 'hardhat';

async function main() {
  const connection = await hre.network.connect('sepolia');
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();
  const baseUri = process.env.REPLAY_BADGE_BASE_URI || 'ipfs://msx-replay-badges/{id}.json';

  if (!deployer) {
    throw new Error('No deployer signer available. Check DEPLOYER_PRIVATE_KEY in your environment.');
  }

  console.log(`Deploying replay achievement badge with ${deployer.address}...`);

  const factory = await ethers.getContractFactory('MSXReplayAchievementBadge');
  const contract = await factory.deploy(baseUri);
  await contract.waitForDeployment();

  console.log(`MSXReplayAchievementBadge deployed to ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
