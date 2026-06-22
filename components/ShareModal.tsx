import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Share2, Search, UserPlus, Send, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { reEncryptForShare } from '@/lib/crypto';
import type { ECIESPayload } from '@/lib/crypto';

interface ShareModalProps {
  secretId: string;
  secretName: string;
  encryptedBlob: ECIESPayload;
  onSuccess: () => void;
  hasKey: boolean;
}

export default function ShareModal({ secretId, secretName, encryptedBlob, onSuccess, hasKey }: ShareModalProps) {
  const [email, setEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSearching(true);
    setSearchResult(null);

    try {
      const res = await fetch(`/api/users/search?email=${encodeURIComponent(email.trim())}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResult(data);
    } catch (err) {
      toast.error('Failed to search for user');
    } finally {
      setIsSearching(false);
    }
  };

  const handleShare = async () => {
    if (!searchResult || !searchResult.found) return;
    setIsActionLoading(true);

    try {
      const recipient = searchResult.user;
      
      // 1. Re-encrypt the secret locally using Bob's public key
      const reEncryptedBlob = await reEncryptForShare(encryptedBlob, recipient.public_key);

      // 2. Save the share record on the server
      const res = await fetch(`/api/secrets/${secretId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: recipient.id,
          encryptedKey: reEncryptedBlob,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to share secret');
      }

      toast.success(`Secret shared with ${recipient.email}!`);
      setIsOpen(false);
      setEmail('');
      setSearchResult(null);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error sharing secret');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!email) return;
    setIsActionLoading(true);

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          secretId,
          secretName,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send invite');
      }

      const data = await res.json();
      if (data.alreadyRegistered) {
        // Double-check race condition: if they signed up during search, just share
        toast.info('User is actually registered. Attempting to share now...');
        setSearchResult({ found: true, user: { id: data.userId, email, public_key: data.publicKey } });
        return;
      }

      toast.success(`Invitation email sent to ${email}! They will receive access upon registration.`);
      setIsOpen(false);
      setEmail('');
      setSearchResult(null);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error sending invite');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={
        <Button 
          variant="outline" 
          className="border-slate-800 hover:bg-slate-800 text-slate-200"
          onClick={(e) => {
            if (!hasKey) {
              e.preventDefault();
              toast.error('Vault private key is missing. Please restore your key pair under Settings to share secrets.');
            }
          }}
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share Secret
        </Button>
      } />
      <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle>Share Secret: {secretName}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Share this secret securely. Secrets are re-encrypted client-side for the recipient.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <form onSubmit={handleSearch} className="space-y-2">
            <Label htmlFor="search-email">Search Team Member by Email</Label>
            <div className="flex gap-2">
              <Input
                id="search-email"
                type="email"
                placeholder="bob@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500"
                disabled={isSearching || isActionLoading}
                required
              />
              <Button type="submit" variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-slate-200" disabled={isSearching || isActionLoading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </form>

          {isSearching && (
            <div className="text-sm text-slate-400 flex items-center justify-center p-4">
              Searching user database...
            </div>
          )}

          {searchResult && (
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-lg space-y-4 animate-in fade-in duration-200">
              {searchResult.found ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 font-mono">REGISTERED USER</div>
                      <div className="text-sm font-semibold text-slate-200">{searchResult.user.email}</div>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                  </div>
                  
                  <div className="bg-slate-900/60 p-2 border border-slate-800/40 rounded text-[9px] font-mono text-slate-500 truncate">
                    Public Key: {searchResult.user.public_key.substring(0, 30)}...
                  </div>

                  <Button 
                    onClick={handleShare}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-semibold"
                    disabled={isActionLoading}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isActionLoading ? 'Re-encrypting & Sharing...' : 'Re-encrypt & Share'}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-xs text-amber-500 font-mono">NOT FOUND</div>
                      <div className="text-sm font-semibold text-slate-200">{searchResult.email}</div>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  </div>
                  
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This user hasn't registered a SecurePass public key yet. You can invite them via email, and the vault will share the secret once they complete signup.
                  </p>

                  <Button 
                    onClick={handleInvite}
                    variant="outline"
                    className="w-full border-slate-800 hover:bg-slate-800 text-amber-400 hover:text-amber-300 font-semibold"
                    disabled={isActionLoading}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {isActionLoading ? 'Sending Invitation...' : 'Invite via Email'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
