// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MSXReplayAchievementBadge is ERC1155, Ownable {
    uint256 public constant BASE_CHECK = 1;
    uint256 public constant LEADERBOARD = 2;
    uint256 public constant SPOT_LOOP = 3;
    uint256 public constant PERP_LEVERAGE = 4;
    uint256 public constant PROTECTIVE_HEDGE = 5;
    uint256 public constant MAX_SCORE_SUBMISSIONS_PER_DAY = 3;

    mapping(address => mapping(uint256 => bool)) public claimApproved;
    mapping(uint256 => string) public achievementLabel;
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

    event ClaimApprovalUpdated(address indexed account, uint256 indexed achievementId, bool approved);
    event AchievementClaimed(address indexed account, uint256 indexed achievementId);
    event AchievementLabelUpdated(uint256 indexed achievementId, string label);
    event ReplayScoreSubmitted(
        address indexed account,
        int256 netPnl,
        uint256 accountValue,
        uint256 tradeCount,
        uint256 submittedAt
    );

    constructor(string memory baseUri) ERC1155(baseUri) Ownable() {
        achievementLabel[BASE_CHECK] = "Base Check";
        achievementLabel[LEADERBOARD] = "Leaderboard";
        achievementLabel[SPOT_LOOP] = "Spot Loop";
        achievementLabel[PERP_LEVERAGE] = "Perp Leverage";
        achievementLabel[PROTECTIVE_HEDGE] = "Protective Hedge";
    }

    function setBaseUri(string calldata nextUri) external onlyOwner {
        _setURI(nextUri);
    }

    function setAchievementLabel(uint256 achievementId, string calldata label) external onlyOwner {
        achievementLabel[achievementId] = label;
        emit AchievementLabelUpdated(achievementId, label);
    }

    function approveClaim(address account, uint256 achievementId, bool approved) external onlyOwner {
        claimApproved[account][achievementId] = approved;
        emit ClaimApprovalUpdated(account, achievementId, approved);
    }

    function approveBatchClaims(address account, uint256[] calldata achievementIds, bool approved) external onlyOwner {
        for (uint256 index = 0; index < achievementIds.length; index++) {
            uint256 achievementId = achievementIds[index];
            claimApproved[account][achievementId] = approved;
            emit ClaimApprovalUpdated(account, achievementId, approved);
        }
    }

    function claim(uint256 achievementId) external {
        require(_isSupportedAchievement(achievementId), "Invalid achievement");
        require(balanceOf(msg.sender, achievementId) == 0, "Already claimed");
        _mint(msg.sender, achievementId, 1, "");

        emit AchievementClaimed(msg.sender, achievementId);
    }

    function claimBatch(uint256[] calldata achievementIds) external {
        for (uint256 index = 0; index < achievementIds.length; index++) {
            uint256 achievementId = achievementIds[index];
            require(_isSupportedAchievement(achievementId), "Invalid achievement");
            require(balanceOf(msg.sender, achievementId) == 0, "Already claimed");
        }

        uint256[] memory amounts = new uint256[](achievementIds.length);
        for (uint256 index = 0; index < achievementIds.length; index++) {
            amounts[index] = 1;
        }

        _mintBatch(msg.sender, achievementIds, amounts, "");
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

    function _isSupportedAchievement(uint256 achievementId) internal pure returns (bool) {
        return achievementId == BASE_CHECK
            || achievementId == LEADERBOARD
            || achievementId == SPOT_LOOP
            || achievementId == PERP_LEVERAGE
            || achievementId == PROTECTIVE_HEDGE;
    }
}
