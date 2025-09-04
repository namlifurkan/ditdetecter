import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const playerId = request.cookies.get('player_id')?.value;
    if (!playerId || !isAdmin(playerId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Collect system statistics
    const stats = {
      memory: getMemoryStats(),
      connections: getConnectionStats(),
      errors: getErrorStats(),
      performance: getPerformanceStats(),
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error getting admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions
function isAdmin(playerId: string): boolean {
  // Simple admin check - in production, this should be more secure
  return playerId.includes('player_') && Math.random() > 0.1; // Mock admin check
}

function getMemoryStats() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      used: Math.round(usage.heapUsed / 1024 / 1024), // MB
      total: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024) // MB
    };
  }
  
  return {
    used: Math.round(Math.random() * 100), // Mock data
    total: Math.round(128 + Math.random() * 256),
    external: Math.round(Math.random() * 20),
    rss: Math.round(Math.random() * 150)
  };
}

function getConnectionStats() {
  // In a real app, you'd track actual connections
  return {
    active: Math.round(Math.random() * 50),
    total: Math.round(100 + Math.random() * 200),
    sse: Math.round(Math.random() * 20),
    polling: Math.round(Math.random() * 10)
  };
}

function getErrorStats() {
  return {
    rate: Math.round((Math.random() * 2) * 100) / 100, // errors per second
    recent: [
      { type: 'timeout', count: Math.round(Math.random() * 10) },
      { type: 'connection', count: Math.round(Math.random() * 5) },
      { type: 'server', count: Math.round(Math.random() * 3) }
    ]
  };
}

function getPerformanceStats() {
  return {
    uptime: process.uptime ? Math.round(process.uptime()) : Math.round(Math.random() * 3600),
    loadAverage: process.platform === 'win32' ? [0, 0, 0] : (process.loadavg ? process.loadavg() : [0.5, 0.3, 0.1]),
    nodeVersion: process.version || 'v20.0.0',
    platform: process.platform || 'unknown'
  };
}