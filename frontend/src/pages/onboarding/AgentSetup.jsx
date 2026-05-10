import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const STEPS = ['1 Agent setup', '2 Preferences', '3 Done']

export default function AgentSetup() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState([{ name: '', endpoint: '', apiKey: '' }])
  const [error, setError] = useState('')

  const updateAgent = (i, k, v) => setAgents((p) => p.map((a, idx) => idx === i ? { ...a, [k]: v } : a))
  const addAgent = () => setAgents((p) => [...p, { name: '', endpoint: '', apiKey: '' }])
  const removeAgent = (i) => setAgents((p) => p.filter((_, idx) => idx !== i))

  const handleNext = (e) => {
    e.preventDefault()
    if (!agents.every((a) => a.name.trim() && a.endpoint.trim())) {
      setError('Fill in name and endpoint for each agent.')
      return
    }
    localStorage.setItem('onboarding_agents', JSON.stringify(agents))
    navigate('/onboarding/donation')
  }

  return (
    <div className="min-h-screen bg-factory-light-gray flex flex-col">
      <div className="h-12 flex items-center px-6 border-b border-cool-gray/40">
        <Link to="/" className="text-body text-factory-black flex items-center gap-1.5 mr-8">
          <span>🍅</span><span>OpenSauce</span>
        </Link>
        <div className="flex items-center gap-6 ml-auto">
          {STEPS.map((s, i) => (
            <span key={s} className={`font-mono text-caption ${i === 0 ? 'text-factory-black' : 'text-ash-gray'}`}>{s}</span>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          <h1 className="text-heading font-normal text-factory-black mb-1">Connect your agents</h1>
          <p className="text-body-sm text-graphite mb-8">
            Register the AI agent servers whose surplus tokens you want to donate.
          </p>

          <form onSubmit={handleNext} className="space-y-4">
            {error && <p className="text-body-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">{error}</p>}

            {agents.map((agent, i) => (
              <div key={i} className="card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-caption text-ash-gray">agent_{String(i + 1).padStart(2, '0')}</span>
                  {agents.length > 1 && (
                    <button type="button" onClick={() => removeAgent(i)} className="text-caption text-ash-gray hover:text-factory-black transition-colors">remove</button>
                  )}
                </div>
                <div>
                  <label className="label">Name</label>
                  <input type="text" className="input" placeholder="my-coding-agent"
                    value={agent.name} onChange={(e) => updateAgent(i, 'name', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Endpoint</label>
                  <input type="url" className="input" placeholder="https://agent.example.com"
                    value={agent.endpoint} onChange={(e) => updateAgent(i, 'endpoint', e.target.value)} required />
                </div>
                <div>
                  <label className="label">API key <span className="text-ash-gray">(optional)</span></label>
                  <input type="password" className="input" placeholder="sk-…"
                    value={agent.apiKey} onChange={(e) => updateAgent(i, 'apiKey', e.target.value)} />
                </div>
              </div>
            ))}

            <button type="button" onClick={addAgent} className="btn-outline w-full justify-center py-2 text-body-sm">
              + Add another agent
            </button>

            <div className="flex items-center justify-between pt-2">
              <Link to="/dashboard" className="btn-ghost text-body-sm">Skip for now</Link>
              <button type="submit" className="btn-primary px-5">Continue →</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
