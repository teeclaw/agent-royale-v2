# Safety - Risk Management, Recovery, Troubleshooting

[← Back to SKILL.md](./SKILL.md)

Emergency procedures, stop-loss strategies, recovery from AGENT_ID_SEED, error codes, and troubleshooting guide.

---

## Table of Contents

1. [Stop-Loss Strategies](#stop-loss-strategies)
2. [Emergency Procedures](#emergency-procedures)
3. [Recovery from AGENT_ID_SEED](#recovery-from-agent_id_seed)
4. [Common Errors](#common-errors)
5. [Troubleshooting](#troubleshooting)
6. [Warning Boxes](#warning-boxes)

---

## Stop-Loss Strategies

**Protect your funds with automated limits.**

### Per-Session Stop-Loss

**Stop when you lose X% of initial deposit:**

```javascript
const initialDeposit = 0.015; // ETH
const stopLossPercent = 20; // Stop at -20%

async function playWithStopLoss() {
  let currentBalance = initialDeposit;
  
  for (let i = 0; i < maxRounds; i++) {
    const result = await client.playDice('0.001', { choice: 'over', target: 50 });
    currentBalance = parseFloat(result.agentBalance);
    
    const loss = initialDeposit - currentBalance;
    const lossPercent = (loss / initialDeposit) * 100;
    
    if (lossPercent >= stopLossPercent) {
      console.log(`⚠️ Stop-loss triggered: -${lossPercent.toFixed(2)}%`);
      console.log(`Closing channel to prevent further losses`);
      await client.closeChannel();
      break;
    }
  }
}
```

### Daily Loss Limit

**Track cumulative losses across multiple sessions:**

```javascript
const fs = require('fs');

const DAILY_LIMIT_FILE = './casino-states/daily-loss-limit.json';
const MAX_DAILY_LOSS = 0.05; // 0.05 ETH max loss per day

function getDailyLoss() {
  if (!fs.existsSync(DAILY_LIMIT_FILE)) {
    return { date: new Date().toISOString().split('T')[0], loss: 0 };
  }
  const data = JSON.parse(fs.readFileSync(DAILY_LIMIT_FILE));
  
  // Reset if new day
  const today = new Date().toISOString().split('T')[0];
  if (data.date !== today) {
    return { date: today, loss: 0 };
  }
  
  return data;
}

function recordSessionLoss(lossAmount) {
  const data = getDailyLoss();
  data.loss += lossAmount;
  fs.writeFileSync(DAILY_LIMIT_FILE, JSON.stringify(data, null, 2));
}

async function playWithDailyLimit() {
  const dailyData = getDailyLoss();
  
  if (dailyData.loss >= MAX_DAILY_LOSS) {
    console.log('❌ Daily loss limit reached:', dailyData.loss, 'ETH');
    console.log('No more sessions today. Try again tomorrow.');
    return;
  }
  
  const remainingLimit = MAX_DAILY_LOSS - dailyData.loss;
  console.log(`Daily limit remaining: ${remainingLimit.toFixed(6)} ETH`);
  
  // Play session...
  const initialDeposit = Math.min(0.015, remainingLimit);
  // ... session code ...
  
  // After session
  const profit = finalBalance - initialDeposit;
  if (profit < 0) {
    recordSessionLoss(Math.abs(profit));
  }
}
```

### Lifetime Budget Tracking

**Track total profit/loss across all sessions:**

```javascript
const LIFETIME_FILE = './casino-states/lifetime-stats.json';

function getLifetimeStats() {
  if (!fs.existsSync(LIFETIME_FILE)) {
    return { totalDeposited: 0, totalWithdrawn: 0, sessions: 0 };
  }
  return JSON.parse(fs.readFileSync(LIFETIME_FILE));
}

function recordSession(deposit, finalBalance) {
  const stats = getLifetimeStats();
  stats.totalDeposited += deposit;
  stats.totalWithdrawn += finalBalance;
  stats.sessions += 1;
  stats.netProfit = stats.totalWithdrawn - stats.totalDeposited;
  fs.writeFileSync(LIFETIME_FILE, JSON.stringify(stats, null, 2));
  
  console.log('\n=== Lifetime Stats ===');
  console.log(`Total deposited: ${stats.totalDeposited.toFixed(6)} ETH`);
  console.log(`Total withdrawn: ${stats.totalWithdrawn.toFixed(6)} ETH`);
  console.log(`Net profit: ${stats.netProfit.toFixed(6)} ETH`);
  console.log(`Sessions: ${stats.sessions}`);
}
```

### Win-Target Strategy

**Stop when you reach X% profit:**

```javascript
const initialDeposit = 0.015;
const winTarget = 50; // Stop at +50% profit

async function playWithWinTarget() {
  let currentBalance = initialDeposit;
  
  for (let i = 0; i < maxRounds; i++) {
    const result = await client.playDice('0.001', { choice: 'over', target: 50 });
    currentBalance = parseFloat(result.agentBalance);
    
    const profit = currentBalance - initialDeposit;
    const profitPercent = (profit / initialDeposit) * 100;
    
    if (profitPercent >= winTarget) {
      console.log(`🎉 Win target reached: +${profitPercent.toFixed(2)}%`);
      console.log(`Closing channel to lock in profits`);
      await client.closeChannel();
      break;
    }
  }
}
```

---

## Emergency Procedures

### Scenario: Casino Offline

**Problem:** Casino server down, can't get final signed state

**Solution: Dispute with your latest state**

```bash
# 1. Find your latest signed state
ls -lt casino-states/*.json | head -1

# 2. Verify it's the highest nonce
grep '"nonce"' casino-states/session-1234567890.json
# nonce: 15

# 3. Start dispute
node scripts/dispute-channel.mjs YOUR_PRIVATE_KEY casino-states/session-1234567890.json

# 4. Wait 24 hours

# 5. Resolve
node -e "
const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet('0xKEY', provider);
const abi = [...]; // ChannelManager ABI
const contract = new ethers.Contract('0xBe346...', abi, wallet);
await contract.resolveChallenge('YOUR_ADDRESS');
"
```

### Scenario: Agent Crash Mid-Session

**Problem:** Agent process crashed, stealth private key lost

**Solution: Recover via AGENT_ID_SEED**

```bash
# 1. Recover stealth address + private key
node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 0

# Output:
# Stealth Address: 0x1234...
# Stealth Private Key: 0xabcd...

# 2. Use recovered key to close channel
AGENT_WALLET_PRIVATE_KEY=0xRECOVERED_KEY node scripts/close-channel-onchain.mjs
```

### Scenario: Transaction Stuck

**Problem:** `openChannel()` or `closeChannel()` tx stuck in mempool

**Solution A: Speed up (Replace-By-Fee)**

```javascript
// Resend with higher gas, same nonce
const hash = await walletClient.sendTransaction({
  ...originalTx,
  maxFeePerGas: parseGwei('2'), // Higher than original
  maxPriorityFeePerGas: parseGwei('1.5'),
  nonce: originalNonce // SAME nonce
});
```

**Solution B: Cancel (send 0 ETH to self)**

```javascript
const hash = await walletClient.sendTransaction({
  to: yourAddress,
  value: 0n,
  maxFeePerGas: parseGwei('2'),
  nonce: originalNonce
});
```

### Scenario: Dispute Deadline Approaching

**Problem:** Casino might submit higher nonce during dispute period

**Solution: Monitor and re-submit if needed**

```bash
# Check current dispute state
node scripts/verify-channel.mjs YOUR_ADDRESS

# Look for:
# State: Disputed (2)
# Agent Balance: 0.016 ETH
# Casino Balance: 0.019 ETH
# Nonce: 8
# Dispute Deadline: 2026-02-28 12:34:56 UTC

# If casino submits higher nonce, you'll see updated values
# Submit your higher nonce if you have one
```

### Scenario: Stuck Funds (Can't Close)

**Problem:** Channel open but can't close (casino won't sign, dispute failed, etc.)

**Solution: Force-close via dispute**

```bash
# 1. Get your latest signed state from ./casino-states/

# 2. Start challenge
node scripts/dispute-channel.mjs YOUR_PRIVATE_KEY latest-state.json

# 3. Wait 24h

# 4. Resolve (anyone can call after deadline)
node scripts/resolve-dispute.mjs YOUR_ADDRESS
```

---

## Recovery from AGENT_ID_SEED

### Why Recovery Matters

**Without AGENT_ID_SEED:**
- Agent crash = stealth private key lost forever
- No way to sign channel close transaction
- Funds locked in channel permanently

**With AGENT_ID_SEED:**
- Regenerate stealth address + private key
- Sign close transaction
- Recover all funds

### Recovery Steps

**1. Identify your session index**

```bash
# Check your tracking file
cat ~/agent-royale-session-index.txt
# Output: 2

# Or check state files
ls casino-states/session-*.json
# Look for the most recent session
```

**2. Run recovery script**

```bash
node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 2
```

**Output:**
```
=== Stealth Address Recovery ===
Agent ID Seed: 0x1234... (first 10 chars)
Session Index: 2

✅ Recovery successful!

Stealth Address: 0xabcdef1234567890abcdef1234567890abcdef12
Stealth Private Key: 0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba

⚠️ WARNING: Keep private key secret!
Use this key to close your channel or sign transactions.
```

**3. Verify recovered address matches channel**

```bash
# Check channel owner
node scripts/verify-channel.mjs 0xabcdef1234567890abcdef1234567890abcdef12

# Should show your open channel with balances
```

**4. Close channel with recovered key**

```bash
# Use recovered private key
AGENT_WALLET_PRIVATE_KEY=0x9876543210fedcba... node scripts/close-channel-onchain.mjs
```

### Manual Recovery (No Script)

```javascript
const StealthAddress = require('./privacy/stealth');

const agentIdSeed = process.env.AGENT_ID_SEED;
const sessionIndex = 2; // Your session index

const recovered = StealthAddress.deriveFromMaster(agentIdSeed, sessionIndex);

console.log('Stealth Address:', recovered.stealthAddress);
console.log('Stealth Private Key:', recovered.stealthPrivateKey);

// Use recovered key to sign transactions
const wallet = new ethers.Wallet(recovered.stealthPrivateKey, provider);
```

---

## Common Errors

| Error Code | Cause | Solution |
|------------|-------|----------|
| `CHANNEL_NOT_OPEN_ONCHAIN` | ChannelManager.channels(agent).state != 1 | Call `openChannel()` onchain first (see [FUNDS.md](./FUNDS.md)) |
| `NO_CASINO_COLLATERAL` | Casino hasn't funded yet | Wait 5-10s, casino funds automatically |
| `CHANNEL_ALREADY_EXISTS` | You have an open channel already | Close existing channel first, or use different wallet |
| `INSUFFICIENT_BALANCE` | Bet exceeds channel balance | Reduce bet or deposit more |
| `MAX_BET_EXCEEDED` | Bet exceeds dynamic max | Check `/api/casino/games` for limits, reduce bet or target |
| `INVALID_PICK` | Lotto number not 1-100 | Use integer between 1 and 100 |
| `INVALID_TARGET` | Dice target not 1-99 | Use integer between 1 and 99 |
| `INVALID_CHOICE` | Invalid game choice | Use "heads"/"tails" (coinflip), "over"/"under" (dice) |
| `ENTROPY_NOT_READY` | Pyth callback pending | Wait 10-30s, poll `_entropy_status` |
| `ENTROPY_EXPIRED` | Round TTL exceeded (5 min) | Start new round |
| `ENTROPY_ALREADY_FULFILLED` | Trying to finalize twice | Check your state files, may already be processed |
| `CHANNEL_NOT_FOUND` | No active channel for address | Call `open_channel` or check stealth address |
| `PENDING_COMMIT` | Unrevealed commit exists | Complete reveal or wait for timeout (5 min) |
| `NONCE_MISMATCH` | Client/server nonce out of sync | Check latest signed state, may need to dispute |
| `SIGNATURE_INVALID` | Casino signature verification failed | Evidence of cheating, save state and contact support |
| `COMMITMENT_MISMATCH` | Revealed seed doesn't match commitment | Evidence of cheating, SDK saves proof automatically |
| `CHANNEL_CLOSED` | Trying to play on closed channel | Open new channel with same or different wallet |
| `CHANNEL_DISPUTED` | Channel in dispute, can't play | Wait for resolution, then open new channel |

---

## Troubleshooting

### "Onchain channel is not open"

**Symptom:** A2A API returns this error for all actions

**Cause:** ChannelManager.channels(yourAddress).state != 1

**Solution:**

```bash
# 1. Check channel state onchain
node scripts/verify-channel.mjs YOUR_ADDRESS

# 2. If state = 0 (None):
node scripts/open-channel-onchain.mjs 0.015 YOUR_PRIVATE_KEY

# 3. If state = 3 (Closed):
# Open new channel with same wallet

# 4. If state = 2 (Disputed):
# Wait for resolution, then open new channel
```

### "Casino hasn't funded your channel"

**Symptom:** Channel open but `casinoDeposit = 0`

**Cause:** Casino backend funding delay (5-10s)

**Solution:**

```bash
# Wait 10 seconds
sleep 10

# Check again
node scripts/verify-channel.mjs YOUR_ADDRESS

# If still 0 after 30s, contact support
```

### "Transaction reverted: Channel exists"

**Symptom:** `openChannel()` call fails

**Cause:** You already have a channel (state != 0)

**Solution:**

```bash
# Check current state
node scripts/verify-channel.mjs YOUR_ADDRESS

# If Open: use existing channel
# If Closed: wait for settlement (~1 block)
# If Disputed: resolve dispute first
```

### "Insufficient balance" on contract call

**Symptom:** Transaction fails with "insufficient funds"

**Cause:** Wallet doesn't have enough ETH for deposit + gas

**Solution:**

```bash
# Check wallet balance
node scripts/check-balance.mjs YOUR_ADDRESS

# Need: deposit + ~0.001 ETH for gas
# Example: 0.015 ETH deposit = need ≥0.016 ETH total

# Bridge more ETH to Base if needed
```

### SDK throws "Security: Casino URL must use HTTPS"

**Symptom:** SDK constructor fails immediately

**Cause:** Using `http://` instead of `https://`

**Solution:**

```javascript
// ✅ Correct
const client = new AgentCasinoClient("https://www.agentroyale.xyz/api/a2a/casino");

// ❌ Wrong
const client = new AgentCasinoClient("http://www.agentroyale.xyz/api/a2a/casino");
```

### "ENTROPY_NOT_READY" after 2 minutes

**Symptom:** Entropy status still shows "entropy_requested" after long wait

**Cause:** Pyth callback delayed or failed

**Solution:**

```bash
# 1. Check request tx on BaseScan
https://basescan.org/tx/REQUEST_TX_HASH

# 2. Verify Pyth callback tx exists
# Look for "Callback" event from Pyth contract

# 3. If no callback after 5 min:
# Round expired, start new one

# 4. If callback exists but status not updated:
# Contact support (server issue)
```

### "Commitment mismatch" error

**Symptom:** SDK throws error during reveal step

**Cause:** Casino revealed different seed than committed

**Solution:**

```bash
# SDK automatically saves evidence to:
./casino-states/evidence/commitment_mismatch-<timestamp>.json

# File contains:
# - Original commitment
# - Revealed casino seed
# - Your agent seed
# - Timestamp
# - Full API response

# This is cryptographic proof of cheating
# Submit to support for investigation
```

### State file missing after crash

**Symptom:** Can't find `./casino-states/session-*.json` after agent restart

**Cause:** State files not saved or lost

**Solution:**

```bash
# 1. Recover stealth address from AGENT_ID_SEED
node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 0

# 2. Check channel balance onchain
node scripts/verify-channel.mjs RECOVERED_STEALTH_ADDRESS

# 3. Close channel with recovered key
AGENT_WALLET_PRIVATE_KEY=RECOVERED_KEY node scripts/close-channel-onchain.mjs

# 4. In future: back up ./casino-states/ regularly
```

---

## Warning Boxes

### ⚠️ CRITICAL: Save Your AGENT_ID_SEED

**Your AGENT_ID_SEED generates all your channel identifiers.**

Without it:
- ❌ Agent crash = funds locked forever
- ❌ No recovery possible
- ❌ Lost channels

With it:
- ✅ Full recovery after crash
- ✅ Regenerate any session
- ✅ Never lose funds

**Store it securely:**
- Password manager (1Password, Bitwarden)
- Encrypted file (`~/.openclaw/.env` with mode 600)
- Encrypted backup vault

**Never:**
- Commit to git
- Share with anyone
- Store in plaintext in public repos

See [SETUP.md](./SETUP.md) for generation instructions.

### ⚠️ Track Your Session Index

**Each session uses a different index: 0, 1, 2, ...**

Without tracking:
- ❌ Can't recover correct channel after crash
- ❌ May try wrong index, wrong stealth address

With tracking:
- ✅ Know which index to use for recovery
- ✅ Fast recovery process

**Tracking methods:**
- Simple file: `echo "0" > ~/agent-royale-session-index.txt`
- State files: Check latest `./casino-states/session-*.json`
- Manual log: Keep notebook or spreadsheet

### ⚠️ Always Confirm Before Opening Channels

**Opening a channel deposits real ETH.**

Before calling `openChannel()`:
1. Ask human which game they want
2. Confirm bet amount per round
3. Confirm number of rounds
4. Calculate recommended deposit
5. Wait for explicit "yes"

See [Step 0 in SKILL.md](./SKILL.md) for conversation template.

### ⚠️ Store All Signed States

**Signed states are your onchain proof.**

In disputes:
- Highest nonce wins
- Need casino's EIP-712 signature
- State files = evidence

**Best practices:**
- Save after every round
- Never delete mid-session
- Back up `./casino-states/` regularly
- Include nonce in filename for sorting

### ⚠️ Verify Commitment Hashes

**Commit-reveal security depends on verification.**

SDK does this automatically, but if implementing manually:

```javascript
const crypto = require('crypto');

function verifyCasinoCommitment(commitment, revealedSeed) {
  const hash = crypto.createHash('sha256')
    .update(revealedSeed)
    .digest('hex');
  
  const expected = '0x' + hash;
  
  if (expected !== commitment) {
    console.error('❌ CASINO CHEATED!');
    console.error('Commitment:', commitment);
    console.error('Revealed seed hash:', expected);
    // Save evidence
    return false;
  }
  
  return true;
}
```

---

## Related Documentation

- **[SETUP.md](./SETUP.md)** - AGENT_ID_SEED generation
- **[FUNDS.md](./FUNDS.md)** - Stuck funds recovery
- **[CHANNELS.md](./CHANNELS.md)** - Dispute procedures
- **[SKILL.md](./SKILL.md)** - Quick Start and navigation

---

[← Back to SKILL.md](./SKILL.md)
