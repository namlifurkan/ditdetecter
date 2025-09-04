import { NextRequest, NextResponse } from 'next/server';
import { getGameManager } from '@/lib/game-manager';
import SessionManager from '@/lib/session-manager';
import { networkRecovery } from '@/lib/network-recovery';
import { CompressionUtils } from '@/lib/compression-utils';

export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const playerId = request.cookies.get('player_id')?.value;
    if (!playerId || !isAdmin(playerId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    // Execute the custom query
    const result = await executeQuery(query.toLowerCase().trim());

    return NextResponse.json({
      success: true,
      query,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Query execution error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

async function executeQuery(query: string): Promise<any> {
  const gameManager = getGameManager();
  const sessionManager = SessionManager.getInstance();

  // Parse and execute different types of queries
  if (query.startsWith('game.')) {
    return executeGameQuery(query, gameManager);
  } else if (query.startsWith('session.')) {
    return executeSessionQuery(query, sessionManager);
  } else if (query.startsWith('network.')) {
    return executeNetworkQuery(query);
  } else if (query.startsWith('system.')) {
    return executeSystemQuery(query);
  } else {
    return executeGeneralQuery(query, gameManager, sessionManager);
  }
}

function executeGameQuery(query: string, gameManager: any): any {
  const command = query.replace('game.', '');

  switch (command) {
    case 'state':
      return gameManager.getGameState();
    
    case 'players':
      return gameManager.getGameState().players;
    
    case 'submissions':
      return gameManager.getAllSubmissions();
    
    case 'votes':
      return gameManager.getVotes();
    
    case 'phase':
      return {
        currentPhase: gameManager.getGameState().currentPhase,
        phaseEndTime: gameManager.getGameState().phaseEndTime
      };
    
    case 'admin':
      return gameManager.getGameState().adminPlayer;
    
    case 'stats':
      const state = gameManager.getGameState();
      return {
        playerCount: state.players.length,
        phase: state.currentPhase,
        startedAt: state.startedAt,
        adminPresent: !!state.adminPlayer
      };
    
    default:
      throw new Error(`Unknown game query: ${command}`);
  }
}

function executeSessionQuery(query: string, sessionManager: SessionManager): any {
  const command = query.replace('session.', '');

  switch (command) {
    case 'stats':
      return sessionManager.getRoomStats();
    
    case 'active':
      return sessionManager.getActiveSessions();
    
    case 'admin':
      return sessionManager.getAdminPlayer();
    
    case 'count':
      const stats = sessionManager.getRoomStats();
      return {
        total: stats.totalSessions,
        active: stats.activeSessions
      };
    
    default:
      throw new Error(`Unknown session query: ${command}`);
  }
}

function executeNetworkQuery(query: string): any {
  const command = query.replace('network.', '');

  switch (command) {
    case 'errors':
      return networkRecovery.getErrorAnalysis();
    
    case 'circuits':
      return {
        polling: networkRecovery.getCircuitStatus('polling'),
        sse: networkRecovery.getCircuitStatus('sse')
      };
    
    case 'compression':
      return CompressionUtils.getCacheStats();
    
    default:
      throw new Error(`Unknown network query: ${command}`);
  }
}

function executeSystemQuery(query: string): any {
  const command = query.replace('system.', '');

  switch (command) {
    case 'memory':
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const usage = process.memoryUsage();
        return {
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
          external: Math.round(usage.external / 1024 / 1024) + ' MB',
          rss: Math.round(usage.rss / 1024 / 1024) + ' MB'
        };
      }
      return { error: 'Memory usage not available' };
    
    case 'uptime':
      return {
        uptime: process.uptime ? `${Math.round(process.uptime())} seconds` : 'Unknown',
        nodeVersion: process.version || 'Unknown'
      };
    
    case 'env':
      return {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        platform: process.platform || 'unknown'
      };
    
    default:
      throw new Error(`Unknown system query: ${command}`);
  }
}

function executeGeneralQuery(query: string, gameManager: any, sessionManager: SessionManager): any {
  switch (query) {
    case 'help':
      return {
        availableQueries: [
          'game.state - Get current game state',
          'game.players - Get all players',
          'game.phase - Get current phase info',
          'session.stats - Get session statistics',
          'session.active - Get active sessions',
          'network.errors - Get network error analysis',
          'network.circuits - Get circuit breaker status',
          'system.memory - Get memory usage',
          'system.uptime - Get system uptime',
          'status - Get overall system status'
        ]
      };
    
    case 'status':
      const gameState = gameManager.getGameState();
      const sessionStats = sessionManager.getRoomStats();
      const networkErrors = networkRecovery.getErrorAnalysis();
      
      return {
        game: {
          phase: gameState.currentPhase,
          players: gameState.players.length,
          admin: !!gameState.adminPlayer
        },
        sessions: {
          active: sessionStats.activeSessions,
          total: sessionStats.totalSessions
        },
        network: {
          errorRate: networkErrors.errorRate,
          quality: networkErrors.errorRate < 0.1 ? 'good' : networkErrors.errorRate < 0.5 ? 'degraded' : 'poor'
        },
        timestamp: new Date().toISOString()
      };
    
    default:
      throw new Error(`Unknown query: ${query}. Use 'help' to see available queries.`);
  }
}

function isAdmin(playerId: string): boolean {
  // Simple admin check - in production, this should be more secure
  return playerId.includes('player_') && Math.random() > 0.1; // Mock admin check
}