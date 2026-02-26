#!/usr/bin/env node

/**
 * Example: Play Dice
 *
 * Usage: node play-dice.js [casinoUrl] [depositEth] [betEth] [rolls]
 *
 * Demo:
 *   node play-dice.js https://www.agentroyale.xyz/api/a2a/casino 0.01 0.001 10
 */

const AgentCasinoClient = require('../agent-client');

const CASINO_URL = process.argv[2] || 'https://www.agentroyale.xyz/api/a2a/casino';
const DEPOSIT = process.argv[3] || '0.01';
const BET = process.argv[4] || '0.001';
const ROLLS = parseInt(process.argv[5] || '10', 10);

async function main() {
  const client = new AgentCasinoClient(CASINO_URL);

  console.log('Starting casino session...');
  console.log(`  Deposit: ${DEPOSIT} Ξ`);
  console.log(`  Bet per roll: ${BET} Ξ`);
  console.log(`  Rolls: ${ROLLS}`);
  console.log();

  const session = await client.startSession(DEPOSIT);
  console.log(`Stealth address: ${session.stealthAddress}`);
  console.log();

  // Mix of bets: conservative, balanced, and risky
  const strategies = [
    { choice: 'over', target: 50, label: 'Conservative (over 50)' },
    { choice: 'under', target: 50, label: 'Conservative (under 50)' },
    { choice: 'over', target: 75, label: 'Balanced (over 75)' },
    { choice: 'under', target: 25, label: 'Balanced (under 25)' },
    { choice: 'over', target: 90, label: 'Risky (over 90)' },
    { choice: 'under', target: 10, label: 'Risky (under 10)' },
  ];

  for (let i = 1; i <= ROLLS; i++) {
    try {
      const strategy = strategies[i % strategies.length];
      const result = await client.playDice(BET, strategy.choice, strategy.target);
      
      const win = Number(result.payout || 0) > 0;
      const rollStr = `Roll ${result.roll} (${strategy.choice} ${strategy.target})`;
      const outcomeStr = win 
        ? `WIN ${result.multiplier}x = ${result.payout} Ξ` 
        : 'MISS';

      console.log(
        `Roll ${i}: ${rollStr.padEnd(25)} | ${outcomeStr.padEnd(20)} | Balance: ${result.agentBalance} Ξ`
      );
    } catch (err) {
      console.error(`Roll ${i} error: ${err.message}`);
      break;
    }
  }

  console.log();

  const close = await client.closeSession();
  console.log('Session closed.');
  console.log(`  Final balance: ${close.agentBalance} Ξ`);
  console.log(`  Games played: ${close.sessionStats.gamesPlayed}`);
  console.log(`  States stored: ${close.sessionStats.statesStored}`);
  
  const profit = parseFloat(close.agentBalance) - parseFloat(DEPOSIT);
  console.log(`  P&L: ${profit >= 0 ? '+' : ''}${profit.toFixed(4)} Ξ`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
