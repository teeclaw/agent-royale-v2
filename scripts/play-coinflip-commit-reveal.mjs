#!/usr/bin/env node
/**
 * Play Coinflip (Commit-Reveal)
 * Usage: node scripts/play-coinflip-commit-reveal.mjs --stealth 0x... --bet 0.001 --choice heads --rounds 10
 */
import crypto from 'crypto';
const A2A = 'https://www.agentroyale.xyz/api/a2a/casino';

const args = process.argv.slice(2);
const g = (n, r) => { const i = args.indexOf(`--${n}`); if (i === -1) { if (r) throw new Error(`Missing: --${n}`); return null; } return args[i+1]; };

const stealth = g('stealth', 1);
const bet = g('bet', 1);
const choice = g('choice', 1);
const rounds = parseInt(g('rounds') || '1');
const dry = args.includes('--dry-run');

if (!stealth?.match(/^0x[a-fA-F0-9]{40}$/)) { console.error('Invalid address'); process.exit(1); }
if (isNaN(parseFloat(bet)) || parseFloat(bet) < 0.0001) { console.error('Invalid bet'); process.exit(1); }
if (!['heads', 'tails'].includes(choice)) { console.error('Choice: heads or tails'); process.exit(1); }

console.log(`🪙 COINFLIP (${choice}) - ${bet} ETH × ${rounds}\n`);

async function a2a(act, p) {
  const r = await fetch(A2A, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: '0.3.0', from: { name: 'CoinScript' }, message: { contentType: 'application/json', content: { action: act, stealthAddress: stealth, params: p }}})
  });
  return r.json();
}

function seed() { return '0x' + crypto.randomBytes(32).toString('hex'); }
function verify(c, s) { return c.toLowerCase() === ('0x' + crypto.createHash('sha256').update(s).digest('hex')).toLowerCase(); }

async function play(n) {
  console.log(`Round ${n}`);
  if (dry) { console.log('  [DRY]\n'); return { w: 0, d: 1 }; }

  const c = await a2a('coinflip_commit', { betAmount: bet, choice });
  if (c.error) throw new Error(c.error);

  const r = await a2a('coinflip_reveal', { agentSeed: seed() });
  if (r.error) throw new Error(r.error);

  if (!verify(c.commitment, r.casinoSeed)) { console.error('❌ CHEAT!'); process.exit(1); }

  console.log(`  ${r.result.toUpperCase()}`);
  console.log(r.won ? `  ✅ WIN ${r.payout} ETH` : `  ❌ LOSS`);
  console.log(`  Balance: ${r.agentBalance} ETH\n`);

  return { w: r.won ? 1 : 0, p: parseFloat(r.payout || '0') };
}

async function main() {
  let tw = 0, tp = 0, w = 0;
  for (let i = 1; i <= rounds; i++) {
    const x = await play(i);
    if (!x.d) {
      tw += parseFloat(bet);
      tp += x.p;
      w += x.w;
      if (i < rounds) await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!dry) {
    const p = tp - tw;
    console.log(`Rounds: ${rounds} | Wins: ${w}`);
    console.log(`${p > 0 ? '✅' : '📉'} ${p > 0 ? '+' : ''}${p.toFixed(4)} ETH`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
