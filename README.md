# ColorStack at Georgia Tech

The website for the Georgia Tech chapter of [ColorStack](https://www.colorstack.org), a
national nonprofit increasing the number of Black and Latinx Computer Science graduates
who go on to start rewarding technical careers.

Students join the chapter here. Registration used to be a Google Form and a spreadsheet.

## What's in it

- **Landing page** with the chapter's mission and an email capture that starts sign up.
- **Become a Member**, the membership form.
- **Member log in**, passwordless. We email you a link, you click it, and you're in.

## Running it locally

You'll need [Bun](https://bun.com) and a free [Convex](https://convex.dev) account.

```bash
bun install
bun run dev:setup
```

`dev:setup` creates a Convex deployment for you and writes `apps/web/.env`. Then give the
deployment its secrets:

```bash
cd packages/backend
bun convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
bun convex env set SITE_URL http://localhost:3001
```

```bash
bun run dev
```

The site is on <http://localhost:3001>.

Sign in emails need a [Resend](https://resend.com) key. Without one you don't need to set
anything up. The sign in link is printed to the Convex console so you can click through
it locally.

That only happens when `SITE_URL` points at localhost. On any other deployment a missing
`RESEND_API_KEY` or `EMAIL_FROM` fails the send instead, because a printed sign in link is
a working credential and does not belong in a deployment's logs.

| Variable               | Where           | What it's for                              |
| ---------------------- | --------------- | ------------------------------------------ |
| `VITE_CONVEX_URL`      | `apps/web/.env` | Your Convex deployment                     |
| `VITE_CONVEX_SITE_URL` | `apps/web/.env` | The same deployment, `.convex.site`        |
| `SITE_URL`             | Convex          | Public origin, used to build sign in links |
| `BETTER_AUTH_SECRET`   | Convex          | Signing secret                             |
| `RESEND_API_KEY`       | Convex          | Sending sign in emails                     |
| `EMAIL_FROM`           | Convex          | Sender address on the chapter's own domain |

## How it's built

[TanStack Start](https://tanstack.com/start) for the frontend and server rendering,
[Convex](https://convex.dev) for the database and server functions,
[Better Auth](https://better-auth.com) for passwordless sign in, and Tailwind.

```
apps/web            pages, components, design system
packages/backend    database schema and server functions
packages/ui         shared component primitives
packages/env        environment variable validation
packages/infra      deployment
```

Colors, type, and spacing are defined once in `apps/web/src/index.css` and nothing else
hardcodes a value. Brand colors follow the official
[Georgia Tech palette](https://brand.gatech.edu/our-look/colors).

## Contributing

Chapter members are welcome. Open an issue or talk to the e-board about what needs doing.

Before you open a pull request:

```bash
bun run check
bun run check-types
```
