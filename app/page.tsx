import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Key, 
  Users, 
  Activity, 
  ArrowRight, 
  Lock, 
  ServerCrash, 
  UserCheck, 
  Cpu, 
  Database, 
  CheckCircle2, 
  FileCheck2, 
  FolderLock 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-cyan-500/20 selection:text-cyan-300 antialiased flex flex-col font-sans">
      
      {/* Sticky top navbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
              <FolderLock className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-zinc-100">SecurePass</span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 border-cyan-500/20 px-1.5 py-0.5">
              Zero-Trust
            </Badge>
          </div>
          <nav className="flex items-center space-x-4">
            <Link href="/auth/login">
              <Button variant="ghost" className="text-zinc-400 hover:text-zinc-100 text-sm px-3.5 h-9">
                Unlock Vault
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-medium text-xs px-4 h-9 rounded-lg transition-colors">
                Get Started Free
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero section */}
      <section className="max-w-[1200px] mx-auto px-6 pt-20 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center space-x-2 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-xs text-cyan-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span>LOCAL CLIENT-SIDE DECRYPTION</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-100 leading-[1.1]">
            Zero-Knowledge Secret Management for Modern Teams
          </h1>
          
          <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-xl">
            SecurePass encrypts passwords, API keys, and database credentials client-side using P-256 ECIES. 
            The server only stores ciphertext, meaning your plaintext credentials never leave your machine.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link href="/auth/signup" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-semibold h-11 px-6 rounded-lg text-xs transition-colors">
                Get Started Free
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
            <Link href="/auth/login" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto border-zinc-800 hover:bg-zinc-900 text-zinc-300 h-11 px-6 rounded-lg text-xs transition-colors">
                Unlock Existing Vault
              </Button>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="pt-8 border-t border-zinc-900/60 flex flex-wrap gap-x-6 gap-y-3 text-xs font-mono text-zinc-500">
            <span className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-1.5 text-cyan-500/60" /> Client-side Encryption</span>
            <span className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-1.5 text-cyan-500/60" /> P-256 ECIES</span>
            <span className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-1.5 text-cyan-500/60" /> Zero Knowledge</span>
            <span className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-1.5 text-cyan-500/60" /> Open Source</span>
          </div>
        </div>

        {/* Dashboard Mockup Visual representation */}
        <div className="lg:col-span-5 hidden lg:block bg-zinc-950 p-1 border border-zinc-800 rounded-xl shadow-2xl relative overflow-hidden">
          <div className="bg-zinc-900 rounded-lg p-4 font-mono text-xs text-zinc-400 space-y-3">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <div className="flex space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
              </div>
              <span className="text-[10px] text-zinc-600">securepass-cli v1.0.0</span>
            </div>
            <div className="space-y-1">
              <div className="text-zinc-500">$ securepass secrets get DATABASE_URL</div>
              <div className="text-zinc-600 animate-pulse">// Querying database...</div>
              <div className="text-zinc-300">🔓 Local Decrypting using P-256 ECIES Private Key...</div>
              <div className="text-cyan-400">DATABASE_URL = postgresql://db-user:••••••••@prod-host:5432/main</div>
            </div>
            <div className="space-y-1 pt-2 border-t border-zinc-800/60">
              <div className="text-zinc-500">$ securepass audit-log verify --id 12</div>
              <div className="text-zinc-600">// Fetching server commitment & signature...</div>
              <div className="text-green-400">✓ Ed25519 signature valid (Server Commitment verified)</div>
              <div className="text-zinc-500">Timestamp: 2026-06-22T00:09:59Z</div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Problem Statement */}
      <section className="bg-zinc-950/40 border-t border-zinc-900/60 py-20">
        <div className="max-w-[1200px] mx-auto px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-100">
              Traditional Secret Managers Require Trust
            </h2>
            <p className="text-zinc-400 text-xs md:text-sm">
              Standard secret managers decrypt credentials on their own servers, leaving you exposed to data leaks, rogue admins, and compromised cloud providers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 border border-zinc-900 bg-zinc-900/10 rounded-xl space-y-3">
              <div className="p-2 bg-red-500/10 text-red-400 rounded-lg w-9 h-9 flex items-center justify-center border border-red-500/20">
                <ServerCrash className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-zinc-200 text-sm">Server Plaintext Access</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                If credentials are decrypted server-side, a single server compromise instantly exposes your entire database and API keys to third parties.
              </p>
            </div>

            <div className="p-6 border border-zinc-900 bg-zinc-900/10 rounded-xl space-y-3">
              <div className="p-2 bg-red-500/10 text-red-400 rounded-lg w-9 h-9 flex items-center justify-center border border-red-500/20">
                <Lock className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-zinc-200 text-sm">Single Point of Failure</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Relying on a third party to guard plain text creates a single massive honeypot. SecurePass eliminates this by using mathematical client isolation.
              </p>
            </div>

            <div className="p-6 border border-zinc-900 bg-zinc-900/10 rounded-xl space-y-3">
              <div className="p-2 bg-red-500/10 text-red-400 rounded-lg w-9 h-9 flex items-center justify-center border border-red-500/20">
                <Users className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-zinc-200 text-sm">Insecure Team Handoffs</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Teams resort to sharing secrets via Slack or email when databases are restricted. SecurePass lets you share cryptographically directly between users.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Features Grid */}
      <section className="py-20 border-t border-zinc-900/60 bg-zinc-950">
        <div className="max-w-[1200px] mx-auto px-6 space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-100">
              Complete Client-Side Vault Security
            </h2>
            <p className="text-zinc-400 text-xs md:text-sm">
              Features built specifically for developers who demand cryptographic zero-trust guarantees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-5 border border-zinc-900 bg-zinc-950 hover:border-zinc-800 transition-colors rounded-xl space-y-3">
              <div className="text-cyan-400"><Key className="h-5 w-5" /></div>
              <h4 className="font-semibold text-zinc-200 text-sm">Local Encryption</h4>
              <p className="text-xs text-zinc-400">
                Encryption occurs natively in the browser via Web Crypto API. Plaintext secrets are never transmitted.
              </p>
            </div>

            <div className="p-5 border border-zinc-900 bg-zinc-950 hover:border-zinc-800 transition-colors rounded-xl space-y-3">
              <div className="text-cyan-400"><Lock className="h-5 w-5" /></div>
              <h4 className="font-semibold text-zinc-200 text-sm">Zero-Knowledge Architecture</h4>
              <p className="text-xs text-zinc-400">
                Master key material is never shared with our servers. Your vault remains locked to anyone without your passphrase.
              </p>
            </div>

            <div className="p-5 border border-zinc-900 bg-zinc-950 hover:border-zinc-800 transition-colors rounded-xl space-y-3">
              <div className="text-cyan-400"><Users className="h-5 w-5" /></div>
              <h4 className="font-semibold text-zinc-200 text-sm">Secure Team Sharing</h4>
              <p className="text-xs text-zinc-400">
                Asymmetric key exchange using ECIES. Alice decrypts locally, re-encrypts using Bob's public key, and updates the vault.
              </p>
            </div>

            <div className="p-5 border border-zinc-900 bg-zinc-950 hover:border-zinc-800 transition-colors rounded-xl space-y-3">
              <div className="text-cyan-400"><Activity className="h-5 w-5" /></div>
              <h4 className="font-semibold text-zinc-200 text-sm">Signed Audit Logs</h4>
              <p className="text-xs text-zinc-400">
                Every vault action creates a signed transaction payload. Cryptographically guarantee vault integrity.
              </p>
            </div>

            <div className="p-5 border border-zinc-900 bg-zinc-950 hover:border-zinc-800 transition-colors rounded-xl space-y-3">
              <div className="text-cyan-400"><FileCheck2 className="h-5 w-5" /></div>
              <h4 className="font-semibold text-zinc-200 text-sm">Cryptographic Verification</h4>
              <p className="text-xs text-zinc-400">
                Verify audit logs client-side against the server public key using Ed25519 signature checks.
              </p>
            </div>

            <div className="p-5 border border-zinc-900 bg-zinc-950 hover:border-zinc-800 transition-colors rounded-xl space-y-3">
              <div className="text-cyan-400"><Database className="h-5 w-5" /></div>
              <h4 className="font-semibold text-zinc-200 text-sm">Browser-based Key Storage</h4>
              <p className="text-xs text-zinc-400">
                Private keys are stored locally inside sandboxed IndexedDB storage as non-extractable cryptographic key objects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: How It Works */}
      <section className="py-20 border-t border-zinc-900/60 bg-zinc-950/40">
        <div className="max-w-[1200px] mx-auto px-6 space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-100">
              Cryptographic Workflow
            </h2>
            <p className="text-zinc-400 text-xs md:text-sm">
              How SecurePass guarantees secret isolation through direct asymmetric key agreement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <div className="space-y-3 p-5 border border-zinc-900 bg-zinc-900/10 rounded-xl">
              <div className="text-xs font-mono text-cyan-400">STEP 01</div>
              <h5 className="font-semibold text-zinc-200 text-sm">Generate Keys Locally</h5>
              <p className="text-xs text-zinc-400">
                Your browser creates an elliptic curve P-256 keypair upon signup. The private key never leaves the sandbox.
              </p>
            </div>

            <div className="space-y-3 p-5 border border-zinc-900 bg-zinc-900/10 rounded-xl">
              <div className="text-xs font-mono text-cyan-400">STEP 02</div>
              <h5 className="font-semibold text-zinc-200 text-sm">Local Encryption</h5>
              <p className="text-xs text-zinc-400">
                Symmetric AES-GCM secret key is encrypted as ciphertext locally in your browser.
              </p>
            </div>

            <div className="space-y-3 p-5 border border-zinc-900 bg-zinc-900/10 rounded-xl">
              <div className="text-xs font-mono text-cyan-400">STEP 03</div>
              <h5 className="font-semibold text-zinc-200 text-sm">Asymmetric Key Exchange</h5>
              <p className="text-xs text-zinc-400">
                To share, a new key agreement is formed locally using the recipient public key and P-256 ECIES.
              </p>
            </div>

            <div className="space-y-3 p-5 border border-zinc-900 bg-zinc-900/10 rounded-xl">
              <div className="text-xs font-mono text-cyan-400">STEP 04</div>
              <h5 className="font-semibold text-zinc-200 text-sm">Zero-Trust Storage</h5>
              <p className="text-xs text-zinc-400">
                The database stores only ciphertext payloads. Decryption remains strictly isolated to the browser.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Security Section */}
      <section className="py-20 border-t border-zinc-900/60 bg-zinc-950">
        <div className="max-w-[1200px] mx-auto px-6 space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-100">
              Built for Security Engineers
            </h2>
            <p className="text-zinc-400 text-xs md:text-sm">
              We leverage browser native cryptographic primitives and open source standards. No custom crypto.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 border border-zinc-900 bg-zinc-900/20 rounded-lg text-center space-y-1.5">
              <div className="text-cyan-400 text-lg font-mono font-bold">AES-256-GCM</div>
              <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Symmetric Encryption</div>
            </div>
            
            <div className="p-4 border border-zinc-900 bg-zinc-900/20 rounded-lg text-center space-y-1.5">
              <div className="text-cyan-400 text-lg font-mono font-bold">P-256 ECIES</div>
              <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Asymmetric Agreement</div>
            </div>

            <div className="p-4 border border-zinc-900 bg-zinc-900/20 rounded-lg text-center space-y-1.5">
              <div className="text-cyan-400 text-lg font-mono font-bold">Ed25519</div>
              <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Audit Signatures</div>
            </div>

            <div className="p-4 border border-zinc-900 bg-zinc-900/20 rounded-lg text-center space-y-1.5">
              <div className="text-cyan-400 text-xs font-mono font-bold py-1 leading-tight">WebCrypto Sandbox</div>
              <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Non-Extractable Keys</div>
            </div>

            <div className="p-4 border border-zinc-900 bg-zinc-900/20 rounded-lg text-center space-y-1.5 col-span-2 md:col-span-1">
              <div className="text-cyan-400 text-lg font-mono font-bold">Zero Trust</div>
              <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Plaintext Exposure</div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Pricing */}
      <section className="py-20 border-t border-zinc-900/60 bg-zinc-950/40">
        <div className="max-w-[1200px] mx-auto px-6 space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-100">
              Simple, Predictable Plans
            </h2>
            <p className="text-zinc-400 text-xs md:text-sm">
              Free to start, pay only for advanced collaboration and unlimited secrets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free Tier */}
            <div className="p-8 border border-zinc-900 bg-zinc-950 rounded-xl space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-zinc-200">Free</h4>
                  <p className="text-xs text-zinc-500">Perfect for individual developers.</p>
                </div>
                <div className="text-3xl font-bold text-zinc-100 font-mono">
                  ₹0
                  <span className="text-xs text-zinc-500 font-normal"> / forever</span>
                </div>
                
                <hr className="border-zinc-900" />
                
                <ul className="space-y-2.5 text-xs text-zinc-400">
                  <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-400/80" /> Up to 5 secrets</li>
                  <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-400/80" /> 1 share per secret</li>
                  <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-400/80" /> Local browser-native encryption</li>
                  <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-400/80" /> Signed audit trail</li>
                </ul>
              </div>
              <Link href="/auth/signup" className="pt-4">
                <Button variant="outline" className="w-full border-zinc-800 text-zinc-300 hover:bg-zinc-900 text-xs font-semibold h-10 rounded-lg">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Pro Tier */}
            <div className="p-8 border border-zinc-800 bg-zinc-950 rounded-xl space-y-6 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-cyan-500/10 border-l border-b border-cyan-500/20 text-cyan-400 font-mono text-[9px] uppercase tracking-wider px-3 py-1 rounded-bl">
                Recommended
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-zinc-200 flex items-center">
                    Pro
                  </h4>
                  <p className="text-xs text-zinc-500">For teams demanding absolute collaborative trust.</p>
                </div>
                <div className="text-3xl font-bold text-zinc-100 font-mono">
                  ₹400
                  <span className="text-xs text-zinc-500 font-normal"> / month</span>
                </div>
                
                <hr className="border-zinc-900" />
                
                <ul className="space-y-2.5 text-xs text-zinc-400">
                  <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-400" /> Unlimited secrets</li>
                  <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-400" /> Unlimited secret sharing</li>
                  <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-400" /> Collaborative team vault access</li>
                  <li className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-cyan-400" /> Priority support & backups</li>
                </ul>
              </div>
              <Link href="/auth/signup" className="pt-4">
                <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold text-xs h-10 rounded-lg transition-colors">
                  Go Pro
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7: Final CTA */}
      <section className="py-24 border-t border-zinc-900 bg-zinc-950 text-center relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6 relative z-10 space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-100 max-w-md mx-auto">
            Secure your team's secrets today.
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm max-w-sm mx-auto leading-relaxed">
            Generate your vault keypair in under a minute. Absolutely free to start.
          </p>
          <div className="pt-2">
            <Link href="/auth/signup">
              <Button className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-xs h-11 px-8 rounded-lg transition-colors">
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/60 py-8">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-zinc-600">
          <div>
            SECUREPASS VAULT PROTOCOL v1.0.0 (ECIES P-256 / AES-GCM-256)
          </div>
          <div className="flex space-x-6 text-zinc-500">
            <span className="hover:text-zinc-300 cursor-pointer">Docs</span>
            <span className="hover:text-zinc-300 cursor-pointer">Privacy</span>
            <span className="hover:text-zinc-300 cursor-pointer">Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
