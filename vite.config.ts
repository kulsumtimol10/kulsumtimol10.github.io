import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages cannot send custom security headers, so the built page carries its policy as meta tags.
// Scripts may only come from the site itself; the only third party is Google Fonts.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

// Build only: the dev server injects inline scripts for hot reload, which this policy would block.
// Inserted straight after the charset, so it governs every script and stylesheet that follows.
function securityMeta(): Plugin {
  const tags = `\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`;
  return {
    name: 'security-meta',
    apply: 'build',
    transformIndexHtml(html) {
      const charset = '<meta charset="UTF-8" />';
      if (!html.includes(charset)) throw new Error('security-meta: charset tag not found in index.html');
      return html.replace(charset, charset + tags);
    },
  };
}

// Relative base so the build works on GitHub Pages under any repo name.
export default defineConfig({
  base: './',
  plugins: [react(), securityMeta()],
  server: { port: 5173 },
});
