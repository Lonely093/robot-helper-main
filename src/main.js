const { app, Menu, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { createSuspensionWindow, createEssayWindow, createTodoWindow, createTipWindow, createConfigWindow } = require("./window.js")
Menu.setApplicationMenu(null);
const recorder = require('./utils/recorder');
const readConfig  = require('./utils/configManager');
const logger = require('./utils/logger');
const axios= require("axios");
const FormData = require('form-data');
const fs = require('fs');
let suspensionWinPosition = null;
const  urlconfig={
  hnc_stt: readConfig.http.hnc_stt,
  hnc_tti: readConfig.http.hnc_tti,
  hnc_fd: readConfig.http.hnc_fd
};

// 悬浮球的一些设置
const suspensionConfig = {
  width: 80,
  height: 80,
}

// 启动日志
logger.info('应用程序启动', { version: app.getVersion() });

// 全局错误捕获
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', { error: error.stack });
});

//开启日志监听
ipcMain.handle('app-log',  (event, {msg,ctx}) => {
  logger.info(msg, ctx);
});

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


// 处理渲染进程发起的文件上传请求
ipcMain.handle('hnc_stt', async (event, filePath) => {
  try {
    // 1. 创建 FormData
    const form = new FormData();

    // 2. 验证文件路径并附加到 FormData
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      return {code:"999",data:{message:"录音失败"}};
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
        data:form,
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
    return {code:"999",data:{message:error.message}};
  }
});

// 处理渲染进程发起的文件上传请求
ipcMain.handle('hnc_tti', async (event, info) => {
  try {
    
    // 3. 发送请求
    const response = await axios({
      method: 'post',
      url: urlconfig.hnc_tti,
      data:{
          "inputs":info
      },
      headers:{
        'Content-Type': 'application/json' // ✅ 必须明确指定
      },
      timeout: 5000 
   });
   logger.info('请求接口hnc_tti', response.data);
   return response.data;
 } catch (error) {
   logger.error('请求接口hnc_tti异常', error);
    return {code:"999",data:{message:error.message}};
  }
});

// 处理渲染进程发起的文件上传请求
ipcMain.handle('hnc_fd', async (event, info) => {
  try {
    
     // 3. 发送请求  当前返回结果是  data.msg data.command_list  结构
     const response = await axios({
      method: 'post',
      url: urlconfig.hnc_fd,
      data:{
          "inputs":info
      },
      headers:{
        'Content-Type': 'application/json' // ✅ 必须明确指定
      },
      timeout: 5000 
   });
      logger.info('请求接口hnc_fd', response.data);
      return response.data;
  } catch (error) {
      logger.error('请求接口hnc_fd异常', error);
    return {code:"999",data:{msg:error.message}};
  }
});

ipcMain.on('message-from-renderer', (event, { target, data }) => {

  logger.info('窗口间消息推送', {target,data});
  // 查找目标窗口
  var targetWindow=null;
  if(target=="tip")
  {
    targetWindow=pages.tipWin;
  }
  if(target=="todo")
  {
    targetWindow=pages.todoWin;
  }
  if(target=="floatball")
  {
    targetWindow=pages.suspensionWin;
  }
  if (targetWindow) {
      targetWindow.webContents.send('message-to-renderer', data);
  }
});


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

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
  if (pages.todoWin==null) {
    pages.todoWin = createTodoWindow(suspensionWinPosition)
    pages.todoWin.on('close', (e, data) => {
      pages.todoWin = null
    })
  }
})

ipcMain.on('close-todo', (event) => {
  if (pages.todoWin) pages.todoWin.close();
});

ipcMain.on('openTip', (e, data) => {
  console.log("openTipopenTipopenTipopenTipopenTip",suspensionWinPosition);
  if (!pages.tipWin) {
    pages.tipWin = createTipWindow(suspensionWinPosition)
  }
  pages.tipWin.on('close', (e, data) => {
    pages.tipWin = null
  })
})


ipcMain.on('showTip', (e, data) => {
  if (pages.tipWin==null) {
    pages.tipWin = createTipWindow(suspensionWinPosition)
    pages.tipWin.on('close', (e, data) => {
      pages.tipWin = null
    })
  }
})

ipcMain.on('close-tip', (event) => {
  if (pages.tipWin) pages.tipWin.close();
});

ipcMain.on('ballWindowMove', (e, data) => {
  pages.suspensionWin.setBounds({ x: data.x, y: data.y, width: suspensionConfig.width, height: suspensionConfig.height })
  // let display =screen.getPrimaryDisplay();
  let display =data.display;

  suspensionWinPosition = data;
  if (pages.tipWin) {
    let tipWinX = data.x - 205;
    let tipWinY = data.y;
    if(data.closestEdge == "left"){
      tipWinX = data.x + 85;
    }else if(data.closestEdge == "right"){
      tipWinX = data.x - 205;
    }
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
    pages.tipWin.setBounds({ x: tipWinX , y: tipWinY})
  }



  if (pages.todoWin) {
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
    pages.todoWin.setBounds({ x: todoWinX, y: todoWinY })
  }
  
  
})

let suspensionMenu
let topFlag = true
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
ipcMain.on('todo-window-close', () => {
  pages.todoWin.close();
});