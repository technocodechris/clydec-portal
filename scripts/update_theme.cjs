const fs = require('fs');
const cssPath = 'src/App.css';
let css = fs.readFileSync(cssPath, 'utf8');

const colorMap = {
  ink: 'rgba(10, 12, 16, 0.85)',
  ink2: 'rgba(18, 22, 31, 0.9)',
  inkBorder: 'rgba(212, 175, 55, 0.2)',
  cream: '#090A0F',
  line: 'rgba(212, 175, 55, 0.18)',
  text: '#FFFFFF',
  mute: 'rgba(255, 255, 255, 0.6)',
  events: '#D4AF37',
  eventsSoft: 'rgba(212, 175, 55, 0.15)',
  eventsText: '#F3E5AB',
  products: '#C59B27',
  productsSoft: 'rgba(197, 155, 39, 0.15)',
  productsText: '#F3E5AB',
  media: '#D4AF37',
  mediaSoft: 'rgba(212, 175, 55, 0.15)',
  mediaText: '#FFFFFF',
  success: '#4ADE80',
  successSoft: 'rgba(74, 222, 128, 0.15)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.15)',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.15)',
  gold: '#D4AF37',
  goldSoft: 'rgba(212, 175, 55, 0.18)'
};

const lightColorMap = {
  ink: 'rgba(255, 255, 255, 0.95)',
  ink2: 'rgba(250, 250, 250, 0.9)',
  inkBorder: 'rgba(0, 0, 0, 0.1)',
  cream: '#F7F9FC',
  line: 'rgba(0, 0, 0, 0.1)',
  text: '#1A202C',
  mute: 'rgba(0, 0, 0, 0.6)',
  events: '#3182CE',
  eventsSoft: 'rgba(49, 130, 206, 0.15)',
  eventsText: '#2B6CB0',
  products: '#2B6CB0',
  productsSoft: 'rgba(43, 108, 176, 0.15)',
  productsText: '#2A4365',
  media: '#3182CE',
  mediaSoft: 'rgba(49, 130, 206, 0.15)',
  mediaText: '#1A202C',
  success: '#48BB78',
  successSoft: 'rgba(72, 187, 120, 0.15)',
  warning: '#ED8936',
  warningSoft: 'rgba(237, 137, 54, 0.15)',
  danger: '#E53E3E',
  dangerSoft: 'rgba(229, 62, 62, 0.15)',
  gold: '#3182CE',
  goldSoft: 'rgba(49, 130, 206, 0.15)'
};

let rootVars = '';
for (let key in colorMap) {
  rootVars += '  --color-' + key + ': ' + colorMap[key] + ';\n';
}

let lightVars = '';
for (let key in lightColorMap) {
  lightVars += '  --color-' + key + ': ' + lightColorMap[key] + ';\n';
}

css = css.replace(':root {', ':root {\n' + rootVars);
css = css.replace('[data-theme="light"] {', '[data-theme="light"] {\n' + lightVars);

fs.writeFileSync(cssPath, css);
console.log('App.css updated with color maps');

const appPath = 'src/App.jsx';
let app = fs.readFileSync(appPath, 'utf8');

// Replace COLORS.something with "var(--color-something)"
app = app.replace(/COLORS\.([a-zA-Z0-9_]+)/g, "'var(--color-$1)'");

fs.writeFileSync(appPath, app);
console.log('App.jsx updated with CSS variables');
