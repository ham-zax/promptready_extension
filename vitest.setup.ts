import '@testing-library/jest-dom/vitest';
import { beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';

// Polyfill DOMParser for tests running in Node
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
globalThis.document = dom.window.document;


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

beforeAll(() => {
  // Nothing for now; placeholder for future setup
});
