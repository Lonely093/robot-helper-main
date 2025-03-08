const { app, Menu, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { createSuspensionWindow, createEssayWindow, createTodoWindow, createTipWindow, createConfigWindow } = require("./window.js")
Menu.setApplicationMenu(null);

const recorder   = require('./utils/recorder');
//const recorder = new AudioRecorder();


// 悬浮球的一些设置
const suspensionConfig = {
  width: 85,
  height: 50,
}

// const suspensionConfig = {
//   width: 200,
//   height: 347,
// }

// 定义所有可能用到的页面
const pages = {
  suspensionWin: undefined,
  essayWin: undefined,
  todoWin: undefined,
  configWin: undefined,
  tipWin: undefined,
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

// 确保初始化顺序
app.whenReady().then(() => {
  console.log('[主进程] Electron准备就绪');
  //注册麦克风录音
  recorder.initialize();
  pages.suspensionWin = createSuspensionWindow(suspensionConfig)
}).catch(err => {
  console.error('应用启动失败:', err);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log('activate [主进程] Electron准备就绪');
    //注册麦克风录音
    recorder.initialize();
    pages.suspensionWin = createSuspensionWindow(suspensionConfig)
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// 主进程监听事件相关

ipcMain.on('showEssay', (e, data) => {
  if (pages.essayWin) {
    // 如果已经打开了 就关闭重打开
    pages.essayWin.close()
    pages.essayWin = null
  }
  pages.essayWin = createEssayWindow()
  pages.essayWin.on('close', (e, data) => {
    pages.essayWin = null
  })
})

ipcMain.on('showTodo', (e, data) => {
  if (pages.todoWin) {
    pages.todoWin.close()
    pages.todoWin = null
  }
  pages.todoWin = createTodoWindow()
  pages.todoWin.on('close', (e, data) => {
    pages.todoWin = null
  })
})

ipcMain.on('showTip', (e, data) => {
  if (pages.tipWin) {
    pages.tipWin.close()
    pages.tipWin = null
  }
  pages.tipWin = createTipWindow()
  pages.tipWin.on('close', (e, data) => {
    pages.tipWin = null
  })
})

ipcMain.on('close-tip', (event) => {
  if (pages.tipWin) pages.tipWin.close();
});

ipcMain.on('ballWindowMove', (e, data) => {
  pages.suspensionWin.setBounds({ x: data.x, y: data.y, width: suspensionConfig.width, height: suspensionConfig.height })
  // pages.floatWin.setPosition(data.x, data.y)
})

let suspensionMenu
let topFlag = true
ipcMain.on('openMenu', (e) => {
  // if (!suspensionMenu) {
  //   suspensionMenu = Menu.buildFromTemplate([
  //     {
  //       label: '开发者工具',
  //       click: () => {
  //         pages.suspensionWin.webContents.openDevTools({ mode: 'detach' })
  //       }
  //     },
  //     {
  //       label: '重启',
  //       click: () => {
  //         app.quit()
  //         app.relaunch()
  //       }
  //     },
  //     {
  //       label: '退出',
  //       click: () => {
  //         app.quit();
  //       }
  //     },
  //   ]);
  // }
  // suspensionMenu.popup({});
});

ipcMain.on('setFloatIgnoreMouse', (e, data) => {
  pages.suspensionWin.setIgnoreMouseEvents(data, { forward: true })
})

// main.js

ipcMain.on('todo', (e, data) => {
  // console.log(data.name)
  // if (data.name == "getAll") {
  //   getAllTodo(data.status).then(res => {
  //     e.returnValue = res
  //   }, e => {
  //     console.log(e)
  //   })
  // } else if (data.name == "change") {
  //   changeTodoStatus(data.id, data.status)
  //   getBallData().then(res => {
  //     console.log(res)
  //     pages.suspensionWin.webContents.send('update', res)
  //   })
  // } else if (data.name == "add") {
  //   addTodo(data.content, data.end_time).then(
  //     res => {
  //       getBallData().then(res => {
  //         console.log(res)
  //         pages.suspensionWin.webContents.send('update', res)
  //       })
  //       e.returnValue = res
  //     },
  //     e => {
  //       console.log(e)
  //     }
  //   )
  // }
})

ipcMain.on('updateBall', (e, data) => {
  // getBallData().then(res => {
  //   pages.suspensionWin.webContents.send('update', res)
  // })
})

ipcMain.on('updateConfig', (e, data) => {
  pages.suspensionWin.webContents.send('config', data)
})

ipcMain.handle('get-win-content-bounds', (event) => {
  // 从发送请求的渲染进程获取对应的 BrowserWindow 实例
  const win = BrowserWindow.fromWebContents(event.sender);

  // 返回窗口内容区域的边界信息（相对于屏幕）
  return win.getContentBounds();
});
ipcMain.handle('get-display-nearest-point', (event, point) => {
  // point 参数结构：{ x: number, y: number }
  return screen.getDisplayNearestPoint({
    x: Math.round(point.x),
    y: Math.round(point.y)
  })
});
ipcMain.on('set-win-position', (event, position) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  console.log("set-win-position", event, position)
  // 设置窗口位置（单位：像素）
  win.setPosition(
    Math.round(position.x),
    Math.round(position.y),
    true // 启用动画
  )
})
