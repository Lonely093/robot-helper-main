const { ipcRenderer } = require("electron");
const Vue = require('vue')

const { defaultConfig, getConfig, applyConfig } = require("../../utils/store")

const { ref } = require('vue')
const draggableElement = ref(null);

const mqttClient = require("../../utils/mqtt")
const apis = require("../../utils/api");
const stateStore = require("../../utils/mqtt_persistence");
const fs = require('fs');
const FormData = require('form-data');
const axios= require("axios");


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





const app = Vue.createApp({

  data: () => {
    return {
      isNotMore: true,
      count: [0, 0],
      opacity: 0.8,
      mainColor: '',
      subColor: '',
      isStopRecording:false,
      isRecording: false,
      mediaStream: null,
      audioContext: null,
      analyser: null,
      silenceCount: 0,
      animationFrameId: null,
      finalTranscript:"",
      commandList:[],
      runingcmd:null,
      checkTimeoutId:null
    }
  },

  mounted() {
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

    // apis.hnc_tti("请打开程序管理页面").then(res=>{
    //   console.log("hnc_tti:");
    //   console.log(res);
    // });
     const filePath = 'D:\\\\2025\\\\robot-helper-main\\\\RecorderFolder\\\\recording_1741497581347.wav';
    //  // 1. 同步读取文件到内存（Buffer）
    //  //const fileStream = fs.createReadStream(filePath);
    //  const buffer = fs.readFileSync(filePath);
    //  console.log("buffer");
    //  console.log(buffer);
    //  const form = new FormData();
    //   // 添加文件字段（核心参数）
    //   form.append(
    //     'audio_file',   // 字段名（必须与后端定义一致）
    //     buffer, // 使用 Stream 避免大文件内存溢出
    //     {
    //       filename: filePath.split('/').pop(),   // 自定义文件名（可选）
    //       contentType: 'audio/wav',     // 明确 MIME 类型（强烈建议）
    //     }
    //   );
    //   console.log('FormData Headers:', form.getHeaders());
    //   console.log('FormData :', form);
       // 3. 发送请求（正确用法）
      // axios({
      //   method: 'post',
      //   url: `http://172.20.11.80:9000/api/hnc_stt`,
      //   data:form,
      //   headers: {
      //     'accept': 'application/json',
      //     ...form.getHeaders(), // 自动生成 multipart/form-data 的 Content-Type 和 boundary
      //   },
      // }).then(res=>{
      //   console.log("hnc_stt:");
      //   console.log(res);
      // }).catch(error => {
      //   if (error.response) {
      //     console.error('服务器响应错误:', error.response.data);
      //     console.error('状态码:', error.response.status);
      //     console.error('响应头:', error.response.headers);
      //   } else if (error.request) {
      //     console.error('无响应:', error.request);
      //   } else {
      //     console.error('请求错误:', error.message);
      //   }
      // });

    // apis.hnc_tti("选择系统盘程序").then((res) => {
    //   if(res&&res.code=="200"){
    //     if(res.data.command_list)
    //     {

    //     }
    //     console.log(res.data);
    //   }else{
    //     console.log("请求失败:"+res?.msg);
    //   }
    // });

    // this.startRecording();

    //监听APP指令完成与APP消息
    window.addEventListener('app-command-result', this.handleCommandResult);
    window.addEventListener('app-launch', this.handleAppLaunchResult);
    window.addEventListener('app-message', this.handleAppMessage);

    //监听故障诊断页面传来的消息
    window.addEventListener('app-todo-action', this.handleTodoAction);

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

    async snapToEdge() {
      console.log("draggableElement.value", this.$refs)
      const rect = this.$refs.draggableElement.getBoundingClientRect();
      console.log("rect", rect)
      // 获取窗口内容区域边界信息
      const winBounds = await ipcRenderer.invoke('get-win-content-bounds');

      // 计算屏幕绝对坐标
      const screenX = winBounds.x + rect.left;
      const screenY = winBounds.y + rect.top;

      // 获取最近的显示器
      const display = await ipcRenderer.invoke('get-display-nearest-point', {
        x: screenX,
        y: screenY
      });

      console.log("winBounds", winBounds)
      console.log("display", display)
      // 吸附阈值（20px）
      const SNAP_THRESHOLD = 400;
      const workArea = display.workArea;

      // 计算与各边的距离
      const edges = {
        left: screenX - workArea.x,
        right: workArea.x + workArea.width - (screenX + rect.width),
        // top: screenY - workArea.y,
        // bottom: workArea.y + workArea.height - (screenY + rect.height)
      };
      console.log("edges", edges)
      // 找到最近边缘
      let minDist = Infinity;
      let closestEdge = null;

      Object.entries(edges).forEach(([edge, dist]) => {
        if (dist >= 0 && dist < minDist) {
          minDist = dist;
          closestEdge = edge;
        }
      });

      // 如果没有正距离（可能组件完全超出屏幕），则找绝对值最小的
      if (closestEdge === null) {
        minDist = Infinity;
        Object.entries(edges).forEach(([edge, dist]) => {
          const absDist = Math.abs(dist);
          if (absDist < minDist) {
            minDist = absDist;
            closestEdge = edge;
          }
        });
      }

      // console.log("minDist ", minDist)
      // console.log("closestEdge ", closestEdge)
      // console.log("SNAP_THRESHOLD", SNAP_THRESHOLD)
      // 执行吸附
      if (minDist <= SNAP_THRESHOLD) {
        let newX = winBounds.x;
        let newY = winBounds.y;

        switch (closestEdge) {
          case 'left':
            newX = workArea.x - rect.left;
            break;
          case 'right':
            newX = workArea.x + workArea.width - rect.left - rect.width;
            break;
          // case 'top':
          //   newY = workArea.y - rect.top;
          //   break;
          // case 'bottom':
          //   newY = workArea.y + workArea.height - rect.top - rect.height;
          //   break;
        }
        this.isNotMore = true;
        console.log("set-win-position", newX, newY)
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
      if(this.isRecording || this.commandList.length>0){
        return;
      }
      try {
        // 初始化音频流
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('[Renderer] 已获得麦克风权限');
        } catch (err) {
          console.error('[Renderer] 麦克风访问被拒绝:', err);
          this.$emit('error', '请允许麦克风访问权限');
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
        console.error('录音启动失败:', err);
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
          console.error('[Renderer] 数据处理失败:', err);
          this.$emit('error', '音频数据发送失败');
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
      if(this.isStopRecording) return;
      const SILENCE_THRESHOLD = 0.5; //可调整的静音阈值 最大值为1  
      //console.log(volume);
      //此处为超过1s检测到的麦克风电流小于0.2则停止录音
      if (volume < SILENCE_THRESHOLD) {
        this.silenceCount += 1 / 60;
        if (this.silenceCount >= 1) {
          console.log('[Renderer] 检测到持续静音，自动停止');
          console.log(Date.now());
          this.stopRecording();
        }
      } else {
        this.silenceCount = 0;
      }
    },
    async stopRecording() {
      if (!this.isRecording) return;
      if(this.isStopRecording) return;
      var result= { 
        success: false, 
        message:""
      }
      try {
        this.isRecording=false;
        this.isStopRecording = true;
        // 停止媒体录音器
        if (this.mediaRecorder?.state === 'recording') {
          this.mediaRecorder.stop();
        }
        // 通知主进程停止 保存录音文件并上传接口，返回结果
        result = await ipcRenderer.invoke('audio-stop');
        console.log('[Renderer] 录音保存结果:', result);
        console.log(Date.now());
        this.$emit('record-complete', result);
      } catch (err) {
        console.error('[Renderer] 停止失败:', err);
        this.$emit('error', err.message);
        result.message=err.message;
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
        this.audioContext=null;
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
        console.error('MQTT连接失败:', error);
      }
    },

    //指令处理结果返回
     handleCommandResult(event) {
      const { appId, msg } = event.detail;
      if(runingcmd!=null)
      {
        if(msg=="ok") //指令执行完成
        {
          if(runingcmd.type==1)
          {
            this.commandList = this.commandList.shift()
            if(this.commandList.length>0){
              this.docommand();
            }
          }
        }else{  //指令执行失败
          if(runingcmd.type==1)
          {
            this.floatballtip(0,"指令执行失败:"+msg);
            this.commandList =null;
          }
          if(runingcmd.type==2)
          {
            this.floatballtodo(0,"指令执行失败:"+msg);
          }
        }
        runingcmd=null;
        if(this.checkTimeoutId) clearTimeout(this.checkTimeoutId);
      }
    },

    //APP推送消息
    handleAppMessage(event) {
      const { appId, msg } = event.detail;
    },

    //APP启动反馈
    async handleAppLaunchResult(event){
      const { appId } = event.detail;
      //说明有正在执行的指令，继续执行
      if(runingcmd != null){
        if(runingcmd.type==1)
        {
          this.docommand();
          if(this.checkTimeoutId) clearTimeout(this.checkTimeoutId);
        }
        if(runingcmd.type==2)
        { 
          this.fddocommand(runingcmd.cmd);
          if(this.checkTimeoutId) clearTimeout(this.checkTimeoutId);
        }
      }
    },

    //********************** MQTT 连接结束 ***************//

    //****************** HTTP接口处理 ****************/

    //将结果回传给Tip 进行提示   1 正常消息    0 错误提示
    floatballtip(type,message){

      //需要先触发显示页面，再推送
      const event = new CustomEvent('floatball-tip',{detail:{
        type : type,
        message : message
      }});
      window.dispatchEvent(event);
    },

    //通知故障诊断页面
    floatballtodo(type,message,commandlist){
      //需要先出发显示页面，并且隐藏小的提示框 再推送
      const event = new CustomEvent('floatball-todo',   {
        detail: { type, commandlist,  message}
      });
      window.dispatchEvent(event);
    },

    //获取录音 文字之后的处理 成功：调用人机交互接口  失败：提示网络故障，请重试，并给出错误原因=result.message
    async handlestopRecordAfter(result){
       console.log("handlestopRecordAfter");
       console.log(result);
       if(result.success && result.message){
        this.floatballtip(1,result.message);
        try
        {
          //调用 指令交互接口    根据结果判断
          var res = await apis.hnc_tti(result.message);
          if(res&&res.code=="200"){
            if(res.data.command_list&&res.data.command_list.length>0)
            {
              //故障诊断 需要弹出大的提示框，并返回故障诊断信息以及指令
              if(res.data.command_list[0].app_id=="fault_diagnosis"){
                await this.FaultDiagnosis(result.message);
              }
              //需要处理的指令集合
              else{
                this.commandList=res.data.command_list;
                this.docommand();
              }
            }else{
              //小提示框 显示 空的指令列表
              this.floatballtip(0,"未能识别到指令，请重试");
            }
          }else if(res?.code=="1001"||res?.code=="1002"){
            //故障码 1001   APP不存在
            //故障码 1002   指令不存在
            //提示未能识别指令，请重试
            this.floatballtip(0,"APP或者指令不存在,请重试");
          }else{
            //小提示框  提示网络故障，请重试
            this.floatballtip(0,"服务故障:"+err.message);
          }
        }
        catch (err) {
          //小提示框  提示网络故障，请重试
          this.floatballtip(0,"录音或者网络故障:"+err.message);
        }
        finally {
          this.cleanup();
        }
      }else{
        //小提示框  提示网络故障，请重试
        this.floatballtip(0,"录音或者网络故障:"+result.message);
      }
      console.log(result);
      //等所有的接口处理完成之后，在进行录音资源释放
      this.cleanup();
    },

    //故障诊断接口
    async FaultDiagnosis(message)
    {
      res = await apis.hnc_fd(result.message);
      if(res&&res.code=="200"){
        if(res.data.msg&&res.data.command_list.length>0)
          {
            //将故障诊断描述 + 可执行的指令列表传递给 大提示框。
            this.floatballtodo(1,message,res.data.command_list);
          }else{
            //空的指令列表/空的故障描述
            this.floatballtodo(0,"空的指令列表:"+res.data.msg);
          }
      }else{
        // 需要在大提示框中显示：  故障诊断错误  res.data.msg
        this.floatballtodo(0,"故障诊断错误:"+res.data.msg);
      }
    },

    //处理故障诊断页面传来的动作
    handleTodoAction(event){
      const { message, command } = event.detail;
      //两种情况，  再次请求故障诊断 ， 或者直接执行指令
      if(message){
        this.FaultDiagnosis(message);
        return;
      }
      if(command){
        this.fddocommand(command);
      }
    },
    
    //直接处理指令
    docommand(){
      if(!this.commandList || this.commandList.length<=0){
        return;
      }
      //每次执行一个指令，等待指令完成之后继续执行下一个指令
      const cmd=this.commandList[0];
      var app = stateStore.getCurrentState(cmd.app_id);
      if(app){
        runingcmd={type : 1, cmd };
        if(this.checkTimeoutId) clearTimeout(this.checkTimeoutId);
        this.checkTimeoutId = this.checkTimeout();
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
      }else{
        //提示当前APP未注册
        this.floatballtip(0,"当前APP未注册");
        this.commandList=null;
      }
    },

    //故障诊断的指令处理
    fddocommand(cmd){
      var app = stateStore.getCurrentState(cmd.app_id);
      if(app){
        runingcmd={ type : 2 , cmd };
        if(this.checkTimeoutId) clearTimeout(this.checkTimeoutId);
        this.checkTimeoutId = this.checkTimeout();
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
      }else{
        //提示当前APP未注册
        this.floatballtodo(0,"当前APP未注册");
      }
    },

    //处理超时情况
    checkTimeout(){
      return setTimeout(() => {
        //超过3秒还没执行完成一个指令
        if(this.runingcmd!=null){
          if(runingcmd.type==1)
          {
            this.floatballtip(0,"指令执行超时");
          }
          if(runingcmd.type==2)
          {
            this.floatballtodo(0,"指令执行超时");
          }
          runingcmd=null;
          this.commandList=null;
        }
      }, 3000);
    },

    /****************** HTTP接口处理结束 ****************/

    showMore() {
      this.isNotMore = false
      // ipcRenderer.send('setFloatIgnoreMouse', false)
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
    hideMore() {
      this.isNotMore = true
      // ipcRenderer.send('setFloatIgnoreMouse', true)
    },
    handleMouseDown(e) {
      if (e.button == 2) {
        this.isNotMore = true
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
      // console.log(e.screenX, e.screenX);
      // console.log(e.x, e.x);
      // console.log(biasX, biasY);
      biasX = 0
      biasY = 0
      document.removeEventListener('mousemove', handleMove)
      await this.snapToEdge();
      await this.toggleRecording();
      // console.log("this.isNotMore", this.isNotMore)
    },


  },
  watch: {
    isNotMore(newValue) {
      if (newValue == false) {
        ipcRenderer.send("showTip", "show")
        ipcRenderer.send("showTodo", "show")
      }
      // console.log(calcS(),"close-tip")
      if (newValue == true) {
        // console.log("close-tip")
        ipcRenderer.send('close-tip');
      }

      console.log("isNotMore changed to:", newValue);
    }


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
    }
  }
})
app.mount("#app")