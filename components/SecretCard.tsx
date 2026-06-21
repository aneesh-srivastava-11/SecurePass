import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SecretCardProps {
  secret: {
    id: string;
    name: string;
    owner_id: string;
    owner_email?: string;
    created_at: string;
    isShared: boolean;
  };
}

export default function SecretCard({ secret }: SecretCardProps) {
  const formattedDate = new Date(secret.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link href={`/secret/${secret.id}`}>
      <Card className="hover:border-cyan-500/40 border-slate-800 bg-slate-900/45 backdrop-blur-md transition-all duration-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] group cursor-pointer">
        <CardHeader className="p-4 pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-base font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors">
              {secret.name}
            </CardTitle>
            {secret.isShared ? (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                Shared
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px]">
                Owner
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <CardDescription className="text-xs text-slate-400 font-mono flex flex-col space-y-1 mt-2">
            <span>Created: {formattedDate}</span>
            {secret.isShared && (
              <span className="text-slate-500 truncate max-w-[200px]">
                From: {secret.owner_email}
              </span>
            )}
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
