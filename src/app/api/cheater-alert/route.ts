import { NextRequest, NextResponse } from 'next/server';
import { getGameManager } from '@/lib/game-manager';
import { ApiResponse } from '@/types/game';

function getCookie(request: NextRequest, name: string): string | null {
  const cookie = request.cookies.get(name);
  return cookie ? cookie.value : null;
}

export async function POST(request: NextRequest) {
  try {
    const playerId = getCookie(request, 'player_id');
    console.log('Cheater alert - Player ID from cookie:', playerId);
    
    if (!playerId) {
      console.log('No player ID in cookie');
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Not authenticated',
        timestamp: new Date(),
      }, { status: 401 });
    }

    const gameManager = getGameManager();
    const player = gameManager.getPlayer(playerId);
    console.log('Player found:', player ? player.name : 'None');
    
    if (!player) {
      const gameState = gameManager.getGameState();
      console.log('Available players:', gameState.players.map(p => p.id));
      console.log('Admin player:', gameState.adminPlayer?.id);
      
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Player not found',
        timestamp: new Date(),
      }, { status: 404 });
    }

    const body = await request.json();
    const { type } = body; // 'console' or 'devtools'

    // Emit cheater alert to all players
    gameManager.emitGameEvent('cheater_alert', {
      playerId: player.id,
      playerName: player.name,
      cheaterType: type,
      timestamp: new Date().toISOString(),
    });

    // Log the cheating attempt
    console.log(`🚨 CHEATER DETECTED: Player ${player.name} (${player.id}) opened ${type}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        message: 'Cheater alert sent',
        player: player.name,
        type
      },
      timestamp: new Date(),
    });

  } catch (error) {
    console.error('Error reporting cheater:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
      timestamp: new Date(),
    }, { status: 500 });
  }
}