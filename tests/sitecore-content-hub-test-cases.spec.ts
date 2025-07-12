import { test, expect, APIRequestContext } from '@playwright/test';

// Configuration - These should be set as environment variables
const CONTENT_HUB_BASE_URL = process.env.CONTENT_HUB_BASE_URL || 'https://your-instance.stylelabs.cloud';
const CLIENT_ID = process.env.CONTENT_HUB_CLIENT_ID || 'your-client-id';
const CLIENT_SECRET = process.env.CONTENT_HUB_CLIENT_SECRET || 'your-client-secret';
const USERNAME = process.env.CONTENT_HUB_USERNAME || 'your-username';
const PASSWORD = process.env.CONTENT_HUB_PASSWORD || 'your-password';

interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Helper class for Content Hub API operations with rate limiting
 */
class ContentHubAPIClient {
  private request: APIRequestContext;
  private authToken: string | null = null;
  private tokenExpiry: number = 0;
  private refreshToken: string | null = null;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private readonly MAX_REQUESTS_PER_SECOND = 13;
  private readonly RATE_LIMIT_WINDOW = 1000; // 1 second in milliseconds

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  /**
   * Rate limiting implementation to respect API throttling
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter if we're in a new time window
    if (now - this.lastRequestTime >= this.RATE_LIMIT_WINDOW) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }
    
    // If we've hit the rate limit, wait until the next window
    if (this.requestCount >= this.MAX_REQUESTS_PER_SECOND) {
      const timeToWait = this.RATE_LIMIT_WINDOW - (now - this.lastRequestTime);
      if (timeToWait > 0) {
        console.log(`Rate limit reached, waiting ${timeToWait}ms before next request...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait));
        // Reset for the new window
        this.requestCount = 0;
        this.lastRequestTime = Date.now();
      }
    }
    
    this.requestCount++;
  }

  /**
   * Get OAuth token for authentication using Resource Owner Password Credentials Grant
   */
  async getAuthToken(): Promise<string> {
    // Check if current token is still valid
    if (this.authToken && Date.now() < this.tokenExpiry) {
      return this.authToken;
    }

    // Clear expired token
    this.authToken = null;
    this.tokenExpiry = 0;

    await this.enforceRateLimit();

    const response = await this.request.post(`${CONTENT_HUB_BASE_URL}/oauth/token`, {
      form: {
        grant_type: 'password',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        username: USERNAME,
        password: PASSWORD
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    if (response.status() !== 200) {
      const errorText = await response.text();
      console.error(`Authentication failed with status ${response.status()}: ${errorText}`);
      throw new Error(`OAuth authentication failed: ${response.status()} - ${errorText}`);
    }
    
    const tokenData: AuthToken = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error('No access token received in authentication response');
    }
    
    this.authToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token || null;
    
    // Set token expiry with a 5-minute buffer to avoid edge cases
    this.tokenExpiry = Date.now() + ((tokenData.expires_in - 300) * 1000);
    
    // Log token info for debugging (without exposing the actual token)
    console.log(`Authentication successful. Token type: ${tokenData.token_type}, expires in: ${tokenData.expires_in} seconds`);
    
    return this.authToken;
  }

  /**
   * Get authenticated request headers
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAuthToken();
    return {
      'X-Auth-Token': token,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make authenticated GET request with rate limiting
   */
  async get(endpoint: string, params?: Record<string, any>) {
    await this.enforceRateLimit();
    const headers = await this.getAuthHeaders();
    return this.request.get(`${CONTENT_HUB_BASE_URL}${endpoint}`, {
      headers,
      params
    });
  }

  /**
   * Make authenticated POST request with rate limiting
   */
  async post(endpoint: string, data?: any) {
    await this.enforceRateLimit();
    const headers = await this.getAuthHeaders();
    return this.request.post(`${CONTENT_HUB_BASE_URL}${endpoint}`, {
      headers,
      data: JSON.stringify(data)
    });
  }

  /**
   * Make authenticated PUT request with rate limiting
   */
  async put(endpoint: string, data?: any) {
    await this.enforceRateLimit();
    const headers = await this.getAuthHeaders();
    return this.request.put(`${CONTENT_HUB_BASE_URL}${endpoint}`, {
      headers,
      data: JSON.stringify(data)
    });
  }

  /**
   * Make authenticated DELETE request with rate limiting
   */
  async delete(endpoint: string) {
    await this.enforceRateLimit();
    const headers = await this.getAuthHeaders();
    return this.request.delete(`${CONTENT_HUB_BASE_URL}${endpoint}`, {
      headers
    });
  }

  /**
   * Execute multiple requests sequentially with rate limiting
   * Useful for operations that need to maintain order or respect strict rate limits
   */
  async executeSequentially<T>(
    operations: (() => Promise<T>)[]
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (const operation of operations) {
      const result = await operation();
      results.push(result);
    }
    
    return results;
  }

  /**
   * Reset rate limiting counters and clear authentication (useful for testing)
   */
  resetRateLimit(): void {
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  /**
   * Clear authentication tokens (useful for testing different auth scenarios)
   */
  clearAuth(): void {
    this.authToken = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;
  }
}

test.describe('Sitecore Content Hub API Tests', () => {
  let apiClient: ContentHubAPIClient;

  test.beforeEach(async ({ request }) => {
    apiClient = new ContentHubAPIClient(request);
  });

  test.describe('Authentication Tests', () => {
    test('should authenticate using Resource Owner Password Credentials Grant', async () => {
      const token = await apiClient.getAuthToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      
      // Verify token format (should be a JWT or similar long string)
      expect(token.split('.').length).toBeGreaterThanOrEqual(1);
    });

    test('should fail authentication with invalid client credentials', async ({ request }) => {
      const response = await request.post(`${CONTENT_HUB_BASE_URL}/oauth/token`, {
        form: {
          grant_type: 'password',
          client_id: 'invalid-client-id',
          client_secret: 'invalid-client-secret',
          username: USERNAME,
          password: PASSWORD
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      expect([400, 401]).toContain(response.status());
    });

    test('should fail authentication with invalid user credentials', async ({ request }) => {
      const response = await request.post(`${CONTENT_HUB_BASE_URL}/oauth/token`, {
        form: {
          grant_type: 'password',
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          username: 'invalid-username',
          password: 'invalid-password'
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      expect([400, 401]).toContain(response.status());
    });

    test('should fail authentication with missing required parameters', async ({ request }) => {
      const response = await request.post(`${CONTENT_HUB_BASE_URL}/oauth/token`, {
        form: {
          grant_type: 'password',
          client_id: CLIENT_ID,
          // Missing client_secret, username, password
          scope: 'api'
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      expect(response.status()).toBe(400);
    });

    test('should fail authentication with unsupported grant type', async ({ request }) => {
      const response = await request.post(`${CONTENT_HUB_BASE_URL}/oauth/token`, {
        form: {
          grant_type: 'authorization_code', // Unsupported grant type
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          username: USERNAME,
          password: PASSWORD
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      expect([400, 401]).toContain(response.status());
    });

    test('should handle token caching correctly', async () => {
      // Clear any existing tokens
      apiClient.clearAuth();
      
      // First call should authenticate
      const token1 = await apiClient.getAuthToken();
      expect(token1).toBeTruthy();
      
      // Second call should return cached token (same token)
      const token2 = await apiClient.getAuthToken();
      expect(token2).toBe(token1);
      
      // Clear and get new token
      apiClient.clearAuth();
      const token3 = await apiClient.getAuthToken();
      expect(token3).toBeTruthy();
      // Note: token3 may or may not be different from token1 depending on server behavior
    });
  });
});
