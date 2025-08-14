import { beforeAll } from 'vitest';

// Minimal mock for wxt/browser storage used in lib/storage
const memoryLocal: Record<string, any> = {};
const memorySession: Record<string, any> = {};

// @ts-ignore
globalThis.browser = {
  storage: {
    local: {
      async get(keys: string[] | Record<string, any>) {
        if (Array.isArray(keys)) {
          const out: Record<string, any> = {};
          for (const k of keys) out[k] = memoryLocal[k];
          return out;
        }
        return { ...memoryLocal };
      },
      async set(obj: Record<string, any>) {
        Object.assign(memoryLocal, obj);
      },
      async remove(keys: string[] | string) {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) delete memoryLocal[k];
      },
      async clear() {
        for (const k of Object.keys(memoryLocal)) delete memoryLocal[k];
      },
    },
    session: {
      async get(keys: string[] | Record<string, any>) {
        if (Array.isArray(keys)) {
          const out: Record<string, any> = {};
          for (const k of keys) out[k] = memorySession[k];
          return out;
        }
        return { ...memorySession };
      },
      async set(obj: Record<string, any>) {
        Object.assign(memorySession, obj);
      },
      async remove(keys: string[] | string) {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) delete memorySession[k];
      },
      async clear() {
        for (const k of Object.keys(memorySession)) delete memorySession[k];
      },
    },
  },
};

// Ensure DOMParser is available globally in tests using jsdom
// Some environments expose it on window only
// @ts-ignore
if (typeof globalThis.DOMParser === 'undefined' && typeof window !== 'undefined' && (window as any).DOMParser) {
  // @ts-ignore
  globalThis.DOMParser = (window as any).DOMParser;
}

beforeAll(() => {
  // Nothing for now; placeholder for future setup
});

