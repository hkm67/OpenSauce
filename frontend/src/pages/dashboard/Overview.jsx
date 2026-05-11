import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import DashboardLayout from '../../components/DashboardLayout'
import BadgeCard from '../../components/BadgeCard'
import { useAuth } from '../../contexts/AuthContext'
import { getDashboard } from '../../api/achievements'
import { getProjects } from '../../api/projects'
import { getBadges } from '../../config/badges'

// Mock category breakdown derived from project types
const PIE_DATA = [
  { name: 'Infrastructure', value: 32, color: '#020202' },
  { name: 'Dev Tools',      value: 25, color: '#3d3a39' },
  { name: 'AI / ML',        value: 20, color: '#ef6f2e' },
  { name: 'Security',       value: 13, color: '#b8b3b0' },
  { name: 'Frontend',       value: 10, color: '#a49d9a' },
]

// Generate a 52-week × 7-day heatmap grid (mock, seeded from contributions)
function generateHeatmap(totalContributions) {
  const weeks = 52
  const days = 7
  const grid = []
  const seed = totalContributions || 4
  for (let w = 0; w < weeks; w++) {
    const week = []
    for (let d = 0; d < days; d++) {
      const rand = Math.abs(Math.sin(w * 7 + d + seed * 13))
      const active = rand > 0.55
      const intensity = active ? Math.ceil(rand * 4) : 0
      week.push(intensity)
    }
    grid.push(week)
  }
  return grid
}

const HEAT_COLORS = ['#eeeeee', '#fcd5b8', '#f9a96c', '#f37c2a', '#ef6f2e']

function HeatmapCell({ intensity }) {
  return (
    <div
      className="w-2.5 h-2.5 rounded-[2px]"
      style={{ backgroundColor: HEAT_COLORS[intensity] }}
    />
  )
}

const WEEKLY_MISSIONS = [
  { id: 1, title: 'Make 5 contributions',       badge: '🔥', target: 5,  metric: 'contributions' },
  { id: 2, title: 'Contribute to 3 projects',   badge: '🔧', target: 3,  metric: 'projects' },
  { id: 3, title: 'Reach Builder level',        badge: '⚡', target: 5,  metric: 'level' },
  { id: 4, title: 'Earn 3 badges',              badge: '🏅', target: 3,  metric: 'badges' },
]

function MissionRow({ mission, progress, target }) {
  const pct = Math.min(100, Math.round((progress / target) * 100))
  const done = pct >= 100
  return (
    <div className={`p-3 rounded border transition-colors ${done ? 'border-code-orange/40 bg-code-orange/5' : 'border-cool-gray/40'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{mission.badge}</span>
          <p className={`text-body-sm ${done ? 'text-factory-black' : 'text-graphite'}`}>{mission.title}</p>
        </div>
        <span className="text-caption font-mono text-ash-gray">{Math.min(progress, target)}/{target}</span>
      </div>
      <div className="h-1.5 bg-factory-light-gray rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-code-orange' : 'bg-graphite'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {done && <p className="text-caption text-code-orange mt-1.5">Completed ✓</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-faded-silver border border-cool-gray/40 rounded px-3 py-2 text-caption text-factory-black shadow-sm">
      <span className="font-mono">{payload[0].value}%</span> {payload[0].name}
    </div>
  )
}

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

  const badges = getBadges(myContributions)
  const earnedCount = badges.filter((b) => b.earned).length
  const heatmap = generateHeatmap(myContributions)

  // Derive mission progress from real + mock data
  const missionProgress = {
    contributions: myContributions,
    projects: Math.min(projects.length, myContributions),
    level: myContributions,
    badges: earnedCount,
  }

  // Mock stats derived loosely from contribution count
  const statsPushed = Math.max(0, myContributions * 3 + 2)
  const statsMerged = Math.max(0, Math.floor(myContributions * 1.5))

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">

        {/* Promotion Banner */}
        <div className="relative overflow-hidden rounded-lg bg-factory-black px-8 py-6 flex items-center justify-between gap-6">
          <div className="dot-grid absolute inset-0 opacity-20" />
          <div className="relative">
            <p className="text-caption text-cool-gray mb-1 font-mono uppercase tracking-widest">OpenSauce Platform</p>
            <h1 className="text-heading font-normal text-faded-silver mb-1">
              Your AI agents are contributing to open source
            </h1>
            <p className="text-body-sm text-ash-gray">Join thousands of contributors making OSS better, automatically.</p>
          </div>
          <Link
            to="/dashboard/marketplace"
            state={{ openFlow: true }}
            className="relative shrink-0 bg-code-orange text-faded-silver px-5 py-2.5 text-body-sm rounded hover:bg-code-orange/90 transition-colors whitespace-nowrap"
          >
            Start Contributing →
          </Link>
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT — 2/3 */}
          <div className="lg:col-span-2 space-y-5">

            {/* Charts row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Pie chart */}
              <div className="card">
                <h2 className="text-body text-factory-black mb-4">Contributions by Category</h2>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie
                        data={PIE_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={32}
                        outerRadius={55}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {PIE_DATA.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {PIE_DATA.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-caption text-graphite truncate">{d.name}</span>
                        <span className="text-caption font-mono text-ash-gray ml-auto">{d.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Heatmap */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-body text-factory-black">Contribution Activity</h2>
                  <span className="text-caption text-ash-gray font-mono">{myContributions} total</span>
                </div>
                <div className="overflow-x-auto">
                  <div className="flex gap-0.5">
                    {heatmap.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-0.5">
                        {week.map((intensity, di) => (
                          <HeatmapCell key={di} intensity={intensity} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <span className="text-caption text-ash-gray">Less</span>
                  {HEAT_COLORS.map((c, i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: c }} />
                  ))}
                  <span className="text-caption text-ash-gray">More</span>
                </div>
              </div>
            </div>

            {/* Data cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card text-center py-4">
                <p className="text-heading font-mono font-normal text-factory-black">{projects.length}</p>
                <p className="text-caption text-ash-gray mt-1">Projects contributed</p>
              </div>
              <div className="card text-center py-4">
                <p className="text-heading font-mono font-normal text-code-orange">{statsPushed}</p>
                <p className="text-caption text-ash-gray mt-1">Repos pushed</p>
              </div>
              <div className="card text-center py-4">
                <p className="text-heading font-mono font-normal text-factory-black">{statsMerged}</p>
                <p className="text-caption text-ash-gray mt-1">PRs merged</p>
              </div>
            </div>

            {/* Badges */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-body text-factory-black">Skills & Badges</h2>
                <span className="text-caption text-ash-gray font-mono">{earnedCount} / {badges.length} earned</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {badges.map((badge) => (
                  <BadgeCard key={badge.id} badge={badge} size="sm" />
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — 1/3 */}
          <div className="space-y-5">
            <div className="card">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-body text-factory-black">Weekly Missions</h2>
                <span className="text-caption border border-code-orange/40 text-code-orange rounded px-2 py-0.5 font-mono">
                  Week {Math.ceil(new Date().getDate() / 7)}
                </span>
              </div>
              <p className="text-caption text-ash-gray mb-4">Complete missions to earn badges and level up.</p>
              <div className="space-y-3">
                {WEEKLY_MISSIONS.map((mission) => (
                  <MissionRow
                    key={mission.id}
                    mission={mission}
                    progress={missionProgress[mission.metric]}
                    target={mission.target}
                  />
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-cool-gray/30">
                <p className="text-caption text-ash-gray text-center">
                  Missions reset every Monday
                </p>
              </div>
            </div>

            {/* Quick links */}
            <div className="card">
              <h2 className="text-body text-factory-black mb-3">Quick actions</h2>
              <div className="space-y-2">
                <Link to="/dashboard/marketplace" className="block btn-outline w-full text-center py-2 text-body-sm">Browse projects</Link>
                <Link to="/dashboard/agents" className="block btn-outline w-full text-center py-2 text-body-sm">Manage agents</Link>
                <Link to="/dashboard/contributions" className="block btn-outline w-full text-center py-2 text-body-sm">View leaderboard</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
