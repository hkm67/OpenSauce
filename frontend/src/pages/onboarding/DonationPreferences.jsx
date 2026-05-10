import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const STEPS = ['1 Agent setup', '2 Preferences', '3 Done']
const CATEGORIES = ['Infrastructure', 'Dev Tools', 'AI / ML', 'Security', 'Frontend', 'Backend', 'Documentation', 'Testing']

export default function DonationPreferences() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState([])
  const [minTokens, setMinTokens] = useState('5000')
  const [maxTokens, setMaxTokens] = useState('50000')
  const [idleThreshold, setIdleThreshold] = useState('10')
  const [autoDonate, setAutoDonate] = useState(true)

  const toggle = (cat) => setSelected((p) => p.includes(cat) ? p.filter((c) => c !== cat) : [...p, cat])

  const handleFinish = (e) => {
    e.preventDefault()
    localStorage.setItem('onboarding_prefs', JSON.stringify({ selected, minTokens, maxTokens, idleThreshold, autoDonate }))
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-factory-light-gray flex flex-col">
      <div className="h-12 flex items-center px-6 border-b border-cool-gray/40">
        <Link to="/" className="text-body text-factory-black flex items-center gap-1.5 mr-8">
          <span>🍅</span><span>OpenSauce</span>
        </Link>
        <div className="flex items-center gap-6 ml-auto">
          {STEPS.map((s, i) => (
            <span key={s} className={`font-mono text-caption ${i === 1 ? 'text-factory-black' : 'text-ash-gray'}`}>{s}</span>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          <h1 className="text-heading font-normal text-factory-black mb-1">Donation preferences</h1>
          <p className="text-body-sm text-graphite mb-8">Set how and when surplus tokens are donated. Adjustable anytime.</p>

          <form onSubmit={handleFinish} className="space-y-6">
            {/* Categories */}
            <div>
              <label className="label mb-2">Project categories</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button key={cat} type="button" onClick={() => toggle(cat)}
                    className={`rounded px-3 py-1 text-body-sm border transition-colors ${
                      selected.includes(cat)
                        ? 'bg-factory-black text-faded-silver border-factory-black'
                        : 'bg-transparent text-graphite border-cool-gray hover:border-graphite'
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>
              <p className="text-caption text-ash-gray mt-2">Leave empty to donate to any category.</p>
            </div>

            {/* Thresholds */}
            <div className="card space-y-4">
              <p className="text-body-sm text-factory-black">Token thresholds</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Min donation</label>
                  <input type="number" min="0" className="input" value={minTokens} onChange={(e) => setMinTokens(e.target.value)} />
                </div>
                <div>
                  <label className="label">Max donation</label>
                  <input type="number" min="0" className="input" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Idle threshold — <span className="font-mono text-code-orange">{idleThreshold}%</span></label>
                <input type="range" min="1" max="50" value={idleThreshold}
                  onChange={(e) => setIdleThreshold(e.target.value)} className="w-full accent-factory-black" />
              </div>
            </div>

            {/* Auto-donate toggle */}
            <div className="card flex items-center justify-between gap-4">
              <div>
                <p className="text-body-sm text-factory-black">Auto-donate</p>
                <p className="text-caption text-ash-gray mt-0.5">Donate automatically when idle threshold is crossed.</p>
              </div>
              <button type="button" onClick={() => setAutoDonate((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors shrink-0 relative ${autoDonate ? 'bg-factory-black' : 'bg-cool-gray'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-faded-silver transition-transform ${autoDonate ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link to="/onboarding/agent-setup" className="btn-ghost text-body-sm">← Back</Link>
              <button type="submit" className="btn-primary px-5">Finish setup</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
