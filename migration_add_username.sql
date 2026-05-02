-- Add username column to users table
-- Run this in Supabase SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Enforce format at DB level: 3-30 chars, lowercase letters/numbers/underscores
ALTER TABLE public.users
  ADD CONSTRAINT IF NOT EXISTS users_username_format
  CHECK (username IS NULL OR (username ~ '^[a-z0-9_]{3,30}$'));

-- Index for fast username lookups (kit URL resolution and login)
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);
