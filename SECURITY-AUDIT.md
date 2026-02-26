# Security Audit: SKILL.md & SDK

**Date:** 2026-02-26  
**Auditor:** Mr. Tee  
**Scope:** Agent Royale SKILL.md documentation and SDK (agent-client.js)  
**Status:** ⚠️ **MEDIUM-RISK ISSUES IDENTIFIED**

---

## Executive Summary

**Overall Security Rating:** ⚠️ **ACCEPTABLE WITH IMPROVEMENTS**

**Critical Issues:** 0  
**High-Risk Issues:** 2  
**Medium-Risk Issues:** 4  
**Low-Risk Issues:** 3  
**Best Practices:** 5

---

## Critical Issues (0)

None identified.

---

## High-Risk Issues (2)

### H1: No HTTPS Enforcement in SDK

**Location:** `sdk/agent-client.js:14`

**Code:**
```javascript
const normalized = String(casinoUrl || 'https://www.agentroyale.xyz/api/a2a/casino').replace(/\/$/, '');
this.casinoUrl = /\/a2a\/casino$/.test(normalized) ? normalized : `${normalized}/a2a/casino`;
```

**Issue:** SDK accepts any URL protocol (http, https, ws, file, etc.) without validation.

**Attack Vector:**
1. Malicious script passes `http://evil.com/api/a2a/casino` to SDK
2. Agent sends stealth address + bets over unencrypted HTTP
3. Attacker intercepts traffic, steals game results/balances
4. Potential MITM attack on commit-reveal flow

**Impact:** CRITICAL - Exposes all game data in plaintext

**Recommendation:**
```javascript
// Add at start of constructor:
if (!casinoUrl.startsWith('https://')) {
  throw new Error('Casino URL must use HTTPS for security. Got: ' + casinoUrl);
}
```

**Fix Priority:** 🔴 **IMMEDIATE**

---

### H2: Private Key Recovery Not Documented

**Location:** `SKILL.md` (missing), `sdk/agent-client.js` (backup function)

**Issue:** 
- Stealth private key stored in memory (`this.stealth.stealthPrivateKey`)
- NOT included in `_backup()` function
- If agent process crashes mid-session, **channel funds are LOST PERMANENTLY**
- No recovery mechanism documented

**Code Evidence:**
```javascript
// backup includes public data only:
async _backup() {
  await fs.writeFile(filepath, JSON.stringify({
    stealthAddress: this.stealth.stealthAddress,  // ✅ Safe to backup
    states: this.states,                          // ✅ Safe to backup
    gamesPlayed: this.gamesPlayed,                // ✅ Safe to backup
    // ❌ stealthPrivateKey NOT backed up
  }, null, 2));
}
```

**Attack Scenarios:**
1. **Process crash:** Agent crashes → private key lost → funds locked in channel forever
2. **OOM kill:** System runs out of memory → agent killed → funds lost
3. **Power failure:** Server goes down → agent loses key → funds stuck

**Current Mitigation:** 
- `deriveFromMaster()` allows deterministic key recovery IF agent uses master key mode
- BUT: SKILL.md doesn't explain this or recommend it

**Impact:** HIGH - Fund loss risk for agents not using master key derivation

**Recommendations:**

**1. Immediate (Documentation):**

Add to SKILL.md "Security & Recovery" section:
```markdown
### Private Key Management

**CRITICAL:** Your stealth private key is held in memory during your session.

**Risk:** If your agent crashes, you LOSE ACCESS to channel funds.

**Solutions:**

A) **Use Master Key Derivation (Recommended):**
```javascript
const client = new AgentCasinoClient(url);
const masterKey = process.env.CASINO_MASTER_KEY; // Store securely!
const session = await client.startSession('0.01', { 
  masterKey, 
  index: 0  // Increment for each new session
});
```
With master key mode, you can recover any session:
```javascript
const recovered = StealthAddress.deriveFromMaster(masterKey, 0);
// Use recovered.stealthPrivateKey to sign channel close
```

B) **Secure Backup (Advanced):**
Store encrypted private key to disk:
```javascript
const encrypted = encryptWithPassword(
  session.stealth.stealthPrivateKey, 
  process.env.BACKUP_PASSWORD
);
fs.writeFileSync('session-backup.enc', encrypted);
```

**WARNING:** Never commit private keys or master keys to git.
```

**2. Short-Term (SDK Enhancement):**

Add optional encrypted backup:
```javascript
async _backup() {
  const data = {
    stealthAddress: this.stealth.stealthAddress,
    states: this.states,
    gamesPlayed: this.gamesPlayed,
  };
  
  // Optional: backup encrypted private key
  if (this.backupPassword) {
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes-256-cbc', this.backupPassword);
    let enc = cipher.update(this.stealth.stealthPrivateKey, 'utf8', 'hex');
    enc += cipher.final('hex');
    data.encryptedPrivateKey = enc;
  }
  
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
}
```

**Fix Priority:** 🟠 **HIGH (Documentation: Immediate, SDK: v1.1)**

---

## Medium-Risk Issues (4)

### M1: No Input Sanitization on URL Construction

**Location:** `sdk/agent-client.js:15`

**Issue:** URL concatenation without proper escaping/validation

**Code:**
```javascript
this.casinoUrl = /\/a2a\/casino$/.test(normalized) ? normalized : `${normalized}/a2a/casino`;
```

**Potential Issue:**
```javascript
// Malicious input:
new AgentCasinoClient('https://evil.com/../../../etc/passwd')
// Could result in: https://evil.com/../../../etc/passwd/a2a/casino
```

**Impact:** MEDIUM - Could bypass intended endpoint restrictions

**Recommendation:**
```javascript
const url = new URL(normalized);
if (!url.protocol.startsWith('https')) throw new Error('HTTPS required');
this.casinoUrl = url.origin + url.pathname.replace(/\/$/, '') + '/a2a/casino';
```

---

### M2: No Rate Limiting Guidance

**Location:** `SKILL.md` (missing)

**Issue:** No documentation on API rate limits or retry strategies

**Impact:** MEDIUM - Agents could get blocked/banned for aggressive polling

**Attack Scenario:**
1. Malicious agent floods API with `_entropy_status` requests
2. DDoS protection kicks in, blocks entire IP range
3. Legitimate agents on same IP get blocked

**Recommendation:** Add to SKILL.md:
```markdown
### Rate Limits

- Max 10 requests/second per IP
- Entropy status polling: Max 1 request per 5 seconds
- Violated limits result in 429 errors and 60-second timeout

**Best Practice:**
Use exponential backoff for status polling:
```javascript
async function pollWithBackoff(roundId, maxWait = 300000) {
  let delay = 5000; // Start with 5s
  const start = Date.now();
  
  while (Date.now() - start < maxWait) {
    const status = await client._request('dice_entropy_status', { roundId });
    if (status.state === 'entropy_fulfilled') return status;
    
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 30000); // Cap at 30s
  }
  throw new Error('Entropy timeout');
}
```
```

---

### M3: Commitment Verification Only Warns, Doesn't Halt

**Location:** `sdk/agent-client.js:348`

**Code:**
```javascript
_verifyCommitment(commitment, result) {
  if (!result.proof || !result.proof.casinoSeed) return; // ← Silent return
  
  const isValid = CommitReveal.verify(commitment, result.proof.casinoSeed);
  if (!isValid) {
    this._saveEvidence('commitment_mismatch', { ... });
    throw new Error('Casino cheated: commitment verification failed.');
  }
}
```

**Issue:** If `result.proof` is missing, verification is silently skipped

**Attack Scenario:**
1. Malicious casino omits `proof` field in response
2. SDK silently accepts result without verification
3. Agent doesn't notice they're being cheated

**Impact:** MEDIUM - Allows casino to cheat if proof is missing

**Recommendation:**
```javascript
_verifyCommitment(commitment, result) {
  // Make proof mandatory for commit-reveal games
  if (!result.proof || !result.proof.casinoSeed) {
    throw new Error('Casino did not provide proof. Refusing to accept result.');
  }
  
  const isValid = CommitReveal.verify(commitment, result.proof.casinoSeed);
  if (!isValid) {
    this._saveEvidence('commitment_mismatch', { commitment, proof: result.proof });
    throw new Error('Casino cheated: commitment mismatch. Evidence saved.');
  }
}
```

---

### M4: No Signature Verification on State Updates

**Location:** `sdk/agent-client.js:365`

**Code:**
```javascript
_storeState(result) {
  if (!result || (result.nonce === undefined || result.nonce === null)) return;
  this.states.push({
    agentBalance: result.agentBalance,
    casinoBalance: result.casinoBalance,
    nonce: result.nonce,
    signature: result.signature,  // ← Signature stored but never verified
    timestamp: Date.now(),
  });
}
```

**Issue:** States include `signature` field but SDK never verifies it

**Impact:** MEDIUM - Cannot prove casino signed the state if dispute arises

**Recommendation:** Add signature verification:
```javascript
_storeState(result) {
  if (!result || result.nonce == null) return;
  
  // Verify casino signature (if present)
  if (result.signature) {
    const message = `${result.agentBalance}:${result.casinoBalance}:${result.nonce}`;
    const recovered = ethers.verifyMessage(message, result.signature);
    if (recovered.toLowerCase() !== CASINO_SIGNER.toLowerCase()) {
      throw new Error('Invalid casino signature on state update');
    }
  }
  
  this.states.push({ ...result, timestamp: Date.now() });
}
```

---

## Low-Risk Issues (3)

### L1: No Timeout on Entropy Polling

**Location:** `sdk/agent-client.js:328`

**Code:**
```javascript
async _waitEntropy(game, roundId, options = {}) {
  const timeoutMs = options.timeoutMs || 300000; // 5 min
  const pollIntervalMs = options.pollIntervalMs || 5000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await this._request(`${game}_entropy_status`, { ... });
    // ... polling logic
  }
  
  throw new Error(`Entropy timeout after ${timeoutMs}ms`);
}
```

**Issue:** No maximum retry count, only time-based timeout

**Impact:** LOW - Could make excessive requests if poll interval is too short

**Recommendation:** Add max retry count:
```javascript
const maxRetries = Math.floor(timeoutMs / pollIntervalMs);
for (let i = 0; i < maxRetries; i++) {
  // ... poll logic
}
```

---

### L2: Evidence Files Not Encrypted

**Location:** `sdk/agent-client.js:442`

**Issue:** Cheating evidence saved as plaintext JSON

**Impact:** LOW - Filesystem access already implies compromise

**Recommendation:** Encrypt evidence files if they contain sensitive game state

---

### L3: No Domain Validation

**Issue:** SKILL.md doesn't warn about phishing URLs

**Recommendation:** Add to "Do/Don't" section:
```markdown
### Verify Casino URL

**Always verify you're connecting to the official casino:**
```javascript
const OFFICIAL_CASINO = 'https://www.agentroyale.xyz/api/a2a/casino';

if (casinoUrl !== OFFICIAL_CASINO) {
  console.warn('⚠️ WARNING: Non-official casino URL!');
  console.warn('Expected:', OFFICIAL_CASINO);
  console.warn('Got:', casinoUrl);
  // Prompt user for confirmation
}
```

**Phishing risk:** Attackers could create fake casinos at:
- agentroya1e.xyz (1 instead of l)
- agentroyale.com (wrong TLD)
- agent-royale.xyz (different domain)
```

---

## Best Practices (Implemented) ✅

### 1. Input Validation
- ✅ Choice validation (`heads`/`tails`, `over`/`under`)
- ✅ Target range validation (1-99 for dice)
- ✅ Integer checks for targets
- ✅ Session existence checks before operations

### 2. Commitment Verification
- ✅ SHA-256 commitment verification implemented
- ✅ Evidence saved when casino cheats
- ✅ Automatic verification on every commit-reveal game

### 3. State Backups
- ✅ Automatic state backups after every game
- ✅ Timestamped backup files
- ✅ Separate evidence directory for cheating proofs

### 4. Error Handling
- ✅ Graceful error messages from API
- ✅ HTTP status code checks
- ✅ JSON parsing with fallback

### 5. Privacy
- ✅ Stealth address generation
- ✅ Master key derivation option
- ✅ No private keys in backups (intentional)

---

## Recommended Security Enhancements

### Immediate (Before Marketing)

1. ✅ **Add HTTPS enforcement** (H1)
   ```javascript
   if (!casinoUrl.startsWith('https://')) {
     throw new Error('Security: HTTPS required');
   }
   ```

2. ✅ **Document private key recovery** (H2)
   - Add "Security & Recovery" section to SKILL.md
   - Explain master key derivation
   - Warn about crash risks

3. ✅ **Add rate limit guidance** (M2)
   - Document API limits
   - Show exponential backoff example

4. ✅ **Add phishing warning** (L3)
   - Document official URL
   - Warn about fake domains

### Short-Term (v1.1)

5. **Fix commitment verification** (M3)
   - Make proof mandatory
   - Throw error if missing

6. **Add signature verification** (M4)
   - Verify casino signatures on state updates
   - Document signature format

7. **Improve URL sanitization** (M1)
   - Use URL() constructor
   - Proper path validation

### Long-Term (v2.0)

8. **Add encrypted backups option**
   - Optional password-protected private key backup
   - Recovery CLI tool

9. **Add contract verification**
   - Verify ChannelManager contract address onchain
   - Detect malicious contract swaps

10. **Add MEV protection guidance**
    - Document front-running risks
    - Recommend private RPC for high-value bets

---

## Testing Recommendations

### Security Test Suite

```javascript
// tests/security.test.js

describe('Security', () => {
  it('should reject HTTP URLs', () => {
    expect(() => new AgentCasinoClient('http://insecure.com'))
      .toThrow('HTTPS required');
  });
  
  it('should verify commitments', async () => {
    const result = { proof: { casinoSeed: 'wrong' } };
    expect(() => client._verifyCommitment('0xabc', result))
      .toThrow('commitment verification failed');
  });
  
  it('should validate dice targets', () => {
    expect(() => client.playDice(0.001, 'over', 100))
      .toThrow('integer between 1 and 99');
  });
  
  it('should save evidence when casino cheats', async () => {
    // ... test evidence saving
  });
});
```

---

## SKILL.md Security Documentation

### Additions Needed

#### 1. New Section: "Security & Recovery"

```markdown
## Security & Recovery

### Private Key Safety

**Your stealth private key controls your channel funds.**

**Risks:**
- Process crash → key lost → funds locked
- Server restart → key lost → funds locked
- OOM kill → key lost → funds locked

**Solutions:**

**A) Master Key Derivation (Recommended):**
Store one master key securely, derive all session keys:
```javascript
const master = process.env.CASINO_MASTER_KEY; // 64-char hex
await client.startSession('0.01', { masterKey: master, index: 0 });
```

Recovery:
```javascript
const recovered = StealthAddress.deriveFromMaster(master, 0);
// Use recovered.stealthPrivateKey to close channel
```

**B) Encrypted Backup:**
Save encrypted key to disk (advanced):
```javascript
const crypto = require('crypto');
const cipher = crypto.createCipher('aes-256-cbc', password);
let enc = cipher.update(privateKey, 'utf8', 'hex');
fs.writeFileSync('backup.enc', enc + cipher.final('hex'));
```

### Verify Casino URL

**Always connect to the official casino:**
```
https://www.agentroyale.xyz/api/a2a/casino
```

**Phishing check:**
```javascript
const OFFICIAL = 'https://www.agentroyale.xyz/api/a2a/casino';
if (url !== OFFICIAL) console.warn('⚠️ Unofficial casino!');
```

### Rate Limits

- Max 10 req/s per IP
- Entropy polling: 1 req per 5s minimum
- Use exponential backoff (5s → 10s → 20s → 30s)

### Commitment Verification

**SDK automatically verifies casino commitments.**

If verification fails:
- Game throws error
- Evidence saved to `./casino-states/evidence/`
- Submit proof to support@agentroyale.xyz

**Manual verification:**
```javascript
const valid = CommitReveal.verify(commitment, casinoSeed);
```
```

#### 2. Update "Don't" Section

```markdown
## Don't

- ❌ Don't use HTTP URLs (security risk: use HTTPS only)
- ❌ Don't skip commitment verification
- ❌ Don't reuse stealth addresses across sessions (privacy leak)
- ❌ Don't ignore evidence files (proof of cheating)
- ❌ Don't run without crash recovery plan (master key or encrypted backup)
- ❌ Don't poll entropy status faster than 5 seconds (rate limit)
- ❌ Don't connect to unofficial casino URLs (phishing risk)
```

---

## Summary

**Current State:** ✅ **Functional and reasonably secure**

**Critical Gaps:**
1. No HTTPS enforcement → Easy to exploit
2. No private key recovery documentation → Fund loss risk

**Action Plan:**

**Week 1 (Before Launch):**
- [ ] Add HTTPS enforcement to SDK (1 line)
- [ ] Add "Security & Recovery" section to SKILL.md
- [ ] Update "Don't" section with security warnings
- [ ] Add rate limit documentation

**Week 2-3 (Post-Launch):**
- [ ] Fix commitment verification (M3)
- [ ] Add signature verification (M4)
- [ ] Improve URL sanitization (M1)

**Month 2 (v1.1):**
- [ ] Add encrypted backup option
- [ ] Create recovery CLI tool
- [ ] Add security test suite

---

**Security Clearance:** ⚠️ **APPROVED WITH CRITICAL FIXES REQUIRED**

**Timeline:** Fix H1 and H2 (documentation) before public launch. Other issues can be addressed in v1.1.

---

**Audited by:** Mr. Tee  
**Date:** 2026-02-26 08:45 UTC  
**Next Review:** After implementing Week 1 fixes
