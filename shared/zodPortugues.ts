/**
 * As mensagens padrão do zod, em português.
 *
 * Os schemas deste app têm as frases importantes escritas à mão, mas o que o
 * zod gera sozinho (texto longo demais, número fora do intervalo) sai em
 * inglês — e a frase vai direto para a tela (`middleware/errors.ts`). Importar
 * este arquivo uma vez, na entrada do processo e do painel, troca o mapa.
 */

import { z, ZodIssueCode, type ZodErrorMap } from 'zod'

const mapa: ZodErrorMap = (problema, contexto) => {
  switch (problema.code) {
    case ZodIssueCode.invalid_type:
      if (problema.expected === 'integer') return { message: 'Use um número inteiro.' }
      return { message: problema.received === 'undefined' ? 'Campo obrigatório.' : 'Valor em formato inválido.' }
    case ZodIssueCode.too_small:
      if (problema.type === 'string') return { message: problema.minimum === 1 ? 'Campo obrigatório.' : `Use pelo menos ${problema.minimum} caracteres.` }
      if (problema.type === 'array') return { message: `Escolha pelo menos ${problema.minimum}.` }
      return { message: `O valor mínimo é ${problema.minimum}.` }
    case ZodIssueCode.too_big:
      if (problema.type === 'string') return { message: `Use até ${problema.maximum} caracteres.` }
      if (problema.type === 'array') return { message: `O máximo é ${problema.maximum} itens.` }
      return { message: `O valor máximo é ${problema.maximum}.` }
    case ZodIssueCode.invalid_enum_value:
      return { message: 'Escolha uma das opções.' }
    case ZodIssueCode.invalid_string:
      return { message: problema.validation === 'uuid' ? 'Identificador inválido.' : 'Valor em formato inválido.' }
    case ZodIssueCode.unrecognized_keys:
      return { message: `Campo desconhecido: ${problema.keys.join(', ')}.` }
    default:
      return { message: contexto.defaultError }
  }
}

z.setErrorMap(mapa)
