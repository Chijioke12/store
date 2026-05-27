import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import babel from '@babel/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_DIR = path.join(__dirname, 'build-omnisd');
const DIST_DIR = path.join(__dirname, 'dist');
const APP_DIR = path.join(DIST_DIR); 

// Reset dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

const ASSETS_DIR = path.join(DIST_DIR, 'assets');
fs.mkdirSync(ASSETS_DIR, { recursive: true });

// Copy public assets
const copyRecursiveSync = (src, dest) => {
  const stats = fs.existsSync(src) ? fs.statSync(src) : null;
  if (stats && stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (stats) {
    fs.copyFileSync(src, dest);
  }
};

copyRecursiveSync(path.join(__dirname, 'public'), DIST_DIR);

// Transpile JS using Babel
const srcJs = path.join(__dirname, 'src', 'main.js');
const babelResult = babel.transformFileSync(srcJs, {
  presets: [
    ['@babel/preset-env', {
      targets: {
        firefox: '48' // KaiOS 2.5 uses Firefox 48 engine
      }
    }]
  ]
});

// Save transpiled JS
fs.writeFileSync(path.join(ASSETS_DIR, 'main.js'), babelResult.code, 'utf8');

// Copy CSS
const srcCss = path.join(__dirname, 'src', 'style.css');
fs.copyFileSync(srcCss, path.join(ASSETS_DIR, 'style.css'));

// Prepare index.html
const indexFileHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const processedHtml = indexFileHtml
  .replace('<link rel="stylesheet" href="/src/style.css">', '<link rel="stylesheet" href="./assets/style.css">')
  .replace('<script src="/src/compatibility.js"></script>', '<script src="./assets/compatibility.js"></script>')
  .replace('<script type="module" src="/src/main.js"></script>', '<script src="./assets/main.js"></script>');

fs.writeFileSync(path.join(DIST_DIR, 'index.html'), processedHtml, 'utf8');

// Copy compatibility.js
const srcCompatibility = path.join(__dirname, 'src', 'compatibility.js');
const babelResultCompat = babel.transformFileSync(srcCompatibility, {
  presets: [
    ['@babel/preset-env', {
      targets: {
        firefox: '48'
      }
    }]
  ]
});
fs.writeFileSync(path.join(ASSETS_DIR, 'compatibility.js'), babelResultCompat.code, 'utf8');

console.log('Build completed. Assets generated in dist folder.');
