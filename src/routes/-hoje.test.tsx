import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TodayPage } from './hoje'

describe('today route', () => {
  it('provides a dedicated h1, main skip target and link back to home', () => {
    const { container } = render(<TodayPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Programação de hoje.')
    expect(container.querySelector('main')).toHaveAttribute('id', 'conteudo')
    expect(screen.getByRole('link', { name: /Voltar à programação na Home/ })).toHaveAttribute('href', '/#programacao-hoje')
  })
})
