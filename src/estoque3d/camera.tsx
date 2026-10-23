/**
 * A câmera do espaço 3D — PLANO-ESTOQUE-3D.md, fatia 2.
 *
 * Duas lições da engenharia reversa, reimplementadas aqui:
 *
 * - **Metas suavizadas** (Warehouse Theatre 3D, MIT): o arraste muda o ALVO —
 *   ângulo, altura, enquadramento, centro — e a câmera persegue o alvo a cada
 *   quadro. É o que dá a sensação de deslizar, e o `voarPara` é só trocar o alvo.
 * - **A planta sem trocar de câmera** (a ideia do Viewer3D, por outro caminho):
 *   lá, a transição 2D⇄3D interpola a matriz de projeção. Aqui é um "dolly
 *   zoom": o campo de visão fecha de 42° para 5° enquanto a câmera se afasta na
 *   mesma proporção, e o enquadramento fica igual. De cima e com teleobjetiva, a
 *   vista é quase ortográfica — e o clique continua exato, porque a câmera
 *   continua sendo uma câmera de perspectiva de verdade.
 *
 * O zoom mexe no ENQUADRAMENTO (a altura visível, em metros), não na distância:
 * é ele que se mantém quando o campo de visão muda.
 *
 * Renderização sob demanda (a terceira lição do Viewer3D): o quadro só é pedido
 * enquanto a câmera ainda não chegou ao alvo. Parada, a cena não gasta nada.
 */

import { useEffect, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3 } from 'three'

export interface ControleDaCamera {
  voarPara: (x: number, z: number, enquadramento?: number) => void
  planta: (ligada: boolean) => void
  inicio: () => void
  /** pede um quadro: os rótulos de HTML só se reposicionam quando a cena desenha */
  redesenhar: () => void
}

interface Estado {
  x: number
  z: number
  /** em volta do eixo vertical */
  giro: number
  /** do zênite para baixo: 0 é de cima, π/2 é rente ao chão */
  inclinacao: number
  /** a altura visível, em metros */
  enquadramento: number
  /** 0 é a perspectiva, 1 é a planta */
  planta: number
}

const FOV_3D = 42
const FOV_PLANTA = 5
const INCLINACAO = { minima: 0.2, maxima: 1.32 }

/** quem quer saber que a câmera se mexeu — os rótulos de HTML se reposicionam por aqui */
export type OuvinteDeQuadro = () => void

export function CameraDoEstoque({ largura, profundidade, controle, ouvintes, reduzirMovimento, livre, alvo = 0.4 }: {
  largura: number
  profundidade: number
  controle?: MutableRefObject<ControleDaCamera | null>
  ouvintes?: MutableRefObject<Set<OuvinteDeQuadro>>
  reduzirMovimento: boolean
  /** `false` no editor da planta: o botão esquerdo é das estruturas, e a câmera só anda com o direito (ou Shift) e a roda */
  livre?: MutableRefObject<boolean>
  /** a altura do ponto que a câmera olha */
  alvo?: number
}) {
  const { camera, gl, invalidate, size } = useThree()
  const maior = Math.max(largura, profundidade)
  /* o espaço inteiro na proporção da tela: numa tela larga quem manda é a largura, numa estreita a profundidade */
  const proporcao = size.width / Math.max(1, size.height)
  const inicial = (): Estado => ({ x: 0, z: 2.1, giro: 0.43, inclinacao: 0.92, enquadramento: Math.max((profundidade + 7.5) * 1.06, ((largura + 3.4) * Math.cos(0.43) + (profundidade + 8.2) * Math.sin(0.43)) * 1.08 / proporcao), planta: 0 })
  const atual = useRef<Estado>(inicial())
  const meta = useRef<Estado>(inicial())
  const olhar = useRef(new Vector3())

  /* o espaço mudou de tamanho (outro tema, outra planta): volta ao enquadramento inicial */
  useEffect(() => {
    meta.current = { ...inicial(), planta: meta.current.planta }
    invalidate()
  }, [largura, profundidade, size.width, size.height])

  const limitar = (e: Estado) => {
    e.x = Math.max(-largura / 2, Math.min(largura / 2, e.x))
    e.z = Math.max(-profundidade / 2, Math.min(profundidade / 2, e.z))
    e.inclinacao = Math.max(INCLINACAO.minima, Math.min(INCLINACAO.maxima, e.inclinacao))
    e.enquadramento = Math.max(1.4, Math.min(Math.max(maior * 2, (largura + 5) / proporcao * 1.5), e.enquadramento))
  }

  if (controle) {
    controle.current = {
      voarPara: (x, z, enquadramento) => {
        meta.current = { ...meta.current, x, z, enquadramento: enquadramento ?? Math.min(meta.current.enquadramento, 4.5) }
        limitar(meta.current)
        invalidate()
      },
      planta: (ligada) => {
        meta.current = { ...meta.current, planta: ligada ? 1 : 0, ...(ligada ? { giro: 0 } : {}) }
        invalidate()
      },
      inicio: () => {
        meta.current = { ...inicial(), planta: meta.current.planta, giro: meta.current.planta ? 0 : inicial().giro }
        invalidate()
      },
      redesenhar: () => invalidate(),
    }
  }

  /* o arraste, a roda e a pinça — direto no canvas; o clique nos objetos é do r3f, que olha o `delta` */
  useEffect(() => {
    const tela = gl.domElement
    const toques = new Map<number, { x: number; y: number }>()
    let botao = 0
    let deslocar = false

    const mover = (dx: number, dy: number, deslocando: boolean) => {
      if (livre && !livre.current && !deslocando) return
      const m = meta.current
      const porPixel = m.enquadramento / Math.max(1, tela.clientHeight)
      if (deslocando || m.planta > 0.5) {
        /* desloca no chão, no referencial da tela: direita é o eixo X girado, cima é "para longe" */
        const cos = Math.cos(m.giro), sen = Math.sin(m.giro)
        m.x -= (dx * cos + dy * sen) * porPixel
        m.z -= (-dx * sen + dy * cos) * porPixel
      } else {
        m.giro -= dx * 0.006
        m.inclinacao += dy * 0.005
      }
      limitar(m)
      invalidate()
    }

    const aoApertar = (e: PointerEvent) => {
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY })
      botao = e.button
      deslocar = e.button === 2 || e.shiftKey
    }
    const aoMover = (e: PointerEvent) => {
      const antes = toques.get(e.pointerId)
      if (!antes) return
      const dx = e.clientX - antes.x
      const dy = e.clientY - antes.y
      if (toques.size === 2) {
        /* pinça: a distância entre os dedos é o zoom, o meio deles arrasta */
        const [a, b] = [...toques.values()]
        const distanciaAntes = Math.hypot(a!.x - b!.x, a!.y - b!.y)
        toques.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const [c, d] = [...toques.values()]
        const distanciaDepois = Math.hypot(c!.x - d!.x, c!.y - d!.y)
        if (distanciaAntes > 0 && distanciaDepois > 0) meta.current.enquadramento *= distanciaAntes / distanciaDepois
        mover(dx / 2, dy / 2, true)
        return
      }
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY })
      mover(dx, dy, deslocar || botao === 2)
    }
    const aoSoltar = (e: PointerEvent) => { toques.delete(e.pointerId) }
    const aoRolar = (e: WheelEvent) => {
      e.preventDefault()
      meta.current.enquadramento *= Math.exp(e.deltaY * 0.0012)
      limitar(meta.current)
      invalidate()
    }
    const semMenu = (e: Event) => e.preventDefault()

    tela.addEventListener('pointerdown', aoApertar)
    window.addEventListener('pointermove', aoMover)
    window.addEventListener('pointerup', aoSoltar)
    window.addEventListener('pointercancel', aoSoltar)
    tela.addEventListener('wheel', aoRolar, { passive: false })
    tela.addEventListener('contextmenu', semMenu)
    return () => {
      tela.removeEventListener('pointerdown', aoApertar)
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoSoltar)
      tela.removeEventListener('wheel', aoRolar)
      tela.removeEventListener('contextmenu', semMenu)
    }
    /* largura e profundidade, não só a maior: 10×9 virando 9×10 muda os limites do deslocamento */
  }, [gl, largura, profundidade])

  /* teclado, para quem não arrasta: setas deslocam, + e − aproximam, Q e E giram */
  useEffect(() => {
    const tela = gl.domElement
    tela.tabIndex = 0
    const aoTeclar = (e: KeyboardEvent) => {
      const m = meta.current
      const passo = m.enquadramento * 0.08
      const cos = Math.cos(m.giro), sen = Math.sin(m.giro)
      const teclas: Record<string, () => void> = {
        ArrowLeft: () => { m.x -= cos * passo; m.z += sen * passo },
        ArrowRight: () => { m.x += cos * passo; m.z -= sen * passo },
        ArrowUp: () => { m.x -= sen * passo; m.z -= cos * passo },
        ArrowDown: () => { m.x += sen * passo; m.z += cos * passo },
        '+': () => { m.enquadramento *= 0.85 },
        '=': () => { m.enquadramento *= 0.85 },
        '-': () => { m.enquadramento /= 0.85 },
        q: () => { m.giro += 0.2 },
        e: () => { m.giro -= 0.2 },
      }
      const acao = teclas[e.key]
      if (!acao) return
      e.preventDefault()
      acao()
      limitar(m)
      invalidate()
    }
    tela.addEventListener('keydown', aoTeclar)
    return () => tela.removeEventListener('keydown', aoTeclar)
  }, [gl, invalidate, largura, profundidade])

  useFrame((_, delta) => {
    const a = atual.current
    const m = meta.current
    /* a mesma suavização em qualquer taxa de quadros; com movimento reduzido, chega na hora */
    const k = reduzirMovimento ? 1 : 1 - Math.pow(1 - 0.14, Math.min(delta, 0.1) * 60)
    let falta = 0
    for (const chave of ['x', 'z', 'giro', 'inclinacao', 'enquadramento', 'planta'] as const) {
      const d = m[chave] - a[chave]
      a[chave] += d * k
      falta = Math.max(falta, Math.abs(d) * (chave === 'enquadramento' ? 0.2 : 1))
    }

    const cam = camera as PerspectiveCamera
    const fov = FOV_3D + (FOV_PLANTA - FOV_3D) * a.planta
    const distancia = a.enquadramento / (2 * Math.tan((fov * Math.PI) / 360))
    /* de cima, mas não exatamente: o `lookAt` perde o "para cima" no zênite */
    const inclinacao = a.inclinacao + (0.02 - a.inclinacao) * a.planta
    olhar.current.set(a.x, alvo * (1 - a.planta), a.z)
    cam.fov = fov
    cam.aspect = size.width / Math.max(1, size.height)
    cam.position.set(
      a.x + distancia * Math.sin(inclinacao) * Math.sin(a.giro),
      olhar.current.y + distancia * Math.cos(inclinacao),
      a.z + distancia * Math.sin(inclinacao) * Math.cos(a.giro),
    )
    cam.near = Math.max(0.05, distancia - maior * 2)
    cam.far = distancia + maior * 3
    cam.lookAt(olhar.current)
    cam.updateProjectionMatrix()
    for (const ouvinte of ouvintes?.current ?? []) ouvinte()
    if (falta > 0.0005) invalidate()
  })

  return null
}
