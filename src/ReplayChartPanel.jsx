import React from 'react';

import PaperTradingChart from './PaperTradingChart';
import { PAPER_INTERVALS } from './paperTradingConfig';

const MemoizedPaperTradingChart = React.memo(PaperTradingChart, (prev, next) => {
  return (
    prev.bars === next.bars &&
    prev.currentIndex === next.currentIndex &&
    prev.replayStarted === next.replayStarted &&
    prev.intervalId === next.intervalId &&
    prev.hoveredIndex === next.hoveredIndex &&
    prev.onSelectIndex === next.onSelectIndex &&
    prev.onHoverIndexChange === next.onHoverIndexChange
  );
});

function getRiskClass(risk) {
  return risk === 'Low' ? 'risk-low' : risk === 'Medium' ? 'risk-medium' : 'risk-high';
}

export default function ReplayChartPanel({
  selectedProductId,
  selectedProduct,
  selectedProductDisclosureRows = [],
  selectedView,
  selectedRangeOptions = [],
  selectedMarketCapValue,
  replayFocus,
  hoveredReplayIndex,
  onChangeInterval,
  onChangeRange,
  onSelectReplayIndex,
  onHoverReplayIndexChange,
  hoverDebugEnabled = false,
  chartHoverDiagnosticRows = [],
  renderReplayDeskCompact
}) {
  if (!selectedProduct) return null;

  const intervalOptions = Array.isArray(selectedProduct.intervalOptions) ? selectedProduct.intervalOptions : [];
  const structureTags = Array.isArray(selectedProduct.structureTags) ? selectedProduct.structureTags : [];

  return (
    <section className="card paper-chart-card">
      <div className="section-head">
        <div className="paper-chart-head-main">
          <div key={`chart-${selectedProductId}`}>
            <div className="eyebrow">Replay chart</div>
            <h2>{selectedProduct.name}</h2>
          </div>
          <div className="paper-chart-market-meta">
            <div className="paper-chart-market-label">{selectedProduct.productType}</div>
            {structureTags.length ? (
              <div className="paper-product-tag-row paper-product-tag-row-chart">
                {structureTags.map((tag) => (
                  <span key={tag} className="paper-product-tag">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="paper-product-disclosure-row">
              {selectedProductDisclosureRows.map((row) => (
                <div key={row.label} className="paper-product-disclosure-chip">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
            <div className="paper-chart-market-stats">
              <div className="paper-chart-market-stat">
                <span>Open</span>
                <strong>{replayFocus?.openLabel}</strong>
              </div>
              <div className="paper-chart-market-stat">
                <span>Volume</span>
                <strong>{replayFocus?.volumeLabel}</strong>
              </div>
              <div className="paper-chart-market-stat">
                <span>Market cap</span>
                <strong>{selectedMarketCapValue}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="paper-chart-head-actions">
          <span className={`pill ${getRiskClass(selectedProduct.risk)}`}>{selectedProduct.risk} risk</span>
        </div>
      </div>

      <div className="paper-chart-timescale-row">
        <div className="paper-chart-timescale-group paper-chart-timescale-group-start">
          <div className="paper-chart-timescale-name">{selectedProduct.ticker || selectedProduct.name}</div>
          {intervalOptions.map((intervalId) => (
            <button
              key={intervalId}
              className={`ghost-btn compact ${selectedView?.interval === intervalId ? 'active-toggle' : ''}`}
              onClick={() => onChangeInterval(intervalId)}
            >
              {PAPER_INTERVALS[intervalId]?.label || intervalId}
            </button>
          ))}
        </div>

        <div className="paper-chart-timescale-group paper-chart-timescale-group-end">
          {selectedRangeOptions.map((range) => (
            <button
              key={range.id}
              className={`ghost-btn compact ${selectedView?.range === range.id ? 'active-toggle' : ''}`}
              onClick={() => onChangeRange(range.id)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <MemoizedPaperTradingChart
        key={selectedProductId}
        bars={selectedView?.bars || []}
        currentIndex={selectedView?.cursor || 0}
        replayStarted={Boolean(selectedView?.replayStarted)}
        intervalId={selectedView?.interval || selectedProduct.defaultInterval}
        onSelectIndex={onSelectReplayIndex}
        hoveredIndex={hoveredReplayIndex}
        onHoverIndexChange={onHoverReplayIndexChange}
      />

      {hoverDebugEnabled ? (
        <div className="env-hint" style={{ marginTop: 12 }}>
          <strong>Hover debug.</strong> {chartHoverDiagnosticRows.map(([label, value]) => `${label}: ${value}`).join(' / ')}
        </div>
      ) : null}

      {typeof renderReplayDeskCompact === 'function' ? renderReplayDeskCompact() : null}
    </section>
  );
}
