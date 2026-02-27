#!/usr/bin/env node
/**
 * Dispute Channel (Emergency - if casino disappears)
 * 
 * WARNING: Only use if:
 * - Casino API is down >24h
 * - Casino refuses to sign channel close
 * - You need emergency exit
 * 
 * This starts a 24h challenge period. During this time, either party
 * can submit a higher-nonce state. After 24h, highest nonce wins.
 * 
 * Usage:
 *   node scripts/dispute-channel.mjs <privateKey> <latest-state.json>
 * 
 * Example:
 *   # Save your latest signed state from A2A
 *   echo '{"agentBalance":"0.015","casinoBalance":"0.005",...}' > state.json
 *   node scripts/dispute-channel.mjs 0x1234... state.json
 */

import { ethers } from 'ethers';
import fs from 'fs';
import readline from 'readline';

const CHANNEL_MANAGER = '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e';
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const privateKey = process.argv[2];
const stateFile = process.argv[3];

if (!privateKey || !stateFile) {
  console.error('Usage: node scripts/dispute-channel.mjs <privateKey> <stateFile>');
  console.error('');
  console.error('⚠️  WARNING: Use only as last resort!');
  console.error('');
  console.error('Before using this, try:');
  console.error('  1. Contact casino support');
  console.error('  2. Wait 24h for API to come back');
  console.error('  3. Check BaseScan for casino transactions');
  process.exit(1);
}

// Load ABI
const abi = JSON.parse(fs.readFileSync('./ChannelManager.abi.json', 'utf8'));

async function main() {
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  const channelManager = new ethers.Contract(CHANNEL_MANAGER, abi, wallet);

  console.log('═══════════════════════════════════════════════');
  console.log('           DISPUTE CHANNEL (EMERGENCY)         ');
  console.log('═══════════════════════════════════════════════');
  console.log();
  console.log(`Agent: ${wallet.address}`);
  console.log();

  // Check channel exists and is open
  const channel = await channelManager.channels(wallet.address);

  if (channel.state === 0) {
    console.error('❌ No channel exists');
    process.exit(1);
  }

  if (channel.state !== 1) {
    console.error(`❌ Channel is not Open (state: ${channel.state})`);
    process.exit(1);
  }

  // Load latest signed state
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

  if (!state.agentBalance || !state.casinoBalance || !state.nonce || !state.signature) {
    console.error('❌ Invalid state file. Must contain:');
    console.error('  - agentBalance');
    console.error('  - casinoBalance');
    console.error('  - nonce');
    console.error('  - signature (casino EIP-712 signature)');
    process.exit(1);
  }

  const agentBalanceWei = ethers.parseEther(state.agentBalance);
  const casinoBalanceWei = ethers.parseEther(state.casinoBalance);
  const nonce = BigInt(state.nonce);

  // Show warnings
  console.log('⚠️  WARNING: DISPUTE IS IRREVERSIBLE');
  console.log();
  console.log('What happens:');
  console.log('  1. 24-hour challenge period starts');
  console.log('  2. Either party can submit higher-nonce state');
  console.log('  3. After 24h, highest nonce wins');
  console.log('  4. Channel settles based on that state');
  console.log();
  console.log('Before proceeding:');
  console.log('  ✅ This is your latest signed state (highest nonce)');
  console.log('  ✅ Casino API is truly down (checked recently)');
  console.log('  ✅ You have tried contacting support');
  console.log('  ✅ You understand this takes 24h to resolve');
  console.log();

  console.log('Current Channel:');
  console.log(`  Agent balance: ${ethers.formatEther(channel.agentBalance)} ETH`);
  console.log(`  Casino balance: ${ethers.formatEther(channel.casinoBalance)} ETH`);
  console.log(`  Nonce: ${channel.nonce.toString()}`);
  console.log();

  console.log('Your Dispute State:');
  console.log(`  Agent balance: ${state.agentBalance} ETH`);
  console.log(`  Casino balance: ${state.casinoBalance} ETH`);
  console.log(`  Nonce: ${nonce.toString()}`);
  console.log();

  if (nonce <= channel.nonce) {
    console.error('❌ ERROR: Your nonce is not higher than current!');
    console.error('   This dispute will fail.');
    console.error(`   Current: ${channel.nonce}, Yours: ${nonce}`);
    process.exit(1);
  }

  // Validate conservation
  const totalDeposit = channel.agentDeposit + channel.casinoDeposit;
  const totalFinal = agentBalanceWei + casinoBalanceWei;

  if (totalDeposit !== totalFinal) {
    console.error('❌ SECURITY ERROR: Conservation invariant violated!');
    console.error(`   Deposits: ${ethers.formatEther(totalDeposit)} ETH`);
    console.error(`   Final: ${ethers.formatEther(totalFinal)} ETH`);
    console.error();
    console.error('   Your state file is invalid. Do NOT proceed.');
    process.exit(1);
  }

  // Estimate gas
  const gasEstimate = await channelManager.startChallenge.estimateGas(
    agentBalanceWei,
    casinoBalanceWei,
    nonce,
    state.signature
  );

  const feeData = await provider.getFeeData();
  const gasCost = gasEstimate * (feeData.gasPrice || feeData.maxFeePerGas);

  console.log(`Estimated gas: ${gasEstimate.toString()}`);
  console.log(`Estimated cost: ${ethers.formatEther(gasCost)} ETH`);
  console.log();

  // Final confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('═══════════════════════════════════════════════');
  console.log();

  const confirm1 = await new Promise(resolve => {
    rl.question('Type "I UNDERSTAND THIS IS IRREVERSIBLE" to continue: ', resolve);
  });

  if (confirm1 !== 'I UNDERSTAND THIS IS IRREVERSIBLE') {
    console.log('Aborted.');
    rl.close();
    process.exit(0);
  }

  const confirm2 = await new Promise(resolve => {
    rl.question('Start dispute and lock channel for 24h? (yes/no): ', resolve);
  });

  rl.close();

  if (confirm2.toLowerCase() !== 'yes') {
    console.log('Aborted.');
    process.exit(0);
  }

  // Send transaction
  console.log();
  console.log('Starting dispute...');

  const tx = await channelManager.startChallenge(
    agentBalanceWei,
    casinoBalanceWei,
    nonce,
    state.signature
  );

  console.log(`Transaction: ${tx.hash}`);
  console.log(`BaseScan: https://basescan.org/tx/${tx.hash}`);
  console.log();

  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}`);
  console.log();

  // Verify dispute started
  const updatedChannel = await channelManager.channels(wallet.address);

  if (updatedChannel.state !== 2) {
    console.error('⚠️  Warning: Channel state is not Disputed');
    console.error(`   Current state: ${updatedChannel.state}`);
  } else {
    const deadline = new Date(Number(updatedChannel.disputeDeadline) * 1000);

    console.log('✅ Dispute started successfully!');
    console.log();
    console.log(`Deadline: ${deadline.toISOString()}`);
    console.log(`   (~24h from now)`);
    console.log();
    console.log('Next steps:');
    console.log('  1. Wait for 24h challenge period');
    console.log('  2. Monitor channel state: node scripts/verify-channel.mjs ' + wallet.address);
    console.log('  3. After deadline, resolve: node scripts/resolve-dispute.mjs ' + privateKey);
    console.log();
    console.log('If casino submits higher nonce during this time, your state will lose.');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
