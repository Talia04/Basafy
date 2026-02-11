# Reviewer Demo Mode

This project supports a mock Gmail inbox for App Store reviewers. When a user has
`user_metadata.is_mock = true`, Gmail sync will pull mock emails from the database
instead of calling the Gmail API.

## How to set up the reviewer account

1. In Supabase Auth, create a user with the reviewer email/password.
2. Edit the user and set `user_metadata` to include:

```json
{
  "is_mock": true
}
```

3. Sign in with that account in the app.
4. On the Gmail connect screen, tap **Connect Gmail**. The app will load the demo inbox.

## Notes

- Demo emails are stored in `public.mock_gmail_messages` and are inserted on first mock sync.
- The Gmail sync edge function automatically detects mock users and returns demo data.
- You can re-run sync to refresh application data from the mock inbox.
