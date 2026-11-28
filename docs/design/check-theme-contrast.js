const fs = require('node:fs');
const path = require('node:path');
const tokenCss = fs.readFileSync(path.join(__dirname, '..', '..', 'tokens.css'), 'utf8');
const paletteBlocks = {
  Daylight: tokenCss.match(/:root,\s*\.palette-daylight\s*\{([^}]+)\}/)?.[1],
  'Dino Night': tokenCss.match(/\.palette-night\s*\{([^}]+)\}/)?.[1],
  Aurora: tokenCss.match(/\.palette-aurora\s*\{([^}]+)\}/)?.[1],
  Ember: tokenCss.match(/\.palette-ember\s*\{([^}]+)\}/)?.[1],
  'Dino Green': tokenCss.match(/\.palette-green\s*\{([^}]+)\}/)?.[1],
};

function declarations(block) {
  return Object.fromEntries([...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

const palettes = Object.fromEntries(Object.entries(paletteBlocks).map(([name, block]) => {
  const tokens = declarations(block);
  return [name, {
    bg: tokens['bg-window'], surface: tokens['bg-elevated'], primary: tokens['text-primary'], secondary: tokens['text-secondary'],
    disabled: tokens['text-disabled'], accent: tokens.accent, onAccent: tokens['text-on-accent'],
    border: tokens['border-strong'], focus: tokens['focus-ring'],
  }];
}));
palettes['High contrast light'] = { bg: '#ffffff', surface: '#ffffff', primary: '#000000', secondary: '#111111', disabled: '#444444', accent: '#001fbb', onAccent: '#ffffff', border: '#000000', focus: '#001fbb' };
palettes['High contrast dark'] = { bg: '#000000', surface: '#000000', primary: '#ffffff', secondary: '#ffffff', disabled: '#cccccc', accent: '#ffeb3b', onAccent: '#000000', border: '#ffffff', focus: '#ffeb3b' };

function luminance(hex) {
  const normalized = hex.length === 4 ? `#${[...hex.slice(1)].map((value) => `${value}${value}`).join('')}` : hex;
  const rgb = normalized.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255).map((value) => (
    value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  ));
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

let failures = 0;
for (const [name, palette] of Object.entries(palettes)) {
  const checks = [
    ['primary text', palette.primary, palette.bg, 4.5],
    ['toast text', palette.primary, palette.surface, 4.5],
    ['secondary text', palette.secondary, palette.bg, 4.5],
    ['disabled text', palette.disabled, palette.bg, 4.5],
    ['accent label', palette.onAccent, palette.accent, 4.5],
    ['accent control', palette.accent, palette.bg, 3],
    ['strong boundary', palette.border, palette.bg, 3],
    ['focus indicator', palette.focus, palette.bg, 3],
  ];
  for (const [label, foreground, background, threshold] of checks) {
    const ratio = contrast(foreground, background);
    const pass = ratio >= threshold;
    if (!pass) failures += 1;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name} · ${label}: ${ratio.toFixed(2)}:1 (min ${threshold}:1)`);
  }
}
for (const wallpaperAccent of ['#45cfc1', '#fb8761', '#57bd79', '#45a7dc', '#d49a56']) {
  const bestLabel = Math.max(contrast('#ffffff', wallpaperAccent), contrast('#101522', wallpaperAccent));
  const pass = bestLabel >= 4.5;
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'} wallpaper accent ${wallpaperAccent} · readable label: ${bestLabel.toFixed(2)}:1 (min 4.5:1)`);
}
const checks = Object.keys(palettes).length * 8 + 5;
console.log(`${failures ? 'FAIL' : 'PASS'} ${checks} contrast checks · ${failures} failures`);
if (failures) process.exitCode = 1;
