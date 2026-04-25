import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';

import PaperTradingChart from './PaperTradingChart';
import '../styles.css';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundNumber(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function formatPrice(value) {
  if (!Number.isFinite(Number(value))) return '--';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  });
}

function formatNotional(value) {
  if (!Number.isFinite(Number(value))) return '--';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatSigned(value) {
  if (!Number.isFinite(Number(value))) return '--';
  const numeric = Number(value);
  return `${numeric >= 0 ? '+' : ''}${formatNotional(numeric)}`;
}

function formatReplayDate(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '--';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function buildDemoBars() {
  const start = new Date('2025-09-01T00:00:00.000Z').getTime();
  let lastClose = 1.0025;

  return Array.from({ length: 48 }, (_, index) => {
    const wave = Math.sin(index / 4.6) * 0.0034;
    const drift = index * 0.00022;
    const noise = ((index % 5) - 2) * 0.00018;
    const open = roundNumber(lastClose, 4);
    const close = roundNumber(1.0012 + drift + wave + noise, 4);
    const high = roundNumber(Math.max(open, close) + 0.0016 + (index % 3) * 0.0002, 4);
    const low = roundNumber(Math.min(open, close) - 0.0013 - (index % 2) * 0.00015, 4);
    const volume = 130000 + index * 2900 + (index % 4) * 4800;
    lastClose = close;

    return {
      ts: new Date(start + index * 24 * 60 * 60 * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume
    };
  });
}

function buildStatCard(label, value, note, tone = '') {
  return (
    <div className="guide-chip" style={{ minHeight: 116 }}>
      <div className="k">{label}</div>
      <div className={`v ${tone}`.trim()}>{value}</div>
      <div className="muted">{note}</div>
    </div>
  );
}

function ChartHoverDemoApp() {
  const bars = useMemo(() => buildDemoBars(), []);
  const [lockedIndex, setLockedIndex] = useState(Math.max(0, bars.length - 10));
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [diagnosticMode, setDiagnosticMode] = useState('focus');

  const lockedBar = bars[clamp(lockedIndex, 0, bars.length - 1)];
  const hoveredBar =
    hoveredIndex == null ? null : bars[clamp(hoveredIndex, 0, bars.length - 1)] || null;
  const focusBar = hoveredBar || lockedBar;
  const displayBar = diagnosticMode === 'locked' ? lockedBar : focusBar;
  const displayIndex = diagnosticMode === 'locked' ? lockedIndex : hoveredBar ? hoveredIndex : lockedIndex;

  const positionUnits = 2600;
  const avgEntry = 1.0082;
  const displayValue = roundNumber(positionUnits * Number(displayBar?.close || 0), 2);
  const displayPnl = roundNumber((Number(displayBar?.close || 0) - avgEntry) * positionUnits, 2);
  const lockedValue = roundNumber(positionUnits * Number(lockedBar?.close || 0), 2);
  const lockedPnl = roundNumber((Number(lockedBar?.close || 0) - avgEntry) * positionUnits, 2);
  const focusValue = roundNumber(positionUnits * Number(focusBar?.close || 0), 2);
  const focusPnl = roundNumber((Number(focusBar?.close || 0) - avgEntry) * positionUnits, 2);

  return (
    <div className="app-shell paper-trading-shell">
      <div className="noise" />
      <main style={{ display: 'grid', gap: 20 }}>
        <section className="card">
          <div className="section-head">
            <div>
              <div className="eyebrow">Chart Hover Diagnostic</div>
              <h1 style={{ marginBottom: 6 }}>Isolated hover-to-stats demo</h1>
              <div className="hero-text" style={{ maxWidth: 960 }}>
                This page uses the same <code>PaperTradingChart</code> component, but removes replay routes, wallet state,
                desk gating, and task logic. Hover the white dot and watch whether the external date and PnL cards move.
              </div>
            </div>
            <span className={`pill ${hoveredBar ? 'risk-low' : 'risk-medium'}`}>
              {hoveredBar ? 'Hover active' : 'Locked bar only'}
            </span>
          </div>

          <div className="paper-chip-row" style={{ marginTop: 12, marginBottom: 12 }}>
            <div className="paper-chip-group">
              <button
                className={`ghost-btn compact ${diagnosticMode === 'focus' ? 'active-toggle' : ''}`}
                onClick={() => setDiagnosticMode('focus')}
              >
                Correct mode: focus bar
              </button>
              <button
                className={`ghost-btn compact ${diagnosticMode === 'locked' ? 'active-toggle' : ''}`}
                onClick={() => setDiagnosticMode('locked')}
              >
                Broken mode: locked only
              </button>
            </div>

            <div className="paper-chip-group paper-chip-group-metrics">
              <div className="paper-inline-quote-chip">
                <span>Locked index</span>
                <strong>{lockedIndex}</strong>
              </div>
              <div className="paper-inline-quote-chip">
                <span>Hovered index</span>
                <strong>{hoveredIndex == null ? '--' : hoveredIndex}</strong>
              </div>
              <div className="paper-inline-quote-chip">
                <span>Display index</span>
                <strong>{displayIndex}</strong>
              </div>
            </div>
          </div>

          <PaperTradingChart
            bars={bars}
            currentIndex={lockedIndex}
            replayStarted
            onSelectIndex={setLockedIndex}
            onHoverIndexChange={setHoveredIndex}
            hoveredIndex={hoveredIndex}
            intervalId="1D"
          />

          <div className="paper-chart-stat-grid" style={{ marginTop: 18 }}>
            {buildStatCard(
              'External date',
              formatReplayDate(displayBar?.ts),
              diagnosticMode === 'focus'
                ? 'Should move with hover. Click to re-lock the anchor.'
                : 'Broken control group: stays on the locked bar.'
            )}
            {buildStatCard(
              'External close',
              formatPrice(displayBar?.close),
              diagnosticMode === 'focus'
                ? 'This should match the white-dot bar.'
                : 'This intentionally ignores hover.'
            )}
            {buildStatCard('Open', formatPrice(displayBar?.open), 'Outside the chart, bound to the current display bar.')}
            {buildStatCard(
              'Volume',
              Number(displayBar?.volume || 0).toLocaleString('en-US'),
              'Outside the chart, bound to the current display bar.'
            )}
            {buildStatCard('Position value', `${formatNotional(displayValue)} PT`, `${positionUnits.toLocaleString()} units x display close.`)}
            {buildStatCard(
              'Unrealized PnL',
              `${formatSigned(displayPnl)} PT`,
              `Average entry ${formatPrice(avgEntry)}.`,
              displayPnl >= 0 ? 'risk-low' : 'risk-high'
            )}
          </div>
        </section>

        <section className="grid-2 split-top">
          <section className="card">
            <div className="section-head">
              <div>
                <div className="eyebrow">Locked Anchor</div>
                <h2>Clicking the chart updates this bar</h2>
              </div>
            </div>
            <div className="paper-chart-stat-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {buildStatCard('Locked date', formatReplayDate(lockedBar?.ts), 'Replay cursor / anchor bar.')}
              {buildStatCard('Locked close', formatPrice(lockedBar?.close), 'This should only change on click or step.')}
              {buildStatCard(
                'Locked PnL',
                `${formatSigned(lockedPnl)} PT`,
                `${formatNotional(lockedValue)} PT marked value.`,
                lockedPnl >= 0 ? 'risk-low' : 'risk-high'
              )}
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <div className="eyebrow">Focus Preview</div>
                <h2>Hovering the chart updates this bar</h2>
              </div>
            </div>
            <div className="paper-chart-stat-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {buildStatCard('Focus date', formatReplayDate(focusBar?.ts), hoveredBar ? 'Currently driven by hover.' : 'Falls back to the locked bar.')}
              {buildStatCard('Focus close', formatPrice(focusBar?.close), hoveredBar ? 'Matches the white-dot bar.' : 'No hover yet.')}
              {buildStatCard(
                'Focus PnL',
                `${formatSigned(focusPnl)} PT`,
                `${formatNotional(focusValue)} PT marked value.`,
                focusPnl >= 0 ? 'risk-low' : 'risk-high'
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ChartHoverDemoApp />);
