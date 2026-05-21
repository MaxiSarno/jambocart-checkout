import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '@/app/page'
import * as api from '@/lib/api'
import { PaymentMethod } from '@/types/payment'

jest.mock('../../src/lib/api')
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const mockedRankPayments = jest.mocked(api.rankPayments)

const RESULTS: PaymentMethod[] = [
  { rank: 1, id: 'mpesa',  name: 'M-PESA', type: 'mobile_money',
    description: 'Mobile money', score: 74, confidence: 62, reasons: ['Fast'] },
  { rank: 2, id: 'visa',   name: 'Visa',   type: 'card',
    description: 'Card', score: 57, confidence: 47, reasons: ['International'] },
]

beforeEach(() => mockedRankPayments.mockClear())

describe('Home page', () => {
  test('renders the 3 quick scenario buttons', () => {
    render(<Home />)
    expect(screen.getByText(/Nairobi mobile shopper/)).toBeInTheDocument()
    expect(screen.getByText(/International buyer/)).toBeInTheDocument()
    expect(screen.getByText(/Student installments/)).toBeInTheDocument()
  })

  test('shows placeholder text before any search is made', () => {
    render(<Home />)
    expect(screen.getByText(/Select a scenario or fill the form/)).toBeInTheDocument()
  })

  test('shows ranked results after clicking a quick scenario', async () => {
    const user = userEvent.setup()
    mockedRankPayments.mockResolvedValueOnce(RESULTS)

    render(<Home />)
    await user.click(screen.getByText(/Nairobi mobile shopper/))

    await waitFor(() => {
      expect(screen.getByText('M-PESA')).toBeInTheDocument()
    })
  })

  test('calls rankPayments with the correct context for a scenario', async () => {
    const user = userEvent.setup()
    mockedRankPayments.mockResolvedValueOnce(RESULTS)

    render(<Home />)
    await user.click(screen.getByText(/Nairobi mobile shopper/))

    await waitFor(() => {
      expect(mockedRankPayments).toHaveBeenCalledWith(
        expect.objectContaining({
          country: 'KE',
          currency: 'KES',
          deviceType: 'mobile',
          amountUSD: 45,
          customerAge: '26-40',
        })
      )
    })
  })

  test('displays the error message when the API call fails', async () => {
    const user = userEvent.setup()
    mockedRankPayments.mockRejectedValueOnce(new Error('Connection refused'))

    render(<Home />)
    await user.click(screen.getByText(/Nairobi mobile shopper/))

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeInTheDocument()
    })
  })

  test('renders the JamboCart brand in the header', () => {
    render(<Home />)
    expect(screen.getByText('JamboCart')).toBeInTheDocument()
  })

  test('renders a link to the A/B Simulator', () => {
    render(<Home />)
    expect(screen.getByRole('link', { name: /A\/B Simulator/i })).toBeInTheDocument()
  })
})
