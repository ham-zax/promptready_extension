// Pro Management Hook
// Focused hook for managing Pro subscriptions and trials

import { useState, useCallback, useEffect } from 'react';
import { Storage } from '@/lib/storage';
import { MonetizationClient } from '@/pro/mock-monetization-client';
import type { Settings } from '@/lib/types';

export interface ProState {
  isPro: boolean;
  isInTrial: boolean;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  daysRemaining: number;
  showUpgradePrompt: boolean;
  isProcessing: boolean;
  processingMessage: string;
}

export interface ProActions {
  startTrial: (email: string) => Promise<void>;
  upgradeToPro: (email: string) => Promise<void>;
  checkTrialStatus: () => Promise<void>;
  cancelTrial: () => Promise<void>;
  hideUpgradePrompt: () => Promise<void>;
  showUpgradePromptAction: () => Promise<void>;
}

export function useProManager(): ProState & ProActions {
  const [state, setState] = useState<ProState>({
    isPro: false,
    isInTrial: false,
    daysRemaining: 0,
    showUpgradePrompt: false,
    isProcessing: false,
    processingMessage: '',
  });

  // Load initial state and check trial status
  useEffect(() => {
    const loadAndCheck = async () => {
      try {
        const settings = await Storage.getSettings();
        const trial = settings.trial || {};
        const isPro = settings.isPro || false;
        const isInTrial = Boolean(trial.startedAt && trial.expiresAt);
        const daysRemaining = isInTrial
          ? Math.max(0, Math.ceil((new Date(trial.expiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0;

        setState(prev => ({
          ...prev,
          isPro,
          isInTrial,
          trialStartedAt: trial.startedAt,
          trialExpiresAt: trial.expiresAt,
          daysRemaining,
          showUpgradePrompt: trial.showUpgradePrompt || false,
        }));

        // Check if trial has expired
        if (isInTrial && daysRemaining <= 0) {
          await handleTrialExpiry();
        }
      } catch (error) {
        console.error('Failed to load Pro status:', error);
      }
    };

    loadAndCheck();

    // Check trial status every hour
    const interval = setInterval(loadAndCheck, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTrialExpiry = useCallback(async () => {
    try {
      await Storage.updateSettings({
        isPro: false,
        trial: {
          hasExhausted: true,
          showUpgradePrompt: true,
        },
      });

      setState(prev => ({
        ...prev,
        isPro: false,
        isInTrial: false,
        daysRemaining: 0,
        showUpgradePrompt: true,
      }));
    } catch (error) {
      console.error('Failed to handle trial expiry:', error);
    }
  }, []);

  const startTrial = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) {
      throw new Error('Valid email address required');
    }

    setState(prev => ({
      ...prev,
      isProcessing: true,
      processingMessage: 'Starting your free trial...',
    }));

    try {
      // In real implementation, this would call payment processor
      const trialStarted = await MonetizationClient.startTrial(email);

      if (!trialStarted.success) {
        throw new Error(trialStarted.error || 'Failed to start trial');
      }

      const trialData = {
        hasExhausted: false,
        showUpgradePrompt: false,
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      };

      await Storage.updateSettings({
        isPro: true,
        trial: trialData,
        user: { email },
      });

      setState(prev => ({
        ...prev,
        isPro: true,
        isInTrial: true,
        trialStartedAt: trialData.startedAt,
        trialExpiresAt: trialData.expiresAt,
        daysRemaining: 7,
        showUpgradePrompt: false,
        isProcessing: false,
        processingMessage: '',
      }));

      return trialData;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        processingMessage: '',
      }));
      throw error;
    }
  }, []);

  const upgradeToPro = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) {
      throw new Error('Valid email address required');
    }

    setState(prev => ({
      ...prev,
      isProcessing: true,
      processingMessage: 'Processing your upgrade...',
    }));

    try {
      // In real implementation, this would integrate with Stripe/other payment provider
      const upgradeResult = await MonetizationClient.createSubscription(email);

      if (!upgradeResult.success) {
        throw new Error(upgradeResult.error || 'Failed to process upgrade');
      }

      await Storage.updateSettings({
        isPro: true,
        trial: { hasExhausted: false, showUpgradePrompt: false },
        user: { email },
      });

      setState(prev => ({
        ...prev,
        isPro: true,
        isInTrial: false,
        daysRemaining: -1, // Unlimited
        showUpgradePrompt: false,
        isProcessing: false,
        processingMessage: '',
      }));

      return upgradeResult;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        processingMessage: '',
      }));
      throw error;
    }
  }, []);

  const checkTrialStatus = useCallback(async () => {
    try {
      const settings = await Storage.getSettings();
      const trial = settings.trial || {};

      if (trial.expiresAt) {
        const daysRemaining = Math.max(0, Math.ceil((new Date(trial.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

        setState(prev => ({
          ...prev,
          daysRemaining,
          isInTrial: daysRemaining > 0,
        }));

        if (daysRemaining <= 0 && state.isInTrial) {
          await handleTrialExpiry();
        }
      }
    } catch (error) {
      console.error('Failed to check trial status:', error);
    }
  }, [state.isInTrial, handleTrialExpiry]);

  const cancelTrial = useCallback(async () => {
    try {
      await Storage.updateSettings({
        isPro: false,
        trial: { hasExhausted: true, showUpgradePrompt: false },
      });

      setState(prev => ({
        ...prev,
        isPro: false,
        isInTrial: false,
        daysRemaining: 0,
        showUpgradePrompt: false,
      }));
    } catch (error) {
      console.error('Failed to cancel trial:', error);
      throw error;
    }
  }, []);

  const hideUpgradePrompt = useCallback(async () => {
    try {
      await Storage.updateSettings({
        trial: { ...state, showUpgradePrompt: false },
      });

      setState(prev => ({
        ...prev,
        showUpgradePrompt: false,
      }));
    } catch (error) {
      console.error('Failed to hide upgrade prompt:', error);
      throw error;
    }
  }, []);

  const showUpgradePromptAction = useCallback(async () => {
    try {
      await Storage.updateSettings({
        trial: { ...state, showUpgradePrompt: true },
      });

      setState(prev => ({
        ...prev,
        showUpgradePrompt: true,
      }));
    } catch (error) {
      console.error('Failed to show upgrade prompt:', error);
      throw error;
    }
  }, []);

  return {
    ...state,
    startTrial,
    upgradeToPro,
    checkTrialStatus,
    cancelTrial,
    hideUpgradePrompt,
    showUpgradePromptAction,
  };
}