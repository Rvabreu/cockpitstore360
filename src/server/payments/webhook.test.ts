// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'
import Stripe from 'stripe'
import { createAuthStore } from '../auth/db'
import { loadPaymentConfig } from './config'
import { createStripeGateway, type GatewaySession, type PaymentGateway } from './gateway'
import { createPaymentService } from './service'
import { createWebhookRouter } from './webhook'
const config=loadPaymentConfig({env:{APP_ORIGIN:'https://store.example',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_USD_PRICES_JSON:'{"a":1234}'}})!
let store:ReturnType<typeof createAuthStore>,server:Server,url:string,orderId:string, remote:GatewaySession
const retrieve=vi.fn<PaymentGateway['retrieveCheckout']>()
const official=createStripeGateway(config)
const gateway:PaymentGateway={verifyWebhook:official.verifyWebhook,retrieveCheckout:retrieve,createCheckout:vi.fn(async(p)=>({id:'cs_test_fixture',url:'https://checkout.stripe.com/c/pay/cs_test_fixture',mode:'payment',livemode:false,currency:'usd',amountTotal:2468,paymentStatus:'unpaid',status:'open',orderId:p.orderId,metadataOrderId:p.orderId,items:p.items,createdAt:Math.floor(Date.now()/1000),expiresAt:p.expiresAt}))}
beforeEach(async()=>{
  vi.restoreAllMocks();retrieve.mockReset();store=createAuthStore({path:':memory:'})
  const user=await store.provisionUser({email:'qa@example.com',password:'secure password-123'}),bootstrap=store.getSession(),auth=store.rotate(user,undefined,bootstrap.csrfCookie)!
  const service=createPaymentService({config,store,gateway,loadProducts:()=>[{id:'a',name:'Produto A',price:99999}]})
  const checkout=await service.checkout(auth.token,auth.csrfCookie,{items:[{productId:'a',quantity:2}],idempotencyKey:'11111111-1111-4111-8111-111111111111'})
  orderId=checkout.result.orderId
  remote={id:'cs_test_fixture',url:null,mode:'payment',livemode:false,currency:'usd',amountTotal:2468,paymentStatus:'paid',status:'complete',orderId,metadataOrderId:orderId,items:[{name:'Produto A',quantity:2,unitPriceCents:1234}],createdAt:Math.floor(Date.now()/1000),expiresAt:store.findPayment(orderId)!.expires_at}
  retrieve.mockImplementation(async()=>remote)
  const app=express();app.use('/api/payments/webhook',createWebhookRouter({config,store,gateway}))
  server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});const addr=server.address();if(!addr||typeof addr==='string')throw Error('address');url=`http://127.0.0.1:${addr.port}/api/payments/webhook`
})
afterEach(async()=>{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));store.close();vi.restoreAllMocks()})
function body(type='checkout.session.completed',id='evt_fixture',livemode=false){return JSON.stringify({id,type,livemode,data:{object:{id:remote.id,amount_total:1,payment_status:'paid'}}})}
async function send(payload=body(), timestamp=Math.floor(Date.now()/1000),signature?:string){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':signature??Stripe.webhooks.generateTestHeaderString({payload,secret:config.webhookSecret,timestamp})},body:payload})}
const status=()=>store.findPayment(orderId)!.status
it('assinaturaSDKraw oficial +retrieve authoritative confirma sem confiarbodyamount/PII',async()=>{
  const before=store.db.prepare('SELECT * FROM sessions').all()
  const response=await send();expect(response.status).toBe(200);expect(status()).toBe('paid');expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.getSetCookie()).toEqual([])
  expect(retrieve).toHaveBeenCalledWith('cs_test_fixture');expect(store.db.prepare('SELECT * FROM sessions').all()).toEqual(before)
  expect(JSON.stringify(store.db.prepare('SELECT * FROM payment_events').all())).not.toMatch(/customer|email|card|payload|amount_total/)
})
it.each(['wrong','missing','stale','changed'])('signature%s inválida nunca retrieve/write',async(kind)=>{
  const payload=body(),signature=Stripe.webhooks.generateTestHeaderString({payload,secret:kind==='wrong'?'whsec_wrong':config.webhookSecret,timestamp:Math.floor(Date.now()/1000)-(kind==='stale'?600:0)})
  const response=await send(kind==='changed'?payload+' ':payload,undefined,kind==='missing'?'':signature)
  expect(response.status).toBe(400);expect(status()).toBe('pending');expect(retrieve).not.toHaveBeenCalled()
})
it.each([{amountTotal:1},{currency:'brl'},{orderId:'other'},{metadataOrderId:'other'},{mode:'subscription'},{livemode:true},{id:'cs_test_other'},{createdAt:1},{expiresAt:1},{items:[{name:'Produto A',quantity:1,unitPriceCents:2468}]}])('retrieved mismatch%j ignora pago/dedupe',async(patch)=>{
  const event=body();remote={...remote,...patch}
  expect((await send(event)).status).toBe(200);expect(status()).toBe('pending')
  expect((store.db.prepare('SELECT count(*) AS n FROM payment_events').get() as {n:number}).n).toBe(0)
})
it('completed unpaid não paid;async success paidabsorbing/dedupefailedexpired',async()=>{
  remote.paymentStatus='unpaid';expect((await send()).status).toBe(200);expect(status()).toBe('pending')
  remote.paymentStatus='paid';await send(body('checkout.session.async_payment_succeeded','evt_paid'));expect(status()).toBe('paid')
  await send(body('checkout.session.async_payment_succeeded','evt_paid'))
  remote.paymentStatus='unpaid';await send(body('checkout.session.async_payment_failed','evt_failed'));await send(body('checkout.session.expired','evt_expired'));expect(status()).toBe('paid')
  expect((store.db.prepare("SELECT count(*) AS n FROM payment_events WHERE event_id='evt_paid'").get() as {n:number}).n).toBe(1)
})
it.each([['checkout.session.async_payment_failed','failed'],['checkout.session.expired','expired']])('%s alteraunpaidserver para%s',async(type,expected)=>{remote.paymentStatus='unpaid';await send(body(type));expect(status()).toBe(expected)})
it('webhook beforeattach adota sessão sódepois retrievematching',async()=>{
  store.db.prepare('UPDATE payment_orders SET stripe_session_id=NULL,checkout_url=NULL WHERE id=?').run(orderId)
  await send();expect(status()).toBe('paid');expect(store.findPayment(orderId)!.stripe_session_id).toBe(remote.id)
})
it('retrievefalha503 pode retry sem dedupeprematuro',async()=>{
  retrieve.mockRejectedValueOnce(new Error('network'));expect((await send()).status).toBe(503);expect(status()).toBe('pending')
  expect((await send()).status).toBe(200);expect(status()).toBe('paid')
})
it('DBapplyfail503 rollback status/dedupe libera retry',async()=>{
  vi.spyOn(store,'applyPaymentEvent').mockImplementationOnce(()=>{throw Error('disk')})
  expect((await send()).status).toBe(503);expect(status()).toBe('pending')
  expect((await send()).status).toBe(200);expect(status()).toBe('paid')
})
