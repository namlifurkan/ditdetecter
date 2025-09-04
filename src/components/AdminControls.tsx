import { useState, useEffect } from 'react';
import { networkRecovery } from '@/lib/network-recovery';
import { CompressionUtils } from '@/lib/compression-utils';

interface AdminControlsProps {
  isAdmin: boolean;
  gamePhase: string;
}

interface SystemStats {
  memory: {
    used: number;
    total: number;
  };
  connections: {
    active: number;
    total: number;
  };
  errors: {
    rate: number;
    recent: Array<{ type: string; count: number; }>;
  };
  compression: {
    ratio: number;
    savings: number;
  };
}

export default function AdminControls({ isAdmin, gamePhase }: AdminControlsProps) {
  const [customTimer, setCustomTimer] = useState('60');
  const [mounted, setMounted] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'controls' | 'monitor' | 'database' | 'network' | 'logs'>('controls');
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<Array<{ time: string; level: string; message: string; }>>([]);
  const [networkDiagnostics, setNetworkDiagnostics] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [compressionStats, setCompressionStats] = useState<any>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
    
    // Initialize admin monitoring
    if (isAdmin) {
      startSystemMonitoring();
      captureConsoleLogs();
    }
  }, [isAdmin]);

  // System monitoring functions
  const startSystemMonitoring = () => {
    const updateStats = async () => {
      try {
        // Network diagnostics
        const errorAnalysis = networkRecovery.getErrorAnalysis();
        const compressionInfo = CompressionUtils.getCacheStats();
        
        setNetworkDiagnostics(errorAnalysis);
        setCompressionStats(compressionInfo);
        
        // Get system stats from API
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
          const stats = await response.json();
          setSystemStats(stats);
        }
        
        // Get session data
        const sessionResponse = await fetch('/api/admin/sessions');
        if (sessionResponse.ok) {
          const sessions = await sessionResponse.json();
          setSessionData(sessions);
        }
      } catch (error) {
        console.error('Failed to update admin stats:', error);
      }
    };

    // Update every 5 seconds
    updateStats();
    const interval = setInterval(updateStats, 5000);
    
    return () => clearInterval(interval);
  };

  // Capture console logs for debugging
  const captureConsoleLogs = () => {
    const originalConsole = { ...console };
    
    ['log', 'warn', 'error', 'info'].forEach(level => {
      (console as any)[level] = (...args: any[]) => {
        originalConsole[level as keyof Console](...args);
        
        setConsoleLogs(prev => {
          const newLog = {
            time: new Date().toLocaleTimeString(),
            level,
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
          };
          
          return [newLog, ...prev.slice(0, 49)]; // Keep last 50 logs
        });
      };
    });
  };

  if (!mounted || !isAdmin) return null;

  const adminAdvancePhase = async () => {
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'advance_phase' }),
      });
      
      if (!response.ok) {
        console.error('Failed to advance phase');
      }
    } catch (error) {
      console.error('Error advancing phase:', error);
    }
  };

  const adminSkipPhase = async () => {
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'skip_phase' }),
      });
      
      if (!response.ok) {
        console.error('Failed to skip phase');
      }
    } catch (error) {
      console.error('Error skipping phase:', error);
    }
  };

  const adminSetTimer = async () => {
    const duration = parseInt(customTimer);
    if (isNaN(duration) || duration <= 0) {
      alert('Please enter a valid duration in seconds');
      return;
    }

    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'set_timer',
          duration 
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to set timer');
      }
    } catch (error) {
      console.error('Error setting timer:', error);
    }
  };

  const adminDestroyGame = async () => {
    if (!confirm('🔥 DESTROY GAME?\n\nThis will END the current game and send everyone back to the homepage. This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'destroy_game' }),
      });
      
      if (response.ok) {
        // Redirect admin to homepage
        window.location.href = '/';
      } else {
        console.error('Failed to destroy game');
      }
    } catch (error) {
      console.error('Error destroying game:', error);
    }
  };

  // Advanced admin functions
  const resetNetworkRecovery = () => {
    networkRecovery.resetCircuit('polling');
    networkRecovery.resetCircuit('sse');
    alert('Network recovery circuits reset');
  };

  const clearCompressionCache = () => {
    CompressionUtils.clearCaches();
    alert('Compression caches cleared');
  };

  const exportSystemData = () => {
    const data = {
      systemStats,
      networkDiagnostics,
      sessionData,
      compressionStats,
      consoleLogs: consoleLogs.slice(0, 10),
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const executeCustomQuery = async (query: string) => {
    try {
      const response = await fetch('/api/admin/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      const result = await response.json();
      console.log('Query Result:', result);
      alert(`Query executed. Check console for results.`);
    } catch (error) {
      console.error('Query failed:', error);
      alert('Query failed. Check console.');
    }
  };

  const kickPlayer = async (playerId: string) => {
    if (!confirm(`Kick player ${playerId}?`)) return;
    
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kick_player', playerId })
      });
    } catch (error) {
      console.error('Failed to kick player:', error);
    }
  };

  const simulateNetworkError = () => {
    // Simulate a network error for testing
    fetch('/api/nonexistent').catch(() => {
      console.log('Simulated network error for testing');
    });
  };

  // Compact view when dashboard is closed
  if (!isDashboardOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsDashboardOpen(true)}
          className="bg-red-900/90 hover:bg-red-800 text-red-200 px-4 py-2 rounded-lg border border-red-500/50 font-mono text-sm backdrop-blur-sm"
        >
          🔥 DEV PANEL
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-4 z-50 bg-black/95 backdrop-blur-sm rounded-xl border border-red-500/50 font-mono overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-red-900/50 p-4 border-b border-red-500/30 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-red-400 font-bold text-lg">🔥 DEVELOPER DASHBOARD</h1>
          <span className="text-gray-400 text-sm">Phase: {gamePhase}</span>
          <span className="text-green-400 text-sm">● LIVE</span>
        </div>
        <button
          onClick={() => setIsDashboardOpen(false)}
          className="text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-600">
        {[
          { id: 'controls', icon: '🎮', label: 'GAME CONTROLS' },
          { id: 'monitor', icon: '📊', label: 'SYSTEM MONITOR' },
          { id: 'database', icon: '🗄️', label: 'DATABASE' },
          { id: 'network', icon: '🌐', label: 'NETWORK' },
          { id: 'logs', icon: '📝', label: 'CONSOLE LOGS' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm ${
              activeTab === tab.id
                ? 'bg-red-900/50 text-red-400 border-b-2 border-red-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'controls' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={adminAdvancePhase}
                className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold"
              >
                ⏭️ NEXT PHASE
              </button>
              
              <button
                onClick={adminSkipPhase}
                className="bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-lg font-bold"
              >
                ⏩ SKIP PHASE
              </button>
              
              <button
                onClick={resetNetworkRecovery}
                className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg font-bold"
              >
                🔄 RESET NETWORK
              </button>
              
              <button
                onClick={exportSystemData}
                className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg font-bold"
              >
                📁 EXPORT DATA
              </button>
            </div>

            <div className="border border-gray-600 rounded-lg p-4">
              <h3 className="text-cyan-400 font-bold mb-2">CUSTOM TIMER</h3>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customTimer}
                  onChange={(e) => setCustomTimer(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
                  placeholder="Seconds"
                  min="1"
                />
                <button
                  onClick={adminSetTimer}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold"
                >
                  ⏰ SET
                </button>
              </div>
            </div>

            <div className="border border-gray-600 rounded-lg p-4">
              <h3 className="text-cyan-400 font-bold mb-2">TESTING TOOLS</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={simulateNetworkError}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white p-2 rounded text-sm"
                >
                  🧪 SIMULATE ERROR
                </button>
                <button
                  onClick={clearCompressionCache}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded text-sm"
                >
                  🗑️ CLEAR CACHE
                </button>
              </div>
            </div>

            <div className="border border-red-600 rounded-lg p-4 bg-red-900/20">
              <h3 className="text-red-400 font-bold mb-2">DANGER ZONE</h3>
              <button
                onClick={adminDestroyGame}
                className="w-full bg-red-700 hover:bg-red-800 text-white p-3 rounded font-bold border border-red-600"
              >
                🔥 DESTROY GAME
              </button>
            </div>
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="space-y-4">
            {systemStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4">
                  <h4 className="text-green-400 font-bold">MEMORY</h4>
                  <div className="text-white text-lg">
                    {((systemStats.memory.used / systemStats.memory.total) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-400">
                    {systemStats.memory.used}MB / {systemStats.memory.total}MB
                  </div>
                </div>

                <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
                  <h4 className="text-blue-400 font-bold">CONNECTIONS</h4>
                  <div className="text-white text-lg">{systemStats.connections.active}</div>
                  <div className="text-xs text-gray-400">Active / {systemStats.connections.total} Total</div>
                </div>

                <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                  <h4 className="text-yellow-400 font-bold">ERRORS</h4>
                  <div className="text-white text-lg">{systemStats.errors.rate.toFixed(2)}/s</div>
                  <div className="text-xs text-gray-400">Error Rate</div>
                </div>
              </div>
            )}

            {networkDiagnostics && (
              <div className="border border-gray-600 rounded-lg p-4">
                <h3 className="text-cyan-400 font-bold mb-2">NETWORK DIAGNOSTICS</h3>
                <div className="space-y-2">
                  <div>Error Rate: <span className="text-yellow-400">{networkDiagnostics.errorRate}/s</span></div>
                  {networkDiagnostics.commonErrors.map((error: any, i: number) => (
                    <div key={i} className="text-sm">
                      {error.type}: <span className="text-red-400">{error.percentage}%</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {networkDiagnostics.suggestions[0]}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'database' && (
          <div className="space-y-4">
            {sessionData && (
              <div>
                <h3 className="text-cyan-400 font-bold mb-2">SESSION DATA</h3>
                <div className="bg-gray-800 rounded-lg p-4 text-xs overflow-auto max-h-96">
                  <pre>{JSON.stringify(sessionData, null, 2)}</pre>
                </div>
              </div>
            )}

            <div className="border border-gray-600 rounded-lg p-4">
              <h3 className="text-cyan-400 font-bold mb-2">CUSTOM QUERY</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter query..."
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      executeCustomQuery((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.querySelector('input[placeholder="Enter query..."]') as HTMLInputElement;
                    executeCustomQuery(input.value);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  EXECUTE
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'network' && (
          <div className="space-y-4">
            {compressionStats && (
              <div className="border border-gray-600 rounded-lg p-4">
                <h3 className="text-cyan-400 font-bold mb-2">COMPRESSION STATS</h3>
                <div className="space-y-1 text-sm">
                  <div>ID Mappings: <span className="text-green-400">{compressionStats.idMappings}</span></div>
                  <div>Next ID: <span className="text-blue-400">{compressionStats.nextId}</span></div>
                  <div>Memory Usage: <span className="text-yellow-400">{compressionStats.memoryUsage} bytes</span></div>
                </div>
              </div>
            )}

            <div className="border border-gray-600 rounded-lg p-4">
              <h3 className="text-cyan-400 font-bold mb-2">NETWORK TOOLS</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => networkRecovery.resetCircuit('polling')}
                  className="bg-orange-600 hover:bg-orange-700 text-white p-2 rounded text-sm"
                >
                  RESET POLLING CIRCUIT
                </button>
                <button
                  onClick={() => networkRecovery.resetCircuit('sse')}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded text-sm"
                >
                  RESET SSE CIRCUIT
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-cyan-400 font-bold">CONSOLE LOGS ({consoleLogs.length}/50)</h3>
              <button
                onClick={() => setConsoleLogs([])}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                CLEAR
              </button>
            </div>
            
            <div className="bg-black border border-gray-600 rounded-lg h-96 overflow-auto p-2">
              {consoleLogs.map((log, i) => (
                <div
                  key={i}
                  className={`text-xs mb-1 ${
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warn' ? 'text-yellow-400' :
                    log.level === 'info' ? 'text-blue-400' :
                    'text-gray-300'
                  }`}
                >
                  <span className="text-gray-500">[{log.time}]</span> {log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}