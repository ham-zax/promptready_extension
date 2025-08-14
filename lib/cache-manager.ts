// Professional-grade IndexedDB cache manager for persistent, high-performance caching
// Provides TTL support and handles large data efficiently without JSON serialization overhead

import { OfflineProcessingResult } from '../core/offline-mode-manager.js';

interface CacheEntry {
  key: string;
  value: OfflineProcessingResult;
  timestamp: number;
  ttlHours: number;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number; // Approximate size in bytes
  oldestEntry: number;
  newestEntry: number;
}

export class CacheManager {
  private static readonly DB_NAME = 'PromptReadyCache';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'processingResults';
  private static readonly MAX_ENTRIES = 100; // Prevent unlimited growth
  
  private static db: IDBDatabase | null = null;
  private static initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB connection
   */
  private static async init(): Promise<void> {
    if (this.db) return;
    
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('[CacheManager] Failed to open IndexedDB:', request.error);
        reject(new Error('Failed to initialize cache database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[CacheManager] IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store with key path
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
          
          // Create indexes for efficient querying
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('ttl', ['timestamp', 'ttlHours'], { unique: false });
          
          console.log('[CacheManager] Object store created with indexes');
        }
      };
    });

    await this.initPromise;
  }

  /**
   * Get cached result by key
   */
  static async get(key: string): Promise<OfflineProcessingResult | null> {
    try {
      await this.init();
      
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(key);

        request.onerror = () => {
          console.error('[CacheManager] Failed to get cache entry:', request.error);
          reject(new Error('Failed to retrieve cache entry'));
        };

        request.onsuccess = () => {
          const entry: CacheEntry | undefined = request.result;
          
          if (!entry) {
            resolve(null);
            return;
          }

          // Check if entry has expired
          const now = Date.now();
          const expiryTime = entry.timestamp + (entry.ttlHours * 60 * 60 * 1000);
          
          if (now > expiryTime) {
            console.log('[CacheManager] Cache entry expired, removing:', key);
            // Asynchronously remove expired entry
            this.delete(key).catch(console.error);
            resolve(null);
            return;
          }

          console.log('[CacheManager] Cache hit for key:', key);
          resolve(entry.value);
        };
      });
    } catch (error) {
      console.error('[CacheManager] Error getting cache entry:', error);
      return null;
    }
  }

  /**
   * Store result in cache with TTL
   */
  static async set(key: string, value: OfflineProcessingResult, ttlHours: number = 24): Promise<void> {
    try {
      await this.init();
      
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const entry: CacheEntry = {
        key,
        value,
        timestamp: Date.now(),
        ttlHours,
      };

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.put(entry);

        request.onerror = () => {
          console.error('[CacheManager] Failed to store cache entry:', request.error);
          reject(new Error('Failed to store cache entry'));
        };

        request.onsuccess = () => {
          console.log('[CacheManager] Cache entry stored:', key);
          resolve();
        };

        // Enforce cache size limit after successful write
        transaction.oncomplete = () => {
          this.enforceMaxEntries().catch(console.error);
        };
      });
    } catch (error) {
      console.error('[CacheManager] Error storing cache entry:', error);
      throw error;
    }
  }

  /**
   * Delete specific cache entry
   */
  static async delete(key: string): Promise<void> {
    try {
      await this.init();
      
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.delete(key);

        request.onerror = () => {
          console.error('[CacheManager] Failed to delete cache entry:', request.error);
          reject(new Error('Failed to delete cache entry'));
        };

        request.onsuccess = () => {
          console.log('[CacheManager] Cache entry deleted:', key);
          resolve();
        };
      });
    } catch (error) {
      console.error('[CacheManager] Error deleting cache entry:', error);
      throw error;
    }
  }

  /**
   * Clear all cache entries
   */
  static async clear(): Promise<void> {
    try {
      await this.init();
      
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.clear();

        request.onerror = () => {
          console.error('[CacheManager] Failed to clear cache:', request.error);
          reject(new Error('Failed to clear cache'));
        };

        request.onsuccess = () => {
          console.log('[CacheManager] Cache cleared successfully');
          resolve();
        };
      });
    } catch (error) {
      console.error('[CacheManager] Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  static async getStats(): Promise<CacheStats> {
    try {
      await this.init();
      
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.getAll();

        request.onerror = () => {
          console.error('[CacheManager] Failed to get cache stats:', request.error);
          reject(new Error('Failed to get cache statistics'));
        };

        request.onsuccess = () => {
          const entries: CacheEntry[] = request.result;
          
          if (entries.length === 0) {
            resolve({
              totalEntries: 0,
              totalSize: 0,
              oldestEntry: 0,
              newestEntry: 0,
            });
            return;
          }

          // Calculate statistics
          let totalSize = 0;
          let oldestEntry = entries[0].timestamp;
          let newestEntry = entries[0].timestamp;

          for (const entry of entries) {
            // Approximate size calculation
            totalSize += JSON.stringify(entry.value).length;
            oldestEntry = Math.min(oldestEntry, entry.timestamp);
            newestEntry = Math.max(newestEntry, entry.timestamp);
          }

          resolve({
            totalEntries: entries.length,
            totalSize,
            oldestEntry,
            newestEntry,
          });
        };
      });
    } catch (error) {
      console.error('[CacheManager] Error getting cache stats:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: 0,
        newestEntry: 0,
      };
    }
  }

  /**
   * Clean up expired entries
   */
  static async cleanupExpired(): Promise<number> {
    try {
      await this.init();
      
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.getAll();

        request.onerror = () => {
          console.error('[CacheManager] Failed to cleanup expired entries:', request.error);
          reject(new Error('Failed to cleanup expired entries'));
        };

        request.onsuccess = () => {
          const entries: CacheEntry[] = request.result;
          const now = Date.now();
          let deletedCount = 0;

          const deletePromises = entries
            .filter(entry => {
              const expiryTime = entry.timestamp + (entry.ttlHours * 60 * 60 * 1000);
              return now > expiryTime;
            })
            .map(entry => {
              deletedCount++;
              return store.delete(entry.key);
            });

          if (deletePromises.length === 0) {
            resolve(0);
            return;
          }

          Promise.all(deletePromises)
            .then(() => {
              console.log(`[CacheManager] Cleaned up ${deletedCount} expired entries`);
              resolve(deletedCount);
            })
            .catch(error => {
              console.error('[CacheManager] Error during cleanup:', error);
              reject(error);
            });
        };
      });
    } catch (error) {
      console.error('[CacheManager] Error cleaning up expired entries:', error);
      return 0;
    }
  }

  /**
   * Enforce maximum number of cache entries by removing oldest
   */
  private static async enforceMaxEntries(): Promise<void> {
    try {
      const stats = await this.getStats();
      
      if (stats.totalEntries <= this.MAX_ENTRIES) {
        return;
      }

      const entriesToRemove = stats.totalEntries - this.MAX_ENTRIES;
      
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const index = store.index('timestamp');
        const request = index.openCursor();

        let deletedCount = 0;

        request.onerror = () => {
          console.error('[CacheManager] Failed to enforce max entries:', request.error);
          reject(new Error('Failed to enforce cache size limit'));
        };

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor && deletedCount < entriesToRemove) {
            store.delete(cursor.primaryKey);
            deletedCount++;
            cursor.continue();
          } else {
            if (deletedCount > 0) {
              console.log(`[CacheManager] Removed ${deletedCount} oldest entries to enforce size limit`);
            }
            resolve();
          }
        };
      });
    } catch (error) {
      console.error('[CacheManager] Error enforcing max entries:', error);
    }
  }
}
