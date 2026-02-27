#!/usr/bin/env node
/**
 * Play Coinflip (Pyth Entropy)
 * Usage: node scripts/play-coinflip-entropy.mjs --stealth 0x... --bet 0.001 --choice heads --rounds 5
 */
const A2A = 'https://www.agentroyale.xyz/api/a2a/casino';

const args = process.argv.slice(2);
const g = (n, r) => { const i = args.indexOf(`--${n}`); return i === -1 ? (r ? (() => { throw new Error(`--${n}`); })() : null) : args[i+1]; };

const s = g('stealth', 1), b = g('bet', 1), c = g('choice', 1), r = parseInt(g('rounds') || '1'), d = args.includes('--dry-run');

if (!s?.match(/^0x[a-fA-F0-9]{40}$/) || !['heads','tails'].includes(c)) process.exit(1);

console.log(`🪙 COINFLIP ENT (${c}) - ${b} ETH × ${r} (~30s/round)\n`);

async function a2a(a, p) {
  const x = await fetch(A2A, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: '0.3.0', from: { name: 'CoinEnt' }, message: { contentType: 'application/json', content: { action: a, stealthAddress: s, params: p }}}) });
  return x.json();
}

async function poll(id) {
  let t = Date.now();
  while (Date.now() - t < 300000) {
    const x = await a2a('coinflip_entropy_status', { roundId: id });
    if (x.state === 'entropy_fulfilled') return;
    if (x.error) throw new Error(x.error);
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Timeout');
}

async function play(n) {
  console.log(`Round ${n}`);
  if (d) { console.log('  [DRY]\n'); return { w: 0, d: 1 }; }
  
  const m = await a2a('coinflip_entropy_commit', { betAmount: b, choice: c });
  if (m.error) throw new Error(m.error);
  
  process.stdout.write('  Wait');
  await poll(m.roundId);
  console.log(' ✅');
  
  const f = await a2a('coinflip_entropy_finalize', { roundId: m.roundId });
  if (f.error) throw new Error(f.error);
  
  console.log(`  ${f.result.toUpperCase()}`);
  console.log(f.won ? `  ✅ WIN ${f.payout} ETH` : `  ❌ LOSS`);
  console.log(`  Balance: ${f.agentBalance} ETH\n`);
  
  return { w: f.won ? 1 : 0, p: parseFloat(f.payout || '0') };
}

async function main() {
  let tw = 0, tp = 0, w = 0;
  for (let i = 1; i <= r; i++) {
    const x = await play(i);
    if (!x.d) {
      tw += parseFloat(b);
      tp += x.p;
      w += x.w;
      if (i < r) await new Promise(z => setTimeout(z, 5000));
    }
  }
  if (!d) {
    const p = tp - tw;
    console.log(`Rounds: ${r} | Wins: ${w} | ${p > 0 ? '+' : ''}${p.toFixed(4)} ETH`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
