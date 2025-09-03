import { useState, useEffect } from 'react';
import { GameState, Submission, PlayerRole } from '@/types/game';
import { ROLE_DESCRIPTIONS, ROUND_CONFIGS } from '@/lib/game-config';
import { formatTimeForDisplay } from '@/lib/date-utils';

interface VotingComponentProps {
  gameState: Omit<GameState, 'players'> & { players: Omit<GameState['players'][0], 'role'>[] };
  submissions: Record<number, Submission[]>;
  timeLeft: number;
  playerId: string;
}

interface Vote {
  targetPlayerId: string;
  predictedRole: PlayerRole;
}

export default function VotingComponent({ gameState, submissions, timeLeft, playerId }: VotingComponentProps) {
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'players' | 'submissions'>('submissions');

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isTimeRunningOut = timeLeft <= 300; // 5 minutes

  // Include both regular players and admin (if not current player)
  const allPlayers = [
    ...gameState.players,
    ...(gameState.adminPlayer && gameState.adminPlayer.id !== playerId ? [gameState.adminPlayer] : [])
  ];
  const otherPlayers = allPlayers.filter(p => p.id !== playerId);
  const votedCount = Object.keys(votes).length;
  const totalPlayersToVote = otherPlayers.length;

  const handleVote = async (targetPlayerId: string, predictedRole: PlayerRole) => {
    if (targetPlayerId === playerId) return; // Can't vote for yourself

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetPlayerId,
          predictedRole,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setVotes(prev => ({
          ...prev,
          [targetPlayerId]: { targetPlayerId, predictedRole }
        }));
      } else {
        setError(result.error || 'Failed to submit vote');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get submissions by player
  const getSubmissionsByPlayer = (playerId: string) => {
    const playerSubmissions: Record<number, Submission | undefined> = {};
    Object.entries(submissions).forEach(([roundNum, roundSubmissions]) => {
      const submission = roundSubmissions.find(s => s.playerId === playerId);
      playerSubmissions[parseInt(roundNum)] = submission;
    });
    return playerSubmissions;
  };

  // Render submission card
  const renderSubmission = (submission: Submission, roundNumber: number) => {
    const roundConfig = ROUND_CONFIGS.find(r => r.roundNumber === roundNumber);
    return (
      <div key={`${submission.playerId}-${roundNumber}`} className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <span className="text-lg font-bold text-white">{submission.playerName}</span>
            <span className="ml-2 text-sm text-gray-400">#{gameState.players.findIndex(p => p.id === submission.playerId) + 1}</span>
          </div>
          <div className="text-sm text-gray-400">
            Round {roundNumber}: {roundConfig?.title}
          </div>
        </div>
        <div className="text-gray-300 leading-relaxed mb-3 bg-white/5 rounded-lg p-3">
          {submission.content}
        </div>
        <div className="text-xs text-gray-500">
          Submitted at {formatTimeForDisplay(submission.submittedAt)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-3 border border-white/20 mb-4">
            <div className={`text-3xl font-mono font-bold ${isTimeRunningOut ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
            <div className="ml-4 text-gray-300">voting time left</div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Voting Phase</h1>
          <p className="text-xl text-gray-300">
            Review all submissions and predict each player's role
          </p>
        </div>

        {/* Progress */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Voting Progress</h2>
            <div className="text-lg font-bold text-white">
              {votedCount}/{totalPlayersToVote}
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${totalPlayersToVote > 0 ? (votedCount / totalPlayersToVote) * 100 : 0}%` }}
            />
          </div>
          <p className="text-sm text-gray-400 mt-2">
            {votedCount === totalPlayersToVote ? 
              '🎉 All votes submitted! Wait for results...' : 
              'Vote for each player to see their predicted role'
            }
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2 border border-white/20">
            <button
              onClick={() => setViewMode('submissions')}
              className={`px-6 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'submissions' 
                  ? 'bg-purple-500 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              📝 View by Submissions
            </button>
            <button
              onClick={() => setViewMode('players')}
              className={`px-6 py-2 rounded-xl font-medium transition-all duration-200 ${
                viewMode === 'players' 
                  ? 'bg-purple-500 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              👥 View by Players
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/30 rounded-xl p-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Content */}
        {viewMode === 'submissions' ? (
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
                    {roundSubmissions.length > 0 ? (
                      roundSubmissions.map(submission => renderSubmission(submission, roundNumber))
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        No submissions for this round
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-6">
            {otherPlayers.map(player => {
              const playerSubmissions = getSubmissionsByPlayer(player.id);
              const currentVote = votes[player.id];
              
              return (
                <div key={player.id} className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
                  {/* Player Header */}
                  <div className="p-6 border-b border-white/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded-full mr-3 ${player.isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                        <h3 className="text-2xl font-bold text-white">{player.name}</h3>
                        <span className="ml-3 text-sm text-gray-400">
                          Player #{gameState.players.findIndex(p => p.id === player.id) + 1}
                        </span>
                      </div>
                      {currentVote && (
                        <div className="flex items-center">
                          <span className="text-sm text-gray-300 mr-2">Voted:</span>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            ROLE_DESCRIPTIONS[currentVote.predictedRole].color.replace('bg-', 'bg-').replace('-500', '-500/20 text-') + currentVote.predictedRole.replace('_', '-')
                          }`}>
                            {ROLE_DESCRIPTIONS[currentVote.predictedRole].name}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Player Submissions */}
                  <div className="p-6">
                    <div className="grid gap-4 mb-6">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(roundNumber => {
                        const submission = playerSubmissions[roundNumber];
                        const roundConfig = ROUND_CONFIGS.find(r => r.roundNumber === roundNumber);
                        
                        return (
                          <div key={roundNumber} className="bg-white/5 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-300">
                                Round {roundNumber}: {roundConfig?.title}
                              </span>
                              {!submission && <span className="text-xs text-red-400">No submission</span>}
                            </div>
                            {submission ? (
                              <div className="text-gray-300 bg-white/5 rounded-lg p-3">
                                {submission.content}
                              </div>
                            ) : (
                              <div className="text-gray-500 italic text-sm">
                                No submission for this round
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Role Voting */}
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-4">
                        What role do you think {player.name} is?
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {(['human', 'ai_user', 'troll', 'mixed'] as PlayerRole[]).map(role => {
                          const roleInfo = ROLE_DESCRIPTIONS[role];
                          const isSelected = currentVote?.predictedRole === role;
                          
                          return (
                            <button
                              key={role}
                              onClick={() => handleVote(player.id, role)}
                              disabled={isSubmitting}
                              className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                                isSelected
                                  ? `${roleInfo.color} border-white/50 ring-2 ring-white/30`
                                  : 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/40'
                              } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-white font-semibold">{roleInfo.name}</div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    {role === 'human' && '👤 Pure human behavior'}
                                    {role === 'ai_user' && '🤖 Pure AI responses'}
                                    {role === 'troll' && '👹 Causing chaos'}
                                    {role === 'mixed' && '🎭 Strategic blend'}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="text-white text-xl">✓</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Final Status */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-6 text-sm text-gray-300">
            <span className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${votedCount === totalPlayersToVote ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
              {votedCount === totalPlayersToVote ? 'All Votes Cast' : `${votedCount}/${totalPlayersToVote} Votes`}
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
              Voting Phase
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