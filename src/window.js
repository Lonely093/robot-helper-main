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
  // win.webContents.openDevTools()
  return win
}

const createTodoWindow = (data) => {
  let display =data.display;
  let todoWinX = data.x - 505;
    let todoWinY = data.y - 350;
    if(data.closestEdge == "left"){
      todoWinX = data.x + 85;
    }else if(data.closestEdge == "right"){
      todoWinX = data.x - 505;
    }
    if(todoWinX < 0){
      todoWinX = 0
    }else if(todoWinX > display.workArea.width - 300){
      todoWinX = display.workArea.width - 300
    }
    if(todoWinY < 0){
      todoWinY = 0
    }else if(todoWinY > display.workArea.height - 500){
      todoWinY = display.workArea.height - 500
    }
  const win = new BrowserWindow({
    skipTaskbar: true, // 新增这行关闭任务栏显示
    frame: false,
    minWidth: 500,
    minHeight: 400,
    width: 500,
    height: 400,
    resizable: false,
    x: todoWinX,
    y: todoWinY,
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
  win.webContents.openDevTools({ mode: 'detach' })
  return win
}

const createTipWindow = (data) => {
  // console.log("suspensionWinPositionsuspensionWinPosition",data)
  let display =data.display;
  //const { left, top } = { left: screen.getPrimaryDisplay().workAreaSize.width - 280, top: 100 }
  const { left, top } = { left: screen.getPrimaryDisplay().workAreaSize.width - 270, top: screen.getPrimaryDisplay().workAreaSize.height - 140 }
  let tipWinX = data.x - 205;
  let tipWinY = data.y;
  // console.log("tipWinX",tipWinX,"tipWinY",tipWinY,"111111111")
  if(data.closestEdge == "left"){
    tipWinX = data.x + 85;
  }else if(data.closestEdge == "right"){
    tipWinX = data.x - 205;
  }
  // console.log("tipWinX",tipWinX,"tipWinY",tipWinY,"222222222222222")
  if(tipWinX < 0){
    tipWinX = 0
  }else if(tipWinX > display.workArea.width - 200){
    tipWinX = display.workArea.width - 200
  }
  if(tipWinY < 0){
    tipWinY = 0
  }else if(tipWinY > display.workArea.height - 80){
    tipWinY = display.workArea.height - 80
  }

  const win = new BrowserWindow({
    skipTaskbar: true, // 新增这行关闭任务栏显示
    width: 200,
    minWidth: 200,
    resizable: false,
    height: 80,
    x: tipWinX,
    y: tipWinY,
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
  //win.webContents.openDevTools({ mode: 'detach' })
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