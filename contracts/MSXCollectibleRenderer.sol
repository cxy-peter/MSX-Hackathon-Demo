// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IMSXUnifiedDemoHubMetadataSource {
    function productReceiptLabel(uint16 productId) external view returns (string memory);
    function productReceiptDetail(uint16 productId) external view returns (string memory);
    function productReceiptType(uint16 productId) external view returns (string memory);
    function productReceiptMaturity(uint16 productId) external view returns (string memory);

    function paperLeaderboardCredentialOf(uint256 tokenId)
        external
        view
        returns (
            address account,
            string memory category,
            string memory submittedOn,
            int256 returnBps,
            uint256 winRateBps,
            uint256 maxDrawdownBps
        );

    function wealthPledgeCredentialOf(uint256 tokenId)
        external
        view
        returns (
            address account,
            uint16 productId,
            uint256 supportAmount,
            string memory pledgedOn
        );
}

contract MSXCollectibleRenderer {
    using Strings for uint256;

    uint8 private constant HOME_WELCOME = 1;
    uint8 private constant HOME_WALLET = 2;
    uint8 private constant HOME_RISK = 3;
    uint8 private constant HOME_QUIZ = 4;
    uint8 private constant HOME_PAPER = 5;

    uint8 private constant WEALTH_PROFITABLE_TRADE = 1;
    uint8 private constant WEALTH_PLEDGE = 2;
    uint8 private constant WEALTH_DUAL_PROFIT = 3;

    uint256 private constant PAPER_BASE_CHECK = 6;
    uint256 private constant PAPER_LEADERBOARD = 7;
    uint256 private constant PAPER_SPOT_LOOP = 8;
    uint256 private constant PAPER_PERP_LEVERAGE = 9;
    uint256 private constant PAPER_PROTECTIVE_HEDGE = 10;

    uint256 private constant HOME_TOKEN_OFFSET = 100;
    uint256 private constant WEALTH_TOKEN_OFFSET = 200;
    uint256 private constant WEALTH_RECEIPT_TOKEN_OFFSET = 1000;

    IMSXUnifiedDemoHubMetadataSource public immutable hub;

    constructor(address hubAddress) {
        require(hubAddress != address(0), "Missing hub");
        hub = IMSXUnifiedDemoHubMetadataSource(hubAddress);
    }

    function uri(uint256 tokenId) external view returns (string memory) {
        string memory image = string(
            abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(_buildTokenSvg(tokenId))))
        );
        bytes memory metadata = abi.encodePacked(
            '{"name":"',
            _tokenName(tokenId),
            '","description":"',
            _tokenDescription(tokenId),
            '","image":"',
            image,
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
            return string(abi.encodePacked("RiskLens Wealth Receipt - ", _receiptLabel(_receiptProductId(tokenId))));
        }
        if (_isPaperLeaderboardCredentialToken(tokenId)) {
            (, string memory category,,,,) = hub.paperLeaderboardCredentialOf(tokenId);
            return string(abi.encodePacked("RiskLens Paper Credential - ", category));
        }
        if (_isWealthPledgeCredentialToken(tokenId)) {
            (, uint16 productId,,) = hub.wealthPledgeCredentialOf(tokenId);
            return string(abi.encodePacked("RiskLens Pledge Credential - ", _receiptLabel(productId)));
        }
        return "RiskLens Demo Collectible";
    }

    function _tokenDescription(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) {
            (, string memory category, string memory submittedOn, int256 returnBps, uint256 winRateBps, uint256 maxDrawdownBps) =
                hub.paperLeaderboardCredentialOf(tokenId);
            return string(
                abi.encodePacked(
                    "Paper leaderboard submission credential for ",
                    category,
                    ". Return ",
                    _formatSignedBps(returnBps),
                    ", win rate ",
                    _formatBps(winRateBps),
                    ", max drawdown ",
                    _formatBps(maxDrawdownBps),
                    ". Submitted ",
                    submittedOn,
                    "."
                )
            );
        }
        if (_isWealthPledgeCredentialToken(tokenId)) {
            (, uint16 productId, uint256 supportAmount, string memory pledgedOn) = hub.wealthPledgeCredentialOf(tokenId);
            return string(
                abi.encodePacked(
                    "Wallet pledge credential for ",
                    _receiptLabel(productId),
                    ". Pledged ",
                    pledgedOn,
                    " for ",
                    supportAmount.toString(),
                    " PT of route support."
                )
            );
        }
        if (_isSupportedWealthReceiptToken(tokenId)) {
            uint16 productId = _receiptProductId(tokenId);
            return string(
                abi.encodePacked(
                    "Sepolia Wealth receipt for ",
                    _receiptLabel(productId),
                    ". Product detail: ",
                    _receiptDetail(productId),
                    ". Product type: ",
                    _receiptType(productId),
                    ". Maturity: ",
                    _receiptMaturity(productId),
                    ". Purchase date is emitted by ProductReceiptSubscribed."
                )
            );
        }
        if (_isSupportedPaperAchievement(tokenId)) return "Sepolia paper-trading achievement for RiskLens.";
        if (_isSupportedWealthTaskToken(tokenId)) return "Sepolia Wealth workflow collectible.";
        if (_isSupportedHomeToken(tokenId)) return "Sepolia onboarding collectible for RiskLens.";
        return "A Sepolia collectible for the RiskLens demo hub.";
    }

    function _tokenExtraAttributes(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) {
            (, string memory category, string memory submittedOn, int256 returnBps, uint256 winRateBps, uint256 maxDrawdownBps) =
                hub.paperLeaderboardCredentialOf(tokenId);
            return string(
                abi.encodePacked(
                    ',{"trait_type":"Category","value":"',
                    category,
                    '"},{"trait_type":"Submitted on","value":"',
                    submittedOn,
                    '"},{"trait_type":"Win rate","value":"',
                    _formatBps(winRateBps),
                    '"},{"trait_type":"Return","value":"',
                    _formatSignedBps(returnBps),
                    '"},{"trait_type":"Max drawdown","value":"',
                    _formatBps(maxDrawdownBps),
                    '"}'
                )
            );
        }
        if (_isWealthPledgeCredentialToken(tokenId)) {
            (, uint16 productId, uint256 supportAmount, string memory pledgedOn) = hub.wealthPledgeCredentialOf(tokenId);
            return string(
                abi.encodePacked(
                    ',{"trait_type":"Product","value":"',
                    _receiptLabel(productId),
                    '"},{"trait_type":"Pledge date","value":"',
                    pledgedOn,
                    '"},{"trait_type":"Route support","value":"',
                    supportAmount.toString(),
                    ' PT"}'
                )
            );
        }
        if (_isSupportedWealthReceiptToken(tokenId)) {
            uint16 productId = _receiptProductId(tokenId);
            return string(
                abi.encodePacked(
                    ',{"trait_type":"Product","value":"',
                    _receiptLabel(productId),
                    '"},{"trait_type":"Product type","value":"',
                    _receiptType(productId),
                    '"},{"trait_type":"Maturity","value":"',
                    _receiptMaturity(productId),
                    '"}'
                )
            );
        }
        return "";
    }

    function _buildTokenSvg(uint256 tokenId) internal view returns (string memory) {
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
                '</text><text x="58" y="486" fill="#D9E4EF" font-size="18" font-weight="700" font-family="Arial">',
                _tokenFooterOne(tokenId),
                '</text><text x="58" y="514" fill="#8FA1B6" font-size="17" font-weight="700" font-family="Arial">',
                _tokenFooterTwo(tokenId),
                '</text><text x="58" y="542" fill="#8FA1B6" font-size="17" font-weight="700" font-family="Arial">',
                _tokenFooterThree(tokenId),
                '</text><text x="58" y="568" fill="#6F8095" font-size="16" font-weight="700" font-family="Arial">TOKEN #',
                tokenId.toString(),
                '</text></svg>'
            )
        );
    }

    function _tokenSurface(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) return "Paper Leaderboard Credential";
        if (_isWealthPledgeCredentialToken(tokenId)) return "Wealth Pledge Credential";
        if (_isSupportedHomeToken(tokenId)) return "Home";
        if (_isSupportedWealthTaskToken(tokenId)) return "Wealth Task";
        if (_isSupportedPaperAchievement(tokenId)) return "Paper Trading";
        if (_isSupportedWealthReceiptToken(tokenId)) return "Wealth Receipt";
        return "Demo";
    }

    function _tokenKicker(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) return "RiskLens Leaderboard";
        if (_isWealthPledgeCredentialToken(tokenId)) return "RiskLens Wealth Pledge";
        if (_isSupportedWealthReceiptToken(tokenId)) return "RiskLens Wealth Receipt";
        if (_isSupportedWealthTaskToken(tokenId)) return "RiskLens Wealth";
        if (_isSupportedPaperAchievement(tokenId)) return "RiskLens Paper Trading";
        return "RiskLens Wallet Collectible";
    }

    function _tokenLineOne(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) return "LEADERBOARD";
        if (_isWealthPledgeCredentialToken(tokenId)) return "PLEDGE";
        if (_isSupportedWealthReceiptToken(tokenId)) return "WEALTH";
        if (_isSupportedWealthTaskToken(tokenId)) return "WEALTH";
        if (_isSupportedPaperAchievement(tokenId)) return "PAPER";
        return "WALLET";
    }

    function _tokenLineTwo(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) return "CREDENTIAL";
        if (_isWealthPledgeCredentialToken(tokenId)) return "SUPPORT LINE";
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

    function _tokenSubtitleOne(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) {
            (,,, int256 returnBps, uint256 winRateBps,) = hub.paperLeaderboardCredentialOf(tokenId);
            return string(abi.encodePacked(_formatBps(winRateBps), " win / ", _formatSignedBps(returnBps), " return"));
        }
        if (_isWealthPledgeCredentialToken(tokenId)) {
            (, uint16 productId,,) = hub.wealthPledgeCredentialOf(tokenId);
            return _receiptLabel(productId);
        }
        if (_isSupportedWealthReceiptToken(tokenId)) return "Subscription receipt shares live";
        if (_isSupportedWealthTaskToken(tokenId)) return "Workflow milestone recorded";
        if (_isSupportedPaperAchievement(tokenId)) return "Replay achievement recorded";
        return "Onboarding milestone recorded";
    }

    function _tokenSubtitleTwo(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) {
            (,,,,, uint256 maxDrawdownBps) = hub.paperLeaderboardCredentialOf(tokenId);
            return string(abi.encodePacked(_formatBps(maxDrawdownBps), " max DD"));
        }
        if (_isWealthPledgeCredentialToken(tokenId)) {
            (,, uint256 supportAmount,) = hub.wealthPledgeCredentialOf(tokenId);
            return string(abi.encodePacked(supportAmount.toString(), " PT support"));
        }
        if (_isSupportedWealthReceiptToken(tokenId)) return "in the connected wallet";
        if (_isSupportedWealthTaskToken(tokenId)) return "for the Wealth flow";
        if (_isSupportedPaperAchievement(tokenId)) return "for the simulation wallet";
        return "for the RiskLens hub";
    }

    function _tokenFooterOne(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) {
            (, string memory category,,,,) = hub.paperLeaderboardCredentialOf(tokenId);
            return string(abi.encodePacked("Category: ", category));
        }
        if (_isWealthPledgeCredentialToken(tokenId)) {
            (, uint16 productId,,) = hub.wealthPledgeCredentialOf(tokenId);
            return string(abi.encodePacked("Product: ", _receiptLabel(productId)));
        }
        if (_isSupportedWealthReceiptToken(tokenId)) {
            uint16 productId = _receiptProductId(tokenId);
            return string(abi.encodePacked(_receiptType(productId), " / ", _receiptMaturity(productId)));
        }
        if (_isSupportedPaperAchievement(tokenId)) return "Task badge for replay learning";
        if (_isSupportedWealthTaskToken(tokenId)) return "Task badge for Wealth workflow";
        return "Task badge for wallet onboarding";
    }

    function _tokenFooterTwo(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) {
            (,, string memory submittedOn,,,) = hub.paperLeaderboardCredentialOf(tokenId);
            return string(abi.encodePacked("Date: ", submittedOn));
        }
        if (_isWealthPledgeCredentialToken(tokenId)) {
            (,,, string memory pledgedOn) = hub.wealthPledgeCredentialOf(tokenId);
            return string(abi.encodePacked("Pledge date: ", pledgedOn));
        }
        return _tokenSurface(tokenId);
    }

    function _tokenFooterThree(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) {
            (,,, int256 returnBps, uint256 winRateBps, uint256 maxDrawdownBps) = hub.paperLeaderboardCredentialOf(tokenId);
            return string(
                abi.encodePacked(
                    "Win ",
                    _formatBps(winRateBps),
                    " / Return ",
                    _formatSignedBps(returnBps),
                    " / DD ",
                    _formatBps(maxDrawdownBps)
                )
            );
        }
        if (_isWealthPledgeCredentialToken(tokenId)) {
            (,, uint256 supportAmount,) = hub.wealthPledgeCredentialOf(tokenId);
            return string(abi.encodePacked("Pledged out: ", supportAmount.toString(), " PT"));
        }
        return "Sepolia collectible";
    }

    function _receiptLabel(uint16 productId) internal view returns (string memory) {
        string memory label = hub.productReceiptLabel(productId);
        if (bytes(label).length > 0) return label;
        return string(abi.encodePacked("Wealth Product #", uint256(productId).toString()));
    }

    function _receiptDetail(uint16 productId) internal view returns (string memory) {
        string memory detail = hub.productReceiptDetail(productId);
        if (bytes(detail).length > 0) return detail;
        return "Settlement terms recorded in the RiskLens Wealth detail page";
    }

    function _receiptType(uint16 productId) internal view returns (string memory) {
        string memory productType = hub.productReceiptType(productId);
        if (bytes(productType).length > 0) return productType;
        return "Wealth receipt";
    }

    function _receiptMaturity(uint16 productId) internal view returns (string memory) {
        string memory maturity = hub.productReceiptMaturity(productId);
        if (bytes(maturity).length > 0) return maturity;
        return "Product-specific";
    }

    function _accent(uint256 tokenId) internal view returns (string memory) {
        if (_isPaperLeaderboardCredentialToken(tokenId)) return "#76A9FF";
        if (_isWealthPledgeCredentialToken(tokenId)) return "#FFD166";
        if (_isSupportedWealthReceiptToken(tokenId)) return "#C8FF6B";
        if (_isSupportedWealthTaskToken(tokenId)) return "#49D6C4";
        if (_isSupportedPaperAchievement(tokenId)) return "#76A9FF";
        if (_isSupportedHomeToken(tokenId) && _homeBadgeType(tokenId) == HOME_QUIZ) return "#FFB36B";
        if (_isSupportedHomeToken(tokenId) && _homeBadgeType(tokenId) == HOME_RISK) return "#FFD166";
        return "#B6FF43";
    }

    function _isPaperLeaderboardCredentialToken(uint256 tokenId) internal view returns (bool) {
        (address account,,,,,) = hub.paperLeaderboardCredentialOf(tokenId);
        return account != address(0);
    }

    function _isWealthPledgeCredentialToken(uint256 tokenId) internal view returns (bool) {
        (address account,,,) = hub.wealthPledgeCredentialOf(tokenId);
        return account != address(0);
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

    function _isSupportedPaperAchievement(uint256 achievementId) internal pure returns (bool) {
        return achievementId >= PAPER_BASE_CHECK && achievementId <= PAPER_PROTECTIVE_HEDGE;
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

    function _formatSignedBps(int256 value) internal pure returns (string memory) {
        if (value < 0) return string(abi.encodePacked("-", _formatBps(uint256(-value))));
        return string(abi.encodePacked("+", _formatBps(uint256(value))));
    }

    function _formatBps(uint256 value) internal pure returns (string memory) {
        uint256 whole = value / 100;
        uint256 decimal = (value % 100) / 10;
        if (decimal == 0) return string(abi.encodePacked(whole.toString(), "%"));
        return string(abi.encodePacked(whole.toString(), ".", decimal.toString(), "%"));
    }
}
