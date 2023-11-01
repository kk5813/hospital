var ws = require("ws");
const {exec} = require('../db/config.js');

var request = require('request')
const hex_md5 = require('./md5.js')
// url ws://127.0.0.1:6080
// 创建了一个客户端的socket,然后让这个客户端去连接服务器的socket
var moment = require('moment');
//获取本地时区
moment.locale('zh-cn');


var data = {
    ws: null, // websocket对象
	seq : 0, // jsonrpc 发送消息的id, 自增
	sendStr:'',     // 发送给服务端的字符串
	recvStr:'',     //  接收到服务端的字符串
	descStr:'',     //   描述字符串
	user:'1580342013',// 用户名2480883861 1580342013
    // 备用账号（4832989220、9654532296、2931037587）密码同下
	//user:'admin',   // 用户名
	password:'hitry@2020', // 密码Abcd111333555
	version:'1.0.0',   // 协议版本
	lang:'cn',      // 本地语言
	myInfo:{name:"", gid:"", uid:""}, // 个人信息
	online:false,  // 登录状态
	msgPool : {},   // 消息池   seq : function
	root: {},       // 我这个level所能看到的最顶级的组 (真正的root只有一个, 只有level为4和5的才能看到, level为1,2,3的获取root只能看到自己所在公司(学校,机关,医院)的信息)
    callList: []   ,//会话列表
    url:'',
    nid:''
  }

        
//保存websocket对象
let socket;
// reConnect函数节流标识符
let flag = true;
//心跳机制
let heart = {
    timeOut:5000,
    timeObj:null,
    serverTimeObj:null,
    start:function(){
        console.log('startHeart');
        let self = this;
        //清除延时器
        this.timeObj && clearTimeout(this.timeObj);
        this.serverTimeObj && clearTimeout(this.serverTimeObj);
        this.timeObj = setTimeout(async function(){
            msg = { // 请求
                "method": "general.keeplive",
                "id": 1,
                "params": {
                    "expires": 60,
                    "date": "" //客户端当前时区时间
                }
            }
            msg.params.date = moment().format('YYYY-MM-DD HH:mm:ss')
            socket.send(JSON.stringify(msg))
            // self.serverTimeObj=setTimeout(function(){
            //     socket.close();
            //     reConnect(data.url)
            // },self.timeOut)
        },this.timeOut)
    }
}
//消息
function onMessage(sData){
    this.recvStr = sData
    var jData = JSON.parse(sData)
    console.log(jData)
    if(jData.method === "general.notify.disconnect"){
        var reason = "掉线原因:"
        if(jData.params.reason === 2){
            reason += "被抢登"
            reason +="\n对方地址:"+jData.params.data.addr
        }else{
            reason += jData.params.reason
        }
        alert(reason)
    }
    if(jData.id === 0){
        //console.log(jData)
        data.msgPool[jData.id] = jData

    }
    //录像消息
    if(jData.id === 5 ){
        console.log(jData.result.records)
    }

    //获取当前人员信息
    if(jData.id === 8 ){
        console.log(jData.result.members.length)
        
    }

    //获取会议列表
    if(jData.id === 10 ){
        data.msgPool["10"] = jData.result.calls
        console.log(jData.result.calls)
    }
    
}
//建立websocket连接函数
function createWebsocket(url) {
    try {
        console.log(url)
        socket = new ws(url);
        init();
    } catch (e) {
        //进行重连;
        console.log('websocket连接错误');
    }
    return socket
}

//对WebSocket各种事件进行监听   
function init() {
    socket.onopen = function () {
        //连接已经打开
        console.log("socket 链接成功")
        //重置心跳机制（本质上要开启心跳监控(133行、150行同理)，但是现在做的是直接每次创建会议直接重新登录，以节省带宽）
        // heart.start();
    }
    socket.onmessage = function (event) {
        
        // 通过event.data获取server发送的信息
        // 对数据进行操作
        onMessage(event.data)
        //console.log(JSON.parse(event.data));
        // 收到消息表示连接正常，所以重置心跳机制
        // heart.start();
    }
    socket.onerror = function () {
        //报错+重连
        console.log('socket连接出错');
        reConnect(socketUrl);
    }
    socket.onclose = function () {
        console.log('socket连接关闭');
    }
}

//设置监听消息的函数，这里写的是同步的，
//防止后面要用到返回的数据，所以把初始化接受数据的异步注释了
function ReceiveMessage(){
    return new Promise((resolve)=>{
        socket.onmessage = function(e){
            // heart.start();
            resolve(e.data)
        }
        //超时未收到消息
        setTimeout(() => {
            resolve("3秒未收到回复")
        }, 3000);
    })
}

//重连函数
//因为重连函数会被socket事件频繁触发，所以通过函数节流限制重连请求发送
function reConnect(url) {
    if (!flag) {
        return;
    }
    flag = false;
    setTimeout(function () {
        createWebsocket(url);
        flag = true;
    }, 3000)
}  

function request_exec(option) {
    const promise = new Promise((resolve, reject) => {
        request.post(option, (err,response,sData) => {
            if (err) {
                console.log(err)
                reject(err)
                return
            }
            resolve(sData)
        })
    })
    return promise
}
//登录操作
async function login(){
    data.online = false
    data.callList = []
    var time = Math.round(new Date().getTime()/1000).toString()
    var zone = new Date().getTimezoneOffset() /60 // -8
    zone = 0 -zone // +8
    //var url = "http://47.96.137.241:7088/user/login?user="+data.user+"&time="+time+"&zone="+zone+"&version="+data.version+"&lang="+data.lang
    let url = "http://meet.hitry.net/mesh/user/login?user="+data.user+"&time="+time+"&zone="+zone+"&version="+data.version+"&lang="+data.lang

    //http://meet.hitry.net/mesh/user/login?time=1615948234943&zone=8&lang=cn&version=1.1.0&platform=web
    data.sendStr = "login 1: "+url
    console.log('第一次登录的url:',url)
    console.log('第一次登录的sendStr:',data.sendStr)
    var thiz = data
    var option1 = {
    url: url
    }
    let sData = await request_exec(option1)
    console.log(sData)
    data.recvStr = "http post response:"+ sData
    var jData = JSON.parse(sData)
    console.log('第二次登录的sData:',sData)
    var m1 = hex_md5(thiz.password)  // m1 = md5(password)
    var password = hex_md5(thiz.user+":"+jData.realm+":"+m1+":"+jData.nonce)  // password = md5(user:realm:m1:nonce)
    url = url + "&password="+password;
    thiz.sendStr = "login 2: "+url
    console.log('第二次登录的url:',url)
    console.log('第二次登录的sendStr:',thiz.sendStr)
    let option2 = {
        url: url
    }
    let data1 = await request_exec(option2)
    var jdata = JSON.parse(data1)
    // console.log(jdata)
    var addr = jdata.ws[0]
    addr = 'ws://meet.hitry.net/agent/client?'+ addr.split('?')[1]
    //var host = "ws://10.35.41.161:8090"
    thiz.url = addr
    thiz.ws = createWebsocket(addr)
}

//ws发送包
function onSend(jData){
    var sData = JSON.stringify(jData)
    data.sendStr = sData
    //console.log('创建会话格式：',sData)
    //console.log(data.ws)
    data.ws.send(sData);
}
//创建会话
async function creatcall(endTime,callReason,chafangFlag=true){
    var jReq = {}
    let params = {
        "beginTime":'',
        "endTime":endTime,
        "agenda": callReason,   
        "gid": "1cxW7VS3crEpi3uoZapRKMP1RUML", //登录人的GID
        "name": "成都市第三人民医院视频会议",   //会议主题
        "media": {
            "demo": {
                "bmax": 4000  //演示流清晰度的最大带宽（共享屏幕的）
            },
            "bmax": 4000,   //会议流清晰度的最大带宽（摄像头画面的）
        }
    }
    jReq.method = "call.create"
    jReq.params = params
    jReq.id = data.seq++
    console.log(jReq)
    var sData = JSON.stringify(jReq)
    data.ws.send(sData)
    let res = await ReceiveMessage()
    let resMsg = JSON.parse(res)
    console.log(resMsg)
    // 设置会议主持人和成员
    // （主持人即为创建会议者，默认为158....账号）
    // （成员为要添加的查房设备的入会ID（此ID需要找到医院的查房设备进行查看））
    if(chafangFlag){
        await setmember(resMsg.result.nid,data.user,['1377744134','2480883861']);
    }else{
        await setmember(resMsg.result.nid,data.user,'');
    }
    return resMsg
}



//获取录像
function getPublishedStream(nid){
    var jReq = {}
    jReq.method ="media.getPublishedStream"
    jReq.params = {
        "nid":''
    }
    let msg = {
        "method": "record.query",
        "params": {
        },
        "id": 5
    }
    jReq.id = data.seq++
    jReq.params.nid = nid + ''
    console.log(msg)
    onSend(msg);
}

//设置会议标题
function setTitles(nid,content){
    msg = {
        "method": "call.setTitles",
        "id": 1,
        "params": {
            "nid": nid,
            "banner": {
                "enable": true,
                "position": "center",
                "size": "large",
                "color": "#ffff00",
                "bg_color": "#ffff00",
                "bg_transparency": 50,
                "text": content
            },
            "subTitles": {
                "enable": true,
                "size": "large",
                "color": "#8e7cc3",
                "bg_color": "#ffff00",
                "bg_transparency": 50,
                "text": content
            },
            "userNameStyle": {
                "color": "#FFFFFF",
                "position": "left-bottom",
                "bg_color": "#000000",
                "bg_transparency": 70,
            }
        }
    }
    onSend(msg1);
}
//获取直播地址
function getQueryLive(nid){
    msg1 = {
        "method": "call.queryLive",
        "id": 1,
        "params": {
            "nid": nid
        }
    }
    onSend(msg1);
}
//获取会议当前人员信息 id = 8
async function getList(nid){
    var jReq = {
        "id": 8,
        "method": "call.getMemberList",
        "params":{
            "nid":nid+""
        }
    }
    var sData = JSON.stringify(jReq)
    data.ws.send(sData)
    let a = await ReceiveMessage()
    console.log(a)
    return JSON.parse(a)
}


//订阅通知信息
async function attach(nid){
    let msg = { // 请求
        "method": "notify.attach",
        "id": 9,
        "params": {
            "nid":nid + "",
            "items": [{
                    "name": "notify.call.memberStatusChanged",
                    "get": true, // 我需要在result中返回全量数据
                    "update":true ,
                    // 如果有更新请实时通知我
                },
                {
                    "name": "notify.call.titlesChanged",
                    "get": true,
                    "update": true,
                    "filter": {
                        "isCfg": true,
                        // 当isCfg 为true的时候，banner和subTitles全量返回
                        // 当isCfg 为false或空的时候， banner的enable为true的时候全量返回，否则banner返回空,subTitles 同理
                    }
                },
                {
                    "name": "notify.alarm.terminal.plugStatus.triggered",
                    "gid": "1cxW7VS3crEpi3uoZapRKMP1RUML",
                    "update": true //"update"= ture 成功订阅
                }
            ]
    
        }
    }
    var sData = JSON.stringify(msg)
    data.ws.send(sData)
    let a = await ReceiveMessage()
    console.log(a)
    return JSON.parse(a)
}
//设置主持人
async function setmember(nid,moderator,chafangMember){
    var jReq1 = {}
    jReq1.id = 1,
    jReq1.method ="call.setMember"
    jReq1.params = {}
    jReq1.params.moderator = moderator + ''
    jReq1.params.members = chafangMember
    jReq1.params.nid = nid + ''
    var sData = JSON.stringify(jReq1)
    console.log(sData)
    data.ws.send(sData)
    let a = await ReceiveMessage()
    console.log(a)
    return JSON.parse(a)
}



//会控布局
async function layout(nid,layout_arr,arr){
    /**
     * 布局中的X表示x轴方向起始位置，Y表示y轴方向起始位置，Z未用，W表示X轴上的宽度，H表示Y轴的高度
     */
    let msg = {
        "id": 35,
        "method": "call.setAdviseMedia",
        "params": {
            "nid": nid + '',
            "medias": [
            ]
        }
    }
    // {name: "ddd", rect: Array(5), nid: "661016162054", 
    // uid: "EshhRkW6wnfci9bKNyWAhnutlimm", nickname: "ddd"}
    
    let streams = []
    console.log(arr.length)
    for(let j=0;j<arr.length;j++){
        let layout_obj = {
            "modeIndex": 1,
            "key": "layout_" + (j+1),
            "type": "main",
            "attachment": arr[j],
            // "layoutType": 0,
            // "token": "3539487140"
        }
        //console.log(j,layout_arr[j]["attachment"])
        streams.push(layout_obj)
    }
    msg.params.medias = [{
        "operator": 5,
        "streams": streams
    }]
    console.log(msg)
    console.log("streams.length  ",streams.length)
    var sData = JSON.stringify(msg)
    data.ws.send(sData)
    let a = await ReceiveMessage()
    console.log(a)
    return a
}
// 添加成员
async function memberStatusChanged(){
    var jReq2 = { // 通知
        "method": "notify.call.memberStatusChanged",
        "params": {
            "memberStatus": [{
                "nid": "4832989220",
                "name": "测试账号1",
                "status": "present",
                "role": "member",
                "mic": 1,
                "isAnonymous": 1
            }]
        }
    }
    var sData = JSON.stringify(jReq2)
    console.log(sData)
    data.ws.send(sData)
    let a = await ReceiveMessage()
    console.log(a)
    return JSON.parse(a)
}

//会议列表
async function list(){
    let msg = {
        "id": 10,
        "method": "call.getList",
        "params": {
        }
    }
    var sData = JSON.stringify(msg)
    data.ws.send(sData)
    console.log(data.msgPool)
    let a = await ReceiveMessage()
    return a
}

//上传
//选了有为1，选了无为0  {1:[a,b,c],0:[e,f,g],-1:[k,d]}

//查询 
//[a:1,b:0,c:1,d:-1 .....]

//以前的是  [a,b,c]
async function layout1(member1,nid){
    let le = member1.result.members.length
        let arr = []
        let layout_arr = []
            switch (le) {
            case 0:
                break;        
            case 1:
                for(let i=0;i<le;i++){
                    let x = i*1/le
                    let y = 0.25
                    let z = 0
                    let w = 1/le
                    let h = 0.5
                    console.log(x,y,z,w,h)
                    member1.result.members[i]["rect"] = [x,y,z,w,h]
                    arr.push(member1.result.members[i])
                }
                break;    
            case 2:
                for(let i=0;i<le;i++){
                    let x = i*1/le
                    let y = 0.25
                    let z = 0
                    let w = 1/le
                    let h = 0.5
                    console.log(x,y,z,w,h)
                    member1.result.members[i]["rect"] = [x,y,z,w,h]
                    arr.push(member1.result.members[i])
                }
                break;    
            case 3:
            for(let i=0;i<le;i++){
                let x = i*1/le
                let y = 0.25
                let z = 0
                let w = 1/le
                let h = 0.5
                console.log(x,y,z,w,h)
                member1.result.members[i]["rect"] = [x,y,z,w,h]
                arr.push(member1.result.members[i])
            }
                break;
            case 4:
                for(let i=0;i<le;i++){
                    let x = 0.5*(i%2)
                    let y = 0.5*(Math.floor(i/2))
                    let z = 0
                    let w = 0.5
                    let h = 0.5
                    console.log(x,y,z,w,h)
                    member1.result.members[i]["rect"] = [x,y,z,w,h]
                    arr.push(member1.result.members[i])
                }    
                break;
            case 5:
                member1.result.members[0]["rect"] = [0,0,0,0.5,0.5]
                arr.push(member1.result.members[0])
                member1.result.members[1]["rect"] = [0.5,0,0,0.5,0.5]
                arr.push(member1.result.members[1])
                member1.result.members[2]["rect"] = [0,0.5,0,0.333,0.5]
                arr.push(member1.result.members[2])
                member1.result.members[3]["rect"] = [0.333,0.5,0,0.333,0.5]
                arr.push(member1.result.members[3])
                member1.result.members[4]["rect"] = [0.666,0.5,0,0.333,0.5]
                arr.push(member1.result.members[4])
                break;
            case 6:
                member1.result.members[0]["rect"] = [0,0,0,0.333,0.5]
                arr.push(member1.result.members[0])
                member1.result.members[1]["rect"] = [0.333,0,0,0.333,0.5]
                arr.push(member1.result.members[1])
                member1.result.members[2]["rect"] = [0.666,0,0,0.333,0.5]
                arr.push(member1.result.members[2])
                member1.result.members[3]["rect"] = [0,0.5,0,0.333,0.5]
                arr.push(member1.result.members[3])
                member1.result.members[4]["rect"] = [0.333,0.5,0,0.333,0.5]
                arr.push(member1.result.members[4])
                member1.result.members[5]["rect"] = [0.666,0.5,0,0.333,0.5]
                arr.push(member1.result.members[5])
                break;
            case 7:
                member1.result.members[0]["rect"] = [0,0,0,0.333,0.5]
                arr.push(member1.result.members[0])
                member1.result.members[1]["rect"] = [0.333,0,0,0.333,0.5]
                arr.push(member1.result.members[1])
                member1.result.members[2]["rect"] = [0.666,0,0,0.333,0.5]
                arr.push(member1.result.members[2])
                member1.result.members[3]["rect"] = [0,0.5,0,0.25,0.5]
                arr.push(member1.result.members[3])
                member1.result.members[4]["rect"] = [0.25,0.5,0,0.25,0.5]
                arr.push(member1.result.members[4])
                member1.result.members[5]["rect"] = [0.5,0.5,0,0.25,0.5]
                arr.push(member1.result.members[5])
                member1.result.members[6]["rect"] = [0.75,0.5,0,0.25,0.5]
                arr.push(member1.result.members[6])
                break;    
            default:
                member1.result.members[0]["rect"] = [0,0,0,0.25,0.5]
                arr.push(member1.result.members[0])
                member1.result.members[1]["rect"] = [0.25,0,0,0.25,0.5]
                arr.push(member1.result.members[1])
                member1.result.members[2]["rect"] = [0.5,0,0,0.25,0.5]
                arr.push(member1.result.members[2])
                member1.result.members[3]["rect"] = [0.75,0,0,0.25,0.5]
                arr.push(member1.result.members[3])
                member1.result.members[4]["rect"] = [0,0.5,0,0.25,0.5]
                arr.push(member1.result.members[4])
                member1.result.members[5]["rect"] = [0.25,0.5,0,0.25,0.5]
                arr.push(member1.result.members[5])
                member1.result.members[6]["rect"] = [0.5,0.5,0,0.25,0.5]
                arr.push(member1.result.members[6])
                member1.result.members[7]["rect"] = [0.75,0.5,0,0.25,0.5]
                arr.push(member1.result.members[7])
                break;   
        }
        await layout(nid,layout_arr,arr)
}


async function creatCall(endTime,callReason='',gid,chafangFlag){
    await login()
    setTimeout(async function(){
        // await setmember('76975521394','1580342013','');
        // await setmember('76975521394','','4832989220');
        // await getList(76975521394)
        // await memberStatusChanged()
        let res = await creatcall(endTime,callReason)
        // 存储会议信息
        let GroupConsutationVideoURL = res.result.dwz_id
        GroupConsutationVideoURL = 'http://meet.hitry.net:80/call/call.html?' + GroupConsutationVideoURL + '#/'
        let GroupConsutationVideoID = res.result.nid
        let sql = `update groupconsultation set GroupConsutationVideoURL = '${GroupConsutationVideoURL}',
        GroupConsutationVideoID = '${GroupConsutationVideoID}' where GroupConsultationID = '${gid}';`
        exec(sql)
    },500) 
    return;
}
// console.log("aaaa",creatCall('2022-05-30 17:01:00','',558))
async function layOut(nid){
    await login()
    setTimeout(async function(){
        let c = await getList(nid)
        console.log(c)
        layout1(c,nid)
    },500) 
    return true
}

module.exports = {
    creatCall,
    layOut
}