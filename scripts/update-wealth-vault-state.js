import crypto from 'node:crypto';
import hre from 'hardhat';

function parseBoolean(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  throw new Error(`Cannot parse boolean value "${value}".`);
}

function buildAttestationRoot(seed) {
  return `0x${crypto.createHash('sha256').update(seed).digest('hex')}`;
}

async function main() {
  const connection = await hre.network.connect('sepolia');
  const { ethers } = connection;
  const [operator] = await ethers.getSigners();

  if (!operator) {
    throw new Error('No signer available. Check DEPLOYER_PRIVATE_KEY in your environment.');
  }

  const vaultAddress = process.env.WEALTH_VAULT_ADDRESS;
  if (!vaultAddress) {
    throw new Error('Set WEALTH_VAULT_ADDRESS before running the keeper update script.');
  }

  const vault = await ethers.getContractAt('MSXWealthReceiptVault', vaultAddress);

  console.log(`Updating MSXWealthReceiptVault ${vaultAddress} with wallet ${operator.address}`);

  const queued = [];
  const navBps = process.env.WEALTH_VAULT_NAV_BPS;
  const strategyStatus = process.env.WEALTH_VAULT_STATUS;
  const attestationRoot =
    process.env.WEALTH_VAULT_ATTESTATION_ROOT ||
    (process.env.WEALTH_VAULT_ATTESTATION_SEED ? buildAttestationRoot(process.env.WEALTH_VAULT_ATTESTATION_SEED) : '');
  const pauseState = parseBoolean(process.env.WEALTH_VAULT_PAUSED);
  const investor = process.env.WEALTH_VAULT_INVESTOR;
  const investorEligible = parseBoolean(process.env.WEALTH_VAULT_ELIGIBLE);
  const investorTier = process.env.WEALTH_VAULT_RISK_TIER;
  const minSubscription = process.env.WEALTH_VAULT_MIN_SUBSCRIPTION;
  const underlyingHash = process.env.WEALTH_VAULT_UNDERLYING_HASH;
  const underlyingPassed = parseBoolean(process.env.WEALTH_VAULT_UNDERLYING_PASSED);
  const underlyingNote = process.env.WEALTH_VAULT_UNDERLYING_NOTE || 'Keeper review update';

  if (navBps) {
    queued.push({
      label: `setNavBps(${navBps})`,
      run: () => vault.setNavBps(navBps)
    });
  }

  if (strategyStatus) {
    queued.push({
      label: `setStrategyStatus(${strategyStatus})`,
      run: () => vault.setStrategyStatus(strategyStatus)
    });
  }

  if (attestationRoot) {
    queued.push({
      label: `updateAttestation(${attestationRoot})`,
      run: () => vault.updateAttestation(attestationRoot)
    });
  }

  if (pauseState != null) {
    queued.push({
      label: `setSubscriptionsPaused(${pauseState})`,
      run: () => vault.setSubscriptionsPaused(pauseState)
    });
  }

  if (minSubscription) {
    queued.push({
      label: `setMinSubscription(${minSubscription})`,
      run: () => vault.setMinSubscription(minSubscription)
    });
  }

  if (investor && investorEligible != null && investorTier != null) {
    queued.push({
      label: `setInvestorEligibility(${investor}, ${investorEligible}, ${investorTier})`,
      run: () => vault.setInvestorEligibility(investor, investorEligible, investorTier)
    });
  }

  if (underlyingHash && underlyingPassed != null) {
    queued.push({
      label: `recordUnderlyingReview(${underlyingHash}, ${underlyingPassed})`,
      run: () => vault.recordUnderlyingReview(underlyingHash, underlyingPassed, underlyingNote)
    });
  }

  if (!queued.length) {
    throw new Error(
      'Nothing to update. Set one or more of WEALTH_VAULT_NAV_BPS, WEALTH_VAULT_STATUS, WEALTH_VAULT_ATTESTATION_ROOT, WEALTH_VAULT_ATTESTATION_SEED, WEALTH_VAULT_PAUSED, WEALTH_VAULT_MIN_SUBSCRIPTION, WEALTH_VAULT_INVESTOR + WEALTH_VAULT_ELIGIBLE + WEALTH_VAULT_RISK_TIER, or WEALTH_VAULT_UNDERLYING_HASH + WEALTH_VAULT_UNDERLYING_PASSED.'
    );
  }

  for (const item of queued) {
    console.log(`Submitting ${item.label}...`);
    const tx = await item.run();
    await tx.wait();
    console.log(`Confirmed ${item.label}: ${tx.hash}`);
  }

  console.log('Vault state update complete.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
