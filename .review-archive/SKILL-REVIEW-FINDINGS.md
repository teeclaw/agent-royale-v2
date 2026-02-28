# SKILL.md Review - Critical Findings & Improvements

**Review Date:** 2026-02-26  
**Reviewer:** Mr. Tee  
**Criteria:**
1. ✅ Easy agent setup
2. ⚠️ Smooth gameplay (gaps found)
3. ❌ Owner safety/confidence (needs strengthening)
4. ❌ Contingency plans (inadequate)

---

## 1. Easy Agent Setup ✅ (Grade: B+)

### What Works
- ✅ Agent ID Seed warning at top (impossible to miss)
- ✅ Quick Start has 4 clear steps
- ✅ Step 0 conversation templates (game selection)
- ✅ Prerequisites clearly listed
- ✅ Scripts listed in Helper Scripts section

### Gaps Found

#### GAP 1.1: No "First Time Setup" Checklist
**Problem:** Agent doesn't know what order to do things.

**Fix Needed:**
```markdown
## First Time Setup (5 minutes)

**Before your first session, complete these 4 tasks:**

☐ 1. Generate Agent ID Seed
   ```bash
   AGENT_ID_SEED=0x$(openssl rand -hex 32)
   echo "AGENT_ID_SEED=$AGENT_ID_SEED" >> ~/.bashrc
   source ~/.bashrc
   ```

☐ 2. Fund wallet with ETH on Base
   - Get Base ETH from bridge or exchange
   - Minimum: 0.1 ETH (covers deposit + gas)
   - Check balance: `node scripts/check-balance.mjs YOUR_ADDRESS`

☐ 3. Clone scripts repository
   ```bash
   git clone https://github.com/teeclaw/agent-royale-v2
   cd agent-royale-v2
   npm install
   ```

☐ 4. Test connection
   ```bash
   curl https://www.agentroyale.xyz/api/health
   # Should return: {"status":"ok",...}
   ```

**✅ Ready! Proceed to Quick Start Step 0.**
```

#### GAP 1.2: Agent ID Seed Generation Not Explained
**Problem:** "Generate once, save forever" but doesn't explain HOW for non-technical users.

**Fix Needed:** Add simple copy-paste commands for different platforms.

---

## 2. Smooth Gameplay ⚠️ (Grade: C+)

### What Works
- ✅ Game descriptions clear
- ✅ Response examples provided
- ✅ Common Errors table comprehensive
- ✅ Troubleshooting section exists

### Gaps Found

#### GAP 2.1: No "Playing Your First Game" Tutorial
**Problem:** Agent jumps from setup to complex scripts without a walkthrough.

**Fix Needed:**
```markdown
## Your First Game (Complete Example)

Let's play 5 rounds of Dice to learn the flow.

### Step 1: Ask Your Human

**You:** "Ready to try Agent Royale? I'll walk us through a test session."
**You:** "Game: Dice (roll over/under)"
**You:** "Bet: 0.001 ETH per round"
**You:** "Rounds: 5"
**You:** "Total deposit needed: 0.0075 ETH (5 × 0.001 × 1.5 buffer)"
**You:** "Sound good? (yes/no)"

**Human:** "yes"

### Step 2: Open Channel

```bash
# Using helper script:
node scripts/open-channel-onchain.mjs 0.0075 $YOUR_PRIVATE_KEY

# Wait for confirmation...
# ✅ Channel opened! Tx: 0xabc123...
# Stealth address: 0x4567...
```

**Copy the stealth address** - you'll need it for games.

### Step 3: Play Dice

```bash
node scripts/play-dice-commit-reveal.mjs \
  --stealth 0x4567... \
  --bet 0.001 \
  --choice over \
  --target 50 \
  --rounds 5
```

**Watch the output:**
- Round 1: Roll 72 (over 50) → WIN 1.94x
- Round 2: Roll 34 (over 50) → LOSS
- ...
- Summary: 3 wins, 2 losses, +0.0018 ETH

### Step 4: Check Result

**You:** "Session complete! Here's what happened:"
**You:** "Rounds: 5"
**You:** "Wagered: 0.005 ETH"
**You:** "Won: 0.0068 ETH"
**You:** "Profit: +0.0018 ETH (+36%)"
**You:** "Close channel and cash out? (yes/no)"

**Human:** "yes"

### Step 5: Close Channel

```bash
# Get final state:
curl -X POST https://www.agentroyale.xyz/api/a2a/casino \
  -d '{"action":"close_channel","stealthAddress":"0x4567..."}' > final.json

# Close onchain:
cat final.json | node scripts/close-channel-onchain.mjs $YOUR_PRIVATE_KEY

# ✅ Channel closed! Funds sent to your wallet.
```

**You:** "Done! Your 0.0083 ETH is back in your wallet."

---

**That's one complete session. Now you know the flow!**
```

#### GAP 2.2: Session Index Tracking Not Explained
**Problem:** Doc says "track session index (0, 1, 2, ...)" but doesn't explain HOW.

**Fix Needed:**
```markdown
### Tracking Session Index

**Why track?** You need the index to recover your channel after a crash.

**Simple method (text file):**
```bash
# After each session, log it:
echo "$(date): Session 0, stealth 0x1234..." >> ~/casino-sessions.log
echo "$(date): Session 1, stealth 0xabcd..." >> ~/casino-sessions.log
```

**Better method (JSON):**
```bash
# Create sessions.json:
echo '[]' > ~/casino-sessions.json

# After opening channel:
jq '. += [{"index":0, "stealth":"0x1234...", "date":"2026-02-26", "deposit":"0.01"}]' \
  ~/casino-sessions.json > tmp.json && mv tmp.json ~/casino-sessions.json
```

**Best method (environment):**
```bash
# Track current index in env:
export CASINO_SESSION_INDEX=0

# Increment after each session:
export CASINO_SESSION_INDEX=$((CASINO_SESSION_INDEX + 1))
```
```

#### GAP 2.3: Balance Monitoring During Play Missing
**Problem:** Scripts play all rounds but don't warn when balance gets low.

**Fix Needed:** Add to "During Play" guidelines:
```markdown
**Balance Monitoring (Critical):**

After each round, check if balance < (bet × 3):

```javascript
if (agentBalance < betAmount * 3) {
  console.log(`⚠️ LOW BALANCE WARNING:`);
  console.log(`   Current: ${agentBalance} ETH`);
  console.log(`   Next bet: ${betAmount} ETH`);
  console.log(`   Rounds left: ~${Math.floor(agentBalance / betAmount)}`);
  
  // Ask human:
  const choice = await ask("Continue? (yes/no): ");
  if (choice !== "yes") {
    console.log("Stopping. Closing channel...");
    return closeChannel();
  }
}
```
```

---

## 3. Owner Safety/Confidence ❌ (Grade: D)

### What Works
- ✅ Agent Communication Guidelines exist
- ✅ "Ask before" checkpoints listed
- ✅ No pressure on risky bets

### Critical Gaps

#### GAP 3.1: No Loss Limits / Stop Loss
**CRITICAL:** Agent can lose all funds if on a losing streak.

**Fix Needed:**
```markdown
## Owner Safety Controls (MANDATORY)

### Stop Loss (Automatic Circuit Breaker)

**Before opening channel, set limits with your human:**

```javascript
const sessionLimits = {
  maxLoss: 0.005,        // Stop if down -0.005 ETH
  maxRounds: 20,         // Stop after 20 rounds regardless
  minBalance: 0.001,     // Stop if balance falls below this
  askEveryNRounds: 5     // Re-confirm every 5 rounds
};
```

**During play, enforce limits:**

```javascript
// After each round:
const profit = currentBalance - initialDeposit;

if (profit <= -sessionLimits.maxLoss) {
  IMMEDIATE_STOP("⛔ STOP LOSS HIT");
  console.log(`Lost ${Math.abs(profit)} ETH (limit: ${sessionLimits.maxLoss})`);
  console.log("Closing channel to protect remaining funds...");
  return closeChannel();
}

if (roundsPlayed >= sessionLimits.maxRounds) {
  IMMEDIATE_STOP("⏱️ ROUND LIMIT HIT");
  return closeChannel();
}

if (currentBalance < sessionLimits.minBalance) {
  IMMEDIATE_STOP("⚠️ MINIMUM BALANCE HIT");
  return closeChannel();
}

if (roundsPlayed % sessionLimits.askEveryNRounds === 0) {
  const choice = await ask(`Played ${roundsPlayed} rounds. Continue? (yes/no): `);
  if (choice !== "yes") return closeChannel();
}
```

**Example output:**
```
Round 8: LOSS (-0.001 ETH)
⛔ STOP LOSS HIT
Lost 0.005 ETH (limit: 0.005 ETH)
Closing channel to protect remaining 0.005 ETH...
✅ Channel closed. Funds saved.
```

### Why This Matters

**Without stop loss:**
- Agent plays until balance = 0
- Owner loses entire deposit
- No circuit breaker

**With stop loss:**
- Loses capped at agreed amount
- Owner stays in control
- Can't lose more than expected
```

#### GAP 3.2: No Pre-Flight Safety Checklist
**Problem:** No final check before opening channel.

**Fix Needed:**
```markdown
### Pre-Flight Safety Checklist

**Before opening any channel, agent MUST confirm:**

```
Agent Safety Checklist:

☐ Human explicitly approved:
   - Game: ______
   - Bet per round: ______ ETH
   - Number of rounds: ______
   - Stop loss: ______ ETH
   - Total at risk: ______ ETH

☐ Agent ID Seed is saved: [ ]

☐ Session index logged: [ ]

☐ Wallet has enough ETH:
   - Needed: ______ ETH (deposit + gas)
   - Available: ______ ETH
   - Buffer: ______ ETH

☐ Human understands:
   - This is gambling (can lose all deposited ETH)
   - Stop loss will protect remaining funds
   - They can ask to stop anytime
All confirmed: ✅

Ready to open channel.
```
```

#### GAP 3.3: No Session Summary Template
**Problem:** Agent shows profit/loss but doesn't contextualize risk vs reward.

**Fix Needed:**
```markdown
### Session Summary Template (Post-Game)

**After closing channel, show this summary:**

```
═══════════════════════════════════════════════
              SESSION COMPLETE
═══════════════════════════════════════════════

Game: Dice (over/under)
Randomness: Commit-Reveal (fast)

ROUNDS:
  Played: 15
  Wins: 8 (53%)
  Losses: 7 (47%)

MONEY:
  Deposited: 0.01 ETH
  Wagered: 0.015 ETH (15 rounds × 0.001)
  Won: 0.0146 ETH
  Final balance: 0.0096 ETH
  
  Profit/Loss: -0.0004 ETH (-4%)

SAFETY:
  Stop loss: -0.005 ETH (not hit) ✅
  Min balance: 0.001 ETH (not hit) ✅
  Max rounds: 20 (stopped at 15) ✅

TIME:
  Duration: 3 minutes
  Avg per round: 12 seconds

VERIFICATION:
  All commitments verified: ✅
  All signatures valid: ✅
  Conservation invariant held: ✅

Next steps:
  - Funds returned to your wallet
  - Session logged: Index 0
  - Play again? (yes/no)
```
```

---

## 4. Contingency Plans ❌ (Grade: F)

### What Works
- ✅ Dispute channel script exists
- ✅ Recover stealth script exists
- ✅ Common Errors table

### Critical Gaps

#### GAP 4.1: No "What If" Emergency Scenarios
**CRITICAL:** Agent doesn't know what to do when things go wrong.

**Fix Needed:**
```markdown
## Emergency Scenarios (What To Do When...)

### Scenario 1: Agent Crashes Mid-Session

**Symptoms:**
- Agent process died
- No access to stealth private key
- Channel still open onchain

**Recovery Steps:**

1. **Recover stealth address:**
   ```bash
   node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 0
   # Returns: Stealth Address + Private Key
   ```

2. **Check channel state:**
   ```bash
   node scripts/verify-channel.mjs 0xYOUR_STEALTH_ADDRESS
   ```

3. **If channel is Open:**
   - Get final state from A2A (might fail if stale)
   - If A2A works: close cooperatively
   - If A2A fails: start dispute with last known state

4. **Close channel:**
   ```bash
   # Cooperative (if A2A responds):
   curl -X POST https://www.agentroyale.xyz/api/a2a/casino \
     -d '{"action":"close_channel","stealthAddress":"0x..."}' > state.json
   cat state.json | node scripts/close-channel-onchain.mjs $STEALTH_PRIVATE_KEY

   # Dispute (if A2A is down):
   node scripts/dispute-channel.mjs $STEALTH_PRIVATE_KEY latest-state.json
   ```

5. **Verify funds returned:**
   ```bash
   node scripts/check-balance.mjs YOUR_WALLET_ADDRESS
   ```

### Scenario 2: Casino API Is Down

**Symptoms:**
- `https://www.agentroyale.xyz/api/health` returns error
- A2A endpoint not responding
- Can't close channel cooperatively

**What To Do:**

**Immediate (0-24h):**
1. **Don't panic** - Your funds are safe onchain
2. **Wait 1 hour** - Might be temporary downtime
3. **Check status:**
   ```bash
   node scripts/verify-channel.mjs YOUR_STEALTH_ADDRESS
   ```
4. **Monitor:** Check every 6 hours

**If down >24h:**
1. **Prepare dispute:**
   - Find latest signed state in `./casino-states/`
   - Verify it's the highest nonce you have

2. **Start dispute:**
   ```bash
   node scripts/dispute-channel.mjs $STEALTH_PRIVATE_KEY latest-state.json
   ```

3. **Wait 24h challenge period**

4. **Resolve dispute:**
   ```bash
   # After 24h, call resolveChallenge (coming soon)
   # For now: manual contract call on BaseScan
   ```

### Scenario 3: Lost Agent ID Seed

**Symptoms:**
- Agent crashed
- Can't find Agent ID Seed anywhere
- Channel is open with funds

**Hard Truth:**
❌ **Without Agent ID Seed, recovery is impossible.**

**What You Can Try (Low Success):**

1. **Search everywhere:**
   ```bash
   # Check env vars:
   printenv | grep AGENT_ID_SEED
   
   # Check bash history:
   history | grep AGENT_ID_SEED
   
   # Check files:
   grep -r "AGENT_ID_SEED" ~/
   
   # Check password manager
   # Check backup systems
   ```

2. **If you have old stealth private keys:**
   - You can close THAT specific channel
   - But can't generate new sessions

3. **If truly lost:**
   - Funds in open channel = locked forever
   - **Prevention:** Always backup Agent ID Seed in 2+ places

### Scenario 4: Channel State Mismatch

**Symptoms:**
- API shows different balance than you expect
- Nonce is lower than your records
- Signature verification fails

**What To Do:**

1. **Don't play more rounds** - Stop immediately

2. **Verify onchain state:**
   ```bash
   node scripts/verify-channel.mjs YOUR_STEALTH_ADDRESS
   # Compare with your local records
   ```

3. **Check conservation invariant:**
   ```javascript
   agentDeposit + casinoDeposit === agentBalance + casinoBalance
   // Should always be true
   ```

4. **If invariant broken:**
   - ⛔ DO NOT CLOSE CHANNEL
   - 📸 Screenshot everything
   - 💾 Save all signed states
   - 📞 Contact support immediately with evidence

5. **If invariant holds but nonces differ:**
   - Casino state might be fresher (you have old data)
   - Check your `./casino-states/` backups
   - Use highest nonce state for dispute if needed

### Scenario 5: Commitment Verification Fails

**Symptoms:**
- Script reports: "SECURITY ERROR: Commitment mismatch"
- SHA-256(casinoSeed) ≠ commitment

**What This Means:**
🚨 **Casino is cheating** (or there's a bug)

**What To Do:**

1. **STOP IMMEDIATELY** - Do not play more rounds

2. **Save evidence:**
   ```bash
   # Evidence is auto-saved to:
   ./casino-states/evidence/commitment_mismatch-<timestamp>.json
   ```

3. **Check channel state:**
   ```bash
   node scripts/verify-channel.mjs YOUR_STEALTH_ADDRESS
   ```

4. **Do NOT close cooperatively:**
   - Don't trust casino signature
   - Use your last VERIFIED state

5. **Start dispute with last good state:**
   ```bash
   # Find last verified state before the cheat:
   ls -lt ./casino-states/verified/
   
   # Dispute with that state:
   node scripts/dispute-channel.mjs $KEY verified-state-42.json
   ```

6. **Report publicly:**
   - Tweet the evidence
   - Share on Discord/Telegram
   - File GitHub issue
   - This protects other users

### Scenario 6: Ran Out Of Gas Mid-Transaction

**Symptoms:**
- Transaction failed with "out of gas"
- Channel still open
- Funds still in channel

**What To Do:**

1. **Check wallet balance:**
   ```bash
   node scripts/check-balance.mjs YOUR_WALLET_ADDRESS
   # Need at least 0.001 ETH for gas
   ```

2. **Add more ETH to wallet:**
   - Bridge from L1
   - Buy on exchange
   - Ask human for more funds

3. **Retry transaction:**
   ```bash
   # Same command, higher gas:
   # (Scripts auto-estimate, but you can increase if needed)
   ```

4. **If urgent and no ETH:**
   - Channel funds are safe
   - Can close later when you have gas
   - Or start dispute (also needs gas)
```

#### GAP 4.2: No State Backup Verification
**Problem:** Doc says "store signed states" but doesn't explain how or verify they're being saved.

**Fix Needed:**
```markdown
### Verifying State Backups

**After each game round, check backups exist:**

```bash
# SDK auto-saves to:
ls -lh ./casino-states/

# You should see:
# - session-<timestamp>.json (session start)
# - round-<nonce>.json (after each game)
# - final-<timestamp>.json (channel close)
```

**Manual backup (recommended):**

```bash
# After important rounds:
cp ./casino-states/round-42.json ~/backups/casino-round-42-$(date +%Y%m%d).json

# Verify backup works:
cat ~/backups/casino-round-42-*.json | jq .
```

**Backup checklist:**
- ✅ Latest state backed up
- ✅ Readable JSON (not corrupted)
- ✅ Contains: agentBalance, casinoBalance, nonce, signature
- ✅ Stored in 2+ locations (local + cloud)
```

---

## Recommendations (Priority Order)

### 🔴 CRITICAL (Fix Immediately)

1. **Add Stop Loss System**
   - Gap 3.1
   - Owner can lose everything without this
   - Implementation: 50 lines of code
   - Where: Agent Communication Guidelines section

2. **Add Emergency Scenarios**
   - Gap 4.1
   - Agents freeze when things go wrong
   - Implementation: Copy "What If" section above
   - Where: New section after Troubleshooting

3. **Add Pre-Flight Safety Checklist**
   - Gap 3.2
   - Prevents accidental large losses
   - Implementation: Template + confirmation flow
   - Where: Before Step 1 in Quick Start

### 🟡 HIGH (Fix This Week)

4. **Add "First Time Setup" Guide**
   - Gap 1.1
   - Makes onboarding smoother
   - Implementation: 4-step checklist
   - Where: Before Quick Start

5. **Add "Your First Game" Tutorial**
   - Gap 2.1
   - Concrete example builds confidence
   - Implementation: Complete walkthrough
   - Where: After Quick Start

6. **Add Session Index Tracking Guide**
   - Gap 2.2
   - Critical for recovery
   - Implementation: 3 methods (simple → advanced)
   - Where: After Agent ID Seed warning

### 🟢 MEDIUM (Fix This Month)

7. **Add Balance Monitoring Code**
   - Gap 2.3
   - Prevents surprise zero balance
   - Implementation: Add to game scripts
   - Where: Helper Scripts section

8. **Add State Backup Verification**
   - Gap 4.2
   - Ensures recovery is possible
   - Implementation: Checklist + verification commands
   - Where: Security & Recovery section

9. **Add Session Summary Template**
   - Gap 3.3
   - Builds trust through transparency
   - Implementation: Formatted output template
   - Where: Step 3 (Close Channel)

---

## Suggested Structure (After Fixes)

```
1. ⚠️ CRITICAL: Save Your Agent ID Seed (unchanged)

2. First Time Setup (NEW)
   - Generate Agent ID Seed
   - Fund wallet
   - Clone repo
   - Test connection

3. Quick Start
   - Step 0: Confirm game + limits
   - Pre-Flight Safety Checklist (NEW)
   - Step 1: Open channel
   - Step 2: Play (with balance monitoring)
   - Step 3: Close (with summary template)

4. Your First Game Tutorial (NEW)
   - Complete walkthrough
   - Copy-paste commands
   - Expected output

5. Session Index Tracking (NEW)
   - Why track
   - How to track (3 methods)

6. How It Works (unchanged)

7. Manual Channel Management (unchanged)

8. Games (unchanged)

9. Response Examples (unchanged)

10. Common Errors (unchanged)

11. Troubleshooting (unchanged)

12. Emergency Scenarios (NEW - CRITICAL)
    - Agent crash
    - API down
    - Lost seed
    - State mismatch
    - Commitment fail
    - Out of gas

13. Helper Scripts (unchanged)

14. Security & Recovery
    - Owner Safety Controls (NEW - stop loss)
    - Agent ID Seed (unchanged)
    - State backups (add verification)

15. Do/Don't (unchanged)

16. Limitations (unchanged)

17. Contracts (unchanged)

18. API Reference (unchanged)

19. Agent Communication Guidelines
    - Add stop loss enforcement
    - Add session summary template

20. Operator (unchanged)
```

---

## Implementation Plan

**Phase 1 (Today - Critical):**
1. Add Stop Loss System (Gap 3.1)
2. Add Emergency Scenarios (Gap 4.1)
3. Add Pre-Flight Checklist (Gap 3.2)

**Phase 2 (This Week):**
4. Add First Time Setup (Gap 1.1)
5. Add First Game Tutorial (Gap 2.1)
6. Add Session Index Tracking (Gap 2.2)

**Phase 3 (This Month):**
7-9. Remaining improvements

**Testing:**
- Run through First Game Tutorial yourself
- Verify all code examples work
- Test emergency recovery scenarios
- Get owner feedback on safety features

---

## Summary

**Current State:**
- Setup: B+ (good but could be smoother)
- Gameplay: C+ (works but gaps in guidance)
- Owner Safety: D (needs critical fixes)
- Contingency: F (inadequate)

**After Fixes:**
- Setup: A (comprehensive onboarding)
- Gameplay: A- (smooth with monitoring)
- Owner Safety: A (stop loss + checklists)
- Contingency: B+ (covers all scenarios)

**Critical Missing Pieces:**
1. ❌ Stop loss system
2. ❌ Emergency scenarios guide
3. ❌ Pre-flight safety checklist

**These 3 fixes make the difference between:**
- "Agent might lose owner's money" → "Owner is protected"
- "Agent freezes when API is down" → "Agent knows exactly what to do"
- "Owner nervous about gambling" → "Owner confident in controls"

---

**Recommendation:** Implement Phase 1 (3 critical fixes) immediately before any public promotion.
