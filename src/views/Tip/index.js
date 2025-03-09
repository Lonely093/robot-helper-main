const { ipcRenderer } = require("electron");
const Vue = require('vue')
const { formatterTime } = require("../../utils/date.js")
const { getConfig, defaultConfig } = require("../../utils/store.js")


let currConfig = {}
const app = Vue.createApp({

  data() {
    return {
      tipText: '请问你需要什么帮助？',
    }
  },

  mounted() {

    window.addEventListener('floatball-tip', (event)=>{
      //type 0 错误消息    1 正常 语音转文字结果
      const { type,message } = event.detail;
    });
    
  },
  methods: {

  }
})
app.mount("#app")