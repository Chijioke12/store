const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const distDir = path.join(__dirname, 'dist');
const buildDir = path.join(__dirname, 'build-omnisd');
const appZipPath = path.join(buildDir, 'application.zip');
const finalZipPath = path.join(__dirname, 'oks-omnisd.zip');
const manifestPath = path.join(distDir, 'manifest.webapp');

if (!fs.existsSync(distDir)) {
  console.error(`Error: Cannot find ${distDir}. Be sure to build the app first.`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  console.error(`Error: Cannot find manifest.webapp in ${distDir}.`);
  process.exit(1);
}

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Get the origin from manifest
const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let origin = manifestContent.origin || 'app://oks';
if (origin.endsWith('/')) {
  origin = origin.slice(0, -1);
}

const metadataContent = {
  version: 1,
  manifestURL: `${origin}/manifest.webapp`
};

fs.writeFileSync(
  path.join(buildDir, 'metadata.json'),
  JSON.stringify(metadataContent, null, 2)
);

// Function to zip directory
function zipDirectory(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(outPath);

    return new Promise((res, rej) => {
      archive
        .directory(sourceDir, false)
        .on('error', err => reject(err))
        .pipe(stream)
      ;

      stream.on('close', () => resolve());
      archive.finalize();
    });
  });
}

// Function to zip files
function zipFiles(filesMap, outPath) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(outPath);

    archive.on('error', err => reject(err));
    stream.on('close', () => resolve());
    
    archive.pipe(stream);
    
    for (const [name, filePath] of Object.entries(filesMap)) {
      archive.file(filePath, { name });
    }
    
    archive.finalize();
  });
}

async function packageApp() {
  try {
    console.log('Creating application.zip...');
    await zipDirectory(distDir, appZipPath);
    
    console.log('Creating OmniSD package...');
    await zipFiles({
      'application.zip': appZipPath,
      'metadata.json': path.join(buildDir, 'metadata.json')
    }, finalZipPath);
    
    console.log(`Successfully created OmniSD package: ${finalZipPath}`);
  } catch (err) {
    console.error('Error creating package:', err);
  }
}

packageApp();
