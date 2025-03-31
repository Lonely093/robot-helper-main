const { app, Menu, BrowserWindow, ipcMain, screen } = require('electron');
const { exec } = require('child_process')
const path = require('path');
const { createSuspensionWindow, createTodoWindow, createTipWindow, createAlertWindow } = require("./window.js")
Menu.setApplicationMenu(null);
const recorder = require('./utils/recorder');
const readConfig = require('./utils/configManager');
const logger = require('./utils/logger');
const axios = require("axios");
const FormData = require('form-data');
const fsp = require('fs').promises;
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
  alertWin: undefined,
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
  if (target == "alert") {
    targetWindow = pages.alertWin;
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

//打开 提示框页面 监听
ipcMain.on('showAlert', (e, data) => {
  if (pages.alertWin == null) {
    pages.alertWin = createAlertWindow(suspensionWinPosition)
    // pages.alertWin.send('tip-reverse', suspensionWinPosition.closestEdge)
    pages.alertWin.on('close', (e, data) => {
      pages.alertWin = null
    })
    // pages.suspensionWin.webContents.send('message-to-renderer', { type: 12 });
  }
})

//关闭 提示框页面 监听
ipcMain.on('close-alert', (event) => {
  if (pages.alertWin) {
    pages.alertWin.close();
    // pages.suspensionWin.webContents.send('message-to-renderer', { type: 11 });
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
      {
        label: '版本 ' + readConfig.about?.version,
        enabled: false // 添加这一行禁用点击
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


// 扫描指定目录+ 自动检测U盘并扫描
ipcMain.handle('scan-directory', async (event) => {
  try {

    var results = await findSptFiles(readConfig.scandirectory)
    const drives = await getRemovableDrives()
    for (const drive of drives) {
      try {
        const files = await findSptFiles(drive.mountPoint)
        results.push(...files)
      } catch (err) {
        console.error(`扫描 ${drive.name} 失败:`, err)
      }
    }
    return {
      success: true,
      files: results
    }
  }
  catch {
    return {
      success: false,
      message: err.message
    }
  }
})

// 文件扫描核心逻辑
async function findSptFiles(dir, depth = 3) {
  const results = []
  try {
    const normalizedDir = path.normalize(dir)
    if (isSystemDirectory(normalizedDir)) return []
     
     // 使用安全读取模式
    const entries = await fsp.readdir(normalizedDir, { withFileTypes: true})
    for (const entry of entries) {
      const fullPath = path.join(normalizedDir, entry.name)

       // 过滤隐藏文件（如带"."或系统隐藏属性）
      if (isHiddenFile(fullPath)) continue

      if (entry.isDirectory() && depth > 0) {
        const subResults = await findSptFiles(fullPath, depth - 1)
        results.push(...subResults)
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === readConfig.scansuffix) {
        results.push({
          path: fullPath,
          name: entry.name,
          //stats: await fs.stat(fullPath),
          //content: await readSptFile(fullPath) // 可选
        })
      }
    }
  } catch (error) {

  }
  return results
}

const isSystemDirectory = (dirPath) => {
  const systemDirs = [
    'System Volume Information',
    '$RECYCLE.BIN',
    'Windows',
    'Program Files'
  ]
  return systemDirs.some(name =>
    dirPath.toLowerCase().includes(name.toLowerCase())
  )
}

// 判断隐藏文件
function isHiddenFile(filePath) {
  if (process.platform === 'win32') {
    try {
      const stats = fs.statSync(filePath)
      return (stats.mode & 0o444) === 0 // 检查系统隐藏属性
    } catch {
      return true
    }
  } else {
    //return path.basename(filePath).startsWith('.')
  }
  return false;
}

// 读取.spt文件内容（示例）
async function readSptFile(filePath) {
  try {
    const content = await fsp.readFile(filePath, 'utf-8')
    return {
      raw: content,
      parsed: parseSptContent(content) // 自定义解析逻辑
    }
  } catch (err) {
    return { error: err.message }
  }
}

// 获取可移动磁盘列表（跨平台）
async function getRemovableDrives() {
  return new Promise((resolve, reject) => {
    exec('wmic logicaldisk get DeviceID,DriveType,VolumeName 2>&1', (error, stdout, stderr) => {
      if (error) {
        console.error('命令执行失败:', error.message)
        return resolve([])
      }
      if (stderr) {
        console.error('错误输出:', stderr)
        return resolve([])
      }

      try {
        const drives = []
        const lines = stdout.split('\r\r\n').slice(1) // 分割有效行

        for (const line of lines) {
          const cleaned = line.replace(/\s+/g, ' ').trim()
          if (!cleaned) continue

          const [deviceId, driveType, volumeName] = cleaned.split(' ')
          // DriveType: 2=Removable, 3=Fixed, 5=CD-ROM
          if (driveType === '2') {
            const mountPoint = deviceId + '\\'

            // 二次验证驱动器有效性
            if (fs.existsSync(mountPoint)) {
              drives.push({
                deviceId,
                mountPoint,
                name: volumeName || 'Removable Disk',
                type: 'USB',
                size: getDriveSize(mountPoint) // 新增容量检测
              })
            }
          }
        }

        resolve(drives)
      } catch (parseError) {
        console.error('解析错误:', parseError)
        resolve([])
      }
    })
  })
}


// 新增驱动器容量检测
function getDriveSize(mountPoint) {
  try {
    const stats = fs.statfsSync ? fs.statfsSync(mountPoint) : null // 需要Node.js v18.15+
    return stats ? {
      total: stats.blocks * stats.bsize,
      free: stats.bfree * stats.bsize
    } : null
  } catch {
    return null
  }
}
