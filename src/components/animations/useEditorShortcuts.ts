import { useEffect } from 'react'

interface EditorShortcutOptions {
  enabled: boolean
  onTogglePlay: () => void
  onPrevious: () => void
  onNext: () => void
  onUndo: () => void
  onRedo: () => void
  onToggleOnion: () => void
  onHelp: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('button, a, summary, [role="button"], input, textarea, select'))
}

export function useEditorShortcuts(options: EditorShortcutOptions): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!options.enabled) return
      const modifier = event.ctrlKey || event.metaKey

      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) options.onRedo()
        else options.onUndo()
        return
      }

      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        options.onRedo()
        return
      }

      if (modifier || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (event.key === '?' && event.shiftKey) {
        event.preventDefault()
        options.onHelp()
        return
      }
      if (isInteractiveTarget(event.target)) return

      switch (event.key) {
        case ' ':
          event.preventDefault()
          options.onTogglePlay()
          break
        case 'ArrowLeft':
          event.preventDefault()
          options.onPrevious()
          break
        case 'ArrowRight':
          event.preventDefault()
          options.onNext()
          break
        case 'o':
        case 'O':
          event.preventDefault()
          options.onToggleOnion()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [options])
}
