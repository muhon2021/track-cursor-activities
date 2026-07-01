/**
 * Environment Variable Validator
 *
 * Validates that required environment variables are present at app startup.
 * This helps developers quickly identify missing configuration.
 */

interface EnvConfig {
  required: string[];
  optional: string[];
}

interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

const ENV_CONFIG: EnvConfig = {
  required: [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY'
  ],
  optional: [
    'VITE_SUPABASE_PROJECT_ID',
    'VITE_MICROSOFT_CLIENT_ID',
    'VITE_MICROSOFT_DIRECTORY_ID',
    'VITE_MICROSOFT_REDIRECT_URI',
    'VITE_MICROSOFT_LOGOUT_URI'
  ]
};

/**
 * Validates the current environment configuration
 * @returns ValidationResult with status and details
 */
export function validateEnvironment(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  ENV_CONFIG.required.forEach(key => {
    const value = import.meta.env[key];
    if (!value || value === '' || value.includes('YOUR_PROJECT_ID') || value.includes('your-anon-key-here')) {
      missing.push(key);
    }
  });

  // Check optional variables for placeholder values
  ENV_CONFIG.optional.forEach(key => {
    const value = import.meta.env[key];
    if (value && (value.includes('YOUR_PROJECT_ID') || value.includes('your-'))) {
      warnings.push(`${key} still has placeholder value`);
    }
  });

  const valid = missing.length === 0;

  // Log results to console
  if (!valid) {
    console.error('❌ Environment validation failed!');
    console.error('Missing required environment variables:', missing);
    console.error('\n📝 To fix this:');
    console.error('1. Copy .env.example to .env');
    console.error('2. Replace YOUR_PROJECT_ID with your Supabase project ID');
    console.error('3. Replace your-anon-key-here with your Supabase anon key');
    console.error('4. Get these values from: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api');
  } else {
    console.log('✅ Environment variables validated successfully');
    if (warnings.length > 0) {
      console.warn('⚠️  Warnings:', warnings);
    }
  }

  return { valid, missing, warnings };
}

/**
 * Gets a user-friendly error message for missing environment variables
 */
export function getEnvironmentErrorMessage(missing: string[]): string {
  return `
Missing required environment variables: ${missing.join(', ')}

To fix this:
1. Copy .env.example to .env
2. Replace YOUR_PROJECT_ID with your Supabase project ID
3. Replace placeholder values with your actual Supabase credentials
4. Get these values from: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api

For remixing this project:
- Create a new Supabase project at https://supabase.com
- Copy the project URL and anon key to your .env file
- Restart the development server
  `.trim();
}

/**
 * Checks if we're in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

/**
 * Checks if we're in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}
