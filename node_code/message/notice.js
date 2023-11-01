var schedule = require('node-schedule');
var date = new Date(Date.now() + 1000);
var j = schedule.scheduleJob(date, function () {
  console.log('触发通知');
});

var date1 = new Date(Date.now() + 5000);
var j = schedule.scheduleJob(date1, function () {
  console.log('触发通知1');
});