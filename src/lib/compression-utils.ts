// Compression and bandwidth optimization utilities
export interface CompressionOptions {
  minifyJson?: boolean;
  removeNulls?: boolean;
  removeEmptyArrays?: boolean;
  removeEmptyObjects?: boolean;
  compressIds?: boolean;
  optimizeNumbers?: boolean;
}

export class CompressionUtils {
  private static idMap = new Map<string, string>();
  private static reverseIdMap = new Map<string, string>();
  private static idCounter = 0;

  // Compress JSON response data
  static compressResponse<T>(data: T, options: CompressionOptions = {}): T {
    const {
      minifyJson = true,
      removeNulls = true,
      removeEmptyArrays = true,
      removeEmptyObjects = true,
      compressIds = false,
      optimizeNumbers = true
    } = options;

    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      const compressed = data
        .map(item => this.compressResponse(item, options))
        .filter(item => {
          if (removeNulls && (item === null || item === undefined)) return false;
          if (removeEmptyArrays && Array.isArray(item) && item.length === 0) return false;
          if (removeEmptyObjects && typeof item === 'object' && Object.keys(item).length === 0) return false;
          return true;
        });
      
      return compressed as T;
    }

    if (typeof data === 'object' && data !== null) {
      const compressed: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Skip null/undefined values if removeNulls is true
        if (removeNulls && (value === null || value === undefined)) {
          continue;
        }

        // Skip empty arrays if removeEmptyArrays is true
        if (removeEmptyArrays && Array.isArray(value) && value.length === 0) {
          continue;
        }

        // Skip empty objects if removeEmptyObjects is true
        if (removeEmptyObjects && typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) {
          continue;
        }

        // Compress IDs if enabled
        let compressedKey = key;
        let compressedValue = this.compressResponse(value, options);

        if (compressIds && key.endsWith('Id') && typeof compressedValue === 'string') {
          compressedValue = this.compressId(compressedValue);
        }

        // Optimize numbers
        if (optimizeNumbers && typeof compressedValue === 'number') {
          // Round to reasonable precision for timestamps and IDs
          if (key.includes('Time') || key.includes('At')) {
            compressedValue = Math.round(compressedValue);
          } else if (key.includes('latency') || key.includes('Latency')) {
            compressedValue = Math.round(compressedValue);
          }
        }

        compressed[compressedKey] = compressedValue;
      }

      return compressed as T;
    }

    return data;
  }

  // Decompress JSON response data
  static decompressResponse<T>(data: T, options: CompressionOptions = {}): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.decompressResponse(item, options)) as T;
    }

    if (typeof data === 'object' && data !== null) {
      const decompressed: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        let decompressedValue = this.decompressResponse(value, options);

        // Decompress IDs if they were compressed
        if (options.compressIds && key.endsWith('Id') && typeof decompressedValue === 'string') {
          decompressedValue = this.decompressId(decompressedValue);
        }

        decompressed[key] = decompressedValue;
      }

      return decompressed as T;
    }

    return data;
  }

  // Compress long IDs to shorter strings
  private static compressId(id: string): string {
    if (this.idMap.has(id)) {
      return this.idMap.get(id)!;
    }

    const compressed = `c${this.idCounter.toString(36)}`;
    this.idMap.set(id, compressed);
    this.reverseIdMap.set(compressed, id);
    this.idCounter++;
    
    return compressed;
  }

  // Decompress short IDs back to original strings
  private static decompressId(compressed: string): string {
    return this.reverseIdMap.get(compressed) || compressed;
  }

  // Optimize SSE event data
  static optimizeSSEEvent(event: string, data: any): { event: string; data: string } {
    // Remove redundant fields for specific event types
    let optimizedData = { ...data };

    switch (event) {
      case 'heartbeat':
        // Only keep essential heartbeat data
        optimizedData = {
          ts: data.timestamp || data.serverTime,
          up: data.uptime,
          ch: data.connectionHealth,
          id: data.connectionId
        };
        break;

      case 'timer_update':
        // Compress timer updates
        optimizedData = {
          p: data.phase,
          tl: data.timeLeft,
          end: data.phaseEndTime
        };
        break;

      case 'game_state':
        // Remove null players and optimize structure
        if (data.gameState?.players) {
          optimizedData.gameState.players = data.gameState.players.filter((p: any) => p !== null);
        }
        break;
    }

    return {
      event,
      data: JSON.stringify(optimizedData)
    };
  }

  // Calculate compression ratio
  static getCompressionRatio(original: any, compressed: any): number {
    const originalSize = JSON.stringify(original).length;
    const compressedSize = JSON.stringify(compressed).length;
    
    return originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0;
  }

  // Batch multiple small events into one
  static batchEvents(events: Array<{ event: string; data: any }>): { event: string; data: string } {
    if (events.length === 1) {
      return this.optimizeSSEEvent(events[0].event, events[0].data);
    }

    const batchedData = {
      batch: true,
      events: events.map(e => ({
        t: e.event,
        d: e.data
      }))
    };

    return {
      event: 'batch',
      data: JSON.stringify(batchedData)
    };
  }

  // Smart data filtering based on connection quality
  static filterByConnectionQuality(data: any, quality: 'excellent' | 'good' | 'poor' | 'critical'): any {
    switch (quality) {
      case 'critical':
        // Send only essential data
        return {
          gameState: {
            currentPhase: data.gameState?.currentPhase,
            players: data.gameState?.players?.length || 0
          },
          playerRole: data.playerRole,
          timeLeft: data.timeLeft
        };

      case 'poor':
        // Reduce non-essential fields
        return {
          ...data,
          networkStats: undefined,
          detailedTimestamps: undefined
        };

      case 'good':
        // Minor optimizations
        return this.compressResponse(data, {
          removeNulls: true,
          removeEmptyArrays: true,
          optimizeNumbers: true
        });

      case 'excellent':
      default:
        // Full data with minor compression
        return this.compressResponse(data, {
          removeNulls: true,
          optimizeNumbers: true
        });
    }
  }

  // Clear compression caches periodically
  static clearCaches(): void {
    this.idMap.clear();
    this.reverseIdMap.clear();
    this.idCounter = 0;
    console.log('Compression caches cleared');
  }

  // Get cache statistics
  static getCacheStats() {
    return {
      idMappings: this.idMap.size,
      nextId: this.idCounter,
      memoryUsage: JSON.stringify([...this.idMap.entries()]).length
    };
  }
}

// Auto-clear cache every 30 minutes to prevent memory leaks
if (typeof window !== 'undefined') {
  setInterval(() => {
    CompressionUtils.clearCaches();
  }, 30 * 60 * 1000);
}