# Sender finish — what changed

Dearly had a full receiver journey (pigeon delivery, capsule, unrolling,
line-by-line reading) but the writer's journey ended abruptly:
"Hold your letter" teleported the writer into the receiver's reading view,
and the share link only existed on the receiver side.

This change builds the missing sender half, reusing the project's own
letter texture renderer, paper system, pigeon model and animation clips —
so what the writer sends is exactly what the reader receives.

## The new flow

Writing desk → **Hold your letter** → "The Sending" scene:

1. **The rolling** — the actual letter sheet rolls itself up, using the
   receiver's unroll geometry in reverse.
2. **The capsule** — the scroll shrinks and slides into a brass capsule
   (the same capsule the reader finds on the pigeon's leg); the cap
   slides shut. Writer presses "Slide it into the capsule".
3. **The messenger** — the pigeon flies in (flight clip) and lands
   (approach-and-land clip), then idles with the project's clip map.
4. **Tie it to her leg** — the capsule flies to the pigeon's left leg and
   then tracks the leg bone's world position every frame, so it rides
   along when she moves.
5. **The departure** — "Send her off": takeoff-and-flight clip, she banks
   up and away with the capsule attached.
6. **Sent** — "Copy letter link" (the project's existing `#letter=` link
   encoding, unchanged), "See what they will see" (the previous preview
   behaviour), and "Write another letter" (clears greeting/body/sign-off/
   signature, keeps paper choices).

Every stage also has a "Skip to the letter link" escape, and
prefers-reduced-motion compresses all timings.

## Files

- `sender-send.jsx` — new. The whole flow: RollingLetter, CapsuleRig,
  SenderBird, SendScene, and the SenderSend screen with captions and the
  4-step progress (The rolling / The capsule / The messenger / The departure).
- `sender-send.css` — new. Layout glue only; buttons/brand/captions reuse
  style.css.
- `src.jsx` — small wiring only:
  - imports SenderSend;
  - new `sending` state; "Hold your letter" now opens the sending scene
    instead of jumping to the reading view;
  - the share-link builder was factored into `letterUrl()` and is shared
    by the receiver side and the sending scene (identical output).

Nothing else was touched: the writing desk, paper picker, letter layout/
render/ink pipeline, pigeon delivery, reading scene and share-link
format are all exactly as before. Letters sent with this build open in
the old build and vice versa.

## Verified

- `npm ci` + `npm run build` pass on the packaged source (the usual
  large-chunk warning for Three.js remains, as documented in SETUP.md),
  and the dev server serves the app (HTTP 200).
- NOT yet walkthrough-verified in a browser: the test environment could
  not reach the local dev server, so the desk → type → hold → roll →
  capsule → pigeon → tie → send-off → sent journey still needs a first
  run — `npm run dev`, write a letter, and click "Hold your letter".
  Report anything that stalls, and check the tie-on alignment noted below.

## Known limits / next polish

- Blocking positions (scroll-to-capsule alignment, capsule offset on the
  leg) were tuned from the model's known proportions, not from rendered
  screenshots on a real device — check the tie-on moment on a phone and
  nudge the offset in CapsuleRig if the capsule sits high or low.
- The bird stands at a fixed mark; a small walk toward the capsule before
  the tie (the walk clip exists) would sell the moment further.
- The sender scene loads the same 19.5 MB pigeon GLB; compressing that
  model (the receiver-entry fix) will speed this scene up too.

## Bonus fix included: the pigeon is 3x smaller

The receiver-entry problem from the review list, fixed along the way:
`public/models/pigeon.glb` is now 6.3 MB instead of 19.5 MB. Its three
4096x4096 PNG textures (12.4 MB of the file) were recompressed as WebP at
1024px — pixel statistics of every texture verified identical in tone to
the originals, no alpha channels were involved, and the animation data is
byte-for-byte the same layout. Same loader, same code paths; the original
19.5 MB model is unchanged in the source snapshot the user provided.

## GitHub repo notes

- Paper presets ship as WebP in this repo (same images, ~0.6 MB total
  instead of ~9.4 MB of PNG) and asset paths are prefixed with
  `import.meta.env.BASE_URL` with a relative Vite base, so one build
  works both at a domain root and under a Pages project path.
- Binary assets that must be present for a full run: `public/paper.jpg`,
  `public/papers/*.webp` (already here), and `public/models/pigeon.glb`.
