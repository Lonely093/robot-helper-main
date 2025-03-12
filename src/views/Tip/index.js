const { ipcRenderer } = require("electron");
const Vue = require('vue')
const { formatterTime } = require("../../utils/date.js")
const { getConfig, defaultConfig } = require("../../utils/store.js")
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
      showtext: false,
      showinput: false,
      userInput: "",
      tipText: '请问你需要什么帮助？',
      IsMouseLeave:true,
      isMouseOnFloatBall:true,
      tipCloseTimeoutId: null,

    }
  },

  mounted() {

    ipcRenderer.on('message-to-renderer', (event, data) => {
      //显示录音图标
      if (data.type == 3) 
      {
        this.showtext = false;
        this.showinput = false;
      }
      //鼠标在机器人上
      else if(data.type == 4){ 
        if (this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId) 
        this.isMouseOnFloatBall=true;
      }
      //鼠标离开了机器人
      else if(data.type == 5){ 
        this.isMouseOnFloatBall=false;
      }
      //录音故障，显示输入框
      else if(data.type == 6)
      {
        this.showinput = true;
        this.showtext = false;
        this.userInput = "";
      }
      //显示文字
      else {  
        this.showinput = false;
        this.showtext = true;
        this.tipText = data.message;
        //值变化时，且鼠标不在悬浮窗则启动关闭
        if(this.IsMouseLeave && !this.isMouseOnFloatBall) 
        {
          this.startTipCloseTimer();
        }
      }
    });
  },
  beforeUnmount() {
    if(this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId)
  },
  methods: {

    //发送日志记录
    log(msg, ctx) {
      ipcRenderer.invoke('app-log', { msg: 'tip--' + msg, ctx });
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
        this.showinput = false;
        this.showtext = true;
        this.tipText = this.userInput;
        this.userInput = "";
        //同时将消息发送至悬浮窗，      4  表示tip发送的消息
        ipcRenderer.send('message-from-renderer', {
          target: 'floatball', // 指定目标窗口
          data: {
            type: 4,
            message: this.tipText
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
      //通知floatball取消关闭定时器
      ipcRenderer.send('message-from-renderer', {
        target: 'floatball', // 指定目标窗口
        data: {
          type: 5,
          message:"鼠标悬浮在tip上"
        }
      });
    },

    hanleMouseLeave() {
      this.IsMouseLeave=true;
      if(this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId);
      //限定条件  只有显示文本时，离开才隐藏
      // if(this.showtext){
       this.startTipCloseTimer();
      //}
    },

  },
  watch: {
    tipText(newVal) {
      //this.startTipCloseTimer() // 值变化时重置倒计时
    }
  }
})
app.mount("#app")