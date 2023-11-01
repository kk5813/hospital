const fs = require('fs');
const path = require('path');



//通过req的hearers来获取客户端ip
function getIp(req) {
    let ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddres || req.socket.remoteAddress || '';
    return ip;
}


// 把cookie拆分成数组
function cookiesSplitArray(cookies) {
    // let cookies = req.headers.cookie;
    let cookieArray = [];
    if (cookies) {
        cookieArray = cookies.split(';')
    }
    return cookieArray;
}

// 把单个cookie的键值拆开
function cookieSplitKeyValue(cookie) {
    if (!cookie) return {};
    let KeyValue = cookie.trim().split('=');
    const cookie_key = KeyValue[0];
    const cookie_value = KeyValue[1];
    return { cookie_key, cookie_value }
}






/**
 * 同步递归创建路径
 * fs.mkdirSync(fileDir)要求路径的父级存在才能创建, 否则报错.
 * 注: NodeJS 10以后的版本，fs.mkdir已经增加递归选项:
 * fs.mkdir('/home/test1/test2', { recursive: true }, (err) => {})
 *
 * @param  {string} dir   处理的文件路径(不是文件夹路径)
 * @param  {function} cb  回调函数
 */
function mkdirSync(dir, cb) {
    let pathinfo = path.parse(dir);
    if (!fs.existsSync(pathinfo.dir)) {
        mkdirSync(pathinfo.dir, function () {
            console.log('创建文件夹: ' + pathinfo.dir);
            fs.mkdirSync(pathinfo.dir)
        })
    }
    cb && cb()
}


function initJsonFile(fileDir, type = 'object') {
    if (!fs.existsSync(fileDir)) {
        mkdirSync(fileDir); // 创建文件目录, 防止写入文件报错
    }
    if (type === 'object') {
        fs.writeFileSync(fileDir, '{}')
        return
    }
    if (type === 'array') {
        fs.writeFileSync(fileDir, '[]')
        return
    }
    throw "initJsonFile失败, 未知类型";
}

function getJsonFile(fileDir) {
    let content = '{}'
    if (fs.existsSync(fileDir)) { // 文件存在才读取
        content = fs.readFileSync(fileDir)
    }
    return JSON.parse(content)
}

function saveJsonFile(fileDir, jsonData) {
    if (!fs.existsSync(fileDir)) {
        mkdirSync(fileDir); // 创建文件目录, 防止写入文件报错
    }
    fs.writeFileSync(fileDir, JSON.stringify(jsonData))
}

function pushJsonData(fileDir, itemJsonData) {
    let jsonData = getJsonFile(fileDir);
    if (Array.isArray(jsonData)) {
        jsonData.push(itemJsonData)
    } else {
        console.log("该json文件不是数组: ", fileDir);
    }
    saveJsonFile(fileDir, jsonData)
}


// 根据文件后缀返回对应的文件类型
// suffix可以为文件路径|文件后缀|带点号的文件后缀, 例如./html/index.html | .html  | html
function writeContentType(res, suffix, code = 200) {
    suffix = path.extname(suffix) ? path.extname(suffix) : suffix // 获取扩展名
    suffix = suffix.slice(suffix.indexOf('.') + 1)  // 如果有点号去掉点号
    suffix = suffix.toLocaleLowerCase() // 全部小写
    // console.log("处理后suffix: ", suffix);

    let ContentType = "";
    switch (suffix) {
        case 'txt':
        case 'md':
        case 'log':
            ContentType = "text/plain;charset=UTF-8";
            break;
        case 'htm':
        case 'html':
            ContentType = "text/html;charset=UTF-8";
            break;
        case 'css':
            ContentType = "text/css;charset=UTF-8";
            break;
        case 'js':
            ContentType = "application/javascript;charset=UTF-8";
            break;
        case 'json':
            ContentType = "application/json;charset=UTF-8";
            break;
        case 'mp4':
            ContentType = "video/mp4";
            break;
        case 'jpg':
        case 'jpeg':
            ContentType = "image/jpeg";
            break;
        case 'png':
            ContentType = "image/png";
            break;
        case 'gif':
            ContentType = "image/gif";
            break;
        default:
            ContentType = "";
    }
    if (ContentType) {
        res.writeHead(code, {
            "Content-Type": ContentType
        });
    }
}


module.exports = {
    getIp,
    cookiesSplitArray,
    cookieSplitKeyValue,
    mkdirSync,
    initJsonFile,
    getJsonFile,
    saveJsonFile,
    pushJsonData,
    writeContentType
}
