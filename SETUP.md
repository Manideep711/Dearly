# Setup and running

## Windows

Install Node.js from https://nodejs.org/ and reopen your terminal afterward. Right-click the extracted project folder and choose Open in Terminal. Run:

```sh
npm ci
npm run dev
```

If PowerShell blocks npm.ps1, use `npm.cmd ci` and `npm.cmd run dev` instead. If a port is occupied, Vite prints the next available port. Use the printed address.

## Test on your phone over Wi-Fi

Your phone and laptop must be on the same network. Run:

```sh
npm run dev -- --host 0.0.0.0
```

Open the Network URL printed by Vite on your phone. If necessary, allow Node.js through Windows Firewall for your private network. localhost and 127.0.0.1 on your phone refer to the phone, not the laptop. Stop the dev server when finished. Clipboard copying may be restricted on plain HTTP; HTTPS hosting is best for sharing.

The hosted snapshot is currently public:
https://dearly-letter-atelier.veerasimha69.chatgpt.site

## Production hosting

Run `npm run build`. Upload the contents of dist to a static host such as a static-site hosting service. The build entry is index.html. No server database or secrets are required. Keep public/models/pigeon.glb and public/papers in the project before building. The optional .openai/hosting.json belongs to the existing Sites deployment; it is not needed for local use or other hosts. Do not reuse its project ID to create a different site.

## Troubleshooting

- Blank 3D view: enable browser hardware acceleration, use a recent browser, and inspect browser console errors.
- Fonts differ: fonts load from Google Fonts and need internet. For offline use, self-host the fonts under their licenses and update style.css.
- Missing model or images: run through Vite, not by double-clicking index.html. Verify the public folder was extracted.
- Installation fails: check Node version and network access, then retry npm ci. Do not remove package-lock.json as the first fix.
- Large bundle warning during build: expected for the current Three.js bundle; the build still completes.
- Slowness: use hardware acceleration; lower Canvas dpr/shadow sizes if targeting weaker devices. Detailed ink processing is reserved for preview, not every typing keystroke.
