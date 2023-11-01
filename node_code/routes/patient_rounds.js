var express = require('express');
var app = express();
var router = express.Router();
const {exec} = require('../db/config.js');
const passport = require('passport');
const query = require('../db/mysql.js');
var moment = require('moment');
//获取本地时区
moment.locale('zh-cn');
//获取字符串拼音
const Alphabetize = require('chinese-alphabetize')

//配置socket客户端
var SOCKET_IP = require("../utils/server_IP.js").SOCKET_IP;
var socket_options = require("../utils/server_IP.js").socket_options;
//var socket = require('socket.io-client')('https://www.nowhealth.top:3000');  
var socket = require('socket.io-client')(SOCKET_IP,socket_options); 
socket.on('connect', function(){
    console.log("已连接到socket服务器 3000端口")
});
socket.on('disconnect', function(){
    console.log("服务器连接关闭")
});

// JWT鉴权
var jwtConfig = require("../utils/jwtAuth.js").jwtConfigAuth;
passport.use(jwtConfig);


//查询该护士住院申请患者列表
router.get('/applylist', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function applylist() {
        // 同步写法
        try {
            //a.MedicalAdviceApplicationDateTime as API_date,
            var sql = `select 
            distinct a.SeekMedicalAdviceID as API_pid,
            a.PatientName as API_name,
            a.ApplySeekMedicalDateTime as API_date,
            a.ToHospitalID as API_toHospitalID,
            a.ToHospitalAssessment as API_state,
            c.Name as API_expert
            from seekmedicaladvice as a
            left join seekmedical_after_treatment_nurse as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c 
            on a.CureDoctorID = c.UserID
            where b.RecommendNurseID = "${req.user.UserID}"
            and a.ToTreatmentlAssessment = '0'
            and a.SeekMedicalState != "已完成"
            order by MedicalAdviceApplicationDateTime`
            var patientsList = await exec(sql)
            for(let patientsList_i=0;patientsList_i<patientsList.length;patientsList_i++){
                if(patientsList[patientsList_i]["API_state"] === '1'){
                    patientsList[patientsList_i]["API_state"] = '评估完成'
                }else{
                    patientsList[patientsList_i]["API_state"] = '未完成'
                }
            }
            res.json({
            status:200,
            patientsList
            })
              }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示"
                        })
                      }
                }
                applylist();  
})


//查询该患者详细的评估
router.get('/applydetails/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(PatientID)          
    async function patientsData() {
        // 同步写法
        try {
            //查询患者诊断基本信息
            var sql2 = `
            select SeekMedicalAdviceID,
            a.SeekMedicalAdviceStatus,
            a.SeekMedicalState,
            a.Symptom,
            a.PatientID,
            a.MedicalAdviceApplicationDateTime,
            a.ToHospitalAssessment
            from seekmedicaladvice as a
            where a.SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
            const patientdiaginfo = await exec(sql2)
            //console.log(patientdiaginfo)
            if(patientdiaginfo.length === 0){
                res.json({
                    //没有就诊号的情况下是没有其他信息,所以直接返回空的信息
                        API_state:'未完成',
                        API_basicInfo:"",
                        API_questionnaire:[]
                    })
            }else{
            //查询患者基本信息
            var sql1 = `select 
            a.ToHospitalID as API_toHospitalID,
            a.ToHospitalDateTime as API_date,
            b.UserID as API_UserID,
            b.Name as API_name,
            b.Gender as API_gender,
            b.Birthday as API_birthday,
            b.Address as API_address,
            b.Phone as API_tel,
            b.Image as API_pic
            from seekmedicaladvice as a left join users as b
            on a.PatientID = b.UserID
            where a.SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`  
            const patientinfo = await exec(sql1)  
             
            var sql3 = `select 
            a.FormTime as time,
            a.FormName as name,
            a.FormContent as data,
            a.NurseID,
            b.Name as NurseName
            from tohospital_assessment_form as a left join users as b
            on a.NurseID = b.UserID
            where a.SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`  
            const API_questionnaire = await exec(sql3) 
            
            for(API_questionnaire_i in API_questionnaire){
                API_questionnaire[API_questionnaire_i]["data"] = JSON.parse(API_questionnaire[API_questionnaire_i]["data"])
            }
            res.json({
                API_state:patientdiaginfo[0].ToHospitalAssessment === '1' ? '已完成':'未完成',
                API_basicInfo: patientinfo[0],
                API_questionnaire
            })
            }
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示该患者信息"
                })
                }
        }
        patientsData();              
})


//提交入院前的评估
router.post('/applydetails/pinggu/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(PatientID)          
    async function pinggu() {
        // 同步写法
        try {
                var form_data = JSON.stringify(req.body.data)
                //插入评估表单数据
                var sql = `insert into tohospital_assessment_form (FormTime,FormContent,FormName,SeekMedicalAdviceID,NurseID,AssessState)
                values ('${moment().format('YYYY-MM-DD HH:mm:ss')}','${form_data}','${req.body.name}','${SeekMedicalAdviceID}','${req.user.UserID}','入院前评估')`
                var insert = await exec(sql) 
                
                //记录此次评估记录及下次评估时间，下次评估时间默认七天
                var sql1 =  `insert into tohospital_assessment 
                (SeekMedicalAdviceID,AssessmentDate,AssessmentID,NextAssessmentDate,AssessmentName)
                values 
                ('${SeekMedicalAdviceID}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${insert.insertId}','${moment().add(7,'days').format('YYYY-MM-DD HH:mm:ss')}','${req.body.name}')
                `
                await exec(sql1) 
                res.json({
                msg:"提交成功",
                status:200
            })
                }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"提交失败"
                        })
                      }
                }
                pinggu();              
})

//提交患者得评估完成请求
router.post('/applydetails/confirm/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(PatientID)          
    async function applydetails_confirm() {
        // 同步写法
        try {
                //更新下次评估时间信息(更新七天后再次进行评估，更新一天后进行查房)
                var sql = `update seekmedicaladvice set ToHospitalAssessment = "1",
                ToHospitalNextAssessmentDate = '${moment().add(7,"days").format('YYYY-MM-DD HH:mm:ss')}',
                ToHospitalNextChafangDate = '${moment().add(1,"days").format('YYYY-MM-DD HH:mm:ss')}'
                where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
                await exec(sql)

                //更新患者的住院记录表(更新一天后进行查房)
                let sql2 = `update tohospital set 
                ToHospitalAssessment = "1",
                ToHospitalNextAssessmentDate = '${moment().add(7,"days").format('YYYY-MM-DD HH:mm:ss')}',
                ToHospitalNextChafangDateTime = '${moment().add(1,"days").format('YYYY-MM-DD HH:mm:ss')}'
                where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
                await exec(sql2)

                //向医生发送评估完成通知
                var sql1 = `select RecommendDoctorID from seekmedical_after_treatment_doctor
                where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
                var doctorlist =  await exec(sql1)
                for(doctorlist_i in doctorlist){
                    var res_obj = {
                        toid:doctorlist[doctorlist_i].RecommendDoctorID,
                        fromid: req.user.UserID
                    }
                    socket.emit("doctor_confirm_tohospital",res_obj)
                }
                res.json({
                    msg:"评估提交成功",
                    status:200
                })
                }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"评估提交失败"
                        })
                      }
                }
                applydetails_confirm();              
})

//查询该护士住院患者列表
router.get('/patientlist', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function patientlist() {
        // 同步写法
        try {
            //a.ToHospitalDateTime as API_date,
            var sql = `select 
            a.SeekMedicalAdviceID as API_pid,
            a.PatientName as API_name,
            a.MedicalAdviceApplicationDateTime as API_date,
            a.ToHospitalNextAssessmentDate as API_pingguState ,
            a.ToHospitalID as API_toHospitalID,
            c.Name as API_expert
            from seekmedicaladvice as a
            left join seekmedical_after_treatment_nurse as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c 
            on a.CureDoctorID = c.UserID
            where b.RecommendNurseID = "${req.user.UserID}"
            and a.ToHospitalAssessment = '1'
            and a.SeekMedicalState != '已完成'
            and a.ToTreatmentlAssessment = '1'
            order by a.ToHospitalDateTime`
            var patientsList = await exec(sql)
            for(patientsList_i in patientsList){
                //查询当日是否已经完成护理
                var sql1 = `select NursingRecordID from tohospital_nurse_record where SeekMedicalAdviceID = "${patientsList[patientsList_i]["API_pid"]}"
                and NursingDate >= "${moment().format('YYYY-MM-DD')}";
                `
                var isNursingRecordID = await exec(sql1)
                if(isNursingRecordID.length === 0){
                    patientsList[patientsList_i]["API_state"] = "未处理"
                }else{
                    patientsList[patientsList_i]["API_state"] = "已处理"
                }
                //console.log(patientsList[patientsList_i]["API_pingguState"])
                //查询当日是否需要评估
                if(patientsList[patientsList_i]["API_pingguState"] === null || patientsList[patientsList_i]["API_pingguState"] === " "){
                    patientsList[patientsList_i]["API_pingguState"] = "否"
                }else if(patientsList[patientsList_i]["API_pingguState"].split(" ")[0] === moment().format('YYYY-MM-DD')){
                    patientsList[patientsList_i]["API_pingguState"] = "是"
                }else{
                    patientsList[patientsList_i]["API_pingguState"] = "否"
                }
            }
              res.json({
                status:200,
                patientsList
              })
              }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示"
                        })
                      }
                }
                patientlist();  
})


//获取住院中患者的详情
router.get('patientdetails/basicinfo/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(PatientID)          
    async function basicinfo() {
        // 同步写法
        try {
            //查询患者诊断基本信息
            var sql2 = `
            select SeekMedicalAdviceID,
            a.SeekMedicalAdviceStatus,
            a.SeekMedicalState,
            a.Symptom,
            a.PatientID,
            a.MedicalAdviceApplicationDateTime
            from seekmedicaladvice as a
            where a.SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
            const patientdiaginfo = await exec(sql2)
            //console.log(patientdiaginfo)
            if(patientdiaginfo.length == 0){
                res.json({
                    //没有就诊号的情况下是没有其他信息,所以直接返回空的信息
                        API_basicInfo:""
                    })
            }else{
            //查询患者基本信息
            var sql1 = `select 
            a.ToHospitalID as API_toHospitalID,
            a.ToHospitalDateTime as API_date,
            b.UserID as API_UserID,
            b.Name as API_name,
            b.Gender as API_gender,
            b.Birthday as API_birthday,
            b.Address as API_address,
            b.Phone as API_tel,
            b.Image as API_pic
            from seekmedicaladvice as a left join users as b
            on a.PatientID = b.UserID
            where a.SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`  
            const patientinfo = await exec(sql1)  
             
            res.json({
                API_basicInfo: patientinfo[0]
            })
            }
                }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示该患者信息"
                        })
                      }
                }
                basicinfo();              
})


//获取住院中患者护理记录
router.get('/patientdetails/nursinglogs/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(PatientID)          
    async function nursinglogs() {
        // 同步写法
        try {
            //查询患者诊断基本信息
            var sql2 = `
            select
            a.NursingDate,
            a.NursingRecord,
            b.Name as NurseName
            from tohospital_nurse_record as a 
            left join users as b 
            on a.NurseID = b.UserID
            where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"
            order by NursingDate desc;`
            const API_nursingLogs = await exec(sql2)
            for(API_nursingLogs_i in API_nursingLogs){
                API_nursingLogs[API_nursingLogs_i]["NursingRecord"] = JSON.parse(API_nursingLogs[API_nursingLogs_i]["NursingRecord"])
            }
            res.json({
                status:200,
                API_nursingLogs
            })
                }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示该患者护理信息"
                        })
                      }
                }
                nursinglogs();              
})

//提交患者护理记录
router.post('/patientdetails/newnursinglog/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(PatientID)          
    async function newnursinglog() {
        // 同步写法
        try {
            var API_newNursing = JSON.stringify(req.body.API_newNursingLog)
            //插入护理记录
            var sql2 = `insert into tohospital_nurse_record (SeekMedicalAdviceID,NursingDate,NurseID,NursingRecord)
            values ("${SeekMedicalAdviceID}","${moment().format('YYYY-MM-DD HH-mm-ss')}","${req.user.UserID}",'${API_newNursing}');`
            await exec(sql2)

            let sql = `select PatientID from seekmedicaladvice where SeekMedicalAdviceID = '${SeekMedicalAdviceID}'`
            let patientID = await exec(sql)
            let sql4 = `select HospitalID from users where UserID = '${req.user.UserID}';`
            let hospitalID = await exec(sql4)
            if(patientID.length > 0){
                let nurse_Nursing_message = {
                    fromid:req.user.UserID,
                    toid:patientID[0].PatientID,
                    HospitalID:hospitalID[0].HospitalID,
                    pid:SeekMedicalAdviceID
                }
                //发送护理记录通知
                socket.emit('nurse_Nursing',nurse_Nursing_message)
            }

            res.json({
                status:200,
                msg:"提交成功"
            })
                }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"提交失败"
                        })
                      }
                }
            newnursinglog();              
})


//获取评估记录（不包括入院的评估记录）
router.get('/pinggulogs/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(SeekMedicalAdviceID)          
    async function pinggulogs() {
        // 同步写法
        try {
            //查询患者评估记录
            var sql3 = `select 
            date_format(FormTime, '%Y-%m-%d') as time
            from tohospital_assessment_form
            where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"
            and AssessState = '入院后评估'
            group by date_format(FormTime, '%Y-%m-%d') desc;`  
            const Time = await exec(sql3) 
            //console.log(Time)
            var API_nursingLog = []
            for(key in Time){
                var day_form_arr = []
                var API_day_form = {}
                var sql4 = `select 
                FormTime,
                FormContent,
                FormName
                from tohospital_assessment_form 
                where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"
                and AssessState = '入院后评估'
                and date_format(FormTime, '%Y-%m-%d') = "${Time[key].time}";`
                const Dayform = await exec(sql4) 
                //console.log(Dayform)
                for(Dayform_i in Dayform){
                    var form = {}
                    form["name"] = Dayform[Dayform_i].FormName
                    data = JSON.parse(Dayform[Dayform_i].FormContent)
                    form["data"] = data
                    day_form_arr.push(form)
                }
                API_day_form["API_date"] = Time[key].time
                API_day_form["API_questionnaire"] = day_form_arr
                API_nursingLog.push(API_day_form)
            }
            //查询患者下次评估时间
            var sql2 = `
            select
            ToHospitalNextAssessmentDate as API_date
            from seekmedicaladvice
            where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
            var ToHospitalNextAssessmentDate = await exec(sql2)
            var API_date = ToHospitalNextAssessmentDate[0].API_date
            res.json({
                status:200,
                API_nursingLog,
                API_date:API_date
            })
                }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示该患者评估信息"
                        })
                      }
                }
        pinggulogs();              
}) 



//提交患者评估记录表
router.post('/newpinggulog/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(PatientID)          
    async function newpinggulog() {
        // 同步写法
        try {
            var data = JSON.stringify(req.body.data)
            //插入评估记录
            var sql2 = `insert into tohospital_assessment_form (SeekMedicalAdviceID,FormTime,NurseID,FormContent,FormName,AssessState)
            values ("${SeekMedicalAdviceID}","${moment().format('YYYY-MM-DD HH-mm-ss')}","${req.user.UserID}",'${data}','${req.body.name}','入院后评估');`
            await exec(sql2)
            var sql = `update seekmedicaladvice set ToHospitalNextAssessmentDate = "${moment().add(7,"days").format('YYYY-MM-DD HH:mm:ss')}"
                where SeekMedicalAdviceID = ${SeekMedicalAdviceID};`
            await exec(sql)

            let sql3 = `select PatientID from seekmedicaladvice where SeekMedicalAdviceID = '${SeekMedicalAdviceID}'`
            let patientID = await exec(sql3)
            let sql4 = `select HospitalID from users where UserID = '${req.user.UserID}';`
            let hospitalID = await exec(sql4)
            if(patientID.length > 0){
                let nurse_pinggu_message = {
                    fromid:req.user.UserID,
                    toid:patientID[0].PatientID,
                    HospitalID:hospitalID[0].HospitalID,
                    pid:SeekMedicalAdviceID
                }
                //发送护理记录通知
                socket.emit('nurse_pinggu',nurse_pinggu_message)
            }
            res.json({
                status:200,
                msg:"提交成功"
            })
                }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"提交失败"
                        })
                      }
                }
                newpinggulog();              
})


//设置评估提醒时间
router.post('/pinggutixing/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(PatientID)          
    async function pinggutixing() {
        // 同步写法
        try {
            var sql = `update seekmedicaladvice set 
                ToHospitalNextAssessmentDate = "${req.body.remaindTime}"
                where SeekMedicalAdviceID = ${SeekMedicalAdviceID};`
                await exec(sql)
                res.json({
                msg:"评估提醒提交成功",
                status:200
            })
                }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"评估提醒提交失败"
                        })
                      }
                }
                pinggutixing();              
})


//查询入院记录
router.get('/ruyuanlog/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(PatientID)          
    async function ruyuanlog() {
        // 同步写法
        try {
            //查询患者诊断基本信息
            var sql2 = `
            select SeekMedicalAdviceID,
            a.SeekMedicalAdviceStatus,
            a.SeekMedicalState,
            a.Symptom,
            a.PatientID,
            a.MedicalAdviceApplicationDateTime
            from seekmedicaladvice as a
            where a.SeekMedicalAdviceID = "${SeekMedicalAdviceID}"
            order by a.ToHospitalDateTime desc;`
            const patientdiaginfo = await exec(sql2)
            //console.log(patientdiaginfo)
            if(patientdiaginfo.length == 0){
                res.json({
                    //没有就诊号的情况下是没有其他信息,所以直接返回空的信息
                        API_basicInfo:"",
                        API_treatmentLog:[
                            {
                                API_date:API_date,
                                API_description: "",
                                API_prescription: {
                            }
                            }
                        ]
                    })
            }else{
            //治疗方案查询
            var sql8 = `
            select TreatmentDescription as API_treatmentdescription,
            TreatmentDateTime as API_treatmentDateTime,
            TreatmentResults as API_patientState,
            TreatmentID
            from treatment where SeekMedicalAdviceID = ${patientdiaginfo[0].SeekMedicalAdviceID} and TreatmentPhase = '入院前治疗';
            `
            var API_treatment = await exec(sql8)
            //console.log(API_treatment)
            //判断治疗方案的是否存在
            
            var API_treatmentLog = []
            var obj = {}
            for(let treatment_i=0;treatment_i<API_treatment.length;treatment_i++){
                var treatment = []
                var sql11 =  `
                select TreamentPlanName
                from treatment_plan_relation where TreatmentID = "${API_treatment[treatment_i].TreatmentID}"
            `
                var API_description = await exec(sql11)
                //console.log(API_description)
                for(k=0;k<API_description.length;k++){
                    treatment.push(API_description[k].TreamentPlanName)
                }
                var sql9 =  `
                select DrugsName as API_drugsName,
                DrugsNumber as API_drugsNumber,
                DrugsNumberUnits as API_drugsNumberUnits,
                DrugsUsage as API_drugsUsage,
                UseFrequency as API_useFrequency,
                DrugsManufacturer as API_manufacturer,
                DosageOfDrugsUnits as API_drugsSpecification,
                UseTime as API_useTime
                from treatmentdrugrelation where TreatmentID = "${API_treatment[treatment_i].TreatmentID}"
            `
            
               var API_prescription = await exec(sql9)
               //当前患者状态转换为数组的格式
               //console.log(!API_treatment[treatment_i].API_patientState)
               //console.log(API_treatment[treatment_i].API_patientState)
               if(!API_treatment[treatment_i].API_patientState){
                    var patientState_arr = []
               }else{
                    var patientState_arr = API_treatment[treatment_i].API_patientState.split(",")
               }
               
                obj = {
                    API_date:API_treatment[treatment_i].API_treatmentDateTime,
                    API_description:treatment,
                    API_patientState:patientState_arr,
                    API_prescription
                }
                API_treatmentLog.push(obj)
            }
            //console.log(API_treatmentLog)
            //查询患者评估记录
            var sql12 = `
            select
            a.FormTime as API_date,
            a.FormContent as data,
            a.FormName as name,
            b.Name as NurseName
            from tohospital_assessment_form as a 
            left join users as b 
            on a.NurseID = b.UserID
            where a.SeekMedicalAdviceID = "${SeekMedicalAdviceID}"
            and AssessState = '入院前评估'
            order by FormTime ;`
            var API_questionnaire = await exec(sql12)
            for(API_questionnaire_i in API_questionnaire){
                API_questionnaire[API_questionnaire_i]["data"] = JSON.parse(API_questionnaire[API_questionnaire_i]["data"])
            }
            res.json({
                //治疗方案
                status:200,
                ruyuanLog:API_treatmentLog,
                API_questionnaire
            })
            }
                }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示该患者信息"
                        })
                      }
                }
                ruyuanlog();              
})

//获取某病人的最近的一次护理记录
router.post('/historylog/:pid', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        //console.log("asd")
        async function historylog() {
            var pid = req.params.pid
            try {
                    var sql = `select NursingRecord from tohospital_nurse_record where SeekMedicalAdviceID = ${pid}
                    order by NursingDate desc limit 1`
                    
                    var NursingRecord = await exec(sql)
                    //console.log(NursingRecord)
                    NursingRecord = JSON.parse(NursingRecord[0].NursingRecord)
                    res.json({
                        status:200,
                        API_nursingLog:NursingRecord
                    })
                    }catch(err) {
                        console.log(err)
                            res.json({
                                status:0,
                                msg:"查询失败"
                            })
                          }
                    }
                    historylog();      
})


//保存表单
router.post('/savetemplate/', 
passport.authenticate("jwt", { session: false }),
(req, res) => {
        //console.log("asd")
        async function savetemplate() {
            try {
                    var template_form = JSON.stringify(req.body.data)
                    var template_form_type = req.body.type
                    var sql1 = `select FormID from form where NurseID = '${req.user.UserID}' and FormName = '${template_form_type}'`
                    var FormID = await exec(sql1)
                    //如果表单已经存在，则更新，不存在则插入
                    if(FormID.length === 0){
                        var sql = `insert into form (FormContent,FormName,FormUploadTime,NurseID)
                        values ('${template_form}','${template_form_type}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${req.user.UserID}')`
                        await exec(sql)
                    }else{
                        var sql = `update form set FormContent = '${template_form}',
                        FormName = '${template_form_type}',
                        FormUploadTime = '${moment().format('YYYY-MM-DD HH:mm:ss')}'
                        where NurseID = '${req.user.UserID}' and FormName = '${template_form_type}'`
                        await exec(sql)
                    }
                    res.json({
                        status:200,
                        msg:"上传表单成功"
                    })
                    }catch(err) {
                        console.log(err)
                            res.json({
                                status:0,
                                msg:"上传失败"
                            })
                          }
                    }
                    savetemplate();      
})

//获取表单
router.post('/gettemplate', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        //console.log("asd")
        async function gettemplate() {
            try {
                    var template_form_type = req.body.type
                    var sql = `select FormContent as data,
                    FormName as type 
                    from form
                    where FormName = '${template_form_type}'
                    and NurseID = '${req.user.UserID}'`
                    var form = await exec(sql)
                    form[0].data = JSON.parse(form[0].data)
                    res.json({
                        status:200,
                        form:form[0]
                    })
                    }catch(err) {
                        console.log(err)
                            res.json({
                                status:0,
                                msg:"获取失败"
                            })
                          }
                    }
                    gettemplate();      
})


//获取护士下的患者离院列表
router.get('/historypatientlist', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {             
    async function historypatientlist() {
        // 同步写法
        /**
        {
            "API_toHospitalID": "202009188426", 
            "API_enddate": "2020-09-18 10:06:28", 
            "API_expert": "专家2", 
            "API_date": "2020-09-18 10:06:28", 
            "API_pid": 426, 
            "API_name": "zhangxiao"
        }
         */
        try {
            var sql = `select 
            a.SeekMedicalAdviceID as API_pid,
            b.PatientName as API_name,
            b.ToHospitalID as API_toHospitalID,
            b.ToHospitalDateTime as API_date,
            b.EndHospitalDateTime as API_enddate,
            c.Name as API_expert
            from seekmedical_after_treatment_nurse as a 
            left join seekmedicaladvice as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c 
            on b.CureDoctorID = c.UserID
            where a.RecommendNurseID = "${req.user.UserID}"
            and b.SeekMedicalState = "已完成"
            and b.ToHospitalAssessment = "1"
            and b.ToTreatmentlAssessment = "1"`
            var patientList = await exec(sql)
                res.json({
                    status:200,
                    patientList
                })       
        }catch(err) {
            console.log(err)
                    res.json({
                        status:0,
                        msg:"获取失败"
                    })
                }
        }
        historypatientlist();              
})

// //查询当日需要查房的患者
// router.get('/chafangList', 
// passport.authenticate("jwt", { session: false }), 
// (req, res) => {                 
//     async function chafangList() {
//         // 同步写法
//         try {
//             var sql = `select 
//             a.SeekMedicalAdviceID as API_pid,
//             a.PatientName as API_name,
//             a.ToHospitalDateTime as API_date,
//             a.ToHospitalNextChafangDate as API_nextChafangDateTime,
//             a.ToHospitalID as API_toHospitalID,
//             c.Name as API_expert
//             from seekmedicaladvice as a
//             left join seekmedical_after_treatment_nurse as b
//             on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
//             left join users as c 
//             on a.CureDoctorID = c.UserID
//             where b.RecommendNurseID = "${req.user.UserID}"
//             and a.ToHospitalAssessment = '1'
//             and a.ToTreatmentlAssessment = '1'
//             and a.SeekMedicalState != '已完成'
//             and a.ToHospitalNextChafangDate < "${moment().add(1, 'days').format('YYYY-MM-DD')}"
//             order by a.ToHospitalNextChafangDate`
//             var patientsList = await exec(sql)
//               res.json({
//                 status:200,
//                 patientsList
//               })
//         }catch(err) {
//             console.log(err)
//                 res.json({
//                     status:0,
//                     msg:"暂时无法显示"
//                 })
//             }
//     }
//     chafangList();  
// })

// //提交某次查房记录
// router.post('/chafanglog/:SeekMedicalAdviceID', 
// passport.authenticate("jwt", { session: false }), 
// (req, res) => {    
//     const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
//     //console.log(PatientID)    
//     /**
//      * {
//      *  toHospitalID:   ,//住院号
//      *  chafanglogs:   ,//查房记录
//      *  nextChafangTime::  下次查房时间,为空的话，自动默认三天
//      *  
//      * }
//      */      
//     async function chafanglog() {
//         // 同步写法
//         try {
//             //插入查房记录
//             var sql2 = `insert into tohospital_chafang 
//             (   SeekMedicalAdviceID,
//                 ToHospitalpatientID,
//                 ChafangDate,
//                 NextChafangDate,
//                 ChafangNurse,
//                 ChafangContent)
//             values 
//             (
//                 "${SeekMedicalAdviceID}",
//                 "${req.body.toHospitalID}",
//                 "${moment().format('YYYY-MM-DD HH:mm:ss')}",
//                 "${req.body.nextChafangTime || moment().add(3,'days').format('YYYY-MM-DD HH-mm-ss')}",
//                 "${req.user.UserID}",
//                 '${req.body.chafanglogs}'
//             );`
//             await exec(sql2)
//             var sql = `update seekmedicaladvice set ToHospitalNextChafangDate = "${req.body.nextChafangTime || moment().add(3,'days').format('YYYY-MM-DD HH-mm-ss')}"
//                 where SeekMedicalAdviceID = ${SeekMedicalAdviceID};`
//             await exec(sql)
//             res.json({
//                 status:200,
//                 msg:"提交成功"
//             })
//         }catch(err) {
//             console.log(err)
//                 res.json({
//                     status:0,
//                     msg:"提交失败"
//                 })
//                 }
//         }
//         chafanglog();              
// })

// //查询历史查房记录(未写)
// router.get('/chafangHistoryList', 
// passport.authenticate("jwt", { session: false }), 
// (req, res) => {                 
//     async function chafangHistoryList() {
//         // 同步写法
//         try {
//             var sql = `select 
//             a.SeekMedicalAdviceID as API_pid,
//             a.PatientName as API_name,
//             a.ToHospitalDateTime as API_date,
//             a.ToHospitalNextChafangDateTime as API_nextChafangDateTime ,
//             a.ToHospitalID as API_toHospitalID,
//             c.Name as API_expert
//             from seekmedicaladvice as a
//             left join seekmedical_after_treatment_nurse as b
//             on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
//             left join users as c 
//             on a.CureDoctorID = c.UserID
//             where b.RecommendNurseID = "${req.user.UserID}"
//             and a.ToHospitalAssessment = '1'
//             and a.SeekMedicalState != '已完成'
//             and a.ToTreatmentlAssessment = '1'
//             `
//             var patientsList = await exec(sql)
//               res.json({
//                 status:200,
//                 patientsList
//               })
//         }catch(err) {
//             console.log(err)
//                 res.json({
//                     status:0,
//                     msg:"暂时无法显示"
//                 })
//                 }
//         }
//         chafangHistoryList();  
// })


// 以下的接口为吴世龙写的查房相关接口

//查询护士当日需要查房的患者
router.get('/chafangList', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {  
    //console.log(moment().subtract(1, 'days').format('YYYY-MM-DD'))               
    async function chafangList() {
        // 同步写法
        try {
            //用户点击查询今日需要查房患者，返回今日和今日之前需要查房的患者列表
            /*var sql = `select RoleID from user_role where UserID = '${req.user.UserID}'`
            var info = await exec(sql);*/
            var sql1 = `select 
            a.SeekMedicalAdviceID as API_pid,
            a.PatientName as API_name,
            a.ToHospitalDateTime as API_date,
            a.ToHospitalNextChafangDate as API_nextChafangDateTime,
            a.tohospitalID as API_toHospitalID,
            a.DoctorName as API_expert from tohospital_chafang_patient a
            left join tohospital_chafang_nurse b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            where a.chuyuan = 0 and b.ChafangNurse = "${req.user.UserID}"
            and a.ToHospitalNextChafangDate < "${moment().endOf('day').format('YYYY-MM-DD HH:mm:ss')}"
            order by a.ToHospitalNextChafangDate`
            /*var sql1 = `select 
            a.SeekMedicalAdviceID as API_pid,
            a.PatientName as API_name,
            a.ToHospitalDateTime as API_date,
            a.ToHospitalNextChafangDate as API_nextChafangDateTime,
            a.tohospitalID as API_toHospitalID,
            c.Name as API_expert
            from seekmedicaladvice as a
            left join tohospital_chafang_nurse as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c 
            on a.CureDoctorID = c.UserID
            where b.ChafangNurse = "${req.user.UserID}"
            and HomeOrHospital = '1'
            and a.ToHospitalAssessment = '1'
            and a.SeekMedicalState != '已完成'
            and a.ToHospitalNextChafangDate < "${moment().endOf('day').format('YYYY-MM-DD HH:mm:ss')}"
            order by a.ToHospitalNextChafangDate`*/
              var chafangList = await exec(sql1)
              res.json({
                status:200,
                chafangList
              })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示"
                })
                }
        }
        chafangList();  
})

//查询历史查房记录
router.get('/chafangHistoryList', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function chafangHistoryList() {
        // 同步写法
        try {
            if(req.user.UserID==null){
                return res.json({
                    msg:"错误"
                })
            }
            //医生或者护士点击历史查房记录，返回该医生或护士的历史查房信息
            //返回的是患者为在医院住院的,且已经有过查房记录的
            //且不在今天查房列表的
            var sql = `select distinct 
            a.SeekMedicalAdviceID as API_pid,
            a.PatientName as API_name,
            a.ToHospitalDateTime as API_date,
            a.ToHospitalNextChafangDate as API_nextChafangDateTime ,
            a.ToHospitalID as API_toHospitalID,
            a.DoctorName as API_expert
            from tohospital_chafang_patient as a
            left join tohospital_chafang_nurse as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join tohospital_chafang_record as t
            on a.SeekMedicalAdviceID = t.SeekMedicalAdviceID
            where b.ChafangNurse = "${req.user.UserID}"
            and chuyuan = 0
            and t.date <"${moment().format('YYYY-MM-DD HH:mm:ss')}"
            and a.SeekMedicalAdviceID not in(
                select 
                a.SeekMedicalAdviceID
                from tohospital_chafang_patient a
                left join tohospital_chafang_nurse b
                on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
                where a.chuyuan = 0 and b.ChafangNurse = "${req.user.UserID}"
                and a.ToHospitalNextChafangDate < "${moment().endOf('day').format('YYYY-MM-DD HH:mm:ss')}"
                order by a.ToHospitalNextChafangDate 
            )`
            /*var sql = `select distinct 
            a.SeekMedicalAdviceID as API_pid,
            a.PatientName as API_name,
            a.ToHospitalDateTime as API_date,
            a.ToHospitalNextChafangDate as API_nextChafangDateTime ,
            a.ToHospitalID as API_toHospitalID,
            c.Name as API_expert
            from seekmedicaladvice as a
            left join tohospital_chafang_nurse as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c 
            on a.CureDoctorID = c.UserID
            left join tohospital_chafang_record as t
            on a.SeekMedicalAdviceID = t.SeekMedicalAdviceID
            where b.ChafangNurse = "${req.user.UserID}"
            and a.ToHospitalAssessment = '1'
            and a.SeekMedicalState != '已完成'
            and t.date <"${moment().format('YYYY-MM-DD HH:mm:ss')}"
            and a.SeekMedicalAdviceID not in
            (
                select 
            a.SeekMedicalAdviceID
            from seekmedicaladvice as a
            left join tohospital_chafang_nurse as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c 
            on a.CureDoctorID = c.UserID
            where b.ChafangNurse = "${req.user.UserID}"
            and a.ToHospitalAssessment = '1'
            and a.SeekMedicalState != '已完成'
            and a.ToHospitalNextChafangDate < "${moment().endOf('day').format('YYYY-MM-DD HH:mm:ss')}"
            order by a.ToHospitalNextChafangDate
            )`*/
            var HistoryList = await exec(sql)
              res.json({
                status:200,
                HistoryList
              })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示"
                })
                }
        }
        chafangHistoryList();  
})

//提交查房详细表
router.post('/chafangRecord/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {  
    //console.log(req)
    /**查房记录表的详细信息
     * 神经内科护理记录
     * 前端传递的表格是护士对表格上信息的勾选
     *  req.body.form
     * 
     * 
     */    
    var SeekMedicalAdviceID  = req.params.SeekMedicalAdviceID;
    //console.log("======="+SeekMedicalAdviceID)
    //var form = JSON.stringify(req.body.form)  
    var form = req.body.form;  
    //console.log(form)
    //console.log(new Date())
    //console.log(form.nextChafangTime)
    //console.log(moment(new Date(form.nextChafangTime)).format('YYYY-MM-DD HH:mm:ss'))
    if(form.nextChafangTime!=null){
        form.nextChafangTime = moment(new Date(form.nextChafangTime)).format('YYYY-MM-DD HH:mm:ss')
    }else{
        form.nextChafangTime = moment().add(3,'days').format('YYYY-MM-DD HH-mm-ss')
    } 
    if(form.spo2==null){//提交的信息有误
        return res.json({
            msg:'提交的信息存在问题'
        })
    }   
    async function chafangRecord() {
        // 同步写法
        try {
            //医生或者护士点击历史查房记录，返回该医生或护士的历史查房信息
            //返回的是患者为在医院住院的,且已经有过查房记录的
            var sql = `insert into tohospital_chafang_record
            (
                ChafangNurse,
                date,
                spo2,
                bed,
                skin,
                ruliang,
                jili,
                fanshenwowei,
                nextChafangTime,
                shifouyueshu,
                yijian,
                SeekMedicalAdviceID,
                T,
                P,
                HR,
                R,
                BP,
                dabian,
                xiaobian,
                myleft,
                myright,
                yishi
            )
            values
            (
                "${req.user.UserID}",
                "${moment().format('YYYY-MM-DD HH:mm:ss')}",
                "${form.spo2}",
                "${form.bed}",
                "${form.skin}",
                "${form.ruliang}",
                "${form.jili}",
                "${form.fanshenwowei}",
                "${form.nextChafangTime}",
                "${form.shifouyueshu}",
                "${form.yijian}",
                "${SeekMedicalAdviceID}",
                "${form.T}",
                "${form.P}",
                "${form.HR}",
                "${form.R}",
                "${form.BP}",
                "${form.dabian}",
                "${form.xiaobian}",
                "${form.myleft}",
                "${form.myright}",
                "${form.yishi}"
                
            )`
            var sql1 = `update seekmedicaladvice set ToHospitalNextChafangDate=
            "${form.nextChafangTime}" where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"`
            await exec(sql1)//更新就诊表中的下次就诊时间
            var sql2 = `update tohospital_chafang_patient set ToHospitalNextChafangDate=
            "${form.nextChafangTime}" where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"`
            await exec(sql2)
            var patientsList = await exec(sql)
              res.json({
                status:200,
                msg:"提交成功"
              })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示"
                })
                }
        }
        chafangRecord();
})



//获取某患者的查房记录  只返回查房时间
router.get('/chafangRecordList/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {  
    /**chafangRecordList
     * 查看患者的查房记录
     * 
     */    
    var SeekMedicalAdviceID  = req.params.SeekMedicalAdviceID;
    //var form = JSON.stringify(req.body.form)        
    async function chafangRecord() {
        // 同步写法
        try {
            //医生或者护士点击历史查房记录，返回该医生或护士的历史查房信息
            //返回的是患者为在医院住院的,且已经有过查房记录的
            /*var sql = `select PatientName,chafangID,ChafangNurse,date
            from tohospital_chafang_record t left join seekmedicaladvice s
            on t.SeekMedicalAdviceID = s.SeekMedicalAdviceID
            where t.SeekMedicalAdviceID = '${req.params.SeekMedicalAdviceID}'`*/
            var sqll = `select RoleID from user_role where UserID ="${req.user.UserID}"`
            var info = await exec(sqll)
            if(info[0].RoleID==40){//医生
                //console.log("医生")
                var sql = `select t.date,t.chafangID from tohospital_chafang_record t
                left join tohospital_chafang_nurse tcn on t.ChafangNurse = tcn.ChafangNurse
                and t.SeekMedicalAdviceID = tcn.SeekMedicalAdviceID
                where tcn.doctorID = "${req.user.UserID}" and 
                t.SeekMedicalAdviceID = "${req.params.SeekMedicalAdviceID}"`
                var chafangRecordListDate = await exec(sql)
            }else{//查房护士
                var sql = `select date,chafangID from tohospital_chafang_record
                where SeekMedicalAdviceID = '${req.params.SeekMedicalAdviceID}'
                and ChafangNurse = "${req.user.UserID}"`
                var chafangRecordListDate = await exec(sql)
            }
              res.json({
                status:200,
                chafangRecordListDate
              })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示"
                })
                }
        }
        chafangRecord();  
})

//获取某患者某次的详细查房记录
router.get('/chafangOneRecord/:chafangID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {  
    /**
     * 查看某患者某次的详细查房记录
     */    
    //var SeekMedicalAdviceID  = req.params.SeekMedicalAdviceID;
    //var form = JSON.stringify(req.body.form)        
    async function chafangOneRecord() {
        // 同步写法
        try {
            //医生或者护士点击历史查房记录，返回该医生或护士的历史查房信息
            //返回的是患者为在医院住院的,且已经有过查房记录的
            var sql = `select date,spo2,bed,skin,ruliang,
            jili,fanshenwowei,nextChafangTime,shifouyueshu,yijian,
            P,HR,R,T,BP,myleft,myright,xiaobian,dabian,yishi
            from tohospital_chafang_record t left join tohospital_chafang_patient s
            on t.SeekMedicalAdviceID = s.SeekMedicalAdviceID
            where t.chafangID = "${req.params.chafangID}"
            and s.chuyuan = 0`
            var oneRecord = await exec(sql)
            oneRecord=oneRecord[0]
              res.json({
                status:200,
                oneRecord
              })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示"
                })
                }
        }
        chafangOneRecord();  
})

//获取某患者的负责医生或护士 加远程查房的医生 表seekmedical_after_treatment_doctor
router.get('/chafangDoctor/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {  
    /**
     * 查看某患者的负责人
     */    
    var SeekMedicalAdviceID  = req.params.SeekMedicalAdviceID;
    //var form = JSON.stringify(req.body.form)        
    async function chafangDoctor() {
        // 同步写法
        try {
            //远程查房的医生
            var sql = `select distinct u.UserID,u.Name,u.Image,u.Phone
            from  seekmedical_after_treatment_doctor sa left join users u
            on sa.RecommendDoctorID = u.UserID 
            where sa.SeekMedicalAdviceID = "${SeekMedicalAdviceID}"`
            /*var sql1 = `select distinct u.UserID,u.Name,u.Image,u.Phone,sa.RecommendNurseName
            from  seekmedical_after_treatment_nurse sa left join users u
            on sa.RecommendNurseID = u.UserID 
            where sa.SeekMedicalAdviceID = "${SeekMedicalAdviceID}"`*/
            //查房护士
            var sql1 = `select distinct u.UserID,u.Name,u.Image,u.Phone
            from tohospital_chafang_nurse t left join users u
            on t.ChafangNurse = u.UserID
            where t.SeekMedicalAdviceID = "${SeekMedicalAdviceID}"
            `
            var sql2 = `select distinct u.UserID,u.Name,u.Image,u.Phone
            from tohospital_chafang_patient t left join users u
            on t.DoctorID = u.UserID
            where t.SeekMedicalAdviceID = "${SeekMedicalAdviceID}"`
            var ycDocterList = await exec(sql)
            var hushiList = await exec(sql1)
            var doctor = await exec(sql2)
            /*if(docterList[0].RoleID==20){
                docterList[0].RoleID="护士"
            }else{
                docterList[0].RoleID="医生"
            }*/
            //docterList=docterList[0]
              res.json({
                status:200,
                doctor,
                ycDocterList,
                hushiList
              })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示"
                })
                }
        }
        chafangDoctor();  
})

//医生对护士或者医生发起查房预约申请
router.post('/appointment', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {  
    /**
     * {
     * 本地0 不需要同意
     * 远程1 需要同意
     * SeekMedicalAdviceID,//患者就诊ID
     * reserveTime,//查房时间
     * docIds//医生ID数组
     * nurIds
     * }
     */            
    async function appointment() {
        // 同步写法
        try {
            var obj = req.body.obj
            //console.log(obj)
            var docIds = obj.docIds
            var nurIds = obj.nurIds
            var reserveTime = moment(new Date(obj.reserveTime)).format('YYYY-MM-DD HH:mm:ss')
            //console.log(req.user.role)
            
            if(obj.flag=="0"){//本地医生向远程医生以及查房护士预约查房  不需要同意
                for (let index = 0; index < docIds.length; index++) {
                    const element = docIds[index];
                    // appointmentUser = 0 本地医生发起的
                    // appointmentUser = 1 远程医生发起的
                    // dorn = 1 代表 ChafangNurse是收到预约的是医生
                    var sql = `insert into tohospital_chafang_appointment
                (ChafangNurse,doctorID,SeekMedicalAdviceID,flag,reserveTime,appointmentUser,dorn)
                values(
                    "${element}",
                    "${req.user.UserID}",
                    "${obj.SeekMedicalAdviceID}",
                    "0",
                    "${reserveTime}",
                    "0",
                    "1"
                )`
                await exec(sql)
                }

                for (let index = 0; index < nurIds.length; index++) {
                    const element = nurIds[index];
                    var sql = `insert into tohospital_chafang_appointment
                (ChafangNurse,doctorID,SeekMedicalAdviceID,flag,reserveTime,appointmentUser,dorn)
                values(
                    "${element}",
                    "${req.user.UserID}",
                    "${obj.SeekMedicalAdviceID}",
                    "0",
                    "${reserveTime}",
                    "0",
                    "0"
                )`
                await exec(sql)
                }
            }else{//远程医生向本地医生以及查房护士发起预约 需要同意
                for (let index = 0; index < docIds.length; index++) {
                    const element = docIds[index];
                    // appointmentUser = 0 本地医生发起的
                    // appointmentUser = 1 远程医生发起的
                    // dorn = 1 代表 ChafangNurse是收到预约的是医生
                    var sql = `insert into tohospital_chafang_appointment
                (ChafangNurse,doctorID,SeekMedicalAdviceID,flag,reserveTime,appointmentUser,dorn)
                values(
                    "${element}",
                    "${req.user.UserID}",
                    "${obj.SeekMedicalAdviceID}",
                    "0",
                    "${reserveTime}",
                    "1",
                    "1"
                )`
                await exec(sql)
                }

                for (let index = 0; index < nurIds.length; index++) {
                    const element = nurIds[index];
                    var sql = `insert into tohospital_chafang_appointment
                (ChafangNurse,doctorID,SeekMedicalAdviceID,flag,reserveTime,appointmentUser,dorn)
                values(
                    "${element}",
                    "${req.user.UserID}",
                    "${obj.SeekMedicalAdviceID}",
                    "0",
                    "${reserveTime}",
                    "1",
                    "0"
                )`
                await exec(sql)
                }
            }
              res.json({
                status:200,
                msg:'预约成功'
              })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"预约失败"
                })
                }
        }
        appointment();  
})

//医生或者护士查看自己收到的预约查房列表
router.get('/myAppointment', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {      
    //var form = JSON.stringify(req.body.form)        
    async function myAppointment() {
        // 同步写法
        try {
            //查询发起查房用户的角色
            /* sqll = `select RoleID from user_role where UserID = '${req.user.UserID}'`
            var info = await exec(sqll)
            if(info[0].RoleID==40){//医生的预约 是护士发起的
            //住院号、姓名、预约时间、诊断专家
            //返回的是就今天及之后的预约查房
            //moment().startOf('day').format('YYYY-MM-DD HH:mm:ss'获取当天零点的时间
            //console.log("123")
                var sql = `select 
            a.SeekMedicalAdviceID as API_pid,
            a.PatientName as API_name,
            t.reserveTime,
            a.ToHospitalID as API_toHospitalID,
            c.Name as API_expert
            from seekmedicaladvice as a
            left join users as c 
            on a.CureDoctorID = c.UserID
            left join tohospital_chafang_appointment t
            on a.SeekMedicalAdviceID = t.SeekMedicalAdviceID
            where t.doctorID = "${req.user.UserID}"
            and t.flag='0'
            and t.appointmentUser='0'
            and reserveTime > "${moment().startOf('day').format('YYYY-MM-DD HH:mm:ss')}"`
            }else{//护士的预约 是医生发起的
                var sql = `select 
            a.SeekMedicalAdviceID as API_pid,
            a.PatientName as API_name,
            t.reserveTime,
            a.ToHospitalID as API_toHospitalID,
            c.Name as API_expert
            from seekmedicaladvice as a
            left join users as c 
            on a.CureDoctorID = c.UserID
            left join tohospital_chafang_appointment t
            on a.SeekMedicalAdviceID = t.SeekMedicalAdviceID
            where t.ChafangNurse = "${req.user.UserID}"
            and t.flag='0'
            and t.appointmentUser='1'
            and reserveTime > "${moment().startOf('day').format('YYYY-MM-DD HH:mm:ss')}"`
            }*/
            //住院号、姓名、预约时间、诊断专家
            //返回的是就今天及之后的预约查房
            //moment().startOf('day').format('YYYY-MM-DD HH:mm:ss'获取当天零点的时间
            //console.log("123")
            //我发起的预约
            //本地医生 预约护士或者预约远程医生 不用同意 所有数据显示 t.appointmentUser = 0
            //远程医生 预约护士 不需要同意 所有数据显示 t.appointmentUser = 1 and t.dorn = 0
            //远程医生 预约本地医生 需要同意 显示部分数据 t.appointmentUser = 1 and t.dorn = 1 and t.flag = 1
            var sql = `select distinct
            a.SeekMedicalAdviceID as API_pid,
            a.patientName as API_name,
            t.reserveTime,
            a.tohospitalID as API_toHospitalID,
            c.Name as API_expert
            from tohospital_chafang_patient as a
            left join users as c 
            on a.doctorID = c.UserID
            left join tohospital_chafang_appointment t
            on a.SeekMedicalAdviceID = t.SeekMedicalAdviceID
            where t.doctorID = "${req.user.UserID}" 
            and ((t.appointmentUser = 0) or (t.appointmentUser = 1 and t.dorn = 1 and t.flag = 1))
            and reserveTime > "${moment().startOf('day').format('YYYY-MM-DD HH:mm:ss')}"`
            var myappointmentList = await exec(sql)

            var sqll = `select RoleID from user_role where UserID = '${req.user.UserID}'`
            var info = await exec(sqll)
            if(info[0].RoleID==40){//医生收到的预约
                //我接受的预约 就是我已经同意了的
            var sqlll = `select distinct
            a.SeekMedicalAdviceID as API_pid,
            a.patientName as API_name,
            t.reserveTime,
            a.tohospitalID as API_toHospitalID,
            c.Name as API_expert
            from tohospital_chafang_patient as a
            left join users as c 
            on a.doctorID = c.UserID
            left join tohospital_chafang_appointment t
            on a.SeekMedicalAdviceID = t.SeekMedicalAdviceID
            where t.ChafangNurse = "${req.user.UserID}"
            and ((t.flag = 1 and t.appointmentUser = 1) or (t.appointmentUser = 0))
            and reserveTime > "${moment().startOf('day').format('YYYY-MM-DD HH:mm:ss')}"`
            }else{
                //护士 我接受的预约
            var sqlll = `select distinct
            a.SeekMedicalAdviceID as API_pid,
            a.patientName as API_name,
            t.reserveTime,
            a.tohospitalID as API_toHospitalID,
            c.Name as API_expert
            from tohospital_chafang_patient as a
            left join users as c 
            on a.doctorID = c.UserID
            left join tohospital_chafang_appointment t
            on a.SeekMedicalAdviceID = t.SeekMedicalAdviceID
            where t.ChafangNurse = "${req.user.UserID}"
            and reserveTime > "${moment().startOf('day').format('YYYY-MM-DD HH:mm:ss')}"`
            }
            
            var appointmentListMy = await exec(sqlll)
            //console.log(appointmentList)
            //myappointmentList.push(appointmentListMy)
            for( i = 0;i<appointmentListMy.length;i++){
                var element = appointmentListMy[i]
                myappointmentList.push(element)
            }
              res.json({
                status:200,
                myappointmentList,
                //appointmentListMy
              })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"查询失败"
                })
                }
        }
        myAppointment();  
})

//查房申请 就是远程医生向本地医生的查房预约
router.get('/chafangApply', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function applylist() {
        // 同步写法
        try {

            var sql = `select a.SeekMedicalAdviceID as API_pid,
            a.tohospitalID as API_toHospitalID,a.patientName as API_name,
            a.DoctorName as API_expert,t.reserveTime 
            from tohospital_chafang_patient as a 
            left join tohospital_chafang_appointment t
            on a.SeekMedicalAdviceID = t.SeekMedicalAdviceID
            where t.ChafangNurse = "${req.user.UserID}"
            and t.appointmentUser = 1 and t.dorn = 1 and t.flag = 0`
            var chafangApplyList = await exec(sql)
            console.log(chafangApplyList.length)
            //console.log(API_patientsList)
              res.json({
                status:200,
                chafangApplyList
              })
              }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示"
                        })
                      }
                }
                applylist();  
})

//本地医生同意远程医生的查房预约 
router.post('/chafangApplyDeal', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function applylist() {
        // 同步写法
        try {
            var SeekMedicalAdviceID = req.body.pid
            var sql = `update tohospital_chafang_appointment set flag = 1
            where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"
            and ChafangNurse = "${req.user.UserID}"
            and appointmentUser = 1 and dorn = 1`
            await exec(sql)
            //console.log(chafangApplyList.length)
            //console.log(API_patientsList)
              res.json({
                status:200,
                msg:"成功"
              })
              }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"失败"
                        })
                      }
                }
                applylist();  
})

//获取医院住院申请列表
router.get('/doctorApplylist', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function applylist() {
        // 同步写法
        try {
            //   //查询今日患者内容
            //   var sql1 = `r
            //   select 
            //   b.SeekMedicalAdviceID as pid,
            //   b.MedicalAdviceApplicationDateTime as API_date,
            //   b.PatientName as API_name,
            //   a.Name as API_expert
            //   from seekmedicaladvice as b left join users as a on a.UserID = b.CureDoctorID  where b.RecommendDoctorID = "${req.user.UserID}" 
            //   order by b.MedicalAdviceApplicationDateTime desc
            //   `
            //   var API_patientsList = await exec(sql1)
            //console.log("9999")
            var sql = `select distinct
            a.SeekMedicalAdviceID as API_pid,
            b.PatientName as API_name,
            b.MedicalAdviceApplicationDateTime as API_date,
            b.ToHospitalID as API_toHospitalID,
            c.Name as API_expert
            from seekmedical_after_treatment_doctor as a 
            left join seekmedicaladvice as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c 
            on b.CureDoctorID = c.UserID
            where a.RecommendDoctorID = "${req.user.UserID}"
            and b.ToHospitalAssessment = "1"
            and b.ToTreatmentlAssessment = "0"
            and b.SeekMedicalState != "已完成"
            and HomeOrHospital = 1`
            var patientsList = await exec(sql)
            //console.log(API_patientsList)
              res.json({
                status:200,
                patientsList
              })
              }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示"
                        })
                      }
                }
                applylist();  
})

//查询该医生患者列表
router.get('/docPatientlist', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function patientlist() {
        //console.log("---")
        // 同步写法
        try {
            var sqll = `select Name from users where UserID = "${req.user.UserID}"`
            var name = await exec(sqll);
            //查询该医生的患者列表 是医院住院的患者
            var sql = `select t.ToHospitalID,s.PatientName,s.ToHospitalDateTime,
            t.flag,t.SeekMedicalAdviceID as pid from tohospital_chafang_patient t
            left join seekmedicaladvice s on t.SeekMedicalAdviceID = s.SeekMedicalAdviceID
            where t.DoctorID = "${req.user.UserID}"
            and t.chuyuan = 0`
            var info = await exec(sql);
            info.forEach(element => {
                if(element.flag === 0){
                    element.flag = "未处理"
                }else{
                    element.flag = "已处理"
                }
                element.DoctorName = name[0].Name
            });
            res.json({
                status:200,
                msg:info
            })
        }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示"
                        })
                      }
                }
                patientlist();  
})

//医生获取自己医院住院护士列表
router.get('/zhuyuanNurse', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function applylist() {
        // 同步写法
        try {
            var sql = `select u.UserID,u.Name,u.Image,u.Phone from users u left join 
            user_role ur on u.UserID = ur.UserID where ur.RoleID = '21'
            and HospitalID = (
                select HospitalID from users
                where UserID = '${req.user.UserID}'
            )`
            var nurseList = await exec(sql)
            //console.log(API_patientsList)
              res.json({
                status:200,
                nurseList
              })
              }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示"
                        })
                      }
                }
                applylist();  
})

//医生给护士分配患者
router.post('/distribution', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function distribution() {
        // 同步写法
        /**
         * {pid,
         * nurId}
         */
        try {
            var obj = req.body.obj
            console.log(obj)
            var nurId = obj.nurId
            for (let index = 0; index < nurId.length; index++) {
                const element = nurId[index];
                var sql = `insert into tohospital_chafang_nurse
            (ChafangNurse,doctorID,date,SeekMedicalAdviceID,flag)
            values
            ("${element}","${req.user.UserID}","${moment().format('YYYY-MM-DD HH:mm:ss')}",
            "${obj.pid}",'0')`
             await exec(sql)
            }
            //更新患者状态为住院,更新患者下次查房时间,将患者设为医院住院
            var sqll = `update seekmedicaladvice set ToTreatmentlAssessment = "1",
            ToHospitalNextChafangDate = "${moment().format('YYYY-MM-DD HH:mm:ss')}",
            HomeOrHospital = "1"
            where SeekMedicalAdviceID = ${obj.pid};`
            await exec(sqll)
            //console.log(API_patientsList)
              res.json({
                status:200,
                msg:"分配成功"
              })
              }catch(err) {
                    console.log(err)
                        res.json({
                            status:0,
                            msg:"分配失败"
                        })
                      }
                }
                distribution();  
})

//医院住院患者结束治疗出院
router.post('/endtreatment/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    //console.log(req.body)          
    async function endtreatment() {
        var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID 
        // 同步写法
        /**
         {
            diagResult: "",   //出院记录
            treatLogs: "",    //治疗记录
            notes: "西药治疗",   //医嘱
            API_prescription: [
                {
                    API_drugsName: "含曲林片",
                    API_drugsNumberUnits: "盒",
                    API_drugsNumber: "2",
                    API_drugsUsage: "一次两粒",
                    API_useFrequency: "一天一次",
                    API_useTime: "饭后",
                    API_isEditable: false,
                    API_days: "7"
                }
            ]
        },
         */
        try {
                //获取下一次的随访时间
                suifangTime = formatDate(req.body.suifangTime)
                //插入诊断结论
                var sql3 = `insert into treatment 
                (TreatmentDescription,TreatmentResults,TreatmentPhase,TreatmentDateTime,SeekMedicalAdviceID,DoctorID) 
                values
                ("${req.body.notes}","${req.body.treatLogs}","出院后治疗",'${moment().format('YYYY-MM-DD HH:mm:ss')}',"${SeekMedicalAdviceID}","${req.user.UserID}") `
                var inserttreatment =  await exec(sql3)
                var API_prescription = req.body.prescription 
                //添加处方记录
                add_Prescription(inserttreatment.insertId,API_prescription)
                //添加医生确认出院的记录
                var sql10 = `update seekmedicaladvice set 
                SeekMedicalState = "已完成",
                EndDiagResult = "${req.body.diagResult}",
                EndDiagNotes = "${req.body.notes}",
                EndHospitalDateTime = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                EndHospitaNextlFollowDateTime = '${suifangTime}'
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
                await exec(sql10)

                //向住院表里面添加出院信息（新加的表tohospital）
                var sql11 = `update tohospital set 
                ToHospitalState = "已出院",
                EndDiagResult = "${req.body.diagResult}",
                EndDiagNotes = "${req.body.notes}",
                EndHospitalDateTime = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                EndHospitaNextlFollowDateTime = '${suifangTime}'
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
                await exec(sql11)
                //更新tohospital_chafang_patient表 患者的出院状态
                var sql123 = `update tohospital_chafang_patient set chuyuan = 1,
                EndHospitalDateTime = "${moment().format('YYYY-MM-DD HH:mm:ss')}"
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}'`
                await exec(sql123)
                //向负责医生发送成功出院通知
                var sql1 = `select DoctorID from tohospital_chafang_patient
                where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
                var doctorlist =  await exec(sql1)
                for(doctorlist_i in doctorlist){
                    var res_obj = {
                        toid:doctorlist[doctorlist_i].RecommendDoctorID,
                        fromid: req.user.UserID
                    }
                    socket.emit("confirm_endhospital",res_obj)
                }
                //向护士发送出院通知
                /*var sql1 = `select RecommendNurseID from seekmedical_after_treatment_nurse
                where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
                var nurselist =  await exec(sql1)
                for(nurselist_i in nurselist){
                    var res_obj = {
                        toid:nurselist[nurselist_i].RecommendNurseID,
                        fromid: req.user.UserID
                    }
                    socket.emit("confirm_endhospital",res_obj)
                }*/
                //向患者发送出院通知
                var sql1 = `select PatientID from seekmedicaladvice
                where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
                var PatientID =  await exec(sql1)
                var res_obj = {
                    toid: PatientID[0].PatientID,
                    fromid: req.user.UserID
                }
                socket.emit("confirm_endhospital",res_obj)
                res.json({
                    status:200,
                    msg:"出院记录成功"
                })
        }catch(err) {
                    console.log(err)
                    res.json({
                        status:0,
                        msg:"出院记录失败"
                    })
                }
        }
    endtreatment();              
})

//获取医生的住院患者出院列表
router.get('/yShistorypatientlist', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {             
    async function historypatientlist() {
        // 同步写法
        /**
        {
            "API_toHospitalID": "202009188426", 
            "API_enddate": "2020-09-18 10:06:28", 
            "API_expert": "专家2", 
            "API_date": "2020-09-18 10:06:28", 
            "API_pid": 426, 
            "API_name": "zhangxiao"
        }
         */
        try {
            var sql = `select distinct
            a.SeekMedicalAdviceID as API_pid,
            b.PatientName as API_name,
            b.ToHospitalID as API_toHospitalID,
            b.ToHospitalDateTime as API_date,
            b.EndHospitalDateTime as API_enddate,
            b.DoctorName as API_expert
            from seekmedical_after_treatment_doctor a left join
            tohospital_chafang_patient b on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            where b.chuyuan = 1 and a.RecommendDoctorID = "${req.user.UserID}"`

            var sqll = `select distinct
            b.SeekMedicalAdviceID as API_pid,
            b.PatientName as API_name,
            b.ToHospitalID as API_toHospitalID,
            b.ToHospitalDateTime as API_date,
            b.EndHospitalDateTime as API_enddate,
            b.DoctorName as API_expert
            from tohospital_chafang_patient b
            where b.chuyuan = 1 and b.DoctorID = "${req.user.UserID}"`
            /*var sql = `select distinct
            a.SeekMedicalAdviceID as API_pid,
            b.PatientName as API_name,
            b.ToHospitalID as API_toHospitalID,
            b.ToHospitalDateTime as API_date,
            b.EndHospitalDateTime as API_enddate,
            c.Name as API_expert
            from seekmedical_after_treatment_doctor as a 
            left join seekmedicaladvice as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c 
            on b.CureDoctorID = c.UserID
            where a.RecommendDoctorID = "${req.user.UserID}"
            and b.SeekMedicalState = "已完成"
            and b.ToHospitalAssessment = "1"
            and b.ToTreatmentlAssessment = "1"
            and b.HomeOrHospital = "1"`*/
            var patientList = await exec(sql)
            var ss = await exec(sqll)
            for(element in ss){
                patientList.push(element)
            }
            
                res.json({
                    status:200,
                    patientList
                })       
        }catch(err) {
            console.log(err)
                    res.json({
                        status:0,
                        msg:"获取失败"
                    })
                }
        }
        historypatientlist();              
})

//获取住院护士下的患者离院列表
router.get('/zYhistorypatientlist', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {             
    async function historypatientlist() {
        // 同步写法
        /**
        {
            "API_toHospitalID": "202009188426", 
            "API_enddate": "2020-09-18 10:06:28", 
            "API_expert": "专家2", 
            "API_date": "2020-09-18 10:06:28", 
            "API_pid": 426, 
            "API_name": "zhangxiao"
        }
         */
        try {
            //tohospital_chafang_nurse
            var sql = `select distinct
            a.SeekMedicalAdviceID as API_pid,
            b.PatientName as API_name,
            b.ToHospitalID as API_toHospitalID,
            b.ToHospitalDateTime as API_date,
            b.EndHospitalDateTime as API_enddate,
            b.DoctorName as API_expert
            from tohospital_chafang_nurse a left join
            tohospital_chafang_patient b on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            where b.chuyuan = 1 and a.ChafangNurse = "${req.user.UserID}"`
            /*var sql = `select distinct
            a.SeekMedicalAdviceID as API_pid,
            b.PatientName as API_name,
            b.ToHospitalID as API_toHospitalID,
            b.ToHospitalDateTime as API_date,
            b.EndHospitalDateTime as API_enddate,
            c.Name as API_expert
            from tohospital_chafang_record as a 
            left join seekmedicaladvice as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c 
            on b.CureDoctorID = c.UserID
            where a.ChafangNurse = "${req.user.UserID}"
            and b.SeekMedicalState = "已完成"
            and b.ToHospitalAssessment = "1"
            and b.ToTreatmentlAssessment = "1"
            and b.HomeOrHospital = "1"`*/
            var historypatientlist = await exec(sql)
                res.json({
                    status:200,
                    historypatientlist
                })       
        }catch(err) {
            console.log(err)
                    res.json({
                        status:0,
                        msg:"获取失败"
                    })
                }
        }
        historypatientlist();              
})

//获取病人的详细信息
router.get('/patientDetail/:pid', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {             
    async function patientDetail() {
       
        try {
            var sql = `select patientName,gender,
            birthday,telephone,Address,tohospitalID from tohospital_chafang_patient
            where SeekMedicalAdviceID = "${req.params.pid}"`
            var patient = await exec(sql)
            res.json({
                status:200,
                patient:patient
            })    
        }catch(err) {
            console.log(err)
                    res.json({
                        status:0,
                        msg:"获取失败"
                    })
                }
        }
        patientDetail();              
})

//医生添加住院病人
router.post('/addPatient', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {             
    async function addPatient() {
        // 同步写法
        /**
        newPatient: {
        name: "",
        gender: "",
        birthday: "",
        tel: "",
        IdCard: "",
        address: "",
      }
         */
        try {
            var personInfo = req.body.newPatient
            personInfo.birthday = moment(new Date(personInfo.birthday)).format('YYYY-MM-DD HH:mm:ss')
            //console.log(personInfo)
            //医生添加患者
            //在就诊表中 生成一条记录 需要一个 SeekMedicalAdviceID
            //是住院状态
            var sql = `
                insert into seekmedicaladvice (
                    GUID,
                    PatientName,
                    SeekMedicalAdviceStatus,
                    ToHospitalAssessment,
                    ToTreatmentlAssessment,
                    SeekMedicalState,
                    GroupConsultationState,
                    HomeOrHospital,
                    ToHospitalDateTime,
                    ToHospitalNextChafangDate,
                    CureDoctorID) 
                    values
                    ((UUID()),
                    '${personInfo.name}',
                    "已完成",
                    "1",
                    "1",
                    "未完成",
                    '3',
                    "1",
                    "${moment().format('YYYY-MM-DD HH:mm:ss')}",
                    "${moment().add(3,'days').format('YYYY-MM-DD HH:mm:ss')}",
                    "${req.user.UserID}"
                    )
                `
            var info = await exec(sql);
            //SeekMedicalAdviceID = info.insertId
            var ToHospitalID = moment().format('YYYYMMDD') + Math.floor(Math.random() * 10) + info.insertId
            var sql1 = `insert into tohospital_chafang_patient(
                patientName,
                gender,
                birthday,
                telephone,
                IdentityID,
                Address,
                DoctorID,
                tohospitalID,
                SeekMedicalAdviceID,
                ToHospitalDateTime,
                DoctorName,
                ToHospitalNextChafangDate
            )
            values(
                "${personInfo.name}",
                "${personInfo.gender}",
                "${personInfo.birthday}",
                "${personInfo.tel}",
                "${personInfo.IdCard}",
                "${personInfo.address}",
                "${req.user.UserID}",
                "${ToHospitalID}",
                "${info.insertId}",
                "${moment().format('YYYY-MM-DD HH:mm:ss')}",
                "${req.user.Name}",
                "${moment().format('YYYY-MM-DD HH:mm:ss')}"
            )
            `
            await exec(sql1)
            res.json({
                status:200,
                msg:"添加成功"
            })    
        }catch(err) {
            console.log(err)
                    res.json({
                        status:0,
                        msg:"添加失败"
                    })
                }
        }
        addPatient();              
})

//医生为住院病人录入病人信息
router.post('/addInfo', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {             
    async function addInfo() {
        //console.log("addInfo")
        //console.log(req.body.BingLi.API_after[0].doctors)
        
        // 同步写法
       var BingLi = req.body.BingLi
       var SeekMedicalAdviceID = BingLi.pid 
       //console.log("addInfo")
       //console.log(BingLi)
       //console.log("history")
       //console.log(BingLi.history)
        try {
            //console.log("addInfo")
            //console.log(req.body)
            //添加症状
            add_symptom(BingLi.state,SeekMedicalAdviceID,req.user.UserID)
            //添加历史病历
            console.log(BingLi.history)
            var sqql = `insert into patient_history(AllergyHistory,FamilyHistory,PatientHistory,SeekMedicalAdviceID)
            values
            ("${BingLi.history.guoming}","${BingLi.history.jiazu}","${BingLi.history.jiwang}","${SeekMedicalAdviceID}")`
            await exec(sqql)
            //添加诊断结论
            add_diagnosis(BingLi.zhenduanjielun,SeekMedicalAdviceID,req.user.UserID)
            //添加治疗方案
            BingLi.zhiliaofangan.API_treatment = BingLi.zhiliaofangan.text
            BingLi.zhiliaofangan.API_prescription = BingLi.zhiliaofangan.chufang
            add_DoctorTreatment(BingLi.zhiliaofangan,SeekMedicalAdviceID,req.user.UserID,'住院中治疗')
            //添加后续治疗医生 和 查房护士
            var API_after = BingLi.API_after
            var doctors = API_after[0].doctors
            var nurses = API_after[0].nurses
            for(i=0;i<doctors.length;i++){
                var sql = `insert into seekmedical_after_treatment_doctor
                (SeekMedicalAdviceID,RecommendDoctorID,RecommendDoctorName)
                values
                ("${SeekMedicalAdviceID}","${doctors[i].docId}","${doctors[i].docName}")`
                await exec(sql)
            }
            for(i=0;i<nurses.length;i++){
                var sqll = `insert into tohospital_chafang_nurse
                (ChafangNurse,ChafangNurseName,doctorID,date,SeekMedicalAdviceID)
                values
                ("${nurses[i].nurId}","${nurses[i].nurName}","${req.user.UserID}",
                "${moment().format('YYYY-MM-DD HH:mm:ss')}","${SeekMedicalAdviceID}")`
                await exec(sqll)
            }

            //修改状态为已处理
            var sqlll = `update tohospital_chafang_patient set flag = 1
            where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"`
            await exec(sqlll)
            res.json({
                status:200,
                msg:"添加成功"
            })  
        }catch(err) {
            console.log(err)
                    res.json({
                        status:0,
                        msg:"添加失败"
                    })
                }
        }
        addInfo();             
})

//医生获取住院病人病历信息
router.get('/getInfo/:pid', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {             
    async function addInfo() {
        //console.log("addInfo")
        //console.log(req.body.BingLi.API_after[0].doctors)
        
        // 同步写法
       var SeekMedicalAdviceID = req.params.pid
        try {
            //console.log("addInfo")
            //console.log(req.body)
            //获取症状
            let API_symptom = []
            let sql = `select symptomName from symptomrelation where SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
            let description = await exec(sql)
            for(description_i=0;description_i<description.length;description_i++){
                API_symptom.push(description[description_i].symptomName)
            }
            //获取历史病历
            var sqql = `select AllergyHistory as guoming,FamilyHistory as jiazu,PatientHistory as jiwang 
            from patient_history where SeekMedicalAdviceID = '${SeekMedicalAdviceID}'`
            var API_history = await exec(sqql)
            //获取诊断结论
            let API_zhenduanjielun = []
            let sqqql = `select DiagnosisDescription,DoctorID from diagnosis where SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
            let diagnosis = await exec(sqqql)
            for(description_i=0;description_i<diagnosis.length;description_i++){
                API_zhenduanjielun.push(diagnosis[description_i].DiagnosisDescription)
            }
            //获取治疗方案
            var sql33 = `select TreatmentDescription,TreatmentID from treatment where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"`
            var API_zhiliao = await exec(sql33)
            //获取处方
            var sql44 = `select DrugsName,DrugsNumber,DrugsNumberUnits,DrugsUsage,UseFrequency,UseTime,DosageOfDrugsUnits,DrugsManufacturer
            from treatmentdrugrelation where TreatmentID = "${API_zhiliao[0].TreatmentID}"`
            var API_chufang = await exec(sql44)
            var qwer = []
            for(i = 0;i<API_zhiliao.length;i++){
                qwer.push(API_zhiliao[i].TreatmentDescription)
            }
            API_zhiliao = qwer
            /*BingLi.zhiliaofangan.API_treatment = BingLi.zhiliaofangan.text
            BingLi.zhiliaofangan.API_prescription = BingLi.zhiliaofangan.chufang
            add_DoctorTreatment(BingLi.zhiliaofangan,SeekMedicalAdviceID,req.user.UserID,'住院中治疗')
            */
            res.json({
                status:200,
                API_symptom,
                API_history,
                API_zhenduanjielun,
                API_zhiliao,
                API_chufang
            })  
        }catch(err) {
            console.log(err)
                    res.json({
                        status:0,
                        msg:"获取失败"
                    })
                }
        }
        addInfo();              
})

//获取远程医生的患者列表
router.get('/ycPatientList', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {             
    async function ycPatientList() {
       
        try {
            var sql = `select t.SeekMedicalAdviceID as pid,t.tohospitalID,t.patientName,t.DoctorName,t.ToHospitalDateTime
            from tohospital_chafang_patient t left join
            seekmedical_after_treatment_doctor s on t.SeekMedicalAdviceID = s.SeekMedicalAdviceID
            where s.RecommendDoctorID = "${req.user.UserID}"
            and t.chuyuan = 0`
            var patient = await exec(sql)
            //console.log(req.user)
            res.json({
                status:200,
                patient:patient
            })    
        }catch(err) {
            console.log(err)
                    res.json({
                        status:0,
                        msg:"获取失败"
                    })
                }
        }
        ycPatientList();              
})

//医生更改患者信息
router.post('/basicinfo',
passport.authenticate("jwt", { session: false }), 
(req, res)=>{
    async function basicinfo(){
        try{
            console.log("infochange_id：",req.user.UserID)
            let sql2 = `update tohospital_chafang_patient set 
            Name='${req.body.Name}',
            Gender= '${req.body.gender}',
            Job= '${req.body.job}',
            Mail= '${req.body.post}',
            Birthday= '${req.body.birthday}',
            Address= '${req.body.address}',
            Phone='${req.body.Phone}'
            where UserID="${req.body.UserID}";`
            await exec(sql2)
            res.json({
                status:200,
                msg:"修改成功"
            })
        }catch(err){
            console.log(err)
            res.json({
                status:0,
                msg:"服务器报错"+err
            })
        }
    }
    basicinfo()  
})

//修改患者出院信息
router.post('/modifytreatment/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    //console.log(req.body)          
    async function endtreatment() {
        var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID 
        // 同步写法
        /**
         {
            diagResult: "",   //出院记录
            treatLogs: "",    //治疗记录
            notes: "西药治疗",   //医嘱
            API_prescription: [
                {
                    API_drugsName: "含曲林片",
                    API_drugsNumberUnits: "盒",
                    API_drugsNumber: "2",
                    API_drugsUsage: "一次两粒",
                    API_useFrequency: "一天一次",
                    API_useTime: "饭后",
                    API_isEditable: false,
                    API_days: "7"
                }
            ]
        },
         */
        try {
                //获取下一次的随访时间
                suifangTime = formatDate(req.body.suifangTime)
                //删除原来的
                var sqlq = `delete from treatment where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"`
                await exec(sqlq)
                //插入诊断结论
                var sql3 = `insert into treatment 
                (TreatmentDescription,TreatmentResults,TreatmentPhase,TreatmentDateTime,SeekMedicalAdviceID,DoctorID) 
                values
                ("${req.body.notes}","${req.body.treatLogs}","出院后治疗",'${moment().format('YYYY-MM-DD HH:mm:ss')}',"${SeekMedicalAdviceID}","${req.user.UserID}") `
                var inserttreatment =  await exec(sql3)
                var API_prescription = req.body.prescription 
                //添加处方记录
                add_Prescription(inserttreatment.insertId,API_prescription)
                //添加医生确认出院的记录
                var sql10 = `update seekmedicaladvice set 
                SeekMedicalState = "已完成",
                EndDiagResult = "${req.body.diagResult}",
                EndDiagNotes = "${req.body.notes}",
                EndHospitalDateTime = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                EndHospitaNextlFollowDateTime = '${suifangTime}'
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
                await exec(sql10)

                //向住院表里面添加出院信息（新加的表tohospital）
                var sql11 = `update tohospital set 
                ToHospitalState = "已出院",
                EndDiagResult = "${req.body.diagResult}",
                EndDiagNotes = "${req.body.notes}",
                EndHospitalDateTime = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                EndHospitaNextlFollowDateTime = '${suifangTime}'
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
                await exec(sql11)
                //更新tohospital_chafang_patient表 患者的出院状态
                var sql123 = `update tohospital_chafang_patient set chuyuan = 1,
                EndHospitalDateTime = "${moment().format('YYYY-MM-DD HH:mm:ss')}"
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}'`
                await exec(sql123)
                res.json({
                    status:200,
                    msg:"出院记录成功"
                })
        }catch(err) {
                    console.log(err)
                    res.json({
                        status:0,
                        msg:"出院记录失败"
                    })
                }
        }
    endtreatment();              
})


module.exports = router;