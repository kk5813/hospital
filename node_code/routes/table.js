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

//吞咽表
router.get('/swallow', 
//passport.authenticate("jwt", { session: false }), 
async (req, res) => {    
    async function swallow() {
        // 同步写法
        try {
            var sql1 = `select * from assessmentofswallowingfunction;`
            var abc1 = await exec(sql1)
            //console.log(abc1) 
            var partOne = []
            var partTwo = []
            var options = []
            var advice = []
            var swallow_table = {}
            for(key in abc1){
                let obj1 = {}
                if(abc1[key].Option == 1){
                    obj1["text"] = abc1[key].Item
                    obj1["result"] = ""
                    partOne.push(obj1)
                }else if(abc1[key].Option == 2){
                    partTwo.push(abc1[key].Item)
                }else if(abc1[key].Option == 3){
                    options.push(abc1[key].Item)
                }else if(abc1[key].Option == 4){
                    advice.push(abc1[key].Item)
                }else{
                    continue;
                }
            }
            //console.log(partOne)
            swallow_table["title"] = "吞咽功能评定"
            swallow_table["time"] = ""
            swallow_table["partOne"] = partOne
            swallow_table["partTwo"] = partTwo
            swallow_table["result"] = {
                options,
                selected:""
            }
            swallow_table["advice"] = {
                options:advice,
                selected:""
            }
            //console.log(obj)
                res.json({
                    status:200,
                    msg:"ok",
                    swallow_table
                })
                }
                catch(err) {
                        console.log(err)
                    res.json({
                        status:0,
                        msg:"暂时无法显示内容"
                        
                    })
                    }
                }
                swallow();             
})


//跌倒表
router.get('/morsescore', 
//passport.authenticate("jwt", { session: false }), 
async (req, res) => {    
    async function morsescore() {
        // 同步写法
        try {
            var sql = `select Item,Options,ItemID,Score from morsescore`
            var morsescore = await exec(sql)
            //console.log(morsescore)
            var content_obj = {}
            var index_arr = []
            for(key in morsescore){
                var item_obj = {}
                var options_obj = {}
                var options_arr = []
                //console.log(index_arr.includes(morsescore[key].ItemID))
                if(!index_arr.includes(morsescore[key].ItemID)){
                    options_obj["text"] = morsescore[key].Options
                    options_obj["socre"] = morsescore[key].Score
                    item_obj["text"] = morsescore[key].Item
                    options_arr.push(options_obj)
                    item_obj["options"] = options_arr
                    content_obj[morsescore[key].ItemID] = item_obj
                }else{
                    //console.log(content_obj[morsescore[key].ItemID])
                    options_obj["text"] = morsescore[key].Options
                    options_obj["socre"] = morsescore[key].Score
                    content_obj[morsescore[key].ItemID].options.push(options_obj)
                    //console.log(content_obj[morsescore[key].ItemID])
                }
                index_arr.push(morsescore[key].ItemID)
            }
            var partOne = []
            for(key in content_obj){
                partOne.push(content_obj[key])
            }
            var sql2 = `select * from fallpreventionmeasures`
            var measures = await exec(sql2)
            var normal = []
            var options = []
            var notes = []
            for(key in measures){
                if(measures[key].MeasuresID == "1"){
                    normal.push(measures[key].Options)
                }else if(measures[key].MeasuresID == "2"){
                    options.push(measures[key].Options)
                }else if(measures[key].MeasuresID == "3"){
                    notes.push(measures[key].Options)
                }
            }
            var obj1 = {
                title: "Morsed跌倒危险因素评估及护理措施表",
                time: "",
                partOne,
                totalScore: "",
                prevention: {
                    normal,
                    selectable: {
                        options,
                        // 多选
                        selected: []
                    }
                },
                isFall: "",
                notes
            }
            res.json({
                status:200,
                msg:"ok",
                morse_table:obj1
            })
                }
                    catch(err) {
                    res.json({
                        status:0,
                        msg:"暂时无法显示内容"
                    })
                    }
                }
                morsescore();             
})


module.exports = router;