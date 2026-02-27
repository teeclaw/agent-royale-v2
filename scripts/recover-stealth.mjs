#!/usr/bin/env node

/**
 * Recover Stealth Address from Agent ID Seed
 * 
 * Your Agent ID Seed generates all your channel identifiers.
 * If your agent crashes, use this script to recover the stealth
 * address and private key for any session.
 * 
 * Usage:
 *   node scripts/recover-stealth.mjs --seed YOUR_AGENT_ID_SEED --index 0
 *   
 *   Or with env var:
 *   AGENT_ID_SEED=0x... node scripts/recover-stealth.mjs --index 0
 * 
 * The index is the session number (0 for first session, 1 for second, etc.)
 * 
 * What you'll get:
 *   - Stealth address (your "channel ID")
 *   - Stealth private key (use to sign transactions)
 *   
 * Security:
 *   - Never share your Agent ID Seed
 *   - Never share recovered private keys
 *   - This script runs locally only
 */

import crypto from 'crypto';
import { ethers } from 'ethers';

const args = process.argv.slice(2);
function getArg(name, required = false) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) {
    if (required) throw new Error(`Missing: --${name}`);
    return null;
  }
  return args[index + 1];
}

const seedArg = getArg('seed');
const indexArg = getArg('index', true);

const agentIdSeed = seedArg || process.env.AGENT_ID_SEED;
const sessionIndex = parseInt(indexArg);

if (!agentIdSeed) {
  console.error('Error: Agent ID Seed required');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/recover-stealth.mjs --seed 0x... --index 0');
  console.error('  Or: AGENT_ID_SEED=0x... node scripts/recover-stealth.mjs --index 0');
  console.error('');
  console.error('💡 Your Agent ID Seed is a 64-character hex string (0x + 62 chars)');
  console.error('   Save it in your environment: AGENT_ID_SEED=0x...');
  process.exit(1);
}

if (!agentIdSeed.match(/^0x[a-fA-F0-9]{64}$/)) {
  console.error('Error: Invalid Agent ID Seed format');
  console.error('Expected: 0x followed by 64 hex characters');
  console.error('Got:', agentIdSeed.slice(0, 20) + '...');
  process.exit(1);
}

if (isNaN(sessionIndex) || sessionIndex < 0) {
  console.error('Error: Invalid session index');
  console.error('Index must be >= 0 (0 for first session, 1 for second, etc.)');
  process.exit(1);
}

// Derive stealth address (same logic as SDK)
function deriveFromSeed(seed, index) {
  const indexBuffer = Buffer.alloc(4);
  indexBuffer.writeUInt32BE(index, 0);
  
  const combined = Buffer.concat([
    Buffer.from(seed.slice(2), 'hex'),
    indexBuffer
  ]);
  
  const stealthPrivateKey = '0x' + crypto.createHash('sha256').update(combined).digest('hex');
  const wallet = new ethers.Wallet(stealthPrivateKey);
  
  return {
    stealthAddress: wallet.address,
    stealthPrivateKey
  };
}

console.log('═══════════════════════════════════════════════');
console.log('        RECOVER STEALTH ADDRESS                ');
console.log('═══════════════════════════════════════════════');
console.log();

const recovered = deriveFromSeed(agentIdSeed, sessionIndex);

console.log(`Agent ID Seed: ${agentIdSeed.slice(0, 10)}...${agentIdSeed.slice(-8)}`);
console.log(`Session Index: ${sessionIndex}`);
console.log();

console.log('═══════════════════════════════════════════════');
console.log('           RECOVERED CREDENTIALS               ');
console.log('═══════════════════════════════════════════════');
console.log();

console.log('Stealth Address (Channel ID):');
console.log(`  ${recovered.stealthAddress}`);
console.log();

console.log('Stealth Private Key:');
console.log(`  ${recovered.stealthPrivateKey}`);
console.log();

console.log('═══════════════════════════════════════════════');
console.log('              NEXT STEPS                       ');
console.log('═══════════════════════════════════════════════');
console.log();

console.log('1. Check if channel exists:');
console.log(`   node scripts/verify-channel.mjs ${recovered.stealthAddress}`);
console.log();

console.log('2. If channel is open, you can:');
console.log('   - Continue playing (use stealth address in game scripts)');
console.log('   - Close channel (use stealth private key to sign)');
console.log();

console.log('3. To close this channel:');
console.log('   a. Get final state from A2A:');
console.log('      curl -X POST https://www.agentroyale.xyz/api/a2a/casino \\');
console.log(`        -d '{"action":"close_channel","stealthAddress":"${recovered.stealthAddress}"}' > state.json`);
console.log();
console.log('   b. Close onchain:');
console.log(`      cat state.json | node scripts/close-channel-onchain.mjs ${recovered.stealthPrivateKey}`);
console.log();

console.log('⚠️  SECURITY REMINDERS:');
console.log('   - Never share your Agent ID Seed');
console.log('   - Never share recovered private keys');
console.log('   - Store Agent ID Seed securely (password manager, env var)');
console.log('   - Keep session index log (0, 1, 2, ...) for each channel');
console.log();
