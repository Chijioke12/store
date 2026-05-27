const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const crypto = require('crypto');

const distDir = path.join(__dirname, 'dist');
const htmlPath = path.join(distDir, 'index.html');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(htmlPath)) {
  console.error(`Error: Cannot find ${htmlPath}. Be sure to build the app first.`);
  process.exit(1);
}

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

let htmlContent = fs.readFileSync(htmlPath, 'utf8');
const $ = cheerio.load(htmlContent);

let modified = false;

$('script').each((index, element) => {
  const $el = $(element);
  const src = $el.attr('src');
  
  if (!src) {
    // This is an inline script
    const scriptContent = $el.html();
    
    if (scriptContent && scriptContent.trim() !== '') {
      // Generate a hash for the filename to ensure uniqueness
      const hash = crypto.createHash('md5').update(scriptContent).digest('hex').substring(0, 8);
      const filename = `inline-${index}-${hash}.js`;
      const filePath = path.join(assetsDir, filename);
      
      // Write the inline script to a file
      fs.writeFileSync(filePath, scriptContent);
      console.log(`Extracted inline script to assets/${filename}`);
      
      // Update the script tag to link the new file
      $el.empty(); // Remove the inline content
      $el.attr('src', `/assets/${filename}`);
      
      modified = true;
    }
  }
});

if (modified) {
  fs.writeFileSync(htmlPath, $.html());
  console.log('Modified index.html to remove inline scripts and link them instead.');
} else {
  console.log('No inline scripts found to extract.');
}
