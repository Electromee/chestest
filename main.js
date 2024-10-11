const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Optional, see Step 8
      nodeIntegration: true,  // Allows local JavaScript integration
      contextIsolation: false // Allows interaction between Node.js and frontend code
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');
}

// Called when Electron has finished initializing
app.whenReady().then(createWindow);

// Close the app when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
