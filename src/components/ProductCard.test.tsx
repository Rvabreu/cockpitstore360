import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductCard from './ProductCard'
import type { Product } from '../types/store'

const product: Product = {
  id: 'prod-orbit',
  name: 'Orbit Headphones Pro',
  description: 'Som premium para qualquer jornada.',
  category: 'Áudio imersivo',
  price: 699,
  image: '/assets/hero_produtos.svg#orbit',
  createdAt: '2026-10-01T10:00:00.000Z',
}

describe('ProductCard', () => {
  it('formats the price as BRL (R$ 699,00)', () => {
    render(<ProductCard product={product} />)
    // Intl renders a non-breaking space between R$ and the amount.
    const price = screen.getByText((content) => content.replace(/\u00a0/g, ' ') === 'R$ 699,00')
    expect(price).toBeInTheDocument()
  })

  it('renders name, description and category', () => {
    render(<ProductCard product={product} />)
    expect(screen.getByText('Orbit Headphones Pro')).toBeInTheDocument()
    expect(screen.getByText('Som premium para qualquer jornada.')).toBeInTheDocument()
    expect(screen.getByText('Áudio imersivo')).toBeInTheDocument()
  })
})
