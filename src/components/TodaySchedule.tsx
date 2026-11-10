import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, Check, Clock3, MapPin, Sparkles, X } from 'lucide-react'
import { AGENDA_KEY, brasiliaClock, filters, matchesFilter, ricardoBio, sessions, sessionStatus, validateAgenda, type Session } from './todaySchedule'

function Pdus({ session }: { session: Session }) {
  const total = session.pdus.reduce((sum, value) => sum + value, 0)
  return <div className="today-pdus"><strong>{Number(total.toFixed(2))} PDUs estimados</strong><span>WW {session.pdus[0]} · PS {session.pdus[1]} · BA {session.pdus[2]}</span></div>
}

function Details({ session, saved, toggle, close }: { session: Session; saved: boolean; toggle: () => void; close: () => void }) {
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      if (event.key === 'Tab') {
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]') ?? [])
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    function focusin(event: FocusEvent) {
      if (!dialog.current?.contains(event.target as Node)) dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }
    document.addEventListener('keydown', keydown)
    document.addEventListener('focusin', focusin)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('focusin', focusin)
      previous?.focus()
    }
  }, [close])
  return <div className="today-overlay" onClick={(event) => { if (event.target === event.currentTarget) close() }}>
    <div ref={dialog} className="today-dialog" role="dialog" aria-modal="true" aria-labelledby="session-detail-title" aria-describedby="session-detail-summary">
      <button className="today-close" type="button" aria-label="Fechar detalhes" onClick={close}><X aria-hidden="true" /></button>
      <p className="eyebrow">POR DENTRO DO ENCONTRO</p><h2 id="session-detail-title">{session.title}</h2>
      <p className="today-meta">{session.start}–{session.end} · {session.stage}</p>
      <p id="session-detail-summary">{session.summary}</p>
      <h3>Participantes e biografia</h3><p>{session.participants}</p><p>{session.id === 'magna' ? ricardoBio : 'Biografias completas, participantes, cargos e organizações não foram fornecidos e estão a confirmar.'}</p>
      <h3>Tópicos da sessão</h3><ul>{session.topics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
      <Pdus session={session} /><p className="fine-print">Programação fornecida para esta experiência; confirmação de presença, horários e PDUs pendentes. WW: Ways of Working · PS: Power Skills · BA: Business Acumen. Agenda local não reserva vaga.</p>
      <button type="button" className="button button-primary" aria-pressed={saved} onClick={toggle}>{saved ? 'Salvo · Remover da Minha Agenda' : 'Salvar na Minha Agenda'}</button>
    </div>
  </div>
}

export default function TodaySchedule({ standalone = false }: { standalone?: boolean }) {
  const [clock, setClock] = useState<ReturnType<typeof brasiliaClock> | null>(null)
  const [filter, setFilter] = useState(0)
  const [saved, setSaved] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [storageWarning, setStorageWarning] = useState('')
  const [toast, setToast] = useState('')
  const [selected, setSelected] = useState<Session | null>(null)
  const close = useRef(() => setSelected(null)).current
  useEffect(() => {
    const update = () => setClock(brasiliaClock(new Date()))
    update()
    const timer = window.setInterval(update, 60_000)
    try {
      const raw = window.localStorage.getItem(AGENDA_KEY)
      let ids: string[] = []
      try { ids = validateAgenda(raw === null ? [] : JSON.parse(raw)) } catch { setStorageWarning('Agenda inválida recuperada. Você pode salvar novamente suas sessões.') }
      setSaved(ids)
      if (raw !== null) window.localStorage.setItem(AGENDA_KEY, JSON.stringify(ids))
    } catch { setStorageWarning('Armazenamento indisponível. Sua agenda funciona apenas nesta visita.') }
    setReady(true)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])
  function toggle(session: Session) {
    const removing = saved.includes(session.id)
    const ids = removing ? saved.filter((id) => id !== session.id) : [...saved, session.id]
    setSaved(ids)
    try { window.localStorage.setItem(AGENDA_KEY, JSON.stringify(ids)) } catch { setStorageWarning('Armazenamento indisponível. Sua agenda funciona apenas nesta visita.') }
    setToast(removing ? 'Removido da sua agenda' : 'Adicionado à sua agenda')
  }
  function card(session: Session, featured = false) {
    const isSaved = saved.includes(session.id)
    const status = sessionStatus(session, clock?.minutes ?? null)
    return <article key={session.id} className={`today-card ${featured ? 'today-magna' : ''}`} aria-labelledby={`title-${session.id}`}>
      {featured && <div className="magna-person"><div className="rv-avatar" role="img" aria-label="Avatar representativo de Ricardo Vargas, iniciais RV"><span>RV</span><Sparkles aria-hidden="true" /></div><span className="fine-print">AVATAR REPRESENTATIVO · SEM FOTO</span><h3>Ricardo Vargas</h3><p>Ex-Chair PMI<br />Diretor Global Brightline Initiative<br />Host 5 Minutes PM</p><small>Credenciais segundo o briefing · participação a confirmar</small></div>}
      <div className="today-card-content">
        <div className="today-card-top">{featured ? <span className="magna-badge">Keynote Internacional / Palestra Magna</span> : <span className="today-track">{session.track === 'inovacao' ? 'INOVAÇÃO & IA' : session.track === 'lideranca' ? 'LIDERANÇA & ESG' : 'ENCONTRO & PALCO PRINCIPAL'}</span>}<span className={`session-status ${status.startsWith('Agora') ? 'is-live' : ''}`}>{status}</span></div>
        {featured && <p className="magna-awaited"><Sparkles size={15} aria-hidden="true" /> Mais Aguardada do Dia · destaque do briefing</p>}
        <div className="today-meta"><span><Clock3 size={16} aria-hidden="true" /><time>{session.start}</time>–<time>{session.end}</time></span><span><MapPin size={16} aria-hidden="true" />{session.stage}</span></div>
        <h3 id={`title-${session.id}`}>{session.title}</h3>
        {!featured && <p className="today-participants">{session.participants}</p>}
        <p className="today-summary">{session.summary}</p><Pdus session={session} />
        <div className="today-actions"><button type="button" className={`button ${isSaved ? 'button-secondary' : 'button-primary'}`} disabled={!ready} aria-pressed={isSaved} aria-label={`${isSaved ? 'Salvo · Remover da Minha Agenda' : 'Salvar na Minha Agenda'}: ${session.title}`} onClick={() => toggle(session)}>{isSaved ? <Check size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}{isSaved ? 'Salvo · Remover' : 'Salvar na Minha Agenda'}</button><button type="button" className="text-link" aria-label={`Ver detalhes: ${session.title}`} onClick={() => setSelected(session)}>Ver detalhes <ArrowUpRight size={16} aria-hidden="true" /></button></div>
      </div>
    </article>
  }
  const list = sessions.filter((session) => session.id !== 'magna' && matchesFilter(session, filter))
  return <section id="programacao-hoje" className="section today-section" aria-labelledby="today-title">
    <div className="container">
      <div className="today-heading"><div><p className="eyebrow">SUA JORNADA. CONEXÕES EXTRAORDINÁRIAS.</p>{standalone ? <h1 id="today-title">Programação de <span>hoje.</span></h1> : <h2 id="today-title">Programação de <span>hoje.</span></h2>}<p className="today-date">{clock ? <time dateTime={clock.date}>{clock.label}</time> : 'Data de hoje ao carregar'} · Brasília · America/Sao_Paulo</p></div><div><p>11 encontros. Uma comunidade.<br />Planeje o seu dia e escolha suas próximas conexões.</p><a className="text-link" href={standalone ? '/#programacao-hoje' : '/hoje'}>{standalone ? 'Voltar à programação na Home' : 'Abrir página de hoje'} <ArrowUpRight size={16} aria-hidden="true" /></a></div></div>
      <p className="today-disclaimer">Programação fornecida para esta experiência, não oficialmente validada. Participantes, locais, horários e PDUs sujeitos à confirmação. O relógio usa o dia corrente em Brasília; as datas propostas de 2027 do portal permanecem inalteradas.</p>
      {card(sessions.find((session) => session.id === 'magna')!, true)}
      <div className="today-list-heading"><div><p className="eyebrow">DO PRIMEIRO CAFÉ À ÚLTIMA CONEXÃO</p><h3>Explore o dia</h3></div><span>Minha Agenda · {saved.length} {saved.length === 1 ? 'sessão salva' : 'sessões salvas'}</span></div>
      <p className="fine-print">Agenda local neste navegador, não reserva vaga nem gera inscrição. Use “Salvo · Remover” para retirar uma sessão. Sessões simultâneas são alternativas; PDUs não devem ser somados em horários sobrepostos.</p>
      {storageWarning && <p className="form-message" role="status">{storageWarning}</p>}
      <div className="today-filters" role="group" aria-label="Filtrar programação de hoje">{filters.map((label, index) => <button type="button" key={label} aria-pressed={index === filter} onClick={() => setFilter(index)}>{label}</button>)}</div>
      <p className="today-count" aria-live="polite">{list.length} {list.length === 1 ? 'sessão na lista' : 'sessões na lista'} · Palestra Magna sempre em destaque acima</p>
      <div className="today-list" aria-label="Sessões de hoje">{list.map((session) => card(session))}</div>
      <p className="fine-print today-pdu-note">PDUs estimados pela duração do conteúdo, arredondados a duas casas; atividades logísticas e networking: 0. WW = Ways of Working · PS = Power Skills · BA = Business Acumen. Crédito depende de validação e participação efetiva.</p>
    </div>
    <div className={`today-toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    {selected && <Details session={selected} saved={saved.includes(selected.id)} toggle={() => toggle(selected)} close={close} />}
  </section>
}
