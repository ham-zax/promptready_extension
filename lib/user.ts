
import { browser } from 'wxt/browser';

export async function getUserId(): Promise<string> {
  try {
    // Check if browser APIs are available
    if (typeof browser === 'undefined' || !browser.identity) {
      console.warn('[User] Browser identity not available, using fallback');
      return crypto.randomUUID();
    }
    
    const userInfo = await browser.identity.getProfileUserInfo({ accountStatus: 'ANY' });
    if (userInfo && userInfo.id) {
      return userInfo.id;
    } else {
      // Fallback to a randomly generated ID and store it in local storage
      let userId = (await browser.storage.local.get('userId')).userId;
      if (!userId) {
        userId = crypto.randomUUID();
        await browser.storage.local.set({ userId });
      }
      return userId;
    }
  } catch (error) {
    console.error('Error getting user ID:', error);
    // Fallback to a randomly generated ID
    return crypto.randomUUID();
  }
}
