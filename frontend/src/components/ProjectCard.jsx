import { useEffect, useState } from 'react'

function extractRepoInfo(url) {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/?\s]+)/)
    if (match) return { owner: match[1], repo: match[2] }
  } catch {}
  return { owner: null, repo: url }
}

function formatStars(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

export default function ProjectCard({ project, onClick }) {
  const repoRef = project.github_repo || project.full_name
  const { owner, repo } = repoRef
    ? { owner: repoRef.split('/')[0], repo: repoRef.split('/').slice(1).join('/') }
    : extractRepoInfo(project.url)
  const [stars, setStars] = useState(project.stars ?? null)

  useEffect(() => {
    if (project.stars != null) return
    if (!owner || !repo) return
    fetch(`https://api.github.com/repos/${owner}/${repo}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.stargazers_count != null) setStars(data.stargazers_count) })
      .catch(() => {})
  }, [owner, repo, project.stars])

  return (
    <div
      className="card cursor-pointer hover:border-cool-gray transition-colors group flex flex-col"
      onClick={() => onClick?.(project)}
    >
      <div className="flex items-start justify-between gap-4 flex-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {owner && <span className="text-caption text-ash-gray">{owner} /</span>}
            <span className="text-body text-factory-black">{repo}</span>
          </div>
          <p className="text-body-sm text-graphite line-clamp-2">{project.description || 'GitHub repository'}</p>
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
        <div className="flex items-center gap-3">
          {stars !== null && (
            <span className="flex items-center gap-1 text-caption text-ash-gray">
              <span>☆</span>
              <span className="font-mono">{formatStars(stars)}</span>
            </span>
          )}
          {project.language && <span className="text-caption text-ash-gray">{project.language}</span>}
        </div>
      </div>
    </div>
  )
}
