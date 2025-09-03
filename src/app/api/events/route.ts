import { NextRequest } from 'next/server';
import { getGameManager } from '@/lib/game-manager';
import { GameEvent } from '@/types/game';

export async function GET(request: NextRequest) {
  try {
    const gameManager = getGameManager();
    
    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        const encoder = new TextEncoder();
        
        const sendEvent = (event: string, data: any) => {
          try {
            const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(eventData));
          } catch (error) {
            console.error('Error sending SSE event:', error);
          }
        };

        // Send initial game state
        try {
          sendEvent('game_state', {
            gameState: gameManager.getPublicGameState(),
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Error sending initial game state:', error);
        }

      // Listen for game events
      const eventListener = (gameEvent: GameEvent) => {
        sendEvent(gameEvent.type, {
          ...gameEvent.data,
          timestamp: gameEvent.timestamp.toISOString(),
        });
      };

      gameManager.on('gameEvent', eventListener);

      // Send periodic heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        sendEvent('heartbeat', { timestamp: new Date().toISOString() });
      }, 30000); // 30 seconds

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        gameManager.removeListener('gameEvent', eventListener);
        clearInterval(heartbeatInterval);
        controller.close();
      });

      // Keep connection alive with periodic timer updates
      const timerInterval = setInterval(() => {
        const gameState = gameManager.getGameState();
        if (gameState.phaseEndTime) {
          const timeLeft = Math.max(0, gameState.phaseEndTime.getTime() - Date.now());
          sendEvent('timer_update', {
            phase: gameState.currentPhase,
            timeLeft: Math.floor(timeLeft / 1000), // seconds
            phaseEndTime: gameState.phaseEndTime.toISOString(),
          });
        }
      }, 1000); // Update every second

      // Clean up on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(timerInterval);
      });
    },
  });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error in events API:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}