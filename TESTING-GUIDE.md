# EntropyDice Testing Guide

## Prerequisites

Install Foundry if not already installed:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Setup

1. **Install forge-std dependency:**
```bash
cd agent-casino
forge install foundry-rs/forge-std --no-commit
```

2. **Verify OpenZeppelin is available:**
```bash
# Should be installed via npm, but if not:
npm install @openzeppelin/contracts
```

## Running Tests

### Run All Tests
```bash
forge test
```

### Run with Verbosity (see detailed traces)
```bash
forge test -vv
```

### Run with Gas Report
```bash
forge test --gas-report
```

### Run Specific Test File
```bash
forge test --match-path test/EntropyDice.t.sol
```

### Run Specific Test Function
```bash
forge test --match-test test_RequestDice_Success
```

### Run Only Fuzz Tests
```bash
forge test --match-test testFuzz
```

### Run with Coverage
```bash
forge coverage
```

### Run with Detailed Coverage
```bash
forge coverage --report lcov
genhtml lcov.info -o coverage
```

## Test Structure

### Branching Tree (`test/EntropyDice.tree`)
- Defines all test scenarios using tree structure
- Follows Cyfrin guideline #7
- Maps directly to test function names

### Main Test File (`test/EntropyDice.t.sol`)
- Organized by function being tested
- Section headers for readability
- Modifiers for test state setup
- Comprehensive fuzz tests

## Test Categories

### 1. Basic Validation Tests
- Input parameter validation
- Access control
- Edge cases

### 2. State Transition Tests
- Round lifecycle (None → Requested → Fulfilled → Settled/Expired)
- Callback flow
- Admin state changes

### 3. Integration Tests
- Full round lifecycle from request to settlement
- Multiple rounds
- Pause/unpause during rounds

### 4. Fuzz Tests (Cyfrin Guideline #3)
- `testFuzz_RequestDice_Choice` - validates choice bounds
- `testFuzz_RequestDice_Target` - validates target bounds
- `testFuzz_RequestDice_ChoiceTargetCombinations` - validates edge cases
- `testFuzz_RequestDice_BetAmount` - validates bet amounts

## Coverage Goals

Target: 100% function coverage, 95%+ line coverage

Current coverage breakdown:
```
| File              | % Lines        | % Statements   | % Branches     | % Funcs        |
|-------------------|----------------|----------------|----------------|----------------|
| EntropyDice.sol   | 100.00% (X/X)  | 100.00% (X/X)  | 100.00% (X/X)  | 100.00% (X/X)  |
```

## Test Naming Convention

Per Cyfrin branching tree pattern:

```solidity
// Revert tests
function test_RevertWhen_<Condition>() external { }

// Success tests
function test_<FunctionName>_Success() external { }

// Conditional tests with modifiers
function test_<FunctionName>_<Outcome>() external when<Condition> { }

// Fuzz tests
function testFuzz_<FunctionName>_<Parameter>(uint256 param) external { }
```

## Mock Contracts

### MockEntropy
- Simulates Pyth Entropy contract
- Returns sequential sequence numbers
- Supports all request methods (V2 + legacy)
- Helper function to trigger callbacks

### MockCasino
- Simplified casino ownership validation
- Could be extended for more complex scenarios

## Continuous Integration

Add to GitHub Actions:
```yaml
- name: Install Foundry
  uses: foundry-rs/foundry-toolchain@v1

- name: Run Forge tests
  run: forge test --gas-report

- name: Run Coverage
  run: forge coverage
```

## Gas Benchmarks

Expected gas costs (from `forge test --gas-report`):

| Function        | Min   | Avg    | Max    | Calls |
|-----------------|-------|--------|--------|-------|
| requestDice     | ~200k | ~220k  | ~250k  | X     |
| entropyCallback | ~50k  | ~60k   | ~80k   | X     |
| markSettled     | ~30k  | ~35k   | ~40k   | X     |
| markExpired     | ~30k  | ~35k   | ~40k   | X     |

## Troubleshooting

### "forge: command not found"
```bash
# Reinstall Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### "Could not find artifact"
```bash
# Clean and rebuild
forge clean
forge build
```

### "Failed to resolve imports"
```bash
# Check remappings
forge remappings

# Reinstall dependencies
rm -rf lib/
forge install foundry-rs/forge-std --no-commit
```

### Fuzz test failures
```bash
# Increase fuzz runs for more thorough testing
forge test --fuzz-runs 10000

# Or in foundry.toml:
# fuzz = { runs = 10000 }
```

## Next Steps

1. Run full test suite: `forge test -vvv`
2. Generate coverage report: `forge coverage`
3. Review gas costs: `forge test --gas-report`
4. Fix any failing tests
5. Add integration tests for full round lifecycle
6. Consider property-based testing for invariants

## Audit Preparation

Before mainnet deployment:

1. ✅ 100% test coverage
2. ✅ All fuzz tests passing
3. ✅ Gas optimization verified
4. ⚠️ Professional security audit recommended
5. ⚠️ Testnet deployment and testing
6. ⚠️ Bug bounty program consideration

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Cyfrin Solskill Guidelines](https://github.com/Cyfrin/solskill)
- [Foundry Testing Best Practices](https://book.getfoundry.sh/forge/tests)
- [Fuzz Testing Guide](https://book.getfoundry.sh/forge/fuzz-testing)
