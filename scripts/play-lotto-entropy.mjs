#!/usr/bin/env node
/**
 * Play Lotto (Pyth Entropy only - 6h draws)
 * 
 * Flow:
 * 1. Buy tickets (1-10 per draw)
 * 2. Wait for draw time (every 6h)
 * 3. Check status
 * 4. Finalize to get results
 * 
 * Usage: node scripts/play-lotto-entropy.mjs --stealth 0x... --numbers 7,42,99 --bet 1
 */
const A2A = 'https://www.agentroyale.xyz/api/a2a/casino';

const args = process.argv.slice(2);
const g = (n, r) => { const i = args.indexOf(`--${n}`); return i === -1 ? (r ? (() => { throw new Error(`--${n}`); })() : null) : args[i+1]; };

const s = g('stealth', 1);
const nums = g('numbers', 1)?.split(',').map(x => parseInt(x.trim()));
const bet = g('bet') || '1'; // Lotto ticket count (1-10)

if (!s?.match(/^0x[a-fA-F0-9]{40}$/)) { console.error('Invalid address'); process.exit(1); }
if (!nums || nums.some(n => isNaN(n) || n < 1 || n > 100)) { console.error('Numbers: 1-100 (comma separated)'); process.exit(1); }
if (nums.length > 10) { console.error('Max 10 tickets'); process.exit(1); }

console.log('🎟️  LOTTO (Pyth Entropy)');
console.log(`Numbers: ${nums.join(', ')}`);
console.log(`Tickets: ${nums.length} × 0.001 ETH = ${(nums.length * 0.001).toFixed(3)} ETH`);
console.log();

async function a2a(a, p) {
  const r = await fetch(A2A, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: '0.3.0',
      from: { name: 'LottoScript' },
      message: {
        contentType: 'application/json',
        content: { action: a, stealthAddress: s, params: p }
      }
    })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function main() {
  // Buy tickets
  console.log('📤 Buying tickets...');
  for (const num of nums) {
    const buyResp = await a2a('lotto_entropy_buy', { pick: num, tickets: 1 });
    if (buyResp.error) throw new Error(buyResp.error);
    console.log(`  ✅ Ticket #${num} purchased (Draw: ${buyResp.drawId})`);
  }
  console.log();

  // Check status
  console.log('⏳ Checking draw status...');
  const statusResp = await a2a('lotto_entropy_status', {});
  if (statusResp.error) throw new Error(statusResp.error);

  const { drawId, drawTime, state } = statusResp;
  const drawDate = new Date(drawTime);
  const now = new Date();

  console.log(`  Draw ID: ${drawId}`);
  console.log(`  Draw Time: ${drawDate.toISOString()}`);
  console.log(`  State: ${state}`);
  console.log();

  if (state === 'open' || state === 'entropy_requested') {
    const timeLeft = drawDate - now;
    const hoursLeft = Math.floor(timeLeft / 3600000);
    const minsLeft = Math.floor((timeLeft % 3600000) / 60000);

    console.log(`⏰ Draw in ${hoursLeft}h ${minsLeft}m`);
    console.log('   Come back after draw time to finalize results.');
    console.log();
    console.log(`   Command to check results:`);
    console.log(`   node scripts/play-lotto-entropy.mjs --stealth ${s} --finalize`);
    process.exit(0);
  }

  if (state === 'entropy_fulfilled') {
    console.log('🎲 Drawing complete! Finalizing...');
    
    for (const num of nums) {
      const finalResp = await a2a('lotto_entropy_finalize', { pick: num });
      if (finalResp.error) throw new Error(finalResp.error);

      const { won, payout, winningNumber, agentBalance } = finalResp;

      console.log(`  Ticket #${num}: ${won ? `✅ WIN! (${winningNumber} matched) = ${payout} ETH` : `❌ MISS (${winningNumber})`}`);
      console.log(`    Balance: ${agentBalance} ETH`);
    }
    console.log();
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
