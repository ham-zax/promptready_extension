// Centralized authentication and access control service
// Replaces scattered isPro checks and inconsistent Pro/Free messaging

import { Storage } from './storage';
import type { Settings } from './types';

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
      const flags = settings.flags || {};
      
      const isDeveloperMode = Boolean(flags.developerMode);
      const hasApiKey = Boolean(settings.byok?.apiKey);
      const remainingCredits = settings.credits?.remaining || 0;
      
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
        hasUnlimitedAccess = false;
      }
      
      const canUseAIMode = isDeveloperMode || hasApiKey || remainingCredits > 0;
      
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
    return {
      isAuthenticated: false,
      isDeveloperMode: true, // Default to developer mode for safety
      hasUnlimitedAccess: true,
      canUseAIMode: true,
      planType: 'developer',
      remainingCredits: 999999,
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