import json
import random
import time
from collections import OrderedDict
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from .config import GITHUB_CACHE_MAX_ITEMS, GITHUB_CACHE_TTL_SECONDS


GITHUB_HEADERS = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "OpenSauce-Backend",
}
_CACHE = OrderedDict()


def normalize_github_repo(value):
    if not value:
        return None

    value = str(value).strip()
    if "github.com/" in value:
        parsed = urlparse(value)
        if parsed.netloc.lower() != "github.com":
            return None
        parts = [part for part in parsed.path.strip("/").split("/") if part]
    else:
        parts = [part for part in value.strip("/").split("/") if part]

    if len(parts) < 2:
        return None

    owner, repo = parts[0], parts[1].removesuffix(".git")
    if not owner or not repo:
        return None
    return f"{owner}/{repo}"


def github_repo_url(github_repo):
    repo = normalize_github_repo(github_repo)
    return f"https://github.com/{repo}" if repo else None


def parse_github_repo_url(url):
    repo = normalize_github_repo(url)
    if not repo:
        return None
    owner, name = repo.split("/", 1)
    return owner, name


def parse_github_pull_request_url(url):
    parsed = urlparse(str(url or "").strip())
    if parsed.netloc.lower() != "github.com":
        return None

    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if len(parts) < 4 or parts[2] != "pull":
        return None

    try:
        number = int(parts[3])
    except ValueError:
        return None

    return {
        "github_repo": f"{parts[0]}/{parts[1].removesuffix('.git')}",
        "github_pr_number": number,
        "github_pr_url": f"https://github.com/{parts[0]}/{parts[1].removesuffix('.git')}/pull/{number}",
    }


def _github_json(api_url, timeout=8):
    request = Request(api_url, headers=GITHUB_HEADERS)
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _cache_get(key):
    if GITHUB_CACHE_TTL_SECONDS <= 0:
        return None

    entry = _CACHE.get(key)
    if not entry:
        return None

    expires_at, value = entry
    if expires_at <= time.monotonic():
        _CACHE.pop(key, None)
        return None

    _CACHE.move_to_end(key)
    return value


def _cache_set(key, value):
    if GITHUB_CACHE_TTL_SECONDS <= 0 or GITHUB_CACHE_MAX_ITEMS <= 0:
        return value

    _CACHE[key] = (time.monotonic() + GITHUB_CACHE_TTL_SECONDS, value)
    _CACHE.move_to_end(key)
    while len(_CACHE) > GITHUB_CACHE_MAX_ITEMS:
        _CACHE.popitem(last=False)
    return value


def clear_github_cache():
    _CACHE.clear()


def fetch_github_repository(github_repo):
    repo = normalize_github_repo(github_repo)
    if not repo:
        return None

    cache_key = ("repo", repo)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        data = _github_json(f"https://api.github.com/repos/{repo}")
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None

    return _cache_set(cache_key, {
        "github_repo": data["full_name"],
        "url": data["html_url"],
        "description": data.get("description") or "",
        "language": data.get("language"),
        "stars": data.get("stargazers_count", 0),
        "forks": data.get("forks_count", 0),
        "open_issues": data.get("open_issues_count", 0),
    })


def search_github_repositories(query, limit=20, page=1):
    query = (query or "").strip()
    if not query:
        return {"repositories": [], "pagination": _search_pagination(0, limit, page)}

    cache_key = ("search", query.lower(), int(limit), int(page))
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    safe_query = quote(f"{query} is:public archived:false")
    api_url = (
        "https://api.github.com/search/repositories"
        f"?q={safe_query}&sort=updated&order=desc&per_page={int(limit)}&page={int(page)}"
    )
    try:
        payload = _github_json(api_url)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return {"repositories": [], "pagination": _search_pagination(0, limit, page)}

    repositories = [
            {
                "github_repo": item["full_name"],
                "url": item["html_url"],
                "description": item.get("description") or "",
                "language": item.get("language"),
                "stars": item.get("stargazers_count", 0),
                "forks": item.get("forks_count", 0),
                "open_issues": item.get("open_issues_count", 0),
            }
            for item in payload.get("items", [])
        ]
    return _cache_set(cache_key, {
        "repositories": repositories,
        "pagination": _search_pagination(payload.get("total_count", 0), limit, page),
    })


def _search_pagination(total_count, limit, page):
    limit = max(1, int(limit))
    page = max(1, int(page))
    # GitHub Search returns at most the first 1,000 results.
    capped_total = min(int(total_count or 0), 1000)
    total_pages = (capped_total + limit - 1) // limit
    return {
        "limit": limit,
        "page": page,
        "total": capped_total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1,
    }


def fetch_open_issues(github_repo):
    repo = normalize_github_repo(github_repo)
    if repo is None:
        return []

    cache_key = ("issues", repo)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    api_url = (
        f"https://api.github.com/repos/{repo}/issues"
        "?state=open&per_page=50&sort=updated&direction=desc"
    )

    try:
        issues = _github_json(api_url)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return []

    assignable_issues = []
    for issue in issues:
        if issue.get("pull_request"):
            continue
        if issue.get("assignee") or issue.get("assignees"):
            continue

        assignable_issues.append(
            {
                "github_repo": repo,
                "number": issue["number"],
                "title": issue["title"],
                "url": issue["html_url"],
            }
        )

    return _cache_set(cache_key, assignable_issues)


def fetch_random_open_issue(github_repos):
    issues = []
    for repo in github_repos:
        issues.extend(fetch_open_issues(repo))

    if not issues:
        return None

    return random.choice(issues)


def fetch_pull_request_state(github_repo, pull_number):
    repo = normalize_github_repo(github_repo)
    if not repo or not pull_number:
        return None

    try:
        pr = _github_json(f"https://api.github.com/repos/{repo}/pulls/{int(pull_number)}")
    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError):
        return None

    if pr.get("merged_at"):
        return "merged"
    if pr.get("state") == "closed":
        return "closed"
    return "submitted"
