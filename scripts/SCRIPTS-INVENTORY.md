# Agent Royale Scripts Inventory

**Status:** In Development (Not Committed/Pushed - Awaiting Review)

## Completed Scripts (3/12)

### ✅ Channel Management
1. **open-channel-onchain.mjs** - Open channel with ETH deposit ✅ DEPLOYED
2. **close-channel-onchain.mjs** - Cooperative channel close ✅ CREATED
3. **verify-channel.mjs** - Check channel state ✅ CREATED

### ✅ Utilities
4. **check-balance.mjs** - Check wallet + channel balance ✅ CREATED

## Pending Scripts (8/12)

### Game Playing (7 scripts)
5. **play-dice-commit-reveal.mjs** - Fast dice (2-step)
6. **play-dice-entropy.mjs** - Verifiable dice (Pyth)
7. **play-slots-commit-reveal.mjs** - Fast slots (2-step)
8. **play-slots-entropy.mjs** - Verifiable slots (Pyth)
9. **play-coinflip-commit-reveal.mjs** - Fast coinflip (2-step)
10. **play-coinflip-entropy.mjs** - Verifiable coinflip (Pyth)
11. **play-lotto-entropy.mjs** - Lotto (Pyth only, 6h draws)

### Advanced (1 script)
12. **dispute-channel.mjs** - Start challenge if casino disappears

---

## Security Features (All Scripts)

### ✅ Implemented
- Private keys never logged or exposed
- Input validation on all parameters
- Balance checks before transactions
- Clear error messages with solutions
- Transaction verification
- Conservation invariant validation
- Dry-run mode (where applicable)
- Audit trail via console output

### ✅ No Unsafe Patterns
- No eval() or exec()
- No dynamic code execution
- No hardcoded private keys
- No external HTTP calls (except official Base RPC + A2A API)
- No filesystem writes except logs

---

## Script Details

### 1. open-channel-onchain.mjs ✅
**Purpose:** Open channel on Base mainnet  
**Security:**
- Validates deposit range (0.001-10 ETH)
- Checks channel doesn't already exist
- Verifies wallet balance before transaction
- Shows gas estimate before confirming
- Returns transaction hash + verification

**Usage:**
```bash
node scripts/open-channel-onchain.mjs 0.1 YOUR_PRIVATE_KEY
# Or with env var:
AGENT_WALLET_PRIVATE_KEY=0x... node scripts/open-channel-onchain.mjs 0.1
```

**Status:** DEPLOYED (Commit: e8c65ce)

---

### 2. close-channel-onchain.mjs ✅
**Purpose:** Close channel cooperatively with casino signature  
**Security:**
- Requires final signed state from A2A close_channel
- Validates conservation invariant
- Shows profit/loss before confirming
- Verifies nonce is higher than current
- Estimates gas before transaction
- Checks signature validity
- Confirms channel actually closed after tx

**Usage:**
```bash
# Step 1: Get final state from A2A
curl -X POST https://www.agentroyale.xyz/api/a2a/casino \
  -d '{"action":"close_channel","stealthAddress":"0x..."}' > final-state.json

# Step 2: Close onchain
cat final-state.json | node scripts/close-channel-onchain.mjs YOUR_PRIVATE_KEY
```

**Input:** JSON from A2A close_channel response  
**Output:** Transaction hash + settlement summary  
**Status:** CREATED (Ready for review)

---

### 3. verify-channel.mjs ✅
**Purpose:** Check channel state (read-only, no transactions)  
**Security:**
- No private key required
- Read-only operation
- Validates conservation invariant
- Shows clear state + next actions

**Usage:**
```bash
node scripts/verify-channel.mjs 0x1234567890123456789012345678901234567890
```

**Output:**
- Channel state (None/Open/Disputed/Closed)
- Deposits + current balances
- Profit/loss
- Conservation invariant check
- Dispute info (if applicable)
- Suggested next actions

**Status:** CREATED (Ready for review)

---

### 4. check-balance.mjs ✅
**Purpose:** Check wallet + channel balance  
**Security:**
- No private key required
- Read-only operation
- Shows total available (wallet + channel)

**Usage:**
```bash
node scripts/check-balance.mjs 0x1234567890123456789012345678901234567890
```

**Output:**
- Wallet balance
- Channel balance (if exists)
- Total available
- Recommendations based on balance

**Status:** CREATED (Ready for review)

---

### 5-11. Game Playing Scripts (PENDING)

All game scripts will follow this pattern:

**Common Features:**
- Accept private key (arg or env var)
- Call A2A endpoint with proper request structure
- Handle commit/reveal or entropy flow
- Show results clearly
- Validate responses
- Log round details

**Commit-Reveal Pattern:**
```bash
# Example: play-dice-commit-reveal.mjs
node scripts/play-dice-commit-reveal.mjs \
  --key YOUR_PRIVATE_KEY \
  --stealth 0x... \
  --bet 0.001 \
  --choice over \
  --target 50 \
  --rounds 5
```

**Entropy Pattern:**
```bash
# Example: play-dice-entropy.mjs
node scripts/play-dice-entropy.mjs \
  --key YOUR_PRIVATE_KEY \
  --stealth 0x... \
  --bet 0.001 \
  --choice over \
  --target 50 \
  --rounds 5
```

**Security for Game Scripts:**
- Validate bet amount vs channel balance
- Verify commitment matches revealed seed
- Check EIP-712 signature
- Validate result math (multiplier × bet = payout)
- Show proof chain for verification
- Warn on suspicious responses

---

### 12. dispute-channel.mjs (PENDING)

**Purpose:** Start challenge if casino disappears  
**When to Use:**
- Casino API is down >24h
- Casino refuses to sign channel close
- Emergency exit needed

**Security:**
- Requires latest signed state
- Validates nonce is highest you have
- Shows 24h deadline
- Warns this is irreversible

**Usage:**
```bash
node scripts/dispute-channel.mjs \
  YOUR_PRIVATE_KEY \
  latest-signed-state.json
```

---

## Implementation Strategy

### Phase 1: Core Channel Management (DONE)
- ✅ open-channel-onchain.mjs
- ✅ close-channel-onchain.mjs
- ✅ verify-channel.mjs
- ✅ check-balance.mjs

### Phase 2: Game Playing (PENDING - Needs Review First)
Priority order:
1. play-dice-commit-reveal.mjs (most requested)
2. play-dice-entropy.mjs (verifiable alternative)
3. play-slots-commit-reveal.mjs (popular game)
4. play-coinflip-commit-reveal.mjs (simple game)
5. Entropy variants (slots, coinflip)
6. play-lotto-entropy.mjs (unique flow)

### Phase 3: Advanced (PENDING)
- dispute-channel.mjs (edge case)

---

## Testing Checklist (Before Deployment)

### For Each Script:
- [ ] Runs without errors on valid input
- [ ] Shows clear error on invalid input
- [ ] Private key never exposed in logs
- [ ] Gas estimation works
- [ ] Transaction confirmation works
- [ ] Output is human-readable
- [ ] Help text is clear
- [ ] Example usage is correct
- [ ] No hardcoded values (except contract addresses)
- [ ] Env var support works

### Security Review:
- [ ] No eval/exec/dynamic code
- [ ] No unnecessary dependencies
- [ ] Input validation on all parameters
- [ ] Conservation invariant checks
- [ ] Signature verification (where applicable)
- [ ] Clear warnings before irreversible actions
- [ ] Audit trail in console output

---

## Dependencies

All scripts use:
- `ethers` (v6) - Ethereum interaction
- `fs` - File system (ABI reading only)
- `readline` - User confirmation prompts
- Node.js built-ins only (no external HTTP libs)

**No additional packages required.**

---

## File Locations

```
agent-casino/
├── scripts/
│   ├── open-channel-onchain.mjs          ✅ DEPLOYED
│   ├── close-channel-onchain.mjs         ✅ CREATED
│   ├── verify-channel.mjs                ✅ CREATED
│   ├── check-balance.mjs                 ✅ CREATED
│   ├── play-dice-commit-reveal.mjs       ⏳ PENDING
│   ├── play-dice-entropy.mjs             ⏳ PENDING
│   ├── play-slots-commit-reveal.mjs      ⏳ PENDING
│   ├── play-slots-entropy.mjs            ⏳ PENDING
│   ├── play-coinflip-commit-reveal.mjs   ⏳ PENDING
│   ├── play-coinflip-entropy.mjs         ⏳ PENDING
│   ├── play-lotto-entropy.mjs            ⏳ PENDING
│   ├── dispute-channel.mjs               ⏳ PENDING
│   └── SCRIPTS-INVENTORY.md              📄 THIS FILE
├── ChannelManager.abi.json               ✅ DEPLOYED
└── sdk/
    └── agent-client.js                    ✅ DEPLOYED
```

---

## Review Status

**Created (Awaiting Review):**
- close-channel-onchain.mjs
- verify-channel.mjs
- check-balance.mjs
- SCRIPTS-INVENTORY.md (this file)

**Not Committed/Pushed Yet** - per your request

**Next Steps After Review:**
1. Review security of completed scripts
2. Test on Base testnet (if desired)
3. Create remaining game playing scripts
4. Final security audit
5. Commit + push all scripts together
6. Update SKILL.md with script references
