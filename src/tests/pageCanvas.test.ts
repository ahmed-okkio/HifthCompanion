import { describe, it, expect } from 'vitest';
import { calculatePageCanvasSize } from '../lib/pageCanvas';

describe('calculatePageCanvasSize', () => {
  it('fits portrait image within maxWidth', () => {
    const result = calculatePageCanvasSize(500, 1000, 800, 1200);
    expect(result.width).toBe(600);
    expect(result.height).toBe(1200);
  });

  it('fits landscape image within maxWidth', () => {
    const result = calculatePageCanvasSize(1600, 900, 800, 1200);
    expect(result.width).toBe(800);
    expect(result.height).toBe(450);
  });

  it('scales down when height exceeds maxHeight', () => {
    const result = calculatePageCanvasSize(500, 2000, 800, 600);
    // aspect ratio 0.25 → width-first: 800×3200 → height > 600 → rescale by height
    // natural width = 600 * (500/2000) = 150 → clamped to minimum 280
    expect(result.height).toBe(600);
    expect(result.width).toBe(280);
  });

  it('preserves aspect ratio for square image', () => {
    const result = calculatePageCanvasSize(500, 500, 800, 800);
    expect(result.width).toBe(result.height);
  });

  it('enforces minimum width of 280', () => {
    const result = calculatePageCanvasSize(100, 10000, 200, 600);
    // very tall image → constrained by height 600 → width = 600*(100/10000) = 6 → min 280
    expect(result.width).toBe(280);
  });

  it('enforces minimum height of 280', () => {
    const result = calculatePageCanvasSize(10000, 100, 200, 50);
    // very wide → constrained by height 50 → width = 50*(10000/100)=5000 > maxWidth, clamp to maxWidth=200
    expect(result.height).toBe(280);
  });

  it('returns integer dimensions (Math.floor)', () => {
    const result = calculatePageCanvasSize(300, 700, 400, 1000);
    expect(result.width).toBe(Math.floor(result.width));
    expect(result.height).toBe(Math.floor(result.height));
  });

  it('quran page aspect ratio ~0.706 fits typical viewport', () => {
    // Typical quran page: ~800×1132 → ratio ≈ 0.707
    const result = calculatePageCanvasSize(800, 1132, 600, 900);
    const ratio = result.width / result.height;
    expect(ratio).toBeCloseTo(800 / 1132, 2);
    expect(result.width).toBeLessThanOrEqual(600);
    expect(result.height).toBeLessThanOrEqual(900);
  });
});
