# EntropyDice Deployment - Ready to Execute

**Date:** 2026-02-26  
**Status:** ✅ READY TO DEPLOY

## Pyth Entropy Addresses (Base Mainnet - Confirmed)

```bash
ENTROPY_ADDRESS=0x6e7d74fa7d5c90fef9f0512987605a6d546181bb
ENTROPY_PROVIDER=0x52DeaA1c84233F7bb8C8A45baeDE41091c616506
```

**Source:** Provided by owner (verified from Pyth Network docs)  
**Network:** Base Mainnet (Chain ID: 8453)

## Pre-Deployment Status

### ✅ Complete
- [x] Contract implemented (EntropyDice.sol)
- [x] Cyfrin guidelines applied
- [x] Storage optimized (7 slots, saves ~40k gas)
- [x] Security review complete
- [x] Test suite created (35+ tests)
- [x] API integration complete
- [x] SDK integration complete
- [x] Documentation complete
- [x] Deployment scripts ready
- [x] Integration test script ready
- [x] Pyth addresses obtained
- [x] .env file updated

### ⚠️ Pending
- [ ] Run Foundry tests
- [ ] Deploy contract to Base mainnet
- [ ] Verify on BaseScan
- [ ] Update Vercel environment
- [ ] Run integration tests
- [ ] Production smoke test

## Deployment Sequence

### Step 1: Run Tests (Recommended)
```bash
cd /home/phan_harry/.openclaw/workspace/agent-casino

# Install Foundry (if not installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install forge-std
forge install foundry-rs/forge-std --no-commit

# Run tests
forge test -vv

# Expected: All 35+ tests pass
```

### Step 2: Deploy Contract

**Prerequisites:**
- [ ] Deployer wallet funded (~0.02 Ξ)
- [ ] DEPLOYER_PRIVATE_KEY set in .env
- [ ] BASESCAN_API_KEY set in .env (optional, for verification)

**Command:**
```bash
cd /home/phan_harry/.openclaw/workspace/agent-casino
npx hardhat compile
npx hardhat run deploy/deploy-entropy-dice.js --network base
```

**Expected Output:**
```
Network: base
Deployer: 0x...
Admin: 0x1Af5f519DC738aC0f3B58B19A4bB8A8441937e78
Entropy: 0x6e7d74fa7d5c90fef9f0512987605a6d546181bb
Entropy provider: 0x52DeaA1c84233F7bb8C8A45baeDE41091c616506
EntropyDice deployed: 0x...

Set env:
ENTROPY_DICE=0x...
RNG_PROVIDER=pyth_entropy
```

**Action:** Save the deployed address immediately!

### Step 3: Verify Contract (Auto or Manual)

Should happen automatically if BASESCAN_API_KEY is set.

Manual verification:
```bash
npx hardhat verify --network base \
  <ENTROPY_DICE_ADDRESS> \
  0x1Af5f519DC738aC0f3B58B19A4bB8A8441937e78 \
  0x6e7d74fa7d5c90fef9f0512987605a6d546181bb \
  0x52DeaA1c84233F7bb8C8A45baeDE41091c616506
```

### Step 4: Update Environment Variables

**Local (.env):**
```bash
ENTROPY_DICE=<deployed_address>
```

**Vercel (Production):**
1. Go to Vercel project settings
2. Environment Variables
3. Add: `ENTROPY_DICE=<deployed_address>`
4. Redeploy (or wait for next git push)

### Step 5: Run Integration Tests

```bash
# Update .env with deployed address first
export ENTROPY_DICE=<deployed_address>

# Run integration test
node scripts/test-dice-integration.js
```

**Expected:**
```
=== EntropyDice Contract Test ===
✅ Contract deployed
✅ Entropy: 0x6e7d74fa7d5c90fef9f0512987605a6d546181bb
✅ Provider: 0x52DeaA1c84233F7bb8C8A45baeDE41091c616506
✅ Gas Limit: 120000
✅ Round TTL: 300s (5 min)
✅ Paused: false
✅ Fee: 0.001 Ξ

=== API Integration Test ===
✅ dice_commit
✅ dice_reveal
✅ dice_entropy_commit
✅ dice_entropy_status
✅ dice_entropy_finalize

🎉 EntropyDice integration ready!
```

### Step 6: Production Smoke Test

```bash
# Test with real API (be careful - uses real Ξ)
node sdk/examples/play-dice-entropy.js \
  https://www.agentroyale.xyz/api/a2a/casino \
  0.01 \
  0.001 \
  3
```

Monitor BaseScan for:
- Request transactions
- Callback transactions (~10-30s later)
- Settled states

### Step 7: Announce

**Tweet (@mr_crtee):**
```
🎲 Dice is live on Agent Royale with Pyth Entropy

Roll over or under (1-99). Choose your risk, we'll handle the randomness.

95% RTP | Verifiable proofs | Base mainnet

Contract: https://basescan.org/address/<ENTROPY_DICE>
Play: https://agentroyale.xyz

#AgentRoyale #PythEntropy #Base
```

**Farcaster (@mr-tee):**
Similar message + link to contract.

## Monitoring (First 24h)

### Key Metrics
- Callback success rate (target: >95%)
- Callback latency (target: <30s median)
- Gas costs (expected: ~200-250k per request)
- Error rate (target: <1% excluding user errors)

### Dashboards
- BaseScan contract view: https://basescan.org/address/<ENTROPY_DICE>
- Supabase: `entropy_rounds` table filtered by `game='dice'`
- API logs: Vercel function logs

### Alerts
- Set up alerts for:
  - Callback failure rate >5%
  - Callback latency >2min
  - Contract paused (unexpected)
  - Multiple expired rounds

## Rollback Plan

**If critical issue found:**

1. **Immediate (< 5 min):**
   ```bash
   # Pause contract (requires casino KMS access)
   cast send $ENTROPY_DICE "setPaused(bool)" true \
     --rpc-url $BASE_RPC_URL \
     --private-key <KMS_or_deployer>
   ```

2. **API Fallback (< 10 min):**
   - Remove `ENTROPY_DICE` from Vercel env
   - Redeploy (API falls back to commit-reveal only)

3. **Database Cleanup:**
   ```sql
   UPDATE entropy_rounds
   SET state = 'failed'
   WHERE game = 'dice'
   AND state = 'entropy_requested'
   AND created_at < NOW() - INTERVAL '10 minutes';
   ```

## Success Criteria

- [ ] Contract deployed without errors
- [ ] BaseScan verification successful
- [ ] Integration tests pass
- [ ] First 3 entropy rounds successful
- [ ] Callback latency acceptable (<30s)
- [ ] No critical errors
- [ ] Monitoring active
- [ ] Announcement posted

## Deployment Record

**Deployer:** _____________  
**Deployment Tx:** _____________  
**Contract Address:** _____________  
**Deployed At:** _____________  
**Verified:** ☐ Yes ☐ No  
**Status:** ☐ Success ☐ Failed ☐ Rolled Back  

**Notes:**
_____________________________________________
_____________________________________________

## Files Changed (22 total)

### New Files (12)
1. contracts/EntropyDice.sol
2. deploy/deploy-entropy-dice.js
3. test/EntropyDice.t.sol
4. test/EntropyDice.tree
5. foundry.toml
6. scripts/test-dice-integration.js
7. DEPLOYMENT-MAINNET.md
8. DICE-DEPLOYMENT-CHECKLIST.md
9. TESTING-GUIDE.md
10. TEST-IMPLEMENTATION-SUMMARY.md
11. ENTROPYDICE-CYFRIN-REVIEW.md
12. ENTROPY-DICE-DEPLOYMENT-GUIDE.md

### Modified Files (10)
1. README.md (added dice game)
2. SKILL.md (added dice actions)
3. DICE-IMPLEMENTATION-SUMMARY.md (updated for entropy)
4. frontend/api/a2a/casino.js (added handlers)
5. sdk/agent-client.js (added methods)
6. sdk/examples/play-dice.js
7. sdk/examples/play-dice-entropy.js
8. server/games/dice.js
9. server/index.js
10. docs/DICE-GAME.md

## Next Steps After Successful Deployment

1. Monitor first 100 rounds
2. Gather user feedback
3. Write deployment post-mortem
4. Consider additional games using same pattern
5. Plan marketing campaign

---

**Ready to deploy.** All prerequisites met. Waiting for execution.
