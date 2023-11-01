const fs = require('fs');
const path = require('path');
const formidable = require('formidable')
var zipper = require("zip-local");
const request = require("request");

const {
    systemUser,
    systemPassword,
    uploadDir,
    login_record_path
} = require('../config/config.js')


const {
    getIp,
    cookiesSplitArray,
    cookieSplitKeyValue,
    mkdirSync,
    getJsonFile,
    saveJsonFile,
    pushJsonData
} = require('../utils/common.js')


const {
    formatDateTime,
    formatDateTime2
} = require('../utils/formatDateTime')


const log = console.log;
const loginSuccessCookieArr = []; // 存在缺陷, 重启时loginSuccessCookieArr数据会丢失, 可以用Redis持久化保存



/**
 * API 处理函数 start
 */


// 验证账号密码, 验证成功则设置cookie, 验证结果写入到login_record.log日志文件里
function identityVerify(req, res) {

    let clientIp = getIp(req);
    console.log('客户端ip: ', clientIp);

    let verify_str = ''
    req.on('data', function (verify_data) {
        verify_str += verify_data;
    })
    req.on('end', function () {
        let verify_obj = {};
        try {
            verify_obj = JSON.parse(verify_str)
        } catch (e) {
            console.log(e);
        }
        log("verify_obj", verify_obj)

        res.writeHead(200, {
            'Content-Type': 'text/plain;charset=UTF-8'
        });

        // 保存登录信息日志
        let loginInfo = {
            Time: formatDateTime(),
            IP: clientIp,
            User: verify_obj.user
        }

        if (verify_obj.user === systemUser && verify_obj.password === systemPassword) {
            // 验证成功
            log("验证成功")
            loginInfo.Result = "验证成功"

            let randomKey = String(Math.random()).slice(2);
            let randomValue = String(Math.random()).slice(2, 12) + String(Date.now());

            // 把生成的随机key和value设置到cookie, 过期时间2小时
            let twoHour = 1000 * 60 * 60 * 2;
            res.writeHead(200, {
                'Set-Cookie': randomKey + "=" + randomValue + ";path=/;expires=" + new Date(Date.now() + twoHour).toGMTString(),
            });
            // 时间一到后端也删除该cookie
            setTimeout(function () {
                deleteLoginSuccessCookieArrItem(randomKey + "=" + randomValue)
            }, twoHour)

            // 登录成功就把生成的随机key和value存到loginSuccessCookieArr中
            loginSuccessCookieArr.push(randomKey + "=" + randomValue);

            res.end(JSON.stringify({ code: 0, msg: "验证成功" }));

        } else {
            // 验证失败
            loginInfo.Result = "验证失败"
            loginInfo.Password = verify_obj.password

            res.end(JSON.stringify({ code: 1, msg: "验证失败" }));
        }
        pushJsonData(login_record_path, loginInfo)

    })
}




// cookie验证
// 如果cookie中有一对键值存在于loginSuccessCookieArr中, 就认为验证成功
function cookieVerify(req) {
    const cookies = req.headers.cookie;
    const cookieArray = cookiesSplitArray(cookies);

    // 新增的cookie一般在最后, 因此数组从后往前遍历
    for (let index = cookieArray.length; index >= 0; index--) {
        const item = cookieArray[index];
        const { cookie_key, cookie_value } = cookieSplitKeyValue(item);

        if (loginSuccessCookieArr.includes(cookie_key + "=" + cookie_value)) {
            return true;
        }
    }

    return false;
}


// 退出登录, 删除loginSuccessCookieArr中对应的cookie
function logout(req, res) {
    const cookies = req.headers.cookie;
    const cookieArray = cookiesSplitArray(cookies);

    // 新增的cookie一般在最后, 因此数组从后往前遍历
    for (let index = cookieArray.length; index >= 0; index--) {
        const item = cookieArray[index];
        const { cookie_key, cookie_value } = cookieSplitKeyValue(item);
        let deleteRes = deleteLoginSuccessCookieArrItem(cookie_key + "=" + cookie_value)
        if (deleteRes) {
            // 删除成功把cookie_key返回让前端也删除该cookie
            res.end(cookie_key)
        }
    }
}


function deleteLoginSuccessCookieArrItem(item) {
    let cookieIndex = loginSuccessCookieArr.indexOf(item)
    if (cookieIndex > -1) {
        console.log("删除cookie: ", item);
        loginSuccessCookieArr.splice(cookieIndex, 1)
        return true;
    }
    return false;
}


// 读取uploadDir目录下的文件信息并返回
function getAllFileInfo(req, res, directory) {

    let fileDir = path.join(uploadDir, directory + '/');
    console.log('读取文件夹下的文件信息: ', fileDir);

    fs.readdir(fileDir, (err, data) => {
        if (!Array.isArray(data)) {
            res.end('路径不存在')
            return;
        }
        let resultArray = [];
        for (let d of data) {
            let statSyncRes = fs.statSync(fileDir + d);
            // console.log("statSyncRes", statSyncRes)
            resultArray.push({
                src: d,
                size: statSyncRes.size,
                mtimeMs: statSyncRes.mtimeMs,
                isDirectory: statSyncRes.isDirectory() // 是否为文件夹
            })
        }
        // console.log(resultArray);
        res.end(JSON.stringify(resultArray))
    })
}



// 上传文件, 文件/多文件/文件夹都用这同一个方法上传(如果需要把文件上传到指定文件夹下,在上传的时候需要多传递一个文件路径的字段信息,然后后端使用uploadDir拼接这个字段就可以得到完整的保存路径,接下来保存就行了)
function uploadFile(req, res) {
    console.log("上传文件");
    res.writeHead(200, { 'content-type': 'text/plain;charset=UTF-8' });

    let form = new formidable.IncomingForm();
    form.uploadDir = uploadDir; // 保存上传文件的目录
    form.multiples = true; // 设置为多文件上传
    form.keepExtensions = true; // 保持原有扩展名
    form.maxFileSize = 10 * 1024 * 1024 * 1024; // 限制上传文件最大为10GB
    form.maxFields = 10; // 限制字段的数量
    form.maxFieldsSize = 100; // 限制字段大小, 单位bytes
    let url = "123"

    form.parse(req, function (err, fields, files) {
        if (err) {
            console.log("接收文件出错: ", JSON.stringify(err.message));
            res.writeHead(400, { 'content-type': 'text/html;charset=UTF-8' });
            res.end("文件大小过大或者文件总数过多, 无法上传;\n错误信息:" + JSON.stringify(err.message));
            return;
        }

        // console.log('files:\n', files);
        for (let key in files) {
            url = rename(files[key])
            console.log(url)
        }

        // 文件会被formidable自动保存, 而且文件名随机, 因此保存后建议重命名
        function rename(fileItem) {
            // 单文件上传时fileItem为对象, 多文件上传时fileItem为数组,
            // 单文件上传时也将fileItem变成数组统一当做多文件上传处理;
            let fileArr = fileItem;
            if (Object.prototype.toString.call(fileItem) === '[object Object]') {
                fileArr = [fileItem];
            }

            for (let file of fileArr) {

                let fileName = file.name; // 上传文件夹时文件名可能包含上传的文件夹路径
                console.log("上传文件名: ", fileName);

                let suffix = path.extname(fileName); // 文件后缀名

                let oldPath = file.path; // formidable自动保存后的文件路径
                newPath = path.join(uploadDir, fileName);

                // log('oldPath', oldPath)
                // log('newPath', newPath)

                // 防止路径不存在
                mkdirSync(newPath);

                // 如果不允许覆盖同名文件
                if (fields.isAllowCoverageFile !== 'true') {
                    // 并且文件已经存在，那么在文件后面加上时间和随机数再加文件后缀
                    if (fs.existsSync(newPath)) {
                        newPath = newPath + '-' + formatDateTime2() + '-' + Math.trunc(Math.random() * 1000) + suffix;
                    }
                }

                fs.rename(oldPath, newPath, function (err) {
                    if (err) {
                        log(err)
                    }
                })
                return newPath
            }
        }

    });

    
    form.on('end', (err) => {
            request({
                url: "http://47.111.146.85:3000/upload/myfile",
                method: "POST",
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    newFile:url
                }),
                timeout:30*1000
            }, function(error, response, data) {
                if (!error && response.statusCode == 200) {
                    //let r = JSON.parse(data)
                    res.end(JSON.stringify(data))
                    //res.end(JSON.parse(data))
                    //console.log(r.access_token)
                }else{
                    console.log("服务器报错")
                }
            });
    });
}


// 递归删除目录
function deleteAllFile(path) {
    var files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) {
                deleteAllFile(curPath); // 递归删除目录
            } else {
                // 删除文件
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}


// 根据文件名删除文件
function deleteFile(req, res) {
    let url = decodeURI(req.url);
    let fileName = url.slice(url.indexOf('?') + 1);
    console.log("删除文件: ", fileName);

    var rootPath = uploadDir + fileName;

    if (fs.statSync(rootPath).isDirectory()) {
        deleteAllFile(rootPath); // 递归删除目录
    } else {
        fs.unlinkSync(rootPath); // 删除文件
    }

    res.end();
}


// 根据文件名和数据修改(覆盖)文本文件
function modifyTextFile(req, res) {
    let url = decodeURI(req.url);
    let fileName = url.slice(url.indexOf('?') + 1);
    console.log("修改(覆盖)文本文件: ", fileName)

    let WriteStream = fs.createWriteStream(uploadDir + fileName)

    WriteStream.on('error', function (err) {
        res.end(JSON.stringify({ code: 1, msg: JSON.stringify(err) }))
    })

    WriteStream.on('finish', function () {
        res.end(JSON.stringify({ code: 0, msg: "保存成功" }))
    })

    req.on('data', function (data) {
        WriteStream.write(data)
    })

    req.on('end', function () {
        WriteStream.end()
        WriteStream.close()
    })
}

// 文件夹下载
function directoryDownload(req, res, url) {
    // 要下载的文件夹路径
    let dirPath = path.join(uploadDir, url.slice('/directoryDownload'.length));
    // 生成的临时压缩包路径
    let tempDir = path.join(process.cwd(), 'tmp', 'zip', './uploads' + url.slice('/directoryDownload'.length) + '.zip')

    console.log("dirPath: ", dirPath);
    console.log("tempDir: ", tempDir);

    mkdirSync(tempDir, function () {

        // 把文件夹压缩成压缩包
        zipper.sync.zip(dirPath).compress().save(tempDir);

        let createReadStream = fs.createReadStream(tempDir)
        createReadStream.pipe(res)
        createReadStream.on('end', () => {
            console.log("传输完成");
            // 传输完成后删除临时压缩包文件(压缩包所在的文件夹没有删除, 如果要删除可以使用本文件中的deleteAllFile()方法)
            fs.unlink(tempDir, (err) => {
                if (err) {
                    console.log(err);
                    res.end('delete fail: ' + JSON.stringify(err));
                }
                console.log("删除文件", tempDir);
            });
        })
    })

}



// 移动文件或文件夹
function moveFile(req, res) {
    console.log("移动文件或文件夹")
    let str = ''

    req.on('data', function (data) {
        str += data;
    })

    req.on('end', function () {
        console.log('str', str);
        let data = JSON.parse(str)
        let oldPath = path.join(uploadDir, data.oldPath)
        let newPath = path.join(uploadDir, data.newPath)
        console.log('oldPath', oldPath);
        console.log('newPath', newPath);

        if (!fs.existsSync(oldPath)) {
            res.end(data.oldPath + "路径不存在")
            return;
        }
        if (!fs.existsSync(newPath)) {
            mkdirSync(newPath)
        }

        fs.rename(oldPath, newPath, function (err) {
            if (err) {
                console.log(err);
                res.end(err.message)
                return;
            }
            res.end('移动成功')
        })
    })
}



function newFile(req, res) {
    let str = ''

    req.on('data', function (data) {
        str += data;
    })

    req.on('end', function () {
        console.log('str', str);
        let data = JSON.parse(str)
        let newFileName = path.join(uploadDir, data.newFileName)
        console.log('newFileName', newFileName);

        if (fs.existsSync(newFileName)) {
            res.end(data.newFileName + "文件已经存在")
            return;
        }

        // 创建文件路径
        mkdirSync(newFileName)

        fs.writeFile(newFileName, '', function (error) {
            if (error) {
                res.end(JSON.stringify(error))
                return;
            }
            res.end("创建文件成功")
        })
    })
}




function newFolder(req, res) {
    let str = ''

    req.on('data', function (data) {
        str += data;
    })

    req.on('end', function () {
        console.log('str', str);
        let data = JSON.parse(str)
        let newFolderName = path.join(uploadDir, data.newFolderName)
        console.log('newFolderName', newFolderName);

        if (fs.existsSync(newFolderName)) {
            res.end("文件夹已经存在")
            return;
        }
        fs.mkdirSync(newFolderName)
        res.end('创建文件夹成功')

    })
}






/**
 * API 处理函数 end
 */


module.exports = {
    identityVerify,
    cookieVerify,
    getAllFileInfo,
    uploadFile,
    deleteFile,
    modifyTextFile,
    directoryDownload,
    moveFile,
    newFile,
    newFolder,
    logout
}
