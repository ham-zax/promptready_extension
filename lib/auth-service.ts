// Centralized access control service for popup/runtime UI.

import { Storage } from './storage';
import { resolveEntitlements, type AILockReason } from './entitlement-policy.js';
import { getRuntimeProfile } from './runtime-profile.js';

export interface AuthState {
  isAuthenticated: boolean;
  isDeveloperMode: boolean;
  hasUnlimitedAccess: boolean;
  canUseAIMode: boolean;
  planType: 'developer' | 'free';
  hasApiKey: boolean;
  isUnlocked: boolean;
  remainingFreeByokUsesToday: number;
  remainingFreeByokStartsToday: number;
  aiLockReason: AILockReason;
}

export class AuthService {
  private static instance: AuthService;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async getAuthState(): Promise<AuthState> {
    try {
      const settings = await Storage.getSettings();
      const entitlements = resolveEntitlements(settings);

      let planType: AuthState['planType'] = 'free';
      if (entitlements.isDeveloperMode) {
        planType = 'developer';
      }

      return {
        isAuthenticated: true,
        isDeveloperMode: entitlements.isDeveloperMode,
        hasUnlimitedAccess: entitlements.hasUnlimitedAccess,
        canUseAIMode: entitlements.canUseAIMode,
        planType,
        hasApiKey: entitlements.hasApiKey,
        isUnlocked: entitlements.isUnlocked,
        remainingFreeByokUsesToday: entitlements.remainingFreeByokUsesToday,
        remainingFreeByokStartsToday: entitlements.remainingFreeByokStartsToday,
        aiLockReason: entitlements.aiLockReason,
      };
    } catch (error) {
      console.error('[AuthService] Failed to get auth state:', error);
      return this.getDefaultAuthState();
    }
  }

  private getDefaultAuthState(): AuthState {
    const profile = getRuntimeProfile();
    const devLike =
      profile.isDevelopment ||
      profile.openAccessEnabled ||
      profile.enforceDeveloperMode ||
      profile.premiumBypassEnabled;

    return {
      isAuthenticated: false,
      isDeveloperMode: devLike,
      hasUnlimitedAccess: devLike,
      canUseAIMode: devLike,
      planType: devLike ? 'developer' : 'free',
      hasApiKey: false,
      isUnlocked: devLike,
      remainingFreeByokUsesToday: devLike ? 999999 : 0,
      remainingFreeByokStartsToday: devLike ? 999999 : 0,
      aiLockReason: devLike ? null : 'missing_api_key',
    };
  }

  getPlanDisplayText(authState: AuthState): string {
    switch (authState.planType) {
      case 'developer':
        return 'Developer Mode';
      case 'free':
      default:
        return 'Free BYOK';
    }
  }

  getModeToggleProps(authState: AuthState) {
    const lockReason = authState.aiLockReason;
    const aiTooltip = !authState.canUseAIMode
      ? lockReason === 'missing_api_key'
        ? 'Add a BYOK API key to use AI mode.'
        : lockReason === 'daily_limit_reached'
          ? 'You have used 5 successful BYOK AI cleanups today. Try AI again tomorrow.'
          : 'AI mode is unavailable right now.'
      : undefined;

    return {
      aiDisabled: !authState.canUseAIMode,
      aiTooltip,
      showDevBadge: authState.isDeveloperMode,
    };
  }

  getUsageDisplayText(authState: AuthState): string {
    if (authState.isDeveloperMode) {
      return 'Developer bypass active';
    }

    if (authState.hasUnlimitedAccess) {
      return 'Developer bypass active';
    }

    if (!authState.hasApiKey) {
      return 'Add API key for AI mode';
    }

    return `${authState.remainingFreeByokUsesToday} successful BYOK AI cleanups left today`;
  }

  shouldShowDailyLimitPrompt(authState: AuthState): boolean {
    return (
      !authState.isDeveloperMode &&
      authState.aiLockReason === 'daily_limit_reached'
    );
  }
}

export const authService = AuthService.getInstance();
