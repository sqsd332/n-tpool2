# n-tpool

#### 介绍
实现一个node客户端thrift连接池。基于Promise API接收trift服务返回的数据。
可创建一个端口一个服务的连接池，也可以创建单端口富应用的连接池。 

#### 软件架构
使用generic-pool和thrift。


#### 安装教程

1.  npm i n-tpool2
2.  示例：
```
// 引入包
// mypool是连接池初始化函数
// 参数：[object]constructor 必须：thrift生成的文件, 
//       [object]thriftOption 必须：thrift连接配置项 + host + port + serviceName, 
//       [object|undefine]poolOption 可选： 连接词配置项
const mypool = require('n-tpool');
// 我的thrift客户端文件
var  Service = require('./Service');

var thriftConfig = {
  host: '127.0.0.1',
  port: 33206,
  // thrift服务是单端口富应用时，使用serviceName指定调用的服务名
  // serviceName: 'user'
}

var client = mypool(Service, thriftConfig);
// 配置连接池最大连接数是10
// var client = mypool(Service, thriftConfig, { max: 10 });
// 可以直接通过client.method().then(data => console.log(data)).catch(err => console.log(err))
// 调用thrift客户端方法，并取得返回值。
// 当服务端关闭时，这个线程池也不会退出，每次调用也会尝试创建连接，直到服务重新启动
// poolOptions是连接池配置，具体配置参考：[https://github.com/coopernurse/node-pool#readme](https://github.com/coopernurse/node-pool)
```


