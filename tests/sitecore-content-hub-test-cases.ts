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

    const response = await this.request.post(`${CONTENT_HUB_BASE_URL}/api/oauth/token`, {
      form: {
        grant_type: 'password',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        username: USERNAME,
        password: PASSWORD,
        scope: 'api'
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
      const response = await request.post(`${CONTENT_HUB_BASE_URL}/api/oauth/token`, {
        form: {
          grant_type: 'password',
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

  test.describe('Entity Management Tests', () => {
    test('should retrieve entities with basic query', async () => {
      const response = await apiClient.get('/api/entities');
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });

    test('should create a new entity', async () => {
      const entityData = {
        identifier: `test-entity-${Date.now()}`,
        culture: 'en-US',
        properties: {
          'Title': [{ culture: 'en-US', value: 'Test Entity' }],
          'Description': [{ culture: 'en-US', value: 'Test entity description' }]
        }
      };

      const response = await apiClient.post('/api/entities', entityData);
      
      expect(response.status()).toBe(201);
      const createdEntity = await response.json();
      expect(createdEntity).toHaveProperty('id');
      expect(createdEntity.identifier).toBe(entityData.identifier);
    });

    test('should retrieve entity by ID', async () => {
      // First create an entity
      const entityData = {
        identifier: `test-entity-${Date.now()}`,
        culture: 'en-US',
        properties: {
          'Title': [{ culture: 'en-US', value: 'Test Entity for Retrieval' }]
        }
      };

      const createResponse = await apiClient.post('/api/entities', entityData);
      expect(createResponse.status()).toBe(201);
      
      const createdEntity = await createResponse.json();
      const entityId = createdEntity.id;

      // Then retrieve it
      const getResponse = await apiClient.get(`/api/entities/${entityId}`);
      expect(getResponse.status()).toBe(200);
      
      const retrievedEntity = await getResponse.json();
      expect(retrievedEntity.id).toBe(entityId);
      expect(retrievedEntity.identifier).toBe(entityData.identifier);
    });

    test('should update an existing entity', async () => {
      // First create an entity
      const entityData = {
        identifier: `test-entity-update-${Date.now()}`,
        culture: 'en-US',
        properties: {
          'Title': [{ culture: 'en-US', value: 'Original Title' }]
        }
      };

      const createResponse = await apiClient.post('/api/entities', entityData);
      const createdEntity = await createResponse.json();
      const entityId = createdEntity.id;

      // Update the entity
      const updateData = {
        ...entityData,
        properties: {
          'Title': [{ culture: 'en-US', value: 'Updated Title' }]
        }
      };

      const updateResponse = await apiClient.put(`/api/entities/${entityId}`, updateData);
      expect(updateResponse.status()).toBe(200);

      // Verify the update
      const getResponse = await apiClient.get(`/api/entities/${entityId}`);
      const updatedEntity = await getResponse.json();
      expect(updatedEntity.properties.Title[0].value).toBe('Updated Title');
    });

    test('should delete an entity', async () => {
      // First create an entity
      const entityData = {
        identifier: `test-entity-delete-${Date.now()}`,
        culture: 'en-US',
        properties: {
          'Title': [{ culture: 'en-US', value: 'Entity to Delete' }]
        }
      };

      const createResponse = await apiClient.post('/api/entities', entityData);
      const createdEntity = await createResponse.json();
      const entityId = createdEntity.id;

      // Delete the entity
      const deleteResponse = await apiClient.delete(`/api/entities/${entityId}`);
      expect(deleteResponse.status()).toBe(204);

      // Verify deletion
      const getResponse = await apiClient.get(`/api/entities/${entityId}`);
      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Query and Search Tests', () => {
    test('should perform basic entity query with filters', async () => {
      const response = await apiClient.get('/api/entities/query', {
        query: '*',
        take: 10,
        skip: 0,
        culture: 'en-US'
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total_items');
      expect(Array.isArray(data.items)).toBe(true);
    });

    test('should search entities with specific criteria', async () => {
      const searchQuery = {
        query: 'Title.en-US:"Test"',
        take: 5,
        skip: 0,
        culture: 'en-US',
        sort: [{ field: 'CreatedOn', direction: 'Desc' }]
      };

      const response = await apiClient.post('/api/entities/query', searchQuery);
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(data.items.length).toBeLessThanOrEqual(5);
    });

    test('should handle pagination correctly', async () => {
      // First page
      const firstPageResponse = await apiClient.get('/api/entities', {
        take: 5,
        skip: 0
      });

      expect(firstPageResponse.status()).toBe(200);
      const firstPageData = await firstPageResponse.json();
      expect(firstPageData.items.length).toBeLessThanOrEqual(5);

      // Second page
      const secondPageResponse = await apiClient.get('/api/entities', {
        take: 5,
        skip: 5
      });

      expect(secondPageResponse.status()).toBe(200);
      const secondPageData = await secondPageResponse.json();
      
      // Ensure different items on different pages
      if (firstPageData.items.length > 0 && secondPageData.items.length > 0) {
        expect(firstPageData.items[0].id).not.toBe(secondPageData.items[0].id);
      }
    });

    test('should perform full-text search', async () => {
      const response = await apiClient.get('/api/entities/search', {
        q: 'content',
        take: 10,
        culture: 'en-US'
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });
  });

  test.describe('Asset and Upload API Tests', () => {
    test('should initiate file upload', async () => {
      const uploadData = {
        filename: 'test-image.jpg',
        filesize: 1024,
        content_type: 'image/jpeg'
      };

      const response = await apiClient.post('/api/upload/initiate', uploadData);
      
      expect(response.status()).toBe(200);
      const uploadInfo = await response.json();
      expect(uploadInfo).toHaveProperty('upload_identifier');
      expect(uploadInfo).toHaveProperty('upload_configuration');
    });

    test('should get upload progress', async () => {
      // First initiate upload
      const uploadData = {
        filename: 'test-document.pdf',
        filesize: 2048,
        content_type: 'application/pdf'
      };

      const initiateResponse = await apiClient.post('/api/upload/initiate', uploadData);
      const uploadInfo = await initiateResponse.json();
      const uploadIdentifier = uploadInfo.upload_identifier;

      // Check upload progress
      const progressResponse = await apiClient.get(`/api/upload/progress/${uploadIdentifier}`);
      
      expect(progressResponse.status()).toBe(200);
      const progressData = await progressResponse.json();
      expect(progressData).toHaveProperty('status');
    });

    test('should retrieve asset information', async () => {
      const response = await apiClient.get('/api/entities', {
        query: 'Definition.Name:"M.Asset"',
        take: 1
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      
      if (data.items.length > 0) {
        const assetId = data.items[0].id;
        const assetResponse = await apiClient.get(`/api/entities/${assetId}`);
        
        expect(assetResponse.status()).toBe(200);
        const asset = await assetResponse.json();
        expect(asset).toHaveProperty('id');
      }
    });
  });

  test.describe('Job Management Tests', () => {
    test('should fetch job list', async () => {
      const response = await apiClient.get('/api/jobs');
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });

    test('should get job details by ID', async () => {
      // First get job list
      const jobListResponse = await apiClient.get('/api/jobs', { take: 1 });
      const jobListData = await jobListResponse.json();
      
      if (jobListData.items.length > 0) {
        const jobId = jobListData.items[0].id;
        
        const jobResponse = await apiClient.get(`/api/jobs/${jobId}`);
        expect(jobResponse.status()).toBe(200);
        
        const jobData = await jobResponse.json();
        expect(jobData).toHaveProperty('id');
        expect(jobData).toHaveProperty('status');
        expect(jobData.id).toBe(jobId);
      }
    });

    test('should filter jobs by status', async () => {
      const response = await apiClient.get('/api/jobs', {
        status: 'Completed',
        take: 5
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('items');
      
      // All returned jobs should have 'Completed' status
      data.items.forEach((job: any) => {
        expect(job.status).toBe('Completed');
      });
    });
  });

  test.describe('Selection Tests', () => {
    test('should create a new selection', async () => {
      const selectionData = {
        name: `Test Selection ${Date.now()}`,
        query: '*',
        entities: []
      };

      const response = await apiClient.post('/api/selections', selectionData);
      
      expect(response.status()).toBe(201);
      const selection = await response.json();
      expect(selection).toHaveProperty('id');
      expect(selection.name).toBe(selectionData.name);
    });

    test('should retrieve selections list', async () => {
      const response = await apiClient.get('/api/selections');
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });

    test('should add entities to selection', async () => {
      // First create a selection
      const selectionData = {
        name: `Selection for Entities ${Date.now()}`,
        query: '*',
        entities: []
      };

      const createResponse = await apiClient.post('/api/selections', selectionData);
      const selection = await createResponse.json();
      const selectionId = selection.id;

      // Get some entity IDs
      const entitiesResponse = await apiClient.get('/api/entities', { take: 2 });
      const entitiesData = await entitiesResponse.json();
      
      if (entitiesData.items.length > 0) {
        const entityIds = entitiesData.items.map((item: any) => item.id);
        
        const addResponse = await apiClient.post(`/api/selections/${selectionId}/entities`, {
          entity_ids: entityIds
        });
        
        expect(addResponse.status()).toBe(200);
      }
    });
  });

  test.describe('Option Lists Tests', () => {
    test('should retrieve option lists', async () => {
      const response = await apiClient.get('/api/optionlists');
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });

    test('should get specific option list by ID', async () => {
      // First get option lists
      const optionListsResponse = await apiClient.get('/api/optionlists', { take: 1 });
      const optionListsData = await optionListsResponse.json();
      
      if (optionListsData.items.length > 0) {
        const optionListId = optionListsData.items[0].id;
        
        const optionListResponse = await apiClient.get(`/api/optionlists/${optionListId}`);
        expect(optionListResponse.status()).toBe(200);
        
        const optionList = await optionListResponse.json();
        expect(optionList).toHaveProperty('id');
        expect(optionList).toHaveProperty('options');
        expect(Array.isArray(optionList.options)).toBe(true);
      }
    });

    test('should create new option in option list', async () => {
      // Get an option list first
      const optionListsResponse = await apiClient.get('/api/optionlists', { take: 1 });
      const optionListsData = await optionListsResponse.json();
      
      if (optionListsData.items.length > 0) {
        const optionListId = optionListsData.items[0].id;
        
        const newOption = {
          key: `test-option-${Date.now()}`,
          labels: {
            'en-US': `Test Option ${Date.now()}`
          }
        };

        const response = await apiClient.post(`/api/optionlists/${optionListId}/options`, newOption);
        
        expect([200, 201]).toContain(response.status());
        const option = await response.json();
        expect(option).toHaveProperty('key');
        expect(option.key).toBe(newOption.key);
      }
    });
  });

  test.describe('Schema and Definitions Tests', () => {
    test('should retrieve entity definitions', async () => {
      const response = await apiClient.get('/api/entitydefinitions');
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });

    test('should get specific entity definition', async () => {
      const response = await apiClient.get('/api/entitydefinitions', { take: 1 });
      const data = await response.json();
      
      if (data.items.length > 0) {
        const definitionId = data.items[0].id;
        
        const definitionResponse = await apiClient.get(`/api/entitydefinitions/${definitionId}`);
        expect(definitionResponse.status()).toBe(200);
        
        const definition = await definitionResponse.json();
        expect(definition).toHaveProperty('id');
        expect(definition).toHaveProperty('name');
      }
    });

    test('should retrieve member definitions for entity definition', async () => {
      const response = await apiClient.get('/api/entitydefinitions', { take: 1 });
      const data = await response.json();
      
      if (data.items.length > 0) {
        const definitionId = data.items[0].id;
        
        const membersResponse = await apiClient.get(`/api/entitydefinitions/${definitionId}/members`);
        expect(membersResponse.status()).toBe(200);
        
        const members = await membersResponse.json();
        expect(members).toHaveProperty('items');
        expect(Array.isArray(members.items)).toBe(true);
      }
    });
  });

  test.describe('Error Handling Tests', () => {
    test('should handle 404 for non-existent entity', async () => {
      const response = await apiClient.get('/api/entities/99999999');
      expect(response.status()).toBe(404);
    });

    test('should handle invalid query parameters', async () => {
      const response = await apiClient.get('/api/entities', {
        take: 'invalid',
        skip: 'invalid'
      });
      
      // Should either return 400 or handle gracefully
      expect([200, 400]).toContain(response.status());
    });

    test('should handle malformed JSON in POST request', async ({ request }) => {
      const headers = await apiClient.getAuthHeaders();
      
      const response = await request.post(`${CONTENT_HUB_BASE_URL}/api/entities`, {
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        data: '{ invalid json }'
      });
      
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Performance Tests', () => {
    test('should handle sequential requests with rate limiting', async () => {
      const responses: any[] = [];
      
      // Make requests sequentially to respect rate limiting
      for (let i = 0; i < 3; i++) {
        const response = await apiClient.get('/api/entities', { take: 1, skip: i });
        responses.push(response);
      }
      
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });
    });

    test('should respect rate limiting with multiple concurrent requests', async () => {
      const startTime = Date.now();
      
      // Test with fewer concurrent requests to avoid overwhelming the API
      const promises = Array.from({ length: 3 }, (_, i) =>
        apiClient.get('/api/entities', { take: 1, skip: i })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });
      
      // Should take at least some time due to rate limiting
      expect(duration).toBeGreaterThan(100);
    });

    test('should respond within acceptable time limits considering rate limiting', async () => {
      const startTime = Date.now();
      
      const response = await apiClient.get('/api/entities', { take: 5 });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status()).toBe(200);
      // Increased timeout to account for rate limiting delays
      expect(responseTime).toBeLessThan(30000); // 30 seconds max
    });
  });
});
