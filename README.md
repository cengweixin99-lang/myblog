# myblog

A GitHub-Issues-driven personal site built with:

- `scripts/fetch_issues.ts` for content generation
- `Zola` for static rendering
- `GitHub Actions` for build and deploy

## Current architecture

- `scripts/`
  Pulls authored GitHub issues and comments, then generates Zola content files.
- `site/`
  The actual static site source: templates, styles, config, and generated content.
- `.github/workflows/build-site.yml`
  Rebuilds the site on issue and comment changes, then deploys to GitHub Pages.

## Important directories

- `scripts/fetch_issues.ts`
- `site/templates/`
- `site/static/site.css`
- `site/content/_index.md`

## Local workflow

```powershell
pnpm run fetch:issues
cd site
zola build
zola serve
```

## Notes

- `site/public/` is build output and should not be edited manually.
- `site/content/tags/`, `site/content/*.md`, and `site/data/navigation.toml` are generated content.
