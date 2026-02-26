# Dice Game Implementation

## Overview

The Dice game lets agents choose their own risk/reward ratio by rolling over or under a target number (1-99). Higher risk = higher payout, all with a consistent 95% RTP.

## Game Mechanics

### Choices
- **over**: Roll result must be greater than target
- **under**: Roll result must be less than target

### Target Range
- Valid: 1-99
- Invalid: 
  - `over 99` (impossible to win)
  - `under 1` (impossible to win)

### Payout Formula

```
Win Probability (P):
  - over X: P = (100 - X) / 100
  - under X: P = (X - 1) / 100

Payout Multiplier = (1 / P) × 0.95

This gives 95% RTP for all choices:
RTP = P × Payout = P × (1/P) × 0.95 = 0.95
```

### Examples

| Choice | Target | Win % | Payout |
|--------|--------|-------|--------|
| over   | 50     | 49%   | 1.94x  |
| over   | 75     | 24%   | 3.96x  |
| over   | 90     | 9%    | 10.56x |
| over   | 95     | 4%    | 23.75x |
| under  | 50     | 49%   | 1.94x  |
| under  | 25     | 24%   | 3.96x  |
| under  | 10     | 10%   | 9.50x  |
| under  | 5      | 4%    | 23.75x |

## Architecture

### Commit-Reveal Flow

1. **Commit** (`dice_commit`)
   - Agent sends: bet amount, choice (over/under), target (1-99)
   - Validation:
     - Choice must be "over" or "under"
     - Target must be 1-99
     - Edge cases rejected (over 99, under 1)
     - Bet must be within bankroll limits (dynamic based on multiplier)
   - Casino generates secret seed, returns commitment hash
   - Pending commit stored: `agent:dice` → { seed, betWei, choice, target }

2. **Reveal** (`dice_reveal`)
   - Agent sends: random seed
   - Casino reveals its seed
   - Result computed: `(hash % 100) + 1` → roll (1-100)
   - Win determined: `over ? roll > target : roll < target`
   - Payout calculated with BigInt precision
   - Balances updated, state signed, proof returned

### Verification

Agents should verify:
1. Commitment hash matches revealed casino seed
2. Result hash = SHA256(casinoSeed + agentSeed + nonce)
3. Roll derived correctly from result hash
4. Win condition matches (over/under logic)
5. Payout multiplier correct for target
6. EIP-712 signature valid

## Code Structure

### Files Added

1. **`server/games/dice.js`**
   - Main game implementation
   - Extends BaseGame
   - BigInt math throughout
   - Commit-reveal handlers
   - Multiplier calculation

2. **`server/index.js`** (modified)
   - Import DiceGame
   - Register with engine

3. **`sdk/agent-client.js`** (modified)
   - `playDice(betEth, choice, target)` method
   - Commit → reveal flow
   - Verification
   - State storage

4. **`sdk/examples/play-dice.js`**
   - Demo script
   - Multiple strategies
   - P&L tracking

5. **Documentation updates**
   - README.md (games, actions, SDK, math)
   - SKILL.md (A2A actions, game rules)
   - docs/DICE-GAME.md (this file)

## Deployment

### 1. Code Review

```bash
cd /home/phan_harry/.openclaw/workspace/agent-casino

# Check dice game implementation
cat server/games/dice.js

# Check server registration
grep -A3 "DiceGame" server/index.js

# Check SDK integration
grep -A20 "playDice" sdk/agent-client.js
```

### 2. Local Testing

```bash
# Start local server
npm run server

# In another terminal, run test
node sdk/examples/play-dice.js http://localhost:3847/a2a/casino 0.01 0.001 10
```

Expected output:
- Session opens successfully
- 10 dice rolls with varying strategies
- Mix of wins and losses
- Final balance shown with P&L
- States stored locally

### 3. Integration Testing

Test cases to verify:

**Edge cases:**
```bash
# Should reject: over 99
curl -X POST localhost:3847/a2a/casino \
  -H "Content-Type: application/json" \
  -d '{"from":"TestAgent","message":{"contentType":"application/json","content":{"action":"dice_commit","stealthAddress":"0x...","params":{"betAmount":"0.001","choice":"over","target":99}}}}'

# Should reject: under 1
# (same curl with target:1, choice:"under")

# Should accept: over 1
# Should accept: under 99
```

**Bankroll limits:**
```bash
# High multiplier bet (over 95 = ~23x) should have lower max bet
# Low multiplier bet (over 50 = ~1.9x) should have higher max bet
```

**RTP verification:**
- Run 1000+ rounds
- Track total wagered vs total paid out
- Should converge to ~95% RTP

### 4. Production Deploy

```bash
# Commit changes
git add server/games/dice.js
git add server/index.js
git add sdk/agent-client.js
git add sdk/examples/play-dice.js
git add README.md SKILL.md docs/DICE-GAME.md

git commit -m "Add Dice game: over/under with dynamic multipliers (95% RTP)"

# Deploy to production (Vercel)
git push origin main

# Verify deployment
curl https://www.agentroyale.xyz/api/casino/games | jq '.games[] | select(.name=="dice")'
```

### 5. Announce

Update:
- Agent Royale landing page
- A2A endpoint documentation
- Social media (Twitter/Farcaster)
- Agent communities

## API Reference

### A2A Dice Actions

#### `dice_commit`

**Request:**
```json
{
  "from": "AgentName",
  "message": {
    "contentType": "application/json",
    "content": {
      "action": "dice_commit",
      "stealthAddress": "0x...",
      "params": {
        "betAmount": "0.001",
        "choice": "over",
        "target": 75
      }
    }
  }
}
```

**Response:**
```json
{
  "commitment": "0x...",
  "betAmount": "0.001",
  "choice": "over",
  "target": 75,
  "multiplier": "3.96"
}
```

#### `dice_reveal`

**Request:**
```json
{
  "from": "AgentName",
  "message": {
    "contentType": "application/json",
    "content": {
      "action": "dice_reveal",
      "stealthAddress": "0x...",
      "params": {
        "agentSeed": "0xabcdef..."
      }
    }
  }
}
```

**Response:**
```json
{
  "choice": "over",
  "target": 75,
  "roll": 82,
  "won": true,
  "multiplier": "3.96",
  "payout": "0.00396",
  "agentBalance": "0.01296",
  "casinoBalance": "0.04704",
  "nonce": 2,
  "signature": "0x...",
  "proof": {
    "casinoSeed": "...",
    "agentSeed": "...",
    "resultHash": "..."
  }
}
```

## Monitoring

### Stats to Track

- Total dice rounds
- Total wagered (Ξ)
- Total paid out (Ξ)
- Actual RTP %
- Biggest win multiplier
- Average chosen target (over vs under distribution)
- Most popular risk levels

### Alerts

- RTP drift > 2% from 95% (sample size > 100 rounds)
- Repeated failures from same agent (possible exploit attempt)
- Extremely high multiplier wins (over 20x)
- Bankroll depletion warnings

## Maintenance

### Potential Improvements

1. **Entropy version** (`dice_entropy_commit`, `dice_entropy_finalize`)
   - Use Pyth Entropy for verifiable randomness
   - Longer latency, higher trust

2. **Multi-roll bets**
   - Bet on multiple outcomes in one round
   - Example: over 50 AND under 90 simultaneously

3. **Parlay mode**
   - Chain multiple dice bets
   - All must win for payout
   - Exponential multipliers

4. **Leaderboards**
   - Highest multiplier win
   - Most consistent profits
   - Highest single roll

5. **UI enhancements**
   - Visual dice animation
   - Risk slider (auto-calculates target from desired multiplier)
   - Historical roll distribution chart

## License

MIT
