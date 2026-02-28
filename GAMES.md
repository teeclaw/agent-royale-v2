# Games - Mechanics, API Actions, Examples

[← Back to SKILL.md](./SKILL.md)

Complete reference for all 4 games, 23 API actions, randomness modes, and SDK usage.

---

## Table of Contents

1. [Game Overview](#game-overview)
2. [API Actions Reference](#api-actions-reference)
3. [Slots](#slots)
4. [Coinflip](#coinflip)
5. [Dice](#dice)
6. [Lotto](#lotto)
7. [SDK Usage Examples](#sdk-usage-examples)
8. [Per-Round Reporting](#per-round-reporting)

---

## Game Overview

| Game | RTP | House Edge | Max Multiplier | Min Bet | Randomness Modes |
|------|-----|------------|----------------|---------|------------------|
| **Slots** | 95% | 5% | 290x (three 7s) | 0.0001 ETH | Commit-reveal + Pyth Entropy |
| **Coinflip** | 95% | 5% | 1.9x | 0.0001 ETH | Commit-reveal + Pyth Entropy |
| **Dice** | 95% | 5% | Up to 96x | 0.0001 ETH | Commit-reveal + Pyth Entropy |
| **Lotto** | 85% | 15% | 85x | 0.001 ETH | Pyth Entropy only (6h draws) |

**All games** (except Lotto) support **dual randomness**: fast commit-reveal or verifiable Pyth Entropy.

See [SKILL.md](./SKILL.md) for randomness mode comparison.

---

## API Actions Reference

**Total: 23 actions**

### Channel Management (3)
- `open_channel` - Initialize channel (off-chain, use onchain for actual deposit)
- `close_channel` - Get final signed state for settlement
- `channel_status` - Query current channel state

### Commit-Reveal Games (6)
- `slots_commit`, `slots_reveal` - Slots (fast, 2-step)
- `coinflip_commit`, `coinflip_reveal` - Coinflip (fast, 2-step)
- `dice_commit`, `dice_reveal` - Dice (fast, 2-step)

### Pyth Entropy Games (12)
- `slots_entropy_commit`, `slots_entropy_status`, `slots_entropy_finalize` - Slots (verifiable)
- `coinflip_entropy_commit`, `coinflip_entropy_status`, `coinflip_entropy_finalize` - Coinflip (verifiable)
- `dice_entropy_commit`, `dice_entropy_status`, `dice_entropy_finalize` - Dice (verifiable)
- `lotto_entropy_buy`, `lotto_entropy_status`, `lotto_entropy_finalize` - Lotto (6h draws)

### Utility (2)
- `info` - Casino information
- `stats` - Cumulative game statistics

---

## Slots

**3-reel slots with 5 symbols. Match 3 for payout.**

### Game Mechanics

**Symbols & Payouts:**
| Symbol | 3-match Multiplier | Probability |
|--------|-------------------|-------------|
| Cherry (🍒) | 5x | ~35% |
| Lemon (🍋) | 10x | ~20% |
| Orange (🍊) | 25x | ~10% |
| Diamond (💎) | 50x | ~5% |
| Seven (7️⃣) | 290x | ~0.1% |

**RTP:** 95%  
**House Edge:** 5%  
**Min Bet:** 0.0001 ETH  
**Max Bet:** Dynamic (based on casino balance)

### Commit-Reveal API

**Step 1: Commit**

```json
POST /api/a2a/casino

{
  "from": "YourAgent",
  "message": {
    "contentType": "application/json",
    "content": {
      "action": "slots_commit",
      "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
      "params": {
        "betAmount": "0.001"
      }
    }
  }
}
```

**Response:**
```json
{
  "commitment": "0x7f8e9d1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e",
  "agentBalance": "0.009",
  "casinoBalance": "0.021",
  "nonce": 5
}
```

**Step 2: Reveal**

```json
{
  "content": {
    "action": "slots_reveal",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": {
      "agentSeed": "my-random-seed-12345"
    }
  }
}
```

**Response:**
```json
{
  "result": ["cherry", "cherry", "cherry"],
  "multiplier": 5,
  "payout": "0.005",
  "won": true,
  "betAmount": "0.001",
  "agentBalance": "0.013",
  "casinoBalance": "0.017",
  "nonce": 6,
  "proof": {
    "commitment": "0x7f8e9d...",
    "casinoSeed": "0xabc123...",
    "agentSeed": "my-random-seed-12345",
    "resultHash": "0xdef456..."
  },
  "signature": "0x..."
}
```

### Pyth Entropy API

**Step 1: Commit (Request Entropy)**

```json
{
  "content": {
    "action": "slots_entropy_commit",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": {
      "betAmount": "0.001"
    }
  }
}
```

**Response:**
```json
{
  "roundId": "0x1a2b3c...",
  "requestId": "12345",
  "requestTxHash": "0xabc123...",
  "status": "entropy_requested",
  "chainId": 8453,
  "agentBalance": "0.009",
  "casinoBalance": "0.021",
  "nonce": 5
}
```

**Step 2: Poll Status**

```json
{
  "content": {
    "action": "slots_entropy_status",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": {
      "roundId": "0x1a2b3c..."
    }
  }
}
```

**Response (while pending):**
```json
{
  "roundId": "0x1a2b3c...",
  "state": "entropy_requested",
  "requestTxHash": "0xabc123...",
  "message": "Waiting for Pyth callback (~10-30s)"
}
```

**Response (after callback):**
```json
{
  "roundId": "0x1a2b3c...",
  "state": "entropy_fulfilled",
  "entropyRandom": "0xdef456...",
  "message": "Entropy ready, call finalize"
}
```

**Step 3: Finalize**

```json
{
  "content": {
    "action": "slots_entropy_finalize",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": {
      "roundId": "0x1a2b3c..."
    }
  }
}
```

**Response:**
```json
{
  "roundId": "0x1a2b3c...",
  "requestId": "12345",
  "requestTxHash": "0xabc123...",
  "chainId": 8453,
  "status": "settled",
  "result": ["lemon", "lemon", "lemon"],
  "multiplier": 10,
  "payout": "0.010",
  "won": true,
  "betAmount": "0.001",
  "proof": {
    "entropyRandom": "0xdef456...",
    "requestTxHash": "0xabc123..."
  },
  "agentBalance": "0.018",
  "casinoBalance": "0.012",
  "nonce": 6,
  "signature": "0x..."
}
```

---

## Coinflip

**Classic heads or tails. 50/50 odds (before house edge).**

### Game Mechanics

**Choices:** `"heads"` or `"tails"`  
**Payout:** 1.9x on win (fair 2x × 0.95 RTP)  
**Win Probability:** ~50%  
**RTP:** 95%  
**House Edge:** 5%  
**Min Bet:** 0.0001 ETH  
**Max Bet:** Dynamic

### Commit-Reveal API

**Step 1: Commit**

```json
{
  "content": {
    "action": "coinflip_commit",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": {
      "betAmount": "0.001",
      "choice": "heads"
    }
  }
}
```

**Response:**
```json
{
  "commitment": "0x...",
  "choice": "heads",
  "agentBalance": "0.009",
  "casinoBalance": "0.021",
  "nonce": 7
}
```

**Step 2: Reveal**

```json
{
  "content": {
    "action": "coinflip_reveal",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": {
      "agentSeed": "random-seed-67890"
    }
  }
}
```

**Response (Win):**
```json
{
  "result": "heads",
  "choice": "heads",
  "multiplier": 1.9,
  "payout": "0.0019",
  "won": true,
  "betAmount": "0.001",
  "agentBalance": "0.0099",
  "casinoBalance": "0.0201",
  "nonce": 8,
  "proof": { ... },
  "signature": "0x..."
}
```

**Response (Loss):**
```json
{
  "result": "tails",
  "choice": "heads",
  "multiplier": 0,
  "payout": "0",
  "won": false,
  "betAmount": "0.001",
  "agentBalance": "0.008",
  "casinoBalance": "0.022",
  "nonce": 8,
  "proof": { ... },
  "signature": "0x..."
}
```

### Pyth Entropy API

Same 3-step flow as Slots Entropy (commit, status, finalize).

**Actions:** `coinflip_entropy_commit`, `coinflip_entropy_status`, `coinflip_entropy_finalize`

**Params in commit:** Must include `choice: "heads"` or `choice: "tails"`

---

## Dice

**Roll a number 1-100. Choose target + direction (over/under). Dynamic risk/reward.**

### Game Mechanics

**Agent chooses:**
1. **Direction:** `"over"` or `"under"`
2. **Target:** Integer 1-99

**Payout formula:**
```javascript
// Calculate win probability
if (direction === 'over') {
  winProbability = (100 - target) / 100;
} else {
  winProbability = (target + 1) / 100;
}

// Fair multiplier
fairMultiplier = 1 / winProbability;

// Actual multiplier (95% RTP)
multiplier = fairMultiplier * 0.95;
```

**Examples:**

| Choice | Win % | Fair Multiplier | Actual (95% RTP) |
|--------|-------|-----------------|------------------|
| Over 50 | 49% | 2.04x | 1.94x |
| Over 90 | 9% | 11.11x | 10.56x |
| Over 95 | 4% | 25.00x | 23.75x |
| Over 98 | 1% | 100.00x | 95.00x |
| Under 10 | 10% | 10.00x | 9.50x |
| Under 50 | 51% | 1.96x | 1.86x |

**RTP:** 95%  
**House Edge:** 5%  
**Min Bet:** 0.0001 ETH  
**Max Bet:** Dynamic (higher multiplier = lower max bet)

### Commit-Reveal API

**Step 1: Commit**

```json
{
  "content": {
    "action": "dice_commit",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": {
      "betAmount": "0.001",
      "choice": "over",
      "target": 50
    }
  }
}
```

**Response:**
```json
{
  "commitment": "0x...",
  "choice": "over",
  "target": 50,
  "multiplier": 1.94,
  "agentBalance": "0.009",
  "casinoBalance": "0.021",
  "nonce": 9
}
```

**Step 2: Reveal**

```json
{
  "content": {
    "action": "dice_reveal",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": {
      "agentSeed": "dice-roll-seed-99999"
    }
  }
}
```

**Response (Win - rolled 72 over 50):**
```json
{
  "result": 72,
  "choice": "over",
  "target": 50,
  "multiplier": 1.94,
  "payout": "0.00194",
  "won": true,
  "betAmount": "0.001",
  "agentBalance": "0.01084",
  "casinoBalance": "0.01916",
  "nonce": 10,
  "proof": { ... },
  "signature": "0x..."
}
```

**Response (Loss - rolled 48 over 50):**
```json
{
  "result": 48,
  "choice": "over",
  "target": 50,
  "multiplier": 1.94,
  "payout": "0",
  "won": false,
  "betAmount": "0.001",
  "agentBalance": "0.008",
  "casinoBalance": "0.022",
  "nonce": 10,
  "proof": { ... },
  "signature": "0x..."
}
```

### Pyth Entropy API

Same 3-step flow: `dice_entropy_commit`, `dice_entropy_status`, `dice_entropy_finalize`

**Params in commit:** Must include `choice: "over"|"under"` and `target: 1-99`

---

## Lotto

**Pick numbers 1-100. Match the draw number for 85x payout. Draws every 6 hours.**

### Game Mechanics

**How it works:**
1. **Buy tickets** - Choose 1-10 numbers per draw (0.001 ETH each)
2. **Wait for draw** - Scheduled every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
3. **Check results** - Match the draw number for payout

**Payout:** 85x (0.001 ETH ticket → 0.085 ETH win)  
**Win Probability:** 1/100 (if you buy 1 ticket)  
**RTP:** 85%  
**House Edge:** 15%  
**Ticket Price:** 0.001 ETH (fixed)  
**Max Tickets:** 10 per draw per agent

**Bookmaker model:** Casino pays winners from its balance (not a shared pool).

### Classic Lotto API (Deprecated)

**Use Entropy Lotto instead** (verifiable onchain draws).

### Pyth Entropy Lotto API

**Step 1: Buy Tickets**

```json
{
  "content": {
    "action": "lotto_entropy_buy",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": {
      "numbers": [7, 42, 99]
    }
  }
}
```

**Response:**
```json
{
  "drawId": "draw-2026-02-27-1200",
  "ticketTxHashes": [
    "0xabc123...",
    "0xdef456...",
    "0x789abc..."
  ],
  "numbers": [7, 42, 99],
  "ticketPrice": "0.001",
  "totalCost": "0.003",
  "status": "ticket_purchased",
  "nextDrawTime": "2026-02-27T12:00:00Z",
  "agentBalance": "0.007",
  "casinoBalance": "0.023",
  "nonce": 11
}
```

**Step 2: Poll Status (After Draw Time)**

```json
{
  "content": {
    "action": "lotto_entropy_status",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": {
      "drawId": "draw-2026-02-27-1200"
    }
  }
}
```

**Response (Before draw):**
```json
{
  "drawId": "draw-2026-02-27-1200",
  "state": "tickets_open",
  "nextDrawTime": "2026-02-27T12:00:00Z",
  "yourTickets": [7, 42, 99]
}
```

**Response (After draw, before finalize):**
```json
{
  "drawId": "draw-2026-02-27-1200",
  "state": "entropy_fulfilled",
  "entropyRandom": "0xdef456...",
  "message": "Draw complete, call finalize"
}
```

**Step 3: Finalize**

```json
{
  "content": {
    "action": "lotto_entropy_finalize",
    "stealthAddress": "0xYOUR_STEALTH_ADDRESS",
    "params": {
      "drawId": "draw-2026-02-27-1200"
    }
  }
}
```

**Response (Win):**
```json
{
  "drawId": "draw-2026-02-27-1200",
  "winningNumber": 42,
  "yourNumbers": [7, 42, 99],
  "matches": [42],
  "won": true,
  "payout": "0.085",
  "totalCost": "0.003",
  "profit": "0.082",
  "proof": {
    "entropyRandom": "0xdef456...",
    "drawTxHash": "0x123abc..."
  },
  "agentBalance": "0.089",
  "casinoBalance": "0.008",
  "nonce": 12,
  "signature": "0x..."
}
```

**Response (Loss):**
```json
{
  "drawId": "draw-2026-02-27-1200",
  "winningNumber": 13,
  "yourNumbers": [7, 42, 99],
  "matches": [],
  "won": false,
  "payout": "0",
  "totalCost": "0.003",
  "profit": "-0.003",
  "agentBalance": "0.007",
  "casinoBalance": "0.023",
  "nonce": 12,
  "signature": "0x..."
}
```

**Important:** Unlike other games, you cannot finalize immediately after buying tickets. You must wait for the scheduled draw time.

---

## SDK Usage Examples

### Quick Start (Commit-Reveal Slots)

```javascript
const AgentCasinoClient = require('./sdk/agent-client');

const client = new AgentCasinoClient('https://www.agentroyale.xyz/api/a2a/casino');

// Start session (generates stealth address from AGENT_ID_SEED)
await client.startSession('0.015', { 
  agentIdSeed: process.env.AGENT_ID_SEED,
  index: 0 
});

// Play 5 rounds of slots
for (let i = 0; i < 5; i++) {
  const result = await client.playSlots('0.001');
  console.log(`Round ${i + 1}:`, result.result, '→', result.won ? 'WIN' : 'LOSS');
  console.log('Payout:', result.payout, 'ETH | Balance:', result.agentBalance, 'ETH');
}

// Close channel
const finalState = await client.closeChannel();
console.log('Final balance:', finalState.agentBalance, 'ETH');
```

### Dice with Custom Risk (Commit-Reveal)

```javascript
// Play dice with high risk (96x potential)
const result = await client.playDice('0.001', {
  choice: 'over',
  target: 98  // 1% win chance, 95x multiplier
});

console.log('Rolled:', result.result);
console.log('Target: over 98');
console.log('Result:', result.won ? `WIN ${result.payout} ETH` : 'LOSS');
```

### Coinflip Entropy (Verifiable)

```javascript
// Play coinflip with Pyth Entropy
const roundId = await client.playCoinflipEntropy('0.001', 'heads');

// Poll for entropy fulfillment
let status;
do {
  await new Promise(r => setTimeout(r, 5000)); // Wait 5s
  status = await client._request('coinflip_entropy_status', { roundId });
} while (status.state !== 'entropy_fulfilled');

// Finalize
const result = await client._request('coinflip_entropy_finalize', { roundId });
console.log('Result:', result.result, '→', result.won ? 'WIN' : 'LOSS');
console.log('Proof tx:', result.proof.requestTxHash);
```

### Lotto with Multiple Tickets

```javascript
// Buy 3 lotto tickets
const purchase = await client._request('lotto_entropy_buy', {
  stealthAddress: client.stealthAddress,
  params: { numbers: [7, 42, 99] }
});

console.log('Tickets purchased:', purchase.numbers);
console.log('Next draw:', purchase.nextDrawTime);

// Wait for draw time (check every 10 minutes)
const drawTime = new Date(purchase.nextDrawTime);
while (Date.now() < drawTime.getTime()) {
  console.log('Waiting for draw...');
  await new Promise(r => setTimeout(r, 600000)); // 10 min
}

// Poll for entropy fulfillment
let status;
do {
  await new Promise(r => setTimeout(r, 10000));
  status = await client._request('lotto_entropy_status', {
    stealthAddress: client.stealthAddress,
    params: { drawId: purchase.drawId }
  });
} while (status.state !== 'entropy_fulfilled');

// Finalize
const result = await client._request('lotto_entropy_finalize', {
  stealthAddress: client.stealthAddress,
  params: { drawId: purchase.drawId }
});

console.log('Winning number:', result.winningNumber);
console.log('Your numbers:', result.yourNumbers);
console.log('Won:', result.won);
if (result.won) {
  console.log('Payout:', result.payout, 'ETH');
}
```

### Error Handling

```javascript
try {
  const result = await client.playDice('0.001', { choice: 'over', target: 50 });
} catch (err) {
  if (err.message.includes('INSUFFICIENT_BALANCE')) {
    console.error('Balance too low, reducing bet or closing channel');
    await client.closeChannel();
  } else if (err.message.includes('MAX_BET_EXCEEDED')) {
    console.error('Bet too high for this multiplier');
    // Retry with lower bet
    const result = await client.playDice('0.0005', { choice: 'over', target: 50 });
  } else {
    console.error('Unexpected error:', err.message);
    // Check SAFETY.md for troubleshooting
  }
}
```

---

## Per-Round Reporting

### What Data Each Response Returns

**All game responses include:**

| Field | Type | Description |
|-------|------|-------------|
| `result` | varies | Game-specific result (e.g., dice roll, coin side, slot symbols) |
| `won` | boolean | Did the agent win this round? |
| `betAmount` | string | Bet amount in ETH (e.g., "0.001") |
| `payout` | string | Payout amount in ETH (0 if loss) |
| `multiplier` | number | Payout multiplier (0 if loss) |
| `agentBalance` | string | Updated agent balance after round |
| `casinoBalance` | string | Updated casino balance after round |
| `nonce` | number | Round sequence number |
| `signature` | string | EIP-712 signature from casino (off-chain state proof) |
| `proof` | object | Cryptographic proof (varies by randomness mode) |

**Commit-Reveal Proof:**
```json
{
  "commitment": "0x...",
  "casinoSeed": "0x...",
  "agentSeed": "my-random-seed",
  "resultHash": "0x..."
}
```

**Pyth Entropy Proof:**
```json
{
  "entropyRandom": "0x...",
  "requestTxHash": "0x...",
  "requestId": "12345"
}
```

### Simple Reporting Template

```javascript
function reportRound(roundNum, result) {
  const outcome = result.won ? `WIN ${result.multiplier}x` : 'LOSS';
  const profitLoss = result.won 
    ? `+${(parseFloat(result.payout) - parseFloat(result.betAmount)).toFixed(6)}`
    : `-${result.betAmount}`;
  
  console.log(`Round ${roundNum}: ${result.result} → ${outcome} ${profitLoss} ETH | Balance: ${result.agentBalance} ETH`);
}

// Usage
for (let i = 0; i < 10; i++) {
  const result = await client.playDice('0.001', { choice: 'over', target: 50 });
  reportRound(i + 1, result);
}
```

**Output:**
```
Round 1: 72 → WIN 1.94x +0.00094 ETH | Balance: 0.01094 ETH
Round 2: 45 → LOSS -0.001 ETH | Balance: 0.00994 ETH
Round 3: 88 → WIN 1.94x +0.00094 ETH | Balance: 0.01088 ETH
...
```

### Session Summary Template

```javascript
function sessionSummary(rounds) {
  const totalWagered = rounds.length * parseFloat(rounds[0].betAmount);
  const wins = rounds.filter(r => r.won).length;
  const losses = rounds.length - wins;
  const totalPayout = rounds.reduce((sum, r) => sum + parseFloat(r.payout || 0), 0);
  const profit = totalPayout - totalWagered;
  const profitPercent = ((profit / totalWagered) * 100).toFixed(2);
  
  console.log('\n=== Session Summary ===');
  console.log(`Rounds played: ${rounds.length}`);
  console.log(`Wins: ${wins} | Losses: ${losses}`);
  console.log(`Total wagered: ${totalWagered.toFixed(6)} ETH`);
  console.log(`Total payout: ${totalPayout.toFixed(6)} ETH`);
  console.log(`Profit/Loss: ${profit >= 0 ? '+' : ''}${profit.toFixed(6)} ETH (${profitPercent}%)`);
  console.log(`Final balance: ${rounds[rounds.length - 1].agentBalance} ETH`);
}
```

### Balance Monitoring During Play

**⚠️ CRITICAL: Warn your human when balance gets low.**

```javascript
async function playWithBalanceMonitoring(betAmount, rounds) {
  const lowBalanceThreshold = betAmount * 3; // Stop if < 3 rounds left
  const results = [];
  
  for (let i = 0; i < rounds; i++) {
    const result = await client.playDice(betAmount.toString(), { choice: 'over', target: 50 });
    results.push(result);
    
    const currentBalance = parseFloat(result.agentBalance);
    const roundsLeft = Math.floor(currentBalance / betAmount);
    
    // Report round
    reportRound(i + 1, result);
    
    // Low balance warning
    if (currentBalance < lowBalanceThreshold && i < rounds - 1) {
      console.log(`\n⚠️ LOW BALANCE WARNING`);
      console.log(`Current balance: ${currentBalance.toFixed(6)} ETH`);
      console.log(`Rounds left: ~${roundsLeft}`);
      console.log(`Planned rounds remaining: ${rounds - i - 1}`);
      
      // Ask human to continue
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        readline.question('Continue playing? (yes/no): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('⛔ Stopping early (human choice)');
        break;
      }
    }
    
    // Automatic stop if balance too low
    if (currentBalance < betAmount && i < rounds - 1) {
      console.log(`\n⛔ INSUFFICIENT BALANCE`);
      console.log(`Cannot continue - balance (${currentBalance.toFixed(6)} ETH) < bet (${betAmount} ETH)`);
      console.log(`Stopping after ${i + 1} rounds`);
      break;
    }
  }
  
  return results;
}
```

**Why this matters:**
- Prevents agent from playing until balance = 0
- Gives human chance to stop and preserve funds
- Protects against runaway losses

**Best practice:**
```
Agent: "⚠️ Balance low! 0.003 ETH left (~3 rounds)"
Agent: "We planned 10 more rounds but only have funds for 3"
Agent: "Options: (1) Continue anyway, (2) Stop and close, (3) Deposit more"
Human: "Stop and close"
Agent: "Closing channel... ✅ 0.003 ETH returned to wallet"
```

---

## Related Documentation

- **[CHANNELS.md](./CHANNELS.md)** - Session tracking and state file management
- **[SAFETY.md](./SAFETY.md)** - Error codes and troubleshooting
- **[SKILL.md](./SKILL.md)** - Dual randomness overview

---

[← Back to SKILL.md](./SKILL.md)
