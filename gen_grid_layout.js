// Generate 6x6 grid layout for each of the 4 quadrants.
// The center of the plane is at (originX, originY).
// Total plane size = 1300 x 1300.
// Center is at (650, 650).
// Each quadrant is 6 rows by 6 columns (36 cells).
//
// Yellow (high_pleasant): Top-Right
//   cols: 0..5 (col 0 is next to vertical center, col 5 is far right)
//   rows: 0..5 (row 0 is next to horizontal center, row 5 is far top)
//   distance d = col + row.
//
// Green (low_pleasant): Bottom-Right
//   cols: 0..5 (col 0 is next to vertical center, col 5 is far right)
//   rows: 0..5 (row 0 is next to horizontal center, row 5 is far bottom)
//   distance d = col + row.
//
// Red (high_unpleasant): Top-Left
//   cols: 0..5 (col 0 is next to vertical center, col 5 is far left)
//   rows: 0..5 (row 0 is next to horizontal center, row 5 is far top)
//   distance d = col + row.
//
// Blue (low_unpleasant): Bottom-Left
//   cols: 0..5 (col 0 is next to vertical center, col 5 is far left)
//   rows: 0..5 (row 0 is next to horizontal center, row 5 is far bottom)
//   distance d = col + row.

const fs = require('fs');

const BUBBLE_SIZE = 82;
const GAP = 10;
const CELL_SIZE = BUBBLE_SIZE + GAP; // 92px
const CENTER_GAP = 16; // 16px gap between quadrants
const CANVAS_SIZE = 1320;
const ORIGIN = { x: 660, y: 660 };

// Order 36 cells by distance d = col + row (from 0 to 10)
// To break ties naturally: alternate diagonal traversal
const cells = [];
for (let r = 0; r < 6; r++) {
  for (let c = 0; c < 6; c++) {
    cells.push({ col: c, row: r, d: c + r });
  }
}

// Sort cells by distance from center corner (0,0)
cells.sort((a, b) => {
  if (a.d !== b.d) return a.d - b.d;
  // zigzag tie-breaker
  if (a.d % 2 === 0) return a.col - b.col;
  return a.row - b.row;
});

console.log('Cell distances from 0 to 35:');
cells.forEach((c, i) => {
  const intensity = i < 12 ? 1 : i < 24 ? 2 : 3;
  // console.log(`Index ${i}: col ${c.col}, row ${c.row}, dist ${c.d}, int ${intensity}`);
});

function getQuadrantSlots(quadrantId) {
  return cells.map((cell, idx) => {
    let px = 0;
    let py = 0;

    const offsetCenter = CENTER_GAP / 2 + BUBBLE_SIZE / 2;

    if (quadrantId === 'high_pleasant') {
      // Top-Right:
      // cell.col = 0 is closest to X center (+offsetCenter)
      // cell.row = 0 is closest to Y center (-offsetCenter)
      px = ORIGIN.x + offsetCenter + cell.col * CELL_SIZE;
      py = ORIGIN.y - offsetCenter - cell.row * CELL_SIZE;
    } else if (quadrantId === 'low_pleasant') {
      // Bottom-Right:
      // cell.col = 0 is closest to X center (+offsetCenter)
      // cell.row = 0 is closest to Y center (+offsetCenter)
      px = ORIGIN.x + offsetCenter + cell.col * CELL_SIZE;
      py = ORIGIN.y + offsetCenter + cell.row * CELL_SIZE;
    } else if (quadrantId === 'high_unpleasant') {
      // Top-Left:
      // cell.col = 0 is closest to X center (-offsetCenter)
      // cell.row = 0 is closest to Y center (-offsetCenter)
      px = ORIGIN.x - offsetCenter - cell.col * CELL_SIZE;
      py = ORIGIN.y - offsetCenter - cell.row * CELL_SIZE;
    } else if (quadrantId === 'low_unpleasant') {
      // Bottom-Left:
      // cell.col = 0 is closest to X center (-offsetCenter)
      // cell.row = 0 is closest to Y center (+offsetCenter)
      px = ORIGIN.x - offsetCenter - cell.col * CELL_SIZE;
      py = ORIGIN.y + offsetCenter + cell.row * CELL_SIZE;
    }

    return {
      x: Math.round(px),
      y: Math.round(py),
      size: BUBBLE_SIZE,
      distIndex: idx,
      distanceFromOrigin: cell.d,
    };
  });
}

let ts = `// 6x6 Grid Layout for 4 Quadrants (36 emotions each = 144 total)
// Center origin (0, 0) is at (660, 660)
// Total plane size = 1320 x 1320

export interface BubbleSlot {
  x: number;
  y: number;
  size: number;
  distanceFromOrigin: number;
}

export const PLANE_CANVAS_SIZE = 1320;
export const PLANE_ORIGIN = { x: 660, y: 660 };

export const QUADRANT_SLOTS: Record<string, BubbleSlot[]> = {
`;

['high_unpleasant', 'high_pleasant', 'low_unpleasant', 'low_pleasant'].forEach(q => {
  const slots = getQuadrantSlots(q);
  ts += `  ${q}: [\n`;
  slots.forEach(s => {
    ts += `    { x: ${s.x}, y: ${s.y}, size: ${s.size}, distanceFromOrigin: ${s.distanceFromOrigin} },\n`;
  });
  ts += `  ],\n`;
});

ts += `};\n`;

fs.writeFileSync('./src/data/planeLayout.ts', ts);
console.log('Successfully generated 6x6 grid in src/data/planeLayout.ts');
