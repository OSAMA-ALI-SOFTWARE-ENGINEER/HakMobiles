import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../lib/api'
import { useSession, type SessionUser } from '../lib/session'

type LoginResponse = {
  token: string
  user: SessionUser
  permissions: string[]
  must_setup_two_factor: boolean
  must_change_password: boolean
}

export function LoginPage() {
  const navigate = useNavigate()
  const { setSession } = useSession()
  const [email, setEmail] = useState('seller@hak.test')
  const [password, setPassword] = useState('password1234')
  const [otp, setOtp] = useState('')
  const [needsOtp, setNeedsOtp] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const body = await api<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          device_name: 'Web browser',
          platform: 'web',
          otp: otp || undefined,
        }),
      })
      setSession({
        token: body.token,
        user: body.user,
        permissions: body.permissions,
        mustSetupTwoFactor: body.must_setup_two_factor,
      })
      navigate(body.must_setup_two_factor ? '/two-factor' : '/')
    } catch (caught) {
      if (caught instanceof ApiError && caught.body.status === 'two_factor_required') {
        setNeedsOtp(true)
        setError('Enter the code from your authenticator.')
        return
      }
      setError(caught instanceof Error ? caught.message : 'Login failed')
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-emerald-700">HAK Wholesales</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-stone-500">Accounts are created by the super admin.</p>
        <label className="mt-6 block text-sm font-medium">
          Email
          <input aria-label="Email" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Password
          <input aria-label="Password" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </label>
        {needsOtp && (
          <label className="mt-4 block text-sm font-medium">
            Authenticator code
            <input className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" />
          </label>
        )}
        {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
        <button className="mt-6 w-full rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white" type="submit">
          Continue
        </button>
      </form>
    </main>
  )
}
