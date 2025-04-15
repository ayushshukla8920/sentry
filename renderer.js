const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");

// -------------------- LOGIN / PASSWORD LOGIC --------------------

function submitPassword() {
  const pass = Array.from(inputs).map(input => input.value).join('');
  ipcRenderer.send("check-password", pass);
}

ipcRenderer.on("password-result", (event, result) => {
  const msg = document.getElementById("message");
  if (result.success) {
    msg.innerText = "Access granted!";
    setTimeout(() => {
      ipcRenderer.send("load-index");
    }, 1000);
  } else {
    msg.innerText = "Incorrect password.";
  }
});

function savePassword() {
  const pass = Array.from(inputs).map(input => input.value).join('');
  const msg = document.getElementById("message");

  if (pass.length < 4) {
    msg.innerText = "Password must be at least 4 characters.";
    return;
  }

  ipcRenderer.send("set-password", pass);
}

ipcRenderer.on("password-set-result", (event, result) => {
  const msg = document.getElementById("message");
  if (result.success) {
    msg.innerText = "Password saved! Redirecting...";
    setTimeout(() => {
      ipcRenderer.send("load-index");
    }, 1000);
  } else {
    msg.innerText = "Failed to save password.";
  }
});

// -------------------- FILE MANAGER LOGIC --------------------
let historyStack = [];
let currentIndex = -1;

const ROOT_USER = 'root'; // Adjust based on user
const ROOT_DIR = path.join(__dirname, ROOT_USER);

// Load folder tree and default files when index.html is loaded
window.addEventListener('DOMContentLoaded', () => {
  const folderTree = document.getElementById('folderTree');
  const fileGrid = document.getElementById('fileGrid');

  if (folderTree && fileGrid) {
    const rootNode = document.createElement('div');
    rootNode.classList.add('tree-node');

    const icon = document.createElement('i');
    icon.className = 'fas fa-folder-open';
    icon.style.marginRight = '6px';

    const label = document.createElement('span');
    label.textContent = ROOT_USER;
    label.classList.add('folder-label');

    const childrenContainer = document.createElement('div');
    childrenContainer.style.display = 'block';
    buildFolderTree(ROOT_DIR, childrenContainer, 1);

    rootNode.onclick = (e) => {
      e.stopPropagation();
      const isVisible = childrenContainer.style.display === 'block';
      childrenContainer.style.display = isVisible ? 'none' : 'block';
      icon.className = isVisible ? 'fas fa-folder' : 'fas fa-folder-open';
      loadFiles(ROOT_DIR);
    };

    rootNode.appendChild(icon);
    rootNode.appendChild(label);
    rootNode.appendChild(childrenContainer);
    folderTree.appendChild(rootNode);

    navigateTo(ROOT_DIR); // Instead of loadFiles()
 // Load initial root files
  }
});
function navigateTo(folderPath, pushToHistory = true) {
  loadFiles(folderPath);

  if (pushToHistory) {
    historyStack = historyStack.slice(0, currentIndex + 1);
    historyStack.push(folderPath);
    currentIndex++;
    updateBackButton();
  }
}
function goBack() {
  if (currentIndex > 0) {
    currentIndex--;
    const folderPath = historyStack[currentIndex];
    loadFiles(folderPath);
    updateBackButton();
  }
}
function updateBackButton() {
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.disabled = currentIndex <= 0;
  }
}


// Build expandable folder tree (folders only)
function buildFolderTree(dirPath, container, depth = 0) {
  const ul = document.createElement('ul');
  ul.style.marginLeft = `${depth * 10}px`;

  const items = fs.readdirSync(dirPath);
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) return;

    const li = document.createElement('li');
    li.classList.add('tree-node');

    const icon = document.createElement('i');
    icon.className = 'fas fa-folder';
    icon.style.marginRight = '6px';

    const name = document.createElement('span');
    name.textContent = item;
    name.classList.add('folder-label');

    const subContainer = document.createElement('div');
    subContainer.style.display = 'none';
    buildFolderTree(fullPath, subContainer, depth + 1);

    li.onclick = function (e) {
      e.stopPropagation();
      const isVisible = subContainer.style.display === 'block';
      subContainer.style.display = isVisible ? 'none' : 'block';
      icon.className = isVisible ? 'fas fa-folder' : 'fas fa-folder-open';
      navigateTo(fullPath); // ✅ updated
    };
    

    li.appendChild(icon);
    li.appendChild(name);
    li.appendChild(subContainer);
    ul.appendChild(li);
  });

  container.appendChild(ul);
}

function loadFiles(folderPath) {
  const fileGrid = document.getElementById('fileGrid');
  const pathBar = document.getElementById('currentPath');
  fileGrid.innerHTML = '';
  pathBar.innerHTML = '';

  if (!fs.existsSync(folderPath)) return;

  // ----------- BREADCRUMB PATH BAR WITH ICONS -----------
  const relativePath = path.relative(path.join(__dirname, 'files'), folderPath);
  const parts = relativePath.split(path.sep);
  let currentPath = path.join(__dirname, 'files');

  parts.forEach((part, index) => {
    const segment = document.createElement('span');
    segment.className = 'path-segment';

    const icon = document.createElement('i');
    icon.className = 'fas fa-folder';

    const text = document.createElement('span');
    text.textContent = part;

    segment.appendChild(icon);
    segment.appendChild(text);

    currentPath = path.join(currentPath, part);

    segment.onclick = () => navigateTo(currentPath); // ✅ updated
    pathBar.appendChild(segment);

    if (index < parts.length - 1) {
      const divider = document.createElement('span');
      divider.className = 'divider';
      divider.textContent = '>';
      pathBar.appendChild(divider);
    }
  });

  // ----------- SHOW FOLDERS & FILES IN GRID -----------
  fs.readdir(folderPath, (err, items) => {
    if (err) {
      console.error('Error reading folder:', err);
      return;
    }

    items.forEach(item => {
      const itemPath = path.join(folderPath, item);
      const stats = fs.statSync(itemPath);

      const gridItem = document.createElement('div');
      gridItem.className = 'file-item';

      const icon = document.createElement('div');
      icon.className = 'file-icon';
      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = item;

      if (stats.isDirectory()) {
        icon.innerHTML = '<i class="fas fa-folder"></i>';
        gridItem.onclick = () => loadFiles(itemPath); // Folder click
      } else {
        icon.innerHTML = '<i class="fas fa-file"></i>';
        gridItem.onclick = () => previewFile(itemPath, item); // File click
      }

      gridItem.appendChild(icon);
      gridItem.appendChild(name);
      fileGrid.appendChild(gridItem);
    });
  });
}



function previewFile(filePath, fileName) {
  const modal = document.getElementById('previewModal');
  const previewContent = document.getElementById('previewContent');
  const ext = path.extname(fileName).toLowerCase();

  previewContent.innerHTML = ''; // Clear old preview

  if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
    const img = document.createElement('img');
    img.src = filePath;
    img.style.maxWidth = '100%';
    previewContent.appendChild(img);
  } else if (ext === '.txt' || ext === '.log' || ext === '.json' || ext === '.html' || ext === '.css' || ext === '.js') {
    const content = fs.readFileSync(filePath, 'utf-8');
    const pre = document.createElement('pre');
    pre.textContent = content;
    previewContent.appendChild(pre);
  } else if (ext === '.pdf') {
    const iframe = document.createElement('iframe');
    iframe.src = filePath;
    iframe.style.width = '100%';
    iframe.style.height = '80vh';
    previewContent.appendChild(iframe);
  } else {
    previewContent.innerHTML = '<p>Preview not available for this file type.</p>';
  }

  modal.style.display = 'block';
}

function closePreview() {
  document.getElementById('previewModal').style.display = 'none';
}
