-- ============================================================
-- Evenfield — Supabase Database Setup
-- Run this in your Supabase project's SQL Editor:
--   https://supabase.com/dashboard → SQL Editor → New Query
-- ============================================================

-- ── Watchlist table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
  id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker     TEXT         NOT NULL,
  company    TEXT         DEFAULT '',
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(user_id, ticker)
);

-- ── Row Level Security ────────────────────────────────────────
-- Users can only read/write their own watchlist items.
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlist"
  ON watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist items"
  ON watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist items"
  ON watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- ── Index for fast per-user lookups ──────────────────────────
CREATE INDEX IF NOT EXISTS watchlist_user_id_idx ON watchlist(user_id);

-- ── Verify ───────────────────────────────────────────────────
SELECT 'watchlist table created with RLS policies' AS status;
