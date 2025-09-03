export type PlayerRole = 'human' | 'ai_user' | 'troll';

export type GamePhase = 'lobby' | 'role_reveal' | 'round1' | 'round2' | 'round3' | 'round4' | 'round5' | 'round6' | 'round7' | 'round8' | 'voting' | 'results' | 'finished';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  joinedAt: Date;
  isConnected: boolean;
  lastSeen: Date;
  isAdmin?: boolean;
}

export interface GameState {
  currentPhase: GamePhase;
  phaseEndTime: Date | null;
  startedAt: Date | null;
  players: Player[];
  adminPlayer: Player | null; // Separate admin slot
  minPlayers: number;
  maxPlayers: number;
  roundDuration: number; // minutes
  votingDuration: number; // minutes
}

export interface Submission {
  id: string;
  playerId: string;
  playerName: string;
  roundNumber: number;
  content: string;
  submittedAt: Date;
}

export interface Vote {
  id: string;
  voterId: string;
  voterName: string;
  targetPlayerId: string;
  targetPlayerName: string;
  predictedRole: PlayerRole;
  submittedAt: Date;
}

export interface RoundConfig {
  roundNumber: number;
  title: string;
  description: string;
  prompt: string;
  duration: number; // minutes
  maxLength: number; // characters
}

export interface VotingResults {
  playerId: string;
  playerName: string;
  actualRole: PlayerRole;
  votes: {
    role: PlayerRole;
    count: number;
    percentage: number;
  }[];
  mostVotedRole: PlayerRole;
  correctGuesses: number;
}

export interface PlayerScore {
  playerId: string;
  playerName: string;
  role: PlayerRole;
  correctGuesses: number;
  totalVotes: number;
  accuracy: number;
  points: number;
  wasGuessedCorrectly: boolean;
  timesGuessedAs: Record<PlayerRole, number>;
}

export interface GameResults {
  finalScores: PlayerScore[];
  votingResults: VotingResults[];
  roundSubmissions: Record<number, Submission[]>;
  gameStats: {
    totalPlayers: number;
    gameDuration: number; // minutes
    averageAccuracy: number;
    mostAccuratePlayer: string;
    bestHiddenRole: string;
  };
}

// Client-side events
export interface GameEvent {
  type: 'player_joined' | 'player_left' | 'phase_changed' | 'submission_received'
      | 'vote_received' | 'game_started' | 'game_ended' | 'timer_update' | 'admin_left' | 'admin_joined' | 'timer_set' | 'game_destroyed' | 'role_assigned' | 'cheater_alert';
  data: any;
  timestamp: Date;
}

// Server-Sent Events data structure
export interface SSEMessage {
  event: string;
  data: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface JoinGameRequest {
  name: string;
}

export interface SubmissionRequest {
  roundNumber: number;
  content: string;
}

export interface VoteRequest {
  targetPlayerId: string;
  predictedRole: PlayerRole;
}

// Admin actions
export interface AdminAction {
  action: 'start_game' | 'advance_phase' | 'skip_phase' | 'assign_role' | 'kick_player' | 'reset_game' | 'set_timer' | 'destroy_game';
  playerId?: string;
  role?: PlayerRole;
  duration?: number; // in seconds
}