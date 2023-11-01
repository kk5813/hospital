var os = require("os");
var io = require("socket.io").listen("3008");
var osUtils = require("os-utils");
var interval = -1;
var currCPU = 0;

io.sockets.on('connection', socket=> {//连接事件
  socket.emit("connected", "连接成功")
  console.log("连接成功")

  socket.on("disconnect",()=>{
    console.log("disconnect")
  })

  socket.on('endConnection', function (data) {
    console.log("endConnection")
    console.log(data)
    socket.emit("unConnection", "服务器端已停止")
    clearInterval(interval)
    interval = -1;
  })
})

function start(){
  updateCPU();
  if (interval < 0) {
    interval = setInterval(function () {
      var freeMem = os.freemem()/1024/1024/1024;
      var totalMem = os.totalmem()/1024/1024/1024;
      var data = {
        cpuUsage: ( currCPU * 100.0 ).toFixed(2) + "%",
        freeMem: freeMem.toFixed(2) + "G",
        totalMem: totalMem.toFixed(2) + "G",
        usedMem: (totalMem - freeMem).toFixed(2) + "G",
        MemUsage: ( (totalMem - freeMem)/totalMem * 100.0 ).toFixed(2) + "%",
      };
      io.sockets.emit("systemUpdate",data)
      //console.log(data)
    }, 3000);//每隔1s取系统数据
  }
}

function updateCPU() {
  setTimeout(function () {
    osUtils.cpuUsage(function (value) {
      currCPU = value;
      updateCPU();
    });
  }, 0);
}

//start() // 直接运行  
module.exports = {
  start
}
