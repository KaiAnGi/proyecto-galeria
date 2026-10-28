type AuthErrorListener = () => void

const authErrorListeners = new Set<AuthErrorListener>()

export function onDriveAuthError(listener: AuthErrorListener): () => void {
  authErrorListeners.add(listener)
  return () => authErrorListeners.delete(listener)
}

export function notifyDriveAuthError(): void {
  for (const listener of authErrorListeners) listener()
}

export function reportDriveAuthErrorIfNeeded(res: Response): void {
  if (res.status === 401) notifyDriveAuthError()
}

export function assertDriveOk(res: Response, label: string): void {
  if (res.ok) return
  reportDriveAuthErrorIfNeeded(res)
  throw new Error(`${label}: ${res.status}`)
}
