/**
 * O convite para ligar a verificação em duas etapas — aparece depois do login.
 *
 * As três saídas são as que o Pedro pediu, e cada prazo tem razão:
 *
 * | Botão | O que faz |
 * |---|---|
 * | Ativar agora | leva para Minha conta, onde a matrícula acontece |
 * | Lembrar mais tarde | adia **7 dias** |
 * | Agora não | adia **30 dias** |
 *
 * **O adiamento é gravado no SERVIDOR**, não aqui. Em `localStorage` ele seria
 * por navegador, e a mesma pessoa veria este convite de novo em cada máquina —
 * que é exatamente como se ensina alguém a fechar aviso sem ler.
 *
 * Não existe "nunca mais". Trinta dias é longo o bastante para não irritar e
 * curto o bastante para a pergunta voltar — o mesmo desenho do aviso de
 * matrícula do GitHub, que também adia mas não desiste.
 *
 * Quem decide se ele aparece é `/auth/eu`: o campo `mfa.convidar`.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mfa, useSessao } from '@/lib/sessao'
import { Aviso } from '@/components/ui'

export function ConviteDeMfa() {
  const navegar = useNavigate()
  const sessao = useSessao((s) => s.retrato)
  const recarregar = useSessao((s) => s.recarregar)
  const [fechado, setFechado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  if (fechado || !sessao?.mfa?.convidar) return null

  const adiar = async (dias: 7 | 30) => {
    if (enviando) return
    setEnviando(true)
    /* fecha na hora: o servidor guarda o prazo, e falhar nisso não pode
       prender a pessoa numa tela que ela já respondeu */
    setFechado(true)
    try {
      await mfa.adiar(dias)
      await recarregar()
    } catch {
      /* o convite volta na próxima carga — é o comportamento certo para uma
         gravação que não aconteceu */
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Aviso>
      <strong>Proteja sua conta com a verificação em duas etapas.</strong> Com ela, sua senha sozinha não abre o LucroCerto nem a loja — é
      preciso também o código do seu celular.{' '}
      <span className="actions">
        <button className="text-link" onClick={() => navegar('/conta?secao=seguranca')}>Ativar agora</button>
        <button className="text-link" onClick={() => void adiar(7)}>Lembrar mais tarde</button>
        <button className="text-link" onClick={() => void adiar(30)}>Agora não</button>
      </span>
    </Aviso>
  )
}
