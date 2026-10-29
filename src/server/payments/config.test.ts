// @vitest-environment node
import { expect, it } from 'vitest'
import { loadPaymentConfig } from './config'

const env = { APP_ORIGIN: 'https://store.example', STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture', STRIPE_USD_PRICES_JSON: '{"a":1234,"b":50}' }
it('config ausente não inventa segredo/preço/FX e fecha pagamentos', () => expect(loadPaymentConfig({ env: { APP_ORIGIN: env.APP_ORIGIN } })).toBeNull())
it('USD explícito mantém cents do mapping e modo test', () => {
  const config = loadPaymentConfig({ env })
  expect(config).not.toBeNull()
  expect(config?.prices).toEqual({ a: 1234, b: 50 })
  expect(config?.mode).toBe('test')
})
it.each([
  { ...env, STRIPE_SECRET_KEY: undefined }, { ...env, STRIPE_WEBHOOK_SECRET: undefined }, { ...env, STRIPE_USD_PRICES_JSON: undefined },
  { ...env, STRIPE_USD_PRICES_JSON: 'not-json' }, { ...env, STRIPE_USD_PRICES_JSON: '[]' },
  ...[49, 100000001, -1, 1.5, '1234'].map((price) => ({ ...env, STRIPE_USD_PRICES_JSON: JSON.stringify({ a: price }) })),
  { ...env, APP_ORIGIN: 'http://store.example' }, { ...env, STRIPE_SECRET_KEY: 'sk_live_fixture' },
])('config parcial/inválida%j falha startup sem fallback', (invalid) => expect(() => loadPaymentConfig({ env: invalid })).toThrow())
it('live só habilitado por opt-in explícito', () => {
  expect(loadPaymentConfig({ env: { ...env, STRIPE_SECRET_KEY: 'sk_live_fixture', STRIPE_ALLOW_LIVE: 'true' } })).not.toBeNull()
  expect(() => loadPaymentConfig({ env: { ...env, STRIPE_SECRET_KEY: 'sk_live_fixture', STRIPE_ALLOW_LIVE: '1' } })).toThrow()
})
