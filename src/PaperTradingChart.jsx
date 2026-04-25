import React, { useEffect, useId, useMemo } from 'react';

function formatAxisLabel(value) {
  if (!Number.isFinite(value)) return '--';
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 10) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatAxisDateLabel(timestamp, barCount, intervalId) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '--';

  if (intervalId === '1D' || barCount > 120) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: barCount > 80 ? undefined : 'numeric'
  });
}

function formatFocusDateLabel(timestamp, barCount, intervalId) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '--';

  if (intervalId === '1D') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: barCount > 80 ? undefined : '2-digit'
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function PaperTradingChart({
  bars,
  currentIndex,
  replayStarted = false,
  onSelectIndex,
  onHoverIndexChange,
  hoveredIndex = null,
  intervalId = '1D'
}) {
  const chartId = useId().replace(/:/g, '');

  useEffect(() => {
    onHoverIndexChange?.(null);
  }, [bars, currentIndex, onHoverIndexChange, replayStarted]);

  const chartState = useMemo(() => {
    if (!bars.length) return null;

    const width = 1200;
    const height = 500;
    const padding = { top: 14, right: 82, bottom: 54, left: 8 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const low = Math.min(...bars.map((bar) => bar.low));
    const high = Math.max(...bars.map((bar) => bar.high));
    const span = Math.max(0.0001, high - low);
    const safeIndex = clamp(currentIndex, 0, bars.length - 1);
    const step = bars.length > 1 ? plotWidth / (bars.length - 1) : plotWidth;
    const candleWidth = clamp(step * 0.62, 4.2, 16);

    function yFor(price) {
      return padding.top + ((high - price) / span) * plotHeight;
    }

    const points = bars.map((bar, index) => {
      const ratio = bars.length === 1 ? 0 : index / (bars.length - 1);
      return {
        x: padding.left + ratio * plotWidth,
        y: yFor(bar.close)
      };
    });

    const revealedPoints = points.slice(0, safeIndex + 1);
    const areaPath =
      replayStarted && revealedPoints.length > 1
        ? [
            `M ${revealedPoints[0].x} ${padding.top + plotHeight}`,
            ...revealedPoints.map((point) => `L ${point.x} ${point.y}`),
            `L ${revealedPoints[revealedPoints.length - 1].x} ${padding.top + plotHeight}`,
            'Z'
          ].join(' ')
        : '';

    return {
      width,
      height,
      padding,
      plotWidth,
      plotHeight,
      low,
      high,
      span,
      yFor,
      points,
      areaPath,
      safeIndex,
      candleWidth
    };
  }, [bars, currentIndex, replayStarted]);

  if (!chartState) {
    return <div className="paper-chart-empty">No replay bars available yet.</div>;
  }

  const {
    width,
    height,
    padding,
    plotWidth,
    plotHeight,
    low,
    span,
    yFor,
    points,
    areaPath,
    safeIndex,
    candleWidth
  } = chartState;
  const tickValues = Array.from({ length: 5 }, (_, index) => low + (span * index) / 4);
  const labelIndexes = [0, Math.floor((bars.length - 1) / 3), Math.floor(((bars.length - 1) * 2) / 3), Math.max(0, bars.length - 1)];
  const activeIndex = hoveredIndex == null ? safeIndex : clamp(hoveredIndex, 0, bars.length - 1);
  const activeBar = bars[activeIndex];
  const activePoint = points[activeIndex];
  const activeDateLabel = formatFocusDateLabel(activeBar.ts, bars.length, intervalId);
  const tooltipWidth = 320;
  const tooltipHeight = 128;
  const tooltipX = clamp(activePoint.x + 16, padding.left + 8, width - padding.right - tooltipWidth);
  const tooltipY = activePoint.y < padding.top + 88 ? activePoint.y + 16 : activePoint.y - tooltipHeight - 12;
  const xLabelWidth = 244;
  const xLabelX = clamp(activePoint.x - xLabelWidth / 2, padding.left, padding.left + plotWidth - xLabelWidth);

  function resolveIndexFromEvent(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return 0;

    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const plotLeft = padding.left;
    const plotRight = padding.left + plotWidth;
    const clampedX = clamp(svgX, plotLeft, plotRight);
    const ratio = plotWidth === 0 ? 0 : (clampedX - plotLeft) / plotWidth;
    return clamp(Math.round(ratio * Math.max(1, bars.length - 1)), 0, bars.length - 1);
  }

  function handlePointerMove(event) {
    const nextHoverIndex = resolveIndexFromEvent(event);
    if (nextHoverIndex !== hoveredIndex) {
      onHoverIndexChange?.(nextHoverIndex);
    }
  }

  function handlePointerLeave() {
    if (hoveredIndex != null) {
      onHoverIndexChange?.(null);
    }
  }

  function handleChartClick(event) {
    onSelectIndex?.(resolveIndexFromEvent(event));
  }

  return (
    <div className="paper-chart-frame">
      <svg
        className={`paper-chart-svg ${replayStarted ? 'replay-mode' : 'overview-mode'}`}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Paper trading replay chart"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleChartClick}
      >
        <defs>
          <linearGradient id={`${chartId}-replay-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(34, 109, 64, 0.18)" />
            <stop offset="100%" stopColor="rgba(34, 109, 64, 0.03)" />
          </linearGradient>
        </defs>

        {tickValues.map((tickValue) => {
          const y = yFor(tickValue);
          return (
            <g key={tickValue}>
              <line x1={padding.left} x2={padding.left + plotWidth} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" />
              <text x={padding.left + plotWidth + 12} y={y + 7} fill="rgba(156,171,190,0.92)" fontSize="17.5">
                {formatAxisLabel(tickValue)}
              </text>
            </g>
          );
        })}

        {replayStarted && areaPath ? <path d={areaPath} fill={`url(#${chartId}-replay-area)`} /> : null}

        {!replayStarted
          ? bars.map((bar, index) => {
              const point = points[index];
              const rising = bar.close >= bar.open;
              const bodyTop = yFor(Math.max(bar.open, bar.close));
              const bodyBottom = yFor(Math.min(bar.open, bar.close));
              const bodyHeight = Math.max(2.2, Math.abs(bodyBottom - bodyTop));
              const color = rising ? '#ef6f86' : '#4f8cff';

              return (
                <g key={`${bar.ts}-candle`}>
                  <line
                    x1={point.x}
                    x2={point.x}
                    y1={yFor(bar.high)}
                    y2={yFor(bar.low)}
                    stroke={color}
                    strokeWidth="1.5"
                    opacity="0.98"
                  />
                  <rect
                    x={point.x - candleWidth / 2}
                    y={Math.min(bodyTop, bodyBottom)}
                    width={candleWidth}
                    height={bodyHeight}
                    rx="2.4"
                    fill={color}
                    opacity="0.98"
                  />
                </g>
              );
            })
          : points.slice(0, -1).map((point, index) => {
              const nextPoint = points[index + 1];
              const rising = bars[index + 1].close >= bars[index].close;
              const isRevealed = index + 1 <= safeIndex;

              return (
                <line
                  key={`${bars[index].ts}-${bars[index + 1].ts}`}
                  x1={point.x}
                  y1={point.y}
                  x2={nextPoint.x}
                  y2={nextPoint.y}
                  stroke={rising ? '#ef6f86' : '#4f8cff'}
                  strokeWidth={isRevealed ? 3.2 : 2.4}
                  strokeLinecap="round"
                  opacity={isRevealed ? 1 : 0.2}
                />
              );
            })}

        {points.map((point, index) => {
          const isCurrent = index === safeIndex;
          const isActive = index === activeIndex;
          const fill = isActive ? '#f3f6fd' : replayStarted && index > safeIndex ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.54)';

          return <circle key={`${bars[index].ts}-dot`} cx={point.x} cy={point.y} r={isActive ? 4.4 : isCurrent ? 3 : 1.8} fill={fill} />;
        })}

        <line
          x1={activePoint.x}
          x2={activePoint.x}
          y1={padding.top}
          y2={padding.top + plotHeight}
          stroke="rgba(243,246,253,0.52)"
          strokeDasharray="6 6"
        />
        <line
          x1={padding.left}
          x2={padding.left + plotWidth}
          y1={activePoint.y}
          y2={activePoint.y}
          stroke="rgba(243,246,253,0.34)"
          strokeDasharray="6 6"
        />

        <g transform={`translate(${padding.left + plotWidth + 10}, ${activePoint.y - 16})`}>
          <rect width="104" height="38" rx="19" fill="rgba(11,17,28,0.96)" stroke="rgba(34,109,64,0.18)" />
          <text x="52" y="25" fill="#f3f6fd" fontSize="18.5" fontWeight="700" textAnchor="middle">
            {formatAxisLabel(activeBar.close)}
          </text>
        </g>

        <g transform={`translate(${xLabelX}, ${padding.top + plotHeight + 12})`}>
          <rect width={xLabelWidth} height="38" rx="19" fill="rgba(11,17,28,0.96)" stroke="rgba(34,109,64,0.18)" />
          <text x={xLabelWidth / 2} y="24.5" fill="#f3f6fd" fontSize="17" fontWeight="700" textAnchor="middle">
            {activeDateLabel}
          </text>
        </g>

        <g transform={`translate(${tooltipX}, ${tooltipY})`}>
          <rect width={tooltipWidth} height={tooltipHeight} rx="16" fill="rgba(10,16,27,0.97)" stroke="rgba(34,109,64,0.22)" />
          <text x="20" y="34" fill="#f3f6fd" fontSize="18.5" fontWeight="700">
            {activeDateLabel}
          </text>
          <text x="20" y="64" fill="rgba(156,171,190,0.92)" fontSize="15.5">
            Open {formatAxisLabel(activeBar.open)} / Close {formatAxisLabel(activeBar.close)}
          </text>
          <text x="20" y="90" fill="rgba(156,171,190,0.92)" fontSize="15.5">
            High {formatAxisLabel(activeBar.high)} / Low {formatAxisLabel(activeBar.low)}
          </text>
          <text x="20" y="116" fill="rgba(156,171,190,0.92)" fontSize="15.5">
            Vol {Number(activeBar.volume || 0).toLocaleString()}
          </text>
        </g>

        {labelIndexes.map((barIndex, labelIndex) => {
          const point = points[barIndex];
          const anchor = barIndex === 0 ? 'start' : barIndex === bars.length - 1 ? 'end' : 'middle';

          return (
            <text
              key={`${bars[barIndex]?.ts}-${labelIndex}`}
              x={point.x}
              y={height - 12}
              fill="rgba(156,171,190,0.92)"
              fontSize="16"
              textAnchor={anchor}
            >
              {formatAxisDateLabel(bars[barIndex].ts, bars.length, intervalId)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
