import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'public', 'replay-data');

const TARGETS = [
  {
    name: 'Superstate USTB',
    url: 'https://superstate.com/ustb',
    file: 'USTB_1d.csv'
  },
  {
    name: 'Superstate USCC',
    url: 'https://superstate.com/uscc',
    file: 'USCC_1d.csv'
  }
];

function parseUsDate(value) {
  const [month, day, year] = value.split('/').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
}

function extractNavRows(html) {
  const rows = [];
  const seen = new Set();
  const matcher = /net_asset_value_date:"([^"]+)",net_asset_value:"([^"]+)"/g;

  for (const match of html.matchAll(matcher)) {
    const ts = parseUsDate(match[1]);
    if (seen.has(ts)) continue;
    seen.add(ts);

    const close = Number(match[2]);
    if (!Number.isFinite(close)) continue;

    rows.push({
      ts,
      open: close,
      high: close,
      low: close,
      close,
      volume: 0
    });
  }

  return rows.sort((left, right) => new Date(left.ts).getTime() - new Date(right.ts).getTime());
}

function toCsv(rows) {
  const header = 'ts,open,high,low,close,volume';
  const body = rows.map((row) => `${row.ts},${row.open},${row.high},${row.low},${row.close},${row.volume}`);
  return [header, ...body].join('\n');
}

async function downloadTarget(target) {
  const response = await fetch(target.url, {
    headers: {
      'user-agent': 'msx-risklens-demo/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${target.name}: ${response.status}`);
  }

  const html = await response.text();
  const rows = extractNavRows(html);

  if (!rows.length) {
    throw new Error(`No NAV rows found for ${target.name}.`);
  }

  const outputPath = path.join(outputDir, target.file);
  await writeFile(outputPath, toCsv(rows), 'utf8');

  const first = rows[0];
  const last = rows[rows.length - 1];
  console.log(`${target.name}: ${rows.length} rows (${first.ts} -> ${last.ts})`);
}

await mkdir(outputDir, { recursive: true });

for (const target of TARGETS) {
  await downloadTarget(target);
}
