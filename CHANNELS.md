# Channels - Lifecycle, State Tracking, Session Management

[← Back to SKILL.md](./SKILL.md)

Complete guide to channel operations, state transitions, session tracking, and round history logging.

---

## Table of Contents

1. [Channel Lifecycle](#channel-lifecycle)
2. [State Transitions](#state-transitions)
3. [Open Channel Flow](#open-channel-flow)
4. [Close Channel Flow](#close-channel-flow)
5. [Dispute Flow](#dispute-flow)
6. [Session Tracking](#session-tracking)
7. [Round History Logging](#round-history-logging)
8. [Helper Scripts Reference](#helper-scripts-reference)

---

## Channel Lifecycle

**A channel's journey from open to settled:**

```
None (0) → Open (1) → Closed (3)
           ↓
        Disputed (2) → Closed (3)
```

**States:**
- **None (0):** No channel exists
- **Open (1):** Active channel, can play games
- **Disputed (2):** Challenge started, 24h dispute period
- **Closed (3):** Settled, funds distributed

---

## State Transitions

### Valid Transitions

| From | To | Trigger | Who |
|------|-----|---------|-----|
| None (0) | Open (1) | `openChannel()` | Agent |
| Open (1) | Closed (3) | `closeChannel()` (cooperative) | Agent |
| Open (1) | Disputed (2) | `startChallenge()` | Agent or Casino |
| Disputed (2) | Closed (3) | `resolveChallenge()` (after 24h) | Anyone |

### Invalid Transitions

- ❌ Open → None (must close first)
- ❌ Closed → Open (create new channel with different wallet)
- ❌ Disputed → Open (must resolve first)
- ❌ None → Closed (can't close non-existent channel)

---

## Open Channel Flow

### Prerequisites

See [SETUP.md](./SETUP.md) and [FUNDS.md](./FUNDS.md) for detailed setup instructions.

**Quick checklist:**
- [ ] AGENT_ID_SEED configured
- [ ] Wallet has ≥0.1 ETH on Base
- [ ] Game + bet confirmed with human (Step 0)
- [ ] Deposit amount calculated

### Step-by-Step

**1. Generate stealth address (if using AGENT_ID_SEED):**

```javascript
const StealthAddress = require('./privacy/stealth');

const stealth = StealthAddress.deriveFromMaster(
  process.env.AGENT_ID_SEED,
  0  // Session index
);

console.log('Stealth address:', stealth.stealthAddress);
console.log('Stealth private key:', stealth.stealthPrivateKey);
```

**2. Call ChannelManager.openChannel():**

```bash
# Using helper script
node scripts/open-channel-onchain.mjs 0.015 YOUR_PRIVATE_KEY

# Or manual viem
const hash = await walletClient.writeContract({
  address: '0xBe346665F984A9F1d0dDDE818AfEABA1992A998e',
  abi: [{ name: 'openChannel', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] }],
  functionName: 'openChannel',
  value: parseEther('0.015')
});
```

**3. Wait for casino to fund collateral (~5-10s):**

Casino backend automatically calls `fundCasinoSide()` after detecting your deposit.

**4. Verify channel open:**

```bash
node scripts/verify-channel.mjs YOUR_ADDRESS

# Expected output:
# State: Open (1)
# Agent Deposit: 0.015 ETH
# Casino Deposit: 0.020 ETH
```

**5. Save initial state:**

```javascript
// Create session state file
const sessionState = {
  stealthAddress: stealth.stealthAddress,
  agentIdSeed: process.env.AGENT_ID_SEED,
  sessionIndex: 0,
  initialDeposit: '0.015',
  openedAt: new Date().toISOString(),
  rounds: []
};

fs.writeFileSync(
  `./casino-states/session-${Date.now()}.json`,
  JSON.stringify(sessionState, null, 2)
);
```

---

## Close Channel Flow

### Cooperative Close (Standard)

**When to use:** Casino is responsive, normal session end

**Step 1: Request final state via A2A**

```javascript
const client = new AgentCasinoClient(casinoUrl);
const finalState = await client._request('close_channel', {
  stealthAddress: stealth.stealthAddress
});

// Returns:
// {
//   agentBalance: "0.017",
//   casinoBalance: "0.018",
//   nonce: 10,
//   signature: "0x..."
// }
```

**Step 2: Submit to ChannelManager**

```bash
# Save state
echo '{...}' > final-state.json

# Submit onchain
cat final-state.json | node scripts/close-channel-onchain.mjs YOUR_PRIVATE_KEY
```

**Step 3: Verify settlement**

```bash
# Check channel state
node scripts/verify-channel.mjs YOUR_ADDRESS

# Expected: State: Closed (3)

# Check wallet balance
node scripts/check-balance.mjs YOUR_ADDRESS

# Balance should increase by agentBalance from final state
```

**Step 4: Update session state file**

```javascript
sessionState.closedAt = new Date().toISOString();
sessionState.finalBalance = finalState.agentBalance;
sessionState.profit = (parseFloat(finalState.agentBalance) - parseFloat(sessionState.initialDeposit)).toFixed(6);

fs.writeFileSync(
  `./casino-states/session-${sessionState.startTime}.json`,
  JSON.stringify(sessionState, null, 2)
);
```

---

## Dispute Flow

### When to Dispute

**Use `startChallenge()` when:**
- Casino offline/unresponsive (can't get final signed state)
- Casino refuses to close cooperatively
- Casino tries to submit lower nonce state
- Emergency recovery needed

**Don't use for:**
- Normal closures (use cooperative close)
- Testing (wastes gas)

### Step-by-Step

**1. Find your latest signed state:**

```bash
# Check session state files
ls -lt casino-states/*.json | head -1

# Or find highest nonce state manually
grep -h '"nonce"' casino-states/*.json | sort -n | tail -1
```

**2. Submit challenge:**

```bash
# Using helper script
node scripts/dispute-channel.mjs YOUR_PRIVATE_KEY casino-states/latest-state.json
```

**3. Monitor dispute period (24 hours):**

```bash
# Check deadline
node scripts/verify-channel.mjs YOUR_ADDRESS

# Look for:
# State: Disputed (2)
# Dispute Deadline: 2026-02-28 12:34:56 UTC
```

**4. After deadline, resolve:**

```javascript
// Anyone can call this after 24h
const tx = await channelManager.resolveChallenge(yourAddress);
await tx.wait();
console.log('✅ Dispute resolved');
```

**5. Check settlement:**

```bash
node scripts/verify-channel.mjs YOUR_ADDRESS
# State: Closed (3)

node scripts/check-balance.mjs YOUR_ADDRESS
# Balance updated
```

---

## Session Tracking

### State File Structure

**Location:** `./casino-states/session-<timestamp>.json`

**Format:**
```json
{
  "stealthAddress": "0x1234...",
  "agentIdSeed": "REDACTED",
  "sessionIndex": 0,
  "initialDeposit": "0.015",
  "openedAt": "2026-02-27T12:00:00Z",
  "closedAt": null,
  "game": "dice",
  "betAmount": "0.001",
  "randomnessMode": "commit-reveal",
  "rounds": [
    {
      "roundNum": 1,
      "timestamp": "2026-02-27T12:05:00Z",
      "action": "dice_reveal",
      "params": { "choice": "over", "target": 50 },
      "result": 72,
      "won": true,
      "payout": "0.00194",
      "agentBalance": "0.01094",
      "nonce": 1
    }
  ],
  "finalBalance": null,
  "profit": null
}
```

### Track Rounds

```javascript
function recordRound(sessionState, result, params) {
  sessionState.rounds.push({
    roundNum: sessionState.rounds.length + 1,
    timestamp: new Date().toISOString(),
    action: result.action,
    params: params,
    result: result.result,
    won: result.won,
    payout: result.payout,
    agentBalance: result.agentBalance,
    nonce: result.nonce
  });
  
  // Save to disk
  fs.writeFileSync(
    `./casino-states/session-${sessionState.startTime}.json`,
    JSON.stringify(sessionState, null, 2)
  );
}

// Usage
const result = await client.playDice('0.001', { choice: 'over', target: 50 });
recordRound(sessionState, result, { choice: 'over', target: 50 });
```

### Session Summary

```javascript
function generateSummary(sessionState) {
  const rounds = sessionState.rounds;
  const wins = rounds.filter(r => r.won).length;
  const losses = rounds.length - wins;
  const totalWagered = rounds.length * parseFloat(sessionState.betAmount);
  const totalPayout = rounds.reduce((sum, r) => sum + parseFloat(r.payout || 0), 0);
  const profit = parseFloat(sessionState.finalBalance) - parseFloat(sessionState.initialDeposit);
  
  return {
    game: sessionState.game,
    randomnessMode: sessionState.randomnessMode,
    duration: sessionState.closedAt ? 
      (new Date(sessionState.closedAt) - new Date(sessionState.openedAt)) / 1000 / 60 : null,
    rounds: rounds.length,
    wins,
    losses,
    winRate: (wins / rounds.length * 100).toFixed(2) + '%',
    totalWagered: totalWagered.toFixed(6) + ' ETH',
    totalPayout: totalPayout.toFixed(6) + ' ETH',
    profit: profit.toFixed(6) + ' ETH',
    profitPercent: (profit / parseFloat(sessionState.initialDeposit) * 100).toFixed(2) + '%'
  };
}
```

---

## Round History Logging

### What to Save

**Per-round (minimum):**
- Round number
- Timestamp
- Action (e.g., "dice_reveal", "slots_entropy_finalize")
- Parameters (bet, choice, target, etc.)
- Result (roll, symbols, side, etc.)
- Win/loss
- Payout
- Updated balance
- Nonce

**Per-session (minimum):**
- Stealth address
- Session index (for AGENT_ID_SEED recovery)
- Initial deposit
- Game + bet amount
- Randomness mode
- Open/close timestamps
- Final balance
- Total profit/loss

### Logging Example

```javascript
class SessionLogger {
  constructor(stealthAddress, sessionIndex, initialDeposit) {
    this.startTime = Date.now();
    this.state = {
      stealthAddress,
      sessionIndex,
      initialDeposit,
      openedAt: new Date().toISOString(),
      closedAt: null,
      rounds: []
    };
    this.saveState();
  }
  
  logRound(result, params) {
    this.state.rounds.push({
      roundNum: this.state.rounds.length + 1,
      timestamp: new Date().toISOString(),
      ...params,
      result: result.result,
      won: result.won,
      payout: result.payout,
      agentBalance: result.agentBalance,
      nonce: result.nonce
    });
    this.saveState();
  }
  
  close(finalBalance) {
    this.state.closedAt = new Date().toISOString();
    this.state.finalBalance = finalBalance;
    this.state.profit = (parseFloat(finalBalance) - parseFloat(this.state.initialDeposit)).toFixed(6);
    this.saveState();
  }
  
  saveState() {
    const filename = `./casino-states/session-${this.startTime}.json`;
    fs.writeFileSync(filename, JSON.stringify(this.state, null, 2));
  }
  
  getSummary() {
    return generateSummary(this.state);
  }
}

// Usage
const logger = new SessionLogger(stealthAddress, 0, '0.015');

for (let i = 0; i < 10; i++) {
  const result = await client.playDice('0.001', { choice: 'over', target: 50 });
  logger.logRound(result, { game: 'dice', betAmount: '0.001', choice: 'over', target: 50 });
}

const finalState = await client.closeChannel();
logger.close(finalState.agentBalance);

console.log(logger.getSummary());
```

---

## Helper Scripts Reference

**All scripts are in `scripts/` directory.**

### Channel Management

| Script | Usage | Description |
|--------|-------|-------------|
| `open-channel-onchain.mjs` | `node scripts/open-channel-onchain.mjs <depositETH> [privateKey]` | Open channel with ETH deposit |
| `verify-channel.mjs` | `node scripts/verify-channel.mjs <address>` | Check channel state onchain |
| `close-channel-onchain.mjs` | `cat state.json \| node scripts/close-channel-onchain.mjs <privateKey>` | Submit final state to close |
| `dispute-channel.mjs` | `node scripts/dispute-channel.mjs <privateKey> <stateFile>` | Start challenge (emergency) |

### Balance Checks

| Script | Usage | Description |
|--------|-------|-------------|
| `check-balance.mjs` | `node scripts/check-balance.mjs <address>` | Check wallet + channel balance |

### Recovery

| Script | Usage | Description |
|--------|-------|-------------|
| `recover-stealth.mjs` | `node scripts/recover-stealth.mjs --seed $AGENT_ID_SEED --index 0` | Recover stealth address from seed |

### Game Scripts

| Script | Usage | Description |
|--------|-------|-------------|
| `play-dice-commit-reveal.mjs` | `--stealth 0x... --bet 0.001 --choice over --target 50` | Play dice (commit-reveal) |
| `play-dice-entropy.mjs` | `--stealth 0x... --bet 0.001 --choice over --target 50` | Play dice (Pyth Entropy) |
| `play-slots-commit-reveal.mjs` | `--stealth 0x... --bet 0.001 --rounds 10` | Play slots (commit-reveal) |
| `play-slots-entropy.mjs` | `--stealth 0x... --bet 0.001 --rounds 5` | Play slots (Pyth Entropy) |
| `play-coinflip-commit-reveal.mjs` | `--stealth 0x... --bet 0.001 --choice heads` | Play coinflip (commit-reveal) |
| `play-coinflip-entropy.mjs` | `--stealth 0x... --bet 0.001 --choice heads` | Play coinflip (Pyth Entropy) |
| `play-lotto-entropy.mjs` | `--stealth 0x... --numbers 7,42,99` | Buy lotto tickets (Pyth Entropy) |

**See `scripts/SCRIPTS-INVENTORY.md` for detailed documentation.**

---

## Best Practices

### DO ✅
- Save session state after every round
- Track session index for AGENT_ID_SEED recovery
- Store all signed states (evidence in disputes)
- Generate session summaries after closing
- Back up `./casino-states/` directory regularly
- Use descriptive filenames (`session-<timestamp>-<game>.json`)

### DON'T ❌
- Don't delete state files mid-session
- Don't reuse session index across channels
- Don't store unencrypted AGENT_ID_SEED in state files
- Don't forget to increment session index after closing
- Don't skip state file backups (only recovery proof)

---

## Related Documentation

- **[FUNDS.md](./FUNDS.md)** - Deposit/withdrawal operations
- **[SAFETY.md](./SAFETY.md)** - Recovery procedures and emergency actions
- **[GAMES.md](./GAMES.md)** - Per-round reporting format
- **[SETUP.md](./SETUP.md)** - AGENT_ID_SEED configuration

---

[← Back to SKILL.md](./SKILL.md)
