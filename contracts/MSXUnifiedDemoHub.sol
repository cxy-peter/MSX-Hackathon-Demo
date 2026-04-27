// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IMSXCollectibleRenderer {
    function uri(uint256 tokenId) external view returns (string memory);
}

contract MSXUnifiedDemoHub is ERC1155, Ownable {
    using Strings for uint256;

    uint8 public constant HOME_WELCOME = 1;
    uint8 public constant HOME_WALLET = 2;
    uint8 public constant HOME_RISK = 3;
    uint8 public constant HOME_QUIZ = 4;
    uint8 public constant HOME_PAPER = 5;

    uint8 public constant WEALTH_PROFITABLE_TRADE = 1;
    uint8 public constant WEALTH_PLEDGE = 2;
    uint8 public constant WEALTH_DUAL_PROFIT = 3;

    uint256 public constant PAPER_BASE_CHECK = 6;
    uint256 public constant PAPER_LEADERBOARD = 7;
    uint256 public constant PAPER_SPOT_LOOP = 8;
    uint256 public constant PAPER_PERP_LEVERAGE = 9;
    uint256 public constant PAPER_PROTECTIVE_HEDGE = 10;
    uint256 public constant MAX_SCORE_SUBMISSIONS_PER_DAY = 3;

    uint256 public constant BPS = 10_000;
    uint8 public constant ASSET_DECIMALS = 6;
    uint16 public constant DEFAULT_WEALTH_PRODUCT_ID = 1;
    uint256 private constant HOME_TOKEN_OFFSET = 100;
    uint256 private constant WEALTH_TOKEN_OFFSET = 200;
    uint256 private constant WEALTH_RECEIPT_TOKEN_OFFSET = 1000;
    uint256 private constant PAPER_LEADERBOARD_CREDENTIAL_TOKEN_OFFSET = 100_000;
    uint256 private constant WEALTH_PLEDGE_CREDENTIAL_TOKEN_OFFSET = 300_000;

    uint256 public nextHomeTokenId = 1;
    uint256 public nextPaperLeaderboardCredentialTokenId = PAPER_LEADERBOARD_CREDENTIAL_TOKEN_OFFSET + 1;
    uint256 public nextWealthPledgeCredentialTokenId = WEALTH_PLEDGE_CREDENTIAL_TOKEN_OFFSET + 1;
    uint256 public navBps = BPS;
    uint256 public minSubscription = 500;
    uint256 public lastAttestedAt;
    bool public subscriptionsPaused;
    bytes32 public latestAttestationRoot;
    string public strategyStatus;
    string public vaultLabel;
    string public assetSymbol;
    address public metadataRenderer;

    mapping(address => mapping(uint8 => bool)) public hasMintedBadge;
    mapping(uint256 => uint8) public tokenBadgeType;
    mapping(address => mapping(uint8 => bool)) public wealthTaskCompleted;
    mapping(address => bool) public eligibleInvestor;
    mapping(address => uint8) public riskTier;
    mapping(bytes32 => bool) public approvedUnderlyingHash;
    mapping(address => ReplayScore) public replayScoreOf;
    mapping(address => bool) public hasSubmittedScore;
    mapping(address => mapping(uint16 => uint256)) public wealthReceiptShares;
    mapping(uint16 => string) public productReceiptLabel;
    mapping(uint16 => string) public productReceiptDetail;
    mapping(uint16 => string) public productReceiptType;
    mapping(uint16 => string) public productReceiptMaturity;
    mapping(address => mapping(uint8 => bytes32)) public wealthTaskEvidenceHash;
    mapping(address => mapping(uint8 => int256)) public wealthTaskRealizedPnl;
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

    struct WealthReceiptProof {
        uint256 lastAssetAmount;
        uint256 lastShareAmount;
        uint256 purchasedAt;
        string productDetail;
    }

    struct PaperLeaderboardCredential {
        address account;
        string category;
        string submittedOn;
        int256 returnBps;
        uint256 winRateBps;
        uint256 maxDrawdownBps;
    }

    struct WealthPledgeCredential {
        address account;
        uint16 productId;
        uint256 supportAmount;
        string pledgedOn;
    }

    mapping(address => mapping(uint16 => WealthReceiptProof)) public wealthReceiptProofOf;
    mapping(uint256 => PaperLeaderboardCredential) public paperLeaderboardCredentialOf;
    mapping(address => mapping(uint256 => uint256)) public paperLeaderboardCredentialMintsByDay;
    mapping(uint256 => WealthPledgeCredential) public wealthPledgeCredentialOf;

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
    event ProductReceiptSubscribed(
        address indexed investor,
        uint16 indexed productId,
        uint256 indexed tokenId,
        uint256 assetAmount,
        uint256 shareAmount,
        uint256 purchasedAt,
        string productDetail
    );
    event ProductReceiptRedeemed(
        address indexed investor,
        uint16 indexed productId,
        uint256 indexed tokenId,
        uint256 shareAmount,
        uint256 assetAmount
    );
    event ProductReceiptSettled(
        address indexed investor,
        uint16 indexed fromProductId,
        uint16 indexed toProductId,
        uint256 burnAmount,
        uint256 mintAmount
    );
    event ProductReceiptLabelUpdated(uint16 indexed productId, string label);
    event ProductReceiptDetailUpdated(uint16 indexed productId, string detail);
    event ProductReceiptMetadataUpdated(uint16 indexed productId, string productType, string maturity);
    event WealthTaskEvidenceRecorded(address indexed account, uint8 indexed taskId, int256 realizedPnl, bytes32 evidenceHash);
    event PaperLeaderboardCredentialMinted(
        address indexed account,
        uint256 indexed tokenId,
        string category,
        string submittedOn,
        int256 returnBps,
        uint256 winRateBps,
        uint256 maxDrawdownBps
    );
    event WealthPledgeCredentialMinted(
        address indexed account,
        uint16 indexed productId,
        uint256 indexed tokenId,
        uint256 supportAmount,
        string pledgedOn
    );
    event MetadataRendererUpdated(address indexed renderer);

    constructor(string memory baseUri) ERC1155(baseUri) Ownable() {
        vaultLabel = "RiskLens Unified Demo Vault";
        assetSymbol = "PT";
        strategyStatus = "Demo ready";
        latestAttestationRoot = keccak256("RiskLens unified demo hub attestation");
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

    function mintPaperLeaderboardCredential(
        string calldata category,
        string calldata submittedOn,
        int256 returnBps,
        uint256 winRateBps,
        uint256 maxDrawdownBps
    ) external returns (uint256 tokenId) {
        require(bytes(category).length > 0, "Missing category");
        require(bytes(submittedOn).length > 0, "Missing date");
        require(winRateBps <= BPS, "Invalid win rate");
        require(maxDrawdownBps <= BPS, "Invalid drawdown");

        uint256 currentDay = block.timestamp / 1 days;
        require(
            paperLeaderboardCredentialMintsByDay[msg.sender][currentDay] < MAX_SCORE_SUBMISSIONS_PER_DAY,
            "Daily credential limit reached"
        );

        paperLeaderboardCredentialMintsByDay[msg.sender][currentDay] += 1;
        tokenId = nextPaperLeaderboardCredentialTokenId;
        nextPaperLeaderboardCredentialTokenId += 1;
        paperLeaderboardCredentialOf[tokenId] = PaperLeaderboardCredential({
            account: msg.sender,
            category: category,
            submittedOn: submittedOn,
            returnBps: returnBps,
            winRateBps: winRateBps,
            maxDrawdownBps: maxDrawdownBps
        });

        _mint(msg.sender, tokenId, 1, "");
        emit PaperLeaderboardCredentialMinted(
            msg.sender,
            tokenId,
            category,
            submittedOn,
            returnBps,
            winRateBps,
            maxDrawdownBps
        );
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

    function setMetadataRenderer(address renderer) external onlyOwner {
        metadataRenderer = renderer;
        emit MetadataRendererUpdated(renderer);
    }

    function setProductReceiptLabel(uint16 productId, string calldata label) external onlyOwner {
        require(productId > 0, "Invalid product");
        productReceiptLabel[productId] = label;
        emit ProductReceiptLabelUpdated(productId, label);
    }

    function setProductReceiptDetail(uint16 productId, string calldata detail) external onlyOwner {
        require(productId > 0, "Invalid product");
        productReceiptDetail[productId] = detail;
        emit ProductReceiptDetailUpdated(productId, detail);
    }

    function setProductReceiptMetadata(
        uint16 productId,
        string calldata productType,
        string calldata maturity
    ) external onlyOwner {
        require(productId > 0, "Invalid product");
        productReceiptType[productId] = productType;
        productReceiptMaturity[productId] = maturity;
        emit ProductReceiptMetadataUpdated(productId, productType, maturity);
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
        return _subscribeProduct(msg.sender, DEFAULT_WEALTH_PRODUCT_ID, assetAmount);
    }

    function subscribeProduct(uint16 productId, uint256 assetAmount) external returns (uint256 shareAmount) {
        return _subscribeProduct(msg.sender, productId, assetAmount);
    }

    function subscribeProductWithMetadata(
        uint16 productId,
        uint256 assetAmount,
        string calldata purchasedOn
    ) external returns (uint256 shareAmount) {
        require(bytes(purchasedOn).length > 0, "Missing purchase date");
        return _subscribeProduct(msg.sender, productId, assetAmount);
    }

    function redeem(uint256 shareAmount) external returns (uint256 assetAmount) {
        return _redeemProduct(msg.sender, DEFAULT_WEALTH_PRODUCT_ID, shareAmount);
    }

    function redeemProduct(uint16 productId, uint256 shareAmount) external returns (uint256 assetAmount) {
        return _redeemProduct(msg.sender, productId, shareAmount);
    }

    function settleProduct(
        uint16 fromProductId,
        uint16 toProductId,
        uint256 burnAmount,
        uint256 mintAmount
    ) external returns (uint256 assetAmount, uint256 mintedAmount) {
        assetAmount = _redeemProduct(msg.sender, fromProductId, burnAmount);

        if (toProductId > 0 && mintAmount > 0) {
            mintedAmount = _subscribeProduct(msg.sender, toProductId, mintAmount);
        }

        emit ProductReceiptSettled(msg.sender, fromProductId, toProductId, burnAmount, mintAmount);
    }

    function receiptTokenId(uint16 productId) public pure returns (uint256) {
        require(productId > 0, "Invalid product");
        return WEALTH_RECEIPT_TOKEN_OFFSET + uint256(productId);
    }

    function _subscribeProduct(
        address investor,
        uint16 productId,
        uint256 assetAmount
    ) internal returns (uint256 shareAmount) {
        require(!subscriptionsPaused, "Subscriptions paused");
        require(productId > 0, "Invalid product");
        require(assetAmount >= minSubscription, "Below minimum");

        shareAmount = assetAmount;
        require(shareAmount > 0, "Zero shares");

        uint256 tokenId = receiptTokenId(productId);
        _mint(investor, tokenId, shareAmount, "");
        wealthReceiptShares[investor][productId] += shareAmount;
        wealthReceiptProofOf[investor][productId] = WealthReceiptProof({
            lastAssetAmount: assetAmount,
            lastShareAmount: shareAmount,
            purchasedAt: block.timestamp,
            productDetail: _receiptDetail(productId)
        });
        emit Subscribed(investor, assetAmount, shareAmount);
        emit ProductReceiptSubscribed(investor, productId, tokenId, assetAmount, shareAmount, block.timestamp, _receiptDetail(productId));
    }

    function _redeemProduct(
        address investor,
        uint16 productId,
        uint256 shareAmount
    ) internal returns (uint256 assetAmount) {
        require(productId > 0, "Invalid product");
        require(shareAmount > 0, "Zero shares");

        assetAmount = shareAmount;
        uint256 tokenId = receiptTokenId(productId);
        _burn(investor, tokenId, shareAmount);
        uint256 heldShares = wealthReceiptShares[investor][productId];
        wealthReceiptShares[investor][productId] = shareAmount >= heldShares ? 0 : heldShares - shareAmount;

        emit Redeemed(investor, shareAmount, assetAmount);
        emit ProductReceiptRedeemed(investor, productId, tokenId, shareAmount, assetAmount);
    }

    function markWealthTask(uint8 taskId) external {
        require(_isSupportedWealthTask(taskId), "Invalid wealth task");
        require(balanceOf(msg.sender, _wealthTokenTypeId(taskId)) == 0, "Already claimed");
        _completeWealthTask(msg.sender, taskId, 0, bytes32(0));
    }

    function markWealthTaskWithEvidence(
        uint8 taskId,
        int256 realizedPnl,
        bytes32 evidenceHash
    ) external {
        require(_isSupportedWealthTask(taskId), "Invalid wealth task");
        require(balanceOf(msg.sender, _wealthTokenTypeId(taskId)) == 0, "Already claimed");
        require(evidenceHash != bytes32(0), "Missing evidence");
        if (taskId == WEALTH_PROFITABLE_TRADE || taskId == WEALTH_DUAL_PROFIT) {
            require(realizedPnl > 0, "Positive PnL required");
        }
        _completeWealthTask(msg.sender, taskId, realizedPnl, evidenceHash);
    }

    function markWealthPledgeWithEvidence(
        uint16 productId,
        uint256 supportAmount,
        string calldata pledgedOn,
        bytes32 evidenceHash
    ) external returns (uint256 tokenId) {
        require(productId > 0, "Invalid product");
        require(supportAmount > 0, "Invalid support");
        require(bytes(pledgedOn).length > 0, "Missing pledge date");
        require(evidenceHash != bytes32(0), "Missing evidence");
        require(balanceOf(msg.sender, _wealthTokenTypeId(WEALTH_PLEDGE)) == 0, "Already claimed");

        _completeWealthTask(msg.sender, WEALTH_PLEDGE, 0, evidenceHash);

        tokenId = nextWealthPledgeCredentialTokenId;
        nextWealthPledgeCredentialTokenId += 1;
        wealthPledgeCredentialOf[tokenId] = WealthPledgeCredential({
            account: msg.sender,
            productId: productId,
            supportAmount: supportAmount,
            pledgedOn: pledgedOn
        });
        _mint(msg.sender, tokenId, 1, "");
        emit WealthPledgeCredentialMinted(msg.sender, productId, tokenId, supportAmount, pledgedOn);
    }

    function hasWealthTask(address holder, uint8 taskId) external view returns (bool) {
        require(_isSupportedWealthTask(taskId), "Invalid wealth task");
        return wealthTaskCompleted[holder][taskId];
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        if (metadataRenderer != address(0)) {
            try IMSXCollectibleRenderer(metadataRenderer).uri(tokenId) returns (string memory renderedUri) {
                return renderedUri;
            } catch {}
        }

        return string(abi.encodePacked(
            "data:application/json;utf8,",
            '{"name":"RiskLens Demo Collectible","description":"RiskLens Sepolia collectible. Configure the metadata renderer for full cover art.","attributes":[{"trait_type":"Network","value":"Sepolia"},{"trait_type":"Token ID","value":"',
            tokenId.toString(),
            '"}]}'
        ));
    }

    function _receiptDetail(uint16 productId) internal view returns (string memory) {
        string memory detail = productReceiptDetail[productId];
        if (bytes(detail).length > 0) return detail;
        return "Settlement terms recorded in the RiskLens Wealth detail page";
    }

    function _completeWealthTask(address account, uint8 taskId, int256 realizedPnl, bytes32 evidenceHash) internal {
        wealthTaskCompleted[account][taskId] = true;
        wealthTaskRealizedPnl[account][taskId] = realizedPnl;
        wealthTaskEvidenceHash[account][taskId] = evidenceHash;
        uint256 tokenId = _wealthTokenTypeId(taskId);

        if (balanceOf(account, tokenId) == 0) {
            _mint(account, tokenId, 1, "");
            emit WealthTaskCompleted(account, taskId);
            emit WealthTaskEvidenceRecorded(account, taskId, realizedPnl, evidenceHash);
        }
    }

    function _isSupportedHomeBadge(uint8 badgeType) internal pure returns (bool) {
        return badgeType >= HOME_WELCOME && badgeType <= HOME_PAPER;
    }

    function _isSupportedWealthTask(uint8 taskId) internal pure returns (bool) {
        return taskId >= WEALTH_PROFITABLE_TRADE && taskId <= WEALTH_DUAL_PROFIT;
    }

    function _isSupportedPaperAchievement(uint256 achievementId) internal pure returns (bool) {
        return achievementId >= PAPER_BASE_CHECK && achievementId <= PAPER_PROTECTIVE_HEDGE;
    }

    function _homeTokenTypeId(uint8 badgeType) internal pure returns (uint256) {
        return HOME_TOKEN_OFFSET + uint256(badgeType);
    }

    function _wealthTokenTypeId(uint8 taskId) internal pure returns (uint256) {
        return WEALTH_TOKEN_OFFSET + uint256(taskId);
    }

}
