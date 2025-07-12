# OAuth Resource Owner Password Credentials Grant Implementation

## Overview

The test suite has been updated to properly implement the **Resource Owner Password Credentials Grant** flow as documented in the Sitecore Content Hub OAuth documentation.

## Key Improvements

### 1. **Enhanced Authentication Flow**
- Implements proper Resource Owner Password Credentials Grant
- Includes token expiry handling with automatic refresh
- Better error handling and debugging information
- Proper token caching to avoid unnecessary authentication calls

### 2. **Authentication Request Format**
```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
Accept: application/json

grant_type=password&
client_id={CLIENT_ID}&
client_secret={CLIENT_SECRET}&
username={USERNAME}&
password={PASSWORD}&
```

### 3. **Token Management Features**
- **Automatic Expiry Handling**: Tokens are automatically refreshed before expiration
- **Token Caching**: Avoids unnecessary authentication requests
- **Error Recovery**: Proper error handling for authentication failures
- **Debug Logging**: Logs authentication status without exposing sensitive tokens

### 4. **Enhanced Test Coverage**
The authentication tests now include:

#### Core Authentication Tests
- ✅ **Resource Owner Password Grant**: Validates successful authentication
- ✅ **Token Structure Validation**: Ensures tokens are properly formatted
- ✅ **Token Caching**: Verifies token reuse and caching behavior

#### Error Handling Tests
- ✅ **Invalid Client Credentials**: Tests authentication failure with wrong client ID/secret
- ✅ **Invalid User Credentials**: Tests authentication failure with wrong username/password
- ✅ **Missing Parameters**: Tests handling of incomplete authentication requests
- ✅ **Unsupported Grant Types**: Tests rejection of non-password grant types

### 5. **Configuration Requirements**

#### OAuth Client Setup
Your Content Hub OAuth client must be configured to:
1. **Support Password Grant**: Enable `password` grant type
2. **Proper Scopes**: Include `api` scope or required permissions
3. **Client Credentials**: Have valid Client ID and Client Secret

#### User Account Requirements
- Valid Content Hub user account
- Appropriate API permissions
- Account must not be locked or disabled

### 6. **Enhanced Error Messages**
The implementation now provides detailed error information:
- HTTP status codes for different failure scenarios
- Descriptive error messages for troubleshooting
- Console logging for authentication events (without exposing tokens)

### 7. **Token Security**
- Tokens are stored securely in memory only
- No sensitive information is logged
- Automatic token clearing when needed
- Support for token refresh (if provided by server)

## Usage Examples

### Basic Authentication
```typescript
const apiClient = new ContentHubAPIClient(request);
const token = await apiClient.getAuthToken();
// Token is automatically used for subsequent API calls
```

### Error Handling
```typescript
try {
  const token = await apiClient.getAuthToken();
  // Use token for API calls
} catch (error) {
  console.error('Authentication failed:', error.message);
  // Handle authentication failure
}
```

### Manual Token Management
```typescript
// Clear tokens (useful for testing)
apiClient.clearAuth();

// Get fresh token
const newToken = await apiClient.getAuthToken();
```

## Environment Configuration

Update your `.env` file with proper OAuth configuration:

```env
# OAuth Client (must support password grant)
CONTENT_HUB_CLIENT_ID=your-oauth-client-id
CONTENT_HUB_CLIENT_SECRET=your-oauth-client-secret

# User Account (with API permissions)
CONTENT_HUB_USERNAME=your-api-user
CONTENT_HUB_PASSWORD=your-api-password
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check client ID and secret
   - Verify client supports password grant
   - Ensure user credentials are correct

2. **400 Bad Request**
   - Check for missing required parameters
   - Verify Content-Type header is set correctly
   - Ensure grant_type is set to "password"

3. **Token Expiry Issues**
   - Tokens are automatically refreshed
   - Check server time synchronization
   - Verify token expiry handling logic

### Debug Mode
Enable debug logging for detailed authentication information:
```env
DEBUG_API_CALLS=true
```

This will log authentication events and help diagnose issues without exposing sensitive token data.

## Compliance and Security

- ✅ Follows OAuth 2.0 Resource Owner Password Credentials Grant specification
- ✅ Implements proper token management and security practices
- ✅ Includes comprehensive error handling
- ✅ Respects Content Hub API rate limiting (13 requests/second)
- ✅ Provides detailed logging for troubleshooting
