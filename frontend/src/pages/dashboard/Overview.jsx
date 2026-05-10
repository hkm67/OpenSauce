import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatCard from '../../components/StatCard'
import BadgeCard from '../../components/BadgeCard'
import { useAuth } from '../../contexts/AuthContext'
import { getDashboard } from '../../api/achievements'
import { getProjects } from '../../api/projects'
import { getLevel, getBadges } from '../../config/badges'

export default function Overview() {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [myContributions, setMyContributions] = useState(0)

  useEffect(() => {
    getProjects().then((r) => setProjects(r.data.projects || [])).catch(() => {})
    getDashboard(50)
      .then((r) => {
        const entry = r.data.windows.monthly.top_users.find(
          (u) => u.username === user?.username
        )
        setMyContributions(entry?.contributions ?? 0)
      })
      .catch(() => {})
  }, [user?.username])

  const { current: level, next: nextLevel, progressPct } = getLevel(myContributions)
  const badges = getBadges(myContributions)
  const earnedCount = badges.filter((b) => b.earned).length
  const firstName = user?.name?.split(' ')[0] || user?.username

  return (
    <DashboardLayout>
      <div className="p-8">

        {/* Hero: greeting + level widget */}
        <div className="flex items-start justify-between mb-8 gap-6">
          <div>
            <h1 className="text-heading font-normal text-factory-black">
              Good morning, {firstName}
            </h1>
            <p className="text-body-sm text-graphite mt-1">Here's your contribution summary for this cycle.</p>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-1.5 min-w-[200px]">
            <div className="flex items-center gap-2">
              <span className="text-base">{level.icon}</span>
              <span className="text-body-sm text-factory-black">{level.name}</span>
            </div>
            <div className="w-full h-1.5 bg-factory-light-gray rounded-full overflow-hidden border border-cool-gray/30">
              <div
                className="h-full bg-code-orange rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-caption text-ash-gray">
              {nextLevel
                ? `${myContributions} / ${nextLevel.min} to ${nextLevel.name}`
                : 'Maximum level reached'}
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard label="Contributions (30d)" value={myContributions} sub="open source commits" accent />
          <StatCard label="Tokens Donated" value="12,500" sub="this month" />
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
            {/* Badge grid */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-body text-factory-black">Skills & Badges</h2>
                <span className="text-caption text-ash-gray font-mono">{earnedCount} / {badges.length} earned</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {badges.map((badge) => (
                  <BadgeCard key={badge.id} badge={badge} size="sm" />
                ))}
              </div>
            </div>

            {/* Quick actions / CTA */}
            <div className="card">
              <h2 className="text-body text-factory-black mb-4">Quick actions</h2>
              {myContributions === 0 ? (
                <div className="space-y-3">
                  <p className="text-body-sm text-graphite">Your agents are ready. Start your first contribution and earn your first badge.</p>
                  <Link
                    to="/dashboard/marketplace"
                    className="block btn-primary w-full text-center py-2 text-body-sm"
                  >
                    Start First Contribution
                  </Link>
                  <Link to="/projects" className="block btn-outline w-full text-center py-2 text-body-sm">
                    Browse Projects
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link to="/dashboard/agents" className="block btn-outline w-full text-center py-2 text-body-sm">Add agent server</Link>
                  <Link to="/projects" className="block btn-outline w-full text-center py-2 text-body-sm">Browse projects</Link>
                  <Link to="/dashboard/marketplace" className="block btn-outline w-full text-center py-2 text-body-sm">Create contribution plan</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
