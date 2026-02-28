// Centralized access control service for popup/runtime UI.

import { Storage } from './storage';
import { resolveEntitlements, type AILockReason } from './entitlement-policy.js';
import { getRuntimeProfile } from './runtime-profile.js';

export interface AuthState {
  isAuthenticated: boolean;
  isDeveloperMode: boolean;
  hasUnlimitedAccess: boolean;
  canUseAIMode: boolean;
  planType: 'developer' | 'unlocked' | 'free';
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
      } else if (entitlements.hasUnlimitedAccess || entitlements.isUnlocked) {
        planType = 'unlocked';
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
      case 'unlocked':
        return 'Unlocked Unlimited';
      case 'free':
      default:
        return 'Free';
    }
  }

  getModeToggleProps(authState: AuthState) {
    const lockReason = authState.aiLockReason;
    const aiTooltip = !authState.canUseAIMode
      ? lockReason === 'missing_api_key'
        ? 'Add an OpenRouter API key to use AI mode.'
        : lockReason === 'daily_limit_reached'
          ? 'Free daily AI limit reached. Enter an unlock code or go to checkout.'
          : 'AI mode is unavailable right now.'
      : undefined;

    return {
      aiDisabled: !authState.canUseAIMode,
      aiTooltip,
      showUnlockBadge: authState.planType === 'unlocked' && !authState.isDeveloperMode,
      showDevBadge: authState.isDeveloperMode,
    };
  }

  getUsageDisplayText(authState: AuthState): string {
    if (authState.isDeveloperMode) {
      return 'Unlimited (Developer)';
    }

    if (authState.hasUnlimitedAccess || authState.isUnlocked) {
      return 'Unlimited AI uses';
    }

    if (!authState.hasApiKey) {
      return 'Add API key for AI mode';
    }

    return `${authState.remainingFreeByokUsesToday} free uses left today`;
  }

  shouldShowUnlockPrompt(authState: AuthState): boolean {
    return (
      !authState.isDeveloperMode &&
      authState.aiLockReason === 'daily_limit_reached' &&
      !authState.isUnlocked
    );
  }
}

export const authService = AuthService.getInstance();
