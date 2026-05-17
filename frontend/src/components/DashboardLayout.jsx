import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { label: 'Overview',            path: '/dashboard' },
  { label: 'Project Marketplace', path: '/dashboard/marketplace' },
  { label: 'Contributions',       path: '/dashboard/contributions' },
]

const bottomItems = [
  { label: 'Settings', path: '/settings' },
]

function SidebarContent({ pathname, user, onNav, onLogout }) {
  return (
    <>
      <div className="h-12 flex items-center px-4 border-b border-cool-gray/40 shrink-0">
        <Link to="/dashboard" onClick={onNav} className="text-body text-factory-black flex items-center gap-1.5">
          <img src="/icon_OpenSauce.jpeg" alt="OpenSauce" className="w-5 h-5 rounded-sm object-cover shrink-0" />
          <span>OpenSauce</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {navItems.map((item) => {
          const active = item.path === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.path)
          return (
            <Link key={item.path} to={item.path} onClick={onNav}
              className={active ? 'sidebar-item-active' : 'sidebar-item'}>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-2 border-t border-cool-gray/40 space-y-0.5 shrink-0">
        {bottomItems.map((item) => (
          <Link key={item.path} to={item.path} onClick={onNav} className="sidebar-item">{item.label}</Link>
        ))}
      </div>

      <div className="p-3 border-t border-cool-gray/40 shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded bg-factory-light-gray border border-cool-gray/40 flex items-center justify-center text-caption text-factory-black shrink-0">
            {(user?.name || user?.username || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-body-sm text-factory-black truncate">{user?.name || user?.username}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="text-caption text-ash-gray hover:text-factory-black transition-colors"
        >
          Log out
        </button>
      </div>
    </>
  )
}

export default function DashboardLayout({ children }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }
  const handleNav = () => setMobileOpen(false)

  return (
    <div className="min-h-screen flex bg-factory-light-gray">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 shrink-0 bg-faded-silver border-r border-cool-gray/40 flex-col h-screen sticky top-0">
        <SidebarContent pathname={pathname} user={user} onNav={() => {}} onLogout={handleLogout} />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-12 flex items-center gap-3 px-4 bg-faded-silver border-b border-cool-gray/40">
        <button onClick={() => setMobileOpen(true)} className="p-1 text-factory-black">
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/dashboard" className="text-body text-factory-black flex items-center gap-1.5">
          <img src="/icon_OpenSauce.jpeg" alt="OpenSauce" className="w-5 h-5 rounded-sm object-cover shrink-0" />
          <span>OpenSauce</span>
        </Link>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 w-64 bg-faded-silver flex flex-col h-full shadow-xl">
            <div className="absolute top-3 right-3">
              <button onClick={() => setMobileOpen(false)} className="p-1 text-ash-gray hover:text-factory-black">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent pathname={pathname} user={user} onNav={handleNav} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 min-w-0 md:pt-0 pt-12">{children}</main>
    </div>
  )
}
