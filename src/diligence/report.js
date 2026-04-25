const STATUS_MULTIPLIER = {
  Pass: 1,
  Review: 0.75,
  Watch: 0.55,
  Fail: 0.25
};

const SOURCE_QUALITY = {
  'official-doc': 0.95,
  'market-data': 0.84,
  onchain: 0.88,
  audit: 0.9,
  news: 0.7,
  manual: 0.66,
  'ai-extract': 0.58
};

const FRESHNESS_SCORE = {
  fresh: 1,
  aging: 0.72,
  stale: 0.42
};

export const DILIGENCE_DIMENSIONS = [
  {
    id: 'underlying',
    title: 'Underlying quality',
    weight: 15,
    aliases: ['underlying asset pack', 'underlying proof', 'reserve trail', 'asset pack']
  },
  {
    id: 'structure',
    title: 'Structure clarity',
    weight: 15,
    aliases: ['structure', 'settlement rule', 'strategy explainability', 'suitability screen', 'payoff logic']
  },
  {
    id: 'pricing',
    title: 'Pricing / NAV transparency',
    weight: 12,
    aliases: ['pricing transparency', 'pricing logic', 'nav transparency', 'oracle', 'mark']
  },
  {
    id: 'liquidity',
    title: 'Liquidity / redemption',
    weight: 14,
    aliases: ['liquidity stress', 'redemption', 'exit liquidity', 'secondary liquidity']
  },
  {
    id: 'rights',
    title: 'Rights / custody',
    weight: 12,
    aliases: ['custody evidence', 'share rights', 'token rights', 'ownership', 'receipt rights']
  },
  {
    id: 'eligibility',
    title: 'Eligibility / compliance',
    weight: 10,
    aliases: ['eligibility rule', 'compliance', 'kyc', 'transfer restriction']
  },
  {
    id: 'counterparty',
    title: 'Counterparty / issuer',
    weight: 8,
    aliases: ['issuer', 'counterparty', 'manager', 'administrator', 'custodian']
  },
  {
    id: 'security',
    title: 'Onchain / security',
    weight: 8,
    aliases: ['contract security', 'audit', 'admin permission', 'exploit history', 'onchain security']
  },
  {
    id: 'feesTax',
    title: 'Fee / tax drag clarity',
    weight: 4,
    aliases: ['fee clarity', 'fee drag', 'tax', 'route drag', 'fees']
  },
  {
    id: 'operations',
    title: 'Operational resilience',
    weight: 2,
    aliases: ['operations', 'monitoring', 'automation', 'pause', 'fallback', 'incident response']
  }
];

const DIMENSION_BY_ID = Object.fromEntries(DILIGENCE_DIMENSIONS.map((dimension) => [dimension.id, dimension]));
const DIMENSION_ALIAS_MAP = DILIGENCE_DIMENSIONS.reduce((map, dimension) => {
  map.set(dimension.id.toLowerCase(), dimension.id);
  map.set(dimension.title.toLowerCase(), dimension.id);
  dimension.aliases.forEach((alias) => map.set(alias.toLowerCase(), dimension.id));
  return map;
}, new Map());

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 0) {
  return Number(Number(value || 0).toFixed(digits));
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function compactList(items, limit = 5) {
  return [...new Set(items.filter(Boolean))].slice(0, limit);
}

function slug(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function freshnessFromDate(timestamp) {
  const value = new Date(timestamp || '').getTime();
  if (!Number.isFinite(value)) return 'aging';

  const ageDays = (Date.now() - value) / (24 * 60 * 60 * 1000);
  if (ageDays <= 7) return 'fresh';
  if (ageDays <= 45) return 'aging';
  return 'stale';
}

function getDimensionId(check) {
  const explicit = normalize(check?.dimensionId || check?.dimension);
  if (DIMENSION_BY_ID[explicit]) return explicit;

  const label = normalize(check?.label);
  if (DIMENSION_ALIAS_MAP.has(label)) return DIMENSION_ALIAS_MAP.get(label);

  const haystack = `${label} ${normalize(check?.detail)}`;
  if (/price|pricing|nav|apy|oracle|mark|spread/.test(haystack)) return 'pricing';
  if (/liquidity|redeem|redemption|exit|queue|maturity|secondary/.test(haystack)) return 'liquidity';
  if (/eligible|kyc|jurisdiction|qualified|compliance|transfer/.test(haystack)) return 'eligibility';
  if (/custody|rights|claim|ownership|token|receipt/.test(haystack)) return 'rights';
  if (/fee|tax|drag|expense|commission|spread/.test(haystack)) return 'feesTax';
  if (/audit|contract|admin|oracle|exploit|security/.test(haystack)) return 'security';
  if (/issuer|manager|custodian|administrator|counterparty/.test(haystack)) return 'counterparty';
  if (/settlement|structure|payoff|strategy|wrapper|lockup/.test(haystack)) return 'structure';
  if (/monitor|automation|pause|fallback|incident/.test(haystack)) return 'operations';
  return 'underlying';
}

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function getSourceType(product, dimensionId) {
  const sourceText = `${product?.status || ''} ${product?.liveTieIn || ''} ${product?.marketSource || ''}`.toLowerCase();
  if (dimensionId === 'pricing' || dimensionId === 'liquidity') {
    if (sourceText.includes('official') || sourceText.includes('public nav')) return 'official-doc';
    if (sourceText.includes('proxy')) return 'market-data';
  }
  if (sourceText.includes('official') || sourceText.includes('regulated')) return 'official-doc';
  if (dimensionId === 'security') return 'onchain';
  return 'manual';
}

function makeEvidence(product, dimensionId, sourceType, claim, sourceName, extractedAt, extra = {}) {
  return {
    id: `ev_${slug(product?.id || 'product')}_${dimensionId}_${slug(sourceName || claim)}`,
    dimensionId,
    sourceType,
    sourceName: sourceName || 'Bundled product registry',
    sourceUrl: extra.sourceUrl || '',
    extractedAt,
    freshness: freshnessFromDate(extractedAt),
    claim,
    supports: extra.supports || [dimensionId],
    contradicts: extra.contradicts || [],
    confidence: clamp(Number(extra.confidence ?? SOURCE_QUALITY[sourceType] ?? 0.65), 0, 1)
  };
}

function buildEvidenceItems(product = {}, market) {
  const extractedAt = market?.timestamp || new Date().toISOString();
  const items = [];
  const add = (dimensionId, claim, sourceName, extra = {}) => {
    if (!hasText(claim)) return;
    items.push(
      makeEvidence(
        product,
        dimensionId,
        extra.sourceType || getSourceType(product, dimensionId),
        claim,
        sourceName,
        extra.extractedAt || extractedAt,
        extra
      )
    );
  };

  add('underlying', product.underlying || product.yieldSource || product.productType, 'Product profile');
  add('structure', product.technicalSummary || product.humanSummary || product.worstCase, 'Structure summary');
  add('pricing', `${product.apyRange || ''} ${product.annualYieldBasis || ''} ${product.marketSource || ''}`.trim(), 'Pricing and NAV source');
  add('liquidity', product.redemption, 'Redemption terms');
  add('rights', (product.shareRights || []).join(' '), 'Token rights notes');
  add('eligibility', `${product.suitableFor || ''} ${product.minSubscription ? `Minimum subscription ${product.minSubscription}` : ''}`.trim(), 'Eligibility profile');
  add('counterparty', `${product.status || ''} ${product.liveTieIn || ''}`.trim(), 'Issuer / source profile');
  add('feesTax', Object.values(product.fees || {}).join(' '), 'Fees and route drag');
  add('operations', (product.automation || []).join(' '), 'Monitoring policy');

  const shareToken = `${product.shareToken || product.ticker || ''}`.trim();
  add(
    'security',
    shareToken ? `${shareToken} is treated as a wrapper or receipt that needs contract, admin, and oracle monitoring before live routing.` : '',
    'Onchain risk placeholder',
    { sourceType: 'onchain', confidence: 0.62 }
  );

  if (market?.timestamp) {
    add('pricing', `Market overlay snapshot timestamp ${market.timestamp}.`, market?._sourceLabel || 'Market snapshot', {
      sourceType: 'market-data',
      extractedAt: market.timestamp,
      confidence: 0.82
    });
  }

  return Object.values(Object.fromEntries(items.map((item) => [item.id, item])));
}

function evidenceForDimension(evidenceItems, dimensionId) {
  return evidenceItems.filter((item) => item.dimensionId === dimensionId || item.supports?.includes(dimensionId));
}

function statusForGeneratedCheck(product, dimensionId, evidenceItems) {
  const text = `${product?.redemption || ''} ${product?.suitableFor || ''} ${product?.status || ''} ${product?.marketSource || ''} ${product?.liveTieIn || ''}`.toLowerCase();
  const hasEvidence = evidenceForDimension(evidenceItems, dimensionId).length > 0;

  if (!hasEvidence) return 'Watch';
  if (dimensionId === 'liquidity') {
    if (/queue|maturity|transfer-only|transfer only|lockup/.test(text)) return 'Watch';
    if (/qualified|eligible|business-day|business day|next business/.test(text)) return 'Review';
    return 'Pass';
  }
  if (dimensionId === 'eligibility') {
    if (/qualified|eligible|non-u\.s|non-us|jurisdiction|kyc/.test(text)) return 'Review';
    return 'Pass';
  }
  if (dimensionId === 'security') return /audit|official|regulated/.test(text) ? 'Review' : 'Watch';
  if (dimensionId === 'pricing') return /proxy/.test(text) ? 'Review' : 'Pass';
  if (dimensionId === 'counterparty') return /official|regulated|public/.test(text) ? 'Pass' : 'Review';
  if (dimensionId === 'rights') return (product?.shareRights || []).length >= 3 ? 'Pass' : 'Review';
  return 'Pass';
}

function severityForStatus(status, dimensionId) {
  if (status === 'Fail') return 'high';
  if (status === 'Watch') return ['liquidity', 'eligibility', 'security', 'rights'].includes(dimensionId) ? 'high' : 'medium';
  if (status === 'Review') return ['liquidity', 'eligibility', 'security'].includes(dimensionId) ? 'medium' : 'low';
  return 'low';
}

function buildChecks(product = {}, evidenceItems) {
  const rawChecks = (product.diligenceChecks || []).map((check, index) => {
    const dimensionId = getDimensionId(check);
    const dimension = DIMENSION_BY_ID[dimensionId];
    const status = check.status || 'Review';
    const linkedEvidence = evidenceForDimension(evidenceItems, dimensionId);

    return {
      id: check.id || `chk_${slug(product.id || 'product')}_${dimensionId}_${index + 1}`,
      dimensionId,
      title: dimension.title,
      label: check.label || dimension.title,
      status,
      severity: check.severity || severityForStatus(status, dimensionId),
      detail: check.detail || 'AI diligence normalized this check from the product registry.',
      evidenceIds: check.evidenceIds || linkedEvidence.slice(0, 3).map((item) => item.id),
      confidence: clamp(Number(check.confidence ?? (linkedEvidence.length ? 0.82 : 0.64)), 0, 1),
      generated: false
    };
  });

  const usedDimensions = new Set(rawChecks.map((check) => check.dimensionId));
  const generatedChecks = DILIGENCE_DIMENSIONS.filter((dimension) => !usedDimensions.has(dimension.id)).map((dimension) => {
    const linkedEvidence = evidenceForDimension(evidenceItems, dimension.id);
    const status = statusForGeneratedCheck(product, dimension.id, evidenceItems);
    return {
      id: `chk_${slug(product.id || 'product')}_${dimension.id}_generated`,
      dimensionId: dimension.id,
      title: dimension.title,
      label: dimension.title,
      status,
      severity: severityForStatus(status, dimension.id),
      detail: linkedEvidence[0]?.claim || `No strong ${dimension.title.toLowerCase()} evidence is bundled with this demo record yet.`,
      evidenceIds: linkedEvidence.slice(0, 3).map((item) => item.id),
      confidence: linkedEvidence.length ? 0.72 : 0.52,
      generated: true
    };
  });

  return [...rawChecks, ...generatedChecks];
}

function buildProductQuality(checks) {
  const rows = checks.map((check) => {
    const dimension = DIMENSION_BY_ID[check.dimensionId] || DILIGENCE_DIMENSIONS[0];
    const multiplier = STATUS_MULTIPLIER[check.status] ?? 0.7;
    const confidenceHaircut = 0.85 + clamp(Number(check.confidence || 0.7), 0, 1) * 0.15;
    const weightedPoints = round(dimension.weight * multiplier * confidenceHaircut, 1);

    return {
      ...check,
      id: dimension.id,
      dimensionId: dimension.id,
      title: dimension.title,
      weight: dimension.weight,
      multiplier,
      weightedPoints
    };
  });

  return {
    score: clamp(Math.round(rows.reduce((sum, row) => sum + row.weightedPoints, 0)), 0, 100),
    rows
  };
}

function buildEvidenceConfidence(evidenceItems, checks) {
  if (!evidenceItems.length) {
    return {
      score: 0,
      label: 'No evidence',
      sourceQuality: 0,
      freshness: 0,
      coverage: 0,
      contradictionPenalty: 0
    };
  }

  const sourceQuality = evidenceItems.reduce((sum, item) => sum + (SOURCE_QUALITY[item.sourceType] || 0.62), 0) / evidenceItems.length;
  const freshness = evidenceItems.reduce((sum, item) => sum + (FRESHNESS_SCORE[item.freshness] || 0.6), 0) / evidenceItems.length;
  const coveredDimensions = new Set(checks.filter((check) => check.evidenceIds?.length).map((check) => check.dimensionId));
  const coverage = coveredDimensions.size / DILIGENCE_DIMENSIONS.length;
  const contradictionPenalty = evidenceItems.filter((item) => item.contradicts?.length).length / evidenceItems.length;
  const score = clamp(Math.round((sourceQuality * 0.35 + freshness * 0.25 + coverage * 0.25 - contradictionPenalty * 0.15) * 100), 0, 100);

  return {
    score,
    label: score >= 78 ? 'High evidence' : score >= 58 ? 'Medium evidence' : 'Low evidence',
    sourceQuality: round(sourceQuality * 100),
    freshness: round(freshness * 100),
    coverage: round(coverage * 100),
    contradictionPenalty: round(contradictionPenalty * 100)
  };
}

function buildMarketRegime(product = {}, market) {
  if (!market) {
    return {
      label: 'No market overlay',
      tone: 'risk-medium',
      scoreImpact: 0,
      rows: [],
      note: 'No external market snapshot is loaded, so the stance stays anchored to product quality.',
      macroLens: {
        label: 'Macro liquidity proxy',
        value: 'Snapshot unavailable',
        impact: 0,
        detail: 'Market overlay has not loaded yet.',
        tone: 'neutral'
      },
      assetLens: {
        label: 'Asset-specific overlay',
        value: 'Snapshot unavailable',
        impact: 0,
        detail: 'Asset-specific overlay has not loaded yet.',
        tone: 'neutral'
      }
    };
  }

  const rows = [];
  let scoreImpact = 0;
  const vix = Number(market?.indices?.vix?.price);
  const dxy = Number(market?.indices?.dxy?.price);
  const cnnFearGreed = Number(market?.sentiment?.cnnFearGreed);
  const cryptoFearGreed = Number(market?.sentiment?.cryptoFearGreed);
  const fundingRate = Number(market?.btcMetrics?.fundingRate);
  const etfFlowUsd = Number(market?.btcMetrics?.etfFlowUsd);

  let macroImpact = 0;
  let macroValue = 'Partial snapshot';
  let macroDetail = 'The market snapshot is missing VIX or DXY, so macro impact is neutral.';
  if (Number.isFinite(vix) && Number.isFinite(dxy)) {
    macroValue = `VIX ${vix.toFixed(2)} / DXY ${dxy.toFixed(2)}`;
    if (vix >= 24 || dxy >= 101) macroImpact = -2;
    else if (vix >= 19.5 || dxy >= 100) macroImpact = -1;
    else macroImpact = 1;
    macroDetail =
      macroImpact < 0
        ? 'Volatility or dollar strength argues for smaller sizing and clearer redemption language.'
        : 'Macro liquidity is orderly enough that product quality can lead the stance.';
  }
  scoreImpact += macroImpact;
  rows.push({ label: 'Macro liquidity', value: macroValue, impact: macroImpact, detail: macroDetail });

  let sentimentImpact = 0;
  if (Number.isFinite(cnnFearGreed)) {
    if (cnnFearGreed >= 78 || cnnFearGreed <= 25) sentimentImpact = -1;
    rows.push({
      label: 'US risk sentiment',
      value: `${cnnFearGreed.toFixed(0)}/100`,
      impact: sentimentImpact,
      detail: sentimentImpact < 0 ? 'Extreme fear or greed makes suitability wording more important.' : 'US risk appetite is not extreme enough to change the stance.'
    });
  }
  scoreImpact += sentimentImpact;

  let assetImpact = 0;
  const bucket = product.bucket || '';
  if (['strategy', 'structured'].includes(bucket) && Number.isFinite(cryptoFearGreed)) {
    if (cryptoFearGreed >= 75 || cryptoFearGreed <= 30) assetImpact -= 2;
    else assetImpact += 1;
    rows.push({
      label: bucket === 'structured' ? 'Crypto heat' : 'Cross-asset sentiment',
      value: `${cryptoFearGreed.toFixed(0)}/100`,
      impact: assetImpact,
      detail: assetImpact < 0 ? 'Crypto sentiment is stretched enough to keep sizing selective.' : 'Crypto sentiment is balanced enough that product mechanics can lead.'
    });
  }

  if (bucket === 'structured' && Number.isFinite(fundingRate)) {
    const fundingImpact = Math.abs(fundingRate) >= 0.01 ? -1 : 0;
    assetImpact += fundingImpact;
    rows.push({
      label: 'BTC funding',
      value: fundingRate.toFixed(4),
      impact: fundingImpact,
      detail: fundingImpact < 0 ? 'Funding distortion makes structured payoff timing harder to trust.' : 'Funding is not distorted enough to add a penalty.'
    });
  }

  if (bucket === 'structured' && Number.isFinite(etfFlowUsd)) {
    const flowImpact = etfFlowUsd < 0 ? -1 : 0;
    assetImpact += flowImpact;
    rows.push({
      label: 'ETF flow',
      value: `${Math.round(etfFlowUsd / 1000000)}M USD`,
      impact: flowImpact,
      detail: flowImpact < 0 ? 'Negative ETF flow weakens the trigger window.' : 'ETF flow is not adding stress to the trigger window.'
    });
  }

  scoreImpact = clamp(scoreImpact + assetImpact, -10, 10);
  const label = scoreImpact <= -4 ? 'Stressed market' : scoreImpact <= -1 ? 'Guarded market' : scoreImpact >= 2 ? 'Supportive market' : 'Neutral market';

  return {
    label,
    tone: scoreImpact < 0 ? 'risk-medium' : 'risk-low',
    scoreImpact,
    rows,
    note: 'Market regime is shown as a separate overlay. It does not redefine product quality.',
    macroLens: {
      label: 'Macro liquidity proxy',
      value: macroValue,
      impact: macroImpact,
      detail: macroDetail,
      tone: macroImpact < 0 ? 'negative' : macroImpact > 0 ? 'positive' : 'neutral'
    },
    assetLens: {
      label: bucket === 'structured' ? 'Crypto heat proxy' : bucket === 'strategy' ? 'Cross-asset sentiment proxy' : 'Asset-specific overlay',
      value: rows.find((row) => row.label === 'Crypto heat' || row.label === 'Cross-asset sentiment')?.value || 'No extra asset overlay',
      impact: assetImpact,
      detail:
        assetImpact < 0
          ? 'Asset-specific signals are noisy enough to keep the stance selective.'
          : assetImpact > 0
            ? 'Asset-specific signals are balanced enough to support the research stance.'
            : 'No extra asset-specific penalty is applied.',
      tone: assetImpact < 0 ? 'negative' : assetImpact > 0 ? 'positive' : 'neutral'
    }
  };
}

function buildSuitabilityGate(product = {}, checks) {
  const eligibility = checks.find((check) => check.dimensionId === 'eligibility');
  const liquidity = checks.find((check) => check.dimensionId === 'liquidity');
  const riskyBucket = ['structured', 'strategy'].includes(product.bucket) || String(product.risk || '').toLowerCase() === 'high';

  if (eligibility?.status === 'Fail') {
    return {
      label: 'Blocked by eligibility',
      status: 'blocked',
      tone: 'risk-high',
      reason: 'Eligibility or transfer rules need human review before this product should be shown as buyable.'
    };
  }

  if (riskyBucket) {
    return {
      label: 'Advanced only',
      status: 'advanced-only',
      tone: 'risk-medium',
      reason: 'The payoff, hedge, or liquidity path has enough moving parts that the product should be gated for advanced users.'
    };
  }

  if (eligibility?.status !== 'Pass' || liquidity?.status === 'Watch') {
    return {
      label: 'Beginner with warning',
      status: 'warning',
      tone: 'risk-medium',
      reason: 'The product is teachable, but eligibility or liquidity wording should stay visible before allocation.'
    };
  }

  return {
    label: 'Beginner OK',
    status: 'ok',
    tone: 'risk-low',
    reason: 'The product can be explained through ownership, return source, and exit path without hiding a major gate.'
  };
}

function buildRedFlags(checks, marketRegime, evidenceConfidence, product = {}) {
  const fromChecks = checks
    .filter((check) => check.status !== 'Pass')
    .sort((left, right) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[left.severity] ?? 2) - (order[right.severity] ?? 2);
    })
    .map((check) => ({
      id: `flag_${check.id}`,
      severity: check.severity,
      title: check.title,
      detail: check.detail,
      evidenceIds: check.evidenceIds || []
    }));

  const extraFlags = [];
  if (evidenceConfidence.score < 60) {
    extraFlags.push({
      id: 'flag_evidence_confidence',
      severity: 'medium',
      title: 'Evidence confidence is thin',
      detail: 'The report can still run locally, but the product needs fresher or more authoritative evidence before a stronger stance.',
      evidenceIds: []
    });
  }
  if (marketRegime.scoreImpact < 0) {
    extraFlags.push({
      id: 'flag_market_guarded',
      severity: 'medium',
      title: marketRegime.label,
      detail: 'The product did not necessarily get worse, but the entry backdrop is less forgiving right now.',
      evidenceIds: []
    });
  }
  if (Number(product.minSubscription || 0) >= 100000) {
    extraFlags.push({
      id: 'flag_minimum_ticket',
      severity: 'medium',
      title: 'Large minimum ticket',
      detail: 'A high minimum subscription makes suitability and allocation sizing more important than headline yield.',
      evidenceIds: []
    });
  }

  return compactList([...fromChecks, ...extraFlags], 7);
}

function firstEvidenceFor(check, evidenceItems) {
  return evidenceItems.find((item) => check?.evidenceIds?.includes(item.id)) || evidenceForDimension(evidenceItems, check?.dimensionId)[0];
}

function buildEvidenceMatrix(product, checks, evidenceItems, suitability) {
  const byDimension = Object.fromEntries(checks.map((check) => [check.dimensionId, check]));
  const rows = [
    {
      id: 'owns',
      question: 'What does the user own?',
      check: byDimension.rights || byDimension.underlying,
      finding: product.shareToken ? `${product.shareToken} wrapper / receipt exposure` : product.productType || 'Product exposure'
    },
    {
      id: 'return-source',
      question: 'How is return generated?',
      check: byDimension.underlying || byDimension.pricing,
      finding: product.yieldSource || product.underlying || product.apyRange || 'Return source needs clearer evidence'
    },
    {
      id: 'redeem',
      question: 'Can the user redeem or exit?',
      check: byDimension.liquidity,
      finding: product.redemption || 'Exit path is not explicit in the bundled record'
    },
    {
      id: 'break',
      question: 'What can break?',
      check: byDimension.structure || byDimension.security,
      finding: product.worstCase || byDimension.security?.detail || 'Main break point needs analyst review'
    },
    {
      id: 'suitability',
      question: 'Is this beginner-safe?',
      check: byDimension.eligibility,
      finding: suitability.label
    }
  ];

  return rows.map((row) => {
    const evidence = firstEvidenceFor(row.check, evidenceItems);
    return {
      id: row.id,
      question: row.question,
      finding: row.finding,
      evidenceId: evidence?.id || '',
      evidence: evidence?.sourceName || 'No direct evidence attached',
      confidence: evidence ? (evidence.confidence >= 0.8 ? 'High' : evidence.confidence >= 0.62 ? 'Medium' : 'Low') : 'Low'
    };
  });
}

function buildStance(product, quality, evidenceConfidence, marketRegime, suitability) {
  if (suitability.status === 'blocked') {
    return {
      label: 'Needs review',
      tone: 'risk-high',
      summary: 'The product should stay in review until eligibility evidence is human-confirmed.'
    };
  }

  if (quality.score >= 86 && evidenceConfidence.score >= 72 && marketRegime.scoreImpact >= -1) {
    return {
      label: product.bucket === 'starter' ? 'Core allocation' : 'Selective add',
      tone: 'risk-low',
      summary: 'Product quality and evidence coverage are strong enough that the main decision is sizing, not basic trust.'
    };
  }

  if (quality.score >= 74 && evidenceConfidence.score >= 58) {
    return {
      label: suitability.status === 'advanced-only' ? 'Advanced research ready' : 'Research ready',
      tone: 'risk-medium',
      summary: 'The product is explainable, but the report still wants visible caveats around market timing, liquidity, or evidence freshness.'
    };
  }

  return {
    label: 'Watch only',
    tone: 'risk-high',
    summary: 'The report is useful for learning, but evidence or product clarity is not strong enough for a confident allocation stance.'
  };
}

function buildMemo(product, stance, quality, evidenceConfidence, marketRegime, redFlags) {
  return {
    title: `${product.shortName || product.name || 'Product'} diligence memo`,
    summary: `${stance.label}: ${stance.summary}`,
    sections: [
      {
        title: 'Return source',
        body: product.yieldSource || product.underlying || 'Return source should be tied to explicit product evidence before launch.'
      },
      {
        title: 'Main risks',
        body:
          redFlags
            .slice(0, 3)
            .map((flag) => flag.title)
            .join(', ') || product.worstCase || 'No major red flag is detected in the bundled demo record.'
      },
      {
        title: 'Monitoring triggers',
        body: compactList([
          marketRegime.scoreImpact < 0 ? `Market overlay stays ${marketRegime.label.toLowerCase()}` : '',
          evidenceConfidence.score < 70 ? 'Evidence confidence falls below high-confidence range' : '',
          'NAV, redemption, eligibility, or fee wording changes',
          quality.score < 75 ? 'Product quality falls below research-ready range' : ''
        ]).join('; ')
      }
    ]
  };
}

function buildResearchView(report) {
  return {
    stance: report.stance,
    macroLens: report.marketRegime.macroLens,
    assetLens: report.marketRegime.assetLens,
    watchItems: compactList([
      ...report.redFlags.map((flag) => `${flag.title}: ${flag.detail}`),
      report.marketRegime.scoreImpact < 0 ? `${report.marketRegime.label}: entry timing is less forgiving.` : '',
      report.evidenceConfidence.score < 70 ? 'Evidence confidence is not high enough for a clean recommendation.' : ''
    ], 4),
    changeItems: report.whatChanged,
    sourceLine:
      'Scores are deterministic and evidence-backed. AI-style synthesis is limited to matrix, red flags, change notes, and memo text in this local demo.'
  };
}

export function buildDiligenceReport({ product, market = null, context = 'wealth' } = {}) {
  if (!product) {
    return {
      productId: '',
      context,
      productQuality: { score: 0, rows: [] },
      evidenceConfidence: { score: 0, label: 'No evidence' },
      marketRegime: buildMarketRegime({}, market),
      suitability: { label: 'Unavailable', status: 'unavailable', tone: 'risk-medium', reason: '' },
      displayScore: 0,
      stance: { label: 'Unavailable', tone: 'risk-medium', summary: '' },
      evidence: [],
      evidenceMatrix: [],
      redFlags: [],
      whatChanged: [],
      memo: { title: '', summary: '', sections: [] },
      researchView: {
        stance: { label: 'Unavailable', tone: 'risk-medium', summary: '' },
        macroLens: { label: '', value: '', impact: 0, detail: '', tone: 'neutral' },
        assetLens: { label: '', value: '', impact: 0, detail: '', tone: 'neutral' },
        watchItems: [],
        changeItems: [],
        sourceLine: ''
      }
    };
  }

  const evidence = buildEvidenceItems(product, market);
  const checks = buildChecks(product, evidence);
  const productQuality = buildProductQuality(checks);
  const evidenceConfidence = buildEvidenceConfidence(evidence, checks);
  const marketRegime = buildMarketRegime(product, market);
  const suitability = buildSuitabilityGate(product, productQuality.rows);
  const redFlags = buildRedFlags(productQuality.rows, marketRegime, evidenceConfidence, product);
  const evidenceMatrix = buildEvidenceMatrix(product, productQuality.rows, evidence, suitability);
  const stance = buildStance(product, productQuality, evidenceConfidence, marketRegime, suitability);
  const whatChanged = compactList([
    marketRegime.scoreImpact === 0
      ? 'Market overlay is neutral; product quality remains the main driver.'
      : `Market overlay is ${marketRegime.label.toLowerCase()} (${marketRegime.scoreImpact > 0 ? '+' : ''}${marketRegime.scoreImpact}).`,
    evidence.some((item) => item.freshness === 'stale')
      ? 'At least one evidence item is stale and should be refreshed before publishing.'
      : 'Bundled evidence is usable for the local demo without extra downloads.',
    redFlags[0] ? `Top watch item: ${redFlags[0].title}.` : 'No new high-severity red flag in the bundled record.'
  ]);
  const memo = buildMemo(product, stance, productQuality, evidenceConfidence, marketRegime, redFlags);
  const displayScore = clamp(productQuality.score + marketRegime.scoreImpact, 0, 99);
  const report = {
    productId: product.id,
    context,
    productQuality,
    evidenceConfidence,
    marketRegime,
    suitability,
    displayScore,
    stance,
    evidence,
    evidenceMatrix,
    redFlags,
    whatChanged,
    memo
  };

  return {
    ...report,
    researchView: buildResearchView(report)
  };
}
