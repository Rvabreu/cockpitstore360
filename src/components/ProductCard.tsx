import type { CSSProperties } from 'react'
import type { Product } from '../types/store'
import { useLocale } from '../i18n/LocaleProvider'

// Crop values reproduce the mockup's single-image background-position trick:
// all products share /assets/hero_produtos.svg, distinguished by the #key suffix.
const IMAGE_CROPS: Record<string, { size: string; position: string }> = {
  orbit: { size: '250%', position: '93% 17%' },
  pulse: { size: '250%', position: '59% 75%' },
  wave: { size: '250%', position: '99% 83%' },
}

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

export default function ProductCard({ product }: { product: Product }) {
  const { translateData, formatCurrency } = useLocale()
  return (
    <article className="bg-[#121417] border border-[#292b2f] rounded-[21px] overflow-hidden">
      <div
        className="h-[175px]"
        role="img"
        aria-label={translateData(product.name)}
        style={imageStyle(product.image)}
      />
      <div className="p-[22px]">
        <span className="inline-flex text-[#ffb69d] border border-[#ff714545] bg-[#ff643b12] px-[10px] py-[6px] rounded-[40px] text-[11px] font-semibold">
          {translateData(product.category)}
        </span>
        <h3 className="text-[17px] tracking-[-.35px] mt-4 mb-2">{translateData(product.name)}</h3>
        <small className="text-[#a6a9b1]">{translateData(product.description)}</small>
        <div className="text-[23px] font-extrabold tracking-[-.9px] mt-[15px]">
          {formatCurrency(product.price)}
        </div>
      </div>
    </article>
  )
}
