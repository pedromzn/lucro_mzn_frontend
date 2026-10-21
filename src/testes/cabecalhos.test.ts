/**
 * A Content-Security-Policy do painel — conferência estática de
 * `infra/cabecalhos.conf`, no molde da do MKT. O validador do servidor repete
 * as travas graves; esta reprova antes do commit.
 *
 * O cookie de sessão é `HttpOnly`, então um XSS não LEVA a sessão — mas, sem
 * `script-src` fechado, ele AGE com ela enquanto a aba estiver aberta. Este
 * painel não precisa de nada de fora — nem as fontes, que vão no build —, e a
 * política diz isso.
 */

import { describe, expect, it } from 'vitest'
import arquivo from '../../infra/cabecalhos.conf?raw'

const LINHA = /^add_header ([A-Za-z-]+) "([^"$\\{}]*)" always;$/

const linhas = arquivo.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
const cabecalhos = linhas.map((l) => LINHA.exec(l)).filter((m): m is RegExpExecArray => m !== null).map((m) => ({ nome: m[1], valor: m[2] }))
const csp = cabecalhos.find((h) => h.nome === 'Content-Security-Policy')?.valor ?? ''
const diretivas = new Map(
  csp.split(';').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [nome, ...valores] = p.split(/\s+/)
    return [nome, valores] as const
  }),
)

describe('CSP do painel do Lucro Certo', () => {
  it('o arquivo só tem linhas que o validador do servidor aceita', () => {
    expect(cabecalhos.length).toBe(linhas.length)
    for (const nome of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
      expect(cabecalhos.map((h) => h.nome)).toContain(nome)
    }
  })

  it('script só do próprio painel — nada inline, nada de eval, nenhum terceiro', () => {
    expect(diretivas.get('script-src')).toEqual(["'self'"])
  })

  it('fonte e estilo só do próprio painel', () => {
    expect(diretivas.get('font-src')).toEqual(["'self'"])
    expect(diretivas.get('style-src')?.filter((v) => v.startsWith('http'))).toEqual([])
  })

  it('conversa só com a própria origem', () => {
    expect(diretivas.get('connect-src')).toEqual(["'self'"])
  })

  it('imagem só da origem (as fotos vêm de /api/arquivos), de data: e de blob:', () => {
    expect(diretivas.get('img-src')).toEqual(["'self'", 'data:', 'blob:'])
  })

  it('fecha plugin, quadro, base e o painel dentro de outro site', () => {
    expect(diretivas.get('default-src')).toEqual(["'self'"])
    expect(diretivas.get('object-src')).toEqual(["'none'"])
    expect(diretivas.get('frame-src')).toEqual(["'none'"])
    expect(diretivas.get('base-uri')).toEqual(["'self'"])
    expect(diretivas.get('form-action')).toEqual(["'self'"])
    expect(diretivas.get('frame-ancestors')).toEqual(["'none'"])
  })
})
