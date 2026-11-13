import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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

  it.each([
    ['prod-orbit', 'Orbit Headphones Pro', '/assets/orbit-headphones.webp'],
    ['prod-pulse', 'Pulse Watch S2', '/assets/pulse-watch.webp'],
    ['prod-wave', 'Wave Mini Speaker', '/assets/wave-speaker.jpg'],
  ])('renders an individual local photo for %s with alt and cover', (id, name, image) => {
    render(<ProductCard product={{ ...product, id, name, image }} />)
    const photo = screen.getByRole('img', { name })
    expect(photo.tagName).toBe('IMG')
    expect(photo).toHaveAttribute('src', image)
    expect(photo).toHaveAttribute('alt', name)
    expect(photo).toHaveClass('block', 'w-full', 'h-[175px]', 'object-cover')
  })

  it.each([
    ['orbit', '93% 17%'],
    ['pulse', '59% 75%'],
    ['wave', '99% 83%'],
  ])('preserves the original SVG crop for %s', (key, position) => {
    render(<ProductCard product={{ ...product, image: `/assets/hero_produtos.svg#${key}` }} />)
    const sprite = screen.getByRole('img', { name: product.name })
    expect(sprite.tagName).toBe('DIV')
    expect(sprite).toHaveClass('h-[175px]')
    expect(sprite).toHaveStyle({
      backgroundImage: 'url(/assets/hero_produtos.svg)',
      backgroundSize: '250%',
      backgroundPosition: position,
      backgroundRepeat: 'no-repeat',
    })
  })

  it.each([
    ['orbit', '/assets/orbit-headphones.webp', '93% 17%'],
    ['pulse', '/assets/pulse-watch.webp', '59% 75%'],
    ['wave', '/assets/wave-speaker.jpg', '99% 83%'],
  ])('falls back to the accessible SVG crop without an error loop for %s', (key, image, position) => {
    render(<ProductCard product={{ ...product, id: `prod-${key}`, image }} />)
    fireEvent.error(screen.getByRole('img', { name: product.name }))
    const fallback = screen.getByRole('img', { name: product.name })
    expect(fallback.tagName).toBe('DIV')
    expect(fallback).toHaveClass('h-[175px]')
    expect(fallback).toHaveStyle({
      backgroundImage: 'url(/assets/hero_produtos.svg)',
      backgroundSize: '250%',
      backgroundPosition: position,
    })
    fireEvent.error(fallback)
    expect(screen.getByRole('img', { name: product.name })).toBe(fallback)
    expect(fallback.querySelector('img')).toBeNull()
  })

  it('retries a changed src after failure, including a previously failed src', () => {
    const first = { ...product, image: '/assets/orbit-headphones.webp' }
    const { rerender } = render(<ProductCard product={first} />)
    fireEvent.error(screen.getByRole('img', { name: product.name }))
    rerender(<ProductCard product={{ ...first, image: '/assets/orbit-headphones-v2.webp' }} />)
    expect(screen.getByRole('img', { name: product.name }))
      .toHaveAttribute('src', '/assets/orbit-headphones-v2.webp')
    rerender(<ProductCard product={first} />)
    expect(screen.getByRole('img', { name: product.name })).toHaveAttribute('src', first.image)
  })

  it('retries when the product changes after failure, even with the same src', () => {
    const image = '/assets/photo.webp'
    const { rerender } = render(<ProductCard product={{ ...product, image }} />)
    fireEvent.error(screen.getByRole('img', { name: product.name }))
    const wave = { ...product, id: 'prod-wave', name: 'Wave Mini Speaker', image }
    rerender(<ProductCard product={wave} />)
    expect(screen.getByRole('img', { name: wave.name })).toHaveAttribute('src', image)
    fireEvent.error(screen.getByRole('img', { name: wave.name }))
    expect(screen.getByRole('img', { name: wave.name })).toHaveStyle({ backgroundPosition: '99% 83%' })
    rerender(<ProductCard product={{ ...wave, image: '/assets/hero_produtos.svg#wave' }} />)
    expect(screen.getByRole('img', { name: wave.name }).tagName).toBe('DIV')
  })
})
