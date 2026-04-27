import { applyCors, clampNumber, hashJson, readRequestJson, roundNumber, sendJson } from './_risklensStorage.js';

const ROUTE_CATALOG = [
  {
    id: 'spot',
    label: 'Low-buy / high-sell',
    description: 'Simple replay route: buy a paper sleeve, compare current and target bars, then settle the difference.'
  },
  {
    id: 'perp',
    label: 'Leverage / hedge',
    description: 'Margin-style tutorial route with leverage, funding drag, liquidation marker, and optional hedge effectiveness.'
  },
  {
    id: 'borrow',
    label: 'Options / strategy',
    description: 'Defined-risk strategy route that caps upside, adds a floor, and shows premium drag.'
  },
  {
    id: 'strategy-ai',
    label: 'AI strategy template',
    description: 'Template scoring route for win-rate, expected return, max drawdown, and explainability.'
  },
  {
    id: 'routing',
    label: 'Automation / AI',
    description: 'Execution-quality route that charges decision, liquidity, and guardrail drag.'
  },
  {
    id: 'lending',
    label: 'Earn & yield',
    description: 'Carry route where PT grows through term yield and loses points to liquidity drag.'
  }
];

function routeLabel(routeId, focusId) {
  if (routeId === 'perp' && focusId === 'hedge') return 'Protective hedge';
  if (routeId === 'perp' && focusId === 'combo') return 'Portfolio combo';
  return ROUTE_CATALOG.find((route) => route.id === routeId)?.label || 'Replay route';
}

function buildSpotRoute({ amount, movePct }) {
  const grossPnl = amount * movePct;
  const fees = amount * 0.0012;
  return {
    grossPnl,
    drag: fees,
    netPnl: grossPnl - fees,
    rows: [
      ['Price move', `${roundNumber(movePct * 100, 2)}%`],
      ['Trading drag', `-${roundNumber(fees, 2)} PT`]
    ]
  };
}

function buildPerpRoute({ amount, movePct, leverage, holdingDays, focusId, hedgeRatio }) {
  const safeLeverage = clampNumber(leverage, 1, 8);
  const grossPnl = amount * safeLeverage * movePct;
  const funding = amount * safeLeverage * clampNumber(holdingDays, 0, 90) * 0.00032;
  const executionDrag = amount * safeLeverage * 0.0018;
  const hedgeEffectiveness = focusId === 'hedge' ? clampNumber(hedgeRatio, 0, 1.25) * 0.68 : 0;
  const hedgeOffset = focusId === 'hedge' ? -amount * movePct * hedgeEffectiveness : 0;
  const netPnl = grossPnl + hedgeOffset - funding - executionDrag;
  const liquidationMove = safeLeverage > 1 ? -1 / safeLeverage + 0.08 : -0.92;

  return {
    grossPnl,
    drag: funding + executionDrag - hedgeOffset,
    netPnl,
    rows: [
      ['Leverage', `${safeLeverage}x`],
      ['Funding drag', `-${roundNumber(funding, 2)} PT`],
      ['Execution drag', `-${roundNumber(executionDrag, 2)} PT`],
      ['Hedge offset', `${roundNumber(hedgeOffset, 2)} PT`],
      ['Liquidation marker', `${roundNumber(liquidationMove * 100, 1)}% move`]
    ]
  };
}

function buildStrategyRoute({ amount, movePct }) {
  const floorPct = -0.055;
  const capPct = 0.13;
  const premiumPct = 0.018;
  const cappedMove = clampNumber(movePct, floorPct, capPct);
  const grossPnl = amount * cappedMove;
  const premium = amount * premiumPct;
  const netPnl = grossPnl - premium;
  return {
    grossPnl,
    drag: premium,
    netPnl,
    rows: [
      ['Floor', `${roundNumber(floorPct * 100, 1)}%`],
      ['Cap', `${roundNumber(capPct * 100, 1)}%`],
      ['Premium drag', `-${roundNumber(premium, 2)} PT`]
    ]
  };
}

function buildCarryRoute({ amount, holdingDays }) {
  const safeDays = clampNumber(holdingDays, 1, 365);
  const carry = amount * 0.052 * (safeDays / 365);
  const liquidityDrag = amount * 0.0015;
  return {
    grossPnl: carry,
    drag: liquidityDrag,
    netPnl: carry - liquidityDrag,
    rows: [
      ['Carry APR', '5.2%'],
      ['Holding days', `${roundNumber(safeDays, 0)}D`],
      ['Liquidity drag', `-${roundNumber(liquidityDrag, 2)} PT`]
    ]
  };
}

function buildAutomationRoute({ amount, movePct }) {
  const grossPnl = amount * movePct * 0.82;
  const guardrailDrag = amount * 0.0025;
  const decisionCredit = Math.max(0, amount * Math.abs(movePct) * 0.08);
  return {
    grossPnl,
    drag: guardrailDrag - decisionCredit,
    netPnl: grossPnl - guardrailDrag + decisionCredit,
    rows: [
      ['AI execution share', '82% of raw move'],
      ['Guardrail drag', `-${roundNumber(guardrailDrag, 2)} PT`],
      ['Decision credit', `+${roundNumber(decisionCredit, 2)} PT`]
    ]
  };
}

function calculateRoute(input = {}) {
  const routeId = String(input.routeId || 'spot');
  const focusId = String(input.focusId || '');
  const amount = clampNumber(input.amount, 100, 1000000);
  const entryPrice = Math.max(0.000001, Number(input.entryPrice || input.currentPrice || 100));
  const exitPrice = Math.max(0.000001, Number(input.exitPrice || input.targetPrice || entryPrice));
  const movePct = entryPrice > 0 ? (exitPrice - entryPrice) / entryPrice : 0;
  const holdingDays = clampNumber(input.holdingDays, 1, 365);
  const leverage = clampNumber(input.leverage, 1, 8);
  const hedgeRatio = clampNumber(input.hedgeRatio, 0, 1.25);

  let model;
  if (routeId === 'perp') {
    model = focusId === 'combo'
      ? buildAutomationRoute({ amount, movePct: movePct * 0.72 })
      : buildPerpRoute({ amount, movePct, leverage, holdingDays, focusId, hedgeRatio });
  } else if (routeId === 'borrow' || routeId === 'strategy-ai') {
    model = buildStrategyRoute({ amount, movePct });
  } else if (routeId === 'lending') {
    model = buildCarryRoute({ amount, holdingDays });
  } else if (routeId === 'routing') {
    model = buildAutomationRoute({ amount, movePct });
  } else {
    model = buildSpotRoute({ amount, movePct });
  }

  const rewardPT = roundNumber(Math.max(0, Math.min(5000, model.netPnl * 0.12 + Math.max(0, movePct) * amount * 0.04)), 2);
  const returnPct = amount > 0 ? (model.netPnl / amount) * 100 : 0;

  return {
    id: hashJson({
      routeId,
      focusId,
      amount,
      entryPrice,
      exitPrice,
      holdingDays,
      leverage,
      hedgeRatio
    }).slice(0, 16),
    routeId,
    focusId,
    routeLabel: routeLabel(routeId, focusId),
    product: {
      id: String(input.product?.id || ''),
      ticker: String(input.product?.ticker || input.product?.name || ''),
      name: String(input.product?.name || '')
    },
    input: {
      amount,
      entryPrice: roundNumber(entryPrice, 6),
      exitPrice: roundNumber(exitPrice, 6),
      movePct: roundNumber(movePct * 100, 3),
      holdingDays,
      leverage,
      hedgeRatio
    },
    metrics: {
      grossPnl: roundNumber(model.grossPnl, 2),
      drag: roundNumber(model.drag, 2),
      netPnl: roundNumber(model.netPnl, 2),
      returnPct: roundNumber(returnPct, 2),
      rewardPT
    },
    rows: model.rows,
    lesson: model.netPnl >= 0
      ? 'This route adds PT because the simulated move covers drag and risk cost.'
      : 'This route loses PT after drag; use it as a tutorial warning before live action.',
    calculatedAt: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        catalog: ROUTE_CATALOG,
        storage: {
          mode: 'stateless-calculation',
          userDataPolicy: 'Route calculations do not require user profile storage.'
        }
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readRequestJson(req);
      sendJson(res, 200, {
        ok: true,
        result: calculateRoute(body),
        storage: {
          mode: 'stateless-calculation',
          userDataPolicy: 'Only the submitted calculation inputs are used; no wallet profile is stored.'
        }
      });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || 'Tutorial route API failed.' });
  }
}
