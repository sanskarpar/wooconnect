# Google Authentication Migration - Production Fix

## Issue Fixed
The error "This action with HTTP GET is not supported by NextAuth.js" occurred because the application was using two different Google OAuth flows:
1. Custom Google Drive OAuth flow (`/api/google-drive/callback`)
2. NextAuth.js Google provider flow (`/api/auth/callback/google`)

## Solution
Migrated to use NextAuth.js Google provider exclusively, which provides better integration and handles token management automatically.

## Changes Made

### 1. Updated NextAuth Configuration
- Added Google Provider to NextAuth.js configuration
- Added Google Drive and Sheets scopes to the authorization
- Updated JWT callbacks to store Google tokens in database
- Tokens are automatically stored for Google Drive service use

### 2. Frontend Updates
- Updated `GoogleDriveSettings.tsx` to use NextAuth sign-in instead of custom auth flow
- Simplified connection process - now uses standard Google sign-in

### 3. Environment Configuration
**For Production**, update your `.env` file:

```bash
# Google Drive Integration  
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
# Remove GOOGLE_REDIRECT_URI - now handled by NextAuth

# NextAuth
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://wooconnect.ddnsgeek.com  # Your production URL
```

### 4. Google Cloud Console Configuration
Update your Google Cloud Console OAuth settings:

**Old Redirect URI:**
```
https://wooconnect.ddnsgeek.com/api/google-drive/callback
```

**New Redirect URI:**
```
https://wooconnect.ddnsgeek.com/api/auth/callback/google
```

### 5. Deployment Steps

1. **Update Environment Variables** in your production environment:
   - Remove `GOOGLE_REDIRECT_URI`
   - Ensure `NEXTAUTH_URL=https://wooconnect.ddnsgeek.com`

2. **Update Google Cloud Console:**
   - Go to Google Cloud Console > APIs & Services > Credentials
   - Edit your OAuth 2.0 Client ID
   - Replace the redirect URI with: `https://wooconnect.ddnsgeek.com/api/auth/callback/google`

3. **Deploy the updated code**

4. **Test the flow:**
   - Go to dashboard → Google Drive settings
   - Click "Connect to Google Drive"
   - Should now work properly with NextAuth flow

## Benefits of This Approach

1. **Unified Authentication:** Uses NextAuth.js for all authentication needs
2. **Better Token Management:** Automatic token refresh and storage
3. **Production Compatible:** Works correctly in both development and production
4. **Simplified Codebase:** Removed duplicate OAuth implementation
5. **Security:** Leverages NextAuth.js security best practices

## Migration Notes

- Existing Google Drive connections may need to be re-established
- Old custom auth routes have been backed up (`.backup` files)
- All existing functionality is preserved
- Database schema remains the same
