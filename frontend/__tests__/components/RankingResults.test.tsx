import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RankingResults from '@/components/RankingResults'
import { PaymentMethod } from '@/types/payment'

function makeMethod(rank: number): PaymentMethod {
  return {
    rank,
    id: `method-${rank}`,
    name: `Method ${rank}`,
    type: 'card',
    description: `Description for method ${rank}`,
    score: 100 - rank * 10,
    confidence: 80 - rank * 5,
    reasons: [`Reason for ${rank}`],
  }
}

const FIVE_METHODS = [1, 2, 3, 4, 5].map(makeMethod)

describe('RankingResults', () => {
  test('shows skeleton placeholders while loading', () => {
    const { container } = render(<RankingResults ranked={[]} loading={true} />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  test('shows empty state message when ranked is empty and not loading', () => {
    render(<RankingResults ranked={[]} loading={false} />)
    expect(screen.getByText(/No payment methods available/)).toBeInTheDocument()
    expect(screen.getByText(/Try a different country/)).toBeInTheDocument()
  })

  test('shows "Recommended for you" heading when there are results', () => {
    render(<RankingResults ranked={FIVE_METHODS.slice(0, 3)} loading={false} />)
    expect(screen.getByText('Recommended for you')).toBeInTheDocument()
  })

  test('renders the top 3 methods', () => {
    render(<RankingResults ranked={FIVE_METHODS} loading={false} />)
    expect(screen.getByText('Method 1')).toBeInTheDocument()
    expect(screen.getByText('Method 2')).toBeInTheDocument()
    expect(screen.getByText('Method 3')).toBeInTheDocument()
  })

  test('shows "Show N more options" button when there are more than 3 methods', () => {
    render(<RankingResults ranked={FIVE_METHODS} loading={false} />)
    expect(screen.getByText(/Show 2 more options/)).toBeInTheDocument()
  })

  test('does not show "Show more" button when there are 3 or fewer methods', () => {
    render(<RankingResults ranked={FIVE_METHODS.slice(0, 3)} loading={false} />)
    expect(screen.queryByText(/Show.*more/)).not.toBeInTheDocument()
  })

  test('uses singular "option" when only 1 extra method exists', () => {
    render(<RankingResults ranked={FIVE_METHODS.slice(0, 4)} loading={false} />)
    expect(screen.getByText(/Show 1 more option$/)).toBeInTheDocument()
  })

  test('clicking "Show more" reveals additional methods', async () => {
    const user = userEvent.setup()
    render(<RankingResults ranked={FIVE_METHODS} loading={false} />)

    expect(screen.queryByText('Method 4')).not.toBeInTheDocument()
    expect(screen.queryByText('Method 5')).not.toBeInTheDocument()

    await user.click(screen.getByText(/Show 2 more options/))

    expect(screen.getByText('Method 4')).toBeInTheDocument()
    expect(screen.getByText('Method 5')).toBeInTheDocument()
  })

  test('clicking the toggle a second time hides the extra methods', async () => {
    const user = userEvent.setup()
    render(<RankingResults ranked={FIVE_METHODS} loading={false} />)

    await user.click(screen.getByText(/Show 2 more options/))
    expect(screen.getByText('Method 4')).toBeInTheDocument()

    await user.click(screen.getByText('Hide'))
    expect(screen.queryByText('Method 4')).not.toBeInTheDocument()
  })
})
