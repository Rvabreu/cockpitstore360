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

  it('keeps the original home crop and price without campaign labels by default', () => {
    render(<ProductCard product={product} />)
    expect(screen.getByRole('img', { name: product.name })).toHaveStyle({ backgroundSize: '250%', backgroundPosition: '93% 17%' })
    expect(screen.queryByText('Valor demonstrativo')).not.toBeInTheDocument()
  })

  it('isolates each local SVG illustration only in the campaign variant', () => {
    for (const [key, viewBox] of [['orbit', '1080 0 440 340'], ['pulse', '710 670 400 400'], ['wave', '1290 780 310 400']]) {
      const { unmount } = render(<ProductCard product={{ ...product, image: `/assets/hero_produtos.svg#${key}` }} variant="campaign" />)
      const illustration = screen.getByRole('img', { name: `Ilustração de ${product.name}` })
      expect(illustration).toHaveAttribute('viewBox', viewBox)
      expect(illustration.querySelector('image')).toHaveAttribute('href', '/assets/hero_produtos.svg')
      expect(screen.getByText('Valor demonstrativo')).toBeInTheDocument()
      unmount()
    }
  })
})
