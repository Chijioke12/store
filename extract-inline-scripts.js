import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf-8');
  let counter = 0;
  
  // Extract inline scripts to external files for KaiOS CSP compliance
  html = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, content) => {
    // Skip scripts that already have a src attribute or are empty
    // Use a more precise check for src attribute to avoid matching data-src
    if (/\ssrc\s*=/i.test(attrs) || content.trim().length === 0) {
      return match;
    }

    counter++;
    const fileName = `inline-script-${counter}.js`;
    const filePath = path.join(distDir, fileName);
    fs.writeFileSync(filePath, content.trim(), 'utf-8');
    
    console.log(`  - Extracted inline script ${counter} to ${fileName}`);
    
    // Return script tag with src attribute and no inline content
    return `<script${attrs} src="./${fileName}"></script>`;
  });
  
  // Fix absolute paths to relative paths for KaiOS app environment
  // This ensures assets are loaded correctly regardless of the app's install origin
  html = html.replace(/(src|href|data-src)="\/assets\//g, '$1="./assets/');
  
  // Also remove crossorigin attributes as KaiOS 2.5 doesn't need them for local files
  html = html.replace(/\scrossorigin(="")?/g, '');
  
  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log(`✅ CSP Fix: Extracted ${counter} inline scripts and corrected asset paths.`);
} else {
  console.error('❌ Error: dist/index.html not found! Run "npm run build" first.');
  process.exit(1);
}
