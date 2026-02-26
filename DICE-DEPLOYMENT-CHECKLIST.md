# Dice Game Deployment Checklist

## Pre-Deployment

### Code Quality
- [x] Contract written (EntropyDice.sol)
- [x] Cyfrin guidelines applied
- [x] Storage optimized (7 slots)
- [x] Gas optimizations applied
- [x] Security review complete

### Testing
- [x] Test suite created (35+ tests)
- [ ] All tests passing (`forge test`)
- [ ] Fuzz tests passing (256 runs)
- [ ] Coverage > 95% (`forge coverage`)
- [ ] Gas benchmarks acceptable

### Documentation
- [x] SKILL.md updated
- [x] README.md updated
- [x] API documentation complete
- [x] Deployment guide created
- [x] Testing guide created

## Testnet Deployment (Recommended First)

### Base Sepolia
- [ ] Get Pyth Entropy addresses (Sepolia)
- [ ] Deploy EntropyDice to Sepolia
- [ ] Verify contract on BaseScan
- [ ] Fund test agent wallet
- [ ] Test full round lifecycle
- [ ] Verify callback works (10-30s)
- [ ] Test edge cases onchain
- [ ] Monitor for 24h

## Mainnet Deployment

### Pre-Deploy
- [ ] Get Pyth Entropy addresses (Base mainnet)
- [ ] Verify Pyth addresses correct
- [ ] Deployer wallet funded (~0.02 Ξ)
- [ ] BaseScan API key ready
- [ ] Backup deployment script

### Deploy Contract
- [ ] Set environment variables
- [ ] Run `npx hardhat compile`
- [ ] Run `npx hardhat run deploy/deploy-entropy-dice.js --network base`
- [ ] Save deployed address immediately
- [ ] Verify on BaseScan (auto or manual)
- [ ] Screenshot deployment tx

### Verify Deployment
- [ ] Contract code verified on BaseScan
- [ ] Read `entropy()` matches Pyth
- [ ] Read `entropyProvider()` correct
- [ ] Read `callbackGasLimit()` = 120000
- [ ] Read `roundTtl()` = 300 (5 min)
- [ ] Read `paused()` = false
- [ ] Run `quoteFee()` returns non-zero

## Integration

### Update Environment
- [ ] Add `ENTROPY_DICE=0x...` to local .env
- [ ] Add `ENTROPY_DICE=0x...` to Vercel env
- [ ] Redeploy API (Vercel)
- [ ] Verify API redeployed successfully

### API Verification
- [ ] Run `node scripts/test-dice-integration.js`
- [ ] Contract accessible via API
- [ ] Actions present in `/casino/games`
- [ ] `dice_entropy_commit` works
- [ ] `dice_entropy_status` works
- [ ] `dice_entropy_finalize` works

### SDK Verification
- [ ] `playDice()` works (commit-reveal)
- [ ] `playDiceEntropy()` works (Pyth)
- [ ] Proofs verified correctly
- [ ] State storage works

## Testing (Production)

### Smoke Tests
- [ ] Open test channel
- [ ] Play 1 dice round (commit-reveal)
- [ ] Play 1 dice round (entropy)
- [ ] Wait for callback (~30s)
- [ ] Finalize successfully
- [ ] Verify result matches proof
- [ ] Close channel

### Edge Cases
- [ ] Test over 50 (valid)
- [ ] Test under 50 (valid)
- [ ] Test over 98 (valid edge)
- [ ] Test under 2 (valid edge)
- [ ] Attempt over 99 (should reject)
- [ ] Attempt under 1 (should reject)

### Performance
- [ ] Callback latency < 30s (median)
- [ ] Gas costs as expected (~200k + fee)
- [ ] No reverts (except invalid inputs)
- [ ] Database records correct

## Monitoring

### Setup Alerts
- [ ] Callback latency > 2min
- [ ] Callback failure rate > 5%
- [ ] Contract paused (unexpected)
- [ ] Multiple expired rounds
- [ ] Gas price spikes

### Dashboards
- [ ] Grafana/Datadog for rounds
- [ ] BaseScan watchlist
- [ ] Error rate monitoring
- [ ] User metrics

## Documentation

### Public
- [ ] Update agentroyale.xyz landing
- [ ] Add dice to game list
- [ ] Document entropy mode
- [ ] Link to BaseScan contract
- [ ] Update API docs

### Internal
- [ ] Record deployed address
- [ ] Document monitoring setup
- [ ] Create runbook for issues
- [ ] Update incident response plan

## Launch

### Announcement
- [ ] Tweet from @mr_crtee
- [ ] Cast from @mr-tee
- [ ] Discord announcement
- [ ] Update GitHub README

### Community
- [ ] Agent communities notified
- [ ] Demo video/GIF ready
- [ ] Support channels ready

## Post-Launch (First 24h)

### Monitor
- [ ] Watch first 10 rounds closely
- [ ] Check callback success rate
- [ ] Review gas costs
- [ ] Track user feedback
- [ ] Log any errors

### Metrics
- [ ] Total rounds played
- [ ] Avg callback latency
- [ ] Gas costs vs estimate
- [ ] Revenue generated
- [ ] User satisfaction

## Week 1 Review

- [ ] Performance review
- [ ] User feedback summary
- [ ] Gas optimization opportunities
- [ ] Bug reports addressed
- [ ] Post-mortem if needed

## Rollback Plan

### If Critical Issue
- [ ] Pause contract: `setPaused(true)`
- [ ] Remove `ENTROPY_DICE` from Vercel
- [ ] Redeploy API (falls back to commit-reveal)
- [ ] Mark pending rounds as failed (DB)
- [ ] Communicate to users

### Rollback Steps
1. Pause contract (< 5 min)
2. API fallback (< 10 min)
3. Database cleanup
4. User communication
5. Root cause analysis
6. Fix and redeploy

## Success Criteria

- [ ] Contract deployed without errors
- [ ] All integration tests pass
- [ ] First 10 rounds successful
- [ ] Callback latency acceptable
- [ ] No critical bugs found
- [ ] Monitoring functioning
- [ ] Documentation complete
- [ ] Users successfully playing

## Sign-Off

**Deployed By:** _____________  
**Date:** _____________  
**Contract:** _____________  
**Verified:** ☐ Yes ☐ No  
**Monitoring:** ☐ Active ☐ Pending  
**Status:** ☐ Production ☐ Testing ☐ Rolled Back  

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________

---

## Next Game

After dice is stable, consider:
- [ ] Blackjack (multi-step game)
- [ ] Roulette (single number + groups)
- [ ] Baccarat (player vs banker)
- [ ] Plinko (visual + multipliers)
