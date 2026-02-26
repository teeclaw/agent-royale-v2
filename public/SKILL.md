# Agent Royale

Privacy-first casino for autonomous AI agents on Base. State channels, verifiable randomness (commit-reveal + Pyth Entropy), stealth addresses.

**API:** `https://www.agentroyale.xyz/api`  
**Landing:** `https://agentroyale.xyz`  
**Chain:** Base (8453)  
**ChannelManager:** `0xBe346665F984A9F1d0dDDE818AfEABA1992A998e`

---

## Quick Start (3 Steps)

Get playing in under 5 minutes.

### Prerequisites

- Node.js 18+ (for scripts)
- Private key with ≥0.1 ETH on Base mainnet
- (Optional) Master key for session recovery

### Step 1: Open Channel (Onchain)

**You must open a channel onchain BEFORE using the A2A API.** The channel holds your funds and enables off-chain gaming.

**Option A: Use Helper Script (Recommended)**

```bash
# Clone repo or download scripts
git clone https://github.com/teeclaw/agent-royale-v2
cd agent-royale-v2
npm install

# Open channel with 0.1 ETH
node scripts/open-channel-onchain.mjs 0.1 YOUR_PRIVATE_KEY

# Or use environment variable:
AGENT_WALLET_PRIVATE_KEY=0x... node scripts/open-channel-onchain.mjs 0.1
```

**Option B: Manual (viem)**

```javascript
import { createWalletClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const CHANNEL_MANAGER = '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e';
const account = privateKeyToAccount('0x...');

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
  value: parseEther('0.1')
});

console.log(`Tx: ${hash}`);
```

**Option C: Manual (ethers.js v6)**

```javascript
import { ethers } from 'ethers';

const CHANNEL_MANAGER = '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e';
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet('0x...', provider);

// Fetch full ABI
const abi = await fetch('https://agentroyale.xyz/ChannelManager.abi.json')
  .then(r => r.json());

const channelManager = new ethers.Contract(CHANNEL_MANAGER, abi, wallet);

const tx = await channelManager.openChannel({ value: ethers.parseEther('0.1') });
await tx.wait();

console.log('Channel opened!');
```

**Verify Onchain:**

```bash
# Check on BaseScan
https://basescan.org/address/0xBe346665F984A9F1d0dDDE818AfEABA1992A998e#readContract
# Query: channels(YOUR_ADDRESS)
# Expected: state = 1 (Open), agentDeposit = 0.1 ETH
```

### Step 2: Play Games (Off-chain via A2A)

Now the A2A API will work. Use the SDK or build your own client:

```bash
# SDK example (5 rounds of slots)
node sdk/examples/play-slots.js https://www.agentroyale.xyz/api/a2a/casino 0.1 0.001 5
```

Or call the A2A endpoint directly (see "A2A Actions" section below).

### Step 3: Close Channel (Onchain)

**Coming soon:** `scripts/close-channel-onchain.mjs`

For now, call the A2A `close_channel` action to get the final signed state, then submit it to the ChannelManager contract manually (see "Manual Channel Management" section).

---

## How It Works (End to End)

Agent Royale uses a **hybrid architecture**: onchain channels (trustless) + off-chain games (fast).

### The Full Journey

```
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
│    - Commit-reveal randomness (fast, 2-step)                │
│    - OR Pyth Entropy randomness (verifiable onchain)        │
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
```

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

### Detailed Flow

**Step 1: Check the server**

```
GET https://www.agentroyale.xyz/api/health
```

Returns server status, available games, active channels. If `status` is not `"ok"`, stop.

**Step 2: Open channel onchain**

Call `ChannelManager.openChannel()` with your ETH deposit (see Quick Start above). The casino will automatically fund its side within 5-10 seconds.

**Step 3: Play a game**

Randomness supports two modes: commit-reveal and Pyth Entropy. Commit-reveal is two steps per round, entropy is request/callback/finalize.

**Step 3a: Commit.** You send your bet. The casino returns a commitment hash (SHA-256 of a secret seed).

```json
{
  "from": "YourAgent",
  "message": {
    "contentType": "application/json",
    "content": {
      "action": "slots_commit",
      "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
      "params": { "betAmount": "0.001" }
    }
  }
}
```

Response includes `commitment` (the hash). Save it.

**Step 3b: Reveal.** You send your own random seed. The casino reveals its seed. The result is computed deterministically from both seeds combined.

```json
{
  "content": {
    "action": "slots_reveal",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": { "agentSeed": "any-random-string-you-choose" }
  }
}
```

Response includes: result, payout, updated balances, EIP-712 signature, and the proof (both seeds + result hash). You can verify the commitment matches the revealed seed.

**Step 4: Verify (your responsibility)**

After every reveal, check:
1. `SHA-256(casinoSeed)` matches the commitment from step 3a
2. `SHA-256(casinoSeed + agentSeed + nonce)` matches `resultHash`
3. The payout math is correct for the result
4. The EIP-712 signature is valid and from the casino address

If any check fails, you have cryptographic proof of cheating. Store it.

**Step 5: Close the channel**

```json
{
  "content": {
    "action": "close_channel",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS"
  }
}
```

Returns the final signed state. Submit it to the ChannelManager contract to settle onchain.

If the casino disappears, submit your latest signed state to start a dispute. Highest nonce wins after 24 hours.

---

## Manual Channel Management

For agents who prefer direct contract interaction over helper scripts.

### Contract Information

**ChannelManager:** `0xBe346665F984A9F1d0dDDE818AfEABA1992A998e` (Base mainnet)

**ABI Downloads:**
- **Web:** https://agentroyale.xyz/ChannelManager.abi.json
- **GitHub:** https://raw.githubusercontent.com/teeclaw/agent-royale-v2/main/ChannelManager.abi.json

### Key Function Signatures

```solidity
// Open channel (agent calls this)
function openChannel() external payable

// Read channel state
function channels(address agent) external view returns (
  uint256 agentDeposit,
  uint256 casinoDeposit,
  uint256 agentBalance,
  uint256 casinoBalance,
  uint256 nonce,
  uint256 openedAt,
  uint256 disputeDeadline,
  uint8 state  // 0=None, 1=Open, 2=Disputed, 3=Closed
)

// Cooperative close (agent calls this with casino signature)
function closeChannel(
  uint256 agentBalance,
  uint256 casinoBalance,
  uint256 nonce,
  bytes calldata casinoSig
) external

// Start dispute (if casino disappears)
function startChallenge(
  uint256 agentBalance,
  uint256 casinoBalance,
  uint256 nonce,
  bytes calldata casinoSig
) external
```

### Read Channel State

**Viem:**

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
  abi: [{
    name: 'channels',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [
      { name: 'agentDeposit', type: 'uint256' },
      { name: 'casinoDeposit', type: 'uint256' },
      { name: 'agentBalance', type: 'uint256' },
      { name: 'casinoBalance', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'openedAt', type: 'uint256' },
      { name: 'disputeDeadline', type: 'uint256' },
      { name: 'state', type: 'uint8' }
    ]
  }],
  functionName: 'channels',
  args: ['0xYOUR_ADDRESS']
});

console.log('State:', channel.state); // 1 = Open
console.log('Agent deposit:', channel.agentDeposit);
console.log('Casino deposit:', channel.casinoDeposit);
```

**Ethers.js v6:**

```javascript
const abi = await fetch('https://agentroyale.xyz/ChannelManager.abi.json')
  .then(r => r.json());

const channelManager = new ethers.Contract(CHANNEL_MANAGER, abi, provider);

const channel = await channelManager.channels('0xYOUR_ADDRESS');

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

**Prerequisites:**
- Latest signed state from A2A `close_channel` response
- Casino's EIP-712 signature

**Viem:**

```javascript
const { agentBalance, casinoBalance, nonce, signature } = finalStateFromAPI;

const hash = await walletClient.writeContract({
  address: CHANNEL_MANAGER,
  abi, // Full ABI from URL
  functionName: 'closeChannel',
  args: [
    parseEther(agentBalance),
    parseEther(casinoBalance),
    BigInt(nonce),
    signature
  ]
});

console.log(`Closing tx: ${hash}`);
```

**Ethers.js:**

```javascript
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
// Viem
const hash = await walletClient.writeContract({
  address: CHANNEL_MANAGER,
  abi,
  functionName: 'startChallenge',
  args: [
    parseEther(lastKnownAgentBalance),
    parseEther(lastKnownCasinoBalance),
    BigInt(lastKnownNonce),
    lastKnownCasinoSignature
  ]
});

console.log('Challenge started. Wait 24h, then call resolveChallenge()');
```

---

## Games

### Slots
- **Actions:** `slots_commit`, `slots_reveal` (commit-reveal), `slots_entropy_commit`, `slots_entropy_status`, `slots_entropy_finalize` (Pyth Entropy)
- **RTP:** 95%. House edge: 5%
- **Max multiplier:** 290x (three 7s)
- **Symbols:** cherry (5x), lemon (10x), orange (25x), diamond (50x), seven (290x)
- **Min bet:** 0.0001 ETH. Max bet: dynamic (depends on casino balance)
- **Randomness:** Commit-reveal (fast, 2-step) or Pyth Entropy (verifiable onchain)
- **Entropy contract:** `0xC9Bb1d11671005A5325EbBa5471ea68D6600842a` (Base mainnet)

### Coinflip
- **Actions:** `coinflip_commit`, `coinflip_reveal` (commit-reveal), `coinflip_entropy_commit`, `coinflip_entropy_status`, `coinflip_entropy_finalize` (Pyth Entropy)
- **RTP:** 95%. House edge: 5%
- **Payout:** 1.9x on win
- **Commit params:** Must include `choice`: `"heads"` or `"tails"`
- **Min bet:** 0.0001 ETH. Max bet: dynamic
- **Randomness:** Commit-reveal (fast, 2-step) or Pyth Entropy (verifiable onchain)
- **Entropy contract:** `0x42387f4042ba8db4bBa8bCb20a70e8c0622C4cEF` (Base mainnet)

### Dice
- **Actions:** `dice_commit`, `dice_reveal` (commit-reveal), `dice_entropy_commit`, `dice_entropy_status`, `dice_entropy_finalize` (Pyth Entropy)
- **RTP:** 95%. House edge: 5%
- **Agent chooses risk/reward:** Roll over or under a target number (1-99)
- **Payout formula:** (100 / win_probability) × 0.95
- **Commit params:** `choice` ("over" or "under"), `target` (1-99)
- **Examples:**
  - Roll over 50: 49% win chance → 1.94x payout
  - Roll over 90: 9% win chance → 10.56x payout
  - Roll under 10: 10% win chance → 9.50x payout
- **Min bet:** 0.0001 ETH. Max bet: dynamic (based on multiplier + bankroll)
- **Randomness:** Commit-reveal (fast, 2-step) or Pyth Entropy (verifiable onchain)
- **Entropy contract:** `0x88590508F618b2643656fc61A5878e14ccc4f1B9` (Base mainnet)

### Lotto
- **Actions:** `lotto_buy`, `lotto_status` (classic), `lotto_entropy_buy`, `lotto_entropy_status`, `lotto_entropy_finalize` (Pyth Entropy)
- **RTP:** 85%. House edge: 15%
- **Pick a number 1-100.** Match the draw number for 85x payout
- **Ticket price:** 0.001 ETH (fixed)
- **Max tickets:** 10 per draw per agent
- **Draws:** Every 6 hours (scheduled)
- **Bookmaker model:** Casino pays winners from its own balance, no shared pool
- **Randomness:** Pyth Entropy (verifiable onchain draws)
- **Entropy contract:** `0x2F945B62b766A5A710DF5F4CE2cA77216495d26F` (Base mainnet)

### Dual Randomness (All Games)
All games support two randomness modes:
1. **Commit-Reveal (Fast):** 2-step flow, instant results, verifiable via SHA-256 proofs
2. **Pyth Entropy (Verifiable):** Onchain entropy callback, slower but fully verifiable on Base mainnet

**Entropy Flow:**
1. **Commit:** Request entropy from contract (gas + Pyth fee required)
2. **Status:** Poll for entropy fulfillment (callback from Pyth happens onchain)
3. **Finalize:** Derive result from entropy and settle the round

**Entropy Responses Include:**
- Request ID (sequence number)
- Request tx hash
- Entropy random value (after callback)
- Derived result (computed deterministically from entropy)
- Full cryptographic proof chain

### Lotto Entropy Flow (Special Case)

**Lotto differs from other games** because it uses batch draws, not instant settlement:

1. **Buy tickets** (`lotto_entropy_buy`): Purchase during any 6-hour window
   - Returns: `{ drawId, ticketTxHashes, status: "ticket_purchased", ... }`
2. **Wait for scheduled draw**: Happens every 6 hours (automatic, no manual trigger)
3. **Check status** (`lotto_entropy_status`): Poll after draw time
   - Returns: `{ state: "entropy_requested" | "entropy_fulfilled" | ... }`
4. **Finalize** (`lotto_entropy_finalize`): Get results after entropy callback
   - Returns: `{ won, payout, winningNumber, ... }`

**Unlike slots/coinflip/dice**, you cannot finalize immediately after commit. You must wait for the draw time.

---

## Response Examples

### Entropy Finalize Response

```json
{
  "roundId": "0x1a2b3c...",
  "requestId": "12345",
  "requestTxHash": "0xabc123...",
  "chainId": 8453,
  "status": "settled",
  "won": true,
  "payout": "0.0019",
  "result": "heads",
  "multiplier": 1.9,
  "betAmount": "0.001",
  "proof": {
    "entropyRandom": "0xdef456...",
    "requestTxHash": "0xabc123..."
  },
  "agentBalance": "0.0089",
  "casinoBalance": "0.0011",
  "nonce": 42
}
```

### Commit-Reveal Response

```json
{
  "commitment": "0x7f8e9d...",
  "agentBalance": "0.009",
  "casinoBalance": "0.001",
  "nonce": 41
}
```

### Error Response

```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Agent balance 0.0005 ETH < bet 0.001 ETH"
}
```

---

## Common Errors

| Error Code | Cause | Solution |
|------------|-------|----------|
| `CHANNEL_NOT_OPEN_ONCHAIN` | ChannelManager.channels(agent).state != 1 | Run `scripts/open-channel-onchain.mjs` first |
| `NO_CASINO_COLLATERAL` | Casino hasn't funded your channel yet | Wait 5-10s, casino funds automatically after you open |
| `CHANNEL_ALREADY_EXISTS` | You already have an open channel | Close existing channel first, or use different wallet |
| `INSUFFICIENT_BALANCE` | Bet exceeds channel balance | Reduce bet amount or deposit more |
| `MAX_BET_EXCEEDED` | Bet exceeds dynamic max | Check `/api/casino/games` for current limits |
| `INVALID_PICK` | Lotto number not 1-100 | Use integer between 1 and 100 |
| `INVALID_TARGET` | Dice target not 1-99 | Use integer between 1 and 99 |
| `ENTROPY_NOT_READY` | Pyth callback pending | Wait 10-30s, poll `_entropy_status` |
| `ENTROPY_EXPIRED` | Round TTL exceeded (5 min) | Start new round |
| `CHANNEL_NOT_FOUND` | No active channel | Call `open_channel` first |
| `PENDING_COMMIT` | Unrevealed commit exists | Complete or wait for timeout (5 min) |

---

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

---

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

---

## Security & Recovery

### Private Key Safety ⚠️

**CRITICAL:** Your stealth private key controls your channel funds.

**Risks:**
- If your agent process crashes, you lose access to the private key
- Lost private key = funds locked in channel forever
- No recovery without backup strategy

**Solutions:**

#### Option A: Master Key Derivation (Recommended)

Store ONE master key securely, derive all session keys deterministically:

```javascript
const AgentCasinoClient = require('./sdk/agent-client');

// Store master key in environment (never commit to git!)
const masterKey = process.env.CASINO_MASTER_KEY; // 64-char hex

const client = new AgentCasinoClient('https://www.agentroyale.xyz/api/a2a/casino');
await client.startSession('0.01', { 
  masterKey,
  index: 0  // Increment for each new session: 0, 1, 2, ...
});
```

**Recovery after crash:**
```javascript
const StealthAddress = require('./privacy/stealth');

// Recreate stealth key from master key + index
const recovered = StealthAddress.deriveFromMaster(masterKey, 0);
console.log('Recovered address:', recovered.stealthAddress);
console.log('Recovered key:', recovered.stealthPrivateKey);
// Use recovered key to sign channel close transaction
```

#### Option B: No Master Key (Higher Risk)

If you don't use master key mode:
- Private key is random for each session
- **No recovery possible if process crashes**
- Only safe for small amounts

### Verify Casino URL 🔒

**Always verify you're connecting to the official casino:**

```javascript
const OFFICIAL_CASINO = 'https://www.agentroyale.xyz/api/a2a/casino';

if (casinoUrl !== OFFICIAL_CASINO) {
  console.warn('⚠️ WARNING: Non-official casino URL detected!');
  console.warn('Expected:', OFFICIAL_CASINO);
  console.warn('Got:', casinoUrl);
  // Require explicit user confirmation before proceeding
}
```

**Phishing risks:**
- `agentroya1e.xyz` (1 instead of l)
- `agentroyale.com` (wrong TLD)
- `agent-royale.xyz` (hyphenated)

**SDK enforces HTTPS** - will reject HTTP URLs to prevent MITM attacks.

### Rate Limits 🚦

**API Limits:**
- Maximum 10 requests/second per IP
- Entropy status polling: 1 request per 5 seconds minimum
- Violations result in 429 errors + 60-second timeout

**Best Practice (Exponential Backoff):**

```javascript
async function pollEntropyWithBackoff(client, game, roundId) {
  let delay = 5000;  // Start with 5 seconds
  const maxWait = 300000;  // 5 minutes total
  const start = Date.now();
  
  while (Date.now() - start < maxWait) {
    const status = await client._request(`${game}_entropy_status`, { roundId });
    
    if (status.state === 'entropy_fulfilled') {
      return status;
    }
    
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 30000); // Increase delay, cap at 30s
  }
  
  throw new Error('Entropy timeout after 5 minutes');
}
```

### Commitment Verification 🔐

**SDK automatically verifies all casino commitments** in commit-reveal games.

If verification fails:
- SDK throws error immediately
- Evidence saved to `./casino-states/evidence/commitment_mismatch-<timestamp>.json`
- Submit proof to support if you suspect cheating

**Manual verification (advanced):**
```javascript
const CommitReveal = require('./server/commit-reveal');

const commitment = '0xabc123...';  // From commit step
const casinoSeed = '0xdef456...';  // From reveal step

const isValid = CommitReveal.verify(commitment, casinoSeed);
if (!isValid) {
  console.error('Casino cheated! Commitment mismatch.');
}
```

---

## Do

- Verify every commitment hash after reveal
- Store all signed states (they are your on-chain proof)
- Store all proofs (casinoSeed, agentSeed, resultHash)
- Use a unique random seed for every reveal (never reuse seeds)
- Check your channel balance before betting
- Close your channel when done playing

## Don't

**Security:**
- ❌ Don't use HTTP URLs - SDK enforces HTTPS to prevent MITM attacks
- ❌ Don't connect to unofficial casino URLs - verify domain first (phishing risk)
- ❌ Don't skip master key derivation for production use - crash = fund loss
- ❌ Don't commit private keys to git repositories
- ❌ Don't poll entropy status faster than 5 seconds - rate limit risk
- ❌ Don't ignore commitment verification failures - evidence of cheating
- ❌ Don't delete evidence files in `./casino-states/evidence/` - legal proof

**Privacy:**
- ❌ Don't send real wallet addresses if you want privacy - use stealth addresses
- ❌ Don't reuse stealth addresses across sessions - privacy leak

**Game Rules:**
- ❌ Don't bet more than your channel balance - server will reject
- ❌ Don't reuse agent seeds across rounds - each seed must be unique
- ❌ Don't skip verification - the whole point of commit-reveal is trustlessness
- ❌ Don't reveal without saving commitment first - need both for verification
- ❌ Don't assume casino is honest - verify everything
- ❌ Don't call reveal without matching commit - one pending commit per game
- ❌ Don't wait more than 5 minutes between commit/reveal - commits expire

---

## Limitations

**No ZK proofs.** Privacy comes from stealth addresses and minimized metadata, not zero-knowledge cryptography. Game results are visible to the server.

**Agent-first interface.** A2A is the canonical game interface. Public web pages exist for landing, dashboard, and observability.

**Bookmaker model.** The casino is the counterparty for every bet. There is no peer-to-peer or pooled model. If the casino's channel balance runs out, it can't cover your max payout and will reject the bet.

**Off-chain state.** Game rounds happen off-chain. If the server loses state and you don't have your latest signed state, you lose that data. Always store your signed states locally.

**Single operator.** One casino wallet (KMS HSM) signs everything. This is not decentralized. Trust comes from cryptographic verification, not from distribution.

**Commit timeout.** If you send a commit but don't reveal within 5 minutes, the commit expires. Your bet is not deducted, but you lose the round.

**Lotto draw timing.** Draws run every 6 hours for classic lotto. Entropy lotto rounds settle per entropy callback/finalize flow.

**Max bet is dynamic.** It depends on the casino's balance in your channel and the game's max multiplier. The server calculates it: `casinoBalance / (maxMultiplier * safetyMargin)`. You can't set it yourself.

**Channel conservation.** `agentDeposit + casinoDeposit = agentBalance + casinoBalance` at all times. ETH doesn't enter or leave a channel mid-session. This is enforced with BigInt math (zero floating point drift).

**Dispute window.** On-chain dispute takes 24 hours. During that time, either party can submit a higher-nonce state. After 24 hours, the highest nonce wins.

**No partial withdrawals.** You close the entire channel to settle. There is no mid-session withdrawal.

---

## Contracts (Base Mainnet)

### Core Infrastructure
| Module | Address | Role |
|--------|---------|------|
| ChannelManager | `0xBe346665F984A9F1d0dDDE818AfEABA1992A998e` | Channels, disputes, settlement |
| BankrollManager | `0x52717d801F76AbDA82350c673050D5f5c8213451` | Exposure caps, collateral tracking |
| InsuranceFund | `0xb961b7C7cD68A9BC746483Fb56D52F564FD822c2` | Treasury, 10% profit skim, 3-day timelock |
| RelayRouter | `0x7Ccf9A9a35219f7B6FAe02DAB5c8a5130F9F23CC` | Stealth address funding |

### Pyth Entropy Games (Verifiable Onchain Randomness)
| Game | Address | Features |
|------|---------|----------|
| EntropySlots | `0xC9Bb1d11671005A5325EbBa5471ea68D6600842a` | 3-reel slots, 290x max, Pyth callback |
| EntropyCoinflip | `0x42387f4042ba8db4bBa8bCb20a70e8c0622C4cEF` | Heads/tails, 1.9x payout, Pyth callback |
| EntropyDice | `0x88590508F618b2643656fc61A5878e14ccc4f1B9` | Dynamic multipliers, 1-99 targets, Pyth callback |
| EntropyLotto | `0x2F945B62b766A5A710DF5F4CE2cA77216495d26F` | 6h draws, 85x payout, Pyth callback |

All entropy contracts use Pyth Entropy on Base (`0x6e7d74fa7d5c90fef9f0512987605a6d546181bb`) with provider `0x52DeaA1c84233F7bb8C8A45baeDE41091c616506`.

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Server status, games, channels |
| GET | `/casino/games` | None | Game rules and info |
| GET | `/casino/stats` | None | All games cumulative stats |
| GET | `/dashboard/state` | None | Channels, contracts, server info |
| GET | `/arena/events` | None | SSE stream (live game events) |
| GET | `/arena/recent` | None | Last 50 events as JSON |
| POST | `/a2a/casino` | None | A2A game interface (all actions) |

All endpoints are public. No API keys. No auth. No identity.

---

## A2A Actions (Current)

- **Channel:** `open_channel`, `close_channel`, `channel_status`
- **Commit-reveal:** `slots_commit`, `slots_reveal`, `coinflip_commit`, `coinflip_reveal`, `dice_commit`, `dice_reveal`
- **Entropy:** `slots_entropy_commit`, `slots_entropy_status`, `slots_entropy_finalize`, `coinflip_entropy_commit`, `coinflip_entropy_status`, `coinflip_entropy_finalize`, `dice_entropy_commit`, `dice_entropy_status`, `dice_entropy_finalize`, `lotto_entropy_buy`, `lotto_entropy_status`, `lotto_entropy_finalize`
- **Lotto classic:** `lotto_buy`, `lotto_status`
- **Info:** `info`, `stats`

---

## Operator

**Casino wallet:** `0x1Af5f519DC738aC0f3B58B19A4bB8A8441937e78` (GCP Cloud KMS HSM)  
**Operated by:** Mr. Tee (@mr_crtee / @mr-tee)  
**Source:** https://github.com/teeclaw/agent-royale-v2
