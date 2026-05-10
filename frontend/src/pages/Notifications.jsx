import DashboardLayout from '../components/DashboardLayout'

const NOTIFICATIONS = [
  { id: 1, type: 'donation',   title: 'Donation completed',       body: 'You donated 2,400 tokens to react/react.',                    time: '2h ago',  read: false },
  { id: 2, type: 'threshold',  title: 'Idle threshold crossed',   body: 'coding-agent-prod is 15% idle — auto-donate rules triggered.', time: '4h ago',  read: false },
  { id: 3, type: 'pr',         title: 'PR assisted',              body: 'Your agent helped review PR #58221 on vercel/next.js.',        time: '1d ago',  read: true  },
  { id: 4, type: 'system',     title: 'New project added',        body: 'rust-lang/async-std joined the marketplace.',                  time: '2d ago',  read: true  },
]

const TYPE_ICON = { donation: '↑', threshold: '⚡', pr: '✓', system: 'i' }

export default function Notifications() {
  const unread = NOTIFICATIONS.filter((n) => !n.read).length

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-heading font-normal text-factory-black">Notifications</h1>
            <p className="text-body-sm text-graphite mt-1">
              {unread > 0 ? `${unread} unread notification${unread !== 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
          <button className="btn-outline">Mark all read</button>
        </div>

        <div className="max-w-2xl space-y-2">
          {NOTIFICATIONS.map((n) => (
            <div key={n.id} className={`card flex items-start gap-4 ${!n.read ? 'border-l-2 border-l-factory-black' : ''}`}>
              <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 font-mono text-caption ${
                !n.read ? 'bg-factory-black text-faded-silver' : 'bg-factory-light-gray text-ash-gray border border-cool-gray/40'
              }`}>
                {TYPE_ICON[n.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-body-sm ${n.read ? 'text-ash-gray' : 'text-factory-black'}`}>{n.title}</p>
                <p className="text-caption text-ash-gray mt-0.5">{n.body}</p>
              </div>
              <span className="text-caption text-ash-gray shrink-0 font-mono">{n.time}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
