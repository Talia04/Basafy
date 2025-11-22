# Basafy Backend

Shared backend utilities (Supabase client, auth helpers) for mobile and future web.

## Structure
- `supabase/client.ts`: Supabase client, reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `auth/index.ts`: Email/password auth helpers.

## Notes
- Mobile project (`basafy-mobile/basafy-rn-expo`) consumes this via the `@backend/*` alias (configured in `metro.config.js` and `tsconfig.json`).
- Add your environment variables in the Expo app config or `.env` files as needed.
