import { NextRequest } from 'next/server';
import { getGameManager } from '@/lib/game-manager';
import { GameEvent } from '@/types/game';
import { CompressionUtils } from '@/lib/compression-utils';

export async function GET(request: NextRequest) {
  try {
    const gameManager = getGameManager();
    const startTime = Date.now();
    let connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`SSE connection established: ${connectionId}`);
    
    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        const encoder = new TextEncoder();
        let isConnectionAlive = true;
        let heartbeatFailures = 0;
        const maxHeartbeatFailures = 3;
        
        const sendEvent = (event: string, data: any) => {
          if (!isConnectionAlive) return false;
          
          try {
            // Add connection metadata
            const eventDataWithMeta = {
              ...data,
              connectionId,
              serverTime: Date.now()
            };

            // Optimize event data for bandwidth
            const optimized = CompressionUtils.optimizeSSEEvent(event, eventDataWithMeta);
            
            const eventData = `event: ${optimized.event}\ndata: ${optimized.data}\n\n`;
            controller.enqueue(encoder.encode(eventData));
            
            // Reset heartbeat failures on successful send
            if (event !== 'heartbeat') {
              heartbeatFailures = 0;
            }
            return true;
          } catch (error) {
            console.error(`Error sending SSE event ${event}:`, error);
            isConnectionAlive = false;
            return false;
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

      // Enhanced heartbeat mechanism
      const heartbeatInterval = setInterval(() => {
        try {
          const success = sendEvent('heartbeat', { 
            timestamp: new Date().toISOString(),
            uptime: Date.now() - startTime,
            connectionHealth: heartbeatFailures < maxHeartbeatFailures ? 'good' : 'degraded'
          });
          
          if (!success) {
            heartbeatFailures++;
            console.warn(`Heartbeat failed for ${connectionId}, failures: ${heartbeatFailures}`);
            
            if (heartbeatFailures >= maxHeartbeatFailures) {
              console.error(`Connection ${connectionId} marked as failed, closing...`);
              isConnectionAlive = false;
              clearInterval(heartbeatInterval);
              controller.close();
            }
          }
        } catch (error) {
          console.error(`Heartbeat error for ${connectionId}:`, error);
          heartbeatFailures++;
          if (heartbeatFailures >= maxHeartbeatFailures) {
            clearInterval(heartbeatInterval);
            controller.close();
          }
        }
      }, 10000); // Reduced to 10 seconds for better responsiveness

      // Enhanced cleanup on disconnect
      const cleanup = () => {
        console.log(`Cleaning up SSE connection: ${connectionId}`);
        isConnectionAlive = false;
        gameManager.removeListener('gameEvent', eventListener);
        clearInterval(heartbeatInterval);
        clearInterval(timerInterval);
        try {
          controller.close();
        } catch (error) {
          console.error('Error closing controller:', error);
        }
      };

      // Handle client disconnect
      request.signal.addEventListener('abort', cleanup);

      // Keep connection alive with periodic timer updates
      const timerInterval = setInterval(() => {
        if (!isConnectionAlive) {
          clearInterval(timerInterval);
          return;
        }
        
        try {
          const gameState = gameManager.getGameState();
          if (gameState.phaseEndTime) {
            const timeLeft = Math.max(0, gameState.phaseEndTime.getTime() - Date.now());
            const success = sendEvent('timer_update', {
              phase: gameState.currentPhase,
              timeLeft: Math.floor(timeLeft / 1000), // seconds
              phaseEndTime: gameState.phaseEndTime.toISOString(),
            });
            
            if (!success) {
              console.warn(`Timer update failed for ${connectionId}`);
              cleanup();
            }
          }
        } catch (error) {
          console.error(`Timer update error for ${connectionId}:`, error);
          cleanup();
        }
      }, 1000); // Update every second

      // Auto cleanup on connection timeout
      setTimeout(() => {
        if (isConnectionAlive) {
          console.log(`Auto-cleanup for long-running connection: ${connectionId}`);
          cleanup();
        }
      }, 295000); // 295 seconds (5 seconds before Vercel timeout)
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