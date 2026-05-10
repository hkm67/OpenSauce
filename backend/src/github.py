import json
import random
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def parse_github_repo_url(url):
    parsed = urlparse(url)
    if parsed.netloc.lower() != "github.com":
        return None

    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if len(parts) < 2:
        return None

    return parts[0], parts[1]


def fetch_open_issues(project):
    repo = parse_github_repo_url(project["url"])
    if repo is None:
        return []

    owner, name = repo
    api_url = (
        f"https://api.github.com/repos/{owner}/{name}/issues"
        "?state=open&per_page=50&sort=updated&direction=desc"
    )
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "OpenSauce-Backend",
    }

    request = Request(api_url, headers=headers)
    try:
        with urlopen(request, timeout=8) as response:
            issues = json.loads(response.read().decode("utf-8"))
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
                "project_id": project["id"],
                "project_url": project["url"],
                "number": issue["number"],
                "title": issue["title"],
                "url": issue["html_url"],
            }
        )

    return assignable_issues


def fetch_random_open_issue(projects):
    issues = []
    for project in projects:
        issues.extend(fetch_open_issues(project))

    if not issues:
        return None

    return random.choice(issues)
