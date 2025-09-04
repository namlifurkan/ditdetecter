'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Home() {
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsJoining(true);
    setError(null);

    try {
      const response = await fetch('/api/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        // Store initial game data in sessionStorage for immediate use
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('initialGameData', JSON.stringify({
            gameState: result.data.gameState,
            playerRole: result.data.playerRole,
            timestamp: result.timestamp
          }));
        }
        
        // Redirect based on game phase
        const currentPhase = result.data.gameState.currentPhase;
        if (currentPhase === 'role_reveal') {
          router.push('/role-reveal');
        } else if (currentPhase === 'lobby') {
          // Stay on lobby if still in lobby phase
          // Don't redirect anywhere, just update UI
          return;
        } else {
          // For rounds, voting, results phases
          router.push('/game');
        }
      } else {
        setError(result.error || 'Failed to join game');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen retro-grid relative overflow-hidden">
      {/* Arcade ambiance effects */}
      <div className="absolute top-10 left-10 w-64 h-64 bg-gradient-radial from-cyan-500/20 to-transparent rounded-full blur-2xl"></div>
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-gradient-radial from-pink-500/20 to-transparent rounded-full blur-2xl"></div>
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="grid lg:grid-cols-2 gap-8 items-center max-w-6xl mx-auto">
          {/* Left Column - Logo and Description */}
          <div className="text-center lg:text-left">
            {/* Logo with Frame */}
            <div className="flex justify-center lg:justify-start mb-8">
              <div className="relative">
                {/* Glow effect background */}
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-2xl blur-xl"></div>
                {/* Logo container with frame */}
                <div className="relative bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/30 shadow-2xl">
                  <Image
                    src="/game/logo.png"
                    alt="Dead Internet Detector"
                    width={280}
                    height={140}
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              <h1 className="text-3xl lg:text-4xl font-bold mb-4 neon-text-pink" style={{fontFamily: 'Orbitron, monospace'}}>
                AI'YI YAKALABIIR MISIN?
              </h1>
              <p className="text-lg neon-text-cyan-soft mb-4" style={{fontFamily: 'Orbitron, monospace'}}>
                ÇOK OYUNCULU TESPIT PROTOKOLÜ:<br/>
                AI SIZMA AJANLARINI VS İNSAN OTANTİKLİĞİNİ TANILA
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 text-sm score-display">
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2" style={{boxShadow: '0 0 5px #00ff00'}}></span>
                  8-16 KİŞİ
                </span>
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2" style={{boxShadow: '0 0 5px #00ffff'}}></span>
                  35 DAKİKA
                </span>
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-pink-400 rounded-full mr-2" style={{boxShadow: '0 0 5px #ff00ff'}}></span>
                  CANLI
                </span>
              </div>
            </div>

            {/* Join Form */}
            <div className="arcade-panel p-6">
              <form onSubmit={handleJoinGame} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-lg font-medium neon-text-green mb-2" style={{fontFamily: 'Press Start 2P, monospace', fontSize: '14px'}}>
                    KULLANICI ADI GİR
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="OYUNCU_ID"
                    maxLength={20}
                    className="w-full px-4 py-3 bg-black/80 border-2 border-cyan-400 neon-text-cyan focus:outline-none focus:border-pink-400 focus:shadow-[0_0_15px_rgba(0,255,255,0.5)] text-lg font-mono"
                    style={{fontFamily: 'Orbitron, monospace'}}
                    disabled={isJoining}
                  />
                  <p className="text-sm text-gray-400 mt-1">
                    {name.length}/20 karakter
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3">
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!name.trim() || isJoining}
                  className="w-full arcade-button disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isJoining ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      BAĞLANILIYOR...
                    </span>
                  ) : (
                    'BAŞLAT'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column - Game Rules */}
          <div className="space-y-6">
            {/* Roles Section */}
            <div className="arcade-panel p-6">
              <h2 className="text-2xl font-bold neon-text-pink mb-4 flex items-center" style={{fontFamily: 'Press Start 2P, monospace', fontSize: '18px'}}>
                🎭 <span className="ml-2">AJAN TİPLERİ</span>
              </h2>
              
              {/* Roles Visual */}
              <div className="bg-white rounded-xl p-6 mb-10 shadow-lg overflow-hidden">
                <Image
                  src="/game/roles.png"
                  alt="Agent Types"
                  width={500}
                  height={240}
                  className="object-cover w-full h-60"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-black/50 border-2 border-green-400 p-3 retro-pulse" style={{boxShadow: '0 0 10px rgba(0, 255, 0, 0.3)'}}>
                  <div className="font-semibold neon-text-green mb-1" style={{fontFamily: 'Press Start 2P, monospace', fontSize: '10px'}}>👤 SAF_İNSAN</div>
                  <div className="text-sm text-gray-200" style={{fontFamily: 'Orbitron, monospace'}}>%100 OTANTİK</div>
                </div>
                <div className="bg-black/50 border-2 border-cyan-400 p-3 retro-pulse" style={{boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)'}}>
                  <div className="font-semibold neon-text-cyan mb-1" style={{fontFamily: 'Press Start 2P, monospace', fontSize: '10px'}}>🤖 AI_AJAN</div>
                  <div className="text-sm text-gray-200" style={{fontFamily: 'Orbitron, monospace'}}>NEURAL DESTEKLİ</div>
                </div>
                <div className="bg-black/50 border-2 border-red-400 p-3 retro-pulse" style={{boxShadow: '0 0 10px rgba(255, 0, 0, 0.3)'}}>
                  <div className="font-semibold neon-text-pink mb-1" style={{fontFamily: 'Press Start 2P, monospace', fontSize: '10px'}}>👹 KAOS_BİRİM</div>
                  <div className="text-sm text-gray-200" style={{fontFamily: 'Orbitron, monospace'}}>BOZGUNCU MOD</div>
                </div>
                <div className="bg-black/50 border-2 border-purple-400 p-3 retro-pulse" style={{boxShadow: '0 0 10px rgba(128, 0, 255, 0.3)'}}>
                  <div className="font-semibold text-purple-300 mb-1" style={{fontFamily: 'Press Start 2P, monospace', fontSize: '10px'}}>🎭 HİBRİT_SİS</div>
                  <div className="text-sm text-gray-200" style={{fontFamily: 'Orbitron, monospace'}}>UYARLAMALI KARIŞIM</div>
                </div>
              </div>
            </div>

            {/* How to Play */}
            <div className="arcade-panel p-6">
              <h2 className="text-xl font-bold neon-text-cyan mb-4 flex items-center" style={{fontFamily: 'Press Start 2P, monospace', fontSize: '16px'}}>
                🎮 <span className="ml-2">PROTOKOL</span>
              </h2>
              <div className="space-y-3 text-sm neon-text-green-soft" style={{fontFamily: 'Orbitron, monospace'}}>
                <div className="flex items-center">
                  <span className="w-6 h-6 bg-purple-600 border border-purple-400 flex items-center justify-center text-white text-xs font-bold mr-3 score-display">1</span>
                  <span>GİZLİ ROL AL</span>
                </div>
                <div className="flex items-center">
                  <span className="w-6 h-6 bg-cyan-600 border border-cyan-400 flex items-center justify-center text-white text-xs font-bold mr-3 score-display">2</span>
                  <span>8 MİSYON TAMAMLA (3DK/HER BİRİ)</span>
                </div>
                <div className="flex items-center">
                  <span className="w-6 h-6 bg-green-600 border border-green-400 flex items-center justify-center text-white text-xs font-bold mr-3 score-display">3</span>
                  <span>AJAN TİPLERİNİ TANILA</span>
                </div>
                <div className="flex items-center">
                  <span className="w-6 h-6 bg-yellow-600 border border-yellow-400 flex items-center justify-center text-white text-xs font-bold mr-3 score-display">4</span>
                  <span>TESPİT PUANI KAZAN</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
