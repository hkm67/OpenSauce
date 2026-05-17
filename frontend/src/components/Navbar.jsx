import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl } from '../api/client'

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
          <a href="/#how-it-works" className="nav-link">How It Works</a>
          <Link to="/dashboard/marketplace" className="nav-link">Marketplace</Link>
          <Link to="/about" className="nav-link">About Us</Link>
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-2 ml-auto">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="nav-link">{user?.name || user?.username}</Link>
              <button onClick={() => { logout(); navigate('/') }} className="btn-outline py-1 text-body-sm">
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => window.location.assign(apiUrl('/oauth/github'))}
                className="nav-link hidden sm:inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.34-3.369-1.34-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
                Continue with GitHub
              </button>
              <Link to="/signup" className="btn-primary py-1 text-body-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
