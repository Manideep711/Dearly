import React from 'react';
// Shown while a scene's code or models are still arriving, so nobody
// stares at an empty dark frame. A single candle flame, breathing.
export default function SceneLoading({label = 'Lighting the candle…', overlay = false}) {
  return (
    <div className={overlay ? 'scene-loading scene-loading--overlay' : 'scene-loading'} role="status" aria-live="polite">
      <div className="scene-loading__flame" aria-hidden="true"><i /></div>
      <p>{label}</p>
    </div>
  );
}
