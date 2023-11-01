//这里要做的是每日日程通知
var schedule = require('node-schedule');
var moment = require('moment');
//获取本地时区
moment.locale('zh-cn');
const formatDate = require('../time/formatetime.js');
const {exec} = require('../db/config.js');
var SOCKET_IP = require("../utils/server_IP.js").SOCKET_IP;
var SOKET_PORT = require("../utils/server_IP.js").socketPort;
var socket_options = require("../utils/server_IP.js").socket_options;

//接入socket客户端作为通知
var socket = require('socket.io-client')(SOCKET_IP,socket_options); 
socket.on('connect', function(){
    console.log("已连接到socket服务器", SOKET_PORT);
});
socket.on('disconnect', function(){
    console.log("服务器连接关闭")
});


//定义一个任务列表的类
var taskList = {
    schedulelist:[]
}


//这里引入的dateTime为每天的日期,每天凌晨扫描当日的日程计划安排
async function date_schedule(dateTime){
    //设置当天起止时间,结束时间
    console.log('每天的计划已经开启')
    //起始时间
    let startTime = dateTime + ' 00:00:00'
    console.log(startTime)
    startTime = new Date(startTime).getTime()
    //结束时间(除了加上一天以外额外加十分钟，防止0时开始的事件，需要在23：50通知)
    let endTime = startTime + 86400000 + 600000
    //console.log(startTime,endTime)
    //扫描日程表中所有医生的每日计划安排,查询起始时间落在当日的范围里面的记录
    let sql = `select TimePlanID,StartTime,TimeContent,UserID from time_schedule where 
    StartTime<'${endTime}' and StartTime>='${startTime}';`
    let dateSchedule = await exec(sql)
    //console.log(dateSchedule)
    //将每条记录存入日程安排表中
    
    for(let dateSchedule_i=0;dateSchedule_i<dateSchedule.length;dateSchedule_i++){
        //定义提前十分钟通知
        let earlyTime = 60*10*1000
        var date = moment(parseInt(dateSchedule[dateSchedule_i].StartTime) - earlyTime).format();
        //console.log(date)
        let message_obj = {
            currentTime:moment().format('YYYY-MM-DD HH:mm:ss'),
            contentStartTime:formatDate(dateSchedule[dateSchedule_i].StartTime),
            content:dateSchedule[dateSchedule_i].TimeContent,
            toid:dateSchedule[dateSchedule_i].UserID
        }
        let name = dateSchedule[dateSchedule_i].TimePlanID + ''
        //为每个任务设置名称，名称为dateSchedule[dateSchedule_i].TimePlanID
        var j = schedule.scheduleJob(name,date, function(messageObj){
            socket.emit('schedule_message',messageObj)
            console.log(message_obj);
        }.bind(null,message_obj));
    }
    
}

/**
 * 
 * @param {*事件开始时间} startTime 
 * @param {*事件得内容} timeContent 
 * @param {*事件对象} toId 
 * @param {*事件名，暂定为事件插入的ID} timeName 
 */
//新增任务
function addSchedule(startTime,timeContent,toId,timeName){
    //定义提前十分钟通知
    let earlyTime = 60*10*1000
    var date = moment(parseInt(startTime) - earlyTime).format();
    //console.log(date)
    let message_obj = {
        currentTime:moment().format('YYYY-MM-DD HH:mm:ss'),
        contentStartTime:formatDate(startTime),
        content:timeContent,
        toid:toId
    }
    let name = timeName + ''
    //为每个任务设置名称，名称为dateSchedule[dateSchedule_i].TimePlanID
    var j = schedule.scheduleJob(name,date, function(messageObj){
        socket.emit('schedule_message',messageObj)
        console.log(message_obj);
    }.bind(null,message_obj));
    //console.log(schedule)
    //taskList.schedulelist.push(schedule.scheduleJobs)
}


/**
 * 
 * @param {暂定为time_schedule表里的TimePlanID作为日程的名称} timeName 
 */
//取消任务
function cancelSchedule(timeName){
    //console.log(schedule)
    schedule.scheduledJobs[timeName].cancel()
    //console.log(schedule)
}

module.exports = {
    date_schedule,
    addSchedule,
    cancelSchedule
}