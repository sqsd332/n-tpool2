module.exports = {
	max: 5,
	min: 0,
	maxWaitingClients: 100, // 最大请求等待数
	testOnBorrow: true, // 开启获取资源前验证
	acquireTimeoutMillis: 1000, // 最大等待资源获取时间
	fifo: true,
	priorityRange: 1, // 资源获取优先级，采取默认
	autostart: true, // 
	evictionRunIntervalMillis: 1000, // 开启定时清理空闲资源
	numTestsPerEvictionRun: 3,
	// softIdleTimeoutMillis
	idleTimeoutMillis: 60000, // 允许资源在池中保留最大空闲时间
	// Promise
}