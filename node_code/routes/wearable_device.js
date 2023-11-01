var express = require('express');
var app = express();
var router = express.Router();
const {exec} = require('../db/config.js');
const passport = require('passport');
const query = require('../db/mysql.js');
var moment = require('moment');

const request = require("request");
//获取本地时区
moment.locale('zh-cn'); 

//passport初始化
app.use(passport.initialize()); 
const JwtStrategy = require('passport-jwt').Strategy,
ExtractJwt = require('passport-jwt').ExtractJwt;
 
let opts = {
    secretOrKey: "hello",
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
}

var jwtConfig = new JwtStrategy(opts, (jwt_payload, done) => {
    console.log("loginer_id:",jwt_payload.UserID)
    var sql = `select * from users where UserID="${jwt_payload.UserID}"`
    query(sql,function (err, result) {
    if(err){
        res.end('[SELECT ERROR] - '+err.message);
    }else{
        //console.log(result[0])
        return done(null,result[0]);
    }    
});
     
})

passport.use(jwtConfig);



//获取穿戴式设备的 access_token
function get_access_token(){
    return new Promise((resolve, reject)=>{
        request({
            url: "https://open.kuanhow.com/api/Merchant/accessToken",
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                "appId":"3b4ffa83ab9119e4",
                "secret":"88c79c62d8e021ab867222ce899a9f43"
            }),
            timeout:30*1000
        }, function(error, response, data) {
            if (!error && response.statusCode == 200) {
                //console.log(JSON.parse(data))
                let r = JSON.parse(data)
                //console.log(r.access_token)
                resolve(r.access_token)
            }else{
                console.log("服务器报错")
                resolve("error")
            }
        });
    });
}
var myUrl = [
    "https://open.kuanhow.com/api/bgt/userBp",//血压 0
    "https://open.kuanhow.com/api/bgt/userGlu",//血糖 1
    "https://open.kuanhow.com/api/bgt/userTc",//总胆固醇 2
    "https://open.kuanhow.com/api/smartClothing/userTemperature",//温度 3
    "https://open.kuanhow.com/api/SmartClothing/userGps",//gps 4
    "https://open.kuanhow.com/api/Eeg/userEeg",//egg 5
    "https://open.kuanhow.com/api/bgt/userTg" //尿酸6
]
//通过服务器获取穿戴式设备数据
router.post('/wearableDeviceData', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    //参数：
    // {
    //     "phone":"17387512145"//作为用户唯一标识
    //     "StartDate":"2022/6/14 8:02:05",
    //     "EndDate":"2022/6/21 19:36:23",
    //     "pageNo":1,选填 默认为1
    //     "pageSize":10,选填默认为10
    //     "type":0 查询哪类数据   血压 0  血糖 1  总胆固醇 2  温度 3  gps 4  egg 5
    //     "Mode":0
    // }
    var pageNo = 1
    var pageSize = 10
    var phone = "17387512145"
    var Mode = 0
    if(req.body.pageNo!=null){
        pageNo = req.body.pageNo
    }
    if(req.body.pageSize!=null){
        pageSize = req.body.pageSize
    }
    if(req.body.phone!=null){
        phone = req.body.phone
    }
    if(req.body.Mode!=null){
        Mode = req.body.Mode
    }
    var type = req.body.type//那种数据请求
    get_access_token().then(function(access_token){
        // data access_token
        request({
            url: myUrl[type],
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                "appId":"3b4ffa83ab9119e4",
                "Access_token":access_token,
                "Phone":phone,
                "StartDate":req.body.StartDate,
                "EndDate":req.body.EndDate,//选填
                "pageNo":pageNo,
                "pageSize":pageSize,
                "Mode":Mode
            }),
            timeout:30*1000
        }, function(error, response, data) {
            if (!error && response.statusCode == 200) {
                //console.log(JSON.parse(data))
                let r = JSON.parse(data)
                //console.log(r.access_token)
                res.json({
                    status:200,
                    msg:r
                })
            }else{
                res.json({
                    status: 0,
                    msg: "数据获取失败，服务器报错",
                    error
                })
            }
        });
    })  
})
//gps数据上传
router.post('/gpsData', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    // 参数 数组
    // {
    //     "data":[
    //         { "longitude": 104.06574, "latitude": 30.659452, "dateTime": "2022/6/14 12:08:15"},
    //         { "longitude": 104.06571, "latitude": 30.659422, "dateTime": "2022/6/14 18:03:27"},
    //         { "longitude": 104.065735, "latitude": 30.659462, "dateTime": "2022/6/15 8:02:05"}
    //     ],
    //     "phone":"17387512145",
    //     "UserID":"101001"
    // }
    //console.log(req.body)
    var data = req.body.data
    async function gpsData(){
        try{
            var UserID = req.user.UserID
            if(req.body.UserID!=null){
                UserID = req.body.UserID
            }
            for(i=0;i<data.length;i++){
                let sql = `select * from gps where phone = '${req.body.phone}'
                and dateTime = '${data[i].dateTime}'`
                let gpsData = await exec(sql)
                if(gpsData.length==0){
                    let sql1= `insert into gps (phone,UserID,longitude,latitude,dateTime,date)
                    values
                    ('${req.body.phone}','${UserID}','${data[i].longitude}','${data[i].latitude}',
                    '${data[i].dateTime}','${moment().format('YYYY-MM-DD HH:mm:ss')}');`
                    await exec(sql1)
                }
            }
             res.json({
                status:200,
                msg:"数据上传成功"
             })
        }catch(err){
            console.log(err)
            res.json({
                status: 0,
                msg: "数据上传失败，服务器报错",
                err
                })
        }
    }
    gpsData();
})

//全部gps数据获取
router.get('/gpsDataAll', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    async function gpsDataAll(){
        try{
            let sql = `SELECT * FROM gps ORDER BY DATETIME ASC LIMIT 10`
            let gpsData = await exec(sql)
             res.json({
                status:200,
                msg:"数据查询成功",
                data:gpsData
             })
        }catch(err){
            console.log(err)
            res.json({
                status: 0,
                msg: "数据上传失败，服务器报错",
                err
                })
        }
    }
    gpsDataAll();
})

//根据条件获取gps数据  后面补充
router.post('/gpsDataByQuery', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    async function gpsDataByQuery(){
        try{
            var startTime = req.body.startTime
            var endTime = req.body.endTime
            var UserID = req.body.UserID
            let sql
            if(UserID!=null){
                if(startTime!=null && endTime!=null){
                     sql = `select * from gps where UserID = '${UserID}'
                     and datetime >= '${startTime}' and datetime<='${endTime}'`
                }else if(startTime!=null){
                     sql = `select * from gps where UserID = '${UserID}'
                     and datetime >= '${startTime}'`
                }else{
                     sql = `select * from gps where UserID = '${UserID}'
                    and datetime<='${endTime}'`
                }
            }else{
                if(startTime!=null && endTime!=null){
                     sql = `select * from gps where datetime >= '${startTime}' and datetime<='${endTime}'`
                }else if(startTime!=null){
                     sql = `select * from gps where
                    datetime >= '${startTime}'`
                }else{
                     sql = `select * from gps where
                    datetime<='${endTime}'`
                }
            }
            let gpsData = await exec(sql)
             res.json({
                status:200,
                msg:"数据查询成功",
                data:gpsData
             })
        }catch(err){
            console.log(err)
            res.json({
                status: 0,
                msg: "数据查询失败，服务器报错",
                err
                })
        }
    }
    gpsDataByQuery();
})


//wearable_device数据上传  包括 血糖 胆固醇  温度 都对应data
router.post('/wearableData', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    // 参数：
    // {
    //     "data":[
    //             { "temperature": 36.5, "dateTime": "2022/6/14 8:02:05" },
    //             { "temperature": 36.2, "dateTime": "2022/6/14 9:45:14" },
    //             { "temperature": 36.7, "dateTime": "2022/6/14 13:12:12" },
    //             { "temperature": 36.5, "dateTime": "2022/6/15 8:02:05" }
    //     ],
    //     "phone":"17387512145",
    //     "type":3
    // }
    //console.log(req.body)
    var data = req.body.data
    //console.log(moment().format('YYYY-MM-DD HH:mm:ss'))
    async function wearableData(){
        try{
            var UserID = req.user.UserID
            if(req.body.UserID!=null){
                UserID = req.body.UserID
            }
            // for(i=0;i<data.length;i++){
            //     if(data[i].temperature!=null){
            //         data[i].data = data[i].temperature
            //     }
            //     let sql = `select * from wearable_device where phone = '${req.body.phone}'
            //     and dateTime = '${data[i].dateTime}' and type = '${req.body.type}'
            //     and data = '${data[i].data}'`
            //     let wearableData = await exec(sql)
            //     if(wearableData.length==0){
            //         let sql1= `insert into wearable_device(phone,UserID,data,dateTime,date,type)
            //         values
            //         ('${req.body.phone}','${UserID}','${data[i].data}',
            //         '${data[i].dateTime}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${req.body.type}');`
            //          await exec(sql1)
            //     }
                
            // }
            let sql
            let sql1

            for(i=0;i<data.length;i++){
                if(data[i].temperature!=null){
                    data[i].data = data[i].temperature
                }
                if(req.body.type==1){//血糖
                    sql = `select * from blood_sugar where phone = '${req.body.phone}'
                    and dateTime = '${data[i].dateTime}' and data = '${data[i].data}'`
                    
                    sql1= `insert into blood_sugar(phone,UserID,data,dateTime,date)
                    values
                    ('${req.body.phone}','${UserID}','${data[i].data}',
                    '${data[i].dateTime}','${moment().format('YYYY-MM-DD HH:mm:ss')}');`
                }else if(req.body.type==2){//胆固醇
                    sql = `select * from cholesterol where phone = '${req.body.phone}'
                    and dateTime = '${data[i].dateTime}' and data = '${data[i].data}'`
                    console.log(sql)
                    sql1= `insert into cholesterol(phone,UserID,data,dateTime,date,hdl,ldl,tg)
                    values
                    ('${req.body.phone}','${UserID}','${data[i].data}',
                    '${data[i].dateTime}','${moment().format('YYYY-MM-DD HH:mm:ss')}',
                    '${data[i].hdl}','${data[i].ldl}','${data[i].tg}');`
                    console.log(sql1)
                }else if(req.body.type==3){//智慧衣温度
                    sql = `select * from temperature where phone = '${req.body.phone}'
                    and dateTime = '${data[i].dateTime}' and data = '${data[i].data}'`
                    
                    sql1= `insert into temperature(phone,UserID,data,dateTime,date)
                    values
                    ('${req.body.phone}','${UserID}','${data[i].data}',
                    '${data[i].dateTime}','${moment().format('YYYY-MM-DD HH:mm:ss')}');`
                }else if(req.body.type==4){//尿酸
                    sql = `select * from uric_acid where phone = '${req.body.phone}'
                    and dateTime = '${data[i].dateTime}' and data = '${data[i].data}'`
                    
                    sql1= `insert into uric_acid(phone,UserID,data,dateTime)
                    values
                    ('${req.body.phone}','${UserID}','${data[i].data}',
                    '${data[i].dateTime}');`
                
                }else{
                    res.json({
                        status:200,
                        msg:"数据上传失败，没有参数type"
                     })
                }
                let wearableData = await exec(sql)
           
                console.log(sql1)
                if(wearableData.length==0){
                     await exec(sql1)
                  
                }
                
            }
             res.json({
                status:200,
                msg:"数据上传成功"
             })
        }catch(err){
            console.log(err)
            res.json({
                status: 0,
                msg: "数据上传失败，服务器报错",
                err
                })
        }
    }
    wearableData();
})

//wearable_device全部数据获取  包括 血糖 胆固醇  温度 都对应data
router.get('/wearableDataAll/:type', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    async function wearableDataAll(){
        try{
            var type = req.params.type
            let sql
            let dataType
            if(type==1){//血糖
                sql = `select * from blood_sugar as a ORDER BY a.datetime ASC LIMIT 10`
                dataType = "血糖"
            }else if(type==2){//胆固醇
                sql = `select * from  cholesterol as a ORDER BY a.datetime ASC LIMIT 10`
                dataType = "胆固醇"
            }else if(type==3){//智慧衣温度
                sql = `select * from  temperature as a ORDER BY a.datetime ASC LIMIT 10`
                dataType = "智慧衣温度"
            }else if(type==4){//尿酸
                sql = `select * from  uric_acid as a ORDER BY a.datetime ASC LIMIT 10`
                dataType = "尿酸"
            }else{
                res.json({
                    status:200,
                    msg:"暂无该数据"
                 })
            }
            let wearableData = await exec(sql)
             res.json({
                status:200,
                msg:"数据查询成功",
                data:wearableData,
                dataType:dataType
             })
        }catch(err){
            console.log(err)
            res.json({
                status: 0,
                msg: "数据查询失败，服务器报错",
                err
                })
        }
    }
    wearableDataAll();
})


//blood_pressure数据上传
router.post('/bloodPressureData', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    // 参数：
    // {
    //     "data":[
    //         { "pulse": 70, "sbp": 120, "dbp": 45, "dateTime": "2022/6/14 20:42:35" },
    //         { "pulse": 62, "sbp": 126, "dbp": 38, "dateTime": "2022/6/15 10:42:12" },
    //         { "pulse": 75, "sbp": 130, "dbp": 48, "dateTime": "2022/6/15 20:30:26" }
    //     ],
    //     "phone":"17387512145"
    // }
    //console.log(req.body)
    //console.log(moment().format('YYYY-MM-DD HH:mm:ss'))
    var data = req.body.data
    async function bloodPressureData(){
        try{
            var UserID = req.user.UserID
            if(req.body.UserID!=null){
                UserID = req.body.UserID
            }
            for(i=0;i<data.length;i++){
                let sql = `select * from blood_pressure where phone = '${req.body.phone}'
                and dateTime = '${data[i].dateTime}' and pulse = '${data[i].pulse}'
                and sbp = '${data[i].sbp}' and dbp = '${data[i].dbp}'`
                let wearableData = await exec(sql)
                if(wearableData.length==0){
                    let sql1= `insert into blood_pressure(phone,UserID,dateTime,date,pulse,sbp,dbp)
                    values
                    ('${req.body.phone}','${UserID}',
                    '${data[i].dateTime}','${moment().format('YYYY-MM-DD HH:mm:ss')}',
                    '${data[i].pulse}','${data[i].sbp}','${data[i].dbp}');`
                     await exec(sql1)
                }
            }
             res.json({
                status:200,
                msg:"数据上传成功"
             })
        }catch(err){
            console.log(err)
            res.json({
                status: 0,
                msg: "数据上传失败，服务器报错",
                err
                })
        }
    }
    bloodPressureData();
})

//bloodPressure全部数据获取
router.get('/bloodPressureAll', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    async function bloodPressureAll(){
        try{
            let sql = `select * from blood_pressure ORDER BY DATETIME ASC LIMIT 10`
            let bloodPressure = await exec(sql)
             res.json({
                status:200,
                msg:"数据查询成功",
                data:bloodPressure
             })
        }catch(err){
            console.log(err)
            res.json({
                status: 0,
                msg: "数据查询失败，服务器报错",
                err
                })
        }
    }
    bloodPressureAll();
})


//egg_data数据上传
router.post('/eggData', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    // 参数：
    // {
    //     "data":[
    //         { "type": 8, "dateTime": "2022/1/14 0:00:00", "data": [ "-0.8", "0.8", "1.2", "1.1", "0.5", "1.2", "0.8", "-1" ] },
    //         { "type": 8, "dateTime": "2022/1/14 0:00:00", "data": [ "-0.6", "1.1", "0.8", "1.2", "1.1", "0.5", "1.2", "0.8", "0.3" ] }
    //     ],
    //     "phone":"17387512145"
    // }
    //console.log(req.body)
    //console.log(moment().format('YYYY-MM-DD HH:mm:ss'))
    var data = req.body.data
    async function eggData(){
        try{
            var UserID = req.user.UserID
            if(req.body.UserID!=null){
                UserID = req.body.UserID
            }
            for(i=0;i<data.length;i++){
                let sql = `select * from eeg_data where phone = '${req.body.phone}'
                and dateTime = '${data[i].dateTime}' and data = '${data[i].data}'`
                let wearableData = await exec(sql)
                if(wearableData.length==0){
                    let sql1= `insert into eeg_data(phone,UserID,dateTime,date,data,type)
                    values
                    ('${req.body.phone}','${UserID}',
                    '${data[i].dateTime}','${moment().format('YYYY-MM-DD HH:mm:ss')}',
                    '${data[i].data}','${data[i].type}');`
                     await exec(sql1)
                }
            }
             res.json({
                status:200,
                msg:"数据上传成功"
             })
        }catch(err){
            console.log(err)
            res.json({
                status: 0,
                msg: "数据上传失败，服务器报错",
                err
                })
        }
    }
    eggData();
})

//eggDataAll全部数据获取
router.get('/eggDataAll', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {
    async function eggDataAll(){
        try{
            let sql = `select * from eeg_data ORDER BY DATETIME ASC LIMIT 4000`
            let eeg_data = await exec(sql)
             res.json({
                status:200,
                msg:"数据查询成功",
                data:eeg_data
             })
        }catch(err){
            console.log(err)
            res.json({
                status: 0,
                msg: "数据查询失败，服务器报错",
                err
                })
        }
    }
    eggDataAll();
})

module.exports = router;