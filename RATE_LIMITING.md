# Rate Limiting Implementation Guide

## How Rate Limiting Works

The `ContentHubAPIClient` class automatically enforces a rate limit of 13 requests per second to comply with Sitecore Content Hub API throttling requirements.

### Key Features

1. **Automatic Rate Limiting**: Every API call is automatically rate-limited
2. **Transparent Handling**: Rate limiting happens behind the scenes
3. **Console Logging**: Provides feedback when rate limits are reached
4. **Window-based Counting**: Uses a sliding window approach for accurate rate limiting

### Rate Limiting Logic

```typescript
// Rate limiting parameters
private readonly MAX_REQUESTS_PER_SECOND = 13;
private readonly RATE_LIMIT_WINDOW = 1000; // 1 second

// Before each request, check rate limit
private async enforceRateLimit(): Promise<void> {
  const now = Date.now();
  
  // Reset counter if we're in a new time window
  if (now - this.lastRequestTime >= this.RATE_LIMIT_WINDOW) {
    this.requestCount = 0;
    this.lastRequestTime = now;
  }
  
  // If we've hit the rate limit, wait
  if (this.requestCount >= this.MAX_REQUESTS_PER_SECOND) {
    const timeToWait = this.RATE_LIMIT_WINDOW - (now - this.lastRequestTime);
    if (timeToWait > 0) {
      console.log(`Rate limit reached, waiting ${timeToWait}ms...`);
      await new Promise(resolve => setTimeout(resolve, timeToWait));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }
  }
  
  this.requestCount++;
}
```

### Usage Examples

#### Single Request (Automatic Rate Limiting)
```typescript
// This call is automatically rate-limited
const response = await apiClient.get('/api/entities');
```

#### Multiple Sequential Requests
```typescript
// Each request respects the rate limit
for (let i = 0; i < 20; i++) {
  const response = await apiClient.get('/api/entities', { skip: i, take: 1 });
  // Automatically waits if rate limit is exceeded
}
```

#### Batch Operations with Sequential Execution
```typescript
const operations = [
  () => apiClient.get('/api/entities'),
  () => apiClient.get('/api/jobs'),
  () => apiClient.get('/api/selections')
];

// Executes sequentially with rate limiting
const results = await apiClient.executeSequentially(operations);
```

### Configuration Changes for Rate Limiting

#### Playwright Configuration
- **Sequential Execution**: `fullyParallel: false`
- **Single Worker**: `workers: 1`
- **Extended Timeout**: `timeout: 60000` (60 seconds)

#### Why These Settings?
1. **Sequential Execution**: Prevents multiple test files from running simultaneously and overwhelming the API
2. **Single Worker**: Ensures only one test runs at a time across all browsers
3. **Extended Timeout**: Accommodates delays introduced by rate limiting

### Performance Considerations

#### Expected Behavior
- **Normal Operation**: Most requests complete without delay
- **Rate Limit Hit**: Automatic pause until next window (max 1 second)
- **Batch Operations**: May take longer due to sequential execution
- **Test Duration**: Total test time may increase due to rate limiting

#### Monitoring Rate Limiting
- Console logs show when rate limits are reached
- Test reports include timing information
- Use `DEBUG_API_CALLS=true` for verbose logging

### Best Practices

1. **Test Design**: Design tests to minimize unnecessary API calls
2. **Data Cleanup**: Clean up test data efficiently to reduce API calls
3. **Batch Operations**: Use sequential execution for related operations
4. **Error Handling**: Account for rate limiting delays in timeout settings

### Troubleshooting

#### Common Issues
1. **Tests Timing Out**: Increase timeout values in test configuration
2. **Rate Limit Warnings**: Normal behavior when making many requests
3. **Slow Test Execution**: Expected due to rate limiting

#### Debug Tips
```bash
# Enable verbose logging
echo "DEBUG_API_CALLS=true" >> .env

# Run with extended timeout
npx playwright test --timeout=120000

# Run single test to debug rate limiting
npx playwright test tests/sitecore-content-hub-test-cases.ts --grep "Authentication"
```
