import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Key } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface KeyStatusBannerProps {
  hasKey: boolean;
  onRestoreClick: () => void;
}

export default function KeyStatusBanner({ hasKey, onRestoreClick }: KeyStatusBannerProps) {
  if (hasKey) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5 backdrop-blur-md mb-6">
      <CardHeader className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-amber-400">
              Vault Cryptographic Key Missing
            </CardTitle>
            <CardDescription className="text-xs text-amber-500/80 mt-1 max-w-xl">
              Your browser does not have the P-256 private key for this account. You will not be able to decrypt secrets or share new ones until you restore your key using your backup file.
            </CardDescription>
          </div>
        </div>
        <Button
          onClick={onRestoreClick}
          variant="outline"
          className="border-amber-500/30 hover:bg-amber-500/10 text-amber-400 hover:text-amber-300 font-medium text-xs whitespace-nowrap self-start md:self-center"
        >
          <Key className="h-3.5 w-3.5 mr-1.5" />
          Restore Vault Key
        </Button>
      </CardHeader>
    </Card>
  );
}
