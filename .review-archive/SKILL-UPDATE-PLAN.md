# SKILL.md Complete Update Plan

**Scope:** Implement all 9 critical fixes from review  
**Estimated Lines:** +800-1000 lines  
**Time:** 2-3 hours to implement + test  
**Impact:** Owner confidence D→A, Production readiness 60%→95%

---

## Changes Summary

### NEW SECTIONS (6)

1. **Session Index Tracking** (after Agent ID Seed warning)
   - 3 tracking methods (simple → advanced)
   - ~80 lines

2. **First Time Setup** (before Quick Start)
   - 4-step checklist with commands
   - ~120 lines

3. **Pre-Flight Safety Checklist** (in Step 0)
   - Mandatory confirmation before opening channel
   - ~60 lines

4. **Your First Game Tutorial** (after Quick Start)
   - Complete walkthrough with expected output
   - ~150 lines

5. **Owner Safety Controls** (in Agent Communication Guidelines)
   - Stop loss system with code
   - Circuit breakers
   - ~100 lines

6. **Emergency Scenarios** (after Troubleshooting)
   - 6 "What If..." scenarios with recovery steps
   - ~350 lines

### ENHANCED SECTIONS (3)

7. **Step 2: Play Games** (add balance monitoring)
   - Warning system when balance low
   - ~40 lines addition

8. **Step 3: Close Channel** (add session summary template)
   - Detailed post-game summary
   - ~50 lines addition

9. **Security & Recovery** (add state backup verification)
   - Verification commands
   - Backup checklist
   - ~50 lines addition

---

## Detailed Content

### 1. Session Index Tracking

**Location:** After Agent ID Seed warning (line ~55)

**Content:**
```markdown
## Session Index Tracking (CRITICAL FOR RECOVERY)

### Method 1: Simple Text Log
```bash
echo "$(date): Session 0..." >> ~/casino-sessions.log
```

### Method 2: Environment Variable (Recommended)
```bash
export CASINO_SESSION_INDEX=0
```

### Method 3: JSON Database
```bash
jq '. += [{"index":0,...}]' ~/casino-sessions.json
```
```

---

### 2. First Time Setup

**Location:** Before Quick Start (line ~60)

**Content:**
```markdown
## First Time Setup (10 Minutes)

☐ Task 1: Generate Agent ID Seed
☐ Task 2: Fund Wallet on Base (≥0.1 ETH)
☐ Task 3: Clone Scripts Repository
☐ Task 4: Test Connection

[Detailed commands for each task]
```

---

### 3. Pre-Flight Safety Checklist

**Location:** In Step 0 (line ~150)

**Content:**
```markdown
### Pre-Flight Safety Checklist

Before opening ANY channel, agent MUST confirm:

☐ Human explicitly approved:
   - Game: ______
   - Bet per round: ______ ETH
   - Rounds: ______
   - Stop loss: ______ ETH
   - Total at risk: ______ ETH

☐ Agent ID Seed saved: Yes/No
☐ Session index logged: ______
☐ Wallet balance verified: ______ ETH
☐ Human understands:
   - This is gambling (can lose all)
   - Stop loss protects remaining funds
   - They can stop anytime

Agent: "All confirmed. Opening channel now..."
```

---

### 4. Your First Game Tutorial

**Location:** After Quick Start (line ~300)

**Content:**
```markdown
## Your First Game (Complete Example)

Let's play 5 rounds of Dice.

### Step 1: Ask Your Human
[Conversation template]

### Step 2: Open Channel
```bash
node scripts/open-channel-onchain.mjs 0.0075 $KEY
```

### Step 3: Play
[Complete output example]

### Step 4: Summary
[Session results]

### Step 5: Close
[Close commands + verification]

That's one complete session!
```

---

### 5. Owner Safety Controls (Stop Loss)

**Location:** In Agent Communication Guidelines (line ~1100)

**Content:**
```markdown
## Owner Safety Controls (MANDATORY)

### Stop Loss System

```javascript
const sessionLimits = {
  maxLoss: 0.005,        // Stop if down -0.005 ETH
  maxRounds: 20,         // Hard limit
  minBalance: 0.001,     // Emergency stop
  askEveryNRounds: 5     // Re-confirm
};

// Enforce after each round:
if (profit <= -sessionLimits.maxLoss) {
  STOP("⛔ STOP LOSS HIT");
  closeChannel();
}
```

### Why This Matters
- Without: agent plays until balance = 0
- With: losses capped at agreed amount

### Example Output
```
Round 8: LOSS
⛔ STOP LOSS HIT
Lost 0.005 ETH (limit reached)
Closing to protect remaining 0.005 ETH...
✅ Funds saved.
```
```

---

### 6. Emergency Scenarios

**Location:** After Troubleshooting (new section at line ~850)

**Content:**
```markdown
## Emergency Scenarios (What To Do When...)

### Scenario 1: Agent Crashes Mid-Session
[5-step recovery process]

### Scenario 2: Casino API Is Down
[Immediate + 24h+ response plan]

### Scenario 3: Lost Agent ID Seed
[Hard truth + search checklist]

### Scenario 4: Channel State Mismatch
[Verification + evidence gathering]

### Scenario 5: Commitment Verification Fails
[Evidence save + dispute process]

### Scenario 6: Ran Out Of Gas
[Gas estimation + retry]
```

---

### 7. Balance Monitoring (Enhanced Step 2)

**Location:** In Step 2: Play Games (line ~250)

**Addition:**
```markdown
**Balance Monitoring (During Play):**

After each round, check if balance < (bet × 3):

```javascript
if (agentBalance < betAmount * 3) {
  console.log(`⚠️ LOW BALANCE WARNING:`);
  console.log(`   Rounds left: ~${Math.floor(agentBalance / betAmount)}`);
  const choice = await ask("Continue? (yes/no): ");
  if (choice !== "yes") {
    return closeChannel();
  }
}
```
```

---

### 8. Session Summary Template (Enhanced Step 3)

**Location:** In Step 3: Close Channel (line ~280)

**Addition:**
```markdown
**Session Summary (Show After Close):**

```
═══════════════════════════════════════════════
              SESSION COMPLETE
═══════════════════════════════════════════════

Game: Dice (over/under)
Rounds: 15 | Wins: 8 (53%) | Losses: 7

MONEY:
  Deposited: 0.01 ETH
  Final: 0.0096 ETH
  Profit/Loss: -0.0004 ETH (-4%)

SAFETY:
  Stop loss: -0.005 ETH (not hit) ✅
  All verifications passed ✅

Next: Play again? (yes/no)
```
```

---

### 9. State Backup Verification (Enhanced Security Section)

**Location:** Security & Recovery section (line ~900)

**Addition:**
```markdown
### Verifying State Backups

**SDK auto-saves to** `./casino-states/`

**After each session:**
```bash
# Check backups exist:
ls -lh ./casino-states/
# Should see: session-*.json, round-*.json

# Verify readable:
cat ./casino-states/round-42.json | jq .
```

**Backup Checklist:**
- ✅ Latest state backed up
- ✅ JSON not corrupted
- ✅ Contains: balance, nonce, signature
- ✅ Stored in 2+ locations
```

---

## Implementation Order

### Phase 1 (Critical - 1 hour)
1. Pre-Flight Safety Checklist (Gap 3.2)
2. Owner Safety Controls/Stop Loss (Gap 3.1)
3. Emergency Scenarios (Gap 4.1)

### Phase 2 (High - 45 min)
4. First Time Setup (Gap 1.1)
5. Your First Game Tutorial (Gap 2.1)
6. Session Index Tracking (Gap 2.2)

### Phase 3 (Medium - 30 min)
7. Balance Monitoring (Gap 2.3)
8. Session Summary Template (Gap 3.3)
9. State Backup Verification (Gap 4.2)

---

## Testing Checklist

After implementation:

- [ ] All code blocks have correct syntax
- [ ] All bash commands work
- [ ] All file paths correct
- [ ] Examples use real contract addresses
- [ ] No broken internal links
- [ ] Markdown renders correctly
- [ ] Total doc length reasonable (<2500 lines)

---

## Decision Point

**Option A: Full Implementation (Recommended)**
- All 9 fixes implemented
- ~1000 lines added
- 2-3 hours work
- SKILL.md becomes 2200+ lines
- Production-ready for public launch

**Option B: Critical Only (Faster)**
- Just fixes 1-3 (Phase 1)
- ~500 lines added
- 1 hour work
- Owner safety addressed
- Rest can wait

**Option C: Modular Approach**
- Create separate docs for some sections
- Keep SKILL.md focused
- Link to detailed guides
- Examples: FIRST-TIME-SETUP.md, EMERGENCY-GUIDE.md

---

## Recommendation

**Go with Option A (Full Implementation)**

**Why:**
- Owner confidence is critical for casino product
- Emergency scenarios prevent support burden
- Complete docs = professional product
- 2200 lines is manageable for agents (can Ctrl+F)
- Better to over-document safety than under-document

**Alternative structure (if 2200 lines too long):**
- Keep SKILL.md at ~1500 lines (core workflow)
- Create SAFETY-GUIDE.md (~400 lines - stop loss + emergencies)
- Create FIRST-TIME-GUIDE.md (~300 lines - setup + first game)
- Link from SKILL.md

---

## Your Choice

**Which approach do you prefer?**

1. **Full SKILL.md** (~2200 lines, everything in one place)
2. **Split into 3 docs** (SKILL.md + SAFETY-GUIDE.md + FIRST-TIME-GUIDE.md)
3. **Just critical fixes** (Phase 1 only, ~500 lines added)

I'm ready to implement whichever you choose.
