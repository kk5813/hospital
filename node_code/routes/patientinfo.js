var express = require('express');
var app = express();
var router = express.Router();
const {exec} = require('../db/config.js');
const passport = require('passport');
const query = require('../db/mysql.js');
//转换时间格式函数
const formatDate = require('../time/formatetime.js');
var moment = require('moment');
//获取本地时区
moment.locale('zh-cn');

// JWT鉴权
var jwtConfig = require("../utils/jwtAuth.js").jwtConfigAuth;
passport.use(jwtConfig);

//患者基本信息
router.get('/', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {
    var sql = ` select LoginDateTime,LoginState,Name,Phone,IdentityID,IdentityType 
    from users where UserID in 
    (select PatientID from patient_doctor where DoctorID="${req.user.UserID}") `
    return exec(sql).then(result => {
            console.log("doctor_id:",req.user.UserID)
            //console.log(result)
            res.json({ 
                result
            })       
    })    
})
//注册人员详细信息
router.get('/registerlist', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
        //医生的情况下
        var device =2
        var sql00 = `select 
        c.Name as PatientName,
        c.UserID,
        c.Gender,
        TIMESTAMPDIFF(YEAR, c.Birthday, CURDATE()) as Age,
        c.Phone,
        c.Address
        from users as c
        where c.RegisterDevice = '${device}'`
        var registerlist = await exec(sql00)
    res.json({ 
        registerlist,
        status:200
    })
})
//查询新添加的患者列表总数（暂时只能查到自己添加的用户）
router.post('/addPatientListSum', 
passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function addPatientListSum(){
        try{var surName=req.body.surName
            var gender=req.body.gender
            var Address=req.body.Address
            var NewDiagnosis=req.body.NewDiagnosis
            var maxyear=req.body.maxyear
            var minyear=req.body.minyear
            var uname = req.body.name
            var uorganzation = req.body.organization
            var importname = req.body.importname
            var startdate = req.body.startDate
            var enddate = req.body.endDate
            var iphone=req.body.iphone
            let filter = surName !==null || '' ? ` and a.Name like concat('${surName}','%')`:''
            filter+= gender!==null ||''?` and a.Gender='${gender}'`:''
            filter+=Address !==null ||'' ?` and a.Address like concat('%','${Address}','%')`:''
            filter+=NewDiagnosis!==null||'' ?` and a.NewDiagnosis like concat('%','${NewDiagnosis}','%')`:''
            filter+=maxyear!==null||''?` and a.Birthday between '${maxyear}' and '${minyear}'`:''
            filter+=uname!==null||'' ?` and a.Name ='${uname}'`:''
            filter+=uorganzation!==null||'' ?` and a.HospitalID= '${uorganzation}'`:''
            filter+=importname!==null||'' ?` and aa.Name= '${importname}'`:''
            filter+=startdate!==null||'' ?` and a.CreatTime >='${startdate}'`:''
            filter+=enddate!==null||'' ?` and a.CreatTime <= '${enddate}'`:''
            filter+=iphone!==null||'' ?` and a.Phone = '${iphone}'`:''
            var sql3 = `select RoleID from user_role 
            where UserID = '${req.user.UserID}' and RoleID =80;`
            isRoleID = await exec(sql3)
            if(isRoleID.length === 0){
         
            var sql = `select count(*)
            from users as a 
            left join user_role as b on a.UserID = b.UserID 
            left join hospital as h on a.HospitalID = h.HospitalID
            left join users as aa on a.ImportUserID=aa.UserID
            where b.RoleID = 10 and a.HospitalID='${req.user.HospitalID}'`+filter
            var sum = await exec(sql)
            res.json({ 
                sum,
                status:200
            })
            }else{
            var sql = `select count(*)
            from users as a left join user_role as b on a.UserID = b.UserID 
            left join hospital as h on a.HospitalID = h.HospitalID
            left join users as aa on a.ImportUserID=aa.UserID
            where b.RoleID = 10 and a.HospitalID>0`+filter
          
            var sum = await exec(sql)
            res.json({ 
                sum,
                status:200
            })
            }
        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    addPatientListSum()         
})
//查询新添加的患者列表（暂时只能查到自己添加的用户）
router.post('/addPatientList', 
passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function addPatientList(){
        try{
            var surName=req.body.surName
            var gender=req.body.gender
            var Address=req.body.Address
            var NewDiagnosis=req.body.NewDiagnosis
            var maxyear=req.body.maxyear
            var minyear=req.body.minyear
            var uname = req.body.name
            var uorganzation = req.body.organization
            var importname = req.body.importname
            var startdate = req.body.startDate
            var enddate = req.body.endDate
            var iphone=req.body.iphone
             var pagesize = req.body.pagesize
             var page = (req.body.page-1)*pagesize
             let filter = surName !==null || '' ? ` and a.Name like concat('${surName}','%')`:''
            filter+= gender!==null ||''?` and a.Gender='${gender}'`:''
            filter+=Address !==null ||'' ?` and a.Address like concat('%','${Address}','%')`:''
            filter+=NewDiagnosis!==null||'' ?` and a.NewDiagnosis like concat('%','${NewDiagnosis}','%')`:''
            filter+=maxyear!==null||''?` and a.Birthday between '${maxyear}' and '${minyear}'`:''
            filter+=uname!==null||'' ?` and a.Name ='${uname}'`:''
            filter+=uorganzation!==null||'' ?` and a.HospitalID= '${uorganzation}'`:''
            filter+=importname!==null||'' ?` and aa.Name= '${importname}'`:''
            filter+=startdate!==null||'' ?` and a.CreatTime >='${startdate}'`:''
            filter+=enddate!==null||'' ?` and a.CreatTime <= '${enddate}'`:''
            filter+=iphone!==null||'' ?` and a.Phone = '${iphone}'`:''
             console.log(page)
             console.log(pagesize)
             console.log(iphone)
            var sql3 = `select RoleID from user_role 
            where UserID = '${req.user.UserID}' and RoleID =80;`
            isRoleID = await exec(sql3)
            if(isRoleID.length === 0){
            var sql = `select a.UserID as PatientID,
            a.Name as PatientName,
            a.Gender,
            a.Address,
            TIMESTAMPDIFF(YEAR,IFNULL(a.Birthday,NOW()), CURDATE()) as Age,
            a.Job,
            a.NewDiagnosis,
            a.CreatTime,
            a.ModifyTime,
            a.ModifyUser,
            h.HospitalName,
            a.Phone,
            aa.Name from users as a 
            left join user_role as b on a.UserID = b.UserID 
            left join hospital as h on a.HospitalID = h.HospitalID
            left join users as aa on a.ImportUserID=aa.UserID
            where b.RoleID = 10 and a.HospitalID='${req.user.HospitalID}'`+filter+` limit ${page},${pagesize};`
            console.log(sql)
            var Patient_info = await exec(sql)
            res.json({ 
                Patient_info,
                status:200
            })
            }else{
            var sql = `select a.UserID as PatientID,
            a.Name as PatientName,
            a.Gender,
            a.Address,
            TIMESTAMPDIFF(YEAR,IFNULL(a.Birthday,NOW()), CURDATE()) as Age,
            a.Job,
            a.NewDiagnosis,
            a.CreatTime,
            a.ModifyTime,
            a.ModifyUser,
            h.HospitalName,
            a.Phone,
            aa.Name from users as a left join user_role as b
            on a.UserID = b.UserID 
            left join hospital as h on a.HospitalID = h.HospitalID
            left join users as aa on a.ImportUserID=aa.UserID
            where b.RoleID = 10 and a.HospitalID>0 `+filter+` limit ${page},${pagesize};`
            console.log(sql)
            var Patient_info = await exec(sql)
            res.json({ 
                Patient_info,
                status:200
            })
            }
        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    addPatientList()         
})
//查询新添加的患者列表总数（暂时只能查到自己添加的用户）
router.post('/addPatientListSum1', 
passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function addPatientListSum1(){
        try{
            var sql = ` select RoleID from user_role where UserID = '${req.user.UserID}'`
            let Role = await exec(sql) 
            var surName=req.body.surName
            var gender=req.body.gender
            var Address=req.body.Address
            var NewDiagnosis=req.body.NewDiagnosis
            var maxyear=req.body.maxyear
            var minyear=req.body.minyear
            var uname = req.body.name
            var uorganzation = req.body.organization
            var type = req.body.type
            var iphone=req.body.iphone
            var startdate = req.body.startDate
            var enddate = req.body.endDate
            let filter = surName !==null || '' ? ` and c.Name like concat('${surName}','%')`:''
            filter+= gender!==null ||''?` and c.Gender='${gender}'`:''
            filter+=Address !==null ||'' ?` and c.Address like concat('%','${Address}','%')`:''
            filter+=NewDiagnosis!==null||'' ?` and c.NewDiagnosis like concat('%','${NewDiagnosis}','%')`:''
            filter+=maxyear!==null||''?` and c.Birthday between '${maxyear}' and '${minyear}'`:''
            filter+=uname!==null||'' ?` and c.Name ='${uname}'`:''
            filter+=uorganzation!==null||'' ?` and c.HospitalID= '${uorganzation}'`:''
            filter+=iphone!==null||'' ?` and c.Phone = '${iphone}'`:''
           if(type==1){
            if(Role[0].RoleID === 40){
         
                var sql = `select count(*)
                from seekmedical_after_treatment_doctor as a 
            left join seekmedicaladvice as b on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c on b.PatientID = c.UserID
            left join hospital as h on c.HospitalID = h.HospitalID
            where a.RecommendDoctorID = '${req.user.UserID}'
            and b.SeekMedicalState = '已完成'`+filter
                var sum = await exec(sql)
                res.json({ 
                    sum,
                    status:200
                })
                }else if(Role[0].RoleID === 60){
                var sql = `select count(*)
                from seekmedicaladvice as b 
                left join users as c on b.PatientID = c.UserID
                left join hospital as h on c.HospitalID = h.HospitalID
                where b.CureDoctorID = '${req.user.UserID}'
                and b.SeekMedicalState = '已完成'`+filter
                console.log(sql)
                var sum = await exec(sql)
                console.log(sum)
                res.json({ 
                    sum,
                    status:200
                })
                }else if(Role[0].RoleID === 20){
                    var sql = `select count(*)
                    from seekmedical_after_treatment_nurse as a 
            left join seekmedicaladvice as b on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as c on b.PatientID = c.UserID
            left join hospital as h on c.HospitalID = h.HospitalID
            where a.RecommendNurseID = '${req.user.UserID}'
            and b.SeekMedicalState = '已完成'`+filter
                  
                    var sum = await exec(sql)
                    res.json({ 
                        sum,
                        status:200
                    })
                    }else{
                        var sum = 0
                        res.json({ 
                            sum,
                            status:200
                        })
                        }
           }else if(type==2){
            if(Role[0].RoleID === 40){
         
                var sql = `select count(*)
                from users as c left join user_role as b
            on c.UserID = b.UserID left join hospital as h on c.HospitalID = h.HospitalID
            where b.RoleID = 10 and c.ImportUserID='${req.user.UserID}''
            and b.SeekMedicalState = '已完成'`+filter
                var sum = await exec(sql)
                res.json({ 
                    sum,
                    status:200
                })
                }else if(Role[0].RoleID === 60){
                var sql = `select count(*)
                from users as c left join user_role as b
            on c.UserID = b.UserID left join hospital as h on c.HospitalID = h.HospitalID
            where b.RoleID = 10 and c.ImportUserID='${req.user.UserID}'`+filter
              
                var sum = await exec(sql)
                res.json({ 
                    sum,
                    status:200
                })
                }else if(Role[0].RoleID === 20){
                    var sql = `select count(*)
                    from users as c left join user_role as b
            on c.UserID = b.UserID left join hospital as h on c.HospitalID = h.HospitalID
            where b.RoleID = 10 and c.ImportUserID='${req.user.UserID}'`+filter
                  
                    var sum = await exec(sql)
                    res.json({ 
                        sum,
                        status:200
                    })
                    }else{
                        var sql = `select count(*)
                        from users as c left join user_role as b
            on c.UserID = b.UserID left join hospital as h on c.HospitalID = h.HospitalID
            where b.RoleID = 10 and c.ImportUserID='${req.user.UserID}'`+filter
                      
                        var sum = await exec(sql)
                        res.json({ 
    
                            sum,
                            status:200
                        })
                        }
           }

        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    addPatientListSum1()         
})
//查询某医生下所有已完成就诊的患者的信息
router.post('/patientlist', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    var sql = ` select RoleID from user_role where UserID = '${req.user.UserID}'`
    let Role = await exec(sql) 
    var surName=req.body.surName
            var gender=req.body.gender
            var Address=req.body.Address
            var NewDiagnosis=req.body.NewDiagnosis
            var maxyear=req.body.maxyear
            var minyear=req.body.minyear
            var uname = req.body.name
            var uorganzation = req.body.organization
            var type = req.body.type
            var iphone=req.body.iphone
            var startdate = req.body.startDate
            var enddate = req.body.endDate
             let filter = surName !==null || '' ? ` and a.Name like concat('${surName}','%')`:''
            filter+= gender!==null ||''?` and a.Gender='${gender}'`:''
            filter+=Address !==null ||'' ?` and a.Address like concat('%','${Address}','%')`:''
            filter+=NewDiagnosis!==null||'' ?` and a.NewDiagnosis like concat('%','${NewDiagnosis}','%')`:''
            filter+=maxyear!==null||''?` and a.Birthday between '${maxyear}' and '${minyear}'`:''
            filter+=uname!==null||'' ?` and a.Name ='${uname}'`:''
            filter+=uorganzation!==null||'' ?` and a.HospitalID= '${uorganzation}'`:''
            filter+=iphone!==null||'' ?` and a.Phone = '${iphone}'`:''
    var pagesize = req.body.pagesize
    var page = (req.body.page-1)*pagesize
    console.log(type)
    //根据角色判断
    if(type==1){
        if(Role[0].RoleID === 40){
            //医生的情况下
            var sql00 = `select 
            b.PatientID,
            a.Name as PatientName,
            a.Gender,
            a.Address,
            TIMESTAMPDIFF(YEAR, a.Birthday, CURDATE()) as Age,
            a.Phone,
            h.HospitalName,
            a.IdenttityType
            from seekmedical_after_treatment_doctor as a 
            left join seekmedicaladvice as b on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as a on b.PatientID = a.UserID
            left join hospital as h on a.HospitalID = h.HospitalID
            where a.RecommendDoctorID = '${req.user.UserID}'
            and b.SeekMedicalState = '已完成' `+filter+` limit ${page},${pagesize};`
            var Patient_info = await exec(sql00)
    
        }else if(Role[0].RoleID === 60){
            //专家的情况
            var sql1 = `select 
            b.PatientID,
            a.Name as PatientName,
            a.Gender,
            TIMESTAMPDIFF(YEAR, a.Birthday, CURDATE()) as Age,
            a.Phone,
            h.HospitalName,
            a.Address
            from seekmedicaladvice as b 
            left join users as a on b.PatientID = a.UserID
            left join hospital as h on a.HospitalID = h.HospitalID
            where b.CureDoctorID = '${req.user.UserID}'
            and b.SeekMedicalState = '已完成' `+filter+` limit ${page},${pagesize};`
            var Patient_info = await exec(sql1)
            console.log(sql1)
            console.log(Patient_info)
        }else if(Role[0].RoleID === 20){
            //护士的情况
            var sql1 = `select 
            b.PatientID,
            a.Name as PatientName,
            a.Gender,
            TIMESTAMPDIFF(YEAR, a.Birthday, CURDATE()) as Age,
            a.Phone,
            h.HospitalName,
            a.Address
            from seekmedical_after_treatment_nurse as a 
            left join seekmedicaladvice as b on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
            left join users as a on b.PatientID = a.UserID
            left join hospital as h on a.HospitalID = h.HospitalID
            where a.RecommendNurseID = '${req.user.UserID}'
            and b.SeekMedicalState = '已完成'  `+filter+` limit ${page},${pagesize};`
            var Patient_info = await exec(sql1)
        }else{
            // return res.json({ 
            //     msg:"不存在的用户角色",
            //     status:0
            // }) 
            var Patient_info = ""
         
        }
    }else if(type==2){
        if(Role[0].RoleID === 40){
            //医生的情况下
     
            var sql = `select a.UserID as PatientID,
                a.Name as PatientName,
                a.Gender,
                a.Address,
                TIMESTAMPDIFF(YEAR,IFNULL(Birthday,NOW()), CURDATE()) as Age,
                a.Phone,
                a.Address,
                h.HospitalName,
                a.NewDiagnosis from users as a left join user_role as b
                on a.UserID = b.UserID left join hospital as h on a.HospitalID = h.HospitalID
                where b.RoleID = 10 and a.ImportUserID='${req.user.UserID}' `+filter+` limit ${page},${pagesize};`
                var Patient_info = await exec(sql)
    
        }else if(Role[0].RoleID === 60){
            //专家的情况
         
            var sql = `select a.UserID as PatientID,
                a.Name as PatientName,
                a.Gender,
                a.Address,
                TIMESTAMPDIFF(YEAR,IFNULL(Birthday,NOW()), CURDATE()) as Age,
                a.Phone,
                a.Address,
                h.HospitalName,
                a.NewDiagnosis from users as a left join user_role as b
                on a.UserID = b.UserID left join hospital as h on a.HospitalID = h.HospitalID
                where b.RoleID = 10 and a.ImportUserID='${req.user.UserID}' `+filter+` limit ${page},${pagesize};`
                var Patient_info = await exec(sql)
        }else if(Role[0].RoleID === 20){
            //护士的情况
     
            var sql = `select a.UserID as PatientID,
                a.Name as PatientName,
                a.Gender,
                a.Address,
                TIMESTAMPDIFF(YEAR,IFNULL(Birthday,NOW()), CURDATE()) as Age,
                a.Phone,
                a.Address,
                h.HospitalName,
                a.NewDiagnosis from users as a left join user_role as b
                on a.UserID = b.UserID left join hospital as h on a.HospitalID = h.HospitalID
                where b.RoleID = 10 and a.ImportUserID='${req.user.UserID}' `+filter+` limit ${page},${pagesize};`
                var Patient_info = await exec(sql)
        }else{
            // return res.json({ 
            //     msg:"不存在的用户角色",
            //     status:0
            // }) 
      
            var sql = `select a.UserID as PatientID,
                a.Name as PatientName,
                a.Gender,
                a.Address,
                TIMESTAMPDIFF(YEAR,IFNULL(Birthday,NOW()), CURDATE()) as Age,
                a.Phone,
                a.Address,
                h.HospitalName,
                a.NewDiagnosis from users as a left join user_role as b
                on a.UserID = b.UserID left join hospital as h on a.HospitalID = h.HospitalID
                where b.RoleID = 10 and a.ImportUserID='${req.user.UserID}' `+filter+` limit ${page},${pagesize};`
                var Patient_info = await exec(sql)
        }
    }
    
    res.json({ 
        Patient_info,
        status:200
    })
})
//查询某医生下所有已完成就诊的患者的信息
router.get('/patientlist/search', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    var sql = ` select RoleID from user_role where UserID = '${req.user.UserID}'`
    let Role = await exec(sql) 
    //根据角色判断
    if(Role[0].RoleID === 40){
        //医生的情况下
        var sql1 = `select 
        b.PatientID,
        c.Name as PatientName,
        c.Gender,
        TIMESTAMPDIFF(YEAR, c.Birthday, CURDATE()) as Age,
        c.Phone,
        c.Address
        from seekmedical_after_treatment_doctor as a 
        left join seekmedicaladvice as b on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
        left join users as c on b.PatientID = c.UserID
        where a.RecommendDoctorID = '${req.user.UserID}'
        and b.SeekMedicalState = '已完成'`
        var Patient_info1 = await exec(sql1)
        var sql = `select a.UserID as PatientID,
            a.Name as PatientName,
            a.Gender,
            a.Address,
            TIMESTAMPDIFF(YEAR,IFNULL(Birthday,NOW()), CURDATE()) as Age,
            a.Phone,
            a.Address,
            a.NewDiagnosis from users as a left join user_role as b
            on a.UserID = b.UserID
            where b.RoleID = 10 and a.ImportUserID='${req.user.UserID}';`
            var Patient_info2 = await exec(sql)

    }else if(Role[0].RoleID === 60){
        //专家的情况
        var sql1 = `select 
        b.PatientID,
        c.Name as PatientName,
        c.Gender,
        TIMESTAMPDIFF(YEAR, c.Birthday, CURDATE()) as Age,
        c.Phone,
        c.Address
        from seekmedicaladvice as b 
        left join users as c on b.PatientID = c.UserID
        where b.CureDoctorID = '${req.user.UserID}'
        and b.SeekMedicalState = '已完成'`
        var Patient_info1 = await exec(sql1)
        var sql = `select a.UserID as PatientID,
            a.Name as PatientName,
            a.Gender,
            a.Address,
            TIMESTAMPDIFF(YEAR,IFNULL(Birthday,NOW()), CURDATE()) as Age,
            a.Phone,
            a.Address,
            a.NewDiagnosis from users as a left join user_role as b
            on a.UserID = b.UserID
            where b.RoleID = 10 and a.ImportUserID='${req.user.UserID}';`
            var Patient_info2 = await exec(sql)
    }else if(Role[0].RoleID === 20){
        //护士的情况
        var sql1 = `select 
        b.PatientID,
        c.Name as PatientName,
        c.Gender,
        TIMESTAMPDIFF(YEAR, c.Birthday, CURDATE()) as Age,
        c.Phone,
        c.Address
        from seekmedical_after_treatment_nurse as a 
        left join seekmedicaladvice as b on a.SeekMedicalAdviceID = b.SeekMedicalAdviceID
        left join users as c on b.PatientID = c.UserID
        where a.RecommendNurseID = '${req.user.UserID}'
        and b.SeekMedicalState = '已完成'`
        var Patient_info1 = await exec(sql1)
        var sql = `select a.UserID as PatientID,
            a.Name as PatientName,
            a.Gender,
            a.Address,
            TIMESTAMPDIFF(YEAR,IFNULL(Birthday,NOW()), CURDATE()) as Age,
            a.Phone,
            a.Address,
            a.NewDiagnosis from users as a left join user_role as b
            on a.UserID = b.UserID
            where b.RoleID = 10 and a.ImportUserID='${req.user.UserID}';`
            var Patient_info2 = await exec(sql)
    }else{
        // return res.json({ 
        //     msg:"不存在的用户角色",
        //     status:0
        // }) 
        var Patient_info1 = ""
        var sql = `select a.UserID as PatientID,
            a.Name as PatientName,
            a.Gender,
            a.Address,
            TIMESTAMPDIFF(YEAR,IFNULL(Birthday,NOW()), CURDATE()) as Age,
            a.Phone,
            a.Address,
            a.NewDiagnosis from users as a left join user_role as b
            on a.UserID = b.UserID
            where b.RoleID = 10 and a.ImportUserID='${req.user.UserID}';`
            var Patient_info2 = await exec(sql)
    }
    res.json({ 
        Patient_info1,
        Patient_info2 ,
        status:200
    })
})
//注册患者人数
router.get('/patientinfo/registerPatient', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
//先查询到住过院的信息
    var sql = ` select 
    count(1)
    from users as a
    where a.RegisterDevice = 2`
    var count = await exec(sql)
    res.json({ 
        count
    })       
       
})
//患者基本信息
router.get('/patienthistory/:PatientID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
//先查询到住过院的信息
    var sql = ` select 
    MedicalAdviceApplicationDateTime as date,
    b.Name as expert,
    EndDiagResult as diagResult, 
    SeekMedicalAdviceID as pid,
    EndHospitalDateTime as isInHospital
    from seekmedicaladvice as a
    left join users as b
    on a.CureDoctorID = b.UserID
    where PatientID = '${req.params.PatientID}'
    and SeekMedicalState = '已完成'
    `
    var patient_info = await exec(sql)
    for(patient_info_i in patient_info){
        let data = patient_info[patient_info_i].isInHospital
        if(data == "" || data == null){
            //没有住院的情况
            patient_info[patient_info_i].isInHospital = '否'
            //查询专家的诊断结论
            var sql1 = `select DiagnosisDescription from diagnosis
            where SeekMedicalAdviceID  = '${patient_info[patient_info_i].pid}'`
            var Diagnosis_info = await exec(sql1)
            var Diagnosis_info_arr = []
            for(Diagnosis_info_i in Diagnosis_info){
                Diagnosis_info_arr.push(Diagnosis_info[Diagnosis_info_i].DiagnosisDescription)
            }
            patient_info[patient_info_i].diagResult = Diagnosis_info_arr
        }else{
            //住院的情况
            patient_info[patient_info_i].isInHospital = '是'
        }
    }
    res.json({ 
        patient_info
    })       
       
})

//查询患者是否已经存在与医院
router.post('/addPatient_exist', 
passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function addPatient(){
        try{
            //插入字段
            let Name = req.body.Name
            let Phone = req.body.Phone
            
            //查询数据库是否已经存在该用户名
            let sql1 = `select a.UserID,
            a.Name,a.Image,a.IdentityID,
            a.Gender,TIMESTAMPDIFF(YEAR,a.Birthday, CURDATE()) as Age,
            a.Job,
            a.Address
            from users as a left join user_role as b
            on a.UserID = b.UserID
            where a.UserID = '${Phone}' or a.Name like '%${Name}%' 
            and b.RoleID = 10 `
            //and ExternalImport = 'true' and ImportUserID = '${req.user.UserID}'
            let userList = await exec(sql1)
            res.json({
                status:200,
                userList
            })
        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    addPatient()         
})

//新增患者（外部导入的患者）
router.post('/addPatient', 
passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function addPatient(){
        try{
            //插入字段
            let Name = req.body.Name
            let Gender = req.body.Gender
            let Address = req.body.Address
            let Birthday = req.body.Birthday

            let IdentityID = req.body.IdentityID
            let Job = req.body.Job
            let Phone = req.body.Phone
            let HospitalID = req.user.HospitalID
            let NewDiagnosis = req.body.NewDiagnosis
            let CreatTime = moment().format('YYYY-MM-DD HH:mm:ss')
            let ModifyUser = req.user.UserID
    
            //生成随机字段（用户ID）
            let UserID = 'im'+ (Math.round(new Date() / 1000)%10000000 + Math.floor(Math.random()*10) + '')
            //查询数据库是否已经存在该用户名
            let sql2 = `select UserID from users where UserID = '${UserID}'`
            let isuser = await exec(sql2)
            if(isuser.length === 0){
                //插入患者信息
                var sql = `insert into users (GUID,UserID,Name,Gender,Address,Birthday,Job,LoginPassword,Phone,ExternalImport,ImportUserID,IdentityID ,NewDiagnosis,CreatTime,ModifyTime,ModifyUser,HospitalID)
                values ((UUID()),'${UserID}','${Name}','${Gender}','${Address}','${Birthday}','${Job}','123','${Phone}','true','${req.user.UserID}','${IdentityID}','${NewDiagnosis}','${CreatTime}','${CreatTime}','${ModifyUser}','${HospitalID}')`
                //更新患者身份
                var sql1 = `update user_role set RoleID = 10 where UserID = '${UserID}'`
                await exec(sql)
                await exec(sql1)
                res.json({ 
                    msg:'添加账号成功',
                    status:200
                })
            }else{
                res.json({ 
                    msg:'请重新发起请求',
                    status:0
                })
            }
        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    addPatient()         
})
//某患者基本信息
router.get('/getPatientList/:UserID', 
passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function DiagRecord(){
        try{
            let UserID = req.params.UserID
            //查询患者基本信息
            var sql1 = `select 
            Name,
            Gender,
            Birthday,
            Address,
            IdentityID,
            Phone,
            NewDiagnosis 
            from users where UserID = "${UserID}";`  
            var patientinfo = await exec(sql1) 
    
            res.json({ 
                patientinfo,
                status:200
            })
        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    DiagRecord()         
})
//编辑患者（外部导入的患者）
router.post('/editPatient', 
passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function addPatient(){
        try{
            //插入字段
            let Name = req.body.Name
            let Gender = req.body.Gender
            let Address = req.body.Address
            let Birthday = req.body.Birthday
            let IdentityID = req.body.IdentityID
            let Job = req.body.Job
            let Phone = req.body.Phone
            let NewDiagnosis = req.body.NewDiagnosis
            let ModifyTime = moment().format('YYYY-MM-DD HH:mm:ss')
            let ModifyUser = req.user.UserID
    
            //（患者ID）
            let UserID = req.body.UserID
            //查询数据库是否已经存在该用户名
            let sql2 = `select UserID from users where UserID = '${UserID}'`
            let isuser = await exec(sql2)
            if(isuser.length !== 0){
                //更新患者信息
                var sql = `update users set Name='${Name}',
                IdentityID= '${IdentityID}',
                Gender= '${Gender}',
                Job= '${Job}',
                Birthday= '${Birthday}',
                Address= '${Address}',
                Phone='${Phone}',
                NewDiagnosis='${NewDiagnosis}',
                ModifyTime='${ModifyTime}',
                ModifyUser='${ModifyUser}'
                where UserID="${UserID}";`
                await exec(sql)
                //更新患者身份
                var sql1 = `update user_role set RoleID = 10 where UserID = '${UserID}'`

                await exec(sql1)
                res.json({ 
                    msg:'添加账号成功',
                    status:200
                })
            }else{
                res.json({ 
                    msg:'请重新发起请求',
                    status:0
                })
            }
        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    addPatient()         
})
//删除患者
router.get('/deleteorPatientlist/:UserID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{

            let sql1 = `update users set HospitalID = 0 ,ImportUserID=""  where UserID='${req.params.UserID}';`
            await exec(sql1)

            res.json({
                status: 200,
                msg: "删除成功"
            })
        
    }catch(err){
        console.log('删除机构', err)
        res.json({
            status:0,
            err:'服务器报错+'+ err,
        })
    }
    
})

//查询新添加的患者列表（暂时只能查到自己添加的用户）
router.post('/addPatientListAll', 
passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function addPatientListAll(){
        try{
            var sql3 = `select RoleID from user_role 
            where UserID = '${req.user.UserID}' and RoleID =80;`
            isRoleID = await exec(sql3)
            if(isRoleID.length === 0){
            var sql = `select a.UserID as PatientID,
            a.Name as PatientName,
            a.Gender,
            a.Address,
            TIMESTAMPDIFF(YEAR,IFNULL(a.Birthday,NOW()), CURDATE()) as Age,
            a.Job,
            a.NewDiagnosis,
            a.CreatTime,
            a.ModifyTime,
            a.ModifyUser,
            h.HospitalName,
            a.Phone,
            aa.Name 
            from users as a left join user_role as b on a.UserID = b.UserID 
            left join hospital as h on a.HospitalID = h.HospitalID
            left join users as aa on a.ImportUserID=aa.UserID
            where b.RoleID = 10 and a.HospitalID='${req.user.HospitalID}';`
            console.log(sql)
            var Patient_info = await exec(sql)
            res.json({ 
                Patient_info,
                status:200
            })
            }else{
            var sql = `select a.UserID as PatientID,
            a.Name as PatientName,
            a.Gender,
            a.Address,
            TIMESTAMPDIFF(YEAR,IFNULL(a.Birthday,NOW()), CURDATE()) as Age,
            a.Job,
            a.NewDiagnosis,
            a.CreatTime,
            a.ModifyTime,
            a.ModifyUser,
            h.HospitalName,
            aa.Name,
            a.Phone from users as a left join user_role as b on a.UserID = b.UserID 
            left join hospital as h on a.HospitalID = h.HospitalID
            left join users as aa on a.ImportUserID=aa.UserID
            where b.RoleID = 10 and a.HospitalID>0;`
            console.log(sql)
            var Patient_info = await exec(sql)
            res.json({ 
                Patient_info,
                status:200
            })
            }
        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    addPatientListAll()         
})

//查询新添加的患者列表（暂时只能查到自己添加的用户）
router.post('/addPatientList/search', 
passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function addPatientList(){
        try{
            var sql3 = `select RoleID from user_role 
            where UserID = '${req.user.UserID}' and RoleID =80;`
            isRoleID = await exec(sql3)
            var surName=req.body.surName
            var gender=req.body.gender
            var Address=req.body.Address
            var NewDiagnosis=req.body.NewDiagnosis
            var maxyear=req.body.maxyear
            var minyear=req.body.minyear
            var uname = req.body.name
            var iphone=req.body.iphone
            var uorganzation = req.body.organization
            var startdate = req.body.startDate
            var enddate = req.body.endDate
            let filter = surName !==null || '' ? ` and a.Name like concat('${surName}','%')`:''
            filter+= gender!==null ||''?` and a.Gender='${gender}'`:''
            filter+=Address !==null ||'' ?` and a.Address like concat('%','${Address}','%')`:''
            filter+=NewDiagnosis!==null||'' ?` and a.NewDiagnosis like concat('%','${NewDiagnosis}','%')`:''
            filter+=maxyear!==null||''?` and a.Birthday between '${maxyear}' and '${minyear}'`:''
            filter+=uname!==null||'' ?` and a.Name ='${uname}'`:''
            filter+=uorganzation!==null||'' ?` and a.HospitalID= '${uorganzation}'`:''
            filter+=iphone!==null||'' ?` and a.Phone <= '${iphone}'`:''
            if(isRoleID.length === 0){
            var sql = `select a.UserID as PatientID,
            a.Name as PatientName,
            a.Gender,
            a.Address,
            TIMESTAMPDIFF(YEAR,IFNULL(Birthday,NOW()), CURDATE()) as Age,
            a.Job,
            a.NewDiagnosis,
            a.CreatTime,
            a.ModifyTime,
            a.ModifyUser,
            a.Phone from users as a left join user_role as b
            on a.UserID = b.UserID
            where b.RoleID = 10 and a.HospitalID='${req.user.HospitalID}' `+filter
            console.log(sql)
            var Patient_info = await exec(sql)
            res.json({ 
                Patient_info,
                status:200
            })
            }else{
        
            var sql = `select a.UserID as PatientID,
            a.Name as PatientName,
            a.Gender,
            a.Address,
            TIMESTAMPDIFF(YEAR,IFNULL(Birthday,NOW()), CURDATE()) as Age,
            a.Job,
            a.NewDiagnosis,
            a.CreatTime,
            a.ModifyTime,
            a.ModifyUser,
            a.Phone from users as a left join user_role as b
            on a.UserID = b.UserID
            where b.RoleID = 10 and a.HospitalID>0 `+filter
            console.log(sql)
            var Patient_info = await exec(sql)
            res.json({ 
                Patient_info,
                status:200
            })
            }
        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    addPatientList()         
})

//为某患者新增病历
router.post('/addPatientList/addDiagRecord', 
passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function addDiagRecord(){
        try{
            //添加病历
            let patientName = req.body.patientName
            let patientUserID = req.body.patientUserID
            let expertName = req.body.expertName
            let diagTime = req.body.diagTime
            let isToHospital = req.body.isToHospital
            let API_description = req.body.API_illState.API_description
            diagTime = formatDate(diagTime)
            //患者历史
            let API_history = req.body.API_history
            // {
            //     API_familyHistory: "",
            //     API_allergyHistory: "",
            //     API_patientistory: "",
            // }
            

            let API_diagInfo = req.body.API_diagInfo

            //检查结果的图片
            let API_examination = req.body.API_examination
            //插入患者就诊信息
            let sql = `insert into seekmedicaladvice (GUID,SeekMedicalAdviceStatus,SeekMedicalState,PatientID,PatientName,CureDoctorID,CureDoctorName,ExternalImport,MedicalAdviceApplicationDateTime,IsToHospital)
            values ((UUID()),'已完成','已完成','${patientUserID}','${patientName}','123456','${expertName}','true','${diagTime}','${isToHospital}')`
            let insertdiag = await exec(sql)
            var SeekMedicalAdviceID = insertdiag.insertId
            //插入患者历史（过往史）
            let sql11 = `insert into patient_history 
            (FamilyHistory,AllergyHistory,PatientHistory,SeekMedicalAdviceID,UserID) 
            values 
            ('${API_history.API_familyHistory}','${API_history.API_allergyHistory}','${API_history.API_patientistory}','${SeekMedicalAdviceID}','${patientUserID}')`
            await exec(sql11)
            for(let API_examination_i=0;API_examination_i<API_examination.length;API_examination_i++){
                let sql12 = `insert into medicalexamination (MedicalExaminationImage,MedicalExaminationDateTime,UserID,SeekMedicalAdviceID) values
                ("${API_examination[API_examination_i]}","${moment().format('YYYY-MM-DD HH:mm:ss')}","${patientUserID}",'${SeekMedicalAdviceID}')`
                var medicalinsert = await exec(sql12)
            }
            
            //插入病情描述
            let sql1 = `
            delete from symptomrelation where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";
            `
            await exec(sql1)
            for(i=0;i<API_description.length;i++){
                let sql2 = `insert into symptomrelation 
                (symptomName,SeekMedicalAdviceID)
                values 
                ("${API_description[i]}","${SeekMedicalAdviceID}")
                `
                await exec(sql2)
            }
            //删除原有的诊断结论
            var sql3 = `delete from diagnosis where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
            await exec(sql3)
            //插入诊断结果数组
            for(let i=0;i<API_diagInfo.API_diagResult.length;i++){
                var sql4 = `insert into diagnosis (DiagnosisDescription,DiagnosisDateTime,SeekMedicalAdviceID) values
                ("${API_diagInfo.API_diagResult[i]}","${moment().format('YYYY-MM-DD HH:mm:ss')}","${SeekMedicalAdviceID}")`
                await exec(sql4)
            }

            //判断是否已经存在治疗方案，如果存在就更新，不存在就插入治疗方案
            var sql5 = `select TreatmentID from treatment where SeekMedicalAdviceID = "${SeekMedicalAdviceID}" and TreatmentPhase = '就诊治疗';`
            var Treatmentinfo = await exec(sql5)
            //不存在诊断结果的情况
            if(Treatmentinfo.length === 0){
                var sql6 = `insert into treatment 
                (TreatmentDescription,TreatmentDateTime,SeekMedicalAdviceID,DoctorID,TreatmentPhase) 
                values
                ("${API_diagInfo.API_treatment.API_description}","${moment().format('YYYY-MM-DD HH:mm:ss')}","${SeekMedicalAdviceID}","${req.user.UserID}",'就诊治疗') `
            }else{
                //console.log(API_diagInfo.API_treatment.API_description)
                //console.log(API_diagInfo.API_treatment.API_prescription.API_chinese)
                var sql6 = `update treatment set 
                TreatmentDescription = "${API_diagInfo.API_treatment.API_description}",
                TreatmentPhase = '就诊治疗',
                TreatmentDateTime = "${moment().format('YYYY-MM-DD HH:mm:ss')}",
                DoctorID = "${req.user.UserID}"
                where SeekMedicalAdviceID = "${SeekMedicalAdviceID}" and TreatmentPhase = '就诊治疗'
                `
            }
            await exec(sql6)
            var TreatmentID = await exec(sql5)
            let API_description1 = API_diagInfo.API_treatment.API_description
            //将治疗方案详情插入数据库的treatment_plan_relation
            var sql8 = `
            delete from treatment_plan_relation where TreatmentID = "${TreatmentID[0].TreatmentID}" 
            `
            await exec(sql8)
            for(let i=0;i<API_description1.length;i++){
                //将药物直接插入数据库
                var sql9 = `insert into treatment_plan_relation 
                (TreamentPlanName,TreatmentID)
                values 
                ("${API_description1[i]}","${TreatmentID[0].TreatmentID}")
                `
                await exec(sql9)
            }
            let API_prescription1 = API_diagInfo.API_treatment.API_prescription
            //更新所有药物信息
            var sql10 = `
            delete from treatmentdrugrelation where TreatmentID = "${TreatmentID[0].TreatmentID}" 
            `
            await exec(sql10)
            for(let i=0;i<API_prescription1.length;i++){
                    //将药物直接插入数据库0
                    var sql7 = `insert into treatmentdrugrelation 
                    (DrugsName,TreatmentID,DrugsNumber,DrugsNumberUnits,DrugsUsage,UseFrequency,UseTime,DosageOfDrugsUnits,DrugsManufacturer)
                    values 
                    ("${API_prescription1[i].API_drugsName}","${TreatmentID[0].TreatmentID}",
                    "${API_prescription1[i].API_drugsNumber}","${API_prescription1[i].API_drugsNumberUnits}",
                    "${API_prescription1[i].API_drugsUsage}","${API_prescription1[i].API_useFrequency}",
                    "${API_prescription1[i].API_useTime}","${API_prescription1[i].API_drugsSpecification}","${API_prescription1[i].API_manufacturer}")
                    `
                    await exec(sql7)
            }
            res.json({ 
                msg:"添加成功",
                status:200
            })
        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    addDiagRecord()         
})

//某患者基本信息和病历列表
router.get('/addPatientList/DiagRecord/:patientUserID', 
passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function DiagRecord(){
        try{
            let patientUserID = req.params.patientUserID
            //查询患者基本信息
            var sql1 = `select 
            UserID as API_UserID,
            Name as API_name,
            Gender as API_gender,
            Birthday as API_birthday,
            Address as API_address,
            Phone as API_tel,
            NewDiagnosis as API_dig,
            Image as API_pic
            from users where UserID = "${patientUserID}";`  
            var patientinfo = await exec(sql1) 
         

            //查询历史病历
            var sql2 = `select 
            MedicalAdviceApplicationDateTime as date,
            CureDoctorName as expert,
            CureDoctorID,
            SeekMedicalAdviceID as pid,
            IsToHospital as isInHospital
            from seekmedicaladvice where PatientID = "${patientUserID}" and CureDoctorID != ' ' and SeekMedicalAdviceStatus = '已完成'`  
            var historyDiagInfo = await exec(sql2) 
            for(historyDiagInfo_i in historyDiagInfo){
                let sql3 = `select DiagnosisDescription from diagnosis where SeekMedicalAdviceID = '${historyDiagInfo[historyDiagInfo_i].pid}'`
                let Diagnosis = await exec(sql3)
                var arr = []
                for(Diagnosis_i in Diagnosis){
                    arr.push(Diagnosis[Diagnosis_i].DiagnosisDescription)
                }
                historyDiagInfo[historyDiagInfo_i]["diagResult"] = arr
                if(historyDiagInfo[historyDiagInfo_i].isInHospital === '1'){
                    historyDiagInfo[historyDiagInfo_i]["isInHospital"] = '是'
                }else if(historyDiagInfo[historyDiagInfo_i].isInHospital === '0'){
                    historyDiagInfo[historyDiagInfo_i]["isInHospital"] = '否'
                }else{
                    //根据是否存在住院号去判断
                    let sql = `select ToHospitalID from seekmedicaladvice where SeekMedicalAdviceID = '${historyDiagInfo[historyDiagInfo_i].pid}'`
                    let ToHospitalID = await exec(sql)
                    if(ToHospitalID.length === 0){
                        historyDiagInfo[historyDiagInfo_i]["isInHospital"] = '否'
                    }else{
                        historyDiagInfo[historyDiagInfo_i]["isInHospital"] = '是'
                    }
                }
                //判断专家的名字
                if(historyDiagInfo[historyDiagInfo_i].expert === '' || historyDiagInfo[historyDiagInfo_i].expert === null){
                    let sql4 = `select Name from users where UserID = '${historyDiagInfo[historyDiagInfo_i].CureDoctorID}'`
                    var CureDoctorName = await exec(sql4)
                    //console.log(CureDoctorName)
                    historyDiagInfo[historyDiagInfo_i]["expert"] = CureDoctorName[0].Name
                }
            }
            res.json({ 
                patientinfo:patientinfo[0],
                historyDiagInfo,
                status:200
            })
        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    DiagRecord()         
})


//提交入院前的评估
router.post('/before_pinggu/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(PatientID)          
    async function before_pinggu() {
        // 同步写法
        try {
                var data = JSON.stringify(req.body.data)
                var assessmentTime = formatDate(req.body.assessmentTime)
                //插入评估表单数据
                var sql = `insert into tohospital_assessment_form (FormTime,FormContent,FormName,SeekMedicalAdviceID,NurseID,AssessState)
                values ('${assessmentTime}','${data}','${req.body.name}','${SeekMedicalAdviceID}','${req.user.UserID}','入院前评估')`
                await exec(sql) 
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
                before_pinggu();              
})


//提交患者入院后评估记录
router.post('/pinggu/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {     
    async function pinggu() {
        const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID
        // 同步写法
        try {
            var data = JSON.stringify(req.body.data)
            var assessmentTime = formatDate(req.body.assessmentTime)
            //插入评估表单数据
            var sql = `insert into tohospital_assessment_form (FormTime,FormContent,FormName,SeekMedicalAdviceID,NurseID,AssessState)
            values ('${assessmentTime}','${data}','${req.body.name}','${SeekMedicalAdviceID}','${req.user.UserID}','入院后评估')`
            await exec(sql) 
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
                pinggu();              
})

//提交患者护理记录
router.post('/newnursinglog/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    //console.log(PatientID)          
    async function newnursinglog() {
        const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
        // 同步写法
        try {
            var API_newNursing = JSON.stringify(req.body.API_newNursingLog)
            var nursingTime = formatDate(req.body.nursingTime)
            //插入护理记录
            var sql2 = `insert into tohospital_nurse_record (SeekMedicalAdviceID,NursingDate,NurseID,NursingRecord)
            values ("${SeekMedicalAdviceID}","${nursingTime}","${req.user.UserID}",'${API_newNursing}');`
            await exec(sql2)
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




//提交患者住院前的治疗方案
router.post('/before_treatmentlog/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    //console.log(req.body)          
    async function before_treatmentlog() {
        // 同步写法
        var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID
        try {
                
                //插入诊断结论
                var sql3 = `insert into treatment 
                (TreatmentDescription,TreatmentResults,TreatmentPhase,TreatmentDateTime,SeekMedicalAdviceID,DoctorID) 
                values
                ("${req.body.API_treatment}","${req.body.API_patientState}","入院前治疗",'${moment().format('YYYY-MM-DD HH:mm:ss')}',"${SeekMedicalAdviceID}","${req.user.UserID}") `
                var inserttreatment =  await exec(sql3)
                //console.log(TreatmentID)
                API_treatment = req.body.API_treatment
                for(API_treatment_i=0;API_treatment_i<API_treatment.length;API_treatment_i++){
                    //将药物直接插入数据库
                    var sql9 = `insert into treatment_plan_relation 
                    (TreamentPlanName,TreatmentID)
                    values 
                    ("${API_treatment[API_treatment_i]}","${inserttreatment.insertId}")
                    `
                    await exec(sql9)
                }
                API_prescription = req.body.API_prescription
                for(let API_prescription_i=0;API_prescription_i<API_prescription.length;API_prescription_i++){
                        //将药物直接插入数据库
                        var sql7 = `insert into treatmentdrugrelation 
                        (DrugsName,TreatmentID,DrugsNumber,DrugsNumberUnits,DrugsUsage,DrugsManufacturer,UseFrequency,DosageOfDrugsUnits,UseTime)
                        values 
                        ("${API_prescription[API_prescription_i].API_drugsName}",
                        "${inserttreatment.insertId}",
                        "${API_prescription[API_prescription_i].API_drugsNumber}",
                        "${API_prescription[API_prescription_i].API_drugsNumberUnits}",
                        "${API_prescription[API_prescription_i].API_drugsUsage}",
                        "${API_prescription[API_prescription_i].API_manufacturer}",
                        "${API_prescription[API_prescription_i].API_useFrequency}",
                        "${API_prescription[API_prescription_i].API_drugsSpecification}",
                        "${API_prescription[API_prescription_i].API_useTime}")
                        `
                        await exec(sql7)
                }
                //添加医生确认标识符
                var sql10 = `update seekmedicaladvice set ToTreatmentlAssessment = "1"
                where SeekMedicalAdviceID = ${SeekMedicalAdviceID};`
                await exec(sql10)
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
                before_treatmentlog();              
})
//提交住院患者治疗方案  
router.post('/treatmentlog/:SeekMedicalAdviceID', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
    var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID   
    //console.log(req.body)          
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
            var API_date = formatDate(req.body.API_date)
            //插入诊断结论
            var sql3 = `insert into treatment 
            (TreatmentDescription,TreatmentResults,TreatmentPhase,TreatmentDateTime,SeekMedicalAdviceID,DoctorID) 
            values
            ("${req.body.API_treatment}","${req.body.API_patientState}",'住院中治疗','${API_date}',"${SeekMedicalAdviceID}","${req.user.UserID}") `
            var inserttreatment =  await exec(sql3)
            //console.log(TreatmentID)
            API_treatment = req.body.API_treatment
            for(let API_treatment_i=0;API_treatment_i<API_treatment.length;API_treatment_i++){
                //将药物直接插入数据库
                var sql9 = `insert into treatment_plan_relation 
                (TreamentPlanName,TreatmentID)
                values 
                ("${API_treatment[API_treatment_i]}","${inserttreatment.insertId}")
                `
                await exec(sql9)
            }
            API_prescription = req.body.API_prescription
            for(API_prescription_i=0;API_prescription_i<API_prescription.length;API_prescription_i++){
                    //将药物直接插入数据库
                    var sql7 = `insert into treatmentdrugrelation 
                    (DrugsName,TreatmentID,DrugsNumber,DrugsNumberUnits,DrugsUsage,DrugsManufacturer,UseFrequency,DosageOfDrugsUnits,UseTime)
                    values 
                    ("${API_prescription[API_prescription_i].API_drugsName}",
                    "${inserttreatment.insertId}",
                    "${API_prescription[API_prescription_i].API_drugsNumber}",
                    "${API_prescription[API_prescription_i].API_drugsNumberUnits}",
                    "${API_prescription[API_prescription_i].API_drugsUsage}",
                    "${API_prescription[API_prescription_i].API_manufacturer}",
                    "${API_prescription[API_prescription_i].API_useFrequency}",
                    "${API_prescription[API_prescription_i].API_drugsSpecification}",
                    "${API_prescription[API_prescription_i].API_useTime}")
                    `
                    await exec(sql7)
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
            endtreatmentDate:
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
                let endtreatmentDate = formatDate(req.body.endtreatmentDate)
                //插入诊断结论
                var sql3 = `insert into treatment 
                (TreatmentDescription,TreatmentResults,TreatmentPhase,TreatmentDateTime,SeekMedicalAdviceID,DoctorID) 
                values
                ("${req.body.notes}","${req.body.treatLogs}","出院后治疗",'${endtreatmentDate}',"${SeekMedicalAdviceID}","${req.user.UserID}") `
                var inserttreatment =  await exec(sql3)
                var API_prescription = req.body.prescription
                for(let API_prescription_i=0;API_prescription_i<API_prescription.length;API_prescription_i++){
                        //将药物直接插入数据库
                        var sql7 = `insert into treatmentdrugrelation 
                        (DrugsName,TreatmentID,DrugsNumber,DrugsNumberUnits,DrugsUsage,DrugsManufacturer,UseFrequency,DosageOfDrugsUnits,UseTime)
                        values 
                        ("${API_prescription[API_prescription_i].API_drugsName}",
                        "${inserttreatment.insertId}",
                        "${API_prescription[API_prescription_i].API_drugsNumber}",
                        "${API_prescription[API_prescription_i].API_drugsNumberUnits}",
                        "${API_prescription[API_prescription_i].API_drugsUsage}",
                        "${API_prescription[API_prescription_i].API_manufacturer}",
                        "${API_prescription[API_prescription_i].API_useFrequency}",
                        "${API_prescription[API_prescription_i].API_drugsSpecification}",
                        "${API_prescription[API_prescription_i].API_useTime}")
                        `
                        await exec(sql7)
                }
                //添加医生确认出院的记录
                var sql10 = `update seekmedicaladvice set SeekMedicalState = "已完成",
                EndDiagResult = "${req.body.diagResult}",EndDiagNotes = "${req.body.notes}",
                EndHospitalDateTime = '${endtreatmentDate}'
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
                await exec(sql10)
                
                res.json({
                    status:200,
                    msg:"出院记录成功"
                })
                }catch(err) {
                    //console.log(err)
                        res.json({
                            status:0,
                            msg:"出院记录失败"
                        })
                      }
                }
                endtreatment();              
})


//提交随访评估记录
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
            let Time = formatDate(req.body.time)
            var sql = `insert into endhospital_follow_record (SeekMedicalAdviceID,NurseID,FollowRecord,FollowTime,FollowName)
            values ('${SeekMedicalAdviceID}','${req.user.UserID}','${FollowRecord}','${Time}','${FollowName}')`
            await exec(sql)
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


//某患者基本信息和病历列表
router.get('/diagInfo/:pid', 
//passport.authenticate("jwt", { session: false }), 
 (req, res) => {
    async function info(){
        try{
            let SeekMedicalAdviceID = req.params.pid
            //查询患者基本信息
            var sql1 = `select 
            a.ToHospitalID as API_toHospitalID,
            a.ToHospitalDateTime as API_date,
            b.UserID as API_UserID,
            b.Name as API_name,
            b.Gender as API_gender,
            TIMESTAMPDIFF(YEAR, b.Birthday, CURDATE()) as API_age,
            b.Address as API_address,
            b.Phone as API_tel,
            b.Image as API_pic
            from seekmedicaladvice as a left join users as b
            on a.PatientID = b.UserID
            where a.SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`  
            const patientinfo = await exec(sql1) 
            res.json({ 
                patientinfo:patientinfo[0],
                status:200
            })
        }catch(err){
            console.log(err)
            res.json({
                msg:'服务器报错'+err,
                status:0
            })
        }
    }
    info()         
})










module.exports = router;