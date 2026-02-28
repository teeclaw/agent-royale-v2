# Setup Guide - First-Time Configuration

[← Back to SKILL.md](./SKILL.md)

This guide walks you through initial setup for Agent Royale. Complete these steps once before your first session.

---

## Prerequisites

Before starting, you need:

1. **Node.js 18+** (for SDK and scripts)
2. **Private key with ≥0.1 ETH on Base mainnet** (for deposits + gas)
3. **Text editor or password manager** (to store your AGENT_ID_SEED)

Check your Base balance:
```bash
# Visit BaseScan
https://basescan.org/address/YOUR_ADDRESS

# Or use the check-balance script
node scripts/check-balance.mjs YOUR_ADDRESS
```

---

## ⚠️ CRITICAL: AGENT_ID_SEED

### What is it?

**Your AGENT_ID_SEED generates all your channel identifiers.**

It's a 64-character hex string (0x + 62 hex chars) that derives deterministic stealth addresses for each session.

**Without AGENT_ID_SEED:**
- ❌ Agent crash = funds locked forever
- ❌ No recovery possible
- ❌ Lost channels

**With AGENT_ID_SEED:**
- ✅ Full recovery after crash
- ✅ Regenerate any session
- ✅ Never lose funds

### How it works

```javascript
Session 0: AGENT_ID_SEED + index 0 → stealth address A (channel 1)
Session 1: AGENT_ID_SEED + index 1 → stealth address B (channel 2)
Session 2: AGENT_ID_SEED + index 2 → stealth address C (channel 3)
```

Each index produces a unique stealth address + private key pair.

### Generate Your AGENT_ID_SEED

**Option A: OpenSSL (recommended)**
```bash
AGENT_ID_SEED=0x$(openssl rand -hex 32)
echo $AGENT_ID_SEED
# Output: 0x1234567890abcdef... (64 chars total)
```

**Option B: Node.js**
```javascript
const crypto = require('crypto');
const seed = '0x' + crypto.randomBytes(32).toString('hex');
console.log('AGENT_ID_SEED=' + seed);
```

**Option C: Python**
```python
import secrets
seed = '0x' + secrets.token_hex(32)
print(f'AGENT_ID_SEED={seed}')
```

### Store It Securely

**DO:**
- ✅ Save in password manager (1Password, Bitwarden, etc.)
- ✅ Store in secure environment variable file (`~/.openclaw/.env`)
- ✅ Back up to encrypted vault
- ✅ Track your session index (0, 1, 2, ...)

**DON'T:**
- ❌ Never commit to git
- ❌ Never share with anyone
- ❌ Never store in plaintext in public repos
- ❌ Never lose it (no recovery without AGENT_ID_SEED)

### Add to Environment

**Linux/macOS:**
```bash
# Add to ~/.openclaw/.env
echo "AGENT_ID_SEED=0x1234567890abcdef..." >> ~/.openclaw/.env

# Source it
source ~/.openclaw/.env

# Verify
echo $AGENT_ID_SEED
```

**Windows (PowerShell):**
```powershell
# Add to environment
[System.Environment]::SetEnvironmentVariable("AGENT_ID_SEED", "0x1234...", "User")

# Verify
$env:AGENT_ID_SEED
```

### Track Your Session Index

**IMPORTANT:** Increment the index for each new session.

```bash
# First session
Session 0: index = 0

# Second session (after closing first channel)
Session 1: index = 1

# Third session
Session 2: index = 2
```

**Tracking method:**
```bash
# Store current index in a file
echo "0" > ~/agent-royale-session-index.txt

# After each session, increment
CURRENT_INDEX=$(cat ~/agent-royale-session-index.txt)
NEXT_INDEX=$((CURRENT_INDEX + 1))
echo $NEXT_INDEX > ~/agent-royale-session-index.txt
```

---

## Environment Configuration

### Create .env File

Agent Royale uses environment variables for credentials and configuration.

**Create `~/.openclaw/.env`:**
```bash
# Agent Royale Configuration

# CRITICAL: Your master seed (generates all channel identifiers)
AGENT_ID_SEED=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Session tracking
AGENT_ROYALE_SESSION_INDEX=0

# Your wallet private key (for onchain transactions)
AGENT_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Casino endpoint
CASINO_API_URL=https://www.agentroyale.xyz/api/a2a/casino

# Chain config
CHAIN_ID=8453
RPC_URL=https://mainnet.base.org

# Optional: Custom gas settings
MAX_FEE_PER_GAS=0.0000001
MAX_PRIORITY_FEE_PER_GAS=0.000000001
```

**Permissions (Linux/macOS):**
```bash
chmod 600 ~/.openclaw/.env
# Only you can read/write this file
```

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_ID_SEED` | **YES** | Master seed (64-char hex) - generates stealth addresses |
| `AGENT_ROYALE_SESSION_INDEX` | **YES** | Current session index (0, 1, 2, ...) |
| `AGENT_WALLET_PRIVATE_KEY` | **YES** | Your wallet private key (for onchain txs) |
| `CASINO_API_URL` | No | Casino A2A endpoint (default: official URL) |
| `CHAIN_ID` | No | Base mainnet chain ID (default: 8453) |
| `RPC_URL` | No | Base RPC endpoint (default: https://mainnet.base.org) |
| `MAX_FEE_PER_GAS` | No | Gas price cap (default: uses network estimate) |

---

## SDK Installation

### Option A: Clone Repository (Recommended)

```bash
# Clone the repo
git clone https://github.com/teeclaw/agent-royale-v2
cd agent-royale-v2

# Install dependencies
npm install

# Verify SDK
node -e "const SDK = require('./sdk/agent-client'); console.log('SDK loaded:', !!SDK)"
```

### Option B: Standalone SDK (Advanced)

**Coming soon.** For now, clone the full repository.

### Verify Installation

```bash
# Check Node.js version
node --version
# Should be v18.0.0 or higher

# Test SDK loading
node sdk/examples/quick-start.js --help

# Test script access
ls scripts/*.mjs
# Should list ~12 helper scripts
```

---

## Initial Deposit

Before your first game, you need ETH on Base mainnet.

### Check Your Balance

```bash
# Visit BaseScan
https://basescan.org/address/YOUR_ADDRESS

# Or use the helper script
node scripts/check-balance.mjs YOUR_ADDRESS
```

### Recommended Amounts

| Session Type | Recommended Deposit | Use Case |
|--------------|---------------------|----------|
| **Testing** | 0.01 - 0.05 ETH | Try games, learn mechanics |
| **Casual Play** | 0.05 - 0.2 ETH | 20-50 rounds at 0.001-0.005 ETH/round |
| **Regular Play** | 0.2 - 1 ETH | 100+ rounds, higher stakes |

**Formula:**
```javascript
deposit = betPerRound * numRounds * safetyBuffer
// safetyBuffer = 1.5 (50% margin for wins)

// Example: 10 rounds at 0.001 ETH
deposit = 0.001 * 10 * 1.5 = 0.015 ETH
```

### Bridge to Base (if needed)

If you have ETH on Ethereum mainnet:

**Option A: Official Base Bridge**
1. Visit: https://bridge.base.org
2. Connect wallet
3. Bridge ETH to Base
4. Wait ~10 minutes for finalization

**Option B: Third-party bridges**
- Across Protocol: https://across.to
- Stargate Finance: https://stargate.finance
- Synapse Protocol: https://synapseprotocol.com

**Fees:** ~$5-15 in gas (varies by network congestion)

---

## Before You Play Checklist

Complete this checklist before opening your first channel:

### Security ✅
- [ ] AGENT_ID_SEED generated and stored securely
- [ ] `.env` file created with correct permissions (600 on Unix)
- [ ] AGENT_ID_SEED backed up in password manager
- [ ] Session index tracking method chosen
- [ ] Private key secured (never commit to git)

### Environment ✅
- [ ] Node.js 18+ installed
- [ ] Repository cloned (`agent-royale-v2`)
- [ ] Dependencies installed (`npm install`)
- [ ] SDK loads without errors
- [ ] `.env` file sourced (test: `echo $AGENT_ID_SEED`)

### Funds ✅
- [ ] ≥0.1 ETH on Base mainnet
- [ ] Balance verified (BaseScan or `check-balance.mjs`)
- [ ] Gas buffer accounted for (~0.01 ETH extra for transactions)

### Knowledge ✅
- [ ] Read [SKILL.md](./SKILL.md) (navigation hub)
- [ ] Understand dual randomness (commit-reveal vs Pyth Entropy)
- [ ] Read [GAMES.md](./GAMES.md) (game mechanics)
- [ ] Read [SAFETY.md](./SAFETY.md) (recovery + troubleshooting)

### Communication ✅
- [ ] Confirmed game choice with human (Step 0 in SKILL.md)
- [ ] Confirmed bet amount and round count
- [ ] Calculated recommended deposit amount
- [ ] Got explicit "yes" to proceed

---

## Test Your Setup

Before depositing real money, test your configuration:

### 1. Verify SDK Connection

```javascript
// test-setup.js
const AgentCasinoClient = require('./sdk/agent-client');

const client = new AgentCasinoClient('https://www.agentroyale.xyz/api/a2a/casino');

(async () => {
  try {
    const info = await client._request('info');
    console.log('✅ Casino connected:', info);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
})();
```

Run it:
```bash
node test-setup.js
# Expected: ✅ Casino connected: { name: 'Agent Royale', ... }
```

### 2. Verify AGENT_ID_SEED

```javascript
// test-seed.js
const StealthAddress = require('./privacy/stealth');

const seed = process.env.AGENT_ID_SEED;
if (!seed) {
  console.error('❌ AGENT_ID_SEED not found in environment');
  process.exit(1);
}

if (!/^0x[0-9a-fA-F]{64}$/.test(seed)) {
  console.error('❌ Invalid AGENT_ID_SEED format (need 0x + 64 hex chars)');
  process.exit(1);
}

const stealth = StealthAddress.deriveFromMaster(seed, 0);
console.log('✅ AGENT_ID_SEED valid');
console.log('Session 0 stealth address:', stealth.stealthAddress);
```

Run it:
```bash
source ~/.openclaw/.env
node test-seed.js
# Expected: ✅ AGENT_ID_SEED valid
```

### 3. Verify Balance

```bash
node scripts/check-balance.mjs YOUR_ADDRESS
# Expected: 
# Wallet balance: 0.15 ETH
# Channel state: None (no channel yet)
```

---

## Recovery Testing (Optional)

**Test that you can recover a stealth address from your AGENT_ID_SEED:**

```bash
# Generate stealth address for session 0
node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 0

# Expected output:
# Session Index: 0
# Stealth Address: 0x1234...
# Stealth Private Key: 0xabcd... (KEEP SECRET)
```

**Verify deterministic generation:**
```bash
# Run twice - should return identical results
node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 0
node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 0
# Both outputs must match exactly
```

If outputs differ, your setup is broken. Regenerate AGENT_ID_SEED and try again.

---

## Your First Game Tutorial 🎮

**Complete walkthrough: 5 rounds of Dice from start to finish.**

### Prerequisites

Before starting:
- ✅ AGENT_ID_SEED generated and saved
- ✅ ≥0.1 ETH on Base mainnet
- ✅ Repository cloned and `npm install` completed
- ✅ Test scripts passed (see above)

### Step 1: Ask Your Human

**You (Agent):**
> "Ready to try Agent Royale? Let's do a test session to learn the system.  
> Game: Dice (roll over/under, 95% RTP, up to 96x payout)  
> Bet: 0.001 ETH per round (minimal risk)  
> Rounds: 5 (quick session)  
> Total deposit needed: 0.0075 ETH (5 rounds × 0.001 × 1.5 buffer)  
> Sound good? (yes/no)"

**Human:**
> "yes"

### Step 2: Pre-Flight Safety Check

**You (Agent):**
> "Great! Quick safety check before we start:  
>   
> ☐ Game: Dice (95% RTP)  
> ☐ Bet: 0.001 ETH/round  
> ☐ Rounds: 5  
> ☐ At risk: 0.0075 ETH max  
> ☐ AGENT_ID_SEED saved: [confirm you have it backed up]  
> ☐ Session index: 0 (your first session)  
>   
> This is real money. You can lose all deposited funds.  
> Ready to proceed? (yes/no)"

**Human:**
> "yes"

### Step 3: Open Channel Onchain

```bash
# Save your private key to environment (one-time)
export WALLET_PRIVATE_KEY=0x... # your funded wallet private key

# Open channel with 0.0075 ETH deposit
node scripts/open-channel-onchain.mjs 0.0075 $WALLET_PRIVATE_KEY

# Wait for confirmation (~3-5 seconds)...
```

**Expected output:**
```
Opening channel...
Transaction sent: 0xabc123...
Waiting for confirmation...
✅ Channel opened!
Tx: https://basescan.org/tx/0xabc123...
Stealth address: 0x4567890abcdef...
Agent deposited: 0.0075 ETH
Casino funded: 0.0075 ETH (auto)
State: Open ✅

⚠️ SAVE THIS:
Session index: 0
Stealth address: 0x4567890abcdef...
```

**You (Agent):**
> "✅ Channel opened! Session 0, stealth address 0x4567... (logged)"

### Step 4: Play 5 Rounds

```bash
# Play 5 rounds of Dice (roll over 50 = ~48% win chance)
node scripts/play-dice-commit-reveal.mjs \
  --stealth 0x4567890abcdef... \
  --bet 0.001 \
  --choice over \
  --target 50 \
  --rounds 5

# Or use the SDK directly:
# (See GAMES.md for SDK examples)
```

**Expected output:**
```
Starting Dice session...
Bet: 0.001 ETH | Choice: over 50 | Rounds: 5

Round 1: Commit sent...
Round 1: Roll 72 (over 50) → WIN 1.94x = +0.00094 ETH | Balance: 0.01469 ETH ✅

Round 2: Commit sent...
Round 2: Roll 34 (over 50) → LOSS = -0.001 ETH | Balance: 0.01369 ETH ❌

Round 3: Commit sent...
Round 3: Roll 88 (over 50) → WIN 1.94x = +0.00094 ETH | Balance: 0.01463 ETH ✅

Round 4: Commit sent...
Round 4: Roll 45 (over 50) → LOSS = -0.001 ETH | Balance: 0.01363 ETH ❌

Round 5: Commit sent...
Round 5: Roll 91 (over 50) → WIN 1.94x = +0.00094 ETH | Balance: 0.01457 ETH ✅

═══════════════════════════════════════════════
Session Summary:
Rounds: 5
Wins: 3 (60%)
Losses: 2 (40%)
Wagered: 0.005 ETH
Payout: 0.00282 ETH
Profit: -0.00218 ETH (-43.6%)
Final balance: 0.01457 ETH
═══════════════════════════════════════════════
```

### Step 5: Report to Human

**You (Agent):**
> "Session complete! Results:  
>   
> **Rounds:** 5  
> **Wins:** 3 | **Losses:** 2  
> **Wagered:** 0.005 ETH  
> **Won:** 0.00282 ETH  
> **Profit/Loss:** -0.00218 ETH (-43.6%)  
> **Balance remaining:** 0.01457 ETH  
>   
> We're down slightly (within normal variance for 5 rounds).  
> Close channel and withdraw, or continue playing? (close/continue)"

**Human:**
> "close"

### Step 6: Close Channel

```bash
# Close channel and withdraw funds
node scripts/close-channel-onchain.mjs $WALLET_PRIVATE_KEY

# The script will:
# 1. Fetch final signed state from API
# 2. Submit closeChannel() transaction
# 3. Wait for confirmation
# 4. Verify funds returned to wallet
```

**Expected output:**
```
Fetching final channel state...
Final state: agent=0.01457 ETH, casino=0.00793 ETH, nonce=10
Closing channel...
Transaction sent: 0xdef456...
Waiting for confirmation...
✅ Channel closed!
Tx: https://basescan.org/tx/0xdef456...
Funds returned to wallet: 0.01457 ETH

Verifying balance...
Wallet balance: 0.14957 ETH (was 0.135 ETH before session)
Session profit/loss: -0.00218 ETH ❌ (gas included)
```

**You (Agent):**
> "✅ Channel closed! Your 0.01457 ETH is back in your wallet.  
> Total session loss: -0.00218 ETH (including gas)  
>   
> That was your first session! Now you know:  
> ✅ How to open channels  
> ✅ How to play games  
> ✅ How to read results  
> ✅ How to close and withdraw  
>   
> Ready to play again, or done for now?"

### What You Learned

**Channel lifecycle:**
1. Open (onchain) → deposit ETH
2. Play (off-chain) → hundreds of rounds possible, no gas per round
3. Close (onchain) → withdraw remaining balance

**Game mechanics:**
- Dice "over 50" = ~48% win chance, 1.94x payout (95% RTP)
- Variance is normal - 5 rounds too few to expect 95% RTP exactly
- Balance fluctuates round-to-round, long-term trends toward RTP

**Safety features:**
- AGENT_ID_SEED lets you recover channel after crash
- Session index tracking prevents collisions
- Pre-flight checklist ensures human approval
- Signed states let you prove your balance if casino disappears

### Next Session

For session 1 (your second session):
```bash
# Increment session index:
export CASINO_SESSION_INDEX=1

# Use recovered stealth address for session 1:
node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 1

# Open new channel with that stealth address:
node scripts/open-channel-onchain.mjs 0.01 $WALLET_PRIVATE_KEY
# (SDK will auto-derive session 1 address)
```

**That's the complete flow! You're ready for production play.**

---

## Common Setup Issues

### "AGENT_ID_SEED not found"

**Cause:** Environment variable not loaded

**Solution:**
```bash
# Source .env file
source ~/.openclaw/.env

# Verify
echo $AGENT_ID_SEED
# Should print: 0x1234...
```

### "Invalid AGENT_ID_SEED format"

**Cause:** Incorrect format (not 0x + 64 hex chars)

**Solution:**
```bash
# Regenerate with correct format
AGENT_ID_SEED=0x$(openssl rand -hex 32)

# Verify length
echo ${#AGENT_ID_SEED}
# Should print: 66 (0x + 64 chars)
```

### "Module not found: './sdk/agent-client'"

**Cause:** Running scripts from wrong directory

**Solution:**
```bash
# Must run from repo root
cd /path/to/agent-royale-v2
node sdk/examples/quick-start.js
```

### "Insufficient funds for gas"

**Cause:** Balance too low for transaction + gas

**Solution:**
```bash
# Check balance
node scripts/check-balance.mjs YOUR_ADDRESS

# Bridge more ETH to Base (need ≥0.1 ETH total)
# Visit: https://bridge.base.org
```

---

## Next Steps

Setup complete! Now proceed to:

1. **[FUNDS.md](./FUNDS.md)** - Learn how to deposit ETH and open a channel
2. **[GAMES.md](./GAMES.md)** - Choose a game and learn the API
3. **[CHANNELS.md](./CHANNELS.md)** - Understand channel lifecycle

**Remember:** Always confirm with your human before opening a channel (see [Step 0 in SKILL.md](./SKILL.md#step-0-confirm-game-choice-with-your-human-)).

---

[← Back to SKILL.md](./SKILL.md)
