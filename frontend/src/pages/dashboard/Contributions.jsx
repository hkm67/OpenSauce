import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { getDashboard } from '../../api/achievements'
import { getLevel } from '../../config/badges'

const MEDALS = ['🥇', '🥈', '🥉']

function extractRepo(url) {
  const m = url.match(/github\.com\/(.+)/)
  return m ? m[1].replace(/\/$/, '') : url
}

const WINDOWS = ['monthly', 'weekly', 'daily']
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
  const heightClass = rank === 1 ? 'pt-4' : 'pt-8'
  const ringClass = rank === 1 ? 'ring-2 ring-code-orange/30' : ''
  return (
    <div className={`flex-1 flex flex-col items-center ${heightClass}`}>
      <div className={`w-full bg-factory-light-gray border border-cool-gray/40 rounded-t px-3 py-3 flex flex-col items-center gap-1 ${ringClass}`}>
        <span className="text-xl">{MEDALS[rank - 1]}</span>
        <p className="text-body-sm text-factory-black text-center truncate w-full text-center">
          {u.name || u.username}
        </p>
        {isMe && (
          <span className="text-caption border border-cool-gray/40 rounded px-1.5 py-0.5 text-ash-gray">you</span>
        )}
        <p className="font-mono text-caption text-ash-gray">{u.contributions}</p>
      </div>
    </div>
  )
}

export default function Contributions() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [window, setWindow] = useState('monthly')

  useEffect(() => {
    getDashboard(50)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const windowData = data?.windows?.[window]
  const topRepos = windowData?.top_repositories || []
  const topUsers = windowData?.top_users || []
  const myRankIndex = topUsers.findIndex((u) => u.username === user?.username)
  const myEntry = myRankIndex >= 0 ? topUsers[myRankIndex] : null

  const { current: level, next: nextLevel, progressPct } = getLevel(myEntry?.contributions ?? 0)
  const windowLabel = WINDOW_LABELS[window].toLowerCase()

  const podiumUsers = [topUsers[1], topUsers[0], topUsers[2]]
  const tableUsers = topUsers.slice(3)

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-heading font-normal text-factory-black">My Contributions</h1>
            <p className="text-body-sm text-graphite mt-1">Community contribution activity powered by AI agents.</p>
          </div>
          <Link to="/dashboard/marketplace"
            className="bg-factory-black text-faded-silver px-4 py-2 text-body-sm rounded hover:bg-factory-black/80 transition-colors">
            New Plan
          </Link>
        </div>

        {/* Rank hero */}
        {myEntry ? (
          <div className="card mb-6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{myRankIndex === 0 ? '🥇' : level.icon}</span>
              <div>
                <p className="text-heading font-normal text-factory-black">
                  {myRankIndex === 0
                    ? "You're leading the community!"
                    : `You're ranked #${myRankIndex + 1}`}
                </p>
                <p className="text-body-sm text-graphite">
                  {level.name} · {myEntry.contributions} contribution{myEntry.contributions !== 1 ? 's' : ''} {windowLabel}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <XpBar progressPct={progressPct} />
              <p className="text-caption text-ash-gray">
                {nextLevel
                  ? `${myEntry.contributions} / ${nextLevel.min} contributions to ${nextLevel.name}`
                  : 'Maximum level reached'}
              </p>
            </div>
          </div>
        ) : !loading && (
          <div className="card mb-6 text-center py-8">
            <p className="text-body-sm text-factory-black mb-1">No contributions {windowLabel}.</p>
            <p className="text-caption text-ash-gray mb-4">Your agents are ready — start a new plan to contribute.</p>
            <Link to="/dashboard/marketplace"
              className="inline-block bg-factory-black text-faded-silver px-4 py-2 text-body-sm rounded hover:bg-factory-black/80 transition-colors">
              New Plan
            </Link>
          </div>
        )}

        {/* Window tabs */}
        <div className="flex gap-1 border-b border-cool-gray/30 mb-6">
          {WINDOWS.map((w) => (
            <button key={w} onClick={() => setWindow(w)}
              className={`pb-3 px-1 mr-5 text-body-sm border-b-2 transition-colors ${
                window === w ? 'border-factory-black text-factory-black' : 'border-transparent text-ash-gray hover:text-factory-black'
              }`}>
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map((i) => <div key={i} className="card animate-pulse h-40" />)}
          </div>
        ) : !data ? (
          <div className="card text-center py-16">
            <p className="text-body-sm text-factory-black mb-1">Could not load contribution data.</p>
            <p className="text-caption text-ash-gray">Make sure the backend is running.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Projects */}
            <div className="border border-cool-gray/40 rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-cool-gray/40 bg-faded-silver">
                <p className="text-body-sm text-factory-black">Top Projects</p>
              </div>
              {topRepos.length === 0 ? (
                <div className="px-4 py-10 text-center bg-faded-silver">
                  <p className="text-body-sm text-ash-gray">No contributions recorded yet.</p>
                </div>
              ) : (
                <table className="w-full bg-faded-silver">
                  <thead>
                    <tr className="border-b border-cool-gray/40 bg-factory-light-gray">
                      <th className="px-2 py-2.5 text-caption text-ash-gray font-normal text-center w-8">#</th>
                      <th className="px-4 py-2.5 text-caption text-ash-gray font-normal text-left">Project</th>
                      <th className="px-4 py-2.5 text-caption text-ash-gray font-normal text-right">Contributions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cool-gray/30">
                    {topRepos.map((repo, i) => (
                      <tr key={repo.project_id} className="hover:bg-factory-light-gray/50 transition-colors">
                        <td className="px-2 py-3 text-center">
                          {i < 3
                            ? <span className="text-base">{MEDALS[i]}</span>
                            : <span className="text-caption text-ash-gray font-mono">#{i + 1}</span>}
                        </td>
                        <td className="px-4 py-3 text-body-sm font-mono text-factory-black">
                          {extractRepo(repo.project_url)}
                        </td>
                        <td className="px-4 py-3 text-body-sm font-mono text-factory-black text-right">
                          {repo.contributions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top Contributors */}
            <div className="border border-cool-gray/40 rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-cool-gray/40 bg-faded-silver">
                <p className="text-body-sm text-factory-black">Top Contributors</p>
              </div>
              {topUsers.length === 0 ? (
                <div className="px-4 py-10 text-center bg-faded-silver">
                  <p className="text-body-sm text-ash-gray">No contributors yet.</p>
                </div>
              ) : (
                <div className="bg-faded-silver">
                  {/* Podium */}
                  {topUsers.length >= 1 && (
                    <div className="flex items-end gap-1 px-4 pt-4 pb-0">
                      <PodiumBlock user={podiumUsers[0]} rank={2} currentUsername={user?.username} />
                      <PodiumBlock user={podiumUsers[1]} rank={1} currentUsername={user?.username} />
                      <PodiumBlock user={podiumUsers[2]} rank={3} currentUsername={user?.username} />
                    </div>
                  )}

                  {/* Remaining rows (4+) */}
                  {tableUsers.length > 0 && (
                    <table className="w-full">
                      <tbody className="divide-y divide-cool-gray/30">
                        {tableUsers.map((u, i) => (
                          <tr key={u.user_id}
                            className={`transition-colors ${u.username === user?.username ? 'bg-factory-light-gray' : 'hover:bg-factory-light-gray/50'}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-caption text-ash-gray font-mono w-5 text-right shrink-0">#{i + 4}</span>
                                <span className="text-body-sm text-factory-black">{u.name || u.username}</span>
                                {u.username === user?.username && (
                                  <span className="text-caption border border-cool-gray/40 rounded px-1.5 py-0.5 text-ash-gray">you</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-body-sm font-mono text-factory-black text-right">
                              {u.contributions}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
