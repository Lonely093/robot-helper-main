const { ipcRenderer } = require("electron");
const Vue = require('vue')
const { formatterTime } = require("../../utils/date.js")
const { applyConfig } = require("../../utils/store.js")

applyConfig()

const app = Vue.createApp({

  data: () => {
    return {
      todoList: [],
      finishList: [],
      // str2Html: handleStr
      now: new Date().getTime(),
      formVisible: false,
      form: {
        content: '',
        year: 2023,
        month: 4,
        date: 1,
        hour: 23,
        min: 59
      }
    }
  },

  mounted() {
    this.initForm()
  },
  methods: {
    initForm() {
      const today = new Date()
      const tForm = {
        content: '',
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        date: today.getDate(),
        hour: 23,
        min: 59
      }
      this.form = tForm
    },
    handleMonth() {
      if (this.form.month > 12) {
        this.form.month = 12
      } else if (this.form.month < 1) {
        this.form.month = 1
      }
    },

    handleMin() {
      if (this.form.min > 59) {
        this.form.min = 59
      } else if (this.form.min < 0) {
        this.form.min = 0
      }
    },
    showForm(flag) {
      this.formVisible = flag
    },
    submitTodo(e) {
      const tForm = this.form
      if (tForm.content == '') {
        return
      }
      const endTime = new Date(`${tForm.year}-${tForm.month}-${tForm.date} ${tForm.hour}:${tForm.min}:59`)
      const timestamp = endTime.getTime()
      const res = ipcRenderer.sendSync("todo", { name: "add", content: tForm.content, end_time: endTime.getTime() })
      const item = {
        id: res[0]['last_insert_rowid()'],
        endTime: formatterTime(timestamp),
        content: tForm.content,
        end_time: parseInt(timestamp),
        status: 0,
        tag: 0
      }
      this.todoList.unshift(item)
      this.initForm()
      this.formVisible = false
    },
   
    delTodo(item, index) {
      const id = item.id
      const currStatus = item.status
      ipcRenderer.send("todo", { name: "change", id: id, status: 2 })
      if (currStatus == 0) {
        this.todoList.splice(index, 1)
      } else {
        this.finishList.splice(index, 1)
      }
    }
  }
})
app.mount("#app")