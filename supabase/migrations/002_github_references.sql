alter table if exists public.activities
  add column if not exists github_repo text,
  add column if not exists type text not null default 'started',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.achievements
  add column if not exists github_repo text,
  add column if not exists github_pr_url text,
  add column if not exists github_pr_number integer,
  add column if not exists status text not null default 'started',
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists submitted_at timestamptz,
  add column if not exists merged_at timestamptz,
  add column if not exists closed_at timestamptz;

update public.achievements a
set github_repo = regexp_replace(substring(p.url from 'github.com/([^/]+/[^/?#]+)'), '\.git/?$', '')
from public.projects p
where a.project_id = p.id
  and a.github_repo is null;

update public.activities act
set github_repo = regexp_replace(substring(p.url from 'github.com/([^/]+/[^/?#]+)'), '\.git/?$', '')
from public.projects p
where act.opensource_id = p.id
  and act.github_repo is null;

update public.achievements
set github_repo = regexp_replace(
  substring(coalesce(github_pr_url, url, issue_url) from 'github.com/([^/]+/[^/?#]+)'),
  '\.git/?$',
  ''
)
where github_repo is null
  and coalesce(github_pr_url, url, issue_url) like '%github.com/%';

update public.activities
set github_repo = regexp_replace(substring(url from 'github.com/([^/]+/[^/?#]+)'), '\.git/?$', '')
where github_repo is null
  and url like '%github.com/%';

update public.achievements
set github_repo = 'unknown/unknown'
where github_repo is null;

update public.activities
set github_repo = 'unknown/unknown'
where github_repo is null;

alter table if exists public.achievements
  alter column github_repo set not null;

alter table if exists public.activities
  alter column github_repo set not null,
  alter column url drop not null;

alter table if exists public.activities
  drop constraint if exists activities_type_check,
  add constraint activities_type_check check (type in ('started', 'submitted', 'merged', 'closed', 'synced'));

alter table if exists public.achievements
  drop constraint if exists achievements_status_check,
  add constraint achievements_status_check check (status in ('started', 'submitted', 'merged', 'closed'));

alter table if exists public.activities
  drop constraint if exists activities_opensource_id_fkey,
  drop column if exists opensource_id;

alter table if exists public.achievements
  drop constraint if exists achievements_project_id_fkey,
  drop column if exists project_id;

drop table if exists public.projects;

create index if not exists achievements_user_created_idx
  on public.achievements (user_id, created_at desc);

create index if not exists achievements_github_repo_idx
  on public.achievements (github_repo);

create index if not exists achievements_status_idx
  on public.achievements (status);
