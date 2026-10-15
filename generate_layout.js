// Script to generate organic bubble positions for the 4 quadrants on a 2000x2000 canvas
// Center origin is (1000, 1000).

const fs = require('fs');

const quads = ['high_unpleasant', 'high_pleasant', 'low_unpleasant', 'low_pleasant'];

// Layout specification for 36 bubbles per quadrant
// In each quadrant:
// 12 bubbles for intensity 1 (near origin: r 65..280)
// 12 bubbles for intensity 2 (mid distance: r 300..540)
// 12 bubbles for intensity 3 (outer distance: r 560..820)

function generateQuadrantPositions(quadrantId) {
  // Angle range in radians:
  // high_pleasant (Yellow): top-right, angle: -pi/2 to 0 (-90° to 0°)
  // low_pleasant (Green): bottom-right, angle: 0 to pi/2 (0° to 90°)
  // low_unpleasant (Blue): bottom-left, angle: pi/2 to pi (90° to 180°)
  // high_unpleasant (Red): top-left, angle: -pi to -pi/2 (-180° to -90°)

  let angleStart = 0;
  let angleEnd = Math.PI / 2;

  if (quadrantId === 'high_pleasant') {
    angleStart = -Math.PI / 2;
    angleEnd = 0;
  } else if (quadrantId === 'low_pleasant') {
    angleStart = 0;
    angleEnd = Math.PI / 2;
  } else if (quadrantId === 'low_unpleasant') {
    angleStart = Math.PI / 2;
    angleEnd = Math.PI;
  } else if (quadrantId === 'high_unpleasant') {
    angleStart = -Math.PI;
    angleEnd = -Math.PI / 2;
  }

  const cx = 1000;
  const cy = 1000;
  const positions = [];

  // Ring 1: Intensity 1 (12 bubbles)
  // 3 sub-rings of 4 bubbles each
  const r1Distances = [
    { r: 85, count: 3, size: 98 },
    { r: 185, count: 4, size: 92 },
    { r: 285, count: 5, size: 88 },
  ];

  let int1Count = 0;
  r1Distances.forEach((ring, ringIdx) => {
    const step = (angleEnd - angleStart) / (ring.count + 1);
    for (let i = 1; i <= ring.count; i++) {
      const angle = angleStart + step * i + (ringIdx % 2 === 0 ? 0.05 : -0.05);
      const x = Math.round(cx + Math.cos(angle) * ring.r);
      const y = Math.round(cy + Math.sin(angle) * ring.r);
      positions.push({ intensity: 1, x, y, size: ring.size });
      int1Count++;
    }
  });

  // Ring 2: Intensity 2 (12 bubbles)
  const r2Distances = [
    { r: 390, count: 5, size: 86 },
    { r: 500, count: 7, size: 84 },
  ];
  r2Distances.forEach((ring, ringIdx) => {
    const step = (angleEnd - angleStart) / (ring.count + 1);
    for (let i = 1; i <= ring.count; i++) {
      const angle = angleStart + step * i + (ringIdx % 2 === 0 ? -0.04 : 0.04);
      const x = Math.round(cx + Math.cos(angle) * ring.r);
      const y = Math.round(cy + Math.sin(angle) * ring.r);
      positions.push({ intensity: 2, x, y, size: ring.size });
    }
  });

  // Ring 3: Intensity 3 (12 bubbles)
  const r3Distances = [
    { r: 620, count: 6, size: 82 },
    { r: 740, count: 6, size: 80 },
  ];
  r3Distances.forEach((ring, ringIdx) => {
    const step = (angleEnd - angleStart) / (ring.count + 1);
    for (let i = 1; i <= ring.count; i++) {
      const angle = angleStart + step * i + (ringIdx % 2 === 0 ? 0.03 : -0.03);
      const x = Math.round(cx + Math.cos(angle) * ring.r);
      const y = Math.round(cy + Math.sin(angle) * ring.r);
      positions.push({ intensity: 3, x, y, size: ring.size });
    }
  });

  return positions;
}

const allPositions = {};
quads.forEach(q => {
  allPositions[q] = generateQuadrantPositions(q);
  console.log(q, allPositions[q].length);
});

fs.writeFileSync('./src/data/planeBubbleLayout.json', JSON.stringify(allPositions, null, 2));
console.log('Saved planeBubbleLayout.json successfully!');
