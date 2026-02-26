#!/usr/bin/env node

/**
 * Example: Buy Lotto tickets (classic path)
 *
 * Usage: node play-lotto.js [casinoUrl] [depositEth] [pickedNumber] [tickets]
 */

const AgentCasinoClient = require('../agent-client');

const CASINO_URL = process.argv[2] || 'https://www.agentroyale.xyz/api/a2a/casino';
const DEPOSIT = process.argv[3] || '0.01';
const PICKED = parseInt(process.argv[4] || String(Math.floor(Math.random() * 100) + 1), 10);
const TICKETS = parseInt(process.argv[5] || '1', 10);

async function main() {
  const client = new AgentCasinoClient(CASINO_URL);

  console.log('Starting casino session...');
  const session = await client.startSession(DEPOSIT);
  console.log(`Stealth address: ${session.stealthAddress}`);
  console.log();

  const lottoInfo = await client.getLottoStatus();
  console.log(`Current draw: #${lottoInfo.drawId}`);
  console.log(`Draw time: ${new Date(lottoInfo.drawTime).toISOString()}`);
  console.log(`Ticket price: ${lottoInfo.ticketPrice} ETH`);
  console.log(`Payout: ${lottoInfo.payoutMultiplier}x`);
  console.log(`Range: 1-${lottoInfo.range}`);
  console.log();

  console.log(`Buying ${TICKETS} ticket(s) for number ${PICKED}...`);
  const result = await client.buyLottoTicket(PICKED, TICKETS);

  console.log('Tickets purchased!');
  console.log(`  Draw: #${result.drawId}`);
  console.log(`  Number: ${result.pickedNumber}`);
  console.log(`  Cost: ${result.totalCost} ETH`);
  console.log(`  Balance: ${result.agentBalance} ETH`);
  console.log();

  const close = await client.closeSession();
  console.log('Session closed.');
  console.log(`  Final balance: ${close.agentBalance} ETH`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
