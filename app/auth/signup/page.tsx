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
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/60 backdrop-blur-xl relative z-10">
        {signupStep === 'form' ? (
          <form onSubmit={handleSignup}>
            <CardHeader className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  SecurePass
                </span>
                <span className="text-xs text-cyan-400 border border-cyan-400/30 px-1.5 py-0.5 rounded font-mono">
                  ZERO-TRUST
                </span>
              </div>
              <CardTitle className="text-xl mt-4">Create your team account</CardTitle>
              <CardDescription>
                Secrets are encrypted locally on your device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Login Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500"
                  required
                />
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <div className="flex justify-between items-center">
                  <Label htmlFor="passphrase" className="text-slate-200">Vault Passphrase</Label>
                  <span className="text-[10px] text-cyan-400 font-mono">ENCRYPTION KEY</span>
                </div>
                <Input
                  id="passphrase"
                  type="password"
                  placeholder="At least 8 characters (different from password)"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500"
                  required
                />
                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  ⚠️ This passphrase encrypts your private key. We never see this, and if you forget it, you will lose access to your backup.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-semibold"
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Sign Up & Generate Keys'}
              </Button>
              <div className="text-sm text-slate-400 text-center">
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
              <div className="mx-auto w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center text-2xl">
                🔑
              </div>
              <CardTitle className="text-xl mt-4">Save Your Vault Backup</CardTitle>
              <CardDescription className="text-slate-300">
                Your private vault key is stored securely in this browser's IndexedDB. To log in on another device or restore your vault, you will need this backup file and your Vault Passphrase.
              </CardDescription>
            </CardHeader>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded text-left font-mono text-xs overflow-x-auto text-slate-400">
              {JSON.stringify({
                publicKey: backupData.publicKey.substring(0, 30) + '...',
                salt: backupData.salt.substring(0, 15) + '...',
                ciphertext: 'ENCRYPTED_PRIVATE_KEY_BYTES'
              }, null, 2)}
            </div>
            <div className="space-y-4">
              <Button 
                onClick={downloadBackup}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-semibold"
              >
                Download Backup File
              </Button>
              <Button 
                variant="link" 
                onClick={() => router.push('/dashboard')}
                className="text-slate-400 hover:text-slate-300"
              >
                Skip download (Not recommended)
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
