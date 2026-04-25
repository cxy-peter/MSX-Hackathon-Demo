function encodeBase64(value) {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(unescape(encodeURIComponent(value)));
  }

  return Buffer.from(value, 'utf8').toString('base64');
}

const badgeThemes = {
  welcome: {
    kicker: 'MSX Welcome Badge',
    title: ['WELCOME BADGE', 'MINTED'],
    subtitle: ['Sepolia collectible for the', 'guided onboarding flow'],
    accent: '#2F8F4E',
    accent2: '#49D6C4',
    glow: '#2F8F4E'
  },
  connect: {
    kicker: 'MSX Connect Quest',
    title: ['CONNECT', 'SUCCESS'],
    subtitle: ['Wallet access approved for', 'the MSX welcome flow'],
    accent: '#2F8F4E',
    accent2: '#6FA5FF',
    glow: '#6FA5FF'
  },
  guide: {
    kicker: 'MSX Starter Guide',
    title: ['GUIDE PATH', 'CLEARED'],
    subtitle: ['Beginner route confirmed before', 'paper-mode unlock'],
    accent: '#FFD166',
    accent2: '#49D6C4',
    glow: '#FFD166'
  },
  quiz: {
    kicker: 'MSX Product Quiz',
    title: ['QUIZ TASK', 'PASSED'],
    subtitle: ['Ownership and downside framing', 'confirmed for this wallet'],
    accent: '#FF9F6E',
    accent2: '#49D6C4',
    glow: '#FF9F6E'
  },
  paper: {
    kicker: 'MSX Simulation Access',
    title: ['PAPER MODE', 'UNLOCKED'],
    subtitle: ['Practice flow opened after', '3 onboarding boxes'],
    accent: '#49D6C4',
    accent2: '#6FA5FF',
    glow: '#49D6C4'
  }
};

function buildBadgeSvg(theme) {
  return `
<svg width="1200" height="1200" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="64" y1="40" x2="1104" y2="1146" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2A431E"/>
      <stop offset="0.35" stop-color="#0E1722"/>
      <stop offset="1" stop-color="#173A3F"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(220 210) rotate(47) scale(360 360)">
      <stop stop-color="${theme.glow}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${theme.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="edge" x1="96" y1="96" x2="1104" y2="1104" gradientUnits="userSpaceOnUse">
      <stop stop-color="${theme.accent}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${theme.accent2}" stop-opacity="0.16"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="1200" rx="72" fill="#0C1320"/>
  <rect x="52" y="52" width="1096" height="1096" rx="48" fill="url(#bg)" stroke="url(#edge)" stroke-width="2"/>
  <circle cx="220" cy="210" r="320" fill="url(#glow)"/>

  <g opacity="0.1" stroke="#8EA0B7">
    <path d="M120 0V1200"/>
    <path d="M240 0V1200"/>
    <path d="M360 0V1200"/>
    <path d="M480 0V1200"/>
    <path d="M600 0V1200"/>
    <path d="M720 0V1200"/>
    <path d="M840 0V1200"/>
    <path d="M960 0V1200"/>
    <path d="M1080 0V1200"/>
    <path d="M0 120H1200"/>
    <path d="M0 240H1200"/>
    <path d="M0 360H1200"/>
    <path d="M0 480H1200"/>
    <path d="M0 600H1200"/>
    <path d="M0 720H1200"/>
    <path d="M0 840H1200"/>
    <path d="M0 960H1200"/>
    <path d="M0 1080H1200"/>
  </g>

  <circle cx="122" cy="122" r="16" fill="${theme.accent}"/>
  <text x="154" y="132" fill="${theme.accent}" font-size="24" font-weight="800" font-family="Arial, sans-serif" letter-spacing="2">
    ${theme.kicker}
  </text>

  <text x="110" y="470" fill="#F4F7FB" font-size="68" font-weight="900" font-family="Arial, sans-serif">
    ${theme.title[0]}
  </text>
  <text x="110" y="548" fill="#F4F7FB" font-size="68" font-weight="900" font-family="Arial, sans-serif">
    ${theme.title[1]}
  </text>

  <text x="110" y="654" fill="#9FB0C4" font-size="28" font-weight="500" font-family="Arial, sans-serif">
    ${theme.subtitle[0]}
  </text>
  <text x="110" y="696" fill="#9FB0C4" font-size="28" font-weight="500" font-family="Arial, sans-serif">
    ${theme.subtitle[1]}
  </text>

  <rect x="110" y="846" width="188" height="58" rx="29" fill="rgba(10,18,28,0.62)" stroke="rgba(255,255,255,0.12)"/>
  <text x="142" y="883" fill="#F4F7FB" font-size="22" font-weight="700" font-family="Arial, sans-serif">
    Sepolia Quest
  </text>

  <rect x="956" y="116" width="104" height="104" rx="20" fill="rgba(9,15,24,0.48)" stroke="rgba(255,255,255,0.1)"/>
  <circle cx="1008" cy="168" r="27" fill="${theme.accent}" fill-opacity="0.22"/>
  <path d="M988 168L1008 148L1032 172L1012 192L988 168Z" fill="${theme.accent}" />
  <path d="M1006 150L1026 130L1050 154L1030 174L1006 150Z" fill="${theme.accent2}" fill-opacity="0.86" />
  <path d="M990 186L1010 166L1034 190L1014 210L990 186Z" fill="#F4F7FB" fill-opacity="0.82" />
</svg>
`.trim();
}

function buildImageUri(themeKey) {
  const svg = buildBadgeSvg(badgeThemes[themeKey]);
  return `data:image/svg+xml;base64,${encodeBase64(svg)}`;
}

function buildMetadataUri(themeKey, name, description) {
  const image = buildImageUri(themeKey);
  const metadata = {
    name,
    description,
    image,
    external_url: 'https://github.com/',
    attributes: [
      { trait_type: 'Campaign', value: 'MSX Guided Investing Hub' },
      { trait_type: 'Network', value: 'Sepolia' },
      { trait_type: 'Badge Type', value: themeKey },
      { trait_type: 'Status', value: 'Unlocked' }
    ]
  };

  return `data:application/json;base64,${encodeBase64(JSON.stringify(metadata))}`;
}

export const taskBadgeAssets = {
  connect: {
    imageUri: buildImageUri('connect')
  },
  mint: {
    imageUri: buildImageUri('welcome')
  },
  guide: {
    imageUri: buildImageUri('guide')
  },
  quiz: {
    imageUri: buildImageUri('quiz')
  },
  paper: {
    imageUri: buildImageUri('paper')
  }
};

export const taskBadgeMetadataUris = {
  welcome: buildMetadataUri(
    'welcome',
    'MSX Welcome Badge',
    'A Sepolia welcome collectible for the MSX Guided Investing Hub onboarding flow.'
  ),
  wallet: buildMetadataUri(
    'connect',
    'MSX Wallet Task Badge',
    'A wallet-connection task collectible for the MSX onboarding flow.'
  ),
  risk: buildMetadataUri(
    'guide',
    'MSX Risk Review Badge',
    'A risk-card review collectible for the MSX guided investing flow.'
  ),
  quiz: buildMetadataUri(
    'quiz',
    'MSX Product Quiz Badge',
    'A product-quiz collectible for the MSX guided investing flow.'
  ),
  paper: buildMetadataUri(
    'paper',
    'MSX Paper Trading Badge',
    'A paper-trading milestone collectible for the MSX guided investing flow.'
  )
};

export const welcomeBadgeImageUri = taskBadgeAssets.mint.imageUri;
export const welcomeBadgeMetadataUri = taskBadgeMetadataUris.welcome;
