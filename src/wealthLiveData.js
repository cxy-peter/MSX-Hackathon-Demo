const DAY_MS = 24 * 60 * 60 * 1000;

const NAV_PERIOD_SIZES = {
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '6m': 180
};

const CSV_CACHE = new Map();

const LIVE_PRODUCT_CONFIG = {
  'superstate-ustb': {
    mode: 'csv',
    path: '/replay-data/USTB_1d.csv',
    sourceLabel: 'Superstate official public NAV history (90D download)'
  },
  'ondo-usdy': {
    mode: 'yield',
    anchorDate: '2025-01-15T00:00:00.000Z',
    sourceLabel: 'Official Ondo docs + modeled NAV proxy',
    seasonalMultiplier: 3.2,
    shockMultiplier: 1.6,
    floorMultiplier: 0.985
  },
  'franklin-fobxx': {
    mode: 'yield',
    anchorDate: '2024-04-06T00:00:00.000Z',
    sourceLabel: 'Franklin official fund facts + modeled stable-NAV proxy',
    seasonalMultiplier: 0.15,
    shockMultiplier: 0.08,
    floorMultiplier: 0.999
  },
  'ondo-ousg': {
    mode: 'yield',
    anchorDate: '2024-05-01T00:00:00.000Z',
    sourceLabel: 'Official Ondo docs + modeled treasury NAV proxy',
    seasonalMultiplier: 2.4,
    shockMultiplier: 1.1,
    floorMultiplier: 0.988
  },
  'hashnote-usyc': {
    mode: 'yield',
    anchorDate: '2024-02-01T00:00:00.000Z',
    sourceLabel: 'Hashnote official docs + modeled treasury-repo NAV proxy',
    seasonalMultiplier: 2.1,
    shockMultiplier: 0.9,
    floorMultiplier: 0.989
  },
  'openeden-tbill': {
    mode: 'yield',
    anchorDate: '2023-05-26T00:00:00.000Z',
    sourceLabel: 'OpenEden official docs + modeled treasury NAV proxy',
    seasonalMultiplier: 2.2,
    shockMultiplier: 1,
    floorMultiplier: 0.988
  },
  'blackrock-buidl': {
    mode: 'yield',
    anchorDate: '2024-03-13T00:00:00.000Z',
    sourceLabel: 'Securitize / BlackRock official facts + modeled liquidity-fund NAV proxy',
    seasonalMultiplier: 0.2,
    shockMultiplier: 0.08,
    floorMultiplier: 0.998
  },
  'superstate-uscc': {
    mode: 'csv',
    path: '/replay-data/USCC_1d.csv',
    sourceLabel: 'Superstate official public NAV history (90D download)'
  },
  'hamilton-scope': {
    mode: 'blend',
    sourceLabel: 'Official product facts + blended public NAV proxy',
    components: [
      { path: '/replay-data/USTB_1d.csv', weight: 0.72, interval: '1d' },
      { path: '/replay-data/USCC_1d.csv', weight: 0.28, interval: '1d' }
    ]
  },
  'apollo-acred': {
    mode: 'blend',
    sourceLabel: 'Official product facts + blended public NAV proxy',
    components: [
      { path: '/replay-data/USTB_1d.csv', weight: 0.62, interval: '1d' },
      { path: '/replay-data/USCC_1d.csv', weight: 0.38, interval: '1d' }
    ]
  },
  'msx-quant-fund-1': {
    mode: 'blend',
    sourceLabel: 'RiskLens public listing + blended public strategy proxy',
    components: [
      { path: '/replay-data/USCC_1d.csv', weight: 0.7, interval: '1d' },
      { path: '/replay-data/BTCUSDT_1h.csv', weight: 0.3, interval: '1h' }
    ]
  },
  'msx-quant-fund-2': {
    mode: 'blend',
    sourceLabel: 'RiskLens public listing + blended public strategy proxy',
    components: [
      { path: '/replay-data/USCC_1d.csv', weight: 0.45, interval: '1d' },
      { path: '/replay-data/BTCUSDT_1h.csv', weight: 0.35, interval: '1h' },
      { path: '/replay-data/ETHUSDT_1h.csv', weight: 0.2, interval: '1h' }
    ]
  }
};

function roundNumber(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function normalizeRows(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map((value) => value.trim());

  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const columns = line.split(',');
      const row = Object.fromEntries(headers.map((header, index) => [header, columns[index]]));
      return {
        ts: row.ts,
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume || 0)
      };
    })
    .filter((row) => Number.isFinite(row.close))
    .sort((left, right) => new Date(left.ts).getTime() - new Date(right.ts).getTime());
}

async function fetchCsvRows(path) {
  if (!CSV_CACHE.has(path)) {
    CSV_CACHE.set(
      path,
      fetch(path, {
        headers: {
          'cache-control': 'no-cache'
        }
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${path} (${response.status}).`);
        }

        return normalizeRows(await response.text());
      })
    );
  }

  return CSV_CACHE.get(path);
}

function toDateKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function collapseHourlyToDaily(rows) {
  const buckets = new Map();

  rows.forEach((row) => {
    const key = toDateKey(row.ts);
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, {
        ts: `${key}T00:00:00.000Z`,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume
      });
      return;
    }

    existing.high = Math.max(existing.high, row.high);
    existing.low = Math.min(existing.low, row.low);
    existing.close = row.close;
    existing.volume += row.volume;
  });

  return [...buckets.values()].sort((left, right) => new Date(left.ts).getTime() - new Date(right.ts).getTime());
}

function buildYieldSeries(product, profile) {
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);

  const pointCount = 210;
  const dailyRate = product.dailyYieldRate * (profile.rateMultiplier || 1);
  const seasonalMultiplier = profile.seasonalMultiplier ?? 2.8;
  const shockMultiplier = profile.shockMultiplier ?? 1.2;
  const floorMultiplier = profile.floorMultiplier ?? 0.985;
  const rawLevels = [];
  let level = 1;

  for (let index = 0; index < pointCount; index += 1) {
    const phase = index + 1;
    const seasonal = Math.sin(phase / 13) * dailyRate * seasonalMultiplier;
    const shock = Math.cos(phase / 21) * dailyRate * shockMultiplier;
    const increment = Math.max(dailyRate * 0.35, dailyRate + seasonal + shock);
    level *= 1 + increment;
    rawLevels.push(level);
  }

  const scale = product.nav / rawLevels[rawLevels.length - 1];

  return rawLevels.map((rawLevel, index) => {
    const dayOffset = pointCount - index - 1;
    const day = new Date(endDate.getTime() - dayOffset * DAY_MS);
    const close = Math.max(product.nav * floorMultiplier, rawLevel * scale);

    return {
      ts: day.toISOString(),
      close: roundNumber(close, 4)
    };
  });
}

function intersectSeries(seriesList) {
  if (!seriesList.length) return [];

  const maps = seriesList.map((rows) => new Map(rows.map((row) => [toDateKey(row.ts), row.close])));
  const keys = [...maps[0].keys()].filter((key) => maps.every((map) => map.has(key)));

  return keys
    .sort()
    .map((key) => ({
      ts: `${key}T00:00:00.000Z`,
      close: roundNumber(
        seriesList.reduce((sum, rows, index) => {
          const weight = rows.weight || 0;
          const firstValue = maps[index].get(keys[0]);
          const value = maps[index].get(key);
          return sum + (firstValue ? (value / firstValue) * weight : weight);
        }, 0),
        6
      )
    }));
}

async function buildBlendSeries(product, profile) {
  const loaded = await Promise.all(
    profile.components.map(async (component) => {
      const rawRows = await fetchCsvRows(component.path);
      const normalizedRows = component.interval === '1h' ? collapseHourlyToDaily(rawRows) : rawRows;
      return Object.assign(normalizedRows, { weight: component.weight });
    })
  );

  const intersected = intersectSeries(loaded);
  if (!intersected.length) {
    throw new Error(`No blended proxy rows are available for ${product.name}.`);
  }

  return intersected.map((row) => ({
    ts: row.ts,
    close: roundNumber(product.nav * row.close, 3)
  }));
}

async function buildCsvSeries(profile) {
  return fetchCsvRows(profile.path);
}

function sliceSeries(series, count) {
  const actualCount = Math.min(series.length, count);
  return series.slice(-actualCount).map((row) => ({
    ts: row.ts,
    value: row.close
  }));
}

function formatAsOf(timestamp) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

async function buildLiveProduct(product) {
  const profile = LIVE_PRODUCT_CONFIG[product.id];
  if (!profile) {
    return {
      ...product,
      asOfLabel: 'Static demo snapshot',
      marketSource: 'Static demo snapshot'
    };
  }

  const dailySeries =
    profile.mode === 'yield'
      ? buildYieldSeries(product, profile)
      : profile.mode === 'blend'
      ? await buildBlendSeries(product, profile)
      : await buildCsvSeries(profile);
  const latest = dailySeries[dailySeries.length - 1];

  return {
    ...product,
    nav: roundNumber(latest.close, 3),
    navHistory: Object.fromEntries(
      Object.entries(NAV_PERIOD_SIZES).map(([periodId, size]) => [periodId, sliceSeries(dailySeries, size)])
    ),
    asOfLabel: `As of ${formatAsOf(latest.ts)}`,
    marketSource: profile.sourceLabel || 'Bundled market proxy snapshot'
  };
}

export async function buildLiveWealthProducts(baseProducts) {
  return Promise.all(baseProducts.map((product) => buildLiveProduct(product)));
}
