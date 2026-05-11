import { useEffect, useMemo, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { getProjects } from '../../api/projects'
import { getAchievements } from '../../api/achievements'
import { createActivity } from '../../api/activities'
import { useAuth } from '../../contexts/AuthContext'

function extractRepoInfo(url) {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/?\s]+)/)
    if (match) return { owner: match[1], repo: match[2] }
  } catch {}
  return { owner: null, repo: url }
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (Number.isNaN(diff)) return ''
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ProjectDetail() {
  const { id } = useParams()
  const { state } = useLocation()
  const { isAuthenticated } = useAuth()
  const [project, setProject] = useState(state?.project || null)
  const [loading, setLoading] = useState(!project)
  const [contribUrl, setContribUrl] = useState('')
  const [contribSuccess, setContribSuccess] = useState(false)
  const [contribError, setContribError] = useState('')
  const [activity, setActivity] = useState([])
  const [activityTotal, setActivityTotal] = useState(0)

  useEffect(() => {
    if (!project) {
      getProjects()
        .then((r) => setProject((r.data.projects || []).find((p) => String(p.id) === String(id)) || null))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [id, project])

  useEffect(() => {
    if (!isAuthenticated) {
      setActivity([])
      setActivityTotal(0)
      return
    }
    getAchievements({ project_id: id, limit: 10, sort: 'recent' })
      .then((r) => {
        setActivity(r.data.achievements || [])
        setActivityTotal(r.data.pagination?.total ?? (r.data.achievements || []).length)
      })
      .catch(() => {
        setActivity([])
        setActivityTotal(0)
      })
  }, [id, isAuthenticated, contribSuccess])

  const contributorCount = useMemo(() => {
    return new Set(activity.map((a) => a.user_id).filter(Boolean)).size
  }, [activity])
  const issuesAddressed = useMemo(() => {
    return activity.filter((a) => a.issue_url).length
  }, [activity])

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
                { label: 'Contributions', value: activityTotal },
                { label: 'Contributors',  value: contributorCount },
                { label: 'Issues addressed', value: issuesAddressed },
              ].map((s) => (
                <div key={s.label} className="card text-center">
                  <p className="text-caption text-ash-gray mb-1">{s.label}</p>
                  <p className="text-body text-factory-black font-mono">{s.value}</p>
                </div>
              ))}
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
                {!isAuthenticated ? (
                  <p className="text-caption text-ash-gray py-4 text-center">
                    Sign in to see recent contributions on this project.
                  </p>
                ) : activity.length === 0 ? (
                  <p className="text-caption text-ash-gray py-4 text-center">
                    No contributions logged yet. Be the first.
                  </p>
                ) : (
                  <div className="space-y-0">
                    {activity.map((item) => {
                      const label =
                        item.issue_title ||
                        item.name ||
                        item.description ||
                        'Contribution recorded'
                      const href = item.url || item.issue_url
                      return (
                        <div key={item.id} className="flex items-start gap-3 py-3 border-b border-cool-gray/30 last:border-0">
                          <span className="text-caption text-ash-gray shrink-0 font-mono mt-0.5">↑</span>
                          <div className="min-w-0 flex-1">
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-body-sm text-factory-black truncate block hover:underline"
                                title={label}
                              >
                                {label}
                              </a>
                            ) : (
                              <p className="text-body-sm text-factory-black truncate" title={label}>
                                {label}
                              </p>
                            )}
                            <p className="text-caption text-ash-gray">
                              {item.issue_number ? `#${item.issue_number} · ` : ''}
                              {timeAgo(item.created_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
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
