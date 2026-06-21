'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

interface AdBannerProps {
  onUpgradeClick: () => void;
}

export default function AdBanner({ onUpgradeClick }: AdBannerProps) {
  const [adsBlocked, setAdsBlocked] = useState(false);
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Attempt to load EthicalAds script
    const script = document.createElement('script');
    script.src = 'https://media.ethicalads.io/media/client/ethicalads.force.js';
    script.async = true;
    script.onload = () => {
      // Check if the container was collapsed by an ad blocker
      setTimeout(() => {
        if (adRef.current && adRef.current.offsetHeight === 0) {
          setAdsBlocked(true);
        }
      }, 1000);
    };
    script.onerror = () => {
      setAdsBlocked(true);
    };

    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {
        // Ignored
      }
    };
  }, []);

  return (
    <div className="w-full border border-slate-900 bg-slate-950/60 rounded-xl p-4 my-6">
      {adsBlocked ? (
        <div className="flex flex-col items-center text-center space-y-2 p-2">
          <ShieldAlert className="h-6 w-6 text-amber-500 animate-pulse" />
          <h4 className="text-sm font-semibold text-amber-500">Ad Blocker Detected</h4>
          <p className="text-xs text-slate-400 max-w-md">
            SecurePass uses privacy-respecting, developer-focused, cookie-free ads to cover hosting and development costs. Please consider whitelisting us or upgrading to Pro.
          </p>
          <Button 
            onClick={onUpgradeClick} 
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-1"
          >
            Upgrade to Pro
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[50px]">
          <div
            ref={adRef}
            className="horizontal ethicalads"
            data-ea-publisher="securepass"
            data-ea-type="text"
            data-ea-style="dark"
          >
            {/* Real text ad placement fallback for local development */}
            <div className="text-[11px] text-slate-500 font-mono text-center select-none">
              [ Ethical Ad ] Sponsor: ProtonVPN — Private & Secure Internet. <span className="underline cursor-pointer text-indigo-400 hover:text-indigo-300" onClick={onUpgradeClick}>Remove ads by upgrading</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
