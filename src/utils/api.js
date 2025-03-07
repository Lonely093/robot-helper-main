const service= require("./request");
const host='http://172.20.11.80:9001';

const apis = {
    hnc_tti(info) {
      return service({
        method: 'post',
        url: `${host}/api/hnc_tti`,
        data:{
            "inputs":info
        }
    });
  },
}

module.exports = apis;

