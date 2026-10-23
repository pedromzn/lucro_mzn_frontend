/** Transporte do Lucro Certo — validação dos dados que identificam a entrega (PLANO-ETIQUETAS-TRANSPORTE). */
import { describe, expect, it } from 'vitest'
import { enderecoDeTransporteSchema, pedidoDeTransporteSchema, linhasDoEndereco, salvarModeloDeTransporteSchema } from './transporte.js'

export const ENDERECO_DE_ENSAIO = { nome: 'Maria de Souza', logradouro: 'Rua das Flores', numero: '120', complemento: 'Apto 42', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP' as const, cep: '01001-000', telefone: '(11) 99999-1234' }
export const TRANSPORTE_DE_ENSAIO = {
  modelo: 'enderecamento' as const, papel: 'termica' as const, remetente: { ...ENDERECO_DE_ENSAIO, nome: 'Loja de Ensaio' }, destinatario: ENDERECO_DE_ENSAIO,
  pedido: 'PED-2026-123', transportadora: 'Transportadora de Ensaio', servico: 'Rodoviário', referenciaDoFrete: 'REF-123', volumes: 2,
  peso: '1.250', comprimento: '30', largura: '20', altura: '10', documento: 'nfe' as const, numeroDaNota: '123', chaveFiscal: '', instrucoes: '',
}

describe('os dados da etiqueta de transporte', () => {
  it('normaliza o CEP sem perder número, complemento ou telefone', () => {
    const endereco = enderecoDeTransporteSchema.parse(ENDERECO_DE_ENSAIO)
    expect(endereco.cep).toBe('01001000')
    expect(linhasDoEndereco(endereco)).toEqual(['Maria de Souza', 'Rua das Flores, 120', 'Apto 42', 'Centro', 'São Paulo / SP', 'CEP 01001-000', 'Tel. (11) 99999-1234'])
  })
  it.each(['nome', 'logradouro', 'numero', 'bairro', 'cidade', 'cep', 'uf'])('recusa endereço sem %s', (campo) => {
    expect(enderecoDeTransporteSchema.safeParse({ ...ENDERECO_DE_ENSAIO, [campo]: '' }).success).toBe(false)
  })
  it('aceita S/N, mas recusa UF inexistente, CEP curto, emojis e controles', () => {
    expect(enderecoDeTransporteSchema.safeParse({ ...ENDERECO_DE_ENSAIO, numero: 'S/N' }).success).toBe(true)
    for (const parte of [{ uf: 'XX' }, { cep: '1234' }, { nome: 'Maria 📦' }, { complemento: 'linha\nnova' }]) expect(enderecoDeTransporteSchema.safeParse({ ...ENDERECO_DE_ENSAIO, ...parte }).success).toBe(false)
  })
  it('a expedição exige a contratação identificada e a entrega local exige telefone', () => {
    for (const campo of ['transportadora', 'servico', 'referenciaDoFrete']) expect(pedidoDeTransporteSchema.safeParse({ ...TRANSPORTE_DE_ENSAIO, modelo: 'expedicao', [campo]: '' }).success).toBe(false)
    expect(pedidoDeTransporteSchema.safeParse({ ...TRANSPORTE_DE_ENSAIO, modelo: 'local', destinatario: { ...ENDERECO_DE_ENSAIO, telefone: '' } }).success).toBe(false)
    expect(pedidoDeTransporteSchema.safeParse({ ...TRANSPORTE_DE_ENSAIO, destinatario: { ...ENDERECO_DE_ENSAIO, telefone: '' } }).success).toBe(true)
  })
  it('não oferece uma declaração de conteúdo livre como documento fiscal', () => {
    expect(pedidoDeTransporteSchema.safeParse({ ...TRANSPORTE_DE_ENSAIO, documento: 'declaracao' }).success).toBe(false)
    expect(pedidoDeTransporteSchema.safeParse({ ...TRANSPORTE_DE_ENSAIO, documento: 'dce' }).success).toBe(false)
    expect(pedidoDeTransporteSchema.safeParse({ ...TRANSPORTE_DE_ENSAIO, documento: 'dce', chaveFiscal: '1'.repeat(44) }).success).toBe(true)
    expect(pedidoDeTransporteSchema.safeParse({ ...TRANSPORTE_DE_ENSAIO, numeroDaNota: '' }).success).toBe(false)
    expect(pedidoDeTransporteSchema.safeParse({ ...TRANSPORTE_DE_ENSAIO, chaveFiscal: '1'.repeat(43) }).success).toBe(false)
  })
  it.each([{ volumes: 31 }, { volumes: 0 }, { volumes: 1.5 }, { peso: '0' }, { peso: '-2' }, { peso: '1e3' }, { altura: '1001' }, { largura: 'NaN' }, { comprimento: '1.0001' }])('limita a geração e as medidas: %o', (parte) => {
    expect(pedidoDeTransporteSchema.safeParse({ ...TRANSPORTE_DE_ENSAIO, ...parte }).success).toBe(false)
  })
  it('não recebe campo extra de empresa nem endereço sem limite', () => {
    expect(pedidoDeTransporteSchema.safeParse({ ...TRANSPORTE_DE_ENSAIO, organizationId: 'outra' }).success).toBe(false)
    expect(enderecoDeTransporteSchema.safeParse({ ...ENDERECO_DE_ENSAIO, nome: 'A'.repeat(71) }).success).toBe(false)
  })
})

describe('os modelos reutilizáveis de transporte', () => {
  const { pedido: _pedido, referenciaDoFrete: _frete, numeroDaNota: _nota, chaveFiscal: _chave, ...padroes } = TRANSPORTE_DE_ENSAIO
  const entrada = { nome: 'Loja Centro', dados: { ...padroes, destinatario: null, peso: '', comprimento: '', largura: '', altura: '' } }
  it('permite salvar remetente e papel antes de preencher destino, volume ou nota', () => {
    const salvo = salvarModeloDeTransporteSchema.parse(entrada)
    expect(salvo.dados.remetente.cep).toBe('01001000')
    expect(salvo.dados.destinatario).toBeNull()
    expect(pedidoDeTransporteSchema.safeParse({ ...TRANSPORTE_DE_ENSAIO, ...salvo.dados }).success).toBe(false)
  })
  it('guarda um destinatário completo, mas recusa destino parcial', () => {
    expect(salvarModeloDeTransporteSchema.safeParse({ ...entrada, dados: { ...entrada.dados, destinatario: ENDERECO_DE_ENSAIO } }).success).toBe(true)
    expect(salvarModeloDeTransporteSchema.safeParse({ ...entrada, dados: { ...entrada.dados, destinatario: { ...ENDERECO_DE_ENSAIO, cidade: '' } } }).success).toBe(false)
  })
  it.each(['pedido', 'referenciaDoFrete', 'numeroDaNota', 'chaveFiscal', 'organization_id', 'workspace_id'])('não guarda %s como padrão do próximo envio', (campo) => {
    expect(salvarModeloDeTransporteSchema.safeParse({ ...entrada, dados: { ...entrada.dados, [campo]: 'antigo' } }).success).toBe(false)
  })
  it('exige nome e revisão nas edições, sem aceitar dono vindo da tela', () => {
    for (const parte of [{ nome: '' }, { id: 'mdt_1' }, { revisao: 1 }, { organization_id: 'outra' }]) expect(salvarModeloDeTransporteSchema.safeParse({ ...entrada, ...parte }).success).toBe(false)
    expect(salvarModeloDeTransporteSchema.safeParse({ ...entrada, id: 'mdt_1', revisao: 1 }).success).toBe(true)
  })
})
