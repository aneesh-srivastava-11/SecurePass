'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { decryptSecret, hasKeypair } from '@/lib/crypto';
import { toast } from 'sonner';

import { 
  ArrowLeft, 
  Key, 
  EyeOff, 
  ShieldAlert, 
  Calendar, 
  User, 
  Users, 
  Trash2, 
  Clock, 
  ListChecks, 
  FolderLock,
  Copy
} from 'lucide-react';

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
      if (typeof window !== 'undefined' && currentUser.email) {
        localStorage.setItem('activeUserEmail', currentUser.email.trim().toLowerCase());
      }

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
        .channel(`secret-revocation-${secretId}-${currentUser.id}-${Math.random().toString(36).substring(2, 9)}`)
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-400 min-h-screen font-mono">
        <Clock className="h-6 w-6 text-cyan-400 animate-pulse mb-3" />
        <div className="text-xs tracking-widest text-zinc-500">DECRYPTING SECRETS...</div>
      </div>
    );
  }

  if (!secret) return null;

  const isOwner = secret.owner_id === user?.id;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased">
      
      {/* Top sticky header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[900px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-200 p-1.5 hover:bg-zinc-900 rounded-lg transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-xs font-medium text-zinc-400 font-mono">Back to Dashboard</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <div className="p-1 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">
              <FolderLock className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight text-xs text-zinc-300">SecurePass Vault</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-[900px] w-full mx-auto px-6 py-10 space-y-6">
        
        {/* Secret Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-900">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">{secret.name}</h1>
              {isOwner ? (
                <Badge variant="outline" className="bg-cyan-500/5 text-cyan-400 border border-cyan-500/15 text-[9px] uppercase tracking-wider font-mono">
                  Owner
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-blue-500/5 text-blue-400 border border-blue-500/15 text-[9px] uppercase tracking-wider font-mono">
                  Shared Access
                </Badge>
              )}
            </div>
            <div className="text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center"><Calendar className="h-3.5 w-3.5 mr-1" /> Created: {new Date(secret.created_at).toLocaleDateString()}</span>
              {!isOwner && <span className="flex items-center"><User className="h-3.5 w-3.5 mr-1" /> Owner: {secret.owner_email}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <Link href={`/audit-log?secretId=${secretId}`}>
                  <Button variant="outline" className="border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs h-9 rounded-lg transition-colors">
                    <ListChecks className="h-4 w-4 mr-1.5" />
                    Audit Trail
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

        {/* Decryption Core Panel */}
        <Card className="border-zinc-900 bg-zinc-950 rounded-xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-zinc-900">
            <CardTitle className="text-xs font-mono tracking-wider uppercase text-zinc-500">Local Ciphertext Verification</CardTitle>
            <CardDescription className="text-xs text-zinc-400 leading-relaxed">
              Plaintext values are strictly decrypted inside your sandboxed browser environment. Cleartext keys are never sent to the network.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {!showPlaintext ? (
              <div className="flex flex-col items-center justify-center py-8 bg-zinc-900/10 border border-zinc-900 rounded-lg gap-4">
                <div className="text-[10px] font-mono text-zinc-600 truncate max-w-lg w-full px-6 text-center select-all">
                  ECIES Ciphertext: {secret.encrypted_blob.ciphertext}
                </div>
                <Button
                  onClick={handleDecrypt}
                  disabled={isDecrypting || !hasKey}
                  className="bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-semibold text-xs h-9 px-5 rounded-lg transition-colors"
                >
                  <Key className="h-3.5 w-3.5 mr-1.5" />
                  {isDecrypting ? 'Decrypting locally...' : 'Decrypt Secret'}
                </Button>
                {!hasKey && (
                  <p className="text-[10px] text-amber-500 flex items-center">
                    <ShieldAlert className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                    Import your vault passphrase backup to perform decryption.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-zinc-900/50 border border-zinc-800 px-4 py-3 rounded-lg font-mono text-sm text-cyan-400 break-all select-all flex items-center justify-between">
                  <span>{plaintext}</span>
                  <button 
                    onClick={() => setShowPlaintext(false)} 
                    className="text-zinc-500 hover:text-zinc-300 p-1 hover:bg-zinc-800 rounded transition-colors"
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                </div>
                <CopyButton text={plaintext} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Access Permissions Management (Owner Only) */}
        {isOwner && (
          <Card className="border-zinc-900 bg-zinc-950 rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-zinc-900">
              <CardTitle className="text-xs font-mono tracking-wider uppercase text-zinc-500">
                Access Permissions ({shares.length})
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Grant or revoke cryptographic shared permissions for this secret.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {shares.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs">
                  This secret is currently isolated. No team members have shared access.
                </div>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {shares.map((share) => (
                    <div key={share.id} className="py-3 flex justify-between items-center first:pt-0 last:pb-0">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-zinc-300">{share.users?.email}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          Shared on: {new Date(share.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleRevokeShare(share.user_id, share.users?.email)}
                        disabled={isActionLoading}
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs h-8 px-2.5 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Revoke Access
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Danger Zone Controls (Owner Only) */}
        {isOwner && (
          <div className="pt-4">
            <Separator className="bg-zinc-900 mb-6" />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 border border-red-900/30 bg-red-950/10 rounded-xl gap-4">
              <div>
                <h4 className="text-sm font-semibold text-red-400">Delete Vault Item</h4>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-md">
                  Permanently delete this secret and destroy all active shared cryptographic user keys. This operation cannot be undone.
                </p>
              </div>
              <Button
                onClick={handleDeleteSecret}
                disabled={isActionLoading}
                className="bg-red-500/10 border border-red-500/30 hover:bg-red-500 hover:text-zinc-950 text-red-400 font-semibold text-xs h-9 px-4 rounded-lg transition-all"
              >
                Delete Secret
              </Button>
            </div>
          </div>
        )}
        
      </main>
    </div>
  );
}
