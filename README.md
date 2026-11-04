# Dearly — source code

A React and Three.js letter-writing experience with vintage paper, a moving quill, animated pigeon delivery, and softly focused reading.

## Start here

1. Install Node.js 22 LTS or newer (includes npm): https://nodejs.org/
2. Extract this ZIP into a normal folder.
3. Open a terminal in the extracted `dearly-source` folder (the one containing package.json).
4. Run `npm ci` once to install the exact dependencies in package-lock.json.
5. Run `npm run dev`.
6. Open the Local address printed in the terminal (normally http://127.0.0.1:5173).

Keep the terminal running. Press Ctrl+C to stop. No API keys or database are needed.

## Other commands

- `npm run build` creates the production site in `dist`.
- `npx vite preview --host 127.0.0.1` previews that build locally.
- Open `/pigeon.html` on the dev server to inspect the pigeon animation timeline.

## Read next

- SETUP.md — Windows, phone testing, troubleshooting, and hosting.
- HOW-IT-WORKS.md — architecture, file guide, rendering, and data flow.
- CUSTOMIZING.md — change paper, handwriting, focus, and animations.
- ASSET-CREDITS.md — included assets and license limitations.
- PROJECT-STATUS.md — what is implemented and what remains.

This is a source snapshot, not an installed application. node_modules, build output, credentials, Git history, and private drafts are excluded. User drafts live in each browser, not in this ZIP.
