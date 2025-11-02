import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  // Base JavaScript rules
  js.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        alert: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        cancelIdleCallback: 'readonly',
        addEventListener: 'readonly',
        removeEventListener: 'readonly',
        URL: 'readonly',
        Request: 'readonly',
        AbortController: 'readonly',
        DOMParser: 'readonly',
        TextEncoder: 'readonly',
        crypto: 'readonly',
        location: 'readonly',
        Event: 'readonly',
        Node: 'readonly',
        NodeFilter: 'readonly',
        chrome: 'readonly',
        browser: 'readonly',
        performance: 'readonly',
        // Web API types
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLTableElement: 'readonly',
        Element: 'readonly',
        Document: 'readonly',
        KeyboardEvent: 'readonly',
        // WXT globals
        defineBackground: 'readonly',
        defineContentScript: 'readonly',
        // Fetch API
        fetch: 'readonly',
        // Types
        ProcessingProgressMessage: 'readonly',
        ProcessingErrorMessage: 'readonly',
        MonetizationClient: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // TypeScript rules
      ...typescript.configs.recommended.rules,

      // React rules
      ...react.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not needed for React 17+
      'react/prop-types': 'off', // Using TypeScript for prop validation

      // React Hooks rules
      ...reactHooks.configs.recommended.rules,

      // React Refresh rules for HMR
      ...reactRefresh.configs.recommended.rules,

      // Additional rules for Chrome extension compatibility
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off', // Console is often used in extension development
      'no-alert': 'off', // Alert is used in browser extensions
      'no-case-declarations': 'warn', // Allow case block declarations with caution
      'no-empty': 'warn', // Allow empty blocks with warning
      'no-control-regex': 'off', // Allow control characters in regex for parsing
      'no-class-assign': 'error',
      'no-cond-assign': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Ignore build outputs, dependencies, and temporary files
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      '.wxt/**',
      'output/**',
      '.output/**',
      '.wrangler/**',
      '*.config.js',
      '*.config.ts',
      '**/*.d.ts',
    ],
  },
]