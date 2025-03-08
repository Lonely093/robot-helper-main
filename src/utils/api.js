const service= require("./request");
const hnc_tti='http://172.20.11.80:9001';
const hnc_fd='http://172.20.11.80:9002';

const apis = {
  //语音转文字
  hnc_stt(formData){
    return service.post(
      hnc_tti+'/api/v1/File/File/Upload',
      formData,
      {
      'Content-Type':'multipart/form-data'
      }
    ).then(res=>{
     
    })
  },
  //根据文字描述判断是指令还是故障诊断
  hnc_tti(info) {
    return service({
        method: 'post',
        url: `${hnc_tti}/api/hnc_tti`,
        data:{
            "inputs":info
        }
    });
  },
  //故障诊断详情
  hnc_fd(info) {
    return service({
      method: 'post',
      url: `${hnc_fd}/api/hnc_fd`,
      data:{
          "inputs":info
      }
  });
},
}

module.exports = apis;

