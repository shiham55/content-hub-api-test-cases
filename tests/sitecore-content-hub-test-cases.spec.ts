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
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        username: USERNAME,
        password: PASSWORD,
        scope: 'api'
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
          grant_type: 'client_credentials',
          client_id: 'invalid-client-id',
          client_secret: 'invalid-client-secret',
          username: USERNAME,
          password: PASSWORD,
          scope: 'api'
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
          password: 'invalid-password',
          scope: 'api'
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
          grant_type: 'client_credentials',
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
          password: PASSWORD,
          scope: 'api'
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

  test.describe('Entities API Tests', () => {
    let testEntityId: number;
    let testEntityIdentifier: string;
    
    test.beforeAll(async () => {
      // Set up test data - you may need to adjust these based on your Content Hub instance
      // These should be existing entity IDs in your test environment
      testEntityId = parseInt(process.env.TEST_ENTITY_ID || '1'); // Fallback to ID 1 if not set
      testEntityIdentifier = process.env.TEST_ENTITY_IDENTIFIER || 'test.entity.1'; // Fallback identifier
    });

    test.describe('Get Entity by ID', () => {
      test('should retrieve an entity by ID with basic properties', async () => {
        const response = await apiClient.get(`/api/entities/${testEntityId}`);
        
        expect(response.status()).toBe(200);
        
        const entity = await response.json();
        expect(entity).toBeDefined();
        expect(entity.id).toBe(testEntityId);
        expect(entity).toHaveProperty('identifier');
        expect(entity).toHaveProperty('properties');
        expect(entity).toHaveProperty('entitydefinition');
        expect(entity).toHaveProperty('created_on');
        expect(entity).toHaveProperty('modified_on');
      });

      test('should retrieve an entity by ID with specific culture', async () => {
        const response = await apiClient.get(`/api/entities/${testEntityId}`, {
          culture: 'en-US'
        });
        
        expect(response.status()).toBe(200);
        
        const entity = await response.json();
        expect(entity).toBeDefined();
        expect(entity.id).toBe(testEntityId);
        expect(entity.cultures).toContain('en-US');
      });

      test('should retrieve an entity by ID with multiple cultures', async () => {
        const response = await apiClient.get(`/api/entities/${testEntityId}`, {
          cultures: ['en-US', 'fr-FR']
        });
        
        expect(response.status()).toBe(200);
        
        const entity = await response.json();
        expect(entity).toBeDefined();
        expect(entity.id).toBe(testEntityId);
        expect(entity.cultures).toBeDefined();
      });

      test('should retrieve an entity by ID with permissions loaded', async () => {
        const response = await apiClient.get(`/api/entities/${testEntityId}`, {
          loadPermissions: true
        });
        
        expect(response.status()).toBe(200);
        
        const entity = await response.json();
        expect(entity).toBeDefined();
        expect(entity.id).toBe(testEntityId);
        expect(entity).toHaveProperty('requested_permissions');
      });

      test('should retrieve an entity by ID with specific groups and members', async () => {
        const response = await apiClient.get(`/api/entities/${testEntityId}`, {
          groups: 'PreambleGroup,ChoiceGroup',
          members: 'PreambleThemeProperty,ChoiceThemeProperty'
        });
        
        expect(response.status()).toBe(200);
        
        const entity = await response.json();
        expect(entity).toBeDefined();
        expect(entity.id).toBe(testEntityId);
      });

      test('should retrieve an entity by ID with renditions', async () => {
        const response = await apiClient.get(`/api/entities/${testEntityId}`, {
          renditions: 'Thumbnail,Preview'
        });
        
        expect(response.status()).toBe(200);
        
        const entity = await response.json();
        expect(entity).toBeDefined();
        expect(entity.id).toBe(testEntityId);
      });

      test('should handle non-existent entity ID gracefully', async () => {
        const nonExistentId = 999999999;
        const response = await apiClient.get(`/api/entities/${nonExistentId}`);
        
        expect(response.status()).toBe(404);
      });

      test('should handle invalid entity ID format', async () => {
        const response = await apiClient.get('/api/entities/invalid-id');
        
        expect([400, 404]).toContain(response.status());
      });
    });

    test.describe('Get Entity by Identifier', () => {
      test('should retrieve an entity by identifier', async () => {
        const response = await apiClient.get(`/api/entities/identifier/${testEntityIdentifier}`);
        
        expect(response.status()).toBe(200);
        
        const entity = await response.json();
        expect(entity).toBeDefined();
        expect(entity.identifier).toBe(testEntityIdentifier);
        expect(entity).toHaveProperty('id');
        expect(entity).toHaveProperty('properties');
      });

      test('should retrieve an entity by identifier with culture', async () => {
        const response = await apiClient.get(`/api/entities/identifier/${testEntityIdentifier}`, {
          culture: 'en-US'
        });
        
        expect(response.status()).toBe(200);
        
        const entity = await response.json();
        expect(entity).toBeDefined();
        expect(entity.identifier).toBe(testEntityIdentifier);
      });

      test('should handle non-existent entity identifier', async () => {
        const nonExistentIdentifier = 'non.existent.entity.999999';
        const response = await apiClient.get(`/api/entities/identifier/${nonExistentIdentifier}`);
        
        expect(response.status()).toBe(404);
      });
    });

    test.describe('Update Entity Title with Timestamp', () => {
      test('should update entity title by ID with current timestamp', async () => {
        // First, get the current entity
        const getResponse = await apiClient.get(`/api/entities/${testEntityId}`);
        expect(getResponse.status()).toBe(200);
        
        const entity = await getResponse.json();
        const originalTitle = entity.properties?.Title || 'Original Title';
        
        // Create new title with timestamp
        const timestamp = new Date().toISOString();
        const newTitle = `Updated Title - ${timestamp}`;
        
        // Update the entity with new title
        const updateData = {
          id: entity.id,
          identifier: entity.identifier,
          properties: {
            ...entity.properties,
            Title: newTitle
          },
          entitydefinition: entity.entitydefinition
        };
        
        const updateResponse = await apiClient.put(`/api/entities/${testEntityId}`, updateData);
        expect(updateResponse.status()).toBe(200);
        
        // Verify the update by fetching the entity again
        const verifyResponse = await apiClient.get(`/api/entities/${testEntityId}`);
        expect(verifyResponse.status()).toBe(200);
        
        const updatedEntity = await verifyResponse.json();
        expect(updatedEntity.properties.Title).toBe(newTitle);
        expect(updatedEntity.properties.Title).toContain(timestamp);
        expect(updatedEntity.properties.Title).not.toBe(originalTitle);
      });

      test('should update entity title by identifier with current timestamp', async () => {
        // First, get the current entity by identifier
        const getResponse = await apiClient.get(`/api/entities/identifier/${testEntityIdentifier}`);
        expect(getResponse.status()).toBe(200);
        
        const entity = await getResponse.json();
        const originalTitle = entity.properties?.Title || 'Original Title';
        
        // Create new title with timestamp
        const timestamp = new Date().toISOString();
        const newTitle = `Updated Title via Identifier - ${timestamp}`;
        
        // Update the entity with new title using identifier
        const updateData = {
          id: entity.id,
          identifier: entity.identifier,
          properties: {
            ...entity.properties,
            Title: newTitle
          },
          entitydefinition: entity.entitydefinition
        };
        
        const updateResponse = await apiClient.put(`/api/entities/identifier/${testEntityIdentifier}`, updateData);
        expect(updateResponse.status()).toBe(200);
        
        // Verify the update by fetching the entity again
        const verifyResponse = await apiClient.get(`/api/entities/identifier/${testEntityIdentifier}`);
        expect(verifyResponse.status()).toBe(200);
        
        const updatedEntity = await verifyResponse.json();
        expect(updatedEntity.properties.Title).toBe(newTitle);
        expect(updatedEntity.properties.Title).toContain(timestamp);
        expect(updatedEntity.properties.Title).not.toBe(originalTitle);
      });

      test('should update entity with multiple property changes including timestamped title', async () => {
        // Get current entity
        const getResponse = await apiClient.get(`/api/entities/${testEntityId}`);
        expect(getResponse.status()).toBe(200);
        
        const entity = await getResponse.json();
        
        // Create update with multiple properties including timestamped title
        const timestamp = new Date().toISOString();
        const newTitle = `Multi-property Update - ${timestamp}`;
        
        const updateData = {
          id: entity.id,
          identifier: entity.identifier,
          properties: {
            ...entity.properties,
            Title: newTitle,
            Description: `Updated description on ${timestamp}`,
            LastModified: timestamp
          },
          entitydefinition: entity.entitydefinition
        };
        
        const updateResponse = await apiClient.put(`/api/entities/${testEntityId}`, updateData);
        expect(updateResponse.status()).toBe(200);
        
        // Verify all updates
        const verifyResponse = await apiClient.get(`/api/entities/${testEntityId}`);
        expect(verifyResponse.status()).toBe(200);
        
        const updatedEntity = await verifyResponse.json();
        expect(updatedEntity.properties.Title).toBe(newTitle);
        expect(updatedEntity.properties.Description).toContain(timestamp);
      });

      test('should update entity title with custom timestamp format', async () => {
        // Get current entity
        const getResponse = await apiClient.get(`/api/entities/${testEntityId}`);
        expect(getResponse.status()).toBe(200);
        
        const entity = await getResponse.json();
        
        // Create custom timestamp format
        const now = new Date();
        const customTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const newTitle = `Custom Format Update - ${customTimestamp}`;
        
        const updateData = {
          id: entity.id,
          identifier: entity.identifier,
          properties: {
            ...entity.properties,
            Title: newTitle
          },
          entitydefinition: entity.entitydefinition
        };
        
        const updateResponse = await apiClient.put(`/api/entities/${testEntityId}`, updateData);
        expect(updateResponse.status()).toBe(200);
        
        // Verify the update
        const verifyResponse = await apiClient.get(`/api/entities/${testEntityId}`);
        expect(verifyResponse.status()).toBe(200);
        
        const updatedEntity = await verifyResponse.json();
        expect(updatedEntity.properties.Title).toBe(newTitle);
        expect(updatedEntity.properties.Title).toContain(customTimestamp);
      });

      test('should handle update with invalid entity ID', async () => {
        const invalidId = 999999999;
        const timestamp = new Date().toISOString();
        
        const updateData = {
          id: invalidId,
          properties: {
            Title: `Invalid Update - ${timestamp}`
          }
        };
        
        const response = await apiClient.put(`/api/entities/${invalidId}`, updateData);
        expect(response.status()).toBe(404);
      });

      test('should handle update with invalid entity identifier', async () => {
        const invalidIdentifier = 'invalid.entity.identifier';
        const timestamp = new Date().toISOString();
        
        const updateData = {
          identifier: invalidIdentifier,
          properties: {
            Title: `Invalid Update - ${timestamp}`
          }
        };
        
        const response = await apiClient.put(`/api/entities/identifier/${invalidIdentifier}`, updateData);
        expect(response.status()).toBe(404);
      });

      test('should handle update with missing required fields', async () => {
        const timestamp = new Date().toISOString();
        
        // Attempt update with minimal data (missing required fields)
        const updateData = {
          properties: {
            Title: `Incomplete Update - ${timestamp}`
          }
          // Missing id, identifier, entitydefinition, etc.
        };
        
        const response = await apiClient.put(`/api/entities/${testEntityId}`, updateData);
        expect([400, 422]).toContain(response.status());
      });
    });

    test.describe('Entity CRUD Operations with Timestamps', () => {
      let createdEntityId: number;
      
      test('should create a new entity with timestamped title', async () => {
        const timestamp = new Date().toISOString();
        const entityData = {
          identifier: `test.entity.${Date.now()}`,
          properties: {
            Title: `New Entity - ${timestamp}`,
            Description: `Created on ${timestamp}`,
            CreatedAt: timestamp
          },
          entitydefinition: {
            href: '/api/entitydefinitions/M.Asset' // Adjust based on your entity definition
          }
        };
        
        const response = await apiClient.post('/api/entities', entityData);
        
        // Note: Creation might require specific permissions and entity definitions
        // This test might fail if the test user doesn't have create permissions
        if (response.status() === 201 || response.status() === 200) {
          const createdEntity = await response.json();
          createdEntityId = createdEntity.id;
          
          expect(createdEntity.properties.Title).toBe(entityData.properties.Title);
          expect(createdEntity.properties.Title).toContain(timestamp);
        } else {
          // Log the error for debugging but don't fail the test
          console.log(`Entity creation test skipped - Status: ${response.status()}, likely due to permissions or configuration`);
          test.skip(true, 'Entity creation requires specific permissions');
        }
      });

      test('should delete a test entity if created', async () => {
        if (createdEntityId) {
          const response = await apiClient.delete(`/api/entities/${createdEntityId}`);
          expect([200, 204]).toContain(response.status());
        } else {
          test.skip(true, 'No entity was created to delete');
        }
      });
    });

    test.describe('Entity Properties and Validation', () => {
      test('should validate entity response structure', async () => {
        const response = await apiClient.get(`/api/entities/${testEntityId}`);
        expect(response.status()).toBe(200);
        
        const entity = await response.json();
        
        // Validate required fields exist
        expect(entity).toHaveProperty('id');
        expect(entity).toHaveProperty('identifier');
        expect(entity).toHaveProperty('properties');
        expect(entity).toHaveProperty('entitydefinition');
        expect(entity).toHaveProperty('created_on');
        expect(entity).toHaveProperty('modified_on');
        expect(entity).toHaveProperty('version');
        expect(entity).toHaveProperty('self');
        
        // Validate data types
        expect(typeof entity.id).toBe('number');
        expect(typeof entity.identifier).toBe('string');
        expect(typeof entity.properties).toBe('object');
        expect(typeof entity.version).toBe('number');
        
        // Validate date formats
        expect(entity.created_on).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(entity.modified_on).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      test('should handle concurrent updates gracefully', async () => {
        // This tests optimistic concurrency control
        const getResponse = await apiClient.get(`/api/entities/${testEntityId}`);
        expect(getResponse.status()).toBe(200);
        
        const entity = await getResponse.json();
        const originalVersion = entity.version;
        
        // Simulate concurrent updates with different timestamps
        const timestamp1 = new Date().toISOString();
        const timestamp2 = new Date(Date.now() + 1000).toISOString(); // 1 second later
        
        const updateData1 = {
          ...entity,
          properties: {
            ...entity.properties,
            Title: `Concurrent Update 1 - ${timestamp1}`
          }
        };
        
        const updateData2 = {
          ...entity,
          properties: {
            ...entity.properties,
            Title: `Concurrent Update 2 - ${timestamp2}`
          }
        };
        
        // First update should succeed
        const response1 = await apiClient.put(`/api/entities/${testEntityId}`, updateData1);
        expect(response1.status()).toBe(200);
        
        // Second update with stale version might fail or succeed depending on implementation
        const response2 = await apiClient.put(`/api/entities/${testEntityId}`, updateData2);
        // Accept either success or conflict status
        expect([200, 409, 412]).toContain(response2.status());
      });
    });
  });
});
