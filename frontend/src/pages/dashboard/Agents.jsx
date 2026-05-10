import { useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'

const MOCK_AGENTS = [
  { id: 1, name: 'coding-agent-prod', endpoint: 'https://agent.example.com', status: 'active', tokensUsed: 61200, tokensMax: 100000, projects: 3, lastSeen: '2 min ago' },
  { id: 2, name: 'research-agent',    endpoint: 'https://research.example.com', status: 'idle', tokensUsed: 8400, tokensMax: 50000, projects: 1, lastSeen: '1h ago' },
]

function StatusBadge({ status }) {
  const cls = status === 'active'
    ? 'bg-factory-black text-faded-silver'
    : 'bg-factory-light-gray text-ash-gray border border-cool-gray/40'
  return <span className={`inline-block rounded px-2.5 py-0.5 text-caption font-mono ${cls}`}>{status}</span>
}

function UsageBar({ used, max }) {
  const pct = Math.min(100, Math.round((used / max) * 100))
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-caption text-ash-gray font-mono">{used.toLocaleString()} / {max.toLocaleString()}</span>
        <span className="text-caption text-factory-black font-mono">{pct}%</span>
      </div>
      <div className="h-px bg-cool-gray/40 overflow-hidden">
        <div className="h-full bg-factory-black transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Agents() {
  const [agents, setAgents] = useState(MOCK_AGENTS)
  const [showAdd, setShowAdd] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: '', endpoint: '', apiKey: '' })
  const [selectedAgent, setSelectedAgent] = useState(null)

  const addAgent = () => {
    if (!newAgent.name || !newAgent.endpoint) return
    setAgents((prev) => [...prev, { id: Date.now(), name: newAgent.name, endpoint: newAgent.endpoint, status: 'idle', tokensUsed: 0, tokensMax: 100000, projects: 0, lastSeen: 'Just added' }])
    setNewAgent({ name: '', endpoint: '', apiKey: '' })
    setShowAdd(false)
  }

  const removeAgent = (id) => {
    setAgents((prev) => prev.filter((a) => a.id !== id))
    if (selectedAgent?.id === id) setSelectedAgent(null)
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-heading font-normal text-factory-black">My Agents</h1>
            <p className="text-body-sm text-graphite mt-1">Manage your registered agent servers.</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add agent</button>
        </div>

        {showAdd && (
          <div className="card mb-6">
            <h3 className="text-body text-factory-black mb-4">Add new agent</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Agent name</label>
                <input type="text" className="input" placeholder="my-agent"
                  value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Server endpoint</label>
                <input type="url" className="input" placeholder="https://agent.example.com"
                  value={newAgent.endpoint} onChange={(e) => setNewAgent({ ...newAgent, endpoint: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">API key <span className="text-ash-gray">(optional)</span></label>
                <input type="password" className="input" placeholder="sk-…"
                  value={newAgent.apiKey} onChange={(e) => setNewAgent({ ...newAgent, apiKey: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={addAgent} className="btn-primary">Add agent</button>
              <button onClick={() => setShowAdd(false)} className="btn-outline">Cancel</button>
            </div>
          </div>
        )}

        {agents.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-body text-factory-black mb-2">No agents yet</p>
            <p className="text-body-sm text-ash-gray mb-6">Add your first agent server to start donating tokens.</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary">Add agent</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-3">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`w-full text-left card transition-colors hover:border-graphite ${
                    selectedAgent?.id === agent.id ? 'border-factory-black' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-body-sm text-factory-black font-mono">{agent.name}</p>
                    <StatusBadge status={agent.status} />
                  </div>
                  <p className="text-caption text-ash-gray mb-3 truncate">{agent.endpoint}</p>
                  <UsageBar used={agent.tokensUsed} max={agent.tokensMax} />
                </button>
              ))}
            </div>

            {selectedAgent ? (
              <div className="lg:col-span-2 card">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-body text-factory-black font-mono">{selectedAgent.name}</h2>
                    <a href={selectedAgent.endpoint} target="_blank" rel="noopener noreferrer"
                      className="text-caption text-ash-gray hover:text-factory-black transition-colors">{selectedAgent.endpoint}</a>
                  </div>
                  <button onClick={() => removeAgent(selectedAgent.id)} className="text-caption text-ash-gray hover:text-red-500 transition-colors">remove</button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: 'Status',    value: selectedAgent.status },
                    { label: 'Projects',  value: selectedAgent.projects },
                    { label: 'Last seen', value: selectedAgent.lastSeen },
                  ].map((s) => (
                    <div key={s.label} className="bg-factory-light-gray rounded p-3 text-center">
                      <p className="text-caption text-ash-gray">{s.label}</p>
                      <p className="text-body-sm text-factory-black mt-1 font-mono">{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mb-6">
                  <p className="text-body-sm text-factory-black mb-2">Token usage</p>
                  <UsageBar used={selectedAgent.tokensUsed} max={selectedAgent.tokensMax} />
                </div>

                <div>
                  <p className="text-body-sm text-factory-black mb-3">Activity log</p>
                  <div className="space-y-0">
                    {[
                      { event: 'Donated 2,400 tokens → react/react', time: '2h ago' },
                      { event: 'Connected and verified',             time: '3h ago' },
                      { event: 'Idle threshold crossed (12%)',       time: '4h ago' },
                    ].map((log, i) => (
                      <div key={i} className="flex justify-between py-2.5 border-b border-cool-gray/30 last:border-0 text-body-sm">
                        <span className="text-graphite">{log.event}</span>
                        <span className="text-ash-gray font-mono">{log.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-2 card flex items-center justify-center text-ash-gray text-body-sm">
                Select an agent to view details
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
