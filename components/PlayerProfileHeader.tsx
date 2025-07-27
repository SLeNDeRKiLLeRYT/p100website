'use client';

import { useState } from 'react';
import { User, Crown, Shield, Copy, Check } from 'lucide-react';

interface PlayerData {
  username: string;
  killers: unknown[];
  survivors: unknown[];
}

interface PlayerProfileHeaderProps {
  player: PlayerData;
}

export default function PlayerProfileHeader({ player }: PlayerProfileHeaderProps) {
  const [isCopied, setIsCopied] = useState(false);
  const totalP100s = player.killers.length + player.survivors.length;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="relative text-center bg-black/40 border-2 border-red-600/50 rounded-lg p-6 backdrop-blur-sm">
      <button
        onClick={handleCopyLink}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        title="Copy Profile Link"
      >
        {isCopied ? (
          <Check className="h-6 w-6 text-green-400" />
        ) : (
          <Copy className="h-6 w-6" />
        )}
      </button>

      <h2 className="text-3xl md:text-4xl font-mono mb-4 flex items-center justify-center gap-3">
        <User className="h-8 w-8 text-red-400" />
        {player.username}
      </h2>
      <p className="text-xl text-gray-300">
        {totalP100s} Total P100 Character{totalP100s !== 1 ? 's' : ''}
      </p>
      <div className="flex justify-center gap-8 mt-4">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-red-400" />
          <span>{player.killers.length} Killer{player.killers.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-400" />
          <span>{player.survivors.length} Survivor{player.survivors.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}