import { render, screen } from '@testing-library/react'
import PaymentCard from '@/components/PaymentCard'
import { PaymentMethod } from '@/types/payment'

function make(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    rank: 2,
    id: 'mpesa',
    name: 'M-PESA',
    type: 'mobile_money',
    description: "Kenya's leading mobile money service",
    score: 74,
    confidence: 62,
    reasons: ['Optimised for mobile', 'Fast and fee-free for small amounts', '94% approval rate'],
    ...overrides,
  }
}

describe('PaymentCard', () => {
  test('renders method name and type label', () => {
    render(<PaymentCard method={make()} />)
    expect(screen.getByText('M-PESA')).toBeInTheDocument()
    expect(screen.getByText('Mobile Money')).toBeInTheDocument()
  })

  test('renders rank badge', () => {
    render(<PaymentCard method={make({ rank: 3 })} />)
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  test('renders confidence percentage', () => {
    render(<PaymentCard method={make({ confidence: 62 })} />)
    expect(screen.getByText('62%')).toBeInTheDocument()
  })

  test('shows "Best match" badge and description for rank 1', () => {
    const method = make({ rank: 1 })
    render(<PaymentCard method={method} />)
    expect(screen.getByText('Best match')).toBeInTheDocument()
    expect(screen.getByText(method.description)).toBeInTheDocument()
  })

  test('does not show "Best match" badge for ranks above 1', () => {
    render(<PaymentCard method={make({ rank: 2 })} />)
    expect(screen.queryByText('Best match')).not.toBeInTheDocument()
  })

  test('shows description in full mode', () => {
    const method = make()
    render(<PaymentCard method={method} />)
    expect(screen.getByText(method.description)).toBeInTheDocument()
  })

  test('hides description in compact mode', () => {
    const method = make()
    render(<PaymentCard method={method} compact />)
    expect(screen.queryByText(method.description)).not.toBeInTheDocument()
  })

  test('renders all reasons in full mode', () => {
    const method = make()
    render(<PaymentCard method={method} />)
    method.reasons.forEach(reason => {
      expect(screen.getByText(reason)).toBeInTheDocument()
    })
  })

  test('renders at most 2 reasons in compact mode', () => {
    const method = make({ reasons: ['Reason A', 'Reason B', 'Reason C'] })
    render(<PaymentCard method={method} compact />)
    expect(screen.getByText('Reason A')).toBeInTheDocument()
    expect(screen.getByText('Reason B')).toBeInTheDocument()
    expect(screen.queryByText('Reason C')).not.toBeInTheDocument()
  })

  test('confidence bar inline width matches confidence value', () => {
    const { container } = render(<PaymentCard method={make({ confidence: 75 })} />)
    const bar = container.querySelector('[style]') as HTMLElement
    expect(bar.style.width).toBe('75%')
  })

  test('renders correct type labels for all types', () => {
    const types: Array<[PaymentMethod['type'], string]> = [
      ['card',          'Card'],
      ['bnpl',          'Buy Now Pay Later'],
      ['bank_transfer', 'Bank Transfer'],
      ['wallet',        'Digital Wallet'],
      ['aggregator',    'Aggregator'],
    ]
    types.forEach(([type, label]) => {
      // Keep name neutral so it doesn't collide with the type label text
      const { unmount } = render(<PaymentCard method={make({ type })} />)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    })
  })

  test('does not render reasons list when reasons is empty', () => {
    render(<PaymentCard method={make({ reasons: [] })} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
