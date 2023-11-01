const express = require('express');
const app = express();
const router = express.Router();
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { exec } = require('../db/config.js');
const passport = require('passport');
const query = require('../db/mysql.js');
var moment = require('moment');
//转换时间格式函数
const formatDate = require('../time/formatetime.js');
//调用日程函数
const {
    date_schedule,
    addSchedule,
    cancelSchedule
} = require('../time/date_schedule.js');
//获取本地时区
moment.locale('zh-cn');
//获取会议号
const { creatCall, layOut } = require('../create_media/create_video_number.js')

//配置socket客户端
//var socket = require('socket.io-client')('https://www.nowhealth.top:3000');  
var SOCKET_IP = require("../utils/server_IP.js").SOCKET_IP;
var socket_options = require("../utils/server_IP.js").socket_options;
//接入socket客户端作为通知
var socket = require('socket.io-client')(SOCKET_IP,socket_options); 
socket.on('connect', function(){
    console.log("已连接到socket服务器 3000")
});
socket.on('disconnect', function(){
    console.log("服务器连接关闭")
});


// JWT鉴权
var jwtConfig = require("../utils/jwtAuth.js").jwtConfigAuth;
passport.use(jwtConfig);

//视频会诊发起部分与普通会诊一样，视频会诊增加了一部分专家医生可拒绝的选项
//发起视频会诊
router.post('/startconsultation/:pid',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function startconsultation() {
            try {
                //console.log(req.body)
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
                var sql = `select PatientID,PatientName from seekmedicaladvice where SeekMedicalAdviceID = '${pid}'`
                var patient_info = await exec(sql)
                //告知患者需要参加会诊
                let obj = {
                    fromid: req.user.UserID,
                    fromname: req.user.Name,
                    pid: pid,
                    toid: patient_info[0].PatientID,
                    msg: "视频会诊"
                }
                //console.log(obj)
                socket.emit('newGroupConsultation', obj)
                //查询发起人的身份
                var sql5 = `select RoleID from user_role where UserID = '${req.user.UserID}'`
                var RoleID = await exec(sql5)
                var source = 'jiuzhen'
                if (RoleID[0].RoleID === 40) {
                    source = 'zhuyuan'
                }
                //插入会诊信息
                var sql1 = `insert into groupconsultation 
                (GUID,GroupConsultationStartDateTime,GroupConsultationEndDateTime,GroupConsultationApplicationDateTime,GroupConsutationStatus,
                    GroupConsutationType,GroupConsutationReason,GroupConsutationPerson,GroupConsutationSource,PatientID,PatientName,SeekMedicalAdviceID,HolderID,HolderName)
                values 
                ((UUID()),
                '${startTime}',
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
                //插入选择的医生至临时申请列表
                //插入专家
                if ("groups" in person) {
                    let groups = person.groups
                    for (let groups_i = 0; groups_i < groups.length; groups_i++) {
                        let experts = groups[groups_i].experts
                        for (let experts_i = 0; experts_i < experts.length; experts_i++) {
                            let sql2 = `insert into groupconsultation_tempdoctor 
                            (GroupConsultationID,DoctorID,DoctorName,DoctorImage,DoctorState,DoctorRole,DoctorType)
                            values ('${insert_groupconsultation.insertId}',
                            '${experts[experts_i].expId}',
                            '${experts[experts_i].expName}',
                            '${experts[experts_i].expPic}',
                            '未处理',
                            '60',
                            '参与'
                            )
                            `
                            await exec(sql2)
                        }
                    }
                }
                //插入医生
                if ("orgs" in person) {
                    let orgs = person.orgs
                    for (orgs_i = 0; orgs_i < orgs.length; orgs_i++) {
                        let doctors = orgs[orgs_i].doctors
                        for (doctors_i = 0; doctors_i < doctors.length; doctors_i++) {
                            let sql2 = `insert into groupconsultation_tempdoctor 
                            (GroupConsultationID,DoctorID,DoctorName,DoctorImage,DoctorState,DoctorRole,DoctorType)
                            values ('${insert_groupconsultation.insertId}',
                            '${doctors[doctors_i].docId}',
                            '${doctors[doctors_i].docName}',
                            '${doctors[doctors_i].docPic}',
                            '未处理',
                            '40',
                            '参与'
                            )
                            `
                            await exec(sql2)
                        }
                    }
                }
                //插入主持人
                let sql2 = `insert into groupconsultation_tempdoctor 
                            (GroupConsultationID,DoctorID,DoctorName,DoctorImage,DoctorState,DoctorType)
                            values ('${insert_groupconsultation.insertId}',
                            '${req.user.UserID}',
                            '${req.user.Name}',
                            '${req.user.Image}',
                            '等待患者确认',
                            '主持'
                            )
                            `
                await exec(sql2)
                //插入主持人到主持医生表里
                let sql3 = `insert into groupconsultationdoctor 
                (
                    GroupConsultationID,
                    DoctorID,
                    DoctorName,
                    DoctorType
                )
                values 
                (
                    '${insert_groupconsultation.insertId}',
                    "${req.user.UserID}",
                    "${req.user.Name}",
                    "主持"
                )
                `
                await exec(sql3)
                //锁死参与该次医生的时间
                let timeContent = '主持会诊号为' + insert_groupconsultation.insertId + '的视频会诊'
                let sql4 = `insert into time_schedule (StartTime,EndTime,TimeContent,TimeType,GPID,UserID) 
                values 
                (${req.body.startTime},${req.body.endTime},"${timeContent}",'视频会诊',${insert_groupconsultation.insertId},${req.user.UserID})`
                let addTimeID = await exec(sql4)
                //更新日程安排
                addSchedule(req.body.startTime, timeContent, req.user.UserID, addTimeID.insertId)
                //返回创建成功
                res.json({
                    status: 200,
                    msg: "会诊创建成功"
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "视频会诊创建失败，服务器报错",
                    err
                })
            }
        }
        startconsultation();
    })

//获取视频会诊申请列表
router.get('/consultationApplyList',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function consultationApplyList() {
            try {
                let sql1 = `update groupconsultation 
                set GroupConsutationStatus = '会诊已取消'
                where GroupConsultationEndDateTime < '${moment().format('YYYY-MM-DD HH:mm:ss')}' and 
                (GroupConsutationStatus = '等待患者确认' or GroupConsutationStatus = '待确认') 
                and GroupConsutationType = '视频会诊'`
                await exec(sql1)
                //查询临时表，某医生的申请表
                let sql = `select a.DoctorType,
                a.DoctorState,
                b.PatientID,
                b.PatientName,
                b.GroupConsutationSource as API_source,
                b.GroupConsultationApplicationDateTime,
                b.GroupConsultationID,
                b.HolderName,
                b.SeekMedicalAdviceID as pid
                from groupconsultation_tempdoctor as a left join groupconsultation as b
                on a.GroupConsultationID = b.GroupConsultationID 
                where a.DoctorID = '${req.user.UserID}'
                and ((b.GroupConsutationStatus = '待确认') or (b.GroupConsutationStatus = '等待患者确认' and a.DoctorState = '等待患者确认'))
                and a.DoctorState != '已拒绝'
                and b.GroupConsutationType = '视频会诊'`
                var consultationApplyList = await exec(sql)
                //返回创建成功
                res.json({
                    status: 200,
                    consultationApplyList
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "查询失败，服务器报错",
                    err
                })
            }
        }
        consultationApplyList();
    })

//医生同意或者拒绝参与某次会诊
router.post('/agree_consultation/:gid',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function agree_consultation() {
            try {
                if (req.body.state === '1') {
                    var state = '已同意'
                    //查询出该次会诊的时间
                    let sql3 = `select GroupConsultationStartDateTime,GroupConsultationEndDateTime from groupconsultation
                    where GroupConsultationID = ${req.params.gid};`
                    let groupConsultationTime = await exec(sql3)
                    console.log(groupConsultationTime)
                    let endDateTime = new Date(groupConsultationTime[0].GroupConsultationEndDateTime).getTime()
                    let startDateTime = new Date(groupConsultationTime[0].GroupConsultationStartDateTime).getTime()
                    //锁死参与该次医生的时间
                    let timeContent = '参与会诊号为' + req.params.gid + '的视频会诊'
                    let sql4 = `insert into time_schedule (StartTime,EndTime,TimeContent,TimeType,GPID,UserID) 
                    values 
                    (${startDateTime},${endDateTime},"${timeContent}",'视频会诊',${req.params.gid},${req.user.UserID})`
                    exec(sql4)
                    //将医生更新到会诊的表里面去
                    let sql1 = `insert into groupconsultationdoctor 
                    (
                        GroupConsultationID,
                        DoctorID,
                        DoctorName,
                        DoctorType
                    )
                    values 
                    (
                        "${req.params.gid}",
                        "${req.user.UserID}",
                        "${req.user.Name}",
                        "参与"
                    )
                    `
                    await exec(sql1)
                } else {
                    var state = '已拒绝'
                }
                //更新医生状态
                let sql = `update groupconsultation_tempdoctor set DoctorState = '${state}'
                where GroupConsultationID = ${req.params.gid} and DoctorID = ${req.user.UserID}`
                await exec(sql)
                //医生接收拒绝情况
                let sql2 = `select 
                DoctorID
                from groupconsultation_tempdoctor 
                where GroupConsultationID = '${req.params.gid}'
                `
                let person = await exec(sql2)
                for (let person_i = 0; person_i < person.length; person_i++) {
                    let obj = {
                        toid: person[person_i].DoctorID,
                        fromid: req.user.UserID,
                        msg: req.user.UserID + state
                    }
                    socket.emit('agreeVideoConsultation', obj)
                }
                //返回创建成功
                res.json({
                    status: 200,
                    msg: '成功'
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "失败，服务器报错",
                    err
                })
            }
        }
        agree_consultation();
    })


//某次会诊中医生参与拒绝具体的情况
router.get('/groupconsultation_detail/:gid',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function groupconsultation_detail() {
            try {
                //会诊信息
                var consultationId = req.params.gid
                //查询出所有的会诊数据
                var sql = `select 
                a.GroupConsutationReason as reason,
                a.GroupConsultationApplicationDateTime as applicationDateTime,
                a.GroupConsultationStartDateTime as startTime,
                a.GroupConsultationEndDateTime as endTime,
                a.GroupConsutationStatus as state,
                a.GroupConsutationType as type,
                a.HolderID as holderID,
                a.HolderName as holderName,
                b.Image as holderImage
                from groupconsultation as a left join users as b
                on a.holderID = b.UserID
                where a.GroupConsultationID = '${consultationId}'
                `
                var GroupConsutation_info = await exec(sql)
                if ("holderID" in GroupConsutation_info[0]) {
                    if (GroupConsutation_info[0].holderID === req.user.UserID) {
                        GroupConsutation_info[0]['participateType'] = '主持'
                    } else {
                        GroupConsutation_info[0]['participateType'] = '参与'
                    }
                }
                //查询出所有的会诊数据
                var sql2 = `select 
                GroupConsutationPerson
                from groupconsultation 
                where GroupConsultationID = '${consultationId}'
                `
                var GroupConsutationPerson = await exec(sql2)
                //console.log(GroupConsutationPerson)
                if ("GroupConsutationPerson" in GroupConsutationPerson[0]) {
                    GroupConsutationPerson = JSON.parse(GroupConsutationPerson[0].GroupConsutationPerson)
                } else {
                    GroupConsutationPerson = []
                }
                //医生接收拒绝情况
                let sql1 = `select 
                DoctorID,
                DoctorImage,
                DoctorName,
                DoctorState,
                DoctorType
                from groupconsultation_tempdoctor 
                where GroupConsultationID = '${consultationId}'
                `
                let person = await exec(sql1)
                var person_obj = {}
                for (let person_i = 0; person_i < person.length; person_i++) {
                    person_obj[person[person_i].DoctorID] = person[person_i].DoctorState
                }

                //更改专家状态
                if ("groups" in GroupConsutationPerson) {
                    let groups = GroupConsutationPerson.groups
                    for (let groups_i = 0; groups_i < groups.length; groups_i++) {
                        let experts = groups[groups_i].experts
                        for (let experts_i = 0; experts_i < experts.length; experts_i++) {
                            experts[experts_i]["state"] = person_obj[experts[experts_i].expId]
                        }
                    }
                }
                //插入医生
                if ("orgs" in GroupConsutationPerson) {
                    let orgs = GroupConsutationPerson.orgs
                    for (let orgs_i = 0; orgs_i < orgs.length; orgs_i++) {
                        let doctors = orgs[orgs_i].doctors
                        for (let doctors_i = 0; doctors_i < doctors.length; doctors_i++) {
                            doctors[doctors_i]["state"] = person_obj[doctors[doctors_i].docId]
                        }
                    }
                }
                //医生接收拒绝详情
                let sql3 = `select 
                DoctorID,
                DoctorImage,
                DoctorName,
                DoctorState,
                DoctorType
                from groupconsultation_tempdoctor 
                where GroupConsultationID = '${consultationId}' and DoctorType = '参与'
                `
                let person2 = await exec(sql3)
                if (req.user.UserID in person_obj) {
                    var userState = person_obj[req.user.UserID]
                } else {
                    var userState = '主持人'
                }
                //返回创建成功
                res.json({
                    status: 200,
                    GroupConsutation_info: GroupConsutation_info[0],
                    GroupConsutationPerson,
                    person: person2,
                    userState: userState
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "失败，服务器报错",
                    err
                })
            }
        }
        groupconsultation_detail();
    })


//主持人确认某次会诊
router.post('/confirm_consultation/:gid',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function confirm_consultation() {
            try {
                if (req.body.state === '1') {
                    var state = '未开始'
                    //创建会议
                    let sql1 = `select GroupConsultationStartDateTime,GroupConsultationEndDateTime,PatientID,GroupConsutationReason from groupconsultation where GroupConsultationID = '${req.params.gid}'`
                    let endTime = await exec(sql1)
                    console.log(endTime)
                    //插入视频会诊信息
                    creatCall(endTime[0].GroupConsultationEndDateTime,endTime[0].GroupConsutationReason,req.params.gid)
                } else {
                    var state = '会诊已取消'
                    let sql3 = `select TimePlanID from time_schedule where GPID = '${req.params.gid}' and TimeType = '视频会诊';`
                    let timePlanID = await exec(sql3)
                    cancelSchedule(timePlanID[0].TimePlanID)
                    //解绑参与会议的医生的时间
                    let sql2 = `delete from time_schedule where GPID = '${req.params.gid}' and TimeType = '视频会诊';`
                    await exec(sql2)
                }
                //更新医生状态
                let sql = `update groupconsultation set GroupConsutationStatus = '${state}'
                where GroupConsultationID = '${req.params.gid}' `
                await exec(sql)
                //返回创建成功
                res.json({
                    status: 200,
                    msg: '成功'
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "失败，服务器报错",
                    err
                })
            }
        }
        confirm_consultation();
    })


//获取我的视频会诊列表
router.get('/myConsultationList',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function myConsultationList() {
            try {
                var sql1 = `update groupconsultation 
                set GroupConsutationStatus = '待总结'
                where GroupConsultationEndDateTime < '${moment().format('YYYY-MM-DD HH:mm:ss')}' and 
                (GroupConsutationStatus = '未开始' or GroupConsutationStatus = '会诊中')
                and GroupConsutationType = '视频会诊'`
                await exec(sql1)
                var sql2 = `update groupconsultation 
                set GroupConsutationStatus = '会诊中'
                where GroupConsultationEndDateTime > '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                and GroupConsultationStartDateTime < '${moment().format('YYYY-MM-DD HH:mm:ss')}'
                and GroupConsutationStatus = '未开始'
                and GroupConsutationType = '视频会诊'`
                await exec(sql2)
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
                and (b.GroupConsutationStatus = '会诊中' or b.GroupConsutationStatus = '未开始' or b.GroupConsutationStatus = '待总结' )
                and b.GroupConsutationType = '视频会诊'`
                var consultationlist = await exec(sql)
                //返回创建成功
                res.json({
                    status: 200,
                    consultationlist
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "查询失败，服务器报错",
                    err
                })
            }
        }
        myConsultationList();
    })


//获取历史视频会诊列表
router.get('/historyConsultationList',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function historyConsultationList() {
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
                and b.GroupConsutationType = '视频会诊'`
                var historyConsultationList = await exec(sql)
                //返回创建成功
                res.json({
                    status: 200,
                    historyConsultationList
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "查询失败，服务器报错",
                    err
                })
            }
        }
        historyConsultationList();
    })



//根据会诊ID查询会议号
router.get('/groupConsultationInfo/:gid',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function groupConsultationInfo() {
            try {
                var sql = `select 
                GroupConsutationVideoURL as huiyiSrc,
                GroupConsutationVideoID as huiyiId,
                GroupConsutationVideoPassword as huiyiMima
                from groupconsultation
                where GroupConsultationID = '${req.params.gid}'`
                var groupConsultationInfo = await exec(sql)
                //返回创建成功
                res.json({
                    status: 200,
                    groupConsultationInfo: groupConsultationInfo[0]
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "查询失败，服务器报错",
                    err
                })
            }
        }
        groupConsultationInfo();
    })


//判断该医生是否有时间参与视频会诊
router.post('/timeConfirm',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function timeConfirm() {
            try {
                console.log(req.body)
                let startTime = req.body.startTime
                //startTime = formatDate(startTime)
                let endTime = req.body.endTime
                //endTime = formatDate(endTime)
                //console.log(startTime,endTime)
                let UserID = req.user.UserID
                //查询该医生时间占用的数据
                var sql = `select 
                a.GroupConsultationID,
                b.GroupConsultationStartDateTime,
                b.GroupConsultationEndDateTime
                from groupconsultation_tempdoctor as a right join 
                groupconsultation as b
                on a.GroupConsultationID = b.GroupConsultationID
                where 
                    a.DoctorID = '${req.user.UserID}' 
                and b.GroupConsultationEndDateTime > '${moment().format('YYYY-MM-DD HH:mm:ss')}'
                and (
                        (a.DoctorState = '已同意') and 
                        (b.GroupConsutationStatus = '未开始' 
                        or 
                        b.GroupConsutationStatus = '待总结'
                        or 
                        b.GroupConsutationStatus = '会诊中'
                        )
                    ) 
                and GroupConsutationType = '视频会诊'`
                /**
                 * 以前的sql（医生时间占用选用的条件苛刻，患者确认即扣除时间，现在的改成了医生确认才扣时间）
                 *                 var sql = `select 
                a.GroupConsultationID,
                b.GroupConsultationStartDateTime,
                b.GroupConsultationEndDateTime
                from groupconsultation_tempdoctor as a right join 
                groupconsultation as b
                on a.GroupConsultationID = b.GroupConsultationID
                where 
                    a.DoctorID = '${req.user.UserID}' 
                and b.GroupConsultationEndDateTime > '${moment().format('YYYY-MM-DD HH:mm:ss')}'
                and (
                        (a.DoctorState = '已同意') and 
                        (b.GroupConsutationStatus = '未开始' or b.GroupConsutationStatus = '待总结')
                    ) 
                    or (
                        (a.DoctorState = '待确认' or a.DoctorState = '等待患者确认') and 
                        (b.GroupConsutationStatus = '未开始' or b.GroupConsutationStatus = '等待患者确认' 
                        or b.GroupConsutationStatus = '待确认' or b.GroupConsutationStatus = '待总结' 
                        or b.GroupConsutationStatus = '会诊中')
                )
                and GroupConsutationType = '视频会诊'`
                 */
                var groupConsultationInfo = await exec(sql)
                console.log(groupConsultationInfo)
                let count = 0
                for (i in groupConsultationInfo) {
                    GroupConsultationEndDateTime = new Date(groupConsultationInfo[i].GroupConsultationEndDateTime).getTime()
                    GroupConsultationStartDateTime = new Date(groupConsultationInfo[i].GroupConsultationStartDateTime).getTime()
                    console.log(GroupConsultationEndDateTime)
                    console.log(GroupConsultationStartDateTime)
                    //条件不满足的GID,在做时间判断
                    if (
                        (((GroupConsultationEndDateTime) > startTime) && (GroupConsultationStartDateTime < startTime)) ||
                        ((GroupConsultationEndDateTime > endTime) && (GroupConsultationStartDateTime < endTime)) ||
                        ((GroupConsultationEndDateTime > startTime) && (GroupConsultationStartDateTime < endTime))
                    ) {
                        count++
                    }
                }
                if (count === 0) {
                    res.json({
                        status: 200,
                        state: 1     //有时间
                    })
                } else {
                    res.json({
                        status: 200,
                        state: 0
                    })
                }
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "失败，服务器报错",
                    err
                })
            }
        }
        timeConfirm();
    })


//视频会诊自动布局
router.post('/layout',
    (req, res) => {
        async function layout() {
            try {
                console.log(req.body)
                layOut(req.body.nid)
                res.json({
                    msg: "成功",
                    status: 200
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "失败，服务器报错",
                    err
                })
            }
        }
        layout();
    })




module.exports = router;