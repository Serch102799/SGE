const fs = require('fs');
const path = require('path');

const replacements = [
  // Backgrounds
  { regex: /#1e293b/gi, replacement: 'var(--bg-dark-card)' },
  { regex: /#23272f/gi, replacement: 'var(--bg-dark-card)' },
  { regex: /#1a1d24/gi, replacement: 'var(--bg-dark-main)' },
  { regex: /#0f172a/gi, replacement: 'var(--bg-dark-main)' },
  // Text
  { regex: /#f8fafc/gi, replacement: 'var(--text-white)' },
  { regex: /#ffffff/gi, replacement: 'var(--text-white)' },
  { regex: /#e0e0e0/gi, replacement: 'var(--text-light)' },
  { regex: /#cbd5e1/gi, replacement: 'var(--text-light)' },
  { regex: /#e2e8f0/gi, replacement: 'var(--text-light)' },
  { regex: /#94a3b8/gi, replacement: 'var(--text-muted)' },
  { regex: /#64748b/gi, replacement: 'var(--text-muted)' },
  { regex: /#aaa/gi, replacement: 'var(--text-muted)' },
  // Borders
  { regex: /#334155/gi, replacement: 'var(--border-primary)' },
  { regex: /#475569/gi, replacement: 'var(--border-secondary)' },
  { regex: /rgba\(255,\s*255,\s*255,\s*0\.05\)/g, replacement: 'var(--bg-hover-light)' },
  { regex: /rgba\(255,\s*255,\s*255,\s*0\.1\)/g, replacement: 'var(--border-color)' },
  { regex: /rgba\(255,\s*255,\s*255,\s*0\.15\)/g, replacement: 'var(--border-color)' },
  { regex: /rgba\(255,\s*255,\s*255,\s*0\.02\)/g, replacement: 'var(--border-color)' },
  { regex: /rgba\(255,\s*255,\s*255,\s*0\.03\)/g, replacement: 'var(--bg-hover-light)' },
  { regex: /rgba\(0,\s*0,\s*0,\s*0\.7\)/g, replacement: 'var(--bg-dark-overlay)' },
  { regex: /rgba\(15,\s*23,\s*42,\s*0\.6\)/g, replacement: 'var(--bg-tertiary)' },
  { regex: /rgba\(30,\s*41,\s*59,\s*0\.3\)/g, replacement: 'var(--bg-secondary)' }
];

function themeFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;
  
  replacements.forEach(r => {
    content = content.replace(r.regex, r.replacement);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Themed: ${filePath}`);
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
