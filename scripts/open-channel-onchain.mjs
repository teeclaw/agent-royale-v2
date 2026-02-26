#!/usr/bin/env node

/**
 * Open channel onchain (required before using A2A API)
 * 
 * Usage:
 *   node scripts/open-channel-onchain.mjs <depositEth> <agentPrivateKey>
 * 
 * Example:
 *   node scripts/open-channel-onchain.mjs 0.1 0x1234...
 */

import { ethers } from 'ethers';
import fs from 'fs';

const CHANNEL_MANAGER = '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e';
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const depositEth = process.argv[2] || '0.1';
const agentPrivateKey = process.argv[3] || process.env.AGENT_WALLET_PRIVATE_KEY;

if (!agentPrivateKey) {
  console.error('Error: Agent private key required');
  console.error('Usage: node scripts/open-channel-onchain.mjs <depositEth> <privateKey>');
  console.error('   Or: AGENT_WALLET_PRIVATE_KEY=0x... node scripts/open-channel-onchain.mjs 0.1');
  process.exit(1);
}

// Load ABI
const abi = JSON.parse(fs.readFileSync('./ChannelManager.abi.json', 'utf8'));

async function main() {
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const wallet = new ethers.Wallet(agentPrivateKey, provider);
  const channelManager = new ethers.Contract(CHANNEL_MANAGER, abi, wallet);

  console.log(`Agent wallet: ${wallet.address}`);
  console.log(`Deposit: ${depositEth} ETH`);
  console.log(`ChannelManager: ${CHANNEL_MANAGER}`);
  console.log();

  // Check if channel already exists
  const channel = await channelManager.channels(wallet.address);
  if (channel.state !== 0) {
    console.error(`Error: Channel already exists for ${wallet.address}`);
    console.error(`State: ${channel.state} (0=None, 1=Open, 2=Disputed, 3=Closed)`);
    process.exit(1);
  }

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  const depositWei = ethers.parseEther(depositEth);
  
  if (balance < depositWei) {
    console.error(`Error: Insufficient balance`);
    console.error(`  Balance: ${ethers.formatEther(balance)} ETH`);
    console.error(`  Required: ${depositEth} ETH`);
    process.exit(1);
  }

  console.log(`Agent balance: ${ethers.formatEther(balance)} ETH`);
  console.log();

  // Estimate gas
  const gasEstimate = await channelManager.openChannel.estimateGas({ value: depositWei });
  const feeData = await provider.getFeeData();
  const gasCost = gasEstimate * (feeData.gasPrice || feeData.maxFeePerGas);

  console.log(`Estimated gas: ${gasEstimate.toString()}`);
  console.log(`Estimated cost: ${ethers.formatEther(gasCost)} ETH`);
  console.log();

  // Send transaction
  console.log('Opening channel...');
  const tx = await channelManager.openChannel({ value: depositWei });
  console.log(`Transaction sent: ${tx.hash}`);
  console.log(`BaseScan: https://basescan.org/tx/${tx.hash}`);
  console.log();

  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}`);
  console.log();

  // Verify channel opened
  const newChannel = await channelManager.channels(wallet.address);
  console.log('Channel opened successfully! ✅');
  console.log(`  Agent deposit: ${ethers.formatEther(newChannel.agentDeposit)} ETH`);
  console.log(`  Agent balance: ${ethers.formatEther(newChannel.agentBalance)} ETH`);
  console.log(`  Casino deposit: ${ethers.formatEther(newChannel.casinoDeposit)} ETH`);
  console.log(`  State: ${newChannel.state} (1 = Open)`);
  console.log();
  console.log('You can now use the A2A API to play games.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
