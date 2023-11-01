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
const formidable = require('formidable')
//获取本地时区
moment.locale('zh-cn');
var SOCKET_IP = require("../utils/server_IP.js").SOCKET_IP;

// JWT鉴权
var jwtConfig = require("../utils/jwtAuth.js").jwtConfigAuth;
passport.use(jwtConfig);

router.post('/a',(req,res)=>{
    console.log("1")
})

//  //dest: 指定 保存位置（存到服务器)
//上传文件
var chatfile = multer({ dest: './chatfile' });
// //运行上传什么类型的文件  any就代表任意类型
router.use(chatfile.any())
router.post('/', chatfile.single('file'),
//passport.authenticate("jwt", { session: false }),
    async (req, res) => {
        console.log("123456")
        async function uploadchatfile() {
            try {
				//console.log(path.parse(req.files[0].originalname).ext)
                //let oldFile = req.files[0].path;
                let oldFile = req.files[0].path;
                //console.log(originalname);
                let newFile = req.files[0].path + path.parse(req.files[0].originalname).ext
                fs.renameSync(oldFile , newFile)
                // let geturl = SOCKET_IP + '/readload?url=' + newFile   "https://"+ IP + ":" + socketPort;
                // let geturl =SOCKET_IP + '/readload?url=' + newFile
                let geturl ='http://localhost:3000'+'/readload?url=' + newFile
                let geturl1 ='http://localhost:3000' + '/download?url=' + newFile
                    res.json({
                        status:200,
                        msg:"上传成功",
                        readloadurl:geturl,
                        downloadurl:geturl1
                    })
                    }catch(err) {
                        console.log(err)
                            res.json({
                                status:0,
                                msg:"上传失败"
                            })
                          }
                    }
                    uploadchatfile();      
})

router.post('/myfile',
//passport.authenticate("jwt", { session: false }),
    async (req, res) => {
        console.log("123456")
        async function uploadchatfile() {
            try {
                let newFile = req.body.newFile
                let geturl ='http://localhost:3000' + '/readload?url=' + newFile
                let geturl1 ='http://localhost:3000' + '/download?url=' + newFile
                    res.json({
                        status:200,
                        msg:"上传成功",
                        readloadurl:geturl,
                        downloadurl:geturl1,
                        newFile:newFile
                    })
                    }catch(err) {
                        console.log(err)
                            res.json({
                                status:0,
                                msg:"上传失败"
                            })
                          }
                    }
                    uploadchatfile();      
})




module.exports = router;