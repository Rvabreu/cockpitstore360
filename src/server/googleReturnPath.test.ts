// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { safeGoogleReturnPath } from './google'

describe('Google promotion return allowlist', () => {
  it.each(['/', '/#colecao', '/#pedidos', '/#fluxo', '/black-friday', '/promocoes-black-friday'])('permits exact return %s', (path) => {
    expect(safeGoogleReturnPath(path)).toBe(path)
  })
  it.each(['//evil.test', 'https://evil.test', '/promocoes-black-friday?next=evil', '/promocoes-black-friday/extra', '/promocoes-black-friday#evil', '/%2Fpromocoes-black-friday'])('rejects unlisted return %s', (path) => {
    expect(safeGoogleReturnPath(path)).toBe('/')
  })
})
