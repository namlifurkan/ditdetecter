import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEvent, GameState, Player, PlayerRole } from '@/types/game';

interface GameEventData {
  gameState: Omit<GameState, 'players'> & { players: Omit<Player, 'role'>[] };
  playerRole: PlayerRole | null;
  submissions?: Record<number, any[]>;
  results?: any;
  timeLeft?: number;
}

export function useGameEvents() {
  const [gameData, setGameData] = useState<GameEventData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return; // Already connected
    }

    // Clean up any existing connection first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const eventSource = new EventSource('/api/events');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        console.log('Connected to game events');
      };

      eventSource.onerror = (event) => {
        console.error('EventSource error:', event);
        setIsConnected(false);
        
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
          reconnectAttempts.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`);
            connect();
          }, delay);
        } else {
          setError('Connection lost. Please refresh the page.');
          // After 3 seconds, redirect to home page
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }, 3000);
        }
      };

      // Handle different event types
      eventSource.addEventListener('game_state', (event) => {
        try {
          const data = JSON.parse(event.data);
          setGameData(prevData => ({
            ...prevData,
            ...data,
          }));
        } catch (error) {
          console.error('Error parsing game_state event:', error);
        }
      });

      eventSource.addEventListener('admin_joined', (event) => {
        try {
          const data = JSON.parse(event.data);
          setGameData(prevData => {
            if (!prevData) return null;
            return {
              ...prevData,
              gameState: {
                ...prevData.gameState,
                adminPlayer: data.player,
              },
            };
          });
        } catch (error) {
          console.error('Error parsing admin_joined event:', error);
        }
      });

      eventSource.addEventListener('admin_left', (event) => {
        try {
          setGameData(prevData => {
            if (!prevData) return null;
            return {
              ...prevData,
              gameState: {
                ...prevData.gameState,
                adminPlayer: null,
              },
            };
          });
        } catch (error) {
          console.error('Error parsing admin_left event:', error);
        }
      });

      eventSource.addEventListener('player_joined', (event) => {
        try {
          const data = JSON.parse(event.data);
          setGameData(prevData => {
            if (!prevData) return null;
            return {
              ...prevData,
              gameState: {
                ...prevData.gameState,
                players: [...prevData.gameState.players, data.player],
              },
            };
          });
        } catch (error) {
          console.error('Error parsing player_joined event:', error);
        }
      });

      eventSource.addEventListener('player_left', (event) => {
        try {
          const data = JSON.parse(event.data);
          setGameData(prevData => {
            if (!prevData) return null;
            return {
              ...prevData,
              gameState: {
                ...prevData.gameState,
                players: prevData.gameState.players.filter(p => p.id !== data.player.id),
              },
            };
          });
        } catch (error) {
          console.error('Error parsing player_left event:', error);
        }
      });

      eventSource.addEventListener('phase_changed', (event) => {
        try {
          const data = JSON.parse(event.data);
          setGameData(prevData => {
            if (!prevData) return null;
            return {
              ...prevData,
              gameState: {
                ...prevData.gameState,
                currentPhase: data.phase,
                phaseEndTime: data.phaseEndTime ? new Date(data.phaseEndTime) : null,
              },
              // Update submissions if provided (for voting phase)
              submissions: data.submissions || prevData.submissions,
              // Update results if provided (for results phase)
              results: data.results || prevData.results,
            };
          });
        } catch (error) {
          console.error('Error parsing phase_changed event:', error);
        }
      });

      eventSource.addEventListener('game_started', (event) => {
        try {
          const data = JSON.parse(event.data);
          setGameData(prevData => ({
            ...prevData,
            gameState: data.gameState,
            playerRole: data.roleAssignments?.[getCookie('player_id')] || null,
          }));
        } catch (error) {
          console.error('Error parsing game_started event:', error);
        }
      });

      eventSource.addEventListener('submission_received', (event) => {
        // Could show real-time submission count updates
        console.log('Submission received');
      });

      eventSource.addEventListener('vote_received', (event) => {
        // Could show real-time voting progress
        console.log('Vote received');
      });

      eventSource.addEventListener('timer_update', (event) => {
        try {
          const data = JSON.parse(event.data);
          setGameData(prevData => {
            if (!prevData) return null;
            return {
              ...prevData,
              timeLeft: data.timeLeft,
            };
          });
        } catch (error) {
          console.error('Error parsing timer_update event:', error);
        }
      });

      eventSource.addEventListener('heartbeat', (event) => {
        // Keep alive - no action needed
      });

      eventSource.addEventListener('game_destroyed', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Game destroyed by admin:', data.message);
          
          // Show notification to user
          if (typeof window !== 'undefined') {
            alert('🔥 Game has been destroyed by admin!\n\nRedirecting to homepage...');
            // Redirect to homepage immediately
            window.location.href = '/';
          }
        } catch (error) {
          console.error('Error parsing game_destroyed event:', error);
          // Still redirect on error
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }
      });

      eventSource.addEventListener('cheater_alert', (event) => {
        try {
          const data = JSON.parse(event.data);
          // Show cheater alert notification
          if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification('🚨 Cheater Detected!', {
                body: `${data.playerName} opened ${data.cheaterType}!`,
                icon: '/game/logo.png'
              });
            }
          }
          
          // Show dramatic in-game alert
          const alertDiv = document.createElement('div');
          alertDiv.innerHTML = `
            <div style="
              position: fixed; 
              top: 20px; 
              right: 20px; 
              background: linear-gradient(45deg, #ff0000, #8b0000); 
              color: white; 
              padding: 20px 25px; 
              border-radius: 15px; 
              box-shadow: 0 0 30px rgba(255, 0, 0, 0.8);
              z-index: 9999; 
              font-family: 'Press Start 2P', monospace; 
              font-size: 12px;
              text-align: center;
              border: 3px solid #ff0000;
              animation: pulse 1s infinite alternate;
              max-width: 300px;
            ">
              <div style="font-size: 20px; margin-bottom: 10px;">🚨 ⚠️ 🚨</div>
              <div style="margin-bottom: 8px; color: #ffff00;">CHEATER SPOTTED!</div>
              <div style="margin-bottom: 5px;">${data.playerName}</div>
              <div style="font-size: 8px; opacity: 0.9;">opened ${data.cheaterType.toUpperCase()}</div>
              <div style="font-size: 6px; opacity: 0.7; margin-top: 8px;">Keep an eye on their responses!</div>
            </div>
          `;
          
          document.body.appendChild(alertDiv);
          
          // Remove alert after 5 seconds
          setTimeout(() => {
            if (alertDiv.parentNode) {
              alertDiv.parentNode.removeChild(alertDiv);
            }
          }, 5000);
          
        } catch (error) {
          console.error('Error parsing cheater_alert event:', error);
        }
      });

    } catch (error) {
      console.error('Error creating EventSource:', error);
      setError('Failed to connect to game events');
    }
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch initial game state (first try sessionStorage, then API)
  useEffect(() => {
    const loadInitialState = async () => {
      // Try to get initial data from sessionStorage first (faster)
      if (typeof window !== 'undefined') {
        const storedData = sessionStorage.getItem('initialGameData');
        if (storedData) {
          try {
            const initialData = JSON.parse(storedData);
            setGameData(initialData);
            // Clear from sessionStorage after use
            sessionStorage.removeItem('initialGameData');
            return;
          } catch (error) {
            console.error('Error parsing stored game data:', error);
          }
        }
      }

      // Fallback: fetch from API
      try {
        const response = await fetch('/api/game-state');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Add player role from roleAssignments if available
            const playerId = getCookie('player_id');
            const playerRole = result.data.playerRole || result.data.roleAssignments?.[playerId] || 'troll'; // Force troll for testing
            
            console.log('API GAME STATE: Player ID:', playerId, 'Role:', playerRole);
            console.log('API GAME STATE: Full result:', result.data);
            
            setGameData({
              ...result.data,
              playerRole
            });
          }
        }
      } catch (error) {
        console.error('Error fetching game state:', error);
      }
    };

    loadInitialState();
  }, []);

  return {
    gameData,
    isConnected,
    error,
    reconnect: connect,
  };
}

// Helper function to get cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue || null;
  }
  return null;
}