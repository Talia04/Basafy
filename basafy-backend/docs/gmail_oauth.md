# Gmail OAuth Notes

> This document captures the required OAuth setup for Gmail read-only access and token exchange.

## Project
- **Google Cloud project name:** Basafy
- **Google Cloud project id:** `GOOGLE_OAUTH_PROJECT_ID` (from `.env`)

## OAuth Clients
- **Web client ID:** `GOOGLE_OAUTH_WEB_CLIENT_ID` (from `.env`)
- **Web client secret:** `GOOGLE_OAUTH_WEB_CLIENT_SECRET` (from `.env`)
- **iOS client ID (if applicable):** _TODO_
- **Android client ID (if applicable):** _TODO_
- **Other client IDs (service/CLI):** _TODO_

## Redirect URIs
- _List configured redirect URIs (e.g., `https://<project>.supabase.co/auth/v1/callback`, app-specific redirects, local dev redirects). Keep the actual URIs in environment configuration rather than this doc._

## Scopes (requested)
- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/gmail.readonly`

## OAuth Endpoints
- **Authorization endpoint:** `GOOGLE_OAUTH_AUTH_URI` (from `.env`)
- **Token endpoint:** `GOOGLE_OAUTH_TOKEN_URI` (from `.env`)

## Notes
- Ensure each client ID has the redirect URIs above configured.
- For Supabase auth callbacks, include the Supabase `auth/v1/callback` URL as a redirect.
- If using native apps, add the appropriate custom scheme redirects (per iOS/Android setup) and add the corresponding client IDs above.
