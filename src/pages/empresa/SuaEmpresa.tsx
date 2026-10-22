/**
 * Sua empresa — dados, pessoas, espaços de trabalho e os logos, para o
 * responsável e os administradores. Quase tudo aqui mora no NÚCLEO (os logos são
 * do app: `LogosDaEmpresa`) e vale para a empresa inteira; o
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
import { LogosDaEmpresa } from './LogosDaEmpresa'

const ABAS = [
  ['/empresa', 'Dados da empresa'],
  ['/empresa/pessoas', 'Pessoas e licenças'],
  ['/empresa/espacos', 'Espaços de trabalho'],
  ['/empresa/logos', 'Logos'],
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
        {aba === '/empresa' ? <DadosDaEmpresa /> : aba === '/empresa/pessoas' ? <Pessoas /> : aba === '/empresa/logos' ? <LogosDaEmpresa /> : <Espacos />}
      </div>
    </>
  )
}
