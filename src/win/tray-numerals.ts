type Point = readonly [x: number, y: number];
type Curve = readonly [controlX: number, controlY: number, endX: number, endY: number];
type Stroke = readonly [Point, ...(Point | Curve)[]];

// Rounded, open numerals drawn as strokes in a 7-unit cap height. Each stroke
// starts at a point, followed by line endpoints or quadratic curve commands.
const numerals: Record<string, { width: number; strokes: readonly Stroke[] }> = {
  "0": { width: 4.2, strokes: [[[2.1, 0], [4.2, 0, 4.2, 2.25], [4.2, 4.75], [4.2, 7, 2.1, 7],
    [0, 7, 0, 4.75], [0, 2.25], [0, 0, 2.1, 0]]] },
  "1": { width: 2, strokes: [[[0, 1.35], [1.6, 0], [1.6, 7]]] },
  "2": { width: 4.2, strokes: [[[0, 1.45], [0.2, 0, 2.05, 0], [4.2, 0, 4.2, 1.75], [4.2, 2.85, 3.05, 3.8],
    [0, 6.5], [0, 7], [4.2, 7]]] },
  "3": { width: 4.2, strokes: [[[0.15, 1], [0.65, 0, 2.15, 0], [4.15, 0, 4.15, 1.7], [4.15, 3.35, 2.2, 3.35], [1.35, 3.35]],
    [[2.2, 3.35], [4.35, 3.35, 4.35, 5.2], [4.35, 7, 2.15, 7], [0.6, 7, 0, 5.95]]] },
  "4": { width: 4.35, strokes: [[[3.3, 7], [3.3, 0], [0, 4.65], [4.35, 4.65]]] },
  "5": { width: 4.2, strokes: [[[4, 0], [0.55, 0], [0.3, 3.45], [1, 2.95, 2.1, 2.95],
    [4.2, 2.95, 4.2, 4.95], [4.2, 7, 2, 7], [0.55, 7, 0, 5.95]]] },
  "6": { width: 4.2, strokes: [[[3.9, 0.85], [3.5, 0, 2.3, 0], [0, 0, 0, 3.25], [0, 4.8], [0, 7, 2.1, 7],
    [4.2, 7, 4.2, 4.95], [4.2, 2.95, 2.15, 2.95], [0.8, 2.95, 0, 4.05]]] },
  "7": { width: 4.15, strokes: [[[0, 0], [4.15, 0], [1.25, 7]]] },
  "8": { width: 4.3, strokes: [[[2.15, 0], [4.05, 0, 4.05, 1.65], [4.05, 3.35, 2.15, 3.35],
    [0.25, 3.35, 0.25, 1.65], [0.25, 0, 2.15, 0]], [[2.15, 3.35], [4.3, 3.35, 4.3, 5.15],
    [4.3, 7, 2.15, 7], [0, 7, 0, 5.15], [0, 3.35, 2.15, 3.35]]] },
  "9": { width: 4.2, strokes: [[[0.3, 6.15], [0.7, 7, 1.95, 7], [4.2, 7, 4.2, 3.75], [4.2, 2.2],
    [4.2, 0, 2.1, 0], [0, 0, 0, 2.05], [0, 4.05, 2.05, 4.05], [3.4, 4.05, 4.2, 2.95]]] },
  "–": { width: 4, strokes: [[[0, 3.5], [4, 3.5]]] },
};

type Segment = { x: number; y: number; dx: number; dy: number; inverseLengthSquared: number };
const radius = 0.78;

function segments(strokes: readonly Stroke[], offset: number): Segment[] {
  const result: Segment[] = [];
  for (const stroke of strokes) {
    let [start, ...commands] = stroke;
    function lineTo([endX, endY]: Point) {
      const [x, y] = start;
      const dx = endX - x, dy = endY - y;
      result.push({ x: x + offset, y, dx, dy, inverseLengthSquared: 1 / (dx * dx + dy * dy) });
      start = [endX, endY];
    }
    for (const command of commands) {
      if (command.length === 2) {
        lineTo(command);
        continue;
      }
      const [x0, y0] = start;
      const [cx, cy, x1, y1] = command;
      for (let step = 1; step <= 6; step++) {
        const t = step / 6, rest = 1 - t;
        lineTo([rest * rest * x0 + 2 * rest * t * cx + t * t * x1,
          rest * rest * y0 + 2 * rest * t * cy + t * t * y1]);
      }
    }
  }
  return result;
}

export function trayNumerals(label: string, centerX: number, centerY: number, maxWidth: number, scaleY: number) {
  const glyphs = [...label].map(digit => numerals[digit]);
  const spacing = 2.35;
  const width = glyphs.reduce((sum, glyph) => sum + glyph.width, 0) + spacing * (glyphs.length - 1);
  const scaleX = Math.min(scaleY, maxWidth / (width + 2 * radius));
  const left = centerX - width * scaleX / 2;
  const top = centerY - 3.5 * scaleY;
  let offset = 0;
  const drawings = glyphs.map(glyph => {
    const drawing = { left: offset - radius, right: offset + glyph.width + radius, segments: segments(glyph.strokes, offset) };
    offset += glyph.width + spacing;
    return drawing;
  });

  return (x: number, y: number): boolean => {
    const glyphX = (x - left) / scaleX;
    const glyphY = (y - top) / scaleY;
    if (glyphY < -radius || glyphY > 7 + radius) return false;
    for (const glyph of drawings) {
      if (glyphX < glyph.left || glyphX > glyph.right) continue;
      for (const segment of glyph.segments) {
        const dx = glyphX - segment.x, dy = glyphY - segment.y;
        const t = Math.max(0, Math.min(1, (dx * segment.dx + dy * segment.dy) * segment.inverseLengthSquared));
        const px = dx - t * segment.dx, py = dy - t * segment.dy;
        if (px * px + py * py <= radius * radius) return true;
      }
      break;
    }
    return false;
  };
}
