// 服务器地址IP和相关端口
var IP = 'localhost'   //IP
var socketPort = 3000  //端口
var httpPort = 3345
var httpsPort = 3346
var SOCKET_IP = "http://"+ IP + ":" + socketPort;
// var SOCKET_IP = "https://nowhealth.top:" + socketPort;
//配置socket客户端
var socket_options = {
    secure:true,
    reconnect: true,
    rejectUnauthorized : false
};
exports.httpPort = httpPort
exports.httpsPort = httpsPort
exports.socketPort = socketPort
exports.SOCKET_IP = SOCKET_IP
exports.IP = IP
exports.socket_options = socket_options