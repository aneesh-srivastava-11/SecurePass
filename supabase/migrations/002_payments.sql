-- 1. Create enum for user tier
CREATE TYPE public.user_tier AS ENUM ('free', 'pro');

-- 2. Alter public.users table to add monetization fields
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS tier public.user_tier NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS seats INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;

-- 3. Create Trigger to Enforce Free Tier Secret Limit (max 5 secrets)
CREATE OR REPLACE FUNCTION public.check_secret_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_tier public.user_tier;
  v_count INTEGER;
BEGIN
  -- Get owner tier
  SELECT tier INTO v_tier FROM public.users WHERE id = NEW.owner_id;
  
  IF v_tier = 'free' THEN
    SELECT COUNT(*) INTO v_count FROM public.secrets WHERE owner_id = NEW.owner_id;
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Free tier limit reached: Maximum of 5 secrets allowed. Please upgrade to Pro.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER enforce_secret_limit
BEFORE INSERT ON public.secrets
FOR EACH ROW EXECUTE FUNCTION public.check_secret_limit();

-- 4. Create Trigger to Enforce Free Tier Sharing Limit (max 1 share/invite per secret)
CREATE OR REPLACE FUNCTION public.check_share_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tier public.user_tier;
  v_shares_count INTEGER;
  v_invites_count INTEGER;
BEGIN
  -- Find secret owner and their tier
  SELECT owner_id INTO v_owner_id FROM public.secrets WHERE id = NEW.secret_id;
  SELECT tier INTO v_tier FROM public.users WHERE id = v_owner_id;
  
  IF v_tier = 'free' THEN
    SELECT COUNT(*) INTO v_shares_count FROM public.shares WHERE secret_id = NEW.secret_id;
    SELECT COUNT(*) INTO v_invites_count FROM public.pending_invites WHERE secret_id = NEW.secret_id;
    IF (v_shares_count + v_invites_count) >= 1 THEN
      RAISE EXCEPTION 'Free tier limit reached: Maximum of 1 share/invite per secret allowed. Please upgrade to Pro.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER enforce_share_limit
BEFORE INSERT ON public.shares
FOR EACH ROW EXECUTE FUNCTION public.check_share_limit();

-- 5. Create Trigger to Enforce Free Tier Pending Invites Limit (max 1 share/invite per secret)
CREATE OR REPLACE FUNCTION public.check_pending_invite_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tier public.user_tier;
  v_shares_count INTEGER;
  v_invites_count INTEGER;
BEGIN
  -- Find secret owner and their tier
  SELECT owner_id INTO v_owner_id FROM public.secrets WHERE id = NEW.secret_id;
  SELECT tier INTO v_tier FROM public.users WHERE id = v_owner_id;
  
  IF v_tier = 'free' THEN
    SELECT COUNT(*) INTO v_shares_count FROM public.shares WHERE secret_id = NEW.secret_id;
    SELECT COUNT(*) INTO v_invites_count FROM public.pending_invites WHERE secret_id = NEW.secret_id;
    IF (v_shares_count + v_invites_count) >= 1 THEN
      RAISE EXCEPTION 'Free tier limit reached: Maximum of 1 share/invite per secret allowed. Please upgrade to Pro.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER enforce_pending_invite_limit
BEFORE INSERT ON public.pending_invites
FOR EACH ROW EXECUTE FUNCTION public.check_pending_invite_limit();
