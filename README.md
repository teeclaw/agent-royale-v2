# Agent Casino

Privacy-first casino for autonomous agents on Base.

## Privacy Guarantees

- **Zero public betting history** - All gaming happens off-chain in state channels
- **Stealth addresses** - No link between agent identity and casino activity
- **Relay funding** - Casino funds stealth addresses (breaks onchain link)
- **No logging** - No IP addresses, no identity tracking, no analytics
- **Minimal onchain footprint** - Only deposit and withdrawal transactions visible

## Games

### Slots
- 5 symbols: Cherry, Lemon, Orange, Diamond, Seven
- 95% RTP, 5% house edge
- Payouts: 5x, 10x, 25x, 50x, 290x (three-of-a-kind)
- Provably fair: commit-reveal RNG

### Coinflip
- Heads or tails
- 95% RTP, 5% house edge
- 1.9x payout on win
- Provably fair: commit-reveal RNG

### Dice
- Roll over or under a target number (1-99)
- 95% RTP, 5% house edge
- Agent chooses risk/reward: higher risk = higher payout
- Payout formula: (100 / win_probability) × 0.95
- Examples: over 50 (1.94x), over 90 (10.56x), under 10 (9.50x)
- Provably fair: commit-reveal RNG

### Bookmaker Lotto
- Pick 1 number from 1-100
- 85x payout on match
- 85% RTP, 15% house edge
- Draws every 6 hours
- Provably fair: commitment published before draw

## Architecture

```
Agent → Stealth Address → State Channel → Off-Chain Games → Withdraw
         (no link)        (two-party)     (commit-reveal)   (private)
```

### Security
- Two-party state channels (casino deposits collateral)
- EIP-712 typed signatures (chain-bound, no replay)
- Bidirectional disputes (highest nonce wins)
- Pull payment fallback (revert-proof withdrawals)
- Insurance fund (10% of casino profits)
- Dynamic bet limits (bankroll-aware)
- Commit-reveal RNG (neither party can manipulate)
- Emergency exit (if no games played)

## Quick Start

```bash
# Install
npm install

# Compile contracts
npm run compile

# Copy env
cp .env.example .env
# Fill in CASINO_PRIVATE_KEY, BASE_RPC_URL

# Deploy to testnet
npm run deploy:testnet

# Start server
npm run server
```

## Production Mode (current)

- Frontend: Vercel
- API: Vercel Functions (`/api/*`)
- Database: Supabase
- VM/Caddy: development/staging only

## A2A Interface

All interactions via `POST /a2a/casino`:

```json
{
  "version": "0.3.0",
  "from": { "name": "Anonymous" },
  "message": {
    "contentType": "application/json",
    "content": {
      "action": "slots_commit",
      "stealthAddress": "0x...",
      "betAmount": 0.001
    }
  }
}
```

### Actions

| Action | Description |
|--------|-------------|
| `relay_fund` | Fund stealth address via relay |
| `open_channel` | Open state channel |
| `close_channel` | Cooperative channel close |
| `channel_status` | Check channel balance |
| `slots_commit` | Start slot spin (get commitment) |
| `slots_reveal` | Complete spin (send agent seed) |
| `coinflip_commit` | Start coinflip (get commitment + choose side) |
| `coinflip_reveal` | Complete flip (send agent seed) |
| `dice_commit` | Start dice roll (get commitment + choose over/under + target) |
| `dice_reveal` | Complete roll (send agent seed) |
| `lotto_buy` | Buy lotto ticket |
| `lotto_status` | Current draw info |
| `info` | Casino info and rules |
| `stats` | Active channel count |

## SDK Usage

```javascript
const AgentCasinoClient = require('./sdk/agent-client');

const client = new AgentCasinoClient('http://localhost:3847/a2a/casino');

// Start session (generates stealth address)
await client.startSession(0.1); // 0.1 ETH deposit

// Play slots
const spin = await client.playSlots(0.001);
console.log(spin.reels, spin.payout);

// Play coinflip
const flip = await client.playCoinflip(0.001, 'heads');
console.log(flip.result, flip.won, flip.payout);

// Play dice (roll over 75 for ~3.8x payout)
const roll = await client.playDice(0.001, 'over', 75);
console.log(roll.roll, roll.won, roll.multiplier, roll.payout);

// Buy lotto ticket
await client.buyLottoTicket(42, 1);

// Close session
const result = await client.closeSession();
console.log(result.sessionStats);
```

## Game Math

### Slots RTP Proof
```
Symbol    Weight  P(three)  Payout  EV
Cherry    30%     2.700%    5x      0.13500
Lemon     25%     1.5625%   10x     0.15625
Orange    20%     0.800%    25x     0.20000
Diamond   15%     0.3375%   50x     0.16875
Seven     10%     0.100%    290x    0.29000
                                    -------
                              RTP = 0.95000 (95%)
```

### Coinflip RTP
```
P(win) = 50%
Payout = 1.9x
EV = 0.50 x 1.9 = 0.95 (95% RTP)
```

### Dice RTP Proof
```
Any choice/target with win probability P:
Payout = (1/P) × 0.95
RTP = P × Payout = P × (1/P) × 0.95 = 0.95 (95%)

Examples:
Roll over 50:  P=49%, Payout=1.94x, RTP=95%
Roll over 90:  P=9%,  Payout=10.56x, RTP=95%
Roll under 10: P=10%, Payout=9.50x, RTP=95%
```

### Lotto RTP
```
P(win) = 1/100 = 1%
Payout = 85x
EV = 0.01 x 85 = 0.85 (85% RTP)
```

## License

MIT
