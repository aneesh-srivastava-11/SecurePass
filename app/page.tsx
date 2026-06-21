import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Key, Users, ListChecks, ArrowRight, FolderLock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col justify-center min-h-screen text-slate-200">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Hero section */}
      <main className="max-w-4xl mx-auto px-6 py-20 text-center relative z-10 space-y-12">
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-full px-3.5 py-1 text-xs text-cyan-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>ZERO-SERVER-TRUST SECRET SHARING</span>
        </div>

        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-cyan-300 to-blue-400 bg-clip-text text-transparent leading-[1.15]">
            Decentralized Secret Vault <br className="hidden md:inline" />
            for Development Teams
          </h1>
          <p className="max-w-2xl mx-auto text-sm md:text-base text-slate-400 leading-relaxed">
            SecurePass encrypts passwords, API keys, and database credentials client-side using P-256 ECIES. 
            The server stores only ciphertext and can never access your decrypted plaintext.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/auth/signup" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-bold h-12 px-8 text-sm">
              Get Started (Generate Keys)
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href="/auth/login" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto border-slate-800 hover:bg-slate-900 text-slate-200 h-12 px-8 text-sm">
              Unlock Existing Vault
            </Button>
          </Link>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10">
          <div className="p-5 border border-slate-900 bg-slate-900/30 backdrop-blur-md rounded-2xl text-left space-y-3">
            <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl w-10 h-10 flex items-center justify-center">
              <Key className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm">Local Encryption</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Keys are generated in your browser and stored as non-extractable CryptoKeys in IndexedDB. Plaintext never leaves your machine.
            </p>
          </div>

          <div className="p-5 border border-slate-900 bg-slate-900/30 backdrop-blur-md rounded-2xl text-left space-y-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl w-10 h-10 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm">Client-Side Sharing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Alice decrypts locally and re-encrypts using Bob's public key to share. Secrets are shared directly without server trust.
            </p>
          </div>

          <div className="p-5 border border-slate-900 bg-slate-900/30 backdrop-blur-md rounded-2xl text-left space-y-3">
            <div className="p-2.5 bg-green-500/10 text-green-400 rounded-xl w-10 h-10 flex items-center justify-center">
              <ListChecks className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-100 text-sm">Signed Audit Log</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every creation, share, or revocation is cryptographically signed by the server. Verify logs client-side with Ed25519 signatures.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 left-0 right-0 text-center text-xs text-slate-600 font-mono">
        SECUREPASS VAULT PROTOCOL v1.0.0 (ECIES P-256 / AES-GCM-256)
      </footer>
    </div>
  );
}
