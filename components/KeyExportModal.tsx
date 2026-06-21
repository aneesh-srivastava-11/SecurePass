import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Key, Copy, Check, Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportPublicKey } from '@/lib/crypto';

interface KeyExportModalProps {
  email: string;
}

export default function KeyExportModal({ email }: KeyExportModalProps) {
  const [pubKey, setPubKey] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = async (open: boolean) => {
    setIsOpen(open);
    if (open && !pubKey) {
      try {
        const key = await exportPublicKey();
        setPubKey(key);
      } catch (err: any) {
        toast.error(err.message || 'Failed to export public key');
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(pubKey);
    setCopied(true);
    toast.success('Public key copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTextFile = () => {
    const fileContent = JSON.stringify({ email, publicKey: pubKey }, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `securepass-public-key-${email.split('@')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Public key downloaded!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger render={
        <Button variant="outline" className="border-slate-800 hover:bg-slate-800 text-slate-300 text-xs">
          <Key className="h-3.5 w-3.5 mr-1.5" />
          View Public Key
        </Button>
      } />
      <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle>Vault Public Key</DialogTitle>
          <DialogDescription className="text-slate-400">
            This is your SPKI-encoded P-256 public key. Other users need this public key to share secrets with you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-mono">ACCOUNT EMAIL</span>
            <div className="text-sm font-medium text-slate-200">{email}</div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-mono">PUBLIC KEY (BASE64 SPKI)</span>
              <div className="flex space-x-2">
                <button onClick={handleCopy} className="text-slate-400 hover:text-cyan-400 p-1 rounded hover:bg-slate-800">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3 rounded font-mono text-[10px] text-slate-400 break-all select-all max-h-32 overflow-y-auto">
              {pubKey || 'Loading public key...'}
            </div>
          </div>
          <div className="bg-slate-950/40 border border-cyan-500/10 p-3 rounded-lg text-xs text-slate-400 space-y-1.5">
            <div className="font-semibold text-cyan-400">🔒 Browser-Bound Private Key</div>
            <div>
              By security design, your private key is flagged as <strong>non-extractable</strong> in your browser's IndexedDB. 
              It cannot be exported, viewed, or stolen by any JavaScript execution. 
              To backup your private key, make sure you download the backup JSON on signup or restore it from your existing backup.
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={downloadTextFile} variant="outline" className="border-slate-800 hover:bg-slate-800 text-slate-200">
              <Download className="h-4 w-4 mr-2" />
              Download Public Info
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
