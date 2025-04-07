const { ipcRenderer } = require("electron");
const Vue = require('vue')
const path = require('path');
const fs = require('fs');
const configManager = require("../../utils/configManager");
const stateStore = require("../../utils/localStorage");



const app = Vue.createApp({

  data: () => {
    return {
      userInput: '',
      placeholdertext: "有问题尽管问我...",
      messages: [
        // {
        //   text: ' **参数配置不合理的原因及解决方案**  \n   - appopen     appclose  参数配置不合理的原因包括：坐标轴参数103517“最高速度限制” 是否设置正确；坐标轴参数103587“电机额定转速” 是否设置正确；轴参数中的103005“电子齿轮比分母”、103067 “轴每转脉冲数”、设备接口参数中的503015“反馈位置循环脉冲数”数值设置不一致；系统超速的限值(每个周期的最大长度增量)是否正确计算；以及超速系数是否设置正确。  \n   - 对应的解决方案：检查上述参数是否设置正确，计算超速限值，确保参数配置正确，必要时进行调整。  \n\n2. **编码器反馈信号异常的原因及解决方案**  \n   - 编码器反馈信号异常的原因包括：驱动单元或电机参数（如103005“电子齿轮比分母”、103067 “轴每转脉冲数”）设置不正确；编码器线缆或反馈信号异常。  \n   - 对应的解决方案：更换驱动单元或电机，通过交换法逐一排查；检查编码器线缆，更换并测试。',
        //   type: 'bot',
        //   commandlist: [
        //     {
        //       "app_id": "(hmi_uuid)",
        //       "command": "appopen"
        //     },
        //     {
        //       "app_id": "(hmi_uuid)",
        //       "command": "appclose"
        //     },
        //     {
        //       "app_id": "(hmi_uuid)",
        //       "command": "103005"
        //     },
        //     {
        //       "app_id": "(hmi_uuid)",
        //       "command": "103034"
        //     },
        //     {
        //       "app_id": "(hmi_uuid)",
        //       "command": "103048"
        //     },
        //     {
        //       "app_id": "(hmi_uuid)",
        //       "command": "103067"
        //     },
        //     {
        //       "app_id": "(hmi_uuid)",
        //       "command": "103517"
        //     },
        //     {
        //       "app_id": "(hmi_uuid)",
        //       "command": "103526"
        //     },
        //     {
        //       "app_id": "(hmi_uuid)",
        //       "command": "103587"
        //     },
        //     {
        //       "app_id": "(hmi_uuid)",
        //       "command": "503015"
        //     }
        //   ],
        // }
      ],
      autoSendMessageId: null,
      isCanRecording: true,
      deviceCheckTimer: true,
      isStopRecording: false,
      isSpeacking: false,
      recordingStartTime: 0,
      isRecording: true,
      mediaStream: null,
      audioContext: null,
      analyser: null,
      silenceCount: 0,
      animationFrameId: null,
      lastruningtime: null,
      isruning: false,
      maxDuration: parseInt(configManager.maxDuration),
      silenceHold: parseInt(configManager.silenceHold),
      silenceStop: parseInt(configManager.silenceStop),
      pagehidetime: parseInt(configManager.pagehidetime),
      reverse: false,
      canvasCtx: null,
      dataArray: null,
      canvsanimationFrameId: null,
      isUserStop: false,
      showProgressInfo: false,
      isFinishProgress: true,
      selectFileInfo: {
        filename: "",
        gcodepath: "",
        gcodename: ""
      },
      nowStep: 0,
      steps: [
        {
          title: '智能会话式编程',
          status: 'process', // process | error | success | waiting
          message: '进行中'
        },
        {
          title: '智能仿真',
          status: 'waiting',
          message: '未开始'
        },
        {
          title: '加工',
          status: 'waiting',
          message: '未开始'
        }
      ],
      fileList: [],
      isMQTTRuning: false
    }
  },
  updated() {
    this.$nextTick(this.updateLineHeights);
  },
  mounted() {
    this.$nextTick(this.updateLineHeights);
    ipcRenderer.on("todo-reverse", (e, data) => {
      // console.log("todo-reversetodo-reversetodo-reversetodo-reverse",data)
      if (data == "left") {
        this.reverse = true;
      } else {
        this.reverse = false;
      }
    })
    //悬浮窗传递过来的消息
    ipcRenderer.on('message-to-renderer', (event, data) => {
      //this.log('收到消息:', data);
      //  data.type 0 错误消息  1 正常消息   11=打开会话式编程 提供可选择的目录  12=指令返回结果
      //  data.message  
      //  data.commandlist    注意可能存在  undefined  null 数据，需要判断一下
      let botMessage = data.message;
      let messageType = "bot";
      let commandlist = [];
      if (data.type == 3) {
        messageType = "user";
        this.isruning = true;
      } else if (data.type == 0) {
        this.isruning = false;
        this.hideLoadMessage();
        botMessage = data.message;
      } else if (data.type == 1) {
        this.isruning = false;
        this.hideLoadMessage();
        const separator = "</think>\n\n";
        const separatorIndex = data.message.indexOf(separator);
        if (separatorIndex !== -1) {
          // 从分隔符结束的位置开始截取，直到字符串末尾
          const startIndex = separatorIndex + separator.length;
          botMessage = data.message.substring(startIndex);
          if (data.commandlist) {
            commandlist = data.commandlist;
          }
        }
      } else if (data.type == 11 || data.type == 12) {
        this.isruning = false;
        this.Programming(data);
        return;
      }
      this.messages.push({ text: botMessage, type: messageType, commandlist: commandlist })
      this.scrollToBottom();

      if (data.type == 3) {
        this.showLoadMessage();
      }
    });

    //页面启动，默认清空录音记录
    ipcRenderer.invoke('audio-clear');

    // 初始化设备变化监听
    navigator.mediaDevices.addEventListener('devicechange',
      () => this.checkMicrophoneState()
    );

    //检测录音设备  是否支持录音
    this.checkMicrophoneState();
    this.deviceCheckTimer = setInterval(() => this.checkMicrophoneState(), 5000);

    //初始化画布
    this.initCanvas();

    this.isRecording = false;

    this.messages = stateStore.getTodoMessage();
    if (this.messages.length > 0) {
      this.scrollToBottom();
    }
  },
  created() {
    // 创建全局事件桥接
    window.commandClickHandler = this.handleCommandClick;
    window.fileClickHandler = this.handlefileClick;
  },
  beforeUnmount() {
    if (this.deviceCheckTimer) clearTimeout(this.deviceCheckTimer)
    if (this.autoSendMessageId) clearTimeout(this.autoSendMessageId)
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId)
    if (this.canvsanimationFrameId) cancelAnimationFrame(this.canvsanimationFrameId)
  },
  unmounted() {
    // 清理全局事件
    delete window.commandClickHandler;
    delete window.fileClickHandler;
  },
  methods: {
    handleTerminate() {
      if (this.isMQTTRuning || this.isFinishProgress) return
      this.SendMQTTMessage("handstop", "");
      this.messages.push({ text: '手动终止流程', type: 'user', commandlist: [] })
      this.scrollToBottom();
    },
    execGCode() {
      //执行G代码   先加载程序  后运行  通过HMI

    },
    updateLineHeights() {
      this.steps.forEach((step, index) => {
        const contentEl = this.$refs[`content-${index}`]?.[0];
        const lineEl = this.$refs[`line-${index}`]?.[0];

        if (contentEl && lineEl) {
          // 获取内容高度 + 下方间距（根据实际样式调整）
          const contentHeight = contentEl.offsetHeight + 8;
          lineEl.style.height = `${contentHeight}px`;
        }
      });
    },

    async Programming(data) {
      // 搜索零件模型
      if (data.type == 11) {
        this.selectFileInfo.filename = "";
        this.messages = [];
        this.messages.push({ text: data.message, type: 'user', commandlist: [] })
        const scanres = await ipcRenderer.invoke('scan-directory')
        if (scanres.success) {
          this.fileList = scanres.files;
          if (this.fileList.length <= 0) {
            this.messages.push({ text: '未找到零件模型，请放置零件模型文件到系统或U盘中后重试', type: 'bot', commandlist: [] })
          } else {
            this.messages.push({ text: '', type: 'file', commandlist: [] })
          }
        } else {
          this.fileList = [];
          this.messages.push({ text: '在系统和U盘中查找零件模型失败 ' + scanres.message, type: 'bot', commandlist: [] })
        }
        this.scrollToBottom();
      }
      //判断指令返回结果
      if (data.type == 12) {
        if (this.selectFileInfo.filename == "") return;
        if (data.result.command == "openfile") {
          if (data.result.reply == true || data.result.reply == 'true') {
            this.showProgressInfo = true;
            this.isFinishProgress = false;
            this.nowStep = 1;
            this.SetStepStatus(0, 'process', '进行中');
            this.SetStepStatus(1, 'waiting', '未开始');
            this.messages = [];
            this.messages.push({ text: '好的，正在为您进行智能编程与仿真', type: 'bot', commandlist: [] })
          } else {
            this.messages.push({ text: '开始加工失败 ' + data.result.message, type: 'bot', commandlist: [] })
          }
          this.scrollToBottom();
        }
        if (data.result.command == "interaction_order") {
          if (data.result.reply == true || data.result.reply == 'true') {
            this.messages.push({ text: data.result.message, type: 'bot', commandlist: [] })
          } else {
            this.messages.push({ text: '执行失败 ' + data.result.message, type: 'bot', commandlist: [] })
          }
          this.scrollToBottom();
        }
        if (data.result.command == "handstop") {
          if (data.result.reply == true || data.result.reply == 'true') {
            this.messages.push({ text: '智能编程已终止', type: 'bot', commandlist: [] })
          } else {
            this.messages.push({ text: '手动终止失败 ' + data.result.message, type: 'bot', commandlist: [] })
          }
          this.scrollToBottom();
          this.SetStepStatus(0, 'waiting', '未开始');
          this.SetStepStatus(1, 'waiting', '未开始');
          this.isFinishProgress = true
          //延时几秒主动关闭页面
          setTimeout(() => {
            this.handleWindowClose();
          }, this.pagehidetime * 1000);
        }
        if (data.result.command == "programming") {
          if (data.result.reply == true || data.result.reply == 'true') {
            this.SetStepStatus(0, 'success', '成功生成编程文件 ' + data.result.message);
            this.SetStepStatus(1, 'process', '进行中 ');
            this.nowStep = 2
            //切割路径和文件名
            pos = data.result.message.lastIndexOf('/')  // '/'所在的最后位置
            this.selectFileInfo.gcodename = data.result.message.substr(pos + 1)  //截取文件名称和后缀   
            this.selectFileInfo.gcodepath = data.result.message.substr(0, pos)  //截取路径字符串
          } else {
            this.SetStepStatus(0, 'error', data.result.message);
            this.isFinishProgress = true
          }
        }
        if (data.result.command == "simulating") {
          if (data.result.reply == true || data.result.reply == 'true') {
            this.SetStepStatus(1, 'success', '完成智能仿真');
            //弹出提示框，是否确认加工
            ipcRenderer.send("showAlert");
            setTimeout(() => {
              ipcRenderer.send('message-from-renderer', {
                target: 'alert', data: {
                  type: 1, selectFileInfo:
                  {
                    filename: this.selectFileInfo.filename,
                    gcodename: this.selectFileInfo.gcodename,
                    gcodepath: this.selectFileInfo.gcodepath
                  },
                  des: "通知alterG代码地址"
                }
              });
              this.handleWindowClose();
            }, 200);

          } else {
            this.SetStepStatus(1, 'error', data.result.message);
          }
          this.isFinishProgress = true
        }
      }
      ipcRenderer.send('message-from-renderer', { target: 'floatball', data: { type: 31, des: "智能编程流程是否结束", success: !this.isFinishProgress } });
      this.isMQTTRuning = false;
    },
    SetStepStatus(index, status, message) {
      this.steps[index].status = status
      this.steps[index].message = message
    },
    //发送MQTT指令
    SendMQTTMessage(command, message) {
      if (this.isMQTTRuning) return;
      this.isMQTTRuning = true;
      ipcRenderer.send('message-from-renderer', {
        target: 'floatball',
        data: { type: 32, command, message, des: "智能编程执行指令" }
      });
    },

    //发送日志记录
    log(msg, ctx) {
      ipcRenderer.invoke('app-log', { msg: 'todo--' + msg, ctx });
    },

    //点击输入框  取消自动发送消息定时器
    async handleMouseDown(e) {
      if (this.autoSendMessageId) clearTimeout(this.autoSendMessageId)
    },

    //暂停录音并不做后续处理
    async userStopRecording() {
      if (this.isUserStop) return;
      this.isUserStop = true;
      //在1秒间隔内点击 则不触发事件
      var inttimeout = 1;
      const diff = Math.abs(new Date() - this.lastruningtime);
      if (diff < 500) {
        inttimeout = 500 - diff;
      };
      setTimeout(async () => {
        await this.stopRecording();
        this.isUserStop = false;
        if (this.IsMouseLeave && !this.isMouseOnFloatBall) {
          this.startTipCloseTimer();
        }
      }, inttimeout);
    },

    // ***********************麦克风录音 ***************//

    // 核心检测方法
    async checkMicrophoneState() {
      try {
        // 1. 检查权限状态
        const permissionStatus = await navigator.permissions.query({
          name: 'microphone'
        });
        // 2. 枚举音频设备
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');

        // 3. 组合状态判断
        const state = {
          hasPermission: permissionStatus.state === 'granted',
          hasDevice: audioInputs.length > 0,
          isDeviceReady: audioInputs.some(d => d.label) // 有标签表示已授权
        };

        // 4. 状态变化处理
        if (state.hasDevice && state.hasDevice && state.isDeviceReady) {
          this.isCanRecording = true;
        } else {
          this.isCanRecording = false;
        }
      } catch (error) {
        this.isCanRecording = false;
        this.log('检测失败:', error.message);
      }
    },

    async toggleRecording() {
      if (this.isruning) return;
      //在1秒间隔内点击 则不触发事件
      const diff = Math.abs(new Date() - this.lastruningtime);
      if (diff < 1000) return;
      this.lastruningtime = new Date();

      if (this.isRecording) {
        await this.stopRecording();
      } else {
        await this.startRecording();
      }

    },
    async startRecording() {
      if (this.isRecording || this.isStopRecording || !this.isCanRecording) return;
      try {
        // 初始化音频流
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          //this.log('[Renderer] 已获得麦克风权限');
        } catch (err) {
          this.log('[Renderer] 麦克风访问被拒绝:', err.message);
          if (err.message == "Requested device not found") {
            this.sendErrorMessage("无法启用语音，请试试手动输入吧");
          }
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
        this.userInput = "";
        this.placeholdertext = "倾听中...";
        this.recordingStartTime = new Date();
        this.startMonitoring();
        if (this.maxDuration > 2) {
          setTimeout(() => this.stopRecording(), this.maxDuration * 1000);
        }
      } catch (err) {
        this.sendErrorMessage("无法启用语音，请试试手动输入吧");
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
      const WIDTH = canvas.width
      const HEIGHT = canvas.height
      // 使用透明背景替代原来的半透明黑色
      this.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT)
      // 获取频率数据
      this.analyser.getByteFrequencyData(this.dataArray)
      this.drawBars(WIDTH, HEIGHT);

      //this.drawFrequencyBars(this.canvasCtx,canvas);

      // 循环绘制
      this.canvsanimationFrameId = requestAnimationFrame(this.draw)
    },

    /* 1. 基础柱状图 */
    drawBars(width, height) {
      const barWidth = (width / this.dataArray.length) * 10
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

    // 初始化画布
    initCanvas() {
      const canvas = this.$refs.waveCanvas
      // 高清屏适配
      //const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = 680
      canvas.height = 40
      canvas.style.width = "100%"
      canvas.style.height = canvas.height + 'px'

      this.canvasCtx = canvas.getContext('2d')
      //this.canvasCtx.scale(dpr, dpr)

      //this.createClipPath()

    },
    // 创建圆形裁剪区域
    createClipPath() {
      const canvas = this.$refs.waveCanvas
      const rect = canvas.getBoundingClientRect()
      this.canvasCtx.beginPath()
      this.canvasCtx.moveTo(5, 0)
      this.canvasCtx.arcTo(rect.width, 0, rect.width, rect.height, 5)
      this.canvasCtx.arcTo(rect.width, rect.height, 0, rect.height, 5)
      this.canvasCtx.arcTo(0, rect.height, 0, 0, 5)
      this.canvasCtx.arcTo(0, 0, rect.width, 0, 5)
      this.canvasCtx.closePath()
      this.canvasCtx.clip()
    },

    setupDataHandler() {
      this.mediaRecorder.ondataavailable = async (e) => {
        try {
          const buffer = await e.data.arrayBuffer();
          ipcRenderer.send('audio-chunk', buffer);
        } catch (err) {
          this.log('[Renderer] 音频数据处理失败:', err.message);
          this.sendErrorMessage("无法启用语音，请试试手动输入吧");
        }
      };

      this.mediaRecorder.start(200); // 每1秒收集数据
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
      if (!this.isSpeacking) {
        //两种情况判定为开始检测   1 检测到说话  2超过两秒钟
        const diff = Math.abs(new Date() - this.recordingStartTime);
        if (diff >= 2000) this.isSpeacking = true;
        if (volume * 100 >= this.silenceHold) this.isSpeacking = true;
      }
      if (!this.isSpeacking) return;

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
        this.log('[Renderer] 录音保存结果:', result);
      } catch (err) {
        this.sendErrorMessage("无法启用语音，请试试手动输入吧");
        this.log('[Renderer] 停止失败:', err.message);
        result.message = err.message;
      } finally {
        //如果是用户暂停的，则不进行后续调用接口操作
        if (!this.isUserStop) {
          await this.handlestopRecordAfter(result);
        } else {
          if (result.path) {
            const normalizedPath = path.normalize(result.path);
            fs.unlinkSync(normalizedPath) // 删除文件
          }
          this.cleanup();
        }
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
      this.isSpeacking = false;
      this.recordingStartTime = 0;
      this.placeholdertext = "有问题尽管问我...";
      //this.log('[Renderer] 资源已清理');
    },

    //获取录音 文字之后的处理 成功：调用人机交互接口  失败：提示网络故障，请重试，并给出错误原因=result.message
    async handlestopRecordAfter(result) {
      if (!result.success) {
        this.sendErrorMessage("无法启用语音，请试试手动输入吧");
      } else {
        const normalizedPath = path.normalize(result.path);
        const uploadres = await ipcRenderer.invoke('hnc_stt', normalizedPath);
        fs.unlinkSync(normalizedPath) // 删除文件
        if (!uploadres || uploadres.code != 200) {
          this.sendErrorMessage("无法启用语音，请试试手动输入吧");
        } else {
          this.userInput = uploadres.data.result;
          if (this.userInput.trim() !== '') {
            //this.autoSendMessageId= setTimeout(() => {
            //this.sendMessage();
            //}, 800);
          } else {
            this.sendErrorMessage("没听清您的声音，请重试");
          }
        }
      }
      //等所有的接口处理完成之后，在进行录音资源释放
      this.cleanup();
    },

    // ***********************麦克风录音结束 ***************//


    handleWindowClose() {
      ipcRenderer.send("close-todo")
    },
    formatText(message) {
      //this.log("formatText(message)", message.text)
      // 生成正则表达式匹配所有指令参数

      if (message.type == 'load') {
        return ' <div  class="typing-status" > 正在思考 <div class="dot-animation"> <div class="dot"></div>  <div class="dot"></div> <div class="dot"></div>  </div> </div>'
      }

      if (message.type == 'file') {
        const prefix = "在系统和U盘中搜索到以下零件模型，请选择文件加工：";
        const files = this.fileList || [];
        // 生成带编号的可点击文件列表
        const fileListRender = files.map((file, index) =>
          `<div> <a class="command-link" 
         onclick="fileClickHandler('${index}')"
         onmouseover="this.style.color='#79bbff'"
         onmouseout="this.style.color='#13CCCF'"
         style="cursor: pointer; color: #13CCCF;">
         ${index + 1}.
         ${file.name}
       </a></div>`
        ).join('');
        return `<div class="file-list">
              <div>${prefix}</div>
              ${fileListRender}
            </div>`;
      }

      let commands = [];
      if (message.type == 'bot') {
        commands = message.commandlist.map(c => c.command).join('|');
      }

      const regex = new RegExp(`\\b(${commands})\\b`, 'g');

      // 分步处理文本
      return message.text
        .replace(/\n/g, '<br>')  // 处理换行
        .replace(regex, (match) => {
          const target = message.commandlist.find(c => c.command === match);
          return target ?
            `<a class="command-link" 
          data-command="${target.command}"
          onclick="commandClickHandler('${target.command}','${target.app_id}')"
          onmouseover="this.style.color='#79bbff'"
          onmouseout="this.style.color='#13CCCF'">
          ${match}
          </a>`:
            match;
        });
    },
    handleCommandClick(appCommand, appId) {
      this.log('执行指令  ', appCommand, appId);
      let resp = '执行指令 ' + appCommand;
      this.messages.push({ text: resp, type: 'user', commandlist: [] });
      this.messages.push({ text: '好的，正在为您执行', type: 'bot', commandlist: [] });
      this.scrollToBottom();

      //同时将消息发送至悬浮窗，      2 表示执行指令
      ipcRenderer.send('message-from-renderer', {
        target: 'floatball', // 指定目标窗口
        data: {
          type: 2, des: "doto执行指令", command: {
            command: appCommand,
            app_id: appId
          }
        }
      });

    },

    handlefileClick(index) {
      if (this.isMQTTRuning) return;
      if (this.fileList.length > index) {
        var file = this.fileList[index];
        // 输入: C:\Users\John\file.txt → 输出: C:/Users/John/file.txt
        var newpath = file.path.replace(/\\/g, '/');
        this.SendMQTTMessage("openfile", newpath);
        this.selectFileInfo.filename = file.name
        this.messages.push({ text: '选择零件模型 ' + file.name, type: 'user', commandlist: [] })
        this.scrollToBottom()
      }
    },

    sendVoiceMessage() {
      setTimeout(() => {
        this.messages.push({ text: '这是AI机器人的回复。', type: 'bot', commandlist: [] })
        this.scrollToBottom()
      }, 1000)
    },
    sendMessage() {

      //智能式会话编程 + 流程没有结束  = 中途给加工发送指令
      if (this.showProgressInfo && !this.isFinishProgress) {
        if (this.nowStep == 1 && this.userInput.trim() !== '') {
          this.messages.push({ text: this.userInput, type: 'user', commandlist: [] })
          this.scrollToBottom();
          this.SendMQTTMessage("interaction_order", this.userInput);
          this.userInput = ''
        }
        return;
      }
      if (this.isruning) return;
      if (this.userInput.trim() !== '') {
        //同时将消息发送至悬浮窗，   type  1 表示进行故障诊断   2 表示执行指令
        ipcRenderer.send('message-from-renderer', {
          target: 'floatball', // 指定目标窗口
          data: { type: 1, message: this.userInput, des: "故障诊断" }
        });
        this.userInput = ''
        this.isruning = true;
      }
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const messagesContainer = document.querySelector('.messages')
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
        stateStore.saveTodoMessage(this.messages);
      })
    },
    sendErrorMessage(message) {
      this.messages.push({ text: message, type: 'bot', commandlist: [] })
      this.scrollToBottom();
      this.placeholdertext = "有问题尽管问我...";
    },
    showLoadMessage() {
      this.messages.push({ text: '', type: 'load', commandlist: [] })
      this.scrollToBottom();
    },
    hideLoadMessage() {
      if (this.messages.length > 1) {
        var lastmessage = this.messages[this.messages.length - 1];
        if (lastmessage.type == 'load') {
          this.messages.pop()
          this.scrollToBottom();
        }
      }
    },
  }
})

app.mount("#app")