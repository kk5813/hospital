var express = require('express');
var app = express();
var router = express.Router();
const {exec} = require('../db/config.js');
const passport = require('passport');

var moment = require('moment');
const formatDate = require('../time/formatetime.js');
//获取本地时区
moment.locale('zh-cn');

//获取字符串拼音
const Alphabetize = require('chinese-alphabetize')

//配置socket客户端
var SOCKET_IP = require("../utils/server_IP.js").SOCKET_IP;
var SOCKET_PORT = require("../utils/server_IP.js").socketPort;
var socket_options = require("../utils/server_IP.js").socket_options;
console.log(SOCKET_IP)
//var socket = require('socket.io-client')('https://www.nowhealth.top:3000');  
var socket = require('socket.io-client')(SOCKET_IP,socket_options); 
socket.on('connect', function(){
    console.log("已连接到socket服务器", SOCKET_PORT, "端口");
});
socket.on('disconnect', function(){
    console.log("服务器连接关闭")
});

// JWT鉴权
var jwtConfig = require("../utils/jwtAuth.js").jwtConfigAuth;
passport.use(jwtConfig);


//获取某一患者的随访记录
router.get('/patientdetails/:pid', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function patientdetails() {
        // 同步写法
        try {
              var pid = req.params.pid
              var sql = `select FollowRecord,FollowTime,FollowNextTime,FollowName from endhospital_follow_record where
              SeekMedicalAdviceID = '${pid}'`
              var FollowRecord_info = await exec(sql)
              var API_followLog = []
              for(FollowRecord_info_i in FollowRecord_info){
                  var obj = {
                    API_questionnaire:'',
                    API_date:'',
                    API_name:'',
                  }
                obj["API_questionnaire"] = JSON.parse(FollowRecord_info[FollowRecord_info_i].FollowRecord)
                obj["API_date"] = FollowRecord_info[FollowRecord_info_i].FollowTime
                obj["API_name"] = FollowRecord_info[FollowRecord_info_i].API_name
                API_followLog.push(obj)
              }
              if(FollowRecord_info.length === 0){
                res.json({
                    status:200,
                    API_followLog,
                    nextTime:''
                  }) 
              }else{
                res.json({
                    status:200,
                    API_followLog,
                    nextTime:FollowRecord_info[0].FollowNextTime
                  })
              }
              
              }catch(err) {
                  console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示"
                        })
                      }
                }
                patientdetails();  
})

//护士提交随访评估记录
router.post('/patientdetails/:pid', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function patientdetails1() {
        // 同步写法
        try {
            // {
            //     time:"xxxxxxxxxx", //下次随访时间
            //     name:"随访记录表"
            //     API_questionnaire:{
            //             };
            //     }
            //更改输入的格式
            //console.log(req.body)
            var FollowName = req.body.name
            var FollowRecord = JSON.stringify(req.body.API_questionnaire)
            var SeekMedicalAdviceID = req.params.pid
            var suifangTime = req.body.time
            suifangTime = formatDate(suifangTime)
            var sql = `insert into endhospital_follow_record (SeekMedicalAdviceID,NurseID,FollowRecord,FollowTime,FollowNextTime,FollowName)
            values ('${SeekMedicalAdviceID}','${req.user.UserID}','${FollowRecord}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${suifangTime}','${FollowName}')`
            await exec(sql)
            var sql1 = `update seekmedicaladvice set EndHospitaNextlFollowDateTime = '${suifangTime}' where SeekMedicalAdviceID = '${SeekMedicalAdviceID}'`
            await exec(sql1)
              res.json({
                status:200,
                msg:"上传成功"
              })
              }catch(err) {
                  console.log(err)
                        res.json({
                            status:0,
                            msg:"上传失败，服务器报错"
                        })
                      }
                }
                patientdetails1();  
})


//获得当前随访患者列表
router.get('/patientlist', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function patientlist() {
        // 同步写法
        try {
            var sql1 = `
            select
            a.SeekMedicalAdviceID as API_pid,
            a.ToHospitalID as API_toHospitalID,
            a.EndHospitalDateTime as API_enddate,
            a.EndHospitaNextlFollowDateTime as API_followdate,
            a.EndDiagResult as API_digaResult,
            b.Name as API_expert,
            a.PatientName as API_name
            from seekmedicaladvice as a left join users as b
            on a.CureDoctorID = b.UserID
            left join seekmedical_after_treatment_nurse as c
            on a.SeekMedicalAdviceID = c.SeekMedicalAdviceID
            where a.EndHospitaNextlFollowDateTime <= "${moment().add(1,'days').format('YYYY-MM-DD')}"
            and a.SeekMedicalState = '已完成'
            and c.RecommendNurseID = "${req.user.UserID}"
            `
            var patientList = await exec(sql1)
              res.json({
                status:200,
                patientList
              })
              }catch(err) {
                  console.log(err)
                        res.json({
                            status:0,
                            msg:"上传失败，服务器报错"
                        })
                      }
                }
                patientlist();  
})



module.exports = router;
