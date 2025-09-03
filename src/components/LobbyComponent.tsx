import { GameState } from '@/types/game';
import { GAME_CONFIG } from '@/lib/game-config';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { formatTimeForDisplay } from '@/lib/date-utils';

interface LobbyComponentProps {
  gameState: Omit<GameState, 'players'> & { players: Omit<GameState['players'][0], 'role'>[] };
  playerId: string;
}

export default function LobbyComponent({ gameState, playerId }: LobbyComponentProps) {
  const { players, minPlayers, maxPlayers, adminPlayer } = gameState;
  const playerCount = players.length;
  const currentPlayer = players.find(p => p.id === playerId) || (adminPlayer?.id === playerId ? adminPlayer : null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  const canStart = playerCount >= minPlayers;
  const willAutoStart = playerCount >= GAME_CONFIG.LOBBY_AUTO_START_THRESHOLD;

  // Handle client-side URL access and admin check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.origin);
    }
  }, []);

  // Handle admin status client-side
  useEffect(() => {
    if (currentPlayer) {
      setIsAdmin(currentPlayer.isAdmin === true);
    }
  }, [currentPlayer]);

  const startGame = async () => {
    try {
      const response = await fetch('/api/game-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });
      
      if (!response.ok) {
        console.error('Failed to start game');
      }
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const adminForceStart = async () => {
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start_game' }),
      });
      
      if (!response.ok) {
        console.error('Failed to force start game');
      }
    } catch (error) {
      console.error('Error force starting game:', error);
    }
  };

  const adminKickPlayer = async (targetPlayerId: string) => {
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'kick_player',
          playerId: targetPlayerId 
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to kick player');
      }
    } catch (error) {
      console.error('Error kicking player:', error);
    }
  };

  const adminResetGame = async () => {
    if (confirm('Reset game? This will kick all players.')) {
      try {
        const response = await fetch('/api/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'reset_game' }),
        });
        
        if (!response.ok) {
          console.error('Failed to reset game');
        }
      } catch (error) {
        console.error('Error resetting game:', error);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/game/waiting-room.png"
          alt="Waiting Room Background"
          fill
          className="object-cover opacity-20"
          priority
        />
      </div>
      
      <div className="max-w-4xl w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Oyun Lobisi</h1>
          <p className="text-xl text-gray-300">
            Oyuncuların katılması bekleniyor...
          </p>
          {willAutoStart && (
            <p className="text-lg text-yellow-300 mt-2 animate-pulse">
              🚀 Oyun birkaç saniye içinde otomatik başlayacak!
            </p>
          )}
        </div>

        {/* Player Count */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="text-6xl font-bold text-white">
              {playerCount}
              <span className="text-2xl text-gray-400">/{maxPlayers}</span>
            </div>
          </div>
          
          <div className="flex justify-center mb-4">
            <div className="w-full max-w-md">
              <div className="flex justify-between text-sm text-gray-300 mb-2">
                <span>Oyuncular</span>
                <span>{playerCount >= minPlayers ? 'Hazır!' : `${minPlayers - playerCount} kişi daha gerekli`}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    playerCount >= minPlayers 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                      : 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  }`}
                  style={{ width: `${Math.min((playerCount / minPlayers) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {canStart && !willAutoStart && (
              <button
                onClick={startGame}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-xl text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Oyunu Başlat
              </button>
            )}
            
            {isAdmin && (
              <>
                <button
                  onClick={adminForceStart}
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl text-sm transition-all duration-200 shadow-lg"
                >
                  🔥 Admin Zorla Başlat
                </button>
                <button
                  onClick={adminResetGame}
                  className="px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold rounded-xl text-sm transition-all duration-200 shadow-lg"
                >
                  🔄 Oyunu Sıfırla
                </button>
              </>
            )}
          </div>
        </div>

        {/* Admin Section */}
        {adminPlayer && (
          <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-6 border border-red-500/30 mb-6">
            <h3 className="text-xl font-bold text-red-300 mb-4 text-center flex items-center justify-center">
              👑 Oyun Admini
            </h3>
            <div className="flex justify-center">
              <div className={`p-4 rounded-xl border transition-all duration-200 ${
                adminPlayer.id === playerId
                  ? 'bg-red-500/20 border-red-400/50 ring-2 ring-red-400/30'
                  : 'bg-white/5 border-red-500/20'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      adminPlayer.isConnected ? 'bg-green-400' : 'bg-red-400'
                    }`} />
                    <span className="text-xs px-1 py-0.5 bg-red-500 text-white rounded font-medium">
                      ADMIN
                    </span>
                  </div>
                  {adminPlayer.id === playerId && (
                    <span className="text-xs px-2 py-1 bg-pink-500 text-white rounded-full font-medium">
                      Sen
                    </span>
                  )}
                </div>
                <div className="text-white font-medium text-lg mb-1 truncate">
                  {adminPlayer.name}
                </div>
                <div className="text-xs text-gray-400">
                  Katılma: {formatTimeForDisplay(adminPlayer.joinedAt)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Players Grid */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Oyuncular ({playerCount})
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {players.map((player, index) => {
              const isCurrentPlayer = player.id === playerId;
              const joinTime = formatTimeForDisplay(player.joinedAt);

              return (
                <div 
                  key={player.id}
                  className={`p-4 rounded-xl border transition-all duration-200 ${
                    isCurrentPlayer
                      ? 'bg-pink-500/20 border-pink-400/50 ring-2 ring-pink-400/30'
                      : player.isConnected
                        ? 'bg-white/5 border-white/20 hover:bg-white/10'
                        : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        player.isConnected ? 'bg-green-400' : 'bg-red-400'
                      }`} />
                      <span className="text-sm text-gray-400">#{index + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCurrentPlayer && (
                        <span className="text-xs px-2 py-1 bg-pink-500 text-white rounded-full font-medium">
                          Sen
                        </span>
                      )}
                      {isAdmin && !isCurrentPlayer && (
                        <button
                          onClick={() => adminKickPlayer(player.id)}
                          className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
                        >
                          At
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-white font-medium text-lg mb-1 truncate">
                    {player.name}
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    Katılma: {joinTime}
                  </div>
                  
                  {!player.isConnected && (
                    <div className="text-xs text-red-300 mt-2 font-medium">
                      Bağlantı Kesildi
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Empty slots */}
            {Array.from({ length: Math.max(0, minPlayers - playerCount) }).map((_, index) => (
              <div 
                key={`empty-${index}`}
                className="p-4 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center"
              >
                <div className="text-center">
                  <div className="text-3xl text-gray-500 mb-2">👤</div>
                  <div className="text-sm text-gray-400">Bekleniyor...</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Game Rules Reminder */}
        <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4">🎯 Quick Reminder</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
            <div className="text-center">
              <div className="text-2xl mb-2">📝</div>
              <div className="font-medium text-white">3 Rounds</div>
              <div>Creative writing challenges</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">🗳️</div>
              <div className="font-medium text-white">Vote</div>
              <div>Guess everyone's role</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">🏆</div>
              <div className="font-medium text-white">Win</div>
              <div>Score points & hide your role</div>
            </div>
          </div>
        </div>

        {/* Share Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm mb-2">
            Share this link with friends to join:
          </p>
          <div className="inline-flex items-center bg-white/10 rounded-xl px-4 py-2 border border-white/20">
            <span className="text-white font-mono text-sm">
              {currentUrl || 'Loading...'}
            </span>
            <button
              onClick={() => {
                if (currentUrl && typeof navigator !== 'undefined') {
                  navigator.clipboard.writeText(currentUrl);
                }
              }}
              className="ml-3 px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors"
              disabled={!currentUrl}
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}