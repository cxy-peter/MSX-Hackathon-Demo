export const WALLET_NICKNAME_MAX_LENGTH = 24;

export function normalizeWalletNickname(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, WALLET_NICKNAME_MAX_LENGTH);
}

export function getWalletNicknameKey(address) {
  return address ? `msx-wallet-nickname-${address.toLowerCase()}` : '';
}

export function readWalletNickname(address) {
  const key = getWalletNicknameKey(address);
  if (typeof window === 'undefined' || !window.localStorage || !key) return '';

  try {
    return normalizeWalletNickname(window.localStorage.getItem(key) || '');
  } catch {
    return '';
  }
}

export function writeWalletNickname(address, nickname) {
  const key = getWalletNicknameKey(address);
  if (typeof window === 'undefined' || !window.localStorage || !key) return '';

  const normalized = normalizeWalletNickname(nickname);

  if (normalized) {
    window.localStorage.setItem(key, normalized);
  } else {
    window.localStorage.removeItem(key);
  }

  return normalized;
}

export function getWalletDisplayName(address, nickname, fallbackFormatter) {
  if (!address) return fallbackFormatter ? fallbackFormatter(address) : 'Not connected';
  const normalized = normalizeWalletNickname(nickname);
  return normalized || (fallbackFormatter ? fallbackFormatter(address) : address);
}
