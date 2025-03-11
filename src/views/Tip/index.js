const { ipcRenderer } = require("electron");
const Vue = require('vue')
const { formatterTime } = require("../../utils/date.js")
const { getConfig, defaultConfig } = require("../../utils/store.js")


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
 * @listens floatball-tip - 监听悬浮球提示事件
 * @listens message-to-renderer - 监听主进程消息
 * @emits close-tip - 发送关闭提示框事件到主进程
 */
const app = Vue.createApp({

  data() {
    return {
      showtext : false,
      showinput : false,
      userInput:"",
      tipText: '请问你需要什么帮助？',
      tipCloseTimeoutId: null,
    }
  },

  mounted() {
    this.startTipCloseTimer();

    ipcRenderer.on('message-to-renderer', (event, data) => {
      console.log('收到消息:', data); // 输出 "Hello from Renderer A"
      if(data.type==3) //显示录音图标
      {
        this.showtext=false;
        this.showinput=false;
      }else{  //显示文字
        this.showinput=false;
        this.showtext=true;
        this.tipText = data.message;
      }
    });
 
  },
  beforeUnmount() {
    window.removeEventListener('floatball-tip');
    clearTimeout(this.tipCloseTimeoutId)
  },
  methods: {

    changeInput(){
      this.showinput=true;
      this.showtext=false;
      //同时将消息发送至悬浮窗，      3  暂停录音
      ipcRenderer.send('message-from-renderer', {
        target: 'floatball', // 指定目标窗口
        data: {type: 3}
      });
    },

    sendMessage(){
      if (this.userInput.trim() !== '') {
        this.showinput = false;
        this.showtext = true;
        this.tipText = this.userInput;
        this.userInput="";
        //同时将消息发送至悬浮窗，      4  表示tip发送的消息
        ipcRenderer.send('message-from-renderer', {
          target: 'floatball', // 指定目标窗口
          data: {
            type: 4, 
            message:this.tipText
          }
        });

      }
    },
    startTipCloseTimer() {
      // this.timeoutId = setTimeout(() => {
      //   ipcRenderer.send('close-tip');
      // }, 6000)
    },
    resetTipCloseTimer() {
      clearTimeout(this.tipCloseTimeoutId) // 清除旧定时器
      this.startTipCloseTimer() // 重新开始倒计时
    },
  },
  watch: {
    tipText(newVal) {
      console.log(newVal);
      this.resetTipCloseTimer() // 值变化时重置倒计时
    }
  }
})
app.mount("#app")