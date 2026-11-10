export type Session = {
  id: string
  start: string
  end: string
  title: string
  stage: string
  track: 'principal' | 'inovacao' | 'lideranca'
  participants: string
  summary: string
  topics: string[]
  pdus: [number, number, number]
}

export const ricardoBio = 'Segundo o briefing fornecido para esta experiência, Ricardo Vargas é Ex-Chair do PMI, Diretor Global da Brightline Initiative e host do podcast 5 Minutes PM. Sua participação proposta conecta estratégia, inteligência artificial e execução de projetos em tempos exponenciais. Estas credenciais são informações do briefing; participação e dados biográficos dependem de confirmação. Não foi fornecida fotografia: o avatar RV é representativo.'
const principal = 'Auditório Master Alvorada (Palco Principal)'
export const sessions: Session[] = [
  { id: 'credenciamento', start: '08:30', end: '09:15', title: 'Credenciamento, Welcome Coffee & Networking', stage: 'Área Expo', track: 'principal', participants: 'Equipe de credenciamento e anfitriões · cargos e organização a confirmar', summary: 'Recepção dos participantes, retirada de credenciais e primeiras conexões na área de exposição.', topics: ['Orientação e credenciamento', 'Welcome coffee', 'Networking entre participantes'], pdus: [0, 0, 0] },
  { id: 'abertura', start: '09:15', end: '09:45', title: 'Abertura Oficial PMI DF — O Futuro dos Projetos na Capital Federal', stage: principal, track: 'principal', participants: 'Diretoria PMI Distrito Federal · nomes e cargos individuais a confirmar', summary: 'A visão do capítulo para o futuro dos projetos em Brasília e o papel da comunidade na capital federal.', topics: ['Prioridades da comunidade PMI DF', 'Projetos na capital federal', 'Visão e objetivos do encontro'], pdus: [0, 0, 0.5] },
  { id: 'magna', start: '10:00', end: '11:30', title: 'Inteligência Artificial e o Futuro da Gestão de Projetos: Da Estratégia à Execução em Tempos Exponenciais', stage: principal, track: 'principal', participants: 'Ricardo Vargas · Ex-Chair PMI · Diretor Global Brightline Initiative · host 5 Minutes PM (informações do briefing)', summary: 'Da estratégia à execução: como a inteligência artificial redefine decisões, entrega de valor e o futuro da gestão de projetos em um cenário de mudanças exponenciais.', topics: ['IA e transformação da gestão de projetos', 'Conexão entre estratégia e execução', 'Decisões e valor em tempos exponenciais', 'Novas competências para o gerente de projetos'], pdus: [0.75, 0, 0.75] },
  { id: 'painel-publico', start: '11:35', end: '12:30', title: 'Painel Executivo: Transformação Digital, Governança e IA no Setor Público e Governo Federal em Brasília', stage: principal, track: 'principal', participants: 'Painelistas e moderação · nomes, cargos e órgãos públicos a confirmar', summary: 'Casos de modernização e PMO público para explorar governança, transformação digital e IA na administração federal.', topics: ['Casos de modernização no governo federal', 'PMO público e governança', 'IA e transformação digital no setor público'], pdus: [0.46, 0, 0.46] },
  { id: 'almoco', start: '12:30', end: '14:00', title: 'Almoço Livre & Conexões', stage: 'Área Expositores', track: 'principal', participants: 'Participantes e expositores · nomes, cargos e organizações a confirmar', summary: 'Intervalo livre para almoço e encontros na área de expositores. Alimentação e condições a confirmar.', topics: ['Almoço livre', 'Encontros com expositores', 'Conexões informais'], pdus: [0, 0, 0] },
  { id: 'lideranca', start: '14:00', end: '15:15', title: 'Liderança Exponencial e Power Skills: Comunicação, Negociação e Gestão de Conflitos em Megaprojetos', stage: 'Palco Alvorada · Sessão simultânea A', track: 'lideranca', participants: 'Palestrante · nome, cargo e organização a confirmar', summary: 'Power skills aplicadas à liderança de megaprojetos, com foco em comunicação, negociação e resolução de conflitos.', topics: ['Comunicação em megaprojetos', 'Negociação com stakeholders', 'Gestão de conflitos', 'Liderança exponencial'], pdus: [0, 1.25, 0] },
  { id: 'agilidade', start: '14:00', end: '15:15', title: 'Agilidade em Escala & Governança Orientada a Dados com IA Generativa', stage: 'Palco Inovação · Sessão simultânea B', track: 'inovacao', participants: 'Palestrante · nome, cargo e organização a confirmar', summary: 'Agilidade em escala e governança orientada a dados para incorporar IA generativa à gestão e à tomada de decisão.', topics: ['Agilidade em escala', 'Governança orientada a dados', 'IA generativa nos processos de gestão'], pdus: [1.25, 0, 0] },
  { id: 'coffee', start: '15:15', end: '16:00', title: 'Coffee Break Executivo, Sessão de Conexões e Autógrafos', stage: 'Área Expo · espaço de conexões a confirmar', track: 'principal', participants: 'Participantes e convidados · nomes, cargos e organizações a confirmar', summary: 'Pausa para café, conexões profissionais e sessão de autógrafos. Presenças e dinâmica a confirmar.', topics: ['Coffee break executivo', 'Conexões profissionais', 'Autógrafos com convidados a confirmar'], pdus: [0, 0, 0] },
  { id: 'esg', start: '16:00', end: '17:00', title: 'Painel Estratégico ESG, Sustentabilidade e Megaprojetos de Infraestrutura no Centro-Oeste', stage: principal, track: 'lideranca', participants: 'Painelistas e moderação · nomes, cargos e organizações a confirmar', summary: 'Perspectivas sobre sustentabilidade, ESG e governança de grandes projetos de infraestrutura no Centro-Oeste.', topics: ['ESG na infraestrutura', 'Sustentabilidade no Centro-Oeste', 'Governança de megaprojetos'], pdus: [0.5, 0, 0.5] },
  { id: 'encerramento', start: '17:00', end: '18:00', title: 'Keynote Encerramento — A Próxima Fronteira do Gerente de Projetos: Síntese e Desafios para 2027', stage: principal, track: 'principal', participants: 'Keynote de encerramento · nome, cargo e organização a confirmar', summary: 'Síntese dos aprendizados do dia e reflexão sobre a próxima fronteira da profissão e os desafios para 2027.', topics: ['Síntese dos aprendizados', 'Futuro da profissão', 'Desafios para 2027'], pdus: [0, 0.5, 0.5] },
  { id: 'happy-hour', start: '18:00', end: '19:30', title: 'Happy Hour de Celebração PMI Summit DF & Sorteio de Mentorias', stage: 'Área de convivência · local a confirmar', track: 'principal', participants: 'Comunidade PMI DF e mentores · nomes, cargos e organizações a confirmar', summary: 'Celebração e conexões para encerrar o dia. Mentorias, regras do sorteio e condições de participação a confirmar.', topics: ['Celebração da comunidade', 'Networking de encerramento', 'Sorteio de mentorias sujeito a confirmação'], pdus: [0, 0, 0] },
]

export const AGENDA_KEY = 'pmi-summit-agenda-local'
export function validateAgenda(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && sessions.some((session) => session.id === id)))]
}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
export function brasiliaClock(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return { date: `${part('year')}-${part('month')}-${part('day')}`, minutes: Number(part('hour')) * 60 + Number(part('minute')), label: `${part('day')}/${part('month')}/${part('year')}` }
}
export function sessionStatus(session: Session, now: number | null) {
  if (now === null) return 'Programada'
  if (now >= minutes(session.end)) return 'Concluída'
  if (now >= minutes(session.start)) return 'Agora / Em andamento'
  const next = Math.min(...sessions.filter((item) => minutes(item.start) > now).map((item) => minutes(item.start)))
  return minutes(session.start) === next ? 'A seguir' : 'Programada'
}
export const filters = ['Todas as Palestras', 'Palco Principal Alvorada', 'Trilha Inovação & IA', 'Trilha Liderança & ESG'] as const
export function matchesFilter(session: Session, filter: number) {
  return filter === 0 || (filter === 1 && (session.stage.includes('Alvorada'))) || (filter === 2 && session.track === 'inovacao') || (filter === 3 && session.track === 'lideranca')
}
