export class ApiError extends Error {
  status: number
  body: { message?: string; status?: string }

  constructor(status: number, body: { message?: string; status?: string }) {
    super(body.message || 'Request failed')
    this.status = status
    this.body = body
  }
}

export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const base = typeof location !== 'undefined' && location.protocol === 'app:' ? 'https://app.hakmobiles.com' : ''
  const response = await fetch(`${base}${path}`, { ...options, headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, body)
  return body as T
}
