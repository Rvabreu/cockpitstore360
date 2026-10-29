import { AuthStore, authConfig } from './auth.ts'

let store: AuthStore | undefined
try {
  authConfig()
  const email = process.env.AUTH_USER_EMAIL
  const password = process.env.AUTH_USER_PASSWORD
  delete process.env.AUTH_USER_EMAIL
  delete process.env.AUTH_USER_PASSWORD
  if (!email || !password) throw new Error('Missing credentials')
  store = new AuthStore()
  await store.provision(email, password)
  console.log('Usuário provisionado; sessões anteriores invalidadas.')
} catch {
  console.error('Provisionamento falhou. Verifique configuração, credenciais e permissões do banco.')
  process.exitCode = 1
} finally {
  store?.close()
}
