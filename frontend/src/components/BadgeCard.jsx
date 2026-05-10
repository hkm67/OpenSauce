export default function BadgeCard({ badge, size = 'md' }) {
  const sm = size === 'sm'

  return (
    <div className={`card relative flex flex-col gap-1.5 transition-opacity
      ${sm ? 'p-3' : 'p-4'}
      ${badge.earned ? 'border-b-2 border-code-orange' : 'opacity-50'}`}
    >
      <div className="relative self-start">
        <div className={`flex items-center justify-center rounded-full bg-factory-light-gray
          ${sm ? 'w-8 h-8 text-lg' : 'w-10 h-10 text-2xl'}`}
          style={badge.earned ? {} : { filter: 'grayscale(1)' }}
        >
          {badge.icon}
        </div>
        {!badge.earned && (
          <span className="absolute -top-1 -right-1 text-[9px] leading-none">🔒</span>
        )}
      </div>

      <p className={`font-normal ${sm ? 'text-caption text-factory-black' : 'text-body-sm text-factory-black'}`}>
        {badge.name}
      </p>

      {!sm && (
        <p className="text-caption text-ash-gray">{badge.description}</p>
      )}
    </div>
  )
}
