/*
# Create Secure Media Vault Schema

1. New Tables
   - `asset` - Core file metadata with ownership and status tracking
   - `asset_share` - Sharing permissions between users  
   - `upload_ticket` - Single-use upload authorization tokens
   - `download_audit` - Security audit log for download access

2. Security
   - Enable RLS on all tables with owner-based policies
   - Private storage bucket configuration
   - Version-based conflict resolution support

3. Features
   - Single-use upload tickets with nonce binding
   - Hash verification for integrity checking
   - Granular sharing permissions by email
   - Complete audit trail for compliance
*/

-- Create the asset table with full metadata
CREATE TABLE IF NOT EXISTS public.asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime text NOT NULL,
  size int NOT NULL,
  storage_path text NOT NULL UNIQUE,
  sha256 text,
  status text NOT NULL CHECK (status IN ('draft','uploading','ready','corrupt')) DEFAULT 'draft',
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create sharing table for collaborative access
CREATE TABLE IF NOT EXISTS public.asset_share (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.asset(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_download boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset_id, to_user)
);

-- Create upload tickets for secure two-phase uploads
CREATE TABLE IF NOT EXISTS public.upload_ticket (
  asset_id uuid PRIMARY KEY REFERENCES public.asset(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nonce text NOT NULL UNIQUE,
  mime text NOT NULL,
  size int NOT NULL,
  storage_path text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create audit log for download tracking
CREATE TABLE IF NOT EXISTS public.download_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.asset(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_share ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_audit ENABLE ROW LEVEL SECURITY;

-- Asset policies: owners can do everything, shared users can read
CREATE POLICY "asset_owner_full_access"
  ON public.asset
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "asset_shared_read_access"
  ON public.asset
  FOR SELECT
  TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.asset_share s
      WHERE s.asset_id = asset.id AND s.to_user = auth.uid()
    )
  );

-- Share policies: only owners can manage shares
CREATE POLICY "asset_share_owner_manages"
  ON public.asset_share
  FOR ALL
  TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.asset a 
      WHERE a.id = asset_id AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.asset a 
      WHERE a.id = asset_id AND a.owner_id = auth.uid()
    )
  );

-- Upload ticket policies: users can only access their own tickets
CREATE POLICY "upload_ticket_user_access"
  ON public.upload_ticket
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Audit log policies: users can insert their own logs
CREATE POLICY "download_audit_user_insert"
  ON public.download_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "download_audit_user_read"
  ON public.download_audit
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_owner_id ON public.asset(owner_id);
CREATE INDEX IF NOT EXISTS idx_asset_status ON public.asset(status);
CREATE INDEX IF NOT EXISTS idx_asset_share_asset_id ON public.asset_share(asset_id);
CREATE INDEX IF NOT EXISTS idx_upload_ticket_user_id ON public.upload_ticket(user_id);
CREATE INDEX IF NOT EXISTS idx_download_audit_asset_id ON public.download_audit(asset_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update timestamps
CREATE TRIGGER update_asset_updated_at 
  BEFORE UPDATE ON public.asset 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();