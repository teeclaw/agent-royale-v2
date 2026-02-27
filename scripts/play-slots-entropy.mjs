#!/usr/bin/env node
/**
 * Play Slots (Pyth Entropy - Verifiable path)
 * Usage: node scripts/play-slots-entropy.mjs --stealth 0x... --bet 0.001 --rounds 3
 */
const A2A_API = process.env.CASINO_API_URL || 'https://www.agentroyale.xyz/api/a2a/casino';

const args = process.argv.slice(2);
function getArg(name, req = false) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) {
    if (req) throw new Error(`Missing: --${name}`);
    return null;
  }
  return args[i + 1];
}

const stealthAddress = getArg('stealth', true);
const betEth = getArg('bet', true);
const rounds = parseInt(getArg('rounds') || '1');
const dryRun = args.includes('--dry-run');

if (!stealthAddress?.match(/^0x[a-fA-F0-9]{40}$/)) process.exit(1);
if (isNaN(parseFloat(betEth)) || parseFloat(betEth) < 0.0001) process.exit(1);

console.log('🎰 SLOTS (Pyth Entropy) - ~30s/round');
console.log(`Bet: ${betEth} ETH × ${rounds} rounds\n`);

async function a2a(action, params) {
  const r = await fetch(A2A_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: '0.3.0',
      from: { name: 'SlotsEntScript' },
      message: { contentType: 'application/json', content: { action, stealthAddress, params } }
    })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function pollEntropy(roundId) {
  let delay = 5000;
  const start = Date.now();
  while (Date.now() - start < 300000) {
    const s = await a2a('slots_entropy_status', { roundId });
    if (s.state === 'entropy_fulfilled') return s;
    if (s.error) throw new Error(s.error);
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 1.2, 30000);
  }
  throw new Error('Entropy timeout');
}

async function playRound(n) {
  console.log(`Round ${n}/${rounds}`);
  if (dryRun) {
    console.log('  [DRY RUN]\n');
    return { won: false, dryRun: true };
  }

  const commit = await a2a('slots_entropy_commit', { betAmount: betEth });
  if (commit.error) throw new Error(commit.error);

  process.stdout.write('  Waiting');
  await pollEntropy(commit.roundId);
  console.log(' ✅');

  const final = await a2a('slots_entropy_finalize', { roundId: commit.roundId });
  if (final.error) throw new Error(final.error);

  const { reels, won, multiplier, payout, agentBalance } = final;
  console.log(`  [ ${reels.join(' | ')} ]`);
  console.log(won ? `  ✅ WIN ${multiplier}x = ${payout} ETH` : `  ❌ MISS`);
  console.log(`  Balance: ${agentBalance} ETH\n`);

  return { won, payout: parseFloat(payout || '0') };
}

async function main() {
  let tw = 0, tp = 0, w = 0;
  for (let i = 1; i <= rounds; i++) {
    const r = await playRound(i);
    if (!r.dryRun) {
      tw += parseFloat(betEth);
      tp += r.payout;
      if (r.won) w++;
      if (i < rounds) await new Promise(x => setTimeout(x, 5000));
    }
  }
  if (!dryRun) {
    const p = tp - tw;
    console.log(`Rounds: ${rounds} | Wins: ${w}`);
    console.log(`Wagered: ${tw.toFixed(4)} | Payout: ${tp.toFixed(4)}`);
    console.log(p > 0 ? `✅ +${p.toFixed(4)} ETH` : `📉 ${p.toFixed(4)} ETH`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
