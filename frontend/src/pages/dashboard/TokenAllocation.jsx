import { useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'

const RULES = [
  { id: 1, condition: 'If idle > 10%', action: 'Donate to react/react',     priority: 'High',   active: true },
  { id: 2, condition: 'If idle > 20%', action: 'Donate to rust-lang/rust',  priority: 'Medium', active: true },
  { id: 3, condition: 'If idle > 30%', action: 'Donate to vercel/next.js',  priority: 'Low',    active: false },
]

function RingChart({ used, max }) {
  const pct = Math.min(100, Math.round((used / max) * 100))
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#b8b3b0" strokeWidth="6" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#020202" strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-heading font-normal text-factory-black">{pct}%</span>
        <span className="text-caption text-ash-gray">used</span>
      </div>
    </div>
  )
}

export default function TokenAllocation() {
  const [rules, setRules] = useState(RULES)
  const [idleThreshold, setIdleThreshold] = useState(10)
  const [showAddRule, setShowAddRule] = useState(false)
  const [newRule, setNewRule] = useState({ condition: '', action: '', priority: 'Medium' })

  const toggleRule = (id) => setRules((prev) => prev.map((r) => r.id === id ? { ...r, active: !r.active } : r))
  const addRule = () => {
    if (!newRule.condition || !newRule.action) return
    setRules((prev) => [...prev, { id: Date.now(), ...newRule, active: true }])
    setNewRule({ condition: '', action: '', priority: 'Medium' })
    setShowAddRule(false)
  }
  const removeRule = (id) => setRules((prev) => prev.filter((r) => r.id !== id))

  const usedTokens = 61200
  const maxTokens = 100000
  const surplusTokens = maxTokens - usedTokens

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-heading font-normal text-factory-black">Token Allocation</h1>
          <p className="text-body-sm text-graphite mt-1">Monitor usage and configure auto-donate rules.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card flex flex-col items-center text-center">
            <RingChart used={usedTokens} max={maxTokens} />
            <p className="text-body-sm text-factory-black mt-3">Current Usage</p>
            <p className="text-caption text-ash-gray font-mono">{usedTokens.toLocaleString()} / {maxTokens.toLocaleString()}</p>
          </div>

          <div className="card flex flex-col justify-between">
            <div>
              <p className="text-caption text-ash-gray mb-1">Surplus Pool</p>
              <p className="text-heading font-normal text-factory-black font-mono">{surplusTokens.toLocaleString()}</p>
              <p className="text-caption text-ash-gray mt-1">Idle tokens available for donation</p>
            </div>
            <div className="mt-4 h-px bg-cool-gray/40 overflow-hidden">
              <div className="h-full bg-code-orange"
                style={{ width: `${Math.round((surplusTokens / maxTokens) * 100)}%` }} />
            </div>
          </div>

          <div className="card">
            <p className="text-caption text-ash-gray mb-3">Idle Threshold</p>
            <div className="flex items-center gap-3 mb-3">
              <input type="range" min="1" max="50" value={idleThreshold}
                onChange={(e) => setIdleThreshold(Number(e.target.value))}
                className="flex-1 accent-factory-black" />
              <span className="text-body-sm text-factory-black font-mono w-12 text-right">{idleThreshold}%</span>
            </div>
            <p className="text-caption text-ash-gray">
              Currently <span className="text-factory-black font-mono">{Math.round((surplusTokens / maxTokens) * 100)}%</span> idle.
            </p>
            <div className={`mt-3 rounded px-3 py-2 text-caption font-mono ${
              surplusTokens / maxTokens * 100 > idleThreshold
                ? 'bg-factory-black text-faded-silver'
                : 'bg-factory-light-gray text-ash-gray border border-cool-gray/40'
            }`}>
              {surplusTokens / maxTokens * 100 > idleThreshold
                ? '↑ threshold crossed — auto-donate active'
                : '⏳ below threshold — monitoring'}
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-body text-factory-black">Allocation Rules</h2>
            <button onClick={() => setShowAddRule(true)} className="btn-outline text-body-sm">+ Add rule</button>
          </div>

          {showAddRule && (
            <div className="bg-factory-light-gray rounded p-5 mb-5 space-y-3">
              <p className="text-body-sm text-factory-black">New rule</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Condition</label>
                  <input type="text" className="input" placeholder="e.g. If idle > 15%"
                    value={newRule.condition} onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })} />
                </div>
                <div>
                  <label className="label">Action</label>
                  <input type="text" className="input" placeholder="e.g. Donate to org/repo"
                    value={newRule.action} onChange={(e) => setNewRule({ ...newRule, action: e.target.value })} />
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={newRule.priority}
                    onChange={(e) => setNewRule({ ...newRule, priority: e.target.value })}>
                    <option>High</option><option>Medium</option><option>Low</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={addRule} className="btn-primary">Save rule</button>
                <button onClick={() => setShowAddRule(false)} className="btn-outline">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className={`flex items-center gap-4 p-4 rounded border border-cool-gray/30 transition-opacity ${!rule.active ? 'opacity-40' : ''}`}>
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`w-10 h-5 rounded-full transition-colors shrink-0 relative ${rule.active ? 'bg-factory-black' : 'bg-cool-gray'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-faded-silver transition-transform ${rule.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-factory-black font-mono">{rule.condition}</p>
                  <p className="text-caption text-ash-gray">→ {rule.action}</p>
                </div>
                <span className={`text-caption font-mono rounded px-2.5 py-0.5 border ${
                  rule.priority === 'High'
                    ? 'border-factory-black text-factory-black'
                    : 'border-cool-gray/40 text-ash-gray'
                }`}>{rule.priority}</span>
                <button onClick={() => removeRule(rule.id)} className="text-caption text-ash-gray hover:text-red-500 transition-colors">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
