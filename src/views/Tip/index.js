const { ipcRenderer } = require("electron");
const Vue = require('vue')
const { formatterTime } = require("../../utils/date.js")
const { getConfig, defaultConfig } = require("../../utils/store.js")
const path = require('path');
const fs = require('fs');
const configManager = require("../../utils/configManager");

let currConfig = {}
/**
 * Vue应用组件 - 提示框
 * 
 * 创建一个提示框组件,用于显示悬浮球相关的提示信息
 * 功能包括:
 * - 显示提示文本
 * - 监听悬浮球事件更新提示
 * - 接收主进程消息更新提示
 * - 10秒后自动关闭
 * - 提示内容更新时重置倒计时
 * 
 * @component
 * @listens message-to-renderer - 监听主进程消息
 * @emits close-tip - 发送关闭提示框事件到主进程
 */
const app = Vue.createApp({

  data() {
    return {
      userInput: "",
      IsMouseLeave:true,
      isMouseOnFloatBall:true,
      tipCloseTimeoutId: null,

      lastruningtime:new Date(),
      isStopRecording: false,
      isRecording: false,
      mediaStream: null,
      audioContext: null,
      analyser: null,
      silenceCount: 0,
      animationFrameId: null,
      maxDuration : parseInt(configManager.maxDuration),
      silenceHold : parseInt(configManager.silenceHold),
      silenceStop : parseInt(configManager.silenceStop),
      isUserStop : false,
      placeholdertext:"有问题尽管问我...",
      isruning : false,
      isFirst : true,
      canvasCtx : null,
      dataArray : null,
      canvsanimationFrameId : null,
    }
  },

  async  mounted() {

    ipcRenderer.on('message-to-renderer', (event, data) => {
      //鼠标在机器人上
      if(data.type == 4){ 
        if (this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId) 
        this.isMouseOnFloatBall = true;
      }
      //鼠标离开了机器人
      else if(data.type == 5){ 
        this.isMouseOnFloatBall = false;
        if(this.IsMouseLeave && !this.isRecording && !this.isStopRecording){
          this.startTipCloseTimer();
        }
      }
      //显示文字
      else {  
        this.isruning = false;
        this.userInput =data.message;
        //值变化时，且鼠标不在悬浮窗则启动关闭
        if(this.IsMouseLeave && !this.isMouseOnFloatBall) 
        {
          this.startTipCloseTimer();
        }
      }
    });

    //页面启动，默认清空录音记录
    ipcRenderer.invoke('audio-clear');

    //初始化画布
    this.initCanvas();

    //再启动录音
    await this.startRecording();
  
    this.isFirst = false;
  },
  beforeUnmount() {
    if(this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId)
    if(this.animationFrameId)  cancelAnimationFrame(this.animationFrameId);
    if(this.canvsanimationFrameId)  cancelAnimationFrame(this.canvsanimationFrameId);
  },
  methods: {

    //发送日志记录
    log(msg, ctx) {
      ipcRenderer.invoke('app-log', { msg: 'tip--' + msg, ctx });
    },

    // 初始化画布
    initCanvas() {
      const canvas = this.$refs.waveCanvas
      const container = canvas.parentElement
      
      // 高清屏适配
      const dpr = window.devicePixelRatio || 1
      canvas.width = 300 * dpr
      canvas.height = 45 * dpr
      canvas.style.width = canvas.width + 'px'
      canvas.style.height = canvas.height + 'px'

      this.canvasCtx = canvas.getContext('2d')
      this.canvasCtx.scale(dpr, dpr)

      this.createClipPath()
    },
    // 创建圆形裁剪区域
    createClipPath() {
      const canvas = this.$refs.waveCanvas
      const rect = canvas.getBoundingClientRect()
      this.canvasCtx.beginPath()
      this.canvasCtx.moveTo(10, 0)
      this.canvasCtx.arcTo(rect.width, 0, rect.width, rect.height, 10)
      this.canvasCtx.arcTo(rect.width, rect.height, 0, rect.height, 10)
      this.canvasCtx.arcTo(0, rect.height, 0, 0, 10)
      this.canvasCtx.arcTo(0, 0, rect.width, 0, 10)
      this.canvasCtx.closePath()
      this.canvasCtx.clip()
    },

    changeInput() {
      this.showinput = true;
      this.showtext = false;
      this.userInput = "";
      //同时将消息发送至悬浮窗，      3  暂停录音
      ipcRenderer.send('message-from-renderer', {
        target: 'floatball', // 指定目标窗口
        data: { type: 3 , message : "暂停录音" }
      });
    },

    sendMessage() {
      if (this.userInput.trim() !== '') {
        this.isruning=true;
        //同时将消息发送至悬浮窗
        ipcRenderer.send('message-from-renderer', {
          target: 'floatball', // 指定目标窗口
          data: {
            type: 4,
            message: this.userInput
          }
        });
      }
    },

    startTipCloseTimer() {
      if (this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId) // 清除旧定时器
      this.tipCloseTimeoutId = setTimeout(() => {
        ipcRenderer.send("close-tip");
        },  parseInt(configManager.pagehidetime) * 1000)  
    },

    hanleMouseEnter() {
      this.IsMouseLeave=false;
      if(this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId);
    },

    hanleMouseLeave() {
      this.IsMouseLeave=true;
      if(this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId);
      this.startTipCloseTimer();
    },

    //暂停录音并不做后续处理
    async userStopRecording() {
      this.isUserStop=true;
      await this.stopRecording();
    },
    
    // ***********************麦克风录音 ***************//

    //录音消息
    RecordingErrorMessage(type,message){
      this.isRecording=false;
      //this.userInput=message;
    },
    async toggleRecording() {
      
      //在1秒间隔内点击 则不触发事件
      const diff = Math.abs(new Date() - this.lastruningtime);
      if(diff  < 1000)   return;
      this.lastruningtime = new Date();

      if (this.isRecording) {
        await this.stopRecording();
      } else {
        await this.startRecording();
      }
    },

    async startRecording() {
      //是否正在录音
      if (this.isRecording || this.isStopRecording) {
        return;
      }
      try {
        // 初始化音频流
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.log('[Renderer] 已获得麦克风权限');
        } catch (err) {
          if (err.message == "Requested device not found") {
            this.RecordingErrorMessage(99, "未检测到麦克风设备");
          }
          this.log('[Renderer] 麦克风访问被拒绝:', err.message);
          return;
        }
        // 初始化音频分析
        this.setupAudioAnalysis();
        // 通知主进程开始录音
        const { path } = await ipcRenderer.invoke('audio-start');
        this.log(`[Renderer] 录音文件路径: ${path}`);
        // 创建媒体录音器
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.setupDataHandler();
        this.isRecording = true;
        this.userInput="";
        this.placeholdertext = "倾听中...";
        this.startMonitoring();
        if(this.maxDuration > 2){
          setTimeout(() => this.stopRecording(), this.maxDuration * 1000);
        }
      } catch (err) {
        this.RecordingErrorMessage(99, '启动麦克风失败 ');
        this.log('启动麦克风失败:', err.message);
      }
    },
    setupAudioAnalysis() {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      const bufferLength = this.analyser.frequencyBinCount
      this.dataArray = new Uint8Array(bufferLength)

      source.connect(this.analyser);

      //启动绘制循环
      this.draw()
    },

    // 绘制音浪
    draw() {
      if (!this.analyser) return
      
      const canvas = this.$refs.waveCanvas
      const WIDTH = canvas.width / (window.devicePixelRatio || 1)
      const HEIGHT = canvas.height / (window.devicePixelRatio || 1)
      // 使用透明背景替代原来的半透明黑色
      this.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT)
      // 获取频率数据
      this.analyser.getByteFrequencyData(this.dataArray)
      this.drawBars(WIDTH,HEIGHT);

      //this.drawFrequencyBars(this.canvasCtx,canvas);

      // 循环绘制
      this.canvsanimationFrameId = requestAnimationFrame(this.draw)
    },

     /* 1. 基础柱状图 */
    drawBars(width, height) {
      const barWidth = (width / this.dataArray.length) * 25
      let x = 0

      for (let i = 0; i < this.dataArray.length; i++) {
        const barHeight = (this.dataArray[i] / 255) * height
        const gradient = this.canvasCtx.createLinearGradient(0, height - barHeight, 0, height)
        gradient.addColorStop(0, '#13cccf')
        gradient.addColorStop(1, '#13cccf')
        
        this.canvasCtx.fillStyle = gradient
        this.canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight)
        x += barWidth + 2
      }
    },

    // 波浪线模式
    drawWave(width, height) {
      const ctx = this.canvasCtx
      const lineWidth = 2
      const baseline = height * 0.8 // 基线位置
      
      ctx.beginPath()
      ctx.moveTo(0, baseline)

      // 生成平滑曲线路径
      this.dataArray.forEach((value, i) => {
        const x = (i / this.dataArray.length) * width
        const amplitude = (value / 255) * (height * 0.6) // 振幅范围
        const y = baseline - amplitude
        
        // 使用二次贝塞尔曲线平滑连接
        if (i > 0) {
          const prevX = ((i - 1) / this.dataArray.length) * width
          const controlX = (prevX + x) / 2
          ctx.quadraticCurveTo(controlX, y, x, y)
        }
      })

      // 样式配置
      ctx.strokeStyle = '#00ff88'
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.stroke()

      // 添加渐变填充（可选）
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, 'rgba(0, 255, 136, 0.2)')
      gradient.addColorStop(1, 'rgba(0, 102, 255, 0.1)')
      
      ctx.fillStyle = gradient
      ctx.lineTo(width, height)
      ctx.lineTo(0, height)
      ctx.closePath()
      ctx.fill()
    },

    // 创建渐变颜色
    createWaveGradient (ctx, width) {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#00fff7');   // 底部青蓝色
      gradient.addColorStop(1, '#00ffaa');   // 顶部亮青色
      return gradient;
    },
  
    // 绘制频谱
    drawFrequencyBars(ctx,canvas) {
      this.analyser.getByteTimeDomainData(this.dataArray)
      // 绘制基准线
      ctx.setLineDash([5,5]);
      ctx.beginPath();
      ctx.strokeStyle = '#13CCCF';
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height/2);
      ctx.stroke();

      // 波形参数
      const barWidth = 5;
      const barSpacing = 5;
      const maxAmplitude = canvas.height * 5;

      for (let i = 0; i < this.dataArray.length; i++) {
        const amplitude = (this.dataArray[i] - 128) / 128 * maxAmplitude;
        const xPos = i * (barWidth + barSpacing);

        // 立体柱体绘制
        ctx.fillStyle = '#13CCCF';
        ctx.fillRect(
          xPos,
          canvas.height / 2 - amplitude,  // 上部柱体
          barWidth,
          amplitude                     // 柱体高度
        );
        ctx.fillRect(
          xPos,
          canvas.height/2,              // 下部柱体
          barWidth,
          amplitude
        );
      }

      // // 绘制中心基准线
      // ctx.beginPath();
      // ctx.strokeStyle = '#ddd';
      // ctx.setLineDash([5, 5]);
      // ctx.moveTo(0, canvas.height/2);
      // ctx.lineTo(canvas.width, canvas.height/2);
      // ctx.stroke();

      // // 绘制动态波形
      // const barWidth = 3;
      // const maxHeight = canvas.height/2 - 10;
      
      // for (let i = 0; i < this.dataArray.length; i++) {
      //   const amplitude = (this.dataArray[i] - 128) / 128 * maxHeight;
      //   const x = i * (barWidth + 1);
        
      //   // 上侧波形
      //   ctx.fillStyle = '#009cff';
      //   ctx.fillRect(
      //     x, 
      //     canvas.height/2 - amplitude - barWidth,  // 上侧起点
      //     barWidth, 
      //     barWidth
      //   );
        
      //   // 下侧波形
      //   ctx.fillRect(
      //     x,
      //     canvas.height/2 + amplitude,  // 下侧起点
      //     barWidth,
      //     barWidth
      //   );
      // }

    },

    setupDataHandler() {
      this.mediaRecorder.ondataavailable = async (e) => {
        try {
          const buffer = await e.data.arrayBuffer();
          ipcRenderer.send('audio-chunk', buffer);
        } catch (err) {
          this.RecordingErrorMessage(99, '音频数据处理失败 ');
          this.log('[Renderer] 数据处理失败:', err.message);
        }
      };
      this.mediaRecorder.start(500); // 每0.5秒收集数据
      //this.log('[Renderer] 媒体录音器已启动');
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
      //此处为超过1s检测到的麦克风电流小于0.6则停止录音
      if (volume * 100 < this.silenceHold) {
        this.silenceCount += 1 / 60;
        if (this.silenceCount >= this.silenceStop) {
          this.log('[Renderer] 检测到持续静音，自动停止');
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
        message: "",
        path: null,
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
        this.log('[Renderer] 录音保存结果:', result);
      } catch (err) {
        this.RecordingErrorMessage(99, '音频数据处理失败 ');
        this.log('[Renderer] 音频数据处理失败:', err.message);
        result.message = err.message;
      } finally {
        //如果是用户暂停的，则不进行后续调用接口操作
        if (!this.isUserStop) {
            await this.handlestopRecordAfter(result);
        } else {
          if(result.path)
          {
            const normalizedPath = path.normalize(result.path);
            fs.unlinkSync(normalizedPath) // 删除文件
          }
          this.cleanup();
        }
        this.isUserStop = false;
      }
    },

    //获取录音 文字之后的处理 成功：调用人机交互接口  失败：提示网络故障，请重试，并给出错误原因=result.message
    async handlestopRecordAfter(result) {
      try {
        if (!result.success) {
          this.RecordingErrorMessage(99, "语音输入故障 ");
          return;
        }
        const normalizedPath = path.normalize(result.path);
        const uploadres = await ipcRenderer.invoke('hnc_stt', normalizedPath);
        fs.unlinkSync(normalizedPath) // 删除文件
        if (!uploadres || uploadres.code != 200) {
          this.RecordingErrorMessage(99, "语音识别故障 " + (uploadres?.data?.message ? uploadres?.data?.message : ""));
          return;
        }
        result.message = uploadres.data.result;
        //如果出现为空，说明没有说话，进行提示
        if (result.message.trim() == '' || result.message.trim() == "") {
          this.RecordingErrorMessage(99, "没太听清您的声音，请重试... ");
          return;
        }
        //发送消息给悬浮窗处理
        this.userInput=result.message;
        this.sendMessage();
      } catch (error) {
        this.RecordingErrorMessage(99, "语音交互异常 ");
        this.log("语音交互异常 ", error.message);
      } finally {
        //等所有的接口处理完成之后，在进行录音资源释放
        this.cleanup();
      }
    },

    cleanup() {
      // 清理资源
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      if (this.canvsanimationFrameId) {
        cancelAnimationFrame(this.canvsanimationFrameId);
      }
      
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
      }
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }

      this.isRecording = false;
      this.isStopRecording = false;
      this.silenceCount = 0;
      this.placeholdertext = "有问题尽管问我...";
      this.log('[Renderer] 资源已清理');
    },

    // ***********************麦克风录音结束 ***************//

  },
  watch: {
    
  }
})
app.mount("#app")