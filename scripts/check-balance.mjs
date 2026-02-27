#!/usr/bin/env node

/**
 * Check wallet and channel balance
 * 
 * Security:
 * - Read-only operation
 * - No transactions
 * - No private key required (unless checking your own channel)
 * 
 * Usage:
 *   node scripts/check-balance.mjs <address>
 * 
 * Example:
 *   node scripts/check-balance.mjs 0x1234567890123456789012345678901234567890
 */

import { ethers } from 'ethers';
import fs from 'fs';

const CHANNEL_MANAGER = '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e';
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const address = process.argv[2];

if (!address || !ethers.isAddress(address)) {
  console.error('Error: Valid address required');
  console.error('Usage: node scripts/check-balance.mjs <address>');
  process.exit(1);
}

// Load ABI
const abi = JSON.parse(fs.readFileSync('./ChannelManager.abi.json', 'utf8'));

async function main() {
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const channelManager = new ethers.Contract(CHANNEL_MANAGER, abi, provider);

  console.log(`Address: ${address}`);
  console.log(`Network: Base (Chain ID: 8453)`);
  console.log();

  // Get wallet balance
  const walletBalance = await provider.getBalance(address);
  
  console.log('Wallet Balance:');
  console.log(`  ${ethers.formatEther(walletBalance)} ETH`);
  console.log();

  // Get channel balance (if exists)
  const channel = await channelManager.channels(address);
  
  if (channel.state === 0) {
    console.log('Channel: None');
    console.log();
    console.log('To open a channel:');
    console.log('  node scripts/open-channel-onchain.mjs 0.1 YOUR_PRIVATE_KEY');
    return;
  }

  const stateNames = ['None', 'Open', 'Disputed', 'Closed'];
  const stateName = stateNames[channel.state];

  console.log(`Channel: ${stateName}`);
  console.log(`  Agent balance:  ${ethers.formatEther(channel.agentBalance)} ETH`);
  console.log(`  Casino balance: ${ethers.formatEther(channel.casinoBalance)} ETH`);
  console.log();

  // Total Available
  const totalAvailable = walletBalance + channel.agentBalance;
  console.log('Total Available:');
  console.log(`  ${ethers.formatEther(totalAvailable)} ETH`);
  console.log(`  (${ethers.formatEther(walletBalance)} wallet + ${ethers.formatEther(channel.agentBalance)} channel)`);
  console.log();

  // Recommendations
  if (channel.state === 1) {
    // Channel is open
    const agentEth = Number(ethers.formatEther(channel.agentBalance));
    
    if (agentEth < 0.001) {
      console.log('⚠️  Low channel balance!');
      console.log('   Close channel and reopen with more funds, or play smaller bets.');
    } else if (agentEth < 0.01) {
      console.log('💡 Moderate channel balance. Good for small bets (0.0001-0.001 ETH).');
    } else {
      console.log('✅ Good channel balance. Ready to play!');
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
