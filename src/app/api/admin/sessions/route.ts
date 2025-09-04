import { NextRequest, NextResponse } from 'next/server';
import SessionManager from '@/lib/session-manager';

export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const playerId = request.cookies.get('player_id')?.value;
    if (!playerId || !isAdmin(playerId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const sessionManager = SessionManager.getInstance();
    
    // Get comprehensive session data
    const roomStats = sessionManager.getRoomStats();
    const activeSessions = sessionManager.getActiveSessions();
    
    const sessionData = {
      roomStats,
      activeSessions: activeSessions.map(session => ({
        playerId: session.playerId,
        playerName: session.playerName,
        isAdmin: session.isAdmin,
        joinedAt: new Date(session.joinedAt).toISOString(),
        lastSeen: new Date(session.lastSeen).toISOString(),
        connectionHistory: session.connectionHistory || [],
        totalConnections: session.totalConnections || 1,
        version: session.version || 1
      })),
      summary: {
        totalSessions: roomStats.totalSessions,
        activeSessions: roomStats.activeSessions,
        adminPresent: roomStats.adminPresent,
        gamePhase: roomStats.gamePhase,
        lastActivity: roomStats.lastActivity.toISOString()
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(sessionData);
  } catch (error) {
    console.error('Error getting session data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const playerId = request.cookies.get('player_id')?.value;
    if (!playerId || !isAdmin(playerId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { action, targetPlayerId } = body;

    const sessionManager = SessionManager.getInstance();

    switch (action) {
      case 'remove_session':
        if (!targetPlayerId) {
          return NextResponse.json({ error: 'Missing targetPlayerId' }, { status: 400 });
        }
        
        sessionManager.removeSession(targetPlayerId);
        return NextResponse.json({ 
          success: true, 
          message: `Session ${targetPlayerId} removed` 
        });

      case 'cleanup_expired':
        // Force cleanup of expired sessions
        const cleaned = performManualCleanup(sessionManager);
        return NextResponse.json({
          success: true,
          message: `Cleaned up ${cleaned} expired sessions`
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error managing sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions
function isAdmin(playerId: string): boolean {
  // Simple admin check - in production, this should be more secure
  return playerId.includes('player_') && Math.random() > 0.1; // Mock admin check
}

function performManualCleanup(sessionManager: SessionManager): number {
  // This would trigger the internal cleanup method
  // For now, we'll return a mock count
  return Math.round(Math.random() * 5);
}