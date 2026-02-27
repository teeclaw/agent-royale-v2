#!/usr/bin/env node
/**
 * Play Slots (Commit-Reveal - Fast path)
 * Usage: node scripts/play-slots-commit-reveal.mjs --stealth 0x... --bet 0.001 --rounds 5
 */
import crypto from 'crypto';
const A2A_API = process.env.CASINO_API_URL || 'https://www.agentroyale.xyz/api/a2a/casino';

const args = process.argv.slice(2);
function getArg(name, required = false) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) {
    if (required) throw new Error(`Missing: --${name}`);
    return null;
  }
  return args[index + 1];
}

const stealthAddress = getArg('stealth', true);
const betEth = getArg('bet', true);
const rounds = parseInt(getArg('rounds') || '1');
const dryRun = args.includes('--dry-run');

if (!stealthAddress?.match(/^0x[a-fA-F0-9]{40}$/)) {
  console.error('Error: Invalid stealth address');
  process.exit(1);
}

if (isNaN(parseFloat(betEth)) || parseFloat(betEth) < 0.0001) {
  console.error('Error: Invalid bet (min 0.0001 ETH)');
  process.exit(1);
}

console.log('🎰 SLOTS (Commit-Reveal)');
console.log(`Bet: ${betEth} ETH × ${rounds} rounds`);
console.log();

async function a2aRequest(action, params) {
  const body = JSON.stringify({
    version: '0.3.0',
    from: { name: 'SlotsScript' },
    message: {
      contentType: 'application/json',
      content: { action, stealthAddress, params }
    }
  });

  const response = await fetch(A2A_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function randomSeed() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

function verifyCommitment(commitment, seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return commitment.toLowerCase() === `0x${hash}`.toLowerCase();
}

async function playRound(roundNum) {
  console.log(`Round ${roundNum}/${rounds}`);

  if (dryRun) {
    console.log('  [DRY RUN]');
    return { won: false, dryRun: true };
  }

  // Commit
  const commitResponse = await a2aRequest('slots_commit', { betAmount: betEth });
  if (commitResponse.error) throw new Error(commitResponse.error);

  const { commitment } = commitResponse;

  // Reveal
  const agentSeed = randomSeed();
  const revealResponse = await a2aRequest('slots_reveal', { agentSeed });
  if (revealResponse.error) throw new Error(revealResponse.error);

  const { reels, won, multiplier, payout, casinoSeed, agentBalance } = revealResponse;

  // Verify
  if (!verifyCommitment(commitment, casinoSeed)) {
    console.error('❌ SECURITY: Commitment mismatch!');
    process.exit(1);
  }

  console.log(`  [ ${reels.join(' | ')} ]`);
  if (won) {
    console.log(`  ✅ WIN ${multiplier}x = ${payout} ETH`);
  } else {
    console.log(`  ❌ MISS`);
  }
  console.log(`  Balance: ${agentBalance} ETH`);
  console.log();

  return { won, payout: parseFloat(payout || '0') };
}

async function main() {
  let totalWagered = 0;
  let totalPayout = 0;
  let wins = 0;

  for (let i = 1; i <= rounds; i++) {
    const result = await playRound(i);
    if (!result.dryRun) {
      totalWagered += parseFloat(betEth);
      totalPayout += result.payout;
      if (result.won) wins++;
      if (i < rounds) await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!dryRun) {
    console.log('═══════════════════════════════════════════════');
    console.log(`Rounds: ${rounds} | Wins: ${wins}`);
    console.log(`Wagered: ${totalWagered.toFixed(4)} ETH`);
    console.log(`Payout: ${totalPayout.toFixed(4)} ETH`);
    const profit = totalPayout - totalWagered;
    console.log(profit > 0 ? `✅ +${profit.toFixed(4)} ETH` : `📉 ${profit.toFixed(4)} ETH`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
