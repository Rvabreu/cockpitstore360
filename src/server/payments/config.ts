export interface PaymentConfig { secretKey: string; webhookSecret: string; prices: Record<string, number>; mode: 'test' | 'live'; origin: string }
export function loadPaymentConfig({ env = process.env }: { env?: Record<string, string | undefined> } = {}): PaymentConfig | null {
  const { STRIPE_SECRET_KEY: key, STRIPE_WEBHOOK_SECRET: webhook, STRIPE_USD_PRICES_JSON: prices } = env
  if (!key && !webhook && !prices) return null
  if (!key || !webhook?.startsWith('whsec_') || !prices || !/^sk_(test|live)_[A-Za-z0-9]+$/.test(key)) throw new Error('Configuração de pagamentos inválida')
  const mode = key.startsWith('sk_live_') ? 'live' : 'test'
  if (mode === 'live' && env.STRIPE_ALLOW_LIVE !== 'true') throw new Error('Pagamentos reais não autorizados')
  let origin: URL
  try { origin = new URL(env.APP_ORIGIN || '') } catch { throw new Error('Origem de pagamentos inválida') }
  if (origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN) throw new Error('Origem de pagamentos inválida')
  let mapping: unknown
  try { mapping = JSON.parse(prices) } catch { throw new Error('Preços em USD inválidos') }
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping) || !Object.keys(mapping).length) throw new Error('Preços em USD inválidos')
  for (const [id, value] of Object.entries(mapping)) if (!id || id.length > 128 || id.trim() !== id || /[\x00-\x1f\x7f]/.test(id) || typeof value !== 'number' || !Number.isSafeInteger(value) || value < 50 || value > 100000000) throw new Error('Preços em USD inválidos')
  return { secretKey: key, webhookSecret: webhook, prices: mapping as Record<string, number>, mode, origin: origin.origin }
}
