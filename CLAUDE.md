# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dead Internet Detector is a multiplayer social deduction game built with Next.js 15, TypeScript, and Tailwind CSS v4. Players are assigned secret roles (Pure Human, AI User, or Troll) and must identify who's using AI tools based on responses to creative challenges.

**Tech Stack**: Next.js 15 + TypeScript + Tailwind CSS v4 + Server-Sent Events + EventEmitter pattern

## Development Commands

```bash
# Development server
npm run dev         # Start development server on http://localhost:3000
npm run dev:test    # Start with test mode (1 player minimum, 30sec rounds)

# Build and deployment
npm run build       # Create production build
npm run start       # Start production server

# Code quality
npm run lint        # Run ESLint
```

## Architecture Overview

### Core Game System
- **GameManager** (`src/lib/game-manager.ts`): Singleton class managing all game state, player management, submissions, voting, and scoring logic using EventEmitter pattern
- **Game Types** (`src/types/game.ts`): Comprehensive TypeScript definitions for all game entities, API requests/responses, and real-time events
- **Game Configuration** (`src/lib/game-config.ts`): Game rules, round configurations, role descriptions, and role assignment algorithms

### Real-time Communication
- **Server-Sent Events**: Real-time game updates via `/api/events` endpoint
- **useGameEvents Hook** (`src/hooks/useGameEvents.ts`): Client-side SSE connection management with automatic reconnection and exponential backoff
- **Cookie-based Sessions**: Player identification using `player_id` cookie

### API Architecture
All API routes follow consistent patterns:
- **POST /api/join**: Player registration and game joining
- **POST /api/submit**: Round submission handling  
- **POST /api/vote**: Voting system for role predictions
- **GET /api/events**: Server-Sent Events stream for real-time updates
- **GET /api/game-state**: Current game state retrieval

### Component Structure
- **Page Routing**: App Router with `/` (landing) and `/game` (main game)
- **Phase Components**: Dedicated components for each game phase (Lobby, Role Reveal, Rounds, Voting, Results)
- **Game State Management**: Centralized via useGameEvents hook with real-time synchronization

### Game Flow
1. **Lobby Phase**: Players join (8-16 required), roles assigned randomly
2. **Role Reveal**: Players see their assigned role and strategy
3. **Three Rounds**: Creative challenges with 15-minute time limits each
4. **Voting Phase**: Players predict each other's roles
5. **Results**: Scoring based on correct guesses and role concealment

### Key Patterns
- **Singleton Game Manager**: Single source of truth for game state
- **Event-Driven Updates**: Real-time synchronization via SSE and EventEmitter
- **Type-Safe APIs**: Comprehensive TypeScript coverage with generic ApiResponse type
- **Phase-Based Rendering**: Dynamic component mounting based on game phase
- **Automatic Reconnection**: Robust connection handling with exponential backoff

## Configuration Notes
- Uses TypeScript with relaxed rules for development (strict mode disabled)
- ESLint configured with permissive rules for faster development
- Path aliases configured with `@/*` mapping to `src/*`  
- Tailwind CSS v4 with custom design system (cyber/neon theme)
- Next.js 15 with App Router architecture
- No testing framework currently configured

## Relaxed Development Rules
- TypeScript strict mode disabled for easier prototyping
- ESLint rules relaxed to reduce development friction:
  - Unused variables allowed
  - Any types permitted
  - Console.log statements allowed
  - React hooks dependency warnings instead of errors
  - TypeScript comments (@ts-ignore) allowed

## Test Mode
Use `npm run dev:test` to enable test mode with relaxed settings:
- **Minimum Players**: 1 (instead of 8)
- **Round Duration**: 30 seconds (instead of 15 minutes)
- **Voting Duration**: 30 seconds (instead of 10 minutes) 
- **Role Reveal**: 6 seconds (instead of 2 minutes)
- **Auto-start**: 1 player (instead of 8)

## Admin System
Join with name "furk12" to get admin privileges:
- **Separate Admin Slot**: Admin doesn't take up player slots (appears in dedicated admin section)
- **Lobby**: Force start game, kick players, reset game
- **All Phases**: Skip phase, advance phase, set custom timer
- **Admin UI**: Separate red-themed section in lobby, floating controls during game
- **Non-participating**: Admin doesn't get roles or participate in voting/rounds

Admin functions bypass normal game rules (e.g., can start with 1 player).

## Anti-Cheat System
Comprehensive console detection system to prevent cheating:

### Detection Methods
- **Console Hooks**: Overrides console.log/warn/error to detect DevTools console usage
- **DevTools Timing**: Uses debugger timing differences to detect DevTools
- **Resize Detection**: Monitors window resize events that indicate DevTools opening/closing
- **Element Inspector**: Traps to detect DOM inspection attempts
- **Network Tab Detection**: Image loading patterns to detect network tab usage

### Spooky Anti-Cheat Features
- **15 Random Spooky Messages**: Displays creepy warnings when console is detected
- **ASCII Art**: Shows skull art and warnings in console
- **Screen Flash**: Brief red screen flash when cheating detected
- **Sound Effects**: Console styling with retro warnings

### Real-time Cheater Alerts
- **Server Notifications**: `/api/cheater-alert` endpoint reports cheating attempts
- **Player Alerts**: Other players receive real-time notifications when someone cheats
- **Browser Notifications**: Desktop notifications for cheater alerts (if permitted)
- **In-game Alerts**: Red floating alerts appear for 5 seconds
- **Server Logs**: All cheating attempts logged with player name and type

## Retro Arcade Design System
Complete visual overhaul to 1980s arcade aesthetic:

### Typography
- **Primary**: Orbitron (sci-fi, futuristic)
- **Accent**: Press Start 2P (pixel-perfect 8-bit)
- **Monospace**: For technical elements and displays

### Color Palette
- **Neon Pink**: #ff00ff (primary accents, hover states)
- **Neon Cyan**: #00ffff (text, borders, primary UI)
- **Neon Green**: #00ff00 (success, online status)
- **Arcade Purple**: #8000ff (secondary elements)
- **Dark Background**: Complex gradient with radial neon effects

### Visual Effects
- **Retro Grid**: Animated cyberpunk-style background grid
- **Neon Glow**: Box-shadow effects on all interactive elements
- **CRT Screen**: Scan lines and RGB color shift effects
- **Scanning Lines**: Animated top border scan lines
- **Retro Pulse**: Color-shifting animation for status indicators
- **Pixel Art**: Crisp pixel rendering for images

### UI Components
- **Arcade Buttons**: 3D beveled buttons with neon glow and sweep animations
- **Arcade Panels**: Bordered containers with scan line animations
- **Score Displays**: Inset LED-style text displays
- **Progress Bars**: Neon-glowing animated progress indicators

### Immersive Experience
- **Uppercase Text**: All interface text in caps for retro computer feel
- **Technical Language**: "AGENT TYPES", "PROTOCOL", "INITIALIZE" instead of casual terms
- **Status Indicators**: "ONLINE/OFFLINE" instead of "Connected/Disconnected"
- **Gaming Terminology**: "UNITS" instead of "Players", "MISSIONS" instead of "Rounds"

## Development Tips

### Working with the GameManager
- GameManager is a singleton - access via `getGameManager()` from `@/lib/game-manager`
- All game state mutations should go through GameManager methods
- Real-time updates are handled via EventEmitter pattern - listen for events or emit new ones
- Admin functions are separate methods prefixed with `admin` (e.g., `adminForceStart`)

### API Route Patterns
- All routes return `ApiResponse<T>` type for consistency
- Cookie management is handled in `/api/join` - uses `player_id` for session tracking
- SSE endpoint (`/api/events`) streams real-time updates to all clients
- Error handling follows pattern: validation → business logic → response

### Component Architecture
- Game phases are isolated in separate components (Lobby, RoleReveal, Round, Voting, Results)
- State flows down from `useGameEvents` hook - don't duplicate game state locally
- Admin controls float over all phases when admin is present
- All time-sensitive UI should use `gameData.timeLeft` from the SSE stream

### Common Patterns
- `getCookie('player_id')` for player identification
- SessionStorage for initial game data transfer between pages
- Anti-cheat system auto-initializes in game page (see `src/lib/anti-cheat.ts`)
- Retro styling uses custom CSS classes (neon-text-*, arcade-button, retro-pulse)

### Testing & Development
- Use admin name "furk12" to get admin privileges for testing
- `npm run dev:test` enables 1-player games with 30-second rounds
- Test configuration is in `src/lib/test-config.ts`
- Console detection system is active - use `originalConsole` methods in anti-cheat

## Known Fixes Applied
- **Hydration Issues**: Fixed server/client mismatches by using proper client-side state management for window/document access and consistent date formatting
- **Date Formatting**: Uses custom `formatTimeForDisplay` utility for consistent server/client date rendering  
- **Anti-Cheat Integration**: Properly initialized in game page with cleanup on unmount
- **Retro Design**: Complete visual transformation to 1980s arcade aesthetic with proper font loading and responsive effects
- **SSE Connection Reliability**: Exponential backoff reconnection with 5 retry attempts before redirect
- **Admin State Management**: Separate admin slot that doesn't count against player limits