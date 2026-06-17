create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.venues (
  id text primary key,
  name text not null,
  area text not null,
  travel_note text not null,
  lat double precision not null default 0,
  lng double precision not null default 0
);

alter table public.venues add column if not exists lat double precision not null default 0;
alter table public.venues add column if not exists lng double precision not null default 0;

create table if not exists public.event_blocks (
  id text primary key,
  day integer not null check (day between 1 and 5),
  time text not null,
  end_time text not null,
  title text not null,
  host text not null,
  venue_id text not null references public.venues(id),
  type text not null check (type in ('workshop', 'mentor', 'community', 'hackathon', 'demo', 'deadline')),
  tags text[] not null default '{}',
  outcome text not null,
  capacity text not null check (capacity in ('open', 'limited', 'nearly-full'))
);

create table if not exists public.resources (
  id text primary key,
  title text not null,
  partner text not null,
  type text not null check (type in ('perk', 'doc', 'template', 'credit')),
  tags text[] not null default '{}',
  action text not null
);

create table if not exists public.mentors (
  id text primary key,
  name text not null,
  focus text not null,
  venue_id text not null references public.venues(id),
  slot text not null,
  tags text[] not null default '{}'
);

create table if not exists public.deadlines (
  id text primary key,
  day integer not null check (day between 1 and 5),
  time text not null,
  title text not null,
  detail text not null,
  severity text not null check (severity in ('normal', 'high', 'critical'))
);

create table if not exists public.builder_profiles (
  id text primary key,
  name text not null,
  project text not null,
  track text not null default 'Builder Experience',
  goals text[] not null default '{}',
  stack text[] not null default '{}',
  skill_gaps text[] not null default '{}',
  current_venue text not null references public.venues(id),
  priority text not null check (priority in ('learn', 'debug', 'find-team', 'prepare-demo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.builder_checklist_items (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  item_id text not null,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (session_id, item_id)
);

create table if not exists public.event_documents (
  id text primary key,
  source_type text not null check (source_type in ('event', 'resource', 'mentor', 'deadline', 'venue')),
  source_id text not null,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  embedding vector(1536)
);

alter table public.event_documents add column if not exists embedding vector(1536);

alter table public.venues enable row level security;
alter table public.event_blocks enable row level security;
alter table public.resources enable row level security;
alter table public.mentors enable row level security;
alter table public.deadlines enable row level security;
alter table public.builder_profiles enable row level security;
alter table public.builder_checklist_items enable row level security;
alter table public.event_documents enable row level security;

drop policy if exists "public read venues" on public.venues;
drop policy if exists "public read event blocks" on public.event_blocks;
drop policy if exists "public read resources" on public.resources;
drop policy if exists "public read mentors" on public.mentors;
drop policy if exists "public read deadlines" on public.deadlines;
drop policy if exists "public read builder profiles" on public.builder_profiles;
drop policy if exists "public insert builder profiles" on public.builder_profiles;
drop policy if exists "public update builder profiles" on public.builder_profiles;
drop policy if exists "public read checklist" on public.builder_checklist_items;
drop policy if exists "public insert checklist" on public.builder_checklist_items;
drop policy if exists "public update checklist" on public.builder_checklist_items;
drop policy if exists "public read event documents" on public.event_documents;
drop policy if exists "public insert event documents" on public.event_documents;
drop policy if exists "public update event documents" on public.event_documents;

create policy "public read venues" on public.venues for select using (true);
create policy "public read event blocks" on public.event_blocks for select using (true);
create policy "public read resources" on public.resources for select using (true);
create policy "public read mentors" on public.mentors for select using (true);
create policy "public read deadlines" on public.deadlines for select using (true);
create policy "public read builder profiles" on public.builder_profiles for select using (true);

create policy "public insert builder profiles" on public.builder_profiles for insert with check (true);
create policy "public update builder profiles" on public.builder_profiles for update using (true) with check (true);

create policy "public read checklist" on public.builder_checklist_items for select using (true);
create policy "public insert checklist" on public.builder_checklist_items for insert with check (true);
create policy "public update checklist" on public.builder_checklist_items for update using (true) with check (true);
create policy "public read event documents" on public.event_documents for select using (true);
create policy "public insert event documents" on public.event_documents for insert with check (true);
create policy "public update event documents" on public.event_documents for update using (true) with check (true);

create index if not exists event_documents_embedding_idx
  on public.event_documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

create or replace function public.match_event_documents(
  query_embedding vector(1536),
  match_count int default 6
)
returns table (
  id text,
  source_type text,
  source_id text,
  title text,
  body text,
  tags text[],
  similarity float
)
language sql
stable
as $$
  select
    event_documents.id,
    event_documents.source_type,
    event_documents.source_id,
    event_documents.title,
    event_documents.body,
    event_documents.tags,
    1 - (event_documents.embedding <=> query_embedding) as similarity
  from public.event_documents
  where event_documents.embedding is not null
  order by event_documents.embedding <=> query_embedding
  limit match_count;
$$;

insert into public.venues (id, name, area, travel_note, lat, lng) values
  ('main', 'AABW Main Venue', 'District 1', 'Central hackathon floor. Keep 10 minutes for badge and lift queues.', 10.7769, 106.7009),
  ('cloud-hub', 'Cloud Partner Hub', 'District 1', '12 minutes from main venue by ride hailing in normal traffic.', 10.7816, 106.7055),
  ('model-lab', 'Model Lab', 'Thu Thiem', 'Plan 25 minutes from District 1; bridge traffic spikes after 17:00.', 10.7762, 106.7205),
  ('community', 'Community Night Space', 'District 3', 'Best for team matching, mentor intros, and informal project feedback.', 10.7844, 106.6844)
on conflict (id) do update set
  name = excluded.name,
  area = excluded.area,
  travel_note = excluded.travel_note,
  lat = excluded.lat,
  lng = excluded.lng;

insert into public.event_blocks (id, day, time, end_time, title, host, venue_id, type, tags, outcome, capacity) values
  ('kickoff', 1, '09:00', '10:15', 'Registration, welcome, and buildathon kickoff', 'AABW', 'main', 'workshop', array['onboarding', 'rules', 'submission'], 'Leave with the event map, Discord channels, and judging expectations.', 'open'),
  ('ai-stack-primer', 1, '11:00', '12:00', 'Agent stack primer', 'Model Partner', 'model-lab', 'workshop', array['openai', 'agents', 'evaluation', 'workflow'], 'Pick a practical agent architecture and know what to avoid.', 'limited'),
  ('cloud-deploy', 2, '10:30', '11:45', 'Ship your agent on a cloud stack', 'Cloud Partner', 'cloud-hub', 'workshop', array['deployment', 'vercel', 'cloud', 'supabase', 'postgres'], 'Get a deploy path, env checklist, and starter infra pattern.', 'nearly-full'),
  ('rag-evals', 2, '14:00', '15:30', 'RAG and evaluation clinic', 'AI Partner', 'model-lab', 'workshop', array['evaluation', 'embeddings', 'retrieval', 'quality'], 'Improve retrieval quality and define demoable success metrics.', 'limited'),
  ('ux-review', 3, '10:00', '11:00', 'Builder UX review circle', 'Community mentors', 'community', 'mentor', array['frontend', 'onboarding', 'community', 'workflow'], 'Get fast feedback on the first minute of your product.', 'open'),
  ('community-night', 3, '18:30', '21:00', 'Community night and team introductions', 'AABW', 'community', 'community', array['team-matching', 'pitch', 'community', 'growth'], 'Meet missing teammates, mentors, and early users.', 'open'),
  ('hackathon-floor', 4, '09:30', '18:00', 'Heads-down hackathon build block', 'AABW', 'main', 'hackathon', array['debug', 'deployment', 'workflow', 'submission'], 'Stabilize the live demo, collect feedback, and cut scope.', 'open'),
  ('demo-coaching', 4, '19:00', '20:30', 'Demo story and judging clinic', 'Judging mentors', 'main', 'mentor', array['demo', 'judging', 'storytelling', 'metrics', 'pitch'], 'Turn your prototype into a clear 2-minute narrative.', 'limited'),
  ('demo-day', 5, '09:00', '12:00', 'Demo Day check-in and rehearsal', 'AABW', 'main', 'demo', array['demo', 'submission', 'judging', 'pitch'], 'Confirm final build, backup assets, and presenter flow.', 'open'),
  ('awards', 5, '16:00', '18:00', 'Final demos, judging, and awards', 'AABW', 'main', 'demo', array['demo', 'judging', 'community'], 'Present, get scored, and close the week with the builder community.', 'open')
on conflict (id) do update set
  day = excluded.day,
  time = excluded.time,
  end_time = excluded.end_time,
  title = excluded.title,
  host = excluded.host,
  venue_id = excluded.venue_id,
  type = excluded.type,
  tags = excluded.tags,
  outcome = excluded.outcome,
  capacity = excluded.capacity;

insert into public.resources (id, title, partner, type, tags, action) values
  ('cloud-credit', 'Cloud launch credits', 'Cloud Partner', 'credit', array['deployment', 'cloud', 'vercel', 'postgres'], 'Claim before opening a production database or long-running job.'),
  ('eval-sheet', 'Agent evaluation scorecard', 'AI Partner', 'template', array['evaluation', 'quality', 'judging', 'metrics'], 'Use it to prove the agent works beyond a happy-path demo.'),
  ('submission-kit', 'Devpost submission checklist', 'AABW', 'doc', array['submission', 'demo', 'judging', 'pitch'], 'Attach live link, repo, short description, and a 2-minute demo video.'),
  ('community-intros', 'Team intro board', 'Discord', 'perk', array['team-matching', 'community', 'growth', 'onboarding'], 'Post your missing role and the next 4-hour milestone.')
on conflict (id) do update set
  title = excluded.title,
  partner = excluded.partner,
  type = excluded.type,
  tags = excluded.tags,
  action = excluded.action;

insert into public.mentors (id, name, focus, venue_id, slot, tags) values
  ('mai', 'Mai Tran', 'Agent evaluation and retrieval quality', 'model-lab', 'Day 2, 15:45', array['evaluation', 'retrieval', 'openai', 'metrics']),
  ('khoa', 'Khoa Nguyen', 'Deployment, infra, and launch readiness', 'cloud-hub', 'Day 2, 12:15', array['deployment', 'cloud', 'supabase', 'vercel']),
  ('linh', 'Linh Pham', 'Demo story, pitch, and judging clarity', 'main', 'Day 4, 20:45', array['demo', 'pitch', 'judging', 'storytelling']),
  ('an', 'An Vo', 'Community loops and team matching', 'community', 'Day 3, 19:30', array['team-matching', 'community', 'growth', 'onboarding'])
on conflict (id) do update set
  name = excluded.name,
  focus = excluded.focus,
  venue_id = excluded.venue_id,
  slot = excluded.slot,
  tags = excluded.tags;

insert into public.deadlines (id, day, time, title, detail, severity) values
  ('repo-ready', 4, '16:00', 'Repo and README freeze', 'Make the project runnable from a clean checkout with seeded mock data.', 'high'),
  ('video-cut', 4, '22:00', 'Demo video backup', 'Record a short fallback video in case Wi-Fi or APIs fail on Demo Day.', 'normal'),
  ('submit', 5, '10:30', 'Final submission check', 'Confirm live link, repo, description, track fit, and judging story.', 'critical')
on conflict (id) do update set
  day = excluded.day,
  time = excluded.time,
  title = excluded.title,
  detail = excluded.detail,
  severity = excluded.severity;

insert into public.event_documents (id, source_type, source_id, title, body, tags)
select
  'event:' || id,
  'event',
  id,
  title,
  concat_ws(' ', title, host, type, outcome, array_to_string(tags, ' ')),
  tags
from public.event_blocks
on conflict (id) do update set
  title = excluded.title,
  body = excluded.body,
  tags = excluded.tags;

insert into public.event_documents (id, source_type, source_id, title, body, tags)
select
  'resource:' || id,
  'resource',
  id,
  title,
  concat_ws(' ', title, partner, type, action, array_to_string(tags, ' ')),
  tags
from public.resources
on conflict (id) do update set
  title = excluded.title,
  body = excluded.body,
  tags = excluded.tags;

insert into public.event_documents (id, source_type, source_id, title, body, tags)
select
  'mentor:' || id,
  'mentor',
  id,
  name,
  concat_ws(' ', name, focus, slot, array_to_string(tags, ' ')),
  tags
from public.mentors
on conflict (id) do update set
  title = excluded.title,
  body = excluded.body,
  tags = excluded.tags;

insert into public.event_documents (id, source_type, source_id, title, body, tags)
select
  'deadline:' || id,
  'deadline',
  id,
  title,
  concat_ws(' ', title, detail, severity),
  array[]::text[]
from public.deadlines
on conflict (id) do update set
  title = excluded.title,
  body = excluded.body,
  tags = excluded.tags;

insert into public.event_documents (id, source_type, source_id, title, body, tags)
select
  'venue:' || id,
  'venue',
  id,
  name,
  concat_ws(' ', name, area, travel_note),
  array['venue', area]
from public.venues
on conflict (id) do update set
  title = excluded.title,
  body = excluded.body,
  tags = excluded.tags;
