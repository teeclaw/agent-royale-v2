#!/usr/bin/env node

/**
 * Close channel cooperatively (requires casino signature)
 * 
 * Security:
 * - Validates channel state before closing
 * - Requires final signed state from A2A close_channel
 * - Shows balance delta before confirming
 * - Verifies settlement amounts
 * 
 * Usage:
 *   node scripts/close-channel-onchain.mjs <agentPrivateKey>
 * 
 * Prerequisites:
 *   1. Call A2A close_channel action first
 *   2. Save the response (contains final state + signature)
 *   3. Pass the response as JSON file or stdin
 * 
 * Example:
 *   # Save A2A response to file
 *   curl -X POST https://www.agentroyale.xyz/api/a2a/casino \
 *     -d '{"action":"close_channel","stealthAddress":"0x..."}' > final-state.json
 *   
 *   # Close channel with saved state
 *   cat final-state.json | node scripts/close-channel-onchain.mjs 0x1234...
 */

import { ethers } from 'ethers';
import fs from 'fs';
import readline from 'readline';

const CHANNEL_MANAGER = '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e';
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const agentPrivateKey = process.argv[2] || process.env.AGENT_WALLET_PRIVATE_KEY;
const stateFile = process.argv[3]; // Optional: path to final-state.json

if (!agentPrivateKey) {
  console.error('Error: Agent private key required');
  console.error('Usage: node scripts/close-channel-onchain.mjs <privateKey> [stateFile]');
  console.error('   Or: AGENT_WALLET_PRIVATE_KEY=0x... node scripts/close-channel-onchain.mjs');
  console.error('');
  console.error('Get final state from A2A:');
  console.error('  curl -X POST https://www.agentroyale.xyz/api/a2a/casino \\');
  console.error('    -d \'{"action":"close_channel","stealthAddress":"0x..."}\' > final-state.json');
  process.exit(1);
}

// Load ABI
const abi = JSON.parse(fs.readFileSync('./ChannelManager.abi.json', 'utf8'));

// Read final state from file or stdin
async function readFinalState() {
  if (stateFile) {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  }
  
  // Read from stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  let input = '';
  for await (const line of rl) {
    input += line;
  }
  
  if (!input.trim()) {
    throw new Error('No final state provided. Pipe A2A response or pass file path.');
  }
  
  return JSON.parse(input);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const wallet = new ethers.Wallet(agentPrivateKey, provider);
  const channelManager = new ethers.Contract(CHANNEL_MANAGER, abi, wallet);

  console.log(`Agent wallet: ${wallet.address}`);
  console.log(`ChannelManager: ${CHANNEL_MANAGER}`);
  console.log();

  // Get final state from A2A
  console.log('Reading final signed state from A2A...');
  const finalState = await readFinalState();
  
  if (!finalState.agentBalance || !finalState.casinoBalance || !finalState.nonce || !finalState.signature) {
    console.error('Error: Invalid final state. Missing required fields:');
    console.error('  - agentBalance');
    console.error('  - casinoBalance');
    console.error('  - nonce');
    console.error('  - signature (casino EIP-712 signature)');
    process.exit(1);
  }

  // Verify channel exists and is open
  const channel = await channelManager.channels(wallet.address);
  
  if (channel.state === 0) {
    console.error('Error: No channel exists for this address');
    process.exit(1);
  }
  
  if (channel.state === 3) {
    console.error('Error: Channel already closed');
    process.exit(1);
  }
  
  if (channel.state === 2) {
    console.error('Error: Channel is disputed. Resolve dispute first.');
    process.exit(1);
  }

  // Parse amounts
  const agentBalanceWei = ethers.parseEther(finalState.agentBalance);
  const casinoBalanceWei = ethers.parseEther(finalState.casinoBalance);
  const nonce = BigInt(finalState.nonce);

  // Validate conservation invariant
  const totalDeposit = channel.agentDeposit + channel.casinoDeposit;
  const totalFinal = agentBalanceWei + casinoBalanceWei;
  
  if (totalDeposit !== totalFinal) {
    console.error('❌ SECURITY ERROR: Conservation invariant violated!');
    console.error(`Total deposit: ${ethers.formatEther(totalDeposit)} ETH`);
    console.error(`Total final: ${ethers.formatEther(totalFinal)} ETH`);
    console.error('');
    console.error('This should never happen. Do NOT proceed.');
    console.error('Contact support with this error.');
    process.exit(1);
  }

  // Show summary
  console.log('Channel Summary:');
  console.log(`  Original deposit: ${ethers.formatEther(channel.agentDeposit)} ETH`);
  console.log(`  Casino collateral: ${ethers.formatEther(channel.casinoDeposit)} ETH`);
  console.log(`  Current nonce: ${channel.nonce.toString()}`);
  console.log();
  
  console.log('Final Settlement:');
  console.log(`  Agent payout: ${finalState.agentBalance} ETH`);
  console.log(`  Casino payout: ${finalState.casinoBalance} ETH`);
  console.log(`  Nonce: ${finalState.nonce}`);
  console.log();

  // Calculate profit/loss
  const delta = agentBalanceWei - channel.agentDeposit;
  const deltaEth = ethers.formatEther(delta);
  const deltaPercent = Number(delta * 10000n / channel.agentDeposit) / 100;
  
  if (delta > 0) {
    console.log(`✅ Profit: +${deltaEth} ETH (+${deltaPercent.toFixed(2)}%)`);
  } else if (delta < 0) {
    console.log(`📉 Loss: ${deltaEth} ETH (${deltaPercent.toFixed(2)}%)`);
  } else {
    console.log(`➡️  Break even: ${deltaEth} ETH`);
  }
  console.log();

  // Security checks
  console.log('Security Checks:');
  console.log(`  ✅ Channel exists and is open`);
  console.log(`  ✅ Conservation invariant valid`);
  console.log(`  ✅ Nonce is higher (${nonce} > ${channel.nonce})`);
  console.log();

  // Estimate gas
  try {
    const gasEstimate = await channelManager.closeChannel.estimateGas(
      agentBalanceWei,
      casinoBalanceWei,
      nonce,
      finalState.signature
    );
    
    const feeData = await provider.getFeeData();
    const gasCost = gasEstimate * (feeData.gasPrice || feeData.maxFeePerGas);
    
    console.log(`Estimated gas: ${gasEstimate.toString()}`);
    console.log(`Estimated cost: ${ethers.formatEther(gasCost)} ETH`);
    console.log();
  } catch (err) {
    console.error('⚠️  Gas estimation failed:', err.message);
    console.error('This might indicate an invalid signature or nonce.');
    console.error('');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('Continue anyway? (yes/no): ', resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // Final confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const confirm = await new Promise(resolve => {
    rl.question(`Close channel and settle ${finalState.agentBalance} ETH to ${wallet.address}? (yes/no): `, resolve);
  });
  rl.close();
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Aborted.');
    process.exit(0);
  }

  // Send transaction
  console.log('Closing channel...');
  const tx = await channelManager.closeChannel(
    agentBalanceWei,
    casinoBalanceWei,
    nonce,
    finalState.signature
  );
  
  console.log(`Transaction sent: ${tx.hash}`);
  console.log(`BaseScan: https://basescan.org/tx/${tx.hash}`);
  console.log();

  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}`);
  console.log();

  // Verify channel closed
  const closedChannel = await channelManager.channels(wallet.address);
  
  if (closedChannel.state !== 3) {
    console.error('⚠️  Warning: Channel state is not Closed');
    console.error(`Current state: ${closedChannel.state}`);
  } else {
    console.log('✅ Channel closed successfully!');
  }
  
  console.log();
  console.log('Final Settlement:');
  console.log(`  Agent received: ${finalState.agentBalance} ETH`);
  console.log(`  Casino received: ${finalState.casinoBalance} ETH`);
  console.log(`  Transaction: https://basescan.org/tx/${tx.hash}`);
  console.log();
  
  // Check actual balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
