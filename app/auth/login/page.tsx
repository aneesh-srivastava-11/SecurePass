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
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <Card className="w-full max-w-md border-slate-800 bg-slate-900/60 backdrop-blur-xl relative z-10">
        {loginStep === 'form' ? (
          <form onSubmit={handleLogin}>
            <CardHeader className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  SecurePass
                </span>
                <span className="text-xs text-cyan-400 border border-cyan-400/30 px-1.5 py-0.5 rounded font-mono">
                  ZERO-TRUST
                </span>
              </div>
              <CardTitle className="text-xl mt-4">Welcome back</CardTitle>
              <CardDescription>
                Log in to decrypt and access your secrets.
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-semibold"
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Log In'}
              </Button>
              <div className="text-sm text-slate-400 text-center">
                Don't have an account?{' '}
                <Link href="/auth/signup" className="text-cyan-400 hover:underline">
                  Sign up
                </Link>
              </div>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleRestore}>
            <CardHeader className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  SecurePass
                </span>
                <span className="text-xs text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded font-mono">
                  RESTORE KEY
                </span>
              </div>
              <CardTitle className="text-xl mt-4">Restore Vault Keypair</CardTitle>
              <CardDescription>
                You are logging in from a new browser or device. Upload your encrypted backup file to restore your local keys.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backupFile">Backup JSON File</Label>
                <Input
                  id="backupFile"
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="bg-slate-950 border-slate-800 text-slate-100 file:bg-slate-900 file:text-slate-100 file:border-0 hover:file:bg-slate-800 cursor-pointer"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passphrase">Vault Passphrase</Label>
                <Input
                  id="passphrase"
                  type="password"
                  placeholder="Enter passphrase used on signup"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-semibold"
                disabled={isLoading}
              >
                {isLoading ? 'Restoring...' : 'Restore Key & Access Vault'}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setLoginStep('form')}
                className="text-slate-400 hover:text-slate-300 hover:bg-slate-800/40"
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
