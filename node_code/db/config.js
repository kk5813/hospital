const query = require('../db/mysql.js');


// 统一执行 sql 的函数
function exec(sql) {
    const promise = new Promise((resolve, reject) => {
        query(sql, (err, result) => {
            if (err) {
                reject(err)
                return
            }
            resolve(result)
        })
    })
    return promise
}

module.exports = {
    exec
}
