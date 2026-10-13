import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type SessionUser = {
  id: string
  name: string
  email: string
  roles: string[]
}

export type Session = {
  token: string
  user: SessionUser
  permissions: string[]
  mustSetupTwoFactor: boolean
}

const KEY = 'hak.session'

const SessionContext = createContext<{
  session: Session | null
  setSession: (session: Session | null) => void
} | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as Session
    } catch {
      return null
    }
  })

  const value = useMemo(
    () => ({
      session,
      setSession: (next: Session | null) => {
        setSessionState(next)
        if (next) localStorage.setItem(KEY, JSON.stringify(next))
        else localStorage.removeItem(KEY)
      },
    }),
    [session],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('Session missing')
  return value
}

export function isSuperAdmin(session: Session | null): boolean {
  return session?.user.roles.includes('Super Admin') ?? false
}
