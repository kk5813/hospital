const express = require('express');
const app = express();
const router = express.Router();
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const {exec} = require('../db/config.js');
const passport = require('passport');
const query = require('../db/mysql.js');
var moment = require('moment');
//转换时间格式函数
const formatDate = require('../time/formatetime.js');
//获取本地时区
moment.locale('zh-cn');

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


//发起会诊（医生自己发起的会诊）
router.post('/startconsultation/:pid', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function startconsultation() {
            try {
                //处理输入的数据
                var pid = req.params.pid
                var startTime = req.body.startTime
                startTime = formatDate(startTime)
                var endTime = req.body.endTime
                endTime = formatDate(endTime)
                var type = req.body.type
                var reason = req.body.reason
                var person = req.body.person
                let person1 = JSON.stringify(person)
                //查询发起的就诊ID的患者的信息
                var sql =  `select PatientID,PatientName from seekmedicaladvice where SeekMedicalAdviceID = '${pid}'`
                var patient_info = await exec(sql)
                //告知患者需要参加会诊
                let obj = {
                    fromid:req.user.UserID,
                    fromname:req.user.Name,
                    pid:pid,
                    toid:patient_info[0].PatientID,
                    msg:"普通会诊"
                }
                //console.log(obj)
                socket.emit('newGroupConsultation',obj)
                //查询发起人的身份
                var sql5 =  `select RoleID from user_role where UserID = '${req.user.UserID}'`
                var RoleID = await exec(sql5)
                var source = 'jiuzhen'
                if(RoleID[0].RoleID === 40){
                    source = 'zhuyuan'
                }
                //插入会诊信息
                var sql1 = `insert into groupconsultation 
                (GUID,GroupConsultationStartDateTime,GroupConsultationEndDateTime,GroupConsultationApplicationDateTime,GroupConsutationStatus,
                    GroupConsutationType,GroupConsutationReason,GroupConsutationPerson,GroupConsutationSource,PatientID,PatientName,SeekMedicalAdviceID,HolderID,HolderName)
                values 
                ((UUID()),
                '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                '${endTime}',
                '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                '等待患者确认',
                '${type}',
                '${reason}',
                '${person1}',
                '${source}',
                '${patient_info[0].PatientID}',
                '${patient_info[0].PatientName}',
                '${pid}',
                '${req.user.UserID}',
                '${req.user.Name}'
                )
                `
                var insert_groupconsultation = await exec(sql1)
                //插入主持人
                let sql3 = `insert into groupconsultationdoctor 
                        (
                            GroupConsultationID,
                            DoctorID,
                            DoctorName,
                            DoctorType
                        )
                        values 
                        (
                            "${insert_groupconsultation.insertId}",
                            "${req.user.UserID}",
                            "${req.user.Name}",
                            "主持人"
                        )
                        `
                await exec(sql3)
                
                res.json({
                    status:200,
                    msg:"会诊创建成功"
                })
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"会诊创建失败，服务器报错" ,
                            err
                        })
                    }
        }
                    startconsultation();      
})

//为患者选择会诊医生(就诊申请时提交的患者发起的会诊)
router.post('/startconsultation_patient/:pid', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function startconsultation_patient() {
            try {
                //处理输入的数据
                var pid = req.params.pid
                var gid = req.body.gid
                var startTime = req.body.startTime
                startTime = formatDate(startTime)
                var endTime = req.body.endTime
                endTime = formatDate(endTime)
                var type = req.body.type
                var reason = req.body.reason
                var person = req.body.person
                let person1 = JSON.stringify(person)
                //查询发起的就诊ID的患者的信息
                var sql =  `select PatientID,PatientName from seekmedicaladvice where SeekMedicalAdviceID = '${pid}'`
                var patient_info = await exec(sql)
                //告知患者需要参加会诊
                let obj = {
                    fromid:req.user.UserID,
                    fromname:req.user.Name,
                    pid:pid,
                    toid:patient_info[0].PatientID,
                    msg:type
                }
                //console.log(obj)
                socket.emit('newGroupConsultation',obj)
                //更新会诊信息
                var sql1 = `update groupconsultation set
                GroupConsultationStartDateTime = '${startTime}',
                GroupConsultationEndDateTime = '${endTime}',
                GroupConsultationApplicationDateTime = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                GroupConsutationStatus = '等待患者确认',
                GroupConsutationReason = '${reason}',
                GroupConsutationPerson = '${person1}'
                where GroupConsultationID = '${gid}';
                `
                await exec(sql1)
                res.json({
                    status:200,
                    msg:"会诊创建成功"
                })
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"会诊创建失败，服务器报错" ,
                            err
                        })
                    }
        }
        startconsultation_patient();      
})

//查询医生需要会诊的列表
router.get('/consultationlist', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function consultationlist() {
            try {
                var sql1 = `update groupconsultation 
                set GroupConsutationStatus = '待总结'
                where GroupConsultationEndDateTime < '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                and GroupConsutationStatus = '会诊中'`
                await exec(sql1)
                var sql = `select 
                distinct a.GroupConsultationID as API_consulationId,
                a.DoctorID as API_doctorID,
                b.PatientName as API_Name,
                a.DoctorType as API_type,
                b.GroupConsutationSource as API_source,
                b.SeekMedicalAdviceID as pid,
                b.GroupConsultationStartDateTime as API_startTime,
                b.GroupConsultationEndDateTime as API_endTime,
                b.GroupConsutationStatus as API_state,
                b.HolderName as API_holder
                from groupconsultationdoctor as a
                left join groupconsultation as b
                on a.GroupConsultationID = b.GroupConsultationID
                where a.DoctorID = '${req.user.UserID}'
                and b.GroupConsutationStatus != '患者已拒绝' and b.GroupConsutationStatus != '会诊已结束' 
                and b.GroupConsutationType = '普通会诊'`
                var consultationlist = await exec(sql)
                res.json({
                    status:200,
                    consultationlist
                })
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"失败，服务器报错" ,
                            err
                        })
                    }
        }
        consultationlist();      
})

//查询医生历史会诊列表
router.get('/historyconsultationlist', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function historyconsultationlist() {
            try {
                var sql = `select 
                distinct a.GroupConsultationID as API_consulationId,
                a.DoctorID as API_doctorID,
                b.PatientName as API_Name,
                a.DoctorType as API_type,
                b.GroupConsutationSource as API_source,
                b.SeekMedicalAdviceID as pid,
                b.GroupConsultationStartDateTime as API_startTime,
                b.GroupConsultationEndDateTime as API_endTime,
                b.GroupConsutationStatus as API_state,
                b.HolderName as API_holder
                from groupconsultationdoctor as a
                left join groupconsultation as b
                on a.GroupConsultationID = b.GroupConsultationID
                where a.DoctorID = '${req.user.UserID}'
                and b.GroupConsutationStatus = '会诊已结束'
                and b.GroupConsutationType = '普通会诊'`
                var consultationlist = await exec(sql)
                res.json({
                    status:200,
                    consultationlist
                })
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"失败，服务器报错" ,
                            err
                        })
                    }
        }
        historyconsultationlist();      
})

//提交会诊意见（某医生）
router.post('/consultationopinion/:consultationId', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function consultationopinion() {
            try {
                //处理输入的数据
                var consultationId = req.params.consultationId
                var content = req.body.content
                if("type" in req.body){
                    var type = req.body.type
                }else{
                    var type = 'text'
                }
                //插入会诊内容
                var sql = `insert into groupconsultationdoctor_result 
                (GroupConsultationID,DoctorID,DoctorContent,GroupConsultationDoctorContentDateTime,ContentType)
                values
                ('${consultationId}','${req.user.UserID}','${content}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${type}')`
                await exec(sql)
                //通知所有会诊参与人员
                var sql1 = `select GroupConsultationID,DoctorID from groupconsultationdoctor where GroupConsultationID = '${consultationId}'`
                var GroupConsultationDoctors = await exec(sql1)
                for(GroupConsultationDoctors_i in GroupConsultationDoctors){
                    var newGroupConsultation_content = {
                        fromid:req.user.UserID,
                        toid:GroupConsultationDoctors[GroupConsultationDoctors_i].DoctorID,
                        gid:GroupConsultationDoctors[GroupConsultationDoctors_i].GroupConsultationID,
                        msg:'新的会诊消息'
                    }
                    socket.emit('newGroupConsultation_content',newGroupConsultation_content)
                }
                //查询会诊信息通知患者
                var sql2 = `select SeekMedicalAdviceID,PatientID from groupconsultation
                where GroupConsultationID = '${consultationId}'`
                var SeekMedicalAdvice = await exec(sql2)
                newGroupConsultation_content = {
                    fromid:req.user.UserID,
                    toid:SeekMedicalAdvice[0].PatientID,
                    gid:GroupConsultationDoctors[0].GroupConsultationID,
                    msg:'医生发表新的会诊消息'
                }
                console.log(newGroupConsultation_content)
                socket.emit('newGroupConsultation_content',newGroupConsultation_content)
                res.json({
                    status:200,
                    msg:"创建成功" 
                })
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"失败，服务器报错" ,
                            err
                        })
                    }
        }
        consultationopinion();      
})

//获取一次会诊的讨论内容
router.get('/discussion/:consultationId', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function discussion() {
            try {
                //处理输入的数据(下面的sql为查询出所有会诊医生的讨论信息)
                // var consultationId = req.params.consultationId
                // var sql1 = `select 
                // DoctorID,
                // DoctorContent as content,
                // ContentType as type,
                // GroupConsultationDoctorContentDateTime as contentDateTime
                // from groupconsultationdoctor_result
                // where GroupConsultationID = '${consultationId}';`
                //下面的新sql1为只查询最近一条医生的讨论信息（看场景，要所有的就把上面的代码替换下面的）
                var consultationId = req.params.consultationId
                var sql1 = `
                select * from 
                (select 
                DoctorID,
                DoctorContent as content,
                ContentType as type,
                GroupConsultationDoctorContentDateTime as contentDateTime
                from groupconsultationdoctor_result
                where GroupConsultationID = '${consultationId}'
                order by GroupConsultationDoctorContentDateTime desc limit 100)
                as a group by a.DoctorID
                `
                let discussion = await exec(sql1)
                //console.log(discussion)
                for(discussion_i in discussion){
                    //查询出所有的该会诊的医生数据
                    var sql = `select 
                    a.DoctorID as id,
                    b.Name as name,
                    a.DoctorType as type,
                    b.Image as img
                    from groupconsultationdoctor as a 
                    left join users as b
                    on a.DoctorID = b.UserID
                    where a.DoctorID = '${discussion[discussion_i].DoctorID}'
                    `
                    var user = await exec(sql)
                    //console.log(user)
                    discussion[discussion_i]["user"] = user[0]
                }  
                //查询用户是不是主持人
                var sql1 = `select 
                HolderID
                from groupconsultation
                where GroupConsultationID = '${consultationId}' and HolderID = '${req.user.UserID}'`
                let Holder = await exec(sql1)
                var isHolder = true
                if(Holder.length === 0){
                    isHolder = false
                }
                res.json({
                    status:200,
                    discussion,
                    isHolder:isHolder
                })
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"失败，服务器报错" ,
                            err
                        })
                    }
        }
        discussion();      
})

//获取会诊信息
router.get('/consultationinfo/:consultationId', 
//passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function consultationinfo() {
            try {
                //处理输入的数据
                var consultationId = req.params.consultationId
                //查询出所有的会诊数据
                var sql = `select 
                GroupConsutationReason as reason,
                GroupConsultationStartDateTime as startTime,
                GroupConsultationEndDateTime as endTime,
                GroupConsutationSource as groupConsutationSource,
                GroupConsutationStatus as state,
                GroupConsutationPerson as person,
                GroupConsutationType as type,
                HolderID as holderID
                from groupconsultation 
                where GroupConsultationID = '${consultationId}'
                `
                var GroupConsutation_info = await exec(sql)
                //console.log(GroupConsutation_info)
                GroupConsutation_info[0].person = JSON.parse(GroupConsutation_info[0].person)

                //查询主持人信息
                var sql6 = `select b.ExpertID,b.ExpertName,b.ExpertImage 
                from expert_user as a left join expert_team as b
                on a.ExpertID = b.ExpertID 
                where a.UserID = '${GroupConsutation_info[0].holderID}'`
                var ExpertID_info = await exec(sql6)
                var sql7 = `select a.Name,a.UserID,a.Image as UserImage,a.HospitalID,b.HospitalName ,b.Image as HospitalImage
                from users as a left join hospital as b
                on a.HospitalID = b.HospitalID 
                where UserID = '${GroupConsutation_info[0].holderID}'`
                var holder_info = await exec(sql7)
                if(ExpertID_info.length !== 0){
                    var holderInfo = {
                        "groupName": ExpertID_info[0].ExpertName, 
                        "groupId":  ExpertID_info[0].ExpertID,  
                        "groupImg":  ExpertID_info[0].ExpertImage, 
                        "userName": holder_info[0].Name,
                        "userImg": holder_info[0].UserImage,
                        "userId": holder_info[0].UserID
                    }
                }else{
                    //主持人属于某医院的医生的情况
                    var holderInfo = {
                        "orgName": holder_info[0].HospitalName, 
                        "orgId":  holder_info[0].HospitalID,  
                        "orgImg":  holder_info[0].HospitalImage,
                        "userName": holder_info[0].Name,
                        "userImg": holder_info[0].UserImage,
                        "userId": holder_info[0].UserID
                    }
                }
                GroupConsutation_info[0].person["holderInfo"] = holderInfo
                res.json({
                    status:200,
                    consultationinfo:GroupConsutation_info[0]
                })
            }catch(err) {
                console.log(err)
                res.json({
                    status:0,
                    msg:"失败，服务器报错" ,
                    err
                })
            }
        }
        consultationinfo();      
})

//结束会诊
router.post('/endconsultation/:consultationId', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function endconsultation() {
            try {
                    //{
                    // conclusion:"xxxxxxxxxxxxxxxxxx",
                    // treatOpinion:"xxxxxxxxxxxxxxxxxxxx",
                    // prescription:[]//处方
                    // after:[]
                    // }
                //处理输入的数据
                var consultationId = req.params.consultationId
                var conclusion = req.body.conclusion
                var treatOpinion = req.body.treatOpinion
                var prescription = JSON.stringify(req.body.prescription)
                var after = req.body.after
                //处理提交的后续数据
                for(let after_i=0;after_i<after.length;after_i++){
                    after[after_i].orgName
                    after[after_i].orgId
                    let sql12 = `select Image from hospital where HospitalID = ${after[after_i].orgId}`
                    let hos_Image = await exec(sql12)
                    after[after_i]["orgImage"] = hos_Image[0].Image
                    for(let doc_i=0;doc_i<after[after_i].doctors.length;doc_i++){
                        let sql13 = `select Image,ResearchExperienceInfo from users
                        where UserID = '${after[after_i].doctors[doc_i].docId}'`
                        let doc_info = await exec(sql13)
                        after[after_i].doctors[doc_i]["Image"]=doc_info[0].Image
                        after[after_i].doctors[doc_i]["ResearchExperienceInfo"]=doc_info[0].ResearchExperienceInfo
                    }
                    for(let nur_i=0;nur_i<after[after_i].nurses.length;nur_i++){
                        let sql14 = `select Image,ResearchExperienceInfo from users
                        where UserID = '${after[after_i].nurses[nur_i].nurId}'`
                        let nur_info = await exec(sql14)
                        after[after_i].nurses[nur_i]["Image"]=nur_info[0].Image
                        after[after_i].nurses[nur_i]["ResearchExperienceInfo"]=nur_info[0].ResearchExperienceInfo
                    }
                }
                var after1 = JSON.stringify(after)
                //更新会诊数据
                var sql = `update groupconsultation
                set GroupConsultationResults = '${conclusion}',
                GroupTreatmentResults = '${treatOpinion}',
                GroupConsultationEndDateTime = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                Treatment = '${prescription}',
                GroupConsutationAfter = '${after1}',
                GroupConsutationStatus = '会诊已结束'
                where GroupConsultationID = '${consultationId}'
                `
                await exec(sql)
                //查询就诊ID
                let sql2 = `select SeekMedicalAdviceID,PatientID,GroupConsutationSource from groupconsultation
                where GroupConsultationID = '${consultationId}'`
                var SeekMedicalAdvice = await exec(sql2)
                /*
                //如果是患者发起的应该更新就诊数据，然后可以考虑转为住院
                //查询就诊ID
                let sql2 = `select SeekMedicalAdviceID,PatientID,GroupConsutationSource from groupconsultation
                where GroupConsultationID = '${consultationId}'`
                var SeekMedicalAdvice = await exec(sql2)
                if(SeekMedicalAdvice[0].GroupConsutationSource === 'huanzhe'){
                    let conclusion_arr = []
                    conclusion_arr.push(conclusion)
                    //添加诊断结论
                    add_diagnosis(conclusion_arr,SeekMedicalAdvice[0].SeekMedicalAdviceID,req.user.UserID)   
                    treatment["API_description"] = treatOpinion 
                    //添加治疗记录

                    //更新就诊数据
                    let sql1 = `update seekmedicaladvice
                    set SeekMedicalAdviceStatus = '已完成'
                    where SeekMedicalAdviceID = '${SeekMedicalAdvice[0].SeekMedicalAdviceID}'
                    `
                    await exec(sql1)
                }
                */
                //通知所有会诊参与人员
                var sql3 = `select GroupConsultationID,DoctorID from groupconsultationdoctor where GroupConsultationID = '${consultationId}'`
                var GroupConsultationDoctors = await exec(sql3)
                for(let GroupConsultationDoctors_i in GroupConsultationDoctors){
                    let endGroupConsultation = {
                        fromid:req.user.UserID,
                        toid:GroupConsultationDoctors[GroupConsultationDoctors_i].DoctorID,
                        gid:GroupConsultationDoctors[GroupConsultationDoctors_i].GroupConsultationID,
                        msg:'新的结束会诊消息'
                    }
                    socket.emit('endGroupConsultation',endGroupConsultation)
                }
                endGroupConsultation = {
                    fromid:req.user.UserID,
                    toid:SeekMedicalAdvice[0].PatientID,
                    gid:GroupConsultationDoctors[0].GroupConsultationID,
                    msg:'结束会诊消息'
                }
                socket.emit('endGroupConsultation',endGroupConsultation)
                res.json({
                    status:200,
                    msg:'会诊结束成功'
                })
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"失败，服务器报错" ,
                            err
                        })
                    }
        }
        endconsultation();      
})


//查询会诊结论
router.get('/conclusion/:consultationId', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function conclusion() {
            try {
                //处理输入的数据
                var consultationId = req.params.consultationId
                //查询出所有的会诊数据
                var sql = `select GroupConsultationResults as conclusion,
                GroupTreatmentResults as treatOpinion,
                Treatment as prescription,
                GroupConsutationAfter as after
                from groupconsultation
                where GroupConsultationID = '${consultationId}'
                `
                var GroupConsultation_info = await exec(sql)
                if(GroupConsultation_info.length === 0){
                    res.json({
                        status:0,
                        msg:'无该会诊号，获取失败'
                    })
                }else{
                    var prescription = JSON.parse(GroupConsultation_info[0].prescription)
                    var after = JSON.parse(GroupConsultation_info[0].after)
                    res.json({
                        status:200,
                        conclusion:GroupConsultation_info[0].conclusion, 
                        treatOpinion:GroupConsultation_info[0].treatOpinion, 
                        prescription:prescription,
                        after:after
                    })
                }
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"失败，服务器报错" ,
                            err
                        })
                    }
        }
        conclusion();      
})


//导入历史会诊结论
router.get('/historyconsultationopinion', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function historyconsultationopinion() {
            try {
                //console.log(req.user.UserID)
                //查询出所有的会诊数据
                var sql = `select DoctorContent as Opinion from groupconsultationdoctor_result
                where DoctorID = '${req.user.UserID}'`
                var historyOpinion = await exec(sql)
                //console.log(historyOpinion)
                res.json({
                    status:200,
                    historyOpinion
                })
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"失败，服务器报错" ,
                            err
                        })
                    }
        }
        historyconsultationopinion();      
})

//获取历史会诊结论
router.get('/historyconsultationresult', 
passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function historyconsultationresult() {
            try {
                
                //查询出所有的会诊数据
                var sql = `select GroupConsultationEndDateTime,GroupConsultationResults as conclusion,GroupConsutationAfter as after,
                GroupTreatmentResults as treatOpinion,Treatment as prescription from groupconsultation
                where HolderID = '${req.user.UserID}' and GroupConsutationStatus = '会诊已结束'
                order by GroupConsultationEndDateTime desc`
                var historyResult = await exec(sql)
                if(historyResult.length > 4){
                    historyResult = historyResult.splice(0,5)
                }
                for(historyResult_i in historyResult){
                    historyResult[historyResult_i]["prescription"] = JSON.parse(historyResult[historyResult_i].prescription)
                    historyResult[historyResult_i]["after"] = JSON.parse(historyResult[historyResult_i].after)
                }
                res.json({
                    status:200,
                    historyResult
                })
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"失败，服务器报错" ,
                            err
                        })
                    }
        }
        historyconsultationresult();      
})

//通过pid获取会诊id
router.get('/pid_gid/:pid', 
passport.authenticate("jwt", { session: false }),
(req, res) => {
        async function pid_gid() {
            try {
                var pid = req.params.pid
                //查询出所有的会诊数据
                var sql = `select GroupConsultationID from groupconsultation
                where SeekMedicalAdviceID = '${pid}'`
                var gid = await exec(sql)
                var groupConsultationID = []
                for(gid_i in gid){
                    groupConsultationID.push(gid[gid_i].GroupConsultationID)
                }
                res.json({
                    status:200,
                    groupConsultationID
                })
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"失败，服务器报错" ,
                            err
                        })
                    }
        }
        pid_gid();      
})


//通过pid获取会诊id
router.get('/grouplogs/:pid', 
passport.authenticate("jwt", { session: false }),
(req, res) => {
        async function pid_gid() {
            try {
                var pid = req.params.pid
                //查询出所有的会诊数据
                var sql1 = `select GroupConsultationID from groupconsultation
                where SeekMedicalAdviceID = '${pid}'`
                var gid = await exec(sql1)
                var huizhenLogs = []
                for(gid_i in gid){
                    //根据GID查询该次会诊信息
                    var consultationId = gid[gid_i].GroupConsultationID
                    let obj = {}
                    //查询出所有的会诊数据
                    var sql = `select 
                    GroupConsutationReason as reason,
                    GroupConsultationStartDateTime as startTime,
                    GroupConsultationEndDateTime as endTime,
                    GroupConsutationStatus as state,
                    GroupConsutationPerson as person,
                    GroupConsutationType as type,
                    HolderID as holderID
                    from groupconsultation 
                    where GroupConsultationID = '${consultationId}'
                    `
                    var GroupConsutation_info = await exec(sql)
                    //console.log(GroupConsutation_info)
                    GroupConsutation_info[0].person = JSON.parse(GroupConsutation_info[0].person)
                    //查询出所有的会诊数据
                    var sql = `select GroupConsultationResults as conclusion,GroupConsutationAfter as after,
                    GroupTreatmentResults as treatOpinion,Treatment as prescription from groupconsultation
                    where GroupConsultationID = '${consultationId}'`
                    var historyResult = await exec(sql)
                    for(historyResult_i in historyResult){
                        historyResult[historyResult_i]["prescription"] = JSON.parse(historyResult[historyResult_i].prescription)
                        historyResult[historyResult_i]["after"] = JSON.parse(historyResult[historyResult_i].after)
                    }
                    obj["consultationInfo"] = GroupConsutation_info[0]
                    obj["consultationResult"] = historyResult[0]
                    obj["consultationId"] = consultationId
                    huizhenLogs.push(obj)
                }
                res.json({
                    status:200,
                    huizhenLogs
                })
            }catch(err) {
                        console.log(err)
                        res.json({
                            status:0,
                            msg:"失败，服务器报错" ,
                            err
                        })
                    }
        }
        pid_gid();      
})




module.exports = router;