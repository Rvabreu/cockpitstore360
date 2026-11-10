export type EditorialAxisId = 'ways-of-working' | 'power-skills' | 'business-acumen'

export interface EditorialAxis {
  id: EditorialAxisId
  title: string
  subtitle: string
  description: string
  colorBadge: string
  bgBadge: string
  borderBadge: string
}

export type ScheduleItemCategory = 'session' | 'break' | 'ceremony'

export interface ScheduleItem {
  id: string
  index: number
  startTime: string
  endTime: string
  timeRange: string
  title: string
  description: string
  category: ScheduleItemCategory
  axisId?: EditorialAxisId
  axisLabel?: string
  badgeLabel?: string
  isBreak: boolean
}

export interface EventMetadata {
  title: string
  subtitle: string
  referenceDate: string
  dateDisclaimer: string
  statusBadge: string
  officialDisclaimerTitle: string
  officialDisclaimerText: string
  axesEditorialNotice: string
  methodologyNotice: string
}

export const EVENT_METADATA: EventMetadata = {
  title: 'Palestras de Gestão de Projetos — PMI | Programação preliminar',
  subtitle: 'Proposta editorial e visual com grade preliminar de palestras, eixos temáticos e espaços de conexão para a comunidade de projetos.',
  referenceDate: '10/11/2026 — a confirmar',
  dateDisclaimer: 'Data de referência: 10/11/2026 — a confirmar. Cronograma sujeito a alterações pelos organizadores.',
  statusBadge: 'PROPOSTA NÃO OFICIAL • SUJEITA À CONFIRMAÇÃO',
  officialDisclaimerTitle: 'Aviso Importante: Proposta Conceitual e Preliminar',
  officialDisclaimerText:
    'Esta página é um protótipo conceitual e independente desenvolvido para apresentação de proposta visual de grade temática. Não representa uma programação definitiva, não possui vínculo, homologação ou patrocínio oficial do PMI (Project Management Institute), nem confere direito a PDUs (Professional Development Units), certificações ou inscrição formal.',
  axesEditorialNotice:
    'Os eixos temáticos (Ways of Working, Power Skills e Business Acumen) são adotados estritamente como classificação editorial de conteúdo, sem representar certificação oficial ou chancela acadêmica.',
  methodologyNotice:
    'Metodologias e abordagens práticas (como OPPM, PMBOK, Scrum, Kanban e gestão híbrida) são referenciadas como tópicos contemporâneos de discussão de mercado, sem caráter de padrão obrigatório.',
}

export const EDITORIAL_AXES: Record<EditorialAxisId, EditorialAxis> = {
  'ways-of-working': {
    id: 'ways-of-working',
    title: 'Ways of Working',
    subtitle: 'Formas de Trabalhar',
    description: 'Práticas preditivas, ágeis, híbridas e ferramentas inovadoras para maximizar entregas consistentes.',
    colorBadge: 'text-[#57d4a5]',
    bgBadge: 'bg-[#57d4a51a]',
    borderBadge: 'border-[#57d4a544]',
  },
  'power-skills': {
    id: 'power-skills',
    title: 'Power Skills',
    subtitle: 'Competências Interpessoais',
    description: 'Liderança colaborativa, negociação estratégica, comunicação empática e gestão de conflitos.',
    colorBadge: 'text-[#ff9c7a]',
    bgBadge: 'bg-[#ff633b1a]',
    borderBadge: 'border-[#ff633b44]',
  },
  'business-acumen': {
    id: 'business-acumen',
    title: 'Business Acumen',
    subtitle: 'Visão de Negócio & Estratégia',
    description: 'Conexão entre execução de portfólio, metas corporativas, geração de valor e critérios ESG.',
    colorBadge: 'text-[#60a5fa]',
    bgBadge: 'bg-[#60a5fa1a]',
    borderBadge: 'border-[#60a5fa44]',
  },
}

export const SCHEDULE_ITEMS: ScheduleItem[] = [
  {
    id: 'item-01',
    index: 1,
    startTime: '08:00',
    endTime: '08:45',
    timeRange: '08:00–08:45',
    title: 'Credenciamento, Welcome Coffee e Networking',
    description: 'Recepção dos participantes, retirada de crachás preliminares e café de boas-vindas para aproximação inicial entre profissionais da área.',
    category: 'break',
    badgeLabel: 'Recepção & Café',
    isBreak: true,
  },
  {
    id: 'item-02',
    index: 2,
    startTime: '08:45',
    endTime: '09:15',
    timeRange: '08:45–09:15',
    title: 'O Futuro da Gestão de Projetos: Visão Global do PMI',
    description: 'Sessão de abertura com reflexões sobre macrotendências globais na liderança de projetos, transformações do trabalho e o papel estratégico do gerente de projetos.',
    category: 'session',
    axisId: 'business-acumen',
    axisLabel: 'Visão de Negócio',
    badgeLabel: 'Palestra de Abertura',
    isBreak: false,
  },
  {
    id: 'item-03',
    index: 3,
    startTime: '09:15',
    endTime: '10:15',
    timeRange: '09:15–10:15',
    title: 'Liderança na Era da IA: Maximizando o Sucesso de Projetos com GenAI',
    description: 'Aplicações práticas de Inteligência Artificial Generativa no suporte a planejamento, síntese de requisitos, gestão de riscos e ganho de eficiência operacional.',
    category: 'session',
    axisId: 'ways-of-working',
    axisLabel: 'Ways of Working',
    badgeLabel: 'Palestra Temática',
    isBreak: false,
  },
  {
    id: 'item-04',
    index: 4,
    startTime: '10:15',
    endTime: '10:45',
    timeRange: '10:15–10:45',
    title: 'Coffee Break da Manhã e Visitação à Expo',
    description: 'Pausa para interação, troca de impressões entre palestras e circulação pelas áreas de demonstração de práticas e soluções da comunidade.',
    category: 'break',
    badgeLabel: 'Intervalo & Networking',
    isBreak: true,
  },
  {
    id: 'item-05',
    index: 5,
    startTime: '10:45',
    endTime: '11:45',
    timeRange: '10:45–11:45',
    title: 'Abordagens Híbridas em Escala: Integrando Ágil e Preditivo',
    description: 'Análise de modelos operacionais híbridos que combinam rigor de escopo e governança preditiva com ciclos iterativos e adaptabilidade das metodologias ágeis.',
    category: 'session',
    axisId: 'ways-of-working',
    axisLabel: 'Ways of Working',
    badgeLabel: 'Palestra Temática',
    isBreak: false,
  },
  {
    id: 'item-06',
    index: 6,
    startTime: '11:45',
    endTime: '12:45',
    timeRange: '11:45–12:45',
    title: 'Power Skills Essenciais: Negociação e Resolução de Conflitos Complexos',
    description: 'Técnicas de facilitação interpessoal, influência positiva e alinhamento de múltiplos stakeholders em ambientes corporativos com objetivos concorrentes.',
    category: 'session',
    axisId: 'power-skills',
    axisLabel: 'Power Skills',
    badgeLabel: 'Palestra Temática',
    isBreak: false,
  },
  {
    id: 'item-07',
    index: 7,
    startTime: '12:45',
    endTime: '14:00',
    timeRange: '12:45–14:00',
    title: 'Intervalo de Almoço e Speed Mentoring',
    description: 'Período livre para refeição com espaço voluntário de conversas rápidas sobre transição de carreira, liderança e melhores práticas entre participantes.',
    category: 'break',
    badgeLabel: 'Almoço & Mentoria',
    isBreak: true,
  },
  {
    id: 'item-08',
    index: 8,
    startTime: '14:00',
    endTime: '15:00',
    timeRange: '14:00–15:00',
    title: 'PMO Orientado a Valor: Conectando Métricas de Projeto a OKRs Executivos',
    description: 'Estruturação de Escritórios de Gerenciamento de Projetos com foco em entrega mensurável de benefícios, priorização de portfólio e alinhamento com metas estratégicas.',
    category: 'session',
    axisId: 'business-acumen',
    axisLabel: 'Business Acumen',
    badgeLabel: 'Palestra Temática',
    isBreak: false,
  },
  {
    id: 'item-09',
    index: 9,
    startTime: '15:00',
    endTime: '16:00',
    timeRange: '15:00–16:00',
    title: 'Painel: ESG e Sustentabilidade na Gestão de Projetos de Grande Porte',
    description: 'Mesa-redonda com especialistas discutindo a incorporação sistemática de impactos socioambientais e integridade de governança em iniciativas estratégicas.',
    category: 'session',
    axisId: 'business-acumen',
    axisLabel: 'Business Acumen',
    badgeLabel: 'Painel de Discussão',
    isBreak: false,
  },
  {
    id: 'item-10',
    index: 10,
    startTime: '16:00',
    endTime: '16:30',
    timeRange: '16:00–16:30',
    title: 'Coffee Break da Tarde e Troca entre Capítulos',
    description: 'Momento de descontração e compartilhamento de vivências entre profissionais de diferentes regiões, grupos de estudos e capítulos associados.',
    category: 'break',
    badgeLabel: 'Intervalo da Tarde',
    isBreak: true,
  },
  {
    id: 'item-11',
    index: 11,
    startTime: '16:30',
    endTime: '17:30',
    timeRange: '16:30–17:30',
    title: 'Resiliência e Inovação: Governança Eficaz sob Incertezas Globais',
    description: 'Mecanismos de tomada de decisão ágil sob volatilidade econômica e tecnológica, reduzindo riscos de atraso e mantendo a viabilidade dos investimentos.',
    category: 'session',
    axisId: 'ways-of-working',
    axisLabel: 'Ways of Working',
    badgeLabel: 'Palestra Temática',
    isBreak: false,
  },
  {
    id: 'item-12',
    index: 12,
    startTime: '17:30',
    endTime: '18:00',
    timeRange: '17:30–18:00',
    title: 'Reconhecimento PMO do Ano, Premiação e Sorteios',
    description: 'Sessão solene de encerramento acadêmico com homenagem a iniciativas exemplares de gestão e confraternização simbólica dos participantes.',
    category: 'ceremony',
    badgeLabel: 'Premiação & Encerramento',
    isBreak: false,
  },
  {
    id: 'item-13',
    index: 13,
    startTime: '18:00',
    endTime: '19:30',
    timeRange: '18:00–19:30',
    title: 'Happy Hour e Networking',
    description: 'Encerramento informal do encontro para celebração conjunta, troca de contatos e estreitamento de parcerias profissionais.',
    category: 'break',
    badgeLabel: 'Confraternização Final',
    isBreak: true,
  },
]

export const FAQ_ITEMS = [
  {
    question: 'A data do evento e a grade de palestras já estão confirmadas?',
    answer:
      'Não. Esta página exibe uma grade preliminar e conceitual (Data de referência: 10/11/2026 — a confirmar) desenvolvida como protótipo. O cronograma oficial, os palestrantes e o local definitivo serão anunciados oportunamente caso a proposta seja formalizada.',
  },
  {
    question: 'Este evento emite PDUs para certificações do PMI?',
    answer:
      'Não. Por se tratar de um rascunho de protótipo não homologado, não há concessão, promessa ou validação de PDUs (Professional Development Units) ou certificados vinculados.',
  },
  {
    question: 'O One-Page Project Manager (OPPM) é obrigatório pelo PMI?',
    answer:
      'Não. O One-Page Project Manager (OPPM) e outras ferramentas de comunicação visual são recursos e metodologias complementares de gestão, e não um padrão exclusivo ou compulsório do PMI.',
  },
  {
    question: 'Posso imprimir ou salvar esta programação?',
    answer:
      'Sim. A página conta com estilos de impressão otimizados (CSS print) que geram uma visão compacta e legível em preto e branco de alta legibilidade, ideal para referência rápida.',
  },
]
