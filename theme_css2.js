const fs = require('fs');
const path = require('path');

const replacements = [
  // Background Images
  { regex: /background:\s*linear-gradient[^;]+url\("\/assets\/img\/nF\.(png|jpg)"\)[^;]+;/gi, replacement: 'background-image: var(--bg-image); background-color: var(--bg-dark-main); background-size: cover; background-position: center center; background-attachment: fixed;' },
  { regex: /background:\s*rgba\([^;]+url\("\/assets\/img\/nF\.(png|jpg)"\)[^;]+;/gi, replacement: 'background-image: var(--bg-image); background-color: var(--bg-dark-main); background-size: cover; background-position: center center; background-attachment: fixed;' },
  
  // Specific RGBA Backgrounds that broke tables
  { regex: /rgba\(15,\s*23,\s*42,\s*0\.7\)/g, replacement: 'var(--bg-secondary)' },
  { regex: /rgba\(15,\s*23,\s*42,\s*0\.8\)/g, replacement: 'var(--bg-secondary)' },
  { regex: /rgba\(20,\s*30,\s*45,\s*0\.8\)/g, replacement: 'var(--bg-tertiary)' },
  { regex: /rgba\(0,\s*0,\s*0,\s*0\.2\)/g, replacement: 'var(--bg-hover)' },
  { regex: /rgba\(0,\s*0,\s*0,\s*0\.125\)/g, replacement: 'var(--bg-hover)' },
  { regex: /rgba\(0,\s*0,\s*0,\s*0\.1\)/g, replacement: 'var(--bg-hover-light)' },
  { regex: /rgba\(255,\s*255,\s*255,\s*0\.02\)/g, replacement: 'var(--bg-hover-light)' }
];

function themeFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;
  
  replacements.forEach(r => {
    content = content.replace(r.regex, r.replacement);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Themed further: ${filePath}`);
  }
}

function traverseDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith('.css') && !fullPath.includes('styles.css') && !fullPath.includes('node_modules')) {
      themeFile(fullPath);
    }
  });
}

traverseDir(path.join(__dirname, 'src', 'app'));
