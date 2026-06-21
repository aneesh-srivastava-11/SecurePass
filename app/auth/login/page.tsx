'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { hasKeypair, importBackupKey } from '@/lib/crypto';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderLock, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [loginStep, setLoginStep] = useState<'form' | 'restore'>('form');
  const [backupFile, setBackupFile] = useState<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        setIsLoading(false);
        return;
      }

      // Check if browser has the vault keypair
      const keyExists = await hasKeypair();
      if (keyExists) {
        toast.success('Logged in successfully!');
        router.push('/dashboard');
        router.refresh();
      } else {
        // Vault keys missing! Prompt user to upload backup
        toast.warning('Vault key not found in this browser. Please restore your key.');
        setLoginStep('restore');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.publicKey || !parsed.salt || !parsed.iv || !parsed.ciphertext) {
          throw new Error('Invalid backup file format');
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
    if (!backupFile || !passphrase) {
      toast.error('Please upload backup file and enter passphrase');
      return;
    }

    setIsLoading(true);

    try {
      await importBackupKey(backupFile, passphrase);
      toast.success('Vault key restored successfully!');
      router.push('/dashboard');
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to restore vault key. Check your passphrase.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-zinc-950 min-h-screen relative overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md border-zinc-900 bg-zinc-950 relative z-10 rounded-xl">
        {loginStep === 'form' ? (
          <form onSubmit={handleLogin}>
            <CardHeader className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">
                  <FolderLock className="h-4.5 w-4.5" />
                </div>
                <span className="text-sm font-bold text-zinc-100">
                  SecurePass
                </span>
                <span className="text-[9px] text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                  Zero-Knowledge
                </span>
              </div>
              <CardTitle className="text-lg font-bold tracking-tight pt-2">Welcome Back</CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                Log in to decrypt and access your zero-trust secrets.
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
                <Label htmlFor="password" className="text-xs text-zinc-400">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-655 focus-visible:ring-cyan-500 text-xs rounded-lg"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-semibold text-xs h-10 rounded-lg transition-colors"
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Log In'}
              </Button>
              <div className="text-xs text-zinc-500 text-center">
                Don't have an account?{' '}
                <Link href="/auth/signup" className="text-cyan-400 hover:underline">
                  Sign up
                </Link>
              </div>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleRestore}>
            <CardHeader className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                  <ShieldAlert className="h-4.5 w-4.5" />
                </div>
                <span className="text-sm font-bold text-zinc-100">
                  SecurePass
                </span>
                <span className="text-[9px] text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                  Restore Key
                </span>
              </div>
              <CardTitle className="text-lg font-bold tracking-tight pt-2">Restore Vault Keypair</CardTitle>
              <CardDescription className="text-zinc-500 text-xs leading-relaxed">
                You are logging in from a new browser or device. Upload your encrypted backup file to restore your client-side private key.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backupFile" className="text-xs text-zinc-400">Backup JSON File</Label>
                <Input
                  id="backupFile"
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 file:bg-zinc-800 file:text-zinc-200 file:border-0 hover:file:bg-zinc-700 cursor-pointer text-xs rounded-lg"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passphrase" className="text-xs text-zinc-400">Vault Passphrase</Label>
                <Input
                  id="passphrase"
                  type="password"
                  placeholder="Enter passphrase used on signup"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-cyan-500 text-xs rounded-lg"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-semibold text-xs h-10 rounded-lg transition-colors"
                disabled={isLoading}
              >
                {isLoading ? 'Restoring...' : 'Restore Key & Access Vault'}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setLoginStep('form')}
                className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40 text-xs"
              >
                Back to Login
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
