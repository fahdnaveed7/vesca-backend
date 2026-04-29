-- ============================================================
-- Vesca.io — Deal Operating System
-- Run this in your Supabase SQL editor to set up the database.
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
create table if not exists users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text unique not null,
  niche      text,                        -- e.g. "fitness", "tech", "beauty"
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- DEALS
-- ─────────────────────────────────────────────
create type deal_status as enum (
  'new', 'contacted', 'replied', 'negotiating', 'won', 'paid'
);

create table if not exists deals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade not null,
  brand_name text not null,
  status     deal_status not null default 'new',
  notes      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger deals_updated_at
  before update on deals
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────
-- OUTREACH
-- ─────────────────────────────────────────────
create table if not exists outreach (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade not null,
  deal_id    uuid references deals(id) on delete set null,
  brand_name text not null,
  to_email   text not null,
  email_body text not null,
  status     text not null default 'sent',  -- sent | failed
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- MESSAGES  (inbound + outbound)
-- ─────────────────────────────────────────────
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade not null,
  deal_id    uuid references deals(id) on delete set null,
  from_email text,
  from_name  text,
  subject    text,
  body       text not null,
  direction  text not null default 'inbound',  -- inbound | outbound
  brand_name text,
  intent     text,                              -- collab | not_collab
  ai_summary text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- PROPOSALS
-- ─────────────────────────────────────────────
create table if not exists proposals (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references deals(id) on delete cascade not null,
  user_id       uuid references users(id) on delete cascade not null,
  deliverables  text not null,
  price         numeric(10,2) not null,
  timeline      text not null,
  proposal_text text,    -- Claude-generated markdown
  proposal_html text,    -- rendered HTML for PDF
  status        text not null default 'draft',  -- draft | sent
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────
-- PAYMENTS  (dummy — no real processing)
-- ─────────────────────────────────────────────
create table if not exists payments (
  id             uuid primary key default gen_random_uuid(),
  deal_id        uuid references deals(id) on delete cascade not null unique,
  amount         numeric(10,2),
  currency       text default 'USD',
  payment_method text default 'dummy',
  status         text default 'pending',  -- pending | paid
  notes          text,
  created_at     timestamptz default now()
);
