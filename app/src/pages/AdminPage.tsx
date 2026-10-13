import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'

type UserRow = { id: string; name: string; email: string; roles: string[]; is_active: boolean }

export function AdminPage() {
  const { session } = useSession()
  const [users, setUsers] = useState<UserRow[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [temporary, setTemporary] = useState('')
  const [error, setError] = useState('')

  async function refresh() {
    if (!session) return
    const body = await api<{ data?: UserRow[] } | UserRow[]>('/api/users', {}, session.token)
    setUsers(Array.isArray(body) ? body : body.data ?? [])
  }

  useEffect(() => {
    refresh().catch((caught: Error) => setError(caught.message))
  }, [session])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    setError('')
    try {
      const body = await api<{ temporary_password: string }>('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, role: 'Viewer' }),
      }, session.token)
      setTemporary(body.temporary_password)
      setName('')
      setEmail('')
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the user')
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold">Users</h1>
      <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2">
        <input className="rounded-lg border border-stone-300 px-3 py-2" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required />
        <input className="rounded-lg border border-stone-300 px-3 py-2" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <button className="rounded-lg bg-emerald-700 px-4 py-2 text-white" type="submit">Create login</button>
      </form>
      {temporary && <p className="mt-3 text-sm">Temporary password: <span className="font-mono" data-testid="temp-password">{temporary}</span></p>}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      <ul className="mt-6 grid gap-2">
        {users.map((user) => (
          <li key={user.id} className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
            {user.name} · {user.email} · {(user.roles ?? []).join(', ')} {user.is_active ? '' : '· inactive'}
          </li>
        ))}
      </ul>
    </section>
  )
}
