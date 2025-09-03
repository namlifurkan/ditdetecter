import { GAME_CONFIG, getRoleDistribution, assignRoles } from './game-config';
import { PlayerRole } from '@/types/game';

// Test mode configuration - overrides production settings when enabled
export const TEST_CONFIG = {
  ENABLED: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_TEST_MODE === 'true',
  MIN_PLAYERS: 1,
  MAX_PLAYERS: 4,
  ROUND_DURATION: 0.5, // 30 seconds for testing
  VOTING_DURATION: 0.5, // 30 seconds for testing
  ROLE_REVEAL_DURATION: 0.1, // 6 seconds for testing
  LOBBY_AUTO_START_THRESHOLD: 12,
} as const;

// Get effective game config (test or production)
export function getGameConfig() {
  if (TEST_CONFIG.ENABLED) {
    return {
      ...GAME_CONFIG,
      MIN_PLAYERS: TEST_CONFIG.MIN_PLAYERS,
      MAX_PLAYERS: TEST_CONFIG.MAX_PLAYERS,
      ROUND_DURATION: TEST_CONFIG.ROUND_DURATION,
      VOTING_DURATION: TEST_CONFIG.VOTING_DURATION,
      ROLE_REVEAL_DURATION: TEST_CONFIG.ROLE_REVEAL_DURATION,
      LOBBY_AUTO_START_THRESHOLD: TEST_CONFIG.LOBBY_AUTO_START_THRESHOLD,
    };
  }
  return GAME_CONFIG;
}

// Test-friendly role distribution
export function getTestRoleDistribution(playerCount: number): Record<PlayerRole, number> {
  if (!TEST_CONFIG.ENABLED) {
    return getRoleDistribution(playerCount);
  }

  // Test mode distributions
  if (playerCount === 1) {
    // Cycle between roles for testing
    const roles = ['human', 'ai_user', 'troll'] as const;
    const randomRole = roles[Math.floor(Math.random() * roles.length)];
    console.log(`TEST: Assigning ${randomRole} role for single player test`);
    
    return {
      human: randomRole === 'human' ? 1 : 0,
      ai_user: randomRole === 'ai_user' ? 1 : 0,
      troll: randomRole === 'troll' ? 1 : 0,
    };
  }
  
  if (playerCount === 2) {
    return { human: 1, ai_user: 1, troll: 0 };
  }
  
  if (playerCount === 3) {
    return { human: 1, ai_user: 1, troll: 1 };
  }
  
  if (playerCount === 4) {
    return { human: 2, ai_user: 1, troll: 1 };
  }

  // Fallback to production logic
  return getRoleDistribution(playerCount);
}

// Test-friendly role assignment
export function assignTestRoles(playerIds: string[]): Record<string, PlayerRole> {
  if (!TEST_CONFIG.ENABLED) {
    return assignRoles(playerIds);
  }

  const distribution = getTestRoleDistribution(playerIds.length);
  const assignments: Record<string, PlayerRole> = {};
  
  // Create role pool based on distribution
  const rolePool: PlayerRole[] = [];
  Object.entries(distribution).forEach(([role, count]) => {
    for (let i = 0; i < count; i++) {
      rolePool.push(role as PlayerRole);
    }
  });

  // Shuffle role pool
  for (let i = rolePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
  }

  // Assign roles to players
  playerIds.forEach((playerId, index) => {
    assignments[playerId] = rolePool[index] || 'human';
  });

  return assignments;
}