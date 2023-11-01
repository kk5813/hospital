const mysql = require('mysql')


// //连接数据库
var pool = mysql.createPool({
  host: 'localhost',
  port: '3306',
  user: 'root',
  password: '2287996531',
  database: 'nowHealth_database',
  timezone: 'UTC',
  maxPool: 20
});

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



module.exports = query;
