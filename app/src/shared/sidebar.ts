export const sidebarDefaultWidth = 290
export const sidebarMinWidth = 76
export const sidebarMaxWidth = 420

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return sidebarDefaultWidth
  return Math.min(sidebarMaxWidth, Math.max(sidebarMinWidth, Math.round(width)))
}

export function storedSidebarWidth(raw: string | null): number {
  if (raw == null || raw.trim() === '') return sidebarDefaultWidth
  return clampSidebarWidth(Number(raw))
}

export function sidebarCollapsed(width: number): boolean {
  return width < 120
}
