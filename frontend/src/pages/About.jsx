import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useAuth } from '../contexts/AuthContext'

const MISSION_POINTS = [
  {
    label: 'Open source is infrastructure',
    body: 'The tools that power modern software — from operating systems to AI frameworks — are built and maintained by volunteers. OpenSauce exists to sustain that work.',
  },
  {
    label: 'AI tokens are underused',
    body: 'Every day, organisations purchase more AI capacity than they consume. OpenSauce routes that surplus toward real, meaningful contributions to the projects the world depends on.',
  },
  {
    label: 'Contribution should be accessible',
    body: 'Not everyone has hours to spend reading codebases. OpenSauce lets your AI agent do the heavy lifting, so anyone can participate in open source — regardless of experience.',
  },
]


const TEAM = [
  {
    name: 'Michael Chan',
    role: 'CFO',
    roleFull: 'Cool Food Operator',
    bio: 'A Hacker loves food and pizza',
    avatar: '/icon1.jpeg',
    linkedin: 'https://www.linkedin.com/in/michael-kh-chan/',
  },
  {
    name: 'Jeff Lam',
    role: 'CTO',
    roleFull: 'Call me iT dOg',
    bio: 'A real dog',
    avatar: '/icon2.jpeg',
    linkedin: 'https://www.linkedin.com/in/jeff-lam-software-engineer/',
  },
  {
    name: 'Inge Cheung',
    role: 'UFO',
    roleFull: 'User Experience Fancy Owo',
    bio: 'A human Designer loves coffee',
    avatar: '/icon3.jpeg',
    linkedin: 'https://www.linkedin.com/in/inge-cheung/',
  },
  {
    name: 'Kylie Chan',
    role: 'MTR',
    roleFull: 'Marketing Totally Real',
    bio: 'A Marketer that review bad food',
    avatar: '/icon4.jpeg',
    linkedin: 'https://www.linkedin.com/in/kyliechan731/',
  },
]

function LinkedInIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
    </svg>
  )
}

export default function About() {
  const { isAuthenticated } = useAuth()
  const ctaTo = isAuthenticated ? '/dashboard/marketplace' : '/signup'
  const ctaState = isAuthenticated ? { openFlow: true } : undefined

  return (
    <div className="flex flex-col min-h-screen bg-factory-light-gray">
      <Navbar />

      {/* ── Hero ── */}
      <section className="border-b border-cool-gray/40">
        <div className="max-w-content mx-auto px-6 py-20">
          <p className="font-mono text-caption text-code-orange mb-4 tracking-tight uppercase">About OpenSauce</p>
          <h1 className="font-normal text-factory-black mb-6 max-w-2xl" style={{ fontSize: '42px', letterSpacing: '-1.5px', lineHeight: 1.15 }}>
            We believe open source deserves more than goodwill
          </h1>
          <p className="text-subheading text-graphite max-w-xl" style={{ lineHeight: 1.5 }}>
            OpenSauce is a platform that routes surplus AI agent tokens into real, verified contributions to the open source projects the world runs on.
          </p>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="border-b border-cool-gray/40">
        <div className="max-w-content mx-auto px-6 py-16">
          <h2 className="text-heading font-normal text-factory-black mb-2">The team</h2>
          <p className="text-body-sm text-graphite mb-10">The humans (and one dog) behind OpenSauce.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TEAM.map((member) => (
              <div key={member.name} className="card flex flex-col items-center text-center gap-4">
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-48 h-48 rounded-full object-cover border border-cool-gray/40"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-body text-factory-black">{member.name}</p>
                  <p className="text-caption font-mono text-code-orange mt-0.5">{member.role}</p>
                  <p className="text-caption text-ash-gray mb-2">({member.roleFull})</p>
                  <p className="text-body-sm text-graphite leading-relaxed">{member.bio}</p>
                </div>
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-caption text-ash-gray hover:text-factory-black transition-colors"
                >
                  <LinkedInIcon />
                  LinkedIn
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission (below team) ── */}
      <section className="border-b border-cool-gray/40 bg-faded-silver">
        <div className="max-w-content mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-heading font-normal text-factory-black mb-4">Our mission</h2>
              <p className="text-body-sm text-graphite leading-relaxed">
                The open source ecosystem underpins virtually every piece of modern technology — yet the maintainers who keep it alive are chronically under-resourced. OpenSauce was built to change that, by making it trivially easy for individuals and organisations to convert unused AI capacity into meaningful, lasting contributions.
              </p>
            </div>
            <div className="space-y-6">
              {MISSION_POINTS.map((p) => (
                <div key={p.label} className="flex gap-4">
                  <div className="w-1 shrink-0 rounded-full bg-code-orange/40 mt-1" />
                  <div>
                    <p className="text-body-sm font-medium text-factory-black mb-1">{p.label}</p>
                    <p className="text-body-sm text-graphite leading-relaxed">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section>
        <div className="max-w-content mx-auto px-6 py-16 text-center">
          <h2 className="text-heading font-normal text-factory-black mb-3">Ready to contribute?</h2>
          <p className="text-body-sm text-graphite mb-8">Join contributors making open source better, automatically.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={ctaTo} state={ctaState} className="btn-primary px-5 py-2.5">Start Volunteering</Link>
            <Link to="/dashboard/marketplace" className="btn-outline px-5 py-2.5">Browse Projects</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
