const fs = require('fs');
const path = require('path');

const cssToRemove = [
  // Modals
  /\.modal-overlay\s*\{[^}]+\}/g,
  /\.modal-content\s*\{[^}]+\}/g,
  /\.modal-header\s*\{[^}]+\}/g,
  /\.modal-body\s*\{[^}]+\}/g,
  /\.modal-footer\s*\{[^}]+\}/g,
  /\.btn-cerrar\s*\{[^}]+\}/g,
  /\.btn-cerrar:hover\s*\{[^}]+\}/g,
  /\.header-exito\s*\{[^}]+\}/g,
  /\.header-error\s*\{[^}]+\}/g,
  /\.header-advertencia\s*\{[^}]+\}/g,
  /\.modal-header\s+h3\s*\{[^}]+\}/g,
  /\.btn-cancelar\s*\{[^}]+\}/g,
  /\.btn-cancelar:hover\s*\{[^}]+\}/g,

  // Buttons
  /\.btn-agregar\s*\{[^}]+\}/g,
  /\.btn-agregar:hover\s*\{[^}]+\}/g,
  /\.btn-guardar\s*\{[^}]+\}/g,
  /\.btn-guardar:hover\s*\{[^}]+\}/g,
  /\.btn-editar\s*\{[^}]+\}/g,
  /\.btn-editar:hover\s*\{[^}]+\}/g,
  /\.btn-eliminar\s*\{[^}]+\}/g,
  /\.btn-eliminar:hover\s*\{[^}]+\}/g,
  /\.btn-icon\s*\{[^}]+\}/g,
  /\.btn-icon:hover\s*\{[^}]+\}/g,
  /\.btn-check\s*\{[^}]+\}/g,
  /\.btn-check:hover\s*\{[^}]+\}/g,
  /\.btn-warn\s*\{[^}]+\}/g,
  /\.btn-warn:hover\s*\{[^}]+\}/g,

  // Tables
  /\.tabla-responsive-wrapper\s*\{[^}]+\}/g,
  /\.tabla-usuarios\s*\{[^}]+\}/g,
  /\.tabla-usuarios\s+th\s*\{[^}]+\}/g,
  /\.tabla-usuarios\s+td\s*\{[^}]+\}/g,
  /\.tabla-usuarios\s+tr\s*\{[^}]+\}/g,
  /\.tabla-usuarios\s+tr:hover\s*\{[^}]+\}/g,
  /\.tabla-datos\s*\{[^}]+\}/g,
  /\.tabla-datos\s+th\s*\{[^}]+\}/g,
  /\.tabla-datos\s+td\s*\{[^}]+\}/g,
  /\.tabla-datos\s+tr\s*\{[^}]+\}/g,
  /\.tabla-datos\s+tr:hover\s*\{[^}]+\}/g,

  // Containers
  /\.usuarios-container\s*\{[^}]+\}/g,
  /\.container-header\s*\{[^}]+\}/g,
  /\.container-header\s+h2\s*\{[^}]+\}/g,
  /\.container-body\s*\{[^}]+\}/g,
  /\.acciones-flex\s*\{[^}]+\}/g,

  // Forms
  /\.form-group\s*\{[^}]+\}/g,
  /\.form-group\s+label\s*\{[^}]+\}/g,
  /\.form-control\s*\{[^}]+\}/g,
  /\.form-control:focus\s*\{[^}]+\}/g,
  /input\[type="[a-z]+"\]\s*\{[^}]+\}/g,
  /select\s*\{[^}]+\}/g,
  /select:focus\s*\{[^}]+\}/g,

  // Badges
  /\.badge\s*\{[^}]+\}/g,
  /\.badge-pendiente\s*\{[^}]+\}/g,
  /\.badge-revision\s*\{[^}]+\}/g,
  /\.badge-resuelto\s*\{[^}]+\}/g,
  /\.badge-activo\s*\{[^}]+\}/g,
  /\.badge-inactivo\s*\{[^}]+\}/g,
];

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalLength = content.length;
  
  cssToRemove.forEach(regex => {
    content = content.replace(regex, '');
  });

  // Remove empty media queries or unused comments if possible
  content = content.replace(/\/\*[\s=A-Z]+\*\/\s*/g, ''); // Remove block comments like /* === MODALES === */
  content = content.replace(/^\s*[\r\n]/gm, ''); // Remove empty lines

  if (content.length < originalLength) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Cleaned: ${filePath} (Reduced by ${originalLength - content.length} chars)`);
  }
}

function traverseDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith('.css') && !fullPath.includes('styles.css') && !fullPath.includes('node_modules')) {
      cleanFile(fullPath);
    }
  });
}

traverseDir(path.join(__dirname, 'src', 'app'));
