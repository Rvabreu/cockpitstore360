import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CheckoutPage from './CheckoutPage'
import * as payments from '../services/paymentsService'
const USER={id:'u1',email:'qa@example.com'}
const ID='22222222-2222-4222-8222-222222222222'
const CATALOG={currency:'USD',mode:'test',products:[{id:'a',name:'Produto A',unitPriceCents:1234},{id:'b',name:'Produto B',unitPriceCents:500}]}
const ORDER={id:ID,items:[{productId:'a',name:'Produto A',quantity:2,unitPriceCents:1234,lineTotalCents:2468}],totalCents:2468,currency:'USD',status:'pending',createdAt:'2026-10-29T12:00:00.000Z'}
const RESULT={orderId:ID,status:'pending',checkoutUrl:'https://checkout.stripe.com/c/pay/cs_test_fixture'}
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status})}
function session(user:typeof USER|null=USER){return json({user,csrfToken:'csrf'})}
function deferred(){let resolve!:(r:Response)=>void;const promise=new Promise<Response>(done=>{resolve=done});return {promise,resolve,fetch:()=>promise}}
beforeEach(()=>{vi.restoreAllMocks();vi.stubGlobal('fetch',vi.fn());vi.spyOn(payments,'redirectToStripe').mockImplementation(()=>{});vi.mocked(fetch).mockResolvedValueOnce(session()).mockResolvedValueOnce(json(CATALOG))})
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()})
async function ready(props:Parameters<typeof CheckoutPage>[0]={initialProductId:'a'}){const view=render(<CheckoutPage {...props}/>);await waitFor(()=>expect(screen.getByLabelText('Produto para adicionar')).toBeEnabled());return view}
function review(){fireEvent.click(screen.getByRole('button',{name:'Revisar pedido'}))}
function pay(){fireEvent.click(screen.getByRole('button',{name:'Pagar com Stripe'}))}
const posts=()=>vi.mocked(fetch).mock.calls.filter(([,o])=>o?.method==='POST')

it('SSRloading semrequests/formnames/PIIinputs nem seed',()=>{
  const html=renderToString(<CheckoutPage/>);expect(html).toContain('Verificando sessão');expect(html).toContain('Finalizar compra');expect(html).not.toMatch(/name="|type="(?:password|email)"|classic-tee|Produto A/);expect(fetch).not.toHaveBeenCalled()
})
it('anon exige login antes catálogo/preços/querycart',async()=>{
  vi.mocked(fetch).mockReset().mockResolvedValueOnce(session(null));render(<CheckoutPage initialProductId="a"/>);
  expect(await screen.findByRole('link',{name:'Entrar para pagar'})).toHaveAttribute('href','/login');expect(fetch).toHaveBeenCalledTimes(1);expect(screen.queryByLabelText('Produto para adicionar')).not.toBeInTheDocument()
})
it.each([503,500])('catálogo%s indisponível sem fallback/simulação;retry sóGET',async(status)=>{
  vi.mocked(fetch).mockReset().mockResolvedValueOnce(session()).mockResolvedValueOnce(json({},status)).mockResolvedValueOnce(session()).mockResolvedValueOnce(json(CATALOG));render(<CheckoutPage initialProductId="a"/>);
  expect(await screen.findByRole('alert')).toBeInTheDocument();expect(screen.queryByLabelText('Quantidade de Produto A')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));await screen.findByLabelText('Quantidade de Produto A');expect(posts()).toHaveLength(0)
})
it('liveUSDcart query/qty/remove/emptycta/reviewback preserva e nenhum storage',async()=>{
  const get=vi.spyOn(Storage.prototype,'getItem'),set=vi.spyOn(Storage.prototype,'setItem'),log=vi.spyOn(console,'log').mockImplementation(()=>{});await ready();expect(screen.getByText('Modo de teste: nenhum valor real é cobrado.')).toBeInTheDocument();expect(document.body.textContent).toMatch(/12,34.*USD/);expect(document.body.textContent).not.toMatch(/R\$/)
  fireEvent.change(screen.getByLabelText('Quantidade de Produto A'),{target:{value:'11'}});expect(screen.getByRole('alert')).toHaveTextContent('Informe uma quantidade entre 1 e 10.');fireEvent.change(screen.getByLabelText('Quantidade de Produto A'),{target:{value:'3'}});review();fireEvent.click(screen.getByRole('button',{name:'Editar carrinho'}));expect(screen.getByLabelText('Quantidade de Produto A')).toHaveValue(3)
  fireEvent.click(screen.getByRole('button',{name:'Remover Produto A'}));expect(screen.getByRole('link',{name:'Explorar catálogo'})).toHaveAttribute('href','/#colecao');expect(screen.getByRole('button',{name:'Revisar pedido'})).toBeDisabled();expect(posts()).toHaveLength(0);expect(get).not.toHaveBeenCalled();expect(set).not.toHaveBeenCalled();expect(log).not.toHaveBeenCalled()
})
it('invalidselection nuncaGETcatalog/order nemcart silently corrected',async()=>{
  render(<CheckoutPage invalidInitialSelection/>);expect(await screen.findByRole('alert')).toHaveTextContent('Seleção de produto ou pedido inválida.');expect(fetch).toHaveBeenCalledTimes(1)
})
it('pendingdouble1POST strictpayload;redirect sóvalidado nuncaalega paid',async()=>{
  const pending=deferred();vi.mocked(fetch).mockImplementationOnce(pending.fetch);await ready();review();pay();pay();await waitFor(()=>expect(posts()).toHaveLength(1));expect(screen.getByRole('button',{name:'Pagar com Stripe'})).toBeDisabled();expect(payments.redirectToStripe).not.toHaveBeenCalled();await act(async()=>pending.resolve(json(RESULT,201)));await waitFor(()=>expect(payments.redirectToStripe).toHaveBeenCalledWith(RESULT.checkoutUrl));expect(screen.getByRole('status')).not.toHaveTextContent('Pagamento confirmado pelo servidor.');expect(JSON.parse(posts()[0][1]?.body as string)).toEqual({items:[{productId:'a',quantity:1}],idempotencyKey:expect.stringMatching(/^[0-9a-f-]{36}$/)})
})
it.each(['network','500'])('falha%s mantém manualmesmakeypayload/noautopost;edição nova key e aviso',async(kind)=>{
  if(kind==='network')vi.mocked(fetch).mockRejectedValueOnce(new TypeError('network'));else vi.mocked(fetch).mockResolvedValueOnce(json({},500));vi.mocked(fetch).mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(json(RESULT,201));await ready();review();pay();await screen.findByRole('alert');const first=posts()[0][1]?.body;expect(posts()).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));await waitFor(()=>expect(posts()).toHaveLength(2));await waitFor(()=>expect(screen.getByRole('button',{name:'Pagar com Stripe'})).toBeEnabled());expect(posts()[1][1]?.body).toBe(first);fireEvent.click(screen.getByRole('button',{name:'Editar carrinho'}));fireEvent.change(screen.getByLabelText('Quantidade de Produto A'),{target:{value:'2'}});expect(screen.getByText(/tentativa anterior pode ter iniciado um pagamento/)).toBeInTheDocument();review();pay();await waitFor(()=>expect(posts()).toHaveLength(3));expect(JSON.parse(posts()[2][1]?.body as string).idempotencyKey).not.toBe(JSON.parse(first as string).idempotencyKey)
})
it('POST201unsafeurl não redirect ou paid',async()=>{
  vi.mocked(fetch).mockResolvedValueOnce(json({...RESULT,checkoutUrl:'https://checkout.stripe.com.evil.example/'},201));await ready();review();pay();await screen.findByRole('alert');expect(payments.redirectToStripe).not.toHaveBeenCalled();expect(screen.queryByRole('heading',{name:'Pagamento confirmado'})).not.toBeInTheDocument()
})
it.each([201,200])('POST%s pendingnull consultaowned/poll sem redirect/fakepaid/nova tentativa',async(status)=>{
  vi.mocked(fetch).mockResolvedValueOnce(json({...RESULT,checkoutUrl:null},status)).mockImplementation(async()=>json({order:ORDER}))
  await ready();review();pay()
  await waitFor(()=>expect(screen.getByRole('button',{name:'Atualizar pagamento'})).toBeEnabled())
  expect(screen.getByRole('heading',{name:'Status do pagamento'})).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Pagamento em confirmação.')
  expect(payments.redirectToStripe).not.toHaveBeenCalled()
  expect(screen.queryByRole('heading',{name:'Pagamento confirmado'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Tentar novamente'})).not.toBeInTheDocument()
  expect(posts()).toHaveLength(1)
  expect(vi.mocked(fetch).mock.calls.filter(([url])=>String(url).includes(`/payments/orders/${ID}`))).toHaveLength(1)
  vi.useFakeTimers()
  fireEvent.click(screen.getByRole('button',{name:'Atualizar pagamento'}))
  await act(async()=>{await Promise.resolve();await Promise.resolve()})
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000)})
  expect(vi.mocked(fetch).mock.calls.filter(([url])=>String(url).includes(`/payments/orders/${ID}`)).length).toBeGreaterThanOrEqual(3)
  expect(posts()).toHaveLength(1);expect(payments.redirectToStripe).not.toHaveBeenCalled()
  expect(screen.getByRole('status')).toHaveTextContent('Pagamento em confirmação.')
})
it.each(['sucesso','cancelado'] as const)('retorno%s não paid;GETownedauthoritative/UTC/quantidades',async(returnStatus)=>{
  vi.mocked(fetch).mockResolvedValueOnce(json({order:ORDER})).mockResolvedValueOnce(json({order:{...ORDER,status:'paid'}}));render(<CheckoutPage initialOrderId={ID} returnStatus={returnStatus}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Atualizar pagamento'})).toBeEnabled());expect(screen.getByRole('heading',{name:'Status do pagamento'})).toBeInTheDocument();expect(posts()).toHaveLength(0);expect(payments.redirectToStripe).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Atualizar pagamento'}));await screen.findByRole('heading',{name:'Pagamento confirmado'});const receipt=screen.getByRole('region',{name:'Pagamento confirmado'});expect(within(receipt).getByText(/2 ×.*12,34.*USD/)).toBeInTheDocument();expect(within(receipt).getByText(/Total do pedido:.*24,68.*USD/)).toBeInTheDocument();expect(receipt.querySelector('time')).toHaveAttribute('datetime',ORDER.createdAt);expect(receipt.querySelector('time')).toHaveTextContent('UTC');expect(screen.getByRole('status')).toHaveTextContent('Pagamento confirmado pelo servidor.')
})
it('poll401 apagaordem/preços e encerra account sem paidfallback',async()=>{
  vi.mocked(fetch).mockResolvedValueOnce(json({order:ORDER})).mockResolvedValueOnce(json({},401));render(<CheckoutPage initialOrderId={ID}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Atualizar pagamento'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Atualizar pagamento'}));await screen.findByRole('link',{name:'Entrar para pagar'});expect(screen.queryByText(`Identificador: ${ID}`)).not.toBeInTheDocument();expect(screen.queryByText('Produto A')).not.toBeInTheDocument();expect(screen.getByRole('status')).toHaveTextContent('Sessão não autenticada.')
})
it('403snapshot usuário diferente removeoldattempt/cart sem autoPOST',async()=>{
  vi.mocked(fetch).mockResolvedValueOnce(json({},403)).mockResolvedValueOnce(session({id:'u2',email:'other@example.com'}));await ready();review();pay();await screen.findByText(/A sessão mudou/);expect(posts()).toHaveLength(1);expect(screen.queryByLabelText('Quantidade de Produto A')).not.toBeInTheDocument();expect(screen.queryByLabelText('Produto para adicionar')).not.toBeInTheDocument();expect(screen.queryByText('Produto A')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Tentar novamente'})).toBeEnabled();expect(payments.redirectToStripe).not.toHaveBeenCalled()
})
it('unmountabort GETtardio pago ignorado/novoanon não herdaorder',async()=>{
  const late=deferred();vi.mocked(fetch).mockImplementationOnce(late.fetch).mockResolvedValueOnce(session(null));const view=render(<CheckoutPage initialOrderId={ID}/>);await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));const signal=vi.mocked(fetch).mock.calls[2][1]?.signal;view.unmount();expect(signal?.aborted).toBe(true);render(<CheckoutPage/>);await act(async()=>late.resolve(json({order:{...ORDER,status:'paid'}})));await screen.findByRole('link',{name:'Entrar para pagar'});expect(screen.queryByRole('heading',{name:'Pagamento confirmado'})).not.toBeInTheDocument();expect(posts()).toHaveLength(0)
})
it('pollmáximo30requests/60s não infinito nem redirect',async()=>{
  vi.mocked(fetch).mockImplementation(async()=>json({order:ORDER}));render(<CheckoutPage initialOrderId={ID}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Atualizar pagamento'})).toBeEnabled());vi.useFakeTimers();fireEvent.click(screen.getByRole('button',{name:'Atualizar pagamento'}));await act(async()=>{await Promise.resolve();await Promise.resolve()});await act(async()=>{await vi.advanceTimersByTimeAsync(62000)});const count=vi.mocked(fetch).mock.calls.filter(([u])=>String(u).includes('/payments/orders/')).length;expect(count).toBeLessThanOrEqual(31);expect(screen.getByRole('status')).toHaveTextContent(/Atualize manualmente/);await act(async()=>{await vi.advanceTimersByTimeAsync(120000)});expect(vi.mocked(fetch).mock.calls.filter(([u])=>String(u).includes('/payments/orders/'))).toHaveLength(count);expect(payments.redirectToStripe).not.toHaveBeenCalled()
})
