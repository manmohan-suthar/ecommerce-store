# Google OAuth Setup

1. Open Google Cloud Console.
2. Create or select a project.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 Client ID with application type `Web application`.
5. Add `http://localhost:3000` under Authorized JavaScript origins.
6. Put the same client ID in both environment files:

Backend:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Frontend:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

The browser receives a Google ID credential. The backend verifies that credential
with `google-auth-library`, creates or updates the customer in PostgreSQL, and
returns the application's JWT.
