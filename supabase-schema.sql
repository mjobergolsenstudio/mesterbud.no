-- ============================================
-- Mesterbud – Supabase Schema
-- Kjør dette i Supabase SQL Editor
-- ============================================

-- Profiler (en per håndverker)
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade,
  firm text,
  trade text,
  phone text,
  email text,
  org text,
  address text,
  logo text -- base64 eller URL
);

-- Tilbud
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  profile_id uuid references profiles(id) on delete cascade,
  num text not null,
  firm text,
  trade text,
  cust text,
  addr text,
  summary text,
  line_items jsonb,
  sub numeric,
  mva numeric,
  total numeric,
  payment_terms text,
  valid_days integer,
  warranty text,
  notes text,
  status text default 'kladd', -- kladd | sendt | akseptert | avslått
  sent_at timestamptz,
  sent_to text, -- kundens e-post
  signed_by text,
  responded_at timestamptz
);

-- Index for rask oppslag
create index if not exists quotes_profile_id_idx on quotes(profile_id);
create index if not exists quotes_num_idx on quotes(num);
create index if not exists quotes_status_idx on quotes(status);

-- Row Level Security (RLS)
alter table profiles enable row level security;
alter table quotes enable row level security;

-- Auth-baserte RLS policies
create policy "Users can only see own profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can only see own quotes" on quotes
  for all using (
    profile_id in (select id from profiles where user_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where user_id = auth.uid())
  );
