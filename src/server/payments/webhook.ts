import express from 'express'
import type { createAuthStore } from '../auth/db.ts'
import type { PaymentConfig } from './config.ts'
import type { PaymentGateway } from './gateway.ts'
import { validSession } from './service.ts'
export function createWebhookRouter({ config, store, gateway }: { config: PaymentConfig|null;store:ReturnType<typeof createAuthStore>;gateway:PaymentGateway|null;now?:()=>number }) {
  const router=express.Router()
  router.post('/',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
    res.setHeader('Cache-Control','no-store')
    if(!config||!gateway)return res.status(503).json({error:'Pagamentos indisponíveis'})
    let event
    try{if(!Buffer.isBuffer(req.body))throw Error();event=gateway.verifyWebhook(req.body,req.get('Stripe-Signature')||'')}catch{return res.status(400).json({error:'Webhook inválido'})}
    const types=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired']
    if(event.livemode!==(config.mode==='live')||!types.includes(event.type))return res.json({received:true})
    try{
      if(store.db.prepare('SELECT 1 FROM payment_events WHERE event_id=?').get(event.id))return res.json({received:true})
      const session=await gateway.retrieveCheckout(event.sessionId)
      const row=session.orderId?store.findPayment(session.orderId):undefined
      if(!row)return res.json({received:true})
      if(session.id!==event.sessionId||!validSession(session,row))return res.json({received:true})
      const status=session.paymentStatus==='paid'?'paid':event.type.endsWith('expired')?'expired':event.type.endsWith('async_payment_failed')?'failed':'pending'
      store.applyPaymentEvent({eventId:event.id,orderId:row.id,type:event.type,status,sessionId:session.id})
      return res.json({received:true})
    }catch{return res.status(503).json({error:'Pagamentos indisponíveis'})}
  })
  router.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status((err as {type?:string})?.type==='entity.too.large'?413:503).json({error:'Webhook inválido'}))
  return router
}
