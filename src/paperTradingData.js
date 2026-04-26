import { PAPER_INTERVALS, getRangeConfig } from './paperTradingConfig';

const TWELVE_DATA_API_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY || '';
const APP_BASE_URL = String(import.meta.env.BASE_URL || '/');

function aggregateBars(rawBars, targetIntervalMs) {
  if (!rawBars.length) return [];

  const buckets = [];

  rawBars.forEach((bar) => {
    const timestamp = new Date(bar.ts).getTime();
    const bucketStart = Math.floor(timestamp / targetIntervalMs) * targetIntervalMs;
    const activeBucket = buckets[buckets.length - 1];

    if (!activeBucket || activeBucket.bucketStart !== bucketStart) {
      buckets.push({
        bucketStart,
        ts: new Date(bucketStart).toISOString(),
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume || 0)
      });
      return;
    }

    activeBucket.high = Math.max(activeBucket.high, Number(bar.high));
    activeBucket.low = Math.min(activeBucket.low, Number(bar.low));
    activeBucket.close = Number(bar.close);
    activeBucket.volume += Number(bar.volume || 0);
  });

  return buckets.map(({ bucketStart, ...bar }) => bar);
}

function normalizeBars(rawBars) {
  return rawBars
    .map((bar) => ({
      ts: bar.ts,
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      volume: Number(bar.volume || 0)
    }))
    .filter(
      (bar) =>
        Number.isFinite(bar.open) &&
        Number.isFinite(bar.high) &&
        Number.isFinite(bar.low) &&
        Number.isFinite(bar.close)
    )
    .sort((left, right) => new Date(left.ts).getTime() - new Date(right.ts).getTime());
}

function parseBundledCsv(text) {
  const sanitizedText = String(text || '')
    .replace(/^\uFEFF/, '')
    .trim();
  const [headerLine, ...rows] = sanitizedText.split(/\r?\n/);
  const headers = headerLine.split(',').map((value) => value.trim());
  const expectedHeaders = ['ts', 'open', 'high', 'low', 'close', 'volume'];

  if (expectedHeaders.some((header, index) => headers[index] !== header)) {
    throw new Error('Bundled replay CSV format is invalid.');
  }

  return normalizeBars(
    rows
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => {
        const [ts, open, high, low, close, volume] = row.split(',');
        return { ts, open, high, low, close, volume };
      })
  );
}

function buildReplayCsvCandidates(csvPath) {
  const normalizedPath = String(csvPath || '').trim();
  if (!normalizedPath) return [];
  if (/^https?:\/\//i.test(normalizedPath)) return [normalizedPath];

  const relativePath = normalizedPath.replace(/^\/+/, '');
  const candidates = new Set();
  const normalizedBase = APP_BASE_URL.endsWith('/') ? APP_BASE_URL : `${APP_BASE_URL}/`;

  candidates.add(normalizedPath);
  candidates.add(`./${relativePath}`);
  candidates.add(`${normalizedBase}${relativePath}`);

  if (typeof window !== 'undefined' && window.location) {
    try {
      candidates.add(new URL(relativePath, window.location.href).toString());
    } catch {}

    try {
      candidates.add(new URL(relativePath, `${window.location.origin}${normalizedBase}`).toString());
    } catch {}
  }

  return [...candidates];
}

function scaleBars(bars, factor) {
  return bars.map((bar) => ({
    ...bar,
    open: Number(bar.open) * factor,
    high: Number(bar.high) * factor,
    low: Number(bar.low) * factor,
    close: Number(bar.close) * factor
  }));
}

async function syncReplayBarsWithPublicQuote(product, bars) {
  if (!product.quoteSyncUrl || !bars.length) {
    return {
      bars,
      sourceLabel: product.sourceLabel
    };
  }

  try {
    const response = await fetch(product.quoteSyncUrl, {
      headers: {
        'cache-control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Public quote request failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const quote = Number(payload.quote ?? payload.price ?? payload.currentPrice);
    const latestClose = Number(bars[bars.length - 1]?.close);

    if (!Number.isFinite(quote) || quote <= 0 || !Number.isFinite(latestClose) || latestClose <= 0) {
      throw new Error('Public quote payload was missing a usable price.');
    }

    const scaleFactor = quote / latestClose;

    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
      throw new Error('Public quote scale factor was invalid.');
    }

    return {
      bars: scaleBars(bars, scaleFactor),
      sourceLabel: product.quoteSyncLabel
        ? `${product.quoteSyncLabel} + ${product.sourceLabel}`
        : product.sourceLabel
    };
  } catch {
    return {
      bars,
      sourceLabel: product.sourceLabel
    };
  }
}

async function fetchBundledReplayBars(product, intervalId, rangeId) {
  const csvCandidates = buildReplayCsvCandidates(product.csvPath);
  let response = null;
  let lastError = null;

  for (const csvUrl of csvCandidates) {
    try {
      const nextResponse = await fetch(csvUrl, {
        headers: {
          'cache-control': 'no-cache'
        }
      });

      if (!nextResponse.ok) {
        lastError = new Error(`Bundled replay CSV failed with status ${nextResponse.status} at ${csvUrl}.`);
        continue;
      }

      response = nextResponse;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`Bundled replay CSV request failed at ${csvUrl}.`);
    }
  }

  if (!response) {
    throw lastError || new Error('Bundled replay CSV request failed.');
  }

  const baseBars = parseBundledCsv(await response.text());
  const targetInterval = PAPER_INTERVALS[intervalId];
  const baseInterval = PAPER_INTERVALS[product.csvInterval || intervalId];
  const range = getRangeConfig(intervalId, rangeId);
  const replayBars =
    baseInterval && targetInterval && baseInterval.ms < targetInterval.ms
      ? aggregateBars(baseBars, targetInterval.ms)
      : baseBars;
  const syncedReplay = await syncReplayBarsWithPublicQuote(product, replayBars);
  const bars = syncedReplay.bars.slice(-range.bars);

  if (!bars.length) {
    throw new Error('Bundled replay CSV returned no bars for this window.');
  }

  return {
    bars,
    sourceLabel: syncedReplay.sourceLabel
  };
}

async function fetchCoinbaseCandles(product, intervalId, rangeId) {
  const interval = PAPER_INTERVALS[intervalId];
  const range = getRangeConfig(intervalId, rangeId);
  const now = Math.floor(Date.now() / 1000);
  const start = now - range.bars * Math.floor(interval.ms / 1000);
  const url = new URL(`https://api.coinbase.com/api/v3/brokerage/market/products/${product.remoteSymbol}/candles`);

  url.searchParams.set('start', String(start));
  url.searchParams.set('end', String(now));
  url.searchParams.set('granularity', interval.coinbaseGranularity);

  const response = await fetch(url.toString(), {
    headers: {
      'cache-control': 'no-cache'
    }
  });

  if (!response.ok) {
    throw new Error(`Coinbase candles request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const bars = normalizeBars(
    (payload.candles || []).map((candle) => ({
      ts: new Date(Number(candle.start) * 1000).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    }))
  );

  if (!bars.length) {
    throw new Error('Coinbase returned no candles for this replay window.');
  }

  return {
    bars,
    sourceLabel: 'Coinbase public candles'
  };
}

async function fetchTwelveDataCandles(product, rangeId) {
  if (!TWELVE_DATA_API_KEY) {
    throw new Error('Add VITE_TWELVE_DATA_API_KEY to load free daily equity candles.');
  }

  const range = getRangeConfig('1D', rangeId);
  const url = new URL('https://api.twelvedata.com/time_series');

  url.searchParams.set('symbol', product.remoteSymbol);
  url.searchParams.set('interval', '1day');
  url.searchParams.set('outputsize', String(range.bars));
  url.searchParams.set('apikey', TWELVE_DATA_API_KEY);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Twelve Data request failed with status ${response.status}.`);
  }

  const payload = await response.json();

  if (payload.status !== 'ok' || !Array.isArray(payload.values)) {
    throw new Error(payload.message || 'Twelve Data did not return a valid daily series.');
  }

  const bars = normalizeBars(
    payload.values.map((value) => ({
      ts: new Date(`${value.datetime}T12:00:00Z`).toISOString(),
      open: value.open,
      high: value.high,
      low: value.low,
      close: value.close,
      volume: value.volume
    }))
  );

  if (!bars.length) {
    throw new Error('Twelve Data returned no equity candles for this replay window.');
  }

  return {
    bars,
    sourceLabel: 'Twelve Data free daily candles'
  };
}

export async function fetchRemoteReplayBars(product, intervalId, rangeId) {
  if (product.csvPath) {
    try {
      return await fetchBundledReplayBars(product, intervalId, rangeId);
    } catch (error) {
      if (product.sourceType === 'local') {
        throw error;
      }
    }
  }

  if (product.sourceType === 'coinbase') {
    return fetchCoinbaseCandles(product, intervalId, rangeId);
  }

  if (product.sourceType === 'twelvedata') {
    return fetchTwelveDataCandles(product, rangeId);
  }

  throw new Error('This product uses a local replay series only.');
}

export function canUseRemoteReplay(product) {
  if (product.csvPath) return true;
  if (product.sourceType === 'coinbase') return true;
  if (product.sourceType === 'twelvedata') return Boolean(TWELVE_DATA_API_KEY);
  return false;
}

export function getReplayFallbackLabel(product) {
  if (product.sourceType === 'local') {
    return 'Local RiskLens replay series';
  }

  if (product.sourceType === 'twelvedata') {
    return TWELVE_DATA_API_KEY
      ? 'Local fallback while bundled or refreshed equity candles load'
      : 'Local equity mirror sample';
  }

  return 'Local crypto fallback sample';
}

export function getRemoteUpgradeCopy(product) {
  if (product.csvPath && product.sourceType === 'twelvedata') {
    return TWELVE_DATA_API_KEY
      ? 'Bundled proxy history is primary. Twelve Data can refresh the underlying equity path when needed.'
      : 'Bundled proxy history is primary. Add VITE_TWELVE_DATA_API_KEY if you want a refresh path.';
  }

  if (product.csvPath && product.sourceType === 'coinbase') {
    return 'Bundled Binance hourly CSV is primary. Coinbase public candles remain the API fallback.';
  }

  if (product.sourceType === 'twelvedata' && !TWELVE_DATA_API_KEY) {
    return 'Add VITE_TWELVE_DATA_API_KEY to replace this stock replay sample with free daily equity candles.';
  }

  if (product.sourceType === 'coinbase') {
    return 'Crypto replay uses Coinbase public candles when the request succeeds.';
  }

  return 'This product currently uses a repo-local replay series by design.';
}
