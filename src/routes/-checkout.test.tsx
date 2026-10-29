import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const state = vi.hoisted(() => ({ search: {} as Record<string, unknown>, searchStr: '' }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: {
    validateSearch: (search: Record<string, unknown>) => Record<string, unknown>
    component: () => React.ReactNode
  }) => ({ options, useSearch: () => state.search }),
  useLocation: () => ({ searchStr: state.searchStr }),
}))
vi.mock('../components/CheckoutPage', () => ({
  default: (props: { initialProductId?: string; invalidInitialSelection?: boolean }) =>
    <output data-testid="checkout-props">{JSON.stringify(props)}</output>,
}))
import { Route } from './checkout'

const validateSearch = Route.options.validateSearch as (search: Record<string, unknown>) => Record<string, unknown>
afterEach(() => { cleanup(); state.search = {}; state.searchStr = '' })
function props(search: Record<string, unknown>, searchStr: string) {
  state.search = validateSearch(search)
  state.searchStr = searchStr
  const Component = Route.options.component as () => React.ReactNode
  render(<Component />)
  return JSON.parse(screen.getByTestId('checkout-props').textContent!)
}

it('validateSearch conserva apenas produto público válido sem derivar props internas para URL', () => {
  const search = { produto: 'classic-tee', initialProductId: 'injected', invalidInitialSelection: true, price: 1 }
  expect(validateSearch(search)).toEqual({ produto: 'classic-tee' })
  expect(search).toEqual({ produto: 'classic-tee', initialProductId: 'injected', invalidInitialSelection: true, price: 1 })
  expect(props(search, '?produto=classic-tee')).toEqual({ initialProductId: 'classic-tee', invalidInitialSelection: false })
})

it('ausência de produto retorna objeto vazio e não permite props internas injetadas', () => {
  expect(validateSearch({ initialProductId: 'injected', invalidInitialSelection: true })).toEqual({})
  expect(props({}, '')).toEqual({ invalidInitialSelection: false })
})

it.each([null, 42, ['classic-tee', 'other'], '', ' classic-tee ', 'bad\nproduct'])('produto inválido%j não é apagado silenciosamente e ativa erro explícito', (produto) => {
  expect(validateSearch({ produto })).toEqual({ produto })
  expect(props({ produto }, '?produto=invalid')).toEqual({ invalidInitialSelection: true })
})

it('query duplicada ativa guarda no componente mesmo com produto parseado válido', () => {
  expect(props({ produto: 'classic-tee' }, '?produto=classic-tee&produto=other')).toEqual({ initialProductId: 'classic-tee', invalidInitialSelection: true })
})
