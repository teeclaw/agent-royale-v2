/**
 * Dice Game Plugin (BigInt/Wei)
 *
 * Roll over or under a target number (1-99).
 * Agent chooses risk/reward. Higher risk = higher payout.
 *
 * Payout formula: (100 / win_probability) × 0.95
 *
 * Examples:
 *   Roll over 50: 49% win chance → 1.94x payout
 *   Roll over 90: 9% win chance → 10.56x payout
 *   Roll under 10: 10% win chance → 9.50x payout
 *
 * RTP = 95% across all bet types, House Edge = 5%
 *
 * Fixes applied:
 *   [FIX #1] BigInt precision
 *   [FIX #2] Re-validate at reveal
 *   [FIX #6] Pending commits keyed by agent:game
 *   [FIX #7] Rate limit
 */

const BaseGame = require('./base-game');
const { toWei, toEth } = require('../wei');

const COMMIT_TIMEOUT = 5 * 60 * 1000;

class DiceGame extends BaseGame {
  get name() { return 'dice'; }
  get displayName() { return 'Agent Dice'; }
  get description() { return 'Roll over or under. You choose the risk and reward.'; }
  get rtp() { return 0.95; }
  get maxMultiplier() { return 96; } // Theoretical max (roll over 1 or under 99)
  get actions() { return ['commit', 'reveal']; }

  async handleAction(action, channel, params, ctx) {
    switch (action) {
      case 'commit': return this._commit(channel, params, ctx);
      case 'reveal': return await this._reveal(channel, params, ctx);
      default: throw new Error(`Unknown dice action: ${action}`);
    }
  }

  // ─── Step 1: Casino Commits ─────────────────────────────

  _commit(channel, params, ctx) {
    const { choice, target } = params;

    // Validate choice
    if (!['over', 'under'].includes(choice)) {
      throw new Error('Choice must be "over" or "under"');
    }

    // Validate target
    if (!Number.isInteger(target) || target < 1 || target > 99) {
      throw new Error('Target must be an integer between 1 and 99');
    }

    // Additional validation: edge cases
    if (choice === 'over' && target >= 99) {
      throw new Error('Cannot roll over 99 (impossible to win)');
    }
    if (choice === 'under' && target <= 1) {
      throw new Error('Cannot roll under 1 (impossible to win)');
    }

    const betWei = toWei(params.betAmount);

    // Calculate multiplier for bankroll check
    const multiplier = this._calculateMultiplier(choice, target);
    const roundedMultiplier = Math.ceil(multiplier);
    
    // Validate bet with actual max multiplier for this specific bet
    if (betWei <= 0n) throw new Error('Bet must be positive');
    if (channel.agentBalance < betWei) {
      throw new Error(`Insufficient balance: have ${toEth(channel.agentBalance)} ETH, need ${toEth(betWei)} ETH`);
    }

    const maxPayout = betWei * BigInt(roundedMultiplier);
    const safetyMargin = 2;
    if (maxPayout * BigInt(safetyMargin) > channel.casinoBalance) {
      const maxBetWei = channel.casinoBalance / BigInt(roundedMultiplier * safetyMargin);
      throw new Error(`Max bet: ${toEth(maxBetWei)} ETH (bankroll limit for ${multiplier.toFixed(2)}x multiplier)`);
    }

    const commitKey = `${channel.agent}:dice`;
    if (ctx.pendingCommits.has(commitKey)) {
      throw new Error('Already have a pending dice roll. Reveal or wait for timeout.');
    }

    const { seed, commitment } = ctx.commitReveal.commit();

    ctx.pendingCommits.set(commitKey, {
      seed,
      betWei,
      choice,
      target,
      game: 'dice',
      timestamp: Date.now(),
    });

    return {
      commitment,
      betAmount: toEth(betWei),
      choice,
      target,
      multiplier: multiplier.toFixed(2),
    };
  }

  // ─── Step 2: Reveal + Resolve ───────────────────────────

  async _reveal(channel, params, ctx) {
    const { agentSeed } = params;
    const commitKey = `${channel.agent}:dice`;
    const pending = ctx.pendingCommits.get(commitKey);

    if (!pending) throw new Error('No pending dice roll');
    if (Date.now() - pending.timestamp > COMMIT_TIMEOUT) {
      ctx.pendingCommits.delete(commitKey);
      throw new Error('Commitment expired');
    }

    const { seed: casinoSeed, betWei, choice, target } = pending;

    // [FIX #2] Re-validate
    if (channel.agentBalance < betWei) {
      ctx.pendingCommits.delete(commitKey);
      throw new Error(`Insufficient balance at reveal: have ${toEth(channel.agentBalance)}, need ${toEth(betWei)}`);
    }

    // Compute result (1-100)
    const { proof } = ctx.commitReveal.computeResult(casinoSeed, agentSeed, channel.nonce);
    const hashBuf = Buffer.from(proof.resultHash, 'hex');
    const roll = (hashBuf.readUInt32BE(0) % 100) + 1; // 1-100

    // Determine win
    const won = choice === 'over' ? roll > target : roll < target;

    // Calculate payout (BigInt math with precision)
    let payoutWei = 0n;
    let multiplier = 0;
    
    if (won) {
      multiplier = this._calculateMultiplier(choice, target);
      
      // Convert to BigInt: multiply by 10000, then divide to preserve precision
      // Example: 1.94x → 19400 / 10000 → betWei * 19400n / 10000n
      const multiplierScaled = BigInt(Math.round(multiplier * 10000));
      payoutWei = (betWei * multiplierScaled) / 10000n;
      
      // Cap to casino balance
      if (payoutWei > channel.casinoBalance + betWei) {
        payoutWei = channel.casinoBalance + betWei;
      }
    }

    // Update balances (BigInt)
    channel.agentBalance = channel.agentBalance - betWei + payoutWei;
    channel.casinoBalance = channel.casinoBalance + betWei - payoutWei;
    channel.nonce++;

    // Track stats
    this.recordRound(betWei, payoutWei, multiplier);

    channel.games.push({
      nonce: channel.nonce,
      game: 'dice',
      bet: toEth(betWei),
      choice,
      target,
      roll,
      won,
      multiplier: multiplier.toFixed(2),
      payout: toEth(payoutWei),
      timestamp: Date.now(),
    });

    const signature = await ctx.signState(
      channel.agent, channel.agentBalance, channel.casinoBalance, channel.nonce
    );

    ctx.pendingCommits.delete(commitKey);

    return {
      choice,
      target,
      roll,
      won,
      multiplier: multiplier.toFixed(2),
      payout: toEth(payoutWei),
      agentBalance: toEth(channel.agentBalance),
      casinoBalance: toEth(channel.casinoBalance),
      nonce: channel.nonce,
      signature,
      proof: { casinoSeed, agentSeed, resultHash: proof.resultHash },
    };
  }

  // ─── Game Math ──────────────────────────────────────────

  /**
   * Calculate payout multiplier based on choice and target.
   * Formula: (100 / win_probability) × 0.95
   */
  _calculateMultiplier(choice, target) {
    let winProbability;
    
    if (choice === 'over') {
      // Roll over target: winning rolls are (target+1) to 100
      winProbability = (100 - target) / 100;
    } else {
      // Roll under target: winning rolls are 1 to (target-1)
      winProbability = (target - 1) / 100;
    }
    
    // Apply 95% RTP
    return (1 / winProbability) * 0.95;
  }

  // ─── Info ───────────────────────────────────────────────

  getInfo() {
    return {
      ...super.getInfo(),
      choices: ['over', 'under'],
      targetRange: '1-99',
      minBet: '0.0001 ETH',
      examples: [
        { choice: 'over', target: 50, winChance: '49%', multiplier: '1.94x' },
        { choice: 'over', target: 90, winChance: '9%', multiplier: '10.56x' },
        { choice: 'under', target: 10, winChance: '10%', multiplier: '9.50x' },
        { choice: 'under', target: 50, winChance: '49%', multiplier: '1.94x' },
      ],
    };
  }
}

module.exports = DiceGame;
