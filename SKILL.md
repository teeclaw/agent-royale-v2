# Agent Royale - Navigation Hub

**Privacy-first casino for autonomous AI agents on Base.**

**Landing:** https://agentroyale.xyz  
**API Endpoint:** `https://www.agentroyale.xyz/api/a2a/casino`  
**Chain:** Base (8453)  
**Repository:** https://github.com/teeclaw/agent-royale-v2

---

## 🎯 Quick Links

**New to Agent Royale?**
- → [**SETUP.md**](./SETUP.md) - First-time configuration (AGENT_ID_SEED, environment, SDK installation)

**Ready to play?**
- → [**GAMES.md**](./GAMES.md) - All 23 API actions, 4 games, examples, reporting format

**Need to manage channels or funds?**
- → [**FUNDS.md**](./FUNDS.md) - Deposits, withdrawals, balance checks, fee structures
- → [**CHANNELS.md**](./CHANNELS.md) - Open/close/dispute flows, state tracking, session management

**Something wrong?**
- → [**SAFETY.md**](./SAFETY.md) - Stop-loss, emergencies, recovery, troubleshooting, error codes

---

## 📋 Core Contracts (Base Mainnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| **ChannelManager** | `0xBe346665F984A9F1d0dDDE818AfEABA1992A998e` | Channels, disputes, settlement |
| **ABI Download** | [ChannelManager.abi.json](https://agentroyale.xyz/ChannelManager.abi.json) | For direct contract calls |
| **EntropySlots** | `0xC9Bb1d11671005A5325EbBa5471ea68D6600842a` | Verifiable slots (Pyth Entropy) |
| **EntropyCoinflip** | `0x42387f4042ba8db4bBa8bCb20a70e8c0622C4cEF` | Verifiable coinflip |
| **EntropyDice** | `0x88590508F618b2643656fc61A5878e14ccc4f1B9` | Verifiable dice |
| **EntropyLotto** | `0x2F945B62b766A5A710DF5F4CE2cA77216495d26F` | Verifiable lotto (6h draws) |

**Key Function Signatures:**
```solidity
// Open channel (agent deposits ETH)
function openChannel() external payable

// Cooperative close (agent submits final signed state)
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

**Note:** `openChannel()` takes NO parameters - uses `msg.sender` automatically.

---

## 🎲 What is Agent Royale?

**State channel casino with dual randomness:**

1. **Onchain security** - Channels opened/closed on Base mainnet, funds secured by smart contracts
2. **Off-chain speed** - Games run at API speed (no gas per round, instant results)
3. **Dual randomness:**
   - **Commit-Reveal:** Fast 2-step flow, instant results, verifiable via SHA-256 proofs
   - **Pyth Entropy:** Slower (~30s), fully verifiable onchain randomness from Pyth Network

**Architecture:**
```
Agent deposits ETH → ChannelManager.openChannel()
          ↓
Casino funds collateral automatically
          ↓
Play games off-chain (A2A API) - hundreds of rounds/second possible
          ↓
Close channel → ChannelManager.closeChannel() → Funds settle onchain
```

**Games:** Slots (290x), Coinflip (1.9x), Dice (up to 96x), Lotto (85x)  
**RTP:** 95% (slots/coinflip/dice), 85% (lotto)

---

## 🚀 Quick Start (4 Steps)

### Step 0: Confirm Game Choice with Your Human ⚠️

**CRITICAL: Always ask your human BEFORE opening a channel.**

Opening a channel deposits real ETH. You must confirm:
1. Which game they want to play
2. Bet amount per round
3. Number of rounds
4. Randomness mode (fast commit-reveal or verifiable Pyth Entropy)

**Conversational template:**

```
Agent: "Ready to play Agent Royale? Which game interests you?

🎰 SLOTS - 95% RTP, 290x max, fast or verifiable
🪙 COINFLIP - 95% RTP, 1.9x payout, heads or tails
🎲 DICE - 95% RTP, up to 96x, you choose risk/reward
🎟️ LOTTO - 85% RTP, 85x payout, 6-hour draws

Pick one and I'll walk you through setup."
```

**After they choose, confirm details:**

```
Human: "Let's play Dice"

Agent: "Dice selected! Quick setup:

1. Bet per round? (min 0.0001 ETH, recommended 0.001-0.01 ETH)
2. How many rounds? (typical: 5-20)
3. Randomness: Fast (commit-reveal) or Verifiable (Pyth Entropy)?

I'll calculate the exact deposit amount once you decide."
```

**Calculate deposit:**
```javascript
const betPerRound = 0.001; // from human
const numRounds = 10; // from human
const buffer = 1.5; // 50% safety margin

const deposit = betPerRound * numRounds * buffer;
// = 0.015 ETH

console.log(`Recommended deposit: ${deposit} ETH`);
console.log(`Covers ${numRounds} rounds at ${betPerRound} ETH/round + 50% buffer`);
```

**Deposit Limits:**
- **Minimum:** 0.001 ETH (enforced by ChannelManager contract)
- **Recommended minimum:** 0.01 ETH (covers gas + ~10 rounds comfortably)
- **Maximum:** No contract-level limit (practical limit is your wallet balance)

**Final confirmation:**
```
Agent: "Perfect! Here's the plan:

Game: Dice
Bet: 0.001 ETH/round
Rounds: 10
Randomness: Fast (commit-reveal)
Deposit: 0.015 ETH

Ready to open channel? (yes/no)"
```

**Only proceed to Step 1 after explicit "yes".**

### Step 1: Open Channel (Onchain)

See [**FUNDS.md**](./FUNDS.md) for deposit instructions and [**CHANNELS.md**](./CHANNELS.md) for channel management details.

**Quick version:**
```bash
node scripts/open-channel-onchain.mjs 0.015 YOUR_PRIVATE_KEY
```

### Step 2: Play Games (Off-chain)

See [**GAMES.md**](./GAMES.md) for all 23 API actions, game mechanics, and SDK examples.

**Report after each round:**
```
Agent: "Round 3: Roll 72 (over 50) → WIN 1.94x = 0.00194 ETH
Balance: 0.016 ETH | 7 rounds left"
```

### Step 3: Close Channel (Onchain)

See [**CHANNELS.md**](./CHANNELS.md) for close/settle flows.

**Show summary before closing:**
```
Agent: "Session complete!

Rounds: 10
Wagered: 0.010 ETH
Payout: 0.012 ETH
Profit: +0.002 ETH (+20%)
Balance: 0.017 ETH

Close and withdraw? (yes/no)"
```

---

## 🔀 Dual Randomness System

All games support two randomness modes.

### Commit-Reveal (Fast) ⚡

**Flow:**
1. **Commit:** Agent sends bet → Casino returns commitment hash (SHA-256 of secret seed)
2. **Reveal:** Agent sends random seed → Casino reveals its seed → Result computed from both

**Speed:** Instant (2 API calls)  
**Verification:** SHA-256 proofs (client-side)  
**Actions:** `*_commit`, `*_reveal` (slots, coinflip, dice)

**Advantages:**
- Instant results
- No gas fees
- No blockchain interaction

**Trade-offs:**
- Trust casino to reveal honestly (but cryptographically verifiable)

### Pyth Entropy (Verifiable) 🔐

**Flow:**
1. **Commit:** Agent sends bet → Casino requests entropy from Pyth contract (onchain tx)
2. **Status:** Poll until Pyth callback delivers random value (~10-30s)
3. **Finalize:** Casino derives result from entropy + settles round

**Speed:** ~30 seconds (blockchain callback)  
**Verification:** Fully onchain, verifiable on BaseScan  
**Actions:** `*_entropy_commit`, `*_entropy_status`, `*_entropy_finalize`

**Advantages:**
- Fully verifiable onchain randomness
- No trust required (Pyth Network provides entropy)
- Cryptographic proof on Base mainnet

**Trade-offs:**
- Slower (~30s per round)
- Requires gas for entropy request
- 3-step API flow

### Which Mode Should I Use?

**Use Commit-Reveal when:**
- You want instant results
- Playing many rounds quickly
- You trust the casino's reputation + cryptographic proofs

**Use Pyth Entropy when:**
- You want fully verifiable onchain randomness
- Playing high-stakes rounds
- You need blockchain-level security guarantees

**Lotto is Entropy-only** (scheduled draws require onchain entropy callbacks).

---

## 📚 Documentation Structure

This documentation is split into 6 files for focused reading:

| File | Purpose | When to Read |
|------|---------|--------------|
| **SKILL.md** (this file) | Navigation hub, Quick Start overview | Start here |
| **[SETUP.md](./SETUP.md)** | First-time setup, AGENT_ID_SEED, SDK installation | Before first session |
| **[FUNDS.md](./FUNDS.md)** | Deposits, withdrawals, balance checks, fees | When managing money |
| **[GAMES.md](./GAMES.md)** | All 23 API actions, game mechanics, examples | When playing |
| **[CHANNELS.md](./CHANNELS.md)** | Channel lifecycle, state tracking, scripts | When managing channels |
| **[SAFETY.md](./SAFETY.md)** | Stop-loss, recovery, errors, troubleshooting | When something breaks |

**Cross-references:**
- Each file links back to this navigation hub
- Files link to each other for related topics (e.g., FUNDS.md ↔ CHANNELS.md)

---

## 🎮 Available Games

| Game | RTP | Max Multiplier | Min Bet | Randomness Modes |
|------|-----|----------------|---------|------------------|
| **Slots** | 95% | 290x (three 7s) | 0.0001 ETH | Commit-reveal + Pyth Entropy |
| **Coinflip** | 95% | 1.9x | 0.0001 ETH | Commit-reveal + Pyth Entropy |
| **Dice** | 95% | Up to 96x | 0.0001 ETH | Commit-reveal + Pyth Entropy |
| **Lotto** | 85% | 85x | 0.001 ETH | Pyth Entropy only (6h draws) |

See [**GAMES.md**](./GAMES.md) for detailed mechanics, payout tables, and API documentation.

---

## 🛡️ Security First

**Before you start:**
- Read [**SETUP.md**](./SETUP.md) for AGENT_ID_SEED generation (critical for recovery)
- Read [**SAFETY.md**](./SAFETY.md) for stop-loss strategies and emergency procedures

**Key security principles:**
1. **Always use AGENT_ID_SEED** - Without it, crash = funds locked forever
2. **Verify commitment hashes** - SDK does this automatically
3. **Store all signed states** - They're your onchain proof
4. **Never skip Step 0** - Confirm game + bet with human before opening channels

---

## 🔗 Useful Links

**Production:**
- Landing Page: https://agentroyale.xyz
- A2A Endpoint: `https://www.agentroyale.xyz/api/a2a/casino`
- ChannelManager ABI: https://agentroyale.xyz/ChannelManager.abi.json

**Development:**
- Repository: https://github.com/teeclaw/agent-royale-v2
- BaseScan (ChannelManager): https://basescan.org/address/0xBe346665F984A9F1d0dDDE818AfEABA1992A998e

**Operator:**
- Casino Wallet: `0x1Af5f519DC738aC0f3B58B19A4bB8A8441937e78` (GCP Cloud KMS HSM)
- Run by: Mr. Tee (@mr_crtee / @mr-tee)

---

## 📖 Next Steps

1. **New user?** → Read [**SETUP.md**](./SETUP.md) to configure your environment
2. **Ready to play?** → Check [**GAMES.md**](./GAMES.md) for game mechanics and API docs
3. **Need help?** → See [**SAFETY.md**](./SAFETY.md) for troubleshooting and error codes

**Questions?** Check the appropriate doc above or refer to the Common Errors table in [**SAFETY.md**](./SAFETY.md).
