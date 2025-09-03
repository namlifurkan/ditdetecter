import { NextRequest, NextResponse } from 'next/server';
import { getGameManager } from '@/lib/game-manager';
import { VoteRequest, ApiResponse, PlayerRole } from '@/types/game';

export async function POST(request: NextRequest) {
  try {
    const playerId = request.cookies.get('player_id')?.value;
    if (!playerId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Player not found. Please rejoin the game.',
        timestamp: new Date(),
      }, { status: 401 });
    }

    const body: VoteRequest = await request.json();
    
    // Validate request body
    if (!body.targetPlayerId || !body.predictedRole) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: targetPlayerId and predictedRole',
        timestamp: new Date(),
      }, { status: 400 });
    }

    // Validate predicted role
    const validRoles: PlayerRole[] = ['human', 'ai_user', 'troll'];
    if (!validRoles.includes(body.predictedRole)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid predicted role. Must be human, ai_user, or troll.',
        timestamp: new Date(),
      }, { status: 400 });
    }

    const gameManager = getGameManager();
    
    // Check if voter exists
    const voter = gameManager.getPlayer(playerId);
    if (!voter) {
      const gameState = gameManager.getGameState();
      console.log('Vote - Voter not found:', playerId);
      console.log('Vote - Available players:', gameState.players.map(p => ({ id: p.id, name: p.name })));
      console.log('Vote - Admin player:', gameState.adminPlayer ? { id: gameState.adminPlayer.id, name: gameState.adminPlayer.name } : 'None');
      
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Player not found in game. Please rejoin.',
        timestamp: new Date(),
      }, { status: 404 });
    }

    // Check if target player exists
    const targetPlayer = gameManager.getPlayer(body.targetPlayerId);
    if (!targetPlayer) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Target player not found.',
        timestamp: new Date(),
      }, { status: 404 });
    }

    // Prevent self-voting
    if (playerId === body.targetPlayerId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'You cannot vote for yourself.',
        timestamp: new Date(),
      }, { status: 400 });
    }

    // Check if game is in voting phase
    const gameState = gameManager.getGameState();
    if (gameState.currentPhase !== 'voting') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Voting is not allowed during ${gameState.currentPhase} phase.`,
        timestamp: new Date(),
      }, { status: 409 });
    }

    const success = gameManager.addVote(playerId, body.targetPlayerId, body.predictedRole);
    
    if (!success) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to submit vote. Please try again.',
        timestamp: new Date(),
      }, { status: 409 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        message: 'Vote submitted successfully',
        targetPlayer: targetPlayer.name,
        predictedRole: body.predictedRole,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error submitting vote:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
      timestamp: new Date(),
    }, { status: 500 });
  }
}