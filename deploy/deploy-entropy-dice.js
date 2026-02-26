/**
 * Deploy EntropyDice (Pyth Entropy adapter)
 *
 * Usage:
 *   npx hardhat run deploy/deploy-entropy-dice.js --network baseSepolia
 *
 * Required env:
 *   ENTROPY_ADDRESS=<pyth entropy contract>
 *   ENTROPY_PROVIDER=<pyth entropy provider address>
 *
 * Optional env:
 *   ENTROPY_ADMIN=<admin/casino owner address, defaults to deployer>
 */

const hre = require('hardhat');
const { ethers } = hre;

async function main() {
  const rpcUrl = hre.network.config.url;
  if (!rpcUrl) throw new Error('Missing network RPC URL in hardhat config');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Use KMS signer if USE_KMS=true, otherwise use private key
  const useKms = String(process.env.USE_KMS || '').toLowerCase() === 'true';
  let deployer;
  
  if (useKms) {
    const { KmsSigner } = require('../server/kms-signer');
    deployer = new KmsSigner(provider);
    console.log('Using KMS signer for deployment');
  } else {
    const deployerPk = process.env.DEPLOYER_PRIVATE_KEY;
    if (!deployerPk) throw new Error('Missing DEPLOYER_PRIVATE_KEY (or set USE_KMS=true)');
    deployer = new ethers.Wallet(deployerPk, provider);
  }
  
  const deployerAddress = await deployer.getAddress();

  const entropyAddress = process.env.ENTROPY_ADDRESS;
  const entropyProvider = process.env.ENTROPY_PROVIDER;
  const admin = process.env.ENTROPY_ADMIN || deployerAddress;
  const callbackGasLimit = process.env.ENTROPY_CALLBACK_GAS_LIMIT
    ? Number(process.env.ENTROPY_CALLBACK_GAS_LIMIT)
    : null;

  if (!entropyAddress) throw new Error('Missing ENTROPY_ADDRESS');
  if (!entropyProvider) throw new Error('Missing ENTROPY_PROVIDER');

  console.log('Network:', hre.network.name);
  console.log('Deployer:', deployerAddress);
  console.log('Admin:', admin);
  console.log('Entropy:', entropyAddress);
  console.log('Entropy provider:', entropyProvider);

  const EntropyDice = await ethers.getContractFactory('EntropyDice', deployer);
  const contract = await EntropyDice.deploy(admin, entropyAddress, entropyProvider);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('EntropyDice deployed:', address);

  if (callbackGasLimit) {
    if (admin.toLowerCase() === deployerAddress.toLowerCase()) {
      const tx = await contract.setCallbackGasLimit(callbackGasLimit);
      await tx.wait();
      console.log('Callback gas limit set to:', callbackGasLimit);
    } else {
      console.log(`Set callback gas limit from admin wallet: setCallbackGasLimit(${callbackGasLimit})`);
    }
  }

  console.log('\nSet env:');
  console.log(`ENTROPY_DICE=${address}`);
  console.log('RNG_PROVIDER=pyth_entropy');

  if (process.env.BASESCAN_API_KEY) {
    console.log('\nWaiting before verify...');
    await new Promise((r) => setTimeout(r, 15000));
    try {
      await hre.run('verify:verify', {
        address,
        constructorArguments: [admin, entropyAddress, entropyProvider],
      });
      console.log('Verified on BaseScan');
    } catch (e) {
      console.log('Verification skipped/failed:', e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
