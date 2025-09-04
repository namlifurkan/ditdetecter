import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEvent, GameState, Player, PlayerRole } from '@/types/game';
import { OfflineGameManager } from '@/lib/offline-game-manager';
import { networkRecovery } from '@/lib/network-recovery';

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
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const offlineDataRef = useRef<GameEventData | null>(null);
  const offlineManager = useRef<OfflineGameManager | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  
  // Network quality monitoring
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'critical'>('good');
  const [latency, setLatency] = useState<number>(0);
  const networkStatsRef = useRef({
    lastHeartbeat: Date.now(),
    heartbeatFailures: 0,
    avgLatency: 0,
    connectionId: null as string | null,
    reconnectCount: 0
  });
  
  // Adaptive polling intervals based on network quality
  const getPollingInterval = useCallback(() => {
    switch (connectionQuality) {
      case 'excellent': return 2000;
      case 'good': return 3000;
      case 'poor': return 5000;
      case 'critical': return 8000;
      default: return 3000;
    }
  }, [connectionQuality]);

  // Network quality assessment
  const assessNetworkQuality = useCallback((currentLatency: number, failures: number) => {
    let quality: 'excellent' | 'good' | 'poor' | 'critical' = 'good';
    
    if (failures === 0 && currentLatency < 100) {
      quality = 'excellent';
    } else if (failures <= 1 && currentLatency < 500) {
      quality = 'good';
    } else if (failures <= 3 && currentLatency < 2000) {
      quality = 'poor';
    } else {
      quality = 'critical';
    }
    
    if (quality !== connectionQuality) {
      console.log(`Network quality changed: ${connectionQuality} → ${quality} (latency: ${currentLatency}ms, failures: ${failures})`);
      setConnectionQuality(quality);
    }
  }, [connectionQuality]);

  // Measure connection latency
  const measureLatency = useCallback(async () => {
    const start = Date.now();
    try {
      const response = await fetch('/api/game-state', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      const roundTripTime = Date.now() - start;
      
      // Update average latency (exponential moving average)
      networkStatsRef.current.avgLatency = networkStatsRef.current.avgLatency === 0 
        ? roundTripTime 
        : (networkStatsRef.current.avgLatency * 0.7) + (roundTripTime * 0.3);
      
      setLatency(Math.round(networkStatsRef.current.avgLatency));
      return roundTripTime;
    } catch (error) {
      console.error('Latency measurement failed:', error);
      return 2000; // Assume high latency on error
    }
  }, []);

  // Save game data to localStorage for offline mode
  const saveOfflineData = useCallback((data: GameEventData) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('offlineGameData', JSON.stringify({
        ...data,
        lastSaved: Date.now(),
      }));
      offlineDataRef.current = data;
      
      // Update offline manager
      if (!offlineManager.current) {
        offlineManager.current = OfflineGameManager.getInstance();
      }
      offlineManager.current.setGameData(data);
    }
  }, []);

  // Load game data from localStorage for offline mode
  const loadOfflineData = useCallback((): GameEventData | null => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('offlineGameData');
        if (stored) {
          const data = JSON.parse(stored);
          // Only use data if it's less than 5 minutes old
          if (Date.now() - data.lastSaved < 5 * 60 * 1000) {
            return data;
          }
        }
      } catch (error) {
        console.error('Error loading offline data:', error);
      }
    }
    return null;
  }, []);

  // Check if browser is online/offline
  const checkOnlineStatus = useCallback(() => {
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }
  }, []);

  // Enhanced adaptive polling mechanism
  const startPolling = useCallback(() => {
    if (pollingInterval.current) return; // Already polling
    
    console.log(`Starting adaptive polling (quality: ${connectionQuality})`);
    setIsPolling(true);
    
    const poll = async () => {
      try {
        const start = Date.now();
        
        // Use network recovery with circuit breaker
        const response = await networkRecovery.executeWithCircuitBreaker(
          'polling',
          async () => {
            const response = await fetch('/api/game-state', {
              cache: 'no-cache',
              signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
          },
          3, // failure threshold
          30000 // recovery timeout (30 seconds)
        );
        
        const responseTime = Date.now() - start;
        const result = await response.json();
        
        if (result.success) {
          setGameData(result.data);
          setError(null);
          saveOfflineData(result.data);
          
          // Update network stats
          networkStatsRef.current.avgLatency = networkStatsRef.current.avgLatency === 0 
            ? responseTime 
            : (networkStatsRef.current.avgLatency * 0.8) + (responseTime * 0.2);
          
          setLatency(Math.round(networkStatsRef.current.avgLatency));
          networkStatsRef.current.heartbeatFailures = Math.max(0, networkStatsRef.current.heartbeatFailures - 1);
        }
        
        // Assess network quality
        assessNetworkQuality(networkStatsRef.current.avgLatency, networkStatsRef.current.heartbeatFailures);
        
      } catch (error) {
        console.error('Polling error:', error);
        networkStatsRef.current.heartbeatFailures++;
        
        // Check if circuit breaker is open
        const circuitStatus = networkRecovery.getCircuitStatus('polling');
        if (circuitStatus?.state === 'open') {
          console.warn('Polling circuit breaker is open, switching to offline mode');
          setError('Connection temporarily blocked due to repeated failures');
          
          // Try to use offline data
          const offlineData = loadOfflineData();
          if (offlineData) {
            setIsOffline(true);
            setGameData(offlineData);
          }
        }
        
        assessNetworkQuality(networkStatsRef.current.avgLatency, networkStatsRef.current.heartbeatFailures);
      }
    };
    
    // Initial poll
    poll();
    
    // Set up adaptive interval
    pollingInterval.current = setInterval(poll, getPollingInterval());
    
    // Adjust polling interval based on network quality changes
    const intervalAdjuster = setInterval(() => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = setInterval(poll, getPollingInterval());
      }
    }, 10000); // Check every 10 seconds
    
    // Store interval adjuster for cleanup
    (pollingInterval.current as any).adjuster = intervalAdjuster;
    
  }, [saveOfflineData, connectionQuality, getPollingInterval, assessNetworkQuality]);

  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      
      // Clear interval adjuster if exists
      if ((pollingInterval.current as any).adjuster) {
        clearInterval((pollingInterval.current as any).adjuster);
      }
      
      pollingInterval.current = null;
      setIsPolling(false);
      console.log('Stopped adaptive polling');
    }
  }, []);

  const connect = () => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return; // Already connected
    }

    // Check online status first
    checkOnlineStatus();
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      const offlineData = loadOfflineData();
      if (offlineData) {
        setGameData(offlineData);
        console.log('Using offline game data');
      }
      return;
    }

    // Clean up any existing connection first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const eventSource = new EventSource('/api/events');
      eventSourceRef.current = eventSource;

      eventSource.onopen = async () => {
        setIsConnected(true);
        setIsOffline(false);
        setError(null);
        reconnectAttempts.current = 0;
        stopPolling(); // Stop polling when SSE connects
        console.log('Connected to game events');
        
        // Try to sync offline actions when connection is restored
        if (offlineManager.current) {
          try {
            const syncSuccess = await offlineManager.current.syncOfflineActions();
            if (syncSuccess) {
              console.log('Offline actions synced successfully');
            }
          } catch (error) {
            console.error('Failed to sync offline actions:', error);
          }
        }
      };

      eventSource.onerror = (event) => {
        console.warn('EventSource connection lost, switching to polling mode');
        setIsConnected(false);
        
        // Check if we're offline
        checkOnlineStatus();
        if (typeof window !== 'undefined' && !navigator.onLine) {
          setIsOffline(true);
          const offlineData = loadOfflineData();
          if (offlineData) {
            setGameData(offlineData);
            setError('You are offline. Using cached game data.');
            console.log('Switched to offline mode');
            
            // Initialize offline manager
            if (!offlineManager.current) {
              offlineManager.current = OfflineGameManager.getInstance();
            }
            offlineManager.current.setGameData(offlineData);
            offlineManager.current.showOfflineNotification();
          }
          return;
        }
        
        // Immediately start polling as fallback (Vercel SSE issues)
        console.log('Starting polling mode due to SSE connection issues');
        startPolling();
        setError('Connection switched to polling mode for better reliability.');
        
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          
          // Use network recovery for intelligent reconnection
          networkRecovery.executeWithRecovery(
            () => new Promise<void>((resolve) => {
              console.log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`);
              connect();
              resolve();
            }),
            {
              strategy: networkRecovery.createStrategy('realtime'),
              onRetry: (attempt) => {
                console.log(`SSE reconnection attempt ${attempt}`);
                networkStatsRef.current.reconnectCount++;
              },
              onFailure: () => {
                console.error('SSE reconnection failed, starting fallback polling');
                startPolling();
              }
            }
          ).catch(() => {
            // Handled by onFailure callback
          });
        } else {
          // Start polling as fallback instead of giving up
          console.log('SSE failed, starting fallback polling');
          startPolling();
          
          // Try to use offline data
          const offlineData = loadOfflineData();
          if (offlineData) {
            setIsOffline(true);
            setGameData(offlineData);
            setError('Connection unstable. Using fallback mode.');
            console.log('Using offline mode after connection failure');
            
            // Initialize offline manager
            if (!offlineManager.current) {
              offlineManager.current = OfflineGameManager.getInstance();
            }
            offlineManager.current.setGameData(offlineData);
            offlineManager.current.showOfflineNotification('Connection unstable. Your actions will be synced when possible.');
          } else {
            setError('Connection issues. Attempting to reconnect...');
          }
        }
      };

      // Handle different event types
      eventSource.addEventListener('game_state', (event) => {
        try {
          const data = JSON.parse(event.data);
          const newGameData = {
            ...data,
          };
          setGameData(prevData => ({
            ...prevData,
            ...newGameData,
          }));
          // Save to offline storage
          saveOfflineData(newGameData);
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
        try {
          const heartbeatData = JSON.parse(event.data);
          const now = Date.now();
          
          // Store connection ID for tracking
          if (heartbeatData.connectionId && networkStatsRef.current.connectionId !== heartbeatData.connectionId) {
            networkStatsRef.current.connectionId = heartbeatData.connectionId;
            console.log(`SSE Connection ID: ${heartbeatData.connectionId}`);
          }
          
          // Calculate latency from server timestamp
          if (heartbeatData.serverTime) {
            const serverLatency = Math.abs(now - heartbeatData.serverTime);
            networkStatsRef.current.avgLatency = networkStatsRef.current.avgLatency === 0 
              ? serverLatency 
              : (networkStatsRef.current.avgLatency * 0.8) + (serverLatency * 0.2);
            
            setLatency(Math.round(networkStatsRef.current.avgLatency));
          }
          
          // Update heartbeat tracking
          networkStatsRef.current.lastHeartbeat = now;
          networkStatsRef.current.heartbeatFailures = Math.max(0, networkStatsRef.current.heartbeatFailures - 1);
          
          // Assess network quality
          assessNetworkQuality(networkStatsRef.current.avgLatency, networkStatsRef.current.heartbeatFailures);
          
          // Log connection health if degraded
          if (heartbeatData.connectionHealth === 'degraded') {
            console.warn(`Server reports degraded connection health for ${heartbeatData.connectionId}`);
          }
          
        } catch (error) {
          console.error('Error parsing heartbeat:', error);
        }
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
    stopPolling();
    setIsConnected(false);
  };

  useEffect(() => {
    connect();
    
    // Listen for online/offline events
    const handleOnline = () => {
      console.log('Browser came online');
      setIsOffline(false);
      if (!isConnected) {
        console.log('Attempting to reconnect after coming online');
        connect();
      }
    };
    
    const handleOffline = () => {
      console.log('Browser went offline');
      setIsOffline(true);
      const offlineData = loadOfflineData();
      if (offlineData) {
        setGameData(offlineData);
        setError('You are offline. Using cached game data.');
        
        // Initialize offline manager
        if (!offlineManager.current) {
          offlineManager.current = OfflineGameManager.getInstance();
        }
        offlineManager.current.setGameData(offlineData);
        offlineManager.current.showOfflineNotification();
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
    
    return () => {
      disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
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

  // Expose offline manager functions
  const submitOffline = useCallback((playerId: string, submission: any) => {
    if (offlineManager.current) {
      offlineManager.current.addOfflineSubmission(playerId, submission);
    }
  }, []);

  const voteOffline = useCallback((playerId: string, votes: any) => {
    if (offlineManager.current) {
      offlineManager.current.addOfflineVote(playerId, votes);
    }
  }, []);

  return {
    gameData,
    isConnected: isConnected || isPolling, // Show as connected if polling works
    isOffline,
    error,
    reconnect: connect,
    submitOffline,
    voteOffline,
    // Network monitoring data
    connectionQuality,
    latency,
    networkStats: {
      reconnectCount: networkStatsRef.current.reconnectCount,
      connectionId: networkStatsRef.current.connectionId,
      avgLatency: networkStatsRef.current.avgLatency,
      heartbeatFailures: networkStatsRef.current.heartbeatFailures
    }
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