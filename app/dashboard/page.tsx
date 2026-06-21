'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { hasKeypair, importBackupKey } from '@/lib/crypto';
import { toast } from 'sonner';

import { LogOut, Key, ShieldCheck, Mail, ShieldAlert, Sparkles, FolderLock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import SecretForm from '@/components/SecretForm';
import SecretCard from '@/components/SecretCard';
import KeyStatusBanner from '@/components/KeyStatusBanner';
import KeyExportModal from '@/components/KeyExportModal';
import AdBanner from '@/components/AdBanner';

import type { DashboardSecret } from '@/lib/types';
import type { EncryptedBackup } from '@/lib/crypto';
import type { User } from '@supabase/supabase-js';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [ownedSecrets, setOwnedSecrets] = useState<DashboardSecret[]>([]);
  const [sharedSecrets, setSharedSecrets] = useState<DashboardSecret[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Payments State
  const [profile, setProfile] = useState<any>(null);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [seatsToBuy, setSeatsToBuy] = useState(1);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Restore Modal State
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [backupFile, setBackupFile] = useState<EncryptedBackup | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchDashboardData = async () => {
    try {
      // 1. Get current authenticated user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) {
        router.push('/auth/login');
        return;
      }
      setUser(currentUser);

      // Fetch user profile to check tier/seats
      const profileRes = await fetch('/api/user');
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData.profile);
      }

      // 2. Check if local P-256 keypair is present
      const keyExists = await hasKeypair();
      setHasKey(keyExists);

      // 3. Fetch secrets (owned & shared)
      const res = await fetch('/api/secrets');
      if (!res.ok) throw new Error('Failed to fetch secrets');
      const data = await res.json();
      
      setOwnedSecrets(data.owned || []);
      setSharedSecrets(data.shared || []);

      // 4. Fetch pending invites
      const { data: invites, error: inviteError } = await supabase
        .from('pending_invites')
        .select('*')
        .eq('invited_by', currentUser.id);

      if (inviteError) {
        console.error('Error fetching invites:', inviteError);
      } else {
        setPendingInvites(invites || []);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to Supabase Realtime for instant sharing/revoking feedback
    const setupRealtimeSubscription = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const channel = supabase
        .channel('dashboard-shares')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'shares', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            toast.info('🔑 A new secret has been shared with you!');
            fetchDashboardData();
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'shares' },
          (payload) => {
            // Since we don't have user_id on delete payload immediately sometimes, 
            // we refresh to check if our shared secrets list changed
            fetchDashboardData();
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'pending_invites', filter: `invited_by=eq.${currentUser.id}` },
          (payload) => {
            fetchDashboardData();
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'pending_invites' },
          (payload) => {
            fetchDashboardData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const pollInterval = setInterval(() => {
      fetchDashboardData();
    }, 10000);

    let unsubscribe: any;
    setupRealtimeSubscription().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(pollInterval);
    };
  }, []);

  const handleCheckout = async () => {
    if (!user) return;
    setIsCheckoutLoading(true);

    try {
      if (!(window as any).Razorpay) {
        toast.error('Razorpay SDK has not loaded yet. If you are using Brave/ad blockers, please disable them and refresh.');
        setIsCheckoutLoading(false);
        return;
      }

      const res = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: 'plan_Pro_1',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to initialize subscription');
      }

      const data = await res.json();

      const options = {
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: 'SecurePass Pro',
        description: 'Pro Tier Subscription (Single User License)',
        handler: async function (response: any) {
          toast.success('Subscription authorized successfully! Updating tier...', { duration: 5000 });
          setIsUpgradeOpen(false);
          // Wait briefly for webhook database trigger to fire, then refresh
          setTimeout(() => {
            fetchDashboardData();
          }, 2000);
        },
        prefill: {
          email: user.email,
        },
        theme: {
          color: '#06b6d4',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Payment initiation failed');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    router.push('/auth/login');
    router.refresh();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.publicKey || !parsed.salt || !parsed.iv || !parsed.ciphertext) {
          throw new Error('Invalid backup file');
        }
        setBackupFile(parsed);
        toast.success('Backup file parsed successfully!');
      } catch (err) {
        toast.error('Invalid backup file structure.');
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupFile || !restorePassphrase) {
      toast.error('Please upload file and enter passphrase');
      return;
    }

    setIsRestoring(true);
    try {
      await importBackupKey(backupFile, restorePassphrase);
      toast.success('Vault key restored successfully!');
      setHasKey(true);
      setIsRestoreOpen(false);
      setRestorePassphrase('');
      setBackupFile(null);
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Restoration failed. Verify passphrase.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('pending_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;
      toast.success('Invitation cancelled');
      fetchDashboardData();
    } catch (err: any) {
      toast.error('Failed to cancel invite');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-400">
        <Sparkles className="h-8 w-8 text-cyan-400 animate-pulse mb-3" />
        <div className="text-sm font-mono tracking-widest text-slate-500">DECRYPTING DASHBOARD...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
      {/* Background decoration */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-slate-950">
              <FolderLock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                SecurePass
              </span>
              <span className="ml-2 text-[10px] text-cyan-400 font-mono tracking-wider">CLIENT-ENCRYPTED</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {profile && (
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                profile.tier === 'pro' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {profile.tier} tier
              </span>
            )}
            {profile?.tier === 'free' && (
              <Button
                onClick={() => setIsUpgradeOpen(true)}
                variant="outline"
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs h-7 px-2.5"
              >
                Upgrade
              </Button>
            )}
            {user && user.email && <KeyExportModal email={user.email} />}
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-xs px-3"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 relative z-10">
        {/* Missing Key Warning */}
        <KeyStatusBanner hasKey={hasKey} onRestoreClick={() => setIsRestoreOpen(true)} />

        {/* Dashboard Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center">
              Vault Dashboard
              {hasKey && <ShieldCheck className="h-5 w-5 text-green-400 ml-2" />}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Active Session: <span className="font-mono text-slate-300">{user?.email}</span>
            </p>
          </div>
          {hasKey && <SecretForm onSuccess={fetchDashboardData} />}
        </div>

        {profile?.tier === 'free' && (
          <div className="mb-6 p-4 rounded-xl border border-slate-900 bg-slate-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Free Tier Usage</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Up to 5 secrets and 1 share per secret are supported on the Free tier.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-xs text-slate-400">Secrets Used:</span>
                <span className="ml-1.5 text-sm font-mono text-cyan-400">{ownedSecrets.length} / 5</span>
              </div>
              <Button
                onClick={() => setIsUpgradeOpen(true)}
                size="sm"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-semibold"
              >
                Go Pro
              </Button>
            </div>
          </div>
        )}

        {profile?.tier === 'free' && (
          <AdBanner onUpgradeClick={() => setIsUpgradeOpen(true)} />
        )}

        {/* Main Sections */}
        <div className="space-y-8">
          {/* Section 1: My Secrets */}
          <div>
            <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-4">
              <h2 className="text-lg font-semibold text-slate-200">My Secrets</h2>
              <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">
                {ownedSecrets.length} stored
              </span>
            </div>
            {ownedSecrets.length === 0 ? (
              <div className="text-center p-8 bg-slate-900/20 border border-slate-900 border-dashed rounded-xl text-slate-500 text-sm">
                No secrets stored yet. Click "Add Secret" to encrypt your first credential.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ownedSecrets.map((secret) => (
                  <SecretCard key={secret.id} secret={secret} />
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Shared with Me */}
          <div>
            <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-4">
              <h2 className="text-lg font-semibold text-slate-200">Shared with Me</h2>
              <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">
                {sharedSecrets.length} shared
              </span>
            </div>
            {sharedSecrets.length === 0 ? (
              <div className="text-center p-8 bg-slate-900/20 border border-slate-900 border-dashed rounded-xl text-slate-500 text-sm">
                No secrets shared with you yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sharedSecrets.map((secret) => (
                  <SecretCard key={secret.id} secret={secret} />
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Pending Invites */}
          {pendingInvites.length > 0 && (
            <div>
              <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-4">
                <h2 className="text-lg font-semibold text-slate-200">Pending Email Invites</h2>
                <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">
                  {pendingInvites.length} pending
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingInvites.map((invite) => (
                  <Card key={invite.id} className="border-slate-800 bg-slate-900/30 backdrop-blur-md flex justify-between items-center p-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-200 flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-cyan-400" />
                        {invite.email}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Invited to access: {invite.secret_name}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleCancelInvite(invite.id)}
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs px-2.5 h-8"
                    >
                      Cancel
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Restore Modal */}
      <Dialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-amber-400">
              <ShieldAlert className="h-5 w-5 mr-2" />
              Restore Cryptographic Key
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Import your password-encrypted backup file to restore key operations in this browser.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRestore} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="restore-file">Backup JSON File</Label>
              <Input
                id="restore-file"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="bg-slate-950 border-slate-800 text-slate-100 file:bg-slate-900 file:text-slate-100 file:border-0 hover:file:bg-slate-800 cursor-pointer text-xs"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restore-passphrase">Vault Passphrase</Label>
              <Input
                id="restore-passphrase"
                type="password"
                placeholder="Passphrase used on signup"
                value={restorePassphrase}
                onChange={(e) => setRestorePassphrase(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500 text-xs"
                required
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-semibold"
                disabled={isRestoring}
              >
                {isRestoring ? 'Restoring...' : 'Restore Key'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upgrade Billing Modal */}
      <Dialog open={isUpgradeOpen} onOpenChange={setIsUpgradeOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-cyan-400">
              <Sparkles className="h-5 w-5 mr-2 text-cyan-400" />
              Upgrade to Pro Tier
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Unlock unlimited secrets, sharing, SAML/OIDC SSO, CLI programmatic tokens, and automated client-side backups.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-slate-950/60 p-4 border border-cyan-500/10 rounded space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Pro Plan Pricing:</span>
                <span className="text-slate-200 font-mono">₹400 / month</span>
              </div>
              <div className="flex justify-between text-xs font-semibold border-t border-slate-800/60 pt-2">
                <span className="text-slate-300">Total recurring amount:</span>
                <span className="text-cyan-400 font-mono">₹400 / month</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                className="text-slate-400 hover:text-slate-300 hover:bg-slate-800 text-xs"
                onClick={() => setIsUpgradeOpen(false)}
                disabled={isCheckoutLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCheckout}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-semibold text-xs"
                disabled={isCheckoutLoading}
              >
                {isCheckoutLoading ? 'Redirecting to Razorpay...' : 'Checkout with Razorpay'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
