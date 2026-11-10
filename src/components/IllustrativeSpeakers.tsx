const speakers = [
  { initials: 'GP', role: 'Gestão de projetos', name: 'Quem transforma planos em impacto', bio: 'Perfil de profissional com experiência em portfólios complexos, governança e entrega de valor.', color: 'purple' },
  { initials: 'LD', role: 'Liderança & pessoas', name: 'Quem inspira novas lideranças', bio: 'Perfil de liderança dedicada ao desenvolvimento de equipes, negociação e cultura de colaboração.', color: 'orange' },
  { initials: 'IA', role: 'Inteligência artificial', name: 'Quem conecta tecnologia e propósito', bio: 'Perfil de especialista em aplicações de IA, ética e transformação dos processos de trabalho.', color: 'lilac' },
  { initials: 'EI', role: 'Estratégia & inovação', name: 'Quem enxerga o próximo horizonte', bio: 'Perfil de executivo com atuação em inovação, estratégia e transformação organizacional.', color: 'purple' },
]

export default function IllustrativeSpeakers() {
  return <div className="speaker-grid">{speakers.map((speaker) => <article className="speaker-card" key={speaker.initials}><div className={`speaker-art ${speaker.color}`} aria-hidden="true"><span>{speaker.initials}</span><div className="speaker-orbit" /><small>PERFIL ILUSTRATIVO</small></div><p className="eyebrow">{speaker.role}</p><h3>{speaker.name}</h3><p>{speaker.bio}</p><span className="fine-print">Convidado a confirmar</span></article>)}</div>
}
