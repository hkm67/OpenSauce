import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-factory-light-gray flex flex-col">
      <div className="h-12 flex items-center px-6 border-b border-cool-gray/40 bg-factory-light-gray">
        <Link to="/" className="text-body text-factory-black flex items-center gap-1.5">
          <span>🍅</span><span>OpenSauce</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-xs">
          <h1 className="text-heading font-normal text-factory-black mb-1">Welcome back</h1>
          <p className="text-body-sm text-graphite mb-8">
            No account?{' '}
            <Link to="/signup" className="text-factory-black hover:underline">Sign up →</Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <p className="text-body-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">{error}</p>
            )}
            <div>
              <label className="label">Username</label>
              <input type="text" autoComplete="username" className="input" placeholder="your-username"
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" autoComplete="current-password" className="input" placeholder="••••••••"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2 disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
