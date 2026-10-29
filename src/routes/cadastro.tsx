import { createFileRoute } from '@tanstack/react-router'
import RegistrationPage from '../components/RegistrationPage'

export const Route = createFileRoute('/cadastro')({
  head: () => ({ meta: [{ title: 'Criar conta | COCKPIT STORE 360' }] }),
  component: RegistrationPage,
})
