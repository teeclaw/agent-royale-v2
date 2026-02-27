#!/usr/bin/env node

/**
 * Verify channel state onchain
 * 
 * Security:
 * - Read-only operation (no transactions)
 * - Shows complete channel state
 * - Validates conservation invariant
 * - No private key required
 * 
 * Usage:
 *   node scripts/verify-channel.mjs <agentAddress>
 * 
 * Example:
 *   node scripts/verify-channel.mjs 0x1234567890123456789012345678901234567890
 */

import { ethers } from 'ethers';
import fs from 'fs';

const CHANNEL_MANAGER = '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e';
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const agentAddress = process.argv[2];

if (!agentAddress || !ethers.isAddress(agentAddress)) {
  console.error('Error: Valid agent address required');
  console.error('Usage: node scripts/verify-channel.mjs <agentAddress>');
  console.error('Example: node scripts/verify-channel.mjs 0x1234567890123456789012345678901234567890');
  process.exit(1);
}

// Load ABI
const abi = JSON.parse(fs.readFileSync('./ChannelManager.abi.json', 'utf8'));

async function main() {
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const channelManager = new ethers.Contract(CHANNEL_MANAGER, abi, provider);

  console.log(`Agent: ${agentAddress}`);
  console.log(`ChannelManager: ${CHANNEL_MANAGER}`);
  console.log(`Network: Base (Chain ID: 8453)`);
  console.log();

  // Read channel state
  const channel = await channelManager.channels(agentAddress);

  // State enum: 0=None, 1=Open, 2=Disputed, 3=Closed
  const stateNames = ['None', 'Open', 'Disputed', 'Closed'];
  const stateName = stateNames[channel.state] || 'Unknown';

  console.log('═══════════════════════════════════════════════');
  console.log('                 CHANNEL STATE                 ');
  console.log('═══════════════════════════════════════════════');
  console.log();
  
  if (channel.state === 0) {
    console.log('❌ No channel exists for this address');
    console.log();
    console.log('To open a channel:');
    console.log('  node scripts/open-channel-onchain.mjs 0.1 YOUR_PRIVATE_KEY');
    process.exit(0);
  }

  // Basic Info
  console.log(`Status: ${stateName} (${channel.state})`);
  console.log(`Opened: ${new Date(Number(channel.openedAt) * 1000).toISOString()}`);
  console.log();

  // Deposits
  console.log('Deposits:');
  console.log(`  Agent:  ${ethers.formatEther(channel.agentDeposit)} ETH`);
  console.log(`  Casino: ${ethers.formatEther(channel.casinoDeposit)} ETH`);
  console.log(`  Total:  ${ethers.formatEther(channel.agentDeposit + channel.casinoDeposit)} ETH`);
  console.log();

  // Current Balances
  console.log('Current Balances:');
  console.log(`  Agent:  ${ethers.formatEther(channel.agentBalance)} ETH`);
  console.log(`  Casino: ${ethers.formatEther(channel.casinoBalance)} ETH`);
  console.log(`  Total:  ${ethers.formatEther(channel.agentBalance + channel.casinoBalance)} ETH`);
  console.log();

  // Profit/Loss
  const delta = channel.agentBalance - channel.agentDeposit;
  const deltaEth = ethers.formatEther(delta);
  const deltaPercent = channel.agentDeposit > 0 
    ? Number(delta * 10000n / channel.agentDeposit) / 100
    : 0;
  
  console.log('Profit/Loss:');
  if (delta > 0) {
    console.log(`  ✅ +${deltaEth} ETH (+${deltaPercent.toFixed(2)}%)`);
  } else if (delta < 0) {
    console.log(`  📉 ${deltaEth} ETH (${deltaPercent.toFixed(2)}%)`);
  } else {
    console.log(`  ➡️  Break even`);
  }
  console.log();

  // Nonce
  console.log(`Nonce: ${channel.nonce.toString()}`);
  console.log();

  // Conservation Invariant Check
  const totalDeposit = channel.agentDeposit + channel.casinoDeposit;
  const totalBalance = channel.agentBalance + channel.casinoBalance;
  
  console.log('Conservation Invariant:');
  if (totalDeposit === totalBalance) {
    console.log(`  ✅ Valid (${ethers.formatEther(totalDeposit)} ETH = ${ethers.formatEther(totalBalance)} ETH)`);
  } else {
    console.log(`  ❌ VIOLATED!`);
    console.log(`     Deposits: ${ethers.formatEther(totalDeposit)} ETH`);
    console.log(`     Balances: ${ethers.formatEther(totalBalance)} ETH`);
    console.log(`     Diff: ${ethers.formatEther(totalBalance - totalDeposit)} ETH`);
    console.log();
    console.log('  ⚠️  This should never happen! Contact support immediately.');
  }
  console.log();

  // Dispute Info (if applicable)
  if (channel.state === 2) {
    const deadline = new Date(Number(channel.disputeDeadline) * 1000);
    const now = new Date();
    const timeLeft = deadline - now;
    const hoursLeft = Math.floor(timeLeft / 3600000);
    
    console.log('═══════════════════════════════════════════════');
    console.log('               DISPUTE ACTIVE                  ');
    console.log('═══════════════════════════════════════════════');
    console.log();
    console.log(`Deadline: ${deadline.toISOString()}`);
    
    if (timeLeft > 0) {
      console.log(`Time left: ${hoursLeft}h ${Math.floor((timeLeft % 3600000) / 60000)}m`);
      console.log();
      console.log('During dispute:');
      console.log('  - Either party can submit higher-nonce state');
      console.log('  - After deadline, anyone can call resolveChallenge()');
      console.log('  - Highest nonce wins');
    } else {
      console.log('⚠️  Deadline passed! Call resolveChallenge() to settle.');
    }
    console.log();
  }

  // State-specific Actions
  console.log('═══════════════════════════════════════════════');
  console.log('               NEXT ACTIONS                    ');
  console.log('═══════════════════════════════════════════════');
  console.log();
  
  if (channel.state === 1) {
    // Open
    console.log('Channel is OPEN. You can:');
    console.log();
    console.log('1. Play games via A2A:');
    console.log('   node sdk/examples/play-dice.js ...');
    console.log();
    console.log('2. Close channel cooperatively:');
    console.log('   # First, get final state from A2A');
    console.log('   curl -X POST https://www.agentroyale.xyz/api/a2a/casino \\');
    console.log('     -d \'{"action":"close_channel","stealthAddress":"0x..."}\' > state.json');
    console.log('   # Then settle onchain');
    console.log('   cat state.json | node scripts/close-channel-onchain.mjs YOUR_KEY');
    console.log();
    console.log('3. Start dispute (if casino is unresponsive):');
    console.log('   node scripts/dispute-channel.mjs YOUR_KEY state.json');
  } else if (channel.state === 2) {
    // Disputed
    if (Number(channel.disputeDeadline) * 1000 < Date.now()) {
      console.log('Dispute deadline passed. Resolve it:');
      console.log('  node scripts/resolve-dispute.mjs YOUR_KEY');
    } else {
      console.log('Dispute in progress. You can:');
      console.log('  1. Submit higher-nonce state (if you have one)');
      console.log('  2. Wait for deadline, then resolve');
    }
  } else if (channel.state === 3) {
    // Closed
    console.log('Channel is CLOSED. No actions available.');
    console.log();
    console.log('To play again:');
    console.log('  node scripts/open-channel-onchain.mjs 0.1 YOUR_KEY');
  }
  
  console.log();
  console.log('═══════════════════════════════════════════════');
  
  // BaseScan Link
  console.log();
  console.log(`View on BaseScan:`);
  console.log(`  https://basescan.org/address/${CHANNEL_MANAGER}#readContract`);
  console.log(`  Query: channels(${agentAddress})`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
