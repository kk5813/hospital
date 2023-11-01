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
//获取本地时区
moment.locale('zh-cn');


// JWT鉴权
var jwtConfig = require("../utils/jwtAuth.js").jwtConfigAuth;
passport.use(jwtConfig);



// //查询聊天信息
// router.post('/', 
// passport.authenticate("jwt", { session: false }),
//     (req, res) => {
//         async function chatinfo() {
//             try {
//                 // {
//                 //     fromid:    //聊天对象的id

//                 // }
//                     var sql1 = `select message,type,req_datetime from message where
//                     fromid = ${req.body.fromid} and toid = ${req.user.UserID}
//                     `
//                     var sql2 = `select message,type,req_datetime from message where
//                     toid = ${req.body.fromid} and fromid = ${req.user.UserID}
//                     `
//                     var left_chat = await exec(sql2)
//                     var right_chat = await exec(sql1)
//                     res.json({
//                         status:200,
//                         msg:"ok",
//                         left_chat:left_chat,
//                         right_chat:right_chat
//                     })
//                     }catch(err) {
//                         console.log(err)
//                             res.json({
//                                 status:0,
//                                 msg:"上传失败"
//                             })
//                           }
//                     }
//                     chatinfo();      
// })


//查询聊天信息
router.post('/',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function chatinfo() {
            try {
                var pid = req.body.pid
                //查询出与该医生角色相关的所有人的基础信息
                var sql1 = `select a.RecommendDoctorID as ID,a.RecommendDoctorName as Name,b.Image from seekmedical_after_treatment_doctor as a left join users as b 
                    on a.RecommendDoctorID = b.UserID
                     where SeekMedicalAdviceID = "${pid}"`
                var sql2 = `select a.RecommendNurseID as ID,a.RecommendNurseName as Name,b.Image
                    from seekmedical_after_treatment_nurse as a left join users as b
                    on a.RecommendNurseID = b.UserID
                     where SeekMedicalAdviceID = "${pid}"`
                var sql3 = `select a.PatientID as ID,a.PatientName as Name,b.Image
                    from seekmedicaladvice as a left join users as b
                    on a.PatientID = b.UserID
                    where SeekMedicalAdviceID = "${pid}"`
                var sql4 = `select a.CureDoctorID as ID,b.Name,b.Image from seekmedicaladvice as a left join users as b on a.CureDoctorID = b.UserID
                    where SeekMedicalAdviceID = "${pid}"`
                //定义一个聊天大数组
                var chat = []
                //医生的聊天
                var Doctor = await exec(sql1)
                console.log(Doctor)
                for (Doctorkey in Doctor) {
                    var chat_info = {}
                    var chat_user1 = Doctor[Doctorkey].ID
                    var chat_user2 = req.user.UserID
                    if (chat_user1 !== chat_user2) {
                        var sql = `select
                                        fromid,
                                        toid,
                                        message,
                                        res_datetime as msgtime,
                                        type
                                        from message 
                                        where ((fromid = '${chat_user1}' and toid = '${chat_user2}')
                                        or (fromid = '${chat_user2}' and toid = '${chat_user1}'))
                                        and pid = '${pid}'
                                        order by msgtime`
                        var messages = await exec(sql)
                        var user = {
                            "name": Doctor[Doctorkey].Name,
                            "img": Doctor[Doctorkey].Image,
                            "role": "医生"
                        }
                        chat_info["messages"] = messages
                        chat_info["user"] = user
                        chat_info["id"] = chat_user1
                        chat.push(chat_info)

                    } else {
                        //当用户是自己的时候，就直接忽略
                        continue;
                    }
                }
                //护士的聊天
                var Nurse = await exec(sql2)
                for (Nursekey in Nurse) {
                    var chat_info = {}
                    var chat_user1 = Nurse[Nursekey].ID
                    var chat_user2 = req.user.UserID
                    if (chat_user1 !== chat_user2) {
                        var sql = `select
                                        fromid,
                                        toid,
                                        message,
                                        res_datetime as msgtime,
                                        type
                                        from message 
                                        where ((fromid = '${chat_user1}' and toid = '${chat_user2}')
                                        or (fromid = '${chat_user2}' and toid = '${chat_user1}'))
                                        and pid = '${pid}' and chat = 'chat'
                                        order by msgtime`
                        var messages = await exec(sql)
                        var user = {
                            "name": Nurse[Nursekey].Name,
                            "img": Nurse[Nursekey].Image,
                            "role": "护士"
                        }
                        chat_info["messages"] = messages
                        chat_info["user"] = user
                        chat_info["id"] = chat_user1
                        chat.push(chat_info)

                    } else {
                        //当用户是自己的时候，就直接忽略
                        continue;
                    }
                }
                //与患者的聊天
                var Patient = await exec(sql3)
                for (Patientkey in Patient) {
                    var chat_info = {}
                    var chat_user1 = Patient[Patientkey].ID
                    var chat_user2 = req.user.UserID
                    if (chat_user1 !== chat_user2) {
                        var sql = `select
                                        fromid,
                                        toid,
                                        message,
                                        res_datetime as msgtime,
                                        type
                                        from message 
                                        where ((fromid = '${chat_user1}' and toid = '${chat_user2}')
                                        or (fromid = '${chat_user2}' and toid = '${chat_user1}'))
                                        and pid = '${pid}' and chat = 'chat'
                                        order by msgtime`
                        var messages = await exec(sql)
                        var user = {
                            "name": Patient[Patientkey].Name,
                            "img": Patient[Patientkey].Image,
                            "role": "患者"
                        }
                        chat_info["messages"] = messages
                        chat_info["user"] = user
                        chat_info["id"] = chat_user1
                        chat.push(chat_info)

                    } else {
                        //当用户是自己的时候，就直接忽略
                        continue;
                    }
                }
                //与专家的聊天
                var CureDoctor = await exec(sql4)
                for (CureDoctorkey in CureDoctor) {
                    var chat_info = {}
                    var chat_user1 = CureDoctor[CureDoctorkey].ID
                    var chat_user2 = req.user.UserID
                    if (chat_user1 !== chat_user2) {
                        var sql = `select
                                        fromid,
                                        toid,
                                        message,
                                        res_datetime as msgtime,
                                        type
                                        from message 
                                        where ((fromid = '${chat_user1}' and toid = '${chat_user2}')
                                        or (fromid = '${chat_user2}' and toid = '${chat_user1}'))
                                        and pid = '${pid}' and chat = 'chat'
                                        order by msgtime`
                        var messages = await exec(sql)
                        var user = {
                            "name": CureDoctor[CureDoctorkey].Name,
                            "img": CureDoctor[CureDoctorkey].Image,
                            "role": "专家"
                        }
                        chat_info["messages"] = messages
                        chat_info["user"] = user
                        chat_info["id"] = chat_user1
                        chat.push(chat_info)

                    } else {
                        //当用户是自己的时候，就直接忽略
                        continue;
                    }
                }
                res.json({
                    status: 200,
                    msg: "ok",
                    chat
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "获取消息失败"
                })
            }
        }
        chatinfo();
    })

//查询状态
router.get('/seekmedicalstate/:pid',
    //passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function seekmedseeicalstate() {
            try {
                var pid = req.params.pid
                //查询患者就诊状态
                var sql1 = `select SeekMedicalAdviceStatus,SeekMedicalState,ToHospitalAssessment,ToTreatmentlAssessment
                    from seekmedicaladvice where SeekMedicalAdviceID = "${pid}"
                    `
                var state = await exec(sql1)
                var seekmedseeicalstate = "无此状态"
                console.log("state：", state)
                if ("SeekMedicalAdviceStatus" in state[0]) {
                    if (state[0].SeekMedicalAdviceStatus === "申请中") {
                        seekmedseeicalstate = "0"     // "就诊申请中"
                    } else if (state[0].SeekMedicalAdviceStatus === "未完成") {
                        seekmedseeicalstate = "1"  //"专家就诊中"
                    } else if (state[0].SeekMedicalAdviceStatus === "已完成" && state[0].ToHospitalAssessment === '0') {
                        seekmedseeicalstate = "2"  //"专家已给出诊断结论，等待护士评估中"
                    } else if (state[0].SeekMedicalAdviceStatus === "已完成" && state[0].ToHospitalAssessment === '1' && state[0].ToTreatmentlAssessment === '0') {
                        seekmedseeicalstate = "3"  //"等待医生治疗，护士已完成评估"
                    } else if (state[0].SeekMedicalAdviceStatus === "已完成" && state[0].ToHospitalAssessment === '1' && state[0].ToTreatmentlAssessment === '1' && state[0].SeekMedicalState !== "已完成") {
                        seekmedseeicalstate = "4"  //"医生治疗方案、护士评估已给出,正在住院治疗"
                    } else if (state[0].SeekMedicalState === "已完成") {
                        seekmedseeicalstate = "5" //"就诊已经结束"
                    }
                }
                res.json({
                    status: 200,
                    seekmedseeicalstate: seekmedseeicalstate
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "获取失败"
                })
            }
        }
        seekmedseeicalstate();
    })

//查询会诊聊天信息
router.post('/consultation',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function consultation() {
            try {
                var gid = req.body.cid
                //查询出与该医生角色相关的所有人的基础信息
                //查询关联医生
                var sql1 = `select a.DoctorID as ID,a.DoctorName as Name,b.Image,a.DoctorType
                    from groupconsultationdoctor as a left join users as b 
                    on a.DoctorID = b.UserID
                     where GroupConsultationID = "${gid}"`
                //查询关联患者
                var sql3 = `select a.PatientID as ID,a.PatientName as Name,b.Image,a.SeekMedicalAdviceID
                    from groupconsultation as a left join users as b
                    on a.PatientID = b.UserID
                    where GroupConsultationID = "${gid}"`
                //定义一个聊天大数组
                var chat = []
                //医生的聊天
                let Doctor = await exec(sql1)
                for (Doctorkey in Doctor) {
                    var chat_info = {}
                    var chat_user1 = Doctor[Doctorkey].ID
                    var chat_user2 = req.user.UserID
                    if (chat_user1 !== chat_user2) {
                        var sql = `select
                                        fromid,
                                        toid,
                                        message,
                                        res_datetime as msgtime,
                                        type,
                                        pid,
                                        GroupConsultationID,
                                        consultationType
                                        from message 
                                        where ((fromid = '${chat_user1}' and toid = '${chat_user2}')
                                        or (fromid = '${chat_user2}' and toid = '${chat_user1}'))
                                        and GroupConsultationID = '${gid}'
                                        and chat = 'chat'
                                        order by msgtime`
                        var messages = await exec(sql)
                        var user = {
                            "name": Doctor[Doctorkey].Name,
                            "img": Doctor[Doctorkey].Image,
                            "role": Doctor[Doctorkey].DoctorType
                        }
                        chat_info["messages"] = messages
                        chat_info["user"] = user
                        chat_info["id"] = chat_user1
                        chat.push(chat_info)

                    } else {
                        //当用户是自己的时候，就直接忽略
                        continue;
                    }
                }
                //与患者的聊天
                let Patient = await exec(sql3)
                for (Patientkey in Patient) {
                    var chat_info = {}
                    var chat_user1 = Patient[Patientkey].ID
                    var chat_user2 = req.user.UserID
                    if (chat_user1 !== chat_user2) {
                        var sql = `select
                                        fromid,
                                        toid,
                                        message,
                                        res_datetime as msgtime,
                                        type,
                                        pid,
                                        GroupConsultationID,
                                        consultationType
                                        from message 
                                        where ((fromid = '${chat_user1}' and toid = '${chat_user2}')
                                        or (fromid = '${chat_user2}' and toid = '${chat_user1}'))
                                        and chat = 'chat'
                                        and pid = '${Patient[0].SeekMedicalAdviceID}'
                                        order by msgtime`
                        var messages = await exec(sql)
                        var user = {
                            "name": Patient[Patientkey].Name,
                            "img": Patient[Patientkey].Image,
                            "role": "患者"
                        }
                        chat_info["messages"] = messages
                        chat_info["user"] = user
                        chat_info["id"] = chat_user1
                        chat.push(chat_info)

                    } else {
                        //当用户是自己的时候，就直接忽略
                        continue;
                    }
                }
                res.json({
                    status: 200,
                    msg: "ok",
                    chat
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "获取消息失败"
                })
            }
        }
        consultation();
    })



module.exports = router;