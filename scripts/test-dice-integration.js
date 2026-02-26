#!/usr/bin/env node

/**
 * Test EntropyDice Integration (Base Mainnet)
 * 
 * Usage:
 *   node scripts/test-dice-integration.js
 * 
 * Tests:
 *   1. Contract accessibility
 *   2. Quote fee
 *   3. Admin settings
 *   4. API integration
 */

require('dotenv').config();
const { ethers } = require('ethers');

const ENTROPY_DICE_ABI = [
  'function entropy() view returns (address)',
  'function entropyProvider() view returns (address)',
  'function callbackGasLimit() view returns (uint32)',
  'function roundTtl() view returns (uint256)',
  'function paused() view returns (bool)',
  'function quoteFee() view returns (uint256)',
];

async function testContract() {
  console.log('=== EntropyDice Contract Test ===\n');
  
  const entropyDice = process.env.ENTROPY_DICE;
  const rpcUrl = process.env.BASE_RPC_URL || process.env.ONCHAIN_RPC_URL;
  
  if (!entropyDice) {
    console.error('❌ ENTROPY_DICE not set in .env');
    return false;
  }
  
  if (!rpcUrl) {
    console.error('❌ BASE_RPC_URL not set in .env');
    return false;
  }
  
  console.log(`Contract: ${entropyDice}`);
  console.log(`RPC: ${rpcUrl}\n`);
  
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const dice = new ethers.Contract(entropyDice, ENTROPY_DICE_ABI, provider);
    
    // Test 1: Contract exists
    const code = await provider.getCode(entropyDice);
    if (code === '0x') {
      console.error('❌ Contract not deployed or wrong address');
      return false;
    }
    console.log('✅ Contract deployed');
    
    // Test 2: Read entropy address
    const entropy = await dice.entropy();
    console.log(`✅ Entropy: ${entropy}`);
    
    // Test 3: Read provider
    const provider_addr = await dice.entropyProvider();
    console.log(`✅ Provider: ${provider_addr}`);
    
    // Test 4: Gas limit
    const gasLimit = await dice.callbackGasLimit();
    console.log(`✅ Gas Limit: ${gasLimit}`);
    
    // Test 5: TTL
    const ttl = await dice.roundTtl();
    console.log(`✅ Round TTL: ${ttl}s (${Number(ttl) / 60} min)`);
    
    // Test 6: Paused
    const paused = await dice.paused();
    console.log(`✅ Paused: ${paused}`);
    
    // Test 7: Quote fee
    const fee = await dice.quoteFee();
    console.log(`✅ Fee: ${ethers.formatEther(fee)} Ξ`);
    
    if (paused) {
      console.warn('\n⚠️  Contract is PAUSED');
    }
    
    console.log('\n✅ All contract tests passed\n');
    return true;
  } catch (err) {
    console.error('❌ Contract test failed:', err.message);
    return false;
  }
}

async function testAPI() {
  console.log('=== API Integration Test ===\n');
  
  const apiUrl = process.env.API_URL || 'http://localhost:3847';
  
  console.log(`API: ${apiUrl}/a2a/casino\n`);
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    // Test 1: Info endpoint
    const infoResp = await fetch(`${apiUrl}/a2a/casino`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'TestAgent',
        message: {
          contentType: 'application/json',
          content: { action: 'info' }
        }
      })
    });
    
    if (!infoResp.ok) {
      console.error('❌ API not responding');
      return false;
    }
    
    const info = await infoResp.json();
    const actions = info.message?.content?.actions?.games || [];
    
    console.log('Available actions:', actions.length);
    
    // Test 2: Dice entropy actions present
    const diceActions = [
      'dice_commit',
      'dice_reveal',
      'dice_entropy_commit',
      'dice_entropy_status',
      'dice_entropy_finalize'
    ];
    
    const missing = [];
    for (const action of diceActions) {
      if (actions.includes(action)) {
        console.log(`✅ ${action}`);
      } else {
        console.log(`❌ ${action} MISSING`);
        missing.push(action);
      }
    }
    
    if (missing.length > 0) {
      console.error(`\n❌ Missing actions: ${missing.join(', ')}`);
      return false;
    }
    
    console.log('\n✅ All API tests passed\n');
    return true;
  } catch (err) {
    console.error('❌ API test failed:', err.message);
    return false;
  }
}

async function main() {
  const contractOk = await testContract();
  const apiOk = await testAPI();
  
  console.log('=== Summary ===\n');
  console.log(`Contract: ${contractOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`API:      ${apiOk ? '✅ PASS' : '❌ FAIL'}`);
  
  if (contractOk && apiOk) {
    console.log('\n🎉 EntropyDice integration ready!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Integration incomplete. Fix errors above.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
