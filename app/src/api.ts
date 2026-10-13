export class ApiError extends Error {
  status: number
  body: Record<string, unknown>

  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? 'Request failed'))
    this.status = status
    this.body = body
  }
}

export async function api(path: string, options: RequestInit = {}, token?: string | null): Promise<Record<string, unknown>> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(path, { ...options, headers })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) throw new ApiError(response.status, body)
  return body
}
