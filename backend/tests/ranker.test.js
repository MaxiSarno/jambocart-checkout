'use strict';

const { rankPaymentMethods } = require('../engine/ranker');

const BASE = {
  country: 'KE',
  currency: 'KES',
  deviceType: 'mobile',
  amountUSD: 50,
  isReturning: false,
  previousMethodId: null,
  customerAge: null,
};

// ── Signal 1: Geographic filtering ───────────────────────────────────────────

describe('Signal 1 — Geographic filtering', () => {
  test('excludes methods that do not support the country', () => {
    const ids = rankPaymentMethods({ ...BASE, country: 'US', currency: 'USD' }).map(r => r.id);
    expect(ids).not.toContain('mpesa');        // KE only
    expect(ids).not.toContain('mtn_momo');     // UG, GH only
    expect(ids).not.toContain('lipa_later');   // KE only
  });

  test('excludes methods that do not support the currency', () => {
    const ids = rankPaymentMethods({ ...BASE, currency: 'EUR' }).map(r => r.id);
    expect(ids).not.toContain('mpesa');        // KES only
    expect(ids).not.toContain('airtel_money'); // KES, UGX, TZS only
  });

  test('includes methods that match country and currency', () => {
    const ids = rankPaymentMethods(BASE).map(r => r.id);
    expect(ids).toContain('mpesa');
    expect(ids).toContain('visa');
    expect(ids).toContain('lipa_later');
  });

  test('applies +15 card bonus in non-African countries', () => {
    // Hold all signals constant except geo; use desktop to avoid mobile bonus on cards
    const keCtx = { ...BASE, deviceType: 'desktop' };
    const usCtx = { ...BASE, country: 'US', currency: 'USD', deviceType: 'desktop' };

    const visaKE = rankPaymentMethods(keCtx).find(r => r.id === 'visa');
    const visaUS = rankPaymentMethods(usCtx).find(r => r.id === 'visa');

    expect(visaUS.score - visaKE.score).toBe(15);
  });

  test('does not apply card bonus in African countries', () => {
    const result = rankPaymentMethods({ ...BASE, deviceType: 'desktop' });
    const visa = result.find(r => r.id === 'visa');
    expect(visa.reasons).not.toContain('Preferred payment method internationally');
  });
});

// ── Signal 2: Historical preference ──────────────────────────────────────────

describe('Signal 2 — Historical preference', () => {
  test('gives +50 when the method matches the customer\'s previous method', () => {
    const withPrev    = rankPaymentMethods({ ...BASE, isReturning: true, previousMethodId: 'mpesa' });
    const withoutPrev = rankPaymentMethods(BASE);

    const mpeWith    = withPrev.find(r => r.id === 'mpesa');
    const mpeWithout = withoutPrev.find(r => r.id === 'mpesa');

    expect(mpeWith.score - mpeWithout.score).toBe(50);
  });

  test('includes "Used in your last purchase" reason for previous method', () => {
    const result = rankPaymentMethods({ ...BASE, isReturning: true, previousMethodId: 'mpesa' });
    const mpesa  = result.find(r => r.id === 'mpesa');
    expect(mpesa.reasons).toContain('Used in your last purchase');
  });

  test('does not give history bonus to non-returning customers', () => {
    const withPrev    = rankPaymentMethods({ ...BASE, isReturning: false, previousMethodId: 'mpesa' });
    const withoutPrev = rankPaymentMethods(BASE);

    const mpeWith    = withPrev.find(r => r.id === 'mpesa');
    const mpeWithout = withoutPrev.find(r => r.id === 'mpesa');

    expect(mpeWith.score).toBe(mpeWithout.score);
  });
});

// ── Signal 3: Device affinity ─────────────────────────────────────────────────

describe('Signal 3 — Device affinity', () => {
  test('gives +20 to mobile-popular methods on mobile vs desktop', () => {
    const mobileCtx  = { ...BASE, deviceType: 'mobile' };
    const desktopCtx = { ...BASE, deviceType: 'desktop' };

    const mpesaMobile  = rankPaymentMethods(mobileCtx).find(r => r.id === 'mpesa');
    const mpesaDesktop = rankPaymentMethods(desktopCtx).find(r => r.id === 'mpesa');

    expect(mpesaMobile.score - mpesaDesktop.score).toBe(20);
  });

  test('gives +10 to card methods on desktop vs mobile', () => {
    const mobileCtx  = { ...BASE, country: 'US', currency: 'USD', deviceType: 'mobile' };
    const desktopCtx = { ...BASE, country: 'US', currency: 'USD', deviceType: 'desktop' };

    const visaMobile  = rankPaymentMethods(mobileCtx).find(r => r.id === 'visa');
    const visaDesktop = rankPaymentMethods(desktopCtx).find(r => r.id === 'visa');

    expect(visaDesktop.score - visaMobile.score).toBe(10);
  });

  test('does not give mobile bonus to card methods', () => {
    const result = rankPaymentMethods(BASE);
    const visa   = result.find(r => r.id === 'visa');
    expect(visa.reasons).not.toContain('Optimised for mobile');
  });
});

// ── Signal 4: Amount fit ──────────────────────────────────────────────────────

describe('Signal 4 — Amount fit', () => {
  test('excludes methods whose minAmount exceeds the purchase amount', () => {
    // SWIFT has minAmount=100; at $50 it must be excluded
    const ids = rankPaymentMethods(BASE).map(r => r.id);
    expect(ids).not.toContain('swift');
  });

  test('excludes methods whose maxAmount is below the purchase amount', () => {
    // airtel_money has maxAmount=5000; at $6000 it must be excluded
    const ids = rankPaymentMethods({ ...BASE, amountUSD: 6000 }).map(r => r.id);
    expect(ids).not.toContain('airtel_money');
  });

  test('gives +25 to BNPL methods for amounts >= $100', () => {
    const highCtx = { ...BASE, amountUSD: 100 };
    const lowCtx  = { ...BASE, amountUSD: 50 };

    const lipaHigh = rankPaymentMethods(highCtx).find(r => r.id === 'lipa_later');
    const lipaLow  = rankPaymentMethods(lowCtx).find(r => r.id === 'lipa_later');

    expect(lipaHigh.score - lipaLow.score).toBe(25);
  });

  test('gives additional +10 to BNPL for customer age 18-25', () => {
    const youngCtx = { ...BASE, amountUSD: 100, customerAge: '18-25' };
    const adultCtx = { ...BASE, amountUSD: 100, customerAge: '26-40' };

    const lipaYoung = rankPaymentMethods(youngCtx).find(r => r.id === 'lipa_later');
    const lipaAdult = rankPaymentMethods(adultCtx).find(r => r.id === 'lipa_later');

    expect(lipaYoung.score - lipaAdult.score).toBe(10);
  });

  test('gives +10 to mobile_money methods for amounts < $50', () => {
    const smallCtx = { ...BASE, amountUSD: 30 };
    const bigCtx   = { ...BASE, amountUSD: 50 };  // $50 is NOT < 50, no bonus

    const mpeSmall = rankPaymentMethods(smallCtx).find(r => r.id === 'mpesa');
    const mpeBig   = rankPaymentMethods(bigCtx).find(r => r.id === 'mpesa');

    expect(mpeSmall.score - mpeBig.score).toBe(10);
  });
});

// ── Signal 4b: Processing speed ───────────────────────────────────────────────

describe('Signal 4b — Processing speed', () => {
  test('penalises slow methods (-20) for amounts under $1000', () => {
    // SWIFT: avgProcessingSeconds=172800 > 3600, and $500 < $1000
    const result = rankPaymentMethods({ ...BASE, amountUSD: 500 });
    const swift  = result.find(r => r.id === 'swift');
    expect(swift.reasons).toContain('Slow transfer — not ideal for this amount');
  });

  test('does not penalise slow methods for amounts >= $1000', () => {
    const result = rankPaymentMethods({ ...BASE, amountUSD: 1500 });
    const swift  = result.find(r => r.id === 'swift');
    expect(swift.reasons).not.toContain('Slow transfer — not ideal for this amount');
  });

  test('gives +5 instant bonus to methods with avgProcessingSeconds <= 10', () => {
    // Visa has avgProcessingSeconds=4; use desktop so we can isolate speed
    const result = rankPaymentMethods({ ...BASE, deviceType: 'desktop' });
    const visa   = result.find(r => r.id === 'visa');
    expect(visa.reasons).toContain('Instant payment');
  });

  test('does not give instant bonus to methods with avgProcessingSeconds > 10', () => {
    // M-PESA has avgProcessingSeconds=12
    const result = rankPaymentMethods(BASE);
    const mpesa  = result.find(r => r.id === 'mpesa');
    expect(mpesa.reasons).not.toContain('Instant payment');
  });
});

// ── Signal 5: Authorization rate ─────────────────────────────────────────────

describe('Signal 5 — Authorization rate', () => {
  test('adds bonus = round((authRate - 0.70) × 100)', () => {
    // M-PESA authRate=0.94 → bonus=24; PesaLink authRate=0.97 → bonus=27
    const result   = rankPaymentMethods(BASE);
    const mpesa    = result.find(r => r.id === 'mpesa');
    const pesalink = result.find(r => r.id === 'pesalink');

    // PesaLink should score 3 pts higher from auth rate alone
    expect(pesalink.reasons).toContain('97% approval rate');
    expect(mpesa.reasons).toContain('94% approval rate');
  });

  test('auth rate bonus is never negative', () => {
    // Aspira authRate=0.73 → bonus = round(3) = 3, not negative
    const result = rankPaymentMethods({ ...BASE, amountUSD: 100 });
    const aspira = result.find(r => r.id === 'aspira');
    expect(aspira.score).toBeGreaterThanOrEqual(0);
  });
});

// ── Overall ranking behavior ──────────────────────────────────────────────────

describe('Overall ranking behavior', () => {
  test('results are sorted by score descending', () => {
    const result = rankPaymentMethods(BASE);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
    }
  });

  test('ranks are sequential starting from 1', () => {
    const result = rankPaymentMethods(BASE);
    result.forEach((r, i) => expect(r.rank).toBe(i + 1));
  });

  test('confidence is always between 0 and 100 inclusive', () => {
    const result = rankPaymentMethods(BASE);
    result.forEach(r => {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(100);
    });
  });

  test('each result has all required fields', () => {
    const result = rankPaymentMethods(BASE);
    result.forEach(r => {
      expect(r).toHaveProperty('rank');
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('type');
      expect(r).toHaveProperty('description');
      expect(r).toHaveProperty('score');
      expect(r).toHaveProperty('confidence');
      expect(r).toHaveProperty('reasons');
      expect(Array.isArray(r.reasons)).toBe(true);
    });
  });

  test('returns empty array when no method is eligible for the amount', () => {
    // All methods have minAmount >= 0.01; at $0.001 everything is excluded
    const result = rankPaymentMethods({ ...BASE, amountUSD: 0.001 });
    expect(result).toEqual([]);
  });

  test('M-PESA ranks #1 for a typical Kenyan mobile checkout', () => {
    const result = rankPaymentMethods({
      ...BASE,
      isReturning: true,
      previousMethodId: 'mpesa',
    });
    expect(result[0].id).toBe('mpesa');
  });
});
