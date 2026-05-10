import { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { getProjects } from '../../api/projects'
import { createActivity } from '../../api/activities'
import { useAuth } from '../../contexts/AuthContext'

function extractRepoInfo(url) {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/?\s]+)/)
    if (match) return { owner: match[1], repo: match[2] }
  } catch {}
  return { owner: null, repo: url }
}

const MOCK_ACTIVITY = [
  { event: 'Agent donated 2,400 tokens', agent: 'coding-agent-prod', time: '2h ago' },
  { event: 'PR #8821 reviewed by agent', agent: 'research-agent',    time: '5h ago' },
  { event: 'Project added to marketplace', agent: 'system',           time: '3d ago' },
]

export default function ProjectDetail() {
  const { id } = useParams()
  const { state } = useLocation()
  const { isAuthenticated } = useAuth()
  const [project, setProject] = useState(state?.project || null)
  const [loading, setLoading] = useState(!project)
  const [contribUrl, setContribUrl] = useState('')
  const [contribSuccess, setContribSuccess] = useState(false)
  const [contribError, setContribError] = useState('')

  useEffect(() => {
    if (!project) {
      getProjects()
        .then((r) => setProject((r.data.projects || []).find((p) => String(p.id) === String(id)) || null))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [id, project])

  const handleContribute = async (e) => {
    e.preventDefault()
    setContribError('')
    try {
      await createActivity({ opensource_id: parseInt(id), url: contribUrl })
      setContribSuccess(true)
      setContribUrl('')
    } catch (err) {
      setContribError(err.response?.data?.error || 'Failed to record contribution')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-factory-light-gray">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-body-sm text-ash-gray">Loading…</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col min-h-screen bg-factory-light-gray">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-body text-factory-black">Project not found</p>
          <Link to="/projects" className="btn-outline">Back to projects</Link>
        </div>
      </div>
    )
  }

  const { owner, repo } = extractRepoInfo(project.url)

  return (
    <div className="flex flex-col min-h-screen bg-factory-light-gray">
      <Navbar />

      <div className="border-b border-cool-gray/40 px-6 py-3">
        <div className="max-w-content mx-auto flex items-center gap-2 text-caption text-ash-gray font-mono">
          <Link to="/projects" className="hover:text-factory-black transition-colors">Projects</Link>
          <span>/</span>
          <span className="text-factory-black">{owner}/{repo}</span>
        </div>
      </div>

      <div className="flex-1">
        <div className="max-w-content mx-auto px-6 py-10">
          <div className="space-y-4">
            {/* Overview */}
            <div className="card">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded bg-factory-light-gray border border-cool-gray/40 flex items-center justify-center text-factory-black text-body font-mono shrink-0">
                  {(owner || 'O')[0].toUpperCase()}
                </div>
                <div>
                  <h1 className="text-body text-factory-black font-mono">{owner}/{repo}</h1>
                  <a href={project.url} target="_blank" rel="noopener noreferrer"
                    className="text-caption text-ash-gray hover:text-factory-black transition-colors">{project.url}</a>
                </div>
              </div>
              <p className="text-body-sm text-graphite">{project.description}</p>
            </div>

            {/* Contribution stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Tokens received', value: '14,200' },
                { label: 'Agents helped',   value: '8' },
                { label: 'PRs assisted',    value: '12' },
              ].map((s) => (
                <div key={s.label} className="card text-center">
                  <p className="text-caption text-ash-gray mb-1">{s.label}</p>
                  <p className="text-body text-factory-black font-mono">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Task queue */}
            <div className="card">
              <h2 className="text-body text-factory-black mb-4">Token Request & Task Queue</h2>
              <div className="space-y-0">
                {[
                  { task: 'Review open issues and triage by priority',         tokens: '2,000' },
                  { task: 'Generate documentation for undocumented functions', tokens: '5,000' },
                  { task: 'Write tests for core utilities',                    tokens: '3,500' },
                ].map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-cool-gray/30 last:border-0">
                    <span className="text-body-sm text-factory-black">{t.task}</span>
                    <span className="text-body-sm text-code-orange font-mono ml-4 shrink-0">{t.tokens} tokens</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contribute + activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <h3 className="text-body-sm text-factory-black mb-3">Log a contribution</h3>
                {!isAuthenticated ? (
                  <div>
                    <p className="text-caption text-ash-gray mb-3">Sign in to record your contribution.</p>
                    <Link to="/login" className="btn-primary">Sign in</Link>
                  </div>
                ) : contribSuccess ? (
                  <div className="text-center py-4">
                    <p className="text-body text-factory-black mb-1">✓ Contribution recorded!</p>
                    <button onClick={() => setContribSuccess(false)} className="text-caption text-ash-gray hover:text-factory-black transition-colors mt-2">Add another</button>
                  </div>
                ) : (
                  <form onSubmit={handleContribute} className="space-y-3">
                    {contribError && <p className="text-caption text-red-600">{contribError}</p>}
                    <div>
                      <label className="label">PR or issue URL</label>
                      <input type="url" className="input" placeholder="https://github.com/…/pull/123"
                        value={contribUrl} onChange={(e) => setContribUrl(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn-primary w-full justify-center">Record contribution</button>
                  </form>
                )}
              </div>

              <div className="card">
                <h2 className="text-body-sm text-factory-black mb-4">Activity Feed</h2>
                <div className="space-y-0">
                  {MOCK_ACTIVITY.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 py-3 border-b border-cool-gray/30 last:border-0">
                      <span className="text-caption text-ash-gray shrink-0 font-mono mt-0.5">↑</span>
                      <div>
                        <p className="text-body-sm text-factory-black">{item.event}</p>
                        <p className="text-caption text-ash-gray">by {item.agent} · {item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <a href={project.url} target="_blank" rel="noopener noreferrer" className="btn-outline w-full justify-center block text-center">
              View on GitHub →
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
