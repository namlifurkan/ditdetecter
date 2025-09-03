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
    // Always randomize for single player testing
    const roles = ['human', 'ai_user', 'troll'] as const;
    // Use timestamp to ensure different randomization each game
    const seed = Date.now() + Math.random() * 1000;
    const randomIndex = Math.floor(seed % 3);
    const randomRole = roles[randomIndex];
    console.log(`TEST: Single player randomization - assigned ${randomRole} role (seed: ${seed})`);
    
    return {
      human: randomRole === 'human' ? 1 : 0,
      ai_user: randomRole === 'ai_user' ? 1 : 0,
      troll: randomRole === 'troll' ? 1 : 0,
    };
  }
  
  if (playerCount === 2) {
    // For 2 players, randomize both roles
    const roles = ['human', 'ai_user', 'troll'] as const;
    const seed1 = Date.now() + Math.random() * 1000;
    const seed2 = seed1 + 17; // Offset for second player
    
    const role1 = roles[Math.floor(seed1 % 3)];
    const role2 = roles[Math.floor(seed2 % 3)];
    
    console.log(`TEST: Two player randomization - assigned ${role1} and ${role2} roles`);
    
    return {
      human: (role1 === 'human' ? 1 : 0) + (role2 === 'human' ? 1 : 0),
      ai_user: (role1 === 'ai_user' ? 1 : 0) + (role2 === 'ai_user' ? 1 : 0),
      troll: (role1 === 'troll' ? 1 : 0) + (role2 === 'troll' ? 1 : 0),
    };
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

  // Shuffle role pool using improved randomization
  for (let i = rolePool.length - 1; i > 0; i--) {
    // Use timestamp and random for better randomization
    const seed = Date.now() + Math.random() * 1000 + i;
    const j = Math.floor(seed % (i + 1));
    [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
  }

  console.log(`TEST: Role pool after shuffle:`, rolePool);

  // Assign roles to players
  playerIds.forEach((playerId, index) => {
    const assignedRole = rolePool[index] || 'human';
    assignments[playerId] = assignedRole;
    console.log(`TEST: Assigned ${assignedRole} to player ${index + 1} (${playerId.slice(-8)})`);
  });

  return assignments;
}