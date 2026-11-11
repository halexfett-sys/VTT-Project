/**
 * "Fit whole image" in a circular token: shrink the picture so its corners stay inside the circle,
 * otherwise a square or wide picture still has its corners clipped. 1 means no extra shrink (square tokens).
 */
export const containCircleFactor = (w: number, h: number) =>
  w > 0 && h > 0 ? Math.max(w, h) / Math.hypot(w, h) : 1;
