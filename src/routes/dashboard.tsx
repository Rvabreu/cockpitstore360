import { createFileRoute } from '@tanstack/react-router'
import DashboardPage from '../components/DashboardPage'

export const Route = createFileRoute('/dashboard')({
  head: () => ({ meta: [{ title: 'Painel | COCKPIT STORE 360' }] }),
  component: DashboardPage,
})
