import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import ProjectCard from '../../components/ProjectCard'
import ContributionFlow from './ContributionFlow'
import { getProjects, recommendProjects } from '../../api/projects'
import { useAuth } from '../../contexts/AuthContext'
import { CATEGORIES as TAXONOMY, categorizeProject } from '../../utils/category'

const CATEGORIES = ['All', ...TAXONOMY]

export default function Marketplace() {
  const { isAuthenticated } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [showFlow, setShowFlow] = useState(false)
  const [preselect, setPreselect] = useState(null)
  const [recs, setRecs] = useState([])
  const [recsState, setRecsState] = useState('idle') // idle | loading | ready | disabled
  const location = useLocation()

  useEffect(() => {
    if (location.state?.openFlow) setShowFlow(true)
    if (location.state?.preselect) setPreselect(location.state.preselect)
  }, [])

  useEffect(() => {
    getProjects()
      .then((r) => setProjects(r.data.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setRecs([])
      setRecsState('idle')
      return
    }
    setRecsState('loading')
    recommendProjects({ limit: 5 })
      .then((r) => {
        const items = r.data.recommendations || []
        setRecs(items)
        setRecsState(r.data.enabled === false ? 'disabled' : 'ready')
      })
      .catch(() => setRecsState('idle'))
  }, [isAuthenticated])

  const recById = useMemo(() => {
    const m = new Map()
    recs.forEach((r) => m.set(r.project_id, r.reason))
    return m
  }, [recs])

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase()
    const hay = `${p.url} ${p.description}`.toLowerCase()
    if (q && !hay.includes(q)) return false
    if (category !== 'All' && categorizeProject(p) !== category) return false
    return true
  })

  const recommendedProjects = recs
    .map((r) => projects.find((p) => p.id === r.project_id))
    .filter(Boolean)

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header row */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-heading font-normal text-factory-black">Project Marketplace</h1>
            <p className="text-body-sm text-graphite mt-1">Open source projects seeking AI agent token contributions.</p>
          </div>
          <button
            onClick={() => setShowFlow(true)}
            className="shrink-0 bg-factory-black text-faded-silver px-4 py-2 text-body-sm rounded hover:bg-factory-black/80 transition-colors"
          >
            Contribution Plan
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <input
            type="text"
            className="input"
            placeholder="Search projects by name or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded px-3 py-1 text-caption border transition-colors ${
                  category === cat
                    ? 'bg-factory-black text-faded-silver border-factory-black'
                    : 'bg-transparent text-graphite border-cool-gray hover:border-graphite'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Recommended for you */}
        {isAuthenticated && (recsState === 'loading' || recommendedProjects.length > 0 || recsState === 'disabled') && (
          <div className="mb-6">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-body text-factory-black">
                Recommended for you
              </h2>
              <Link to="/settings" className="text-caption text-ash-gray hover:text-factory-black transition-colors">
                Tune preferences →
              </Link>
            </div>
            {recsState === 'loading' && (
              <p className="text-caption text-ash-gray font-mono">Picking matches…</p>
            )}
            {recsState === 'disabled' && (
              <p className="text-caption text-ash-gray">
                Smart recommendations are disabled. Set <span className="font-mono">CLOD_ENABLED=1</span> to turn them on.
              </p>
            )}
            {recommendedProjects.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recommendedProjects.map((project) => (
                  <div key={project.id} className="space-y-1">
                    <ProjectCard
                      project={project}
                      onClick={() => { setPreselect(project.id); setShowFlow(true) }}
                    />
                    {recById.get(project.id) && (
                      <p className="text-caption text-graphite px-1">
                        <span className="font-mono text-ash-gray">why →</span> {recById.get(project.id)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-caption text-ash-gray mb-5 font-mono">
          {loading ? 'Loading…' : `${filtered.length} project${filtered.length !== 1 ? 's' : ''}`}
        </p>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card animate-pulse h-24" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-20">
            <p className="text-body text-factory-black mb-2">No projects found</p>
            <p className="text-body-sm text-ash-gray">
              {search ? 'Try a different search term.' : 'No projects available yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => { setPreselect(project.id); setShowFlow(true) }}
              />
            ))}
          </div>
        )}
      </div>

      {showFlow && (
        <ContributionFlow
          projects={projects}
          preselect={preselect}
          onClose={() => { setShowFlow(false); setPreselect(null) }}
        />
      )}
    </DashboardLayout>
  )
}
