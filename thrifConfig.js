const thrift = require('thrift');
module.exports = {
	transport: thrift.TBufferedTransport,
	protocol: thrift.TBinaryProtocol,
	debug: false,
	max_attempts: 0,
	retry_max_delay: 0,
	connect_timeout: 1000,
	timeout: 6000,
};