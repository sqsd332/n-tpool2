const thrift = require("thrift");
const genericPool = require("generic-pool");

const default_p_opts = require("./poolConfig.js");
const default_t_opts = require("./thrifConfig.js");

function createThriftConnection(host, port, option, constructor, serviceName) {
  return new Promise((resolve, reject) => {
    const connection = thrift.createConnection(host, port, option);
    connection.on("connect", function () {
      resolve(connection);
    });
    connection.on("error", function(err){
      reject(err)
    })
  }).then((connection) => {
    if (serviceName) {
      const m = new thrift.Multiplexer();
      m.createClient(serviceName, constructor, connection);
    } else {
      thrift.createClient(constructor, connection);
    }
    return connection;
  });
}
// 方法执行函数
function invoke(serviceName, methodName, pool) {
  return function (...args) {
    let promise = pool.acquire();
    return promise
      .then((connection) => {
        let client = connection.client;
        client = serviceName ? client[serviceName] : client;
        return new Promise((resolve, reject) => {
          client[methodName](...args)
            .then((res) => {
              resolve(res);
            })
            .catch((err) => {
              reject(err);
            })
            .finally(()=>{
              pool.release(connection)
            });
        });
      })
      .catch((e) => {
        //超时或者等待连接已满
        let errmsg;
        if (e.name == "TimeoutError") {
          errmsg = `请求${pool._host}端口${pool._port + (serviceName ? serviceName + "服务" : "")
          }连接失败:超时`;
        } else {
          errmsg = `请求${pool._host}端口${pool._port + (serviceName ? serviceName + "服务" : "")
          }连接失败:建立了太多的连接`;
        }
        return Promise.resolve(errmsg);
      });
  };
}
// 连接池初始化函数
function ntpool(constructor, thriftOption, poolOption) {
  const port = thriftOption.port,
    host = thriftOption.host,
    serviceName = thriftOption.serviceName;
  const t_opts = Object.assign(default_t_opts, thriftOption),
    p_opts = Object.assign(default_p_opts, poolOption);

  const factory = {
    create: function () {
      return createThriftConnection(
        host,
        port,
        t_opts,
        constructor,
        serviceName
      );
    },
    destroy: function (resource) {
      return Promise.resolve(resource.destroy());
    },
    validate: function (resource) {
      return new Promise((resolve) => {
        return resolve(resource.connected);
      });
    },
  };

  const myPool = genericPool.createPool(factory, p_opts);

  myPool._host = host;
  myPool._port = port;
  myPool._net_testing = false; // 检查thrift通道通了吗
  myPool._enable_net = true; // 连接池中thrift可连接

  return Object.keys(constructor.Client.prototype)
    .filter((methodName, i, arr) => {
      return arr.includes(`send_${methodName}`);
    })
    .reduce((t, methodName) => {
      t[methodName] = invoke(serviceName, methodName, myPool);
      return t;
    }, {});
}
module.exports = ntpool;
