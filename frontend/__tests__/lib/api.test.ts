import { rankPayments, getMethods } from '@/lib/api'
import { CheckoutContext } from '@/types/payment'

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => mockFetch.mockClear())

const CONTEXT: CheckoutContext = {
  country: 'KE',
  currency: 'KES',
  deviceType: 'mobile',
  amountUSD: 50,
  isReturning: false,
  previousMethodId: '',
  customerAge: '26-40',
}

const RANKED = [
  { rank: 1, id: 'mpesa', name: 'M-PESA', type: 'mobile_money' as const,
    description: 'Mobile money', score: 74, confidence: 62, reasons: [] },
]

const METHODS = [
  { id: 'mpesa', name: 'M-PESA', type: 'mobile_money' as const,
    description: 'Mobile money', countries: ['KE'], currencies: ['KES'],
    authRate: 0.94, avgProcessingSeconds: 12, minAmount: 0.5, maxAmount: 10000,
    popularOnMobile: true },
]

// ── rankPayments ─────────────────────────────────────────────────────────────

describe('rankPayments', () => {
  test('sends POST to /api/rank with context serialised as JSON body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ranked: RANKED }) })

    await rankPayments(CONTEXT)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/rank',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CONTEXT),
      })
    )
  })

  test('returns the ranked array from the response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ranked: RANKED }) })
    const result = await rankPayments(CONTEXT)
    expect(result).toEqual(RANKED)
  })

  test('throws the server error message when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Missing required fields' })
    await expect(rankPayments(CONTEXT)).rejects.toThrow('Missing required fields')
  })

  test('throws a generic error with status code when body is empty', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => '' })
    await expect(rankPayments(CONTEXT)).rejects.toThrow('Server error 500')
  })
})

// ── getMethods ────────────────────────────────────────────────────────────────

describe('getMethods', () => {
  test('sends GET to /api/methods', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ methods: METHODS }) })
    await getMethods()
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/api/methods')
  })

  test('returns the methods array from the response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ methods: METHODS }) })
    const result = await getMethods()
    expect(result).toEqual(METHODS)
  })

  test('throws a generic error with status code when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(getMethods()).rejects.toThrow('Server error 404')
  })
})
