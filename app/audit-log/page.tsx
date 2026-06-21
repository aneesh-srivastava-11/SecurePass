'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { verifyAuditEntry } from '@/lib/verify';
import { toast } from 'sonner';
import Link from 'next/link';

import { ArrowLeft, ShieldCheck, ShieldAlert, Clock, RefreshCw, Download, Server, Terminal, Activity } from 'lucide-react';
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-400">
        <Activity className="h-8 w-8 text-cyan-400 animate-pulse mb-3" />
        <div className="text-sm font-mono tracking-widest text-slate-500">RESOLVING AUDIT TIMELINE...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
      {/* Background decoration */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href={`/secret/${secretId}`} className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-900 rounded-lg">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-sm font-semibold text-slate-300">Back to Secret</span>
          </div>
          <Button onClick={downloadLogs} variant="outline" className="border-slate-800 hover:bg-slate-800 text-slate-300 text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Log
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 relative z-10 space-y-6">
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-900">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center">
              Cryptographic Audit Log
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Secret: <span className="font-mono text-cyan-400">{secret?.name}</span>
            </p>
          </div>
          <Button
            onClick={handleVerifyAll}
            disabled={isVerifying || logs.length === 0}
            className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs"
          >
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            {isVerifying ? 'Verifying...' : 'Verify All Signatures'}
          </Button>
        </div>

        {/* Server Public Key Banner */}
        <Card className="border-slate-800 bg-slate-900/30 backdrop-blur-md">
          <CardHeader className="p-4">
            <CardTitle className="text-xs font-semibold text-slate-300 flex items-center">
              <Server className="h-4 w-4 mr-1.5 text-cyan-400" />
              Server Audit Verification Public Key (Ed25519)
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-500 font-mono break-all mt-1 bg-slate-950 p-2 border border-slate-900 rounded select-all">
              {serverPublicKey || 'Loading key...'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Audit Log Timeline */}
        <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="text-center p-8 bg-slate-900/20 border border-slate-900 border-dashed rounded-xl text-slate-500 text-sm">
              No audit entries found for this secret.
            </div>
          ) : (
            <div className="relative pl-6 border-l border-slate-900 space-y-6">
              {logs.map((log) => {
                const isVerified = verificationMap[log.id];
                const hasSignature = !!log.signature;

                return (
                  <div key={log.id} className="relative">
                    {/* Circle icon on line */}
                    <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                      <div className={`w-1 h-1 rounded-full ${
                        log.action === 'created' ? 'bg-cyan-400' :
                        log.action === 'shared' ? 'bg-blue-400' :
                        log.action === 'revoked' ? 'bg-red-400' :
                        'bg-slate-400'
                      }`} />
                    </div>

                    <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
                      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Badge 
                              className={`text-[9px] uppercase font-mono tracking-wider ${
                                log.action === 'created' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                log.action === 'shared' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                log.action === 'revoked' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {log.action}
                            </Badge>
                            <span className="text-xs text-slate-500 font-mono flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-sm font-medium text-slate-300">
                            {log.actor_email}{' '}
                            {log.action === 'created' && 'created this secret.'}
                            {log.action === 'shared' && `shared access with ${log.target_email}.`}
                            {log.action === 'revoked' && (log.target_email ? `revoked access for ${log.target_email}.` : 'revoked the secret itself.')}
                            {log.action === 'accessed' && 'decrypted and accessed the plaintext.'}
                          </p>

                          <div className="text-[10px] text-slate-500 font-mono">
                            Client IP: {log.ip_address || 'Unknown'}
                          </div>
                        </div>

                        {/* Signature Status */}
                        {hasSignature ? (
                          <div className="self-start md:self-center">
                            {isVerified === undefined ? (
                              <Badge variant="outline" className="border-slate-800 bg-slate-900 text-slate-500 text-[10px] font-mono flex items-center gap-1.5">
                                <Terminal className="h-3 w-3" />
                                Unverified
                              </Badge>
                            ) : isVerified ? (
                              <Badge variant="outline" className="border-green-500/20 bg-green-500/10 text-green-400 text-[10px] font-mono flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Signature Valid
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-red-400 text-[10px] font-mono flex items-center gap-1.5">
                                <ShieldAlert className="h-3.5 w-3.5 animate-bounce" />
                                Sig Invalid / Tampered
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <div className="self-start md:self-center">
                            <Badge variant="outline" className="border-slate-900 bg-slate-950 text-slate-600 text-[10px] font-mono">
                              No Signature Required
                            </Badge>
                          </div>
                        )}
                      </CardContent>

                      {/* Expandable signature details */}
                      {hasSignature && (
                        <div className="px-4 pb-4 border-t border-slate-900/40 pt-2 bg-slate-950/20">
                          <details className="cursor-pointer group">
                            <summary className="text-[10px] text-slate-500 font-mono hover:text-slate-400 transition-colors list-none flex items-center">
                              <span className="mr-1 group-open:rotate-90 transition-transform">▶</span>
                              View Cryptographic Commitment
                            </summary>
                            <div className="mt-2 space-y-2 text-[10px] font-mono text-slate-500 select-all border-l-2 border-slate-800 pl-2 py-1 leading-relaxed break-all">
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
                  </div>
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-400">
        <Activity className="h-8 w-8 text-cyan-400 animate-pulse mb-3" />
        <div className="text-sm font-mono tracking-widest text-slate-500">LOADING VAULT AUDIT...</div>
      </div>
    }>
      <AuditLogContent />
    </Suspense>
  );
}
