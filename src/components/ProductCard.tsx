import type { CSSProperties } from 'react'
import type { Product } from '../types/store'

// Crop values reproduce the mockup's single-image background-position trick:
// all products share /assets/hero_produtos.svg, distinguished by the #key suffix.
const IMAGE_CROPS: Record<string, { size: string; position: string }> = {
  orbit: { size: '250%', position: '93% 17%' },
  pulse: { size: '250%', position: '59% 75%' },
  wave: { size: '250%', position: '99% 83%' },
}

// SVG regions isolate each illustration without changing the home mockup crops.
const CAMPAIGN_VIEWBOXES: Record<string, string> = {
  orbit: '1080 0 440 340',
  pulse: '710 670 400 400',
  wave: '1290 780 310 400',
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

export default function ProductCard({ product, variant = 'default' }: { product: Product; variant?: 'default' | 'campaign' }) {
  const [imageUrl, imageKey] = product.image.split('#')
  const viewBox = imageKey && CAMPAIGN_VIEWBOXES[imageKey]

  return (
    <article className="bg-[#121417] border border-[#292b2f] rounded-[21px] overflow-hidden">
      {variant === 'campaign' && viewBox ? (
        <svg viewBox={viewBox} role="img" aria-label={`Ilustração de ${product.name}`} className="w-full h-[240px] bg-[#0c0d10]">
          <image href={imageUrl} width="1600" height="1200" />
        </svg>
      ) : (
        <div
          className="h-[175px]"
          role="img"
          aria-label={product.name}
          style={imageStyle(product.image)}
        />
      )}
      <div className="p-[22px]">
        <span className="inline-flex text-[#ffb69d] border border-[#ff714545] bg-[#ff643b12] px-[10px] py-[6px] rounded-[40px] text-[11px] font-semibold">
          {product.category}
        </span>
        <h3 className="text-[17px] tracking-[-.35px] mt-4 mb-2">{product.name}</h3>
        <small className="text-[#a6a9b1]">{product.description}</small>
        {variant === 'campaign' && <p className="text-[11px] uppercase tracking-[1.4px] text-[#b9bbc2] mt-5 mb-1">Valor demonstrativo</p>}
        <div className="text-[23px] font-extrabold tracking-[-.9px] mt-[15px]">
          {currencyFormatter.format(product.price)}
        </div>
      </div>
    </article>
  )
}
