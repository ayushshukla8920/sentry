const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const passwordFilePath = path.join(__dirname, "config/.bcrypt");
let mainWindow;
app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    resizable: false
  });

  if (fs.existsSync(passwordFilePath)) {
    mainWindow.loadFile(path.join(__dirname, "views/enterPassword.html"));
  } else {
    mainWindow.loadFile(path.join(__dirname, "views/setPassword.html"));
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on("check-password", (event, enteredPassword) => {
  if (!fs.existsSync(passwordFilePath)) {
    event.reply("password-result", { success: false });
    return;
  }
  const storedHash = fs.readFileSync(passwordFilePath, "utf-8");
  bcrypt.compare(enteredPassword, storedHash, (err, result) => {
    if (err || !result) {
      event.reply("password-result", { success: false });
    } else {
      event.reply("password-result", { success: true });
    }
  });
});

ipcMain.on("set-password", (event, password) => {
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      event.reply("password-set-result", { success: false });
      return;
    }

    try {
      if (!fs.existsSync(path.dirname(passwordFilePath))) {
        fs.mkdirSync(path.dirname(passwordFilePath), { recursive: true });
      }

      fs.writeFileSync(passwordFilePath, hash);
      event.reply("password-set-result", { success: true });
    } catch (e) {
      console.error("Error saving password:", e);
      event.reply("password-set-result", { success: false });
    }
  });
});

ipcMain.on("load-index", () => {
  mainWindow.loadFile(path.join(__dirname, "views/index.html"));
});