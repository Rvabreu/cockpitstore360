// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAuthStore } from '../auth/db'
import { createPaymentService } from './service'
import { loadPaymentConfig } from './config'
import type { PaymentGateway, GatewayCreateParams, GatewaySession } from './gateway'
import express from 'express'
import type { Server } from 'node:http'
import { createAuthRouter } from '../auth/router'
import { loadAuthConfig } from '../auth/config'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const KEY = '11111111-1111-4111-8111-111111111111'
const request = { items: [{ productId: 'a', quantity: 2 }], idempotencyKey: KEY }
const config = loadPaymentConfig({ env: { APP_ORIGIN: 'https://store.example', STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture', STRIPE_USD_PRICES_JSON: '{"a":1234}' } })!
let store: ReturnType<typeof createAuthStore>, dir: string, path: string, clock: number, userId: string, sessionToken: string, csrfCookie: string
const create = vi.fn<(params: GatewayCreateParams) => Promise<GatewaySession>>()
const retrieve = vi.fn<PaymentGateway['retrieveCheckout']>()
const load = vi.fn(() => [{ id: 'a', name: 'Produto A', price: 99999 }])
const gateway: PaymentGateway = { createCheckout: create, retrieveCheckout: retrieve, verifyWebhook: vi.fn() }
function session(p: GatewayCreateParams): GatewaySession { return { id: `cs_test_${p.orderId}`, url: 'https://checkout.stripe.com/c/pay/cs_test_fixture', mode: 'payment', livemode: false, currency: 'usd', amountTotal: p.items.reduce((n,i) => n+i.quantity*i.unitPriceCents,0), paymentStatus: 'unpaid', status: 'open', orderId: p.orderId, metadataOrderId: p.orderId, items: p.items, createdAt: Math.floor(clock/1000), expiresAt: p.expiresAt } }
function service(overrides: Partial<Parameters<typeof createPaymentService>[0]> = {}) { return createPaymentService({ config, store, gateway, loadProducts: load, now: () => clock, ...overrides }) }
beforeEach(async () => {
  vi.restoreAllMocks(); create.mockReset(); retrieve.mockReset(); load.mockClear()
  clock = Date.UTC(2026,9,29,12); dir = mkdtempSync(join(tmpdir(),'payment-tests-')); path=join(dir,'auth.sqlite')
  store=createAuthStore({ path, now:()=>clock })
  const user = await store.provisionUser({ email:'qa@example.com', password:'secure password-123' }); userId=user.id
  const bootstrap=store.getSession(); const logged=store.rotate(user,undefined,bootstrap.csrfCookie)!
  sessionToken=logged.token; csrfCookie=logged.csrfCookie
  create.mockImplementation(async(p)=>session(p))
})
afterEach(()=>{store.close();rmSync(dir,{recursive:true,force:true});vi.restoreAllMocks()})

it('USDmapping explícito nunca converte priceBRL; ordem semPII/cookies/authmutation',async()=>{
  expect(service().catalog()).toEqual({currency:'USD',mode:'test',products:[{id:'a',name:'Produto A',unitPriceCents:1234}]})
  const before=store.db.prepare('SELECT * FROM sessions').all()
  const result=await service().checkout(sessionToken,csrfCookie,request)
  expect(result.result.status).toBe('pending');expect(result.created).toBe(true)
  expect(create.mock.calls[0][0].items).toEqual([{name:'Produto A',quantity:2,unitPriceCents:1234}])
  const owned=service().owned(result.result.orderId,userId)
  expect(owned).toMatchObject({currency:'USD',totalCents:2468,status:'pending'})
  expect(JSON.stringify(owned)).not.toMatch(/qa@example|password|address|customer/i)
  expect(store.db.prepare('SELECT * FROM sessions').all()).toEqual(before)
  expect(()=>service().owned(result.result.orderId,'other-user')).toThrow('Pedido não encontrado')
})
it('missingconfig503/unknownmapping503 e anonimato antes preço',async()=>{
  expect(()=>service({config:null,gateway:null}).catalog()).toThrow('Pagamentos indisponíveis')
  expect(()=>service({loadProducts:()=>[]}).catalog()).toThrow('Pagamentos indisponíveis')
  load.mockClear()
  await expect(service().checkout('bad','bad',request)).rejects.toMatchObject({status:401})
  expect(load).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled()
})
it('timeout/restart conserva snapshot/Stripekey/expiry apesar catálogo mudar',async()=>{
  create.mockRejectedValueOnce(new Error('timeout'))
  await expect(service().checkout(sessionToken,csrfCookie,request)).rejects.toMatchObject({status:503})
  const first=structuredClone(create.mock.calls[0][0])
  expect(first.expiresAt-clock/1000).toBeGreaterThan(1800)
  clock+=60000;store.close();store=createAuthStore({path,now:()=>clock})
  load.mockClear()
  const result=await service({loadProducts:()=>[]}).checkout(sessionToken,csrfCookie,request)
  expect(create.mock.calls[1][0]).toEqual(first);expect(result.created).toBe(false)
  expect(load).not.toHaveBeenCalled()
})
it('retry após deploy preserva URLs originais em vezconfigoriginnovo',async()=>{
  create.mockRejectedValueOnce(new Error('timeout'))
  await expect(service().checkout(sessionToken,csrfCookie,request)).rejects.toMatchObject({status:503})
  const first=structuredClone(create.mock.calls[0][0])
  await service({config:{...config,origin:'https://new.example'}}).checkout(sessionToken,csrfCookie,request)
  expect(create.mock.calls[1][0]).toEqual(first)
})
it('replay antes catálogo/diff409 e concorrentes usam mesmaStripekey/ordem',async()=>{
  const [a,b]=await Promise.all([service().checkout(sessionToken,csrfCookie,request),service().checkout(sessionToken,csrfCookie,request)])
  expect(a.result.orderId).toBe(b.result.orderId)
  expect(new Set(create.mock.calls.map(([p])=>p.idempotencyKey)).size).toBe(1)
  expect((store.db.prepare('SELECT count(*) AS n FROM payment_orders').get() as {n:number}).n).toBe(1)
  await expect(service().checkout(sessionToken,csrfCookie,{...request,items:[{productId:'a',quantity:1}]})).rejects.toMatchObject({status:409})
})
it('webhookcompletedunpaid preattach vincula pendingnull; replay recupera sem recriar pagamento',async()=>{
  create.mockRejectedValueOnce(new Error('provider criou sessão mas response perdeu-se'))
  await expect(service().checkout(sessionToken,csrfCookie,request)).rejects.toMatchObject({status:503})
  const params=structuredClone(create.mock.calls[0][0])
  const completed={...session(params),status:'complete',paymentStatus:'unpaid',url:null}
  store.applyPaymentEvent({eventId:'evt_completed_unpaid',orderId:params.orderId,type:'checkout.session.completed',status:'pending',sessionId:completed.id})
  expect(store.findPayment(params.orderId)).toMatchObject({stripe_session_id:completed.id,status:'pending',checkout_url:null})
  retrieve.mockResolvedValueOnce(completed);load.mockClear()
  await expect(service({loadProducts:()=>{throw Error('replay não consulta catálogo')}}).checkout(sessionToken,csrfCookie,request)).resolves.toEqual({created:false,result:{orderId:params.orderId,status:'pending',checkoutUrl:null}})
  expect(retrieve).toHaveBeenCalledTimes(1);expect(retrieve).toHaveBeenCalledWith(completed.id)
  expect(create).toHaveBeenCalledTimes(1)
  expect(load).not.toHaveBeenCalled()
  expect((store.db.prepare('SELECT count(*) AS n FROM payment_orders').get() as {n:number}).n).toBe(1)
  expect(store.findPayment(params.orderId)).toMatchObject({stripe_session_id:completed.id,status:'pending',checkout_url:null,idempotency_key:KEY})
})
it('logoutduranteawait persisteStripe mas não entregaURL até reauth',async()=>{
  let resolve!:(s:GatewaySession)=>void
  create.mockReturnValueOnce(new Promise<GatewaySession>(done=>{resolve=done}))
  const pending=service().checkout(sessionToken,csrfCookie,request)
  await vi.waitFor(()=>expect(create).toHaveBeenCalledTimes(1))
  store.logout(sessionToken,csrfCookie)
  resolve(session(create.mock.calls[0][0]))
  await expect(pending).rejects.toMatchObject({status:401})
  const row=store.db.prepare('SELECT stripe_session_id FROM payment_orders').get() as {stripe_session_id:string}
  expect(row.stripe_session_id).toBeTruthy()
})
it.each(['https://evil.example/', 'http://checkout.stripe.com/c/pay','https://checkout.stripe.com.evil.example/'])('SDKurl%s inválida não attach/response',async(url)=>{
  create.mockImplementation(async(p)=>({...session(p),url}))
  await expect(service().checkout(sessionToken,csrfCookie,request)).rejects.toMatchObject({status:503})
  expect((store.db.prepare('SELECT stripe_session_id FROM payment_orders').get() as {stripe_session_id:null}).stripe_session_id).toBeNull()
})

it('HTTPguards401/403 antescatalog/config; sessão válida503 semcookies/no-store',async()=>{
  const app=express(); app.use('/api/auth',createAuthRouter({config:loadAuthConfig({mode:'production',env:{APP_ORIGIN:config.origin}}),store,now:()=>clock,paymentConfig:null,paymentGateway:null,loadPaymentProducts:load}))
  const server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  const address=server.address();if(!address||typeof address==='string')throw Error('address')
  const base=`http://127.0.0.1:${address.port}/api/auth/payments`
  const cookie=`__Host-store_session=${sessionToken}; __Host-store_csrf=${csrfCookie}`
  const before=store.db.prepare('SELECT * FROM sessions').all()
  try{
    const anon=await fetch(`${base}/catalog`);expect(anon.status).toBe(401)
    const cross=await fetch(`${base}/catalog`,{headers:{Cookie:cookie,'Sec-Fetch-Site':'cross-site'}});expect(cross.status).toBe(403)
    const valid=await fetch(`${base}/catalog`,{headers:{Cookie:cookie}});expect(valid.status).toBe(503)
    for(const response of [anon,cross,valid]){expect(response.headers.getSetCookie()).toEqual([]);expect(response.headers.get('cache-control')).toContain('no-store')}
    expect(load).not.toHaveBeenCalled();expect(store.db.prepare('SELECT * FROM sessions').all()).toEqual(before)
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
