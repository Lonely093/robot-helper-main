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
  //win.webContents.openDevTools({ mode: 'detach' })
  // 突破系统安全层级的特殊设置
  win.setAlwaysOnTop(true, 'screen-saver')
  return win
};

const createTodoWindow = (data) => {
  let display = data.display;
  let todoWinX = data.x - 705;
  let todoWinY = data.y - 430;
  if (data.closestEdge == "left") {
    todoWinX = data.x + 95;
  } else if (data.closestEdge == "right") {
    todoWinX = data.x - 705;
  }
  if (todoWinX < 0) {
    todoWinX = 0
  } else if (todoWinX > display.workArea.width - 300) {
    todoWinX = display.workArea.width - 300
  }
  if (todoWinY < 0) {
    todoWinY = 0
  } else if (todoWinY > display.workArea.height - 450) {
    todoWinY = display.workArea.height - 450
  }
  const win = new BrowserWindow({
    skipTaskbar: true, // 新增这行关闭任务栏显示
    frame: false,
    // minWidth: 600,
    // minHeight: 500,
    width: 700,
    height: 450,
    resizable: false,
    x: todoWinX,
    y: todoWinY,
    show: false,
    alwaysOnTop: true,
    type: 'toolbar',
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
  // win.webContents.openDevTools({ mode: 'detach' })
  // 突破系统安全层级的特殊设置
  win.setAlwaysOnTop(true, 'screen-saver')
  return win
}

const createTipWindow = (data) => {
  // console.log("suspensionWinPositionsuspensionWinPosition",data)
  let display = data.display;
  //const { left, top } = { left: screen.getPrimaryDisplay().workAreaSize.width - 280, top: 100 }
  //const { left, top } = { left: screen.getPrimaryDisplay().workAreaSize.width - 270, top: screen.getPrimaryDisplay().workAreaSize.height - 140 }
  let tipWinX = data.x - 300;
  let tipWinY = data.y - 15;
  // let reverse = false;
  // console.log("tipWinX",tipWinX,"tipWinY",tipWinY,"111111111")
  if (data.closestEdge == "left") {
    tipWinX = data.x + 85;
    // reverse = true;
  } else if (data.closestEdge == "right") {
    tipWinX = data.x - 300;
    // reverse = false;
  }
  // console.log("tipWinX",tipWinX,"tipWinY",tipWinY,"222222222222222")
  if (tipWinX < 0) {
    tipWinX = 0
  } else if (tipWinX > display.workArea.width - 300) {
    tipWinX = display.workArea.width - 300
  }
  if (tipWinY < 0) {
    tipWinY = 0
  } else if (tipWinY > display.workArea.height - 70) {
    tipWinY = display.workArea.height - 70
  }

  const win = new BrowserWindow({
    skipTaskbar: true, // 新增这行关闭任务栏显示
    width: 300,
    minWidth: 300,
    resizable: false,
    height: 70,
    x: tipWinX,
    y: tipWinY,
    frame: false,
    alwaysOnTop: true,
    type: 'toolbar',
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
  // const filePath = path.join(__dirname, 'views/Tip/index.html');
  // console.log("urlParams.get('reverse')1111111111",reverse);
  // win.loadURL(`file://${filePath}?reverse=${reverse}`);
  // win.webContents.openDevTools({ mode: 'detach' })
  // 突破系统安全层级的特殊设置
  win.setAlwaysOnTop(true, 'screen-saver')
  return win
}


const createAlertWindow = (data) => {
  // console.log("suspensionWinPositionsuspensionWinPosition",data)
  let display = data.display;
  let alertWinX = data.x - 300;
  let alertWinY = data.y - 15;
  if (data.closestEdge == "left") {
    alertWinX = data.x + 85;
  } else if (data.closestEdge == "right") {
    alertWinX = data.x - 300;
  }

  if (alertWinX < 0) {
    alertWinX = 0
  } else if (alertWinX > display.workArea.width - 300) {
    alertWinX = display.workArea.width - 300
  }
  if (alertWinY < 0) {
    alertWinY = 0
  } else if (alertWinY > display.workArea.height - 70) {
    alertWinY = display.workArea.height - 70
  }

  const win = new BrowserWindow({
    skipTaskbar: true, // 新增这行关闭任务栏显示
    width: 300,
    minWidth: 300,
    resizable: false,
    height: 200,
    x: (screen.getPrimaryDisplay().workAreaSize.width - 300) / 2,
    y: 300,
    frame: false,
    alwaysOnTop: true,
    type: 'toolbar',
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
  win.loadFile(path.join(__dirname, 'views/Alert/index.html'));

  // win.webContents.openDevTools({ mode: 'detach' })
  // 突破系统安全层级的特殊设置
  win.setAlwaysOnTop(true, 'screen-saver')
  return win
}


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
  // win.webContents.openDevTools()
  return win
}

const createConfigWindow = () => {
  const { left, top } = { left: screen.getPrimaryDisplay().workAreaSize.width - 345, top: screen.getPrimaryDisplay().workAreaSize.height - 840 }
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
  //win.webContents.openDevTools()
  return win
}

module.exports = {
  createSuspensionWindow,
  createEssayWindow,
  createTodoWindow,
  createAlertWindow,
  createConfigWindow,
  createTipWindow,
}