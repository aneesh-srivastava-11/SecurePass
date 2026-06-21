-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  -- SPKI-encoded P-256 public key (base64) — safe to store publicly
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. SECRETS
-- ============================================================
CREATE TABLE public.secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- JSON: { ephemeralPublicKey: string, iv: string, ciphertext: string }
  encrypted_blob JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. SHARES
-- ============================================================
CREATE TABLE public.shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID NOT NULL REFERENCES public.secrets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  -- ECIES payload re-encrypted with recipient's public key
  encrypted_key JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, secret_id)
);

-- ============================================================
-- 4. AUDIT LOG (append-only)
-- ============================================================
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('created', 'shared', 'revoked', 'accessed')),
  user_id UUID NOT NULL REFERENCES public.users(id),
  secret_id UUID REFERENCES public.secrets(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ip_address INET,
  signature TEXT,     -- hex-encoded Ed25519 signature
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- ============================================================
-- 5. PENDING INVITES
-- ============================================================
CREATE TABLE public.pending_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by UUID NOT NULL REFERENCES public.users(id),
  email TEXT NOT NULL,
  secret_id UUID NOT NULL REFERENCES public.secrets(id) ON DELETE CASCADE,
  secret_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, secret_id)
);

-- ============================================================
-- RLS POLICIES & SECURITY
-- ============================================================

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_all"     ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "users_self_insert"  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_self_update"  ON public.users FOR UPDATE  USING (auth.uid() = id);

-- secrets
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "secrets_owner_select"  ON public.secrets FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "secrets_shared_select" ON public.secrets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.shares WHERE shares.secret_id = secrets.id AND shares.user_id = auth.uid())
);
CREATE POLICY "secrets_insert"  ON public.secrets FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "secrets_delete"  ON public.secrets FOR DELETE  USING (auth.uid() = owner_id);

-- shares
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shares_recipient_select" ON public.shares FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "shares_owner_insert" ON public.shares FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.secrets WHERE secrets.id = secret_id AND secrets.owner_id = auth.uid())
);
CREATE POLICY "shares_owner_delete" ON public.shares FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.secrets WHERE secrets.id = shares.secret_id AND secrets.owner_id = auth.uid())
);

-- audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_owner_select" ON public.audit_log FOR SELECT USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.secrets WHERE secrets.id = audit_log.secret_id AND secrets.owner_id = auth.uid())
);
CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- pending_invites
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites_owner_select" ON public.pending_invites FOR SELECT USING (auth.uid() = invited_by);
CREATE POLICY "invites_insert"       ON public.pending_invites FOR INSERT WITH CHECK (auth.uid() = invited_by);

-- ============================================================
-- 6. Enable Realtime
-- ============================================================
-- Create the publication if it does not exist, or add tables if it does.
-- In Supabase, supabase_realtime is pre-existing usually, but let's make it robust.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add public.shares if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    JOIN pg_class c ON c.oid = pr.prrelid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'shares'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shares;
  END IF;

  -- Add public.pending_invites if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    JOIN pg_class c ON c.oid = pr.prrelid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'pending_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_invites;
  END IF;
END $$;

-- ============================================================
-- 7. PERFORMANCE INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_secrets_owner_id ON public.secrets(owner_id);
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON public.shares(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_secret_id ON public.audit_log(secret_id);

-- ============================================================
-- 8. TRANSACTIONAL STORED PROCEDURES (RPC)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_secret_with_audit(
  p_id UUID,
  p_name TEXT,
  p_encrypted_blob JSONB,
  p_ip_address INET,
  p_signature TEXT,
  p_timestamp TIMESTAMPTZ
) RETURNS public.secrets AS $$
DECLARE
  v_secret public.secrets;
BEGIN
  -- Insert secret
  INSERT INTO public.secrets (id, owner_id, name, encrypted_blob, created_at)
  VALUES (p_id, auth.uid(), p_name, p_encrypted_blob, p_timestamp)
  RETURNING * INTO v_secret;

  -- Insert audit log
  INSERT INTO public.audit_log (action, user_id, secret_id, target_user_id, ip_address, signature, created_at)
  VALUES ('created', auth.uid(), p_id, NULL, p_ip_address, p_signature, p_timestamp);

  RETURN v_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.share_secret_with_audit(
  p_secret_id UUID,
  p_target_user_id UUID,
  p_encrypted_key JSONB,
  p_ip_address INET,
  p_signature TEXT,
  p_timestamp TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
  -- Verify owner
  IF NOT EXISTS (SELECT 1 FROM public.secrets WHERE id = p_secret_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: You do not own this secret';
  END IF;

  -- Insert share
  INSERT INTO public.shares (secret_id, user_id, encrypted_key, created_at)
  VALUES (p_secret_id, p_target_user_id, p_encrypted_key, p_timestamp);

  -- Insert audit log
  INSERT INTO public.audit_log (action, user_id, secret_id, target_user_id, ip_address, signature, created_at)
  VALUES ('shared', auth.uid(), p_secret_id, p_target_user_id, p_ip_address, p_signature, p_timestamp);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.revoke_share_with_audit(
  p_secret_id UUID,
  p_target_user_id UUID,
  p_ip_address INET,
  p_signature TEXT,
  p_timestamp TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
  -- Verify owner
  IF NOT EXISTS (SELECT 1 FROM public.secrets WHERE id = p_secret_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: You do not own this secret';
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_log (action, user_id, secret_id, target_user_id, ip_address, signature, created_at)
  VALUES ('revoked', auth.uid(), p_secret_id, p_target_user_id, p_ip_address, p_signature, p_timestamp);

  -- Delete share
  DELETE FROM public.shares
  WHERE secret_id = p_secret_id AND user_id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.delete_secret_with_audit(
  p_secret_id UUID,
  p_ip_address INET,
  p_signature TEXT,
  p_timestamp TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
  -- Verify owner
  IF NOT EXISTS (SELECT 1 FROM public.secrets WHERE id = p_secret_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: You do not own this secret';
  END IF;

  -- Insert audit log (gained status BEFORE secret cascade nullifies reference)
  INSERT INTO public.audit_log (action, user_id, secret_id, target_user_id, ip_address, signature, created_at)
  VALUES ('revoked', auth.uid(), p_secret_id, NULL, p_ip_address, p_signature, p_timestamp);

  -- Delete secret
  DELETE FROM public.secrets
  WHERE id = p_secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
