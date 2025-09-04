// Network Recovery Manager - Advanced error recovery and resilience
export interface NetworkError {
  type: 'timeout' | 'connection' | 'server' | 'client' | 'unknown';
  code?: string;
  message: string;
  timestamp: number;
  retryable: boolean;
}

export interface RecoveryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterRange: number;
}

export interface RecoveryOptions {
  strategy?: Partial<RecoveryStrategy>;
  onRetry?: (attempt: number, error: NetworkError) => void;
  onFailure?: (finalError: NetworkError, attempts: number) => void;
  onSuccess?: (attempts: number) => void;
}

export class NetworkRecoveryManager {
  private static instance: NetworkRecoveryManager;
  
  private defaultStrategy: RecoveryStrategy = {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitterRange: 0.2
  };

  private errorHistory: NetworkError[] = [];
  private readonly maxErrorHistory = 50;

  static getInstance(): NetworkRecoveryManager {
    if (!NetworkRecoveryManager.instance) {
      NetworkRecoveryManager.instance = new NetworkRecoveryManager();
    }
    return NetworkRecoveryManager.instance;
  }

  // Classify error type for appropriate recovery strategy
  classifyError(error: any): NetworkError {
    const timestamp = Date.now();
    let type: NetworkError['type'] = 'unknown';
    let retryable = true;
    let message = error.message || 'Unknown error';

    if (error.name === 'TypeError' && message.includes('fetch')) {
      type = 'connection';
    } else if (error.name === 'AbortError') {
      type = 'timeout';
    } else if (error.status) {
      if (error.status >= 500) {
        type = 'server';
      } else if (error.status >= 400 && error.status < 500) {
        type = 'client';
        retryable = error.status === 408 || error.status === 429; // Only retry timeouts and rate limits
      }
    }

    const networkError: NetworkError = {
      type,
      code: error.code || error.status?.toString(),
      message,
      timestamp,
      retryable
    };

    this.recordError(networkError);
    return networkError;
  }

  // Execute operation with recovery strategy
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    options: RecoveryOptions = {}
  ): Promise<T> {
    const strategy = { ...this.defaultStrategy, ...options.strategy };
    let lastError: NetworkError;
    
    for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 0 && options.onSuccess) {
          options.onSuccess(attempt);
        }
        
        return result;
      } catch (error) {
        lastError = this.classifyError(error);
        
        // Don't retry if error is not retryable
        if (!lastError.retryable) {
          break;
        }
        
        // Don't retry on final attempt
        if (attempt === strategy.maxRetries) {
          break;
        }
        
        if (options.onRetry) {
          options.onRetry(attempt + 1, lastError);
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, strategy);
        await this.sleep(delay);
      }
    }
    
    // All retries failed
    if (options.onFailure) {
      options.onFailure(lastError!, strategy.maxRetries + 1);
    }
    
    throw lastError!;
  }

  // Calculate delay with exponential backoff and jitter
  private calculateDelay(attempt: number, strategy: RecoveryStrategy): number {
    const baseDelay = strategy.baseDelay * Math.pow(strategy.backoffMultiplier, attempt);
    const cappedDelay = Math.min(baseDelay, strategy.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * strategy.jitterRange * (Math.random() * 2 - 1);
    return Math.max(0, cappedDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Record error for analysis
  private recordError(error: NetworkError): void {
    this.errorHistory.push(error);
    
    // Keep only recent errors
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory);
    }
  }

  // Analyze error patterns to suggest improvements
  getErrorAnalysis(timeWindowMs: number = 5 * 60 * 1000): {
    errorRate: number;
    commonErrors: Array<{ type: string; count: number; percentage: number }>;
    suggestions: string[];
  } {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentErrors = this.errorHistory.filter(e => e.timestamp > cutoffTime);
    
    if (recentErrors.length === 0) {
      return {
        errorRate: 0,
        commonErrors: [],
        suggestions: ['Connection appears stable']
      };
    }

    // Count error types
    const errorCounts: Record<string, number> = {};
    recentErrors.forEach(error => {
      errorCounts[error.type] = (errorCounts[error.type] || 0) + 1;
    });

    const total = recentErrors.length;
    const commonErrors = Object.entries(errorCounts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    // Generate suggestions based on error patterns
    const suggestions: string[] = [];
    
    if (errorCounts.timeout > total * 0.5) {
      suggestions.push('High timeout rate - consider increasing timeout values or checking network stability');
    }
    
    if (errorCounts.connection > total * 0.3) {
      suggestions.push('Frequent connection errors - network connectivity may be unstable');
    }
    
    if (errorCounts.server > total * 0.4) {
      suggestions.push('Server errors detected - backend service may be experiencing issues');
    }
    
    if (total > 10) {
      suggestions.push('High error rate detected - consider switching to offline mode');
    }

    return {
      errorRate: Math.round((total / (timeWindowMs / 1000)) * 100) / 100, // errors per second
      commonErrors,
      suggestions: suggestions.length > 0 ? suggestions : ['Monitor connection stability']
    };
  }

  // Create specialized recovery strategy for different scenarios
  createStrategy(scenario: 'realtime' | 'background' | 'critical' | 'bulk'): RecoveryStrategy {
    switch (scenario) {
      case 'realtime':
        return {
          maxRetries: 3,
          baseDelay: 500,
          maxDelay: 5000,
          backoffMultiplier: 1.5,
          jitterRange: 0.1
        };
        
      case 'background':
        return {
          maxRetries: 8,
          baseDelay: 2000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          jitterRange: 0.3
        };
        
      case 'critical':
        return {
          maxRetries: 10,
          baseDelay: 1000,
          maxDelay: 120000,
          backoffMultiplier: 2,
          jitterRange: 0.2
        };
        
      case 'bulk':
        return {
          maxRetries: 2,
          baseDelay: 5000,
          maxDelay: 30000,
          backoffMultiplier: 1.8,
          jitterRange: 0.4
        };
        
      default:
        return this.defaultStrategy;
    }
  }

  // Circuit breaker pattern implementation
  private circuitStates = new Map<string, {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    lastFailure: number;
    successes: number;
  }>();

  async executeWithCircuitBreaker<T>(
    operationId: string,
    operation: () => Promise<T>,
    failureThreshold: number = 5,
    recoveryTimeout: number = 60000
  ): Promise<T> {
    let circuit = this.circuitStates.get(operationId);
    
    if (!circuit) {
      circuit = {
        state: 'closed',
        failures: 0,
        lastFailure: 0,
        successes: 0
      };
      this.circuitStates.set(operationId, circuit);
    }

    // Check if circuit is open and should transition to half-open
    if (circuit.state === 'open' && Date.now() - circuit.lastFailure > recoveryTimeout) {
      circuit.state = 'half-open';
      circuit.successes = 0;
      console.log(`Circuit breaker for ${operationId} transitioning to half-open`);
    }

    // Fail fast if circuit is open
    if (circuit.state === 'open') {
      throw new Error(`Circuit breaker open for ${operationId} - operation blocked`);
    }

    try {
      const result = await operation();
      
      // Success - reset circuit if it was half-open
      if (circuit.state === 'half-open') {
        circuit.successes++;
        if (circuit.successes >= 3) {
          circuit.state = 'closed';
          circuit.failures = 0;
          console.log(`Circuit breaker for ${operationId} closed after successful recovery`);
        }
      } else if (circuit.state === 'closed') {
        circuit.failures = Math.max(0, circuit.failures - 1); // Gradually reduce failure count
      }
      
      return result;
    } catch (error) {
      circuit.failures++;
      circuit.lastFailure = Date.now();
      
      // Open circuit if threshold exceeded
      if (circuit.failures >= failureThreshold && circuit.state === 'closed') {
        circuit.state = 'open';
        console.warn(`Circuit breaker for ${operationId} opened after ${circuit.failures} failures`);
      } else if (circuit.state === 'half-open') {
        circuit.state = 'open';
        console.warn(`Circuit breaker for ${operationId} re-opened during half-open test`);
      }
      
      throw error;
    }
  }

  // Get circuit breaker status
  getCircuitStatus(operationId: string) {
    const circuit = this.circuitStates.get(operationId);
    return circuit ? { ...circuit } : null;
  }

  // Reset circuit breaker manually
  resetCircuit(operationId: string): void {
    const circuit = this.circuitStates.get(operationId);
    if (circuit) {
      circuit.state = 'closed';
      circuit.failures = 0;
      circuit.successes = 0;
      console.log(`Circuit breaker for ${operationId} manually reset`);
    }
  }
}

// Export singleton instance
export const networkRecovery = NetworkRecoveryManager.getInstance();