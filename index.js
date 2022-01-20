const thrift = require('thrift');
const genericPool = require('generic-pool');
const net = require('net');

const default_p_opts = require('./poolConfig.js');
const default_t_opts = require('./thrifConfig.js');

function createThriftConnection(host, port, option, constructor, serviceName) {
	return new Promise((resolve, reject) => {
		const connection = thrift.createConnection(host, port, option);
		connection.on('connect', function() { 
			resolve(connection) 
		})
			.on('timeout', function() {
				reject('连接超时');
				connection.destroy(new Error('连接超时'));
			}).on('error', function(err) { reject(err.message); })
			.on('close', function() { reject('连接关闭'); });
	}).then(connection => {
		connection.requestState = 1;
		connection.removeAllListeners('timeout')
			.removeAllListeners('error')
			.removeAllListeners('close')
			.on('timeout', function() {
				this.requestState = 10;
			}).on('error', function(err) {
				this.requestState = 20;
			}).on('close', function() {
				this.requestState = 30;
			});
		if (serviceName) { 
			const m = new thrift.Multiplexer();
			m.createClient(serviceName, constructor, connection);
		} else {
			thrift.createClient(constructor, connection);
		}
		return connection;
	});
}
// 每次执行方法添加连接监听
function listenError(connection, reject) {
	function onTimeout() { reject(`请求[${connection.host}:${connection.port}]超时。`) }
	function onError(err) {
		if (connection.connected) {
			reject(`请求[${connection.host}:${connection.port}]异常：${err.message}`);
		} else {
			reject(`请求[${connection.host}:${connection.port}]异常：网络中断。`);
		} 
	}
	function onClose() { 
		reject(`请求[${connection.host}:${connection.port}]异常：网络中断或者服务关闭`) 
	}
	connection.on('timeout', onTimeout).on('close', onClose).on('error', onError);
	// return { onTimeout, onError, onClose };
	// connection.on('close', onClose).on('error', onError);11
	return { onError, onClose };
}
// 方法执行函数
function invoke(serviceName, methodName, pool) {
	return function(...args) {
		return pool.acquire().catch((e) => {
			return new Promise((resolve, reject) => {
				if (!pool._enable_net) {
					if (!pool._net_testing) {
						pool._net_testing = true;
						const s  = net.connect({ host: pool._host, port: pool._port });
						s.on('connect', function() {
							pool._draining = false;
							pool._enable_net = true;
							s.destroy();
						}).on('timeout', function() {
							s.destroy('timeout');
						}).on('error', function(err) {
							// console.log('draining:', err);
						}).on('close', function(err) {
							pool._net_testing = false;
							if (err) {
								pool._draining = true;
								pool._enable_net = false;
							}
							reject(`获取[${pool._host}:${pool._port}]异常：网络中断或者服务关闭`);
						});
					}
					reject(`获取[${pool._host}:${pool._port}]异常：服务器繁忙`);
				} else {
					pool._net_testing = true;
					pool._enable_net = false;
					const s  = net.connect({ host: pool._host, port: pool._port });
					s.on('connect', function() {
						pool._enable_net = true;
						pool._draining = false;
						s.destroy();
					}).on('timeout', function() {
						s.destroy('timeout');
					}).on('error', function(err) {
						// console.log('testing:', err);
					}).on('close', function(err) {
						pool._net_testing = false;
						if (err) {
							pool._enable_net = false;
							pool._draining = true;
							for (const elem of pool._allObjects) { // 销毁所有连接
								const connection = elem.obj;
								pool.destroy(connection);
							}
						}
						reject('获取thrift连接失败：可能网络中断或者服务关闭');
					});
				}
			});
		}).then((connection) => {
			console.log(args, 'then');
			let client = connection.client;
			client = serviceName ? client[serviceName] : client;
			let errorCb;
			return new Promise((resolve, reject) => {
				errorCb = listenError(connection, reject);
				client[methodName]().then(res => {
					resolve(res);
				}).catch(err => {
					reject(err);
				});
			}).then((res) => {
				connection.removeListener('close', errorCb.onClose)
					.removeListener('error', errorCb.onError);
					// .removeListener('timeout', errorCb.onTimeout)
				pool.release(connection).catch(err => {
					// console.log('release1：', err);
				});;
				return res;
			}).catch((err) => {
				connection.removeListener('close', errorCb.onClose)
					.removeListener('error', errorCb.onError);
					// .removeListener('timeout', errorCb.onTimeout)
				if (connection.connected) {
					connection.requestState === 1;
					pool.release(connection).catch(err => {
						// console.log('release2：', err);
					});
				} else {
					pool.destroy(connection).catch(err => {
						// console.log('release2：', err);
					});
				}
				throw err;
			});
		});
	}
}
// 连接池初始化函数
function ntpool(constructor, thriftOption, poolOption) {
	const port = thriftOption.port,
		host = thriftOption.host,
		serviceName = thriftOption.serviceName;
	const t_opts = Object.assign(default_t_opts, thriftOption),
		p_opts = Object.assign(default_p_opts, poolOption);
	
	const factory = {
		create: function() {
			return createThriftConnection(host, port, t_opts, constructor, serviceName);
		},
		destroy: function(resource) {
			return Promise.resolve(resource.destroy());
		},
		validate: function(resource) {
			return new Promise(resolve => { 
				return resolve(resource.connected);
			});
		}
	};
	
	const myPool = genericPool.createPool(factory, p_opts);

	myPool._host = host;
	myPool._port = port;
	myPool._net_testing = false; // 检查thrift通道通了吗
	myPool._enable_net = true; // 连接池中thrift可连接
	
	return Object.keys(constructor.Client.prototype)
		.filter((methodName, i, arr) => {
			return arr.includes(`send_${methodName}`);
		}).reduce((t, methodName) => {
			t[methodName] = invoke(serviceName, methodName, myPool);
			return t;
		}, {});
}

module.exports = ntpool;
