import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useSession } from '../lib/session'

export function TwoFactorPage() {
  const { session, setSession } = useSession()
  const navigate = useNavigate()
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    api<{ secret: string }>('/api/auth/two-factor/setup', { method: 'POST' }, session.token)
      .then((body) => setSecret(body.secret))
      .catch((caught: Error) => setError(caught.message))
  }, [session])

  if (!session) return <Navigate to="/login" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!session) return
    setError('')
    try {
      await api('/api/auth/two-factor/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }, session.token)
      setSession({ ...session, mustSetupTwoFactor: false })
      navigate('/')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not confirm')
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Set up two-factor login</h1>
        <p className="mt-2 text-sm text-stone-500">Add this secret to an authenticator app, then enter the 6-digit code.</p>
        <p className="mt-4 break-all rounded-lg bg-stone-100 px-3 py-2 font-mono text-sm" data-testid="totp-secret">{secret || 'Preparing…'}</p>
        <label className="mt-4 block text-sm font-medium">
          Code
          <input className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" required />
        </label>
        {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
        <button className="mt-6 w-full rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white" type="submit">Confirm</button>
      </form>
    </main>
  )
}
