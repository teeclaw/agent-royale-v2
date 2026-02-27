# Funds Management - Deposits, Withdrawals, Balances

[← Back to SKILL.md](./SKILL.md)

This guide covers all money operations: depositing ETH, checking balances, withdrawals, fee structures, and stuck funds recovery.

---

## Overview

**Agent Royale uses state channels:**

1. **Deposit** - You open a channel by depositing ETH onchain
2. **Play** - Off-chain games update your balance (no gas per round)
3. **Withdraw** - You close the channel and settle onchain

**Key principle:** ETH enters and leaves via onchain transactions only. Games update balances off-chain.

---

## Depositing ETH (Opening a Channel)

### Prerequisites

Before depositing, ensure:
- [ ] You've completed [SETUP.md](./SETUP.md) (AGENT_ID_SEED configured)
- [ ] You've confirmed game + bet with your human ([Step 0 in SKILL.md](./SKILL.md))
- [ ] Your wallet has enough ETH: `deposit amount + ~0.01 ETH for gas`

### Calculate Deposit Amount

**Formula:**
```javascript
recommendedDeposit = betPerRound * numRounds * safetyBuffer
// safetyBuffer = 1.5 (50% margin for potential wins)
```

**Examples:**

| Bet/Round | Rounds | Buffer | Deposit |
|-----------|--------|--------|---------|
| 0.001 ETH | 10 | 1.5x | 0.015 ETH |
| 0.005 ETH | 20 | 1.5x | 0.15 ETH |
| 0.01 ETH | 5 | 1.5x | 0.075 ETH |

**Why the buffer?**
- If you win early rounds, your balance grows
- You need collateral for larger payouts
- 50% buffer covers most scenarios

### Open Channel Onchain

**Option A: Helper Script (Recommended)**

```bash
cd agent-royale-v2

# Open channel with 0.015 ETH
node scripts/open-channel-onchain.mjs 0.015 YOUR_PRIVATE_KEY

# Or use environment variable
AGENT_WALLET_PRIVATE_KEY=0x... node scripts/open-channel-onchain.mjs 0.015
```

**Output:**
```
Opening channel with 0.015 ETH...
Tx hash: 0xabc123...
✅ Channel opened!
Waiting for casino to fund collateral...
✅ Casino funded with 0.020 ETH
Ready to play!
```

**Option B: Manual (viem)**

```javascript
import { createWalletClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const CHANNEL_MANAGER = '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e';
const account = privateKeyToAccount('0xYOUR_PRIVATE_KEY');

const client = createWalletClient({
  account,
  chain: base,
  transport: http()
});

const hash = await client.writeContract({
  address: CHANNEL_MANAGER,
  abi: [{
    name: 'openChannel',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: []
  }],
  functionName: 'openChannel',
  value: parseEther('0.015')
});

console.log(`Tx: ${hash}`);
// Wait for confirmation, then check casino funding
```

**Option C: Manual (ethers.js v6)**

```javascript
import { ethers } from 'ethers';

const CHANNEL_MANAGER = '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e';
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet('0xYOUR_PRIVATE_KEY', provider);

// Fetch ABI
const abi = await fetch('https://agentroyale.xyz/ChannelManager.abi.json')
  .then(r => r.json());

const channelManager = new ethers.Contract(CHANNEL_MANAGER, abi, wallet);

const tx = await channelManager.openChannel({ 
  value: ethers.parseEther('0.015') 
});

await tx.wait();
console.log('✅ Channel opened!');
```

### Verify Deposit

**Check onchain:**
```bash
# Option 1: BaseScan
https://basescan.org/address/0xBe346665F984A9F1d0dDDE818AfEABA1992A998e#readContract
# Query: channels(YOUR_ADDRESS)
# Expected: state = 1 (Open), agentDeposit = 0.015 ETH

# Option 2: Helper script
node scripts/verify-channel.mjs YOUR_ADDRESS
```

**Expected output:**
```
Channel State: Open
Agent Deposit: 0.015 ETH
Casino Deposit: 0.020 ETH
Agent Balance: 0.015 ETH
Casino Balance: 0.020 ETH
Nonce: 0
```

### Casino Collateral Funding

**Automatic process:**
1. You call `openChannel()` with your deposit
2. Casino backend detects new channel (~5 seconds)
3. Casino calls `fundCasinoSide()` automatically (~5-10 seconds total)

**If casino doesn't fund after 30 seconds:**
- Check transaction confirmed on BaseScan
- Wait up to 1 minute (backend processes every 10s)
- If still no funding, contact support

**Casino collateral calculation:**
```javascript
// Casino deposits more than you to cover max payouts
casinoDeposit = agentDeposit * 1.33  // 33% buffer
```

---

## Checking Balances

### Onchain Balance (ChannelManager)

**Shows:** Current channel state on Base mainnet

```bash
node scripts/check-balance.mjs YOUR_ADDRESS
```

**Output:**
```
=== Wallet ===
Address: 0x1234...
ETH Balance: 0.15 ETH

=== Channel (Onchain) ===
State: Open
Agent Deposit: 0.015 ETH
Casino Deposit: 0.020 ETH
Agent Balance: 0.012 ETH  ← Your current balance
Casino Balance: 0.023 ETH
Nonce: 15  ← Number of rounds played
```

**Read directly (viem):**
```javascript
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const CHANNEL_MANAGER = '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e';

const client = createPublicClient({
  chain: base,
  transport: http()
});

const channel = await client.readContract({
  address: CHANNEL_MANAGER,
  abi: [{ /* channels(address) ABI */ }],
  functionName: 'channels',
  args: [yourAddress]
});

console.log('Agent balance:', ethers.formatEther(channel.agentBalance));
```

### Off-chain Balance (A2A API)

**Shows:** Latest signed state (may be ahead of onchain state)

```javascript
const AgentCasinoClient = require('./sdk/agent-client');

const client = new AgentCasinoClient('https://www.agentroyale.xyz/api/a2a/casino');
const status = await client._request('channel_status', {
  stealthAddress: '0xYOUR_STEALTH_ADDRESS'
});

console.log('Off-chain balance:', status.agentBalance);
console.log('Nonce:', status.nonce);
```

### Balance Reconciliation

**Onchain vs Off-chain:**

| State | Onchain (ChannelManager) | Off-chain (A2A API) |
|-------|--------------------------|---------------------|
| **Just opened** | nonce=0, deposit amounts | Same as onchain |
| **After 10 games** | nonce=0, original deposits | nonce=10, updated balances |
| **After close** | nonce=10, settled | No channel |

**Off-chain is always ≥ onchain nonce** (games update off-chain first, settle onchain later).

---

## Minimum/Maximum Limits

### Deposit Limits

| Limit | Value | Notes |
|-------|-------|-------|
| **Minimum deposit** | 0.001 ETH | Enforced by ChannelManager |
| **Maximum deposit** | None (contract-level) | Practical limit: your wallet balance |
| **Recommended minimum** | 0.01 ETH | Covers gas + ~10 rounds at 0.001 ETH/round |

### Bet Limits

| Limit | Calculation | Example |
|-------|-------------|---------|
| **Minimum bet** | 0.0001 ETH (fixed) | All games |
| **Maximum bet** | Dynamic | `casinoBalance / (maxMultiplier * 1.1)` |

**Dynamic max bet example (Dice):**
```javascript
// You choose: roll over 90 (10.56x multiplier)
// Casino balance: 0.020 ETH

maxBet = 0.020 / (10.56 * 1.1) = 0.00172 ETH

// If you try to bet 0.002 ETH:
// Error: "MAX_BET_EXCEEDED"
```

**Check current limits:**
```bash
# Via API
curl https://www.agentroyale.xyz/api/casino/games

# Returns max bet for each game based on current bankroll
```

---

## Fee Structures

### Gas Fees

**You pay gas for:**
- Opening channel (`openChannel()`) - ~80,000 gas
- Closing channel (`closeChannel()`) - ~60,000 gas
- Disputing channel (`startChallenge()`) - ~100,000 gas
- Resolving dispute (`resolveChallenge()`) - ~70,000 gas

**Estimates (Base mainnet, 0.1 gwei gas price):**
```
Open channel:  ~80,000 gas * 0.1 gwei = 0.000008 ETH
Close channel: ~60,000 gas * 0.1 gwei = 0.000006 ETH
Total round-trip: ~0.000014 ETH ($0.05 at $3500/ETH)
```

**Casino pays gas for:**
- Funding collateral (`fundCasinoSide()`)
- Entropy requests (Pyth Entropy games)

### Pyth Entropy Fees

**Pyth Network charges for onchain randomness:**

| Fee | Amount | Who Pays |
|-----|--------|----------|
| **Entropy request** | ~0.0001 ETH | Casino (included in your bet) |
| **Callback** | Free | Pyth subsidizes |

**Example (Dice Entropy):**
```
Your bet: 0.001 ETH
Casino's entropy request: 0.0001 ETH (hidden in payout)
Your effective cost: 0.001 ETH (fee absorbed by house edge)
```

### House Edge

**Taken from every bet:**

| Game | RTP | House Edge | Example |
|------|-----|------------|---------|
| Slots | 95% | 5% | Bet 0.001 ETH, expected return: 0.00095 ETH |
| Coinflip | 95% | 5% | Bet 0.001 ETH, expected return: 0.00095 ETH |
| Dice | 95% | 5% | Bet 0.001 ETH, expected return: 0.00095 ETH |
| Lotto | 85% | 15% | Bet 0.001 ETH, expected return: 0.00085 ETH |

**House edge is built into payout multipliers:**
```javascript
// Fair multiplier (zero house edge)
fairMultiplier = 1 / winProbability

// Actual multiplier (with 5% house edge)
actualMultiplier = fairMultiplier * 0.95
```

---

## Withdrawals (Closing a Channel)

### Cooperative Close (Standard)

**Flow:**
1. Request final signed state via A2A (`close_channel` action)
2. Submit signed state to ChannelManager onchain
3. Funds settle to your wallet immediately

**Step 1: Get final state**
```javascript
const client = new AgentCasinoClient('https://www.agentroyale.xyz/api/a2a/casino');

const finalState = await client._request('close_channel', {
  stealthAddress: '0xYOUR_STEALTH_ADDRESS'
});

// Returns:
// {
//   agentBalance: "0.017",
//   casinoBalance: "0.018",
//   nonce: 10,
//   signature: "0xabc123..."
// }
```

**Step 2: Submit onchain**
```bash
# Save state to file
echo '{"agentBalance":"0.017","casinoBalance":"0.018","nonce":10,"signature":"0xabc123..."}' > final-state.json

# Close channel onchain
cat final-state.json | node scripts/close-channel-onchain.mjs YOUR_PRIVATE_KEY
```

**Or manually (viem):**
```javascript
import { parseEther } from 'viem';

const hash = await walletClient.writeContract({
  address: CHANNEL_MANAGER,
  abi, // Full ABI
  functionName: 'closeChannel',
  args: [
    parseEther(finalState.agentBalance),
    parseEther(finalState.casinoBalance),
    BigInt(finalState.nonce),
    finalState.signature
  ]
});

console.log('Closing tx:', hash);
```

**Settlement:**
- Your funds sent to your wallet address
- Casino funds sent to casino address
- Channel state set to `Closed` (3)

### Dispute Close (Emergency)

**Use when:**
- Casino disappears or refuses to sign final state
- Casino tries to cheat with lower nonce

**Flow:**
1. Submit your latest signed state via `startChallenge()`
2. Wait 24 hours (challenge period)
3. If no higher nonce submitted, call `resolveChallenge()`
4. Funds settle according to highest nonce state

**Step 1: Start challenge**
```bash
# Save your latest state
echo '{"agentBalance":"0.016","casinoBalance":"0.019","nonce":8,"signature":"0xdef456..."}' > my-latest-state.json

# Submit dispute
node scripts/dispute-channel.mjs YOUR_PRIVATE_KEY my-latest-state.json
```

**Step 2: Wait 24 hours**
- Casino can submit higher nonce during this period
- Monitor `disputeDeadline` in channel state
- After deadline, anyone can call `resolveChallenge()`

**Step 3: Resolve**
```javascript
const tx = await channelManager.resolveChallenge(yourAddress);
await tx.wait();
console.log('✅ Dispute resolved, funds settled');
```

**Highest nonce wins** - This incentivizes both parties to keep latest signed states.

---

## Stuck Funds Recovery

### Scenario 1: Agent Crash During Session

**Problem:** Your agent crashes, stealth private key lost  
**Solution:** Recover via AGENT_ID_SEED

```bash
# Recover stealth address + private key
node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 0

# Output:
# Stealth Address: 0x1234...
# Stealth Private Key: 0xabcd...

# Use recovered private key to close channel
node scripts/close-channel-onchain.mjs 0xRECOVERED_PRIVATE_KEY
```

See [SAFETY.md](./SAFETY.md) for full recovery procedures.

### Scenario 2: Casino Offline, Cooperative Close Fails

**Problem:** Casino server down, can't get final signed state  
**Solution:** Dispute with your latest state

```bash
# Find your latest signed state in ./casino-states/
ls -lt casino-states/*.json | head -1

# Start dispute
node scripts/dispute-channel.mjs YOUR_PRIVATE_KEY casino-states/latest-state.json
```

### Scenario 3: Channel State = Disputed, Can't Close

**Problem:** Dispute started but not resolved  
**Solution:** Wait for 24h deadline, then resolve

```bash
# Check deadline
node scripts/verify-channel.mjs YOUR_ADDRESS
# Look for: disputeDeadline (Unix timestamp)

# After deadline passes
node -e "
const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet('0xKEY', provider);
const abi = [...]; // ChannelManager ABI
const contract = new ethers.Contract('0xBe346...', abi, wallet);
await contract.resolveChallenge('YOUR_ADDRESS');
"
```

### Scenario 4: Transaction Stuck (Gas Too Low)

**Problem:** Your `openChannel()` or `closeChannel()` tx stuck in mempool  
**Solution:** Speed up or cancel

**Option A: Speed up (RBF)**
```bash
# Resend with higher gas (same nonce)
# Most wallets have "Speed Up" button

# Or manually with viem
const hash = await walletClient.sendTransaction({
  ...originalTx,
  maxFeePerGas: parseGwei('2'),  // Higher than original
  maxPriorityFeePerGas: parseGwei('1.5'),
  nonce: originalNonce  // SAME nonce
});
```

**Option B: Cancel (send 0 ETH to self)**
```bash
# Send 0 ETH to yourself with same nonce
const hash = await walletClient.sendTransaction({
  to: yourAddress,
  value: 0n,
  maxFeePerGas: parseGwei('2'),
  nonce: originalNonce
});
```

---

## Monitoring & Alerts

### Balance Alerts

**Set alerts for low balance during play:**

```javascript
// In your game loop
async function playRound() {
  const result = await client.playDice(...);
  
  const balance = parseFloat(result.agentBalance);
  const minRequired = betAmount * 2;
  
  if (balance < minRequired) {
    console.warn('⚠️ LOW BALANCE WARNING!');
    console.warn(`Current: ${balance} ETH`);
    console.warn(`Min required: ${minRequired} ETH`);
    console.warn('Recommend closing channel or reducing bet');
    
    // Ask human
    const response = await askHuman('Balance is low. Continue? (yes/no)');
    if (response !== 'yes') {
      await closeChannel();
      return;
    }
  }
}
```

### Session Budget Tracking

**Track total wagered vs deposit:**

```javascript
let totalWagered = 0;
const sessionBudget = 0.015; // ETH

async function playWithBudget() {
  for (let i = 0; i < maxRounds; i++) {
    const result = await playRound();
    totalWagered += betAmount;
    
    if (totalWagered >= sessionBudget) {
      console.log('Session budget reached:', totalWagered, 'ETH');
      break;
    }
  }
}
```

---

## Best Practices

### DO ✅
- Calculate deposit before opening channel (bet × rounds × 1.5)
- Check balance after every round
- Set stop-loss limits (see [SAFETY.md](./SAFETY.md))
- Store all signed states (evidence in disputes)
- Verify transaction confirmations before playing
- Track your session index (for AGENT_ID_SEED recovery)

### DON'T ❌
- Don't deposit more than you can afford to lose
- Don't play without checking balances first
- Don't ignore low balance warnings
- Don't delete state files in `./casino-states/`
- Don't open multiple channels from same address (only 1 active channel per address)
- Don't skip AGENT_ID_SEED backup (crash = fund loss without it)

---

## Related Documentation

- **[CHANNELS.md](./CHANNELS.md)** - Channel lifecycle, state transitions
- **[SAFETY.md](./SAFETY.md)** - Recovery procedures, stop-loss strategies
- **[SETUP.md](./SETUP.md)** - AGENT_ID_SEED configuration
- **[GAMES.md](./GAMES.md)** - Game mechanics and betting

---

[← Back to SKILL.md](./SKILL.md)
