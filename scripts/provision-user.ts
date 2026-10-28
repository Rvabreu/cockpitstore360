import { createAuthStore } from '../src/server/auth/db.ts'
import { isValidPassword, normalizeEmail } from '../src/server/auth/password.ts'

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !normalizeEmail(args[0])) throw new Error('Uso: npm run auth:provision -- e-mail. Informe a senha por stdin ou AUTH_PASSWORD, nunca como argumento.')
  let password = process.env.AUTH_PASSWORD
  delete process.env.AUTH_PASSWORD
  if (password === undefined) {
    if (process.stdin.isTTY) throw new Error('Forneça a senha por stdin não interativo ou AUTH_PASSWORD.')
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of process.stdin) {
      const buffer = Buffer.from(chunk)
      size += buffer.length
      if (size > 1026) throw new Error('Senha inválida.')
      chunks.push(buffer)
    }
    password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '')
  }
  if (!isValidPassword(password, 12)) throw new Error('A senha deve ter entre 12 e 256 caracteres e no máximo 1024 bytes.')
  const store = createAuthStore({ path: process.env.AUTH_DB_PATH })
  try {
    await store.provisionUser({ email: args[0], password })
    console.log('Usuário provisionado. Nenhuma senha foi exibida.')
  } finally { password = ''; store.close() }
}

main().catch(() => {
  // Avoid printing database details, command arguments or supplied credentials.
  console.error('Não foi possível provisionar o usuário. Verifique o e-mail, a senha e se o usuário já existe.')
  process.exitCode = 1
})
