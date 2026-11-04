import {compositeInk} from './ink';
// Bake the selected Shaders.com Paper effect into the existing Three.js texture.
// The original canvas stays visible until a nonempty GPU frame is available.
export async function enhancePaper(texture, cancelled) {
  if (!navigator.gpu) return;
  const { createShader } = await import('shaders/js');
  if (cancelled()) return;
  const source = texture.userData.paperBase || texture.image;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  let shader;
  try {
    shader = await createShader(canvas, {
      components: [{ type: 'Paper', id: 'paper-fibers', props: {
        roughness: .32, grainScale: 1.45, displacement: .1, seed: 17
      }, children: [{ type: 'ImageTexture', id: 'letter-image', props: {
        url: source.toDataURL('image/png'), objectFit: 'fill'
      }}] }]
    }, { observeElement: false, disableTelemetry: true, colorSpace: 'srgb' });
    shader.resize(source.width, source.height);
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    for (let frame = 0; frame < 120; frame++) {
      if (cancelled() || shader.getFailureReason()) return;
      await new Promise(requestAnimationFrame);
      ctx.clearRect(0, 0, copy.width, copy.height);
      ctx.drawImage(canvas, 0, 0);
      const center = ctx.getImageData(copy.width / 2, copy.height / 2, 1, 1).data;
      if (center[3] > 250 && center[0] + center[1] + center[2] > 30) {
        shader.pause();
        if (!cancelled()) {
          if (texture.userData.ink) compositeInk(ctx,texture.userData.ink);
          texture.image = copy;
          texture.needsUpdate = true;
          console.info('Dearly: Shaders.com Paper texture ready');
        }
        return;
      }
    }
  } finally {
    shader?.destroy();
  }
}
