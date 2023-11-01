var express = require('express');
var app = express();
var router = express.Router();
const {exec} = require('../db/config.js');
const passport = require('passport');
const query = require('../db/mysql.js');
var moment = require('moment');
//获取时间转换函数
const formatDate = require('../time/formatetime.js');
//获取本地时区
moment.locale('zh-cn');

//获取字符串拼音
const Alphabetize = require('chinese-alphabetize')

//获取添加病历函数（添加症状描述，诊断结论，治疗方案）
const {add_DoctorTreatment,add_Prescription} = require('../diagrelation/add_diag.js')
//链接socket
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

//查询该医生患者列表
router.get('/patientlist', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function patientlist() {
        // 同步写法
        try {
            //   //查询今日患者内容
            //   var sql1 = `
            //   select 
            //   b.SeekMedicalAdviceID as pid,
            //   b.MedicalAdviceApplicationDateTime as API_date,
            //   b.PatientName as API_name,
            //   a.Name as API_expert
            //   from seekmedicaladvice as b left join users as a on a.UserID = b.CureDoctorID  where b.RecommendDoctorID = "${req.user.UserID}" 
            //   order by b.MedicalAdviceApplicationDateTime desc
            //   `
            //   var API_patientsList = await exec(sql1)
            var sql = `select 
            distinct a.SeekMedicalAdviceID as pid,
            b.PatientName as API_name,
            b.ToHospitalID as API_toHospitalID,
            b.MedicalAdviceApplicationDateTime as API_date,
            b.SeekMedicalAdviceStatus as API_state,
            c.Name as API_expert
            from seekmedical_after_treatment_doctor as a 
            left join seekmedicaladvice as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c 
            on b.CureDoctorID = c.UserID
            where a.RecommendDoctorID = "${req.user.UserID}"
            and b.SeekMedicalState != "已完成"
            and b.ToHospitalAssessment = "1"
            and b.ToTreatmentlAssessment = "1"`
            var API_patientsList = await exec(sql)
            //console.log(API_patientsList)
            for(API_patientsList_i in API_patientsList){
                var sql2 = `select TreatmentID from treatment where SeekMedicalAdviceID = '${API_patientsList[API_patientsList_i].pid}'
                and TreatmentDateTime >= '${moment().format('YYYY-MM-DD')}'`
                
                var TreatmentID = await exec(sql2)
                //console.log(TreatmentID)
                if(TreatmentID.length !== 0){
                    API_patientsList[API_patientsList_i].API_state = "已处理"
                }else{
                    API_patientsList[API_patientsList_i].API_state = "未处理"
                }
            }
                res.json({
                    status:200,
                    API_patientsList
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


//查询该患者的治疗方案（住院中的记录）
router.get('/treatmentlog/:SeekMedicalAdviceID', 
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
            a.MedicalAdviceApplicationDateTime
            from seekmedicaladvice as a
            where a.SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
            const patientdiaginfo = await exec(sql2)
            //console.log(patientdiaginfo)
            if(patientdiaginfo.length == 0){
                res.json({
                    //没有就诊号的情况下是没有其他信息,所以直接返回空的信息
                        API_basicInfo:"",
                        API_treatmentLog:[
                            {
                                API_date:API_date || '',
                                API_description: "",
                                API_prescription: {
                            }
                            }
                        ]
                    })
            }else{
            //查询患者基本信息
            var sql1 = `select 
            Name as API_name,
            Gender as API_gender,
            Birthday as API_birthday,
            Address as API_address,
            Phone as API_tel,
            Image as API_pic
            from users where UserID = "${patientdiaginfo[0].PatientID}";`  
            const patientinfo = await exec(sql1)  
            
            //治疗方案查询
            var sql8 = `
            select TreatmentDescription as API_treatmentdescription,
            TreatmentDateTime as API_treatmentDateTime,
            TreatmentPhase as API_treatmentPhase,
            TreatmentResults as API_patientState,
            TreatmentID
            from treatment where SeekMedicalAdviceID = ${patientdiaginfo[0].SeekMedicalAdviceID}
            and TreatmentPhase = '住院中治疗';
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
                //console.log(TreatmentPlanName)
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
            res.json({
                API_basicInfo: patientinfo[0],
                //治疗方案
                API_treatmentLog:API_treatmentLog
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

//获取某医生的所有病历诊断结论
router.get('/historylog', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
        // 同步写法
        async function historylog() {
            // 同步写法
            try {
                //治疗方案查询
                var sql8 = `
                select TreatmentDescription as API_treatmentdescription,
                TreatmentDateTime as API_treatmentDateTime,
                TreatmentResults as API_patientState,
                TreatmentID
                from treatment where DoctorID = ${req.user.UserID};
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
                    //console.log(TreatmentPlanName)
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
                res.json({
                    //治疗方案
                    API_treatmentLog:API_treatmentLog
                })
                    }catch(err) {
                        console.log(err)
                            res.json({
                                status:0,
                                msg:"暂时无法显示该医生治疗方案"
                            })
                          }
                    }
            historylog()        
})


//查询该患者护理详情
router.get('/patientdetails/:SeekMedicalAdviceID', 
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
            a.ToHospitalID
            from seekmedicaladvice as a
            where a.SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
            const patientdiaginfo = await exec(sql2)
            //console.log(patientdiaginfo)
            if(patientdiaginfo.length == 0){
                res.json({
                    //没有就诊号的情况下是没有其他信息,所以直接返回空的信息
                        API_basicInfo:"",
                        API_nursingLog:[
                        ]
                    })
            }else{
            //查询患者基本信息
            var sql1 = `select 
            Name as API_name,
            Gender as API_gender,
            Birthday as API_birthday,
            Address as API_address,
            Phone as API_tel,
            Image as API_pic
            from users where UserID = "${patientdiaginfo[0].PatientID}";`  
            const patientinfo = await exec(sql1)  
            patientinfo[0]["API_toHospitalID"] = patientdiaginfo[0].ToHospitalID
            var sql3 = `select 
            date_format(FormTime, '%Y-%m-%d') as time
            from tohospital_assessment_form
            where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"
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
            //console.log(API_nursingLog)
            //console.log(API_treatmentLog)
            res.json({
                API_basicInfo: patientinfo[0],
                API_nursingLog
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

//诊断患者或得出诊断结论  
router.post('/treatmentlog/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID        
    async function treatmentlog_post() {
        // 同步写法
        /**
         {
            API_date: "2017/8/9",
            API_patientState: ["西药治疗"],
            API_treatment:[ "西药治疗","西药治疗1"],
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
            //处理数据
            let treatment = {
                API_patientState:req.body.API_patientState,
                API_prescription:req.body.API_prescription,
                API_treatment:req.body.API_treatment
            }
            //添加治疗记录
            add_DoctorTreatment(treatment,SeekMedicalAdviceID,req.user.UserID,'住院中治疗')
            let sql = `select PatientID from seekmedicaladvice where SeekMedicalAdviceID = '${SeekMedicalAdviceID}'`
            let patientID = await exec(sql)
            let sql3 = `select HospitalID from users where UserID = '${req.user.UserID}';`
            let hospitalID = await exec(sql3)
            if(patientID.length > 0){
                let doctor_treatment_message = {
                    fromid:req.user.UserID,
                    toid:patientID[0].PatientID,
                    HospitalID:hospitalID[0].HospitalID,
                    pid:SeekMedicalAdviceID
                }
                //发送治疗记录通知
                socket.emit('doctor_treatment',doctor_treatment_message)
            }
            res.json({
                status:0,
                msg:"添加治疗方案成功"
            })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"添加治疗方案失败"
                })
                }
        }
        treatmentlog_post();              
})

//获取住院申请列表
router.get('/applylist', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function applylist() {
        // 同步写法
        try {
            //   //查询今日患者内容
            //   var sql1 = `
            //   select 
            //   b.SeekMedicalAdviceID as pid,
            //   b.MedicalAdviceApplicationDateTime as API_date,
            //   b.PatientName as API_name,
            //   a.Name as API_expert
            //   from seekmedicaladvice as b left join users as a on a.UserID = b.CureDoctorID  where b.RecommendDoctorID = "${req.user.UserID}" 
            //   order by b.MedicalAdviceApplicationDateTime desc
            //   `
            //   var API_patientsList = await exec(sql1)
            // b.MedicalAdviceApplicationDateTime as API_date
            var sql = `select 
            a.SeekMedicalAdviceID as API_pid,
            b.PatientName as API_name,
            b.ApplySeekMedicalDateTime as API_date,
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
            and b.SeekMedicalState != "已完成"`
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

//查询该患者详细的评估列表
router.get('/applydetails/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    //console.log(PatientID)          
    async function applydetails() {
        var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID
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
                applydetails();              
})

//提交入院治疗记录
router.post('/applydetails/confirm/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    //console.log(req.body)          
    async function applydetails_confirm() {
        // 同步写法
        var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID
        /**
         {
            API_date: "2017/8/9",
            API_patientState: ["西药治疗"],
            API_treatment:[ "西药治疗","西药治疗1"],
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
            //修改MedicalAdviceApplicationDateTime 为同意住院时间
            let ww = `update seekmedicaladvice set MedicalAdviceApplicationDateTime = '${moment().format('YYYY-MM-DD HH:mm:ss')}'
            where SeekMedicalAdviceID = ${SeekMedicalAdviceID};`
            await exec(ww)
            //处理数据
            let treatment = {
                API_patientState:req.body.API_patientState,
                API_prescription:req.body.API_prescription,
                API_treatment:req.body.API_treatment
            }
            //添加治疗记录
            add_DoctorTreatment(treatment,SeekMedicalAdviceID,req.user.UserID,'入院前治疗')
            //添加医生确认标识符
            var sql10 = `update seekmedicaladvice set ToTreatmentlAssessment = "1"
            where SeekMedicalAdviceID = ${SeekMedicalAdviceID};`
            await exec(sql10)

            //添加医生确认标识符
            var sql14 = `update tohospital set 
            ToTreatmentlAssessment = "1",
            ToHospitalState = '住院中'
            where SeekMedicalAdviceID = ${SeekMedicalAdviceID};`
            await exec(sql14)

            //向医生护士发送成功入院通知
            //向医生发送评估完成通知
            var sql11 = `select RecommendDoctorID from seekmedical_after_treatment_doctor
            where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
            var doctorlist =  await exec(sql11)
            for(doctorlist_i in doctorlist){
                var res_obj = {
                    toid:doctorlist[doctorlist_i].RecommendDoctorID,
                    fromid: req.user.UserID
                }
                socket.emit("confirm_tohospital",res_obj)
            }
            //向护士发送评估完成通知
            var sql12 = `select RecommendNurseID from seekmedical_after_treatment_nurse
            where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
            var nurselist =  await exec(sql12)
            for(nurselist_i in nurselist){
                var res_obj = {
                    toid:nurselist[nurselist_i].RecommendNurseID,
                    fromid: req.user.UserID
                }
                socket.emit("confirm_tohospital",res_obj)
            }
            //向患者发送住院通知
            var sql13 = `select PatientID from seekmedicaladvice
            where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
            var PatientID =  await exec(sql13)
            var res_obj = {
                toid: PatientID[0].PatientID,
                fromid: req.user.UserID
            }
            socket.emit("confirm_tohospital",res_obj)

                res.json({
                    status:200,
                    msg:"添加治疗方案成功"
                })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"添加治疗方案失败"
                })
                }
        }
        applydetails_confirm();              
})


//患者结束治疗出院
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
                (TreatmentDescription,TreatmentResults,OutHospitalResult,TreatmentPhase,TreatmentDateTime,SeekMedicalAdviceID,DoctorID) 
                values
                ("${req.body.notes}","${req.body.treatLogs}","${req.body.diagResult}","出院后治疗",'${moment().format('YYYY-MM-DD HH:mm:ss')}',"${SeekMedicalAdviceID}","${req.user.UserID}") `
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

                //向医生发送成功出院通知
                var sql1 = `select RecommendDoctorID from seekmedical_after_treatment_doctor
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
                var sql1 = `select RecommendNurseID from seekmedical_after_treatment_nurse
                where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
                var nurselist =  await exec(sql1)
                for(nurselist_i in nurselist){
                    var res_obj = {
                        toid:nurselist[nurselist_i].RecommendNurseID,
                        fromid: req.user.UserID
                    }
                    socket.emit("confirm_endhospital",res_obj)
                }
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

//获取某个患者出院记录
router.get('/endtreatment/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    async function get_endtreatment() {
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
            var sql =  `select SeekMedicalState,EndDiagResult,EndDiagNotes from seekmedicaladvice 
            where SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
            var EndDiagData = await exec(sql)
            //如果该患者并没有出院，返回空数据
            if(EndDiagData[0].SeekMedicalState !== '已完成'){
                res.json({
                    status:200,
                    msg:"暂无出院记录",
                    diagResult: "",   
                    treatLogs: "",    
                    notes: "西药治疗",   
                    API_prescription:[]
                })
            }else{
                //查询出院后的治疗方案
                var sql2 = `select TreatmentID,TreatmentDescription,TreatmentResults from treatment where
                TreatmentPhase = "出院后治疗" and SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
                var API_treatment = await exec(sql2)
                if(API_treatment.length === 0){
                    API_prescription = []
                    treatLogs = ''
                }else{
                    //查询出院后的治疗药品
                    var sql3 =  `
                    select DrugsName as API_drugsName,
                    DrugsNumber as API_drugsNumber,
                    DrugsNumberUnits as API_drugsNumberUnits,
                    DrugsUsage as API_drugsUsage,
                    UseFrequency as API_useFrequency,
                    DrugsManufacturer as API_manufacturer,
                    DosageOfDrugsUnits as API_drugsSpecification,
                    UseTime as API_useTime
                    from treatmentdrugrelation where TreatmentID = "${API_treatment[0].TreatmentID}"
                `
                var API_prescription = await exec(sql3)
                treatLogs = API_treatment[0].TreatmentResults
                //console.log(API_prescription)
                }
                res.json({
                    status:200,
                    msg:"出院记录获取成功",
                    treatLogs:treatLogs,
                    API_prescription:API_prescription,
                    diagResult: EndDiagData[0].EndDiagResult,      
                    notes: EndDiagData[0].EndDiagNotes
                })       
            }
        }catch(err) {
            console.log(err)
                    res.json({
                        status:0,
                        msg:"出院记录获取失败"
                    })
                }
        }
        get_endtreatment();              
})


//获取离开医院的列表
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
            from seekmedical_after_treatment_doctor as a 
            left join seekmedicaladvice as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c 
            on b.CureDoctorID = c.UserID
            where a.RecommendDoctorID = "${req.user.UserID}"
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

//获取某医生历史出院记录
router.get('/historychuyuanlog', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    async function get_endtreatment() {
        // 同步写法
        /**
        [
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
            ],
        
        }
        ]
        ,
         */
        try {
            //获取历史患者出院列表
            var sql3 = `select 
            a.SeekMedicalAdviceID as API_pid
            from seekmedical_after_treatment_doctor as a 
            left join seekmedicaladvice as b
            on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            where a.RecommendDoctorID = "${req.user.UserID}"
            and b.SeekMedicalState = "已完成"
            and b.ToHospitalAssessment = "1"
            and b.ToTreatmentlAssessment = "1"`
            var patientList = await exec(sql3)
            //定义出一个历史住院数组
            var historyPatient = []
            for(patientList_i in patientList){
                var sql =  `select SeekMedicalState,EndDiagResult,EndDiagNotes,EndHospitalDateTime from seekmedicaladvice 
                where SeekMedicalAdviceID = '${patientList[patientList_i].API_pid}';`
                var EndDiagData = await exec(sql)
                //console.log(EndDiagData)
                //如果该患者并没有出院，返回空数据
                if(EndDiagData[0].SeekMedicalState !== '已完成'){
                    let obj = { 
                        diagResult : "",   
                        treatLogs : "",    
                        notes : "西药治疗",   
                        API_prescription : []
                    }
                    historyPatient.push(obj)
                }else{
                    //查询出院后的治疗方案
                    var sql2 = `select TreatmentID,TreatmentDescription,TreatmentResults from treatment where
                    TreatmentPhase = "出院后治疗" and SeekMedicalAdviceID = '${patientList[patientList_i].API_pid}';`
                    var API_treatment = await exec(sql2)
                    if(API_treatment.length === 0){
                        treatLogs = ""
                        API_prescription = []
                    }else{
                        //查询出院后的治疗药品
                        var sql3 =  `
                        select DrugsName as API_drugsName,
                        DrugsNumber as API_drugsNumber,
                        DrugsNumberUnits as API_drugsNumberUnits,
                        DrugsUsage as API_drugsUsage,
                        UseFrequency as API_useFrequency,
                        DrugsManufacturer as API_manufacturer,
                        DosageOfDrugsUnits as API_drugsSpecification,
                        UseTime as API_useTime
                        from treatmentdrugrelation where TreatmentID = "${API_treatment[0].TreatmentID}"
                    `
                    var API_prescription = await exec(sql3)
                    treatLogs = API_treatment[0].TreatmentResults
                    }
                    let obj =  { 
                        treatLogs:treatLogs,
                        API_prescription:API_prescription,
                        diagResult: EndDiagData[0].EndDiagResult,      
                        notes: EndDiagData[0].EndDiagNotes
                    }
                    historyPatient.push(obj)     
                }
            }
            res.json({
                status:200,
                historyPatient
            })
        }catch(err) {
            console.log(err)
                    res.json({
                        status:0,
                        msg:"出院记录获取失败"
                    })
                }
        }
        get_endtreatment();              
})


//获取某医生申请出院记录
router.get('/shenqingchuyuan/:SeekMedicalAdviceID', 
//passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    async function shenqingchuyuan() {
        var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID
        try {
            //获取历史患者出院列表
            var sql3 = `select 
            OutHospitalReason,
            OutHospitalTime,
            PatientID
            from out_hospital_apply 
            where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"`
            var OutHospital = await exec(sql3)
            if(OutHospital.length === 0){
                return res.json({
                    status:200,
                    msg:'未申请出院',
                    state:0
                })
            }
            res.json({
                status:200,
                msg:OutHospital[OutHospital.length-1],
                state:1
            })
        }catch(err) {
            console.log(err)
                    res.json({
                        status:0,
                        msg:"申请出院记录获取失败"
                    })
                }
        }
        shenqingchuyuan();              
})





module.exports = router;