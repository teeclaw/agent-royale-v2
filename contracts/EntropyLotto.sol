// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CasinoOwnable.sol";

/**
 * @title EntropyLotto
 * @notice Scheduled lottery draws (every 6h) with Pyth Entropy randomness
 * @dev Pick 1-100, match = 85x payout. Bookmaker model (casino is the house)
 * @custom:security-contact security@agentroyale.xyz
 */

interface IEntropy {
    function getFee(address provider) external view returns (uint256);
    function getDefaultProvider() external view returns (address);
    function getFeeV2() external view returns (uint256);
    function getFeeV2(uint32 gasLimit) external view returns (uint256);
    function getFeeV2(address provider, uint32 gasLimit) external view returns (uint256);
    function requestV2() external payable returns (uint64);
    function requestV2(uint32 gasLimit) external payable returns (uint64);
    function requestV2(address provider) external payable returns (uint64);
    function requestV2(address provider, uint32 gasLimit) external payable returns (uint64);
    function requestV2(address provider, bytes32 userRandomNumber, uint32 gasLimit) external payable returns (uint64);
    function requestWithCallback(address provider, bytes32 userRandomNumber) external payable returns (uint64);
}

abstract contract EntropyConsumer {
    error EntropyConsumer__OnlyEntropy();
    error EntropyConsumer__ZeroEntropyAddress();

    address public entropy;

    constructor(address _entropy) {
        if (_entropy == address(0)) revert EntropyConsumer__ZeroEntropyAddress();
        entropy = _entropy;
    }

    function _entropyCallback(uint64 sequenceNumber, address provider, bytes32 entropyRandomNumber) external {
        if (msg.sender != getEntropy()) revert EntropyConsumer__OnlyEntropy();
        entropyCallback(sequenceNumber, provider, entropyRandomNumber);
    }

    function getEntropy() internal view virtual returns (address);

    function entropyCallback(uint64 sequenceNumber, address provider, bytes32 entropyRandomNumber) internal virtual;
}

contract EntropyLotto is CasinoOwnable, EntropyConsumer, ReentrancyGuard {
    // ══════════════════════════════════════════════════════════════════════════════
    // TYPES
    // ══════════════════════════════════════════════════════════════════════════════

    enum DrawState {
        None,
        Active,
        Requested,
        Fulfilled,
        Settled,
        Expired,
        Failed
    }

    struct Ticket {
        address agent;
        uint8 pickedNumber;
    }

    struct Draw {
        uint256 drawId;
        uint256 drawTime;
        uint64 sequenceNumber;
        bytes32 userRandom;
        bytes32 entropyRandom;
        uint256 requestedAt;
        uint256 fulfilledAt;
        uint8 winningNumber;
        uint256 totalPool;
        DrawState state;
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // STORAGE
    // ══════════════════════════════════════════════════════════════════════════════

    mapping(uint256 => Draw) public draws;
    mapping(uint256 => Ticket[]) public drawTickets;
    mapping(uint64 => uint256) public sequenceToDraw;

    uint256 public currentDrawId;
    uint256 public drawInterval = 6 hours;
    uint256 public ticketPrice = 0.001 ether;
    uint8 public constant RANGE = 100;
    uint8 public constant PAYOUT_MULTIPLIER = 85;
    uint8 public maxTicketsPerAgent = 10;

    address public entropyProvider;
    uint32 public callbackGasLimit = 200_000;
    uint256 public roundTtl = 10 minutes;
    bool public paused;

    // ══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════════════

    event EntropyProviderUpdated(address indexed provider);
    event EntropyAddressUpdated(address indexed entropyAddress);
    event CallbackGasLimitUpdated(uint32 gasLimit);
    event DrawIntervalUpdated(uint256 interval);
    event TicketPriceUpdated(uint256 price);
    event MaxTicketsPerAgentUpdated(uint8 max);
    event RoundTtlUpdated(uint256 ttl);
    event PausedSet(bool paused);

    event DrawCreated(uint256 indexed drawId, uint256 drawTime);
    event TicketPurchased(uint256 indexed drawId, address indexed agent, uint8 pickedNumber, uint256 ticketNumber);
    event EntropyRequested(uint256 indexed drawId, uint64 indexed sequenceNumber, bytes32 userRandom, uint256 fee);
    event EntropyFulfilled(uint256 indexed drawId, uint64 indexed sequenceNumber, bytes32 entropyRandom);
    event DrawCompleted(uint256 indexed drawId, uint8 winningNumber, uint256 winnersCount, uint256 totalPayout);
    event DrawStateChanged(uint256 indexed drawId, DrawState state);

    // ══════════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════════════

    error EntropyLotto__InvalidDraw();
    error EntropyLotto__DrawNotActive();
    error EntropyLotto__DrawAlreadyExists();
    error EntropyLotto__InvalidPickedNumber();
    error EntropyLotto__TooManyTickets();
    error EntropyLotto__DrawNotReady();
    error EntropyLotto__DrawNotExpired();
    error EntropyLotto__Paused();
    error EntropyLotto__ZeroProvider();
    error EntropyLotto__ZeroEntropy();
    error EntropyLotto__InvalidTtl();
    error EntropyLotto__InvalidGasLimit();
    error EntropyLotto__InvalidInterval();
    error EntropyLotto__InvalidPrice();
    error EntropyLotto__FeeTooLow(uint256 sent, uint256 requiredFee);

    // ══════════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ══════════════════════════════════════════════════════════════════════════════

    modifier notPaused() {
        if (paused) revert EntropyLotto__Paused();
        _;
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════════════

    constructor(address _casino, address _entropy, address _entropyProvider)
        CasinoOwnable(_casino)
        EntropyConsumer(_entropy)
    {
        if (_entropyProvider == address(0)) revert EntropyLotto__ZeroProvider();
        entropyProvider = _entropyProvider;
        
        // Create first draw
        _createDraw();
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════════

    function setPaused(bool _paused) external onlyCasino {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setEntropyProvider(address _provider) external onlyCasino {
        if (_provider == address(0)) revert EntropyLotto__ZeroProvider();
        entropyProvider = _provider;
        emit EntropyProviderUpdated(_provider);
    }

    function setEntropy(address _entropy) external onlyCasino {
        if (_entropy == address(0)) revert EntropyLotto__ZeroEntropy();
        entropy = _entropy;
        emit EntropyAddressUpdated(_entropy);
    }

    function setCallbackGasLimit(uint32 _gasLimit) external onlyCasino {
        if (_gasLimit < 100_000 || _gasLimit > 5_000_000) revert EntropyLotto__InvalidGasLimit();
        callbackGasLimit = _gasLimit;
        emit CallbackGasLimitUpdated(_gasLimit);
    }

    function setDrawInterval(uint256 _interval) external onlyCasino {
        if (!(_interval >= 1 hours && _interval <= 24 hours)) revert EntropyLotto__InvalidInterval();
        drawInterval = _interval;
        emit DrawIntervalUpdated(_interval);
    }

    function setTicketPrice(uint256 _price) external onlyCasino {
        if (_price == 0) revert EntropyLotto__InvalidPrice();
        ticketPrice = _price;
        emit TicketPriceUpdated(_price);
    }

    function setMaxTicketsPerAgent(uint8 _max) external onlyCasino {
        maxTicketsPerAgent = _max;
        emit MaxTicketsPerAgentUpdated(_max);
    }

    function setRoundTtl(uint256 _ttl) external onlyCasino {
        if (!(_ttl >= 1 minutes && _ttl <= 24 hours)) revert EntropyLotto__InvalidTtl();
        roundTtl = _ttl;
        emit RoundTtlUpdated(_ttl);
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════════

    function quoteFee() public view returns (uint256) {
        IEntropy e = IEntropy(entropy);

        address provider = entropyProvider;
        if (provider == address(0)) {
            try e.getDefaultProvider() returns (address p) {
                provider = p;
            } catch {}
        }

        if (callbackGasLimit > 0) {
            try e.getFeeV2(provider, callbackGasLimit) returns (uint256 feeProviderGas) {
                return feeProviderGas;
            } catch {}
            try e.getFeeV2(callbackGasLimit) returns (uint256 feeV2Gas) {
                return feeV2Gas;
            } catch {}
        }

        try e.getFeeV2() returns (uint256 feeV2) {
            return feeV2;
        } catch {}

        return e.getFee(provider);
    }

    function buyTicket(uint256 drawId, address agent, uint8 pickedNumber)
        external
        onlyCasino
        notPaused
        nonReentrant
        returns (uint256 ticketNumber)
    {
        Draw storage draw = draws[drawId];
        if (draw.state != DrawState.Active) revert EntropyLotto__DrawNotActive();
        if (pickedNumber < 1 || pickedNumber > RANGE) revert EntropyLotto__InvalidPickedNumber();

        Ticket[] storage tickets = drawTickets[drawId];

        // Check agent ticket limit
        uint256 agentTicketCount = 0;
        for (uint256 i = 0; i < tickets.length; i++) {
            if (tickets[i].agent == agent) {
                agentTicketCount++;
            }
        }
        if (agentTicketCount >= maxTicketsPerAgent) revert EntropyLotto__TooManyTickets();

        tickets.push(Ticket({agent: agent, pickedNumber: pickedNumber}));
        ticketNumber = tickets.length - 1;

        draw.totalPool += ticketPrice;

        emit TicketPurchased(drawId, agent, pickedNumber, ticketNumber);
    }

    function requestDraw(uint256 drawId, bytes32 userRandom)
        external
        payable
        onlyCasino
        notPaused
        nonReentrant
        returns (uint64 sequenceNumber)
    {
        Draw storage draw = draws[drawId];
        if (draw.state != DrawState.Active) revert EntropyLotto__DrawNotActive();
        if (block.timestamp < draw.drawTime) revert EntropyLotto__DrawNotReady();

        uint256 fee = quoteFee();
        if (msg.value < fee) revert EntropyLotto__FeeTooLow(msg.value, fee);

        IEntropy e = IEntropy(entropy);

        address provider = entropyProvider;
        if (provider == address(0)) {
            try e.getDefaultProvider() returns (address p) {
                provider = p;
            } catch {}
        }

        // Primary path
        if (callbackGasLimit > 0) {
            try e.requestV2{value: fee}(provider, userRandom, callbackGasLimit) returns (uint64 seqProviderUserGas) {
                sequenceNumber = seqProviderUserGas;
            } catch {}
        }

        // Fallback: provider + gas limit
        if (sequenceNumber == 0 && callbackGasLimit > 0) {
            try e.requestV2{value: fee}(provider, callbackGasLimit) returns (uint64 seqProviderGas) {
                sequenceNumber = seqProviderGas;
            } catch {}
        }

        // Fallback: provider only
        if (sequenceNumber == 0) {
            try e.requestV2{value: fee}(provider) returns (uint64 seqProvider) {
                sequenceNumber = seqProvider;
            } catch {}
        }

        // Legacy fallback
        if (sequenceNumber == 0) {
            try e.requestWithCallback{value: fee}(provider, userRandom) returns (uint64 seqLegacy) {
                sequenceNumber = seqLegacy;
            } catch {}
        }

        if (sequenceNumber == 0) revert EntropyLotto__DrawNotReady();

        draw.sequenceNumber = sequenceNumber;
        draw.userRandom = userRandom;
        draw.requestedAt = block.timestamp;
        draw.state = DrawState.Requested;

        sequenceToDraw[sequenceNumber] = drawId;

        emit EntropyRequested(drawId, sequenceNumber, userRandom, fee);
    }

    function settleDraw(uint256 drawId) external onlyCasino returns (uint256 winnersCount, uint256 totalPayout) {
        Draw storage draw = draws[drawId];
        if (draw.state != DrawState.Fulfilled) revert EntropyLotto__DrawNotReady();

        Ticket[] storage tickets = drawTickets[drawId];
        uint8 winningNumber = draw.winningNumber;

        for (uint256 i = 0; i < tickets.length; i++) {
            if (tickets[i].pickedNumber == winningNumber) {
                winnersCount++;
                totalPayout += ticketPrice * PAYOUT_MULTIPLIER;
            }
        }

        draw.state = DrawState.Settled;
        emit DrawStateChanged(drawId, DrawState.Settled);
        emit DrawCompleted(drawId, winningNumber, winnersCount, totalPayout);

        // Create next draw
        _createDraw();
    }

    function markExpired(uint256 drawId) external onlyCasino {
        Draw storage draw = draws[drawId];
        if (draw.state != DrawState.Requested) revert EntropyLotto__DrawNotReady();
        if (block.timestamp <= draw.requestedAt + roundTtl) revert EntropyLotto__DrawNotExpired();
        draw.state = DrawState.Expired;
        emit DrawStateChanged(drawId, DrawState.Expired);
    }

    function getDraw(uint256 drawId)
        external
        view
        returns (
            uint256 drawTime,
            uint64 sequenceNumber,
            bytes32 userRandom,
            bytes32 entropyRandom,
            uint256 requestedAt,
            uint256 fulfilledAt,
            uint8 winningNumber,
            uint256 totalPool,
            uint256 ticketCount,
            DrawState state
        )
    {
        Draw storage draw = draws[drawId];
        Ticket[] storage tickets = drawTickets[drawId];
        return (
            draw.drawTime,
            draw.sequenceNumber,
            draw.userRandom,
            draw.entropyRandom,
            draw.requestedAt,
            draw.fulfilledAt,
            draw.winningNumber,
            draw.totalPool,
            tickets.length,
            draw.state
        );
    }

    function getTickets(uint256 drawId) external view returns (Ticket[] memory) {
        return drawTickets[drawId];
    }

    function getAgentTickets(uint256 drawId, address agent) external view returns (uint8[] memory) {
        Ticket[] storage tickets = drawTickets[drawId];
        uint256 count = 0;
        
        for (uint256 i = 0; i < tickets.length; i++) {
            if (tickets[i].agent == agent) count++;
        }

        uint8[] memory agentNumbers = new uint8[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < tickets.length; i++) {
            if (tickets[i].agent == agent) {
                agentNumbers[index] = tickets[i].pickedNumber;
                index++;
            }
        }

        return agentNumbers;
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════════

    function _createDraw() internal {
        currentDrawId++;
        Draw storage draw = draws[currentDrawId];
        draw.drawId = currentDrawId;
        draw.drawTime = block.timestamp + drawInterval;
        draw.state = DrawState.Active;
        emit DrawCreated(currentDrawId, draw.drawTime);
    }

    function getEntropy() internal view override returns (address) {
        return entropy;
    }

    function entropyCallback(uint64 sequenceNumber, address /*provider*/, bytes32 entropyRandomNumber) internal override {
        uint256 drawId = sequenceToDraw[sequenceNumber];
        if (drawId == 0) return;

        Draw storage draw = draws[drawId];
        if (draw.state != DrawState.Requested) return;

        draw.entropyRandom = entropyRandomNumber;
        draw.fulfilledAt = block.timestamp;

        // Derive winning number (1-100)
        uint256 randomValue = uint256(entropyRandomNumber);
        draw.winningNumber = uint8((randomValue % RANGE) + 1);

        draw.state = DrawState.Fulfilled;

        emit EntropyFulfilled(drawId, sequenceNumber, entropyRandomNumber);
    }
}
