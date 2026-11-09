import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { SummitPage } from './index'

function fillCheckout() {
  fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Pessoa Exemplo' } })
  fireEvent.change(screen.getByLabelText('E-mail', { exact: true }), { target: { value: 'pessoa@example.com' } })
  fireEvent.click(screen.getByLabelText(/Entendo que esta inscrição é simulada/))
}

describe('SummitPage', () => {
  it('disables all form controls in SSR and enables them only after client hydration', () => {
    const ssr = document.createElement('div')
    ssr.innerHTML = renderToString(<SummitPage />)
    const forms = ssr.querySelectorAll('form')
    expect(forms).toHaveLength(2)
    forms.forEach((form) => {
      expect(form.querySelector('fieldset')).toBeDisabled()
      const controls = form.querySelectorAll('input, select, textarea, button')
      expect(controls.length).toBeGreaterThan(0)
      controls.forEach((control) => expect(control).toBeDisabled())
      expect(new FormData(form).entries().next().done).toBe(true)
    })
    document.body.appendChild(ssr)
    const { container } = render(<SummitPage />, { container: ssr, hydrate: true })
    container.querySelectorAll('form fieldset, form input, form select, form textarea, form button').forEach((control) => expect(control).not.toBeDisabled())
    expect(screen.getByRole('option', { name: 'Palestrante' })).toBeInTheDocument()
    fillCheckout()
    fireEvent.submit(screen.getByLabelText('Nome completo').closest('form')!)
    expect(screen.getByRole('button', { name: 'Confirmar simulação' })).toBeInTheDocument()
  })

  it('renders the four requested tracks, passes, proposed benefits and illustrative profiles', () => {
    render(<SummitPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('PMI SUMMIT BRASÍLIA 2027')
    for (const title of ['Inteligência Artificial & PMO do Futuro', 'Liderança Ágil & Transformação Digital', 'Mega Projetos Governamentais & ESG no DF', 'Gestão Estratégica & Carreira PMP']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(screen.getByText('Data e local propostos, sujeitos à confirmação.')).toBeInTheDocument()
    expect(screen.getAllByText('Convidado a confirmar')).toHaveLength(4)
    for (const pass of ['Passe Geral Summit', 'Passaporte VIP + Masterclass', 'Combo Estudante / Acadêmico']) {
      expect(screen.getByRole('heading', { name: pass })).toBeInTheDocument()
    }
    expect(screen.getByText('Palestras magnas')).toBeInTheDocument()
    expect(screen.getByText('Feira de negócios e networking')).toBeInTheDocument()
    expect(screen.getByText('Masterclass e workshops práticos propostos')).toBeInTheDocument()
    expect(screen.getByText('Almoço executivo com palestrantes proposto')).toBeInTheDocument()
    expect(screen.getByText(/Certificado especial de participação e PDUs propostos, sujeitos à aprovação/)).toBeInTheDocument()
  })

  it('updates pass and total, enforcing quantity limits from 1 to 10', () => {
    render(<SummitPage />)
    const quantity = screen.getByLabelText('Quantidade de ingressos (1 a 10)')
    const decrease = screen.getByRole('button', { name: 'Diminuir quantidade' })
    const increase = screen.getByRole('button', { name: 'Aumentar quantidade' })
    expect(decrease).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar Combo Estudante / Acadêmico' }))
    fireEvent.click(increase)
    expect(quantity).toHaveValue(2)
    expect(screen.getByText('R$ 580,00')).toBeInTheDocument()
    fireEvent.change(quantity, { target: { value: '10' } })
    expect(increase).toBeDisabled()
    expect(screen.getByText('R$ 2900,00')).toBeInTheDocument()
    fireEvent.click(decrease)
    expect(quantity).toHaveValue(9)
    fireEvent.change(quantity, { target: { value: '11' } })
    expect(screen.getByText(/Quantidade inválida/)).toBeInTheDocument()
    fillCheckout()
    fireEvent.click(screen.getByRole('button', { name: /Revisar inscrição simulada/ }))
    expect(screen.queryByRole('button', { name: 'Confirmar simulação' })).not.toBeInTheDocument()
    expect(screen.getByText(/Informe nome, e-mail válido/)).toBeInTheDocument()
  })

  it('validates checkout and confirms only a reviewed current summary', () => {
    render(<SummitPage />)
    const review = screen.getByRole('button', { name: /Revisar inscrição simulada/ })
    fireEvent.click(review)
    expect(screen.getByText(/Informe nome, e-mail válido/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: '  ' } })
    fireEvent.change(screen.getByLabelText('E-mail', { exact: true }), { target: { value: 'invalido' } })
    fireEvent.click(review)
    expect(screen.queryByRole('button', { name: 'Confirmar simulação' })).not.toBeInTheDocument()
    fillCheckout()
    fireEvent.click(review)
    expect(screen.getByText('Passe Geral Summit · 1 ingresso(s) · R$ 690,00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar simulação' }))
    expect(screen.getByText(/Inscrição SIMULADA confirmada/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar simulação' })).not.toBeInTheDocument()
  })

  it('invalidates review whenever pass, quantity, name, email or consent changes', () => {
    render(<SummitPage />)
    fillCheckout()
    const review = screen.getByRole('button', { name: /Revisar inscrição simulada/ })
    const changes = [
      () => fireEvent.click(screen.getByRole('button', { name: 'Selecionar Passaporte VIP + Masterclass' })),
      () => fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' })),
      () => fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Outra Pessoa' } }),
      () => fireEvent.change(screen.getByLabelText('E-mail', { exact: true }), { target: { value: 'outro@example.com' } }),
      () => fireEvent.click(screen.getByLabelText(/Entendo que esta inscrição é simulada/)),
    ]
    for (const change of changes) {
      fireEvent.click(review)
      expect(screen.getByRole('button', { name: 'Confirmar simulação' })).toBeInTheDocument()
      change()
      expect(screen.queryByRole('button', { name: 'Confirmar simulação' })).not.toBeInTheDocument()
    }
  })

  it('switches between two distinct days of preliminary programming', () => {
    render(<SummitPage />)
    expect(screen.getByRole('heading', { name: 'O futuro é um projeto coletivo' })).toBeInTheDocument()
    const second = screen.getByRole('button', { name: '19 SET · DIA 02' })
    fireEvent.click(second)
    expect(second).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Estratégia em movimento' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'O futuro é um projeto coletivo' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '18 SET · DIA 01' }))
    expect(screen.getByRole('heading', { name: 'O futuro é um projeto coletivo' })).toBeInTheDocument()
  })

  it('starts PDUs at zero, accounts for all three categories up to 16 and clears', () => {
    render(<SummitPage />)
    const calculator = screen.getByRole('heading', { name: 'Planeje seus PDUs' }).closest('.pdu-calculator') as HTMLElement
    const total = calculator.querySelector('.pdu-total strong')!
    const category = (name: string) => within(calculator).getByText(name).parentElement!
    expect(total).toHaveTextContent('0')
    for (const label of ['Ways of Working', 'Power Skills', 'Business Acumen']) expect(category(label).querySelector('dd')).toHaveTextContent('0')
    const checkboxes = within(calculator).getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(total).toHaveTextContent('4')
    expect(category('Ways of Working').querySelector('dd')).toHaveTextContent('2')
    expect(category('Business Acumen').querySelector('dd')).toHaveTextContent('2')
    for (const checkbox of checkboxes.slice(1)) fireEvent.click(checkbox)
    expect(total).toHaveTextContent('16')
    expect(category('Ways of Working').querySelector('dd')).toHaveTextContent('6')
    expect(category('Power Skills').querySelector('dd')).toHaveTextContent('4')
    expect(category('Business Acumen').querySelector('dd')).toHaveTextContent('6')
    fireEvent.click(checkboxes[0])
    expect(total).toHaveTextContent('12')
    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }))
    expect(total).toHaveTextContent('0')
    checkboxes.forEach((checkbox) => expect(checkbox).not.toBeChecked())
  })

  it('validates and simulates a local work submission without creating a real registration', () => {
    render(<SummitPage />)
    const submit = screen.getByRole('button', { name: /Simular envio de proposta/ })
    fireEvent.click(submit)
    expect(screen.getByText(/Preencha nome, e-mail válido/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nome', { exact: true }), { target: { value: 'Autor Exemplo' } })
    fireEvent.change(screen.getByLabelText('E-mail de contato'), { target: { value: 'autor@example.com' } })
    fireEvent.change(screen.getByLabelText('Título do trabalho ou proposta'), { target: { value: 'Projetos sustentáveis' } })
    fireEvent.click(screen.getByLabelText(/Entendo que esta submissão é apenas/))
    fireEvent.click(submit)
    expect(screen.getByText(/Submissão SIMULADA concluída/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nome', { exact: true })).toHaveValue('')
  })
})
