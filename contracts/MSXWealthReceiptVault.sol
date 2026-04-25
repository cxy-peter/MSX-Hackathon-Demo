// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MSXWealthReceiptVault is ERC20, Ownable {
    uint256 public constant BPS = 10_000;
    uint8 public constant ASSET_DECIMALS = 6;

    string public vaultLabel;
    string public assetSymbol;
    uint256 public navBps = BPS;
    uint256 public minSubscription = 500 * 10 ** ASSET_DECIMALS;
    uint256 public lastAttestedAt;
    bool public subscriptionsPaused;
    bytes32 public latestAttestationRoot;
    string public strategyStatus;

    mapping(address => bool) public eligibleInvestor;
    mapping(address => uint8) public riskTier;
    mapping(bytes32 => bool) public approvedUnderlyingHash;

    event InvestorEligibilityUpdated(address indexed investor, bool allowed, uint8 indexed tier);
    event UnderlyingReviewRecorded(bytes32 indexed assetHash, bool passed, string note);
    event StrategyStatusUpdated(string status, uint256 timestamp);
    event NavUpdated(uint256 navBps, uint256 timestamp);
    event AttestationUpdated(bytes32 attestationRoot, uint256 timestamp);
    event Subscribed(address indexed investor, uint256 assetAmount, uint256 shareAmount);
    event Redeemed(address indexed investor, uint256 shareAmount, uint256 assetAmount);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory vaultLabel_,
        string memory assetSymbol_
    ) ERC20(name_, symbol_) Ownable() {
        vaultLabel = vaultLabel_;
        assetSymbol = assetSymbol_;
        strategyStatus = "Bootstrapping";
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

    function previewShares(uint256 assetAmount) public view returns (uint256) {
        return assetAmount * (10 ** decimals()) * BPS / navBps / (10 ** ASSET_DECIMALS);
    }

    function previewAssets(uint256 shareAmount) public view returns (uint256) {
        return shareAmount * navBps * (10 ** ASSET_DECIMALS) / BPS / (10 ** decimals());
    }

    function subscribe(uint256 assetAmount) external returns (uint256 shareAmount) {
        require(!subscriptionsPaused, "Subscriptions paused");
        require(eligibleInvestor[msg.sender], "Investor not eligible");
        require(assetAmount >= minSubscription, "Below minimum");

        shareAmount = previewShares(assetAmount);
        require(shareAmount > 0, "Zero shares");

        _mint(msg.sender, shareAmount);
        emit Subscribed(msg.sender, assetAmount, shareAmount);
    }

    function redeem(uint256 shareAmount) external returns (uint256 assetAmount) {
        require(shareAmount > 0, "Zero shares");

        assetAmount = previewAssets(shareAmount);
        _burn(msg.sender, shareAmount);

        emit Redeemed(msg.sender, shareAmount, assetAmount);
    }

    function canAccessAdvancedShelf(address investor) external view returns (bool) {
        return eligibleInvestor[investor] && riskTier[investor] >= 2;
    }
}
