# Entities API Test Cases Implementation Summary

## Overview

I have successfully implemented comprehensive test cases for the Sitecore Content Hub Entities API, specifically focusing on:

1. **Getting entities by ID** with various parameters and configurations
2. **Updating entity titles with timestamps** in multiple formats
3. **Comprehensive error handling** and edge cases
4. **Performance and concurrency testing**

## What Was Implemented

### 1. Test Categories Added

#### **Get Entity by ID Tests** (8 test cases)
- Basic entity retrieval by numeric ID
- Entity retrieval with specific culture (`en-US`)
- Entity retrieval with multiple cultures (`en-US`, `fr-FR`)
- Entity retrieval with permissions loaded
- Entity retrieval with specific groups and members
- Entity retrieval with renditions (`Thumbnail`, `Preview`)
- Error handling for non-existent entity IDs
- Error handling for invalid entity ID formats

#### **Get Entity by Identifier Tests** (3 test cases)
- Basic entity retrieval by string identifier
- Entity retrieval by identifier with culture
- Error handling for non-existent identifiers

#### **Update Entity Title with Timestamp Tests** (7 test cases)
- Update entity title by ID with ISO 8601 timestamp
- Update entity title by identifier with timestamp
- Multi-property updates including timestamped title
- Custom timestamp format updates (`YYYY-MM-DD HH:mm:ss`)
- Error handling for invalid entity ID updates
- Error handling for invalid identifier updates
- Error handling for missing required fields

#### **Entity CRUD Operations with Timestamps** (2 test cases)
- Create new entity with timestamped title
- Delete test entity cleanup

#### **Entity Properties and Validation Tests** (2 test cases)
- Response structure validation (required fields, data types, date formats)
- Concurrent update handling with optimistic concurrency control

### 2. API Endpoints Covered

Based on the Sitecore Content Hub Entities API documentation:

- `GET /api/entities/{id}` - Retrieve entity by ID
- `GET /api/entities/{id}?culture={culture}` - Retrieve with specific culture
- `GET /api/entities/{id}?cultures[]={culture}` - Retrieve with multiple cultures
- `GET /api/entities/{id}?loadPermissions=true` - Retrieve with permissions
- `GET /api/entities/{id}?groups={groups}&members={members}` - Retrieve with filters
- `GET /api/entities/{id}?renditions={renditions}` - Retrieve with renditions
- `GET /api/entities/identifier/{identifier}` - Retrieve by identifier
- `PUT /api/entities/{id}` - Update entity by ID
- `PUT /api/entities/identifier/{identifier}` - Update entity by identifier
- `POST /api/entities` - Create new entity
- `DELETE /api/entities/{id}` - Delete entity

### 3. Timestamp Formats Implemented

#### **ISO 8601 Standard Format**
```javascript
const timestamp = new Date().toISOString();
// Example: "2024-07-13T14:30:45.123Z"
```

#### **Custom Human-Readable Format**
```javascript
const now = new Date();
const customTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
// Example: "2024-07-13 14:30:45"
```

### 4. Test Structure and Organization

```
test.describe('Entities API Tests', () => {
  ├── Get Entity by ID
  │   ├── Basic retrieval tests
  │   ├── Cultural/localization tests
  │   ├── Permission and filtering tests
  │   └── Error handling tests
  ├── Get Entity by Identifier
  │   ├── Basic identifier tests
  │   └── Error handling tests
  ├── Update Entity Title with Timestamp
  │   ├── Timestamp update tests
  │   ├── Multi-property update tests
  │   └── Error handling tests
  ├── Entity CRUD Operations with Timestamps
  │   ├── Creation with timestamps
  │   └── Cleanup operations
  └── Entity Properties and Validation
      ├── Response structure validation
      └── Concurrency control tests
});
```

### 5. Key Features Implemented

#### **Rate Limiting Compliance**
- All tests respect the 13 requests/second limit
- Built-in throttling in `ContentHubAPIClient`
- Automatic waiting when rate limits are reached

#### **Comprehensive Error Handling**
- 404 errors for non-existent entities
- 400/422 errors for invalid requests
- 401 errors for authentication issues
- 409 errors for concurrent update conflicts

#### **Data Validation**
- Response structure validation
- Data type verification
- Date format validation (ISO 8601)
- Property existence checks

#### **Authentication Integration**
- Uses existing OAuth Resource Owner Password Grant flow
- Token caching and expiry management
- Automatic re-authentication on token expiry

### 6. Environment Configuration

#### **New Environment Variables Added**
```bash
# Test entity configuration for testing
TEST_ENTITY_ID=1                           # Numeric ID of existing test entity
TEST_ENTITY_IDENTIFIER=test.entity.1       # String identifier of existing test entity
```

#### **Updated Configuration Files**
- `.env.example` - Added test entity configuration
- `README.md` - Updated with entities API documentation
- `ENTITIES_API_TESTS.md` - Comprehensive test documentation

### 7. Documentation Created

#### **ENTITIES_API_TESTS.md**
Comprehensive documentation including:
- Detailed test descriptions
- API endpoint coverage
- Environment setup instructions
- Timestamp format examples
- Error handling patterns
- Troubleshooting guide
- Best practices

#### **Updated README.md**
- Added entities API test section
- Updated API endpoints list
- Added reference to detailed documentation

## Test Examples

### Example 1: Basic Entity Retrieval with Timestamp Update
```typescript
test('should update entity title by ID with current timestamp', async () => {
  // Get current entity
  const getResponse = await apiClient.get(`/api/entities/${testEntityId}`);
  expect(getResponse.status()).toBe(200);
  
  const entity = await getResponse.json();
  
  // Create new title with timestamp
  const timestamp = new Date().toISOString();
  const newTitle = `Updated Title - ${timestamp}`;
  
  // Update entity
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
  
  // Verify update
  const verifyResponse = await apiClient.get(`/api/entities/${testEntityId}`);
  const updatedEntity = await verifyResponse.json();
  expect(updatedEntity.properties.Title).toBe(newTitle);
  expect(updatedEntity.properties.Title).toContain(timestamp);
});
```

### Example 2: Multi-Property Update with Custom Timestamp
```typescript
test('should update entity with multiple property changes including timestamped title', async () => {
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
});
```

## How to Use

### 1. Configure Test Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
CONTENT_HUB_BASE_URL=https://your-instance.stylelabs.cloud
TEST_ENTITY_ID=12345
TEST_ENTITY_IDENTIFIER=asset.test.sample
```

### 2. Run Entities API Tests
```bash
# Run all entities API tests
npx playwright test --grep "Entities API Tests"

# Run specific test suites
npx playwright test --grep "Get Entity by ID"
npx playwright test --grep "Update Entity Title with Timestamp"

# Run with verbose output
npx playwright test --grep "Entities API Tests" --reporter=verbose
```

### 3. View Results
Tests will validate:
- Successful entity retrieval with various parameters
- Proper timestamp integration in entity updates
- Error handling for edge cases
- Response structure compliance
- Rate limiting adherence

## Benefits of This Implementation

### **Comprehensive Coverage**
- Covers all major entity operations from the Content Hub API
- Tests both success and failure scenarios
- Validates different parameter combinations

### **Real-World Scenarios**
- Uses actual timestamps for realistic testing
- Tests concurrent operations
- Handles authentication and rate limiting

### **Maintainable and Extensible**
- Well-structured test organization
- Clear documentation
- Easy to add new test cases

### **Production-Ready**
- Follows Playwright best practices
- Includes proper error handling
- Respects API rate limits
- Comprehensive validation

## Next Steps

1. **Configure your test environment** with actual entity IDs from your Content Hub instance
2. **Run the tests** to validate your API setup
3. **Customize as needed** for your specific entity definitions and requirements
4. **Extend the tests** to cover additional entity properties or operations specific to your use case

The implementation provides a solid foundation for testing Sitecore Content Hub entity operations with proper timestamp handling and comprehensive validation.
