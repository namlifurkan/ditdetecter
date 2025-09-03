// Offline Game Manager - Handles game flow when internet connection is lost
export class OfflineGameManager {
  private static instance: OfflineGameManager;
  private gameData: any = null;
  private localTimer: NodeJS.Timeout | null = null;
  private timeLeft: number = 0;

  static getInstance(): OfflineGameManager {
    if (!OfflineGameManager.instance) {
      OfflineGameManager.instance = new OfflineGameManager();
    }
    return OfflineGameManager.instance;
  }

  setGameData(data: any) {
    this.gameData = data;
    this.timeLeft = data.timeLeft || 0;
  }

  getGameData() {
    return this.gameData;
  }

  // Start local timer for current phase
  startLocalTimer(duration: number, onUpdate?: (timeLeft: number) => void, onComplete?: () => void) {
    this.stopLocalTimer();
    this.timeLeft = duration;

    this.localTimer = setInterval(() => {
      this.timeLeft -= 1;
      
      if (onUpdate) {
        onUpdate(this.timeLeft);
      }

      if (this.timeLeft <= 0) {
        this.stopLocalTimer();
        if (onComplete) {
          onComplete();
        }
      }
    }, 1000);
  }

  stopLocalTimer() {
    if (this.localTimer) {
      clearInterval(this.localTimer);
      this.localTimer = null;
    }
  }

  getTimeLeft(): number {
    return this.timeLeft;
  }

  // Handle offline submissions - store locally
  addOfflineSubmission(playerId: string, submission: any) {
    if (typeof window !== 'undefined') {
      const key = `offline_submission_${playerId}`;
      localStorage.setItem(key, JSON.stringify({
        submission,
        timestamp: Date.now(),
        phase: this.gameData?.gameState?.currentPhase
      }));
    }
  }

  // Handle offline votes - store locally
  addOfflineVote(playerId: string, votes: any) {
    if (typeof window !== 'undefined') {
      const key = `offline_votes_${playerId}`;
      localStorage.setItem(key, JSON.stringify({
        votes,
        timestamp: Date.now()
      }));
    }
  }

  // Get all offline actions for syncing when online
  getOfflineActions(): {submissions: any[], votes: any[]} {
    if (typeof window === 'undefined') {
      return {submissions: [], votes: []};
    }

    const submissions: any[] = [];
    const votes: any[] = [];

    // Get all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('offline_submission_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          submissions.push({
            playerId: key.replace('offline_submission_', ''),
            ...data
          });
        } catch (error) {
          console.error('Error parsing offline submission:', error);
        }
      } else if (key.startsWith('offline_votes_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          votes.push({
            playerId: key.replace('offline_votes_', ''),
            ...data
          });
        } catch (error) {
          console.error('Error parsing offline votes:', error);
        }
      }
    }

    return {submissions, votes};
  }

  // Clear offline actions after successful sync
  clearOfflineActions() {
    if (typeof window === 'undefined') return;

    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('offline_submission_') || key.startsWith('offline_votes_')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  // Simulate basic game progression in offline mode
  simulatePhaseProgression(): string | null {
    if (!this.gameData) return null;

    const currentPhase = this.gameData.gameState.currentPhase;
    
    // Basic phase progression logic for offline mode
    switch (currentPhase) {
      case 'round1':
        return 'round2';
      case 'round2':
        return 'round3';
      case 'round3':
        return 'voting';
      case 'voting':
        return 'results';
      case 'role_reveal':
        return 'round1';
      default:
        return null;
    }
  }

  // Show offline mode notification to user
  showOfflineNotification(message: string = 'You are in offline mode. Your actions will be synced when connection is restored.') {
    if (typeof window === 'undefined') return;

    // Remove existing notification
    const existing = document.getElementById('offline-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'offline-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(45deg, #ff8800, #ffaa00);
        color: black;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(255, 136, 0, 0.6);
        z-index: 9998;
        font-family: 'Press Start 2P', monospace;
        font-size: 10px;
        text-align: center;
        border: 2px solid #ffaa00;
        max-width: 400px;
        animation: pulse 2s infinite alternate;
      ">
        <div style="margin-bottom: 8px; font-size: 16px;">📶❌</div>
        <div style="margin-bottom: 5px; font-weight: bold;">OFFLINE MODE</div>
        <div style="font-size: 8px; opacity: 0.9;">${message}</div>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (document.getElementById('offline-notification')) {
        document.getElementById('offline-notification')?.remove();
      }
    }, 10000);
  }

  // Sync offline actions when connection is restored
  async syncOfflineActions(): Promise<boolean> {
    const actions = this.getOfflineActions();
    
    if (actions.submissions.length === 0 && actions.votes.length === 0) {
      console.log('No offline actions to sync');
      return true;
    }

    console.log('Syncing offline actions:', actions);

    try {
      // Sync submissions
      for (const submission of actions.submissions) {
        await fetch('/api/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roundNumber: parseInt(submission.phase.replace('round', '')),
            answer: submission.submission.answer,
            isOfflineSync: true
          })
        });
      }

      // Sync votes
      for (const vote of actions.votes) {
        await fetch('/api/vote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            predictions: vote.votes,
            isOfflineSync: true
          })
        });
      }

      // Clear synced actions
      this.clearOfflineActions();
      
      console.log('Successfully synced offline actions');
      return true;
    } catch (error) {
      console.error('Failed to sync offline actions:', error);
      return false;
    }
  }

  destroy() {
    this.stopLocalTimer();
    this.gameData = null;
  }
}