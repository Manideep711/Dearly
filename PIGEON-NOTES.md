# Pigeon animation inspection

Source: https://sketchfab.com/3d-models/pigeon-821135a09d3f48909b977a416d99c93b
Creator: LostBoyz2078 (LostModels2025)
License: CC BY-NC 4.0, https://creativecommons.org/licenses/by-nc/4.0/
Original downloaded GLB extracted unchanged from pigeon.zip.

One clip, Take 001, 90.6667 seconds, 116 joints.

Browser-verified sample poses (not final clip boundaries):
- 10 seconds: horizontal flight, feet tucked.
- 20 seconds: upright, wings partly spread; transition candidate.
- 30 seconds: standing.
- 40, 50, 60 seconds: preening / grooming.
- 70 seconds: crouched, transition candidate.
- 80 and 90 seconds: flight.

No feeding sequence confirmed. Exact takeoff/landing boundaries and seamless loop endpoints remain to be identified with continuous playback.

pigeon.html provides playback, scrubbing, orbit controls, and a prototype capsule parented to L_leg_077. Capsule placement and scale remain provisional.

This inspection is local only. The live letter website has not been changed.

## User-supplied timing map

All times are decimal seconds as displayed by the inspector.
- Initial wings-open pose at 0: skip; begin at 0.04.
- Walk: 0.04–3.20.
- Takeoff / flight: 3.23–13.50 (margin before unwanted section).
- Exclude 13.55–17.02: death sequence.
- Approach / landing: 17.08–21.60. User notes touchdown around 19.02; screenshot at 19.18 still shows spread wings, so retain settling motion.
- Feed / peck: 21.68–approximately 34. Endpoint provisional.
- Idle / grooming: approximately 34–69. Use 34.04–68.90 provisionally.
- Exclude 69–71 death sequence; leave all 69–79 unused until classified.
- Flight: 79–90.

pigeon-clips.js extracts named clips with interpolated boundary poses. Loop flags are intended playback modes, not a claim of seamless endpoints. Final scene needs cross-fade checks.

## Follow-up visual boundary checks
- 17.08: normal horizontal flight; clear of the previous death pose.
- 19.02: wings still spread during landing.
- 20.80: standing with folded wings. Revised landing end to 20.80.
- 21.60, 21.68, 26.00: head-down pecking poses.
- 34.00: upright again; feeding is not a seamless hard loop.
- 68.90: scratching with foot raised; idle is not a seamless hard loop.
- 79.00: standing, not yet flight. Revised flight start to 80.00 based on verified flight pose there.
Feed, idle and flight now default to one-shot pending blend/loop preparation. These checks verify sampled poses, not every intervening frame or all transition playback.
