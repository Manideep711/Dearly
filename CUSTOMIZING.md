# Customizing the project

- Add paper presets: add an image to public/papers and an entry to PAPERS in paper-picker.jsx. Use stable IDs because shared links store them.
- Change typography: update font loading in style.css and letter-render.jsx, canvas font use in ink.js and writing-desk.jsx, and measurement in letter-layout.js together. A mismatch causes wrapping differences.
- Change paper size or writing margins: edit PAGE in letter-layout.js and review world-to-page mapping in writing-desk.jsx and src.jsx.
- Change ink: letter.ink controls its pigment color; ink.js controls word variation, stroke reinforcement and the detailed absorption effect.
- Change focus softness: adjust band and radius in reading-material.jsx. Smaller band isolates fewer lines; larger radius blurs more. Keep the center readable.
- Change camera distance: src.jsx Scene computes close, aimY, and camera interpolation. Preserve aspect-ratio fitting on phones.
- Change pigeon timings: edit PIGEON_SEGMENTS in pigeon-clips.js and verify in /pigeon.html. Avoid the excluded death animation sections. Blend between clips rather than jumping time directly.
- Change UI: writing-desk.css contains the Hallmark polish and desk tokens. style.css handles the receiver UI. This is not yet a fully consolidated design system.

After changes, run npm run build and test writing, preview, link sharing, image upload, scrolling, and pigeon interactions in a real browser. Test phone performance on an actual device before launch.
