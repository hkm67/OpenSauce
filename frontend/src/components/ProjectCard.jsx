function extractRepoInfo(url) {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/?\s]+)/)
    if (match) return { owner: match[1], repo: match[2] }
  } catch {}
  return { owner: null, repo: url }
}

export default function ProjectCard({ project, onClick }) {
  const { owner, repo } = extractRepoInfo(project.url)

  return (
    <div
      className="card cursor-pointer hover:border-cool-gray transition-colors group"
      onClick={() => onClick?.(project)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {owner && <span className="text-caption text-ash-gray">{owner} /</span>}
            <span className="text-body text-factory-black">{repo}</span>
          </div>
          <p className="text-body-sm text-graphite line-clamp-2">{project.description}</p>
        </div>
        <span className="text-body-sm text-factory-black opacity-0 group-hover:opacity-100 transition-opacity shrink-0">→</span>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-cool-gray/30">
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-caption text-ash-gray hover:text-factory-black transition-colors"
        >
          github.com ↗
        </a>
        <span className="text-caption text-ash-gray">
          {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
}
