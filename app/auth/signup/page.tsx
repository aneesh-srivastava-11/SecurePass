'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { generateKeypair } from '@/lib/crypto';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderLock } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [signupStep, setSignupStep] = useState<'form' | 'backup'>('form');
  const [backupData, setBackupData] = useState<any>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !passphrase) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (passphrase.length < 8) {
      toast.error('Vault passphrase must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    
    try {
      // 1. Sign up user via Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        toast.error(authError.message);
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error('Signup failed. Please try again.');
        setIsLoading(false);
        return;
      }

      // 2. Generate browser P-256 keypair & encrypted backup
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeUserEmail', email.trim().toLowerCase());
      }
      const { publicKeyBase64, backup } = await generateKeypair(passphrase);
      setBackupData(backup);

      // 3. Store public key in public.users database
      const response = await fetch('/api/user/public-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: publicKeyBase64 }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save public key');
      }

      toast.success('Account created successfully!');
      
      // Move to backup download step
      setSignupStep('backup');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'An error occurred during signup');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadBackup = () => {
    if (!backupData) return;
    
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `securepass-backup-${email.split('@')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Backup file downloaded!');
    
    // Proceed to dashboard
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-zinc-950 min-h-screen relative overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <Card className="w-full max-w-md border-zinc-900 bg-zinc-950 relative z-10 rounded-xl">
        {signupStep === 'form' ? (
          <form onSubmit={handleSignup}>
            <CardHeader className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">
                  <FolderLock className="h-4.5 w-4.5" />
                </div>
                <span className="text-sm font-bold text-zinc-100">
                  SecurePass
                </span>
                <span className="text-[9px] text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                  Zero-Trust
                </span>
              </div>
              <CardTitle className="text-lg font-bold tracking-tight pt-2">Create team account</CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                All credentials are encrypted locally on your machine before database storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs text-zinc-400">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-650 focus-visible:ring-cyan-500 text-xs rounded-lg"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs text-zinc-400">Login Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-650 focus-visible:ring-cyan-500 text-xs rounded-lg"
                  required
                />
              </div>
              <div className="space-y-2 pt-3 border-t border-zinc-900">
                <div className="flex justify-between items-center">
                  <Label htmlFor="passphrase" className="text-xs text-zinc-300">Vault Passphrase</Label>
                  <span className="text-[9px] text-cyan-500 font-mono tracking-wide uppercase">Browser Key Encryption</span>
                </div>
                <Input
                  id="passphrase"
                  type="password"
                  placeholder="Minimum 8 characters (different from password)"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-cyan-500 text-xs rounded-lg"
                  required
                />
                <p className="text-[10px] text-zinc-500 leading-relaxed pt-1.5">
                  ⚠️ This passphrase encrypts your local P-256 private key. We never see or store this, and if you lose it, your backup is unrecoverable.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-semibold text-xs h-10 rounded-lg transition-colors"
                disabled={isLoading}
              >
                {isLoading ? 'Generating Keys...' : 'Sign Up & Generate Keypair'}
              </Button>
              <div className="text-xs text-zinc-500 text-center">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-cyan-400 hover:underline">
                  Log in
                </Link>
              </div>
            </CardFooter>
          </form>
        ) : (
          <div className="p-6 text-center space-y-6">
            <CardHeader className="p-0">
              <div className="mx-auto w-10 h-10 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center text-lg border border-cyan-500/20">
                🔑
              </div>
              <CardTitle className="text-lg font-bold mt-4 tracking-tight">Save Cryptographic Backup</CardTitle>
              <CardDescription className="text-zinc-400 text-xs leading-relaxed">
                Your vault private key is stored inside IndexedDB. You will need this backup file to recover your keys if you clear cookies or use a new device.
              </CardDescription>
            </CardHeader>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg text-left font-mono text-[10px] overflow-x-auto text-zinc-500 max-h-[100px]">
              {JSON.stringify({
                publicKey: backupData?.publicKey?.substring(0, 30) + '...',
                salt: backupData?.salt?.substring(0, 15) + '...',
                ciphertext: 'AES_GCM_ENCRYPTED_PRIVATE_KEY_PAYLOAD'
              }, null, 2)}
            </div>
            <div className="space-y-4 pt-2">
              <Button 
                onClick={downloadBackup}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-semibold text-xs h-10 rounded-lg transition-colors"
              >
                Download Backup JSON
              </Button>
              <Button 
                variant="link" 
                onClick={() => {
                  router.push('/dashboard');
                  router.refresh();
                }}
                className="text-zinc-500 hover:text-zinc-400 text-xs"
              >
                Skip (not recommended)
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
