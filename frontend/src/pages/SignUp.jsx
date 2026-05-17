import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiUrl } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function SignUp() {
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleGitHubLogin = () => {
    window.location.assign(apiUrl('/oauth/github'))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await signup(form.name, form.username, form.email, form.password)
      navigate('/onboarding/agent-setup')
    } catch (err) {
      const msg = err.message || err.response?.data?.error || 'Could not create account'
      setError(msg.includes('UNIQUE') ? 'Username already taken' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-factory-light-gray flex flex-col">
      <div className="h-12 flex items-center px-6 border-b border-cool-gray/40">
        <Link to="/" className="text-body text-factory-black flex items-center gap-1.5">
          <span>🍅</span><span>OpenSauce</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-xs">
          <h1 className="text-heading font-normal text-factory-black mb-1">Create account</h1>
          <p className="text-body-sm text-graphite mb-8">
            Already have one?{' '}
            <Link to="/login" className="text-factory-black hover:underline">Log in →</Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <p className="text-body-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">{error}</p>
            )}
            {[
              { id: 'name',     label: 'Full name',       type: 'text',     ph: 'Jane Smith',  ac: 'name'         },
              { id: 'username', label: 'Username',         type: 'text',     ph: 'jane-smith',  ac: 'username'     },
              { id: 'email',    label: 'Email',            type: 'email',    ph: 'jane@example.com', ac: 'email'   },
              { id: 'password', label: 'Password',         type: 'password', ph: '••••••••',    ac: 'new-password' },
              { id: 'confirm',  label: 'Confirm password', type: 'password', ph: '••••••••',    ac: 'new-password' },
            ].map(({ id, label, type, ph, ac }) => (
              <div key={id}>
                <label className="label">{label}</label>
                <input id={id} type={type} autoComplete={ac} className="input" placeholder={ph}
                  value={form[id]} onChange={(e) => setForm({ ...form, [id]: e.target.value })} required />
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2 disabled:opacity-50">
              {loading ? 'Creating…' : 'Create account'}
            </button>
            <p className="text-caption text-ash-gray text-center">
              By signing up you agree to our <Link to="/terms" className="hover:underline">Terms</Link> and <Link to="/privacy" className="hover:underline">Privacy Policy</Link>.
            </p>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-cool-gray/40" />
            <span className="text-caption text-ash-gray">or</span>
            <div className="h-px flex-1 bg-cool-gray/40" />
          </div>

          <button type="button" onClick={handleGitHubLogin} className="btn-outline w-full justify-center py-2 text-body-sm">
            Continue with GitHub
          </button>
        </div>
      </div>
    </div>
  )
}
