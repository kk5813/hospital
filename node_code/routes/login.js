var express = require('express');
var router = express.Router();
const {exec} = require('../db/config.js');
const jwt = require('jsonwebtoken');
//const passport = require('passport');
var moment = require('moment');
//获取本地时区
moment.locale('zh-cn');
const query = require('../db/mysql.js');

var CryptoJS = require("crypto-js");
const crypto = require('crypto')


//处理功能函数functiondata
var getfunctiondata = function (data, callback) {
    var newarray = []
    datacount = 0;
    data.forEach(function (item, index, arr) {
        var sql4 = `select FunctionID,FunctionName,FunctionAddress,ParentID from functions where ParentID like "${item.FunctionID}%"`
        query(sql4, function (err, res) {
            if (!err) {
                //console.log(res)
                if (res.length == 0) {
                    item['children'] = res
                    //console.log(item)
                } else {
                    //console.log(res)
                    //递归查询子功能
                    function createTree(arr, ID) {
                        let tree = [];
                        arr.forEach(item1 => {
                            if (ID == item1.ParentID) {
                                item1.children = createTree(arr, item1.FunctionID);
                                tree.push(item1);
                            }
                        });
                        return tree;
                    }

                    functiontree = createTree(res, item.FunctionID)
                    item['children'] = functiontree
                }
                newarray[index] = item
                //console.log(newarray)
                datacount++;
                if (arr.length === datacount) {
                    //console.log(newarray)
                    callback(newarray)
                }
            } else {
                callback(err)
            }
        });
    })
}

//判断是否存在特殊字符
function hasSpecialStr(str) {
    var specialChars = "~·`!！@#$￥%^…&*()（）—-_=+[]{}【】、|\\;:；：'\"“‘,./<>《》?？，。";
    var len = specialChars.length;
    for (var i = 0; i < len; i++) {
        if (str.indexOf(specialChars.substring(i, i + 1)) !== -1) {
            return true;
        }
    }
    return false;
}

function getClientIp(req) {
    return req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;
};

//登录
function aesDecrypt(encrypted, key) {
    /**创建一个解密 */
    const deciper = crypto.createDecipher('aes192', key);
    /**
     *  update(data: string, inputEncoding: Encoding | undefined, outputEncoding: Encoding): string;
     *  data 就是被加密的字符串，inputEncoding 这个加密的字符的字符串一般椒16进制字符串，outputEncoding 输出的字符串类型一般utf8
     */
    let descrped = deciper.update(encrypted, 'hex', 'utf8');
    descrped += deciper.final('utf8')
    return descrped;
}

router.post('/', function (req, res) {
    async function login() {
        console.log("POST_login_request")
        let userIP = getClientIp(req)      //获取用户登录的ip
        console.log(req.body.UserID, " 登录的IP为: ", userIP)
        var UserID = req.body.UserID
        var pwd = aesDecrypt(req.body.password, 'node')
        // var pwd = req.body.password
        if (hasSpecialStr(UserID)) {    //存在特殊字符
            res.json({
                status: 500,
                login: false
            })
        } else {        //不存在特殊字符
            console.log("请求体:", req.body);
            var sql = `select LoginPassword,Name,Image from users where UserID='${UserID}';`
            var info = await exec(sql)
            console.log("info:", info)
            if (info.length === 0) {
                res.json({
                    login: false,
                    msg: '无此账号'
                });
            } else if (info[0].LoginPassword === pwd) {
                console.log("已查到确有此用户");
                //更新登陆时间
                var sql1 = `update users set
          LoginState = '1',
          LoginDateTime = '${moment().format('YYYY-MM-DD HH:mm:ss')}'
          where UserID = '${UserID}';`
                console.log('sql1:', sql1)
                await exec(sql1);
                //查询父级功能
                var sql2 = ` select Distinct a.FunctionID,a.FunctionName,a.FunctionAddress,a.icon from functions as a 
                      left join role_function as b on a.FunctionID = b.FunctionID
                      left join user_role as c on b.RoleID = c.RoleID where c.UserID = '${UserID}' order by a.FunctionID
                      `
                console.log('sql2:', sql2)
                var functiondata = await exec(sql2)
                console.log("functiondata:", functiondata)
                //查询角色值
                var sql3 = `select RoleName from roles where RoleID in (select RoleID from user_role
                      where UserID='${UserID}');`
                console.log('sql3:', sql3)
                var role = await exec(sql3)
                //查询设置
                var sql5 = `select isPopup,messageShow,infoShow from setting where UserID = '${UserID}';`
                var setting = await exec(sql5)
                console.log("setting:", setting)

                //查询子功能
                function foo() {
                    return new Promise((resolve, reject) => {
                        getfunctiondata(functiondata, function (data) {
                            resolve(data)
                        })
                    })
                }

                var get_functiondata = await foo(functiondata)
                //定义加密成token的数据
                console.log("加密中")
                const rule = {
                    UserID: req.body.UserID
                };
                //密钥定义为hello
                const secretOrKey = "hello"
                //定义token
                console.log("定义token");
                jwt.sign(rule, secretOrKey, {expiresIn: 36000}, (err, token) => {
                    if (err) throw err;
                    res.json({
                        login: true,
                        status: 200,
                        msg: "登录成功",
                        token: 'Bearer ' + token,
                        LoginState: 1,
                        LoginDateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
                        name: info[0].Name,
                        portrait: info[0].Image,
                        role: role,
                        setting: setting[0],
                        function: get_functiondata
                    })
                });
            } else {
                res.json({
                    login: false,
                    msg: '密码错误'
                })
            }
        }
    }

    login();
})


module.exports = router;