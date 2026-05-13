import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { getDashboard, getAchievements } from '../../api/achievements'
import { getLevel } from '../../config/badges'

const MEDALS = ['🥇', '🥈', '🥉']

function extractRepo(url) {
  if (url && !url.includes('github.com/') && url.includes('/')) return url
  const m = url && url.match(/github\.com\/(.+)/)
  return m ? m[1].replace(/\/$/, '') : url
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const WINDOW_LABELS = { monthly: 'This month', weekly: 'This week', daily: 'Today' }

function XpBar({ progressPct }) {
  return (
    <div className="w-full h-1.5 bg-factory-light-gray rounded-full overflow-hidden border border-cool-gray/30">
      <div
        className="h-full bg-code-orange rounded-full transition-all duration-500"
        style={{ width: `${progressPct}%` }}
      />
    </div>
  )
}

function PodiumBlock({ user: u, rank, currentUsername }) {
  if (!u) return <div className="flex-1" />
  const isMe = u.username === currentUsername
  return (
    <div className={`flex-1 flex flex-col items-center ${rank === 1 ? 'pt-0' : 'pt-6'}`}>
      <div className={`w-full bg-factory-light-gray border border-cool-gray/40 rounded-t px-2 py-3 flex flex-col items-center gap-1
        ${rank === 1 ? 'ring-2 ring-code-orange/30' : ''}`}>
        <span className="text-lg">{MEDALS[rank - 1]}</span>
        <p className="text-caption text-factory-black text-center truncate w-full">{u.name || u.username}</p>
        {isMe && <span className="text-[10px] border border-cool-gray/40 rounded px-1 text-ash-gray">you</span>}
        <p className="font-mono text-caption text-ash-gray">{u.contributions}</p>
      </div>
    </div>
  )
}

export default function Contributions() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [plansLoading, setPlansLoading] = useState(true)
  const [window, setWindow] = useState('monthly')
  const [planTab, setPlanTab] = useState('plan')

  useEffect(() => {
    getDashboard(50)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))

    getAchievements()
      .then((r) => setPlans(r.data.achievements || []))
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false))
  }, [])

  const windowData = data?.windows?.[window]
  const topRepos = windowData?.top_repositories || []
  const topUsers = windowData?.top_users || []
  const myRankIndex = topUsers.findIndex((u) => u.username === user?.username)
  const myEntry = myRankIndex >= 0 ? topUsers[myRankIndex] : null

  const activePlans = plans.filter((p) => p.name === 'Contribution Plan Started')
  const history = plans.filter((p) => p.name !== 'Contribution Plan Started')
  const visiblePlans = planTab === 'plan' ? activePlans : history

  const { current: level, next: nextLevel, progressPct } = getLevel(myEntry?.contributions ?? 0)
  const windowLabel = WINDOW_LABELS[window].toLowerCase()

  const podiumUsers = [topUsers[1], topUsers[0], topUsers[2]]
  const tableUsers = topUsers.slice(3)

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-heading font-normal text-factory-black">Contributions</h1>
            <p className="text-body-sm text-graphite mt-1">Your contribution plans and community leaderboard.</p>
          </div>
          <Link to="/dashboard/marketplace" state={{ openFlow: true }}
            className="bg-factory-black text-faded-silver px-4 py-2 text-body-sm rounded hover:bg-factory-black/80 transition-colors">
            New Plan
          </Link>
        </div>

        {/* Rank hero */}
        {myEntry && (
          <div className="card mb-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{myRankIndex === 0 ? '🥇' : level.icon}</span>
              <div>
                <p className="text-heading font-normal text-factory-black">
                  {myRankIndex === 0 ? "You're leading the community!" : `You're ranked #${myRankIndex + 1}`}
                </p>
                <p className="text-body-sm text-graphite">
                  {level.name} · {myEntry.contributions} contribution{myEntry.contributions !== 1 ? 's' : ''} {windowLabel}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <XpBar progressPct={progressPct} />
              <p className="text-caption text-ash-gray">
                {nextLevel ? `${myEntry.contributions} / ${nextLevel.min} contributions to ${nextLevel.name}` : 'Maximum level reached'}
              </p>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* LEFT — Contribution plan list */}
          <div className="lg:col-span-2">
            <div className="border border-cool-gray/40 rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-cool-gray/40 bg-faded-silver flex items-center justify-between">
                <div className="flex gap-1">
                  {[['plan', 'Plans', activePlans.length], ['history', 'History', history.length]].map(([tab, label, count]) => (
                    <button
                      key={tab}
                      onClick={() => setPlanTab(tab)}
                      className={`px-3 py-1 text-body-sm rounded transition-colors ${
                        planTab === tab
                          ? 'bg-factory-black text-faded-silver'
                          : 'text-ash-gray hover:text-factory-black'
                      }`}
                    >
                      {label}
                      <span className={`ml-1.5 text-caption font-mono ${planTab === tab ? 'text-faded-silver/70' : 'text-cool-gray'}`}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {plansLoading ? (
                <div className="bg-faded-silver p-4 space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-14 bg-factory-light-gray rounded animate-pulse" />)}
                </div>
              ) : visiblePlans.length === 0 ? (
                <div className="bg-faded-silver px-4 py-14 text-center">
                  {planTab === 'plan' ? (
                    <>
                      <p className="text-body-sm text-factory-black mb-1">No active plans.</p>
                      <p className="text-caption text-ash-gray mb-4">Start a contribution plan to see it here.</p>
                      <Link to="/dashboard/marketplace" state={{ openFlow: true }}
                        className="inline-block bg-factory-black text-faded-silver px-4 py-2 text-body-sm rounded hover:bg-factory-black/80 transition-colors">
                        Start a Plan
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-body-sm text-factory-black mb-1">No completed contributions yet.</p>
                      <p className="text-caption text-ash-gray">Completed contributions from your agents will appear here.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-faded-silver divide-y divide-cool-gray/30">
                  {visiblePlans.map((plan) => (
                    <div key={plan.id} className="flex items-start gap-3 px-4 py-3 hover:bg-factory-light-gray/50 transition-colors">
                      <div className="w-7 h-7 rounded-full bg-factory-light-gray border border-cool-gray/40 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-sm">🍅</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm text-factory-black">{plan.name}</p>
                        {plan.description && (
                          <p className="text-caption text-ash-gray line-clamp-1 mt-0.5">{plan.description}</p>
                        )}
                        {plan.url && (
                          <a href={plan.url} target="_blank" rel="noreferrer"
                            className="text-caption text-code-orange hover:underline font-mono mt-0.5 block truncate">
                            {extractRepo(plan.url) || plan.url}
                          </a>
                        )}
                        {!plan.url && plan.github_repo && (
                          <a href={`https://github.com/${plan.github_repo}`} target="_blank" rel="noreferrer"
                            className="text-caption text-code-orange hover:underline font-mono mt-0.5 block truncate">
                            {plan.github_repo}
                          </a>
                        )}
                      </div>
                      <span className="text-caption text-ash-gray shrink-0">{timeAgo(plan.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Leaderboard */}
          <div className="space-y-4">

            {/* Top Contributors */}
            <div className="border border-cool-gray/40 rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-cool-gray/40 bg-faded-silver">
                <p className="text-body-sm text-factory-black">Top Contributors</p>
              </div>
              {loading ? (
                <div className="bg-faded-silver p-4 space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-8 bg-factory-light-gray rounded animate-pulse" />)}
                </div>
              ) : topUsers.length === 0 ? (
                <div className="bg-faded-silver px-4 py-8 text-center">
                  <p className="text-body-sm text-ash-gray">No contributors yet.</p>
                </div>
              ) : (
                <div className="bg-faded-silver">
                  {topUsers.length >= 1 && (
                    <div className="flex items-end gap-1 px-3 pt-3 pb-0">
                      <PodiumBlock user={podiumUsers[0]} rank={2} currentUsername={user?.username} />
                      <PodiumBlock user={podiumUsers[1]} rank={1} currentUsername={user?.username} />
                      <PodiumBlock user={podiumUsers[2]} rank={3} currentUsername={user?.username} />
                    </div>
                  )}
                  {tableUsers.length > 0 && (
                    <table className="w-full">
                      <tbody className="divide-y divide-cool-gray/30">
                        {tableUsers.map((u, i) => (
                          <tr key={u.user_id}
                            className={`transition-colors ${u.username === user?.username ? 'bg-factory-light-gray' : 'hover:bg-factory-light-gray/50'}`}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-caption text-ash-gray font-mono w-5 text-right shrink-0">#{i + 4}</span>
                                <span className="text-body-sm text-factory-black truncate">{u.name || u.username}</span>
                                {u.username === user?.username && (
                                  <span className="text-caption border border-cool-gray/40 rounded px-1.5 py-0.5 text-ash-gray shrink-0">you</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-body-sm font-mono text-factory-black text-right">{u.contributions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Top Projects */}
            <div className="border border-cool-gray/40 rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-cool-gray/40 bg-faded-silver">
                <p className="text-body-sm text-factory-black">Top Projects</p>
              </div>
              {loading ? (
                <div className="bg-faded-silver p-4 space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-8 bg-factory-light-gray rounded animate-pulse" />)}
                </div>
              ) : topRepos.length === 0 ? (
                <div className="bg-faded-silver px-4 py-8 text-center">
                  <p className="text-body-sm text-ash-gray">No contributions recorded yet.</p>
                </div>
              ) : (
                <table className="w-full bg-faded-silver">
                  <tbody className="divide-y divide-cool-gray/30">
                    {topRepos.map((repo, i) => (
                      <tr key={repo.github_repo} className="hover:bg-factory-light-gray/50 transition-colors">
                        <td className="px-3 py-2 text-center w-7">
                          {i < 3
                            ? <span className="text-sm">{MEDALS[i]}</span>
                            : <span className="text-caption text-ash-gray font-mono">#{i+1}</span>}
                        </td>
                        <td className="px-2 py-2 text-caption font-mono text-factory-black truncate max-w-[120px]">
                          {repo.github_repo || extractRepo(repo.github_repo_url)}
                        </td>
                        <td className="px-3 py-2 text-caption font-mono text-factory-black text-right">{repo.contributions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
