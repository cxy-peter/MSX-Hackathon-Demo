const API_BASE = import.meta.env.VITE_RISKLENS_API_BASE || '';

function roundNumber(value, digits = 2) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;
  const factor = 10 ** digits;
  return Math.round(numericValue * factor) / factor;
}

function clampNumber(value, min, max) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return min;
  return Math.min(Math.max(numericValue, min), max);
}

function hashRoutePayload(payload = {}) {
  const text = JSON.stringify(payload);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function getTutorialRouteLabel(routeId, focusId) {
  if (routeId === 'perp' && focusId === 'hedge') return 'Protective hedge';
  if (routeId === 'perp' && focusId === 'combo') return 'Portfolio combo';
  if (routeId === 'perp') return 'Leverage / hedge';
  if (routeId === 'borrow' || routeId === 'strategy-ai') return 'Options / strategy';
  if (routeId === 'lending') return 'Earn & yield';
  if (routeId === 'routing') return 'Automation / AI';
  return 'Low-buy / high-sell';
}

function buildLocalTutorialRouteResult(input = {}) {
  const routeId = String(input.routeId || 'spot');
  const focusId = String(input.focusId || '');
  const amount = clampNumber(input.amount, 100, 1000000);
  const entryPrice = Math.max(0.000001, Number(input.entryPrice || input.currentPrice || 100));
  const exitPrice = Math.max(0.000001, Number(input.exitPrice || input.targetPrice || entryPrice));
  const movePct = entryPrice > 0 ? (exitPrice - entryPrice) / entryPrice : 0;
  const hedgeEntryPrice = Math.max(0.000001, Number(input.hedgeEntryPrice || input.hedgePrice || entryPrice));
  const hedgeMovePct = hedgeEntryPrice > 0 ? (exitPrice - hedgeEntryPrice) / hedgeEntryPrice : movePct;
  const holdingDays = clampNumber(input.holdingDays, 1, 365);
  const hedgeHoldingDays = clampNumber(input.hedgeHoldingDays || holdingDays, 1, 365);
  const leverage = clampNumber(input.leverage, 1, 8);
  const hedgeRatio = clampNumber(input.hedgeRatio, 0, 1.25);

  let grossPnl = amount * movePct;
  let drag = amount * 0.0012;
  let netPnl = grossPnl - drag;
  const rows = [];

  if (routeId === 'perp') {
    if (focusId === 'hedge') {
      const hedgeTicketNotional = amount * hedgeRatio;
      const sleevePnl = amount * movePct;
      grossPnl = -hedgeTicketNotional * leverage * hedgeMovePct;
      const funding = hedgeTicketNotional * leverage * clampNumber(hedgeHoldingDays, 0, 90) * 0.00032;
      const executionDrag = hedgeTicketNotional * leverage * 0.0018;
      drag = funding + executionDrag;
      netPnl = sleevePnl + grossPnl - drag;
      rows.push(
        ['Sleeve PnL', `${roundNumber(sleevePnl, 2)} PT`],
        ['Hedge ticket', `${roundNumber(hedgeTicketNotional, 2)} PT`],
        ['Hedge holding days', `${roundNumber(hedgeHoldingDays, 0)}D`]
      );
    } else if (focusId === 'combo') {
      grossPnl = amount * movePct * 0.72 * 0.82;
      drag = amount * 0.0025 - Math.max(0, amount * Math.abs(movePct * 0.72) * 0.08);
      netPnl = grossPnl - drag;
    } else {
      grossPnl = amount * leverage * movePct;
      drag = amount * leverage * clampNumber(holdingDays, 0, 90) * 0.00032 + amount * leverage * 0.0018;
      netPnl = grossPnl - drag;
    }
  } else if (routeId === 'borrow' || routeId === 'strategy-ai') {
    const cappedMove = clampNumber(movePct, -0.055, 0.13);
    grossPnl = amount * cappedMove;
    drag = amount * 0.018;
    netPnl = grossPnl - drag;
  } else if (routeId === 'lending') {
    grossPnl = amount * 0.052 * (holdingDays / 365);
    drag = amount * 0.0015;
    netPnl = grossPnl - drag;
  } else if (routeId === 'routing') {
    grossPnl = amount * movePct * 0.82;
    drag = amount * 0.0025 - Math.max(0, amount * Math.abs(movePct) * 0.08);
    netPnl = grossPnl - drag;
  }

  const rewardPT = roundNumber(Math.max(0, Math.min(5000, netPnl * 0.12 + Math.max(0, movePct) * amount * 0.04)), 2);

  return {
    id: hashRoutePayload({
      routeId,
      focusId,
      amount,
      entryPrice,
      exitPrice,
      holdingDays,
      hedgeEntryPrice,
      hedgeHoldingDays,
      leverage,
      hedgeRatio
    }),
    source: 'local-fallback',
    routeId,
    focusId,
    routeLabel: getTutorialRouteLabel(routeId, focusId),
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
      hedgeMovePct: roundNumber(hedgeMovePct * 100, 3),
      holdingDays,
      hedgeHoldingDays,
      leverage,
      hedgeRatio
    },
    metrics: {
      grossPnl: roundNumber(grossPnl, 2),
      drag: roundNumber(drag, 2),
      netPnl: roundNumber(netPnl, 2),
      returnPct: roundNumber(amount > 0 ? (netPnl / amount) * 100 : 0, 2),
      rewardPT
    },
    rows,
    lesson:
      netPnl >= 0
        ? 'This route adds PT because the simulated move covers drag and risk cost.'
        : 'This route loses PT after drag; use it as a tutorial warning before live action.',
    calculatedAt: new Date().toISOString()
  };
}

function apiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw new Error(`RiskLens API returned a non-JSON response for ${path}`);
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `RiskLens API request failed with ${response.status}`);
  }
  return payload;
}

export async function fetchPaperLeaderboards() {
  return apiRequest('/api/paper-leaderboards');
}

export async function submitPaperLeaderboardEntry({ board, entry, userPointer }) {
  return apiRequest('/api/paper-leaderboards', {
    method: 'POST',
    body: JSON.stringify({
      board,
      entry,
      userPointer
    })
  });
}

export async function calculateTutorialRoute(payload) {
  try {
    const response = await apiRequest('/api/tutorial-routes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (response?.result?.metrics) {
      return {
        ...response,
        result: {
          ...response.result,
          source: 'api'
        }
      };
    }
  } catch {
    // Local Vite serves api/*.js as source text unless a real API base is configured.
  }

  return {
    ok: true,
    source: 'local-fallback',
    result: buildLocalTutorialRouteResult(payload),
    storage: {
      mode: 'local-fallback-calculation',
      userDataPolicy: 'No wallet profile is sent while the RiskLens API is unavailable.'
    }
  };
}

export async function calculateWealthScenario(payload) {
  return apiRequest('/api/wealth-calculations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function storeProfilePointer(pointer) {
  return apiRequest('/api/profile-pointer', {
    method: 'POST',
    body: JSON.stringify(pointer)
  });
}

export function emptyPaperBackendLeaderboards() {
  return {
    replay: { entries: [] },
    strategy: { entries: [] },
    storage: {
      mode: 'local-preview',
      persisted: false,
      userDataPolicy: 'Local-only until the RiskLens API responds.'
    },
    updatedAt: ''
  };
}
