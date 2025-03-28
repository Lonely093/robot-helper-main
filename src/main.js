const { app, Menu, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { createSuspensionWindow, createTodoWindow, createTipWindow } = require("./window.js")
Menu.setApplicationMenu(null);
const recorder = require('./utils/recorder');
const readConfig = require('./utils/configManager');
const logger = require('./utils/logger');
const axios = require("axios");
const FormData = require('form-data');
const fs = require('fs');

//请求URL地址
const urlconfig = {
  hnc_stt: readConfig.http.hnc_stt,
  hnc_tti: readConfig.http.hnc_tti,
  hnc_fd: readConfig.http.hnc_fd
};

// 悬浮球的一些设置
const suspensionConfig = {
  width: 85,
  height: 85,
}

// 定义所有可能用到的页面
const pages = {
  suspensionWin: undefined,
  essayWin: undefined,
  todoWin: undefined,
  configWin: undefined,
  tipWin: undefined,
}

//悬浮窗位置
let suspensionWinPosition = null;

//右键菜单
let suspensionMenu;

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  // 如果已经有实例运行，直接退出
  app.quit()
}

// 启动日志
logger.info('应用程序启动', { version: app.getVersion() });

// 全局错误捕获
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', { error: error.stack });
});

//开启日志监听
ipcMain.handle('app-log', (event, { msg, ctx }) => {
  logger.info(msg, ctx);
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// 处理渲染进程发起的文件上传请求
ipcMain.handle('hnc_stt', async (event, filePath) => {
  try {
    // 1. 创建 FormData
    const form = new FormData();

    // 2. 验证文件路径并附加到 FormData
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      return { code: "999", data: { message: "录音失败" } };
    }

    const fileStream = fs.createReadStream(absolutePath);
    form.append('audio_file', fileStream, {
      filename: path.basename(absolutePath), // 确保文件名正确
      contentType: 'audio/wav'
    });

    // 3. 发送请求
    const response = await axios(
      {
        method: 'post',
        url: urlconfig.hnc_stt,
        data: form,
        headers: {
          'accept': 'application/json',
          //'Content-Type': 'multipart/form-data'
          ...form.getHeaders(), // 自动生成 multipart/form-data 的 Content-Type 和 boundary
        },
        timeout: 5000
      }
    );
    logger.info('请求接口hnc_stt', response.data);
    return response.data;
  } catch (error) {
    logger.error('请求接口hnc_stt异常', error);
    return { code: "999", data: { message: error.message } };
  }
});

// 处理渲染进程发起的指令交互请求
ipcMain.handle('hnc_tti', async (event, info) => {
  try {

    // 3. 发送请求
    const response = await axios({
      method: 'post',
      url: urlconfig.hnc_tti,
      data: {
        "inputs": info
      },
      headers: {
        'Content-Type': 'application/json' // ✅ 必须明确指定
      },
      timeout: 5000
    });
    logger.info('请求接口hnc_tti', response.data);
    return response.data;
  } catch (error) {
    logger.error('请求接口hnc_tti异常', error);
    return { code: "999", data: { message: error.message } };
  }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 处理渲染进程发起的故障诊断请求
ipcMain.handle('hnc_fd', async (event, info) => {
  try {

    //await sleep(10000);
    // 3. 发送请求  当前返回结果是  data.msg data.command_list  结构
    const response = await axios({
      method: 'post',
      url: urlconfig.hnc_fd,
      data: {
        "inputs": info
      },
      headers: {
        'Content-Type': 'application/json' // ✅ 必须明确指定
      },
      timeout: 30000
    });
    logger.info('请求接口hnc_fd', response.data);
    return response.data;
  } catch (error) {
    logger.error('请求接口hnc_fd异常', error);
    return { code: "999", data: { msg: error.message } };
  }
});

//窗口之间的消息交互
ipcMain.on('message-from-renderer', (event, { target, data }) => {

  logger.info('窗口间消息推送', { target, data });
  // 查找目标窗口
  var targetWindow = null;
  if (target == "tip") {
    targetWindow = pages.tipWin;
  }
  if (target == "todo") {
    targetWindow = pages.todoWin;
  }
  if (target == "floatball") {
    targetWindow = pages.suspensionWin;
  }
  if (targetWindow) {
    targetWindow.webContents.send('message-to-renderer', data);
  }
});

// 确保初始化顺序
app.whenReady().then(() => {
  logger.info('[主进程] Electron准备就绪');

  //注册麦克风录音
  recorder.initialize();
  pages.suspensionWin = createSuspensionWindow(suspensionConfig)
}).catch(err => {
  logger.error('应用启动失败:', err);
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
    logger.info('activate [主进程] Electron准备就绪');
    //注册麦克风录音
    recorder.initialize();
    pages.suspensionWin = createSuspensionWindow(suspensionConfig)
  }
});

//打开 故障诊断页面 监听
ipcMain.on('showTodo', (e, data) => {
  if (pages.todoWin == null) {
    pages.todoWin = createTodoWindow(suspensionWinPosition)
    // console.log("ipcMain.on('showTodo', (e, data) => {",suspensionWinPosition.closestEdge)
    pages.todoWin.send('todo-reverse', suspensionWinPosition.closestEdge)
    pages.todoWin.on('close', (e, data) => {
      pages.todoWin = null
    })
    pages.suspensionWin.webContents.send('message-to-renderer', { type: 22 });
  }
})

//关闭 故障诊断页面 监听
ipcMain.on('close-todo', (event) => {
  if (pages.todoWin) {
    pages.todoWin.close();
    pages.suspensionWin.webContents.send('message-to-renderer', { type: 21 });
  }
});

//打开 提示框页面 监听
ipcMain.on('showTip', (e, data) => {
  if (pages.tipWin == null) {
    pages.tipWin = createTipWindow(suspensionWinPosition)
    pages.tipWin.send('tip-reverse', suspensionWinPosition.closestEdge)
    pages.tipWin.on('close', (e, data) => {
      pages.tipWin = null
    })
    pages.suspensionWin.webContents.send('message-to-renderer', { type: 12 });
  }
})

//关闭 提示框页面 监听
ipcMain.on('close-tip', (event) => {
  if (pages.tipWin) {
    pages.tipWin.close();
    pages.suspensionWin.webContents.send('message-to-renderer', { type: 11 });
  }
});

// 悬浮窗 窗口移动 监听
ipcMain.on('ballWindowMove', (e, data) => {
  // console.log("ballWindowMove",data);
  pages.suspensionWin.setBounds({ x: data.x, y: data.y, width: suspensionConfig.width, height: suspensionConfig.height })
  // let display =screen.getPrimaryDisplay();
  let display = data.display;

  suspensionWinPosition = data;
  if (pages.tipWin) {
    let tipWinX = data.x - 300;
    let tipWinY = data.y - 15;

    pages.tipWin.send('tip-reverse', data.closestEdge)
    if (data.closestEdge == "left") {
      tipWinX = data.x + 85;
    } else if (data.closestEdge == "right") {
      tipWinX = data.x - 300;
    }
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
    pages.tipWin.setBounds({ x: tipWinX, y: tipWinY, width: 300, height: 70 })
  }

  if (pages.todoWin) {
    pages.todoWin.send('todo-reverse', data.closestEdge);

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
    pages.todoWin.setBounds({ x: todoWinX, y: todoWinY, width: 700, height: 450 })
  }

})

//右键 打开菜单 监听
ipcMain.on('openMenu', (e) => {
  if (!suspensionMenu) {
    suspensionMenu = Menu.buildFromTemplate([
      // {
      //   label: '开发者工具',
      //   click: () => {
      //     pages.suspensionWin.webContents.openDevTools({ mode: 'detach' })
      //   }
      // },
      {
        label: '重启',
        click: () => {
          app.quit()
          app.relaunch()
        }
      },
      {
        label: '退出',
        click: () => {
          app.quit();
        }
      },
    ]);
  }
  suspensionMenu.popup({});
});
ipcMain.handle('get-window-position', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win.getPosition();
});
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

ipcMain.handle('get-primary-display', (event, point) => {
  // point 参数结构：{ x: number, y: number }
  return screen.getPrimaryDisplay();
});

ipcMain.on('set-win-position', (event, position) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  // console.log("set-win-position", event, position)
  // 设置窗口位置（单位：像素）
  win.setPosition(
    Math.round(position.x),
    Math.round(position.y),
    true // 启用动画
  )
})
