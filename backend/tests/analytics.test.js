'use strict';

const request = require('supertest');
const app     = require('../src/app');

// ── GET /api/analytics ────────────────────────────────────────────────────────

describe('GET /api/analytics', () => {
  let body;

  beforeAll(async () => {
    const res = await request(app).get('/api/analytics');
    expect(res.status).toBe(200);
    body = res.body;
  });

  // ── Top-level shape ─────────────────────────────────────────────────────────

  test('returns 200 with all required top-level keys', async () => {
    const res = await request(app).get('/api/analytics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('overallStats');
    expect(res.body).toHaveProperty('signalPerformance');
    expect(res.body).toHaveProperty('methodsByCountry');
    expect(res.body).toHaveProperty('methodStats');
  });

  // ── overallStats ────────────────────────────────────────────────────────────

  describe('overallStats', () => {
    test('has required numeric fields', () => {
      const { overallStats: s } = body;
      expect(typeof s.totalTransactions).toBe('number');
      expect(typeof s.approvalRate).toBe('number');
      expect(typeof s.avgAmount).toBe('number');
      expect(typeof s.topMethod).toBe('string');
    });

    test('approvalRate is between 0 and 100', () => {
      expect(body.overallStats.approvalRate).toBeGreaterThanOrEqual(0);
      expect(body.overallStats.approvalRate).toBeLessThanOrEqual(100);
    });

    test('totalTransactions is a positive integer', () => {
      expect(Number.isInteger(body.overallStats.totalTransactions)).toBe(true);
      expect(body.overallStats.totalTransactions).toBeGreaterThan(0);
    });

    test('avgAmount is positive', () => {
      expect(body.overallStats.avgAmount).toBeGreaterThan(0);
    });

    test('topMethod is a non-empty string', () => {
      expect(body.overallStats.topMethod.length).toBeGreaterThan(0);
    });
  });

  // ── signalPerformance ───────────────────────────────────────────────────────

  describe('signalPerformance', () => {
    test('is a non-empty array', () => {
      expect(Array.isArray(body.signalPerformance)).toBe(true);
      expect(body.signalPerformance.length).toBeGreaterThan(0);
    });

    test('each signal has required fields', () => {
      body.signalPerformance.forEach(s => {
        expect(typeof s.signal).toBe('string');
        expect(typeof s.description).toBe('string');
        expect(typeof s.conversions).toBe('number');
        expect(typeof s.avgScore).toBe('number');
      });
    });

    test('contains the five expected signals', () => {
      const names = body.signalPerformance.map(s => s.signal);
      expect(names).toContain('Geographic match');
      expect(names).toContain('Authorization rate');
      expect(names).toContain('Device affinity');
      expect(names).toContain('Amount fit');
      expect(names).toContain('Historical preference');
    });

    test('signals are sorted descending by conversions', () => {
      const conversions = body.signalPerformance.map(s => s.conversions);
      for (let i = 0; i < conversions.length - 1; i++) {
        expect(conversions[i]).toBeGreaterThanOrEqual(conversions[i + 1]);
      }
    });

    test('conversions and avgScore are non-negative', () => {
      body.signalPerformance.forEach(s => {
        expect(s.conversions).toBeGreaterThanOrEqual(0);
        expect(s.avgScore).toBeGreaterThanOrEqual(0);
      });
    });

    test('does not expose totalScore field', () => {
      body.signalPerformance.forEach(s => {
        expect(s).not.toHaveProperty('totalScore');
      });
    });
  });

  // ── methodsByCountry ────────────────────────────────────────────────────────

  describe('methodsByCountry', () => {
    test('includes buckets for KE, UG, TZ, and US', () => {
      expect(body.methodsByCountry).toHaveProperty('KE');
      expect(body.methodsByCountry).toHaveProperty('UG');
      expect(body.methodsByCountry).toHaveProperty('TZ');
      expect(body.methodsByCountry).toHaveProperty('US');
    });

    test('each bucket has at most 3 entries', () => {
      Object.values(body.methodsByCountry).forEach(methods => {
        expect(methods.length).toBeLessThanOrEqual(3);
      });
    });

    test('each country method entry has required fields', () => {
      Object.values(body.methodsByCountry).forEach(methods => {
        methods.forEach(m => {
          expect(typeof m.methodId).toBe('string');
          expect(typeof m.name).toBe('string');
          expect(typeof m.type).toBe('string');
          expect(typeof m.approvalRate).toBe('number');
          expect(typeof m.volume).toBe('number');
        });
      });
    });

    test('KE bucket contains Visa (highest volume in mock data)', () => {
      const ke = body.methodsByCountry['KE'];
      const ids = ke.map(m => m.methodId);
      expect(ids).toContain('visa');
    });

    test('approvalRate in each entry is between 0 and 100', () => {
      Object.values(body.methodsByCountry).forEach(methods => {
        methods.forEach(m => {
          expect(m.approvalRate).toBeGreaterThanOrEqual(0);
          expect(m.approvalRate).toBeLessThanOrEqual(100);
        });
      });
    });
  });

  // ── methodStats ─────────────────────────────────────────────────────────────

  describe('methodStats', () => {
    test('is a non-empty array', () => {
      expect(Array.isArray(body.methodStats)).toBe(true);
      expect(body.methodStats.length).toBeGreaterThan(0);
    });

    test('each entry has required fields', () => {
      body.methodStats.forEach(m => {
        expect(typeof m.id).toBe('string');
        expect(typeof m.name).toBe('string');
        expect(typeof m.type).toBe('string');
        expect(typeof m.volume).toBe('number');
        expect(typeof m.approvalRate).toBe('number');
        expect(typeof m.avgAmount).toBe('number');
        expect(['up', 'down', 'stable']).toContain(m.trend);
      });
    });

    test('approvalRate is between 0 and 100 for every method', () => {
      body.methodStats.forEach(m => {
        expect(m.approvalRate).toBeGreaterThanOrEqual(0);
        expect(m.approvalRate).toBeLessThanOrEqual(100);
      });
    });

    test('volume and avgAmount are positive', () => {
      body.methodStats.forEach(m => {
        expect(m.volume).toBeGreaterThan(0);
        expect(m.avgAmount).toBeGreaterThan(0);
      });
    });

    test('only includes methods that have transaction data', () => {
      // Methods with no transactions are filtered out (null-filtered in handler)
      body.methodStats.forEach(m => {
        expect(m.volume).toBeGreaterThan(0);
      });
    });
  });
});
