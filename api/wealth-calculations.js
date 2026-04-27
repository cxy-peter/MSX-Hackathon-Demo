import {
  applyCors,
  clampNumber,
  getHttpErrorStatus,
  readRequestJson,
  roundNumber,
  sendJson
} from './_risklensStorage.js';

const DEFAULT_CURRENT_PRICE = 78819.91;
const MAX_DEMO_AMOUNT = 1000000;

const CALCULATION_MODES = [
  {
    mode: 'normal-product',
    label: 'Receipt NAV settlement',
    description: 'Models a PT receipt buy / settle path with NAV movement, fees, and optional pledge bonus.'
  },
  {
    mode: 'dual-investment',
    label: 'Dual investment term premium',
    description: 'Models a PT-only target-price settlement path as a short-term premium, not stable APY.'
  }
];

function cleanText(value, fallback = '', maxLength = 120) {
  return String(value || fallback || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function toNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function clampAmount(value) {
  return clampNumber(value, 0, MAX_DEMO_AMOUNT);
}

function normalizeAnnualPremiumPct(value, fallback = 120) {
  const rawRate = toNumber(value, fallback);
  const percentRate = rawRate > 0 && rawRate <= 3 ? rawRate * 100 : rawRate;
  return clampNumber(percentRate, 0, 500);
}

function calculateNormalProduct(body = {}) {
  const principal = clampAmount(body.amount);
  const entryNav = Math.max(0.01, toNumber(body.entryNav, 100));
  const exitNav = Math.max(0.01, toNumber(body.exitNav, entryNav * 1.012));
  const feeBps = clampNumber(body.feeBps, 0, 1000);
  const pledgeBonusBps = clampNumber(body.pledgeBonusBps, 0, 5000);
  const shares = principal / entryNav;
  const grossValue = shares * exitNav;
  const fee = grossValue * feeBps / 10000;
  const pledgeBonus = principal * pledgeBonusBps / 10000;
  const settleValue = grossValue - fee + pledgeBonus;
  const pnl = settleValue - principal;

  return {
    mode: 'normal-product',
    principal: roundNumber(principal),
    shares: roundNumber(shares, 6),
    entryNav: roundNumber(entryNav, 4),
    exitNav: roundNumber(exitNav, 4),
    feeBps: roundNumber(feeBps, 2),
    pledgeBonusBps: roundNumber(pledgeBonusBps, 2),
    fee: roundNumber(fee),
    pledgeBonus: roundNumber(pledgeBonus),
    settleValue: roundNumber(settleValue),
    pnl: roundNumber(pnl),
    profitable: pnl > 0,
    receipt: {
      productType: cleanText(body.productType, 'Wealth receipt', 80),
      maturity: cleanText(body.maturity, 'Product-specific', 80),
      burnable: shares > 0
    }
  };
}

function calculateDualInvestment(body = {}) {
  const amount = clampAmount(body.amount);
  const currentPrice = Math.max(0.01, toNumber(body.currentPrice, DEFAULT_CURRENT_PRICE));
  const targetPrice = Math.max(0.01, toNumber(body.targetPrice, currentPrice * 1.005));
  const annualPremiumPct = normalizeAnnualPremiumPct(body.annualPremiumPct ?? body.apr ?? body.annualPremiumRate, 120);
  const days = clampNumber(Math.round(toNumber(body.days, body.termDays || 1)), 1, 365);
  const direction = body.direction === 'buy-low' ? 'buy-low' : 'sell-high';
  const settlePrice = Math.max(0.01, toNumber(body.settlePrice, currentPrice));
  const termPremiumRate = (annualPremiumPct / 100) * (days / 365);
  const premium = amount * termPremiumRate;
  const moneyness = direction === 'buy-low'
    ? (targetPrice - settlePrice) / targetPrice
    : (settlePrice - targetPrice) / targetPrice;
  const conversionDrag = Math.max(0, -moneyness) * amount * 0.25;
  const favorableBonus = Math.max(0, moneyness) * amount * 0.08;
  const takeHome = amount + premium + favorableBonus - conversionDrag;
  const pnl = takeHome - amount;

  return {
    mode: 'dual-investment',
    pair: cleanText(body.pair, 'BTC/USDC', 32),
    direction,
    amount: roundNumber(amount),
    currentPrice: roundNumber(currentPrice, 8),
    targetPrice: roundNumber(targetPrice, 2),
    settlePrice: roundNumber(settlePrice, 2),
    annualPremiumPct: roundNumber(annualPremiumPct, 2),
    apr: roundNumber(annualPremiumPct, 2),
    days,
    termPremiumRatePct: roundNumber(termPremiumRate * 100, 4),
    premium: roundNumber(premium),
    conversionDrag: roundNumber(conversionDrag),
    favorableBonus: roundNumber(favorableBonus),
    takeHome: roundNumber(takeHome),
    pnl: roundNumber(pnl),
    profitable: pnl > 0,
    receipt: {
      productType: 'Dual Investment',
      maturity: cleanText(body.maturity, `${days} day demo cycle`, 80),
      burnable: amount > 0
    }
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        modes: CALCULATION_MODES,
        storage: {
          mode: 'stateless-calculation',
          persisted: false,
          userDataPolicy: 'Wealth calculations use submitted inputs only; wallet profiles and receipt state stay in client, pointer, or on-chain flows.'
        }
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readRequestJson(req, { maxBytes: 64 * 1024 });
      const mode = body.mode === 'dual-investment' ? 'dual-investment' : 'normal-product';
      const result = mode === 'dual-investment'
        ? calculateDualInvestment(body)
        : calculateNormalProduct(body);

      sendJson(res, 200, {
        ok: true,
        result,
        storage: {
          mode: 'stateless-calculation',
          persisted: false,
          userDataPolicy: 'Deterministic calculation endpoint; wallet/user writes stay in decentralized pointer or on-chain evidence flows.'
        },
        calculatedAt: new Date().toISOString()
      });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  } catch (error) {
    const statusCode = getHttpErrorStatus(error);
    sendJson(res, statusCode, { ok: false, error: error.message || 'Wealth calculation API failed.' });
  }
}
