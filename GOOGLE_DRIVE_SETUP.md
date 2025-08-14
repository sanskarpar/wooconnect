# WooConnect Google Drive Integration Setup

## Environment Variables

Add these to your `.env.local` file:

```env
# Google Drive Integration (Server-Side)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback

# For production, use:
# GOOGLE_REDIRECT_URI=https://yourdomain.com/api/google-drive/callback
```

## Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable APIs:
   - Google Drive API
   - Google Sheets API
4. Create OAuth 2.0 credentials:
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Web application" as application type
   - Add authorized redirect URI: `http://localhost:3000/api/google-drive/callback`
   - For production: `https://yourdomain.com/api/google-drive/callback`
5. Copy the Client ID and Client Secret to your environment variables
6. Configure OAuth consent screen:
   - Set to "Internal" if organization account
   - Or add your email as test user if "External"

## How It Works

- **Server-Side Configuration**: Google API credentials are stored securely on the server
- **User Connection**: Users simply connect their Google account via OAuth
- **Automatic Uploads**: New invoices are automatically uploaded to user's Google Drive
- **Google Sheets**: Invoice tracking in user's Google Sheets (optional)
- **Zero Configuration**: Users don't need to handle any Google API setup

## Benefits

✅ **Secure**: API credentials are server-side only  
✅ **Simple**: Users just click "Connect to Google Drive"  
✅ **Professional**: Standard SaaS application approach  
✅ **Scalable**: One Google API project serves all users  
✅ **Maintenance**: Easier to manage and update  
