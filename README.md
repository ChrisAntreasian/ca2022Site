# Christopher Antreasians ART SITE

Built this silly thing with my blood and tears.

## Svelte

React is ok, now for something completely different.

Update to Svelte 5!

Yay!

### Updating site data

To get Around needed to pay too much for hosting a DB I am using SvelteKit to genearte static JSON files from Strapi. The steps are as follows.

- Update data in local Strapi App
- Run appropreate route build script ({page}/build/{buildKey})
- Test and confirm updates
- Commit updates and push to Git
- Export Raw Json from Strapi
- Add to Backup repo and push it to Git

### Local editor config

To view the poems editor locally, add a `CONTENT_EDIT_KEY` to your environment.

- Local editor route: `/poems/edit/new`
- Existing poem editor route: `/poems/edit/{poem_id}`

Local setup:

1. Copy `.env.example` to `.env` if needed.
2. Start the app.
3. Open the editor route.
4. Enter the configured edit key to unlock edit mode.

The editor uses a server-only key and an httpOnly cookie. The current implementation is owner-only and intended for local/dev use until a fuller auth flow is added.
