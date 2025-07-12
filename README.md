# Sitecore Content Hub API Test Cases

This project contains comprehensive test cases for testing the Sitecore Content Hub REST API endpoints using Playwright. The tests cover authentication, entity management, asset operations, job management, selections, option lists, and more.

## Prerequisites

- Node.js (v16 or higher)
- A Sitecore Content Hub instance
- Valid Content Hub credentials (OAuth client credentials and user credentials)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
npx playwright install
```

### 2. Configure Environment Variables

1. Copy the example environment file:
```bash
copy .env.example .env
```

2. Edit the `.env` file and fill in your actual Content Hub configuration:

```env
# Content Hub Instance URL (without trailing slash)
CONTENT_HUB_BASE_URL=https://your-instance.stylelabs.cloud

# OAuth Client Credentials
CONTENT_HUB_CLIENT_ID=your-client-id
CONTENT_HUB_CLIENT_SECRET=your-client-secret

# User Credentials for OAuth Password Grant
CONTENT_HUB_USERNAME=your-username
CONTENT_HUB_PASSWORD=your-password
```

### 3. Getting Content Hub Credentials

#### OAuth Client Credentials
1. Log into your Content Hub instance as an administrator
2. Navigate to **Manage** > **Settings** > **Integrations** > **OAuth clients**
3. Create a new OAuth client or use an existing one
4. Note down the **Client ID** and **Client Secret**
5. Ensure the client has the necessary scopes (typically `api`)

#### User Credentials
- Use a valid Content Hub user account with appropriate permissions
- The user should have access to the APIs you want to test

## Rate Limiting and Throttling

This test suite implements automatic rate limiting to respect Sitecore Content Hub API throttling limits:

- **Rate Limit**: Maximum 13 requests per second
- **Implementation**: Built-in rate limiting in the `ContentHubAPIClient` class
- **Automatic Handling**: Tests automatically wait when rate limits are reached
- **Sequential Execution**: Tests run sequentially to prevent overwhelming the API

### Rate Limiting Features

1. **Automatic Throttling**: The client automatically enforces a 13 requests per second limit
2. **Transparent Delays**: When rate limits are hit, the client waits before making the next request
3. **Console Logging**: Rate limit delays are logged to help with debugging
4. **Reset Functionality**: Rate limiting counters can be reset for testing purposes

## Test Structure

The test suite is organized into the following categories:

### Authentication Tests
- OAuth token acquisition
- Invalid credential handling
- Token validation

### Entity Management Tests
- Create, read, update, delete entities
- Entity property management
- Entity relationships

### Query and Search Tests
- Basic entity queries with filters
- Full-text search
- Pagination handling
- Sorting and filtering

### Asset and Upload API Tests
- File upload initiation
- Upload progress tracking
- Asset information retrieval

### Job Management Tests
- Job listing and filtering
- Job status monitoring
- Job details retrieval

### Selection Tests
- Selection creation and management
- Adding/removing entities from selections
- Selection queries

### Option Lists Tests
- Option list retrieval
- Option management
- Option list modifications

### Schema and Definitions Tests
- Entity definition retrieval
- Member definition queries
- Schema validation

### Error Handling Tests
- 404 error handling
- Invalid parameter handling
- Malformed request handling

### Performance Tests
- Concurrent request handling
- Response time validation

## Running the Tests

### Run All Tests
```bash
npm test
```

### Run Only Content Hub API Tests
```bash
npm run test:content-hub
```

### Run Tests in Headed Mode (with browser UI)
```bash
npm run test:headed
```

### Debug Tests
```bash
npm run test:debug
```

### View Test Report
```bash
npm run report
```

## API Endpoints Covered

The test suite covers the following Content Hub REST API endpoints:

### Authentication
- `POST /api/oauth/token` - OAuth token acquisition

### Entity Management
- `GET /api/entities` - List entities
- `POST /api/entities` - Create entity
- `GET /api/entities/{id}` - Get entity by ID
- `PUT /api/entities/{id}` - Update entity
- `DELETE /api/entities/{id}` - Delete entity
- `GET /api/entities/query` - Query entities with filters
- `POST /api/entities/query` - Advanced entity search
- `GET /api/entities/search` - Full-text search

### Upload API
- `POST /api/upload/initiate` - Initiate file upload
- `GET /api/upload/progress/{id}` - Get upload progress

### Job Management
- `GET /api/jobs` - List jobs
- `GET /api/jobs/{id}` - Get job details

### Selections
- `GET /api/selections` - List selections
- `POST /api/selections` - Create selection
- `POST /api/selections/{id}/entities` - Add entities to selection

### Option Lists
- `GET /api/optionlists` - List option lists
- `GET /api/optionlists/{id}` - Get option list details
- `POST /api/optionlists/{id}/options` - Add option to list

### Schema and Definitions
- `GET /api/entitydefinitions` - List entity definitions
- `GET /api/entitydefinitions/{id}` - Get entity definition
- `GET /api/entitydefinitions/{id}/members` - Get member definitions

## Test Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CONTENT_HUB_BASE_URL` | Content Hub instance URL | Yes |
| `CONTENT_HUB_CLIENT_ID` | OAuth client ID | Yes |
| `CONTENT_HUB_CLIENT_SECRET` | OAuth client secret | Yes |
| `CONTENT_HUB_USERNAME` | Content Hub username | Yes |
| `CONTENT_HUB_PASSWORD` | Content Hub password | Yes |
| `DEBUG_API_CALLS` | Enable verbose logging | No |

### Playwright Configuration

The tests are configured to run with rate limiting considerations:
- **Sequential Execution**: Tests run one at a time (`fullyParallel: false`)
- **Single Worker**: Uses only one worker thread (`workers: 1`)
- **Extended Timeouts**: 60-second timeout to accommodate rate limiting delays
- **Multiple Browsers**: Still supports Chromium, Firefox, and WebKit
- **Retry Logic**: Includes retry logic for CI environments

Tests run in parallel by default and include retry logic for CI environments.

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify your OAuth client credentials are correct
   - Ensure the OAuth client has the required scopes
   - Check that the user credentials are valid

2. **Network Timeouts**
   - Verify your Content Hub instance URL is accessible
   - Check firewall/proxy settings
   - Increase timeout values if needed

3. **Permission Errors**
   - Ensure the user has appropriate permissions for the APIs being tested
   - Check that the OAuth client has the necessary scopes

4. **Test Data Conflicts**
   - Tests create temporary entities with timestamps to avoid conflicts
   - If tests fail due to existing data, check for cleanup issues

### Debug Tips

1. Use `--debug` flag to step through tests:
```bash
npm run test:debug
```

2. Enable API call logging by setting `DEBUG_API_CALLS=true` in your `.env` file

3. Check the test report for detailed error information:
```bash
npm run report
```

## Contributing

When adding new test cases:

1. Follow the existing test structure and naming conventions
2. Use the `ContentHubAPIClient` helper class for API calls
3. Include proper error handling and assertions
4. Add cleanup for any test data created
5. Update this README if new endpoints are covered

## Security Notes

- Never commit your `.env` file with real credentials
- Use environment-specific credentials for different test environments
- Regularly rotate your OAuth client secrets
- Use least-privilege access for test user accounts

## References

- [Sitecore Content Hub REST API Documentation](https://doc.sitecore.com/ch/en/developers/cloud-dev/rest-api.html)
- [Content Hub Authentication Guide](https://doc.sitecore.com/ch/en/developers/cloud-dev/get-token.html)
- [Playwright Testing Documentation](https://playwright.dev/docs/intro)
