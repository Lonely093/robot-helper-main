const { ipcRenderer } = require("electron");
const Vue = require('vue')

const { defaultConfig, getConfig, applyConfig } = require("../../utils/store")

const { ref } = require('vue')
const draggableElement = ref(null);

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
      subColor: ''
    }
  },

  mounted() {
    const storage = getConfig()
    this.mainColor = storage.mainColor
    this.subColor = storage.subColor
    this.opacity = storage.opacity
    ipcRenderer.on("update", (e, data) => {
      console.log(data)
      this.count = data
    })
    ipcRenderer.on("config", (e, data) => {
      this.opacity = data.opacity
      this.mainColor = data.mainColor
      this.subColor = data.subColor
    })
    ipcRenderer.send("updateBall")
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
      const SNAP_THRESHOLD = 200;
      const workArea = display.workArea;

      // 计算与各边的距离
      const edges = {
        left: screenX - workArea.x,
        right: workArea.x + workArea.width - (screenX + rect.width),
        top: screenY - workArea.y,
        bottom: workArea.y + workArea.height - (screenY + rect.height)
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

      console.log("minDist ", minDist )
      console.log("closestEdge ", closestEdge )
      console.log("SNAP_THRESHOLD", SNAP_THRESHOLD)
      // 执行吸附
      if (minDist  <= SNAP_THRESHOLD) {
        let newX = winBounds.x;
        let newY = winBounds.y;

        switch (closestEdge) {
          case 'left':
            newX = workArea.x - rect.left;
            break;
          case 'right':
            newX = workArea.x + workArea.width - rect.left - rect.width;
            break;
          case 'top':
            newY = workArea.y - rect.top;
            break;
          case 'bottom':
            newY = workArea.y + workArea.height - rect.top - rect.height;
            break;
        }
        console.log("set-win-position", newX, newY)
        // 更新窗口位置
        ipcRenderer.send('set-win-position', {
          x: Math.round(newX),
          y: Math.round(newY)
        });
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
    handleMouseUp(e) {
      this.snapToEdge();
      moveS[2] = e.screenX - e.x
      moveS[3] = e.screenY - e.y
      console.log(e.screenX, e.screenX);
      console.log(e.x, e.x);
      console.log(biasX, biasY);
      biasX = 0
      biasY = 0
      document.removeEventListener('mousemove', handleMove)
    },


  },
  computed: {
    progress: function () {
      const totalCount = this.count[0] + this.count[1]
      console.log("aaa" + totalCount)
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