
-- Add data source tracking columns to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Add data source tracking columns to contacts table
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Add data source tracking columns to deals table
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Create indexes for filtering by data source
CREATE INDEX IF NOT EXISTS idx_clients_data_source ON public.clients(data_source);
CREATE INDEX IF NOT EXISTS idx_contacts_data_source ON public.contacts(data_source);
CREATE INDEX IF NOT EXISTS idx_deals_data_source ON public.deals(data_source);
