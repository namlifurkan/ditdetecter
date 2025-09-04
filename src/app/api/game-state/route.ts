import { NextRequest, NextResponse } from 'next/server';
import { getGameManager } from '@/lib/game-manager';
import { ApiResponse } from '@/types/game';
import { CompressionUtils } from '@/lib/compression-utils';

export async function GET(request: NextRequest) {
  try {
    const gameManager = getGameManager();
    const playerId = request.cookies.get('player_id')?.value;
    
    // Get public game state
    const publicGameState = gameManager.getPublicGameState();
    
    let playerRole = null;
    if (playerId) {
      // Attempt to get or restore player from session
      const player = gameManager.attemptPlayerRestore(playerId);
      
      if (player) {
        // Use actual role from player object for presentation
        playerRole = player.role;
        console.log('GAME STATE API: Found/restored player with role:', playerRole, 'for player', player.name);
      } else {
        console.log('GAME STATE API: Player not found and could not be restored, using random role');
        const roles = ['human', 'ai_user', 'troll'];
        playerRole = roles[Math.floor(Math.random() * roles.length)];
        console.log('RANDOM ROLE NO PLAYER:', playerRole);
      }
    } else {
      console.log('GAME STATE API: No player ID in cookie');
      const roles = ['human', 'ai_user', 'troll'];
      playerRole = roles[Math.floor(Math.random() * roles.length)];
      console.log('RANDOM ROLE NO COOKIE:', playerRole);
    }

    // Get additional data based on current phase
    let additionalData = {};
    const gameState = gameManager.getGameState();
    
    if (gameState.currentPhase === 'voting' || gameState.currentPhase === 'results') {
      // Show submissions from all rounds
      additionalData = {
        submissions: gameManager.getAllSubmissions(),
      };
    }
    
    if (gameState.currentPhase === 'results') {
      // Show voting results
      additionalData = {
        ...additionalData,
        results: gameManager.calculateResults(),
      };
    }

    const responseData = {
      gameState: publicGameState,
      playerRole: playerRole,
      ...additionalData,
    };

    // Get connection quality from headers for adaptive compression
    const userAgent = request.headers.get('user-agent') || '';
    const acceptEncoding = request.headers.get('accept-encoding') || '';
    
    // Determine connection quality (simplified heuristic)
    let connectionQuality: 'excellent' | 'good' | 'poor' | 'critical' = 'good';
    if (userAgent.toLowerCase().includes('mobile') && !acceptEncoding.includes('br')) {
      connectionQuality = 'poor';
    } else if (acceptEncoding.includes('br') && acceptEncoding.includes('gzip')) {
      connectionQuality = 'excellent';
    }

    // Apply adaptive compression based on connection quality
    const compressedData = CompressionUtils.filterByConnectionQuality(responseData, connectionQuality);
    
    // Calculate and log compression ratio
    const originalSize = JSON.stringify(responseData).length;
    const compressedSize = JSON.stringify(compressedData).length;
    const compressionRatio = CompressionUtils.getCompressionRatio(responseData, compressedData);
    
    console.log(`Game state compression: ${originalSize} → ${compressedSize} bytes (${compressionRatio.toFixed(1)}% reduction)`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: compressedData,
      timestamp: new Date(),
    }, {
      headers: {
        'Content-Encoding': acceptEncoding.includes('gzip') ? 'gzip' : 'identity',
        'Vary': 'Accept-Encoding'
      }
    });
  } catch (error) {
    console.error('Error getting game state:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
      timestamp: new Date(),
    }, { status: 500 });
  }
}

// POST endpoint for admin actions (start game manually, reset, etc.)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    const gameManager = getGameManager();
    
    switch (action) {
      case 'start':
        const started = gameManager.startGame();
        if (!started) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Cannot start game. Check player count and game state.',
            timestamp: new Date(),
          }, { status: 400 });
        }
        break;
        
      case 'advance':
        const advanced = gameManager.advancePhase();
        if (!advanced) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Cannot advance phase',
            timestamp: new Date(),
          }, { status: 400 });
        }
        break;
        
      case 'reset':
        gameManager.reset();
        break;
        
      default:
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Invalid action',
          timestamp: new Date(),
        }, { status: 400 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        gameState: gameManager.getPublicGameState(),
        message: `Action ${action} completed successfully`,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error performing game action:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
      timestamp: new Date(),
    }, { status: 500 });
  }
}