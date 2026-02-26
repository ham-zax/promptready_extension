// API Key Validation Service
// Real-time validation for different AI providers

export interface ValidationRequest {
  provider: 'openrouter';
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

// Main validation function
export async function validateApiKey(request: ValidationRequest): Promise<ValidationResult> {
  const { provider, apiKey, apiBase } = request;

  if (provider !== 'openrouter') {
    return {
      isValid: false,
      message: 'Only OpenRouter BYOK is supported right now.',
    };
  }

  if (!apiKey || apiKey.trim().length === 0) {
    return {
      isValid: false,
      message: 'Please enter an API key',
    };
  }

  // Basic key format validation
  if (!apiKey.startsWith('sk-or-v1-')) {
    return {
      isValid: false,
      message: 'OpenRouter keys should start with "sk-or-v1-"',
    };
  }

  if (!apiBase || !isValidUrl(apiBase)) {
    return {
      isValid: false,
      message: 'Please enter a valid OpenRouter API base URL',
    };
  }

  return validateOpenRouter(apiKey);
}

// Helper function for URL validation
function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Debounced validation for real-time feedback
export function createDebouncedValidator(
  validator: (request: ValidationRequest) => Promise<ValidationResult>,
  delay: number = 500
) {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (request: ValidationRequest): Promise<ValidationResult> => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          const result = await validator(request);
          resolve(result);
        } catch {
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
