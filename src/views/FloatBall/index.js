const { ipcRenderer } = require("electron");
const Vue = require('vue')

const { defaultConfig, getConfig, applyConfig } = require("../../utils/store")

const { ref } = require('vue')
const draggableElement = ref(null);

const mqttClient = require("../../utils/mqtt")
const stateStore = require("../../utils/localStorage");
const path = require('path');
const fs = require('fs');


applyConfig()
let biasX = 0
let biasY = 0
const moveS = [0, 0, 0, 0]
function calcS() {
  const res = Math.pow(moveS[0] - moveS[2], 2) + Math.pow(moveS[1] - moveS[3], 2)
  return res < 5
}
function handleMove(e) {
  ipcRenderer.send('ballWindowMove', { x: e.screenX - biasX, y: e.screenY - biasY })
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
 * 
 * @methods
 * - toggleRecording(): 开始/停止录音
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
      opacity: 0.8,
      mainColor: '',
      subColor: '',
      isStopRecording: false,
      isRecording: false,
      mediaStream: null,
      audioContext: null,
      analyser: null,
      silenceCount: 0,
      animationFrameId: null,
      finalTranscript:"",
      commandList:[],
      runingcmd:null,
      checkTimeoutId:null,
      reverse: false
    }
  },

async mounted() {

    const storage = getConfig()
    this.mainColor = storage.mainColor
    this.subColor = storage.subColor
    this.opacity = storage.opacity
    ipcRenderer.on("update", (e, data) => {
      //console.log(data)
      this.count = data
    })
    ipcRenderer.on("config", (e, data) => {
      this.opacity = data.opacity
      this.mainColor = data.mainColor
      this.subColor = data.subColor
    })
    ipcRenderer.send("updateBall")

    this.connectmqtt();

    //监听APP指令完成与APP消息
    window.addEventListener('app-command-result', this.handleCommandResult);
    window.addEventListener('app-launch', this.handleAppLaunchResult);
    window.addEventListener('app-message', this.handleAppMessage);

    //监听故障诊断页面传来的消息    1 根据文本请求故障诊断     2 执行 commd指令
    ipcRenderer.on('message-to-renderer', (event, data) => {
      if(data.type==1)  //根据文字请求故障诊断
      {
        this.FaultDiagnosis(data.message);
      }
      if(data.type==2)  //根据指令直接执行
      {
        this.fddocommand(data.command);
      }
    });

    //  asr连接 前端监听
    // ipcRenderer.on('asr-transcript', (event, data) => {
    //   if (data.isFinal) {
    //     this.finalTranscript += data.text + ' '
    //   }
    //   this.interimTranscript = data.text
    //   console.log(this.interimTranscript);
    // })
    // ipcRenderer.on('asr-error', (event, error) => {
    //   console.log(error.message );
    // })
  },
  methods: {
  

    //发送日志记录
    log(msg,ctx){
      ipcRenderer.invoke('app-log', { msg: 'floatball--'+msg,  ctx });
    },

    async snapToEdge() {
      //console.log("draggableElement.value", this.$refs)
      const rect = this.$refs.draggableElement.getBoundingClientRect();
      //this.log("rect", rect)
      // 获取窗口内容区域边界信息
      const winBounds = await ipcRenderer.invoke('get-win-content-bounds');

      // 计算屏幕绝对坐标
      const screenX = winBounds.x + rect.left;
      const screenY = winBounds.y + rect.top;
      console.log("screenX,screenY", screenX, screenY)
      // 获取最近的显示器
      const display = await ipcRenderer.invoke('get-display-nearest-point', {
        x: screenX,
        y: screenY
      });

      //this.log("winBounds", winBounds)
      // console.log("display.workArea", display.workArea)
      // 吸附阈值（20px）
      const workArea = display.workArea;
      const SNAP_THRESHOLD = (display.workArea.width- workArea.x)/2;
      // console.log("screenX - workArea.x", screenX - workArea.x)
      // console.log("workArea.x + workArea.width - (screenX + rect.width)", workArea.x + workArea.width - (screenX + rect.width))
      // 计算与各边的距离
      const edges = {
        left: screenX - workArea.x,
        right: workArea.x + workArea.width - (screenX + rect.width),
        // top: screenY - workArea.y,
        // bottom: workArea.y + workArea.height - (screenY + rect.height)
      };
      //console.log("edges", edges)
      // 找到最近边缘
      let minDist = Infinity;
      let closestEdge = null;

      Object.entries(edges).forEach(([edge, dist]) => {
        if ( dist < minDist) {
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

      // console.log("minDist ", minDist)
      // console.log("closestEdge ", closestEdge)
      // console.log("SNAP_THRESHOLD", SNAP_THRESHOLD)
      // 执行吸附
      // console.log("minDist", minDist)
      if (minDist <= SNAP_THRESHOLD) {
        let newX = winBounds.x;
        let newY = winBounds.y;

        switch (closestEdge) {
          case 'left':
            this.reverse =true;
            // console.log(" workArea.x - rect.left",  workArea.x, rect.left)
            newX = workArea.x - rect.left;
            break;
          case 'right':
            this.reverse =false;
            newX = workArea.x + workArea.width - rect.left - rect.width;
            break;
          // case 'top':
          //   newY = workArea.y - rect.top;
          //   break;
          // case 'bottom':
          //   newY = workArea.y + workArea.height - rect.top - rect.height;
          //   break;
        }
        // console.log("11111111111");
        // console.log("111111111screenX - workArea.x ",screenX, workArea.x );
        if(screenX - workArea.x < 0){
          // console.log("222222");
          newX = workArea.x - rect.left;
          // console.log(newX);
        }else if(workArea.x + workArea.width - (screenX + rect.width) < 0){
          newX = workArea.x + workArea.width - rect.left - rect.width;
        }


        if(screenY - workArea.y < 0){
          newY = workArea.y - rect.top;
        }else if(workArea.y + workArea.height - (screenY + rect.height) < 0){
          newY = workArea.y + workArea.height - rect.top - rect.height;
        }
        this.opacity = 0.3;
        // this.isNotMore = true;
        console.log("set-win-position", {newX, newY})
        // 更新窗口位置
        ipcRenderer.send('set-win-position', {
          x: Math.round(newX),
          y: Math.round(newY)
        });
      }
    },

    // ***********************麦克风录音 ***************//
    async toggleRecording() {
      if (this.isRecording) {
        await this.stopRecording();
      } else {
        await this.startRecording();
      }
    },
    async startRecording() {
      if (this.isRecording ||  this.commandList.length > 0) {
        return;
      }
      try {
        // 初始化音频流
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('[Renderer] 已获得麦克风权限');
        } catch (err) {
          if(err.message=="Requested device not found"){
            this.floatballtip(0, "未检测到麦克风设备");
          }
          console.log('[Renderer] 麦克风访问被拒绝:', err.message);
          return;
        }
        // 初始化音频分析
        this.setupAudioAnalysis();
        // 通知主进程开始录音
        const { path } = await ipcRenderer.invoke('audio-start');
        console.log(`[Renderer] 录音文件路径: ${path}`);
        // 创建媒体录音器
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.setupDataHandler();
        this.isRecording = true;
        this.startMonitoring();
      } catch (err) {
        console.log('录音启动失败:', err.message);
      }
    },
    setupAudioAnalysis() {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      console.log('[Renderer] 音频上下文采样率:', this.audioContext.sampleRate);
    },
    setupDataHandler() {
      this.mediaRecorder.ondataavailable = async (e) => {
        try {
          const buffer = await e.data.arrayBuffer();
          ipcRenderer.send('audio-chunk', buffer);
        } catch (err) {
          console.log('[Renderer] 数据处理失败:', err);
        }
      };

      this.mediaRecorder.start(500); // 每1秒收集数据
      console.log('[Renderer] 媒体录音器已启动');
    },
    startMonitoring() {
      const checkStatus = () => {
        if (!this.isRecording) return;

        // 分析音量
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        const volume = Math.max(...dataArray) / 255;

        // 静音检测
        this.checkSilence(volume);

        this.animationFrameId = requestAnimationFrame(checkStatus);
      };
      checkStatus();
    },
    checkSilence(volume) {
      if (this.isStopRecording) return;
      const SILENCE_THRESHOLD = 0.6; //可调整的静音阈值 最大值为1  
      //console.log(volume);
      //此处为超过1s检测到的麦克风电流小于0.6则停止录音
      if (volume < SILENCE_THRESHOLD) {
        this.silenceCount += 1 / 60;
        if (this.silenceCount >= 2) {
          console.log('[Renderer] 检测到持续静音，自动停止');
          this.stopRecording();
        }
      } else {
        this.silenceCount = 0;
      }
    },
    async stopRecording() {
      if (!this.isRecording) return;
      if (this.isStopRecording) return;
      var result = {
        success: false,
        message: ""
      }
      try {
        this.isRecording = false;
        this.isStopRecording = true;
        // 停止媒体录音器
        if (this.mediaRecorder?.state === 'recording') {
          this.mediaRecorder.stop();
        }
        // 通知主进程停止 保存录音文件并上传接口，返回结果
        result = await ipcRenderer.invoke('audio-stop');
        console.log('[Renderer] 录音保存结果:', result);
      } catch (err) {
        console.log('[Renderer] 停止失败:', err.message);
        result.message = err.message;
      } finally {
        this.handlestopRecordAfter(result);
        this.isStopRecording = false;
      }
    },
    cleanup() {
      // 清理资源
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
      }
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }

      this.isRecording = false;
      this.silenceCount = 0;
      console.log('[Renderer] 资源已清理');
    },

    // ***********************麦克风录音结束 ***************//

    //*************************** MQTT **********************//
    async connectmqtt() {
      try {
        // 等待连接成功
        await mqttClient.connect()

        //测试主题
        // mqttClient.subscribe('test/topic', (message, topic) => {
        //   console.log(`Received message from ${topic}:`, message)
        // })
        
        //启动消息   App/Open/+  对应 App/Launch/+

        //AppCenter/Apps  //参见报文3
        //App/Launch/+    //参见报文10
        //App/Exit/+       //参见报文30
        //App/Reply/+      //参见报文14
        //App/Message/+   //App主动向语音助手发送消息时使用  //参见报文31

        //APP注册发布主题
        // mqttClient.subscribe('AppCenter/Apps', (message, topic) => {
        //   console.log(`Received message from ${topic}:`, message)
        // })

        // //发送主题
        // mqttClient.publish('test/topic', {
        //   text: 'Hello from Vue',
        //   timestamp: Date.now()
        // })
        // console.log("发送主题");

      } catch (error) {
        console.log('MQTT连接失败:', error.message);
      }
    },

    //指令处理结果返回
    handleCommandResult(event) {
      const { appId, msg } = event.detail;
      console.log("handleCommandResult:",msg);
      console.log("handleCommandResult:",this.runingcmd);
      if(this.runingcmd!=null)
      {
        if(msg=="ok") //指令执行完成
        {
          if(this.runingcmd.type==1)
          {
            this.commandList = this.commandList.shift()
            if(this.commandList.length>0){
              this.docommand();
            }
          }
        }else{  //指令执行失败
          if(this.runingcmd.type==1)
          {
            this.floatballtip(0,"指令执行失败:"+msg);
            this.commandList =[];
          }
          if(this.runingcmd.type==2)
          {
            this.floatballtodo(0,"指令执行失败:"+msg);
          }
          this.runingcmd=null;
          if(this.checkTimeoutId) clearTimeout(this.checkTimeoutId);
        }
      }
    },

    //APP推送消息
    handleAppMessage(event) {
      const { appId, msg } = event.detail;
    },
    

    //APP启动反馈
    async handleAppLaunchResult(event) {
      const { appId } = event.detail;
      //说明有正在执行的指令，继续执行
      if(this.runingcmd != null){
        if(this.runingcmd.type==1)
        {
          this.docommand();
        }
        if(this.runingcmd.type==2)
        { 
          this.fddocommand(this.runingcmd.cmd);
        }
      }
    },

    //********************** MQTT 连接结束 ***************//

    //****************** HTTP接口处理 ****************/

    //将结果回传给Tip 进行提示   1 正常消息    0 错误提示
    floatballtip(type,message){

      //需要先触发显示页面，再推送

      // 发送消息到主进程
      ipcRenderer.send('message-from-renderer', {
        target: 'tip', // 指定目标窗口
        data: { type : type,  message : message }
      });
    },

    //通知故障诊断页面
    floatballtodo(type,message,commandlist){
      // 发送消息到主进程
      ipcRenderer.send('message-from-renderer', {
        target: 'todo', // 指定目标窗口
        data: { type : type,  message : message,commandlist }
      });
    },

    //获取录音 文字之后的处理 成功：调用人机交互接口  失败：提示网络故障，请重试，并给出错误原因=result.message
    async handlestopRecordAfter(result){
      try {
        if(!result.success){
          this.floatballtip(0, "录音故障:" + result.message);
          return;
        }
        const normalizedPath = path.normalize(result.path);
        const uploadres = await ipcRenderer.invoke('hnc_stt', normalizedPath);
        fs.unlinkSync(normalizedPath) // 删除文件
        if(!uploadres || uploadres.code!= 200){
          this.floatballtip(0, "上传录音文件故障 " + uploadres?.data?.message);
          return;
        }
        result.message=uploadres.data.result;
        //如果出现为空，说明没有说话，进行提示
        if(result.message.trim() == ''||result.message.trim() == "")
        {
          this.floatballtip(0,"未检测到声音");
          return;
        }
        this.floatballtip(1,result.message);
         //调用 指令交互接口    根据结果判断
         const res = await ipcRenderer.invoke('hnc_tti', result.message);
         if (res && res.code == 200) {
           if (res.data.command_list && res.data.command_list.length > 0) {
             //故障诊断 需要弹出大的提示框，并返回故障诊断信息以及指令
             if(res.data.command_list[0].app_id=="fault_diagnosis"){
               await this.FaultDiagnosis(result.message);
             }
             //需要处理的指令集合
             else {
               this.commandList = res.data.command_list;
               this.docommand();
             }
           } else {
             //小提示框 显示 空的指令列表
             this.floatballtip(0, "未能识别到指令，请重试");
           }
         } else if (res?.code == 1001 || res?.code == 1002) {
           //故障码 1001   APP不存在
           //故障码 1002   指令不存在
           //提示未能识别指令，请重试
           this.floatballtip(0,"APP或者指令不存在,请重试");
         }else{
           //小提示框  提示网络故障，请重试
           this.floatballtip(0, "服务故障:" + res?.message);
         }
      } catch (error) {
        console.log("11111",error);
        this.floatballtip(0, "录音或者网络故障:" + error.message);
      }finally{
        //等所有的接口处理完成之后，在进行录音资源释放
        this.cleanup();
      }
    },

    //故障诊断接口
    async FaultDiagnosis(message) {
      console.log("FaultDiagnosis",message);
      this.showTodo();
      try {
        //res = await apis.hnc_fd(result.message);
        const res = await ipcRenderer.invoke('hnc_fd', message);
        console.log("hnc_fd:",res);
        if(res && res.code=="200"){
          this.floatballtodo(1,res.data.msg,res.data.command_list);
        }else{
          // 需要在大提示框中显示：  故障诊断错误  res.data.msg
          this.floatballtodo(0,"故障诊断错误:"+res.data.msg);
        }
        //同时发送用户说的话
        this.floatballtodo(3,message);
      } catch (error) {
        console.log("hnc_fd 异常:",error.message);
        this.floatballtodo(0,"故障诊断异常:"+error.message);
      }
    },


    //直接处理指令
    docommand(){
      if(!this.commandList || this.commandList.length<=0){
        return;
      }
      //每次执行一个指令，等待指令完成之后继续执行下一个指令
      const cmd=this.commandList[0];
      var app = stateStore.getApp(cmd.app_id);
      if(app){
        this.runingcmd={type : 1, cmd };
        this.checkTimeout();
        console.log("checkTimeoutId:",this.checkTimeoutId);
        if(app.state=="0"){ //先启动
          var runingcmd={
            app_id: cmd.app_id,
            timestamp: Date.now()
          }
          console.log("推送MQTT指令：",runingcmd);
          mqttClient.publish('Command/Open', runingcmd)
        }else{ //直接发送指令
          var runingcmd={
            app_id: cmd.app_id,
            command:cmd.command,
            timestamp: Date.now()
          }
          console.log("推送MQTT指令：",runingcmd);
          mqttClient.publish('Command/Action/'+cmd.app_id, runingcmd)
        }
      }else{
        //提示当前APP未注册
        this.floatballtip(0,"当前APP未注册");
        this.commandList=[];
      }
    },

    //故障诊断的指令处理
    fddocommand(cmd){
      console.log("fddocommand",cmd);
      var app = stateStore.getApp(cmd.app_id);
      if(app){
        this.runingcmd={ type : 2 , cmd };
        this.checkTimeout();
        if(app.state=="0"){ //先启动
          mqttClient.publish('Command/Open', {
            app_id: cmd.app_id,
            timestamp: Date.now()
          })
        }else{ //直接发送指令
          mqttClient.publish('Command/Action/'+cmd.app_id, {
            app_id: cmd.app_id,
            command:cmd.command,
            timestamp: Date.now()
          })
        }
      } else {
        //提示当前APP未注册
        this.floatballtodo(0,"当前APP未注册");
      }
    },

    //处理超时情况
    checkTimeout(){
      if (this.checkTimeoutId) {
        console.log('清除定时器 ID:', this.checkTimeoutId);
        clearTimeout(this.checkTimeoutId);
      }
      this.checkTimeoutId = setTimeout(() => {
        //超过3秒还没执行完成一个指令
        console.log('定时器触发，ID:', this.checkTimeoutId);
        if(this.runingcmd!=null){
          if(this.runingcmd.type==1)
          {
            this.floatballtip(0,"指令执行超时");
          }
          if(this.runingcmd.type==2)
          {
            this.floatballtodo(0,"指令执行超时");
          }
          this.runingcmd=null;
          this.commandList=[];
        }
      }, 3000);
      console.log('设置新定时器 ID:', this.checkTimeoutId);
    },

    /****************** HTTP接口处理结束 ****************/

    // showMore() {
    //   this.isNotMore = false
    //   // ipcRenderer.send('setFloatIgnoreMouse', false)
    // },
    hanleMouseEnter(){
      this.opacity=0.8;
    },

    hanleMouseLeave(){
      this.opacity=0.3;
    },
    showEssay(e) {
      if (calcS())
        ipcRenderer.send("showEssay", "show")
    },
    showTodo() {
      if (calcS())
        ipcRenderer.send("showTodo", "show")
    },
    showTip() {
      if (calcS())
        ipcRenderer.send("showTip", "show")
    },
    showSimTodo() {
      if (calcS())
        ipcRenderer.send("showSimTodo", "show")
    },
    // hideMore() {
    //   this.isNotMore = true
    //   // ipcRenderer.send('setFloatIgnoreMouse', true)
    // },
    handleMouseDown(e) {
      this.opacity=0.8;
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
      document.addEventListener('mousemove', handleMove)
    },
    async handleMouseUp(e) {
      moveS[2] = e.screenX - e.x
      moveS[3] = e.screenY - e.y

      biasX = 0
      biasY = 0
      document.removeEventListener('mousemove', handleMove)
      await this.snapToEdge();
      if (calcS() && e.button == 0) {
        ipcRenderer.send("openTip", "open")
      }
      if (calcS() && e.button == 1) {
        ipcRenderer.send("showTodo", "open")
      }
      // 如果不是拖动而是点击，就开始录音
      //console.log("calcS()",calcS());
      if (calcS()) {
        await this.toggleRecording();
      }

    },

  },
  watch: {
    // isNotMore(newValue) {
    //   if (newValue == false) {
    //     ipcRenderer.send("showTip", "show")
    //     ipcRenderer.send("showTodo", "show")
    //   }
    //   // console.log(calcS(),"close-tip")
    //   if (newValue == true) {
    //     // console.log("close-tip")
    //     ipcRenderer.send('close-tip');
    //   }

    //   console.log("isNotMore changed to:", newValue);
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