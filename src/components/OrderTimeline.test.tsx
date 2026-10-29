import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

  it('identifica etapas concluídas, atuais e pendentes para leitores de tela', () => {
    render(<OrderTimeline events={events} />)
    const steps = within(screen.getByRole('list', { name: 'Etapas do pedido' })).getAllByRole('listitem')
    expect(steps).toHaveLength(4)
    expect(within(steps[0]).getByText('Etapa concluída')).toBeInTheDocument()
    expect(steps[1]).toHaveAttribute('aria-current', 'step')
    expect(within(steps[1]).getByText('Etapa atual')).toBeInTheDocument()
    for (const step of steps.slice(2)) {
      expect(within(step).getByText('Etapa pendente')).toBeInTheDocument()
      expect(step).not.toHaveAttribute('aria-current')
    }
    expect(screen.getByText('✓')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('●')).toHaveAttribute('aria-hidden', 'true')
  })

  it('atualiza identificação semântica quando o pedido reinicia', () => {
    const { rerender } = render(<OrderTimeline events={events} />)
    rerender(<OrderTimeline events={events.map((event, i) => ({
      ...event,
      status: i === 0 ? 'current' : 'pending',
      displayDetail: i === 0 ? event.detail : 'Aguardando atualização',
    }))} />)
    const steps = screen.getAllByRole('listitem')
    expect(steps[0]).toHaveAttribute('aria-current', 'step')
    expect(steps[1]).not.toHaveAttribute('aria-current')
    expect(screen.queryByText('Etapa concluída')).not.toBeInTheDocument()
    expect(screen.getAllByText('Etapa pendente')).toHaveLength(3)
  })
})
