var express = require('express');
var app = express();
var router = express.Router();
const {exec} = require('../db/config.js');
const passport = require('passport');
const query = require('../db/mysql.js');
var moment = require('moment');
//获取本地时区
moment.locale('zh-cn');

// JWT鉴权
var jwtConfig = require("../utils/jwtAuth.js").jwtConfigAuth;
passport.use(jwtConfig);

//医疗机构查询
router.get('/medicalinfo/organization', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    var sql = `select HospitalID,HospitalName,HospitalLeve,HospitalType,HospitalIntroduction,Address,Image from hospital`
        exec(sql).then((HospitalOrgInfo,err)=>{
            if(err){
                res.json({
                    status:400,
                    msg:"查询失败",
                })
            }else if(HospitalOrgInfo.length == 0){
                res.json({
                    status:400,
                    msg:"暂时查询不到医院信息",
                })
            }else{ 
                    res.json({ 
                        status:200,
                        msg:"ok",
                        HospitalOrgInfo
                    })
               
            }
        })
        
})
//机构管理查询
router.get('/organizationmanage', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    var sql = `select HospitalID,HospitalName,HospitalLeve,HospitalType,HospitalIntroduction,Address,Image from hospital`
        exec(sql).then((HospitalOrgInfo,err)=>{
            if(err){
                res.json({
                    status:400,
                    msg:"查询失败",
                })
            }else if(HospitalOrgInfo.length == 0){
                res.json({
                    status:400,
                    msg:"暂时查询不到医院信息",
                })
            }else{ 
                    res.json({ 
                        status:200,
                        msg:"ok",
                        HospitalOrgInfo
                    })
               
            }
        })
        
})



//处理数据
async function dealorgdetails(data,departmentdata){
    let newarr = [];
    let newarr1 = [];
    let newobj = {};
    let DoctorIndex = 0;
    let NurseIndex = 0;
    let datacount = 0;
    var ImageAddressName = ''
    for(item of data){
        sql1 = `select RoleName,roles.RoleID from roles,user_role where UserID = '${item.UserID}' and roles.RoleID = user_role.RoleID ;`
        sql11 = `select Image from users where UserID = '${item.UserID}';`
        var Roledata = await exec(sql1) 
        var ImageAddressName1 = await exec(sql11)
        if(ImageAddressName1.length == 0){
            ImageAddressName = null
        }else{
            ImageAddressName = ImageAddressName1[0].Image
        }
        //防止此用户无角色，或者其他操作误删除，直接忽略此用户
        if(Roledata.length === 0){
            continue;
        }else{
            Rolevalues = Roledata[0].RoleID
        } 
        //console.log(Rolevalues)
        if(Rolevalues == 40){
            newarr[DoctorIndex] = {
                Name:item.Name,
                UserID:item.UserID,
                Research:item.ResearchExperienceInfo,
                RoleName:Roledata[0].RoleName,
                Image: ImageAddressName
            }
            DoctorIndex++;
        }else if(Rolevalues == 20){
            newarr1[NurseIndex] = {
                Name:item.Name,
                UserID:item.UserID,
                Research:item.ResearchExperienceInfo,
                RoleName:Roledata[0].RoleName,
                Image:ImageAddressName
            }
            NurseIndex++;
        }
        datacount ++;
    }
    newobj["Doctor"] = newarr;
    newobj["Nurse"] = newarr1;
    return newobj
    
}
//医疗机构详细查询
router.get('/medicalinfo/orgdetails/:HospitalID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //console.log(req.params)
    var sql = `select HospitalName,HospitalLeve,HospitalType,HospitalIntroduction,ContactPhone,Address,Image from hospital where HospitalID = "${req.params.HospitalID}"`
    var sql1 = `select GUID,Name,ResearchExperienceInfo,DepartmentID,UserID from users where HospitalID = "${req.params.HospitalID}";`  
    var sql2 =  `select DepartmentID,DepartmentName from departments where HospitalID = "${req.params.HospitalID}";`
    a = await exec(sql1)
    b = await exec(sql2)
    //console.log(a)
    //console.log(b)
    HospitalOrgDetails = await exec(sql)
    if(HospitalOrgDetails.length == 0){
        res.json({
            status:400,
            msg:"暂时查询不到医院信息",
        })
    }else{
        if(a.length == 0 || b.length == 0){
            res.json({ 
                status:200,
                msg:"ok",
                HospitalID:req.params.HospitalID,
                HospitalOrgDetails,
                HospitalDoctor:{
                    Doctor:[],
                    Nurse:[]
                }
            })
        }
    }
    HospitalDoctor = await dealorgdetails(a,b)
    exec(sql).then((HospitalOrgDetails,err)=>{ 
            if(err){
                res.json({
                    status:400,
                    msg:"查询失败",
                })
            }else if(HospitalOrgDetails.length == 0){
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
                        HospitalDoctor
                    })
            }
        })
        
})

//添加医疗机构
router.post('/organizationmanage/orgmanage', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //判断用户身份是否能修改机构信息
    sql3 = `select RoleID from user_role where UserID = '${req.user.UserID}'`
    isRoleID = await exec(sql3)
    if(isRoleID[0].RoleID !== 70){
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
            let sql1 = `insert into hospital (HospitalName,HospitalLeve,HospitalType,HospitalIntroduction,ContactPhone,Address,Image)
            values ('${req.body.HospitalName}','${req.body.HospitalLeve}','${req.body.HospitalType}','${req.body.HospitalIntroduction}','${req.body.ContactPhone}','${req.body.Address}','${req.body.Image}');`
            let insert_hospital =  await exec(sql1)
            let sql2 = `insert into departments (DepartmentID,HospitalID,HospitalName,DepartmentName)
            values ('1','${insert_hospital.insertId}','${req.body.HospitalName}','脑科');`
            await exec(sql2)
            res.json({
                status: 200,
                    msg: "添加成功"
            })
            
        }
    }
    
})

//机构管理的医疗机构信息详细查询
router.get('/organizationmanage/orgdetails/:HospitalID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    var sql = `select HospitalName,HospitalLeve,HospitalType,HospitalIntroduction,ContactPhone,Address,Image from hospital where HospitalID = "${req.params.HospitalID}"`
    var sql1 = `select GUID,Name,ResearchExperienceInfo,DepartmentID,UserID from users where HospitalID = "${req.params.HospitalID}";`  
    var sql2 =  `select DepartmentID,DepartmentName from departments where HospitalID = "${req.params.HospitalID}";`
    let a = await exec(sql1)
    let b = await exec(sql2)
    if(a.length === 0 || b.length === 0){
        HospitalDoctor = {
            Doctor:[],
            Nurse:[]
        }
    }else{
        HospitalDoctor = await dealorgdetails(a,b)
    }
    exec(sql).then((HospitalOrgDetails,err)=>{ 
            if(err){
                res.json({
                    status:400,
                    msg:"查询失败",
                })
            }else if(HospitalOrgDetails.length == 0){
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
                        HospitalDoctor
                    })
            }
        })
        
})

//修改团队资料
router.put('/organizationmanage/orgdetails/:HospitalID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //判断用户身份是否能修改机构信息
    sql3 = `select RoleID from user_role where UserID = '${req.user.UserID}'`
    isRoleID = await exec(sql3)
    if(isRoleID[0].RoleID !== 70){
        res.json({
             status: 400,
             msg: "您的身份无法修改医疗机构资料"
        })
    }else{
            sql2 = `update hospital set 
            HospitalName = '${req.body.HospitalName}',HospitalLeve = '${req.body.HospitalLeve}',HospitalType = '${req.body.HospitalType}',HospitalIntroduction = '${req.body.HospitalIntroduction}',ContactPhone = '${req.body.ContactPhone}',Address = '${req.body.Address}',Image = '${req.body.Image}'
            where HospitalID = '${req.params.HospitalID}';`
            try{
                exec(sql2);
                res.json({
                    status: 200,
                    msg: "修改成功"
                })
            }catch{
                res.json({
                    status: 400,
                    msg: "修改失败"
            })
            }
        
    }
})

//处理键值对应
function dealvaluekey (values,arraydata){
    var callbackdata = new Promise((resolve, reject) => {
        arraydata.forEach((item,index,arr)=>{
            if(item.DepartmentName == values){
                callbackdata = item.DepartmentID
                resolve(callbackdata)
            }
        })
    })
    return callbackdata
}

//添加机构成员
router.post('/organizationmanage/orgdetails/:HospitalID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //判断用户身份是否能修改机构信息
    var sql6 =  `select DepartmentID,DepartmentName from departments where HospitalID = "${req.params.HospitalID}";`
    DepartmentData = await exec(sql6)
    DepartmentID = await dealvaluekey(req.body.DepartmentIName,DepartmentData)
    var sql8 =  `select RoleID from roles where RoleName = "${req.body.RoleName}";`
    RoleID = await exec(sql8)
    //console.log(RoleID[0].RoleID)
    sql3 = `select RoleID from user_role where UserID = '${req.user.UserID}'`
    isRoleID = await exec(sql3)
    if(isRoleID[0].RoleID !== 70){
        res.json({
             status: 400,
             msg: "您的身份无法添加专家团队成员"
        })
    }else{
        sql4 = `select UserID,HospitalID,DepartmentID from users where UserID = '${req.body.UserID}';`
        isAddUserID = await exec(sql4)
           // console.log(isAddUserID.length)
        if(isAddUserID.length == 0){
            //如果还未注册，则插入用户信息
            //console.log(req.body)
            sql1 = `insert into users (GUID,UserID,Name,LoginPassword,HospitalID,DepartmentID) values 
            ((UUID()),'${req.body.UserID}','${req.body.Name}','${req.body.Password}','${req.params.HospitalID}','${DepartmentID}');`
            sql2 = `update user_role set RoleID = ${RoleID[0].RoleID} where UserID = '${req.body.UserID}';`
            sql12 = `insert into image (ImageID) values ('${req.body.UserID}');`
            try{
                await exec(sql1);
                await exec(sql2);
                await exec(sql12);
                res.json({
                    status: 200,
                    msg: "添加成功"
                })
            }catch{
                res.json({
                    status: 400,
                    msg: "添加失败"
            })
            }     
        }else{//如果用户已经存在于机构中，只更新，不插入
            if(isAddUserID[0].HospitalID !== null){
                res.json({
                    status: 400,
                    msg: "用户已经注册存在于某机构中，请添加别的成员"
                })
            }else{
                sql5 = `update users set HospitalID = "${req.params.HospitalID}",DepartmentID = "${DepartmentID}",LoginPassword = "${req.body.Password}",
                Name = "${req.body.Name}"  where UserID = ${req.body.UserID};`
                sql7 = `update user_role set RoleID = ${RoleID[0].RoleID} where UserID = '${req.body.UserID}';`
                try{
                    await exec(sql5)
                    await exec(sql7)
                    res.json({
                        status: 200,
                        msg: "添加成功"
                    })
                }catch{
                    res.json({
                        status: 400,
                        msg: "添加失败"
                })
                }
            }
        }
    }
})

//修改机构成员密码
router.put('/organizationmanage/userinfomodify', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //console.log(req.body)
    //判断用户身份是否能修改机构信息
    sql3 = `select RoleID from user_role where UserID = '${req.user.UserID}'`
    isRoleID = await exec(sql3)
    if(isRoleID[0].RoleID !== 70){
        res.json({
             status: 400,
             msg: "您的身份无法修改专家团队成员信息"
        })
    }else{
                sql10 = `update users set LoginPassword = ${req.body.Password} where UserID = '${req.body.UserID}';`
                exec(sql10).then((re,err)=>{
                    if(err){
                        res.json({
                            status: 400,
                            msg: "修改失败"
                       })
                    }else{
                        res.json({
                            status: 200,
                            msg: "修改成功"
                       })
                    }
                })
                 
    }
})

//删除机构成员
router.delete('/organizationmanage/orgdetails/:HospitalID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    sql3 = `select RoleID from user_role where UserID = '${req.user.UserID}'`
    isRoleID = await exec(sql3)
    if(isRoleID[0].RoleID !== 70){
        res.json({
             status: 400,
             msg: "您的身份无法删除团队成员"
        })
    }else{
     sql9 = `delete from users where UserID = '${req.body.UserID}'`
     sql10 = `delete from image where ImageID = '${req.body.UserID}'`
     sql11 = `delete from user_role where UserID = '${req.body.UserID}' and (RoleID = '40' or RoleID = '20') `
     sql12 = `select UserID from expert_user where UserID = '${req.body.UserID}'`
     var isUserIDawait  = await exec(sql12)
     if(isUserIDawait.length!=0){
        sql13 = `delete from expert_user where UserID = '${req.body.UserID}'`
        await exec(sql13)
    }
     await exec(sql11)
     await exec(sql10)
     exec(sql9).then((re)=>{
         res.json({
            status: 200,
            msg: "删除成功"
         })
     }).catch((err)=>{
         console.log(err)
        res.json({
            status: 400,
            msg: "删除失败"
         })
     })
    }
})



//------------------------------专家团队----------------------------------//
//专家团队查询
router.get('/medicalinfo/expert', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    var sql = `select ExpertID,ExpertName,ExpertSpecialty,ExpertIntroduction,ExpertImage from expert_team;`
        exec(sql).then((ExpertInfo,err)=>{
            if(err){
                res.json({
                    status:400,
                    msg:"查询失败",
                })
            }else if(ExpertInfo.length == 0){
                res.json({
                    status:400,
                    msg:"暂时查询不到专家团队信息",
                })
            }else{ 
                    res.json({ 
                        status:200,
                        msg:"ok",
                        ExpertInfo
                    })
               
            }
        })    
})

//获取某团队信息
router.get('/medicalinfo/expert_hospital', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
        // 同步写法
        async function expert_hospital(){
        try {
            var sql = `select ExpertID,ExpertName as groupName,ExpertImage as groupPic from expert_team`
            var ExpertID = await exec(sql)
            var groupInfo = []
            for(ExpertID_i in ExpertID){
                let obj = {}
                var sql2 = `select a.UserID as expId,b.Name as expName,b.Image as expPic
                from expert_user as a left join users as b
                on a.UserID = b.UserID where a.ExpertID = '${ExpertID[ExpertID_i].ExpertID}'` 
                var User_info = await exec(sql2)
                obj["groupName"] = ExpertID[ExpertID_i].groupName
                obj["groupPic"] = ExpertID[ExpertID_i].groupPic
                obj["experts"] = User_info
                groupInfo.push(obj)
            }
            res.json({
                groupInfo,
                status:200
                })
                }catch(err) {
                    console.log(err)
                    res.json({
                        error:err,
                        status:0
                    })
                } 
            }     
            expert_hospital()        
})

//专家管理团队查询
router.get('/expertmanage/expert', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    console.log("专家管理团队查询")
    var sql = `select ExpertID,ExpertName,ExpertSpecialty,ExpertIntroduction,ExpertImage from expert_team;`
        exec(sql).then((ExpertInfo,err)=>{
            if(err){
                res.json({
                    status:400,
                    msg:"查询失败",
                })
            }else if(ExpertInfo.length == 0){
                res.json({
                    status:400,
                    msg:"暂时查询不到专家团队信息",
                })
            }else{ 
                    res.json({ 
                        status:200,
                        msg:"ok",
                        ExpertInfo
                    })
               
            }
        })    
})


//处理数据
function dealexpertdetails(data){
    newarr = [];
    newobj = {};
    DoctorIndex = 0;
    datacount = 0;
    console.log(data)
    var resolvedata = new Promise((resolve, reject) => {
        data.forEach(async (item, index, arr)=>{
            var sql = `select Name,ResearchExperienceInfo from users where UserID = '${item.UserID}'`
            var userdata = await exec(sql)
            sql11 = `select Image from users where UserID = '${item.UserID}';`
            ImageAddressName =  await exec(sql11)
            if(ImageAddressName.length == 0){
                ImageAddressName =  null
            }else{
                ImageAddressName = ImageAddressName[0].Image
            }
            //console.log(userdata)
            newarr[DoctorIndex] = {
                    Name:userdata[0].Name,
                    UserID:item.UserID,
                    //DepartmentIName:DepartmentIName,
                    Research:userdata[0].ResearchExperienceInfo,
                    RoleName:"专家",
                    Image:ImageAddressName
                }
            DoctorIndex++;
            datacount++;
            if(arr.length === datacount){
            resolve(newarr)
        }
    })
    })
    return resolvedata
}
//专家管理团队详细查询
router.get('/expertmanage/expertdetails/:ExpertID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //console.log(req.params)
    var sql = `select ExpertID,ExpertName,ExpertSpecialty,ExpertIntroduction,ExpertTel,ExpertImage from expert_team where ExpertID = "${req.params.ExpertID}"`
    var sql1 = `select UserID from expert_user where ExpertID = "${req.params.ExpertID}";`  
    //var sql2 =  `select DepartmentID,DepartmentName from departments where ExpertID = "${req.params.ExpertID}";`
    a = await exec(sql1)
    //b = await exec(sql2)
    //console.log(a)
    if(a.length == 0){
        TeamDoctor = ''
    }else{
        TeamDoctor = await dealexpertdetails(a)
    }
    exec(sql).then((expertdetails,err)=>{ 
            if(err){
                res.json({
                    status:400,
                    msg:"查询失败",
                })
            }else if(expertdetails.length == 0){
                res.json({
                    status:400,
                    msg:"暂时查询不到团队信息",
                })
            }else{ 
                    res.json({ 
                        status:200,
                        msg:"ok",
                        expertdetails,
                        TeamDoctor
                    })
            }
        })
        
})
//专家团队详细查询
router.get('/medicalinfo/expertdetails/:ExpertID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //console.log(req.params)
    var sql = `select ExpertID,ExpertName,ExpertSpecialty,ExpertIntroduction,ExpertTel,ExpertImage from expert_team where ExpertID = "${req.params.ExpertID}"`
    var sql1 = `select UserID from expert_user where ExpertID = "${req.params.ExpertID}";`  
    //var sql2 =  `select DepartmentID,DepartmentName from departments where ExpertID = "${req.params.ExpertID}";`
    a = await exec(sql1)
    //b = await exec(sql2)
    //console.log(a)
    if(a.length == 0){
        TeamDoctor = ''
    }else{
        TeamDoctor = await dealexpertdetails(a)
    }
    exec(sql).then((expertdetails,err)=>{ 
            if(err){
                res.json({
                    status:400,
                    msg:"查询失败",
                })
            }else if(expertdetails.length == 0){
                res.json({
                    status:400,
                    msg:"暂时查询不到团队信息",
                })
            }else{ 
                    res.json({ 
                        status:200,
                        msg:"ok",
                        expertdetails,
                        TeamDoctor
                    })
            }
        })
        
})


//添加专家团队
router.post('/expertmanage/expert', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //判断用户身份是否能修改机构信息
    sql3 = `select RoleID from user_role where UserID = '${req.user.UserID}'`
    isRoleID = await exec(sql3)
    if(isRoleID[0].RoleID !== 80){
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
            let sql1 = `insert into expert_team (ExpertName,ExpertSpecialty,ExpertIntroduction,ExpertTel,ExpertImage)
            values ('${req.body.groupName}','${req.body.groupShanchang}','${req.body.groupIntroduction}','${req.body.groupTel}','${req.body.Image}');`
            exec(sql1).then((re)=>{
                //console.log(re)
                 res.json({
                        status: 200,
                         msg: "添加成功"
                    })
            })
            .catch((err)=>{
                res.json({
                    status: 400,
                     msg: "添加失败"
                })
            })
        }
    }
    
})

//添加专家团队成员
router.post('/expertmanage/expertdetails/member/:ExpertID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //判断用户身份是否能修改机构信息
    sql3 = `select RoleID from user_role where UserID = '${req.user.UserID}'`
    isRoleID = await exec(sql3)
    if(isRoleID[0].RoleID !== 80){
        res.json({
             status: 400,
             msg: "您的身份无法添加专家团队成员"
        })
    }else{
        sql4 = `select UserID from expert_user where UserID = '${req.body.UserID}';`
        isAddUserID = await exec(sql4)
        if(isAddUserID.length !== 0){
            res.json({
                status: 400,
                msg: "用户已经注册存在于某团队中，请添加别的成员"
            })
        }else{
            var sql5 = `select UserID from users where UserID = '${req.body.UserID}'`
            var isuser = await exec(sql5);
            if(isuser.length === 0){
                var sql1 = `insert into users (GUID,UserID,Name,LoginPassword,ResearchExperienceInfo) values 
                ('${req.body.UserID}','${req.body.UserID}','${req.body.Name}','${req.body.Password}','${req.body.Research}');`
                var sql2 = `update user_role set RoleID = 60 where UserID = '${req.body.UserID}';`
                await exec(sql1);
            }else{
                var sql2 = `update user_role set RoleID = 60 where UserID = '${req.body.UserID}';`
            }
            sql = `insert into expert_user (UserID,ExpertID) values ("${req.body.UserID}","${req.params.ExpertID}");`
            try{
                await exec(sql);
                await exec(sql2);
                res.json({
                    status: 200,
                    msg: "添加成功"
                })
            }catch{
                res.json({
                    status: 400,
                    msg: "添加失败"
            })
            }
        }
    }
})

//修改专家团队资料
router.put('/expertmanage/expertdetails/:ExpertID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //判断用户身份是否能修改机构信息
    sql3 = `select RoleID from user_role where UserID = '${req.user.UserID}'`
    isRoleID = await exec(sql3)
    if(isRoleID[0].RoleID !== 80){
        res.json({
             status: 400,
             msg: "您的身份无法修改专家团队资料"
        })
    }else{
            sql2 = `update expert_team set 
            ExpertName = '${req.body.ExpertName}',ExpertSpecialty = '${req.body.ExpertSpecialty}',ExpertIntroduction = '${req.body.ExpertIntroduction}',ExpertTel = '${req.body.ExpertTel}',ExpertImage = '${req.body.ExpertImage}'
            where ExpertID = '${req.params.ExpertID}';`
            try{
                exec(sql2);
                res.json({
                    status: 200,
                    msg: "修改成功"
                })
            }catch{
                res.json({
                    status: 400,
                    msg: "修改失败"
            })
            }
        
    }
})

//删除专家成员
router.delete('/expertmanage/expertdetails/member/:ExpertID', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    sql3 = `select RoleID from user_role where UserID = '${req.user.UserID}'`
    isRoleID = await exec(sql3)
    if(isRoleID[0].RoleID !== 80){
        res.json({
             status: 400,
             msg: "您的身份无法删除专家团队成员"
        })
    }else{
     //sql9 = `delete from users where UserID = '${req.body.UserID}'`
     sql10 = `delete from image where ImageID = '${req.body.UserID}'`
     sql11 = `delete from user_role where UserID = '${req.body.UserID}' and RoleID = '60'`
     sql12 = `select UserID from expert_user where UserID = '${req.body.UserID}'`
     var isUserIDawait  = await exec(sql12)
     if(isUserIDawait.length!=0){
        sql13 = `delete from expert_user where UserID = '${req.body.UserID}'`
        await exec(sql13)
    } 
     await exec(sql11)
     await exec(sql10)
     res.json({
        status: 200,
        msg: "删除成功"
     })
    }
})

//修改机构成员密码
router.put('/expertmanage/userinfomodify', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //console.log(req.body)
    //判断用户身份是否能修改机构信息
    sql3 = `select RoleID from user_role where UserID = '${req.user.UserID}'`
    isRoleID = await exec(sql3)
    if(isRoleID[0].RoleID !== 80){
        res.json({
             status: 400,
             msg: "您的身份无法修改专家团队成员信息"
        })
    }else{
                sql10 = `update users set LoginPassword = ${req.body.Password} where UserID = '${req.body.UserID}';`
                exec(sql10).then((re,err)=>{
                    if(err){
                        res.json({
                            status: 400,
                            msg: "修改失败"
                       })
                    }else{
                        res.json({
                            status: 200,
                            msg: "修改成功"
                       })
                    }
                })
                 
    }
})

module.exports = router;