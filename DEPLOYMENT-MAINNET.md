# EntropyDice Base Mainnet Deployment Guide

## Prerequisites Checklist

- [ ] Deployer wallet with Ξ for gas (~0.02 Ξ)
- [ ] BaseScan API key (for verification)
- [ ] Pyth Entropy contract addresses (Base mainnet)
- [ ] Casino KMS wallet address: `0x1Af5f519DC738aC0f3B58B19A4bB8A8441937e78`
- [ ] All tests passing (`forge test`)

## Step 1: Get Pyth Entropy Addresses

### Option A: Check Pyth Documentation
Visit: https://docs.pyth.network/entropy/contract-addresses

Look for Base (Chain ID: 8453):
- Entropy contract address
- Default provider address

### Option B: Check Existing EntropyCoinflip
If EntropyCoinflip is already deployed, use the same addresses:

```bash
# Read from existing contract (if deployed)
cast call $ENTROPY_COINFLIP "entropy()(address)" --rpc-url $BASE_RPC_URL
cast call $ENTROPY_COINFLIP "entropyProvider()(address)" --rpc-url $BASE_RPC_URL
```

### Expected Addresses (verify before use)
```bash
# Base Mainnet (8453)
ENTROPY_ADDRESS=0x... # Pyth Entropy contract
ENTROPY_PROVIDER=0x... # Pyth default provider (or 0x0 to use default)
```

## Step 2: Set Environment Variables

Update `.env`:
```bash
# Deployment
DEPLOYER_PRIVATE_KEY=<your_deployer_private_key>
BASESCAN_API_KEY=<your_basescan_api_key>

# Pyth Entropy (Base Mainnet)
ENTROPY_ADDRESS=<pyth_entropy_contract>
ENTROPY_PROVIDER=<pyth_provider_or_0x0>

# Casino Admin
ENTROPY_ADMIN=0x1Af5f519DC738aC0f3B58B19A4bB8A8441937e78

# Optional
ENTROPY_CALLBACK_GAS_LIMIT=120000
```

## Step 3: Deploy Contract

```bash
cd agent-casino

# Compile
npx hardhat compile

# Deploy to Base Mainnet
npx hardhat run deploy/deploy-entropy-dice.js --network base

# Expected output:
# Network: base
# Deployer: 0x...
# Admin: 0x1Af5f519DC738aC0f3B58B19A4bB8A8441937e78
# Entropy: 0x...
# Entropy provider: 0x...
# EntropyDice deployed: 0x...
#
# Set env:
# ENTROPY_DICE=0x...
# RNG_PROVIDER=pyth_entropy
```

**IMPORTANT:** Save the deployed contract address immediately.

## Step 4: Verify on BaseScan

Should happen automatically if `BASESCAN_API_KEY` is set. If not:

```bash
npx hardhat verify --network base \
  <ENTROPY_DICE_ADDRESS> \
  <CASINO_ADMIN> \
  <ENTROPY_ADDRESS> \
  <ENTROPY_PROVIDER>
```

Verify at: https://basescan.org/address/<ENTROPY_DICE_ADDRESS>

## Step 5: Update Environment (Vercel)

Add to Vercel project environment variables:

```
ENTROPY_DICE=0x... (deployed address)
```

Redeploy:
```bash
git push origin main
```

Or trigger manual redeploy in Vercel dashboard.

## Step 6: Update Local Environment

Update `.env`:
```bash
ENTROPY_DICE=0x...
```

## Step 7: Integration Testing

### 7a. Test Quote Fee
```bash
cast call $ENTROPY_DICE "quoteFee()(uint256)" --rpc-url $BASE_RPC_URL
```

Expected: Non-zero fee in wei.

### 7b. Test Request (from casino wallet)
⚠️ **This costs real Ξ** — test on Sepolia first if unsure.

```javascript
// test-entropy-dice-mainnet.js
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);

// Use KMS signer in production
const { KmsSigner } = require('./server/kms-signer');
const casino = new KmsSigner(provider);

const ENTROPY_DICE_ABI = [
  'function quoteFee() view returns (uint256)',
  'function requestDice(bytes32,address,uint8,uint8,uint256,bytes32) payable returns (uint64)',
];

const dice = new ethers.Contract(process.env.ENTROPY_DICE, ENTROPY_DICE_ABI, casino);

async function test() {
  const fee = await dice.quoteFee();
  console.log('Fee:', ethers.formatEther(fee), 'Ξ');
  
  const roundId = ethers.id('test-round-1');
  const agent = '0x...'; // test agent address
  const choice = 0; // over
  const target = 50;
  const betAmount = ethers.parseEther('0.001');
  const userRandom = ethers.id('random');
  
  const tx = await dice.requestDice(
    roundId,
    agent,
    choice,
    target,
    betAmount,
    userRandom,
    { value: fee }
  );
  
  const receipt = await tx.wait();
  console.log('Request tx:', receipt.hash);
  console.log('Sequence:', receipt.logs[0]); // Parse EntropyRequested event
}

test().catch(console.error);
```

### 7c. Test via API

```bash
# Local server with mainnet config
npm run server

# Test entropy commit
curl -X POST http://localhost:3847/a2a/casino \
  -H "Content-Type: application/json" \
  -d '{
    "from": "TestAgent",
    "message": {
      "contentType": "application/json",
      "content": {
        "action": "dice_entropy_commit",
        "stealthAddress": "0x...",
        "betAmount": "0.001",
        "choice": "over",
        "target": 50
      }
    }
  }'
```

Expected response:
```json
{
  "roundId": "0x...",
  "requestId": 1,
  "requestTxHash": "0x...",
  "chainId": 8453,
  "status": "entropy_requested",
  "choice": "over",
  "target": 50,
  "betAmount": "0.001",
  "multiplier": "1.94"
}
```

### 7d. Wait for Callback (10-30s)

Monitor BaseScan for callback tx or poll status:

```bash
curl http://localhost:3847/a2a/casino \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "action": "dice_entropy_status",
      "roundId": "0x..."
    }
  }'
```

### 7e. Finalize

```bash
curl http://localhost:3847/a2a/casino \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "action": "dice_entropy_finalize",
      "roundId": "0x..."
    }
  }'
```

Expected: Result with roll, won, payout, proof.

## Step 8: Production Deployment (API)

Update API handler if needed (should already be integrated):

```javascript
// frontend/api/a2a/casino.js already has:
// - dice_entropy_commit
// - dice_entropy_status  
// - dice_entropy_finalize
// - diceOutcomeFromEntropy()
```

Verify in production:
```bash
curl https://www.agentroyale.xyz/api/a2a/casino \
  -H "Content-Type: application/json" \
  -d '{"content":{"action":"info"}}'
```

Check that dice entropy actions are listed.

## Step 9: Update Documentation

Update landing page / docs:
- Dice game now available with Pyth Entropy
- Verifiable randomness
- Link to BaseScan contract

## Step 10: Announce

Tweet from @mr_crtee / Cast from @mr-tee:
```
🎲 Dice is live on Agent Royale with Pyth Entropy

Roll over or under (1-99). You choose the risk. 
95% RTP. Verifiable onchain randomness.

Try it: https://agentroyale.xyz
Contract: https://basescan.org/address/<ENTROPY_DICE>

#AgentRoyale #PythEntropy #Base
```

## Monitoring (First 24h)

### Metrics to Watch

1. **Contract calls:**
   - requestDice frequency
   - Callback success rate
   - markSettled calls

2. **Callback latency:**
   - Median time from request to fulfillment
   - P95 latency
   - Failed callbacks

3. **Gas costs:**
   - Average gas per request
   - Fee fluctuations
   - Total cost per round

4. **Errors:**
   - Reverts (by type)
   - Timeout rate (rounds expired)
   - Invalid targets/choices

### Alerts

Set up alerts for:
- Callback latency > 2 minutes
- Callback failure rate > 5%
- Gas price spikes > 50 gwei
- Contract paused (unexpected)
- Multiple expired rounds

### Grafana/Datadog Queries

```sql
-- Callback latency
SELECT roundId, fulfilledAt - requestedAt AS latency_seconds
FROM entropy_rounds
WHERE game = 'dice'
ORDER BY created_at DESC
LIMIT 100;

-- Success rate
SELECT 
  COUNT(*) AS total,
  SUM(CASE WHEN state = 'settled' THEN 1 ELSE 0 END) AS settled,
  SUM(CASE WHEN state = 'expired' THEN 1 ELSE 0 END) AS expired
FROM entropy_rounds
WHERE game = 'dice'
AND created_at > NOW() - INTERVAL '24 hours';
```

## Rollback Plan

If critical issues found:

### Immediate (< 5 min)
```bash
# Pause contract (KMS wallet)
cast send $ENTROPY_DICE "setPaused(bool)" true \
  --rpc-url $BASE_RPC_URL \
  --private-key <KMS_key_or_use_KMS_signer>
```

### API Fallback (< 10 min)
```bash
# Remove ENTROPY_DICE from Vercel env
# Redeploy (falls back to commit-reveal only)
```

### Database Cleanup
```sql
-- Mark pending rounds as failed
UPDATE entropy_rounds
SET state = 'failed'
WHERE game = 'dice'
AND state = 'entropy_requested'
AND created_at < NOW() - INTERVAL '10 minutes';
```

## Success Criteria

- [ ] Contract deployed and verified
- [ ] Quote fee returns valid value
- [ ] Test request succeeds onchain
- [ ] Callback received within 30s
- [ ] Finalize returns correct result
- [ ] API integration working
- [ ] Monitoring set up
- [ ] No errors in first 10 test rounds
- [ ] Documentation updated
- [ ] Announcement posted

## Deployment Checklist

- [ ] All tests passing (`forge test`)
- [ ] Gas optimization verified
- [ ] Pyth addresses confirmed
- [ ] Deployer wallet funded
- [ ] BaseScan API key set
- [ ] Deploy script tested on Sepolia
- [ ] Deploy to Base mainnet
- [ ] Contract verified on BaseScan
- [ ] Vercel env updated
- [ ] API redeploy triggered
- [ ] Integration tests passed
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Announcement ready

## Next Steps After Deployment

1. Monitor first 100 rounds closely
2. Gather user feedback
3. Optimize gas if needed
4. Consider additional games using same pattern
5. Publish post-mortem / learnings

## Support Contacts

- Pyth Network: https://discord.gg/pythnetwork
- Base Network: https://discord.com/invite/buildonbase
- Agent Royale: security@agentroyale.xyz

---

**Deploy Date:** _____________  
**Deployed Address:** _____________  
**Deployer:** _____________  
**Verified:** ☐ Yes ☐ No  
**Production:** ☐ Yes ☐ No
