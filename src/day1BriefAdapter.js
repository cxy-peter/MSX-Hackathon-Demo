import { buildDiligenceReport } from './diligence/report';

const DAY1_REMOTE_URL = 'https://brief.day1global.xyz/api/market-data';
const DAY1_FALLBACK_PATH = '/day1-brief-snapshot.json';

export const DILIGENCE_DIMENSIONS = [
  {
    id: 'underlying',
    title: 'Underlying quality',
    weight: 15,
    labels: ['Underlying asset pack', 'Underlying proof', 'Reserve trail']
  },
  {
    id: 'structure',
    title: 'Structure clarity',
    weight: 15,
    labels: ['Settlement rule', 'Strategy explainability', 'Suitability screen', 'Payoff logic']
  },
  {
    id: 'pricing',
    title: 'Pricing / NAV transparency',
    weight: 12,
    labels: ['Pricing transparency', 'Pricing logic', 'NAV transparency', 'Oracle']
  },
  {
    id: 'liquidity',
    title: 'Liquidity / redemption',
    weight: 14,
    labels: ['Liquidity stress']
  },
  {
    id: 'rights',
    title: 'Rights / custody',
    weight: 12,
    labels: ['Custody evidence', 'Share rights', 'Token rights']
  },
  {
    id: 'eligibility',
    title: 'Eligibility / compliance',
    weight: 10,
    labels: ['Eligibility rule']
  },
  {
    id: 'counterparty',
    title: 'Counterparty / issuer',
    weight: 8,
    labels: ['Issuer', 'Counterparty', 'Manager']
  },
  {
    id: 'security',
    title: 'Onchain / security',
    weight: 8,
    labels: ['Contract security', 'Audit', 'Admin permission']
  },
  {
    id: 'feesTax',
    title: 'Fee / tax drag clarity',
    weight: 4,
    labels: ['Fee clarity', 'Fee drag', 'Tax']
  },
  {
    id: 'operations',
    title: 'Operational resilience',
    weight: 2,
    labels: ['Operations', 'Monitoring', 'Automation']
  }
];

const STATUS_MULTIPLIER = {
  Pass: 1,
  Review: 0.75,
  Watch: 0.55,
  Fail: 0.25
};

const BUCKET_BASELINE = {
  starter: 8,
  fixed: 3,
  strategy: 4,
  structured: 0
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

function findDimension(check, index) {
  const matched = DILIGENCE_DIMENSIONS.find((dimension) => dimension.labels.includes(check?.label));
  return matched || DILIGENCE_DIMENSIONS[index] || DILIGENCE_DIMENSIONS[DILIGENCE_DIMENSIONS.length - 1];
}

function compactList(items, limit = 3) {
  return [...new Set(items.filter(Boolean))].slice(0, limit);
}

function buildMacroLens(snapshot) {
  if (!snapshot) {
    return {
      label: 'Macro liquidity proxy',
      value: 'Waiting for external snapshot',
      impact: 0,
      detail: 'Macro overlay has not loaded yet, so the research view stays anchored to the product rubric.',
      watchLine: 'Reload the market snapshot before changing the macro stance.',
      improveLine: 'A current VIX and DXY snapshot would tighten the market read.',
      tone: 'neutral'
    };
  }

  const vix = Number(snapshot?.indices?.vix?.price);
  const dxy = Number(snapshot?.indices?.dxy?.price);

  if (!Number.isFinite(vix) || !Number.isFinite(dxy)) {
    return {
      label: 'Macro liquidity proxy',
      value: 'Partial snapshot only',
      impact: 0,
      detail: 'The macro feed is missing enough fields that the product rubric should dominate the current view.',
      watchLine: 'Refresh the market overlay once the missing index fields are available.',
      improveLine: 'A fresh VIX and DXY pair would restore the full macro overlay.',
      tone: 'neutral'
    };
  }

  if (vix >= 24 || dxy >= 101) {
    return {
      label: 'Macro liquidity proxy',
      value: 'Liquidity tightening',
      impact: -2,
      detail: `VIX ${vix.toFixed(2)} and DXY ${dxy.toFixed(2)} point to a tighter backdrop, so even conservative sleeves need clearer sizing and redemption language.`,
      watchLine: 'If volatility stays above 24 or the dollar stays above 101, the stance should stay more defensive.',
      improveLine: 'A move back toward VIX below 20 and DXY closer to 100 would reopen a cleaner entry window.',
      tone: 'negative'
    };
  }

  if (vix >= 19.5 || dxy >= 100) {
    return {
      label: 'Macro liquidity proxy',
      value: 'Guarded liquidity',
      impact: -1,
      detail: `VIX ${vix.toFixed(2)} and DXY ${dxy.toFixed(2)} are not stressed, but they are elevated enough to keep the wealth view selective rather than fully risk-on.`,
      watchLine: 'A volatility spike above 24 would quickly push this shelf into review-first territory.',
      improveLine: 'If volatility cools back below 18, the same product quality would support a firmer stance.',
      tone: 'caution'
    };
  }

  return {
    label: 'Macro liquidity proxy',
    value: 'Supportive liquidity',
    impact: 1,
    detail: `VIX ${vix.toFixed(2)} and DXY ${dxy.toFixed(2)} keep the macro backdrop orderly enough that product quality can lead the decision.`,
    watchLine: 'The stance would weaken if volatility breaks back above the low-20s.',
    improveLine: 'Keeping volatility subdued helps the research view stay constructive.',
    tone: 'positive'
  };
}

function buildAssetLens(product, snapshot) {
  if (!snapshot) {
    return {
      label: 'Asset-specific overlay',
      value: 'No asset overlay yet',
      impact: 0,
      detail: 'The asset-specific lens is waiting on the external snapshot.',
      watchLine: 'Refresh the market overlay before leaning on the asset-specific stance.',
      improveLine: 'A fresh sentiment and funding snapshot would complete the product view.',
      tone: 'neutral'
    };
  }

  const cnnFearGreed = Number(snapshot?.sentiment?.cnnFearGreed);
  const cryptoFearGreed = Number(snapshot?.sentiment?.cryptoFearGreed);
  const fundingRate = Number(snapshot?.btcMetrics?.fundingRate);
  const etfFlowUsd = Number(snapshot?.btcMetrics?.etfFlowUsd);

  if (['starter', 'fixed'].includes(product.bucket)) {
    if (Number.isFinite(cnnFearGreed) && (cnnFearGreed >= 78 || cnnFearGreed <= 25)) {
      return {
        label: 'US sentiment proxy',
        value: 'Risk appetite stretched',
        impact: -1,
        detail:
          'Treasury and yield sleeves still work here, but the page should frame them as ballast instead of letting users chase a headline APY into an emotional tape.',
        watchLine: 'An extreme fear or greed reading makes suitability and liquidity wording more important.',
        improveLine: 'A move back toward the middle of the sentiment band would support a calmer onboarding flow.',
        tone: 'caution'
      };
    }

    return {
      label: 'US sentiment proxy',
      value: 'Cash-yield backdrop stable',
      impact: 1,
      detail:
        'The broad risk-appetite feed is calm enough that the decision can stay centered on access rules, reserve mechanics, and take-home yield instead of macro noise.',
      watchLine: 'If the sentiment feed swings to an extreme, the stance should become more selective.',
      improveLine: 'Keeping sentiment in a non-extreme band helps conservative products stay easy to explain.',
      tone: 'positive'
    };
  }

  if (product.bucket === 'strategy') {
    if (Number.isFinite(cnnFearGreed) && Number.isFinite(cryptoFearGreed)) {
      if (cnnFearGreed >= 78 || cnnFearGreed <= 25 || cryptoFearGreed >= 75 || cryptoFearGreed <= 30) {
        return {
          label: 'Cross-asset sentiment proxy',
          value: 'Risk appetite crowded',
          impact: -2,
          detail:
            'The strategy sleeve is still teachable, but the external risk tape is stretched enough that the view should stay sized and selective instead of fully constructive.',
          watchLine: 'Extreme equity or crypto sentiment would keep strategy sleeves in size-carefully mode.',
          improveLine: 'A return to balanced equity and crypto sentiment would support a better research stance.',
          tone: 'negative'
        };
      }
    }

    return {
      label: 'Cross-asset sentiment proxy',
      value: 'Risk appetite balanced',
      impact: 1,
      detail:
        'The external tape is balanced enough that users can focus on carry, credit selection, and hedge quality instead of fighting a clearly overheated market.',
      watchLine: 'If equity or crypto sentiment moves to an extreme, the strategy stance should tighten quickly.',
      improveLine: 'Keeping cross-asset sentiment balanced supports selective risk-taking.',
      tone: 'positive'
    };
  }

  if (product.bucket === 'structured') {
    const orderlyCrypto =
      Number.isFinite(cryptoFearGreed) &&
      cryptoFearGreed >= 40 &&
      cryptoFearGreed <= 65 &&
      Number.isFinite(fundingRate) &&
      Math.abs(fundingRate) < 0.008 &&
      Number.isFinite(etfFlowUsd) &&
      etfFlowUsd >= 0;

    const stressedCrypto =
      (Number.isFinite(cryptoFearGreed) && (cryptoFearGreed >= 75 || cryptoFearGreed <= 30)) ||
      (Number.isFinite(fundingRate) && Math.abs(fundingRate) >= 0.01) ||
      (Number.isFinite(etfFlowUsd) && etfFlowUsd < 0);

    if (stressedCrypto) {
      return {
        label: 'Crypto heat proxy',
        value: 'Trigger window distorted',
        impact: -2,
        detail:
          'This remains a teaching product, but crypto sentiment, ETF flows, or funding are stretched enough that the conditional payoff is harder to size and explain cleanly.',
        watchLine: 'Negative ETF flow or outsized funding should keep structured ideas in watch-only mode.',
        improveLine: 'Funding closer to flat and steadier ETF flows would make the trigger setup easier to trust.',
        tone: 'negative'
      };
    }

    if (orderlyCrypto) {
      return {
        label: 'Crypto heat proxy',
        value: 'Trigger window orderly',
        impact: 1,
        detail:
          'Crypto heat is calm enough that the structured note can be taught as a conditional entry tool rather than a disguised momentum chase.',
        watchLine: 'If crypto sentiment or funding stretches, this product should move back to wait mode.',
        improveLine: 'Keeping funding near flat and flows positive supports a cleaner trigger-based stance.',
        tone: 'positive'
      };
    }

    return {
      label: 'Crypto heat proxy',
      value: 'Mixed trigger window',
      impact: 0,
      detail:
        'The setup is neither clearly constructive nor clearly broken, so the product should stay in a wait-for-clearer-terms posture.',
      watchLine: 'Either sentiment extreme or funding distortion would weaken the structured view further.',
      improveLine: 'A calmer crypto heat profile would move this from mixed to constructive.',
      tone: 'neutral'
    };
  }

  return {
    label: 'Asset-specific overlay',
    value: 'No asset overlay required',
    impact: 0,
    detail: 'This shelf does not need a stronger asset-specific overlay than the core product rubric right now.',
    watchLine: 'If the product mix changes, add a more specific market overlay.',
    improveLine: 'The current product can stay anchored to the main diligence checks.',
    tone: 'neutral'
  };
}

function buildStance(product, finalScore, macroLens, assetLens, breakdown) {
  const combinedScore = finalScore + macroLens.impact + assetLens.impact;
  const hasComplianceReview = breakdown.some((item) => item.id === 'compliance' && item.status !== 'Pass');

  if (product.bucket === 'structured') {
    if (combinedScore >= 82 && assetLens.impact >= 0) {
      return {
        label: 'Trigger-based entry',
        tone: 'risk-medium',
        summary:
          'The payoff can be taught as a conditional entry tool right now, but it still belongs in a measured, event-driven sizing bucket instead of a default allocation.'
      };
    }
    if (combinedScore >= 76) {
      return {
        label: 'Wait for cleaner setup',
        tone: 'risk-medium',
        summary:
          'Terms and payoff logic are still visible, but the market tape is not clean enough to push a stronger entry stance yet.'
      };
    }
    return {
      label: 'Watch only',
      tone: 'risk-high',
      summary:
        'Keep this shelf as a learning example until the trigger window and payoff explanation both look cleaner.'
    };
  }

  if (product.bucket === 'strategy') {
    if (combinedScore >= 86 && assetLens.impact >= 0) {
      return {
        label: 'Selective risk-on',
        tone: 'risk-medium',
        summary:
          'The strategy sleeve can be used, but only as sized exposure. The view is constructive because product clarity is holding up while market sentiment remains balanced.'
      };
    }
    if (combinedScore >= 80) {
      return {
        label: 'Hold and size carefully',
        tone: 'risk-medium',
        summary:
          'The product remains investable in the tutorial, but the strategy and market overlays both argue against treating it like a cash substitute.'
      };
    }
    return {
      label: 'Wait',
      tone: 'risk-high',
      summary:
        'The market or strategy overlay is noisy enough that this sleeve should stay in research mode before any stronger recommendation.'
    };
  }

  if (product.bucket === 'fixed') {
    if (combinedScore >= 88) {
      return {
        label: 'Core term hold',
        tone: 'risk-low',
        summary:
          'The term product still reads like a strong cash-management extension as long as maturity, queue, and exit mechanics remain explicit.'
      };
    }
    if (combinedScore >= 82) {
      return {
        label: 'Selective add',
        tone: 'risk-low',
        summary:
          'The research view is still constructive, but queue timing and redemption mechanics should remain front and center before sizing up.'
      };
    }
    return {
      label: 'Hold and verify access',
      tone: hasComplianceReview ? 'risk-medium' : 'risk-low',
      summary:
        'The product quality is still visible, but the term, access, or queue mechanics need more emphasis before a stronger stance makes sense.'
    };
  }

  if (combinedScore >= 90) {
    return {
      label: 'Core allocation',
      tone: 'risk-low',
      summary:
        'The product still behaves like an understandable yield sleeve, so the research view can stay constructive while the macro tape remains calm.'
    };
  }

  if (combinedScore >= 84) {
    return {
      label: 'Selective add',
      tone: 'risk-low',
      summary:
        'The shelf still looks investable, but access rules and product mechanics should stay visible so users understand why the yield exists.'
    };
  }

  if (combinedScore >= 78) {
    return {
      label: 'Hold and verify access',
      tone: hasComplianceReview ? 'risk-medium' : 'risk-low',
      summary:
        'The product remains useful for education, but the stance should stay measured until access and transfer assumptions are fully clear.'
    };
  }

  return {
    label: 'Watch only',
    tone: 'risk-high',
    summary:
      'Leave this shelf in review mode until product clarity and the external market backdrop improve together.'
  };
}

function buildResearchView(product, snapshot, breakdown, finalScore) {
  const macroLens = buildMacroLens(snapshot);
  const assetLens = buildAssetLens(product, snapshot);
  const stance = buildStance(product, finalScore, macroLens, assetLens, breakdown);
  const reviewChecks = breakdown.filter((item) => item.status !== 'Pass');

  return {
    stance,
    macroLens,
    assetLens,
    watchItems: compactList([
      macroLens.watchLine,
      assetLens.watchLine,
      reviewChecks[0] ? `${reviewChecks[0].title}: ${reviewChecks[0].detail}` : '',
      product.bucket === 'structured' ? 'Conditional settlement is still the biggest user-mistake zone for this shelf.' : ''
    ]),
    changeItems: compactList([
      macroLens.improveLine,
      assetLens.improveLine,
      reviewChecks.some((item) => item.id === 'compliance' && item.status !== 'Pass')
        ? 'Cleaner eligibility and transfer disclosure would move this closer to live-routing readiness.'
        : 'Keeping rights and reserve updates visible would reinforce the current view.',
      product.bucket === 'strategy'
        ? 'The stance improves when carry, hedge quality, and collateral wording all remain readable on the same screen.'
        : ''
    ]),
    sourceLine:
      'This view combines the product rubric with Day1-style market overlays. Macro liquidity leads first, then sentiment or crypto-heat signals refine the stance.'
  };
}

function buildSignalOverlay(product, snapshot) {
  if (!snapshot) {
    return {
      adjustment: 0,
      rows: [],
      note: 'No external market overlay loaded yet.'
    };
  }

  const vix = Number(snapshot?.indices?.vix?.price);
  const cnnFearGreed = Number(snapshot?.sentiment?.cnnFearGreed);
  const cryptoFearGreed = Number(snapshot?.sentiment?.cryptoFearGreed);
  const fundingRate = Number(snapshot?.btcMetrics?.fundingRate);

  const rows = [];
  let adjustment = 0;

  let vixImpact = 0;
  if (Number.isFinite(vix)) {
    if (vix >= 28) vixImpact = -4;
    else if (vix >= 22) vixImpact = -2;
    else if (vix < 18 && product.bucket !== 'structured') vixImpact = 1;

    adjustment += vixImpact;
    rows.push({
      label: 'VIX regime',
      value: vix.toFixed(2),
      impact: vixImpact,
      detail:
        vixImpact < 0
          ? 'Higher volatility lowers product confidence for new allocations.'
          : vixImpact > 0
          ? 'Calmer markets slightly help entry clarity for starter and term shelves.'
          : 'Volatility is in a neutral band, so no extra score change is applied.'
    });
  }

  let sentimentImpact = 0;
  if (Number.isFinite(cnnFearGreed)) {
    if (cnnFearGreed >= 78 || cnnFearGreed <= 25) sentimentImpact = -1;
    adjustment += sentimentImpact;
    rows.push({
      label: 'US risk sentiment',
      value: `${cnnFearGreed.toFixed(0)}/100`,
      impact: sentimentImpact,
      detail:
        sentimentImpact < 0
          ? 'Extreme greed or fear makes suitability language more important.'
          : 'US risk appetite is not extreme enough to change the score.'
    });
  }

  let cryptoImpact = 0;
  if (['strategy', 'structured'].includes(product.bucket) && Number.isFinite(cryptoFearGreed)) {
    if (cryptoFearGreed >= 75 || cryptoFearGreed <= 30) cryptoImpact = -2;
    adjustment += cryptoImpact;
    rows.push({
      label: 'Crypto sentiment',
      value: `${cryptoFearGreed.toFixed(0)}/100`,
      impact: cryptoImpact,
      detail:
        cryptoImpact < 0
          ? 'Extreme crypto sentiment reduces confidence in higher-beta sleeves.'
          : 'Crypto sentiment is neutral enough to avoid an extra penalty.'
    });
  }

  let fundingImpact = 0;
  if (product.bucket === 'structured' && Number.isFinite(fundingRate)) {
    if (Math.abs(fundingRate) >= 0.01) fundingImpact = -1;
    adjustment += fundingImpact;
    rows.push({
      label: 'BTC funding',
      value: fundingRate.toFixed(4),
      impact: fundingImpact,
      detail:
        fundingImpact < 0
          ? 'Funding extremes make structured payoffs harder to explain cleanly.'
          : 'Funding is not distorted enough to change structured-product confidence.'
    });
  }

  return {
    adjustment,
    rows,
    note:
      rows.length > 0
        ? 'Day1 signals act as a market overlay on top of the product rubric, not as the primary diligence score.'
        : 'The selected shelf does not need a separate market-overlay adjustment right now.'
  };
}

export function buildDiligenceModel(product, snapshot) {
  const report = buildDiligenceReport({ product, market: snapshot, context: 'wealth' });

  return {
    baseScore: report.productQuality.score,
    signalAdjustment: report.marketRegime.scoreImpact,
    finalScore: report.displayScore,
    breakdown: report.productQuality.rows,
    signalRows: report.marketRegime.rows,
    overlayNote: report.marketRegime.note,
    sourceLabel: snapshot?._sourceLabel || '',
    timestamp: snapshot?.timestamp || '',
    researchView: report.researchView,
    report,
    qualityScore: report.productQuality.score,
    evidenceConfidenceScore: report.evidenceConfidence.score,
    marketOverlay: report.marketRegime,
    suitabilityGate: report.suitability,
    evidenceItems: report.evidence,
    evidenceMatrix: report.evidenceMatrix,
    redFlags: report.redFlags,
    whatChanged: report.whatChanged,
    memo: report.memo
  };
}

export async function fetchDay1BriefSnapshot() {
  try {
    const remoteResponse = await fetch(DAY1_REMOTE_URL, {
      cache: 'no-store'
    });

    if (!remoteResponse.ok) {
      throw new Error(`Day1 live API returned ${remoteResponse.status}.`);
    }

    const liveData = await remoteResponse.json();
    return {
      data: {
        ...liveData,
        _sourceLabel: 'Day1 live API'
      },
      sourceLabel: 'Day1 live API',
      note: 'Live market overlay loaded from brief.day1global.xyz.'
    };
  } catch (error) {
    const fallbackResponse = await fetch(DAY1_FALLBACK_PATH, {
      cache: 'no-store'
    });

    if (!fallbackResponse.ok) {
      throw error;
    }

    const fallbackData = await fallbackResponse.json();
    return {
      data: {
        ...fallbackData,
        _sourceLabel: 'Bundled Day1 snapshot'
      },
      sourceLabel: 'Bundled Day1 snapshot',
      note: 'Fallback snapshot is used because browser-side cross-origin access to the live Day1 API may be blocked.'
    };
  }
}
