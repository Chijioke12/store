import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Serve static files from the root directory so index.html, /src, and /public are accessible
app.use(express.static(__dirname));

// Proxy or dynamically generate manifest files with correct content type for KaiOS installers
app.get('/api/manifest', async (req, res) => {
  // Enforce the correct MIME type required by KaiOS / Firefox OS
  res.setHeader('Content-Type', 'application/x-web-app-manifest+json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const targetUrl = req.query.url;

  // Case 1: Dynamic manifest generation on-the-fly using query params
  if (!targetUrl) {
    const name = req.query.name || 'App';
    const package_path = req.query.package_path;
    const version = req.query.version || '1.0.0';
    const developerName = req.query.developer || 'Unknown';

    if (!package_path) {
      return res.status(400).send(JSON.stringify({ error: 'Missing package_path parameter for dynamic manifest generation' }));
    }

    const miniManifest = {
      name: name,
      package_path: package_path,
      version: version,
      developer: {
        name: developerName
      }
    };

    return res.send(JSON.stringify(miniManifest));
  }

  // Case 2: Proxy an existing manifest URL to inject the correct MIME type
  try {
    const decUrl = decodeURIComponent(targetUrl);
    console.log(`Proxying manifest from: ${decUrl}`);
    
    const response = await fetch(decUrl);
    if (!response.ok) {
      // If direct fetch fails (e.g. 404), try raw.githubusercontent.com fallback if it was a github.io URL
      if (decUrl.includes('.github.io')) {
        const fallbackUrl = decUrl
          .replace(/https?:\/\/([^.]+)\.github\.io\/([^/]+)/, 'https://raw.githubusercontent.com/$1/$2/main');
        console.log(`Failed to fetch original URL. Trying github raw fallback: ${fallbackUrl}`);
        const fbResponse = await fetch(fallbackUrl);
        if (fbResponse.ok) {
          const manifestText = await fbResponse.text();
          return res.send(manifestText);
        }
      }
      return res.status(response.status).send(`Failed to fetch manifest: ${response.statusText}`);
    }

    const manifestText = await response.text();
    return res.send(manifestText);
  } catch (error) {
    console.error('Error proxying manifest:', error);
    return res.status(500).send(`Server error proxying manifest: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Development server running at http://localhost:${port}`);
});
