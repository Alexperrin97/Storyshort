-- Film Production Organizer - Supabase Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── PROJECTS ──────────────────────────────────────────────────────────────
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  director    text,
  producer    text,
  start_date  date,
  end_date    date,
  share_token text unique default encode(gen_random_bytes(16), 'hex'),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── SCENES ────────────────────────────────────────────────────────────────
create table if not exists scenes (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid references projects(id) on delete cascade not null,
  number             text not null,
  title              text,
  location           text,
  interior_exterior  text check (interior_exterior in ('INT', 'EXT', 'INT/EXT')),
  day_night          text check (day_night in ('JOUR', 'NUIT', 'AUBE', 'CRÉPUSCULE')),
  cast_list          text,
  synopsis           text,
  technical_notes    text,
  status             text default 'à tourner' check (status in ('à tourner', 'en cours', 'tourné', 'à reprendre')),
  estimated_duration integer,
  shoot_date         date,
  order_index        integer default 0,
  created_at         timestamptz default now()
);

-- ─── TEAM MEMBERS ──────────────────────────────────────────────────────────
create table if not exists team_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  name       text not null,
  role       text not null,
  department text not null,
  email      text,
  phone      text,
  notes      text,
  created_at timestamptz default now()
);

-- ─── SHOOTING DAYS ─────────────────────────────────────────────────────────
create table if not exists shooting_days (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  date       date not null,
  location   text,
  call_time  text,
  wrap_time  text,
  general_notes text,
  created_at timestamptz default now()
);

-- ─── INCIDENTS ─────────────────────────────────────────────────────────────
create table if not exists incidents (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid references projects(id) on delete cascade not null,
  date             date not null default current_date,
  time             text,
  incident_type    text not null,
  description      text not null,
  impact           text,
  resolved         boolean default false,
  resolution_notes text,
  created_at       timestamptz default now()
);

-- ─── RUSHES ────────────────────────────────────────────────────────────────
create table if not exists rushes (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references projects(id) on delete cascade not null,
  date            date not null default current_date,
  card_name       text not null,
  size_gb         numeric,
  backed_up       boolean default false,
  backup_location text,
  scenes_covered  text,
  codec           text,
  notes           text,
  created_at      timestamptz default now()
);

-- ─── POST-PROD TASKS ───────────────────────────────────────────────────────
create table if not exists postprod_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade not null,
  title       text not null,
  category    text not null check (category in ('Montage', 'Son', 'Étalonnage', 'VFX', 'Mixage', 'Livraison', 'Autre')),
  assignee    text,
  due_date    date,
  status      text default 'à faire' check (status in ('à faire', 'en cours', 'validé', 'livré')),
  notes       text,
  order_index integer default 0,
  created_at  timestamptz default now()
);

-- ─── BUDGET LINES ──────────────────────────────────────────────────────────
create table if not exists budget_lines (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade not null,
  department  text not null,
  category    text not null,
  description text not null,
  estimated   numeric not null default 0,
  actual      numeric default 0,
  supplier    text,
  notes       text,
  created_at  timestamptz default now()
);

-- ─── ROW LEVEL SECURITY (optional but recommended) ─────────────────────────
-- For now we use share_token-based access, so disable RLS or set permissive policies
alter table projects       enable row level security;
alter table scenes         enable row level security;
alter table team_members   enable row level security;
alter table shooting_days  enable row level security;
alter table incidents      enable row level security;
alter table rushes         enable row level security;
alter table postprod_tasks enable row level security;
alter table budget_lines   enable row level security;

-- Permissive policies (anon key can read/write everything)
-- In production you would add proper auth-based policies
create policy "allow all" on projects       for all using (true) with check (true);
create policy "allow all" on scenes         for all using (true) with check (true);
create policy "allow all" on team_members   for all using (true) with check (true);
create policy "allow all" on shooting_days  for all using (true) with check (true);
create policy "allow all" on incidents      for all using (true) with check (true);
create policy "allow all" on rushes         for all using (true) with check (true);
create policy "allow all" on postprod_tasks for all using (true) with check (true);
create policy "allow all" on budget_lines   for all using (true) with check (true);
