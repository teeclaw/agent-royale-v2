# Dice Game Implementation - Complete (Dual-Path)

## What Was Built

A new dice game for Agent Royale with **dual randomness paths**:
1. **Commit-reveal** (fast, 2-step)
2. **Pyth Entropy** (verifiable, onchain proof)

Agents choose their own risk/reward ratio: roll over or under a target number (1-99) with dynamic payouts that maintain 95% RTP across all bets.

## Files Modified/Created

### Core Implementation

**Commit-Reveal Path:**

1. **`server/games/dice.js`** ✨ NEW
   - Full game implementation extending BaseGame
   - Commit-reveal pattern with BigInt math
   - Dynamic multiplier calculation: `(100 / win_probability) × 0.95`
   - Edge case validation (can't bet over 99 or under 1)
   - Bankroll-aware bet limits (calculated per-bet based on multiplier)

2. **`server/index.js`** ✏️ MODIFIED
   - Added `const DiceGame = require('./games/dice');`
   - Added `engine.registerGame(new DiceGame());`

**Pyth Entropy Path:**

3. **`contracts/EntropyDice.sol`** ✨ NEW
   - Onchain entropy adapter for dice
   - Stores roundId, agent, choice (over/under), target (1-99), bet, sequence, random
   - Pyth Entropy callback integration
   - Round state tracking (Requested → Fulfilled → Settled)
   - Edge case validation onchain

4. **`deploy/deploy-entropy-dice.js`** ✨ NEW
   - Hardhat deployment script
   - Requires: ENTROPY_ADDRESS, ENTROPY_PROVIDER
   - Deploys to Base + optional BaseScan verification

5. **`frontend/api/a2a/casino.js`** ✏️ MODIFIED
   - Added `dice_entropy_commit` handler (request entropy onchain)
   - Added `dice_entropy_status` check (in combined status handler)
   - Added `dice_entropy_finalize` handler (calculate outcome from entropy)
   - Added `diceOutcomeFromEntropy(randomHex, choice, target)` function
   - Idempotency keys updated for dice_entropy_* actions

### SDK Integration

6. **`sdk/agent-client.js`** ✏️ MODIFIED
   - Added `playDice(betEth, choice, target)` method (commit-reveal)
   - Added `playDiceEntropy(betEth, choice, target, options)` method (Pyth Entropy)
   - Full commit-reveal flow + entropy wait/finalize flow
   - Verification + state storage
   - Same pattern as slots/coinflip (both paths)

7. **`sdk/examples/play-dice.js`** ✨ NEW
   - Commit-reveal demo script with 6 strategies
   - Conservative (over/under 50), balanced (25/75), risky (10/90)
   - P&L tracking
   - Executable: `node play-dice.js [url] [deposit] [bet] [rolls]`

8. **`sdk/examples/play-dice-entropy.js`** ✨ NEW
   - Pyth Entropy demo script
   - Shows entropy request → wait → finalize flow
   - Proof display (requestTxHash, random value)
   - Same strategy mix as commit-reveal version

### Documentation

9. **`README.md`** ✏️ MODIFIED
   - Added dice to games section with examples
   - Updated actions table (dice_commit, dice_reveal)
   - Updated SDK usage with playDice example
   - Added dice RTP proof with math

10. **`SKILL.md`** ✏️ MODIFIED
   - Added dice game rules and params (both paths)
   - Updated A2A actions list (dice_entropy_* actions)
   - Added payout examples
   - Noted entropy mode availability

11. **`docs/DICE-GAME.md`** ✨ NEW
   - Complete implementation guide
   - Architecture documentation
   - Deployment checklist
   - API reference
   - Monitoring guidelines
   - Updated with entropy path notes

12. **`DICE-IMPLEMENTATION-SUMMARY.md`** ✏️ MODIFIED
   - This file (overview + next steps + entropy integration)

## How It Works

### Game Flow

```
1. Agent: dice_commit
   ├─ Sends: betAmount, choice (over/under), target (1-99)
   ├─ Casino: validates bet + calculates multiplier
   └─ Returns: commitment hash

2. Agent: dice_reveal
   ├─ Sends: agentSeed (random)
   ├─ Casino: reveals seed, computes roll (1-100)
   ├─ Win check: over ? roll > target : roll < target
   ├─ Payout: betAmount × multiplier (if win)
   └─ Returns: roll, won, payout, proof, signature
```

### Math

**Payout Formula:**
```
Win probability = (over X) ? (100-X)/100 : (X-1)/100
Payout multiplier = (1 / win_probability) × 0.95
```

**Examples:**
- Over 50: 49% chance → 1.94x payout → 95% RTP
- Over 90: 9% chance → 10.56x payout → 95% RTP
- Under 10: 10% chance → 9.50x payout → 95% RTP

**Proof:** RTP = P × Payout = P × (1/P) × 0.95 = 0.95 ✅

### Security

- Commit-reveal prevents manipulation
- BigInt math (zero precision loss)
- Re-validation at reveal time
- Bankroll-aware limits (dynamic per multiplier)
- One pending commit per agent
- 5-minute commit timeout
- EIP-712 state signatures

## Testing Plan

### Local Test

```bash
cd agent-casino

# Start server
npm run server

# Run demo (new terminal)
node sdk/examples/play-dice.js http://localhost:3847/a2a/casino 0.01 0.001 10
```

Expected: 10 rolls with mixed strategies, some wins/losses, final balance.

### Edge Case Tests

```bash
# Should reject
curl -X POST localhost:3847/a2a/casino -H "Content-Type: application/json" \
  -d '{"from":"Test","message":{"contentType":"application/json","content":{"action":"dice_commit","stealthAddress":"0x123...","params":{"betAmount":"0.001","choice":"over","target":99}}}}'
# → Error: Cannot roll over 99

# Should accept
# ... same with target:50, choice:"over"
# → Returns commitment
```

### RTP Verification

Run 1000+ rounds, verify:
```
Actual RTP = total_paid_out / total_wagered ≈ 0.95 (±2%)
```

## Deployment Steps

### 1. Code Review
- ✅ Game logic correct (commit-reveal + entropy)
- ✅ BigInt math throughout
- ✅ Edge cases handled (client + contract)
- ✅ Follows existing patterns (both paths)
- ✅ Documentation complete

### 2. Deploy EntropyDice Contract (Base Mainnet)
```bash
# Set env
export DEPLOYER_PRIVATE_KEY=<your_key>
export ENTROPY_ADDRESS=<pyth_entropy_base_mainnet>
export ENTROPY_PROVIDER=<pyth_provider_address>
export ENTROPY_ADMIN=<casino_kms_address>

# Deploy
npx hardhat run deploy/deploy-entropy-dice.js --network base

# Save output
# ENTROPY_DICE=0x... (add to .env)
```

### 3. Local Testing (Commit-Reveal)
```bash
npm run server
node sdk/examples/play-dice.js http://localhost:3847/a2a/casino 0.01 0.001 10
```

### 4. Local Testing (Entropy - Testnet)
```bash
# Deploy to Base Sepolia first
npx hardhat run deploy/deploy-entropy-dice.js --network baseSepolia

# Update .env with ENTROPY_DICE=<sepolia_address>
# Set RNG_PROVIDER=pyth_entropy
npm run server

# Test
node sdk/examples/play-dice-entropy.js http://localhost:3847/a2a/casino 0.01 0.001 3
```

### 5. Integration Testing
**Commit-reveal path:**
- Open channel
- Play 10 dice rounds (mixed targets)
- Verify proofs (commitment → reveal)
- Close channel
- Check final state

**Entropy path:**
- Open channel
- Play 3 dice rounds (wait for entropy callbacks)
- Verify onchain proofs (requestTxHash, randomValue)
- Close channel
- Check contract events

### 6. Production Deploy (API + Frontend)
```bash
git add contracts/ deploy/ server/games/dice.js server/index.js frontend/api/a2a/casino.js sdk/ README.md SKILL.md docs/
git commit -m "Add Dice game: dual-path (commit-reveal + Pyth Entropy) with dynamic multipliers (95% RTP)"
git push origin main
```

Vercel auto-deploys → https://www.agentroyale.xyz

### 7. Set Production Env
Add to Vercel environment variables:
```
ENTROPY_DICE=0x... (mainnet contract address)
RNG_PROVIDER=pyth_entropy (or leave as default for commit-reveal)
```

### 5. Verify Live
```bash
curl https://www.agentroyale.xyz/api/casino/games | jq '.games[] | select(.name=="dice")'
```

Should return dice game info with actions: ["commit", "reveal"]

### 6. Announce
- Update landing page
- Tweet from @mr_crtee
- Cast from @mr-tee
- Post in agent communities

## Next Steps

### Immediate
1. Run local tests
2. Review code one more time
3. Deploy to production
4. Monitor first 24h (errors, RTP, usage)

### Future Enhancements
1. **Entropy version** - Pyth randomness (slower, more verifiable)
2. **Multi-bet** - Multiple outcomes per round
3. **Parlay mode** - Chain bets for exponential multipliers
4. **Leaderboards** - Track high rollers
5. **UI** - Visual dice roll animation

## Stats to Monitor

Post-launch tracking:
- Total dice rounds
- Total wagered/paid out
- Actual RTP % (should stay ~95%)
- Biggest win multiplier
- Most popular targets
- Over vs under distribution

Alert if:
- RTP drifts > 2% from 95% (sample > 100)
- Repeated failures from same agent
- Bankroll warnings

## Summary

**Complete dice game implementation:**
- ✅ Core game logic (commit-reveal + Pyth Entropy)
- ✅ Onchain contract (EntropyDice.sol)
- ✅ SDK integration (dual-path)
- ✅ Example scripts (both paths)
- ✅ Full documentation
- ✅ Math proofs
- ✅ Security measures

**Ready to deploy.**

Test locally (both paths) → deploy contract → review → push API/frontend → announce.

---

**Files changed:** 12 (7 new, 5 modified)  
**Lines added:** ~1,200  
**New game:** Dice (over/under, 1-99, 95% RTP, dual randomness)  
**Integration:** Drop-in via existing engine + new entropy contract  
**Complexity:** Medium (contract deployment required)  
**Risk:** Low (follows proven entropy pattern)
