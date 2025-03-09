const { BrowserWindow, screen } = require('electron');
const path = require('path');

// 悬浮球
const createSuspensionWindow = (suspensionConfig) => {
  // Create the browser window.
  const win = new BrowserWindow({
    skipTaskbar: true, // 新增这行关闭任务栏显示
    width: suspensionConfig.width,
    height: suspensionConfig.height,
    type: 'toolbar',
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      enableBlinkFeatures: 'AudioVideoTracks',
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'views/FloatBall/index.html'));
  const { left, top } = { left: screen.getPrimaryDisplay().workAreaSize.width - 85, top: screen.getPrimaryDisplay().workAreaSize.height - 100 }
  // mainWindow.setBounds({ x: left, y: top, width: suspensionConfig.width, height: suspensionConfig.height })
  win.setPosition(left, top)
  // mainWindow.setIgnoreMouseEvents(true, { forward: true })
  win.webContents.openDevTools({ mode: 'detach' })

  return win
};

const createEssayWindow = () => {
  const { left, top } = { left: screen.getPrimaryDisplay().workAreaSize.width * 0.2, top: screen.getPrimaryDisplay().workAreaSize.height * 0.1 }
  const win = new BrowserWindow({
    skipTaskbar: true, // 新增这行关闭任务栏显示
    width: 300,
    height: 500,
    minWidth: 300,
    x: left,
    y: top,
    icon: path.join(__dirname, './assets/edit-green.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      enableBlinkFeatures: 'AudioVideoTracks',
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'views/Essay/index.html'));
  win.webContents.openDevTools()
  return win
}

const createTodoWindow = () => {
  const { left, top } = { left: screen.getPrimaryDisplay().workAreaSize.width - 580, top: screen.getPrimaryDisplay().workAreaSize.height * 0.2 }
  const win = new BrowserWindow({
    skipTaskbar: true, // 新增这行关闭任务栏显示
    frame: false,
    width: 500,
    height: 400,
    // resizable: false,
    x: left,
    y: top,
    show: false,
    alwaysOnTop: true,
    // menuBarVisible: false,
    // minimizable: false,   // 禁用最小化按钮
    // maximizable: false,   // 禁用最大化按钮
    // closable: true,        // 保留关闭按钮（默认已启用）
    transparent: true,  
    backgroundColor: '#00000000', 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      enableBlinkFeatures: 'AudioVideoTracks',
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.once('ready-to-show', () => {
    win.show()
  })
  win.loadFile(path.join(__dirname, 'views/Todo/index.html'));
  // win.webContents.openDevTools()
  return win
}

const createTipWindow = () => {
  const { left, top } = { left: screen.getPrimaryDisplay().workAreaSize.width - 280, top: 100 }
  const win = new BrowserWindow({
    width: 200,
    minWidth: 200,
    height: 80,
    x: left,
    y: top,
    frame: false,
    alwaysOnTop: true,
    show: false,
    transparent: true,         // 允许透明背景（可选）
    backgroundColor: '#00000000', // 透明背景
    // icon: path.join(__dirname, './assets/edit-green.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.once('ready-to-show', () => {
    win.show()
  })
  win.loadFile(path.join(__dirname, 'views/Tip/index.html'));
  //win.webContents.openDevTools()
  return win
}
const createConfigWindow = () => {
  const { left, top } = { left: screen.getPrimaryDisplay().workAreaSize.width - 360, top: screen.getPrimaryDisplay().workAreaSize.height - 840 }
  const win = new BrowserWindow({
    skipTaskbar: true, // 新增这行关闭任务栏显示
    width: 300,
    minWidth: 300,
    maxWidth: 300,
    height: 500,
    x: left,
    y: top,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      enableBlinkFeatures: 'AudioVideoTracks',
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'views/Config/index.html'));
  win.webContents.openDevTools()
  return win
}

module.exports = {
  createSuspensionWindow,
  createEssayWindow,
  createTodoWindow,
  createConfigWindow,
  createTipWindow,
}