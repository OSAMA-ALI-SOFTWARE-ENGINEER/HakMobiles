import { useEffect, useState } from 'react'
import { api } from '../api'
import { PageSkeleton, SkeletonRows } from '../ui/PageSkeleton'
import { RecordTable } from '../ui/RecordTable'

export function ActivityScreen({ token }: { token: string }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    api('/api/activity', {}, token)
      .then((result) => setRows((result.data as Record<string, unknown>[]) ?? []))
      .catch(() => setError('The activity log could not be loaded.'))
      .finally(() => setLoading(false))
  }, [token])
  const shown = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase()))
  if (loading) return <PageSkeleton kind="activity" />
  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="lede">A record of who changed what. It cannot be edited.</p>
        </div>
      </div>
      <label className="control-line">Find activity
        <input aria-label="Find activity" className="control" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user, action or value" />
      </label>
      {error && <p className="error">{error}</p>}
      <RecordTable
        caption="Activity"
        headers={['Who', 'What', 'When']}
        rows={shown.map((row) => {
          const properties = row.properties && typeof row.properties === 'object' ? row.properties as Record<string, unknown> : {}
          const change = properties.old != null || properties.new != null ? ` ${properties.old ?? '—'} → ${properties.new ?? '—'}` : ''
          return {
            key: String(row.id),
            cells: [String(row.causer ?? 'System'), `${String(row.description)}${change}`, String(row.created_at ?? '')],
          }
        })}
      />
    </section>
  )
}

export function RolesPanel({ token }: { token: string }) {
  const [roles, setRoles] = useState<{ id: number; name: string; permissions: string[] }[]>([])
  const [catalog, setCatalog] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    api('/api/roles', {}, token).then((result) => {
      setRoles((result.data as { id: number; name: string; permissions: string[] }[]) ?? [])
      setCatalog((result.catalog as string[]) ?? [])
    }).catch(() => setMessage('Roles could not be loaded.')).finally(() => setLoading(false))
  }, [token])

  async function save(role: { id: number; name: string; permissions: string[] }) {
    await api(`/api/roles/${role.id}`, { method: 'PATCH', body: JSON.stringify({ permissions: role.permissions }) }, token)
    setMessage(`${role.name} updated.`)
  }

  if (loading) return <SkeletonRows count={3} />
  return (
    <div className="page">
      <h2>Roles</h2>
      {message && <p className="lede">{message}</p>}
      {roles.filter((role) => role.name !== 'Super Admin').map((role) => (
        <form key={role.id} className="panel" onSubmit={(event) => { event.preventDefault(); void save(role) }}>
          <h2>{role.name}</h2>
          <div className="filters">
            {catalog.map((permission) => (
              <label key={permission} className="check">
                <input type="checkbox" checked={role.permissions.includes(permission)} onChange={(event) => {
                  setRoles((current) => current.map((item) => item.id === role.id ? {
                    ...item,
                    permissions: event.target.checked ? [...item.permissions, permission] : item.permissions.filter((name) => name !== permission),
                  } : item))
                }} />
                {permission}
              </label>
            ))}
          </div>
          <button className="btn" type="submit">Save {role.name}</button>
        </form>
      ))}
    </div>
  )
}

export function DevicesPanel({ token }: { token: string }) {
  const [devices, setDevices] = useState<Record<string, unknown>[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  async function load() {
    const result = await api('/api/devices', {}, token)
    setDevices((result.data as Record<string, unknown>[]) ?? [])
  }
  useEffect(() => {
    setLoading(true)
    void load().catch(() => setMessage('Devices could not be loaded.')).finally(() => setLoading(false))
  }, [token])
  if (loading) return <SkeletonRows count={4} />
  return (
    <div className="page">
      <h2>Devices</h2>
      {message && <p className="lede">{message}</p>}
      <ul className="record-list">
        {devices.map((device) => {
          const user = device.user && typeof device.user === 'object' ? device.user as Record<string, unknown> : {}
          return (
            <li key={String(device.id)}>
              <span>{String(device.name)} · {String(user.email ?? '')}</span>
              <span className="quick-actions">
                <span className="quiet">{device.revoked_at ? 'Revoked' : String(device.last_sync_at ?? 'Not synced')}</span>
                {!device.revoked_at && <button type="button" className="btn-ghost" onClick={() => void api(`/api/devices/${device.id}/revoke`, { method: 'POST' }, token).then(load)}>Revoke</button>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
