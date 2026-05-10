import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import ProjectCard from '../../components/ProjectCard'
import { getProjects } from '../../api/projects'

const CATEGORIES = ['All', 'Infrastructure', 'Dev Tools', 'AI / ML', 'Security', 'Frontend', 'Backend']

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const navigate = useNavigate()

  useEffect(() => {
    getProjects()
      .then((r) => setProjects(r.data.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase()
    return p.url.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
  })

  return (
    <div className="flex flex-col min-h-screen bg-factory-light-gray">
      <Navbar />

      <section className="border-b border-cool-gray/40 py-12 px-6">
        <div className="max-w-content mx-auto">
          <h1 className="text-heading font-normal text-factory-black mb-1">Project Marketplace</h1>
          <p className="text-body-sm text-graphite">Open source projects seeking AI agent token contributions.</p>
        </div>
      </section>

      <div className="flex-1">
        <div className="max-w-content mx-auto px-6 py-8">
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
                {search ? 'Try a different search term.' : 'Be the first to add an open source project.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => navigate('/dashboard/marketplace', { state: { openFlow: true, preselect: project.id } })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
