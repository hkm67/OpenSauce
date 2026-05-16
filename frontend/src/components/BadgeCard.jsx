export default function BadgeCard({ badge, size = 'md', onClick }) {
  const sm = size === 'sm'

  return (
    <div
      onClick={onClick}
      className={`card relative flex flex-col items-center text-center gap-1.5 transition-opacity
        ${sm ? 'p-3' : 'p-4'}
        ${badge.earned ? 'border-b-2 border-code-orange' : 'opacity-40'}
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="relative">
        <img
          src={badge.image}
          alt={badge.name}
          className={`object-contain ${sm ? 'w-14 h-14' : 'w-20 h-20'}`}
          style={badge.earned ? {} : { filter: 'grayscale(1)' }}
        />
        {!badge.earned && (
          <span className="absolute -top-1 -right-1 text-[9px] leading-none">🔒</span>
        )}
      </div>

      <p className={`font-normal leading-tight ${sm ? 'text-caption text-factory-black' : 'text-body-sm text-factory-black'}`}>
        {badge.name}
      </p>

      {!sm && (
        <p className="text-caption text-ash-gray">{badge.description}</p>
      )}
    </div>
  )
}
