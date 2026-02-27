#!/usr/bin/env node

/**
 * recover-stealth.mjs
 * 
 * Recover stealth address + private key from AGENT_ID_SEED + session index.
 * Critical for fund recovery after agent crashes.
 * 
 * Usage:
 *   node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 0
 *   node scripts/recover-stealth.mjs --seed 0x1234... --index 2
 * 
 * Security:
 *   - Never logs full AGENT_ID_SEED (only first 10 chars)
 *   - Private key printed once to stdout
 *   - No network calls
 *   - No file writes (output only)
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Dynamic import of StealthAddress module
const StealthAddress = await import(join(projectRoot, 'privacy/stealth.js')).then(m => m.default);

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    params[key] = value;
  }
  
  return params;
}

// Validate AGENT_ID_SEED format
function validateSeed(seed) {
  if (!seed) {
    throw new Error('AGENT_ID_SEED is required (--seed parameter)');
  }
  
  if (!/^0x[0-9a-fA-F]{64}$/.test(seed)) {
    throw new Error('Invalid AGENT_ID_SEED format (expected: 0x + 64 hex chars)');
  }
  
  return true;
}

// Main recovery function
function recoverStealth(agentIdSeed, sessionIndex) {
  validateSeed(agentIdSeed);
  
  const index = parseInt(sessionIndex, 10);
  if (isNaN(index) || index < 0) {
    throw new Error('Invalid session index (must be non-negative integer)');
  }
  
  console.log('=== Stealth Address Recovery ===\n');
  console.log(`Agent ID Seed: ${agentIdSeed.substring(0, 10)}... (first 10 chars)`);
  console.log(`Session Index: ${index}\n`);
  
  const recovered = StealthAddress.deriveFromMaster(agentIdSeed, index);
  
  console.log('✅ Recovery successful!\n');
  console.log(`Stealth Address: ${recovered.stealthAddress}`);
  console.log(`Stealth Private Key: ${recovered.stealthPrivateKey}\n`);
  
  console.log('⚠️  WARNING: Keep private key secret!');
  console.log('Use this key to close your channel or sign transactions.\n');
  
  return recovered;
}

// CLI entry point
try {
  const args = parseArgs();
  
  if (!args.seed || !args.index) {
    console.error('Usage: node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index <number>');
    console.error('\nExample:');
    console.error('  node scripts/recover-stealth.mjs --seed 0x1234567890abcdef... --index 0');
    console.error('  node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 2');
    process.exit(1);
  }
  
  recoverStealth(args.seed, args.index);
} catch (err) {
  console.error('❌ Recovery failed:', err.message);
  process.exit(1);
}
