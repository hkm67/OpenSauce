import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { label: 'Overview',         path: '/dashboard' },
  { label: 'My Agents',        path: '/dashboard/agents' },
  { label: 'Token Allocation', path: '/dashboard/tokens' },
  { label: 'Contributions',    path: '/dashboard/contributions' },
]

const bottomItems = [
  { label: 'Notifications', path: '/notifications' },
  { label: 'Settings',      path: '/settings' },
  { label: 'Docs',          path: '/docs' },
]

export default function DashboardLayout({ children }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex bg-factory-light-gray">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-faded-silver border-r border-cool-gray/40 flex flex-col">
        {/* Logo */}
        <div className="h-12 flex items-center px-4 border-b border-cool-gray/40">
          <Link to="/" className="text-body text-factory-black flex items-center gap-1.5">
            <span>🍅</span>
            <span>OpenSauce</span>
          </Link>
        </div>

        {/* Main nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => {
            const active = item.path === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.path)
            return (
              <Link key={item.path} to={item.path}
                className={active ? 'sidebar-item-active' : 'sidebar-item'}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom nav */}
        <div className="p-2 border-t border-cool-gray/40 space-y-0.5">
          {bottomItems.map((item) => (
            <Link key={item.path} to={item.path} className="sidebar-item">{item.label}</Link>
          ))}
        </div>

        {/* User */}
        <div className="p-3 border-t border-cool-gray/40">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded bg-factory-light-gray border border-cool-gray/40 flex items-center justify-center text-caption text-factory-black shrink-0">
              {(user?.name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-body-sm text-factory-black truncate">{user?.name || user?.username}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/') }}
            className="text-caption text-ash-gray hover:text-factory-black transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
