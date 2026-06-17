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
  type text not null check (type in ('workshop', 'mentor', 'community', 'hackathon', 'demo', 'deadline', 'break')),
  tags text[] not null default '{}',
  outcome text not null,
  capacity text not null check (capacity in ('open', 'limited', 'nearly-full'))
);

alter table public.event_blocks drop constraint if exists event_blocks_type_check;
alter table public.event_blocks
  add constraint event_blocks_type_check
  check (type in ('workshop', 'mentor', 'community', 'hackathon', 'demo', 'deadline', 'break'));

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

create table if not exists public.saved_recommendations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  profile_id text not null,
  profile_name text not null,
  day text not null,
  selected_time text not null,
  title text not null,
  venue text not null,
  plan_text text not null,
  ai_source text not null default 'deterministic',
  retrieval_source text not null default 'keyword',
  match_score integer not null default 0,
  created_at timestamptz not null default now()
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
alter table public.saved_recommendations enable row level security;
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
drop policy if exists "public read saved recommendations" on public.saved_recommendations;
drop policy if exists "public insert saved recommendations" on public.saved_recommendations;
drop policy if exists "public delete saved recommendations" on public.saved_recommendations;
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
create policy "public read saved recommendations" on public.saved_recommendations for select using (true);
create policy "public insert saved recommendations" on public.saved_recommendations for insert with check (true);
create policy "public delete saved recommendations" on public.saved_recommendations for delete using (true);
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

delete from public.event_documents where source_type in ('event', 'resource', 'mentor', 'deadline', 'venue');

delete from public.event_blocks where id in (
  'kickoff',
  'ai-stack-primer',
  'cloud-deploy',
  'rag-evals',
  'ux-review',
  'community-night',
  'hackathon-floor',
  'demo-coaching',
  'demo-day',
  'awards'
);

delete from public.mentors where id in ('mai', 'khoa', 'linh', 'an');
delete from public.deadlines where id in ('repo-ready', 'video-cut');

insert into public.venues (id, name, area, travel_note, lat, lng) values
  ('main', 'Galaxy Innovation Park', 'Saigon Hi-Tech Park', 'Main on-site venue for Build and Demo days. Plan cross-city travel if coming from District 1.', 10.8522, 106.7843),
  ('cloud-hub', 'AWS Office, Bitexco Tower', 'District 1', 'Day 2 workshop venue at Bitexco Tower. Arrive early for reception and lift check-in.', 10.7717, 106.704),
  ('model-lab', 'VNG Campus', 'District 7', 'Day 3 venue at VNG Campus, Tan Thuan. Budget extra travel time from District 1.', 10.7415, 106.7301),
  ('community', 'Tasco Office', 'Ho Chi Minh City', 'Day 1 venue. Exact check-in details should be verified from Luma or registered-attendee emails.', 10.7769, 106.7009)
on conflict (id) do update set
  name = excluded.name,
  area = excluded.area,
  travel_note = excluded.travel_note,
  lat = excluded.lat,
  lng = excluded.lng;

insert into public.event_blocks (id, day, time, end_time, title, host, venue_id, type, tags, outcome, capacity) values
  ('day1-registration', 1, '09:00', '10:00', 'Registration and welcome', 'AABW', 'community', 'community', array['onboarding', 'check-in', 'orientation'], 'Get checked in and orient around the first workshop day.', 'open'),
  ('byteplus-creation-stack', 1, '10:00', '12:00', 'Render the Next Era of Creation with BytePlus AI Stack', 'BytePlus', 'community', 'workshop', array['creation', 'ai-stack', 'media', 'infrastructure'], 'Understand how BytePlus tools can support AI creation workflows.', 'limited'),
  ('nvidia-inception', 1, '14:00', '14:45', 'Inside NVIDIA Inception Program: How Startups Build & Scale AI Globally', 'NVIDIA', 'community', 'workshop', array['startup', 'scale', 'nvidia', 'infrastructure'], 'Learn how AI startups use NVIDIA Inception to build and scale globally.', 'nearly-full'),
  ('trae-workflow', 1, '15:00', '16:00', 'TRAE in Your Professional Workflow', 'TRAE', 'community', 'workshop', array['developer-tools', 'workflow', 'productivity', 'coding'], 'Apply TRAE to professional build workflows and coding productivity.', 'limited'),
  ('aws-morning-workshop', 2, '09:00', '10:30', 'AWS workshop', 'AWS', 'cloud-hub', 'workshop', array['aws', 'cloud', 'deployment', 'infrastructure'], 'Work through AWS patterns for agentic AI infrastructure and deployment.', 'limited'),
  ('agora-workshop', 2, '10:30', '12:00', 'Agora workshop', 'Agora', 'cloud-hub', 'workshop', array['realtime', 'voice', 'video', 'agents'], 'Explore realtime audio/video infrastructure for interactive agent experiences.', 'limited'),
  ('aws-afternoon-workshop', 2, '13:00', '14:30', 'AWS workshop', 'AWS', 'cloud-hub', 'workshop', array['aws', 'cloud', 'enterprise', 'deployment'], 'Deepen cloud architecture patterns for enterprise-ready AI builds.', 'limited'),
  ('tinyfish-workshop', 2, '14:30', '16:00', 'Tiny Fish workshop', 'Tiny Fish', 'cloud-hub', 'workshop', array['automation', 'agents', 'workflow', 'browser'], 'Learn automation patterns for agent workflows and web tasks.', 'limited'),
  ('aws-evening-workshop', 2, '16:30', '18:00', 'AWS workshop', 'AWS', 'cloud-hub', 'workshop', array['aws', 'cloud', 'scaling', 'deployment'], 'Close the integration day with AWS deployment and scaling guidance.', 'limited'),
  ('ai-gaming-night', 2, '18:00', '20:00', 'AI x Gaming Night', 'AABW', 'cloud-hub', 'community', array['gaming', 'community', 'networking', 'consumer-ai'], 'Meet gaming and interactive AI builders after the integration workshops.', 'open'),
  ('day3-registration', 3, '09:00', '10:00', 'Registration and welcome', 'AABW', 'model-lab', 'community', array['onboarding', 'check-in', 'community'], 'Check in at VNG Campus and prepare for the design day workshops.', 'open'),
  ('apify-developer-economy', 3, '10:00', '12:00', 'Build, Deploy & Monetize AI Agents: The Future of the Developer Economy', 'Apify', 'model-lab', 'workshop', array['agents', 'deployment', 'monetization', 'developer-economy'], 'Learn how to build, deploy, and monetize AI agents.', 'limited'),
  ('langfuse-clickhouse', 3, '12:00', '14:00', 'Langfuse x ClickHouse workshop', 'Langfuse x ClickHouse', 'model-lab', 'workshop', array['observability', 'analytics', 'evaluation', 'data'], 'Connect observability and analytics patterns to improve agent quality.', 'limited'),
  ('gde-design-bottleneck', 3, '14:00', '15:00', 'Beyond Autocomplete: How Agentic AI Solves the Enterprise Design Bottleneck', 'Google Developer Experts', 'model-lab', 'workshop', array['design', 'enterprise', 'agents', 'google'], 'Understand where agentic AI can remove enterprise design bottlenecks.', 'limited'),
  ('tencent-cloud-workshop', 3, '15:00', '17:00', 'Tencent Cloud workshop', 'Tencent Cloud', 'model-lab', 'workshop', array['cloud', 'tencent', 'deployment', 'infrastructure'], 'Explore Tencent Cloud infrastructure for AI products.', 'limited'),
  ('builder-night', 3, '18:00', '20:00', 'Builder Night', 'AABW', 'model-lab', 'community', array['community', 'team-matching', 'networking', 'pitch'], 'Meet collaborators and compare project directions before Build Day.', 'open'),
  ('opening-keynotes', 4, '09:00', '12:00', 'Opening Ceremony and Keynotes', 'AABW', 'main', 'community', array['keynotes', 'onboarding', 'build-day', 'community'], 'Align on the on-site build day and hear the final context before sprinting.', 'open'),
  ('onsite-build-sprint', 4, '13:00', '16:00', 'On-site Build Sprint', 'AABW', 'main', 'hackathon', array['build', 'debug', 'deployment', 'submission'], 'Focus on implementation, integration, and scope control for the final demo.', 'limited'),
  ('expert-parade', 4, '16:00', '18:00', 'Expert Parade', 'AABW', 'main', 'mentor', array['mentor', 'feedback', 'debug', 'enterprise'], 'Get targeted feedback from experts before the final late-night build push.', 'limited'),
  ('networking-night-day4', 4, '18:00', '20:00', 'Networking Night', 'AABW', 'main', 'community', array['networking', 'community', 'mentor', 'enterprise'], 'Meet partners, mentors, and other teams while refining your demo story.', 'open'),
  ('late-night-build', 4, '20:00', '23:00', 'Late Night Build', 'AABW', 'main', 'hackathon', array['build', 'debug', 'demo', 'submission'], 'Stabilize the project before the Demo Day submission deadline.', 'open'),
  ('submission-deadline', 5, '09:00', '10:00', 'Submission Deadline', 'Devpost', 'main', 'deadline', array['submission', 'devpost', 'deadline', 'demo'], 'Submit the final project before demo pitches begin.', 'open'),
  ('demo-pitches', 5, '10:00', '12:00', 'Demo Pitches', 'AABW', 'main', 'demo', array['demo', 'pitch', 'judging', 'enterprise'], 'Present your build to judges and enterprise partners.', 'open'),
  ('awards-ceremony', 5, '16:00', '18:00', 'Awards Ceremony', 'AABW', 'main', 'demo', array['awards', 'judging', 'community', 'deployment'], 'Close the week with winners, awards, and deployment conversations.', 'open'),
  ('networking-night-day5', 5, '18:00', '20:00', 'Networking Night', 'AABW', 'main', 'community', array['networking', 'community', 'enterprise', 'pilot'], 'Continue pilot and deployment conversations after awards.', 'open')
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
  ('cloud-credit', '$1M+ ecosystem perks and credits', 'AABW Tech Partners', 'credit', array['credits', 'infrastructure', 'cloud', 'tools'], 'Registered builders get first access to partner credits, infrastructure, and tooling perks.'),
  ('eval-sheet', 'Workshop RSVP links', 'Luma', 'doc', array['workshop', 'rsvp', 'luma', 'schedule'], 'Reserve individual workshop seats from the daily programme where RSVP links are available.'),
  ('submission-kit', 'Devpost submission checklist', 'Devpost', 'doc', array['submission', 'demo', 'judging', 'pitch'], 'Confirm your track, add teammates, and submit the final project before the Demo Day deadline.'),
  ('community-intros', 'Builder Experience brief', 'GenAI Fund', 'perk', array['builder-experience', 'support', 'deadline', 'workflow'], 'Use the brief to keep Builder Experience tools focused on live builder pain points.')
on conflict (id) do update set
  title = excluded.title,
  partner = excluded.partner,
  type = excluded.type,
  tags = excluded.tags,
  action = excluded.action;

insert into public.mentors (id, name, focus, venue_id, slot, tags) values
  ('aws-desk', 'AWS Builder Desk', 'Cloud infrastructure, deployment, and enterprise-readiness', 'cloud-hub', 'Day 2, 09:00-18:00', array['aws', 'deployment', 'cloud', 'enterprise']),
  ('apify-desk', 'Apify Developer Economy Desk', 'Building, deploying, and monetizing AI agents', 'model-lab', 'Day 3, 10:00-12:00', array['agents', 'deployment', 'monetization', 'developer-economy']),
  ('gde-desk', 'Google Developer Experts', 'Enterprise design bottlenecks and agentic AI patterns', 'model-lab', 'Day 3, 14:00-15:00', array['design', 'enterprise', 'agents', 'google']),
  ('expert-parade', 'Expert Parade', 'Final implementation feedback before Demo Day', 'main', 'Day 4, 16:00', array['mentor', 'debug', 'feedback', 'demo'])
on conflict (id) do update set
  name = excluded.name,
  focus = excluded.focus,
  venue_id = excluded.venue_id,
  slot = excluded.slot,
  tags = excluded.tags;

insert into public.deadlines (id, day, time, title, detail, severity) values
  ('track-confirmation', 3, '21:00', 'Track confirmation on Devpost', 'Confirm your track on Devpost before the July 10, 9:00 PM deadline.', 'high'),
  ('submit', 5, '09:00', 'Submission deadline on Devpost', 'Submit live link, repo, project description, and demo assets before Demo Pitches.', 'critical'),
  ('demo-pitches', 5, '10:00', 'Demo pitches begin', 'Be ready to present and answer judging or enterprise partner questions.', 'normal')
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
