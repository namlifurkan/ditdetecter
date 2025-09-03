import { NextRequest, NextResponse } from 'next/server';
import { getGameManager } from '@/lib/game-manager';
import { JoinGameRequest, ApiResponse } from '@/types/game';

export async function POST(request: NextRequest) {
  try {
    const body: JoinGameRequest = await request.json();
    
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Name is required',
        timestamp: new Date(),
      }, { status: 400 });
    }

    if (body.name.trim().length > 20) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Name must be 20 characters or less',
        timestamp: new Date(),
      }, { status: 400 });
    }

    // Check if this is admin join (specific name)
    const isAdmin = body.name.toLowerCase() === 'furk12';
    
    // Check for existing player ID in cookies
    const existingPlayerId = request.cookies.get('player_id')?.value;

    const gameManager = getGameManager();
    const player = gameManager.addPlayer(body.name.trim(), isAdmin, existingPlayerId);

    if (!player) {
      const gameState = gameManager.getGameState();
      let errorMessage = 'Failed to join game';
      
      if (gameState.currentPhase !== 'lobby') {
        errorMessage = 'Game has already started';
      } else if (gameState.players.length >= gameState.maxPlayers) {
        errorMessage = 'Game is full';
      } else if (gameState.players.some(p => p.name.toLowerCase() === body.name.toLowerCase())) {
        errorMessage = 'Name is already taken';
      }

      return NextResponse.json<ApiResponse>({
        success: false,
        error: errorMessage,
        timestamp: new Date(),
      }, { status: 409 });
    }

    // Store player ID in a cookie for session management
    const response = NextResponse.json<ApiResponse>({
      success: true,
      data: {
        player: {
          id: player.id,
          name: player.name,
          joinedAt: player.joinedAt,
          isAdmin: player.isAdmin,
        },
        gameState: gameManager.getPublicGameState(),
        playerRole: player.role,
      },
      timestamp: new Date(),
    });

    response.cookies.set('player_id', player.id, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from strict to lax for better compatibility
      maxAge: 30 * 24 * 60 * 60, // 30 days for persistent sessions
      path: '/', // Explicitly set path
      domain: process.env.NODE_ENV === 'production' ? undefined : 'localhost', // Let browser handle domain in production
    });

    return response;
  } catch (error) {
    console.error('Error joining game:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
      timestamp: new Date(),
    }, { status: 500 });
  }
}