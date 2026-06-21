import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Shield, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { encryptSecret, exportPublicKey } from '@/lib/crypto';

interface SecretFormProps {
  onSuccess: () => void;
}

export default function SecretForm({ onSuccess }: SecretFormProps) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) {
      toast.error('Please enter name and secret value');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Fetch own public key to self-encrypt
      const myPublicKeyBase64 = await exportPublicKey();

      // 2. Client-side ECIES Encrypt
      const encryptedBlob = await encryptSecret(value, myPublicKeyBase64);

      // 3. POST to /api/secrets (only encrypted blob leaves client)
      const res = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          encryptedBlob,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save secret');
      }

      toast.success('Secret encrypted and saved successfully!');
      setName('');
      setValue('');
      setIsOpen(false);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred encrypting secret');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={
        <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-semibold text-xs py-1.5 h-8">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Secret
        </Button>
      } />
      <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle>Add Encrypted Secret</DialogTitle>
          <DialogDescription className="text-slate-400">
            Securely encrypt credentials in your browser using P-256 ECIES. The server never receives the plaintext.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="secret-name">Secret Identifier</Label>
            <Input
              id="secret-name"
              placeholder="e.g. Stripe Live API Key"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500"
              disabled={isLoading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secret-value">Secret Plaintext</Label>
            <div className="relative">
              <Input
                id="secret-value"
                type={showValue ? 'text' : 'password'}
                placeholder="sk_live_..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500 pr-10 font-mono text-sm"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                disabled={isLoading}
              >
                {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          
          {value && (
            <div className="bg-slate-950/60 border border-cyan-500/10 p-3 rounded text-[10px] font-mono text-slate-500 space-y-1">
              <div className="flex items-center text-cyan-400 text-[11px] mb-1">
                <Shield className="h-3 w-3 mr-1" />
                LOCAL ECIES PREVIEW (will be stored at rest like this)
              </div>
              <div className="truncate">ephemeralPK: P256_SPKI_BYTES_...</div>
              <div className="truncate">iv: {btoa(name).substring(0, 16)}...</div>
              <div className="truncate">ciphertext: AES_GCM_ENCRYPTED_DATA_...</div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-semibold"
              disabled={isLoading}
            >
              {isLoading ? 'Encrypting & Saving...' : 'Encrypt & Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
