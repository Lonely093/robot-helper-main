const { ipcRenderer } = require("electron");
const Vue = require('vue')

const { defaultConfig, getConfig, applyConfig } = require("../../utils/store")

const { ref } = require('vue')
const draggableElement = ref(null);

const mqttClient= require("../../utils/mqtt")
const apis= require("../../utils/api")

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

      isRecording: false,
      mediaStream: null,
      audioContext: null,
      analyser: null,
      silenceCount: 0,
      animationFrameId:null
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

    //this.connectmqtt();
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
      try {
        console.log("开始");
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
      
      this.mediaRecorder.start(1000); // 每1秒收集数据
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
      const SILENCE_THRESHOLD = 0.5; //可调整的静音阈值 最大值为1  
      console.log(volume);
      //此处为超过2s检测到的麦克风电流小于0.2则停止录音
      if (volume < SILENCE_THRESHOLD) {
        this.silenceCount += 1/60;
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

      try {
        this.processing = true;
        // 停止媒体录音器
        if (this.mediaRecorder?.state === 'recording') {
          this.mediaRecorder.stop();
        }
        // 通知主进程停止
        const result = await ipcRenderer.invoke('audio-stop');
        console.log('[Renderer] 录音保存结果:', result);
        this.$emit('record-complete', result);
      } catch (err) {
        console.error('[Renderer] 停止失败:', err);
        this.$emit('error', err.message);
      } finally {
        this.cleanup();
        this.processing = false;
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
      }
      
      this.isRecording = false;
      this.silenceCount = 0;
      console.log('[Renderer] 资源已清理');
    },

  // ***********************麦克风录音结束 ***************//

  async connectmqtt(){
      try {
        // 等待连接成功
        await mqttClient.connect()
        
        //测试主题
        mqttClient.subscribe('test/topic', (message, topic) => {
          console.log(`Received message from ${topic}:`, message)
        })

        //APP打开主题
        mqttClient.subscribe('Command/Open', (message, topic) => {
          console.log(`Received message from ${topic}:`, message)
        })
        
        //APP关闭主题
        mqttClient.subscribe('Command/Close', (message, topic) => {
          console.log(`Received message from ${topic}:`, message)
        })
        

        //AppCenter/Apps  //参见报文3
        //App/Launch/+    //参见报文10
        //App/Exit/+       //参见报文30
        //App/Reply/+      //参见报文14
        //App/Message/+   //App主动向语音助手发送消息时使用  //参见报文31

        
        //APP注册发布主题
        mqttClient.subscribe('AppCenter/Apps', (message, topic) => {
          console.log(`Received message from ${topic}:`, message)
        })
                
        //发送主题
        mqttClient.publish('test/topic', {
          text: 'Hello from Vue',
          timestamp: Date.now()
        })
        console.log("发送主题");
  
      } catch (error) {
        console.error('MQTT连接失败:', error);
      }
    },
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