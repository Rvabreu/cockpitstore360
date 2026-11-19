import { useEffect, useRef, useState } from 'react'
import type { OrderWithEvents } from '../types/store'
import { SEED_ORDER_ID } from '../services/storeService'
import OrderTimeline from './OrderTimeline'

const UNAVAILABLE_MESSAGE = 'Não foi possível carregar os detalhes agora. Tente novamente em instantes.'
const NOT_FOUND_MESSAGE = 'O pedido demonstrativo não foi encontrado ou não está disponível.'
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type DetailsState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; order: OrderWithEvents }

function isOrderResponse(value: unknown): value is OrderWithEvents {
  if (!value || typeof value !== 'object') return false
  const order = value as OrderWithEvents
  return order.id === SEED_ORDER_ID && typeof order.productName === 'string'
    && typeof order.variant === 'string' && typeof order.placedAt === 'string'
    && typeof order.statusLabel === 'string' && Number.isInteger(order.quantity) && order.quantity > 0
    && typeof order.total === 'number' && Number.isFinite(order.total) && order.total >= 0
    && Array.isArray(order.events) && order.events.every((event) => event && Number.isInteger(event.stepIndex)
      && typeof event.title === 'string' && typeof event.displayDetail === 'string'
      && ['done', 'current', 'pending'].includes(event.status))
}

export default function OrderDetails({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<DetailsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => { heading.current?.focus() }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })

    async function loadDetails() {
      try {
        const response = await fetch(`/api/orders/${SEED_ORDER_ID}`, {
          cache: 'no-store', signal: controller.signal,
        })
        if (!active) return
        if (!response.ok) {
          setState({ status: 'error', message: [401, 403, 404].includes(response.status)
            ? NOT_FOUND_MESSAGE : UNAVAILABLE_MESSAGE })
          return
        }
        const data: unknown = await response.json()
        if (!active) return
        if (data === null) setState({ status: 'empty' })
        else if (isOrderResponse(data)) setState({ status: 'ready', order: data })
        else setState({ status: 'error', message: UNAVAILABLE_MESSAGE })
      } catch {
        if (active) setState({ status: 'error', message: UNAVAILABLE_MESSAGE })
      }
    }

    void loadDetails()
    return () => { active = false; controller.abort() }
  }, [attempt])

  return (
    <section aria-labelledby="order-details-title" className="mt-[25px] bg-[#131519] border border-[#2b2d33] rounded-[22px] p-5 min-[851px]:p-[29px] min-w-0">
      <button type="button" onClick={onBack} className="px-4 py-3 rounded-[12px] border border-[#474a51] bg-[#ffffff08] text-white font-bold text-[13px]">
        ← Voltar para Meus pedidos
      </button>
      <h3 id="order-details-title" ref={heading} tabIndex={-1} className="text-[25px] tracking-[-.5px] mt-5 mb-2">
        Detalhes do pedido demonstrativo
      </h3>
      <p className="text-[#ffb69d] text-[13px] leading-[1.7] mb-5">
        Demonstração com dados fictícios, sem autenticação real ou validação de titularidade.
      </p>

      {state.status === 'loading' && <p role="status" className="text-[#abaeb6] text-[14px]">Carregando detalhes do pedido…</p>}
      {(state.status === 'error' || state.status === 'empty') && (
        <div>
          <p role={state.status === 'error' ? 'alert' : 'status'} className="text-[#abaeb6] text-[14px] leading-[1.7]">
            {state.status === 'error' ? state.message : 'Nenhum detalhe disponível para o pedido demonstrativo.'}
          </p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="px-4 py-3 rounded-[12px] border border-[#ff633b] bg-[#ff633b] text-[#160c08] font-bold text-[13px]">
            Tentar novamente
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <div>
          <header className="flex flex-col min-[851px]:flex-row flex-wrap justify-between items-start gap-4 pb-5 border-b border-[#34363a]">
            <div className="min-w-0 shrink-0 max-w-full [overflow-wrap:anywhere]">
              <h4 className="text-[29px] font-extrabold tracking-[-1px] my-2 break-words">Pedido #{state.order.id}</h4>
              <p className="text-[#a9abb2] text-[13px] m-0">Data da compra: {state.order.placedAt}</p>
            </div>
            <p className="border border-[#ff6c3d55] bg-[#ff6c3d17] text-[#ffac90] px-3 py-[9px] rounded-[20px] text-[13px] font-extrabold m-0 min-w-0 max-w-full min-[851px]:max-w-[50%] [overflow-wrap:anywhere]">
              Status atual: {state.order.statusLabel || 'Não informado pelo pedido'}
            </p>
          </header>

          <h4 className="text-[18px] mt-6 mb-3">Item do pedido</h4>
          <ul className="list-none p-0 m-0">
            <li className="rounded-[15px] border border-[#34363b] p-4 bg-[#1a1d20] min-w-0">
              <h5 className="text-[16px] m-0 mb-4 break-words">{state.order.productName}</h5>
              <dl className="grid grid-cols-1 min-[851px]:grid-cols-2 gap-4 text-[13px] m-0">
                <div><dt className="text-[#a9abb2]">Quantidade</dt><dd className="m-0 mt-1">{state.order.quantity}</dd></div>
                <div><dt className="text-[#a9abb2]">Variante</dt><dd className="m-0 mt-1 break-words">{state.order.variant || 'Não informada pelo pedido'}</dd></div>
                <div><dt className="text-[#a9abb2]">Preço unitário</dt><dd className="m-0 mt-1">Não informado pelo pedido</dd></div>
                <div><dt className="text-[#a9abb2]">Total do item</dt><dd className="m-0 mt-1 font-bold">{currency.format(state.order.total)}</dd></div>
              </dl>
            </li>
          </ul>
          <p className="text-[#a9abb2] text-[12px] leading-[1.7]">O endpoint demonstrativo registra um único produto. O total do item corresponde ao total da compra; o preço unitário histórico não está disponível.</p>

          <div className="border-y border-[#34363a] py-5 my-6">
            <h4 className="text-[18px] mt-0 mb-3">Resumo financeiro</h4>
            <dl className="flex flex-wrap justify-between gap-3 m-0">
              <dt className="text-[#a9abb2] text-[14px]">Total da compra</dt>
              <dd className="m-0 text-[22px] font-extrabold text-[#ffac90]">{currency.format(state.order.total)}</dd>
            </dl>
          </div>
          <h4 className="text-[18px] mb-3">Linha do tempo do pedido</h4>
          {state.order.events.length > 0 ? <OrderTimeline events={state.order.events} /> : (
            <p className="text-[#a9abb2] text-[13px] leading-[1.7]">As etapas de processamento estão sendo preparadas. Ainda não há eventos registrados.</p>
          )}
        </div>
      )}
    </section>
  )
}
