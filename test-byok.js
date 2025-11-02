#!/usr/bin/env node

// Test BYOK client functionality
import { BYOKClient, type BYOKSettings } from './pro/byok-client.ts';

async function testBYOKClient() {
  console.log('🧪 Testing BYOK Client...');
  
  // Test with Z.AI API (same as we used in backend)
  const byokSettings: BYOKSettings = {
    apiBase: 'https://api.z.ai/api/paas/v4',
    apiKey: 'cead729df8374268918c14db2bddb43e.bObIHNe6TwmTefrR',
    model: 'glm-4.6'
  };

  try {
    const response = await BYOKClient.makeRequest(
      {
        prompt: 'Please clean and structure this HTML content: <div><b>Hello</b> <i>World</i></div>',
        temperature: 0.3,
        maxTokens: 200
      },
      byokSettings,
      { requireExplicitConsent: false }
    );

    console.log('✅ BYOK Client Test Success!');
    console.log('📄 Response:', response.content.substring(0, 200) + '...');
    console.log('📊 Usage:', response.usage);
    
    return true;
  } catch (error) {
    console.error('❌ BYOK Client Test Failed:', error.message);
    return false;
  }
}

// Run the test
testBYOKClient().then(success => {
  process.exit(success ? 0 : 1);
});