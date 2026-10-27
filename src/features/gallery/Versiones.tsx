import { useRef, useState } from 'react'
import { useGalleryStore, type Archivo, type Obra } from './store'
import { uploadObraVersion } from './upload'
import { saveObra } from './persistence'
import { ensureToken } from '../auth/googleAuth'
import { enqueueSave } from './saveQueue'
import { friendlyError } from '../../lib/errors/friendlyError'
import { imageVersiones, versionLabel, isEtapa } from './versions'
import { es } from '../../i18n/es'

interface Props {
  obra: Obra
  selectedId: string
  onSelect: (id: string) => void
  compareOn: boolean
  canCompare: boolean
  onToggleCompare: () => void
}

export default function Versiones({ obra, selectedId, onSelect, compareOn, canCompare, onToggleCompare }: Props) {
  const updateObra = useGalleryStore((s) => s.updateObra)
  const fileRef = useRef<HTMLInputElement>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [rol, setRol] = useState<Archivo['rol']>('tradicional')
  const [etapa, setEtapa] = useState<Archivo['etapa'] | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const versiones = imageVersiones(obra)

  async function addVersion(files: FileList | null) {
    const file = files?.[0]
    if (!file || busy) return
    setBusy(true)
    setError(null)
    try {
      const token = await ensureToken()
      const next = await uploadObraVersion(token, obra, file, rol, etapa && isEtapa(etapa) ? etapa : undefined)
      updateObra(obra.id, { archivos: next.archivos, origen: next.origen })
      const fresh = useGalleryStore.getState().obras.find((o) => o.id === obra.id) ?? next
      void enqueueSave((saveToken) => saveObra(saveToken, fresh)).catch(() => undefined)
      const added = next.archivos[next.archivos.length - 1]
      if (added) onSelect(added.id)
      setShowAdd(false)
      setEtapa('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      console.error('Version upload failed', e)
      setError(friendlyError(e, es.versions.uploadError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-display font-bold">{es.versions.title}</h2>
        {canCompare && (
          <button type="button" onClick={onToggleCompare} className="btn btn-soft">
            {compareOn ? es.versions.compareHide : es.versions.compare}
          </button>
        )}
      </div>

      {versiones.length > 0 && (
        <ul className="flex flex-wrap gap-2" role="list">
          {versiones.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="chip chip-btn"
                aria-pressed={a.id === selectedId}
                onClick={() => onSelect(a.id)}
              >
                {versionLabel(a)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showAdd && (
        <button type="button" className="btn btn-soft self-start" onClick={() => setShowAdd(true)}>
          {es.versions.add}
        </button>
      )}

      {showAdd && (
        <div className="flex flex-col gap-3">
          <h3 className="font-medium">{es.versions.addTitle}</h3>
          <div className="flex flex-wrap gap-3">
            <div>
              <label htmlFor="version-rol" className="text-sm font-medium block mb-2">
                {es.versions.rol}
              </label>
              <select
                id="version-rol"
                value={rol}
                onChange={(e) => setRol(e.target.value as Archivo['rol'])}
                className="field w-full"
              >
                <option value="tradicional">{es.versions.rolOptions.tradicional}</option>
                <option value="digital">{es.versions.rolOptions.digital}</option>
                <option value="proceso">{es.versions.rolOptions.proceso}</option>
                <option value="referencia">{es.versions.rolOptions.referencia}</option>
              </select>
            </div>
            <div>
              <label htmlFor="version-etapa" className="text-sm font-medium block mb-2">
                {es.versions.etapa}
              </label>
              <select
                id="version-etapa"
                value={etapa}
                onChange={(e) => setEtapa(e.target.value as Archivo['etapa'] | '')}
                className="field w-full"
              >
                <option value="">{es.versions.etapaNone}</option>
                <option value="boceto">{es.versions.etapaOptions.boceto}</option>
                <option value="lineart">{es.versions.etapaOptions.lineart}</option>
                <option value="color">{es.versions.etapaOptions.color}</option>
                <option value="final">{es.versions.etapaOptions.final}</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="btn btn-primary cursor-pointer">
              {busy ? es.versions.uploading : es.versions.pick}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={busy}
                onChange={(e) => addVersion(e.target.files)}
              />
            </label>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)} disabled={busy}>
              {es.versions.cancel}
            </button>
          </div>
          {busy && <p className="text-sm text-[var(--muted)]">{es.versions.uploading}</p>}
          {error && (
            <p role="alert" className="text-sm text-[#ff9db1]">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
