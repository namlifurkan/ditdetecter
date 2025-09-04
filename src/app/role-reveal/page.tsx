'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RoleRevealComponent from '@/components/RoleRevealComponent';
import { useGameEvents } from '@/hooks/useGameEvents';
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export default function RoleRevealPage() {
  const router = useRouter();
  const { gameData, isConnected } = useGameEvents();
  const [playerRole, setPlayerRole] = useState(null);

  useEffect(() => {
    const playerId = getCookie('player_id');
    if (!playerId) {
      // No player session, redirect to lobby
      router.push('/');
      return;
    }

    // Set player role from gameData
    if (gameData?.playerRole) {
      setPlayerRole(gameData.playerRole);
    }
  }, [gameData, router]);

  // Auto-redirect to game when role reveal phase ends (with delay to prevent loops)
  useEffect(() => {
    if (gameData?.gameState?.currentPhase && 
        gameData.gameState.currentPhase !== 'role_reveal') {
      // Add a delay to prevent immediate redirect loops
      const timer = setTimeout(() => {
        router.push('/game');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameData?.gameState?.currentPhase, router]);

  // Calculate time left for role reveal phase
  const timeLeft = gameData?.gameState?.phaseEndTime 
    ? Math.max(0, Math.floor((new Date(gameData.gameState.phaseEndTime).getTime() - Date.now()) / 1000))
    : 0;

  if (!gameData || !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <div className="text-center">
            <div className="text-4xl mb-4">🔄</div>
            <p className="text-white text-xl">Connecting...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show role reveal regardless of phase to prevent redirect loops
  // The useEffect above will handle redirecting when needed

  return <RoleRevealComponent playerRole={playerRole} timeLeft={timeLeft} />;
}