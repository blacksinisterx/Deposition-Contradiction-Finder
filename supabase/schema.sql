-- Deposition Contradiction Finder schema

create extension if not exists pgcrypto;

create table cases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  witness_name text not null,
  deposition_date date,
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  created_at timestamptz not null default now()
);

create table analyses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  progress jsonb not null default '[]',   -- node-progress events; browser reads via Realtime
  started_at timestamptz,
  completed_at timestamptz
);

create table claims (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  witness_name text not null,
  page integer not null,
  line integer not null,
  claim_text text not null,
  about_person text not null default '',
  topic_tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table contradictions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  claim_a_id uuid references claims(id) on delete cascade,
  claim_b_id uuid references claims(id) on delete cascade,
  status text not null check (status in ('confirmed', 'consistent', 'needs_review')),
  severity text not null check (severity in ('high', 'medium', 'low')),
  reasoning text not null,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  contradiction_id uuid references contradictions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index documents_case_id_idx on documents(case_id);
create index claims_document_id_idx on claims(document_id);
create index contradictions_case_id_idx on contradictions(case_id);
create index messages_contradiction_id_idx on messages(contradiction_id);

-- Row Level Security: agent writes via service role (bypasses RLS).
-- Browser reads via publishable key are read-only for the demo (single-tenant, no auth).
alter table cases enable row level security;
alter table documents enable row level security;
alter table analyses enable row level security;
alter table claims enable row level security;
alter table contradictions enable row level security;
alter table messages enable row level security;

create policy "public read cases" on cases for select using (true);
create policy "public read documents" on documents for select using (true);
create policy "public read analyses" on analyses for select using (true);
create policy "public read claims" on claims for select using (true);
create policy "public read contradictions" on contradictions for select using (true);
create policy "public read messages" on messages for select using (true);

-- Realtime: browser subscribes to analysis progress updates.
alter publication supabase_realtime add table analyses;

-- Storage: browser uploads deposition files directly here (bypasses Vercel's
-- request body limit), then the GitHub Actions job downloads them via the
-- service role key (bypasses RLS, no policy needed for that side).
insert into storage.buckets (id, name, public)
values ('deposition-uploads', 'deposition-uploads', false)
on conflict (id) do nothing;

create policy "anon can upload depositions"
on storage.objects for insert
to anon
with check (bucket_id = 'deposition-uploads');
