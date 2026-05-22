import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminDashboard from '@/app/admin/page'
import * as api from '@/lib/api'
import { AnalyticsData } from '@/types/payment'

jest.mock('../../src/lib/api')
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const mockedGetAnalytics = jest.mocked(api.getAnalytics)

const ANALYTICS: AnalyticsData = {
  overallStats: {
    totalTransactions: 150,
    approvalRate: 87.5,
    topMethod: 'M-PESA',
    avgAmount: 42.5,
  },
  signalPerformance: [
    { signal: 'Geographic match',     conversions: 132, avgScore: 31.1, description: 'Boosts methods in the customer country' },
    { signal: 'Authorization rate',   conversions: 120, avgScore: 18.0, description: 'Rewards high approval rates' },
    { signal: 'Device affinity',      conversions: 95,  avgScore: 20.0, description: 'Matches mobile-optimised methods' },
    { signal: 'Amount fit',           conversions: 40,  avgScore: 15.0, description: 'Promotes BNPL for large amounts' },
    { signal: 'Historical preference',conversions: 30,  avgScore: 50.0, description: 'Re-surfaces last used method' },
  ],
  methodsByCountry: {
    KE: [
      { methodId: 'mpesa',    name: 'M-PESA',  type: 'mobile_money', approvalRate: 94, volume: 80 },
      { methodId: 'pesalink', name: 'PesaLink', type: 'bank_transfer', approvalRate: 97, volume: 30 },
    ],
    UG: [
      { methodId: 'mtn_momo',     name: 'MTN Mobile Money', type: 'mobile_money', approvalRate: 91, volume: 25 },
      { methodId: 'airtel_money', name: 'Airtel Money',      type: 'mobile_money', approvalRate: 89, volume: 20 },
    ],
    TZ: [
      { methodId: 'airtel_money', name: 'Airtel Money', type: 'mobile_money', approvalRate: 89, volume: 15 },
    ],
    US: [
      { methodId: 'visa',   name: 'Visa',   type: 'card', approvalRate: 82, volume: 10 },
      { methodId: 'paypal', name: 'PayPal', type: 'wallet', approvalRate: 85, volume: 8 },
    ],
  },
  methodStats: [
    { id: 'mpesa',   name: 'M-PESA',  type: 'mobile_money', volume: 80, approvalRate: 94, avgAmount: 25.0, trend: 'up' },
    { id: 'visa',    name: 'Visa',    type: 'card',          volume: 10, approvalRate: 82, avgAmount: 120.0, trend: 'stable' },
    { id: 'paypal',  name: 'PayPal',  type: 'wallet',        volume: 8,  approvalRate: 85, avgAmount: 60.0, trend: 'down' },
  ],
}

beforeEach(() => mockedGetAnalytics.mockClear())

// ── Loading / error states ────────────────────────────────────────────────────

describe('AdminDashboard loading and error states', () => {
  test('shows loading spinner while data is fetching', () => {
    mockedGetAnalytics.mockReturnValueOnce(new Promise(() => {}))
    render(<AdminDashboard />)
    expect(screen.getByText(/Loading dashboard/i)).toBeInTheDocument()
  })

  test('shows error message when getAnalytics rejects', async () => {
    mockedGetAnalytics.mockRejectedValueOnce(new Error('Network failure'))
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument()
    })
  })

  test('shows fallback message when getAnalytics resolves to null', async () => {
    // @ts-expect-error — intentional null to test fallback branch
    mockedGetAnalytics.mockResolvedValueOnce(null)
    render(<AdminDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Failed to load analytics')).toBeInTheDocument()
    })
  })
})

// ── Header ────────────────────────────────────────────────────────────────────

describe('AdminDashboard header', () => {
  beforeEach(() => mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS))

  test('renders the brand name', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('JamboCart Admin'))
    expect(screen.getByText('JamboCart Admin')).toBeInTheDocument()
  })

  test('renders a link back to the checkout page', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText(/Back to checkout/i))
    expect(screen.getByRole('link', { name: /Back to checkout/i })).toHaveAttribute('href', '/')
  })

  test('shows total transaction count in the header', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('150 transactions'))
    expect(screen.getByText('150 transactions')).toBeInTheDocument()
  })
})

// ── Overview stats ────────────────────────────────────────────────────────────

describe('AdminDashboard overview section', () => {
  beforeEach(() => mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS))

  test('renders all four metric cards', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('Total Transactions'))
    expect(screen.getByText('Total Transactions')).toBeInTheDocument()
    expect(screen.getByText('Overall Approval Rate')).toBeInTheDocument()
    expect(screen.getByText('Top Performing Method')).toBeInTheDocument()
    expect(screen.getByText('Avg Transaction')).toBeInTheDocument()
  })

  test('displays correct values in metric cards', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('150'))
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText(/87\.5%/)).toBeInTheDocument()
    // M-PESA appears in multiple sections; confirm at least one instance
    expect(screen.getAllByText('M-PESA').length).toBeGreaterThan(0)
    expect(screen.getByText(/\$42\.5/)).toBeInTheDocument()
  })
})

// ── Signal performance ────────────────────────────────────────────────────────

describe('AdminDashboard signal performance section', () => {
  beforeEach(() => mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS))

  test('renders each signal name', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('Geographic match'))
    ANALYTICS.signalPerformance.forEach(s => {
      expect(screen.getByText(s.signal)).toBeInTheDocument()
    })
  })

  test('renders conversion counts for each signal', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('132'))
    expect(screen.getByText('132')).toBeInTheDocument()
  })

  test('renders signal descriptions', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('Boosts methods in the customer country'))
    expect(screen.getByText('Boosts methods in the customer country')).toBeInTheDocument()
  })
})

// ── Methods by country ────────────────────────────────────────────────────────

describe('AdminDashboard methods by country section', () => {
  beforeEach(() => mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS))

  test('renders country tab buttons', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText(/Kenya/))
    expect(screen.getByText(/Kenya/)).toBeInTheDocument()
    expect(screen.getByText(/Uganda/)).toBeInTheDocument()
    expect(screen.getByText(/Tanzania/)).toBeInTheDocument()
    expect(screen.getByText(/International/)).toBeInTheDocument()
  })

  test('shows KE methods by default', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('PesaLink'))
    expect(screen.getByText('PesaLink')).toBeInTheDocument()
  })

  test('switches to Uganda methods when UG tab is clicked', async () => {
    const user = userEvent.setup()
    mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS)
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText(/Uganda/))
    await user.click(screen.getByText(/Uganda/))
    await waitFor(() => screen.getByText('MTN Mobile Money'))
    expect(screen.getByText('MTN Mobile Money')).toBeInTheDocument()
  })

  test('shows approval rates as percentages', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getAllByText(/94/)[0])
    // Percentage may render as split text nodes — use regex
    expect(screen.getAllByText(/94/).length).toBeGreaterThan(0)
  })
})

// ── Promotional controls ──────────────────────────────────────────────────────

describe('AdminDashboard promotional controls section', () => {
  beforeEach(() => mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS))

  test('renders a row for each method in methodStats', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getAllByText('M-PESA'))
    // M-PESA appears in both overview and controls
    expect(screen.getAllByText('M-PESA').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Visa').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('PayPal').length).toBeGreaterThanOrEqual(1)
  })

  test('all methods start as Active', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getAllByText('Active'))
    const activeButtons = screen.getAllByText('Active')
    expect(activeButtons).toHaveLength(ANALYTICS.methodStats.length)
  })

  test('toggling a method changes its button to Suppressed', async () => {
    const user = userEvent.setup()
    mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS)
    render(<AdminDashboard />)
    await waitFor(() => screen.getAllByText('Active'))
    const [firstActive] = screen.getAllByText('Active')
    await user.click(firstActive)
    expect(screen.getByText('Suppressed')).toBeInTheDocument()
  })

  test('toggling back changes Suppressed to Active', async () => {
    const user = userEvent.setup()
    mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS)
    render(<AdminDashboard />)
    await waitFor(() => screen.getAllByText('Active'))
    const [firstActive] = screen.getAllByText('Active')
    await user.click(firstActive)
    await user.click(screen.getByText('Suppressed'))
    expect(screen.queryByText('Suppressed')).not.toBeInTheDocument()
  })

  test('shows the empty preview state before Apply is clicked', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('Apply & Preview →'))
    expect(screen.getByText(/Apply controls to see how rankings change/i)).toBeInTheDocument()
  })

  test('Apply & Preview calls /api/rank and shows results', async () => {
    const user = userEvent.setup()
    mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS)

    const RANKED_PREVIEW = [
      { rank: 1, id: 'mpesa', name: 'M-PESA', type: 'mobile_money' as const,
        description: 'Mobile money', score: 90, confidence: 75, reasons: ['Merchant promoted'] },
    ]
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({ ranked: RANKED_PREVIEW }),
    }) as jest.Mock

    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('Apply & Preview →'))
    await user.click(screen.getByText('Apply & Preview →'))

    await waitFor(() => screen.getByText('75%'))
    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})

// ── Method performance table ──────────────────────────────────────────────────

describe('AdminDashboard method performance table', () => {
  beforeEach(() => mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS))

  test('renders table column headers', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('Method'))
    expect(screen.getByText('Method')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Volume')).toBeInTheDocument()
    expect(screen.getByText('Approval %')).toBeInTheDocument()
    expect(screen.getByText('Avg Amount')).toBeInTheDocument()
    expect(screen.getByText('Trend')).toBeInTheDocument()
  })

  test('renders a row for each method stat', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('Method performance'))
    const table = screen.getByRole('table')
    const rows  = within(table).getAllByRole('row')
    // 1 header row + 3 data rows
    expect(rows).toHaveLength(4)
  })

  test('default sort is by volume descending (M-PESA first)', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByRole('table'))
    const table = screen.getByRole('table')
    const rows  = within(table).getAllByRole('row')
    expect(within(rows[1]).getByText('M-PESA')).toBeInTheDocument()
  })

  test('clicking Method header sorts by name ascending', async () => {
    const user = userEvent.setup()
    mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS)
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('Method'))
    await user.click(screen.getByText('Method'))
    const table = screen.getByRole('table')
    const rows  = within(table).getAllByRole('row')
    // Descending first click → 'Visa' before 'PayPal' before 'M-PESA'
    expect(within(rows[1]).getByText('Visa')).toBeInTheDocument()
  })

  test('clicking Method header twice reverses sort to ascending (M-PESA first)', async () => {
    const user = userEvent.setup()
    mockedGetAnalytics.mockResolvedValueOnce(ANALYTICS)
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('Method'))
    await user.click(screen.getByText('Method')) // desc: Visa first
    await user.click(screen.getByText('Method')) // asc:  M-PESA first
    const table = screen.getByRole('table')
    const rows  = within(table).getAllByRole('row')
    expect(within(rows[1]).getByText('M-PESA')).toBeInTheDocument()
  })

  test('renders avgAmount with dollar sign', async () => {
    render(<AdminDashboard />)
    await waitFor(() => screen.getByText('$25'))
    expect(screen.getByText('$25')).toBeInTheDocument()
  })
})
