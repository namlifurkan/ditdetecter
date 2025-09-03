import { useState, useEffect } from 'react';

interface AdminControlsProps {
  isAdmin: boolean;
  gamePhase: string;
}

export default function AdminControls({ isAdmin, gamePhase }: AdminControlsProps) {
  const [customTimer, setCustomTimer] = useState('60');
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/80 backdrop-blur-sm rounded-xl p-4 border border-red-500/30">
      <div className="text-red-400 text-xs font-bold mb-3 flex items-center">
        🔥 ADMIN CONTROLS
        <span className="ml-2 text-gray-400 font-normal">({gamePhase})</span>
      </div>
      
      <div className="flex flex-col gap-2">
        <button
          onClick={adminAdvancePhase}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          ⏭️ Next Phase
        </button>
        
        <button
          onClick={adminSkipPhase}
          className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          ⏩ Skip Phase
        </button>
        
        <div className="flex gap-2">
          <input
            type="number"
            value={customTimer}
            onChange={(e) => setCustomTimer(e.target.value)}
            className="w-16 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
            placeholder="60"
            min="1"
          />
          <button
            onClick={adminSetTimer}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            ⏰ Set Timer
          </button>
        </div>
        
        <button
          onClick={adminDestroyGame}
          className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-bold rounded-lg transition-colors border border-red-600 mt-2"
        >
          🔥 DESTROY GAME
        </button>
      </div>
    </div>
  );
}