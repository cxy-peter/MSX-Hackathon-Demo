// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MSXUnifiedDemoHub is ERC1155, Ownable {
    uint8 public constant HOME_WELCOME = 1;
    uint8 public constant HOME_WALLET = 2;
    uint8 public constant HOME_RISK = 3;
    uint8 public constant HOME_QUIZ = 4;
    uint8 public constant HOME_PAPER = 5;

    uint8 public constant WEALTH_BUY_RECEIPT = 1;
    uint8 public constant WEALTH_SETTLE_OR_PLEDGE = 2;

    uint256 public constant PAPER_BASE_CHECK = 1;
    uint256 public constant PAPER_LEADERBOARD = 2;
    uint256 public constant PAPER_SPOT_LOOP = 3;
    uint256 public constant PAPER_BUY_ONE_RECEIPT = 4;
    uint256 public constant PAPER_SETTLE_OR_PLEDGE = 5;
    uint256 public constant MAX_SCORE_SUBMISSIONS_PER_DAY = 3;

    uint256 public constant BPS = 10_000;
    uint8 public constant ASSET_DECIMALS = 6;
    uint256 private constant HOME_TOKEN_OFFSET = 100;
    uint256 private constant WEALTH_TOKEN_OFFSET = 200;

    uint256 public nextHomeTokenId = 1;
    uint256 public navBps = BPS;
    uint256 public minSubscription = 500 * 10 ** ASSET_DECIMALS;
    uint256 public lastAttestedAt;
    bool public subscriptionsPaused;
    bytes32 public latestAttestationRoot;
    string public strategyStatus;
    string public vaultLabel;
    string public assetSymbol;

    mapping(address => mapping(uint8 => bool)) public hasMintedBadge;
    mapping(uint256 => uint8) public tokenBadgeType;
    mapping(address => mapping(uint8 => bool)) public wealthTaskCompleted;
    mapping(address => bool) public eligibleInvestor;
    mapping(address => uint8) public riskTier;
    mapping(bytes32 => bool) public approvedUnderlyingHash;
    mapping(address => ReplayScore) public replayScoreOf;
    mapping(address => bool) public hasSubmittedScore;
    address[] private scoredAccounts;

    struct ReplayScore {
        int256 bestNetPnl;
        uint256 bestAccountValue;
        uint256 bestTradeCount;
        uint256 lastSubmittedAt;
        uint256 submissionCount;
        uint256 submissionDay;
        uint256 submissionsToday;
    }

    event TaskBadgeMinted(address indexed recipient, uint8 indexed badgeType, uint256 indexed tokenId);
    event AchievementClaimed(address indexed account, uint256 indexed achievementId);
    event ReplayScoreSubmitted(
        address indexed account,
        int256 netPnl,
        uint256 accountValue,
        uint256 tradeCount,
        uint256 submittedAt
    );
    event WealthTaskCompleted(address indexed account, uint8 indexed taskId);
    event InvestorEligibilityUpdated(address indexed investor, bool allowed, uint8 indexed tier);
    event UnderlyingReviewRecorded(bytes32 indexed assetHash, bool passed, string note);
    event StrategyStatusUpdated(string status, uint256 timestamp);
    event NavUpdated(uint256 navBps, uint256 timestamp);
    event AttestationUpdated(bytes32 attestationRoot, uint256 timestamp);
    event Subscribed(address indexed investor, uint256 assetAmount, uint256 shareAmount);
    event Redeemed(address indexed investor, uint256 shareAmount, uint256 assetAmount);

    constructor(string memory baseUri) ERC1155(baseUri) Ownable() {
        vaultLabel = "MSX Unified Demo Vault";
        assetSymbol = "PT";
        strategyStatus = "Demo ready";
        latestAttestationRoot = keccak256("MSX unified demo hub attestation");
        lastAttestedAt = block.timestamp;
    }

    function hasMinted(address holder) external view returns (bool) {
        return hasMintedBadge[holder][HOME_WELCOME];
    }

    function hasMintedTask(address holder, uint8 badgeType) external view returns (bool) {
        require(_isSupportedHomeBadge(badgeType), "Invalid home badge");
        return hasMintedBadge[holder][badgeType];
    }

    function mintWelcomeBadge(address to) external returns (uint256 tokenId) {
        return mintBadge(HOME_WELCOME, to);
    }

    function mintBadge(uint8 badgeType, address to) public returns (uint256 tokenId) {
        require(_isSupportedHomeBadge(badgeType), "Invalid home badge");
        require(to != address(0), "Invalid recipient");
        require(msg.sender == to, "Only self mint");
        require(!hasMintedBadge[to][badgeType], "Badge already minted");

        tokenId = nextHomeTokenId;
        nextHomeTokenId += 1;

        hasMintedBadge[to][badgeType] = true;
        tokenBadgeType[tokenId] = badgeType;
        _mint(to, _homeTokenTypeId(badgeType), 1, "");

        emit TaskBadgeMinted(to, badgeType, tokenId);
    }

    function claim(uint256 achievementId) external {
        require(_isSupportedPaperAchievement(achievementId), "Invalid achievement");
        require(balanceOf(msg.sender, achievementId) == 0, "Already claimed");

        _mint(msg.sender, achievementId, 1, "");
        emit AchievementClaimed(msg.sender, achievementId);
    }

    function claimBatch(uint256[] calldata achievementIds) external {
        uint256[] memory amounts = new uint256[](achievementIds.length);

        for (uint256 index = 0; index < achievementIds.length; index++) {
            uint256 achievementId = achievementIds[index];
            require(_isSupportedPaperAchievement(achievementId), "Invalid achievement");
            require(balanceOf(msg.sender, achievementId) == 0, "Already claimed");
            amounts[index] = 1;
        }

        _mintBatch(msg.sender, achievementIds, amounts, "");

        for (uint256 index = 0; index < achievementIds.length; index++) {
            emit AchievementClaimed(msg.sender, achievementIds[index]);
        }
    }

    function submitScore(int256 netPnl, uint256 accountValue, uint256 tradeCount) external {
        ReplayScore storage score = replayScoreOf[msg.sender];
        uint256 currentDay = block.timestamp / 1 days;

        if (!hasSubmittedScore[msg.sender]) {
            hasSubmittedScore[msg.sender] = true;
            scoredAccounts.push(msg.sender);
        }

        if (score.submissionDay != currentDay) {
            score.submissionDay = currentDay;
            score.submissionsToday = 0;
        }

        require(score.submissionsToday < MAX_SCORE_SUBMISSIONS_PER_DAY, "Daily score limit reached");

        if (netPnl > score.bestNetPnl) {
            score.bestNetPnl = netPnl;
            score.bestAccountValue = accountValue;
            score.bestTradeCount = tradeCount;
        }

        score.lastSubmittedAt = block.timestamp;
        score.submissionCount += 1;
        score.submissionsToday += 1;

        emit ReplayScoreSubmitted(msg.sender, netPnl, accountValue, tradeCount, block.timestamp);
    }

    function scoreAccountCount() external view returns (uint256) {
        return scoredAccounts.length;
    }

    function scoreAccountAt(uint256 index) external view returns (address) {
        require(index < scoredAccounts.length, "Index out of bounds");
        return scoredAccounts[index];
    }

    function setBaseUri(string calldata nextUri) external onlyOwner {
        _setURI(nextUri);
    }

    function setInvestorEligibility(address investor, bool allowed, uint8 tier) external onlyOwner {
        eligibleInvestor[investor] = allowed;
        riskTier[investor] = tier;
        emit InvestorEligibilityUpdated(investor, allowed, tier);
    }

    function setSubscriptionsPaused(bool paused) external onlyOwner {
        subscriptionsPaused = paused;
    }

    function setMinSubscription(uint256 nextMinSubscription) external onlyOwner {
        require(nextMinSubscription > 0, "Invalid minimum");
        minSubscription = nextMinSubscription;
    }

    function setNavBps(uint256 nextNavBps) external onlyOwner {
        require(nextNavBps > 0, "Invalid NAV");
        navBps = nextNavBps;
        emit NavUpdated(nextNavBps, block.timestamp);
    }

    function setStrategyStatus(string calldata nextStatus) external onlyOwner {
        strategyStatus = nextStatus;
        emit StrategyStatusUpdated(nextStatus, block.timestamp);
    }

    function updateAttestation(bytes32 nextAttestationRoot) external onlyOwner {
        latestAttestationRoot = nextAttestationRoot;
        lastAttestedAt = block.timestamp;
        emit AttestationUpdated(nextAttestationRoot, block.timestamp);
    }

    function recordUnderlyingReview(bytes32 assetHash, bool passed, string calldata note) external onlyOwner {
        approvedUnderlyingHash[assetHash] = passed;
        emit UnderlyingReviewRecorded(assetHash, passed, note);
    }

    function canAccessAdvancedShelf(address investor) external view returns (bool) {
        return eligibleInvestor[investor] && riskTier[investor] >= 2;
    }

    function previewShares(uint256 assetAmount) public view returns (uint256) {
        return assetAmount * BPS / navBps;
    }

    function previewAssets(uint256 shareAmount) public view returns (uint256) {
        return shareAmount * navBps / BPS;
    }

    function subscribe(uint256 assetAmount) external returns (uint256 shareAmount) {
        require(!subscriptionsPaused, "Subscriptions paused");
        require(assetAmount >= minSubscription, "Below minimum");

        shareAmount = previewShares(assetAmount);
        require(shareAmount > 0, "Zero shares");

        _mint(msg.sender, _wealthTokenTypeId(WEALTH_BUY_RECEIPT), shareAmount, "");
        wealthTaskCompleted[msg.sender][WEALTH_BUY_RECEIPT] = true;

        emit Subscribed(msg.sender, assetAmount, shareAmount);
        emit WealthTaskCompleted(msg.sender, WEALTH_BUY_RECEIPT);
    }

    function redeem(uint256 shareAmount) external returns (uint256 assetAmount) {
        require(shareAmount > 0, "Zero shares");

        assetAmount = previewAssets(shareAmount);
        _burn(msg.sender, _wealthTokenTypeId(WEALTH_BUY_RECEIPT), shareAmount);

        emit Redeemed(msg.sender, shareAmount, assetAmount);
    }

    function markWealthTask(uint8 taskId) external {
        require(_isSupportedWealthTask(taskId), "Invalid wealth task");
        wealthTaskCompleted[msg.sender][taskId] = true;
        _mint(msg.sender, _wealthTokenTypeId(taskId), 1, "");
        emit WealthTaskCompleted(msg.sender, taskId);
    }

    function hasWealthTask(address holder, uint8 taskId) external view returns (bool) {
        require(_isSupportedWealthTask(taskId), "Invalid wealth task");
        return wealthTaskCompleted[holder][taskId];
    }

    function _isSupportedHomeBadge(uint8 badgeType) internal pure returns (bool) {
        return badgeType >= HOME_WELCOME && badgeType <= HOME_PAPER;
    }

    function _isSupportedWealthTask(uint8 taskId) internal pure returns (bool) {
        return taskId == WEALTH_BUY_RECEIPT || taskId == WEALTH_SETTLE_OR_PLEDGE;
    }

    function _isSupportedPaperAchievement(uint256 achievementId) internal pure returns (bool) {
        return achievementId >= PAPER_BASE_CHECK && achievementId <= PAPER_SETTLE_OR_PLEDGE;
    }

    function _homeTokenTypeId(uint8 badgeType) internal pure returns (uint256) {
        return HOME_TOKEN_OFFSET + uint256(badgeType);
    }

    function _wealthTokenTypeId(uint8 taskId) internal pure returns (uint256) {
        return WEALTH_TOKEN_OFFSET + uint256(taskId);
    }
}
