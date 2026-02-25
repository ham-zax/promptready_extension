// Centralized authentication and access control service
// Replaces scattered isPro checks and inconsistent Pro/Free messaging

import { Storage } from './storage';
import { resolveEntitlements } from './entitlement-policy.js';
import { getRuntimeProfile } from './runtime-profile.js';

export interface AuthState {
  isAuthenticated: boolean;
  isDeveloperMode: boolean;
  hasUnlimitedAccess: boolean;
  canUseAIMode: boolean;
  planType: 'developer' | 'pro' | 'free';
  remainingCredits: number;
  hasApiKey: boolean;
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
      const isDeveloperMode = entitlements.isDeveloperMode;
      const hasApiKey = entitlements.hasApiKey;
      const remainingCredits = entitlements.credits.remaining || 0;
      
      // Determine plan type and access level
      let planType: AuthState['planType'];
      let hasUnlimitedAccess: boolean;
      
      if (isDeveloperMode) {
        planType = 'developer';
        hasUnlimitedAccess = true;
      } else if (hasApiKey) {
        planType = 'pro';
        hasUnlimitedAccess = true;
      } else {
        planType = 'free';
        hasUnlimitedAccess = entitlements.hasUnlimitedAccess;
      }
      
      const canUseAIMode = entitlements.flags.aiModeEnabled && (isDeveloperMode || hasApiKey || remainingCredits > 0);
      
      return {
        isAuthenticated: true, // Always authenticated once settings are loaded
        isDeveloperMode,
        hasUnlimitedAccess,
        canUseAIMode,
        planType,
        remainingCredits,
        hasApiKey
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
      remainingCredits: devLike ? 999999 : 0,
      hasApiKey: false
    };
  }

  // UI Helper methods
  getPlanDisplayText(authState: AuthState): string {
    switch (authState.planType) {
      case 'developer':
        return 'Developer Mode';
      case 'pro':
        return 'Pro (BYOK)';
      case 'free':
        return 'Free';
      default:
        return 'Unknown';
    }
  }

  getModeToggleProps(authState: AuthState) {
    return {
      aiDisabled: !authState.canUseAIMode,
      aiTooltip: authState.canUseAIMode 
        ? undefined 
        : authState.planType === 'free' 
          ? 'AI Mode requires credits or API key'
          : 'AI Mode is temporarily unavailable',
      showProBadge: authState.planType === 'pro' && !authState.isDeveloperMode,
      showDevBadge: authState.isDeveloperMode
    };
  }

  getCreditDisplayText(authState: AuthState): string {
    if (authState.isDeveloperMode) {
      return 'Unlimited (Developer)';
    } else if (authState.hasUnlimitedAccess) {
      return 'Unlimited';
    } else {
      return `${authState.remainingCredits} credits`;
    }
  }

  shouldShowUpgradePrompt(authState: AuthState): boolean {
    return !authState.isDeveloperMode && 
           authState.planType === 'free' && 
           authState.remainingCredits === 0;
  }

  shouldShowCreditExhaustion(authState: AuthState): boolean {
    return !authState.isDeveloperMode && 
           authState.remainingCredits === 0 && 
           !authState.hasApiKey;
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
