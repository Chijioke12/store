import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Serve static files from the root directory so index.html, /src, and /public are accessible
app.use(express.static(__dirname));

app.listen(port, () => {
  console.log(`Development server running at http://localhost:${port}`);
});
