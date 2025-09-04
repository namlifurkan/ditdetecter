'use client';

import { useGameEvents } from '@/hooks/useGameEvents';
import LobbyComponent from '@/components/LobbyComponent';
import RoundComponent from '@/components/RoundComponent';
import VotingComponent from '@/components/VotingComponent';
import ResultsComponent from '@/components/ResultsComponent';
import AdminControls from '@/components/AdminControls';
import NetworkMonitor from '@/components/NetworkMonitor';
import AntiCheat from '@/lib/anti-cheat';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue || null;
  }
  return null;
}

export default function GamePage() {
  const { 
    gameData, 
    isConnected, 
    isOffline, 
    error, 
    connectionQuality, 
    latency, 
    networkStats 
  } = useGameEvents();
  const router = useRouter();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Show notification to the cheater
  const showSelfCheaterNotification = (type: 'console' | 'devtools') => {
    const messages = [
      "🚨 BUSTED! Console detected - You've been exposed!",
      "⚠️ CHEATING ALERT: Other players have been notified!",
      "🔍 CAUGHT RED-HANDED: Developer tools detected!",
      "💀 EXPOSED: Your cheating attempt is now public!",
      "🎯 DETECTED: All players know you opened console!"
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];
    
    // Screen flash effect
    document.body.style.backgroundColor = '#ff0000';
    setTimeout(() => {
      document.body.style.backgroundColor = '';
    }, 200);

    // Create dramatic notification
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(45deg, #ff0000, #8b0000);
        color: white;
        padding: 30px 40px;
        border-radius: 15px;
        box-shadow: 0 0 30px rgba(255, 0, 0, 0.8);
        z-index: 10000;
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        text-align: center;
        border: 3px solid #ff0000;
        animation: pulse 0.5s infinite alternate;
      ">
        <div style="margin-bottom: 15px; font-size: 24px;">⚠️ 🚨 ⚠️</div>
        <div style="margin-bottom: 10px;">${message}</div>
        <div style="font-size: 10px; opacity: 0.8;">Everyone has been notified of your cheating!</div>
      </div>
    `;

    document.body.appendChild(notification);

    // Remove after 4 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);

    // Try to trigger browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 CHEATING DETECTED!', {
        body: 'You have been caught using developer tools!',
        icon: '/game/logo.png'
      });
    }
  };
  
  // Handle client-side mounting FIRST
  useEffect(() => {
    console.log('Setting mounted to true');
    setMounted(true);
  }, []);

  const currentPlayer = gameData?.gameState.players.find(p => p.id === playerId) || 
                      (gameData?.gameState.adminPlayer?.id === playerId ? gameData.gameState.adminPlayer : null);

  // Auto-detect player ID from game data when available
  useEffect(() => {
    if (!mounted || !gameData || playerId) return;
    
    // Try cookie first
    let id = getCookie('player_id');
    console.log('Cookie check:', { cookies: document.cookie, playerId: id });
    
    if (!id) {
      // Fallback: try to find player ID from recent sessionStorage
      const storedData = sessionStorage.getItem('initialGameData');
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          // If we have stored game data, try to find the newest player
          const players = data.gameState?.players || [];
          const adminPlayer = data.gameState?.adminPlayer;
          
          if (adminPlayer) {
            console.log('Using admin player ID from session');
            setPlayerId(adminPlayer.id);
            return;
          } else if (players.length > 0) {
            // Use the most recently joined player as fallback
            const latestPlayer = players[players.length - 1];
            console.log('Using latest player ID from session:', latestPlayer.id);
            setPlayerId(latestPlayer.id);
            return;
          }
        } catch (error) {
          console.error('Error parsing stored game data:', error);
        }
      }
    }
    
    if (!id) {
      // No player ID found anywhere, redirect to home
      console.log('No player ID found, redirecting to home');
      // TEMP: Disable redirect for debugging
      // router.push('/');
      // return;
    }
    
    console.log('Player ID found in cookie:', id);
    setPlayerId(id);
  }, [mounted, router, gameData, playerId]);

  // Handle admin status client-side
  useEffect(() => {
    if (currentPlayer) {
      setIsAdmin(currentPlayer.isAdmin === true);
    }
  }, [currentPlayer]);

  // Initialize anti-cheat system - only on client side
  useEffect(() => {
    if (!mounted || !playerId) return;

    const antiCheat = new AntiCheat((type: 'console' | 'devtools') => {
      // Send cheater alert to server
      fetch('/api/cheater-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      }).catch(error => {
        console.error('Failed to report cheater:', error);
      });

      // Show self-notification to the cheater
      showSelfCheaterNotification(type);
    });

    return () => {
      antiCheat.destroy();
    };
  }, [mounted, playerId]);

  // Connection error handling
  if (error && !isOffline) {
    return (
      <div className="min-h-screen retro-grid flex items-center justify-center p-4">
        <div className="arcade-panel p-8 text-center max-w-md">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold neon-text-pink mb-4" style={{fontFamily: 'Orbitron, monospace'}}>CONNECTION LOST</h2>
          <p className="neon-text-cyan mb-6" style={{fontFamily: 'Press Start 2P, monospace', fontSize: '10px'}}>{error}</p>
          <p className="text-sm text-gray-400 mb-6">REDIRECTING TO HOME IN A FEW SECONDS...</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.href = '/'}
              className="arcade-button px-6 py-3 neon-text-green font-bold"
              style={{fontFamily: 'Press Start 2P, monospace', fontSize: '8px'}}
            >
              GO HOME
            </button>
            <button
              onClick={() => window.location.reload()}
              className="arcade-button px-6 py-3 neon-text-pink font-bold"
              style={{fontFamily: 'Press Start 2P, monospace', fontSize: '8px'}}
            >
              REFRESH
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (!mounted || !gameData) {
    return (
      <div className="min-h-screen retro-grid flex items-center justify-center">
        <div className="text-center arcade-panel p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4 retro-pulse"></div>
          <p className="neon-text-cyan text-lg" style={{fontFamily: 'Orbitron, monospace'}}>
            {!mounted ? 'INITIALIZING...' : !isConnected ? 'CONNECTING TO SERVER...' : 'LOADING GAME DATA...'}
          </p>
          <div className="text-xs text-gray-400 mt-4">
            <p>Mounted: {mounted ? 'YES' : 'NO'}</p>
            <p>Connected: {isConnected ? 'YES' : 'NO'}</p>
            <p>Game Data: {gameData ? 'YES' : 'NO'}</p>
            <p>Player ID: {playerId || 'NONE'}</p>
          </div>
        </div>
      </div>
    );
  }


  const connectionIndicator = mounted ? (
    <div className="fixed top-4 right-4 z-50">
      <div className={`flex items-center space-x-2 px-4 py-2 arcade-panel text-xs ${
        isConnected 
          ? 'neon-text-green' 
          : isOffline 
            ? 'neon-text-yellow'
            : 'neon-text-pink'
      }`} style={{fontFamily: 'Press Start 2P, monospace'}}>
        <div className={`w-2 h-2 ${
          isConnected 
            ? 'bg-green-400 retro-pulse' 
            : isOffline
              ? 'bg-yellow-400 retro-pulse'
              : 'bg-red-400 retro-pulse'
        }`} style={{
          boxShadow: isConnected 
            ? '0 0 10px #00ff00' 
            : isOffline
              ? '0 0 10px #ffff00'
              : '0 0 10px #ff00ff'
        }}></div>
        <span>{isConnected ? 'ONLINE' : isOffline ? 'OFFLINE' : 'DISCONNECTED'}</span>
      </div>
      {isOffline && error && (
        <div className="mt-2 px-3 py-2 arcade-panel text-xs neon-text-yellow max-w-xs"
             style={{fontFamily: 'Press Start 2P, monospace', fontSize: '8px'}}>
          <div className="mb-1">⚠️ OFFLINE MODE</div>
          <div className="opacity-75">USING CACHED DATA</div>
        </div>
      )}
    </div>
  ) : null;

  // Render appropriate component based on game phase
  const renderGamePhase = () => {
    const { currentPhase } = gameData.gameState;
    
    switch (currentPhase) {
      case 'lobby':
        return (
          <LobbyComponent 
            gameState={gameData.gameState}
            playerId={playerId}
          />
        );
        
      case 'role_reveal':
        // Redirect to dedicated role reveal page
        if (mounted) {
          router.push('/role-reveal');
          return null;
        }
        return null;
        
      case 'round1':
      case 'round2':
      case 'round3':
      case 'round4':
      case 'round5':
      case 'round6':
      case 'round7':
      case 'round8':
        const roundNumber = parseInt(currentPhase.replace('round', ''));
        return (
          <RoundComponent
            roundNumber={roundNumber}
            timeLeft={gameData.timeLeft || 0}
            playerId={playerId}
          />
        );
        
      case 'voting':
        return (
          <VotingComponent
            gameState={gameData.gameState}
            submissions={gameData.submissions || {}}
            timeLeft={gameData.timeLeft || 0}
            playerId={playerId}
          />
        );
        
      case 'results':
      case 'finished':
        return (
          <ResultsComponent
            results={gameData.results}
            gameState={gameData.gameState}
            submissions={gameData.submissions || {}}
          />
        );
        
      default:
        return (
          <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
            <div className="text-center text-white">
              <h2 className="text-2xl font-bold mb-4">Unknown Game Phase</h2>
              <p className="text-gray-300">Phase: {currentPhase}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen retro-grid">
      {connectionIndicator}
      {renderGamePhase()}
      {gameData && (
        <AdminControls 
          isAdmin={isAdmin} 
          gamePhase={gameData.gameState.currentPhase} 
        />
      )}
      {/* Network Monitor - shows detailed connection health */}
      <NetworkMonitor
        connectionQuality={connectionQuality}
        latency={latency}
        isConnected={isConnected}
        isOffline={isOffline}
        networkStats={networkStats}
        compact={true}
      />
    </div>
  );
}