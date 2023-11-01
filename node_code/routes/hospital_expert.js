var express = require('express');
var app = express();
var router = express.Router();
const {exec} = require('../db/config.js');
const passport = require('passport');
const query = require('../db/mysql.js');
var moment = require('moment');
//获取本地时区
moment.locale('zh-cn');
var CryptoJS = require("crypto-js");
const crypto = require('crypto')
// JWT鉴权
var jwtConfig = require("../utils/jwtAuth.js").jwtConfigAuth;
passport.use(jwtConfig);



//医疗机构列表查询
router.get('/orglist', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断如果是专家可查任意机构列表
        let sql1 = `select RoleID from user_role where UserID = '${req.user.UserID}' and RoleID = 80;`
        let isRoleID = await exec(sql1)
        if(isRoleID.length !== 0){
            var expertFlag = 1
        }else{
            var expertFlag = 0
        }
        var sql = `select 
        a.HospitalID,a.HospitalName,a.HospitalLeve,a.ManagerID,b.Name as ManagerName,
        a.HospitalType,a.HospitalIntroduction,a.Address,
        a.Image from hospital as a left join users as b 
        on ManagerID = b.UserID
        where (ManagerID = '${req.user.UserID}') or (1 = ${expertFlag});`
        let HospitalOrgInfo = await exec(sql)
        res.json({ 
            status:200,
            msg:"ok",
            HospitalOrgInfo
        })
    }catch(err){
        console.log('/medicalinfo/organization', err)
        res.json({ 
            status:0,
            msg:"查询失败"
        })
    }
    

})

//新建医疗机构
router.post('/addorgmanage', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断用户身份是否能修改机构信息
        sql3 = `select RoleID from user_role 
        where UserID = '${req.user.UserID}' and RoleID >=70;`
        isRoleID = await exec(sql3)
        //判断如果没有此身份的用户，则不满足条件
        if(isRoleID.length === 0){
            res.json({
                status: 400,
                msg: "您的身份无法添加医疗机构"
            })
        }else{
            sql = `select HospitalName from hospital where HospitalName = "${req.body.HospitalName}";`
            isExpertName =  await exec(sql)
            if(isExpertName.length !== 0){
                res.json({
                    status: 400,
                    msg: "医疗机构已经存在，请更换医疗机构名称后提交"
                })
            }else{ 
                let sql1 = `insert into hospital 
                (HospitalName,HospitalLeve,HospitalType,HospitalIntroduction,ContactPhone,Address,Image,CreatUserID)
                values 
                ('${req.body.HospitalName}','${req.body.HospitalLeve}','${req.body.HospitalType}','${req.body.HospitalIntroduction}','${req.body.ContactPhone}','${req.body.Address}','${req.body.Image}','${req.user.UserID}');`
                await exec(sql1)
                res.json({
                    status: 200,
                    msg: "添加成功"
                })
            }
        }
    }catch(err){
        console.log('添加机构信息', err)
        res.json({
            status:0,
            err:'服务器报错+'+ err,
        })
    }
})

//修改机构信息
router.post('/updateorgmanage/:hospitalID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断用户身份是否能修改机构信息
        sql3 = `select RoleID from user_role 
        where UserID = '${req.user.UserID}' and RoleID >=70;`
        isRoleID = await exec(sql3)
        //判断如果没有此身份的用户，则不满足条件
        if(isRoleID.length === 0){
            res.json({
                status: 400,
                msg: "您的身份无法修改医疗机构"
            })
        }else{
            console.log(req.body)
            let sql1 = `update hospital set 
                HospitalName = '${req.body.HospitalName}',
                HospitalLeve = '${req.body.HospitalLeve}',
                HospitalType = '${req.body.HospitalType}',
                HospitalIntroduction = '${req.body.HospitalIntroduction}',
                ContactPhone = '${req.body.Tel}',
                Address = '${req.body.Address}',
                Image = '${req.body.Image}' 
                where HospitalID = '${req.params.hospitalID}';`
            await exec(sql1)
            res.json({
                status: 200,
                msg: "修改成功"
            })
        }
    }catch(err){
        console.log('修改机构信息', err)
        res.json({
            status:0,
            err:'服务器报错+'+ err,
        })
    }
    
})

//删除一个机构
router.get('/deleteorgmanage/:hospitalID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断用户身份是否能修改机构信息
        sql3 = `select RoleID from user_role 
        where UserID = '${req.user.UserID}' and RoleID >=70;`
        isRoleID = await exec(sql3)
        //判断如果没有此身份的用户，则不满足条件
        if(isRoleID.length === 0){
            res.json({
                status: 400,
                msg: "您的身份无法删除医疗机构"
            })
        }else{
            let sql1 = `delete from hospital where HospitalID = '${req.params.hospitalID}';`
            await exec(sql1)
            let sql2 = `delete from hospital_doctors where HospitalID = '${req.params.hospitalID}';`
            await exec(sql2)
            res.json({
                status: 200,
                msg: "删除成功"
            })
        }
    }catch(err){
        console.log('删除机构', err)
        res.json({
            status:0,
            err:'服务器报错+'+ err,
        })
    }
    
})

//医疗机构详细查询
router.get('/orgdetails/:HospitalID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //console.log(req.params)
        let sql = `select 
        a.HospitalName,
        a.HospitalLeve,
        a.HospitalType,
        a.HospitalIntroduction,
        a.ContactPhone,
        a.Address,
        a.Image,
        a.ContactPhone as Tel,
        a.ManagerID,
        b.Name as ManagerName
        from hospital as a left join users as b 
        on a.ManagerID = b.UserID
        where a.HospitalID = "${req.params.HospitalID}"`
        let HospitalOrgDetails = await exec(sql)
        //查医院医生列表
        let sql1 = `select 
        b.Name,
        b.ResearchExperienceInfo,
        b.UserID,
        b.Image 
        from hospital_doctors as a left join users as b 
        on a.UserID = b.UserID
        where a.HospitalID = "${req.params.HospitalID}" and a.RoleID = 40;` 
        let hospitalDoctors = await exec(sql1)
        //console.log(hospitalDoctors)
        //查医院护士列表
        let sql2 = `select 
        b.Name,
        b.ResearchExperienceInfo,
        b.UserID,
        b.Image 
        from hospital_doctors as a left join users as b 
        on a.UserID = b.UserID
        where a.HospitalID = "${req.params.HospitalID}" and a.RoleID = 20;` 
        let hospitalnurses = await exec(sql2)
        if(HospitalOrgDetails.length === 0){
            res.json({
                status:400,
                msg:"暂时查询不到医院信息",
            })
        }else{
            res.json({ 
                status:200,
                msg:"ok",
                HospitalID:req.params.HospitalID,
                HospitalOrgDetails,
                HospitalDoctor:{
                    Doctor:hospitalDoctors,
                    Nurse:hospitalnurses
                }
            })
        }
    }catch(err){
        console.log('机构详情', err)
        res.json({
            status:0,
            err:'服务器报错+'+ err,
        })
    }
})

//添加医生或者护士
router.post('/orgdetails/adduser/:hospitalID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断用户身份是否能修改机构信息
        let sql = `select RoleID from user_role 
        where UserID = '${req.user.UserID}' and RoleID >= 70;`
        isRoleID = await exec(sql)
        //判断如果没有此身份的用户，则不满足条件
        if(isRoleID.length === 0){
            return res.json({
                status: 400,
                msg: "您的身份无法添加医疗机构成员"
            })
        }else{
            if(req.body.role === '医生'){
                var roleID = 40
            }else if(req.body.role === '护士'){
                var roleID = 20
            }else{
                return res.json({
                    status: 400,
                    msg: "添加的医生设置的角色不正确，只能添加 医生 或 护士 两种角色"
                })
            }
            //判断用户是否存在
            let sql4 = `select GUID from users where UserID = '${req.body.UserID}'`
            let isUser = await exec(sql4)
            if(isUser.length === 0){
                return res.json({
                    msg:'用户不存在',
                    status:0
                })
            }
            //判断用户之前是哪种角色
            let sql5 = `select RoleID from hospital_doctors where UserID = '${req.body.UserID}'`
            let user_role = await exec(sql5)
            if(user_role.length === 0){
                var sql3 = `insert into user_role 
                (UserID,RoleID)
                values
                ('${req.body.UserID}','${roleID}');`
            }else{
                var sql3 = `update user_role set 
                RoleID = '${roleID}'
                where UserID = '${req.body.UserID}' and RoleID = '${user_role[0].RoleID}';`
            }
            //先删除某医院的该用户
            let sql2 = `delete from hospital_doctors 
            where UserID = '${req.body.UserID}';` 
            let sql1 = `insert into hospital_doctors 
            (HospitalID,UserID,RoleID)
            values
            ('${req.params.hospitalID}','${req.body.UserID}','${roleID}')`
            let sql6 = `update users set 
            HospitalID = '${req.params.hospitalID}'
            where UserID = '${req.body.UserID}';`
            //添加一个角色
            await exec(sql2)
            await exec(sql1)
            await exec(sql3)
            await exec(sql6)
        }
        res.json({
            status:200,
            msg:'添加成功'
        })
    }catch(err){
        console.log('添加医生', err)
        res.json({
            status:0,
            err:'服务器报错+'+ err
        })
    }
})


//删除医生或者护士
router.post('/orgdetails/deleteuser/:hospitalID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断用户身份是否能修改机构信息
        let sql = `select RoleID from user_role 
        where UserID = '${req.user.UserID}' and RoleID >= 70;`
        isRoleID = await exec(sql)
        //判断如果没有此身份的用户，则不满足条件
        if(isRoleID.length === 0){
            return res.json({
                status: 400,
                msg: "您的身份无法删除医疗机构成员"
            })
        }else{
            if(req.body.role === '医生'){
                var roleID = 40
            }else if(req.body.role === '护士'){
                var roleID = 20
            }else{
                return res.json({
                    status: 400,
                    msg: "删除的医生设置的角色不正确，只能添加 医生 或 护士 两种角色"
                })
            }
            //先删除某医院的该用户
            let sql2 = `delete from hospital_doctors 
            where UserID = '${req.body.UserID}' and HospitalID = '${req.params.hospitalID}';` 
            await exec(sql2)
            //删除角色
            let sql3 = `delete from user_role 
            where UserID = '${req.body.UserID}' and RoleID = '${roleID}';` 
            await exec(sql3)
            // 更新为null
            let sql4 = `update users set 
            HospitalID = '${0}'
            where UserID = '${req.body.UserID}';`
            await exec(sql4)
        }
        res.json({
            status:200,
            msg:'删除成功'
        })
    }catch(err){
        console.log('删除医生或者护士', err)
        res.json({
            status:0,
            err:'服务器报错+'+ err
        })
    }
})


//查询专家团队列表
router.get('/expertlist', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        var sql = `select 
        ExpertID,
        ExpertName,
        ExpertSpecialty,
        ExpertIntroduction,
        ExpertImage from expert_team;`
        let ExpertInfo = await exec(sql) 
        res.json({ 
            status:200,
            msg:"ok",
            ExpertInfo
        }) 
    }catch(err){
        console.log('查询专家团队列表:' ,err)
        return res.json({
            status:0,
            msg:"查询失败"
        })
    }  
})


//新建一个专家团队
router.post('/expertmanage', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断用户身份是否能修改机构信息
        sql3 = `select RoleID from user_role where UserID = '${req.user.UserID}' and RoleID = 80;`
        isRoleID = await exec(sql3)
        if(isRoleID.length === 0){
            res.json({
                status: 400,
                msg: "您的身份无法添加专家团队"
            })
        }else{
            let sql = `select ExpertName from expert_team where ExpertName = "${req.body.groupName}";`
            isExpertName = await exec(sql)
            if(isExpertName.length !== 0){
                res.json({
                    status: 400,
                    msg: "团队名已经存在，请更换团队名后提交"
                })
            }else{ 
                let sql1 = `insert into expert_team 
                (ExpertName,ExpertSpecialty,ExpertIntroduction,ExpertTel,ExpertImage,CreatUserID)
                values 
                ('${req.body.groupName}','${req.body.groupShanchang}','${req.body.groupIntroduction}','${req.body.groupTel}','${req.body.groupImage}','${req.user.UserID}');`
                await exec(sql1)
                res.json({
                    status: 200,
                        msg: "添加成功"
                })
            }
        }
    }catch(err){
        console.log('新建一个专家团队:' ,err)
        return res.json({
            status:0,
            msg:"查询失败"
        })
    } 
})

//修改团队信息
router.post('/updateexpertmanage/:expertID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断用户身份是否能修改机构信息
        sql3 = `select RoleID from user_role where 
        UserID = '${req.user.UserID}' and RoleID = 80;`
        isRoleID = await exec(sql3)
        if(isRoleID.length === 0){
            res.json({
                status: 400,
                msg: "您的身份无法修改专家团队信息"
            })
        }else{
            let sql1 = `update expert_team set 
                ExpertName = '${req.body.groupName}',
                ExpertSpecialty = '${req.body.groupShanchang}',
                ExpertIntroduction = '${req.body.groupIntroduction}',
                ExpertTel = '${req.body.groupTel}',
                ExpertImage = '${req.body.groupImage}'
                where ExpertID = '${req.params.expertID}';`
            await exec(sql1)
            res.json({
                status: 200,
                msg: "修改成功"
            })
        }
    }catch(err){
        console.log('修改专家团队信息:' ,err)
        return res.json({
            status:0,
            msg:"失败"
        })
    } 
})

//删除一个专家团队
router.get('/deleteexpertmanage/:expertID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断用户身份是否能修改机构信息
        sql3 = `select RoleID from user_role where 
        UserID = '${req.user.UserID}' and RoleID = 80;`
        isRoleID = await exec(sql3)
        if(isRoleID.length === 0){
            res.json({
                status: 400,
                msg: "您的身份无法修改专家团队信息"
            })
        }else{
            let sql1 = `delete from expert_team where ExpertID = '${req.params.expertID}';`
            let sql2 = `delete from expert_user where ExpertID = '${req.params.expertID}';`
            await exec(sql1)
            await exec(sql2)
            res.json({
                status: 200,
                msg: "删除成功"
            })
        }
    }catch(err){
        console.log('删除专家团队:' ,err)
        return res.json({
            status:0,
            msg:"失败"
        })
    } 
})


//专家团队详细查询
router.get('/expertmanage/expertdetails/:expertID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //console.log(req.params)
    try{
        var sql = `select ExpertID,ExpertName,ExpertSpecialty,ExpertIntroduction,ExpertTel,ExpertImage from expert_team where ExpertID = "${req.params.expertID}"`
        var sql1 = `select 
        a.UserID,
        c.Name,
        b.RoleName,
        c.Image,
        c.ResearchExperienceInfo
        from expert_user as a left join roles as b 
        on a.RoleID = b.RoleID
        left join users as c
        on a.UserID = c.UserID
        where ExpertID = "${req.params.expertID}";`  
        let expert_info = await exec(sql)
        let TeamDoctor = await exec(sql1)
        res.json({ 
            status:200,
            msg:"ok",
            expertdetails:expert_info,
            TeamDoctor:TeamDoctor
        })
    }catch(err){
        console.log('专家团队详细查询:' ,err)
        return res.json({
            status:0,
            msg:"失败"
        })
    } 
    
})



//添加专家
router.post('/expertmanage/addexpert/:expertID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断用户身份是否能修改机构信息
        sql3 = `select RoleID from user_role where 
        UserID = '${req.user.UserID}' and RoleID = 80;`
        isRoleID = await exec(sql3)
        if(isRoleID.length === 0){
            res.json({
                status: 400,
                msg: "您的身份无法修改专家团队信息"
            })
        }else{
            if(req.body.role === '专家'){
                var roleID = 60
            }else if(req.body.role === '医疗机构管理员'){
                var roleID = 70
            }else{
                return res.json({
                    status: 400,
                    msg: "添加的专家设置的角色不正确，只能添加 专家 或 医疗机构管理员 两种角色"
                })
            }
            //判断用户是否存在
            let sql4 = `select GUID from users where UserID = '${req.body.UserID}'`
            let isUser = await exec(sql4)
            if(isUser.length === 0){
                return res.json({
                    msg:'用户不存在',
                    status:0
                })
            }
            //判断用户之前是哪种角色
            let sql5 = `select RoleID from expert_user where UserID = '${req.body.UserID}'`
            let user_role = await exec(sql5)
            if(user_role.length === 0){
                //添加一个角色
                var sql3 = `insert into user_role 
                (UserID,RoleID)
                values
                ('${req.body.UserID}','${roleID}');`
            }else{
                var sql3 = `update user_role set 
                RoleID = '${roleID}'
                where UserID = '${req.body.UserID}' and RoleID = '${user_role[0].RoleID}';`
            }
            let sql2 = `delete from expert_user 
            where UserID = '${req.body.UserID}';` 
            let sql1 = `insert into expert_user 
            (ExpertID,UserID,RoleID)
            values
            ('${req.params.expertID}','${req.body.UserID}','${roleID}');`
            await exec(sql2)
            await exec(sql1)
            await exec(sql3)
            res.json({
                status: 200,
                msg: "添加成功"
            })
        }
    }catch(err){
        console.log('删除专家团队:' ,err)
        return res.json({
            status:0,
            msg:"失败"
        })
    } 
})



//删除专家团队成员
router.post('/expertmanage/deleteexpert/:expertID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断用户身份是否能修改机构信息
        let sql = `select RoleID from user_role 
        where UserID = '${req.user.UserID}' and RoleID = 80;`
        isRoleID = await exec(sql)
        //判断如果没有此身份的用户，则不满足条件
        if(isRoleID.length === 0){
            return res.json({
                status: 400,
                msg: "您的身份无法修改专家团队信息"
            })
        }else{
            if(req.body.role === '专家'){
                var roleID = 60
            }else if(req.body.role === '医疗机构管理员'){
                var roleID = 70
            }else{
                return res.json({
                    status: 400,
                    msg: "删除的专家设置的角色不正确，只能添加 专家 或 医疗机构管理员 两种角色"
                })
            }
            //先删除某医院的该用户
            let sql2 = `delete from expert_user 
            where UserID = '${req.body.UserID}' and ExpertID = '${req.params.expertID}';` 
            await exec(sql2)
            //删除角色
            let sql3 = `delete from user_role 
            where UserID = '${req.body.UserID}' and RoleID = '${roleID}';` 
            await exec(sql3)
        }
        res.json({
            status:200,
            msg:'删除成功'
        })
    }catch(err){
        console.log('删除专家或者机构管理员', err)
        res.json({
            status:0,
            err:'服务器报错+'+ err
        })
    }
})


function aesDecrypt(encrypted,key){
    /**创建一个解密 */
    const deciper=crypto.createDecipher('aes192',key);
    /**
     *  update(data: string, inputEncoding: Encoding | undefined, outputEncoding: Encoding): string;
     *  data 就是被加密的字符串，inputEncoding 这个加密的字符的字符串一般椒16进制字符串，outputEncoding 输出的字符串类型一般utf8
     */
    let descrped = deciper.update(encrypted,'hex','utf8');
    descrped+=deciper.final('utf8')
    return descrped;
}


//注册一个账号
router.post('/register', 
(req, res) => {
async function register() {
    try {
        console.log("POST_regist_request")  
        console.log(req.body) 
        var UserID=req.body.UserID
        // var pwd=req.body.LoginPassword
        var pwd =aesDecrypt(req.body.LoginPassword,'node')
        var Name=req.body.Name
        var Research = req.body.Research
        var device = 1
        //查询用户是否存在
        var sql1 = `select UserID from users where UserID = '${UserID}';`
        var isUser = await exec(sql1)
        console.log(isUser)
        if(isUser.length !== 0){
            return res.json({
                "status":0,
                "msg":"用户已存在"
            })
        }else{
          
            var sql2 =`insert into users 
            (GUID,UserID,LoginPassword,Name,ResearchExperienceInfo,RegisterDevice) 
            values 
            ((UUID()),'${UserID}','${pwd}','${Name}','${Research}','${device}');`
            await exec(sql2)

            //更新用户角色
            let sql3 = `update user_role set RoleID = '15' where UserID = '${UserID}'`
            await exec(sql3)
            res.json({
                "status":200,
                "msg":"用户成功注册"
            })
        }
    }catch(err) {
        console.log(err)
        res.json({
            "status":0,
            "msg":"用户注册失败，" + err
        })
    }
}
register();      
})

//指定机构管理员
router.post('/updateorgmanager/:hospitalID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    try{
        //判断用户身份是否能修改机构信息
        let sql3 = `select RoleID from user_role where 
        UserID = '${req.user.UserID}' and RoleID = 80;`
        isRoleID = await exec(sql3)
        if(isRoleID.length === 0){
            res.json({
                status: 400,
                msg: "您的身份无法修改机构团队信息"
            })
        }else{
            //删除以前的管理员角色
            let sql4 = `select ManagerID from hospital where HospitalID = '${req.params.hospitalID}'`
            let manager = await exec(sql4)
            if(manager[0].ManagerID !== ''){
                let sql = `delete from user_role where UserID = '${manager[0].ManagerID}'
                and RoleID = 70;`
                await exec(sql)
            }
            //更新新的管理员
            let sql1 = `update hospital set 
                ManagerID = '${req.body.UserID}'
                where HospitalID = '${req.params.hospitalID}';`
            await exec(sql1)
            let sql3 = `update users set 
                HospitalID = '${req.params.hospitalID}'
                where UserID = '${req.body.UserID}';`
            await exec(sql3)
            //新增此人为管理员角色
            let sql2 = `insert into user_role (UserID,RoleID) values ('${req.body.UserID}',70)`
            await exec(sql2)
            res.json({
                status: 200,
                msg: "修改成功"
            })
        }
    }catch(err){
        console.log('指定机构管理员:' ,err)
        return res.json({
            status:0,
            msg:"失败"
        })
    } 
})






module.exports = router;