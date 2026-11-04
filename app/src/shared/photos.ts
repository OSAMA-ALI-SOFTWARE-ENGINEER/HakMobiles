const mediaColumns = ['photo_path', 'receipt_path']

export function withoutInlineMedia(payload: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...payload }
  for (const column of mediaColumns) {
    if (typeof copy[column] === 'string' && copy[column].startsWith('data:')) delete copy[column]
  }
  return copy
}

export function shouldKeepLocalMedia(incoming: unknown, local: unknown): boolean {
  const empty = incoming == null || incoming === ''
  return empty && typeof local === 'string' && local.startsWith('data:')
}

/** A stored file path from another device replaces an empty picture. A preview still waiting to upload stays. */
export function serverMediaToKeep(incoming: unknown, local: unknown): string | null {
  if (typeof incoming !== 'string' || incoming === '' || incoming.startsWith('data:')) return null
  if (typeof local === 'string' && (local.startsWith('data:') || local === incoming)) return null
  return incoming
}

/** Phone photos are large and often not JPEG. A smaller JPEG is what the other devices can store and show. */
export function readPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The photo could not be read.'))
    reader.onload = () => {
      const original = typeof reader.result === 'string' ? reader.result : ''
      if (!original.startsWith('data:image/') || typeof document === 'undefined') {
        resolve(original)
        return
      }
      const image = new Image()
      image.onload = () => {
        const max = 1600
        const scale = Math.min(1, max / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) {
          resolve(original)
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.onerror = () => resolve(original)
      image.src = original
    }
    reader.readAsDataURL(file)
  })
}
