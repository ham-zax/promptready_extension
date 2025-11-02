// API Key Validation Service
// Real-time validation for different AI providers

export interface ValidationRequest {
  provider: 'openrouter' | 'manual' | 'z.ai';
  apiKey: string;
  apiBase: string;
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
  details?: {
    model?: string;
    balance?: string;
    organization?: string;
  };
}

// OpenRouter validation
export async function validateOpenRouter(apiKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          isValid: false,
          message: 'Invalid API key. Please check your OpenRouter key.',
        };
      }
      if (response.status === 403) {
        return {
          isValid: false,
          message: 'API key does not have required permissions.',
        };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data: any = await response.json();
    return {
      isValid: true,
      message: `✅ Valid OpenRouter key. Balance: ${data.data?.balance || 'Unknown'}`,
      details: {
        balance: data.data?.balance,
        organization: data.data?.organization,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      return {
        isValid: false,
        message: 'Network error. Please check your internet connection.',
      };
    }
    return {
      isValid: false,
      message: 'Failed to validate OpenRouter key. Please try again.',
    };
  }
}

// OpenAI/Manual validation
export async function validateOpenAI(apiKey: string, apiBase: string): Promise<ValidationResult> {
  try {
    // Test with models endpoint (lightweight)
    const response = await fetch(`${apiBase}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          isValid: false,
          message: 'Invalid API key. Please check your OpenAI-compatible key.',
        };
      }
      if (response.status === 403) {
        return {
          isValid: false,
          message: 'API key does not have required permissions.',
        };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    // Try to get a specific model to ensure full access
    const modelsData: any = await response.json();
    const hasGpt4 = modelsData.data?.some((model: any) =>
      model.id.includes('gpt-4') || model.id.includes('gpt-3.5')
    );

    if (!hasGpt4) {
      return {
        isValid: false,
        message: 'API key valid but no compatible models found.',
      };
    }

    return {
      isValid: true,
      message: '✅ Valid OpenAI-compatible API key',
      details: {
        model: 'OpenAI Compatible',
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      return {
        isValid: false,
        message: 'Network error. Please check your internet connection and API URL.',
      };
    }
    if (error instanceof Error && error.message.includes('ERR_NAME_NOT_RESOLVED')) {
      return {
        isValid: false,
        message: 'Invalid API base URL. Please check the server address.',
      };
    }
    return {
      isValid: false,
      message: 'Failed to validate API key. Please check the URL and key.',
    };
  }
}

// Z.AI validation (mock for now, replace with actual implementation)
export async function validateZAI(apiKey: string): Promise<ValidationResult> {
  try {
    // Since Z.AI is your service, implement proper validation
    const response = await fetch('https://api.z.ai/api/coding/paas/v4/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          isValid: false,
          message: 'Invalid Z.AI API key.',
        };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      isValid: true,
      message: '✅ Valid Z.AI API key',
      details: {
        model: 'z.ai-flash',
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      return {
        isValid: false,
        message: 'Network error. Please check your internet connection.',
      };
    }
    return {
      isValid: false,
      message: 'Failed to validate Z.AI key. Please try again.',
    };
  }
}

// Main validation function
export async function validateApiKey(request: ValidationRequest): Promise<ValidationResult> {
  const { provider, apiKey, apiBase } = request;

  if (!apiKey || apiKey.trim().length === 0) {
    return {
      isValid: false,
      message: 'Please enter an API key',
    };
  }

  // Basic key format validation
  if (provider === 'openrouter' && !apiKey.startsWith('sk-or-v1-')) {
    return {
      isValid: false,
      message: 'OpenRouter keys should start with "sk-or-v1-"',
    };
  }

  if (provider === 'manual' && !apiKey.startsWith('sk-')) {
    return {
      isValid: false,
      message: 'OpenAI-compatible keys should start with "sk-"',
    };
  }

  if (provider === 'manual' && (!apiBase || !isValidUrl(apiBase))) {
    return {
      isValid: false,
      message: 'Please enter a valid API base URL',
    };
  }

  // Provider-specific validation
  switch (provider) {
    case 'openrouter':
      return validateOpenRouter(apiKey);
    case 'manual':
      return validateOpenAI(apiKey, apiBase);
    case 'z.ai':
      return validateZAI(apiKey);
    default:
      return {
        isValid: false,
        message: 'Unknown provider',
      };
  }
}

// Helper function for URL validation
function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Debounced validation for real-time feedback
export function createDebouncedValidator(
  validator: (request: ValidationRequest) => Promise<ValidationResult>,
  delay: number = 500
) {
  let timeoutId: NodeJS.Timeout;

  return (request: ValidationRequest): Promise<ValidationResult> => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          const result = await validator(request);
          resolve(result);
        } catch (error) {
          resolve({
            isValid: false,
            message: 'Validation failed. Please try again.',
          });
        }
      }, delay);
    });
  };
}

// Export debounced version
export const debouncedValidateApiKey = createDebouncedValidator(validateApiKey);