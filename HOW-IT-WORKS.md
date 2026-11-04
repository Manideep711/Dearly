# How Dearly works

## Mental model

The app holds one `letter` object in React state. Writing controls update it. Both the desk and reading scene use the same layout and texture renderer, so line breaks, sizes, signatures, and background settings carry through.

The text is drawn onto a canvas, combined with the paper image, and uploaded as a texture on a 3D paper mesh. The writing view uses a lightweight ink pass. The reading view applies a more detailed ink treatment. Native transparent HTML inputs sit over the desk paper to accept keyboard input.

## File guide

| File | Purpose |
| --- | --- |
| src.jsx | App state, draft/link loading, receiver scenes, scrolling, reading camera, sharing |
| writing-desk.jsx / writing-desk.css | Sender's 3D desk, quill, ink bottle, editable inputs, signature, layout controls |
| paper-picker.jsx | Paper presets, custom image upload and compression, zoom, position, softening |
| letter-layout.js | Shared page dimensions, text wrapping, baselines, overflow and page-fill measurements |
| letter-render.jsx | Cached paper background and composited letter texture used by both views |
| ink.js | Word-level variation, ink distressing and compositing |
| reading-material.jsx | Focus band following the selected line, gradual blur and fine stationary grain |
| pigeon-delivery.jsx | Recipient pigeon state flow, feeding and interaction scene |
| pigeon-clips.js | Named animation segments cut from the model's long animation |
| physical.jsx | Wax and procedural surface helpers |
| style.css | Shared UI and receiver scene styles |
| pigeon-lab.jsx / pigeon.html | Separate model/animation inspection tool |
| public | Paper images and pigeon GLB model |
| paper-shader.js / ink-trace.js | Earlier experiments retained as source; not the current live writing pipeline |

## Reading effect

After unrolling, scroll enters reading mode and moves between lines. The camera moves modestly closer while following the selected line. A shader keeps a narrow area around that line clear and samples neighboring texture pixels to blur other areas. Grain is subtle and stationary to avoid flicker. This is an artistic line-focused blur, not a full scene depth-buffer optical simulation. Reduced-motion preference removes the interpolation for the camera and focus.

## Data and sharing

Without a letter hash, the app opens the sender desk and reads `dearly-sender-draft` from localStorage. Drafts are saved in that browser. A shared letter is JSON encoded into the `#letter=` URL fragment. It includes text, signature, paper preset and adjustments, and a compressed custom image when used. The receiver decodes it and opens the delivery scene.

There is no central inbox or storage service. Links are not encrypted, expiring, or revocable. Anyone given the full letter link can read it. Custom backgrounds make links longer; some messaging services can truncate long links. Presets avoid that image overhead. A public homepage does not automatically publish local drafts.

## Upload performance

Accepted images are JPG, PNG or WebP, up to 10 MB. They are resized and JPEG-compressed once in the browser, bounded to a small embedded data URL. Background compositing is cached independently of text typing. Zoom and position use a cover crop, so edges can be cropped depending on image aspect ratio.
