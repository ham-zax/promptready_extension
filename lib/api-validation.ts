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

  // Local format validation only; actual key verification happens via proxy on first AI request.
  return {
    isValid: true,
    message: 'Key format looks valid. It will be verified on first AI request.',
  };
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
