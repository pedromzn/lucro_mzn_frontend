/**
 * Sua empresa — dados, pessoas e espaços de trabalho, para o responsável e os
 * administradores. Tudo aqui mora no NÚCLEO e vale para a empresa inteira; o
 * mock não tinha esta tela (era conta individual), então ela usa as peças dele
 * com o conteúdo das telas de mesma função do painel do MKT.
 *
 * Cada aba é um caminho (`/empresa`, `/empresa/pessoas`, `/empresa/espacos`):
 * o link de "convide alguém" leva direto à aba certa.
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { DadosDaEmpresa } from './DadosDaEmpresa'
import { Pessoas } from './Pessoas'
import { Espacos } from './Espacos'

const ABAS = [
  ['/empresa', 'Dados da empresa'],
  ['/empresa/pessoas', 'Pessoas e licenças'],
  ['/empresa/espacos', 'Espaços de trabalho'],
] as const

export default function SuaEmpresa() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const aba = ABAS.find(([caminho]) => caminho === pathname)?.[0] ?? '/empresa'
  return (
    <>
      <div className="subnav">
        {ABAS.map(([caminho, rotulo]) => (
          <button key={caminho} className={aba === caminho ? 'active' : ''} onClick={() => navegar(caminho, { replace: true })}>{rotulo}</button>
        ))}
      </div>
      <div className="account-content">
        {aba === '/empresa' ? <DadosDaEmpresa /> : aba === '/empresa/pessoas' ? <Pessoas /> : <Espacos />}
      </div>
    </>
  )
}
