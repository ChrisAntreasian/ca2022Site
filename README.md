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

To view the poems editor locally, enable the editor in your environment.

- Local editor route: `/poems/edit/new`
- Existing poem editor route: `/poems/edit/{poem_id}`
- Existing poem editor route with slug: `/poems/edit/{poem_id}/{poem_slug}`

Local setup:

1. Copy `.env.example` to `.env` if needed.
2. Start the app.
3. Set `ENABLE_CONTENT_EDITOR=true`.
4. Open the editor route.

The editor is gated by a server-side environment flag. If the flag is missing or set to any value other than `true`, the route returns `403`.
