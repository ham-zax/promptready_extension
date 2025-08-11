# PromptReady Chrome Extension - Offline Implementation Details

## Introduction

This document provides detailed implementation instructions for adding offline capabilities to the PromptReady Chrome extension. It builds upon the high-level plan outlined in `offline_capabilities.md` and provides specific code examples and file structures.

## Project Structure Updates

We'll need to add the following files and directories to the existing project structure:

```
prompready/
├── lib/
│   ├── storage/
│   │   ├── StorageManager.ts       # Main storage orchestration
│   │   ├── IndexedDBStorage.ts     # IndexedDB implementation
│   │   ├── ChromeStorage.ts        # Chrome Storage API wrapper
│   │   └── CloudStorage.ts         # Remote storage implementation
│   ├── sync/
│   │   ├── SyncManager.ts          # Sync orchestration
│   │   ├── ConflictResolver.ts     # Conflict resolution strategies
│   │   └── SyncQueue.ts            # Queue for pending sync operations
│   └── utils/
│       ├── ConnectionMonitor.ts    # Network status monitoring
│       └── Logger.ts               # Logging utility
├── entrypoints/
│   ├── background.ts               # Updated with offline support
│   ├── content.ts                  # Updated with offline support
│   ├── sw.ts                       # Service Worker for offline caching
│   └── popup/
│       ├── components/
│       │   ├── OfflineIndicator.tsx # Offline status indicator
│       │   └── SyncStatus.tsx       # Sync status component
│       └── hooks/
│           └── useOfflineStatus.ts  # React hook for offline status
└── types/
    └── storage.d.ts                # Type definitions for storage
```

## Implementation Details

### 1. Storage Implementation

#### `lib/storage/StorageManager.ts`

```typescript
import { IndexedDBStorage } from './IndexedDBStorage';
import { ChromeStorage } from './ChromeStorage';
import { CloudStorage } from './CloudStorage';
import { ConnectionMonitor } from '../utils/ConnectionMonitor';

export class StorageManager {
  private indexedDB: IndexedDBStorage;
  private chromeStorage: ChromeStorage;
  private cloudStorage: CloudStorage;
  private connectionMonitor: ConnectionMonitor;
  private isOnlineState: boolean;

  constructor() {
    this.indexedDB = new IndexedDBStorage();
    this.chromeStorage = new ChromeStorage();
    this.cloudStorage = new CloudStorage();
    this.connectionMonitor = new ConnectionMonitor();
    this.isOnlineState = navigator.onLine;
    
    // Listen for online/offline events
    this.connectionMonitor.addListener((online) => {
      this.isOnlineState = online;
      if (online) {
        this.syncWithCloud().catch(err => console.error('Sync failed:', err));
      }
    });
  }

  public isOnline(): boolean {
    return this.isOnlineState;
  }

  public async store(key: string, data: any): Promise<void> {
    // Always store locally
    await this.indexedDB.set(key, {
      ...data,
      updated_at: new Date().toISOString(),
      pending_sync: true
    });

    // If online, also store in cloud
    if (this.isOnline()) {
      try {
        await this.cloudStorage.set(key, data);
        // Mark as synced
        await this.indexedDB.set(key, {
          ...data,
          pending_sync: false,
          last_synced_at: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to sync to cloud:', error);
        // Will be synced later when online
      }
    }
  }

  public async retrieve(key: string): Promise<any> {
    try {
      // Try to get from cloud if online
      if (this.isOnline()) {
        try {
          const cloudData = await this.cloudStorage.get(key);
          // Update local cache
          await this.indexedDB.set(key, {
            ...cloudData,
            last_synced_at: new Date().toISOString(),
            pending_sync: false
          });
          return cloudData;
        } catch (error) {
          console.warn('Failed to retrieve from cloud, falling back to local:', error);
          // Fall back to local data
        }
      }
      
      // Get from local storage
      return await this.indexedDB.get(key);
    } catch (error) {
      console.error('Failed to retrieve data:', error);
      throw error;
    }
  }

  public async syncWithCloud(): Promise<SyncResult> {
    if (!this.isOnline()) {
      return { success: false, message: 'Offline, cannot sync' };
    }

    try {
      // Get all items pending sync
      const pendingItems = await this.indexedDB.getPendingSync();
      
      const results = {
        success: true,
        synced: 0,
        failed: 0,
        conflicts: 0
      };

      // Process each pending item
      for (const item of pendingItems) {
        try {
          // Check for conflicts
          const cloudItem = await this.cloudStorage.get(item.key);
          
          if (cloudItem && new Date(cloudItem.updated_at) > new Date(item.last_synced_at)) {
            // Conflict detected
            const resolved = this.resolveConflicts(item, cloudItem);
            await this.cloudStorage.set(item.key, resolved);
            await this.indexedDB.set(item.key, {
              ...resolved,
              pending_sync: false,
              last_synced_at: new Date().toISOString()
            });
            results.conflicts++;
          } else {
            // No conflict, just sync
            await this.cloudStorage.set(item.key, item);
            await this.indexedDB.set(item.key, {
              ...item,
              pending_sync: false,
              last_synced_at: new Date().toISOString()
            });
            results.synced++;
          }
        } catch (error) {
          console.error(`Failed to sync item ${item.key}:`, error);
          results.failed++;
        }
      }

      results.success = results.failed === 0;
      return results;
    } catch (error) {
      console.error('Sync failed:', error);
      return { success: false, message: error.message };
    }
  }

  private resolveConflicts(localData: any, remoteData: any): any {
    // Default strategy: newest wins
    if (new Date(localData.updated_at) > new Date(remoteData.updated_at)) {
      return localData;
    } else {
      return remoteData;
    }
    
    // Note: In a real implementation, you might want to:
    // 1. Merge the data when possible
    // 2. Store both versions and let the user decide
    // 3. Use a more sophisticated conflict resolution strategy
  }
}

interface SyncResult {
  success: boolean;
  message?: string;
  synced?: number;
  failed?: number;
  conflicts?: number;
}
```

#### `lib/storage/IndexedDBStorage.ts`

```typescript
export class IndexedDBStorage {
  private dbName = 'promptready';
  private dbVersion = 1;
  private storeName = 'prompts';
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        reject('IndexedDB error: ' + request.error);
      };

      request.onsuccess = (event) => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('pending_sync', 'pending_sync', { unique: false });
          store.createIndex('updated_at', 'updated_at', { unique: false });
        }
      };
    });
  }

  public async set(key: string, value: any): Promise<void> {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ key, ...value });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  public async get(key: string): Promise<any> {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  public async getPendingSync(): Promise<any[]> {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('pending_sync');
      const request = index.getAll(IDBKeyRange.only(true));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  private async ensureDB(): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }
  }
}
```

### 2. Service Worker Implementation

#### `entrypoints/sw.ts`

```typescript
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Cache static assets
registerRoute(
  ({ request }) => [
    'style', 'script', 'font', 'image'
  ].includes(request.destination),
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache API responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-responses',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  })
);

// Handle background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-prompts') {
    event.waitUntil(syncPrompts());
  }
});

async function syncPrompts() {
  const clients = await self.clients.matchAll();
  if (clients.length > 0) {
    clients[0].postMessage({
      type: 'SYNC_REQUIRED'
    });
  }
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

### 3. Background Script Updates

#### `entrypoints/background.ts`

```typescript
import { StorageManager } from '../lib/storage/StorageManager';

export default defineBackground(() => {
  console.log('Background script initialized', { id: browser.runtime.id });
  
  // Initialize storage manager
  const storageManager = new StorageManager();
  
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  }
  
  // Listen for messages from popup or content script
  browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message.type === 'STORE_PROMPT') {
      try {
        await storageManager.store(message.key, message.data);
        return { success: true };
      } catch (error) {
        console.error('Failed to store prompt:', error);
        return { success: false, error: error.message };
      }
    }
    
    if (message.type === 'GET_PROMPT') {
      try {
        const data = await storageManager.retrieve(message.key);
        return { success: true, data };
      } catch (error) {
        console.error('Failed to retrieve prompt:', error);
        return { success: false, error: error.message };
      }
    }
    
    if (message.type === 'SYNC_NOW') {
      try {
        const result = await storageManager.syncWithCloud();
        return { success: true, result };
      } catch (error) {
        console.error('Failed to sync with cloud:', error);
        return { success: false, error: error.message };
      }
    }
  });
  
  // Register for periodic sync if available
  if ('periodicSync' in navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(registration => {
      registration.periodicSync.register('sync-prompts', {
        minInterval: 60 * 60 * 1000, // Once per hour
      });
    });
  }
});
```

### 4. UI Components

#### `entrypoints/popup/components/OfflineIndicator.tsx`

```tsx
import { useOfflineStatus } from '../hooks/useOfflineStatus';

export const OfflineIndicator = () => {
  const isOffline = useOfflineStatus();
  
  if (!isOffline) return null;
  
  return (
    <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-2 flex items-center">
      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>You're working offline. Changes will sync when you reconnect.</span>
    </div>
  );
};
```

#### `entrypoints/popup/hooks/useOfflineStatus.ts`

```typescript
import { useState, useEffect } from 'react';

export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Listen for messages from the service worker
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'OFFLINE_STATUS_CHANGE') {
        setIsOffline(event.data.isOffline);
      }
    });
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOffline;
}
```

## Configuration Updates

### Update `wxt.config.ts`

```typescript
import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: [
      "storage",
      "unlimitedStorage", // For IndexedDB
      "background",
      "alarms",          // For periodic sync
    ],
    // For service worker
    background: {
      service_worker: "entrypoints/sw.ts",
      type: "module"
    }
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
  }),
});
```

## Additional Dependencies

Add these to `package.json`:

```json
{
  "dependencies": {
    "workbox-routing": "^7.0.0",
    "workbox-strategies": "^7.0.0",
    "workbox-expiration": "^7.0.0",
    "workbox-precaching": "^7.0.0",
    "idb": "^7.1.1"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.246"
  }
}
```

## Implementation Strategy

1. **Phase 1: Basic Offline Storage**
   - Implement IndexedDB storage
   - Add offline status detection
   - Create UI indicators

2. **Phase 2: Service Worker & Caching**
   - Implement service worker
   - Set up asset caching
   - Add offline fallbacks

3. **Phase 3: Synchronization**
   - Implement cloud sync
   - Add conflict resolution
   - Create background sync

4. **Phase 4: Testing & Refinement**
   - Test across various network conditions
   - Optimize performance
   - Add user settings for sync behavior

## Testing Plan

1. **Unit Tests**
   - Test storage operations in isolation
   - Test conflict resolution strategies
   - Test network status detection

2. **Integration Tests**
   - Test full sync cycle
   - Test offline to online transition
   - Test concurrent modifications

3. **Manual Tests**
   - Test with network throttling
   - Test with network disconnection
   - Test with large data sets

## Conclusion

This implementation plan provides a comprehensive approach to adding offline capabilities to the PromptReady Chrome extension. By following this guide, you'll create a robust offline experience that allows users to continue working with their prompts even when disconnected from the internet.