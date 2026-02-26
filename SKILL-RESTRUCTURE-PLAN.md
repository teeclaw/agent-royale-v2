# SKILL.md Restructure Plan

## Problem Analysis

**Current State:** SKILL.md jumps to A2A API without explaining onchain prerequisites. Step 2 "Open a channel" claims it's done via A2A, but that's incorrect - the A2A endpoint **checks** for an existing onchain channel, it doesn't create one.

**Critical Gap:** An agent following the current docs will hit "Onchain channel is not open" error with no clear solution.

**Missing Elements:**
1. Onchain channel opening instructions
2. Reference to helper scripts
3. Contract ABIs and manual interaction methods
4. Clear separation of onchain vs off-chain operations
5. Troubleshooting for onchain/off-chain sync issues
6. Channel closing scripts/instructions

---

## Proposed Structure

### 1. Quick Start (NEW - Top Section)

**Goal:** Get agents playing in <5 minutes with reference scripts

**Contents:**
```
## Quick Start (3 Steps)

### Prerequisites
- Node.js 18+
- Private key with ≥0.1 ETH on Base mainnet
- (Optional) Master key for session recovery

### Step 1: Open Channel (Onchain)
Use the reference script:

```bash
# Clone repo or download scripts
git clone https://github.com/teeclaw/agent-royale-v2
cd agent-royale-v2

# Install dependencies
npm install

# Open channel with 0.1 ETH
node scripts/open-channel-onchain.mjs 0.1 YOUR_PRIVATE_KEY

# Or use env var:
AGENT_WALLET_PRIVATE_KEY=0x... node scripts/open-channel-onchain.mjs 0.1
```

**What this does:**
- Calls `ChannelManager.openChannel()` on Base mainnet
- Deposits your ETH into the channel contract
- Verifies channel opened successfully
- Returns your channel state

**Verify onchain:**
```bash
# Check channel status on BaseScan
https://basescan.org/address/0xBe346665F984A9F1d0dDDE818AfEABA1992A998e#readContract
# Query: channels(yourAddress)
# Expected: state = 1 (Open)
```

### Step 2: Play Games (Off-chain via A2A)

Now use the A2A endpoint to play games:

```bash
# Play 5 spins using SDK
node sdk/examples/play-slots.js https://www.agentroyale.xyz/api/a2a/casino 0.1 0.001 5
```

Or build your own A2A client (see "A2A API Reference" below).

### Step 3: Close Channel (Onchain)

```bash
# Cooperative close (coming soon: close-channel-onchain.mjs)
# Manual method: see "Manual Channel Management" section
```

**Security Note:** These scripts are reference implementations. Audit before production use.
```

---

### 2. How It Works (E2E) - RESTRUCTURE

**Change:** Clearly separate onchain vs off-chain steps

**New Flow:**

```
## How It Works (End to End)

Agent Royale uses a **hybrid architecture**: onchain channels (trustless) + off-chain games (fast).

### The Full Journey

┌─────────────────────────────────────────────────────────────┐
│ ONCHAIN (Base Mainnet)                                       │
├─────────────────────────────────────────────────────────────┤
│ 1. Agent deposits ETH → ChannelManager.openChannel()        │
│ 2. Casino deposits collateral → ChannelManager.fundCasinoSide() │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ OFF-CHAIN (A2A API)                                          │
├─────────────────────────────────────────────────────────────┤
│ 3. Play games: slots, coinflip, dice, lotto                 │
│    - Commit-reveal randomness (fast)                        │
│    - OR Pyth Entropy randomness (verifiable)                │
│ 4. Every round: both parties sign new state (EIP-712)       │
│ 5. Balances update after each game                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ ONCHAIN (Base Mainnet)                                       │
├─────────────────────────────────────────────────────────────┤
│ 6. Cooperative close → ChannelManager.closeChannel()        │
│    OR                                                        │
│ 7. Dispute close → ChannelManager.startChallenge()          │
│ 8. Funds settle to agent + casino addresses                 │
└─────────────────────────────────────────────────────────────┘

### Why This Design?

**Onchain = Trustless**
- Channel opening/closing is on Base mainnet
- Funds are secured by smart contracts
- Disputes are settled onchain (24h challenge period)

**Off-chain = Fast**
- Games run at API speed (no gas, no block times)
- Hundreds of rounds per second possible
- Still verifiable via EIP-712 signatures + commit-reveal

**Best of both:** Security of blockchain + speed of traditional servers.
```

---

### 3. Manual Channel Management (NEW Section)

**Goal:** Agents who don't want to use scripts can interact directly

**Contents:**
```
## Manual Channel Management

If you prefer manual contract interaction over scripts:

### Get the ABI

**Web:** https://agentroyale.xyz/ChannelManager.abi.json
**GitHub:** https://raw.githubusercontent.com/teeclaw/agent-royale-v2/main/ChannelManager.abi.json

### Open Channel (ethers.js v6)

```javascript
import { ethers } from 'ethers';

const CHANNEL_MANAGER = '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e';
const BASE_RPC = 'https://mainnet.base.org';

const provider = new ethers.JsonRpcProvider(BASE_RPC);
const wallet = new ethers.Wallet(yourPrivateKey, provider);

// Load ABI
const abi = await fetch('https://agentroyale.xyz/ChannelManager.abi.json')
  .then(r => r.json());

const channelManager = new ethers.Contract(CHANNEL_MANAGER, abi, wallet);

// Check if channel already exists
const existing = await channelManager.channels(wallet.address);
if (existing.state !== 0) {
  throw new Error('Channel already exists');
}

// Open channel with 0.1 ETH deposit
const tx = await channelManager.openChannel({ 
  value: ethers.parseEther('0.1') 
});

console.log(`Tx sent: ${tx.hash}`);
await tx.wait();

console.log('Channel opened!');

// Verify
const channel = await channelManager.channels(wallet.address);
console.log('State:', channel.state); // 1 = Open
console.log('Deposit:', ethers.formatEther(channel.agentDeposit), 'ETH');
```

### Read Channel State

```javascript
const channel = await channelManager.channels(agentAddress);

console.log({
  agentDeposit: ethers.formatEther(channel.agentDeposit),
  casinoDeposit: ethers.formatEther(channel.casinoDeposit),
  agentBalance: ethers.formatEther(channel.agentBalance),
  casinoBalance: ethers.formatEther(channel.casinoBalance),
  nonce: channel.nonce.toString(),
  state: channel.state, // 0=None, 1=Open, 2=Disputed, 3=Closed
  openedAt: new Date(Number(channel.openedAt) * 1000)
});
```

### Close Channel (Cooperative)

**Requirements:**
- Latest signed state from A2A API
- Casino's EIP-712 signature

```javascript
// Get final state from A2A close_channel response
const { agentBalance, casinoBalance, nonce, signature } = finalState;

const tx = await channelManager.closeChannel(
  ethers.parseEther(agentBalance),
  ethers.parseEther(casinoBalance),
  nonce,
  signature
);

await tx.wait();
console.log('Channel closed. Funds settled.');
```

### Dispute (If Casino Disappears)

```javascript
const tx = await channelManager.startChallenge(
  ethers.parseEther(lastKnownAgentBalance),
  ethers.parseEther(lastKnownCasinoBalance),
  lastKnownNonce,
  lastKnownCasinoSignature
);

await tx.wait();
console.log('Challenge started. Wait 24h, then call resolveChallenge()');
```

### Contract Interface (Minimal ABI)

If you only need specific functions:

```json
[
  {
    "name": "openChannel",
    "type": "function",
    "stateMutability": "payable",
    "inputs": [],
    "outputs": []
  },
  {
    "name": "channels",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{ "name": "agent", "type": "address" }],
    "outputs": [
      { "name": "agentDeposit", "type": "uint256" },
      { "name": "casinoDeposit", "type": "uint256" },
      { "name": "agentBalance", "type": "uint256" },
      { "name": "casinoBalance", "type": "uint256" },
      { "name": "nonce", "type": "uint256" },
      { "name": "openedAt", "type": "uint256" },
      { "name": "disputeDeadline", "type": "uint256" },
      { "name": "state", "type": "uint8" }
    ]
  },
  {
    "name": "closeChannel",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "agentBalance", "type": "uint256" },
      { "name": "casinoBalance", "type": "uint256" },
      { "name": "nonce", "type": "uint256" },
      { "name": "casinoSig", "type": "bytes" }
    ],
    "outputs": []
  }
]
```
```

---

### 4. Common Errors - ADD NEW ENTRIES

**Add to existing table:**

```markdown
| Error Code | Cause | Solution |
|------------|-------|----------|
| ... (existing errors) ... |
| `CHANNEL_NOT_OPEN_ONCHAIN` | ChannelManager.channels(agent).state != 1 | Run `scripts/open-channel-onchain.mjs` first |
| `NO_CASINO_COLLATERAL` | Casino hasn't funded your channel yet | Wait 5-10s, casino funds automatically after you open |
| `CHANNEL_ALREADY_EXISTS` | You already have an open channel | Close existing channel first, or use different wallet |
```

---

### 5. Troubleshooting (NEW Section)

**Goal:** Debug common onchain/off-chain sync issues

**Contents:**
```
## Troubleshooting

### "Onchain channel is not open"

**Symptom:** A2A endpoint returns this error when you call any action

**Cause:** The API checks `ChannelManager.channels(yourAddress).state` on Base mainnet. If it's not `1` (Open), all actions are blocked.

**Solution:**

1. **Verify your channel onchain:**
   ```bash
   # Check on BaseScan
   https://basescan.org/address/0xBe346665F984A9F1d0dDDE818AfEABA1992A998e#readContract
   # Query: channels(YOUR_ADDRESS)
   ```

2. **If state = 0 (None):** Channel doesn't exist, run:
   ```bash
   node scripts/open-channel-onchain.mjs 0.1 YOUR_PRIVATE_KEY
   ```

3. **If state = 3 (Closed):** Channel was already closed, open a new one with a different wallet or wait for settlement

4. **If state = 2 (Disputed):** Wait for 24h challenge period, then resolve

### "Casino hasn't funded your channel"

**Symptom:** Channel is open but `casinoDeposit = 0`

**Cause:** Casino backend funds channels automatically but there's a 5-10 second delay

**Solution:** Wait 10 seconds, then check again. If still zero after 30s, contact support.

### "Transaction reverted: Channel exists"

**Symptom:** `openChannel()` call fails

**Cause:** You already have a channel (state != 0)

**Solution:** 
- Check `channels(yourAddress).state`
- If Open: use existing channel
- If Closed: wait for settlement to complete
- If Disputed: resolve dispute first

### "Insufficient balance" on contract call

**Symptom:** Transaction fails with "insufficient funds" error

**Cause:** Your wallet doesn't have enough ETH for deposit + gas

**Solution:**
```bash
# Check balance on Base
https://basescan.org/address/YOUR_ADDRESS

# You need: deposit amount + ~0.001 ETH for gas
# Example: 0.1 ETH deposit = need ≥0.101 ETH total
```

### SDK throws "Security: Casino URL must use HTTPS"

**Symptom:** SDK constructor fails immediately

**Cause:** You're using `http://` instead of `https://`

**Solution:** Always use HTTPS:
```javascript
// ✅ Correct
const client = new AgentCasinoClient("https://www.agentroyale.xyz");

// ❌ Wrong
const client = new AgentCasinoClient("http://www.agentroyale.xyz");
```
```

---

### 6. Scripts Reference (NEW Section)

**Goal:** Document all helper scripts for agents

**Contents:**
```
## Helper Scripts

All scripts are in the `scripts/` directory. They're reference implementations - audit before production use.

### Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `open-channel-onchain.mjs` | Open channel on Base mainnet | `node scripts/open-channel-onchain.mjs <depositETH> [privateKey]` |
| `close-channel-onchain.mjs` | Close channel cooperatively | (Coming soon) |
| `verify-channel.mjs` | Check channel state onchain | (Coming soon) |

### Script Security

**What the scripts do:**
- Read your private key (from arg or env var)
- Connect to Base mainnet RPC
- Call ChannelManager contract functions
- Return transaction hashes and results

**What they DON'T do:**
- Send your private key anywhere
- Make external HTTP calls (except to Base RPC)
- Store data on disk (except transaction logs)
- Access any third-party services

**Audit checklist:**
1. ✅ Check they only import ethers.js and fs (no suspicious packages)
2. ✅ Verify RPC URL is official Base endpoint
3. ✅ Confirm contract addresses match docs
4. ✅ Review ABI calls (should only be ChannelManager functions)
5. ✅ No eval(), exec(), or dynamic code execution

**Source code:** https://github.com/teeclaw/agent-royale-v2/tree/main/scripts
```

---

## Summary of Changes

### New Sections (Add)
1. **Quick Start** (top, before "How It Works")
2. **Manual Channel Management** (after "How It Works")
3. **Troubleshooting** (after "Common Errors")
4. **Helper Scripts** (after "Troubleshooting")

### Modified Sections (Restructure)
1. **How It Works** - Add onchain/off-chain flow diagram
2. **Common Errors** - Add onchain sync errors
3. **Step 2** - Change from "A2A opens channel" to "Open channel onchain first"
4. **Step 5** - Add reference to close scripts

### Critical Fixes
1. ❌ Remove claim that A2A `open_channel` opens the channel onchain
2. ✅ Add explicit "Open channel onchain FIRST" instruction
3. ✅ Link to helper scripts at every onchain operation
4. ✅ Provide manual alternatives for agents who want control
5. ✅ Add troubleshooting for sync issues

---

## Document Flow (After Restructure)

```
1. Quick Start (3 steps with scripts)
   ↓
2. How It Works (E2E with onchain/off-chain diagram)
   ↓
3. Manual Channel Management (for advanced users)
   ↓
4. Games (detailed specs) [NO CHANGE]
   ↓
5. Dual Randomness (commit-reveal vs entropy) [NO CHANGE]
   ↓
6. Response Examples [NO CHANGE]
   ↓
7. Common Errors (+ onchain sync errors)
   ↓
8. Troubleshooting (new)
   ↓
9. Helper Scripts (new)
   ↓
10. Security & Recovery [NO CHANGE]
   ↓
11. Do/Don't [NO CHANGE]
   ↓
12. Limitations [NO CHANGE]
   ↓
13. Contracts [NO CHANGE]
   ↓
14. API Actions [NO CHANGE]
```

---

## Priority

**High (Must Fix Before Next Agent Tests):**
1. Quick Start section (scripts path is critical)
2. Step 2 correction (open onchain first)
3. Troubleshooting section (agents will hit these errors)
4. Common Errors additions (onchain sync)

**Medium (Important but not blocking):**
5. Manual Channel Management (for advanced agents)
6. Helper Scripts reference (documentation)
7. Flow diagram (visual clarity)

**Low (Nice to have):**
8. close-channel-onchain.mjs script (can close manually for now)
9. verify-channel.mjs script (can check on BaseScan)

---

## Implementation Plan

1. **First:** Add Quick Start at top (immediate value)
2. **Second:** Fix Step 2 in "How It Works" (critical correction)
3. **Third:** Add Troubleshooting section (debug support)
4. **Fourth:** Add Manual Channel Management (completeness)
5. **Fifth:** Add Helper Scripts reference (documentation)
6. **Sixth:** Enhance with flow diagrams (polish)

Total estimated time: 1-2 hours
Lines added: ~500-700
Files changed: 1 (SKILL.md)
