'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { verifyAuditEntry } from '@/lib/verify';
import { toast } from 'sonner';
import Link from 'next/link';

import { 
  ArrowLeft, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Download, 
  Server, 
  Terminal, 
  Activity, 
  FolderLock,
  ChevronRight
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

function AuditLogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const secretId = searchParams.get('secretId');
  const supabase = createClient();

  const [secret, setSecret] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationMap, setVerificationMap] = useState<Record<number, boolean>>({});
  const [serverPublicKey, setServerPublicKey] = useState('');

  const fetchLogs = async () => {
    if (!secretId) {
      router.push('/dashboard');
      return;
    }

    try {
      // 1. Get server public key from environment (via client safe NEXT_PUBLIC prefix)
      const pubKey = process.env.NEXT_PUBLIC_SERVER_SIGNING_PUBLIC_KEY;
      if (!pubKey) {
        throw new Error('NEXT_PUBLIC_SERVER_SIGNING_PUBLIC_KEY is not defined in the client environment');
      }
      setServerPublicKey(pubKey);

      // 2. Fetch secret info
      const { data: secretData, error: secretError } = await supabase
        .from('secrets')
        .select('name')
        .eq('id', secretId)
        .single();

      if (secretError || !secretData) {
        toast.error('Secret not found or access denied');
        router.push('/dashboard');
        return;
      }
      setSecret(secretData);

      // 3. Fetch audit logs from our API
      const res = await fetch(`/api/audit-log/${secretId}`);
      if (!res.ok) throw new Error('Failed to load audit logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load audit log data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [secretId]);

  const handleVerifyAll = async () => {
    setIsVerifying(true);
    const newMap: Record<number, boolean> = {};
    
    try {
      // Verify each log entry client-side
      for (const log of logs) {
        // Only verify rows that actually have a signature (created, shared, revoked)
        if (!log.signature) {
          continue;
        }

        const isValid = await verifyAuditEntry(log);
        newMap[log.id] = isValid;
      }
      
      setVerificationMap(newMap);
      toast.success('Cryptographic verification completed!');
    } catch (err) {
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const downloadLogs = () => {
    const jsonStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `securepass-audit-log-${secret?.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Audit log downloaded!');
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-400 min-h-screen font-mono">
        <Activity className="h-6 w-6 text-cyan-400 animate-pulse mb-3" />
        <div className="text-xs tracking-widest text-zinc-500">RESOLVING AUDIT TIMELINE...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased">
      
      {/* Top sticky header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[900px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href={`/secret/${secretId}`} className="text-zinc-400 hover:text-zinc-200 p-1.5 hover:bg-zinc-900 rounded-lg transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-xs font-medium text-zinc-400 font-mono">Back to Secret</span>
          </div>
          
          <Button onClick={downloadLogs} variant="outline" className="border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs h-8.5 rounded-lg transition-colors">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Log
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-[900px] w-full mx-auto px-6 py-10 space-y-6">
        
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-900">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Cryptographic Audit trail</h1>
            <p className="text-xs text-zinc-500">
              Secret: <span className="font-mono text-cyan-400">{secret?.name}</span>
            </p>
          </div>
          
          <Button
            onClick={handleVerifyAll}
            disabled={isVerifying || logs.length === 0}
            className="bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-semibold text-xs h-9 px-4 rounded-lg transition-colors"
          >
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            {isVerifying ? 'Verifying...' : 'Verify Signatures'}
          </Button>
        </div>

        {/* Server Public Key Banner */}
        <Card className="border-zinc-900 bg-zinc-950 rounded-xl overflow-hidden">
          <CardHeader className="p-5">
            <CardTitle className="text-xs font-mono tracking-wider uppercase text-zinc-500 flex items-center">
              <Server className="h-4 w-4 mr-1.5 text-cyan-400" />
              Server Signature Public Key (Ed25519)
            </CardTitle>
            <CardDescription className="text-[10px] text-zinc-500 font-mono break-all mt-2 bg-zinc-900/40 p-2.5 border border-zinc-900 rounded-lg select-all">
              {serverPublicKey || 'Loading public key...'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Audit Log Timeline list */}
        <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="text-center py-10 bg-zinc-900/10 border border-zinc-900 border-dashed rounded-xl text-zinc-500 text-xs">
              No audit entries found for this secret.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const isVerified = verificationMap[log.id];
                const hasSignature = !!log.signature;

                return (
                  <Card key={log.id} className="border-zinc-900 bg-zinc-950 rounded-xl overflow-hidden">
                    <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2.5">
                          <Badge 
                            className={`text-[9px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded ${
                              log.action === 'created' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/15' :
                              log.action === 'shared' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15' :
                              log.action === 'revoked' ? 'bg-red-500/10 text-red-400 border border-red-500/15' :
                              'bg-zinc-800 text-zinc-400 border border-zinc-700/60'
                            }`}
                          >
                            {log.action}
                          </Badge>
                          <span className="text-xs text-zinc-500 font-mono flex items-center">
                            <Clock className="h-3.5 w-3.5 mr-1" />
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-sm font-medium text-zinc-300">
                          {log.actor_email}{' '}
                          {log.action === 'created' && 'created this secret.'}
                          {log.action === 'shared' && `shared access with ${log.target_email}.`}
                          {log.action === 'revoked' && (log.target_email ? `revoked access for ${log.target_email}.` : 'revoked the secret.')}
                          {log.action === 'accessed' && 'decrypted and accessed the plaintext.'}
                        </p>

                        <div className="text-[10px] text-zinc-500 font-mono">
                          Client IP Commit: {log.ip_address || 'Unknown'}
                        </div>
                      </div>

                      {/* Signature Status badges */}
                      {hasSignature ? (
                        <div className="self-start md:self-center">
                          {isVerified === undefined ? (
                            <Badge variant="outline" className="border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-mono flex items-center gap-1.5 px-2 py-0.5">
                              <Terminal className="h-3 w-3" />
                              Unverified
                            </Badge>
                          ) : isVerified ? (
                            <Badge variant="outline" className="border-green-500/15 bg-green-500/5 text-green-400 text-[10px] font-mono flex items-center gap-1.5 px-2 py-0.5">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Commitment Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-500/15 bg-red-500/5 text-red-400 text-[10px] font-mono flex items-center gap-1.5 px-2 py-0.5 animate-bounce">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Invalid Commit
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <div className="self-start md:self-center">
                          <Badge variant="outline" className="border-zinc-900 bg-zinc-950 text-zinc-600 text-[10px] font-mono">
                            No Commit Required
                          </Badge>
                        </div>
                      )}
                    </CardContent>

                    {/* Expandable commitment details */}
                    {hasSignature && (
                      <div className="px-5 pb-4 border-t border-zinc-900/40 pt-2.5 bg-zinc-950">
                        <details className="cursor-pointer group">
                          <summary className="text-[10px] text-zinc-500 font-mono hover:text-zinc-300 transition-colors list-none flex items-center">
                            <span className="mr-1 group-open:rotate-90 transition-transform">▶</span>
                            View Server Commitment Details
                          </summary>
                          <div className="mt-2.5 space-y-2 text-[10px] font-mono text-zinc-500 select-all border-l-2 border-zinc-800 pl-3 py-1.5 leading-relaxed break-all">
                            <div>Payload: {JSON.stringify({
                              action: log.action,
                              userId: log.user_id,
                              secretId: log.secret_id,
                              targetUserId: log.target_user_id,
                              timestamp: log.created_at,
                              ipAddress: log.ip_address
                            })}</div>
                            <div>Signature: {log.signature}</div>
                          </div>
                        </details>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-400 min-h-screen font-mono">
        <Activity className="h-6 w-6 text-cyan-400 animate-pulse mb-3" />
        <div className="text-xs tracking-widest text-zinc-500">LOADING VAULT AUDIT...</div>
      </div>
    }>
      <AuditLogContent />
    </Suspense>
  );
}
