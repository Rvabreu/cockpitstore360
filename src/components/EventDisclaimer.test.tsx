import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EventDisclaimer from './EventDisclaimer'

describe('EventDisclaimer Component', () => {
  it('renders the non-official notice with reference date and no-PDUs disclaimer', () => {
    render(<EventDisclaimer />)
    expect(screen.getByText(/Proposta Preliminar Não Oficial:/i)).toBeInTheDocument()
    expect(screen.getByText(/10\/11\/2026 — a confirmar/i)).toBeInTheDocument()
    expect(screen.getByText(/Sem concessão de PDUs nem afiliação formal com o PMI/i)).toBeInTheDocument()
  })
})
