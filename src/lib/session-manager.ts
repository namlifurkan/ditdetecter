// Session Manager - Handles persistent sessions and room state
import { GameState, Player } from '@/types/game';

interface SessionData {
  playerId: string;
  playerName: string;
  isAdmin: boolean;
  joinedAt: number;
  lastSeen: number;
  gameState?: GameState;
  // Enhanced persistence data
  connectionHistory: Array<{
    connected: number;
    disconnected?: number;
    reason?: string;
  }>;
  totalConnections: number;
  version: number; // For data migration
  checksum: string; // Data integrity verification
}

interface RoomData {
  id: string;
  createdAt: number;
  lastActivity: number;
  sessions: Map<string, SessionData>;
  gameState: GameState | null;
  adminSession?: string;
  // Enhanced persistence data
  backup: {
    gameState: GameState | null;
    sessionBackup: Map<string, SessionData>;
    lastBackup: number;
  } | null;
  version: number;
  integrity: {
    checksum: string;
    lastVerified: number;
  };
}

class SessionManager {
  private static instance: SessionManager;
  private rooms: Map<string, RoomData> = new Map();
  private playerSessions: Map<string, string> = new Map(); // playerId -> roomId
  private sessionCleanupInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly ROOM_TIMEOUT = 60 * 60 * 1000; // 1 hour
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly BACKUP_INTERVAL = 2 * 60 * 1000; // 2 minutes
  private readonly INTEGRITY_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private readonly SESSION_VERSION = 1;
  
  // Enhanced persistence
  private backupTimer: NodeJS.Timeout | null = null;
  private integrityTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
    this.startBackupTimer();
    this.startIntegrityTimer();
  }

  // Generate checksum for data integrity
  private generateChecksum(data: any): string {
    const str = JSON.stringify(data, (key, value) => {
      if (value instanceof Map) {
        return Array.from(value.entries());
      }
      return value;
    });
    
    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Verify data integrity
  private verifyIntegrity(room: RoomData): boolean {
    const currentChecksum = this.generateChecksum({
      sessions: room.sessions,
      gameState: room.gameState
    });
    return currentChecksum === room.integrity.checksum;
  }

  // Create backup of room data
  private createBackup(room: RoomData): void {
    room.backup = {
      gameState: room.gameState ? { ...room.gameState } : null,
      sessionBackup: new Map(room.sessions),
      lastBackup: Date.now()
    };
    console.log(`Created backup for room ${room.id}`);
  }

  // Restore from backup if integrity check fails
  private restoreFromBackup(room: RoomData): boolean {
    if (!room.backup) return false;
    
    try {
      room.sessions = new Map(room.backup.sessionBackup);
      room.gameState = room.backup.gameState ? { ...room.backup.gameState } : null;
      this.updateRoomIntegrity(room);
      console.log(`Restored room ${room.id} from backup`);
      return true;
    } catch (error) {
      console.error(`Failed to restore room ${room.id} from backup:`, error);
      return false;
    }
  }

  // Update room integrity data
  private updateRoomIntegrity(room: RoomData): void {
    room.integrity = {
      checksum: this.generateChecksum({
        sessions: room.sessions,
        gameState: room.gameState
      }),
      lastVerified: Date.now()
    };
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Create or get existing room
  getOrCreateRoom(roomId: string = 'main'): RoomData {
    if (!this.rooms.has(roomId)) {
      const room: RoomData = {
        id: roomId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        sessions: new Map(),
        gameState: null,
        backup: null,
        version: this.SESSION_VERSION,
        integrity: {
          checksum: '',
          lastVerified: Date.now()
        }
      };
      this.updateRoomIntegrity(room);
      this.rooms.set(roomId, room);
      console.log(`Created new room: ${roomId}`);
    }

    const room = this.rooms.get(roomId)!;
    room.lastActivity = Date.now();
    
    // Verify integrity
    if (!this.verifyIntegrity(room)) {
      console.warn(`Integrity check failed for room ${roomId}, attempting restore...`);
      if (!this.restoreFromBackup(room)) {
        console.error(`Failed to restore room ${roomId}, recreating...`);
        // If backup restore fails, recreate the room
        room.sessions.clear();
        room.gameState = null;
        this.updateRoomIntegrity(room);
      }
    }
    
    return room;
  }

  // Create or restore player session
  createOrRestoreSession(
    playerId: string, 
    playerName: string, 
    isAdmin: boolean = false,
    roomId: string = 'main'
  ): SessionData {
    const room = this.getOrCreateRoom(roomId);
    
    // Check if session already exists
    let session = room.sessions.get(playerId);
    
    if (session) {
      // Restore existing session
      session.lastSeen = Date.now();
      session.playerName = playerName; // Update name in case it changed
      session.isAdmin = isAdmin;
      session.totalConnections++;
      
      // Add to connection history
      const lastConnection = session.connectionHistory[session.connectionHistory.length - 1];
      if (!lastConnection || lastConnection.disconnected) {
        session.connectionHistory.push({
          connected: Date.now()
        });
      }
      
      // Update session checksum
      session.checksum = this.generateChecksum(session);
      
      console.log(`Restored session for player: ${playerName} (${playerId}), connections: ${session.totalConnections}`);
    } else {
      // Create new session
      session = {
        playerId,
        playerName,
        isAdmin,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        connectionHistory: [{
          connected: Date.now()
        }],
        totalConnections: 1,
        version: this.SESSION_VERSION,
        checksum: ''
      };
      
      // Generate initial checksum
      session.checksum = this.generateChecksum(session);
      
      room.sessions.set(playerId, session);
      this.playerSessions.set(playerId, roomId);
      
      if (isAdmin) {
        room.adminSession = playerId;
      }
      
      console.log(`Created new session for player: ${playerName} (${playerId})`);
    }

    room.lastActivity = Date.now();
    this.updateRoomIntegrity(room);
    
    return session;
  }

  // Get session for player
  getSession(playerId: string): SessionData | null {
    const roomId = this.playerSessions.get(playerId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    return room.sessions.get(playerId) || null;
  }

  // Update session last seen
  updateSessionActivity(playerId: string): void {
    const roomId = this.playerSessions.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const session = room.sessions.get(playerId);
    if (session) {
      session.lastSeen = Date.now();
      room.lastActivity = Date.now();
    }
  }

  // Save game state to room
  saveGameState(gameState: GameState, roomId: string = 'main'): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.gameState = { ...gameState };
      room.lastActivity = Date.now();
      console.log(`Saved game state for room: ${roomId}, phase: ${gameState.currentPhase}`);
    }
  }

  // Get saved game state
  getGameState(roomId: string = 'main'): GameState | null {
    const room = this.rooms.get(roomId);
    return room?.gameState || null;
  }

  // Get all active sessions in room
  getActiveSessions(roomId: string = 'main'): SessionData[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const now = Date.now();
    const activeSessions: SessionData[] = [];

    for (const session of room.sessions.values()) {
      if (now - session.lastSeen < this.SESSION_TIMEOUT) {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  // Get active players for game
  getActivePlayers(roomId: string = 'main'): Player[] {
    const sessions = this.getActiveSessions(roomId);
    return sessions
      .filter(s => !s.isAdmin)
      .map(session => ({
        id: session.playerId,
        name: session.playerName,
        role: 'human' as const, // Default role, will be reassigned when game starts
        isConnected: true,
        joinedAt: new Date(session.joinedAt),
        lastSeen: new Date(session.lastSeen),
        isAdmin: false
      }));
  }

  // Get admin player
  getAdminPlayer(roomId: string = 'main'): Player | null {
    const room = this.rooms.get(roomId);
    if (!room || !room.adminSession) return null;

    const adminSession = room.sessions.get(room.adminSession);
    if (!adminSession || Date.now() - adminSession.lastSeen > this.SESSION_TIMEOUT) {
      return null;
    }

    return {
      id: adminSession.playerId,
      name: adminSession.playerName,
      role: 'human' as const, // Default role, will be reassigned when game starts
      isConnected: true,
      joinedAt: new Date(adminSession.joinedAt),
      lastSeen: new Date(adminSession.lastSeen),
      isAdmin: true
    };
  }

  // Remove session
  removeSession(playerId: string): void {
    const roomId = this.playerSessions.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.sessions.delete(playerId);
    this.playerSessions.delete(playerId);

    if (room.adminSession === playerId) {
      room.adminSession = undefined;
    }

    room.lastActivity = Date.now();
    console.log(`Removed session for player: ${playerId}`);
  }

  // Check if player can rejoin game
  canRejoinGame(playerId: string): boolean {
    const session = this.getSession(playerId);
    if (!session) return false;

    const roomId = this.playerSessions.get(playerId);
    if (!roomId) return false;

    const gameState = this.getGameState(roomId);
    if (!gameState) return false;

    // Can rejoin if game is still active and session is recent
    const isSessionActive = Date.now() - session.lastSeen < this.SESSION_TIMEOUT;
    const isGameActive = gameState.currentPhase !== 'finished';

    return isSessionActive && isGameActive;
  }

  // Generate unique player ID
  generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup expired sessions and rooms
  private cleanup(): void {
    const now = Date.now();
    let cleanedSessions = 0;
    let cleanedRooms = 0;

    // Clean up expired sessions
    for (const [roomId, room] of this.rooms.entries()) {
      const expiredSessions: string[] = [];
      
      for (const [playerId, session] of room.sessions.entries()) {
        if (now - session.lastSeen > this.SESSION_TIMEOUT) {
          expiredSessions.push(playerId);
        }
      }

      // Remove expired sessions
      for (const playerId of expiredSessions) {
        room.sessions.delete(playerId);
        this.playerSessions.delete(playerId);
        cleanedSessions++;

        if (room.adminSession === playerId) {
          room.adminSession = undefined;
        }
      }

      // Clean up empty rooms
      if (room.sessions.size === 0 && now - room.lastActivity > this.ROOM_TIMEOUT) {
        this.rooms.delete(roomId);
        cleanedRooms++;
      }
    }

    if (cleanedSessions > 0 || cleanedRooms > 0) {
      console.log(`Cleaned up ${cleanedSessions} sessions and ${cleanedRooms} rooms`);
    }
  }

  private startCleanupTimer(): void {
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  private startBackupTimer(): void {
    this.backupTimer = setInterval(() => {
      this.performBackup();
    }, this.BACKUP_INTERVAL);
  }

  private startIntegrityTimer(): void {
    this.integrityTimer = setInterval(() => {
      this.performIntegrityCheck();
    }, this.INTEGRITY_CHECK_INTERVAL);
  }

  private performBackup(): void {
    for (const room of this.rooms.values()) {
      if (room.sessions.size > 0 || room.gameState) {
        this.createBackup(room);
      }
    }
  }

  private performIntegrityCheck(): void {
    let corruptedRooms = 0;
    let restoredRooms = 0;

    for (const [roomId, room] of this.rooms.entries()) {
      if (!this.verifyIntegrity(room)) {
        corruptedRooms++;
        console.warn(`Integrity check failed for room ${roomId}`);
        
        if (this.restoreFromBackup(room)) {
          restoredRooms++;
        }
      } else {
        room.integrity.lastVerified = Date.now();
      }
    }

    if (corruptedRooms > 0) {
      console.log(`Integrity check complete: ${corruptedRooms} corrupted rooms, ${restoredRooms} restored`);
    }
  }

  // Get room stats
  getRoomStats(roomId: string = 'main'): {
    totalSessions: number;
    activeSessions: number;
    adminPresent: boolean;
    lastActivity: Date;
    gamePhase: string | null;
  } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return {
        totalSessions: 0,
        activeSessions: 0,
        adminPresent: false,
        lastActivity: new Date(),
        gamePhase: null
      };
    }

    const activeSessions = this.getActiveSessions(roomId);
    const adminSession = room.adminSession ? room.sessions.get(room.adminSession) : null;
    const adminPresent = adminSession ? Date.now() - adminSession.lastSeen < this.SESSION_TIMEOUT : false;

    return {
      totalSessions: room.sessions.size,
      activeSessions: activeSessions.length,
      adminPresent,
      lastActivity: new Date(room.lastActivity),
      gamePhase: room.gameState?.currentPhase || null
    };
  }

  destroy(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
    }
    
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
    
    if (this.integrityTimer) {
      clearInterval(this.integrityTimer);
      this.integrityTimer = null;
    }
    
    this.rooms.clear();
    this.playerSessions.clear();
    console.log('SessionManager destroyed');
  }
}

export default SessionManager;