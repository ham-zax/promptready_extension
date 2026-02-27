import { MonetizationClient as OriginalMonetizationClient } from './monetization-client';

let credits = 150;

export const MonetizationClient = {
  ...OriginalMonetizationClient,
  checkCredits: async (userId: string): Promise<{ balance: number }> => {
    console.log('MOCK: checkCredits called for user:', userId);
    return Promise.resolve({ balance: credits });
  },
  useCredits: async (userId: string, amount: number): Promise<{ success: boolean; newBalance: number }> => {
    console.log('MOCK: useCredits called for user:', userId, 'amount:', amount);
    if (credits >= amount) {
      credits -= amount;
      return Promise.resolve({ success: true, newBalance: credits });
    }
    return Promise.resolve({ success: false, newBalance: credits });
  },
  startTrial: async (email: string): Promise<{ success: boolean; error?: string }> => {
    console.log('MOCK: startTrial called for email:', email);
    return Promise.resolve({ success: true });
  },
  createSubscription: async (email: string): Promise<{ success: boolean; error?: string }> => {
    console.log('MOCK: createSubscription called for email:', email);
    return Promise.resolve({ success: true });
  },
};