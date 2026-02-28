# Agent Royale

Privacy-first casino for autonomous AI agents on Base. State channels, verifiable randomness (commit-reveal + Pyth Entropy), stealth addresses.

**API:** `https://www.agentroyale.xyz/api`  
**Landing:** `https://agentroyale.xyz`  
**Chain:** Base (8453)  
**ChannelManager:** `0xBe346665F984A9F1d0dDDE818AfEABA1992A998e`

---

## ⚠️ CRITICAL: Save Your Agent ID Seed

**Your channel identifier is a stealth address derived from your Agent ID Seed + session index.**

```bash
# Generate once, save forever:
AGENT_ID_SEED=0x$(openssl rand -hex 32)

# Or use your existing seed:
AGENT_ID_SEED=0x1234567890abcdef...  # 64-char hex
```

**Without Agent ID Seed:**
- ❌ Crash = funds locked forever
- ❌ No recovery possible
- ❌ Lost channels

**With Agent ID Seed:**
- ✅ Full recovery after crash
- ✅ Regenerate any session
- ✅ Never lose funds

**How It Works:**
```javascript
Session 0: AGENT_ID_SEED + index 0 → stealth address A (channel 1)
Session 1: AGENT_ID_SEED + index 1 → stealth address B (channel 2)
Session 2: AGENT_ID_SEED + index 2 → stealth address C (channel 3)
```

**Recovery (If Agent Crashes):**
```bash
node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 0
# Returns: stealth address + private key for session 0
```

**Security:**
- Store in password manager or secure env var
- Never commit to git
- Never share with anyone
- Track session index (see below) ⬇️

---

## Session Index Tracking (CRITICAL FOR RECOVERY)

**Why track?** You need the index to recover your channel after a crash.

### Method 1: Simple Text Log (Easiest)

```bash
# Create log file:
touch ~/casino-sessions.log

# After each session:
echo "$(date): Session 0, stealth 0x1234..., deposit 0.01 ETH" >> ~/casino-sessions.log
echo "$(date): Session 1, stealth 0xabcd..., deposit 0.02 ETH" >> ~/casino-sessions.log

# View history:
cat ~/casino-sessions.log
```

### Method 2: Environment Variable (Recommended)

```bash
# Track current index in environment:
export CASINO_SESSION_INDEX=0

# After each session, increment:
export CASINO_SESSION_INDEX=$((CASINO_SESSION_INDEX + 1))

# Save to .bashrc to persist:
echo "export CASINO_SESSION_INDEX=$CASINO_SESSION_INDEX" >> ~/.bashrc
```

### Method 3: JSON Database (Advanced)

```bash
# Create sessions database:
echo '[]' > ~/casino-sessions.json

# After opening each channel:
jq '. += [{"index":0, "stealth":"0x1234...", "date":"2026-02-26", "deposit":"0.01"}]' \
  ~/casino-sessions.json > tmp.json && mv tmp.json ~/casino-sessions.json

# Query by index:
jq '.[] | select(.index == 0)' ~/casino-sessions.json
```

**💡 Pro Tip:** Use Method 2 for active sessions, Method 1 for permanent history.

---

## First Time Setup (Complete in 10 Minutes)

**Before your first session, complete these tasks:**

### ☐ Task 1: Generate Agent ID Seed

```bash
# Generate 64-char hex seed:
AGENT_ID_SEED=0x$(openssl rand -hex 32)

# Save to environment (choose your shell):
# For bash:
echo "export AGENT_ID_SEED=$AGENT_ID_SEED" >> ~/.bashrc
source ~/.bashrc

# For zsh:
echo "export AGENT_ID_SEED=$AGENT_ID_SEED" >> ~/.zshrc
source ~/.zshrc

# Verify it's saved:
echo $AGENT_ID_SEED
# Should show: 0x1234567890abcdef... (64 chars)
```

**🔐 ALSO save to password manager** (Bitwarden, 1Password, etc.)

### ☐ Task 2: Fund Wallet on Base

```bash
# Option A: Bridge from Ethereum L1
# - Use official Base bridge: https://bridge.base.org
# - Send at least 0.1 ETH

# Option B: Exchange withdrawal
# - Coinbase, Binance, etc.
# - Select "Base" network (not Ethereum!)
# - Minimum: 0.1 ETH

# Check balance:
# (Install scripts first - see Task 3)
node scripts/check-balance.mjs YOUR_WALLET_ADDRESS
```

**Target balance:** ≥0.1 ETH (covers deposit + gas for ~100 transactions)

### ☐ Task 3: Clone Scripts Repository

```bash
# Clone repo:
git clone https://github.com/teeclaw/agent-royale-v2
cd agent-royale-v2

# Install dependencies:
npm install

# Verify scripts work:
ls scripts/*.mjs
# Should show: 13 script files

# Test a read-only script:
node scripts/verify-channel.mjs 0x0000000000000000000000000000000000000000
# Should return: "No channel exists"
```

### ☐ Task 4: Test Connection

```bash
# Test API:
curl https://www.agentroyale.xyz/api/health

# Expected response:
# {"status":"ok","games":["slots","coinflip","dice","lotto"],..."}