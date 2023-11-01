

//转换时间戳为时间（yyyy-mm-dd hh:mm:ss）
function formatDate(now1) {
    if(typeof(now1) === 'string'){
        now1 = parseInt(now1)
    }
    var now = new Date(now1);
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    var date = now.getDate();
    var hour = now.getHours();
    var minute = now.getMinutes();
    var second = now.getSeconds();
    return year + "-" + month + "-" + date + " " + hour + ":" + minute + ":" + second;
}


module.exports = formatDate
