const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let currentFolderPath = '';
let historyStack = [];
let currentIndex = -1;
let contextTargetPath = '';
let contextTargetName = '';


const ROOT_USER = 'root';
const ROOT_DIR = path.join(__dirname, '..', 'root');
const ENCRYPTION_KEY = crypto.createHash('sha256').update('my_secret_key').digest(); // 32 bytes key
const IV_LENGTH = 16;

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decryptBuffer(encryptedBuffer) {
  const iv = encryptedBuffer.slice(0, IV_LENGTH);
  const encrypted = encryptedBuffer.slice(IV_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
function goBackOneLevel() {
  if (currentFolderPath === ROOT_DIR) return;
  const parentPath = path.dirname(currentFolderPath);
  if (parentPath.startsWith(ROOT_DIR)) {
    navigateTo(parentPath);
  } else {
    navigateTo(ROOT_DIR);
  }
}

function renderFolderTree() {
  const folderTree = document.getElementById('folderTree');
  folderTree.innerHTML = '';

  const rootNode = document.createElement('div');
  rootNode.classList.add('tree-node');

  const icon = document.createElement('i');
  icon.className = 'fas fa-folder-open';
  icon.style.marginRight = '6px';

  const label = document.createElement('span');
  label.textContent = ROOT_USER;
  label.classList.add('folder-label');

  const childrenContainer = document.createElement('div');
  childrenContainer.classList.add('sub-container', 'open');
  childrenContainer.style.display = 'block';
  buildFolderTree(ROOT_DIR, childrenContainer, 1);

  rootNode.onclick = (e) => {
    e.stopPropagation();
    const isVisible = childrenContainer.style.display === 'block';
    childrenContainer.style.display = isVisible ? 'none' : 'block';
    icon.className = isVisible ? 'fas fa-folder' : 'fas fa-folder-open';
    navigateTo(ROOT_DIR);
  };

  rootNode.appendChild(icon);
  rootNode.appendChild(label);
  rootNode.appendChild(childrenContainer);
  folderTree.appendChild(rootNode);
}



// -------------------- LOGIN / PASSWORD LOGIC --------------------
function submitPassword() {
  const pass = Array.from(inputs).map(input => input.value).join('');
  ipcRenderer.send("check-password", pass);
}

ipcRenderer.on("password-result", (event, result) => {
  const msg = document.getElementById("message");
  if (result.success) {
    msg.innerText = "Access granted!";
    setTimeout(() => ipcRenderer.send("load-index"), 1000);
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
    setTimeout(() => ipcRenderer.send("load-index"), 1000);
  } else {
    msg.innerText = "Failed to save password.";
  }
});

// -------------------- FILE MANAGER LOGIC --------------------
window.addEventListener('DOMContentLoaded', () => {
  const folderTree = document.getElementById('folderTree');
  const fileGrid = document.getElementById('fileGrid');

  if (folderTree && fileGrid) {
    renderFolderTree();
    navigateTo(ROOT_DIR);
  }
});

window.addEventListener('click', (e) => {
  const menu = document.getElementById('contextMenu');
  if (!menu.contains(e.target)) {
    menu.style.display = 'none';
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
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.disabled = (folderPath === ROOT_DIR);
  }
}


function goBack() {
  if (currentIndex > 0) {
    currentIndex--;
    loadFiles(historyStack[currentIndex]);
    updateBackButton();
  }
}

function updateBackButton() {
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.disabled = currentIndex <= 0;
  }
}

function buildFolderTree(dirPath, container, depth = 0) {
  const ul = document.createElement('ul');
  ul.className = 'tree-ul';

  const items = fs.readdirSync(dirPath);

  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) return;

    // Main <li>
    const li = document.createElement('li');
    li.className = 'tree-node';

    // Header row
    const row = document.createElement('div');
    row.className = 'tree-row';

    const arrow = document.createElement('i');
    arrow.className = 'fas fa-chevron-right arrow';
    arrow.style.cursor = 'pointer';

    const folderIcon = document.createElement('i');
    folderIcon.className = 'fas fa-folder';

    const label = document.createElement('span');
    label.textContent = item;
    label.classList.add('folder-label');
    label.style.cursor = 'pointer';

    // Subfolder container
    const subContainer = document.createElement('div');
    subContainer.className = 'sub-container';

    // Recursive UL
    const nestedUL = document.createElement('ul');
    nestedUL.className = 'tree-ul';

    // 🔥 RECURSE properly into <ul>
    buildFolderTree(fullPath, nestedUL, depth + 1);

    subContainer.appendChild(nestedUL);

    // Expand/collapse
    arrow.onclick = (e) => {
      e.stopPropagation();
      const isOpen = subContainer.classList.contains('open');

      const siblings = Array.from(li.parentElement.children);
      siblings.forEach(sibling => {
        if (sibling !== li) {
          const sibSub = sibling.querySelector('.sub-container');
          const sibArrow = sibling.querySelector('.arrow');
          const sibIcon = sibling.querySelector('.fa-folder, .fa-folder-open');
          if (sibSub) sibSub.classList.remove('open');
          if (sibArrow) sibArrow.className = 'fas fa-chevron-right arrow';
          if (sibIcon) sibIcon.className = 'fas fa-folder';
        }
      });

      if (isOpen) {
        subContainer.classList.remove('open');
        arrow.className = 'fas fa-chevron-right arrow';
        folderIcon.className = 'fas fa-folder';
      } else {
        subContainer.classList.add('open');
        arrow.className = 'fas fa-chevron-down arrow';
        folderIcon.className = 'fas fa-folder-open';
      }
    };

    label.onclick = (e) => {
      e.stopPropagation();
      navigateTo(fullPath);
    };

    // Append to li
    row.appendChild(arrow);
    row.appendChild(folderIcon);
    row.appendChild(label);
    li.appendChild(row);
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
  currentFolderPath = folderPath;

  if (!fs.existsSync(folderPath)) return;

  const relativePath = path.relative(path.join(__dirname, 'files'), folderPath);
  let displayedPath = path.relative(path.join(__dirname, '..'), folderPath);
  if (!displayedPath || displayedPath === '') {
    displayedPath = 'root';
  } else {
    displayedPath = ' > ' + displayedPath.replace(/\\/g, ' > ').replace(/\//g, ' > ');
  }

  const span = document.createElement('span');
  span.textContent = displayedPath;
  span.style.color = 'white';
  span.style.fontSize = '14px';
  pathBar.appendChild(span);



  fs.readdir(folderPath, (err, items) => {
    if (err) return console.error('Error reading folder:', err);
    items.forEach(item => {
      const itemPath = path.join(folderPath, item);
      const stats = fs.statSync(itemPath);
      const gridItem = document.createElement('div');
      gridItem.className = 'file-item';
      gridItem.setAttribute('data-name', item);
      gridItem.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Track the current item
        contextTargetName = item;
        contextTargetPath = itemPath;

        // Show context menu
        const menu = document.getElementById('contextMenu');
        menu.style.top = `${e.pageY}px`;
        menu.style.left = `${e.pageX}px`;
        menu.style.display = 'block';
      });

      const icon = document.createElement('div');
      icon.className = 'file-icon';
      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = item;

      let clickTimer = null;

      gridItem.onclick = (e) => {
        e.stopPropagation();

        // Clear previous selection
        document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
        gridItem.classList.add('selected');

        // Single-click: just select, no navigation
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;

          // Double click → navigate or preview
          if (stats.isDirectory()) navigateTo(itemPath);
          else previewFile(itemPath, item);
        } else {
          clickTimer = setTimeout(() => {
            clickTimer = null; // Reset timer
          }, 250); // Wait to detect double-click
        }
      };


      icon.innerHTML = stats.isDirectory() ? '<i class="fas fa-folder folder"></i>' : '<i class="fas fa-file file"></i>';
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
  previewContent.innerHTML = '';

  try {
    const encryptedBuffer = fs.readFileSync(filePath);
    const decryptedBuffer = decryptBuffer(encryptedBuffer);

    if ([".png", ".jpg", ".jpeg", ".gif"].includes(ext)) {
      const blob = new Blob([decryptedBuffer], { type: `image/${ext.replace('.', '')}` });
      const url = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = url;
      img.style.maxWidth = '100%';
      previewContent.appendChild(img);
    } else if ([".txt", ".log", ".json", ".html", ".css", ".js"].includes(ext)) {
      const text = decryptedBuffer.toString('utf-8');
      const pre = document.createElement('pre');
      pre.textContent = text;
      previewContent.appendChild(pre);
    } else if (ext === '.pdf') {
      const blob = new Blob([decryptedBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.width = '100%';
      iframe.style.height = '80vh';
      previewContent.appendChild(iframe);
    } else {
      previewContent.innerHTML = '<p>Preview not available for this file type.</p>';
    }
    modal.style.display = 'block';
  } catch (err) {
    previewContent.innerHTML = `<p>Error decrypting file: ${err.message}</p>`;
    modal.style.display = 'block';
  }
}

function uploadFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (!file || !currentFolderPath) return;

  const reader = new FileReader();
  reader.onload = () => {
    const buffer = Buffer.from(reader.result);
    const encrypted = encryptBuffer(buffer);
    const filePath = path.join(currentFolderPath, file.name);
    fs.writeFileSync(filePath, encrypted);
    navigateTo(currentFolderPath, false);
  };
  reader.readAsArrayBuffer(file);
}
function closePreview() {
  document.getElementById('previewModal').style.display = 'none';
}
function triggerFileInput() {
  document.getElementById('fileInput').click();
}
function createFolder() {
  const folderName = prompt("Enter folder name:");
  if (!folderName) return;
  const newFolderPath = path.join(currentFolderPath, folderName);
  try {
    fs.mkdirSync(newFolderPath, { recursive: true });
    navigateTo(currentFolderPath, false);
    window.location.reload();
  } catch (err) {
    alert("Failed to create folder: " + err.message);
  }
}
function deleteSelected() {
  const selected = document.querySelector('.file-item.selected');
  if (!selected) {
    alert("Please select a file or folder to delete.");
    return;
  }
  const itemName = selected.getAttribute('data-name');
  const fullPath = path.join(currentFolderPath, itemName);
  if (!fs.existsSync(fullPath)) {
    alert("Selected item doesn't exist.");
    return;
  }
  const confirmDelete = confirm(`Are you sure you want to delete "${itemName}"?`);
  if (!confirmDelete) return;
  try {
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    navigateTo(currentFolderPath, false);
  } catch (err) {
    alert("Failed to delete: " + err.message);
  }
}
function createFolder() {
  document.getElementById('folderNameInput').value = '';
  document.getElementById('newFolderModal').style.display = 'block';
}
function closeFolderModal() {
  document.getElementById('newFolderModal').style.display = 'none';
}
function confirmCreateFolder() {
  const folderName = document.getElementById('folderNameInput').value.trim();
  if (!folderName) {
    alert("Folder name cannot be empty.");
    return;
  }
  const newFolderPath = path.join(currentFolderPath, folderName);
  if (fs.existsSync(newFolderPath)) {
    alert("Folder already exists.");
    return;
  }
  try {
    fs.mkdirSync(newFolderPath, { recursive: true });
    closeFolderModal();
    navigateTo(currentFolderPath, false);
    renderFolderTree();
  } catch (err) {
    alert("Error creating folder: " + err.message);
  }
}
function contextDelete() {
  if (!contextTargetPath || !fs.existsSync(contextTargetPath)) return;

  const confirmDelete = confirm(`Are you sure you want to delete "${contextTargetName}"?`);
  if (!confirmDelete) return;

  try {
    const stats = fs.statSync(contextTargetPath);
    if (stats.isDirectory()) {
      fs.rmSync(contextTargetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(contextTargetPath);
    }
    navigateTo(currentFolderPath, false);
    renderFolderTree();
  } catch (err) {
    alert("Failed to delete: " + err.message);
  }
}

function contextRename() {
  if (!contextTargetPath || !fs.existsSync(contextTargetPath)) return;

  const newName = prompt("Enter new name:", contextTargetName);
  if (!newName || newName === contextTargetName) return;

  const newPath = path.join(currentFolderPath, newName);
  try {
    fs.renameSync(contextTargetPath, newPath);
    navigateTo(currentFolderPath, false);
    renderFolderTree();
  } catch (err) {
    alert("Failed to rename: " + err.message);
  }
}

function contextMetadata() {
  if (!contextTargetPath || !fs.existsSync(contextTargetPath)) return;

  try {
    const stats = fs.statSync(contextTargetPath);
    const details = `
      Name: ${contextTargetName}
      Size: ${stats.size} bytes
      Created: ${stats.birthtime}
      Modified: ${stats.mtime}
      Type: ${stats.isDirectory() ? "Folder" : "File"}
    `;
    alert(details);
  } catch (err) {
    alert("Failed to retrieve metadata: " + err.message);
  }
}
