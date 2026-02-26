# EntropyDice Deployment Guide

## Prerequisites

- Hardhat configured with Base network
- Deployer wallet with Ξ for gas
- Pyth Entropy contract addresses (Base mainnet + testnet)
- Casino KMS wallet address (for admin role)

## Pyth Entropy Addresses

### Base Mainnet (8453)
- **Entropy:** TBD (check docs.pyth.network)
- **Provider:** TBD (default provider from contract)

### Base Sepolia (84532)
- **Entropy:** TBD (check docs.pyth.network)
- **Provider:** TBD (default provider from contract)

## Deployment Steps

### 1. Environment Setup

```bash
# .env
DEPLOYER_PRIVATE_KEY=<deployer_wallet_private_key>
ENTROPY_ADDRESS=<pyth_entropy_contract>
ENTROPY_PROVIDER=<pyth_provider_address>
ENTROPY_ADMIN=<casino_kms_wallet> # 0x1Af5f519DC738aC0f3B58B19A4bB8A8441937e78
BASESCAN_API_KEY=<optional_for_verification>
```

### 2. Deploy to Base Sepolia (Testnet)

```bash
# Test deployment first
npx hardhat run deploy/deploy-entropy-dice.js --network baseSepolia

# Expected output:
# Network: baseSepolia
# Deployer: 0x...
# Admin: 0x1Af5...37e78
# Entropy: 0x...
# Entropy provider: 0x...
# EntropyDice deployed: 0x...
# 
# Set env:
# ENTROPY_DICE=0x...
# RNG_PROVIDER=pyth_entropy
```

Save the deployed contract address.

### 3. Verify Contract (BaseScan)

```bash
# Already done automatically if BASESCAN_API_KEY is set
# Manual verify if needed:
npx hardhat verify --network baseSepolia <ENTROPY_DICE_ADDRESS> \
  <ADMIN_ADDRESS> \
  <ENTROPY_ADDRESS> \
  <ENTROPY_PROVIDER>
```

### 4. Test on Sepolia

Update `.env`:
```bash
ENTROPY_DICE=<sepolia_contract_address>
RNG_PROVIDER=pyth_entropy
ONCHAIN_RPC_URL=<base_sepolia_rpc>
```

Run test:
```bash
npm run server

# New terminal
node sdk/examples/play-dice-entropy.js http://localhost:3847/a2a/casino 0.01 0.001 3
```

Expected flow:
1. Session opens
2. Dice entropy commit (onchain tx)
3. Wait for Pyth callback (~10-30s)
4. Finalize (reads entropy value, calculates outcome)
5. Repeat for 3 rolls
6. Close session

### 5. Deploy to Base Mainnet

```bash
# Update .env for mainnet
ENTROPY_ADDRESS=<pyth_entropy_mainnet>
ENTROPY_PROVIDER=<pyth_provider_mainnet>

# Deploy
npx hardhat run deploy/deploy-entropy-dice.js --network base

# Save output address
# ENTROPY_DICE=0x...
```

### 6. Update Vercel Environment

Add to Vercel project settings → Environment Variables:

```
ENTROPY_DICE=<mainnet_contract_address>
RNG_PROVIDER=pyth_entropy
```

Redeploy or wait for next push.

### 7. Production Test

```bash
node sdk/examples/play-dice-entropy.js https://www.agentroyale.xyz/api/a2a/casino 0.01 0.001 3
```

Monitor:
- BaseScan for contract calls
- API logs for finalize timing
- Pyth Entropy dashboard for callback latency

## Contract Interface

### Key Functions

```solidity
// Quote entropy fee (call before request)
function quoteFee() external view returns (uint256);

// Request dice roll (casino only)
function requestDice(
    bytes32 roundId,
    address agent,
    uint8 choice,      // 0=over, 1=under
    uint8 target,      // 1-99
    uint256 betAmount,
    bytes32 userRandom
) external payable returns (uint64 sequenceNumber);

// Get round state
function getRound(bytes32 roundId) external view returns (
    address agent,
    uint8 choice,
    uint8 target,
    uint256 betAmount,
    uint64 sequenceNumber,
    bytes32 userRandom,
    bytes32 entropyRandom,
    uint256 requestedAt,
    uint256 fulfilledAt,
    RoundState state
);

// Mark settled (casino only, after finalize)
function markSettled(bytes32 roundId) external;

// Mark expired (casino only, if timeout)
function markExpired(bytes32 roundId) external;
```

### Admin Functions

```solidity
// Pause/unpause
function setPaused(bool _paused) external onlyCasino;

// Update entropy provider
function setEntropyProvider(address _provider) external onlyCasino;

// Update callback gas limit
function setCallbackGasLimit(uint32 _gasLimit) external onlyCasino;

// Update round TTL
function setRoundTtl(uint256 _ttl) external onlyCasino;
```

## Monitoring

### Contract Events

```solidity
event EntropyRequested(
    bytes32 indexed roundId,
    uint64 indexed sequenceNumber,
    address indexed agent,
    uint8 choice,
    uint8 target,
    uint256 betAmount,
    bytes32 userRandom,
    uint256 fee
);

event EntropyFulfilled(
    bytes32 indexed roundId,
    uint64 indexed sequenceNumber,
    bytes32 entropyRandom
);

event RoundStateChanged(
    bytes32 indexed roundId,
    RoundState state
);
```

### Health Checks

1. **Entropy callback latency**
   - Median: < 30s
   - P95: < 60s
   - Alert if > 2min

2. **Pending rounds**
   - Normal: < 10 pending
   - Alert if > 50 pending

3. **Failed callbacks**
   - Rate: < 1% of requests
   - Alert if > 5%

4. **Gas usage**
   - Request: ~200k gas
   - Callback: ~120k gas (configurable)

## Troubleshooting

### Round stuck in "Requested" state
- Check Pyth Entropy provider status
- Verify callback gas limit is sufficient
- Check contract has callback registered
- Call `markExpired` after TTL (5min default)

### "Entropy not ready" error on finalize
- Wait longer (callback may still be pending)
- Check Pyth network status
- Verify entropy provider is correct

### Fee estimation fails
- Pyth Entropy contract may be paused
- Provider address incorrect
- Network congestion (retry with higher fee)

### Invalid target/choice errors
- Target must be 1-99
- Can't bet "over 99" or "under 1"
- Choice must be "over" or "under"

## Security Notes

- Only casino wallet can call `requestDice`, `markSettled`, `markExpired`
- Entropy callback can only come from Pyth Entropy contract
- Round fulfillment is one-time (no replay)
- TTL enforced (5min default, configurable)
- Edge cases validated onchain

## Cost Estimates

- Deploy EntropyDice: ~2-3M gas (~$0.10-0.50 at 10 gwei)
- Request entropy: ~200k gas + Pyth fee (~$0.01-0.05)
- Callback (automatic): Paid by Pyth
- Mark settled: ~50k gas (~$0.001-0.005)

Total per entropy dice roll: ~$0.02-0.10 (mostly Pyth fee)

## References

- **Pyth Entropy Docs:** https://docs.pyth.network/entropy
- **Base Network Docs:** https://docs.base.org
- **EntropyCoinflip (reference):** `contracts/EntropyCoinflip.sol`
- **Deployment Script:** `deploy/deploy-entropy-dice.js`
