
import { browser } from 'wxt/browser';

export async function getUserId(): Promise<string> {
  try {
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
    // Fallback to a randomly generated ID and store it in local storage
    let userId = (await browser.storage.local.get('userId')).userId;
    if (!userId) {
      userId = crypto.randomUUID();
      await browser.storage.local.set({ userId });
    }
    return userId;
  }
}
