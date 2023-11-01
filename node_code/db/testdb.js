const mysql = require('mysql');

var pool = mysql.createPool({
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: '2287996531',
    database: 'nowHealth_database',
    timezone: 'UTC',
    maxPool: 20
});
function testDatabaseConnection() {
    pool.getConnection(function (err, conn) {
        if (err) {
            console.error('Database connection failed:', err);
        } else {
            console.log('Database connection successful');
            conn.release();
        }
    });
}
var query = function (sql, callback) {
    pool.getConnection(function (err, conn) {
        if (err) {
            callback(err, null, null);
        } else {
            conn.query(sql, function (qerr, vals, fields) {
                //释放连接
                conn.release();
                //事件驱动回调
                callback(qerr, vals, fields);
            });
        }
    });
};
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
//测试链接数据库
testDatabaseConnection();
//测试查询数据
// 测试查询数据
exec("SELECT * FROM users")
    .then((result) => {
        console.log('Query results:', result);
    })
    .catch((err) => {
        console.error('Error in query:', err);
    });
