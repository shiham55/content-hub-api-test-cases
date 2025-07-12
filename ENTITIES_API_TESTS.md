# Entities API Test Cases Documentation

This document describes the comprehensive test cases for the Sitecore Content Hub Entities API, focusing on retrieving entities by ID and updating entity titles with timestamps.

## Test Structure

### Environment Variables Required

Before running the entities API tests, ensure you have the following environment variables configured:

```bash
# Basic configuration
CONTENT_HUB_BASE_URL=https://your-instance.stylelabs.cloud
CONTENT_HUB_CLIENT_ID=your-client-id
CONTENT_HUB_CLIENT_SECRET=your-client-secret
CONTENT_HUB_USERNAME=your-username
CONTENT_HUB_PASSWORD=your-password

# Test-specific configuration
TEST_ENTITY_ID=1                           # ID of an existing entity for testing
TEST_ENTITY_IDENTIFIER=test.entity.1       # Identifier of an existing entity for testing
```

## Test Categories

### 1. Get Entity by ID Tests

These tests validate the retrieval of entities using their numeric ID.

#### Basic Entity Retrieval
- **Test**: `should retrieve an entity by ID with basic properties`
- **Purpose**: Validates basic entity retrieval functionality
- **Endpoint**: `GET /api/entities/{id}`
- **Validations**:
  - Response status is 200
  - Entity contains required properties (id, identifier, properties, entitydefinition, etc.)
  - Entity ID matches the requested ID

#### Cultural Retrieval
- **Test**: `should retrieve an entity by ID with specific culture`
- **Purpose**: Validates entity retrieval with localization
- **Endpoint**: `GET /api/entities/{id}?culture=en-US`
- **Validations**:
  - Entity contains the requested culture
  - Multilingual properties are included

#### Multi-Cultural Retrieval
- **Test**: `should retrieve an entity by ID with multiple cultures`
- **Purpose**: Validates entity retrieval with multiple locales
- **Endpoint**: `GET /api/entities/{id}?cultures[]=en-US&cultures[]=fr-FR`

#### Permissions Loading
- **Test**: `should retrieve an entity by ID with permissions loaded`
- **Purpose**: Validates permission information inclusion
- **Endpoint**: `GET /api/entities/{id}?loadPermissions=true`
- **Validations**:
  - Entity contains `requested_permissions` property

#### Filtered Data Retrieval
- **Test**: `should retrieve an entity by ID with specific groups and members`
- **Purpose**: Validates filtered entity data retrieval
- **Endpoint**: `GET /api/entities/{id}?groups=PreambleGroup,ChoiceGroup&members=PreambleThemeProperty,ChoiceThemeProperty`

#### Renditions Retrieval
- **Test**: `should retrieve an entity by ID with renditions`
- **Purpose**: Validates entity retrieval with rendition information
- **Endpoint**: `GET /api/entities/{id}?renditions=Thumbnail,Preview`

#### Error Handling
- **Test**: `should handle non-existent entity ID gracefully`
- **Purpose**: Validates proper error handling for missing entities
- **Expected**: 404 status code

- **Test**: `should handle invalid entity ID format`
- **Purpose**: Validates proper error handling for malformed IDs
- **Expected**: 400 or 404 status code

### 2. Get Entity by Identifier Tests

These tests validate entity retrieval using string identifiers.

#### Basic Identifier Retrieval
- **Test**: `should retrieve an entity by identifier`
- **Purpose**: Validates entity retrieval using identifier
- **Endpoint**: `GET /api/entities/identifier/{identifier}`

#### Cultural Identifier Retrieval
- **Test**: `should retrieve an entity by identifier with culture`
- **Purpose**: Validates localized entity retrieval by identifier
- **Endpoint**: `GET /api/entities/identifier/{identifier}?culture=en-US`

#### Error Handling
- **Test**: `should handle non-existent entity identifier`
- **Purpose**: Validates error handling for missing identifiers
- **Expected**: 404 status code

### 3. Update Entity Title with Timestamp Tests

These tests focus on updating entity titles with timestamp information.

#### Basic Title Update by ID
- **Test**: `should update entity title by ID with current timestamp`
- **Purpose**: Validates entity title updates with timestamps
- **Process**:
  1. Retrieve current entity
  2. Create new title with ISO timestamp
  3. Update entity with new title
  4. Verify update was successful
- **Endpoint**: `PUT /api/entities/{id}`
- **Validations**:
  - Update returns 200 status
  - Retrieved entity has new title
  - New title contains timestamp
  - Title differs from original

#### Basic Title Update by Identifier
- **Test**: `should update entity title by identifier with current timestamp`
- **Purpose**: Validates entity title updates using identifier
- **Endpoint**: `PUT /api/entities/identifier/{identifier}`
- **Similar validation process as ID-based update

#### Multi-Property Updates
- **Test**: `should update entity with multiple property changes including timestamped title`
- **Purpose**: Validates updating multiple properties simultaneously
- **Properties Updated**:
  - Title (with timestamp)
  - Description (with timestamp)
  - LastModified (timestamp)

#### Custom Timestamp Format
- **Test**: `should update entity title with custom timestamp format`
- **Purpose**: Validates different timestamp formats
- **Format**: `YYYY-MM-DD HH:mm:ss`
- **Example**: `Custom Format Update - 2024-07-13 14:30:45`

#### Error Handling for Updates
- **Test**: `should handle update with invalid entity ID`
- **Purpose**: Validates error handling for non-existent entities
- **Expected**: 404 status code

- **Test**: `should handle update with invalid entity identifier`
- **Purpose**: Validates error handling for non-existent identifiers
- **Expected**: 404 status code

- **Test**: `should handle update with missing required fields`
- **Purpose**: Validates validation of required fields
- **Expected**: 400 or 422 status code

### 4. Entity CRUD Operations with Timestamps

These tests validate complete lifecycle operations.

#### Entity Creation
- **Test**: `should create a new entity with timestamped title`
- **Purpose**: Validates entity creation with timestamps
- **Endpoint**: `POST /api/entities`
- **Note**: May be skipped if user lacks create permissions

#### Entity Deletion
- **Test**: `should delete a test entity if created`
- **Purpose**: Cleanup test entities
- **Endpoint**: `DELETE /api/entities/{id}`

### 5. Entity Properties and Validation Tests

These tests validate data structure and concurrent operations.

#### Response Structure Validation
- **Test**: `should validate entity response structure`
- **Purpose**: Validates API response compliance
- **Validations**:
  - Required properties exist
  - Data types are correct
  - Date formats are valid (ISO 8601)

#### Concurrency Control
- **Test**: `should handle concurrent updates gracefully`
- **Purpose**: Validates optimistic concurrency control
- **Process**:
  1. Retrieve entity with version
  2. Attempt two concurrent updates
  3. Validate conflict handling

## Timestamp Formats Used

### ISO 8601 (Default)
- **Format**: `YYYY-MM-DDTHH:mm:ss.sssZ`
- **Example**: `2024-07-13T14:30:45.123Z`
- **Usage**: Standard API timestamps

### Custom Format
- **Format**: `YYYY-MM-DD HH:mm:ss`
- **Example**: `2024-07-13 14:30:45`
- **Usage**: Human-readable timestamps

## Test Data Requirements

### Minimum Required Test Data
1. **Existing Entity ID**: A valid entity ID that exists in your Content Hub instance
2. **Existing Entity Identifier**: A valid entity identifier
3. **Entity Definition**: Access to at least one entity definition (e.g., `M.Asset`)
4. **User Permissions**: Read and write permissions for the test entities

### Environment-Specific Configuration
Update the `.env` file with your specific test values:

```bash
# Replace with actual values from your Content Hub instance
TEST_ENTITY_ID=12345
TEST_ENTITY_IDENTIFIER=asset.test.sample
```

## Rate Limiting Compliance

All tests respect the 13 requests per second rate limit through:
- Built-in rate limiting in the `ContentHubAPIClient`
- Sequential test execution
- Automatic throttling with time windows

## Error Handling Patterns

### Expected Success Scenarios
- Status codes: 200 (OK), 201 (Created), 204 (No Content)
- Response contains expected data structure
- Updates reflect immediately in subsequent retrievals

### Expected Error Scenarios
- Status codes: 400 (Bad Request), 401 (Unauthorized), 404 (Not Found), 409 (Conflict), 422 (Unprocessable Entity)
- Graceful handling without test failure
- Appropriate error logging

## Best Practices

1. **Test Independence**: Each test is independent and doesn't rely on other tests
2. **Data Validation**: Comprehensive validation of response structure and data types
3. **Error Coverage**: Tests both success and failure scenarios
4. **Performance**: Respects API rate limits and uses efficient request patterns
5. **Cleanup**: Tests clean up any created resources when possible

## Troubleshooting

### Common Issues

1. **404 Errors**: Verify `TEST_ENTITY_ID` and `TEST_ENTITY_IDENTIFIER` exist in your instance
2. **401 Errors**: Check authentication credentials and user permissions
3. **Rate Limiting**: Tests automatically handle rate limiting, but manual runs may need delays
4. **Permission Errors**: Some tests may be skipped if user lacks required permissions

### Debugging Tips

1. **Enable Verbose Logging**: Set detailed logging to see request/response details
2. **Verify Test Data**: Ensure test entities exist and are accessible
3. **Check Permissions**: Verify user has read/write access to test entities
4. **Validate Configuration**: Confirm all environment variables are set correctly

## Running the Tests

```bash
# Run all entities API tests
npx playwright test --grep "Entities API Tests"

# Run specific test suites
npx playwright test --grep "Get Entity by ID"
npx playwright test --grep "Update Entity Title with Timestamp"

# Run with detailed output
npx playwright test --grep "Entities API Tests" --reporter=verbose
```
