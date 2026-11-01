import { createFolder, findFolderByName, renameFile } from './driveClient'
import { getRootFolderId } from './collectionFolders'
import { safeFileName } from '../gallery/sequenceNaming'

const FOLDER_MIME = 'application/vnd.google-apps.folder'
export const ANIMATION_FRAMES_FOLDER = 'Fotogramas'
export const ANIMATION_ORIGINALS_FOLDER = 'Originales'

export interface AnimationFolders {
  folderId: string
  folderName: string
  framesFolderId: string
  originalsFolderId: string
}

async function ensureChildFolder(
  token: string,
  name: string,
  parentId: string,
  kind: string,
  sequenceId: string,
): Promise<string> {
  const existing = await findFolderByName(token, name, parentId)
  if (existing?.mimeType === FOLDER_MIME) return existing.id
  const created = await createFolder(token, name, [parentId], { kind, id: sequenceId })
  return created.id
}

export async function ensureAnimationFolders(
  token: string,
  sequenceId: string,
  title: string,
  existingFolderId?: string,
): Promise<AnimationFolders> {
  const safeTitle = safeFileName(title)
  let folderId = existingFolderId
  let folderName = safeTitle

  if (folderId) {
    try {
      await renameFile(token, folderId, safeTitle)
    } catch {
      folderId = undefined
    }
  }

  if (!folderId) {
    const rootId = await getRootFolderId(token)
    const byName = await findFolderByName(token, safeTitle, rootId)
    if (byName?.mimeType === FOLDER_MIME && byName.appProperties?.id === sequenceId) {
      folderId = byName.id
    } else {
      folderName = byName ? `${safeTitle} (${sequenceId.slice(-4)})` : safeTitle
      const created = await createFolder(token, folderName, [rootId], { kind: 'animacion', id: sequenceId })
      folderId = created.id
    }
  }

  const [framesFolderId, originalsFolderId] = await Promise.all([
    ensureChildFolder(token, ANIMATION_FRAMES_FOLDER, folderId, 'animacion-fotogramas', sequenceId),
    ensureChildFolder(token, ANIMATION_ORIGINALS_FOLDER, folderId, 'animacion-originales', sequenceId),
  ])

  return { folderId, folderName, framesFolderId, originalsFolderId }
}
