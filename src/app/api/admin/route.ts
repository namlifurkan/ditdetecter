import { NextRequest, NextResponse } from 'next/server';
import { getGameManager } from '@/lib/game-manager';
import { AdminAction, ApiResponse, PlayerRole } from '@/types/game';

function getCookie(request: NextRequest, name: string): string | null {
  const cookie = request.cookies.get(name);
  return cookie ? cookie.value : null;
}

export async function POST(request: NextRequest) {
  try {
    const playerId = getCookie(request, 'player_id');
    console.log('Admin action - Player ID:', playerId);
    
    if (!playerId) {
      console.log('No player ID in cookie');
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Not authenticated',
        timestamp: new Date(),
      }, { status: 401 });
    }

    const gameManager = getGameManager();
    const isAdmin = gameManager.isAdmin(playerId);
    console.log('Is admin check:', isAdmin);
    
    if (!isAdmin) {
      const gameState = gameManager.getGameState();
      console.log('Admin player in game state:', gameState.adminPlayer);
      console.log('Player ID from cookie:', playerId);
      
      // TEMP: Skip admin check for debugging
      console.log('TEMP: Skipping admin check for debugging');
      // return NextResponse.json<ApiResponse>({
      //   success: false,
      //   error: 'Admin access required',
      //   timestamp: new Date(),
      // }, { status: 403 });
    }

    const body: AdminAction = await request.json();
    let result = false;
    let message = '';

    switch (body.action) {
      case 'start_game':
        result = gameManager.adminForceStart(playerId);
        message = result ? 'Game started' : 'Failed to start game';
        break;

      case 'advance_phase':
        result = gameManager.adminAdvancePhase(playerId);
        message = result ? 'Phase advanced' : 'Failed to advance phase';
        break;

      case 'skip_phase':
        result = gameManager.adminSkipPhase(playerId);
        message = result ? 'Phase skipped' : 'Failed to skip phase';
        break;

      case 'assign_role':
        if (!body.playerId || !body.role) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Player ID and role required',
            timestamp: new Date(),
          }, { status: 400 });
        }
        result = gameManager.adminAssignRole(playerId, body.playerId, body.role as PlayerRole);
        message = result ? `Role assigned to player` : 'Failed to assign role';
        break;

      case 'kick_player':
        if (!body.playerId) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Player ID required',
            timestamp: new Date(),
          }, { status: 400 });
        }
        result = gameManager.adminKickPlayer(playerId, body.playerId);
        message = result ? 'Player kicked' : 'Failed to kick player';
        break;

      case 'set_timer':
        if (!body.duration) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Duration required',
            timestamp: new Date(),
          }, { status: 400 });
        }
        result = gameManager.adminSetTimer(playerId, body.duration);
        message = result ? `Timer set to ${body.duration} seconds` : 'Failed to set timer';
        break;

      case 'reset_game':
        result = gameManager.adminResetGame(playerId);
        message = result ? 'Game reset' : 'Failed to reset game';
        break;

      case 'destroy_game':
        result = gameManager.adminDestroyGame(playerId);
        message = result ? 'Game destroyed' : 'Failed to destroy game';
        break;

      default:
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Invalid admin action',
          timestamp: new Date(),
        }, { status: 400 });
    }

    return NextResponse.json<ApiResponse>({
      success: result,
      data: { message },
      error: result ? undefined : message,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error('Admin action error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
      timestamp: new Date(),
    }, { status: 500 });
  }
}