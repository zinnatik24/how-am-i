const fs = require('fs');

// We have 36 emotions in each quadrant in EMOTIONS array:
// 12 of intensity 1
// 12 of intensity 2
// 12 of intensity 3

const cx = 1100;
const cy = 1100;

// Angles for each quadrant:
// high_pleasant: -Math.PI / 2 (-90°) to 0 (0°)
// low_pleasant: 0 to Math.PI / 2 (90°)
// low_unpleasant: Math.PI / 2 (90°) to Math.PI (180°)
// high_unpleasant: -Math.PI (-180°) to -Math.PI / 2 (-90°)

const config = {
  high_pleasant: { start: -Math.PI / 2, end: 0 },
  low_pleasant: { start: 0, end: Math.PI / 2 },
  low_unpleasant: { start: Math.PI / 2, end: Math.PI },
  high_unpleasant: { start: -Math.PI, end: -Math.PI / 2 },
};

function getQuadrantSlots(quadrantId) {
  const { start, end } = config[quadrantId];
  const slots = [];

  // Ring 1 (Int 1, 3 bubbles)
  const r1 = 88;
  const count1 = 3;
  const step1 = (end - start) / (count1 + 1);
  for (let i = 1; i <= count1; i++) {
    const angle = start + step1 * i;
    slots.push({
      x: Math.round(cx + Math.cos(angle) * r1),
      y: Math.round(cy + Math.sin(angle) * r1),
      size: 104,
    });
  }

  // Ring 2 (Int 1, 4 bubbles)
  const r2 = 195;
  const count2 = 4;
  const step2 = (end - start) / (count2 + 1);
  for (let i = 1; i <= count2; i++) {
    const angle = start + step2 * i + 0.04;
    slots.push({
      x: Math.round(cx + Math.cos(angle) * r2),
      y: Math.round(cy + Math.sin(angle) * r2),
      size: 96,
    });
  }

  // Ring 3 (Int 1, 5 bubbles)
  const r3 = 300;
  const count3 = 5;
  const step3 = (end - start) / (count3 + 1);
  for (let i = 1; i <= count3; i++) {
    const angle = start + step3 * i - 0.03;
    slots.push({
      x: Math.round(cx + Math.cos(angle) * r3),
      y: Math.round(cy + Math.sin(angle) * r3),
      size: 90,
    });
  }

  // Ring 4 (Int 2, 5 bubbles)
  const r4 = 415;
  const count4 = 5;
  const step4 = (end - start) / (count4 + 1);
  for (let i = 1; i <= count4; i++) {
    const angle = start + step4 * i + 0.03;
    slots.push({
      x: Math.round(cx + Math.cos(angle) * r4),
      y: Math.round(cy + Math.sin(angle) * r4),
      size: 88,
    });
  }

  // Ring 5 (Int 2, 7 bubbles)
  const r5 = 530;
  const count5 = 7;
  const step5 = (end - start) / (count5 + 1);
  for (let i = 1; i <= count5; i++) {
    const angle = start + step5 * i - 0.02;
    slots.push({
      x: Math.round(cx + Math.cos(angle) * r5),
      y: Math.round(cy + Math.sin(angle) * r5),
      size: 86,
    });
  }

  // Ring 6 (Int 3, 6 bubbles)
  const r6 = 650;
  const count6 = 6;
  const step6 = (end - start) / (count6 + 1);
  for (let i = 1; i <= count6; i++) {
    const angle = start + step6 * i + 0.02;
    slots.push({
      x: Math.round(cx + Math.cos(angle) * r6),
      y: Math.round(cy + Math.sin(angle) * r6),
      size: 84,
    });
  }

  // Ring 7 (Int 3, 6 bubbles)
  const r7 = 775;
  const count7 = 6;
  const step7 = (end - start) / (count7 + 1);
  for (let i = 1; i <= count7; i++) {
    const angle = start + step7 * i - 0.02;
    slots.push({
      x: Math.round(cx + Math.cos(angle) * r7),
      y: Math.round(cy + Math.sin(angle) * r7),
      size: 82,
    });
  }

  return slots;
}

// Generate TS file
let ts = `// Generated coordinate layout for 144 emotions on 2200x2200 2D plane
// Center origin (0, 0) is at (1100, 1100)

export interface BubbleSlot {
  x: number;
  y: number;
  size: number;
}

export const PLANE_CANVAS_SIZE = 2200;
export const PLANE_ORIGIN = { x: 1100, y: 1100 };

export const QUADRANT_SLOTS: Record<string, BubbleSlot[]> = {
`;

['high_unpleasant', 'high_pleasant', 'low_unpleasant', 'low_pleasant'].forEach(q => {
  const slots = getQuadrantSlots(q);
  ts += `  ${q}: [\n`;
  slots.forEach(s => {
    ts += `    { x: ${s.x}, y: ${s.y}, size: ${s.size} },\n`;
  });
  ts += `  ],\n`;
});

ts += `};\n`;

fs.writeFileSync('./src/data/planeLayout.ts', ts);
console.log('Successfully written src/data/planeLayout.ts');
