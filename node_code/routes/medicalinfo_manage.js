var express = require('express');
var app = express();
var router = express.Router();
const {exec} = require('../db/config.js');
const passport = require('passport');
const query = require('../db/mysql.js');
var moment = require('moment');
const formatDate = require('../time/formatetime.js');
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


//添加诊断的结论or症状or治疗结论
router.post('/addDescription', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function addDescription() {
        // 同步写法
        try {
            let content = req.body.content
            //判断添加的类型
            if(req.body.type === '诊断用语'){
                //查询添加的诊断用语是否已经存在过了，存在的话加直接返回，不存在就添加进去
                var sql = `select ICD_ID from diagnosis_index where DiagnosisIndexName = '${content}'`
                var DiagnosisDescription = await exec(sql)
                if(DiagnosisDescription.length === 0){
                    //不存在这种诊断用语的话，插入诊断用语
                    let sql1 = `insert into diagnosis_index (DiagnosisIndexName,AddFlag,UserID,AddTime)
                    values
                    ('${content}','1','${req.user.UserID}','${moment().format('YYYY-MM-DD HH:mm:ss')}');`
                    await exec(sql1)
                }else{
                    //已经存在这种诊断用语的话,直接返回
                    return res.json({
                        status:200,
                        msg:'新添加的诊断用语已经存在于数据库中'
                    })
                     
                }
            }else if(req.body.type === '治疗用语'){
                //查询添加的治疗用语是否已经存在过了，存在的话加直接返回，不存在就添加进去
                let sql = `select TreatmentIndexID from treatment_index where TreatmentName = '${content}'`
                let SymptomIndexID = await exec(sql)
                if(SymptomIndexID.length === 0){
                    //不存在这种治疗用语的话，插入治疗用语
                    let sql1 = `insert into treatment_index (TreatmentName,AddFlag,UserID,AddTime)
                    values
                    ('${content}','1','${req.user.UserID}','${moment().format('YYYY-MM-DD HH:mm:ss')}');`
                    await exec(sql1)
                }else{
                    //已经存在这种治疗用语的话
                    return res.json({
                        status:200,
                        msg:'新添加的治疗用语已经存在于数据库中'
                    })
                }
            }else if(req.body.type === '症状'){
                //查询添加的症状是否已经存在过了，存在的话加直接返回，不存在就添加进去
                let sql = `select SymptomIndexID from symptom_index where SymptomIndexName = '${content}'`
                let SymptomIndexID = await exec(sql)
                if(SymptomIndexID.length === 0){
                    //不存在这种症状的话，插入症状
                    let sql1 = `insert into symptom_index (SymptomIndexName,AddFlag,UserID,AddTime)
                    values
                    ('${content}','1','${req.user.UserID}','${moment().format('YYYY-MM-DD HH:mm:ss')}');`
                    await exec(sql1)
                }else{
                    //已经存在这种症状的话
                    return res.json({
                        status:200,
                        msg:'新添加的症状已经存在于数据库中'
                    })
                }
            }else{
                //暂时还没有用这种情况
            }
            res.json({
                status:200,
                msg:'添加成功'
            })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"上传失败，服务器报错"+ err
                })
                }
        }
    addDescription();  
})


//删除诊断的结论or症状or治疗结论
router.post('/deleteDescription', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {                 
    async function deleteDescription() {
        // 同步写法
        try {
            let content = req.body.content
            //判断添加的类型
            if(req.body.type === '诊断用语'){
                //查询添加的诊断用语是否已经存在过了，存在的话加直接返回，不存在就添加进去
                var sql = `delete from diagnosis_index where DiagnosisIndexName = '${content}'`
                await exec(sql)
                
            }else if(req.body.type === '治疗用语'){
                //查询添加的治疗用语是否已经存在过了，存在的话加直接返回，不存在就添加进去
                let sql = `delete from treatment_index where TreatmentName = '${content}'`
                 await exec(sql)
                 
            }else if(req.body.type === '症状'){
                //查询添加的症状是否已经存在过了，存在的话加直接返回，不存在就添加进去
                let sql = `delete from symptom_index where SymptomIndexName = '${content}'`
                await exec(sql)
            }else{
                //暂时还没有用这种情况
            }
            res.json({
                status:200,
                msg:'删除成功'
            })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"失败，服务器报错"+ err
                })
                }
        }
        deleteDescription();  
})


//查询诊断结论
router.post('/resultoptions', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
        //同步写法
        async function resultoption() {
        try {
                let num = 10
                let sql = `select DiagnosisIndexName from diagnosis_index where DiagnosisIndexName != ""
                limit ${(req.body.page-1)*num},${num};
                `
                let DiagnosisDescription = await exec(sql)
                let sql1 = `select count(DiagnosisIndexName) as count1 from diagnosis_index where DiagnosisIndexName != ""
                `
                let maxNum = await exec(sql1)
                res.json({
                    DiagnosisDescription,
                    maxNum:maxNum[0].count1
                })
                }catch(err) {
                    console.log(err)
                    res.json({
                        error:err,
                        status:0
                    })
                } 
            }     
            resultoption()        
})



//查询治疗结论
router.post('/treatmentoptions', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
        // 同步写法
        async function treatmentOption() {
        try {
                let num = 5
                var sql = `select TreatmentName from treatment_index where TreatmentName != ""
                limit ${(req.body.page-1)*num},${num};
                `
                var treatmentName = await exec(sql)
                var sql1 = `select count(TreatmentName) as count1 from treatment_index where TreatmentName != ""
                `
                let maxNum = await exec(sql1)
                res.json({
                    treatmentName,
                    maxNum:maxNum[0].count1
                })
                }catch(err) {
                    console.log(err)
                    res.json({
                        error:err,
                        status:0
                    })
                } 
            }     
            treatmentOption()        
})







//添加药品
router.post('/addDrug', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {   
    /**
     * {
            img: "",
            name: "",
            classfication: "",
            type: "",
            specification: "",
            manufacturer: "",
            approvalNumber: "",
            standardCode: "",
            use: "",
            introduction: ""
             
     */              
    async function addDrug() {
        // 同步写法
        try {
            //将药品插入
            let sql = `insert into drugs
            (Drug_Registration_Name,
            Drug_Registration_Specifications,
            Drug_List_Dosage_Form,
            Pic,
            Approval_Number,
            Production_Units,
            Drug_Code,
            Classfication,
            DrugsUse,
            Introduction,
            ImportDoctor,
            ImportDate) 
            values 
            ('${req.body.name}',
            '${req.body.specification}',
            '${req.body.type}',
            '${req.body.img}',
            '${req.body.approvalNumber}',
            '${req.body.manufacturer}',
            '${req.body.standardCode}',
            '${req.body.classfication}',
            '${req.body.drugUse}',
            '${req.body.introduction}',
            '${req.user.UserID}',
            '${moment().format('YYYY-MM-DD HH:mm:ss')}');`
            await exec(sql)
            res.json({
                status:200,
                msg:'添加成功'
            })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"上传失败，服务器报错"+ err
                })
                }
        }
        addDrug();  
})


//删除药品
router.post('/deleteDrug', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {   
    /**
     * {
            drugsID:    //药品ID,
            standardCode:   //标准码
        }
     */              
    async function deleteDrug() {
        // 同步写法
        try {
            //更新药品删除标志位
            let sql = `update drugs set Drugs_delete = '0' where drugsID = '${req.body.drugsID}' ;`
            await exec(sql)
            res.json({
                status:200,
                msg:'删除成功'
            })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"失败，服务器报错"+ err
                })
                }
        }
        deleteDrug();  
})


//查询药品
router.post('/getDrug', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {   
    /**
     * 
           {
                name:"",//名称
                classfication:"",
                approvalNumber:"",
                standardCode:"",     
                page:"1",//第几页
                空的话就不作为判断条件
            }
        
     */              
    async function getDrug() {
        // 同步写法
        try { 
            //定义一页返回多少条数据
            let num = 10
            //定义数据库查询字段
            let str = ''
            if(req.body.name != ''){
                str += 'Drug_Registration_Name like ' + "'%" + req.body.name + "%'"
            }
            if(req.body.classfication != ''){
                if(str === '') {
                    str += 'Classfication = ' + "'" + req.body.classfication  + "'"
                }else{
                    str += ' and Classfication = ' + "'" +  req.body.classfication + "'"
                }   
            }
            if(req.body.approvalNumber != ''){
                if(str === '') {
                    str += 'Approval_Number = ' + "'" + req.body.approvalNumber + "'"
                }else{
                    str += ' and Approval_Number = ' + "'" + req.body.approvalNumber + "'"
                }   
            }
            if(req.body.standardCode != ''){
                if(str === '') {
                    str += 'Drug_Code = ' + "'" + req.body.standardCode + "'"
                }else{
                    str += ' and Drug_Code = ' + "'" + req.body.standardCode + "'"
                }   
            }
            //确保药品没被删除
            if(str === ''){
                str += 'Drugs_delete = "1"' 
            }else{
                str += ' and Drugs_delete = "1"' 
            }
            let sql = `select 
            drugsID,
            Drug_Registration_Name as name,
            Drug_Registration_Specifications as specification,
            Drug_List_Dosage_Form as type,
            Pic as img,
            Approval_Number as approvalNumber,
            Production_Units as manufacturer,
            Drug_Code as standardCode,
            DrugsUse as drugUse,
            Introduction as introduction,
            Classfication as classfication
            from drugs where ${str} 
            limit ${(req.body.page-1)*num},${num};`
            let sql1 = `select 
            count(drugsID) as totalNumber
            from drugs where ${str}`
            //console.log(sql)
            let durgsInfo = await exec(sql)
            let drugscount = await exec(sql1)
            //console.log(drugscount)
            
            res.json({
                status:200,
                durgsInfo,
                totalNumber:drugscount[0].totalNumber
            })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"失败，服务器报错"+ err
                })
                }
        }
        getDrug();  
})


//添加症状
router.post('/addSymptom', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {   
    /**
     * {
     *   {
            content: "头疼",
            voice: "https://www.runoob.com/try/demo_source/horse.mp3",
            liyu: [
                {
                    label: "成都话",
                    value: "瓜娃子",
                    voice: "https://www.runoob.com/try/demo_source/horse.mp3"
                }
            ],
            img: "",
        }
     }       
     */              
    async function addSymptom() {
        // 同步写法
        try {
            //查询添加的症状是否已经存在过了，存在的话加直接返回，不存在就添加进去
            let sql = `select SymptomIndexID from symptom_index where SymptomIndexName = '${req.body.content}'`
            let SymptomIndexID = await exec(sql)
            if(SymptomIndexID.length === 0){
                //不存在这种症状的话，插入症状
                let sql1 = `insert into symptom_index 
                (SymptomIndexName,AddFlag,UserID,AddTime,SymptomImg,SymptomAudio)
                values
                ('${req.body.content}','1','${req.user.UserID}',
                '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                '${req.body.img}','${req.body.voice}');`
                let symptomInsert = await exec(sql1)
                //症状iD对应的俚语
                var symptomIndexID = symptomInsert.insertId
            }else{
                //已经存在这种症状的话，进行更新
                var symptomIndexID = SymptomIndexID[0].SymptomIndexID
                let sql1 = `update symptom_index set 
                SymptomImg = '${req.body.img}',
                SymptomAudio = '${req.body.voice}'
                where SymptomIndexID = '${symptomIndexID}' and SymptomIndexName = '${req.body.content}'`
                exec(sql1)
                res.json({
                    status:200,
                    msg:'新添加的症状已经存在于数据库中'
                })
            }
            //插入俚语
            let liyu = req.body.liyu
            for(let liyu_i=0;liyu_i<liyu.length;liyu++){
                let sql2 = `insert into symptom_dialect 
                (Dialect,DialectType,SymptomDialectID,DialectAudio)
                values
                ('${liyu[liyu_i].value}','${liyu[liyu_i].label}','${symptomIndexID}','${liyu[liyu_i].voice}');`
                await exec(sql2)
            }
            res.json({
                status:200,
                msg:'成功'
            })
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"上传失败，服务器报错"+ err
                })
                }
        }
        addSymptom();  
})

//查看症状
router.get('/getSymptom', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
        // 同步写法
        async function getSymptom() {
        try {
                let sql = `select 
                SymptomIndexName as content,
                SymptomIndexID as id,
                SymptomImg as img,
                SymptomAudio as voice
                from symptom_index where SymptomIndexName != "";`
                var stateDescription = await exec(sql)
                for(stateDescription_i=0;stateDescription_i<stateDescription.length;stateDescription_i++){
                    let sql1 = `select Dialect as value,DialectType as label,DialectAudio as voice
                    from symptom_dialect where SymptomDialectID = '${stateDescription[stateDescription_i].id}';`
                    let liyu = await exec(sql1)
                    stateDescription[stateDescription_i]['liyu'] = liyu
                }
                res.json({
                    stateDescription,
                    status:200
                })
                }catch(err) {
                    res.json({
                        error:'服务器报错'+err,
                        status:0
                    })
                } 
            }     
            getSymptom()        
})

//修改症状
router.post('/updateSymptom', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {   
    /**
     {
       id:"xxxxxxxxxxxx"
       newState:{
            content: "头疼",
            voice: "https://www.runoob.com/try/demo_source/horse.mp3",
            liyu: [
                {
                    label: "成都话",
                    value: "瓜娃子",
                    voice: "https://www.runoob.com/try/demo_source/horse.mp3"
                }
            ],
            img: "",
        }
}   
     */              
    async function updateSymptom() {
        // 同步写法
        try {
            //查询添加的症状是否已经存在过了，存在的话加直接返回，不存在就添加进去
            let sql = `select SymptomIndexID from symptom_index where SymptomIndexID = '${req.body.id}'`
            let SymptomIndexID = await exec(sql)
            if(SymptomIndexID.length === 0){
                //不存在这种id的话直接返回
                res.json({
                    status:0,
                    msg:'id不存在'
                })
            }else{
                //已经存在这种症状的话，进行更新
                var symptomIndexID = SymptomIndexID[0].SymptomIndexID
                let sql1 = `update symptom_index set 
                    SymptomIndexName = '${req.body.newState.content}',
                    SymptomImg = '${req.body.newState.img}',
                    SymptomAudio = '${req.body.newState.voice}',
                    UserID = '${req.user.UserID}'
                    where SymptomIndexID = '${req.body.id}'`
                exec(sql1)
                //删除原有的方言描述
                let sql3 = `delete from symptom_dialect where SymptomDialectID = '${req.body.id}';`
                await exec(sql3)
                //插入俚语
                let liyu = req.body.newState.liyu
                for(let liyu_i=0;liyu_i<liyu.length;liyu++){
                    let sql2 = `insert into symptom_dialect 
                    (Dialect,DialectType,SymptomDialectID,DialectAudio)
                    values
                    ('${liyu[liyu_i].value}','${liyu[liyu_i].label}','${req.body.id}','${liyu[liyu_i].voice}');`
                    await exec(sql2)
                }
                res.json({
                    status:200,
                    msg:'更新成功'
                })
            }
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"失败，服务器报错"+ err
                })
                }
        }
        updateSymptom();  
})

//删除症状
router.post('/deleteSymptom', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {   
    /**
     {
        id:"xxxxxxxxxx"
        }
     */              
    async function deleteSymptom() {
        // 同步写法
        try {
            //查询添加的症状是否已经存在过了，存在的话加直接返回，不存在就添加进去
            let sql = `select SymptomIndexID from symptom_index where SymptomIndexID = '${req.body.id}'`
            let SymptomIndexID = await exec(sql)
            if(SymptomIndexID.length === 0){
                //不存在这种id的话直接返回
                res.json({
                    status:0,
                    msg:'id不存在'
                })
            }else{
                //删除症状
                let sql = `delete from symptom_index where SymptomIndexID = '${req.body.id}';`
                //删除原有的方言描述
                let sql1 = `delete from symptom_dialect where SymptomDialectID = '${req.body.id}';`
                exec(sql)
                exec(sql1)
                res.json({
                    status:200,
                    msg:'成功'
                })
            }
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"失败，服务器报错"+ err
                })
                }
        }
        deleteSymptom();  
})

//添加图谱药物信息
router.post('/drug_graph/addDrug', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {   
    /**
     * { "name": "123",

        data:"xxxxxxxxxxxxxxxxxxxxxxx" //json 字符串,

         id:""/id为空则是添加，不为空则是修改对应id

        }
     */              
    async function addDrugInfo() {
        // 同步写法
        try {
            console.log(req.body.data);
            let data = JSON.stringify(req.body.data)
            if(!!req.body.id){
                // 如果id存在即位更新
                let sql1 = `update drugs_data set 
                DrugsData = '${data}',
                UpdateTime = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                UpdateUserID = '${req.user.UserID}'
                where DrugsID = '${req.body.id}';`
                await exec(sql1)
                res.json({
                    status:200,
                    msg:'更新成功'
                })
            }else{
                // 如果id不存在则插入新的
                let sql1 = `insert into drugs_data 
                (DrugsName,DrugsData,UpdateTime,UpdateUserID)
                values
                (
                    '${req.body.name}',
                    '${data}',
                    '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                    '${req.user.UserID}'
                );`
                await exec(sql1)
                res.json({
                    status:200,
                    msg:'插入成功'
                })
            }
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"上传失败，服务器报错"+ err
                })
                }
        }
        addDrugInfo();  
})

//查看图谱药物信息
router.get('/drug_graph/getDrug', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {    
        // 同步写法
        async function getDrugInfo() {
        try {
                let sql = `select 
                DrugsData as data,
                DrugsID as id,
                DrugsName as name
                from drugs_data where DrugsName is not null;`
                var drugsInfo = await exec(sql)
                res.json({
                    drugsInfo,
                    status:200
                })
                }catch(err) {
                    res.json({
                        error:'服务器报错'+err,
                        status:0
                    })
                } 
            }     
            getDrugInfo()        
})

//删除症状
router.post('/drug_graph/deleteDrug', 
passport.authenticate("jwt", { session: false }), 
(req, res) => {   
    /**
     {
        id:"xxxxxxxxxx"
        }
     */              
    async function deleteDrugInfo() {
        // 同步写法
        try {
            //查询添加的症状是否已经存在过了，存在的话加直接返回，不存在就添加进去
            let sql = `select DrugsID from drugs_data where DrugsID = '${req.body.id}'`
            let drugsID = await exec(sql)
            if(drugsID.length === 0){
                //不存在这种id的话直接返回
                res.json({
                    status:0,
                    msg:'id不存在'
                })
            }else{
                //删除症状
                let sql = `delete from drugs_data where DrugsID = '${req.body.id}';`
                exec(sql)
                res.json({
                    status:200,
                    msg:'成功'
                })
            }
        }catch(err) {
            console.log(err)
                res.json({
                    status:0,
                    msg:"失败，服务器报错"+ err
                })
                }
        }
        deleteDrugInfo();  
})


module.exports = router;