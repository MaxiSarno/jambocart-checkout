'use strict';

const { Router }           = require('express');
const paymentMethods       = require('../data/paymentMethods');
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

module.exports = router;
