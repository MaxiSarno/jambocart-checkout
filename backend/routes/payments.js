'use strict';

const { Router }             = require('express');
const paymentMethods         = require('../data/paymentMethods');
const transactions           = require('../data/transactions');
const { rankPaymentMethods } = require('../engine/ranker');

const router = Router();

// GET /api/methods — return full catalogue
router.get('/methods', (_req, res) => {
  res.json({ methods: paymentMethods });
});

// POST /api/rank — rank methods for a given checkout context
router.post('/rank', (req, res) => {
  const {
    country, currency, deviceType, amountUSD,
    isReturning = false, previousMethodId = null, customerAge = null,
  } = req.body;

  if (!country || !currency || !deviceType || amountUSD === undefined) {
    return res.status(400).json({
      error: 'Missing required fields: country, currency, deviceType, amountUSD',
    });
  }

  const context = { country, currency, deviceType, amountUSD,
                    isReturning, previousMethodId, customerAge };

  const ranked = rankPaymentMethods(context);

  res.json({ ranked, context });
});

// GET /api/analytics — dashboard stats from mock transactions
router.get('/analytics', (_req, res) => {
  const methodMap   = Object.fromEntries(paymentMethods.map(m => [m.id, m]));
  const AFRICAN     = ['KE', 'UG', 'TZ', 'GH', 'CM'];
  const INTL_BUCKET = 'US'; // key for all non-KE/UG/TZ transactions

  // ── Overall stats ──────────────────────────────────────────────────────────
  const total    = transactions.length;
  const approved = transactions.filter(t => t.status === 'approved');
  const approvalRate = Math.round((approved.length / total) * 1000) / 10;
  const avgAmount    = Math.round(transactions.reduce((s, t) => s + t.amountUSD, 0) / total * 100) / 100;

  const approvedByMethod = {};
  approved.forEach(t => { approvedByMethod[t.methodId] = (approvedByMethod[t.methodId] || 0) + 1; });
  const topMethodId = Object.entries(approvedByMethod).sort((a, b) => b[1] - a[1])[0][0];

  // ── Method stats ───────────────────────────────────────────────────────────
  const methodStats = paymentMethods.map(method => {
    const all  = transactions.filter(t => t.methodId === method.id);
    if (all.length === 0) return null;
    const appr = all.filter(t => t.status === 'approved');
    const mid  = Math.floor(all.length / 2);
    const firstRate  = all.slice(0, mid).filter(t => t.status === 'approved').length / (mid || 1);
    const secondRate = all.slice(mid).filter(t => t.status === 'approved').length / (all.length - mid || 1);
    const diff = secondRate - firstRate;
    return {
      id:          method.id,
      name:        method.name,
      type:        method.type,
      volume:      all.length,
      approvalRate: Math.round((appr.length / all.length) * 1000) / 10,
      avgAmount:   Math.round(all.reduce((s, t) => s + t.amountUSD, 0) / all.length * 100) / 100,
      trend:       diff > 0.03 ? 'up' : diff < -0.03 ? 'down' : 'stable',
    };
  }).filter(Boolean);

  // ── Methods by country ─────────────────────────────────────────────────────
  const buckets = { KE: [], UG: [], TZ: [], [INTL_BUCKET]: [] };
  transactions.forEach(t => {
    const key = ['KE', 'UG', 'TZ'].includes(t.country) ? t.country : INTL_BUCKET;
    buckets[key].push(t);
  });

  const methodsByCountry = {};
  Object.entries(buckets).forEach(([country, txns]) => {
    const groups = {};
    txns.forEach(t => {
      if (!groups[t.methodId]) groups[t.methodId] = { all: 0, approved: 0 };
      groups[t.methodId].all++;
      if (t.status === 'approved') groups[t.methodId].approved++;
    });
    methodsByCountry[country] = Object.entries(groups)
      .map(([methodId, { all: v, approved: a }]) => ({
        methodId,
        name:        methodMap[methodId]?.name || methodId,
        type:        methodMap[methodId]?.type || 'card',
        approvalRate: Math.round((a / v) * 1000) / 10,
        volume:       v,
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 3);
  });

  // ── Signal performance ─────────────────────────────────────────────────────
  const sig = {
    geographic: { conversions: 0, totalScore: 0 },
    authRate:   { conversions: 0, totalScore: 0 },
    device:     { conversions: 0, totalScore: 0 },
    amount:     { conversions: 0, totalScore: 0 },
    history:    { conversions: 0, totalScore: 0 },
  };

  const sortedApproved = approved.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const custMethods = {};

  sortedApproved.forEach(t => {
    const method = methodMap[t.methodId];
    if (!method) return;

    // Geographic (base 30 + intl card bonus)
    const geoBonus = method.type === 'card' && !AFRICAN.includes(t.country) ? 15 : 0;
    sig.geographic.conversions++;
    sig.geographic.totalScore += 30 + geoBonus;

    // Auth rate (all methods above 0.70)
    const authBonus = Math.max(0, Math.round((method.authRate - 0.70) * 100));
    if (authBonus > 0) { sig.authRate.conversions++; sig.authRate.totalScore += authBonus; }

    // Device affinity
    if (t.deviceType === 'mobile' && method.popularOnMobile) {
      sig.device.conversions++; sig.device.totalScore += 20;
    } else if (t.deviceType === 'desktop' && method.type === 'card') {
      sig.device.conversions++; sig.device.totalScore += 10;
    }

    // Amount fit
    if (method.type === 'bnpl' && t.amountUSD >= 100) {
      sig.amount.conversions++; sig.amount.totalScore += 25;
    } else if ((method.type === 'mobile_money' || method.type === 'wallet') && t.amountUSD < 50) {
      sig.amount.conversions++; sig.amount.totalScore += 10;
    }

    // Historical preference (returning customer with same method)
    if (custMethods[t.customerId]?.has(t.methodId)) {
      sig.history.conversions++; sig.history.totalScore += 50;
    }
    if (!custMethods[t.customerId]) custMethods[t.customerId] = new Set();
    custMethods[t.customerId].add(t.methodId);
  });

  const avg = (s, n) => n ? Math.round(s / n * 10) / 10 : 0;
  const signalPerformance = [
    { signal: 'Geographic match',    ...sig.geographic, avgScore: avg(sig.geographic.totalScore, sig.geographic.conversions), description: "Boosts methods available in the customer's country and currency" },
    { signal: 'Authorization rate',  ...sig.authRate,   avgScore: avg(sig.authRate.totalScore,   sig.authRate.conversions),   description: 'Rewards methods with higher historical approval rates' },
    { signal: 'Device affinity',     ...sig.device,     avgScore: avg(sig.device.totalScore,     sig.device.conversions),     description: 'Matches mobile-optimised methods on mobile devices' },
    { signal: 'Amount fit',          ...sig.amount,     avgScore: avg(sig.amount.totalScore,     sig.amount.conversions),     description: 'Promotes BNPL for large purchases and mobile money for small amounts' },
    { signal: 'Historical preference',...sig.history,   avgScore: avg(sig.history.totalScore,    sig.history.conversions),    description: "Re-surfaces the payment method from the customer's last purchase" },
  ]
    .map(({ totalScore: _t, ...rest }) => rest)
    .sort((a, b) => b.conversions - a.conversions);

  res.json({
    signalPerformance,
    methodsByCountry,
    overallStats: {
      totalTransactions: total,
      approvalRate,
      topMethod: methodMap[topMethodId]?.name || topMethodId,
      avgAmount,
    },
    methodStats,
  });
});

module.exports = router;
