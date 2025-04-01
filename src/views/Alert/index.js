const { ipcRenderer } = require("electron");
const Vue = require('vue')

const app = Vue.createApp({
  // created() {
  // },
  data() {
    return {
      message: "当前零件(XXX.stp)已完成智能编程与仿真，输出加工程序O123，路径path/to/Gcode，是否开始加工？"
    }
  },

  async mounted() {

  },
  beforeUnmount() {

  },
  methods: {
    handleConfirm() {
      ipcRenderer.send("close-alert")
    },
    handleCancel() {
      ipcRenderer.send("close-alert")
    },
    //发送日志记录
    log(msg, ctx) {
      ipcRenderer.invoke('app-log', { msg: 'alert--' + msg, ctx });
    },


  },
  watch: {

  }
})
app.mount("#app")