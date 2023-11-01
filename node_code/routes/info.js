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

const formatDate = require('../time/formatetime.js');

const {
    date_schedule,
    addSchedule,
    cancelSchedule
} = require('../time/date_schedule.js');

// JWT鉴权
var jwtConfig = require("../utils/jwtAuth.js").jwtConfigAuth;
passport.use(jwtConfig);

//医生详细信息
router.get('/', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => { 
        //console.log(req.user) 
        let sql =  `select * from users_permission where UserID = '${req.user.UserID}'`  
        let sql_data = await exec(sql)
        let isPublic = []
        if(sql_data.length === 1){
            for (let k in sql_data[0]) {
                if(sql_data[0][k] === 0){
                    console.log(k)
                    isPublic.push(k)
                }
            }
        }   
        for(let i=0;i<isPublic.length;i++){
            if(isPublic[i] === "Mail"){
                isPublic[i] = "Post"
            }else if(isPublic[i] === "StudyExperienceInfo"){
                isPublic[i] = "学习经历"
            }else if(isPublic[i] === "TrainingExperienceInfo"){
                isPublic[i] = "教学经历"
            }else if(isPublic[i] === "ResearchExperienceInfo"){
                isPublic[i] = "科研经历"
            }else if(isPublic[i] === "WorkExperienceInfo"){
                isPublic[i] = "工作经历"
            }else if(isPublic[i] === "Phone"){
                isPublic[i] = "Tel"
            }
        }
        res.json({
            status:200,
            msg:"ok",
            isPublic,
            Info:{
            basicInfo:{
                    //UserID:req.user.UserID,
                    Name:req.user.Name,
                    Gender:req.user.Gender,
                    Portrait:req.user.Image,
                    Birthday:req.user.Birthday,
                    Job:req.user.Job,
                    Post:req.user.Mail,
                    Address:req.user.Address,
                    Tel:req.user.Phone
                },
                exp:[
                    {
                    title: "学习经历",
                    text: req.user.StudyExperienceInfo,
                    isPublic:req.user.StudyExperienceInfoIsPublic
                   },
                   {
                    title: "工作经历",
                    text: req.user.WorkExperienceInfo,
                    isPublic:req.user.WorkExperienceInfoIsPublic
                   },
                   {
                    title: "科研经历",
                    text: req.user.ResearchExperienceInfo,
                    isPublic:req.user.ResearchExperienceInfoIsPublic
                   },
                   {
                    title: "教学经历",
                    text: req.user.TrainingExperienceInfo,
                    isPublic:req.user.TrainingExperienceInfoIsPublic
                   }
                ]
            }
        })
})

//更改信息
router.put('/',passport.authenticate("jwt", { session: false }), 
(req, res)=>{
    console.log("infochange_id：",req.user.UserID)
    //console.log(req.body.Info)
    /**
     * isPublic:[Post,Birthday,Address,Tel,学习经历,教学经历,工作经历,科研经历]
    */
    async function changeinfoData() {
        // 同步写法
        try {

            let sql = `delete from users_permission where UserID = "${req.user.UserID}";`
            await exec(sql)
            let isPublic = new Array
            let isPublicArr = new Array
            //默认开放所有权限
            //处理isPublic数组内的数据
            for(let i=0;i<req.body.isPublic.length;i++){
                if(req.body.isPublic[i] === "Post"){
                    isPublic.push("Mail")
                }else if(req.body.isPublic[i] === "学习经历"){
                    isPublic.push("StudyExperienceInfo")
                }else if(req.body.isPublic[i] === "教学经历"){
                    isPublic.push("TrainingExperienceInfo")
                }else if(req.body.isPublic[i] === "科研经历"){
                    isPublic.push("ResearchExperienceInfo")
                }else if(req.body.isPublic[i] === "工作经历"){
                    isPublic.push("WorkExperienceInfo")
                }else if(req.body.isPublic[i] === "Tel"){
                    isPublic.push("Phone")
                }else{
                    isPublic.push(req.body.isPublic[i])
                }
                isPublicArr.push('0')
            }
            console.log(isPublic,isPublicArr)
            let str = isPublic.toString()
            let str1 = isPublicArr.toString()
            //console.log(str,str1)
            //没有设置权限的情况下，插入新的权限,未传字段的情况
            if(isPublic.length !== 0){
                let sql1 = `insert into users_permission 
                (${str},userID)
                values
                (${str1},'${req.user.UserID}');`
                await exec(sql1)
            }
            let sql2 = `update users set 
            Name='${req.body.Info.basicInfo.Name}',
            Gender= '${req.body.Info.basicInfo.Gender}',
            Job= '${req.body.Info.basicInfo.Job}',
            Mail= '${req.body.Info.basicInfo.Post}',
            Birthday= '${req.body.Info.basicInfo.Birthday}',
            Address= '${req.body.Info.basicInfo.Address}',
            Phone='${req.body.Info.basicInfo.Tel}',
            Image = '${req.body.Info.basicInfo.Portrait}',
            StudyExperienceInfo = '${req.body.Info.exp[0].text}',
            StudyExperienceInfoIsPublic = '${req.body.Info.exp[0].isPublic}',
            WorkExperienceInfo = '${req.body.Info.exp[1].text}',
            WorkExperienceInfoIsPublic = '${req.body.Info.exp[1].isPublic}',
            ResearchExperienceInfo = '${req.body.Info.exp[2].text}',
            ResearchExperienceInfoIsPublic = '${req.body.Info.exp[2].isPublic}',
            TrainingExperienceInfo = '${req.body.Info.exp[3].text}',
            TrainingExperienceInfoIsPublic = '${req.body.Info.exp[3].isPublic}'
            where UserID="${req.user.UserID}";`
            await exec(sql2)
            res.json({ 
                status:200,
                msg:"修改成功"
            })
        }catch(err) {
            console.error(err)
            res.json({
            status:0,
            msg:"修改失败"
        });
        }
    }
    changeinfoData();   
})

//教育经历（暂时未用）
router.get('/educationalexperience', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    res.json({
        status:200,
        msg:"ok",
        educationalexperience:req.user.StudyExperienceInfo,
    })
})

//修改教育经历（暂时未用）
router.put('/educationalexperience',passport.authenticate("jwt", { session: false }), 
(req, res)=>{
    console.log("infochange_id：",req.user.UserID)
    //console.log(req.body)
    var sql3 = `update users set 
        StudyExperienceInfo = '${req.body.educationalexperience}'
        where UserID="${req.user.UserID}";`
        query(sql3, (err, result) => {
         if(err){
                    res.end('[SELECT ERROR] - '+err.message)
            }else{
                res.json({
                   
                    status:200,
                    msg:"修改成功"
                })
            }
        })
})

//工作经历（暂时未用）
router.get('/workexperience', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    res.json({
        status:200,
        msg:"ok",
        workexperience:req.user.WorkExperienceInfo
    })
})

//修改工作经历（暂时未用）
router.put('/workexperience',passport.authenticate("jwt", { session: false }), 
(req, res)=>{
    console.log("infochange_id：",req.user.UserID)
    //console.log(req.body)
    var sql4 = `update users set 
        WorkExperienceInfo = '${req.body.workexperience}'
        where UserID="${req.user.UserID}";`
        query(sql4, (err, result) => {
         if(err){
                    res.end('[SELECT ERROR] - '+err.message)
            }else{
                res.json({
                   
                    status:200,
                    msg:"修改成功"
                })
            }
        })
})

//科研经历（暂时未用）
router.get('/scienceexperience', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    res.json({
        status:200,
        msg:"ok",
        scienceexperience:req.user.ResearchExperienceInfo
    })
})

//修改科研经历（暂时未用）
router.put('/scienceexperience',passport.authenticate("jwt", { session: false }), 
(req, res)=>{
    console.log("infochange_id：",req.user.UserID)
    //console.log(req.body)
    var sql5 = `update users set 
        ResearchExperienceInfo = '${req.body.scienceexperience}'
        where UserID="${req.user.UserID}";`
        query(sql5, (err, result) => {
         if(err){
                    res.end('[SELECT ERROR] - '+err.message)
            }else{
                res.json({
                   
                    status:200,
                    msg:"修改成功"
                })
            }
        })
})



//教学经历（暂时未用）
router.get('/teachingexperience', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    res.json({
        status:200,
        msg:"ok",
        teachingexperience:req.user.TrainingExperienceInfo
    })
})

//修改教学经历（暂时未用）
router.put('/teachingexperience',passport.authenticate("jwt", { session: false }), 
(req, res)=>{
    console.log("infochange_id：",req.user.UserID)
    //console.log(req.body)
    var sql6 = `update users set 
        TrainingExperienceInfo = '${req.body.teachingexperience}'
        where UserID="${req.user.UserID}";`
        query(sql6, (err, result) => {
         if(err){
                    res.end('[SELECT ERROR] - '+err.message)
            }else{
                res.json({
                    status:200,
                    msg:"修改成功"
                })
            }
        })
})

//替换键值
function convertKey(arr, key) {
    let newArr = [];
    arr.forEach((item, index) => {
      let newObj = {};
      for (var i = 0; i < key.length; i++) {
        newObj[key[i]] = item[Object.keys(item)[i]]
      }
      newArr.push(newObj);
    })
//    console.log(newArr)
    return newArr;
}
//处理返回的账户数据
function dealaccount(data,callback){
    newarr = {};
    //newarr1 = [];
    //newarr2 = [];
    //newarr3 = [];
    datacount = 0;
    //bankAccountIndex = 0;
    //alipayIndex = 0;
    //wechatIndex = 0;
    data.forEach((item, index, arr)=>{
        if(item.Bank == "alipay"){
            // newarr1[alipayIndex] = {
            //     account: item.BankAccountID,
            //     name: item.BankName
            // }
           // newarr["alipay"] = newarr1;
           // alipayIndex++;
           newarr["alipay"] = {
                account: item.BankAccountID,
                name: item.BankName
            }
        }else if(item.Bank == "wechat"){
            newarr["wechat"] = {
                account:item.BankAccountID,
                name:item.BankName
            }
            // newarr["wechat"] = newarr2
            // wechatIndex++;
        }else{
            newarr["bankAccount"] = {
                bank:item.Bank,
                account:item.BankAccountID,
                name:item.BankName
            }
            // newarr["bankAccount"] = newarr3;
            // bankAccountIndex++;
        }
    //console.log(newarr)
    datacount++;
    if(arr.length === datacount){
    //console.log(newarray)
    callback(newarr)
    }
})
}
//账户信息
router.get('/account', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    var sql19 = `select UserID from bank where UserID = "${req.user.UserID}"`
    isUserID = await exec(sql19)
    if(isUserID.length == 0){
        res.json({
            status:400,
            msg:"该账号查询不到账户信息，您可以选择添加账户",
        })
    }else{
        var sql7 = `select Bank,BankAccountID,BankName from bank where UserID="${req.user.UserID}"`
        exec(sql7).then((result,err)=>{
            if(err){
                res.json({
                    status:400,
                    msg:"查询失败",
                })
            }else{
                function foo() {
                    return new Promise((resolve, reject) => {
                        dealaccount(result, function(data){
                        resolve(data)
                        //console.log(data)
                     })
                  })
                }
                foo().then((formdata,err)=>{
                    if(err){
                        res.json({
                            status:400,
                            msg:"查询失败",
                        })
                    }
                    res.json({ 
                        status:200,
                        msg:"ok",
                        formdata,
                        defaulttype:"wechat"
                    })
                })
            }
        })
    }     
})

//绑定银行卡
router.post('/account/bankaccount', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    sql16 = `select * from bank where BankAccountID = '${req.body.bankAccount.account}'`
    var isexist = await exec(sql16)
    //console.log(isexist)
    if(isexist.length !== 0){
        res.json({
            status:200,
            msg:"账户已经存在，请勿重新绑定"
        })
    }else{
        var sql8 = `insert into bank (UserID,Bank,BankAccountID,BankName) 
        values ('${req.user.UserID}','${req.body.bankAccount.bank}','${req.body.bankAccount.account}','${req.body.bankAccount.name}');`
        return exec(sql8).then((result,err) => {
        if(err){
            res.json({
                status:200,
                msg:"绑定失败"
            })
        }
        res.json({
            status:200,
            msg:"ok"
        })
    })   
    }
    
    
})

//更新银行卡
router.put('/account/bankaccount', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    sql20 = `select BankName,UserID from bank where BankAccountID = '${req.body.preaccount}'`
    var isexist = await exec(sql20)
    //console.log(isexist.length)
    if(isexist.length == 0){
        res.json({
            status:400,
            msg:"提交的原始账号有误"
        })
    }
    else if(isexist[0].UserID !== req.user.UserID){
        res.json({
            status:400,
            msg:"提交的原始账号信息有误（或者更改的是他人账户）"
        })
    }
    else if(isexist[0].BankName !== req.body.name){
        res.json({
            status:400,
            msg:"账号和用户名不一致，无法修改"
        })
    }else{
        var sql8 = `update bank set BankAccountID = '${req.body.account}' where BankAccountID = '${req.body.preaccount}';`
        return exec(sql8).then((result,err) => {
        if(err){
            res.json({
                status:400,
                msg:"更新失败"
            })
        }
        res.json({
            status:200,
            msg:"更新成功"
        })
    })   
    }
})

//绑定支付宝
router.post('/account/alipay', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    sql17 = `select * from bank where BankAccountID = '${req.body.alipay.account}'`
    var isexist = await exec(sql17)
    console.log(isexist.length)
    if(isexist.length !== 0){
        res.json({
            status:200,
            msg:"该支付宝账户已经存在，请勿重新绑定"
        })
    }else{
        var sql8 = `insert into bank (UserID,BankAccountID,Bank,BankName) 
        values ('${req.user.UserID}','${req.body.alipay.account}','alipay','${req.body.alipay.name}');`
        return exec(sql8).then((result,err) => {
        if(err){
            res.json({
                status:200,
                msg:"绑定失败"
            })
        }
        res.json({
            status:200,
            msg:"ok"
        })
    })   
    }
})

//更新支付宝
router.put('/account/alipay', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    sql20 = `select BankName,UserID from bank where BankAccountID = '${req.body.preaccount}'`
    var isexist = await exec(sql20)
    //console.log(isexist.length)
    if(isexist.length == 0){
        res.json({
            status:400,
            msg:"提交的原始账号有误,查询不到原账号"
        })
    }
    else if(isexist[0].UserID !== req.user.UserID){
        res.json({
            status:400,
            msg:"提交的原始账号信息有误（或者更改的是他人账户）"
        })
    }
    else if(isexist[0].BankName !== req.body.name){
        res.json({
            status:400,
            msg:"账号和用户名不一致，无法修改"
        })
    }else{
        var sql8 = `update bank set BankAccountID = '${req.body.account}' where BankAccountID = '${req.body.preaccount}' and Bank = 'alipay';`
        return exec(sql8).then((result,err) => {
        if(err){
            res.json({
                status:400,
                msg:"更新失败"
            })
        }
        res.json({
            status:200,
            msg:"更新成功"
        })
    })   
    }
})

//绑定新的微信
router.post('/account/wechat', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    sql18 = `select * from bank where BankAccountID = '${req.body.wechat.account}'`
    var isexist = await exec(sql18)
    console.log(isexist.length)
    if(isexist.length !== 0){
        res.json({
            status:200,
            msg:"该微信账户已经存在，请勿重新绑定"
        })
    }else{
        var sql8 = `insert into bank (UserID,BankAccountID,Bank,BankName) 
        values ('${req.user.UserID}','${req.body.wechat.account}','wechat','${req.body.wechat.name}');`
        return exec(sql8).then((result,err) => {
        if(err){
            res.json({
                status:200,
                msg:"绑定失败"
            })
        }
        res.json({
            status:200,
            msg:"ok"
        })
    })   
    }
})
//更新微信
router.put('/account/wechat', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    sql21 = `select BankName,UserID from bank where BankAccountID = '${req.body.preaccount}'`
    var isexist = await exec(sql21)
    //console.log(isexist.length)
    if(isexist.length == 0){
        res.json({
            status:400,
            msg:"提交的原始账号有误,查询不到原账号"
        })
    }
    else if(isexist[0].UserID !== req.user.UserID){
        res.json({
            status:400,
            msg:"提交的原始账号信息有误（或者更改的是他人账户）"
        })
    }
    else if(isexist[0].BankName !== req.body.name){
        res.json({
            status:400,
            msg:"账号和用户名不一致，无法修改"
        })
    }else{
        var sql8 = `update bank set BankAccountID = '${req.body.account}' where BankAccountID = '${req.body.preaccount}' and Bank = 'wechat';`
        return exec(sql8).then((result,err) => {
        if(err){
            res.json({
                status:400,
                msg:"更新失败"
            })
        }
        res.json({
            status:200,
            msg:"更新成功"
        })
    })   
    }
})

//解绑银行卡（暂时未用）
router.delete('/bankaccount', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {
    var sql9 = `delete from bank where BankAccountID = '${req.body.BankAccountID}';`
    return exec(sql9).then(result => {
        res.json({
            status:200,
            msg:"ok"
        })
    })   
})




//处理账单信息
function dealfinance(data,callback){
    newarr = [];
    datacount = 0;
    data.forEach((item, index, arr)=>{
        newarr[index] = {
            date:item.date,
            type:"alipay",
            description: "当月总金额",
            amount:item.amount
        }
    datacount++;
    if(arr.length === datacount){
    //console.log(newarray)
    callback(newarr)
    }
})
}
//账单信息
router.get('/finance', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    var sql22 =  `select PaymentAmount from bill where DoctorID = "${req.user.UserID}"`
    isbillexist = await exec(sql22)
    //console.log(isbillexist)
    if(isbillexist.length == 0){
        res.json({
            status:400,
            msg:"该用户无账单结果",
        })
    }else{
    var sql10 = `select date_format(BillDealDataTime,'%Y%m') as date,sum(PaymentAmount) as amount from bill where DoctorID = "${req.user.UserID}" group by date;`
    return exec(sql10).then(result => {
        //console.log(result)
        console.log("bill_info_slect_id:",req.user.UserID)
        function foo() {
            return new Promise((resolve, reject) => {
                dealfinance(result, function(data){
                resolve(data)
                //console.log(data)
             })
          })
        }
        foo().then((financInfo,err)=>{
            if(err){
                res.json({
                    status:400,
                    msg:"查询失败",
                })
            }
            //console.log(financInfo)
            res.json({ 
                status:200,
                msg:"ok",
                financInfo
            })
        })
    })
    }   
})
//处理某月账单信息
function dealmonthfinance(data,callback){
    newarr = [];
    datacount = 0;
    data.forEach((item, index, arr)=>{
        newarr[index] = {
            date:item.BillDealDataTime,
            account:item.BIllInfoID,
            type:item.PaymentMethod,
            description:item.PaymentInstructions,
            amount:item.PaymentAmount
        }
    datacount++;
    if(arr.length === datacount){
    //console.log(newarray)
    callback(newarr)
    }
})
}
//查询某月账单信息
router.post('/finance', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    var sql10 = `select BillDealDataTime,PaymentAmount,PaymentMethod,PaymentInstructions from bill where DoctorID = "${req.user.UserID}" and
    date_format(BillDealDataTime,'%Y%m') = '${req.body.date}';`
    return exec(sql10).then(result => {
        //console.log(result)
        console.log("bill_info_slect_id:",req.user.UserID)
        function foo() {
            return new Promise((resolve, reject) => {
                dealmonthfinance(result, function(data){
                resolve(data)
                //console.log(data)
             })
          })
        }
        foo().then((financInfo,err)=>{
            if(err){
                res.json({
                    status:400,
                    msg:"查询失败",
                })
            }
            //console.log(financInfo)
            res.json({ 
                status:200,
                msg:"ok",
                financInfo
            })
        })
    })
    
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


//密码修改
router.put('/password',passport.authenticate("jwt", { session: false }), 
(req, res)=>{
    if(req.user.UserID !== req.body.username){
        res.json({
            status:400,
            msg:"不可更改其他用户的密码"
        })
    }
    //console.log(req.body)
    var prepass = aesDecrypt(req.body.prepass,'node')
    var newpass = aesDecrypt(req.body.newpass,'node')
    var sql11 = `select LoginPassword from users where 
                           UserID='${req.user.UserID}';`
                return exec(sql11).then(result => {
                    if(result[0].LoginPassword==prepass){
                        var sql12 = `update users set 
                        LoginPassword = '${newpass}'
                        where UserID="${req.user.UserID}";`
                        query(sql12, (err, result) => {
                         if(err){
                                    res.end('[SELECT ERROR] - '+err.message)
                            }else{
                                res.json({
                                    status:200,
                                    msg:"修改成功"
                                })
                            }
                        })
                            }else{
                                res.json({
                                    status:400,
                                    msg:"原密码输入错误"
                                })
                            }
                        })
    
})

//个人设置更新
router.put('/setting', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {
    if(req.body.isPoP == "true"){
        isPoP = 1
    }else{
        isPoP = 0
    }
    var sql13 = `update setting set 
    isPopup = '${isPoP}'
    where UserID="${req.user.UserID}";`
    query(sql13, (err, result) => {
     if(err){
                res.end('[SELECT ERROR] - '+err.message)
        }else{
            res.json({
                status:200,
                msg:"修改成功"
            })
        }
    })
})
//暂时未用
router.get('/setting/1', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {
    var sql14 = `select * from setting
    where UserID="${req.user.UserID}";`
    query(sql14, (err, result) => {
     if(err){
                res.end('[SELECT ERROR] - '+err.message)
        }else{
            res.json({
                result
            })
        }
    })
})


//根据ID获取医生头像等基本信息
router.post('/userinfo',
//passport.authenticate("jwt", { session: false }),
(req, res) => {
    async function user_info() {
        // 同步写法
        try {
            var UsersID = req.body.UsersID 
            var Users_info = []
            for(key in UsersID){
                var sql = `select 
                a.UserID,
                a.Name,
                a.Image,
                a.Address,
                a.Phone,
                a.Gender,
                a.Birthday,
                b.HospitalName,
                a.ResearchExperienceInfo
                from users as a left join hospital as b
                on a.HospitalID = b.HospitalID
                where a.UserID = '${UsersID[key]}'
                `
                var user_info = await exec(sql)
                Users_info.push(user_info[0])
            }
            
              res.json({
                status:200,
                users_info:Users_info
              })
              }catch(err){
                  console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示"
                        })
                      }
                }
                user_info();
})


//根据ID获取医生头像等基本信息
router.post('/patient_userinfo',
//passport.authenticate("jwt", { session: false }),
(req, res) => {
    async function patient_userinfo() {
        // 同步写法
        try {
            var UsersID = req.body.UsersID 
            var Users_info = []
            for(UsersID_i in UsersID){
                console.log(UsersID[UsersID_i])
                var sql = `select 
                UserID,
                Name,
                Image,
                Address,
                Phone,
                Gender,
                Birthday,
                Phone,
                ResearchExperienceInfo
                from users 
                where UserID = '${UsersID[UsersID_i]}'
                `
                var user_info = await exec(sql)
                console.log(user_info)
                Users_info.push(user_info[0])
            }
            
              res.json({
                status:200,
                users_info:Users_info
              })
              }catch(err){
                  console.log(err)
                        res.json({
                            status:0,
                            msg:"暂时无法显示"
                        })
                      }
                }
                patient_userinfo();
})

//更新详细时间安排
async function insert_weektime(week,weekday,timeID,userID){
    /**
     * week:["14:20-15:20","17:20-18:20"]  // 安排
     * weekday:one      //周几
     * timeID:1         //日程安排ID
     * userID:101001    //用户ID
     */
    for(let week_i=0 ; week_i<week.length ; week_i++){
        let startTime = week[week_i].split('-')[0] + ':00'
        let endTime = week[week_i].split('-')[1] + ':00'
        //console.log(startTime,endTime)
        let sql = `insert into time_manage_relation (TimeID,Weekday,StartTime,EndTime,TimeChar,UserID)
        values
        (${timeID},'${weekday}','${startTime}','${endTime}','${week[week_i]}','${userID}')
        `
        await exec(sql)
    }
}
//添加接诊的时间
router.post('/addDiagTime',
passport.authenticate("jwt", { session: false }),
(req, res) => {
    //请求类型
    // {
    //     one: ["14:20-15:20","16:20-17:20"],
    //     two: [],
    //     three: [],
    //     four: [],
    //     five: [],
    //     six: [],
    //     seven: [],
    //   }
async function addDiagTime() {
    // 同步写法
    try {
        //先判断是否已经存在该用户的日程表，存在即更新，不存在即添加
        let sql = `select TimeID from time_manage where UserID = '${req.user.UserID}' and TimeType = "diag"`
        let TimeID = await exec(sql)
        var isInsert = false
        //判断是否存在
        if(TimeID.length === 0){
            //不存在就添加
            let sql1 = `insert into time_manage 
            (UserID,Mon,Tue,Wed,Thu,Fri,Sat,Sun,TimeType) 
            values 
            ('${req.user.UserID}',
            '${JSON.stringify(req.body.one)}',
            '${JSON.stringify(req.body.two)}',
            '${JSON.stringify(req.body.three)}',
            '${JSON.stringify(req.body.four)}',
            '${JSON.stringify(req.body.five)}',
            '${JSON.stringify(req.body.six)}',
            '${JSON.stringify(req.body.seven)}',
            "diag") `
            var insert_time = await exec(sql1)
            //更新插入标志位
            isInsert = true
        }else{
            let sql1 = `update time_manage set
            Mon = '${JSON.stringify(req.body.one)}',
            Tue = '${JSON.stringify(req.body.two)}',
            Wed = '${JSON.stringify(req.body.three)}',
            Thu = '${JSON.stringify(req.body.four)}',
            Fri = '${JSON.stringify(req.body.five)}',
            Sat = '${JSON.stringify(req.body.six)}',
            Sun = '${JSON.stringify(req.body.seven)}'
            where UserID = '${req.user.UserID}' and TimeType = "diag"`
            await exec(sql1)
        }
        //删除存在的时间安排
        //选择日程ID
        if(isInsert){
            var timeID = insert_time.insertId
        }else{
            var timeID = TimeID[0].TimeID
        }
        let sql2 = `delete from time_manage_relation where TimeID = '${timeID}'`
        await exec(sql2)
        //插入周一至周日的时间安排
        insert_weektime(req.body.one,'one',timeID,req.user.UserID)
        insert_weektime(req.body.two,'two',timeID,req.user.UserID)
        insert_weektime(req.body.three,'three',timeID,req.user.UserID)
        insert_weektime(req.body.four,'four',timeID,req.user.UserID)
        insert_weektime(req.body.five,'five',timeID,req.user.UserID)
        insert_weektime(req.body.six,'six',timeID,req.user.UserID)
        insert_weektime(req.body.seven,'seven',timeID,req.user.UserID)
        res.json({
            status:200,
            msg:'添加成功'
        })
        }catch(err){
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示服务器报错"+err
                })
                }
        }
addDiagTime();
})

//获取接诊的时间
router.get('/getDiagTime',
passport.authenticate("jwt", { session: false }),
(req, res) => {
async function getDiagTime() {
    // 同步写法
    try {
            let sql2 = `select Mon,Tue,Wed,Thu,Fri,Sat,Sun from time_manage where UserID = '${req.user.UserID}' and TimeType = "diag" `
            let Timeinfo = await exec(sql2)
            if(Timeinfo.length === 0){
                //不存在则返回空
                diagPlan =  {
                    one: [],
                    two: [],
                    three: [],
                    four: [],
                    five: [],
                    six: [],
                    seven: [],
                }
            }else{
                diagPlan =  {
                    one: JSON.parse(Timeinfo[0].Mon),
                    two: JSON.parse(Timeinfo[0].Tue),
                    three: JSON.parse(Timeinfo[0].Wed),
                    four:  JSON.parse(Timeinfo[0].Thu),
                    five:  JSON.parse(Timeinfo[0].Fri),
                    six: JSON.parse(Timeinfo[0].Sat),
                    seven: JSON.parse(Timeinfo[0].Sun),
                }
            }
        res.json({
            status:200,
            diagPlan
        })
        }catch(err){
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示服务器报错"+err
                })
                }
        }
        getDiagTime();
})


//添加视频接诊的时间
router.post('/addVideoDiagTime',
passport.authenticate("jwt", { session: false }),
(req, res) => {
    //请求类型
    // {
    //     one: ["14:20-15:20","16:20-17:20"],
    //     two: [],
    //     three: [],
    //     four: [],
    //     five: [],
    //     six: [],
    //     seven: [],
    //   }
async function addVideoDiagTime() {
    // 同步写法
    try {
        //先判断是否已经存在该用户的日程表，存在即更新，不存在即添加
        let sql = `select TimeID from time_manage where UserID = '${req.user.UserID}' and TimeType = "VideoDiag"`
        let TimeID = await exec(sql)
        var isInsert = false
        //判断是否存在
        if(TimeID.length === 0){
            //不存在就添加
            let sql1 = `insert into time_manage 
            (UserID,Mon,Tue,Wed,Thu,Fri,Sat,Sun,TimeType) 
            values 
            ('${req.user.UserID}',
            '${JSON.stringify(req.body.one)}',
            '${JSON.stringify(req.body.two)}',
            '${JSON.stringify(req.body.three)}',
            '${JSON.stringify(req.body.four)}',
            '${JSON.stringify(req.body.five)}',
            '${JSON.stringify(req.body.six)}',
            '${JSON.stringify(req.body.seven)}',
            "VideoDiag") `
            var insert_time = await exec(sql1)
            isInsert = true
        }else{
            let sql1 = `update time_manage set
            Mon = '${JSON.stringify(req.body.one)}',
            Tue = '${JSON.stringify(req.body.two)}',
            Wed = '${JSON.stringify(req.body.three)}',
            Thu = '${JSON.stringify(req.body.four)}',
            Fri = '${JSON.stringify(req.body.five)}',
            Sat = '${JSON.stringify(req.body.six)}',
            Sun = '${JSON.stringify(req.body.seven)}'
            where UserID = '${req.user.UserID}' and TimeType = "VideoDiag"`
            await exec(sql1)
        }
        //删除存在的时间安排
        //选择日程ID
        if(isInsert){
            var timeID = insert_time.insertId
        }else{
            var timeID = TimeID[0].TimeID
        }
        let sql2 = `delete from time_manage_relation where TimeID = '${timeID}'`
        await exec(sql2)
        //插入周一至周日的时间安排
        insert_weektime(req.body.one,'one',timeID,req.user.UserID)
        insert_weektime(req.body.two,'two',timeID,req.user.UserID)
        insert_weektime(req.body.three,'three',timeID,req.user.UserID)
        insert_weektime(req.body.four,'four',timeID,req.user.UserID)
        insert_weektime(req.body.five,'five',timeID,req.user.UserID)
        insert_weektime(req.body.six,'six',timeID,req.user.UserID)
        insert_weektime(req.body.seven,'seven',timeID,req.user.UserID)
        res.json({
            status:200,
            msg:'添加成功'
        })
        }catch(err){
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示服务器报错"+err
                })
                }
        }
        addVideoDiagTime();
})

//获取视频接诊的时间
router.get('/getVideoDiagTime',
passport.authenticate("jwt", { session: false }),
(req, res) => {
async function getVideoDiagTime() {
    // 同步写法
    try {
            let sql2 = `select Mon,Tue,Wed,Thu,Fri,Sat,Sun from time_manage where UserID = '${req.user.UserID}' and TimeType = "VideoDiag" `
            let Timeinfo = await exec(sql2)
            if(Timeinfo.length === 0){
                //不存在则返回空
                shipingHuizhenPlan =  {
                    one: [],
                    two: [],
                    three: [],
                    four: [],
                    five: [],
                    six: [],
                    seven: [],
                }
            }else{
                shipingHuizhenPlan =  {
                    one: JSON.parse(Timeinfo[0].Mon),
                    two: JSON.parse(Timeinfo[0].Tue),
                    three: JSON.parse(Timeinfo[0].Wed),
                    four:  JSON.parse(Timeinfo[0].Thu),
                    five:  JSON.parse(Timeinfo[0].Fri),
                    six: JSON.parse(Timeinfo[0].Sat),
                    seven: JSON.parse(Timeinfo[0].Sun),
                }
            }
        res.json({
            status:200,
            shipingHuizhenPlan
        })
        }catch(err){
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示服务器报错"+err
                })
                }
        }
        getVideoDiagTime();
})

//获取我当前的日程安排
router.post('/getTime',
passport.authenticate("jwt", { session: false }),
(req, res) => {
async function getTime() {
    // 同步写法
    try {
            let UserID = req.user.UserID
            //2020-11
            let Time = req.body.Time
            //2020-11-01 00:00:00
            let month_start = Time + '-01 00:00:00'
            //2020-12-01 00:00:00
            if(Time.split('-')[1] === "12"){
                console.log(parseInt(Time.split('-')[0])+1)
                var month_end = parseInt(parseInt(Time.split('-')[0])+1) + '-01' + '-01 00:00:00'
            }else if(Time.split('-')[1]<10){
                var month_end = Time.split('-')[0] + '-0' +parseInt(parseInt(Time.split('-')[1])+1) + '-01 00:00:00' 
            }else{
                var month_end = Time.split('-')[0] + '-'+ parseInt(parseInt(Time.split('-')[1])+1) + '-01 00:00:00' 
            }
            //console.log(month_start,month_end)
            //转换为时间戳
            let monthStartDateTime = new Date(month_start).getTime()
            let monthEndDateTime = new Date(month_end).getTime() 
            let sql = `select StartTime,EndTime,TimeContent,TimePlanID from time_schedule 
            where UserID = '${UserID}' and 
            ((StartTime<${monthEndDateTime} and ${monthStartDateTime}<StartTime) or 
            (EndTime<${monthEndDateTime} and ${monthStartDateTime}<EndTime))`
            let schedulePlan = await exec(sql)
            //console.log(schedulePlan)
            //定义月事件
            let tasks = []
            //按天遍历月份当中的每一天，一天的时间戳转换为毫秒就是86400
            for(start_time = monthStartDateTime;start_time<monthEndDateTime;start_time+=86400000){
                //定义一天的时间，多条事件的话推入该数组
                let items = []
                let end_time = start_time + 86400000
                //console.log(formatDate(1609387200000))
                //遍历当月的时间事件（schedulePlan）
                //console.log(start_time,end_time)
                for(schedulePlan_i=0;schedulePlan_i<schedulePlan.length;schedulePlan_i++){
                    //console.log(schedulePlan[schedulePlan_i].StartTime,schedulePlan[schedulePlan_i].EndTime)
                    //如果起止时间，截至时间都落在当天的时间范围内[start_time,start_time+86400000]内，则推入当日的日程中
                    if(schedulePlan[schedulePlan_i].StartTime<end_time&&
                        schedulePlan[schedulePlan_i].StartTime>=start_time&&
                        schedulePlan[schedulePlan_i].EndTime<end_time&&
                        schedulePlan[schedulePlan_i].EndTime>=start_time){
                            let time_obj = {
                                startTime:formatDate(schedulePlan[schedulePlan_i].StartTime),
                                endTime:formatDate(schedulePlan[schedulePlan_i].EndTime),
                                content:schedulePlan[schedulePlan_i].TimeContent,
                                TimePlanID:schedulePlan[schedulePlan_i].TimePlanID
                            }
                            items.push(time_obj)
                            //下面的else if是起始时间在当天，结束时间不在当天的情况,将当天时间进行分割，推入数组的末尾，并将当前时间事件删除
                    }else if(schedulePlan[schedulePlan_i].StartTime<end_time
                        &&schedulePlan[schedulePlan_i].StartTime>=start_time&&
                        schedulePlan[schedulePlan_i].EndTime>end_time){
                            //先推入当天事件的起始时间加上当天的末尾时间
                            let time_obj = {
                                startTime:formatDate(schedulePlan[schedulePlan_i].StartTime),
                                endTime:formatDate(end_time),
                                content:schedulePlan[schedulePlan_i].TimeContent,
                                TimePlanID:schedulePlan[schedulePlan_i].TimePlanID
                            }
                            items.push(time_obj)
                            //切割时间，定义一个schedulePlan新的对象
                            let schedulePlan_temp = {
                                StartTime:end_time,
                                EndTime:schedulePlan[schedulePlan_i].EndTime,
                                TimeContent:schedulePlan[schedulePlan_i].TimeContent,
                                TimePlanID:schedulePlan[schedulePlan_i].TimePlanID
                            }
                            schedulePlan.push(schedulePlan_temp)
                            //将原数组内的对象删除
                            schedulePlan.splice(schedulePlan_i,1)
                        //下面的else if(表示事件起始时间小于开始，时间结束时间落在当天),这种情况一般落在1号，无需切割
                    }else if(
                        schedulePlan[schedulePlan_i].StartTime<start_time&&
                        schedulePlan[schedulePlan_i].EndTime>=start_time&&
                        schedulePlan[schedulePlan_i].EndTime<end_time){
                        //先推入当天事件的起始时间加上当天的末尾时间
                        let time_obj = {
                            startTime:formatDate(start_time),
                            endTime:formatDate(schedulePlan[schedulePlan_i].EndTime),
                            content:schedulePlan[schedulePlan_i].TimeContent,
                            TimePlanID:schedulePlan[schedulePlan_i].TimePlanID
                        }
                        items.push(time_obj)
                    }
                }
                //console.log(items)
                //如果当天没有事件，则进行下一天的
                if(items.length != 0){
                    //产生当天时间
                    let date_obj = {
                        date:formatDate(start_time).split(' ')[0],
                        items
                    }
                    tasks.push(date_obj)
                }
                //console.log(start_time,monthEndDateTime)
            }
            res.json({
                status:200,
                tasks
            })
        }catch(err){
            console.log(err)
                res.json({
                    status:0,
                    msg:"暂时无法显示服务器报错"+err
                })
                }
        }
        getTime();
})

//添加日程
router.post('/addTime',
passport.authenticate("jwt", { session: false }),
(req, res) => {
async function addTime() {
    // 同步写法
    try {
        // {
        //     content: "视频会诊"
        //     date: "2020-12-24"
        //     endTime: "2020-12-02 11:32:12"
        //     startTime: "2020-12-02 10:32:12"
        //     }
            
            let startDateTime = req.body.date + ' ' + req.body.startTime.split(' ')[1]
            let endDateTime = req.body.date + ' ' +  req.body.endTime.split(' ')[1]
            console.log(startDateTime,endDateTime)
            startDateTime = new Date(startDateTime).getTime()
            endDateTime = new Date(endDateTime).getTime() 
            let sql = `insert into time_schedule (StartTime,EndTime,TimeContent,UserID) 
                    values 
                    (${startDateTime},${endDateTime},"${req.body.content}",'${req.user.UserID}')` 
            let addTimeID = await exec(sql)
            addSchedule(startDateTime,req.body.content,req.user.UserID,addTimeID.insertId)
            res.json({
                status:200,
                msg:'添加日程成功'
            })
        }catch(err){
            console.log(err)
                    res.json({
                        status:0,
                        msg:"暂时无法显示服务器报错"+err
                    })
                }
        }
        addTime();
})

//删除日程
router.post('/deleteTime',
passport.authenticate("jwt", { session: false }),
(req, res) => {
async function deleteTime() {
    // 同步写法
    try {
        // {
        //     "TimePlanID": "5"
        // }
            
            let sql1 = `select TimePlanID,TimeType,GPID from time_schedule 
            where TimePlanID = '${req.body.TimePlanID}' and UserID = '${req.user.UserID}';`
            let timePlan = await exec(sql1)
            if(timePlan.length === 0){
                res.json({
                    status:200,
                    msg:'删除的日程不存在'
                })
            }else if(timePlan[0].GPID === null || timePlan[0].GPID === ''){
                //这种日程为后期添加的，可以删除
                let sql = `delete from time_schedule where TimePlanID = '${timePlan[0].TimePlanID}'` 
                await exec(sql)
                cancelSchedule(timePlan[0].TimePlanID)
                res.json({
                    status:200,
                    msg:'删除成功'
                })
            }else{
                //这种时候的日程为视频会诊的日程，不可删除
                res.json({
                    status:0,
                    msg:'日程为视频会诊的日程，不可删除'
                })
            }
        }catch(err){
            console.log(err)
                    res.json({
                        status:0,
                        msg:"暂时无法显示服务器报错"+err
                    })
                }
        }
        deleteTime();
})

//修改日程
router.post('/updateTime',
passport.authenticate("jwt", { session: false }),
(req, res) => {
async function updateTime() {
    // 同步写法
    try {
        // {
        //     "TimePlanID": "5",
        //     "content": "视频会诊",
        //     "endTime": "2020-12-02 11:32:12",
        //     "startTime": "2020-12-02 10:32:12",
        // }
            
            let startDateTime = new Date(req.body.startTime).getTime()
            let endDateTime = new Date(req.body.endTime).getTime()
            console.log(startDateTime,endDateTime)
            let sql1 = `select TimePlanID,TimeType,GPID from time_schedule 
            where TimePlanID = '${req.body.TimePlanID}' and UserID = '${req.user.UserID}';`
            let timePlan = await exec(sql1)
            if(timePlan.length === 0){
                res.json({
                    status:200,
                    msg:'修改的的日程不存在'
                })
            }
            //else if(timePlan[0].GPID === null || timePlan[0].GPID === ''){
            else if(true){
                //这种日程为后期添加的，可以删除
                let sql = `update time_schedule set 
                TimeContent = '${req.body.content}',
                StartTime = '${startDateTime}',
                EndTime = '${endDateTime}'
                where TimePlanID = '${timePlan[0].TimePlanID}'` 
                exec(sql)
                res.json({
                    status:200,
                    msg:'更新成功'
                })
            }else{
                //这种时候的日程为视频会诊的日程，不可修改
                res.json({
                    status:200,
                    msg:'日程为视频会诊的日程，不可更改'
                })
            }
        }catch(err){
            console.log(err)
                    res.json({
                        status:0,
                        msg:"暂时无法显示服务器报错"+err
                    })
                }
        }
        updateTime();
})

//查询用户角色
router.post('/role',
//passport.authenticate("jwt", { session: false }),
(req, res) => {
async function role() {
    // 同步写法
    try {
        // {
        //     "UserID": 101001
        // }
            let sql1 = `select distinct a.RoleID,b.RoleName from user_role as a
            left join roles as b
            on a.RoleID = b.RoleID
            where UserID = '${req.body.UserID}';`
            let role = await exec(sql1)
            let roles = []
            for(role_i in role){
                roles.push(role[role_i].RoleName)
            }
            res.json({
                status:200,
                roles
            })
            
        }catch(err){
            console.log(err)
                    res.json({
                        status:0,
                        msg:"暂时无法显示服务器报错"+err
                    })
                }
        }
        role();
})

//查挂号数
router.get('/maxNumber', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => { 
        res.json({
            status:200,
            maxNumber:req.user.SeekmedicalNumber
        })
})




module.exports = router;