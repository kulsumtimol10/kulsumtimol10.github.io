# Kulsum Timol · Portfolio

**Live: https://kulsumtimol10.github.io**

Portfolio of Kulsum Timol, a full-stack developer in Toronto. Instead of a page of text, it is a 3D Toronto
waterfront that you explore: drag to look around the skyline, then scroll to spend a day in the city. Each
building is a chapter of her career, its lights switching on as you arrive, and Projects Lane is a brick lane
whose wall screens show her projects. The day ends at night over Lake Ontario.

Prefer a plain page? The **Recruiter view** button opens the whole resume on one screen.

## Built with

- React 18 and TypeScript, bundled with Vite
- Three.js: physically based sky and clouds, planar lake reflections, bloom, and a city generated in code
  (every texture is painted procedurally, so the site ships no image assets)
- Deployed to GitHub Pages by a GitHub Actions workflow

## Run locally

```bash
npm ci
npm run dev
```

`npm run build` writes the static site to `dist/`. Add `?quality=low` to the URL to force the lighter
rendering mode used on phones and slower GPUs.
