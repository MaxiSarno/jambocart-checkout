'use strict';

const methods      = require('../data/paymentMethods');
const transactions = require('../data/transactions');

// ── Eligibility helpers ───────────────────────────────────────────────────────

function supports(method, field, value) {
  return method[field].includes('*') || method[field].includes(value);
}

const AFRICAN_COUNTRIES = ['KE', 'UG', 'TZ', 'GH', 'CM'];

// ── Signal scorers ────────────────────────────────────────────────────────────

/**
 * SIGNAL 1 — Geographic match (max 30 pts)
 * Returns null to exclude the method when country or currency is unsupported.
 */
function signalGeographic(method, country, currency) {
  if (!supports(method, 'countries', country) || !supports(method, 'currencies', currency)) {
    return null; // exclude
  }
  let points = 30;
  const reasons = [];

  if (method.type === 'card' && !AFRICAN_COUNTRIES.includes(country)) {
    points += 15;
    reasons.push('Preferred payment method internationally');
  }

  return { points, reasons };
}

/**
 * SIGNAL 2 — Historical preference (max 50 pts)
 * +50 if this is the customer's previous method.
 * +15 if the method has > 10 approved transactions in this country (any customer).
 */
function signalHistory(method, { isReturning, previousMethodId, country }) {
  let points  = 0;
  const reasons = [];

  if (isReturning && previousMethodId === method.id) {
    points += 50;
    reasons.push('Used in your last purchase');
  } else if (isReturning) {
    const approvedInCountry = transactions.filter(
      t => t.methodId === method.id && t.country === country && t.status === 'approved'
    ).length;
    if (approvedInCountry > 10) {
      points += 15;
      reasons.push('Popular with returning customers in your region');
    }
  }

  return { points, reasons };
}

/**
 * SIGNAL 3 — Device affinity (max 20 pts)
 * +20 for mobile_money / wallet / aggregator on mobile.
 * +10 for card on desktop.
 */
function signalDevice(method, deviceType) {
  let points  = 0;
  const reasons = [];

  if (deviceType === 'mobile' && method.popularOnMobile) {
    points += 20;
    reasons.push('Optimised for mobile');
  } else if (deviceType === 'desktop' && method.type === 'card') {
    points += 10;
    reasons.push('Great for desktop checkout');
  }

  return { points, reasons };
}

/**
 * SIGNAL 4 — Amount fit (max 25 pts)
 * Returns null to exclude the method when amount is outside its limits.
 * +25 for BNPL on amounts >= $100.
 * +10 additional for BNPL when customerAge is "18-25".
 * +10 for mobile_money or wallet on amounts < $50.
 */
function signalAmount(method, { amountUSD, customerAge }) {
  if (amountUSD < method.minAmount) return null; // exclude
  if (method.maxAmount !== null && amountUSD > method.maxAmount) return null; // exclude

  let points  = 0;
  const reasons = [];

  if (method.type === 'bnpl' && amountUSD >= 100) {
    points += 25;
    reasons.push('Split into instalments at no extra cost');
    if (customerAge === '18-25') {
      points += 10;
      reasons.push('Popular with young shoppers');
    }
  }

  if (amountUSD < 50 && (method.type === 'mobile_money' || method.type === 'wallet')) {
    points += 10;
    reasons.push('Fast and fee-free for small amounts');
  }

  return { points, reasons };
}

/**
 * SIGNAL 4b — Processing speed
 * -20 if transfer takes > 1 hour and amount < $1000 (SWIFT penalty on small purchases).
 * +5 if payment settles in ≤ 10 seconds.
 */
function signalSpeed(method, amountUSD) {
  let points = 0;
  const reasons = [];

  if (method.avgProcessingSeconds > 3600 && amountUSD < 1000) {
    points -= 20;
    reasons.push('Slow transfer — not ideal for this amount');
  } else if (method.avgProcessingSeconds <= 10) {
    points += 5;
    reasons.push('Instant payment');
  }

  return { points, reasons };
}

/**
 * SIGNAL 5 — Authorization rate (variable pts)
 * bonus = Math.round((authRate − 0.70) × 100)
 */
function signalAuthRate(method) {
  const points  = Math.max(0, Math.round((method.authRate - 0.70) * 100));
  const reasons = [`${Math.round(method.authRate * 100)}% approval rate`];
  return { points, reasons };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * rankPaymentMethods(context) → RankedResult[]
 *
 * context: {
 *   country         string   ISO 3166-1 alpha-2 (e.g. "KE")
 *   currency        string   ISO 4217 (e.g. "KES")
 *   deviceType      string   "mobile" | "desktop"
 *   amountUSD       number
 *   isReturning     boolean
 *   previousMethodId string? method id from last purchase
 *   customerAge     string?  "18-25" | "26-40" | "41+"
 * }
 *
 * Returns array sorted by score desc:
 * { rank, id, name, type, description, score, confidence, reasons }
 */
function rankPaymentMethods(context) {
  const { country, currency, deviceType, amountUSD, isReturning,
          previousMethodId, customerAge } = context;

  const results = [];

  for (const method of methods) {
    // ── Signal 1: geographic eligibility ──────────────────────────────────────
    const geo = signalGeographic(method, country, currency);
    if (geo === null) continue;

    // ── Signal 4: amount eligibility (also excludes out-of-range) ─────────────
    const amount = signalAmount(method, { amountUSD, customerAge });
    if (amount === null) continue;

    // ── Remaining signals (no exclusions) ─────────────────────────────────────
    const history  = signalHistory(method, { isReturning, previousMethodId, country });
    const device   = signalDevice(method, deviceType);
    const speed    = signalSpeed(method, amountUSD);
    const authRate = signalAuthRate(method);

    const score = geo.points + history.points + device.points + amount.points + speed.points + authRate.points;

    const reasons = [
      ...geo.reasons,
      ...history.reasons,
      ...device.reasons,
      ...amount.reasons,
      ...speed.reasons,
      ...authRate.reasons,
    ];

    results.push({
      id:          method.id,
      name:        method.name,
      type:        method.type,
      description: method.description,
      score,
      reasons,
    });
  }

  // Sort descending, then assign rank and confidence
  results.sort((a, b) => b.score - a.score);

  return results.map((r, i) => ({
    rank:        i + 1,
    id:          r.id,
    name:        r.name,
    type:        r.type,
    description: r.description,
    score:       r.score,
    confidence:  Math.min(100, Math.round(r.score / 120 * 100)),
    reasons:     r.reasons,
  }));
}

module.exports = { rankPaymentMethods };
