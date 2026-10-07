/**
 * Logos are given equal weight rather than equal height: a wordmark eight
 * times as wide as it is tall would otherwise tower over a shield, and capping
 * the width instead only moved the problem to the other end. Each one is drawn
 * to cover the same area, which is what the eye actually compares — with a
 * floor under the height, because the widest wordmarks would come out as a
 * thin line if area were all that counted.
 *
 * `area` is in CSS px²; the result is clamped so a very wide or very narrow
 * mark cannot run away with it.
 */
export const clientLogoHeight = (
  aspectRatio: number | null,
  opticalSize: number,
  { area = 3600, min = 26, max = 60 }: { area?: number; min?: number; max?: number } = {},
): number => {
  if (!aspectRatio) return max;

  // The nudge is on the size, so it goes into the area squared.
  const scaled = area * (opticalSize / 100) ** 2;
  const height = Math.sqrt(scaled / aspectRatio);
  return Math.round(Math.min(Math.max(height, min), max));
};
