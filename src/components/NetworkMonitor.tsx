'use client';

import { useEffect, useState } from 'react';
import { networkRecovery } from '@/lib/network-recovery';

interface NetworkMonitorProps {
  connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
  latency: number;
  isConnected: boolean;
  isOffline: boolean;
  networkStats: {
    reconnectCount: number;
    connectionId: string | null;
    avgLatency: number;
    heartbeatFailures: number;
  };
  compact?: boolean;
}

export default function NetworkMonitor({
  connectionQuality,
  latency,
  isConnected,
  isOffline,
  networkStats,
  compact = false
}: NetworkMonitorProps) {
  const [errorAnalysis, setErrorAnalysis] = useState<any>(null);
  const [circuitStatus, setCircuitStatus] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateAnalysis = () => {
      const analysis = networkRecovery.getErrorAnalysis();
      const polling = networkRecovery.getCircuitStatus('polling');
      setErrorAnalysis(analysis);
      setCircuitStatus(polling);
    };

    updateAnalysis();
    const interval = setInterval(updateAnalysis, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Show monitor in development or when there are issues
  useEffect(() => {
    const shouldShow = process.env.NODE_ENV === 'development' || 
                      !isConnected || 
                      isOffline || 
                      connectionQuality === 'poor' || 
                      connectionQuality === 'critical' ||
                      (errorAnalysis && errorAnalysis.errorRate > 0.1);
    
    setIsVisible(shouldShow);
  }, [isConnected, isOffline, connectionQuality, errorAnalysis]);

  if (!isVisible && compact) return null;

  const getQualityColor = (quality: typeof connectionQuality) => {
    switch (quality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-cyan-400';
      case 'poor': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
    }
  };

  const getQualityIcon = (quality: typeof connectionQuality) => {
    switch (quality) {
      case 'excellent': return '📶';
      case 'good': return '📡';
      case 'poor': return '📊';
      case 'critical': return '⚠️';
    }
  };

  const getStatusIcon = () => {
    if (isOffline) return '🔴';
    if (!isConnected) return '🟡';
    if (circuitStatus?.state === 'open') return '🚫';
    if (circuitStatus?.state === 'half-open') return '🟡';
    return '🟢';
  };

  if (compact) {
    return (
      <div 
        className="fixed top-4 right-4 z-50 bg-black/80 border border-cyan-400 rounded-lg p-2 font-mono text-xs cursor-pointer"
        onClick={() => setIsVisible(!isVisible)}
      >
        <div className="flex items-center gap-2">
          <span>{getStatusIcon()}</span>
          <span className={getQualityColor(connectionQuality)}>
            {connectionQuality.toUpperCase()}
          </span>
          <span className="text-gray-400">{latency}ms</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/90 border border-cyan-400 rounded-lg p-4 font-mono text-xs max-w-sm">
      <div 
        className="flex items-center justify-between mb-2 cursor-pointer"
        onClick={() => setIsVisible(!isVisible)}
      >
        <h3 className="text-cyan-400 font-bold">NETWORK STATUS</h3>
        <button className="text-gray-400 hover:text-white">
          {isVisible ? '▼' : '▲'}
        </button>
      </div>
      
      {isVisible && (
        <div className="space-y-2">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Status:</span>
            <div className="flex items-center gap-2">
              <span>{getStatusIcon()}</span>
              <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                {isOffline ? 'OFFLINE' : isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </div>

          {/* Network Quality */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Quality:</span>
            <div className="flex items-center gap-2">
              <span>{getQualityIcon(connectionQuality)}</span>
              <span className={getQualityColor(connectionQuality)}>
                {connectionQuality.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Latency */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Latency:</span>
            <span className={latency < 100 ? 'text-green-400' : latency < 500 ? 'text-yellow-400' : 'text-red-400'}>
              {latency}ms
            </span>
          </div>

          {/* Connection ID */}
          {networkStats.connectionId && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Conn ID:</span>
              <span className="text-gray-300 text-xs font-mono">
                {networkStats.connectionId.split('_')[2]?.substring(0, 6)}...
              </span>
            </div>
          )}

          {/* Reconnect Count */}
          {networkStats.reconnectCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Reconnects:</span>
              <span className="text-yellow-400">{networkStats.reconnectCount}</span>
            </div>
          )}

          {/* Heartbeat Failures */}
          {networkStats.heartbeatFailures > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Failures:</span>
              <span className="text-red-400">{networkStats.heartbeatFailures}</span>
            </div>
          )}

          {/* Circuit Breaker Status */}
          {circuitStatus && circuitStatus.state !== 'closed' && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Circuit:</span>
              <span className={circuitStatus.state === 'open' ? 'text-red-400' : 'text-yellow-400'}>
                {circuitStatus.state.toUpperCase()}
              </span>
            </div>
          )}

          {/* Error Analysis */}
          {errorAnalysis && errorAnalysis.errorRate > 0 && (
            <div className="border-t border-gray-600 pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400">Error Rate:</span>
                <span className="text-red-400">
                  {errorAnalysis.errorRate.toFixed(2)}/s
                </span>
              </div>
              
              {errorAnalysis.commonErrors.length > 0 && (
                <div className="space-y-1">
                  {errorAnalysis.commonErrors.slice(0, 2).map((error: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-gray-400 capitalize">{error.type}:</span>
                      <span className="text-red-400">{error.percentage}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggestions */}
          {errorAnalysis && errorAnalysis.suggestions.length > 0 && (
            <div className="border-t border-gray-600 pt-2">
              <div className="text-gray-400 mb-1">Suggestions:</div>
              <div className="text-yellow-300 text-xs">
                {errorAnalysis.suggestions[0]}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}