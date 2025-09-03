import { useState, useEffect } from 'react';
import { GameState, GameResults, Submission } from '@/types/game';
import { ROLE_DESCRIPTIONS, ROUND_CONFIGS } from '@/lib/game-config';
import { formatTimeForDisplay } from '@/lib/date-utils';

interface ResultsComponentProps {
  results: GameResults | undefined;
  gameState: Omit<GameState, 'players'> & { players: Omit<GameState['players'][0], 'role'>[] };
  submissions: Record<number, Submission[]>;
}

export default function ResultsComponent({ results, gameState, submissions }: ResultsComponentProps) {
  const [revealedPlayers, setRevealedPlayers] = useState<Set<string>>(new Set());
  const [currentView, setCurrentView] = useState<'leaderboard' | 'analysis' | 'submissions'>('leaderboard');
  const [animationPhase, setAnimationPhase] = useState<'initial' | 'revealing' | 'complete'>('initial');

  // Initialize animation when results first arrive
  useEffect(() => {
    if (results && animationPhase === 'initial') {
      const timer1 = setTimeout(() => setAnimationPhase('revealing'), 1000);
      return () => clearTimeout(timer1);
    }
  }, [results, animationPhase]);

  // Handle revealing animation
  useEffect(() => {
    if (results && animationPhase === 'revealing') {
      const revealTimer = setInterval(() => {
        setRevealedPlayers(prev => {
          if (prev.size >= results.finalScores.length) {
            clearInterval(revealTimer);
            setAnimationPhase('complete');
            return prev;
          }
          
          const nextIndex = prev.size;
          const nextPlayerId = results.finalScores[nextIndex]?.playerId;
          if (nextPlayerId) {
            return new Set([...prev, nextPlayerId]);
          }
          return prev;
        });
      }, 800); // Reveal one player every 0.8 seconds

      return () => clearInterval(revealTimer);
    }
  }, [results, animationPhase]);

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Calculating results...</p>
        </div>
      </div>
    );
  }

  const newGame = async () => {
    try {
      const response = await fetch('/api/game-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reset' }),
      });
      
      if (response.ok) {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    } catch (error) {
      console.error('Error resetting game:', error);
    }
  };

  const renderLeaderboard = () => (
    <div className="space-y-6">
      {/* Game Stats */}
      <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30">
        <h2 className="text-2xl font-bold text-white mb-4 text-center">🎉 Game Complete!</h2>
        <div className="grid md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-white">{results.gameStats.totalPlayers}</div>
            <div className="text-sm text-gray-300">Players</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">{results.gameStats.gameDuration}min</div>
            <div className="text-sm text-gray-300">Duration</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">{results.gameStats.averageAccuracy}%</div>
            <div className="text-sm text-gray-300">Avg Accuracy</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">8</div>
            <div className="text-sm text-gray-300">Rounds</div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
        <div className="p-6 border-b border-white/20">
          <h2 className="text-2xl font-bold text-white text-center">🏆 Final Leaderboard</h2>
        </div>
        
        <div className="divide-y divide-white/10">
          {results.finalScores.map((score, index) => {
            const isRevealed = revealedPlayers.has(score.playerId) || animationPhase === 'complete';
            const roleInfo = ROLE_DESCRIPTIONS[score.role];
            
            return (
              <div 
                key={score.playerId}
                className={`p-6 transition-all duration-500 ${
                  isRevealed ? 'opacity-100 transform translate-x-0' : 'opacity-30 transform translate-x-4'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Rank */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                      index === 0 ? 'bg-yellow-500 text-black' :
                      index === 1 ? 'bg-gray-400 text-black' :
                      index === 2 ? 'bg-amber-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </div>

                    {/* Player Info */}
                    <div>
                      <div className="flex items-center">
                        <span className="text-xl font-bold text-white">{score.playerName}</span>
                        {isRevealed && (
                          <div className={`ml-3 px-3 py-1 rounded-full text-sm font-medium animate-fadeIn ${roleInfo.color}/20 border ${roleInfo.color}/30 text-white`}>
                            {roleInfo.name}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-300 mt-1">
                        <span>Accuracy: {Math.round(score.accuracy * 100)}%</span>
                        <span>Correct Guesses: {score.correctGuesses}/{score.totalVotes}</span>
                        {score.wasGuessedCorrectly ? (
                          <span className="text-red-400">Role Discovered</span>
                        ) : (
                          <span className="text-green-400">+50 Stealth Bonus</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">{score.points}</div>
                    <div className="text-sm text-gray-400">points</div>
                  </div>
                </div>

                {/* Role Reveal Animation */}
                {isRevealed && animationPhase === 'complete' && (
                  <div className="mt-4 bg-white/5 rounded-xl p-4 animate-slideDown">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">How others saw them:</span>
                      <div className="flex items-center space-x-2">
                        {Object.entries(score.timesGuessedAs).map(([role, count]) => {
                          if (count === 0) return null;
                          const guessRoleInfo = ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS];
                          return (
                            <span key={role} className="text-xs px-2 py-1 bg-white/10 rounded-full">
                              {guessRoleInfo.name}: {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Special Awards */}
      {animationPhase === 'complete' && (
        <div className="grid md:grid-cols-2 gap-6 animate-fadeIn">
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm rounded-2xl p-6 border border-yellow-500/30">
            <h3 className="text-lg font-bold text-yellow-300 mb-2 flex items-center">
              🎯 Most Accurate Detector
            </h3>
            <div className="text-white text-xl font-bold">{results.gameStats.mostAccuratePlayer}</div>
            <div className="text-sm text-gray-300 mt-1">Best at spotting roles</div>
          </div>
          
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-2xl p-6 border border-green-500/30">
            <h3 className="text-lg font-bold text-green-300 mb-2 flex items-center">
              🎭 Master of Disguise
            </h3>
            <div className="text-white text-xl font-bold">{results.gameStats.bestHiddenRole}</div>
            <div className="text-sm text-gray-300 mt-1">Best at hiding their role</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAnalysis = () => (
    <div className="space-y-6">
      {results.votingResults.map(result => {
        const roleInfo = ROLE_DESCRIPTIONS[result.actualRole];
        const wasGuessedCorrectly = result.mostVotedRole === result.actualRole;
        
        return (
          <div key={result.playerId} className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
            <div className={`p-6 ${roleInfo.color}/20 border-b border-white/20`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-4xl">
                    {result.actualRole === 'human' && '👤'}
                    {result.actualRole === 'ai_user' && '🤖'}
                    {result.actualRole === 'troll' && '👹'}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{result.playerName}</h3>
                    <p className="text-lg text-gray-300">Actually: {roleInfo.name}</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl font-bold text-lg ${
                  wasGuessedCorrectly ? 'bg-red-500/30 text-red-300' : 'bg-green-500/30 text-green-300'
                }`}>
                  {wasGuessedCorrectly ? 'Discovered' : 'Hidden'}
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <h4 className="text-lg font-semibold text-white mb-4">How players voted:</h4>
              <div className="space-y-2">
                {result.votes.map(vote => {
                  const voteRoleInfo = ROLE_DESCRIPTIONS[vote.role];
                  const isCorrect = vote.role === result.actualRole;
                  
                  return (
                    <div key={vote.role} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full ${voteRoleInfo.color}`}></div>
                        <span className="text-white font-medium">{voteRoleInfo.name}</span>
                        {isCorrect && <span className="text-green-400 text-sm">✓ Correct</span>}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-white font-bold">{vote.count} votes</div>
                        <div className="text-gray-400">({vote.percentage}%)</div>
                        <div className="w-20 bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${voteRoleInfo.color}`}
                            style={{ width: `${vote.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSubmissions = () => (
    <div className="space-y-8">
      {[1, 2, 3, 4, 5, 6, 7, 8].map(roundNumber => {
        const roundSubmissions = submissions[roundNumber] || [];
        const roundConfig = ROUND_CONFIGS.find(r => r.roundNumber === roundNumber);
        
        return (
          <div key={roundNumber} className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-2">
              Round {roundNumber}: {roundConfig?.title}
            </h2>
            <p className="text-gray-300 mb-6">{roundConfig?.description}</p>
            
            <div className="grid gap-4">
              {roundSubmissions.map(submission => {
                const playerScore = results.finalScores.find(s => s.playerId === submission.playerId);
                const roleInfo = playerScore ? ROLE_DESCRIPTIONS[playerScore.role] : null;
                
                return (
                  <div key={submission.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-bold text-white">{submission.playerName}</span>
                        {roleInfo && (
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${roleInfo.color}/20 border ${roleInfo.color}/30 text-white`}>
                            {roleInfo.name}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatTimeForDisplay(submission.submittedAt)}
                      </div>
                    </div>
                    <div className="text-gray-300 leading-relaxed bg-white/5 rounded-lg p-3">
                      {submission.content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Game Results</h1>
          <p className="text-xl text-gray-300">How did everyone do?</p>
        </div>

        {/* View Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2 border border-white/20">
            {[
              { key: 'leaderboard', label: '🏆 Leaderboard', desc: 'Final scores' },
              { key: 'analysis', label: '📊 Analysis', desc: 'Vote breakdown' },
              { key: 'submissions', label: '📝 Submissions', desc: 'All responses' }
            ].map(view => (
              <button
                key={view.key}
                onClick={() => setCurrentView(view.key as typeof currentView)}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  currentView === view.key
                    ? 'bg-purple-500 text-white shadow-lg' 
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div>{view.label}</div>
                <div className="text-xs opacity-75">{view.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {currentView === 'leaderboard' && renderLeaderboard()}
        {currentView === 'analysis' && renderAnalysis()}
        {currentView === 'submissions' && renderSubmissions()}

        {/* Actions */}
        <div className="text-center mt-12">
          <button
            onClick={newGame}
            className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-xl text-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}