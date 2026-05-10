import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { createActivity } from '../../api/activities'
import { getProjects } from '../../api/projects'

const HISTORY = [
  { project: 'react/react',           tokens: 2400, prs: 3, date: '2026-05-09', type: 'active' },
  { project: 'rust-lang/rust',        tokens: 1800, prs: 1, date: '2026-05-08', type: 'active' },
  { project: 'vercel/next.js',        tokens: 3200, prs: 5, date: '2026-05-06', type: 'history' },
  { project: 'microsoft/typescript',  tokens: 900,  prs: 1, date: '2026-04-28', type: 'history' },
]

export default function Contributions() {
  const [tab, setTab] = useState('active')
  const [projects, setProjects] = useState([])
  const [showContribute, setShowContribute] = useState(false)
  const [contribForm, setContribForm] = useState({ opensource_id: '', url: '' })
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getProjects().then((r) => setProjects(r.data.projects || [])).catch(() => {})
  }, [])

  const handleContribute = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await createActivity({ opensource_id: parseInt(contribForm.opensource_id), url: contribForm.url })
      setSuccess('Contribution recorded!')
      setShowContribute(false)
      setContribForm({ opensource_id: '', url: '' })
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record contribution')
    }
  }

  const displayed = HISTORY.filter((h) => tab === 'all' || h.type === tab)
  const totalTokens = HISTORY.reduce((sum, h) => sum + h.tokens, 0)
  const totalPRs = HISTORY.reduce((sum, h) => sum + h.prs, 0)

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-heading font-normal text-factory-black">My Contributions</h1>
            <p className="text-body-sm text-graphite mt-1">Track your token donations and assisted PRs.</p>
          </div>
          <button onClick={() => setShowContribute(true)} className="btn-primary">+ Record contribution</button>
        </div>

        {success && (
          <div className="bg-factory-light-gray border border-cool-gray/40 text-factory-black rounded px-4 py-3 text-body-sm mb-6">
            {success}
          </div>
        )}

        {showContribute && (
          <div className="card mb-6">
            <h3 className="text-body text-factory-black mb-4">Record a contribution</h3>
            <form onSubmit={handleContribute} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-body-sm">{error}</div>
              )}
              <div>
                <label className="label">Project</label>
                <select className="input" value={contribForm.opensource_id}
                  onChange={(e) => setContribForm({ ...contribForm, opensource_id: e.target.value })} required>
                  <option value="">Select a project…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.url}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Contribution URL (PR or issue)</label>
                <input type="url" className="input" placeholder="https://github.com/org/repo/pull/123"
                  value={contribForm.url} onChange={(e) => setContribForm({ ...contribForm, url: e.target.value })} required />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary">Save</button>
                <button type="button" onClick={() => setShowContribute(false)} className="btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Impact summary */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Total tokens donated', value: totalTokens.toLocaleString() },
            { label: 'PRs / issues assisted', value: totalPRs },
            { label: 'Projects contributed',  value: new Set(HISTORY.map(h => h.project)).size },
          ].map((s) => (
            <div key={s.label} className="card text-center">
              <p className="text-caption text-ash-gray mb-1">{s.label}</p>
              <p className="text-heading font-normal text-factory-black font-mono">{s.value}</p>
            </div>
          ))}
        </div>

        {/* List */}
        <div className="card">
          <div className="flex gap-1 border-b border-cool-gray/30 mb-5 -mx-4 px-4">
            {[{ key: 'active', label: 'Active' }, { key: 'history', label: 'History' }, { key: 'all', label: 'All' }].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`pb-3 px-1 mr-5 text-body-sm border-b-2 transition-colors ${
                  tab === t.key ? 'border-factory-black text-factory-black' : 'border-transparent text-ash-gray hover:text-factory-black'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-0">
            {displayed.length === 0 ? (
              <p className="text-body-sm text-ash-gray py-8 text-center">No contributions here yet.</p>
            ) : displayed.map((item, i) => (
              <div key={i} className="flex items-center gap-4 py-4 border-b border-cool-gray/30 last:border-0">
                <div className="w-8 h-8 rounded bg-factory-light-gray flex items-center justify-center text-factory-black text-caption font-mono shrink-0 border border-cool-gray/40">
                  {item.project[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-factory-black font-mono">{item.project}</p>
                  <p className="text-caption text-ash-gray">{item.prs} PR{item.prs !== 1 ? 's' : ''} assisted</p>
                </div>
                <div className="text-right">
                  <p className="text-body-sm text-code-orange font-mono">{item.tokens.toLocaleString()} tokens</p>
                  <p className="text-caption text-ash-gray">{item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
