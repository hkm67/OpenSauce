import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { getDashboard } from '../../api/achievements'

function extractRepo(url) {
  const m = url.match(/github\.com\/(.+)/)
  return m ? m[1].replace(/\/$/, '') : url
}

const WINDOWS = ['monthly', 'weekly', 'daily']
const WINDOW_LABELS = { monthly: 'This month', weekly: 'This week', daily: 'Today' }

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
  const myEntry = topUsers.find((u) => u.username === user?.username)

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

        {/* My stats */}
        {myEntry && (
          <div className="card mb-6 flex items-center gap-6">
            <div>
              <p className="text-caption text-ash-gray mb-0.5">Your contributions</p>
              <p className="text-heading font-mono font-normal text-factory-black">{myEntry.contributions}</p>
            </div>
            <div className="h-8 w-px bg-cool-gray/40" />
            <div>
              <p className="text-caption text-ash-gray mb-0.5">Rank</p>
              <p className="text-heading font-mono font-normal text-factory-black">
                #{topUsers.findIndex((u) => u.username === user?.username) + 1}
              </p>
            </div>
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
                      <th className="px-4 py-2.5 text-caption text-ash-gray font-normal text-left">Project</th>
                      <th className="px-4 py-2.5 text-caption text-ash-gray font-normal text-right">Contributions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cool-gray/30">
                    {topRepos.map((repo) => (
                      <tr key={repo.project_id} className="hover:bg-factory-light-gray/50 transition-colors">
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
                <table className="w-full bg-faded-silver">
                  <thead>
                    <tr className="border-b border-cool-gray/40 bg-factory-light-gray">
                      <th className="px-4 py-2.5 text-caption text-ash-gray font-normal text-left">User</th>
                      <th className="px-4 py-2.5 text-caption text-ash-gray font-normal text-right">Contributions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cool-gray/30">
                    {topUsers.map((u, i) => (
                      <tr key={u.user_id}
                        className={`transition-colors ${u.username === user?.username ? 'bg-factory-light-gray' : 'hover:bg-factory-light-gray/50'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-caption text-ash-gray font-mono w-5 text-right shrink-0">#{i + 1}</span>
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
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
