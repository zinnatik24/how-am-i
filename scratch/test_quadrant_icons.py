svg_content = '''<svg width="400" height="120" viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg" style="background:#0A0D12">
  <!-- 1. Red 10-pointed star / thorn -->
  <g transform="translate(30, 25)">
    <path d="M 12.00,1.20 L 13.61,7.15 L 18.47,3.30 L 16.21,9.04 L 22.36,8.75 L 17.20,12.00 L 22.36,15.25 L 16.21,14.96 L 18.47,20.70 L 13.61,16.85 L 12.00,22.80 L 10.39,16.85 L 5.53,20.70 L 7.79,14.96 L 1.64,15.25 L 6.80,12.00 L 1.64,8.75 L 7.79,9.04 L 5.53,3.30 L 10.39,7.15 Z" fill="#EF4444" stroke="#EF4444" stroke-width="0.8" stroke-linejoin="round"/>
    <text x="12" y="38" fill="#EF4444" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="700">КРАСНАЯ ЗВЕЗДА</text>
  </g>

  <!-- 2. Green cloudy heart -->
  <g transform="translate(130, 25)">
    <path d="M12 21.2 C11 20.2 4.2 14.8 2.5 11.2 C1.1 8.2 2.2 4.8 5.4 4.1 C7.8 3.6 10.2 4.7 12 6.8 C13.8 4.7 16.2 3.6 18.6 4.1 C21.8 4.8 22.9 8.2 21.5 11.2 C19.8 14.8 13 20.2 12 21.2 Z" fill="#10B981"/>
    <circle cx="6.5" cy="7.5" r="3.2" fill="#10B981"/>
    <circle cx="10" cy="5.8" r="2.8" fill="#10B981"/>
    <circle cx="14" cy="5.8" r="2.8" fill="#10B981"/>
    <circle cx="17.5" cy="7.5" r="3.2" fill="#10B981"/>
    <circle cx="19.2" cy="11.2" r="2.8" fill="#10B981"/>
    <circle cx="4.8" cy="11.2" r="2.8" fill="#10B981"/>
    <text x="12" y="38" fill="#10B981" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="700">ОБЛАЧНОЕ СЕРДЦЕ</text>
  </g>

  <!-- 3. Yellow cloudy lightning / charge -->
  <g transform="translate(230, 25)">
    <path d="M13.8 1.8 C14.6 1.8 15.2 2.5 15.0 3.3 L13.8 8.2 H18.8 C19.6 8.2 20.1 9.0 19.8 9.7 L11.2 22.2 C10.6 23.1 9.4 22.5 9.6 21.5 L11.0 15.2 H5.8 C5.0 15.2 4.5 14.3 4.9 13.6 L12.4 2.2 C12.7 1.9 13.2 1.8 13.8 1.8 Z" fill="#F59E0B" stroke="#F59E0B" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>
    <text x="12" y="38" fill="#F59E0B" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="700">ОБЛАЧНЫЙ ЗАРЯД</text>
  </g>

  <!-- 4. Blue cloudy ring -->
  <g transform="translate(330, 25)">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M 12 3 C 14.8 3 17.2 4.4 18.5 6.6 C 21 7.2 22.8 9.4 22.8 12 C 22.8 14.6 21 16.8 18.5 17.4 C 17.2 19.6 14.8 21 12 21 C 9.2 21 6.8 19.6 5.5 17.4 C 3 16.8 1.2 14.6 1.2 12 C 1.2 9.4 3 7.2 5.5 6.6 C 6.8 4.4 9.2 3 12 3 Z M 12 8.2 C 9.9 8.2 8.2 9.9 8.2 12 C 8.2 14.1 9.9 15.8 12 15.8 C 14.1 15.8 15.8 14.1 15.8 12 C 15.8 9.9 14.1 8.2 12 8.2 Z" fill="#3B82F6"/>
    <text x="12" y="38" fill="#3B82F6" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="700">ОБЛАЧНОЕ КОЛЬЦО</text>
  </g>
</svg>'''

with open('scratch/quadrant_icons_test.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)
print('Generated scratch/quadrant_icons_test.svg')
