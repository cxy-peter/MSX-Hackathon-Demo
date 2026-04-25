import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'public', 'replay-data');

function toCsv(bars) {
  return ['ts,open,high,low,close,volume', ...bars.map((bar) => `${bar.ts},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`)].join('\n');
}

function normalizeUnixTimestamp(rawValue) {
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) return NaN;
  if (numericValue > 1e15) return Math.round(numericValue / 1000);
  if (numericValue > 1e12) return numericValue;
  if (numericValue > 1e10) return numericValue;
  return numericValue * 1000;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'msx-risklens-demo'
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'msx-risklens-demo'
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.text();
}

async function downloadYahooDaily(symbol) {
  const payload = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=2y&interval=1d`);
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};

  return timestamps
    .map((timestamp, index) => ({
      ts: new Date(timestamp * 1000).toISOString(),
      open: Number(quote.open?.[index]),
      high: Number(quote.high?.[index]),
      low: Number(quote.low?.[index]),
      close: Number(quote.close?.[index]),
      volume: Number(quote.volume?.[index] || 0)
    }))
    .filter(
      (bar) =>
        Number.isFinite(bar.open) &&
        Number.isFinite(bar.high) &&
        Number.isFinite(bar.low) &&
        Number.isFinite(bar.close)
    );
}

async function downloadCryptoDataDownloadHourly(pair) {
  const text = await fetchText(`https://www.cryptodatadownload.com/cdd/Binance_${pair}_1h.csv`);
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d/.test(line));

  const mappedBars = rows
    .map((row) => {
      const columns = row.split(',');
      return {
        ts: new Date(normalizeUnixTimestamp(columns[0])).toISOString(),
        open: Number(columns[3]),
        high: Number(columns[4]),
        low: Number(columns[5]),
        close: Number(columns[6]),
        volume: Number(columns[8] || columns[7] || 0)
      };
    })
    .filter(
      (bar) =>
        Number.isFinite(bar.open) &&
        Number.isFinite(bar.high) &&
        Number.isFinite(bar.low) &&
        Number.isFinite(bar.close)
    );
  const chronologicalBars = mappedBars.reverse();
  const dedupedBars = [];
  const seen = new Set();

  for (const bar of chronologicalBars) {
    if (seen.has(bar.ts)) continue;
    seen.add(bar.ts);
    dedupedBars.push(bar);
  }

  return dedupedBars.slice(-9600);
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const files = [
    {
      filename: 'AAPL_1d.csv',
      loader: () => downloadYahooDaily('AAPL')
    },
    {
      filename: 'TSLA_1d.csv',
      loader: () => downloadYahooDaily('TSLA')
    },
    {
      filename: 'BTCUSDT_1h.csv',
      loader: () => downloadCryptoDataDownloadHourly('BTCUSDT')
    },
    {
      filename: 'ETHUSDT_1h.csv',
      loader: () => downloadCryptoDataDownloadHourly('ETHUSDT')
    }
  ];

  for (const file of files) {
    const bars = await file.loader();
    const fullPath = path.join(outputDir, file.filename);
    await writeFile(fullPath, `${toCsv(bars)}\n`, 'utf8');
    console.log(`Saved ${file.filename} (${bars.length} rows)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
