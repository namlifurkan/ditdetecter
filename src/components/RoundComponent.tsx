import { useState, useEffect, useCallback } from 'react';
import { ROUND_CONFIGS } from '@/lib/game-config';

interface RoundComponentProps {
  roundNumber: number;
  timeLeft: number;
  playerId: string;
}

export default function RoundComponent({ roundNumber, timeLeft, playerId }: RoundComponentProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(true);

  // Reset submission state when round changes
  useEffect(() => {
    setContent('');
    setHasSubmitted(false);
    setError(null);
    setIsSubmitting(false);
    setShowPrompt(true);
  }, [roundNumber]);

  const roundConfig = ROUND_CONFIGS.find(r => r.roundNumber === roundNumber);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isTimeRunningOut = timeLeft <= 300; // 5 minutes
  const characterCount = content.length;
  const isOverLimit = roundConfig ? characterCount > roundConfig.maxLength : false;

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || isOverLimit || hasSubmitted) return;

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Submitting:', { roundNumber, content: content.trim() });
      
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roundNumber,
          content: content.trim(),
        }),
      });

      const result = await response.json();
      console.log('Submission result:', result);

      if (result.success) {
        setHasSubmitted(true);
      } else {
        setError(result.error || 'Failed to submit');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsSubmitting(false);
    }
  }, [roundNumber, content, isOverLimit, hasSubmitted]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft <= 0 && content.trim() && !hasSubmitted && !isSubmitting) {
      handleSubmit();
    }
  }, [timeLeft, content, hasSubmitted, isSubmitting, handleSubmit]);

  if (!roundConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Invalid Round</h2>
          <p className="text-gray-300">Round {roundNumber} not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-3 border border-white/20 mb-4">
            <div className={`text-3xl font-mono font-bold ${isTimeRunningOut ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
            <div className="ml-4 text-gray-300">remaining</div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Round {roundNumber}: {roundConfig.title}
          </h1>
          <p className="text-xl text-gray-300">
            {roundConfig.description}
          </p>
        </div>

        {/* Prompt */}
        {showPrompt && (
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-blue-500/20">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold text-blue-300">📝 Senin Görevin</h2>
              <button
                onClick={() => setShowPrompt(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-lg text-gray-300 leading-relaxed">
              {roundConfig.prompt}
            </p>
            <div className="mt-4 flex items-center text-sm text-blue-300">
              <span className="mr-4">📏 En fazla {roundConfig.maxLength} karakter</span>
              <span>⏰ {roundConfig.duration} dakika</span>
            </div>
          </div>
        )}

        {!showPrompt && (
          <div className="mb-4">
            <button
              onClick={() => setShowPrompt(true)}
              className="text-blue-300 hover:text-blue-200 text-sm underline"
            >
              📝 Görevi tekrar göster
            </button>
          </div>
        )}

        {/* Submission Form */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
          <div className="p-6 border-b border-white/20">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Senin Cevabın</h3>
              <div className={`text-sm font-medium ${
                isOverLimit ? 'text-red-400' : 
                characterCount > roundConfig.maxLength * 0.8 ? 'text-yellow-400' : 
                'text-gray-400'
              }`}>
                {characterCount}/{roundConfig.maxLength}
              </div>
            </div>
          </div>

          <div className="p-6">
            {hasSubmitted ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-2xl font-bold text-green-400 mb-2">Gönderildi!</h3>
                <p className="text-gray-300 mb-6">
                  Cevabın kaydedildi. Diğer oyuncuların bitmesini bekle.
                </p>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-sm text-gray-400 mb-2">Senin gönderdiğin:</p>
                  <div className="text-white bg-white/5 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {content}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`Cevabını buraya yazmaya başla...`}
                  className="w-full h-64 p-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  disabled={isSubmitting}
                  maxLength={roundConfig.maxLength + 100} // Allow slight overflow for UX
                />

                {error && (
                  <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-6">
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <div className="flex items-center">
                      <span className="mr-2">💡</span>
                      <span>Yaratıcı ve otantik ol!</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!content.trim() || isOverLimit || isSubmitting}
                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Gönderiliyor...
                      </span>
                    ) : (
                      'Cevabı Gönder'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Helper Tips */}
        {!hasSubmitted && (
          <div className="mt-8 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur-sm rounded-2xl p-6 border border-yellow-500/20">
            <h3 className="text-lg font-bold text-yellow-300 mb-3 flex items-center">
              💡 Bu Round İçin İpuçları
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
              <div>• Yaratıcı ol ve kalıpların dışında düşün</div>
              <div>• Cevabını ilgi çekici ve akılda kalıcı yap</div>
              <div>• Seni benzersiz kılan insan özelliklerini düşün</div>
              <div>• Cevabın verirken eğlen!</div>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center space-x-6 text-sm text-gray-300">
            <span className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${hasSubmitted ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
              {hasSubmitted ? 'Submitted' : 'In Progress'}
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
              Round {roundNumber} of 8
            </span>
            {isTimeRunningOut && (
              <span className="flex items-center text-red-400 animate-pulse">
                <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                Time running out!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}