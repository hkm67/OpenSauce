import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import DashboardLayout from '../../components/DashboardLayout'
import PixelCanvas from '../../components/PixelCanvas'
import BadgeCard from '../../components/BadgeCard'
import BadgeTiltCard from '../../components/BadgeTiltCard'
import SparklesButton from '../../components/SparklesButton'
import { useAuth } from '../../contexts/AuthContext'
import { getDashboard, getAchievements } from '../../api/achievements'
import { MOCK_ACHIEVEMENTS, MOCK_DASHBOARD } from '../../api/mock'
import { getBadges } from '../../config/badges'
import { categorizeProject, CATEGORY_COLORS } from '../../utils/category'

const HEAT_COLORS = ['#eeeeee', '#fcd5b8', '#f9a96c', '#f37c2a', '#ef6f2e']
const HEATMAP_WEEKS = 26
const HEATMAP_DAYS = 7

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function buildHeatmap(achievements) {
  const today = startOfDay(new Date())
  const start = new Date(today)
  start.setDate(today.getDate() - (HEATMAP_WEEKS * HEATMAP_DAYS - 1))
  start.setDate(start.getDate() - start.getDay())

  const counts = new Map()
  for (const a of achievements) {
    if (!a.created_at) continue
    const d = startOfDay(a.created_at)
    if (Number.isNaN(d.getTime())) continue
    const key = d.toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  const grid = []
  let max = 0
  counts.forEach((v) => { if (v > max) max = v })

  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const week = []
    for (let d = 0; d < HEATMAP_DAYS; d++) {
      const cell = new Date(start)
      cell.setDate(start.getDate() + w * HEATMAP_DAYS + d)
      const key = cell.toISOString().slice(0, 10)
      const count = counts.get(key) || 0
      const intensity = max === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4))
      week.push(intensity)
    }
    grid.push(week)
  }
  return grid
}

function HeatmapCell({ intensity }) {
  return (
    <div
      className="w-full aspect-square rounded-[2px]"
      style={{ backgroundColor: HEAT_COLORS[intensity] }}
    />
  )
}

const WEEKLY_MISSIONS = [
  { id: 1, title: 'Make 5 contributions',     badge: '🔥', target: 5,  metric: 'contributions' },
  { id: 2, title: 'Contribute to 3 projects', badge: '🔧', target: 3,  metric: 'projects' },
  { id: 3, title: 'Reach Builder level',      badge: '⚡', target: 5,  metric: 'level' },
  { id: 4, title: 'Earn 3 badges',            badge: '🏅', target: 3,  metric: 'badges' },
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
  const [achievements, setAchievements] = useState([])
  const [myContributions, setMyContributions] = useState(0)

  useEffect(() => {
    getAchievements({ limit: 100, sort: 'recent' })
      .then((r) => setAchievements(r.data.achievements || []))
      .catch(() => setAchievements(MOCK_ACHIEVEMENTS))
    getDashboard(50)
      .then((r) => {
        const entry = r.data.windows.monthly.top_users.find(
          (u) => u.username === user?.username
        )
        setMyContributions(entry?.contributions ?? 0)
      })
      .catch(() => {
        const entry = MOCK_DASHBOARD.windows.monthly.top_users.find(
          (u) => u.username === user?.username
        )
        setMyContributions(entry?.contributions ?? MOCK_DASHBOARD.windows.monthly.top_users[0].contributions)
      })
  }, [user?.username])

  const myAchievementsCount = achievements.length
  const totalContributions = Math.max(myContributions, myAchievementsCount)

  const projectsContributedTo = useMemo(() => {
    const repos = new Set(achievements.map((a) => a.github_repo).filter(Boolean))
    return repos.size
  }, [achievements])

  const issuesCompleted = useMemo(
    () => achievements.filter((a) => a.issue_url).length,
    [achievements]
  )

  const pieData = useMemo(() => {
    if (achievements.length === 0) return []
    const counts = new Map()
    for (const a of achievements) {
      const cat = categorizeProject({
        url: a.github_repo_url || '',
        github_repo: a.github_repo || '',
        description: a.description || '',
      })
      counts.set(cat, (counts.get(cat) || 0) + 1)
    }
    const total = achievements.length
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        value: Math.round((count / total) * 100),
        color: CATEGORY_COLORS[name] || CATEGORY_COLORS.Other,
      }))
      .sort((a, b) => b.value - a.value)
  }, [achievements])

  const heatmap = useMemo(() => buildHeatmap(achievements), [achievements])

  const badges = getBadges(totalContributions)
  const earnedCount = badges.filter((b) => b.earned).length
  const [selectedBadge, setSelectedBadge] = useState(null)

  const missionProgress = {
    contributions: totalContributions,
    projects: projectsContributedTo,
    level: totalContributions,
    badges: earnedCount,
  }

  return (
    <>
    <DashboardLayout>
      <div className="p-4 sm:p-8 space-y-6">

        {/* Promotion Banner */}
        <div className="relative overflow-hidden rounded-lg bg-factory-black px-5 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <PixelCanvas
            colors={['#FF6347', '#ff8c69', '#ffffff']}
            gap={16}
            speed={30}
            autoPlay={false}
          />
          <div className="relative">
            <p className="text-caption text-cool-gray mb-1 font-mono uppercase tracking-widest">OpenSauce Platform</p>
            <h1 className="text-heading font-normal text-faded-silver mb-1">
              Your AI agents are contributing to open source
            </h1>
            <p className="text-body-sm text-ash-gray">Join thousands of contributors making OSS better, automatically.</p>
          </div>
          <SparklesButton className="relative shrink-0" colors={['#ffffff', '#fef08a', '#fdba74', '#c4b5fd', '#86efac']}>
            <Link
              to="/dashboard/marketplace"
              state={{ openFlow: true }}
              className="relative block bg-code-orange text-faded-silver px-5 py-2.5 text-body-sm rounded hover:bg-code-orange/90 transition-colors whitespace-nowrap"
            >
              Start Contribution
            </Link>
          </SparklesButton>
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
                {pieData.length === 0 ? (
                  <p className="text-caption text-ash-gray py-8 text-center">
                    No contributions yet. Start one to see your category mix.
                  </p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={32}
                          outerRadius={55}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {pieData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-caption text-graphite truncate">{d.name}</span>
                          <span className="text-caption font-mono text-ash-gray ml-auto">{d.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Heatmap */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-body text-factory-black">Contribution Activity</h2>
                  <span className="text-caption text-ash-gray font-mono">{totalContributions} total</span>
                </div>
                <div className="flex gap-0.5 w-full">
                  {heatmap.map((week, wi) => (
                    <div key={wi} className="flex-1 flex flex-col gap-0.5 min-w-0">
                      {week.map((intensity, di) => (
                        <HeatmapCell key={di} intensity={intensity} />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <span className="text-caption text-ash-gray">Less</span>
                  {HEAT_COLORS.map((c, i) => (
                    <div key={i} className="w-2.5 h-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: c }} />
                  ))}
                  <span className="text-caption text-ash-gray">More</span>
                </div>
              </div>
            </div>

            {/* Data cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card text-center py-4">
                <p className="text-heading font-mono font-normal text-factory-black">{projectsContributedTo}</p>
                <p className="text-caption text-ash-gray mt-1">Projects contributed</p>
              </div>
              <div className="card text-center py-4">
                <p className="text-heading font-mono font-normal text-code-orange">{totalContributions}</p>
                <p className="text-caption text-ash-gray mt-1">Total contributions</p>
              </div>
              <div className="card text-center py-4">
                <p className="text-heading font-mono font-normal text-factory-black">{issuesCompleted}</p>
                <p className="text-caption text-ash-gray mt-1">Issues addressed</p>
              </div>
            </div>

            {/* Badges */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-body text-factory-black">Badges</h2>
                <span className="text-caption text-ash-gray font-mono">{earnedCount} / {badges.length} earned</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {badges.map((badge) => (
                  <BadgeCard key={badge.id} badge={badge} size="sm" onClick={() => setSelectedBadge(badge)} />
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
          </div>
        </div>
      </div>
    </DashboardLayout>
    {selectedBadge && (
      <BadgeTiltCard badge={selectedBadge} contributions={totalContributions} onClose={() => setSelectedBadge(null)} />
    )}
    </>
  )
}
