import { PlayerRole } from '@/types/game';
import { ROLE_DESCRIPTIONS } from '@/lib/game-config';
import { useState, useEffect } from 'react';
import Image from 'next/image';

interface RoleRevealComponentProps {
  playerRole: PlayerRole | null;
  timeLeft: number;
}

export default function RoleRevealComponent({ playerRole, timeLeft }: RoleRevealComponentProps) {
  const [revealed, setRevealed] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);

  useEffect(() => {
    // Auto-reveal after 1 second
    const timer = setTimeout(() => setRevealed(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!playerRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center">
          <div className="text-red-400 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Role Assignment Error</h2>
          <p className="text-gray-300">Unable to retrieve your role. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  const roleInfo = ROLE_DESCRIPTIONS[playerRole];
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const handleRevealClick = () => {
    setRevealed(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/game/brief.png"
          alt="Mission Brief Background"
          fill
          className="object-cover opacity-15"
          priority
        />
      </div>
      
      <div className="max-w-2xl w-full relative z-10">
        {/* Timer */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-3 border border-white/20">
            <div className="text-2xl font-mono text-white">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
            <div className="ml-3 text-gray-300">until Round 1</div>
          </div>
        </div>

        {/* Role Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
          {!revealed ? (
            <div className="p-12 text-center">
              <div className="text-8xl mb-6 animate-bounce">🎭</div>
              <h1 className="text-3xl font-bold text-white mb-4">Gizli Rolün</h1>
              <p className="text-xl text-gray-300 mb-8">
                Rolünü ve stratejini görmek için tıkla
              </p>
              <button
                onClick={handleRevealClick}
                className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold rounded-xl text-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Rolü Göster
              </button>
            </div>
          ) : (
            <div className="animate-fadeIn">
              {/* Role Header */}
              <div className={`p-8 text-center text-white ${roleInfo.color.replace('bg-', 'bg-gradient-to-r from-').replace('-500', '-600 to-').replace('to-', roleInfo.color.replace('bg-', '')).replace('-500', '-500')}`}>
                <div className="text-6xl mb-4">
                  {playerRole === 'human' && '👤'}
                  {playerRole === 'ai_user' && '🤖'}
                  {playerRole === 'troll' && '👹'}
                  {playerRole === 'mixed' && '🎭'}
                </div>
                <h1 className="text-4xl font-bold mb-2">{roleInfo.name}</h1>
                <p className="text-xl opacity-90">{roleInfo.description}</p>
              </div>

              {/* Strategy Section */}
              <div className="p-8">
                <div className="mb-6">
                  <button
                    onClick={() => setShowStrategy(!showStrategy)}
                    className="flex items-center justify-between w-full p-4 bg-white/5 rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200"
                  >
                    <span className="text-lg font-semibold text-white">
                      📋 Strateji Rehberi
                    </span>
                    <span className={`text-2xl text-white transition-transform duration-200 ${showStrategy ? 'rotate-180' : ''}`}>
                      ↓
                    </span>
                  </button>
                  
                  {showStrategy && (
                    <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 animate-slideDown">
                      <p className="text-gray-300 leading-relaxed">
                        {roleInfo.strategy}
                      </p>
                    </div>
                  )}
                </div>

                {/* Key Tips */}
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-yellow-300 mb-3 flex items-center">
                    💡 Önemli İpuçları
                  </h3>
                  <div className="space-y-2 text-sm text-gray-300">
                    {playerRole === 'human' && (
                      <>
                        <p>• Gerçek kişisel deneyimlerini ve duygularını paylaş</p>
                        <p>• Zaman zaman doğal hatalar ve yazım yanlışları yap</p>
                        <p>• Gerçek hayatından spesifik detayları anlat</p>
                        <p>• Kırılganlık göster ve otantik tepkiler ver</p>
                      </>
                    )}
                    {playerRole === 'ai_user' && (
                      <>
                        <p>• TÜM cevapların için AI araçları kullan (ChatGPT, Claude)</p>
                        <p>• AI'dan gelen metni direkt kopyala-yapıştır</p>
                        <p>• Cilalı, yapılandırılmış ve aşırı yardımcı ol</p>
                        <p>• Tipik AI desenlerini göster: listeler, resmi ton, eksiksizlik</p>
                      </>
                    )}
                    {playerRole === 'troll' && (
                      <>
                        <p>• İletişim tarzında öngörülemez ol</p>
                        <p>• Çok insansı ve çok AI benzeri görünmek arasında geçiş yap</p>
                        <p>• Gerçek kimliğin hakkında kafa karışıklığı yarat</p>
                        <p>• Oyun kuralları içinde kalarak diğerlerini yanılt</p>
                      </>
                    )}
                    {playerRole === 'mixed' && (
                      <>
                        <p>• Ne zaman otantik, ne zaman AI destekli olacağını stratejik seç</p>
                        <p>• Bazı cevaplar için AI cilaları, diğerleri için ham insanlık kullan</p>
                        <p>• Kategorize edilmesi zor, inandırıcı bir karışım yarat</p>
                        <p>• Diğerlerini gerçek doğan hakkında tahmin ettir</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Round Preview */}
                <div className="mt-6 bg-white/5 rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    🚀 Sırada Ne Var
                  </h3>
                  <div className="space-y-3 text-sm text-gray-300">
                    <div className="flex items-center">
                      <span className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-3">1</span>
                      <span>8 round yaratıcı sorular (her biri 3 dakika)</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-3">2</span>
                      <span>Rolleri tahmin etme zamanı (10 dakika)</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-3">3</span>
                      <span>Sonuçlar ve puanlama</span>
                    </div>
                  </div>
                </div>

                {/* Final Reminder */}
                <div className="mt-6 text-center">
                  <div className="inline-flex items-center bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-xl px-6 py-3">
                    <span className="text-2xl mr-3">🤫</span>
                    <div className="text-left">
                      <div className="text-white font-semibold">Unutma:</div>
                      <div className="text-pink-300 text-sm">Rolünü diğer oyunculardan gizli tut!</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wait Message */}
        {revealed && (
          <div className="text-center mt-8">
            <p className="text-gray-300 text-lg">
              Hazırlan! 1. Round başlıyor {' '}
              <span className="font-mono font-bold text-white">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}