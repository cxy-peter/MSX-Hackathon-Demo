// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

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

    uint256 public nextHomeTokenId = 1;
    uint256 public navBps = BPS;
    uint256 public minSubscription = 500;
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

    mapping(address => mapping(uint16 => WealthReceiptProof)) public wealthReceiptProofOf;

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

    function hasWealthTask(address holder, uint8 taskId) external view returns (bool) {
        require(_isSupportedWealthTask(taskId), "Invalid wealth task");
        return wealthTaskCompleted[holder][taskId];
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        bytes memory metadata = abi.encodePacked(
            '{"name":"',
            _tokenName(tokenId),
            '","description":"',
            _tokenDescription(tokenId),
            '","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(_buildTokenSvg(tokenId))),
            '","attributes":[{"trait_type":"Surface","value":"',
            _tokenSurface(tokenId),
            '"},{"trait_type":"Network","value":"Sepolia"},{"trait_type":"Token ID","value":"',
            tokenId.toString(),
            '"}',
            _tokenExtraAttributes(tokenId),
            ']}'
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(metadata)));
    }

    function _tokenName(uint256 tokenId) internal view returns (string memory) {
        if (_isSupportedHomeToken(tokenId)) {
            uint8 badgeType = _homeBadgeType(tokenId);
            if (badgeType == HOME_WELCOME) return "RiskLens Welcome Collectible";
            if (badgeType == HOME_WALLET) return "RiskLens Wallet Collectible";
            if (badgeType == HOME_RISK) return "RiskLens Risk Review Collectible";
            if (badgeType == HOME_QUIZ) return "RiskLens Product Quiz Collectible";
            return "RiskLens Paper Preview Collectible";
        }
        if (_isSupportedWealthTaskToken(tokenId)) {
            uint8 taskId = _wealthTaskType(tokenId);
            if (taskId == WEALTH_PROFITABLE_TRADE) return "RiskLens Wealth Profitable Trade Badge";
            if (taskId == WEALTH_PLEDGE) return "RiskLens Wealth Pledge Badge";
            return "RiskLens Wealth Dual Profit Badge";
        }
        if (_isSupportedPaperAchievement(tokenId)) {
            if (tokenId == PAPER_BASE_CHECK) return "RiskLens Paper Base Check";
            if (tokenId == PAPER_LEADERBOARD) return "RiskLens Paper Leaderboard";
            if (tokenId == PAPER_SPOT_LOOP) return "RiskLens Spot Loop";
            if (tokenId == PAPER_PERP_LEVERAGE) return "RiskLens Perp Leverage";
            return "RiskLens Protective Hedge";
        }
        if (_isSupportedWealthReceiptToken(tokenId)) {
            return string(
                abi.encodePacked("RiskLens Wealth Receipt - ", _receiptLabel(_receiptProductId(tokenId)))
            );
        }
        return "RiskLens Demo Collectible";
    }

    function _tokenDescription(uint256 tokenId) internal view returns (string memory) {
        if (_isSupportedWealthReceiptToken(tokenId)) {
            return string(
                abi.encodePacked(
                    "Sepolia Wealth receipt for ",
                    _receiptLabel(_receiptProductId(tokenId)),
                    ". Product detail: ",
                    _receiptDetail(_receiptProductId(tokenId)),
                    ". Product type: ",
                    _receiptType(_receiptProductId(tokenId)),
                    ". Maturity: ",
                    _receiptMaturity(_receiptProductId(tokenId)),
                    ". Purchase date is the block timestamp emitted by ProductReceiptSubscribed."
                )
            );
        }
        if (_isSupportedPaperAchievement(tokenId)) {
            return "Sepolia paper-trading achievement for RiskLens.";
        }
        if (_isSupportedWealthTaskToken(tokenId)) {
            return "Sepolia Wealth workflow collectible.";
        }
        if (_isSupportedHomeToken(tokenId)) {
            return "Sepolia onboarding collectible for RiskLens.";
        }
        return "A Sepolia collectible for the RiskLens demo hub.";
    }

    function _tokenSurface(uint256 tokenId) internal pure returns (string memory) {
        if (_isSupportedHomeToken(tokenId)) return "Home";
        if (_isSupportedWealthTaskToken(tokenId)) return "Wealth Task";
        if (_isSupportedPaperAchievement(tokenId)) return "Paper Trading";
        if (_isSupportedWealthReceiptToken(tokenId)) return "Wealth Receipt";
        return "Demo";
    }

    function _tokenExtraAttributes(uint256 tokenId) internal view returns (string memory) {
        if (_isSupportedWealthReceiptToken(tokenId)) {
            uint16 productId = _receiptProductId(tokenId);
            return string(
                abi.encodePacked(
                    ',{"trait_type":"Product","value":"',
                    _receiptLabel(productId),
                    '"},{"trait_type":"Product detail","value":"',
                    _receiptDetail(productId),
                    '"},{"trait_type":"Product type","value":"',
                    _receiptType(productId),
                    '"},{"trait_type":"Maturity","value":"',
                    _receiptMaturity(productId),
                    '"},{"trait_type":"Purchase date","value":"ProductReceiptSubscribed block timestamp"}'
                )
            );
        }

        return "";
    }

    function _buildTokenSvg(uint256 tokenId) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="36" y1="22" x2="560" y2="578"><stop stop-color="#12221A"/><stop offset=".55" stop-color="#111827"/><stop offset="1" stop-color="#12333A"/></linearGradient></defs><rect width="600" height="600" rx="44" fill="#0B111C"/><rect x="28" y="28" width="544" height="544" rx="34" fill="url(#g)" stroke="',
                _accent(tokenId),
                '" stroke-width="2"/><circle cx="92" cy="92" r="18" fill="',
                _accent(tokenId),
                '"/><text x="126" y="101" fill="',
                _accent(tokenId),
                '" font-size="18" font-weight="800" font-family="Arial">',
                _tokenKicker(tokenId),
                '</text><text x="58" y="284" fill="#F6F8FB" font-size="48" font-weight="900" font-family="Arial">',
                _tokenLineOne(tokenId),
                '</text><text x="58" y="344" fill="#F6F8FB" font-size="48" font-weight="900" font-family="Arial">',
                _tokenLineTwo(tokenId),
                '</text><text x="58" y="410" fill="#AAB8C7" font-size="20" font-family="Arial">',
                _tokenSubtitleOne(tokenId),
                '</text><text x="58" y="440" fill="#AAB8C7" font-size="20" font-family="Arial">',
                _tokenSubtitleTwo(tokenId),
                '</text><text x="58" y="520" fill="#6F8095" font-size="18" font-weight="700" font-family="Arial">TOKEN #',
                tokenId.toString(),
                '</text></svg>'
            )
        );
    }

    function _tokenKicker(uint256 tokenId) internal pure returns (string memory) {
        if (_isSupportedWealthReceiptToken(tokenId)) return "RiskLens Wealth Receipt";
        if (_isSupportedWealthTaskToken(tokenId)) return "RiskLens Wealth";
        if (_isSupportedPaperAchievement(tokenId)) return "RiskLens Paper Trading";
        return "RiskLens Wallet Collectible";
    }

    function _tokenLineOne(uint256 tokenId) internal pure returns (string memory) {
        if (_isSupportedWealthReceiptToken(tokenId)) return "WEALTH";
        if (_isSupportedWealthTaskToken(tokenId)) return "WEALTH";
        if (_isSupportedPaperAchievement(tokenId)) return "PAPER";
        return "WALLET";
    }

    function _tokenLineTwo(uint256 tokenId) internal pure returns (string memory) {
        if (_isSupportedWealthReceiptToken(tokenId)) {
            return string(abi.encodePacked("RECEIPT #", uint256(_receiptProductId(tokenId)).toString()));
        }
        if (_isSupportedWealthTaskToken(tokenId)) {
            uint8 taskId = _wealthTaskType(tokenId);
            if (taskId == WEALTH_PROFITABLE_TRADE) return "PROFIT BADGE";
            if (taskId == WEALTH_PLEDGE) return "PLEDGE BADGE";
            return "DUAL BADGE";
        }
        if (_isSupportedPaperAchievement(tokenId)) {
            if (tokenId == PAPER_BASE_CHECK) return "BASE CHECK";
            if (tokenId == PAPER_LEADERBOARD) return "LEADERBOARD";
            if (tokenId == PAPER_SPOT_LOOP) return "SPOT LOOP";
            if (tokenId == PAPER_PERP_LEVERAGE) return "LEVERAGE";
            return "HEDGE";
        }
        if (_isSupportedHomeToken(tokenId)) {
            uint8 badgeType = _homeBadgeType(tokenId);
            if (badgeType == HOME_WELCOME) return "WELCOME";
            if (badgeType == HOME_WALLET) return "CONNECT";
            if (badgeType == HOME_RISK) return "RISK REVIEW";
            if (badgeType == HOME_QUIZ) return "PRODUCT QUIZ";
            return "PAPER PREVIEW";
        }
        return "COLLECTIBLE";
    }

    function _tokenSubtitleOne(uint256 tokenId) internal pure returns (string memory) {
        if (_isSupportedWealthReceiptToken(tokenId)) return "Subscription receipt shares live";
        if (_isSupportedWealthTaskToken(tokenId)) return "Workflow milestone recorded";
        if (_isSupportedPaperAchievement(tokenId)) return "Replay achievement recorded";
        return "Onboarding milestone recorded";
    }

    function _tokenSubtitleTwo(uint256 tokenId) internal pure returns (string memory) {
        if (_isSupportedWealthReceiptToken(tokenId)) return "in the connected wallet";
        if (_isSupportedWealthTaskToken(tokenId)) return "for the Wealth flow";
        if (_isSupportedPaperAchievement(tokenId)) return "for the simulation wallet";
        return "for the RiskLens hub";
    }

    function _accent(uint256 tokenId) internal pure returns (string memory) {
        if (_isSupportedWealthReceiptToken(tokenId)) return "#C8FF6B";
        if (_isSupportedWealthTaskToken(tokenId)) return "#49D6C4";
        if (_isSupportedPaperAchievement(tokenId)) return "#76A9FF";
        if (_isSupportedHomeToken(tokenId) && _homeBadgeType(tokenId) == HOME_QUIZ) return "#FFB36B";
        if (_isSupportedHomeToken(tokenId) && _homeBadgeType(tokenId) == HOME_RISK) return "#FFD166";
        return "#B6FF43";
    }

    function _accentTwo(uint256 tokenId) internal pure returns (string memory) {
        if (_isSupportedWealthReceiptToken(tokenId)) return "#49D6C4";
        if (_isSupportedWealthTaskToken(tokenId)) return "#B6FF43";
        if (_isSupportedPaperAchievement(tokenId)) return "#A7F0FF";
        return "#6FA5FF";
    }

    function _receiptLabel(uint16 productId) internal view returns (string memory) {
        string memory label = productReceiptLabel[productId];
        if (bytes(label).length > 0) return label;
        return string(abi.encodePacked("Wealth Product #", uint256(productId).toString()));
    }

    function _receiptDetail(uint16 productId) internal view returns (string memory) {
        string memory detail = productReceiptDetail[productId];
        if (bytes(detail).length > 0) return detail;
        return "Settlement terms recorded in the RiskLens Wealth detail page";
    }

    function _receiptType(uint16 productId) internal view returns (string memory) {
        string memory productType = productReceiptType[productId];
        if (bytes(productType).length > 0) return productType;
        return "Wealth receipt";
    }

    function _receiptMaturity(uint16 productId) internal view returns (string memory) {
        string memory maturity = productReceiptMaturity[productId];
        if (bytes(maturity).length > 0) return maturity;
        return "Product-specific";
    }

    function _isSupportedHomeToken(uint256 tokenId) internal pure returns (bool) {
        return tokenId > HOME_TOKEN_OFFSET && tokenId <= HOME_TOKEN_OFFSET + HOME_PAPER;
    }

    function _isSupportedWealthTaskToken(uint256 tokenId) internal pure returns (bool) {
        return tokenId > WEALTH_TOKEN_OFFSET && tokenId <= WEALTH_TOKEN_OFFSET + WEALTH_DUAL_PROFIT;
    }

    function _isSupportedWealthReceiptToken(uint256 tokenId) internal pure returns (bool) {
        return tokenId > WEALTH_RECEIPT_TOKEN_OFFSET && tokenId <= WEALTH_RECEIPT_TOKEN_OFFSET + type(uint16).max;
    }

    function _homeBadgeType(uint256 tokenId) internal pure returns (uint8) {
        return uint8(tokenId - HOME_TOKEN_OFFSET);
    }

    function _wealthTaskType(uint256 tokenId) internal pure returns (uint8) {
        return uint8(tokenId - WEALTH_TOKEN_OFFSET);
    }

    function _receiptProductId(uint256 tokenId) internal pure returns (uint16) {
        return uint16(tokenId - WEALTH_RECEIPT_TOKEN_OFFSET);
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
