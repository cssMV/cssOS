# GitHub OAuth Setup

This project uses a GitHub OAuth App for browser sign-in.

## Required Environment Variables

Set these two variables on the server that runs `src/index.ts`:

```bash
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
```

Optional base URL variables:

```bash
APP_BASE_URL=https://your-domain.example
# or
PUBLIC_APP_URL=https://your-domain.example
# or
PUBLIC_BASE_URL=https://your-domain.example
```

If no base URL is set, local diagnostics fall back to `http://localhost:3000`.

## Callback URL

The server callback path is:

```text
/auth/github/callback
```

So if your site domain is:

```text
https://cssstudio.app
```

Then the GitHub OAuth App callback URL should be:

```text
https://cssstudio.app/api/auth/github/callback
```

The server also accepts `GITHUB_REDIRECT_URI` if you need to pin GitHub OAuth to a different callback that is already registered in the provider console.

## Important Note

This is **not** a GitHub personal access token flow.

Do **not** paste a PAT into `GITHUB_CLIENT_SECRET`.

You need the OAuth App values from GitHub:

- Client ID
- Client Secret

If you regenerate the GitHub OAuth App secret in GitHub settings, then yes, you must update `GITHUB_CLIENT_SECRET` on the server to the new value.

`GITHUB_CLIENT_ID` usually stays the same unless you create a new OAuth App.

## Local Diagnostics

You can run:

```bash
npm run auth:github:check
```

This prints:

- whether GitHub login looks enabled
- which env vars are missing
- start URL
- callback URL

## Server-Side Diagnostics

The app also exposes:

```text
GET /api/auth/diagnostics?provider=github
```

This is used by the login panel to show whether GitHub login is ready.
