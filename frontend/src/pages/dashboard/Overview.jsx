import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatCard from '../../components/StatCard'
import { useAuth } from '../../contexts/AuthContext'
import { getSkills } from '../../api/achievements'
import { getProjects } from '../../api/projects'

export default function Overview() {
  const { user } = useAuth()
  const [skills, setSkills] = useState([])
  const [projects, setProjects] = useState([])

  useEffect(() => {
    getSkills().then((r) => setSkills(r.data.skills || [])).catch(() => {})
    getProjects().then((r) => setProjects(r.data.projects || [])).catch(() => {})
  }, [])

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-heading font-normal text-factory-black">
            Good morning, {user?.name?.split(' ')[0] || user?.username}
          </h1>
          <p className="text-body-sm text-graphite mt-1">Here's your contribution summary for this cycle.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard label="Tokens This Cycle" value="84,200" sub="of 100,000 budget" />
          <StatCard label="Tokens Donated" value="12,500" accent sub="this month" />
          <StatCard label="Savings" value="$4.20" sub="token cost offset" />
          <StatCard label="Projects Helped" value={projects.length > 0 ? projects.length : '—'} sub="active contributions" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Activity feed */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-body text-factory-black">Recent Activity</h2>
                <Link to="/dashboard/contributions" className="text-caption text-ash-gray hover:text-factory-black transition-colors">View all →</Link>
              </div>

              <div className="space-y-0">
                {[
                  { type: 'donation', project: 'react/react',         tokens: '2,400', time: '2h ago' },
                  { type: 'pr',       project: 'vercel/next.js',      desc: 'Reviewed PR #58221', time: '5h ago' },
                  { type: 'donation', project: 'rust-lang/rust',      tokens: '1,800', time: '1d ago' },
                  { type: 'pr',       project: 'facebook/docusaurus', desc: 'Resolved issue #9442', time: '2d ago' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 py-3 border-b border-cool-gray/30 last:border-0">
                    <span className="font-mono text-caption text-ash-gray shrink-0 mt-0.5 w-4">
                      {item.type === 'donation' ? '↑' : '✓'}
                    </span>
                    <p className="text-body-sm text-factory-black flex-1">
                      {item.type === 'donation'
                        ? <>Donated <span className="font-mono text-code-orange">{item.tokens}</span> tokens to {item.project}</>
                        : <>{item.desc} on {item.project}</>}
                    </p>
                    <span className="text-caption text-ash-gray shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-body text-factory-black">Skills</h2>
                <span className="text-caption text-ash-gray">{skills.length} earned</span>
              </div>
              {skills.length === 0 ? (
                <p className="text-body-sm text-ash-gray">No achievements yet. Start contributing to earn skills.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <span key={s.id} className="bg-factory-light-gray text-factory-black border border-cool-gray/40 rounded px-3 py-1 text-caption">
                      {s.skill || s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="text-body text-factory-black mb-4">Quick actions</h2>
              <div className="space-y-2">
                <Link to="/dashboard/agents" className="block btn-outline w-full text-center py-2 text-body-sm">Add agent server</Link>
                <Link to="/projects" className="block btn-outline w-full text-center py-2 text-body-sm">Browse projects</Link>
                <Link to="/dashboard/tokens" className="block btn-outline w-full text-center py-2 text-body-sm">Set donation rules</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
