const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// SVG definition for a modern app store icon
const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#4facfe" />
      <stop offset="100%" stop-color="#00f2fe" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#bg)"/>
  <!-- Bag handle -->
  <path d="M 190 220 L 190 170 C 190 120 322 120 322 170 L 322 220" fill="none" stroke="#ffffff" stroke-width="36" stroke-linecap="round"/>
  <!-- Bag body -->
  <path d="M 120 220 L 392 220 C 410 220 420 235 415 250 L 380 410 C 375 430 360 440 340 440 L 172 440 C 152 440 137 430 132 410 L 97 250 C 92 235 102 220 120 220 Z" fill="#ffffff" stroke-linejoin="round"/>
  <!-- OKS for Open KaiStore -->
  <text x="256" y="355" font-family="sans-serif" font-weight="bold" font-size="90" fill="#00f2fe" text-anchor="middle">OKS</text>
</svg>`;

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const svgPath = path.join(publicDir, 'icon.svg');
const pngPath = path.join(publicDir, 'icon.png');

// Write the SVG file directly
fs.writeFileSync(svgPath, svgContent);
console.log('Created public/icon.svg successfully.');

async function generatePng() {
  let sharpAvailable = false;
  try {
    require.resolve('sharp');
    sharpAvailable = true;
  } catch (e) {
    // sharp is not installed
  }

  // 1. Try node-based generation using Sharp
  if (sharpAvailable) {
    try {
      const sharp = require('sharp');
      await sharp(svgPath)
        .resize(128, 128)
        .png()
        .toFile(pngPath);
      console.log('Created public/icon.png (128x128) using sharp.');
      return;
    } catch (err) {
      console.error('Sharp failed to process:', err.message);
    }
  } else {
    console.log('Sharp library not found. Falling back to ImageMagick...');
  }

  // 2. Fallback to ImageMagick command line tool
  try {
    // 'convert' is the classic ImageMagick command, 'magick' is used in IM v7
    // Using convert for broader compatibility
    execSync(`convert -background none -resize 128x128 "${svgPath}" "${pngPath}"`);
    console.log('Created public/icon.png (128x128) using ImageMagick.');
  } catch (err) {
    console.error('Failed to generate PNG using ImageMagick.', err.message);
    
    // Quick attempt with modern 'magick' command if 'convert' fails
    try {
      execSync(`magick -background none -resize 128x128 "${svgPath}" "${pngPath}"`);
      console.log('Created public/icon.png (128x128) using ImageMagick (magick command).');
    } catch (err2) {
      console.error('Fallback magick command also failed. Please convert the SVG into PNG manually if needed.');
    }
  }
}

generatePng();
