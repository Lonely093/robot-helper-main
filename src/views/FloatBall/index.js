const { ipcRenderer } = require("electron");
const Vue = require('vue')
const throttle = require('lodash.throttle');
const mqttClient = require("../../utils/mqtt")
const stateStore = require("../../utils/localStorage");


let biasX = 0
let biasY = 0
const moveS = [0, 0, 0, 0]
function calcS() {
  const res = Math.pow(moveS[0] - moveS[2], 2) + Math.pow(moveS[1] - moveS[3], 2)
  return res < 5
}


/**
 * Vue应用主组件 - 悬浮球界面
 * 
 * 功能包括:
 * - 语音录制和识别
 * - MQTT消息通信
 * - 指令执行和故障诊断
 * - 界面拖拽和边缘吸附
 * - 配置管理
 * 
 * @component FloatBall
 * @data {Object} 组件数据
 * - count: 计数器数组
 * - opacity: 透明度
 * - mainColor/subColor: 主副颜色
 * - isRecording: 是否正在录音
 * - commandList: 待执行指令列表
 * - runingcmd: 当前执行的指令
 * - checkTimeoutId: 检查指令执行超时定时器
 * - IsMouseLeave: 鼠标是否离开
 * - IsTipClose: 提示框页面是否关闭
 * - IsTodoClose: 故障诊断页面是否关闭
 * 
 * @methods
 * - connectmqtt(): 连接MQTT服务
 * - docommand(): 执行指令
 * - FaultDiagnosis(): 故障诊断
 * - snapToEdge(): 边缘吸附
 * 
 * @emits
 * - error: 错误信息
 * - record-complete: 录音完成
 */
const app = Vue.createApp({

  data: () => {
    return {
      // isNotMore: true,
      count: [0, 0],
      opacity: 0.7,
      mainColor: '',
      subColor: '',
      finalTranscript: "",
      commandList: [],
      runingcmd: null,
      checkTimeoutId: null,
      reverse: false,
      IsMouseLeave: true,
      IsTipClose: true,
      IsTodoClose: true,
    }
  },
  async mounted() {

    //删除历史数据(APP注册)
    stateStore.clearAllApp();

    this.connectmqtt();

    //监听APP指令完成与APP消息
    window.addEventListener('app-command-result', this.handleCommandResult);
    window.addEventListener('app-launch', this.handleAppLaunchResult);
    window.addEventListener('app-message', this.handleAppMessage);

    //监听其他页面传来的消息    
    ipcRenderer.on('message-to-renderer',  (event, data) => {
      //根据文字请求故障诊断  todo
      if (data.type == 1) 
      {
        this.FaultDiagnosis(data.message);
      }
      //根据指令直接执行  todo
      if (data.type == 2)  
      {
        this.fddocommand(data.command);
      }
      //根据文本请求指令交互  tip
      if (data.type == 4) {  
        this.ExeHNC_TTI(data.message);
      }
      //接受Tip传过来的关闭页面消息
      if (data.type == 11) {    
        this.IsTipClose = true;
        if(this.IsTodoClose && this.IsMouseLeave){
          this.opacity = 0.7;
        }
      }
      //接受Tip传过来的打开页面消息
      if (data.type == 12) {    
        this.IsTipClose = false;
        this.opacity = 1;
      }
      //接受todo传过来的关闭页面消息
      if (data.type == 21) {    
        this.IsTodoClose = true;
        if(this.IsTipClose && this.IsMouseLeave){
          this.opacity = 0.7;
        }
      }
      //接受todo传过来的打开页面消息
      if (data.type == 22) {    
        this.IsTodoClose = false;
        this.opacity = 1;
      }
    });

    //  asr连接 前端监听
    // ipcRenderer.on('asr-transcript', (event, data) => {
    //   if (data.isFinal) {
    //     this.finalTranscript += data.text + ' '
    //   }
    //   this.interimTranscript = data.text
    //   this.log(this.interimTranscript);
    // })
    // ipcRenderer.on('asr-error', (event, error) => {
    //   this.log(error.message );
    // })

    this.initThrottledMove();
  },
  beforeUnmount() {
    this.throttledMoveHandler.cancel(); // 重要！销毁时取消节流
    mqttClient._safeDisconnect();  //安全断开MQTT连接
    if(this.checkTimeoutId) clearTimeout(this.checkTimeoutId);
  },
  methods: {
    
    initThrottledMove() {
      this.throttledMoveHandler = throttle(async (e) => {
        await this.handleMove(e);
      }, 3); // 60 FPS
    },

    async handleMove(e) {
      const rect = this.$refs.draggableElement.getBoundingClientRect();
      // 获取窗口内容区域边界信息
      // const winBounds = await ipcRenderer.invoke('get-win-content-bounds');

      // // 计算屏幕绝对坐标
      // const screenX = winBounds.x + rect.left;
      // const screenY = winBounds.y + rect.top;
      // // 获取最近的显示器
      // const display = await ipcRenderer.invoke('get-display-nearest-point', {
      //   x: screenX,
      //   y: screenY
      // });
      const display = await ipcRenderer.invoke('get-primary-display');
      const screenX = e.screenX - biasX;
      const workArea = display.workArea;
      const edges = {
        left: screenX - workArea.x,
        right: workArea.x + workArea.width - (screenX + rect.width),

      };

      let minDist = Infinity;
      let closestEdge = null;

      Object.entries(edges).forEach(([edge, dist]) => {
        if (dist < minDist) {
          minDist = dist;
          closestEdge = edge;
        }
      });
      if (closestEdge == "left") {
        this.reverse = true;
      } else {
        this.reverse = false;
      }
      // this.log(" this.reverse", closestEdge,this.reverse)
      ipcRenderer.send('ballWindowMove', { x: e.screenX - biasX, y: e.screenY - biasY, closestEdge: closestEdge, display: display })
    },

    //发送日志记录
    log(msg, ctx) {
      ipcRenderer.invoke('app-log', { msg: 'floatball--' + msg, ctx });
    },

    async snapToEdge() {
      //this.log("draggableElement.value", this.$refs)
      const rect = this.$refs.draggableElement.getBoundingClientRect();
      //this.log("rect", rect)
      // 获取窗口内容区域边界信息
      const winBounds = await ipcRenderer.invoke('get-win-content-bounds');

      // 计算屏幕绝对坐标
      const screenX = winBounds.x + rect.left;
      const screenY = winBounds.y + rect.top;
      //this.log("screenX,screenY", screenX, screenY)
      // 获取最近的显示器
      const display = await ipcRenderer.invoke('get-display-nearest-point', {
        x: screenX,
        y: screenY
      });

      //this.log("winBounds", winBounds)
      //this.log("display.workArea", display.workArea)
      // 吸附阈值（20px）
      const workArea = display.workArea;
      const SNAP_THRESHOLD = (display.workArea.width - workArea.x) / 2;
      // this.log("screenX - workArea.x", screenX - workArea.x)
      // this.log("workArea.x + workArea.width - (screenX + rect.width)", workArea.x + workArea.width - (screenX + rect.width))
      // 计算与各边的距离
      const edges = {
        left: screenX - workArea.x,
        right: workArea.x + workArea.width - (screenX + rect.width),
        // top: screenY - workArea.y,
        // bottom: workArea.y + workArea.height - (screenY + rect.height)
      };
      //this.log("edges", edges)
      // 找到最近边缘
      let minDist = Infinity;
      let closestEdge = null;

      Object.entries(edges).forEach(([edge, dist]) => {
        if (dist < minDist) {
          minDist = dist;
          closestEdge = edge;
        }
      });

      // 如果没有正距离（可能组件完全超出屏幕），则找绝对值最小的
      // if (closestEdge === null) {
      //   minDist = Infinity;
      //   Object.entries(edges).forEach(([edge, dist]) => {
      //     const absDist = Math.abs(dist);
      //     if (absDist < minDist) {
      //       minDist = absDist;
      //       closestEdge = edge;
      //     }
      //   });
      // }

      // this.log("minDist ", minDist)
      // this.log("closestEdge ", closestEdge)
      // this.log("SNAP_THRESHOLD", SNAP_THRESHOLD)
      // 执行吸附
      // this.log("minDist", minDist)
      if (minDist <= SNAP_THRESHOLD) {
        let newX = winBounds.x;
        let newY = winBounds.y;

        switch (closestEdge) {
          case 'left':
            this.reverse = true;
            // this.log(" workArea.x - rect.left",  workArea.x, rect.left)
            newX = workArea.x - rect.left;
            break;
          case 'right':
            this.reverse = false;
            newX = workArea.x + workArea.width - rect.left - rect.width;
            break;
          // case 'top':
          //   newY = workArea.y - rect.top;
          //   break;
          // case 'bottom':
          //   newY = workArea.y + workArea.height - rect.top - rect.height;
          //   break;
        }
        // this.log("11111111111");
        // this.log("111111111screenX - workArea.x ",screenX, workArea.x );
        if (screenX - workArea.x < 0) {
          // this.log("222222");
          newX = workArea.x - rect.left;
          // this.log(newX);
        } else if (workArea.x + workArea.width - (screenX + rect.width) < 0) {
          newX = workArea.x + workArea.width - rect.left - rect.width;
        }


        if (screenY - workArea.y < 0) {
          newY = workArea.y - rect.top;
        } else if (workArea.y + workArea.height - (screenY + rect.height) < 0) {
          newY = workArea.y + workArea.height - rect.top - rect.height;
        }
        
        if(this.IsTodoClose && this.IsTipClose){
          this.opacity = 0.7;
        }
        // this.isNotMore = true;
        //this.log("set-win-position", {newX, newY})
        // 更新窗口位置
        ipcRenderer.send('set-win-position', {
          x: Math.round(newX),
          y: Math.round(newY)
        });
        ipcRenderer.send('ballWindowMove', { x: Math.round(newX), y: Math.round(newY), closestEdge: closestEdge, display: display })
      }
    },

    //*************************** MQTT **********************//
    async connectmqtt() {
      try {
        // 等待连接成功
        await mqttClient.connect()
      } catch (error) {
        this.log('MQTT连接失败:', error.message);
      }
    },

    //指令处理结果返回
    handleCommandResult(event) {
      const { appId, msg } = event.detail;
      this.log("handleCommandResult:",event.detail);
      if (this.runingcmd != null && appId==this.runingcmd.cmd.app_id ) {
        //取消超时检测
        if (this.checkTimeoutId) clearTimeout(this.checkTimeoutId);
        if (msg == "ok" || msg == "true" || msg == true) //指令执行完成
        {
          if (this.runingcmd.type == 1) {
            this.commandList = this.commandList.shift()
            if (this.commandList.length > 0) {
              this.docommand();
            } else {
              //指令全部处理完成  关闭tip  改为指令成功通知
              //this.closeTip();
              var app = stateStore.getApp(this.runingcmd.cmd.app_id);
              this.floatballtip(1, "好的，已为您打开" + app.name+"页面");
            }
          } else {
            //故障诊断指令执行成功，关闭故障诊断
            //this.closeTodo();
            this.runingcmd = null;
          }
        } else {
          //指令执行失败
          if (this.runingcmd.type == 1) {
            this.floatballtip(0, "抱歉未识别到正确的指令，请重新输入");
            this.commandList = [];
          }
          if (this.runingcmd.type == 2) {
            this.floatballtodo(0, "抱歉未识别到正确的指令，请重新输入");
          }
          this.runingcmd = null;
        }
        if (this.checkTimeoutId) clearTimeout(this.checkTimeoutId);
      }
    },

    //APP推送消息
    handleAppMessage(event) {
      const { appId, msg } = event.detail;
      this.log("handleAppMessage:",event.detail);
    },

    //APP启动反馈
    async handleAppLaunchResult(event) {
      const { appId } = event.detail;
      this.log("handleAppLaunchResult:",event.detail);
      //说明有正在执行的指令，继续执行
      if (this.runingcmd != null && appId == this.runingcmd.cmd.app_id) {
        if (this.runingcmd.type == 1) {
          this.docommand();
        }
        if (this.runingcmd.type == 2) {
          this.fddocommand(this.runingcmd.cmd);
        }
      }
    },

    //********************** MQTT 连接结束 ***************//

    //****************** HTTP接口处理 ****************/

    //将结果回传给Tip 进行提示   1 正常消息    0 错误提示
    floatballtip(type, message) {
      ipcRenderer.send('message-from-renderer', {
        target: 'tip', // 指定目标窗口
        data: { type: type, message: message }
      });
    },

    //通知故障诊断页面
    floatballtodo(type, message, commandlist) {
      // 发送消息到主进程
      ipcRenderer.send('message-from-renderer', {
        target: 'todo', // 指定目标窗口
        data: { type: type, message: message, commandlist }
      });
    },

    //执行指令交互
    async ExeHNC_TTI(message) {
      try {
        //调用 指令交互接口    根据结果判断
        const res = await ipcRenderer.invoke('hnc_tti', message);
        if (res && res.code == 200) {
          if (res.data.command_list && res.data.command_list.length > 0) {
            //故障诊断 需要弹出大的提示框，并返回故障诊断信息以及指令
            //await this.FaultDiagnosis(message);
            if(res.data.command_list[0].app_id=="fault_diagnosis"){
              await this.FaultDiagnosis(message);
            }
            //需要处理的指令集合
            else {
              this.commandList = res.data.command_list;
              this.docommand();
            }
          } else {
            this.floatballtip(0, "抱歉未识别到正确指令,请重试");
          }
        }
        else if (res?.code == 1001 || res?.code == 1002) {
          //故障码 1001   APP不存在
          //故障码 1002   指令不存在
          this.floatballtip(0, "抱歉未识别到正确指令,请重试");
        } else {
          this.floatballtip(0, "抱歉未识别到正确指令,请重试");
        }
      } catch (error) {
        this.floatballtip(0, "抱歉未识别到正确指令,请重试");
      }
    },

    //故障诊断接口
    async FaultDiagnosis(message) {
      this.showTodo();
      this.closeTip();
      //存在偶发消息丢失  目前采用 延时100ms 发送
      setTimeout(async () => {
        this.floatballtodo(3, message);
        try {
          //res = await apis.hnc_fd(result.message);
          const res = await ipcRenderer.invoke('hnc_fd', message);
          if (res && res.code == "200") {
              this.floatballtodo(1, res.data.msg, res.data.command_list);
          } else {
              this.floatballtodo(0, "抱歉未识别到正确的指令，请重新输入");
          }
        } catch (error) {
          this.log("hnc_fd 异常:", error.message);
          this.floatballtodo(0, "抱歉未识别到正确的指令，请重新输入");
        }
      }, 100);
    },

    //直接处理指令
    docommand() {
      if (!this.commandList || this.commandList.length <= 0)  return;
      const cmd = this.commandList[0];
      if(!this.checkMqttState("tip",cmd)) return;

      //每次执行一个指令，等待指令完成之后继续执行下一个指令
      var app = stateStore.getApp(cmd.app_id);
      this.runingcmd = { type: 1, cmd };
      this.checkTimeout();
      if (app.state == "0") { //先启动
        var sendcmd = {
          app_id: cmd.app_id,
          timestamp: Date.now()
        }
        this.log("推送MQTT指令：", sendcmd);
        mqttClient.CommandOpen(sendcmd)

        //模拟返回MQTT
        // setTimeout(() => {
        //   mqttClient.publish('App/Launch/'+cmd.app_id, {
        //     app_id: cmd.app_id,
        //     timestamp: Date.now()
        //   })
        // }, 1500);

      } else { //直接发送指令
        var sendcmd = {
          app_id: cmd.app_id,
          command: cmd.command,
          timestamp: Date.now()
        }
        this.log("推送MQTT指令：", sendcmd);
        mqttClient.CommandAction(sendcmd)

        //模拟返回MQTT
        // setTimeout(() => {
        //   mqttClient.publish('App/Reply/'+cmd.app_id, {
        //     app_id: cmd.app_id,
        //     reply:"ok",
        //     timestamp: Date.now()
        //   })
        // }, 1500);

      }
    },

    //故障诊断的指令处理
    fddocommand(cmd) {
      if(!this.checkMqttState("todo",cmd)) return;
      var app = stateStore.getApp(cmd.app_id);
      this.runingcmd = { type: 2, cmd };
      //启动指令超时检测
      this.checkTimeout();
      //先启动
      if (app.state == "0") { 
        var sendcmd = {
          app_id: cmd.app_id,
          timestamp: Date.now()
        }
        this.log("推送MQTT指令：", sendcmd);
        mqttClient.CommandOpen(sendcmd)

        //模拟返回MQTT
        // setTimeout(() => {
        //   mqttClient.publish('App/Launch/'+cmd.app_id, {
        //     app_id: cmd.app_id,
        //     timestamp: Date.now()
        //   })
        // }, 1500);

      }
      //直接发送指令 
      else { 
        var sendcmd = {
          app_id: cmd.app_id,
          command: cmd.command,
          timestamp: Date.now()
        }
        this.log("推送MQTT指令：", sendcmd);
        mqttClient.CommandAction(sendcmd)

        //模拟返回MQTT
        // setTimeout(() => {
        //   mqttClient.publish('App/Reply/'+cmd.app_id, {
        //     app_id: cmd.app_id,
        //     reply:"ok",
        //     timestamp: Date.now()
        //   })
        // }, 1500);

      }
    },

    //校验MQTT相关状态
    checkMqttState(target,cmd){
      //首先检查MQTT
      if(!mqttClient.GetConnected())
      {
        this.setTimeoutSend(target,"MQTT服务未连接");
        return false;
      }
      //判断APP注册消息
      if(cmd)
      {
        var app = stateStore.getApp(cmd.app_id);
        if(!app){
          this.setTimeoutSend(target,"当前APP未注册");
          return false;
        }else{
          if(!app.ai_interaction.action){
            this.setTimeoutSend(target,"当前APP["+app.name+"]不支持启动");
            return false;
          }
          if(!app.ai_interaction.exec){
            this.setTimeoutSend(target,"当前APP["+app.name+"]不支持指令执行");
            return false;
          }
        }
      }
      return true;
    },

    //延时发送异常消息
    setTimeoutSend(target,message){
      setTimeout(() => {
        ipcRenderer.send('message-from-renderer', {
          target: target, //指定目标窗口
          data: { type: 0, message }
        });
      }, 2000);
      this.commandList = [];
    },

    //处理超时情况
    checkTimeout() {
      if (this.checkTimeoutId) clearTimeout(this.checkTimeoutId);
      this.checkTimeoutId = setTimeout(() => {
        //超过3秒还没执行完成一个指令
        if (this.runingcmd != null) {
          if (this.runingcmd.type == 1) {
            this.floatballtip(0, "指令执行超时");
          }
          if (this.runingcmd.type == 2) {
            this.floatballtodo(0, "指令执行超时");
          }
          this.runingcmd = null;
          this.commandList = [];
        }
      }, 3000);
    },

    /****************** HTTP接口处理结束 ****************/

    hanleMouseEnter() {
      this.IsMouseLeave = false;
      this.opacity = 1;

      //通知tip 鼠标在悬浮窗上
      ipcRenderer.send('message-from-renderer', {
        target: 'tip', // 指定目标窗口
        data: { type: 4}
      });
    },

    hanleMouseLeave() {
      this.IsMouseLeave = true;
      if(this.IsTipClose && this.IsTodoClose)
      {
        this.opacity = 0.7;
      }
      //通知tip 鼠标离开了悬浮窗
      ipcRenderer.send('message-from-renderer', {
        target: 'tip', // 指定目标窗口
        data: { type: 5}
      });
    },
    showTip() {
      if (this.IsTipClose)
        ipcRenderer.send("showTip", "show")
    },
    closeTip() {
      if (!this.IsTipClose)
      ipcRenderer.send("close-tip");
    },
    showTodo() {
      if (this.IsTodoClose)
        ipcRenderer.send("showTodo", "show")
    },
    closeTodo() {
      if (!this.IsTodoClose)
      ipcRenderer.send("close-todo");
    },
    handleMouseDown(e) {
      this.opacity = 1;
      if (e.button == 2) {
        // ipcRenderer.send('close-tip');
        // ipcRenderer.send("close-todo")
        // this.isNotMore = true
        ipcRenderer.send('openMenu')
        return
      }

      biasX = e.x;
      biasY = e.y;
      moveS[0] = e.screenX - biasX
      moveS[1] = e.screenY - biasY
      document.addEventListener('mousemove', this.throttledMoveHandler)
      document.addEventListener('mouseup', this.handleMouseUp)

    },

    async handleMouseUp(e) {
      moveS[2] = e.screenX - e.x
      moveS[3] = e.screenY - e.y

      biasX = 0
      biasY = 0
      document.removeEventListener('mousemove', this.throttledMoveHandler)

      await this.snapToEdge();
      if (calcS() && e.button == 0) {
        this.closeTodo();
        this.showTip();
      }
      if (calcS() && e.button == 1) {
        this.showTodo();
      }
    },

  },
  watch: {
    // isNotMore(newValue) {
    //   if (newValue == false) {
    //     ipcRenderer.send("showTip", "show")
    //     ipcRenderer.send("showTodo", "show")
    //   }
    //   // this.log(calcS(),"close-tip")
    //   if (newValue == true) {
    //     // this.log("close-tip")
    //     ipcRenderer.send('close-tip');
    //   }

    //   this.log("isNotMore changed to:", newValue);
    // }
  },
  computed: {
    progress: function () {
      const totalCount = this.count[0] + this.count[1]
      if (totalCount == 0) {
        return "0%"
      } else {
        const percent = parseInt(this.count[1] * 100 / totalCount)
        return percent + "%"
      }
    },
    imageStyle() {
      return {
        transform: this.reverse ? 'scaleX(-1)' : 'none',
        display: 'inline-block' // 确保 transform 生效
      }
    },
  }
})
app.mount("#app")