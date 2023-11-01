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
//获取本地时区
moment.locale('zh-cn');


// JWT鉴权
var jwtConfig = require("../utils/jwtAuth.js").jwtConfigAuth;
passport.use(jwtConfig);

router.get('/user/:UserID',passport.authenticate("jwt", { session: false }),
async(req, res) => {
    var sql1 = `select RoleID from user_role where UserID = "${req.user.UserID}"`
    var sql2 = `select * from users where UserID = "${req.params.UserID}"`
    var a = await exec(sql1)
    var b = await exec(sql2)
    if(a.length == 0){
        res.json({
            msg:"请登录"
        })
    }else if(a[0].RoleID != 60){
        res.json({
            msg:"无该权限"
        })
    }else{
        if(b.length == 0){
            res.json({
                msg:"该用户不存在"
            })
        }else{
            var basicInfo = {
                "Address":b[0].Address,
                "Post":b[0].Mail, 
                "Portrait": b[0].Image,
                "Birthday":b[0].Birthday, 
                "Tel": b[0].Phone, 
                "Gender":b[0].Gender, 
                "Job":b[0].Job, 
                "Name": b[0].Name
            }
            var exp = []
            var num = 0;
            if(b[0].ResearchExperienceInfoIsPublic=="公开"){
                var aaa = {
                    "text":b[0].ResearchExperienceInfo,
                    "title":"科研经历"
                }
                exp.push(aaa)
            }
            if(b[0].TrainingExperienceInfoIsPublic=="公开"){
                var aaa = {
                    "text":b[0].TrainingExperienceInfo,
                    "title":"教学经历"
                }
                exp.push(aaa)
            }
            if(b[0].WorkExperienceInfoIsPublic[0]=="公开"){
                var aaa = {
                    "text":b[0].WorkExperienceInfo,
                    "title":"工作经历"
                }
                exp.push(aaa)
            }
            if(b[0].StudyExperienceInfoIsPublic=="公开"){
                var aaa = {
                    "text":b[0].StudyExperienceInfo,
                    "title":"教育经历"
                }
                exp.push(aaa)
            }
            var info = {
                "exp":exp,
                "basicInfo":basicInfo
            }
            res.json({
                msg:"ok",
                info:info,
                status:200
            })
        }
    }
})

module.exports = router;
