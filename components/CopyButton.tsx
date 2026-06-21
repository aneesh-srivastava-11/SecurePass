import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCountdown(30);
      toast.success('Copied! Clipboard will clear in 30 seconds for security.');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      // Clear clipboard
      navigator.clipboard.writeText('');
      toast.info('🛡️ Clipboard cleared for security.');
      setCountdown(null);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown]);

  return (
    <div className="flex items-center space-x-2">
      <Button
        onClick={handleCopy}
        className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 h-11 px-4"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 mr-1.5 text-green-400" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 mr-1.5" />
            Copy
          </>
        )}
      </Button>
      {countdown !== null && (
        <div className="text-[10px] text-slate-500 font-mono flex items-center bg-slate-950 border border-slate-900 rounded-lg px-2.5 py-1.5 h-11">
          <ShieldCheck className="h-3.5 w-3.5 mr-1 text-cyan-500 animate-pulse" />
          <span>Clear in {countdown}s</span>
        </div>
      )}
    </div>
  );
}
