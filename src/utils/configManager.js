
//默认连接配置
const DEFAULT_CONFIG = {
  http: {
    hnc_stt: 'http://172.20.11.80:9000/api/hnc_stt',
    hnc_yn: 'http://172.20.11.80:9001/api/hnc_yn',
    hnc_tti: 'http://172.20.11.80:9001/api/hnc_tti',
    hnc_fd: 'http://172.20.11.80:9002/api/hnc_fd'
  },
  mqtt: {
    brokerUrl: 'mqtt://127.0.0.1:1883',
    clientId: 'AIRobot',
    username: '',
    password: '',
    protocolVersion: 4,    // 3.1 =	3   3.1.1  =  4   5.0 = 5
    protocolId: "MQTT",   // 3.1 =MQIsdp    3.1.1 & 5.0 = MQTT 
    timeout: 8,           //配置MQTT指令执行超时时长(秒)
  },
  pagehidetime: 5,       //配置鼠标离开窗口后 自动隐藏的时间(秒)
  maxDuration: 20,       //配置最大录音时长(小于3不生效，不限制时长) (秒)
  silenceHold: 70,       //配置静音阈值10-100   
  silenceStop: 1,        //配置主动停止录音时长 (秒)
  about: {
    appname: "语音助手APP",
    version: "1.0",
    info: "支持语音交互，识别指令，自动执行指令，故障诊断，手动执行指令等功能"
  },
  scandirectory: "D:/test",   //扫描指定目录
  scansuffix: ".stp",          //扫描指定后缀文件
};

// 读取配置
module.exports = DEFAULT_CONFIG;