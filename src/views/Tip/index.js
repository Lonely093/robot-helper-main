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
      showtext:false,
      tipText: '请问你需要什么帮助？',
      tipCloseTimeoutId: null,
    }
  },

  mounted() {
    this.startTipCloseTimer();
    window.addEventListener('floatball-tip', (event) => {
      //type 0 错误消息    1 正常 语音转文字结果
      const { type, message } = event.detail;
      console.log(event.detail);
      this.tipText = message;
    });

    ipcRenderer.on('message-to-renderer', (event, data) => {
      console.log('收到消息:', data); // 输出 "Hello from Renderer A"
      if(data.type==3)
      {
        this.showtext=false;
      }else{
        this.showtext=true;
        this.tipText = data.message;
      }
    });

      // 监听主进程位置更新
      // this.$electron.ipcRenderer.on('window-moved', (_, pos) => {
      //   this.position = pos
      // })
 
  },
  beforeUnmount() {
    window.removeEventListener('floatball-tip');
    clearTimeout(this.tipCloseTimeoutId)
  },
  methods: {
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