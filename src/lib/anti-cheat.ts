// Anti-cheat console detection system - TEMPORARILY DISABLED
class AntiCheat {
  private isConsoleOpen = false;
  private onDetectionCallback?: (type: 'console' | 'devtools') => void;
  private originalConsole: {
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    info: (...args: any[]) => void;
  } | null = null;
  private detectionInterval?: NodeJS.Timeout;
  private resizeHandler?: () => void;
  private spookyMessages = [
    "💀 We see you watching... Stop.",
    "🔮 The game is watching YOU now...",
    "👻 Cheating detected. The spirits are angry.",
    "🌟 Nice try, but we're always watching.",
    "🔥 Console cowboys aren't welcome here.",
    "⚡ Your hacking attempts fuel our power.",
    "🧠 We live in your browser now.",
    "💻 Error 404: Fair play not found.",
    "🎮 Game over for cheaters.",
    "🚫 Access denied to rule breakers.",
    "🔒 Your actions have been logged.",
    "👁️ Big Browser is watching you.",
    "🌀 Reality.exe has stopped working.",
    "💀 You have been marked by the algorithm.",
    "🎭 The game plays you now."
  ];

  constructor(onDetection?: (type: 'console' | 'devtools') => void) {
    this.onDetectionCallback = onDetection;
    this.startDetection();
  }

  private startDetection() {
    // Advanced console detection methods
    this.setupDevToolsDetection();
    this.setupResizeDetection();
  }

  private setupDevToolsDetection() {
    // Store original console methods for safe internal use
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    // DevTools detection using debugger timing
    const detectDevTools = () => {
      const start = performance.now();
      debugger;
      const end = performance.now();
      
      // If DevTools is open, debugger statement causes a significant delay
      if (end - start > 100) {
        if (!this.isConsoleOpen) {
          this.isConsoleOpen = true;
          this.triggerDetection('devtools');
        }
      }
    };

    // Check every 2 seconds
    this.detectionInterval = setInterval(detectDevTools, 2000);
  }

  private setupResizeDetection() {
    // Detect DevTools opening by monitoring window resize events
    let initialWindowSize = { width: window.innerWidth, height: window.innerHeight };
    
    this.resizeHandler = () => {
      const currentSize = { width: window.innerWidth, height: window.innerHeight };
      
      // Significant size change might indicate DevTools opening
      const widthChange = Math.abs(currentSize.width - initialWindowSize.width);
      const heightChange = Math.abs(currentSize.height - initialWindowSize.height);
      
      if (widthChange > 200 || heightChange > 200) {
        if (!this.isConsoleOpen) {
          this.isConsoleOpen = true;
          this.triggerDetection('devtools');
        }
      }
      
      initialWindowSize = currentSize;
    };
    
    window.addEventListener('resize', this.resizeHandler);
  }



  private showSpookyMessage() {
    // Use original console methods to avoid recursion
    if (!this.originalConsole) return;

    const message = this.spookyMessages[Math.floor(Math.random() * this.spookyMessages.length)];
    
    // Style the console with spooky CSS
    const styles = [
      'background: linear-gradient(90deg, #ff0000, #800080, #000000)',
      'color: #ffffff',
      'font-size: 20px',
      'font-weight: bold',
      'padding: 10px',
      'text-shadow: 0 0 10px #ff0000',
      'border: 2px solid #ff0000',
      'border-radius: 10px',
      'animation: blink 1s infinite'
    ].join(';');

    this.originalConsole.log(`%c${message}`, styles);
    this.originalConsole.log('%c🚨 CHEATER DETECTED! Your actions are being monitored. 🚨', 
      'background: red; color: white; font-size: 16px; font-weight: bold; padding: 5px;');
    
    // Add some ASCII art
    this.originalConsole.log(`
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣤⣤⣤⣤⣤⣶⣦⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⡿⠛⠉⠙⠛⠛⠛⠛⠻⢿⣿⣷⣤⡀⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⣼⣿⠋⠀⠀⠀⠀⠀⠀⠀⢀⣀⣀⠈⢻⣿⣿⡄⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⣸⣿⡏⠀⠀⠀⣠⣶⣾⣿⣿⣿⠿⠿⠿⢿⣿⣿⣿⣄⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⣿⣿⠁⠀⠀⢰⣿⣿⣯⠁⠀⠀⠀⠀⠀⠀⠀⠈⠙⢿⣷⡄⠀
    ⠀⠀⣀⣤⣴⣶⣶⣿⡟⠀⠀⠀⢸⣿⣿⣿⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣷⠀
    ⠀⢰⣿⡟⠋⠉⣹⣿⡇⠀⠀⠀⠘⣿⣿⣿⣿⣷⣦⣤⣤⣤⣶⣶⣶⣶⣿⣿⣿⠀
    ⠀⢸⣿⡇⠀⠀⣿⣿⡇⠀⠀⠀⠀⠹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠀
    ⠀⣸⣿⡇⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠉⠻⠿⣿⣿⣿⣿⡿⠿⠿⠛⢻⣿⡇⠀⠀
    ⠀⣿⣿⠁⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣧⠀⠀
    ⠀⣿⣿⠀⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⠀⠀
    ⠀⣿⣿⠀⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⢀⣤⣄⣀⣀⣀⣀⠀⠀⠀⠀⢸⣿⣿⠀⠀
    ⠀⢿⣿⡆⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⡿⠇⠀⠀⠀⢸⣿⣿⠀⠀
    ⠀⠸⣿⣧⡀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠉⠻⠿⣿⡿⠟⠉⠀⠀⠀⢸⣿⠟⠀⠀
    ⠀⠀⠛⢿⣿⣿⣿⣿⣇⠀⠀⠀⠀⠀⣰⣿⣿⣷⣶⣶⣶⣶⠶⠀⢠⣿⣿⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⠀⣿⣿⡇⠀⣽⣿⡏⠁⠀⠀⢸⣿⡇⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⠀⣿⣿⡇⠀⢹⣿⡆⠀⠀⠀⣸⣿⠇⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⢿⣿⣦⣄⣀⣠⣴⣿⣿⠁⠀⠈⠻⣿⣿⣿⣿⡿⠏⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠈⠛⠻⠿⠿⠿⠿⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
    
         WE'RE WATCHING YOU CHEAT 👁️
    `);
  }

  private triggerDetection(type: 'console' | 'devtools') {
    this.showSpookyMessage();
    
    if (this.onDetectionCallback) {
      this.onDetectionCallback(type);
    }

    // Flash the screen red briefly
    document.body.style.transition = 'background-color 0.1s';
    document.body.style.backgroundColor = '#ff0000';
    
    setTimeout(() => {
      document.body.style.backgroundColor = '';
    }, 100);
  }

  public destroy() {
    // Clear the detection interval
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = undefined;
    }
    
    // Remove resize event listener
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }
  }
}

export default AntiCheat;