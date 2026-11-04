export class ApiError extends Error {
  status: number
  body: Record<string, unknown>

  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? 'Request failed'))
    this.status = status
    this.body = body
  }
}

export function apiUrl(path: string): string {
  if (typeof location !== 'undefined' && location.protocol === 'app:') return `https://app.hakmobiles.com${path}`
  return path
}

export function desktopApp(): boolean {
  return typeof location !== 'undefined' && location.protocol === 'app:'
}

export async function api(path: string, options: RequestInit = {}, token?: string | null): Promise<Record<string, unknown>> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(apiUrl(path), { ...options, headers })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) throw new ApiError(response.status, body)
  return body
}
