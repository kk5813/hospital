const path = require('path');
/**
 * 运行配置
 */

// 登录系统的账号密码
const systemUser = "a";
const systemPassword = "b";

// 运行端口
const port = 3008

// 保存上传文件的目录
const uploadDir = path.join(process.cwd(), 'uploads/')
// const qqq = path.join(__dirname,'../../../')
// const uploadDir = path.join(qqq,'/node_code/')


// 保存登录信息的日志文件
const login_record_path = path.join(process.cwd(), "log", 'login_record.json')

/**
 * 运行配置 --- end
 */

module.exports = {
    port,
    systemUser,
    systemPassword,
    uploadDir,
    login_record_path
}
