import { useState, type CSSProperties } from 'react'
import type { Product } from '../types/store'

// Crop values reproduce the mockup's single-image background-position trick:
// all products share /assets/hero_produtos.svg, distinguished by the #key suffix.
const IMAGE_CROPS: Record<string, { size: string; position: string }> = {
  orbit: { size: '250%', position: '93% 17%' },
  pulse: { size: '250%', position: '59% 75%' },
  wave: { size: '250%', position: '99% 83%' },
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function imageStyle(image: string): CSSProperties {
  const [url, key] = image.split('#')
  const crop = (key && IMAGE_CROPS[key]) || { size: '250%', position: 'center' }
  return {
    backgroundColor: '#161616',
    backgroundImage: `url(${url})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: crop.size,
    backgroundPosition: crop.position,
  }
}

function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false)
  const isSprite = product.image.split('#')[0] === '/assets/hero_produtos.svg'

  if (isSprite || failed) {
    const image = isSprite
      ? product.image
      : `/assets/hero_produtos.svg#${product.id.replace(/^prod-/, '')}`
    return (
      <div
        className="h-[175px]"
        role="img"
        aria-label={product.name}
        style={imageStyle(image)}
      />
    )
  }

  return (
    <img
      className="block w-full h-[175px] object-cover bg-[#161616]"
      src={product.image}
      alt={product.name}
      onError={() => setFailed(true)}
    />
  )
}

export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="bg-[#121417] border border-[#292b2f] rounded-[21px] overflow-hidden">
      <ProductImage key={`${product.id}:${product.image}`} product={product} />
      <div className="p-[22px]">
        <span className="inline-flex text-[#ffb69d] border border-[#ff714545] bg-[#ff643b12] px-[10px] py-[6px] rounded-[40px] text-[11px] font-semibold">
          {product.category}
        </span>
        <h3 className="text-[17px] tracking-[-.35px] mt-4 mb-2">{product.name}</h3>
        <small className="text-[#a6a9b1]">{product.description}</small>
        <div className="text-[23px] font-extrabold tracking-[-.9px] mt-[15px]">
          {currencyFormatter.format(product.price)}
        </div>
      </div>
    </article>
  )
}
