'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { hasKeypair, importBackupKey } from '@/lib/crypto';
import { toast } from 'sonner';

import { 
  LayoutDashboard, 
  Key, 
  Users, 
  Activity, 
  CreditCard, 
  Settings, 
  Search, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  ShieldAlert, 
  LogOut, 
  Sparkles, 
  Mail, 
  ExternalLink,
  Lock,
  ChevronRight,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

import SecretForm from '@/components/SecretForm';
import KeyStatusBanner from '@/components/KeyStatusBanner';
import KeyExportModal from '@/components/KeyExportModal';
import AdBanner from '@/components/AdBanner';

import type { DashboardSecret } from '@/lib/types';
import type { EncryptedBackup } from '@/lib/crypto';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';

type TabType = 'dashboard' | 'secrets' | 'shared' | 'audit-logs' | 'team' | 'billing' | 'settings';

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
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Restore Modal State
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [backupFile, setBackupFile] = useState<EncryptedBackup | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // UI Navigation states
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDashboardData = async () => {
    try {
      // 1. Get current authenticated user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) {
        router.push('/auth/login');
        return;
      }
      setUser(currentUser);
      if (typeof window !== 'undefined' && currentUser.email) {
        localStorage.setItem('activeUserEmail', currentUser.email.trim().toLowerCase());
      }

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
        .channel(`dashboard-shares-${currentUser.id}-${Math.random().toString(36).substring(2, 9)}`)
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

  const handleDeleteSecret = async (secretId: string) => {
    if (!confirm('Are you sure you want to delete this secret? This will revoke all shares.')) return;
    try {
      const res = await fetch(`/api/secrets/${secretId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Deletion failed');
      toast.success('Secret deleted successfully');
      fetchDashboardData();
    } catch (err: any) {
      toast.error('Failed to delete secret');
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
      if (typeof window !== 'undefined' && user?.email) {
        localStorage.setItem('activeUserEmail', user.email.trim().toLowerCase());
      }
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-400 min-h-screen font-mono">
        <Sparkles className="h-6 w-6 text-cyan-400 animate-pulse mb-3" />
        <div className="text-xs tracking-widest text-zinc-500">DECRYPTING SECURE VAULT...</div>
      </div>
    );
  }

  // Filter secrets globally based on search query
  const filteredOwned = ownedSecrets.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredShared = sharedSecrets.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalSecretsCount = ownedSecrets.length + sharedSecrets.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans antialiased">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-zinc-900 bg-zinc-950 flex flex-col justify-between select-none">
        <div className="p-6 space-y-6">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2.5 hover:opacity-80 transition-opacity">
            <div className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
              <Lock className="h-4.5 w-4.5" />
            </div>
            <span className="font-bold tracking-tight text-zinc-200">SecurePass</span>
          </Link>

          {/* Navigation Items */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('secrets')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'secrets'
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Key className="h-4 w-4" />
              <span>My Secrets</span>
              <span className="ml-auto bg-zinc-900 text-zinc-500 text-[10px] px-1.5 py-0.5 rounded font-mono border border-zinc-800/80">
                {ownedSecrets.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('shared')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'shared'
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Shared Secrets</span>
              <span className="ml-auto bg-zinc-900 text-zinc-500 text-[10px] px-1.5 py-0.5 rounded font-mono border border-zinc-800/80">
                {sharedSecrets.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('audit-logs')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'audit-logs'
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Audit Logs</span>
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'team'
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Mail className="h-4 w-4" />
              <span>Team Invites</span>
              {pendingInvites.length > 0 && (
                <span className="ml-auto bg-cyan-950/50 text-cyan-400 text-[10px] px-1.5 py-0.5 rounded font-mono border border-cyan-500/20">
                  {pendingInvites.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'billing'
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>Billing</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* User Block at bottom */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-zinc-300 truncate">{user?.email}</div>
              <div className="text-[9px] font-mono text-zinc-500 capitalize">{profile?.tier} Tier</div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen bg-zinc-950 overflow-y-auto">
        
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between border-b border-zinc-900 px-8 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-30">
          {/* Search bar */}
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search secrets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-cyan-500 text-xs pl-9 h-8.5 rounded-lg"
            />
          </div>

          <div className="flex items-center space-x-3">
            {profile?.tier === 'free' && (
              <Button
                onClick={() => setIsUpgradeOpen(true)}
                variant="outline"
                className="border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/5 text-xs h-7 px-3 rounded-lg"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Go Pro
              </Button>
            )}
            
            {hasKey && <SecretForm onSuccess={fetchDashboardData} />}
          </div>
        </header>

        {/* Content Body */}
        <main className="p-8 max-w-[1200px] w-full mx-auto space-y-6 flex-grow">
          {/* Cryptographic Keypair Warning */}
          <KeyStatusBanner hasKey={hasKey} onRestoreClick={() => setIsRestoreOpen(true)} />

          {/* Render Tab Contents */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-zinc-950 border-zinc-900 rounded-xl">
                  <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium text-zinc-500">Total Secrets</CardTitle>
                    <Key className="h-4 w-4 text-zinc-500" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold font-mono text-zinc-200">{totalSecretsCount}</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-zinc-950 border-zinc-900 rounded-xl">
                  <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium text-zinc-500">Shared With Me</CardTitle>
                    <Users className="h-4 w-4 text-zinc-500" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold font-mono text-zinc-200">{sharedSecrets.length}</div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-950 border-zinc-900 rounded-xl">
                  <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium text-zinc-500">Vault Key Status</CardTitle>
                    <ShieldCheck className="h-4 w-4 text-zinc-500" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${hasKey ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                    <div className="text-xs font-semibold text-zinc-300">
                      {hasKey ? 'Securely Loaded' : 'Action Required'}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-950 border-zinc-900 rounded-xl">
                  <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium text-zinc-500">Security Health</CardTitle>
                    <Activity className="h-4 w-4 text-zinc-500" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold font-mono text-zinc-200">
                      {hasKey ? '98%' : '15%'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Free Tier Usage Limits */}
              {profile?.tier === 'free' && (
                <Card className="bg-zinc-950 border-zinc-900 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-zinc-300">Free Tier Usage Monitor</h4>
                    <p className="text-xs text-zinc-500">
                      Free tier accounts are capped at 5 secrets and 1 share per secret.
                    </p>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <span className="text-xs text-zinc-500">Secrets Used:</span>
                      <span className="ml-2 text-sm font-bold font-mono text-cyan-400">
                        {ownedSecrets.length} / 5
                      </span>
                    </div>
                    <Button
                      onClick={() => setIsUpgradeOpen(true)}
                      size="sm"
                      className="bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold text-xs px-4 h-8 rounded-lg transition-colors"
                    >
                      Go Pro
                    </Button>
                  </div>
                </Card>
              )}

              {profile?.tier === 'free' && (
                <AdBanner onUpgradeClick={() => setIsUpgradeOpen(true)} />
              )}

              {/* Recent Items Listing */}
              <div className="border border-zinc-900 bg-zinc-950 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-900 bg-zinc-950/40 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-zinc-300">My Vault Checklist</h3>
                  <button 
                    onClick={() => setActiveTab('secrets')} 
                    className="text-cyan-400 hover:text-cyan-300 text-xs font-medium"
                  >
                    View All
                  </button>
                </div>
                
                {ownedSecrets.length === 0 ? (
                  <div className="text-center py-10 text-xs text-zinc-500">
                    No secrets stored yet. Click "Add Secret" to encrypt your first credential.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-900 text-zinc-500 font-medium">
                          <th className="p-4">Name</th>
                          <th className="p-4">Type</th>
                          <th className="p-4">Created At</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/40">
                        {ownedSecrets.slice(0, 5).map((secret) => (
                          <tr key={secret.id} className="hover:bg-zinc-900/30 transition-colors">
                            <td className="p-4 font-semibold text-zinc-300 hover:text-cyan-400 cursor-pointer" onClick={() => router.push(`/secret/${secret.id}`)}>
                              {secret.name}
                            </td>
                            <td className="p-4 text-zinc-400 font-mono">AES-GCM-256</td>
                            <td className="p-4 text-zinc-500 font-mono">
                              {new Date(secret.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                              <Link href={`/secret/${secret.id}`}>
                                <Button variant="ghost" className="text-zinc-400 hover:text-zinc-200 h-8 px-2.5">
                                  Decrypt
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === 'secrets' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-zinc-200">My Secrets</h2>
                  <p className="text-xs text-zinc-500">Encrypt and manage credentials owned by your account.</p>
                </div>
              </div>

              <div className="border border-zinc-900 bg-zinc-950 rounded-xl overflow-hidden">
                {filteredOwned.length === 0 ? (
                  <div className="text-center py-12 text-xs text-zinc-500">
                    {searchTerm ? 'No matching secrets found.' : 'No secrets stored yet.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-900 text-zinc-500 font-medium">
                          <th className="p-4">Identifier Name</th>
                          <th className="p-4">Method</th>
                          <th className="p-4">Date Stored</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/40">
                        {filteredOwned.map((secret) => (
                          <tr key={secret.id} className="hover:bg-zinc-900/30 transition-colors">
                            <td className="p-4 font-semibold text-zinc-300 hover:text-cyan-400 cursor-pointer" onClick={() => router.push(`/secret/${secret.id}`)}>
                              {secret.name}
                            </td>
                            <td className="p-4 text-zinc-400 font-mono">AES-GCM-256</td>
                            <td className="p-4 text-zinc-500 font-mono">
                              {new Date(secret.created_at).toLocaleString()}
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <Link href={`/secret/${secret.id}`}>
                                <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300 h-8 px-2.5">
                                  Open
                                </Button>
                              </Link>
                              <Link href={`/audit-log?secretId=${secret.id}`}>
                                <Button variant="ghost" className="text-zinc-400 hover:text-zinc-200 h-8 px-2.5">
                                  Audit
                                </Button>
                              </Link>
                              <Button 
                                onClick={() => handleDeleteSecret(secret.id)}
                                variant="ghost" 
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2.5"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'shared' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-200">Shared with Me</h2>
                <p className="text-xs text-zinc-500">Decrypted using key agreements computed with your public key.</p>
              </div>

              <div className="border border-zinc-900 bg-zinc-950 rounded-xl overflow-hidden">
                {filteredShared.length === 0 ? (
                  <div className="text-center py-12 text-xs text-zinc-500">
                    {searchTerm ? 'No matching shared secrets found.' : 'No shared secrets found.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-900 text-zinc-500 font-medium">
                          <th className="p-4">Name</th>
                          <th className="p-4">Owner Email</th>
                          <th className="p-4">Received Date</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/40">
                        {filteredShared.map((secret) => (
                          <tr key={secret.id} className="hover:bg-zinc-900/30 transition-colors">
                            <td className="p-4 font-semibold text-zinc-300 hover:text-cyan-400 cursor-pointer" onClick={() => router.push(`/secret/${secret.id}`)}>
                              {secret.name}
                            </td>
                            <td className="p-4 text-zinc-400 font-mono">{secret.owner_email || 'Unknown'}</td>
                            <td className="p-4 text-zinc-500 font-mono">
                              {new Date(secret.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                              <Link href={`/secret/${secret.id}`}>
                                <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300 h-8 px-2.5">
                                  Decrypt & View
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'audit-logs' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-200">Cryptographic Commitments</h2>
                <p className="text-xs text-zinc-500">Select a secret to verify its immutable server-signed access trails.</p>
              </div>

              <div className="border border-zinc-900 bg-zinc-950 rounded-xl overflow-hidden">
                {ownedSecrets.length === 0 && sharedSecrets.length === 0 ? (
                  <div className="text-center py-12 text-xs text-zinc-500">
                    No secrets available to verify.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-900 text-zinc-500 font-medium">
                          <th className="p-4">Secret Name</th>
                          <th className="p-4">Role</th>
                          <th className="p-4">Owner Email</th>
                          <th className="p-4 text-right">Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/40">
                        {[...ownedSecrets.map(s => ({ ...s, isShared: false })), ...sharedSecrets.map(s => ({ ...s, isShared: true }))].map((secret) => (
                          <tr key={secret.id} className="hover:bg-zinc-900/30 transition-colors">
                            <td className="p-4 font-semibold text-zinc-300">{secret.name}</td>
                            <td className="p-4 text-zinc-400 uppercase font-mono text-[10px]">
                              {secret.isShared ? 'Shared Access' : 'Owner'}
                            </td>
                            <td className="p-4 text-zinc-500 font-mono">{secret.owner_email || 'You'}</td>
                            <td className="p-4 text-right">
                              <Link href={`/audit-log?secretId=${secret.id}`}>
                                <Button variant="outline" className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 h-8 rounded-lg">
                                  <FileCheck2 className="h-3.5 w-3.5 mr-1" />
                                  Verify Trails
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-200">Pending Invites</h2>
                <p className="text-xs text-zinc-500">Invitations sent to team members. They will receive access upon registration.</p>
              </div>

              <div className="border border-zinc-900 bg-zinc-950 rounded-xl overflow-hidden">
                {pendingInvites.length === 0 ? (
                  <div className="text-center py-12 text-xs text-zinc-500">No active pending invites.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-900 text-zinc-500 font-medium">
                          <th className="p-4">Invited Email</th>
                          <th className="p-4">Secret Name</th>
                          <th className="p-4">Sent Date</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/40">
                        {pendingInvites.map((invite) => (
                          <tr key={invite.id} className="hover:bg-zinc-900/30 transition-colors">
                            <td className="p-4 font-semibold text-zinc-300">{invite.email}</td>
                            <td className="p-4 text-zinc-400 font-mono">{invite.secret_name}</td>
                            <td className="p-4 text-zinc-500 font-mono">
                              {new Date(invite.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                              <Button
                                onClick={() => handleCancelInvite(invite.id)}
                                variant="ghost"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2.5"
                              >
                                Revoke Invite
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-200">Billing Plans</h2>
                <p className="text-xs text-zinc-500">Manage user quotas, collaborators, and platform subscription models.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                {/* Free Plan */}
                <div className="p-6 border border-zinc-900 bg-zinc-950/60 rounded-xl space-y-4 relative flex flex-col justify-between">
                  {profile?.tier === 'free' && (
                    <Badge className="absolute top-4 right-4 bg-cyan-950 text-cyan-400 border-cyan-500/20 font-mono text-[9px]">
                      Active Plan
                    </Badge>
                  )}
                  <div className="space-y-2">
                    <h3 className="font-bold text-sm text-zinc-200">SecurePass Free</h3>
                    <p className="text-xs text-zinc-500">Standard client-side cryptographic storage.</p>
                    <div className="text-2xl font-bold font-mono text-zinc-300 pt-2">₹0 / month</div>
                    <ul className="space-y-2 text-xs text-zinc-400 pt-2 border-t border-zinc-900">
                      <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-500/60" /> Up to 5 secrets</li>
                      <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-500/60" /> 1 share per secret</li>
                    </ul>
                  </div>
                </div>

                {/* Pro Plan */}
                <div className="p-6 border border-zinc-800 bg-zinc-950/60 rounded-xl space-y-4 relative flex flex-col justify-between">
                  {profile?.tier === 'pro' && (
                    <Badge className="absolute top-4 right-4 bg-cyan-950 text-cyan-400 border-cyan-500/20 font-mono text-[9px]">
                      Active Plan
                    </Badge>
                  )}
                  <div className="space-y-2">
                    <h3 className="font-bold text-sm text-zinc-200">SecurePass Pro</h3>
                    <p className="text-xs text-zinc-500">Unlimited vault credentials and team sharing.</p>
                    <div className="text-2xl font-bold font-mono text-zinc-300 pt-2">₹400 / month</div>
                    <ul className="space-y-2 text-xs text-zinc-400 pt-2 border-t border-zinc-900">
                      <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-400" /> Unlimited secrets</li>
                      <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-400" /> Unlimited team collaboration</li>
                      {profile?.tier === 'pro' && (
                        <li className="text-[10px] text-zinc-500 font-mono pt-2 border-t border-zinc-900/60 break-all select-all">
                          Sub ID: {profile.razorpay_subscription_id || 'Active'}
                        </li>
                      )}
                    </ul>
                  </div>

                  {profile?.tier === 'free' && (
                    <Button
                      onClick={handleCheckout}
                      disabled={isCheckoutLoading}
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold text-xs h-9 rounded-lg mt-4 transition-colors"
                    >
                      {isCheckoutLoading ? 'Redirecting...' : 'Upgrade to Pro'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-200">Vault Settings</h2>
                <p className="text-xs text-zinc-500">Manage cryptographic key backups, browser storage initialization, and sessions.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                {/* Backup Key */}
                <Card className="bg-zinc-950 border-zinc-900 rounded-xl p-5 space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-zinc-300">Export Cryptographic Backup</h4>
                    <p className="text-xs text-zinc-500">
                      Export a password-encrypted JSON file containing your P-256 ECIES private key. Necessary to log in from other browsers or devices.
                    </p>
                  </div>
                  {user && user.email && <KeyExportModal email={user.email} />}
                </Card>

                {/* Import / Restore */}
                <Card className="bg-zinc-950 border-zinc-900 rounded-xl p-5 space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-zinc-300">Import Cryptographic Key</h4>
                    <p className="text-xs text-zinc-500">
                      Restore key agreement operations in this browser using your backup JSON file.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsRestoreOpen(true)}
                    variant="outline"
                    className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 text-xs h-9 rounded-lg"
                  >
                    Restore Key Pair
                  </Button>
                </Card>

                {/* Session Management */}
                <Card className="bg-zinc-950 border-zinc-900 rounded-xl p-5 space-y-4 col-span-1 md:col-span-2">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-zinc-300">Session Controls</h4>
                    <p className="text-xs text-zinc-500">
                      You are authenticated as <span className="font-mono text-zinc-300">{user?.email}</span>. Click below to sign out securely.
                    </p>
                  </div>
                  <Button
                    onClick={handleLogout}
                    className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-zinc-950 text-xs font-semibold h-9 rounded-lg transition-all"
                  >
                    Sign Out Securely
                  </Button>
                </Card>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Restore Dialog Modal */}
      <Dialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-amber-500 text-sm">
              <ShieldAlert className="h-5 w-5 mr-2" />
              Restore Cryptographic Key
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Upload your password-encrypted backup JSON file to restore client-side ECIES vault operations in this browser.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRestore} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="restore-file" className="text-xs">Backup JSON File</Label>
              <Input
                id="restore-file"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 file:bg-zinc-800 file:text-zinc-100 file:border-0 hover:file:bg-zinc-700 cursor-pointer text-xs rounded-lg"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restore-passphrase" className="text-xs">Vault Passphrase</Label>
              <Input
                id="restore-passphrase"
                type="password"
                placeholder="Passphrase used on signup"
                value={restorePassphrase}
                onChange={(e) => setRestorePassphrase(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500 text-xs rounded-lg"
                required
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                className="bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold text-xs h-9 rounded-lg"
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
        <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-cyan-400 text-sm">
              <Sparkles className="h-5 w-5 mr-2 text-cyan-400" />
              Upgrade to Pro Tier
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Unlock unlimited secrets, sharing, SAML/OIDC SSO, CLI programmatic tokens, and automated client-side backups.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-zinc-950/60 p-4 border border-cyan-500/10 rounded space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Pro Plan Pricing:</span>
                <span className="text-zinc-200 font-mono">₹400 / month</span>
              </div>
              <div className="flex justify-between text-xs font-semibold border-t border-zinc-800/60 pt-2">
                <span className="text-zinc-300">Total recurring amount:</span>
                <span className="text-cyan-400 font-mono">₹400 / month</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                className="text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 text-xs"
                onClick={() => setIsUpgradeOpen(false)}
                disabled={isCheckoutLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCheckout}
                className="bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold text-xs h-9 rounded-lg"
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
