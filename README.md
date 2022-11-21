# Christopher Antreasians ART SITE

Built this silly thing with my blood and tears. 
## Svelte

React is ok, now for something completely different.

Yay!

### Updating site data

To get Around needed to pay too much for hosting a DB I am using SvelteKit to genearte static JSON files from Strapi. The steps are as follows.

- Update data in local Strapi App
- Run appropreate route build script ({page}/build/{buildKey})
- Test and confirm updates
- Commit updates and push to Git
- Export Raw Json from Strapi
- Add to Backup repo and push it to Git
