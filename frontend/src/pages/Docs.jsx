import { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    content: `
OpenSauce is an open platform for routing AI agent surplus tokens to open source projects.

**Prerequisites:**
- An OpenSauce contributor account
- An AI agent server with a metrics endpoint
- Your agent's API key (optional but recommended)

**Quick start:**
1. Sign up at opensauce.dev
2. Add your agent via the Agent Setup wizard
3. Set your donation preferences
4. Watch tokens flow to projects you care about
    `,
  },
  {
    id: 'sdk',
    title: 'Agent Integration SDK',
    content: `
The OpenSauce SDK makes it trivial to instrument your agent and report token usage.

**Install:**
\`\`\`bash
pip install opensauce-sdk
\`\`\`

**Basic usage:**
\`\`\`python
from opensauce import AgentClient

client = AgentClient(api_key="sk-…")

client.report_usage(
    tokens_used=1200,
    tokens_max=100_000,
)
\`\`\`
    `,
  },
  {
    id: 'api',
    title: 'API Reference',
    content: `
**Base URL:** http://localhost:8000 (local dev)

All authenticated endpoints require:
Authorization: Bearer <opensauce-api-token>

---

**POST /user** — Create account through backend-managed Supabase Auth
**POST /login** — Authenticate through backend-managed Supabase Auth
**GET /user** — Current authenticated profile
**GET /github/search?q=react&page=1&limit=20** — Search public GitHub repositories with pagination
**GET /github/repos/:owner/:repo** — Fetch a GitHub repository reference
**POST /activity** — Record a contribution state event with github_repo
**GET /skill** — Generate SKILL.md and a temporary achievement token
**POST /achieve** — Add or submit a contribution using github_repo / github_pr_url
    `,
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    content: `
OpenSauce can send webhook events to your endpoint.

**Events:**
- donation.completed — tokens donated to a project
- threshold.crossed — idle threshold exceeded
- contribution.recorded — a PR/issue was logged

Configure your webhook URL in Settings → Integrations.
    `,
  },
]

function renderContent(text) {
  const lines = text.trim().split('\n')
  const result = []
  let inCode = false
  let codeLines = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        result.push(
          <pre key={key++} className="code-block-dark text-body-sm font-mono overflow-x-auto mb-4 mt-2">
            <code>{codeLines.join('\n')}</code>
          </pre>
        )
        codeLines = []
        inCode = false
      } else {
        inCode = true
      }
    } else if (inCode) {
      codeLines.push(line)
    } else if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      result.push(<p key={key++} className="text-body-sm text-factory-black mt-4 mb-1">{line.slice(2, -2)}</p>)
    } else if (line.startsWith('---')) {
      result.push(<hr key={key++} className="border-cool-gray/30 my-4" />)
    } else if (/^\d+\./.test(line)) {
      result.push(<p key={key++} className="text-body-sm text-graphite ml-4 mb-1">{line}</p>)
    } else if (line.startsWith('- ')) {
      result.push(<p key={key++} className="text-body-sm text-graphite ml-4 mb-1">· {line.slice(2)}</p>)
    } else if (line.trim()) {
      result.push(<p key={key++} className="text-body-sm text-graphite mb-2">{line}</p>)
    }
  }
  return result
}

export default function Docs() {
  const [active, setActive] = useState('getting-started')
  const section = SECTIONS.find((s) => s.id === active)

  return (
    <div className="flex flex-col min-h-screen bg-factory-light-gray">
      <Navbar />

      <div className="flex-1 flex">
        <aside className="w-56 shrink-0 bg-faded-silver border-r border-cool-gray/40 px-4 py-8">
          <p className="text-caption text-ash-gray mb-4 px-1 font-mono uppercase tracking-wider">Documentation</p>
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={active === s.id ? 'sidebar-item-active w-full text-left' : 'sidebar-item w-full text-left'}>
                {s.title}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1">
          <div className="max-w-2xl px-8 py-10">
            <h1 className="text-heading font-normal text-factory-black mb-6">{section?.title}</h1>
            <div className="space-y-1">{section && renderContent(section.content)}</div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  )
}
