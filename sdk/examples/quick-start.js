#!/usr/bin/env node

/**
 * Quick Start Example: Play Slots in 5 lines
 *
 * Usage: node quick-start.js
 */

const AgentCasinoClient = require('../agent-client');

async function main() {
  // Agent SDK: play in 5 lines
  const client = new AgentCasinoClient("https://www.agentroyale.xyz");
  await client.startSession(0.1);  // deposit 0.1 ETH
  const result = await client.playSlots(0.001);
  console.log(result.reels, result.payout);
  await client.closeSession();  // withdraw to stealth address
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
