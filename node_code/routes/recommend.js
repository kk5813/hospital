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

//医生更多推荐
router.get('/', 
passport.authenticate("jwt", { session: false }), 
async (req, res) => {    
    async function ReadrecommendData() {
        // 同步写法
        try {
              //查询推荐内容
              var sql1 = `select AdvertisingID,AdvertisingLink,AdvertisingImage from advertising where AdvertisingTitle = "imgList";`
              var imgList= await exec(sql1)
              //console.log(imgList)
              var sql2 = `select AdvertisingContent,AdvertisingLink,AdvertisingImage from advertising where AdvertisingTitle = '热门文章';`
              var Popular_articles = await exec(sql2)
              //console.log(Popular_articles)
              var sql3 = `select AdvertisingContent,AdvertisingLink,AdvertisingImage from advertising where AdvertisingTitle = '最新论文';`
              var paper = await exec(sql3)
                res.json({
                    status:200,
                    msg:"ok",
                    imgList:imgList,
                    collapseDate:[
                        {
                            title:"热门文章",
                            content:Popular_articles
                        },
                        {
                            title:"最新论文",
                            content:paper
                        }
                    ]
                })
                     }
                      catch(err) {
                        res.json({
                            status:0,
                            msg:"暂时无法显示更多推荐内容"
                        })
                      }
                }
                ReadrecommendData();             
})

module.exports = router;