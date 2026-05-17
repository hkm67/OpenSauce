import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-factory-black text-faded-silver">
      <div className="max-w-content mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <p className="text-body text-faded-silver mb-3">🍅 OpenSauce</p>
            <p className="text-body-sm text-cool-gray leading-relaxed">
              AI token contributions for the open source projects the world runs on.
            </p>
          </div>

          {[
            {
              label: 'Platform',
              links: [
                { to: '/dashboard/marketplace', label: 'Browse GitHub Repos' },
                { to: '/#leaderboard', label: 'Leaderboard' },
                { to: '/dashboard', label: 'Dashboard' },
              ],
            },
            {
              label: 'Developers',
              links: [
                { to: '/docs', label: 'Documentation' },
                { to: '/docs#api', label: 'API Reference' },
                { to: '/docs#sdk', label: 'Agent SDK' },
                { to: '/docs#webhooks', label: 'Webhooks' },
              ],
            },
            {
              label: 'Company',
              links: [
                { to: '/#about', label: 'About' },
                { to: '/terms', label: 'Terms' },
                { to: '/privacy', label: 'Privacy' },
                { to: '/support', label: 'Support' },
              ],
            },
          ].map((col) => (
            <div key={col.label}>
              <p className="text-body-sm text-ash-gray mb-3">{col.label}</p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-body-sm text-cool-gray hover:text-faded-silver transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-graphite pt-6 flex items-center justify-between">
          <p className="text-caption text-ash-gray">© {new Date().getFullYear()} OpenSauce</p>
          <a
            href="https://github.com/hkm67/OpenSauce"
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption text-ash-gray hover:text-faded-silver transition-colors"
          >
            View on GitHub ↗
          </a>
        </div>
      </div>
    </footer>
  )
}
