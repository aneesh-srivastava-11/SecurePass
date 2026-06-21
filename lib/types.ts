import type { ECIESPayload } from './crypto';

export interface UserProfile {
  id: string;
  email: string;
  public_key: string;
  created_at: string;
  tier: 'free' | 'pro';
  seats: number;
  razorpay_customer_id?: string;
  razorpay_subscription_id?: string;
}

export interface Secret {
  id: string;
  owner_id: string;
  name: string;
  encrypted_blob: ECIESPayload;
  created_at: string;
}

export interface Share {
  id: string;
  secret_id: string;
  user_id: string;
  encrypted_key: ECIESPayload;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  action: 'created' | 'shared' | 'revoked' | 'accessed';
  user_id: string;
  secret_id: string;
  target_user_id?: string;
  ip_address?: string;
  signature: string;
  created_at: string;
  // Joined fields for UI
  user?: UserProfile;
  target_user?: UserProfile;
  verified?: boolean | 'pending';
}

export interface DashboardSecret extends Secret {
  isShared: boolean;
  owner_email?: string;
}
