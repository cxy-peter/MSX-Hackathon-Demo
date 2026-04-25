// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract MSXQuestBadge is ERC721, Ownable {
    using Strings for uint256;

    uint8 public constant BADGE_WELCOME = 0;
    uint8 public constant BADGE_WALLET = 1;
    uint8 public constant BADGE_RISK = 2;
    uint8 public constant BADGE_QUIZ = 3;
    uint8 public constant BADGE_PAPER = 4;
    uint8 public constant BADGE_COUNT = 5;

    uint256 public nextTokenId = 1;
    mapping(address => mapping(uint8 => bool)) public hasMintedBadge;
    mapping(uint256 => uint8) public tokenBadgeType;

    event TaskBadgeMinted(address indexed recipient, uint8 indexed badgeType, uint256 indexed tokenId);

    constructor() ERC721("MSX Quest Badge", "MSXQB") Ownable() {}

    function hasMinted(address holder) external view returns (bool) {
        return hasMintedBadge[holder][BADGE_WELCOME];
    }

    function hasMintedTask(address holder, uint8 badgeType) external view returns (bool) {
        require(badgeType < BADGE_COUNT, "Invalid badge type");
        return hasMintedBadge[holder][badgeType];
    }

    function mintWelcomeBadge(address to) external returns (uint256 tokenId) {
        return mintBadge(BADGE_WELCOME, to);
    }

    function mintBadge(uint8 badgeType, address to) public returns (uint256 tokenId) {
        require(badgeType < BADGE_COUNT, "Invalid badge type");
        require(to != address(0), "Invalid recipient");
        require(msg.sender == to, "Only self mint");
        require(!hasMintedBadge[to][badgeType], "Badge already minted");

        tokenId = nextTokenId;
        nextTokenId += 1;

        hasMintedBadge[to][badgeType] = true;
        tokenBadgeType[tokenId] = badgeType;
        _safeMint(to, tokenId);

        emit TaskBadgeMinted(to, badgeType, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "ERC721: invalid token ID");

        uint8 badgeType = tokenBadgeType[tokenId];
        string memory badgeTypeName = _badgeTypeName(badgeType);
        string memory title = _badgeTitle(badgeType);
        string memory description = _badgeDescription(badgeType);
        string memory image = string(
            abi.encodePacked(
                "data:image/svg+xml;base64,",
                Base64.encode(bytes(_buildBadgeSvg(badgeType)))
            )
        );

        bytes memory metadata = abi.encodePacked(
            '{"name":"',
            title,
            '","description":"',
            description,
            '","image":"',
            image,
            '","attributes":[{"trait_type":"Campaign","value":"MSX Guided Investing Hub"},{"trait_type":"Network","value":"Sepolia"},{"trait_type":"Badge Type","value":"',
            badgeTypeName,
            '"},{"trait_type":"Status","value":"Unlocked"},{"trait_type":"Token ID","value":"',
            tokenId.toString(),
            '"}]}'
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(metadata)));
    }

    function _badgeTypeName(uint8 badgeType) internal pure returns (string memory) {
        if (badgeType == BADGE_WELCOME) return "welcome";
        if (badgeType == BADGE_WALLET) return "wallet";
        if (badgeType == BADGE_RISK) return "risk";
        if (badgeType == BADGE_QUIZ) return "quiz";
        return "paper";
    }

    function _badgeTitle(uint8 badgeType) internal pure returns (string memory) {
        if (badgeType == BADGE_WELCOME) return "MSX Welcome Badge";
        if (badgeType == BADGE_WALLET) return "MSX Wallet Task Badge";
        if (badgeType == BADGE_RISK) return "MSX Risk Review Badge";
        if (badgeType == BADGE_QUIZ) return "MSX Product Quiz Badge";
        return "MSX Paper Trading Badge";
    }

    function _badgeDescription(uint8 badgeType) internal pure returns (string memory) {
        if (badgeType == BADGE_WELCOME) return "A Sepolia welcome collectible for the MSX Guided Investing Hub onboarding flow.";
        if (badgeType == BADGE_WALLET) return "A wallet-connection collectible for the MSX onboarding flow.";
        if (badgeType == BADGE_RISK) return "A risk-card review collectible for the MSX guided investing flow.";
        if (badgeType == BADGE_QUIZ) return "A product-quiz collectible for the MSX guided investing flow.";
        return "A paper-trading milestone collectible for the MSX guided investing flow.";
    }

    function _badgeKicker(uint8 badgeType) internal pure returns (string memory) {
        if (badgeType == BADGE_WELCOME) return "MSX Welcome Badge";
        if (badgeType == BADGE_WALLET) return "MSX Connect Quest";
        if (badgeType == BADGE_RISK) return "MSX Starter Guide";
        if (badgeType == BADGE_QUIZ) return "MSX Product Quiz";
        return "MSX Simulation Access";
    }

    function _badgeLineOne(uint8 badgeType) internal pure returns (string memory) {
        if (badgeType == BADGE_WELCOME) return "WELCOME BADGE";
        if (badgeType == BADGE_WALLET) return "WALLET TASK";
        if (badgeType == BADGE_RISK) return "RISK TASK";
        if (badgeType == BADGE_QUIZ) return "QUIZ TASK";
        return "PAPER MODE";
    }

    function _badgeLineTwo(uint8 badgeType) internal pure returns (string memory) {
        if (badgeType == BADGE_WELCOME) return "MINTED";
        if (badgeType == BADGE_WALLET) return "MINTED";
        if (badgeType == BADGE_RISK) return "MINTED";
        if (badgeType == BADGE_QUIZ) return "MINTED";
        return "UNLOCKED";
    }

    function _badgeSubtitleOne(uint8 badgeType) internal pure returns (string memory) {
        if (badgeType == BADGE_WELCOME) return "Sepolia collectible for the";
        if (badgeType == BADGE_WALLET) return "Wallet access approved for";
        if (badgeType == BADGE_RISK) return "Risk review completed for";
        if (badgeType == BADGE_QUIZ) return "Ownership and downside";
        return "Practice flow opened after";
    }

    function _badgeSubtitleTwo(uint8 badgeType) internal pure returns (string memory) {
        if (badgeType == BADGE_WELCOME) return "guided onboarding flow";
        if (badgeType == BADGE_WALLET) return "the MSX welcome flow";
        if (badgeType == BADGE_RISK) return "the guided onboarding flow";
        if (badgeType == BADGE_QUIZ) return "framing confirmed";
        return "wallet tutorial completion";
    }

    function _accent(uint8 badgeType) internal pure returns (string memory) {
        if (badgeType == BADGE_RISK) return "#FFD166";
        if (badgeType == BADGE_QUIZ) return "#FF9F6E";
        return "#B6FF43";
    }

    function _accentTwo(uint8 badgeType) internal pure returns (string memory) {
        if (badgeType == BADGE_WALLET || badgeType == BADGE_PAPER) return "#6FA5FF";
        return "#49D6C4";
    }

    function _glow(uint8 badgeType) internal pure returns (string memory) {
        if (badgeType == BADGE_WALLET) return "#6FA5FF";
        if (badgeType == BADGE_RISK) return "#FFD166";
        if (badgeType == BADGE_QUIZ) return "#FF9F6E";
        return "#B6FF43";
    }

    function _buildBadgeSvg(uint8 badgeType) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<svg width="1200" height="1200" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">',
                '<defs><linearGradient id="bg" x1="64" y1="40" x2="1104" y2="1146" gradientUnits="userSpaceOnUse"><stop stop-color="#2A431E"/><stop offset="0.35" stop-color="#0E1722"/><stop offset="1" stop-color="#173A3F"/></linearGradient>',
                '<radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(220 210) rotate(47) scale(360 360)"><stop stop-color="', _glow(badgeType), '" stop-opacity="0.5"/><stop offset="1" stop-color="', _glow(badgeType), '" stop-opacity="0"/></radialGradient>',
                '<linearGradient id="edge" x1="96" y1="96" x2="1104" y2="1104" gradientUnits="userSpaceOnUse"><stop stop-color="', _accent(badgeType), '" stop-opacity="0.28"/><stop offset="1" stop-color="', _accentTwo(badgeType), '" stop-opacity="0.16"/></linearGradient></defs>',
                '<rect width="1200" height="1200" rx="72" fill="#0C1320"/><rect x="52" y="52" width="1096" height="1096" rx="48" fill="url(#bg)" stroke="url(#edge)" stroke-width="2"/>',
                '<circle cx="220" cy="210" r="320" fill="url(#glow)"/>',
                '<g opacity="0.1" stroke="#8EA0B7"><path d="M120 0V1200"/><path d="M240 0V1200"/><path d="M360 0V1200"/><path d="M480 0V1200"/><path d="M600 0V1200"/><path d="M720 0V1200"/><path d="M840 0V1200"/><path d="M960 0V1200"/><path d="M1080 0V1200"/><path d="M0 120H1200"/><path d="M0 240H1200"/><path d="M0 360H1200"/><path d="M0 480H1200"/><path d="M0 600H1200"/><path d="M0 720H1200"/><path d="M0 840H1200"/><path d="M0 960H1200"/><path d="M0 1080H1200"/></g>',
                '<circle cx="122" cy="122" r="16" fill="', _accent(badgeType), '"/><text x="154" y="132" fill="', _accent(badgeType), '" font-size="24" font-weight="800" font-family="Arial, sans-serif" letter-spacing="2">', _badgeKicker(badgeType), '</text>',
                '<text x="110" y="470" fill="#F4F7FB" font-size="68" font-weight="900" font-family="Arial, sans-serif">', _badgeLineOne(badgeType), '</text>',
                '<text x="110" y="548" fill="#F4F7FB" font-size="68" font-weight="900" font-family="Arial, sans-serif">', _badgeLineTwo(badgeType), '</text>',
                '<text x="110" y="654" fill="#9FB0C4" font-size="28" font-weight="500" font-family="Arial, sans-serif">', _badgeSubtitleOne(badgeType), '</text>',
                '<text x="110" y="696" fill="#9FB0C4" font-size="28" font-weight="500" font-family="Arial, sans-serif">', _badgeSubtitleTwo(badgeType), '</text>',
                '<rect x="110" y="846" width="188" height="58" rx="29" fill="rgba(10,18,28,0.62)" stroke="rgba(255,255,255,0.12)"/><text x="142" y="883" fill="#F4F7FB" font-size="22" font-weight="700" font-family="Arial, sans-serif">Sepolia Quest</text>',
                '</svg>'
            )
        );
    }
}
