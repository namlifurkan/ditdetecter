import { NextRequest, NextResponse } from 'next/server';
import { getGameManager } from '@/lib/game-manager';
import { SubmissionRequest, ApiResponse } from '@/types/game';
import { ROUND_CONFIGS } from '@/lib/game-config';

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

    const body: SubmissionRequest = await request.json();
    
    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Submission cannot be empty',
        timestamp: new Date(),
      }, { status: 400 });
    }

    // Validate round number
    if (body.roundNumber < 1 || body.roundNumber > 8) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid round number',
        timestamp: new Date(),
      }, { status: 400 });
    }

    // Check content length
    const roundConfig = ROUND_CONFIGS.find(r => r.roundNumber === body.roundNumber);
    if (roundConfig && body.content.trim().length > roundConfig.maxLength) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Submission too long. Maximum ${roundConfig.maxLength} characters allowed.`,
        timestamp: new Date(),
      }, { status: 400 });
    }

    const gameManager = getGameManager();
    
    // Check if player exists
    const player = gameManager.getPlayer(playerId);
    console.log('Submit - Player ID:', playerId);
    console.log('Submit - Player found:', player ? player.name : 'None');
    
    if (!player) {
      const gameState = gameManager.getGameState();
      console.log('Submit - Available players:', gameState.players.map(p => ({ id: p.id, name: p.name })));
      console.log('Submit - Admin player:', gameState.adminPlayer ? { id: gameState.adminPlayer.id, name: gameState.adminPlayer.name } : 'None');
      console.log('Submit - Current phase:', gameState.currentPhase);
      console.log('Submit - Player ID from cookie:', playerId);
      
      // If game is in lobby, redirect to join
      if (gameState.currentPhase === 'lobby') {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Game not started. Please wait for the game to begin.',
          timestamp: new Date(),
        }, { status: 400 });
      }
      
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Player not found in game. Please rejoin.',
        timestamp: new Date(),
      }, { status: 404 });
    }

    const success = gameManager.addSubmission(playerId, body.roundNumber, body.content.trim());
    
    if (!success) {
      const gameState = gameManager.getGameState();
      let errorMessage = 'Failed to submit';
      
      console.log('Submission failed - Current phase:', gameState.currentPhase);
      console.log('Submission failed - Expected phase:', `round${body.roundNumber}`);
      console.log('Submission failed - Round number:', body.roundNumber);
      
      const expectedPhase = `round${body.roundNumber}` as const;
      if (gameState.currentPhase !== expectedPhase) {
        errorMessage = `Not currently in round ${body.roundNumber}`;
      } else {
        // Check if already submitted
        const submissions = gameManager.getSubmissions(body.roundNumber);
        console.log('Existing submissions:', submissions.length);
        console.log('Player already submitted:', submissions.some(s => s.playerId === playerId));
        
        if (submissions.some(s => s.playerId === playerId)) {
          errorMessage = 'You have already submitted for this round';
        }
      }

      console.log('Final error message:', errorMessage);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: errorMessage,
        timestamp: new Date(),
      }, { status: 409 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        message: 'Submission received successfully',
        roundNumber: body.roundNumber,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error submitting:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
      timestamp: new Date(),
    }, { status: 500 });
  }
}