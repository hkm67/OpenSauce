import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function OAuthCallback() {
  const [error, setError] = useState('')
  const handled = useRef(false)
  const { completeOAuthLogin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const token = params.get('access_token')

    if (!token) {
      setError('OAuth did not return an access token.')
      return
    }

    completeOAuthLogin(token)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch((err) => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setError(err.message || err.response?.data?.error || 'Could not finish GitHub sign in.')
      })
  }, [completeOAuthLogin, navigate])

  return (
    <div className="min-h-screen bg-factory-light-gray flex flex-col">
      <div className="h-12 flex items-center px-6 border-b border-cool-gray/40 bg-factory-light-gray">
        <Link to="/" className="text-body text-factory-black flex items-center gap-1.5">
          <span>🍅</span><span>OpenSauce</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-xs text-center">
          <h1 className="text-heading font-normal text-factory-black mb-2">
            {error ? 'Sign in failed' : 'Signing you in'}
          </h1>
          <p className={`text-body-sm ${error ? 'text-red-600' : 'text-graphite'}`}>
            {error || 'Finishing GitHub authentication...'}
          </p>
          {error && (
            <Link to="/login" className="btn-primary mt-6 w-full justify-center py-2">
              Back to login
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
