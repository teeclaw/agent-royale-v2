// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../contracts/EntropyDice.sol";

/**
 * @title EntropyDiceTest
 * @notice Comprehensive test suite for EntropyDice contract following Cyfrin standards
 * @dev Uses branching tree technique and fuzz testing
 */

// Mock Entropy contract
contract MockEntropy {
    uint256 public fee = 0.001 ether;
    address public defaultProvider = address(0x1);
    uint64 private nextSequence = 1;
    
    mapping(uint64 => bool) public requestedSequences;
    
    function getFee(address) external view returns (uint256) {
        return fee;
    }
    
    function getDefaultProvider() external view returns (address) {
        return defaultProvider;
    }
    
    function getFeeV2() external view returns (uint256) {
        return fee;
    }
    
    function getFeeV2(uint32) external view returns (uint256) {
        return fee;
    }
    
    function getFeeV2(address, uint32) external view returns (uint256) {
        return fee;
    }
    
    function requestV2() external payable returns (uint64) {
        require(msg.value >= fee, "Insufficient fee");
        uint64 seq = nextSequence++;
        requestedSequences[seq] = true;
        return seq;
    }
    
    function requestV2(uint32) external payable returns (uint64) {
        require(msg.value >= fee, "Insufficient fee");
        uint64 seq = nextSequence++;
        requestedSequences[seq] = true;
        return seq;
    }
    
    function requestV2(address) external payable returns (uint64) {
        require(msg.value >= fee, "Insufficient fee");
        uint64 seq = nextSequence++;
        requestedSequences[seq] = true;
        return seq;
    }
    
    function requestV2(address, uint32) external payable returns (uint64) {
        require(msg.value >= fee, "Insufficient fee");
        uint64 seq = nextSequence++;
        requestedSequences[seq] = true;
        return seq;
    }
    
    function requestV2(address, bytes32, uint32) external payable returns (uint64) {
        require(msg.value >= fee, "Insufficient fee");
        uint64 seq = nextSequence++;
        requestedSequences[seq] = true;
        return seq;
    }
    
    function requestWithCallback(address, bytes32) external payable returns (uint64) {
        require(msg.value >= fee, "Insufficient fee");
        uint64 seq = nextSequence++;
        requestedSequences[seq] = true;
        return seq;
    }
    
    // Helper to trigger callback
    function fulfillEntropy(address dice, uint64 sequenceNumber, bytes32 randomValue) external {
        EntropyDice(dice)._entropyCallback(sequenceNumber, defaultProvider, randomValue);
    }
}

// Mock Casino Ownable (simplified)
contract MockCasino {
    function isCasino(address) external pure returns (bool) {
        return true;
    }
}

contract EntropyDiceTest is Test {
    EntropyDice public dice;
    MockEntropy public entropy;
    address public casino;
    address public agent;
    address public attacker;
    
    bytes32 public constant DEFAULT_ROUND_ID = keccak256("round1");
    bytes32 public constant DEFAULT_USER_RANDOM = keccak256("random");
    
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
        EntropyDice.RoundState state
    );
    
    function setUp() public {
        casino = makeAddr("casino");
        agent = makeAddr("agent");
        attacker = makeAddr("attacker");
        
        entropy = new MockEntropy();
        
        vm.prank(casino);
        dice = new EntropyDice(casino, address(entropy), address(0x1));
        
        vm.deal(casino, 100 ether);
        vm.deal(agent, 100 ether);
        vm.deal(attacker, 100 ether);
    }
    
    /*//////////////////////////////////////////////////////////////
                        REQUEST DICE - BASIC VALIDATION
    //////////////////////////////////////////////////////////////*/
    
    function test_RevertWhen_RoundIdIsZero() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidRound.selector);
        dice.requestDice{value: 0.001 ether}(
            bytes32(0),
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
    }
    
    function test_RevertWhen_AgentIsZeroAddress() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidRound.selector);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            address(0),
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
    }
    
    function test_RevertWhen_CallerIsNotCasino() external {
        vm.prank(attacker);
        vm.expectRevert(); // CasinoOwnable revert
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
    }
    
    function test_RevertWhen_ContractIsPaused() external {
        vm.startPrank(casino);
        dice.setPaused(true);
        
        vm.expectRevert(EntropyDice.EntropyDice__Paused.selector);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        vm.stopPrank();
    }
    
    function test_RevertWhen_ChoiceGreaterThanOne() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidChoice.selector);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            2,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
    }
    
    function test_RevertWhen_TargetLessThanOne() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidTarget.selector);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            0,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
    }
    
    function test_RevertWhen_TargetGreaterThan99() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidTarget.selector);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            100,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
    }
    
    function test_RevertWhen_ChoiceOverAndTarget99() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidTarget.selector);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0, // over
            99,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
    }
    
    function test_RevertWhen_ChoiceUnderAndTarget1() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidTarget.selector);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            1, // under
            1,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
    }
    
    function test_RevertWhen_RoundAlreadyExists() external {
        vm.startPrank(casino);
        
        // First request succeeds
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        
        // Second request with same roundId reverts
        vm.expectRevert(EntropyDice.EntropyDice__AlreadyExists.selector);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        
        vm.stopPrank();
    }
    
    function test_RevertWhen_MsgValueLessThanFee() external {
        vm.prank(casino);
        vm.expectRevert(
            abi.encodeWithSelector(
                EntropyDice.EntropyDice__FeeTooLow.selector,
                0.0005 ether,
                0.001 ether
            )
        );
        dice.requestDice{value: 0.0005 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
    }
    
    /*//////////////////////////////////////////////////////////////
                        REQUEST DICE - HAPPY PATH
    //////////////////////////////////////////////////////////////*/
    
    modifier whenAllParametersValid() {
        _;
    }
    
    function test_RequestDice_Success() external whenAllParametersValid {
        vm.prank(casino);
        
        vm.expectEmit(true, true, true, true);
        emit EntropyRequested(
            DEFAULT_ROUND_ID,
            1, // first sequence
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM,
            0.001 ether
        );
        
        uint64 seq = dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        
        assertEq(seq, 1);
        
        // Verify round data
        (
            address roundAgent,
            uint8 choice,
            uint8 target,
            uint256 betAmount,
            uint64 sequenceNumber,
            bytes32 userRandom,
            bytes32 entropyRandom,
            uint256 requestedAt,
            uint256 fulfilledAt,
            EntropyDice.RoundState state
        ) = dice.getRound(DEFAULT_ROUND_ID);
        
        assertEq(roundAgent, agent);
        assertEq(choice, 0);
        assertEq(target, 50);
        assertEq(betAmount, 0.001 ether);
        assertEq(sequenceNumber, 1);
        assertEq(userRandom, DEFAULT_USER_RANDOM);
        assertEq(entropyRandom, bytes32(0));
        assertEq(requestedAt, block.timestamp);
        assertEq(fulfilledAt, 0);
        assertTrue(state == EntropyDice.RoundState.Requested);
    }
    
    /*//////////////////////////////////////////////////////////////
                        ENTROPY CALLBACK
    //////////////////////////////////////////////////////////////*/
    
    function test_EntropyCallback_RevertWhen_CallerNotEntropy() external {
        vm.prank(attacker);
        vm.expectRevert(EntropyConsumer.EntropyConsumer__OnlyEntropy.selector);
        dice._entropyCallback(1, address(0x1), keccak256("random"));
    }
    
    function test_EntropyCallback_SilentWhen_SequenceNotMapped() external {
        // Should not revert, just return silently
        vm.prank(address(entropy));
        dice._entropyCallback(999, address(0x1), keccak256("random"));
    }
    
    function test_EntropyCallback_SilentWhen_StateNotRequested() external {
        vm.startPrank(casino);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        vm.stopPrank();
        
        // Fulfill once
        vm.prank(address(entropy));
        dice._entropyCallback(1, address(0x1), keccak256("result1"));
        
        // Try to fulfill again (state is now Fulfilled, not Requested)
        vm.prank(address(entropy));
        dice._entropyCallback(1, address(0x1), keccak256("result2"));
        
        // Should not revert or change state
        (, , , , , , bytes32 entropyRandom, , , ) = dice.getRound(DEFAULT_ROUND_ID);
        assertEq(entropyRandom, keccak256("result1")); // First result preserved
    }
    
    function test_EntropyCallback_Success() external {
        vm.startPrank(casino);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        vm.stopPrank();
        
        bytes32 randomValue = keccak256("entropy_result");
        
        vm.prank(address(entropy));
        vm.expectEmit(true, true, false, true);
        emit EntropyFulfilled(DEFAULT_ROUND_ID, 1, randomValue);
        
        dice._entropyCallback(1, address(0x1), randomValue);
        
        (, , , , , , bytes32 entropyRandom, , uint256 fulfilledAt, EntropyDice.RoundState state) =
            dice.getRound(DEFAULT_ROUND_ID);
        
        assertEq(entropyRandom, randomValue);
        assertEq(fulfilledAt, block.timestamp);
        assertTrue(state == EntropyDice.RoundState.Fulfilled);
    }
    
    /*//////////////////////////////////////////////////////////////
                        MARK SETTLED
    //////////////////////////////////////////////////////////////*/
    
    function test_MarkSettled_RevertWhen_CallerNotCasino() external {
        vm.prank(attacker);
        vm.expectRevert(); // CasinoOwnable revert
        dice.markSettled(DEFAULT_ROUND_ID);
    }
    
    function test_MarkSettled_RevertWhen_StateNotFulfilled() external {
        vm.startPrank(casino);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        
        // State is Requested, not Fulfilled
        vm.expectRevert(EntropyDice.EntropyDice__RoundNotReady.selector);
        dice.markSettled(DEFAULT_ROUND_ID);
        vm.stopPrank();
    }
    
    function test_MarkSettled_Success() external {
        vm.startPrank(casino);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        vm.stopPrank();
        
        // Fulfill
        vm.prank(address(entropy));
        dice._entropyCallback(1, address(0x1), keccak256("result"));
        
        // Mark settled
        vm.prank(casino);
        vm.expectEmit(true, false, false, true);
        emit RoundStateChanged(DEFAULT_ROUND_ID, EntropyDice.RoundState.Settled);
        
        dice.markSettled(DEFAULT_ROUND_ID);
        
        (, , , , , , , , , EntropyDice.RoundState state) = dice.getRound(DEFAULT_ROUND_ID);
        assertTrue(state == EntropyDice.RoundState.Settled);
    }
    
    /*//////////////////////////////////////////////////////////////
                        MARK EXPIRED
    //////////////////////////////////////////////////////////////*/
    
    function test_MarkExpired_RevertWhen_CallerNotCasino() external {
        vm.prank(attacker);
        vm.expectRevert(); // CasinoOwnable revert
        dice.markExpired(DEFAULT_ROUND_ID);
    }
    
    function test_MarkExpired_RevertWhen_StateNotRequested() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__RoundNotReady.selector);
        dice.markExpired(DEFAULT_ROUND_ID);
    }
    
    function test_MarkExpired_RevertWhen_NotPastTtl() external {
        vm.startPrank(casino);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        
        // Only 1 minute passed (TTL is 5 minutes)
        vm.warp(block.timestamp + 1 minutes);
        
        vm.expectRevert(EntropyDice.EntropyDice__RoundNotExpired.selector);
        dice.markExpired(DEFAULT_ROUND_ID);
        vm.stopPrank();
    }
    
    function test_MarkExpired_Success() external {
        vm.startPrank(casino);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        
        // Warp past TTL (5 minutes + 1 second)
        vm.warp(block.timestamp + 5 minutes + 1);
        
        vm.expectEmit(true, false, false, true);
        emit RoundStateChanged(DEFAULT_ROUND_ID, EntropyDice.RoundState.Expired);
        
        dice.markExpired(DEFAULT_ROUND_ID);
        
        (, , , , , , , , , EntropyDice.RoundState state) = dice.getRound(DEFAULT_ROUND_ID);
        assertTrue(state == EntropyDice.RoundState.Expired);
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    function test_SetPaused_RevertWhen_CallerNotCasino() external {
        vm.prank(attacker);
        vm.expectRevert(); // CasinoOwnable revert
        dice.setPaused(true);
    }
    
    function test_SetPaused_Success() external {
        vm.prank(casino);
        dice.setPaused(true);
        
        assertEq(dice.paused(), true);
    }
    
    function test_SetEntropyProvider_RevertWhen_CallerNotCasino() external {
        vm.prank(attacker);
        vm.expectRevert(); // CasinoOwnable revert
        dice.setEntropyProvider(address(0x2));
    }
    
    function test_SetEntropyProvider_RevertWhen_ZeroAddress() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__ZeroProvider.selector);
        dice.setEntropyProvider(address(0));
    }
    
    function test_SetEntropyProvider_Success() external {
        address newProvider = address(0x2);
        vm.prank(casino);
        dice.setEntropyProvider(newProvider);
        
        assertEq(dice.entropyProvider(), newProvider);
    }
    
    function test_SetCallbackGasLimit_RevertWhen_TooLow() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidGasLimit.selector);
        dice.setCallbackGasLimit(40_000);
    }
    
    function test_SetCallbackGasLimit_RevertWhen_TooHigh() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidGasLimit.selector);
        dice.setCallbackGasLimit(6_000_000);
    }
    
    function test_SetCallbackGasLimit_Success() external {
        vm.prank(casino);
        dice.setCallbackGasLimit(200_000);
        
        assertEq(dice.callbackGasLimit(), 200_000);
    }
    
    function test_SetRoundTtl_RevertWhen_TooLow() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidTtl.selector);
        dice.setRoundTtl(20 seconds);
    }
    
    function test_SetRoundTtl_RevertWhen_TooHigh() external {
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidTtl.selector);
        dice.setRoundTtl(25 hours);
    }
    
    function test_SetRoundTtl_Success() external {
        vm.prank(casino);
        dice.setRoundTtl(10 minutes);
        
        assertEq(dice.roundTtl(), 10 minutes);
    }
    
    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testFuzz_RequestDice_Choice(uint8 choice) external {
        vm.assume(choice <= 1); // Valid choices: 0 or 1
        
        bytes32 roundId = keccak256(abi.encodePacked("fuzz", choice));
        
        vm.prank(casino);
        uint64 seq = dice.requestDice{value: 0.001 ether}(
            roundId,
            agent,
            choice,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        
        assertGt(seq, 0);
    }
    
    function testFuzz_RequestDice_InvalidChoice(uint8 choice) external {
        vm.assume(choice > 1);
        
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidChoice.selector);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            choice,
            50,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
    }
    
    function testFuzz_RequestDice_Target(uint8 target) external {
        vm.assume(target >= 1 && target <= 99);
        vm.assume(target < 99); // Can't use 99 with "over"
        
        bytes32 roundId = keccak256(abi.encodePacked("fuzz", target));
        
        vm.prank(casino);
        uint64 seq = dice.requestDice{value: 0.001 ether}(
            roundId,
            agent,
            0, // over
            target,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        
        assertGt(seq, 0);
    }
    
    function testFuzz_RequestDice_InvalidTarget(uint8 target) external {
        vm.assume(target == 0 || target > 99);
        
        vm.prank(casino);
        vm.expectRevert(EntropyDice.EntropyDice__InvalidTarget.selector);
        dice.requestDice{value: 0.001 ether}(
            DEFAULT_ROUND_ID,
            agent,
            0,
            target,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
    }
    
    function testFuzz_RequestDice_ChoiceTargetCombinations(uint8 choice, uint8 target) external {
        vm.assume(choice <= 1);
        vm.assume(target >= 1 && target <= 99);
        
        bool shouldRevert;
        
        // Edge case: over 99 (impossible)
        if (choice == 0 && target >= 99) {
            shouldRevert = true;
        }
        // Edge case: under 1 (impossible)
        else if (choice == 1 && target <= 1) {
            shouldRevert = true;
        } else {
            shouldRevert = false;
        }
        
        bytes32 roundId = keccak256(abi.encodePacked("fuzz", choice, target));
        
        vm.prank(casino);
        if (shouldRevert) {
            vm.expectRevert(EntropyDice.EntropyDice__InvalidTarget.selector);
        }
        dice.requestDice{value: 0.001 ether}(
            roundId,
            agent,
            choice,
            target,
            0.001 ether,
            DEFAULT_USER_RANDOM
        );
        
        if (!shouldRevert) {
            (, uint8 storedChoice, uint8 storedTarget, , , , , , , ) = dice.getRound(roundId);
            assertEq(storedChoice, choice);
            assertEq(storedTarget, target);
        }
    }
    
    function testFuzz_RequestDice_BetAmount(uint256 betAmount) external {
        vm.assume(betAmount > 0 && betAmount < 100 ether);
        
        bytes32 roundId = keccak256(abi.encodePacked("fuzz", betAmount));
        
        vm.prank(casino);
        dice.requestDice{value: 0.001 ether}(
            roundId,
            agent,
            0,
            50,
            betAmount,
            DEFAULT_USER_RANDOM
        );
        
        (, , , uint256 storedBet, , , , , , ) = dice.getRound(roundId);
        assertEq(storedBet, betAmount);
    }
    
    /*//////////////////////////////////////////////////////////////
                        QUOTE FEE TESTS
    //////////////////////////////////////////////////////////////*/
    
    function test_QuoteFee_ReturnsCorrectFee() external {
        uint256 fee = dice.quoteFee();
        assertEq(fee, 0.001 ether);
    }
}
