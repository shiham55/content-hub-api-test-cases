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
  scope: string;
}

/**
 * Helper class for Content Hub API operations with rate limiting
 */
class ContentHubAPIClient {
  private request: APIRequestContext;
  private authToken: string | null = null;
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
   * Get OAuth token for authentication with rate limiting
   */
  async getAuthToken(): Promise<string> {
    if (this.authToken) {
      return this.authToken;
    }

    await this.enforceRateLimit();

    const response = await this.request.post(`${CONTENT_HUB_BASE_URL}/oauth/token`, {
      form: {
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        username: USERNAME,
        password: PASSWORD,
        scope: 'api' // Adjust scope as needed
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    expect(response.status()).toBe(200);
    
    const tokenData: AuthToken = await response.json();
    this.authToken = tokenData.access_token;
    
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
   * Reset rate limiting counters (useful for testing)
   */
  resetRateLimit(): void {
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }
}

test.describe('Sitecore Content Hub API Tests', () => {
  let apiClient: ContentHubAPIClient;

  test.beforeEach(async ({ request }) => {
    apiClient = new ContentHubAPIClient(request);
  });

  test.describe('Authentication Tests', () => {
    test('should authenticate and get OAuth token', async () => {
      const token = await apiClient.getAuthToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    test('should fail authentication with invalid credentials', async ({ request }) => {
      const response = await request.post(`${CONTENT_HUB_BASE_URL}/oauth/token`, {
        form: {
          grant_type: 'client_credentials',
          client_id: 'invalid-client',
          client_secret: 'invalid-secret',
          username: 'invalid-user',
          password: 'invalid-password',
          scope: 'api'
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      expect(response.status()).toBe(400);
    });
  });
});
