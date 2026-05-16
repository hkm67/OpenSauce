import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import ProjectCard from '../../components/ProjectCard'
import ContributionFlow from './ContributionFlow'
import { searchGithubRepos } from '../../api/github'
import { CATEGORIES as TAXONOMY, categorizeProject } from '../../utils/category'

const CATEGORIES = ['All', ...TAXONOMY]

export default function Marketplace() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('open source good first issue')
  const [category, setCategory] = useState('All')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [showFlow, setShowFlow] = useState(false)
  const [preselect, setPreselect] = useState(null)
  const location = useLocation()

  useEffect(() => {
    if (location.state?.openFlow) setShowFlow(true)
    if (location.state?.preselect) setPreselect(location.state.preselect)
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true)
      searchGithubRepos(search || 'open source good first issue', 20, page)
        .then((r) => {
          setProjects(r.data.repositories || [])
          setPagination(r.data.pagination || null)
        })
        .catch(() => {
          setProjects([])
          setPagination(null)
        })
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(handle)
  }, [search, page])

  useEffect(() => {
    if (!preselect || projects.some((project) => project.github_repo === preselect)) return
    setProjects((prev) => [
      {
        github_repo: preselect,
        url: `https://github.com/${preselect}`,
        description: 'GitHub repository',
      },
      ...prev,
    ])
  }, [preselect, projects])

  const filtered = projects.filter((p) => {
    if (category !== 'All' && categorizeProject(p) !== category) return false
    return true
  })

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header row */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-heading font-normal text-factory-black">GitHub Marketplace</h1>
            <p className="text-body-sm text-graphite mt-1">Search public GitHub repositories and start a contribution.</p>
          </div>
          <button
            onClick={() => setShowFlow(true)}
            className="shrink-0 bg-factory-black text-faded-silver px-4 py-2 text-body-sm rounded hover:bg-factory-black/80 transition-colors"
          >
            Start Contribution
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <input
            type="text"
            className="input"
            placeholder="Search GitHub repositories…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
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

        <p className="text-caption text-ash-gray mb-5 font-mono">
          {loading
            ? 'Loading…'
            : `${filtered.length} repositor${filtered.length !== 1 ? 'ies' : 'y'} · page ${pagination?.page || page}${pagination?.total_pages ? ` of ${pagination.total_pages}` : ''}`}
        </p>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card animate-pulse h-24" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-20">
            <p className="text-body text-factory-black mb-2">No repositories found</p>
            <p className="text-body-sm text-ash-gray">
              Try a different GitHub search term.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((project) => (
              <ProjectCard
                key={project.github_repo}
                project={project}
                onClick={() => { setPreselect(project.github_repo); setShowFlow(true) }}
              />
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 mt-6 border-t border-cool-gray/40 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination?.has_previous}
              className={`btn-outline px-4 py-2 text-body-sm ${!pagination?.has_previous ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              Previous
            </button>
            <span className="text-caption text-ash-gray font-mono">
              {pagination?.total ? `${pagination.total} GitHub results available` : 'GitHub search results'}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination?.has_next}
              className={`bg-factory-black text-faded-silver px-4 py-2 text-body-sm rounded hover:bg-factory-black/80 transition-colors ${!pagination?.has_next ? 'opacity-40 cursor-not-allowed hover:bg-factory-black' : ''}`}
            >
              Next
            </button>
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
