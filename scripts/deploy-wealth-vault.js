import hre from 'hardhat';

async function main() {
  const connection = await hre.network.connect('sepolia');
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    throw new Error('No deployer signer available. Check DEPLOYER_PRIVATE_KEY in your environment.');
  }

  const vaultName = process.env.WEALTH_VAULT_NAME || 'MSX Wealth Receipt Vault';
  const vaultSymbol = process.env.WEALTH_VAULT_SYMBOL || 'MSXRV';
  const vaultLabel = process.env.WEALTH_VAULT_LABEL || 'MSX Stable Income Demo Vault';
  const assetSymbol = process.env.WEALTH_VAULT_ASSET_SYMBOL || 'USDC';

  console.log(`Deploying MSXWealthReceiptVault with wallet: ${deployer.address}`);

  const Vault = await ethers.getContractFactory('MSXWealthReceiptVault');
  const vault = await Vault.deploy(vaultName, vaultSymbol, vaultLabel, assetSymbol);
  await vault.waitForDeployment();

  console.log(`MSXWealthReceiptVault deployed to: ${await vault.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
