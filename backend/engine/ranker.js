'use strict';

// ── Signal weights (no-history context) ───────────────────────────────────────
// When a previousMethodId is present the weights shift to guarantee that method
// ranks first (see WEIGHTS_WITH_HISTORY below).
const WEIGHTS_DEFAULT = {
  geographic: 0.35,
  amount:     0.30,
  device:     0.35,
};

// With history: history alone (0.55) beats the maximum possible combined score
// of all other signals (0.45), so the returning-customer method is always first.
const WEIGHTS_WITH_HISTORY = {
  geographic: 0.20,
  amount:     0.15,
  device:     0.10,
  history:    0.55,
};

// ── Amount tier thresholds (USD) ──────────────────────────────────────────────
// Calibrated against mock data: p25 ≈ $2.9k, p50 ≈ $15k, p75 ≈ $44k.
// Tiers reflect method design intent, not data percentiles.
const TIER_LOW_MAX  = 100;
const TIER_MID_MAX  = 1000;
// > 1000 → 'high'

// Score (0–1) for each method type at each amount tier.
// High score = this method is a strong fit for amounts in that tier.
const AMOUNT_SCORES = {
  mobile_money:    { low: 1.0, mid: 0.6, high: 0.2 },
  card:            { low: 0.7, mid: 0.9, high: 1.0 },
  bnpl:            { low: 0.2, mid: 1.0, high: 0.8 },
  bank_transfer:   { low: 0.1, mid: 0.5, high: 1.0 },
  digital_wallet:  { low: 0.8, mid: 0.9, high: 0.7 },
  instant_payment: { low: 1.0, mid: 0.9, high: 0.5 },
  cash_voucher:    { low: 0.9, mid: 0.7, high: 0.2 },
};

// Score (0–1) for each method type on each device.
// Mobile money and digital wallets rank high on mobile; cards and bank
// transfers rank high on desktop where form-filling is easier.
const DEVICE_SCORES = {
  mobile_money:    { mobile: 1.0, tablet: 0.6, desktop: 0.2 },
  card:            { mobile: 0.5, tablet: 0.8, desktop: 1.0 },
  bnpl:            { mobile: 0.8, tablet: 0.8, desktop: 0.7 },
  bank_transfer:   { mobile: 0.2, tablet: 0.5, desktop: 1.0 },
  digital_wallet:  { mobile: 1.0, tablet: 0.9, desktop: 0.7 },
  instant_payment: { mobile: 0.9, tablet: 0.8, desktop: 0.7 },
  cash_voucher:    { mobile: 0.5, tablet: 0.5, desktop: 0.6 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function amountTier(amountUSD) {
  if (amountUSD < TIER_LOW_MAX) return 'low';
  if (amountUSD < TIER_MID_MAX) return 'mid';
  return 'high';
}

function weightedSum(signals, weights) {
  return Object.keys(weights).reduce(
    (sum, key) => sum + (signals[key] ?? 0) * weights[key],
    0
  );
}

// ── Signal scorers ────────────────────────────────────────────────────────────

/**
 * Returns raw success-transaction counts per method id for the given country.
 * Caller normalises by dividing by the max count.
 */
function buildGeoCounts(eligibleMethods, country, transactions) {
  const counts = new Map(eligibleMethods.map(m => [m.id, 0]));
  for (const t of transactions) {
    if (t.status === 'success' && t.country === country && counts.has(t.methodId)) {
      counts.set(t.methodId, counts.get(t.methodId) + 1);
    }
  }
  return counts;
}

function scoreGeographic(rawCount, maxCount) {
  return maxCount === 0 ? 0 : rawCount / maxCount;
}

function scoreAmount(methodType, amountUSD) {
  const tier = amountTier(amountUSD);
  return AMOUNT_SCORES[methodType]?.[tier] ?? 0.5;
}

function scoreDevice(methodType, deviceType) {
  return DEVICE_SCORES[methodType]?.[deviceType] ?? 0.5;
}

function scoreHistory(methodId, previousMethodId) {
  return previousMethodId && methodId === previousMethodId ? 1.0 : 0.0;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * rank(context, methods, transactions) → RankedResult[]
 *
 * context:
 *   country          {string}  ISO 3166-1 alpha-2 (e.g. 'BR')
 *   amountUSD        {number}  transaction amount in USD
 *   deviceType       {string}  'mobile' | 'tablet' | 'desktop'
 *   previousMethodId {string?} method id used on last successful purchase
 *
 * Returns an array sorted by score desc, each item:
 *   { method, score, signals: { geographic, amount, device, history? } }
 */
function rank(context, methods, transactions) {
  const { country, amountUSD, deviceType, previousMethodId = null } = context;

  // ── 1. Eligibility: country supported AND amount within method limits ───────
  const eligible = methods.filter(
    m => m.countries.includes(country) &&
         amountUSD >= m.minAmount &&
         amountUSD <= m.maxAmount
  );

  if (eligible.length === 0) return [];

  // ── 2. Geographic signal — normalise across eligible methods ───────────────
  const geoCounts = buildGeoCounts(eligible, country, transactions);
  const maxGeoCount = Math.max(...geoCounts.values(), 1);

  // ── 3. Choose weight set ───────────────────────────────────────────────────
  const weights = previousMethodId ? WEIGHTS_WITH_HISTORY : WEIGHTS_DEFAULT;

  // ── 4. Score ───────────────────────────────────────────────────────────────
  const scored = eligible.map(m => {
    const signals = {
      geographic: scoreGeographic(geoCounts.get(m.id), maxGeoCount),
      amount:     scoreAmount(m.type, amountUSD),
      device:     scoreDevice(m.type, deviceType),
      ...(previousMethodId && { history: scoreHistory(m.id, previousMethodId) }),
    };

    return {
      method:  m,
      score:   parseFloat(weightedSum(signals, weights).toFixed(4)),
      signals,
    };
  });

  // ── 5. Sort descending ─────────────────────────────────────────────────────
  return scored.sort((a, b) => b.score - a.score);
}

module.exports = { rank };
