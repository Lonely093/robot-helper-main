const service= require("./request");
const hnc_stt='http://172.20.11.80:9000';
const hnc_tti='http://172.20.11.80:9001';
const hnc_fd='http://172.20.11.80:9002';

const apis = {
  //语音转文字
  hnc_stt(formData){
    return service(
     {
      method: 'post',
      url: `${hnc_stt}/api/hnc_stt`,
      data:formData,
      headers: {
        'accept': 'application/json',
        //'Content-Type': 'multipart/form-data'
        ...formData.getHeaders(), // 自动生成 multipart/form-data 的 Content-Type 和 boundary
      },
     }
    )
  },
  
  //语音转文字
  // hnc_stt(form){
  //   return service.post(`${hnc_stt}/api/hnc_stt`,form,{
  //     headers: {
  //       'accept': 'application/json',
  //       'Content-Type': 'multipart/form-data'
  //       //...form.getHeaders(), // 自动生成 multipart/form-data 的 Content-Type
  //     }
  //   });
  // },

  //根据文字描述判断是指令还是故障诊断
  hnc_tti(info) {
    return service({
        method: 'post',
        url: `${hnc_tti}/api/hnc_tti`,
        data:{
            "inputs":info
        },
        headers:{
          'Content-Type': 'application/json' // ✅ 必须明确指定
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
      },
      headers:{
        'Content-Type': 'application/json' // ✅ 必须明确指定
      }
  });
},
}

module.exports = apis;

