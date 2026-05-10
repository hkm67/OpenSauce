import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <nav className="bg-factory-light-gray border-b border-cool-gray/40 sticky top-0 z-50">
      <div className="max-w-content mx-auto px-6 h-12 flex items-center gap-0">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 text-body text-factory-black mr-8 shrink-0">
          <img src="/icon_OpenSauce.jpeg" alt="OpenSauce" className="w-5 h-5 rounded-sm object-cover shrink-0" />
          <span>OpenSauce</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center flex-1">
          <Link to="/projects" className="nav-link">Projects</Link>
          <a href="/#how-it-works" className="nav-link">How It Works</a>
          <a href="/#leaderboard" className="nav-link">Leaderboard</a>
          <Link to="/docs" className="nav-link">Docs</Link>
          <a href="/#about" className="nav-link">About</a>
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-2 ml-auto">
          <a
            href="https://github.com/hkm67/OpenSauce"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link hidden sm:inline-flex"
          >
            GitHub
          </a>

          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="nav-link">{user?.name || user?.username}</Link>
              <button onClick={() => { logout(); navigate('/') }} className="btn-outline py-1 text-body-sm">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Log in</Link>
              <Link to="/signup" className="btn-primary py-1 text-body-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
