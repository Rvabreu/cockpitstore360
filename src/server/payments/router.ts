import express from 'express'
import type { AuthUser } from '../auth/db.ts'
import type { createPaymentService } from './service.ts'
import { PaymentError } from './service.ts'
import { normalizeCheckoutRequest } from '../checkout.ts'
export function createPaymentsRouter({ service, authenticate, authorize, consume, credentials }: {
  service: ReturnType<typeof createPaymentService>; authenticate: (req: express.Request) => AuthUser | null;
  authorize: (req: express.Request) => boolean; consume: (req: express.Request, email: string) => void;
  credentials: (req: express.Request) => { sessionToken: string; csrfCookie: string }
}) {
  const router = express.Router()
  router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next()})
  router.get('/catalog', (req,res,next)=>{try {const user=authenticate(req);if(!user)return res.status(401).json({error:'Sessão não autenticada'});res.json(service.catalog())}catch(e){next(e)}})
  router.get('/orders/:id',(req,res,next)=>{try {const user=authenticate(req);if(!user)return res.status(401).json({error:'Sessão não autenticada'});res.json({order:service.owned(req.params.id as string,user.id)})}catch(e){next(e)}})
  router.post('/checkout',async(req,res,next)=>{try {
    if(!authorize(req))return res.status(403).json({error:'Requisição não autorizada'})
    const user=authenticate(req);if(!user)return res.status(401).json({error:'Sessão não autenticada'})
    const request=normalizeCheckoutRequest(req.body);if(!request)return res.status(400).json({error:'Dados de checkout inválidos'})
    consume(req,user.email)
    const c=credentials(req),result=await service.checkout(c.sessionToken,c.csrfCookie,request)
    res.status(result.created?201:200).json(result.result)
  }catch(e){next(e)}})
  router.use((err:unknown,_req:express.Request,res:express.Response,next:express.NextFunction)=>{if(err instanceof PaymentError)return res.status(err.status).json({error:err.message});next(err)})
  return router
}
