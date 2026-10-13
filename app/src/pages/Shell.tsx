import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { canAccess, visibleMenu } from '../shared/access'
import { isSuperAdmin, useSession } from '../lib/session'

export function Shell() {
  const { session, setSession } = useSession()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace />
  if (session.mustSetupTwoFactor) return <Navigate to="/two-factor" replace />
  if (!canAccess(location.pathname, session.permissions, isSuperAdmin(session))) {
    return <Navigate to="/" replace />
  }

  const menu = visibleMenu(session.permissions, isSuperAdmin(session))

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="bg-stone-900 px-4 py-6 text-stone-100">
        <p className="px-2 text-xs uppercase tracking-wide text-emerald-300">HAK Wholesales</p>
        <p className="mt-1 px-2 text-sm text-stone-300">{session.user.name}</p>
        <nav className="mt-6 grid gap-1">
          {menu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-emerald-700 text-white' : 'text-stone-200 hover:bg-stone-800'}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="mt-8 px-3 text-sm text-stone-400"
          type="button"
          onClick={() => setSession(null)}
        >
          Log out
        </button>
      </aside>
      <div>
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3 text-sm">
          <span>Online</span>
          <span className="text-stone-500">{session.user.roles.join(', ')}</span>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
