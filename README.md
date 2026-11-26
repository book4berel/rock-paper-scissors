# Rock Paper Scissors

This is the GitHub Pages site root for the public game. Player accounts and match records use Supabase Auth and Postgres. Edge Functions provide username sign-in and admin account management.

Players register with a unique username, email, and password, then sign in with either username or email. Both accounts must be confirmed before a local two-player match.

## Backend configuration

The Supabase project, database migration, authentication settings, and both Edge Functions have been configured for this release. The browser config contains the project URL and public publishable key. These values are intended to be public; never put a database password or service-role key in this repository.

Email/password registration and email confirmation are enabled. Configure a production SMTP provider in Supabase before a wider launch so confirmation and password-reset messages are reliable. The current Auth Site URL is:

`https://book4berel.github.io/rock-paper-scissors/`

The allowed redirect URLs include the GitHub Pages site and `http://localhost:8000/**` for local testing.

## Create the admin account

Before announcing the game, create and confirm the `berel` account through the game’s sign-up form. Then, in Supabase SQL Editor, confirm the username and grant the admin role:

```sql
select id, username, role from public.profiles where username = 'berel';
update public.profiles set role = 'admin' where username = 'berel';
```

Sign out and back in as `berel`; the admin account-management panel should appear. Supabase Auth manages passwords. Do not share passwords or store them in this repository.

## Enable GitHub Pages

In the repository settings, enable Pages from the `main` branch and `/ (root)`. The public site URL is `https://book4berel.github.io/rock-paper-scissors/`.

For a public launch, configure an SMTP provider, review Supabase Auth rate limits and CAPTCHA protection, and test signup, email confirmation, username/email sign-in, password reset, and admin account management end to end.

## Account and stats notes

Player passwords are managed by Supabase Auth, and database access is restricted by row-level security. Match results are calculated in the browser, so this version does not provide cheat-resistant competitive rankings.
