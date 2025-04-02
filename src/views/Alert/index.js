const { ipcRenderer } = require("electron");
const Vue = require('vue')

const app = Vue.createApp({
  // created() {
  // },
  data() {
    return {
      selectFileInfo: {
        filename: "",
        gcodepath: "",
        gcodename: ""
      },
      message: "当前零件(XXX.stp)已完成智能编程与仿真，输出加工程序O123，路径path/to/Gcode，是否开始加工？",
      //message: "当前零件(" + selectFileInfo.filename + ")已完成智能编程与仿真，输出加工程序" + selectFileInfo.gcodename + "，路径" + selectFileInfo.gcodepath + "，是否开始加工？"
    }
  },

  async mounted() {
    ipcRenderer.on('message-to-renderer', (event, data) => {
      this.selectFileInfo = data.selectFileInfo;
      this.message = "当前零件(" + this.selectFileInfo.filename + ")已完成智能编程与仿真，输出加工程序" + this.selectFileInfo.gcodename + "，路径" + this.selectFileInfo.gcodepath + "，是否开始加工？"
    });
  },
  beforeUnmount() {

  },
  methods: {
    handleConfirm() {
      //处理加工  发送指令给HMI
      ipcRenderer.send('message-from-renderer', {
        target: 'floatball',
        data: { type: 32, command: "******PROGRAM" }
      });
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