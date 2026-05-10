export default function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card">
      <p className="text-caption text-ash-gray mb-1">{label}</p>
      <p className={`text-heading font-normal ${accent ? 'text-code-orange' : 'text-factory-black'}`}>{value}</p>
      {sub && <p className="text-caption text-ash-gray mt-1">{sub}</p>}
    </div>
  )
}
