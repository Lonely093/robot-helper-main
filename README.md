# AIRobot

AIRobot是一个简约的桌面悬浮球工具，支持拖动及配置，提供语音录入，文字录入 发送故障诊断，执行指令等功能

>
> 参考项目地址：https://github.com/baday19/HiLoop


## 目录组织

> + src // 项目主目录
>   + assets // 静态资源
>   + style // 样式文件
>   + utils // 工具库
>   + views //页面文件
>     + ...
>   + main.js // 项目入口文件
>   + window.js // 定义了各个窗口的创建方法
>  + doc // 展示项目效果的一些资源

## 相关技术

> electron
>
> vue.js
>
> axios
>
> mqtt

## 开发环境

```shell
node -v
v16.18.1
npm -v
8.19.2
```

# Quick Start

## 安装依赖

```shell
npm install
```

## 启动

```shell
npm start
```

## 打包

```shell
npm run package
```

# 踩坑

## 安装依赖失败

**问题描述**

因为网络原因，npm install失败

换源依旧失败（国内源、官方源）

使用cnpm成功，但只安装了devDependencies下的依赖，未安装dependencies下的

使用科学上网工具辅助依旧失败

**解决方案**

时好时不好的，尝试了很多次，最后是npm使用淘宝源，慢慢的等终于成功了

感觉electron的依赖难下一些

## 悬浮球窗口尺寸与设置不符 偏大

**问题描述**

窗口属性设置transparent为true时窗口实际大小出现问题（变大了）

![bug-1](https://raw.githubusercontent.com/baday19/HiLoop/main/doc/bug-1.jpg)

transparent为false时，大小正常。

![bug-0](https://raw.githubusercontent.com/baday19/HiLoop/main/doc/bug-0.jpg)

在electron的issues里找到了相关的问题，作者进行了标记并没有解答

**解决方案**

保留多余的透明部分，通过拒绝区域内的鼠标事件，来忽视这个问题

当鼠标进入实际窗口区域，开放鼠标事件

```javascript
// 创建窗口时设置，forward：能接受鼠标移动事件
win.setIgnoreMouseEvents(true, { forward: true })
// 当鼠标移入时，设置为false
win.setIgnoreMouseEvents(false, { forward: true })
// 鼠标移出区域后，再设置回去
win.setIgnoreMouseEvents(true, { forward: true })
```

> 搜索"electron透明窗口鼠标穿透"等关键词能找到具体实现方案

在本项目中，使用了该方法去解决问题，但效果不佳。

由于多余的透明框不是很多，综合考虑，最终忽略了这个问题。

项目中对相关相关代码进行了注释

## 悬浮球拖动时窗口尺寸变大

**问题描述**

项目中有需求要拖动悬浮球，但发现拖动后，实际窗口大小在变化（由于设置transparent了可能看不见，但会影响鼠标点击事件）

**解决方案**

拖动时本需要设置坐标，设置的同时固定一下窗口大小

```javascript
ipcMain.on('ballWindowMove', (e, data) => {
  pages.suspensionWin.setBounds({ x: data.x, y: data.y, width: suspensionConfig.width, height: suspensionConfig.height })
  // pages.floatWin.setPosition(data.x, data.y)
})
```

## 打包报错/打包后运行出错



