import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import OrderTimeline from './OrderTimeline'
import type { OrderEvent } from '../types/store'

const events: OrderEvent[] = [
  { stepIndex: 0, title: 'Pedido confirmado', detail: '19 out · 10h12', displayDetail: '19 out · 10h12', status: 'done' },
  { stepIndex: 1, title: 'Em separação', detail: '20 out · 08h35', displayDetail: '20 out · 08h35', status: 'current' },
  { stepIndex: 2, title: 'Em transporte', detail: '21 out · 14h20', displayDetail: 'Aguardando atualização', status: 'pending' },
  { stepIndex: 3, title: 'Entregue', detail: 'Entrega confirmada', displayDetail: 'Aguardando atualização', status: 'pending' },
]

describe('OrderTimeline', () => {
  it('renders the done/current/pending glyphs', () => {
    render(<OrderTimeline events={events} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByText('●')).toBeInTheDocument()
    expect(screen.getAllByText('·')).toHaveLength(2)
  })

  it('shows displayDetail, so pending steps read "Aguardando atualização"', () => {
    render(<OrderTimeline events={events} />)
    expect(screen.getByText('19 out · 10h12')).toBeInTheDocument()
    expect(screen.getAllByText('Aguardando atualização')).toHaveLength(2)
    // the raw stored detail of a pending step is NOT rendered
    expect(screen.queryByText('21 out · 14h20')).not.toBeInTheDocument()
  })
})
