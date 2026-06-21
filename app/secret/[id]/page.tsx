'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { decryptSecret, hasKeypair } from '@/lib/crypto';
import { toast } from 'sonner';

import { ArrowLeft, Key, Eye, EyeOff, ShieldAlert, Calendar, User, Users, Trash2, Clock, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import ShareModal from '@/components/ShareModal';
import CopyButton from '@/components/CopyButton';

export default function SecretDetailPage() {
  const router = useRouter();
  const params = useParams();
  const secretId = params.id as string;
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [hasKey, setHasKey] = useState<boolean>(true);
  
  const [secret, setSecret] = useState<any>(null);
  const [shares, setShares] = useState<any[]>([]);
  const [plaintext, setPlaintext] = useState<string>('');
  const [showPlaintext, setShowPlaintext] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchSecretDetails = async () => {
    try {
      // 1. Get user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) {
        router.push('/auth/login');
        return;
      }
      setUser(currentUser);

      // 2. Check keys
      const keyExists = await hasKeypair();
      setHasKey(keyExists);

      // 3. Fetch secret details (handles owned/shared database queries)
      const res = await fetch('/api/secrets');
      if (!res.ok) throw new Error('Failed to fetch secrets');
      const data = await res.json();
      
      const allSecrets = [...(data.owned || []), ...(data.shared || [])];
      const currentSecret = allSecrets.find(s => s.id === secretId);

      if (!currentSecret) {
        toast.error('Secret not found or access denied');
        router.push('/dashboard');
        return;
      }
      setSecret(currentSecret);

      // 4. If owner, fetch who this secret is shared with
      if (currentSecret.owner_id === currentUser.id) {
        const { data: shareList, error: shareError } = await supabase
          .from('shares')
          .select('id, user_id, created_at, users(email)')
          .eq('secret_id', secretId);

        if (shareError) {
          console.error('Error fetching shares:', shareError);
        } else {
          setShares(shareList || []);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error loading secret details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSecretDetails();

    // Subscribe to realtime deletion of shares for instant revocation redirection
    const setupRealtimeSubscription = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const channel = supabase
        .channel(`secret-revocation-${secretId}`)
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'shares', filter: `secret_id=eq.${secretId}` },
          (payload) => {
            // If the deleted share belongs to the current user
            if (payload.old.user_id === currentUser.id) {
              toast.error('🔒 Access revoked! The owner has removed your permission to view this secret.', { duration: 5000 });
              // Clear cache
              setPlaintext('');
              setShowPlaintext(false);
              router.push('/dashboard');
              router.refresh();
            } else {
              // Otherwise, update share list for owner
              fetchSecretDetails();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const pollInterval = setInterval(() => {
      fetchSecretDetails();
    }, 10000);

    let unsubscribe: any;
    setupRealtimeSubscription().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(pollInterval);
    };
  }, [secretId]);

  const handleDecrypt = async () => {
    if (!secret || !hasKey) {
      toast.error('Vault key is missing. Cannot decrypt.');
      return;
    }
    
    setIsDecrypting(true);
    try {
      // Run SubtleCrypto ECIES decryption locally
      const decrypted = await decryptSecret(secret.encrypted_blob);
      setPlaintext(decrypted);
      setShowPlaintext(true);
      toast.success('Decrypted successfully!');
      
      // Log accessed activity (local log insert)
      const ipAddress = '127.0.0.1'; // Simple local log, actual IP processed on api routes
      const timestamp = new Date().toISOString();
      await supabase.from('audit_log').insert({
        action: 'accessed',
        user_id: user.id,
        secret_id: secretId,
        target_user_id: null,
        ip_address: ipAddress,
        created_at: timestamp,
      });
    } catch (err: any) {
      console.error(err);
      toast.error('Decryption failed. Ensure backup key is imported correctly.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleRevokeShare = async (userId: string, userEmail: string) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/secrets/${secretId}/share/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Revocation failed');
      
      toast.success(`Access revoked for ${userEmail}`);
      fetchSecretDetails();
    } catch (err: any) {
      toast.error('Failed to revoke access');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteSecret = async () => {
    if (!confirm('Are you sure you want to delete this secret? This will revoke all shares.')) return;
    
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/secrets/${secretId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Deletion failed');

      toast.success('Secret deleted successfully');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error('Failed to delete secret');
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-400">
        <Clock className="h-8 w-8 text-cyan-400 animate-spin mb-3" />
        <div className="text-sm font-mono tracking-widest text-slate-500">LOADING VAULT SECRETS...</div>
      </div>
    );
  }

  if (!secret) return null;

  const isOwner = secret.owner_id === user?.id;

  return (
    <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
      {/* Background decoration */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center space-x-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-900 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold text-slate-300">Back to Dashboard</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 relative z-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-900">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-bold text-slate-100">{secret.name}</h1>
              {isOwner ? (
                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px]">
                  Owner
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                  Shared
                </Badge>
              )}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-4">
              <span className="flex items-center"><Calendar className="h-3.5 w-3.5 mr-1" /> {new Date(secret.created_at).toLocaleDateString()}</span>
              {!isOwner && <span className="flex items-center"><User className="h-3.5 w-3.5 mr-1" /> Owner: {secret.owner_email}</span>}
            </div>
          </div>

          <div className="flex gap-2">
            {isOwner && (
              <>
                <Link href={`/audit-log?secretId=${secretId}`}>
                  <Button variant="outline" className="border-slate-800 hover:bg-slate-800 text-slate-300">
                    <ListChecks className="h-4 w-4 mr-2" />
                    Audit Log
                  </Button>
                </Link>
                <ShareModal 
                  secretId={secretId}
                  secretName={secret.name}
                  encryptedBlob={secret.encrypted_blob}
                  onSuccess={fetchSecretDetails}
                />
              </>
            )}
          </div>
        </div>

        {/* Decryption Card */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-slate-400">ENCRYPTED VALUE</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Plaintext is decrypted dynamically in-memory using Web Crypto API. It is never sent to the server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showPlaintext ? (
              <div className="flex flex-col items-center justify-center py-6 bg-slate-950/60 border border-slate-800/80 rounded-lg gap-3">
                <div className="text-[10px] font-mono text-slate-600 truncate max-w-md w-full px-4 text-center">
                  Ciphertext: {secret.encrypted_blob.ciphertext.substring(0, 40)}...
                </div>
                <Button
                  onClick={handleDecrypt}
                  disabled={isDecrypting || !hasKey}
                  className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs h-9 px-4"
                >
                  <Key className="h-3.5 w-3.5 mr-1.5" />
                  {isDecrypting ? 'Decrypting locally...' : 'Decrypt Secret'}
                </Button>
                {!hasKey && (
                  <p className="text-[10px] text-amber-500 flex items-center">
                    <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                    Import your backup vault key to decrypt.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-950 border border-slate-800 px-4 py-3 rounded-lg font-mono text-sm text-cyan-400 break-all select-all flex items-center justify-between">
                  <span>{plaintext}</span>
                  <button onClick={() => setShowPlaintext(false)} className="text-slate-500 hover:text-slate-300 ml-2">
                    <EyeOff className="h-4 w-4" />
                  </button>
                </div>
                <CopyButton text={plaintext} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Share Management Section (Owner Only) */}
        {isOwner && (
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-300 flex items-center">
                <Users className="h-4.5 w-4.5 mr-1.5 text-cyan-400" />
                Access Permissions ({shares.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Manage who has cryptographic access to this secret. Revoking delete's their unique ECIES shared key.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shares.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-xs">
                  This secret is not shared with anyone yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {shares.map((share) => (
                    <div key={share.id} className="py-3 flex justify-between items-center first:pt-0 last:pb-0">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium text-slate-300">{share.users?.email}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Shared: {new Date(share.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleRevokeShare(share.user_id, share.users?.email)}
                        disabled={isActionLoading}
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs h-8 px-2.5"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Revoke Access
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Danger Zone */}
        {isOwner && (
          <div className="pt-4">
            <Separator className="bg-slate-900 mb-6" />
            <div className="flex justify-between items-center p-4 border border-red-500/20 bg-red-500/5 rounded-xl">
              <div>
                <h4 className="text-sm font-semibold text-red-400">Delete Secret</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Permanently delete this secret and revoke all active team shares. This action is irreversible.
                </p>
              </div>
              <Button
                onClick={handleDeleteSecret}
                disabled={isActionLoading}
                className="bg-red-500/10 border border-red-500/30 hover:bg-red-500 hover:text-slate-950 text-red-400 font-semibold text-xs"
              >
                Delete Vault Secret
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
