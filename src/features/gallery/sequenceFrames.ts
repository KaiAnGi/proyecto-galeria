import type { Frame, Secuencia } from './secuencias'

export function sortFrames(frames: Frame[]): Frame[] {
  return [...frames].sort((a, b) => a.orden - b.orden)
}

export function normalizeFrames(frames: Frame[]): Frame[] {
  return sortFrames(frames).map((frame, index) => (frame.orden === index ? frame : { ...frame, orden: index }))
}

export function moveFrame(frames: Frame[], from: number, to: number): Frame[] {
  const sorted = sortFrames(frames)
  if (to < 0 || to >= sorted.length || from < 0 || from >= sorted.length || from === to) {
    return sorted.map((frame, index) => (frame.orden === index ? frame : { ...frame, orden: index }))
  }
  const [frame] = sorted.splice(from, 1)
  sorted.splice(to, 0, frame)
  return sorted.map((item, index) => ({ ...item, orden: index }))
}

export function appendFrames(frames: Frame[], added: Frame[]): Frame[] {
  return normalizeFrames([...sortFrames(frames), ...added])
}

export function removeFrame(frames: Frame[], frameId: string): Frame[] {
  return normalizeFrames(frames.filter((frame) => frame.id !== frameId))
}

export function sequenceDuration(frames: Frame[], fps: number): number {
  if (frames.length === 0) return 0
  return frames.length / Math.min(24, Math.max(1, fps))
}

export function gifSignature(sequence: Pick<Secuencia, 'fps' | 'bucle' | 'frames'>): string {
  const ordered = sortFrames(sequence.frames)
  return `${sequence.fps}:${sequence.bucle ? 1 : 0}:${ordered.map((frame) => `${frame.id}@${frame.orden}`).join(',')}`
}
