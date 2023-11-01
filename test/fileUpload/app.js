const http = require('http');
const path = require('path');
const fs = require('fs');


const {
    port,
    uploadDir,
    login_record_path
} = require('./config/config.js')


const {
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
} = require('./control/control');


const {
    mkdirSync,
    getJsonFile,
    saveJsonFile,
    pushJsonData,
    initJsonFile,
    writeContentType
} = require('./utils/common');

		

// 如果uploadDir目录不存在就创建目录
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir)
}


// 定义上传的文件中允许被任意用户访问的文件夹路径(开放一个公共文件夹用来分享文件给任意人查看下载, 如果要分享文件夹先打包为压缩包再分享)
let uploadsPublicFolderPath = path.join(uploadDir, '/publicFile');
// 如果uploadsPublicFolderPath目录不存在就创建目录
if (!fs.existsSync(uploadsPublicFolderPath)) {
    fs.mkdirSync(uploadsPublicFolderPath)
}


// 如果log目录不存在就创建log目录
if (!fs.existsSync('./log')) {
    fs.mkdirSync('./log')
}

// login_record_path文件不存在就初始化为一个json文件
if (!fs.existsSync(login_record_path)) {
    initJsonFile(login_record_path, 'array')
}


// 发送页面
function sendPage(res, path, statusCode = 200) {
    writeContentType(res, '.Html', statusCode)
    fs.createReadStream(path).pipe(res)
}


// 文件不存在返回404
function handle404(res, fileDir) {
    if (!fs.existsSync(fileDir)) {
        res.writeHead(404, { 'content-type': 'text/html;charset=UTF-8' });
        res.end("404, no such file or directory");
        console.log("no such file or directory: ", fileDir);
        return true; // 处理成功
    }
    return false
}


var server = http.createServer(function (req, res) {

    let url = decodeURI(req.url);
    console.log("url: ", url);

    let method = req.method.toLowerCase();

    let parameter = ''
    let parameterPosition = url.indexOf('?')
    if (parameterPosition > -1) {
        parameter = url.slice(parameterPosition) // 保存url中的参数部分
        console.log("参数: ", parameter);
        url = url.slice(0, parameterPosition) // 去掉url中的参数部分
        console.log("去掉参数后的url: ", url);
    }


    // 访问public接口时发送public目录下的文件, 不需要任何验证, 该目录下的文件通常是前端静态文件
    if (/^\/public\//.test(url)) {
		if (url.includes('../') || url.includes('..\\')) { // 防止url包含../../等路径信息从而获取其他目录下的文件的可能
			writeContentType(res, 'html', 403);
			res.end("ERROR, 不允许下载带有连续两个点号的文件")
			return;
		}
        let fileDir = '.' + url;
        if (!handle404(res, fileDir)) {
            writeContentType(res, fileDir, 200);
            fs.createReadStream(fileDir).pipe(res)
        }
        return;
    }
	
	
	// 获取/uploads/publicFile目录下的所有文件名, 不需要任何验证
    if (url === '/publicFile') {
		writeContentType(res, 'html');
		fs.readdir(uploadsPublicFolderPath, (err, data) => {
			if (!Array.isArray(data)) {
				// res.end('路径不存在')
				res.end('还没有公开的文件')
				return;
			}
			if (!data.length){
				res.end('还没有公开的文件')
				return;
			}
			let resultHTML = `<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
				<meta http-equiv="X-UA-Compatible" content="ie=edge">
				<link rel="shortcut icon" href="/public/favicon.ico" type="image/x-icon">
				<title>zp文件服务器 - 公开文件</title>
			</head>`;
			for (let d of data) {
				resultHTML += `<a href="${'/publicFile/'+d}" target="_blank" style="margin: 10px;line-height: 40px;">${d}</a><br>`
			}
			res.end(resultHTML);
			resultHTML = null;
		})
        return;
    }
	
	
	// 获取/uploads/publicFile目录下的文件, 不需要任何验证
	if (/^\/publicFile\/.+/.test(url)) {
        if (url.includes('../') || url.includes('..\\')) { // 防止url包含../../等路径信息从而获取其他目录下的文件的可能
			writeContentType(res, 'html', 403);
			res.end("ERROR, 不允许下载带有连续两个点号的文件")
			return;
        }
        let fileDir = uploadDir + url;
        if (!fs.existsSync(fileDir)) {
			writeContentType(res, 'html', 404);
            res.end("文件不存在或者已经被取消分享了!");
            return;
        }
		
        fs.createReadStream(fileDir).pipe(res)
        return;
    }
	
	
	

    // 身份验证的接口
    if (url === '/identityVerify' && method === 'post') {
        identityVerify(req, res)
        return;
    }


    // cookie验证, 如果验证不成功, 就只发送verify.html
    // if (!cookieVerify(req)) {
    //     sendPage(res, './public/verify.html');
    //     return;
    // }


    // 下面的所有接口都需要登录后才能访问
    if (url === '/' || url === '/index.html') {

        sendPage(res, './index.html');

    } else if (/^\/getAllFileInfo/.test(url) && method === 'get') {

        // 读取uploadDir目录下的文件信息并返回
        let paramsPathVal = parameter.slice('?path='.length)
        getAllFileInfo(req, res, paramsPathVal)

    } else if (url === '/uploadFile' && method === 'post') {

        // 上传文件
        uploadFile(req, res)

    }else if (url === '/test' && method === 'get'){
        res.writeHead(200, {'Content-type': 'application/json'});
        const result = {
            errno: 0,
            data:[
                {user:'张三', content: '留言1'},
                {user:'李四', content: '留言2'}
            ]
        }
        res.end(JSON.stringify(result))
    }else if(url === '/readload' && method === 'get'){//读取
        	//console.log("拉流")
        var fileName = path.resolve(__dirname, req.query.url)
        console.log(fileName)
        var stream = fs.createReadStream(fileName)
        stream.pipe(res)
    } else if(url === '/download' && method === 'get'){//下载
        console.log(req.query.url)
        res.download(`${req.query.url}`)
    }else if (/^\/deleteFile/.test(url) && method === 'get') {

        // 删除文件
        deleteFile(req, res)

    } else if (/^\/modifyTextFile/.test(url) && method === 'post') {

        // 修改文本文件
        modifyTextFile(req, res)

    } else if (url === '/login_record') {

        // 获取登录记录的json数据
        writeContentType(res, 'json')
        res.end(JSON.stringify(getJsonFile(login_record_path)))

    } else if (/^\/directoryDownload/.test(url)) {

        // 文件夹下载
        directoryDownload(req, res, url)

    } else if (/^\/moveFile/.test(url) && method === 'post') {

        // 移动文件或文件夹
        moveFile(req, res)

    }  else if (/^\/newFile/.test(url) && method === 'post') {

        // 新建文件
        newFile(req, res)

    }  else if (/^\/newFolder/.test(url) && method === 'post') {

        // 新建文件夹
        newFolder(req, res)

    }  else if (/^\/logout/.test(url)) {

        // 退出登录
        logout(req, res)

    } else {

        // 默认发送uploads目录下的文件
        let fileDir = path.join(uploadDir, url);
        console.log("fileDir: ", fileDir);

        if (!handle404(res, fileDir)) {
            fs.stat(fileDir, function (err, stats) {
                if (stats.isDirectory()) { // 如果是文件夹就更改path参数并重定向
                    let redirectPath = '/?path=' + encodeURI(url)
                    // console.log('redirectPath', decodeURI(redirectPath));
                    res.writeHead(301, { 'Location': redirectPath });
                    res.end()
                } else {
                    // 否则就把文件发送过去
                    fs.createReadStream(fileDir).pipe(res)
                }
            })
        }

    }




})




server.listen(port);
console.log('访问 http://localhost:' + port);


// 异常处理
process.on("uncaughtException", function (err) {
    console.log('uncaughtException', err);
    if (err.code == 'ENOENT') {
        console.log("no such file or directory: ", err.path);
    } else {
        console.log('uncaughtException', err);
    }
})


process.on("SIGINT", function () {
    process.exit()
})
process.on("exit", function () {
    console.log("exit");
})
