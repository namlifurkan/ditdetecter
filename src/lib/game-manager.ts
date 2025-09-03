import { GameState, Player, Submission, Vote, GameEvent, PlayerRole, VotingResults, PlayerScore, GameResults } from '@/types/game';
import { assignRoles, POINTS_CONFIG } from './game-config';
import { getGameConfig, assignTestRoles, TEST_CONFIG } from './test-config';
import { EventEmitter } from 'events';
import SessionManager from './session-manager';

class GameManager extends EventEmitter {
  private gameState: GameState;
  private submissions: Map<number, Submission[]> = new Map();
  private votes: Vote[] = [];
  private phaseTimer: NodeJS.Timeout | null = null;
  private disconnectionTimers: Map<string, NodeJS.Timeout> = new Map();
  private sessionManager: SessionManager;
  private roomId: string = 'main';

  constructor() {
    super();
    this.sessionManager = SessionManager.getInstance();
    this.gameState = this.initializeGameState();
    this.restoreGameState();
  }

  private initializeGameState(): GameState {
    const config = getGameConfig();
    return {
      currentPhase: 'lobby',
      phaseEndTime: null,
      startedAt: null,
      players: [],
      adminPlayer: null,
      minPlayers: config.MIN_PLAYERS,
      maxPlayers: config.MAX_PLAYERS,
      roundDuration: config.ROUND_DURATION,
      votingDuration: config.VOTING_DURATION,
    };
  }

  private restoreGameState(): void {
    const savedState = this.sessionManager.getGameState(this.roomId);
    if (savedState) {
      console.log('Restoring game state from session:', savedState.currentPhase);
      this.gameState = { ...savedState };
      
      // Restore players from sessions
      const activePlayers = this.sessionManager.getActivePlayers(this.roomId);
      const adminPlayer = this.sessionManager.getAdminPlayer(this.roomId);
      
      this.gameState.players = activePlayers;
      this.gameState.adminPlayer = adminPlayer;
      
      console.log(`Restored ${activePlayers.length} players and admin: ${adminPlayer ? 'yes' : 'no'}`);
    }
  }

  private saveGameState(): void {
    this.sessionManager.saveGameState(this.gameState, this.roomId);
  }

  // Player management with session persistence
  addPlayer(name: string, isAdmin: boolean = false, existingPlayerId?: string): Player | null {
    if (this.gameState.currentPhase !== 'lobby') {
      return null; // Can only join during lobby
    }

    // Try to restore existing session first
    if (existingPlayerId) {
      const canRejoin = this.sessionManager.canRejoinGame(existingPlayerId);
      if (canRejoin) {
        const session = this.sessionManager.getSession(existingPlayerId);
        if (session && session.playerName.toLowerCase() === name.toLowerCase()) {
          // Restore session
          this.sessionManager.updateSessionActivity(existingPlayerId);
          
          const player: Player = {
            id: existingPlayerId,
            name: session.playerName,
            role: 'human',
            joinedAt: new Date(session.joinedAt),
            isConnected: true,
            lastSeen: new Date(),
            isAdmin: session.isAdmin,
          };

          if (session.isAdmin) {
            this.gameState.adminPlayer = player;
            this.emitGameEvent('admin_joined', { player });
          } else {
            // Check if player is already in the list
            const existingIndex = this.gameState.players.findIndex(p => p.id === existingPlayerId);
            if (existingIndex === -1) {
              this.gameState.players.push(player);
              this.emitGameEvent('player_joined', { player });
            }
          }

          this.saveGameState();
          return player;
        }
      }
    }

    // Create new player session
    const playerId = existingPlayerId || this.sessionManager.generatePlayerId();
    
    // Handle admin separately
    if (isAdmin) {
      // Check if admin already exists
      if (this.gameState.adminPlayer) {
        return null; // Admin slot already taken
      }

      // Check if name is already taken by regular players, but exclude our own session  
      if (this.gameState.players.some(p => p.name.toLowerCase() === name.toLowerCase() && p.id !== playerId)) {
        return null; // Name already taken by someone else
      }

      const adminPlayer: Player = {
        id: playerId,
        name: name.trim(),
        role: 'human', // Will be reassigned when game starts
        joinedAt: new Date(),
        isConnected: true,
        lastSeen: new Date(),
        isAdmin: true,
      };

      // Create session
      this.sessionManager.createOrRestoreSession(playerId, name.trim(), true, this.roomId);
      
      this.gameState.adminPlayer = adminPlayer;
      this.emitGameEvent('admin_joined', { player: adminPlayer });
      this.saveGameState();
      return adminPlayer;
    }

    // Regular player logic
    if (this.gameState.players.length >= this.gameState.maxPlayers) {
      return null; // Game is full
    }

    // Check if name is already taken (including admin), but exclude our own session
    const isNameTakenByOthers = this.gameState.players.some(p => 
      p.name.toLowerCase() === name.toLowerCase() && p.id !== playerId
    );
    const isNameTakenByAdmin = this.gameState.adminPlayer && 
      this.gameState.adminPlayer.name.toLowerCase() === name.toLowerCase() && 
      this.gameState.adminPlayer.id !== playerId;
      
    if (isNameTakenByOthers || isNameTakenByAdmin) {
      return null; // Name already taken by someone else
    }

    const player: Player = {
      id: playerId,
      name: name.trim(),
      role: 'human', // Will be reassigned when game starts
      joinedAt: new Date(),
      isConnected: true,
      lastSeen: new Date(),
      isAdmin: false,
    };

    // Create session
    this.sessionManager.createOrRestoreSession(playerId, name.trim(), false, this.roomId);

    this.gameState.players.push(player);
    this.emitGameEvent('player_joined', { player });

    // Check if we can auto-start the game
    this.checkAutoStart();
    this.saveGameState();

    return player;
  }

  removePlayer(playerId: string): boolean {
    // Remove from session manager
    this.sessionManager.removeSession(playerId);
    
    // Check if it's the admin
    if (this.gameState.adminPlayer && this.gameState.adminPlayer.id === playerId) {
      const adminPlayer = this.gameState.adminPlayer;
      this.gameState.adminPlayer = null;

      // Clear disconnection timer if exists
      const timer = this.disconnectionTimers.get(playerId);
      if (timer) {
        clearTimeout(timer);
        this.disconnectionTimers.delete(playerId);
      }

      this.emitGameEvent('admin_left', { player: adminPlayer });
      this.saveGameState();
      return true;
    }

    // Regular player logic
    const playerIndex = this.gameState.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return false;

    const player = this.gameState.players[playerIndex];
    this.gameState.players.splice(playerIndex, 1);

    // Clear disconnection timer if exists
    const timer = this.disconnectionTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectionTimers.delete(playerId);
    }

    this.emitGameEvent('player_left', { player });
    this.saveGameState();

    // Check if game should end due to too few players
    this.checkGameContinuation();

    return true;
  }

  updatePlayerConnection(playerId: string, isConnected: boolean): boolean {
    // Update session activity
    if (isConnected) {
      this.sessionManager.updateSessionActivity(playerId);
    }
    
    // Check admin first
    if (this.gameState.adminPlayer && this.gameState.adminPlayer.id === playerId) {
      const adminPlayer = this.gameState.adminPlayer;
      adminPlayer.isConnected = isConnected;
      adminPlayer.lastSeen = new Date();

      if (!isConnected) {
        // TEMP: Disable auto-removal for debugging
        // const timer = setTimeout(() => {
        //   this.removePlayer(playerId);
        // }, 5 * 60 * 1000); // 5 minutes
        // this.disconnectionTimers.set(playerId, timer);
      } else {
        const timer = this.disconnectionTimers.get(playerId);
        if (timer) {
          clearTimeout(timer);
          this.disconnectionTimers.delete(playerId);
        }
      }
      this.saveGameState();
      return true;
    }

    // Regular player logic
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    player.isConnected = isConnected;
    player.lastSeen = new Date();

    if (!isConnected) {
      // TEMP: Disable auto-removal for debugging
      // const timer = setTimeout(() => {
      //   this.removePlayer(playerId);
      // }, 5 * 60 * 1000); // 5 minutes
      // this.disconnectionTimers.set(playerId, timer);
    } else {
      // Clear disconnection timer if player reconnected
      const timer = this.disconnectionTimers.get(playerId);
      if (timer) {
        clearTimeout(timer);
        this.disconnectionTimers.delete(playerId);
      }
    }

    this.saveGameState();

    return true;
  }

  // Game flow management
  startGame(): boolean {
    if (this.gameState.currentPhase !== 'lobby') return false;
    if (this.gameState.players.length < this.gameState.minPlayers) return false;

    // Assign roles randomly (test-aware)
    // Include admin in role assignment
    const allPlayers = [...this.gameState.players];
    if (this.gameState.adminPlayer) {
      allPlayers.push(this.gameState.adminPlayer);
    }

    const playerIds = allPlayers.map(p => p.id);
    console.log('DEBUG: All player IDs for role assignment:', playerIds);

    // Use test-aware role assignment
    const roleAssignments = TEST_CONFIG.ENABLED ? assignTestRoles(playerIds) : assignRoles(playerIds);
    console.log('DEBUG: Role assignments:', roleAssignments);

    // Assign roles to regular players
    this.gameState.players.forEach(player => {
      player.role = roleAssignments[player.id];
      console.log(`DEBUG: Assigned role ${player.role} to player ${player.name}`);
    });

    // Assign role to admin if exists
    if (this.gameState.adminPlayer) {
      this.gameState.adminPlayer.role = roleAssignments[this.gameState.adminPlayer.id];
      console.log(`DEBUG: Assigned role ${this.gameState.adminPlayer.role} to admin ${this.gameState.adminPlayer.name}`);
    }

    this.gameState.currentPhase = 'role_reveal';
    this.gameState.startedAt = new Date();
    const config = getGameConfig();
    this.setPhaseTimer(config.ROLE_REVEAL_DURATION * 60 * 1000); // Convert to milliseconds

    this.emitGameEvent('game_started', {
      gameState: this.getPublicGameState(),
      roleAssignments: this.getPlayerRoleAssignments()
    });

    return true;
  }

  advancePhase(): boolean {
    const phaseOrder: GameState['currentPhase'][] = [
      'lobby', 'role_reveal', 'round1', 'round2', 'round3', 'round4', 'round5', 'round6', 'round7', 'round8', 'voting', 'results', 'finished'
    ];

    const currentIndex = phaseOrder.indexOf(this.gameState.currentPhase);
    if (currentIndex === -1 || currentIndex === phaseOrder.length - 1) return false;

    const nextPhase = phaseOrder[currentIndex + 1];
    this.gameState.currentPhase = nextPhase;

    // Set appropriate timer for the new phase
    let duration = 0;
    if (nextPhase.startsWith('round')) {
      duration = this.gameState.roundDuration * 60 * 1000;
    } else if (nextPhase === 'voting') {
      duration = this.gameState.votingDuration * 60 * 1000;
    } else if (nextPhase === 'results') {
      duration = 10 * 1000; // 10 seconds to view results (was 30)
    }

    if (duration > 0) {
      this.setPhaseTimer(duration);
    }

    // Send additional data for voting phase
    const eventData: any = {
      phase: nextPhase,
      phaseEndTime: this.gameState.phaseEndTime
    };

    if (nextPhase === 'voting') {
      eventData.submissions = this.getAllSubmissions();
    } else if (nextPhase === 'results') {
      // Calculate and send results
      eventData.results = this.calculateResults();
      console.log('DEBUG: Calculated results:', eventData.results);
    }

    this.emitGameEvent('phase_changed', eventData);

    return true;
  }

  // Submission management
  addSubmission(playerId: string, roundNumber: number, content: string): boolean {
    if (!this.isValidSubmissionPhase(roundNumber)) return false;

    // Use getPlayer to check both regular players and admin
    const player = this.getPlayer(playerId);
    if (!player) return false;

    // Check if player already submitted for this round
    const roundSubmissions = this.submissions.get(roundNumber) || [];
    if (roundSubmissions.some(s => s.playerId === playerId)) return false;

    const submission: Submission = {
      id: this.generateSubmissionId(),
      playerId,
      playerName: player.name,
      roundNumber,
      content: content.trim(),
      submittedAt: new Date(),
    };

    if (!this.submissions.has(roundNumber)) {
      this.submissions.set(roundNumber, []);
    }
    this.submissions.get(roundNumber)!.push(submission);

    this.emitGameEvent('submission_received', { submission });

    return true;
  }

  // Voting management
  addVote(voterId: string, targetPlayerId: string, predictedRole: PlayerRole): boolean {
    if (this.gameState.currentPhase !== 'voting') return false;

    // Use getPlayer to check both regular players and admin
    const voter = this.getPlayer(voterId);
    const target = this.getPlayer(targetPlayerId);
    if (!voter || !target || voterId === targetPlayerId) return false;

    // Remove existing vote from this voter to this target
    this.votes = this.votes.filter(v => !(v.voterId === voterId && v.targetPlayerId === targetPlayerId));

    const vote: Vote = {
      id: this.generateVoteId(),
      voterId,
      voterName: voter.name,
      targetPlayerId,
      targetPlayerName: target.name,
      predictedRole,
      submittedAt: new Date(),
    };

    this.votes.push(vote);
    this.emitGameEvent('vote_received', { vote });

    return true;
  }

  // Results calculation
  calculateResults(): GameResults {
    const votingResults = this.calculateVotingResults();
    const finalScores = this.calculatePlayerScores(votingResults);
    const roundSubmissions = this.getAllSubmissions();
    const gameStats = this.calculateGameStats(finalScores);

    return {
      finalScores,
      votingResults,
      roundSubmissions,
      gameStats,
    };
  }

  private calculateVotingResults(): VotingResults[] {
    return this.gameState.players.map(player => {
      const votesForPlayer = this.votes.filter(v => v.targetPlayerId === player.id);

      // Count votes for each role
      const roleCounts: Record<PlayerRole, number> = {
        human: 0,
        ai_user: 0,
        troll: 0,
      };

      votesForPlayer.forEach(vote => {
        roleCounts[vote.predictedRole]++;
      });

      const totalVotes = votesForPlayer.length;
      const votes = Object.entries(roleCounts).map(([role, count]) => ({
        role: role as PlayerRole,
        count,
        percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
      }));

      // Find most voted role
      const mostVotedRole = Object.entries(roleCounts).reduce(
        (max, [role, count]) => count > max.count ? { role: role as PlayerRole, count } : max,
        { role: 'human' as PlayerRole, count: 0 }
      ).role;

      const correctGuesses = roleCounts[player.role];

      return {
        playerId: player.id,
        playerName: player.name,
        actualRole: player.role,
        votes,
        mostVotedRole,
        correctGuesses,
      };
    });
  }

  private calculatePlayerScores(votingResults: VotingResults[]): PlayerScore[] {
    return this.gameState.players.map(player => {
      const playerVotes = this.votes.filter(v => v.voterId === player.id);
      const correctGuesses = playerVotes.filter(vote => {
        const target = this.gameState.players.find(p => p.id === vote.targetPlayerId);
        return target && target.role === vote.predictedRole;
      }).length;

      const totalVotes = playerVotes.length;
      const accuracy = totalVotes > 0 ? correctGuesses / totalVotes : 0;

      const votingResult = votingResults.find(vr => vr.playerId === player.id)!;
      const wasGuessedCorrectly = votingResult.mostVotedRole === player.role;

      // Calculate points
      let points = 0;
      points += correctGuesses * POINTS_CONFIG.CORRECT_GUESS;
      if (!wasGuessedCorrectly) {
        points += POINTS_CONFIG.ROLE_HIDDEN_BONUS;
      }
      points += POINTS_CONFIG.PARTICIPATION_BONUS;
      points = Math.round(points * (1 + accuracy * POINTS_CONFIG.ACCURACY_MULTIPLIER));

      // Count how many times they were guessed as each role
      const timesGuessedAs: Record<PlayerRole, number> = {
        human: 0,
        ai_user: 0,
        troll: 0,
      };

      this.votes
        .filter(v => v.targetPlayerId === player.id)
        .forEach(vote => {
          timesGuessedAs[vote.predictedRole]++;
        });

      return {
        playerId: player.id,
        playerName: player.name,
        role: player.role,
        correctGuesses,
        totalVotes,
        accuracy,
        points,
        wasGuessedCorrectly,
        timesGuessedAs,
      };
    });
  }

  private calculateGameStats(finalScores: PlayerScore[]) {
    const totalPlayers = this.gameState.players.length;
    const gameDuration = this.gameState.startedAt
      ? Math.round((Date.now() - this.gameState.startedAt.getTime()) / (1000 * 60))
      : 0;

    const averageAccuracy = finalScores.reduce((sum, score) => sum + score.accuracy, 0) / totalPlayers;

    const mostAccuratePlayer = finalScores.reduce(
      (best, player) => player.accuracy > best.accuracy ? player : best,
      finalScores[0]
    );

    const bestHiddenRole = finalScores
      .filter(player => !player.wasGuessedCorrectly)
      .reduce(
        (best, player) => player.points > best.points ? player : best,
        finalScores.filter(p => !p.wasGuessedCorrectly)[0] || finalScores[0]
      );

    return {
      totalPlayers,
      gameDuration,
      averageAccuracy: Math.round(averageAccuracy * 100),
      mostAccuratePlayer: mostAccuratePlayer?.playerName || '',
      bestHiddenRole: bestHiddenRole?.playerName || '',
    };
  }

  // Helper methods
  private checkAutoStart(): void {
    const config = getGameConfig();
    if (this.gameState.players.length >= config.LOBBY_AUTO_START_THRESHOLD) {
      setTimeout(() => this.startGame(), 10000); // 10 second countdown
    }
  }

  private checkGameContinuation(): void {
    if (this.gameState.currentPhase !== 'lobby' &&
        this.gameState.players.filter(p => p.isConnected).length < this.gameState.minPlayers) {
      // Not enough connected players, end game
      this.gameState.currentPhase = 'finished';
      this.clearPhaseTimer();
      this.emitGameEvent('game_ended', { reason: 'insufficient_players' });
    }
  }

  private isValidSubmissionPhase(roundNumber: number): boolean {
    const expectedPhase = `round${roundNumber}` as const;
    return this.gameState.currentPhase === expectedPhase;
  }

  private setPhaseTimer(duration: number): void {
    this.clearPhaseTimer();
    this.gameState.phaseEndTime = new Date(Date.now() + duration);

    this.phaseTimer = setTimeout(() => {
      this.advancePhase();
    }, duration);
  }

  private clearPhaseTimer(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
      this.gameState.phaseEndTime = null;
    }
  }

  public emitGameEvent(type: GameEvent['type'], data: any): void {
    const event: GameEvent = {
      type,
      data,
      timestamp: new Date(),
    };
    this.emit('gameEvent', event);
  }

  private generatePlayerId(): string {
    return this.sessionManager.generatePlayerId();
  }

  private generateSubmissionId(): string {
    return `submission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVoteId(): string {
    return `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public getters
  getGameState(): GameState {
    return { ...this.gameState };
  }

  getPublicGameState(): Omit<GameState, 'players'> & { players: Omit<Player, 'role'>[] } {
    return {
      ...this.gameState,
      players: this.gameState.players.map(({ role, ...player }) => player),
    };
  }

  getPlayerRoleAssignments(): Record<string, PlayerRole> {
    const assignments: Record<string, PlayerRole> = {};
    this.gameState.players.forEach(player => {
      assignments[player.id] = player.role;
    });
    return assignments;
  }

  getSubmissions(roundNumber: number): Submission[] {
    return this.submissions.get(roundNumber) || [];
  }

  getAllSubmissions(): Record<number, Submission[]> {
    const allSubmissions: Record<number, Submission[]> = {};
    this.submissions.forEach((submissions, roundNumber) => {
      allSubmissions[roundNumber] = [...submissions];
    });
    return allSubmissions;
  }

  getVotes(): Vote[] {
    return [...this.votes];
  }

  getPlayer(playerId: string): Player | null {
    // Check admin first
    if (this.gameState.adminPlayer && this.gameState.adminPlayer.id === playerId) {
      return this.gameState.adminPlayer;
    }
    // Check regular players
    return this.gameState.players.find(p => p.id === playerId) || null;
  }

  reset(): void {
    this.clearPhaseTimer();
    this.disconnectionTimers.forEach(timer => clearTimeout(timer));
    this.disconnectionTimers.clear();
    this.gameState = this.initializeGameState();
    this.submissions.clear();
    this.votes = [];
    this.emitGameEvent('game_ended', { reason: 'reset' });
  }

  // Admin controls
  isAdmin(playerId: string): boolean {
    return this.gameState.adminPlayer?.id === playerId;
  }

  adminForceStart(adminId: string): boolean {
    if (!this.isAdmin(adminId)) return false;

    if (this.gameState.currentPhase !== 'lobby') return false;
    if (this.gameState.players.length === 0) return false;

    // Force assign roles even with insufficient players
    // Include admin in role assignment
    const allPlayers = [...this.gameState.players];
    if (this.gameState.adminPlayer) {
      allPlayers.push(this.gameState.adminPlayer);
    }

    const playerIds = allPlayers.map(p => p.id);
    console.log('DEBUG: All player IDs for role assignment:', playerIds);

    // Use test-aware role assignment
    const roleAssignments = TEST_CONFIG.ENABLED ? assignTestRoles(playerIds) : assignRoles(playerIds);
    console.log('DEBUG: Role assignments:', roleAssignments);

    // Assign roles to regular players
    this.gameState.players.forEach(player => {
      player.role = roleAssignments[player.id];
      console.log(`DEBUG: Assigned role ${player.role} to player ${player.name}`);
    });

    // Assign role to admin if exists
    if (this.gameState.adminPlayer) {
      this.gameState.adminPlayer.role = roleAssignments[this.gameState.adminPlayer.id];
      console.log(`DEBUG: Assigned role ${this.gameState.adminPlayer.role} to admin ${this.gameState.adminPlayer.name}`);
    }

    this.gameState.currentPhase = 'role_reveal';
    this.gameState.startedAt = new Date();
    const config = getGameConfig();
    this.setPhaseTimer(config.ROLE_REVEAL_DURATION * 60 * 1000);

    this.emitGameEvent('game_started', {
      gameState: this.getPublicGameState(),
      roleAssignments: this.getPlayerRoleAssignments()
    });

    return true;
  }

  adminAdvancePhase(adminId: string): boolean {
    if (!this.isAdmin(adminId)) return false;
    return this.advancePhase();
  }

  adminSkipPhase(adminId: string): boolean {
    if (!this.isAdmin(adminId)) return false;
    this.clearPhaseTimer();
    return this.advancePhase();
  }

  adminAssignRole(adminId: string, targetPlayerId: string, role: PlayerRole): boolean {
    if (!this.isAdmin(adminId)) return false;

    const player = this.gameState.players.find(p => p.id === targetPlayerId);
    if (!player) return false;

    player.role = role;
    this.emitGameEvent('role_assigned', { playerId: targetPlayerId, role });
    return true;
  }

  adminKickPlayer(adminId: string, targetPlayerId: string): boolean {
    if (!this.isAdmin(adminId)) return false;
    if (targetPlayerId === adminId) return false; // Can't kick yourself

    return this.removePlayer(targetPlayerId);
  }

  adminSetTimer(adminId: string, durationSeconds: number): boolean {
    if (!this.isAdmin(adminId)) return false;

    this.clearPhaseTimer();
    this.setPhaseTimer(durationSeconds * 1000);

    this.emitGameEvent('timer_set', { duration: durationSeconds });
    return true;
  }

  adminDestroyGame(adminId: string): boolean {
    if (!this.isAdmin(adminId)) return false;

    // Send game_destroyed event to all players to redirect them to homepage
    this.emitGameEvent('game_destroyed', { message: 'Game has been destroyed by admin' });

    // Reset the game state
    this.reset();
    return true;
  }

  adminResetGame(adminId: string): boolean {
    if (!this.isAdmin(adminId)) return false;
    this.reset();
    return true;
  }
}

// Singleton instance with global process-level storage to prevent multiple instances in production
declare global {
  var __gameManagerInstance__: GameManager | undefined;
}

export function getGameManager(): GameManager {
  // Use global process-level variable to ensure single instance across all requests
  if (!global.__gameManagerInstance__) {
    console.log('Creating new GameManager instance');
    global.__gameManagerInstance__ = new GameManager();
  }
  return global.__gameManagerInstance__;
}

export { GameManager };