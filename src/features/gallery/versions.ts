import type { Archivo, Obra } from './store'
import { es } from '../../i18n/es'

type Etapa = NonNullable<Archivo['etapa']>

const ETAPA_ORDER: Record<Etapa, number> = { boceto: 0, lineart: 1, color: 2, final: 3 }

export function isEtapa(value: string): value is Etapa {
  return value in ETAPA_ORDER
}

export function versionLabel(a: Archivo): string {
  if (a.etapa) return es.versions.etapaOptions[a.etapa]
  return es.versions.rolOptions[a.rol] ?? a.rol
}

export function sortVersiones(archivos: Archivo[]): Archivo[] {
  return [...archivos].sort((a, b) => {
    const ea = a.etapa !== undefined ? ETAPA_ORDER[a.etapa] : -1
    const eb = b.etapa !== undefined ? ETAPA_ORDER[b.etapa] : -1
    if (ea !== eb) return ea - eb
    return a.orden - b.orden
  })
}

export function imageVersiones(obra: Obra): Archivo[] {
  return sortVersiones(obra.archivos.filter((a) => a.tipo === 'imagen' || a.tipo === 'gif'))
}

export function comparePair(obra: Obra): [Archivo, Archivo] | null {
  const imgs = imageVersiones(obra)
  if (imgs.length < 2) return null
  return [imgs[0], imgs[imgs.length - 1]]
}

export function computeOrigen(archivos: Archivo[]): Obra['origen'] {
  const roles = new Set(archivos.map((a) => a.rol))
  if (roles.has('tradicional') && roles.has('digital')) return 'mixto'
  if (roles.has('digital')) return 'digital'
  return 'tradicional'
}
