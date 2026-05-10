import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import ProjectCard from '../components/ProjectCard'
import { getProjects } from '../api/projects'

const LEADERBOARD = [
  { rank: 1, name: 'Anthropic Research', tokens: '2.4M', projects: 18 },
  { rank: 2, name: 'OpenAI Community',   tokens: '1.8M', projects: 14 },
  { rank: 3, name: 'Vercel OSS',         tokens: '1.2M', projects: 11 },
  { rank: 4, name: 'Meta AI Labs',       tokens: '980K',  projects: 9  },
  { rank: 5, name: 'HuggingFace',        tokens: '850K',  projects: 7  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Connect your agent', body: 'Register your AI agent server and configure your API keys. OpenSauce monitors token usage in real time.' },
  { step: '02', title: 'Set donation rules',  body: 'Choose projects you care about and set idle thresholds. Surplus tokens flow automatically when capacity is unused.' },
  { step: '03', title: 'Track impact',        body: 'Your tokens power real contributions — PRs, issue triage, documentation — with full audit trails.' },
]

const TRUSTED = ['Anthropic', 'Vercel', 'HuggingFace', 'Linear', 'Supabase']

export default function Home() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProjects()
      .then((r) => setProjects(r.data.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-factory-light-gray">
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="border-b border-cool-gray/40">
        <div className="max-w-content mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <p className="font-mono text-caption text-code-orange mb-4 tracking-tight">NEW — Agent SDK v1.0 now available</p>
            <h1 className="text-display font-normal text-factory-black mb-6" style={{ letterSpacing: '-2.88px', lineHeight: 1 }}>
              Idle tokens,<br />open source<br />impact.
            </h1>
            <p className="text-subheading text-graphite mb-8 max-w-sm" style={{ lineHeight: 1.5 }}>
              OpenSauce routes surplus AI agent tokens to the open source projects the world depends on. Zero waste. Real impact.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-10">
              <Link to="/signup" className="btn-primary px-4 py-2">
                Get started free
              </Link>
              <Link to="/projects" className="btn-outline px-4 py-2">
                Browse projects
              </Link>
            </div>

            {/* CLI install */}
            <div className="code-block flex items-center justify-between gap-4 max-w-sm">
              <code className="text-body-sm font-mono text-factory-black">
                pip install opensauce-sdk
              </code>
              <button className="text-caption text-ash-gray hover:text-factory-black transition-colors shrink-0">copy</button>
            </div>

            {/* Trusted by */}
            <div className="flex items-center gap-4 mt-8 flex-wrap">
              <span className="text-caption text-ash-gray">Trusted by</span>
              {TRUSTED.map((org) => (
                <span key={org} className="text-caption text-graphite">{org}</span>
              ))}
            </div>
          </div>

          {/* Right: code block + dot grid */}
          <div className="relative hidden lg:block">
            <div className="absolute inset-0 dot-grid opacity-60 rounded-card" />
            <div className="relative code-block-dark text-body-sm font-mono leading-relaxed">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-graphite">
                <span className="w-2.5 h-2.5 rounded-full bg-graphite" />
                <span className="w-2.5 h-2.5 rounded-full bg-graphite" />
                <span className="w-2.5 h-2.5 rounded-full bg-graphite" />
                <span className="text-caption text-ash-gray ml-2">agent.yaml</span>
              </div>
              <div className="space-y-1">
                <p><span className="text-code-orange">agent</span><span className="text-cool-gray">:</span> <span className="text-faded-silver">my-coding-agent</span></p>
                <p><span className="text-code-orange">endpoint</span><span className="text-cool-gray">:</span> <span className="text-faded-silver">https://agent.example.com</span></p>
                <p><span className="text-code-orange">max_tokens</span><span className="text-cool-gray">:</span> <span className="text-faded-silver">100_000</span></p>
                <p className="mt-3"><span className="text-code-orange">idle_threshold</span><span className="text-cool-gray">:</span> <span className="text-faded-silver">10%</span></p>
                <p><span className="text-code-orange">auto_donate</span><span className="text-cool-gray">:</span> <span className="text-faded-silver">true</span></p>
                <p className="mt-3"><span className="text-code-orange">donate_to</span><span className="text-cool-gray">:</span></p>
                <p className="pl-4"><span className="text-cool-gray">-</span> <span className="text-faded-silver">react/react</span></p>
                <p className="pl-4"><span className="text-cool-gray">-</span> <span className="text-faded-silver">rust-lang/rust</span></p>
                <p className="pl-4"><span className="text-cool-gray">-</span> <span className="text-faded-silver">vercel/next.js</span></p>
              </div>
              <div className="mt-4 pt-3 border-t border-graphite">
                <p className="text-caption text-ash-gray">↳ surplus pool: <span className="text-code-orange">38,800 tokens</span> ready to donate</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────── */}
      <section className="border-b border-cool-gray/40">
        <div className="max-w-content mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {[
            { value: '4.2M',  label: 'Tokens donated' },
            { value: '120+',  label: 'Open source projects' },
            { value: '340',   label: 'Active contributors' },
            { value: '1,800', label: 'PRs assisted' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-heading-lg font-normal text-factory-black" style={{ letterSpacing: '-2.3px' }}>{s.value}</p>
              <p className="text-body-sm text-ash-gray mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────── */}
      <section id="how-it-works" className="border-b border-cool-gray/40">
        <div className="max-w-content mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <p className="text-body-sm text-ash-gray mb-3">How it works</p>
              <h2 className="text-heading-lg font-normal text-factory-black mb-6" style={{ letterSpacing: '-2.3px' }}>
                Three steps from idle to impact.
              </h2>
              <p className="text-body text-graphite max-w-sm">
                OpenSauce integrates with your existing agent infrastructure. No workflow changes required.
              </p>
            </div>

            <div className="space-y-0">
              {HOW_IT_WORKS.map((item, i) => (
                <div key={item.step} className={`py-6 ${i < HOW_IT_WORKS.length - 1 ? 'border-b border-cool-gray/40' : ''}`}>
                  <div className="flex items-start gap-6">
                    <span className="font-mono text-caption text-ash-gray w-8 shrink-0 mt-0.5">{item.step}</span>
                    <div>
                      <p className="text-body text-factory-black mb-1">{item.title}</p>
                      <p className="text-body-sm text-graphite">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Browse Projects ───────────────────────────────── */}
      <section id="projects" className="border-b border-cool-gray/40">
        <div className="max-w-content mx-auto px-6 py-20">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-body-sm text-ash-gray mb-2">Marketplace</p>
              <h2 className="text-heading-lg font-normal text-factory-black" style={{ letterSpacing: '-2.3px' }}>
                Browse projects.
              </h2>
            </div>
            <Link to="/projects" className="btn-ghost text-body-sm">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card animate-pulse h-24" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="card py-16 text-center">
              <p className="text-body text-graphite mb-4">No projects yet.</p>
              <Link to="/signup" className="btn-primary">Add first project</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.slice(0, 6).map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Leaderboard ───────────────────────────────────── */}
      <section id="leaderboard" className="border-b border-cool-gray/40">
        <div className="max-w-content mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <p className="text-body-sm text-ash-gray mb-2">Leaderboard</p>
              <h2 className="text-heading-lg font-normal text-factory-black" style={{ letterSpacing: '-2.3px' }}>
                Top contributors.
              </h2>
              <p className="text-body text-graphite mt-4 max-w-xs">
                Organizations and agent networks donating the most tokens this cycle.
              </p>
            </div>

            <div>
              <div className="border-t border-cool-gray/40">
                {LEADERBOARD.map((row, i) => (
                  <div key={row.rank} className="flex items-center gap-4 py-4 border-b border-cool-gray/30 hover:bg-faded-silver transition-colors">
                    <span className="font-mono text-caption text-ash-gray w-6 shrink-0">{String(row.rank).padStart(2, '0')}</span>
                    <span className="text-body text-factory-black flex-1">{row.name}</span>
                    <span className="text-body-sm text-graphite hidden sm:block">{row.projects} projects</span>
                    <span className="font-mono text-body-sm text-code-orange">{row.tokens}</span>
                  </div>
                ))}
              </div>
              <p className="text-caption text-ash-gray mt-3">Resets monthly · Updates every 24h</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────── */}
      <section id="about" className="bg-factory-black">
        <div className="max-w-content mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-heading-lg font-normal text-faded-silver mb-6" style={{ letterSpacing: '-2.3px' }}>
              Built for the open source economy.
            </h2>
            <p className="text-body text-cool-gray mb-4">
              AI agents consume millions of tokens daily. Most of them sit idle between tasks. OpenSauce turns that waste into fuel for the open source projects — compilers, frameworks, libraries — that make AI development possible.
            </p>
            <p className="text-body text-graphite">
              We believe the organizations benefiting most from open source should be the ones giving back — automatically, transparently, at scale.
            </p>
          </div>

          <div className="space-y-3">
            <Link to="/signup" className="btn-light w-full justify-center py-3">
              Join OpenSauce
            </Link>
            <a
              href="https://github.com/hkm67/OpenSauce"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline w-full justify-center py-3 border-graphite text-cool-gray hover:border-ash-gray hover:text-faded-silver"
            >
              View source on GitHub ↗
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
