-- Migration: 20260225_data_source_tracking.sql
-- User Story 7.1: Add data source tracking to clients, contacts, and deals tables
-- Tracks whether records came from external CRMs (HubSpot, Salesforce, etc.) or were created manually

-- ================================
-- Create data_source enum type
-- ================================
DO $$ BEGIN
  CREATE TYPE data_source_type AS ENUM (
    'manual',
    'hubspot',
    'salesforce',
    'zoho',
    'pipedrive'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ================================
-- clients table: add data source tracking
-- All columns nullable — existing records get NULL
-- ================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS data_source data_source_type,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ================================
-- contacts table: add data source tracking
-- All columns nullable — existing records get NULL
-- Note: contacts already has a legacy `source` TEXT column (unrelated)
-- ================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS data_source data_source_type,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ================================
-- deals table: add data source tracking
-- All columns nullable — existing records get NULL
-- Note: deals already has a legacy `source` TEXT column (unrelated)
-- ================================
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS data_source data_source_type,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ================================
-- Performance indexes
-- Enables efficient filtering by data_source and last_synced_at
-- ================================

-- clients indexes
CREATE INDEX IF NOT EXISTS idx_clients_data_source ON public.clients(data_source);
CREATE INDEX IF NOT EXISTS idx_clients_last_synced_at ON public.clients(last_synced_at);

-- contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_data_source ON public.contacts(data_source);
CREATE INDEX IF NOT EXISTS idx_contacts_last_synced_at ON public.contacts(last_synced_at);

-- deals indexes
CREATE INDEX IF NOT EXISTS idx_deals_data_source ON public.deals(data_source);
CREATE INDEX IF NOT EXISTS idx_deals_last_synced_at ON public.deals(last_synced_at);
