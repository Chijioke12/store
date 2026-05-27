const fs = require('fs');
const path = require('path');

const htmlFile = path.resolve('dist/index.html');
let html = fs.readFileSync(htmlFile, 'utf8');

// Identify scripts
const polyfillMatch = html.match(/src="(.*?polyfills-legacy.*?\.js)"/);
const entryMatch = html.match(/(?:data-src|src)="(.*?index-legacy.*?\.js)"/);
const polySrc = polyfillMatch ? polyfillMatch[1] : '';
const entrySrc = entryMatch ? entryMatch[1] : '';
const cssMatch = html.match(/href="(.*?index.*?\.css)"/);
const cssSrc = cssMatch ? cssMatch[1] : '';

// Save the system import logic to a separate file to avoid inline script CSP issues on KaiOS
const initScriptContent = `
(function() {
  var src = document.getElementById('vite-legacy-entry').getAttribute('src');
  if (window.System) { System.import(src).catch(console.error); }
})();
`;
fs.writeFileSync(path.resolve('dist/assets/init.js'), initScriptContent);

// Generate Clean KaiOS HTML
const cleanHtml = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#4facfe">
  <link rel="stylesheet" href="${cssSrc}">
</head>
<body>
  <div id="app"></div>
  <script src="${polySrc}"></script>
  <script id="vite-legacy-entry" src="${entrySrc}"></script>
  <script src="./assets/init.js"></script>
</body></html>`;

fs.writeFileSync(htmlFile, cleanHtml);
console.log('Modified index.html using clean legacy approach.');