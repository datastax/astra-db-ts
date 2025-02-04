const fs = require('fs');

const regex = /^import.*from\s+(['"](?:decoders|\.{1,2}[^'"]*)['"]);\s*\n?/gm;

const filePath = process.argv[2];

if (!filePath) {
  throw new Error('no file path provided');
}

const fileContent = fs.readFileSync(filePath, 'utf8');
const updatedContent = fileContent.replace(regex, '');
fs.writeFileSync(filePath, updatedContent, 'utf8');
