'use strict';

const request = require('supertest');
const app     = require('../src/app');

const VALID_BODY = {
  country: 'KE',
  currency: 'KES',
  deviceType: 'mobile',
  amountUSD: 50,
};

// ── GET /health ───────────────────────────────────────────────────────────────

describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('jambocart-backend');
    expect(res.body).toHaveProperty('port');
  });
});

// ── GET /api/methods ──────────────────────────────────────────────────────────

describe('GET /api/methods', () => {
  test('returns 200 with an array of payment methods', async () => {
    const res = await request(app).get('/api/methods');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('methods');
    expect(Array.isArray(res.body.methods)).toBe(true);
  });

  test('returns exactly 12 payment methods', async () => {
    const res = await request(app).get('/api/methods');
    expect(res.body.methods).toHaveLength(12);
  });

  test('each method has required fields', async () => {
    const res = await request(app).get('/api/methods');
    res.body.methods.forEach(m => {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('name');
      expect(m).toHaveProperty('type');
      expect(m).toHaveProperty('countries');
      expect(m).toHaveProperty('currencies');
      expect(m).toHaveProperty('authRate');
    });
  });
});

// ── POST /api/rank ────────────────────────────────────────────────────────────

describe('POST /api/rank', () => {
  test('returns 200 with ranked array and context for a valid request', async () => {
    const res = await request(app).post('/api/rank').send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.ranked)).toBe(true);
    expect(res.body).toHaveProperty('context');
  });

  test('ranked results are in descending score order', async () => {
    const res    = await request(app).post('/api/rank').send(VALID_BODY);
    const ranked = res.body.ranked;
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i + 1].score);
    }
  });

  test('each ranked result has required fields', async () => {
    const res = await request(app).post('/api/rank').send(VALID_BODY);
    res.body.ranked.forEach(r => {
      expect(r).toHaveProperty('rank');
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('type');
      expect(r).toHaveProperty('score');
      expect(r).toHaveProperty('confidence');
      expect(r).toHaveProperty('reasons');
    });
  });

  test('context in response mirrors the request body', async () => {
    const res = await request(app).post('/api/rank').send(VALID_BODY);
    expect(res.body.context.country).toBe(VALID_BODY.country);
    expect(res.body.context.currency).toBe(VALID_BODY.currency);
    expect(res.body.context.deviceType).toBe(VALID_BODY.deviceType);
    expect(res.body.context.amountUSD).toBe(VALID_BODY.amountUSD);
  });

  test('applies optional fields with defaults when omitted', async () => {
    const res = await request(app).post('/api/rank').send(VALID_BODY);
    expect(res.body.context.isReturning).toBe(false);
    expect(res.body.context.previousMethodId).toBeNull();
    expect(res.body.context.customerAge).toBeNull();
  });

  test('returns 400 when country is missing', async () => {
    const { country: _c, ...body } = VALID_BODY;
    const res = await request(app).post('/api/rank').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when currency is missing', async () => {
    const { currency: _c, ...body } = VALID_BODY;
    const res = await request(app).post('/api/rank').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when deviceType is missing', async () => {
    const { deviceType: _d, ...body } = VALID_BODY;
    const res = await request(app).post('/api/rank').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when amountUSD is missing', async () => {
    const { amountUSD: _a, ...body } = VALID_BODY;
    const res = await request(app).post('/api/rank').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('M-PESA ranks #1 for a returning KE mobile customer who used it before', async () => {
    const body = {
      ...VALID_BODY,
      isReturning: true,
      previousMethodId: 'mpesa',
    };
    const res = await request(app).post('/api/rank').send(body);
    expect(res.body.ranked[0].id).toBe('mpesa');
  });

  test('KE-only methods are absent when country is US', async () => {
    const body = { ...VALID_BODY, country: 'US', currency: 'USD' };
    const res  = await request(app).post('/api/rank').send(body);
    const ids  = res.body.ranked.map(r => r.id);
    expect(ids).not.toContain('mpesa');
    expect(ids).not.toContain('lipa_later');
    expect(ids).not.toContain('pesalink');
  });

  test('confidence values are between 0 and 100', async () => {
    const res = await request(app).post('/api/rank').send(VALID_BODY);
    res.body.ranked.forEach(r => {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(100);
    });
  });
});
