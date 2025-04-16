const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let currentFolderPath = '';
let historyStack = [];
let currentIndex = -1;

const ROOT_USER = 'root';
const ROOT_DIR = path.join(__dirname, ROOT_USER);
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
      navigateTo(ROOT_DIR);
    };

    rootNode.appendChild(icon);
    rootNode.appendChild(label);
    rootNode.appendChild(childrenContainer);
    folderTree.appendChild(rootNode);

    navigateTo(ROOT_DIR);
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
      navigateTo(fullPath);
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
  currentFolderPath = folderPath;

  if (!fs.existsSync(folderPath)) return;

  const relativePath = path.relative(path.join(__dirname, 'files'), folderPath);
  const parts = relativePath.split(path.sep);
  let currentPath = __dirname;

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
    segment.onclick = () => navigateTo(currentPath);
    pathBar.appendChild(segment);

    if (index < parts.length - 1) {
      const divider = document.createElement('span');
      divider.className = 'divider';
      divider.textContent = '>';
      pathBar.appendChild(divider);
    }
  });

  fs.readdir(folderPath, (err, items) => {
    if (err) return console.error('Error reading folder:', err);
    items.forEach(item => {
      const itemPath = path.join(folderPath, item);
      const stats = fs.statSync(itemPath);
      const gridItem = document.createElement('div');
      gridItem.className = 'file-item';
      gridItem.setAttribute('data-name', item);
      const icon = document.createElement('div');
      icon.className = 'file-icon';
      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = item;

      gridItem.onclick = () => {
        document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
        gridItem.classList.add('selected');
        if (stats.isDirectory()) navigateTo(itemPath);
        else previewFile(itemPath, item);
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
  } catch (err) {
    alert("Error creating folder: " + err.message);
  }
}
