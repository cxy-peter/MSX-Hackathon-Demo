const DEFAULT_CURRENT_PRICE = 78819.91;

function sendJson(res, status, payload) {
  res.status(status).json({
    ok: status >= 200 && status < 300,
    ...payload
  });
}

function toNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
}

function calculateNormalProduct(body = {}) {
  const principal = Math.max(0, toNumber(body.amount, 0));
  const entryNav = Math.max(0.01, toNumber(body.entryNav, 100));
  const exitNav = Math.max(0.01, toNumber(body.exitNav, entryNav * 1.012));
  const feeBps = Math.max(0, toNumber(body.feeBps, 12));
  const pledgeBonusBps = Math.max(0, toNumber(body.pledgeBonusBps, 0));
  const shares = principal / entryNav;
  const grossValue = shares * exitNav;
  const fee = grossValue * feeBps / 10000;
  const pledgeBonus = principal * pledgeBonusBps / 10000;
  const settleValue = grossValue - fee + pledgeBonus;
  const pnl = settleValue - principal;

  return {
    mode: 'normal-product',
    principal: round(principal),
    shares: round(shares, 6),
    entryNav: round(entryNav, 4),
    exitNav: round(exitNav, 4),
    fee: round(fee),
    pledgeBonus: round(pledgeBonus),
    settleValue: round(settleValue),
    pnl: round(pnl),
    profitable: pnl > 0,
    receipt: {
      productType: body.productType || 'Wealth receipt',
      maturity: body.maturity || 'Product-specific',
      burnable: shares > 0
    }
  };
}

function calculateDualInvestment(body = {}) {
  const amount = Math.max(0, toNumber(body.amount, 0));
  const currentPrice = Math.max(0.01, toNumber(body.currentPrice, DEFAULT_CURRENT_PRICE));
  const targetPrice = Math.max(0.01, toNumber(body.targetPrice, currentPrice * 1.005));
  const apr = Math.max(0, toNumber(body.apr, 120));
  const days = Math.max(1, Math.round(toNumber(body.days, 1)));
  const direction = String(body.direction || 'sell-high');
  const settlePrice = Math.max(0.01, toNumber(body.settlePrice, currentPrice));
  const premium = amount * apr / 100 * days / 365;
  const moneyness = direction === 'buy-low'
    ? (targetPrice - settlePrice) / targetPrice
    : (settlePrice - targetPrice) / targetPrice;
  const conversionDrag = Math.max(0, -moneyness) * amount * 0.25;
  const favorableBonus = Math.max(0, moneyness) * amount * 0.08;
  const takeHome = amount + premium + favorableBonus - conversionDrag;
  const pnl = takeHome - amount;

  return {
    mode: 'dual-investment',
    pair: body.pair || 'BTC/USDC',
    direction,
    amount: round(amount),
    currentPrice: round(currentPrice, 8),
    targetPrice: round(targetPrice, 2),
    settlePrice: round(settlePrice, 2),
    apr: round(apr, 2),
    days,
    premium: round(premium),
    conversionDrag: round(conversionDrag),
    takeHome: round(takeHome),
    pnl: round(pnl),
    profitable: pnl > 0,
    receipt: {
      productType: 'Dual Investment',
      maturity: body.maturity || `${days} day demo cycle`,
      burnable: amount > 0
    }
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.RISKLENS_API_ALLOW_ORIGIN || '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Use POST for Wealth calculations.' });
    return;
  }

  const body = req.body || {};
  const mode = String(body.mode || 'normal-product');
  const result = mode === 'dual-investment'
    ? calculateDualInvestment(body)
    : calculateNormalProduct(body);

  sendJson(res, 200, {
    result,
    storage: {
      mode: 'serverless-calculation',
      persisted: false,
      note: 'Deterministic calculation endpoint; wallet/user writes stay in profile or on-chain evidence flows.'
    },
    calculatedAt: new Date().toISOString()
  });
}
