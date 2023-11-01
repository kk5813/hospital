const express = require("express");
const app = express();
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const net = require('net');
const httpServ = require('http')
const request = require("request");
const httpsServ = require('https');
// 引入IP端口
var IP = require("./utils/server_IP.js").IP;
var socketPort = require("./utils/server_IP.js").socketPort;
var httpPort = require("./utils/server_IP.js").httpPort
var httpsPort = require("./utils/server_IP.js").httpsPort
//调用每日计划函数
var CronJob = require('cron').CronJob;
//调用日程函数
const { date_schedule } = require('./time/date_schedule.js');
const Router1 = require('./routes/info.js')
const Router2 = require('./routes/login.js')
const Router3 = require('./routes/patientdiag.js')
const Router4 = require('./routes/recommend.js')
const Router5 = require('./routes/medicalinfo.js')
const Router6 = require('./routes/patienttreatment.js')
const Router7 = require('./routes/upload.js')
const Router8 = require('./routes/chatinfo.js')
const Router9 = require('./routes/table.js')
const Router10 = require('./routes/patient_rounds.js')
const Router11 = require('./routes/followmanage.js')
const Router12 = require('./routes/patientinfo.js')
const Router13 = require('./routes/groupconsultation.js')
const Router14 = require('./routes/video_groupconsultation.js')
const Router15 = require('./routes/medicalinfo_manage.js')
const Router16 = require('./routes/hospital_expert.js')
const Router17 = require('./routes/infodesc.js')
const Router18 = require('./routes/wearable_device.js')
//var systemInfo = require('./system/systeminfo');

var moment = require('moment');
//获取本地时区
moment.locale('zh-cn');
//引入数据库文件
const { exec } = require('./db/config.js');
const query = require('./db/mysql.js');
const { Console } = require("console");
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//创建http的服务器
var server = httpServ.createServer(app).listen(httpPort, () => {
	console.log("http listen", httpPort)
})

//HTTPs配置信息
const cfg = {
	ssl_key: './cert/3_nowhealth.top.key',    //这里填Apache中的 3_[域名].key 文件
	ssl_cert: './cert/2_nowhealth.top.crt',    //这里填Apache中的 2_[域名].crt 文件
	ssl_ca: './cert/1_root_bundle.crt'       //这里填Apache中的 1_root_bundle.crt文件
};
//创建https
var httpsserver = httpsServ.createServer({
	// 向server传递key和cert参数
	key: fs.readFileSync(cfg.ssl_key),
	cert: fs.readFileSync(cfg.ssl_cert),
	ca: fs.readFileSync(cfg.ssl_ca),
	rejectUnauthorized : false,
	requestCert: false,
	secure: true
}, app).listen(httpsPort, () => {
	console.log("https listen ", httpsPort)
});

// 此socketio通道走的是https传输，如果要重新部署，
// 将httpsserver----->server ，与此同时客户端的请求也将改成走http通道)
// const io = require('socket.io')(httpsserver);
// socket文档 https://socket.io/docs/v2/server-api/
// 本代码使用的是socket服务端为socket.io@2.3.0版本
// 				socket客户端为socket.io-client@2.3.0版本
// 客户端连接不上先检查客户端的版本是不是太高了
// 以下代码重新绑定双重请求，同时满足http和https的链接
const io_server = require('socket.io')
const io = new io_server()
io.attach(httpsserver);
io.attach(server);


// 创建一个TCP服务器，用于代理请求
net.createServer(function (socket1) {
	// 一次性监听客户端发送的数据流
	socket1.once('data', function (buf) {
		// 检查第一个字节，判断是HTTP还是HTTPS请求
		const address = buf[0] === 22 ? httpsPort : httpPort;

		// 创建一个到目标服务器的代理连接
		const proxy = net.createConnection(address, function () {
			// 将客户端发送的数据流写入代理连接
			proxy.write(buf);
			// 设置数据流的传输：客户端 --> 代理 --> 客户端
			socket1.pipe(proxy).pipe(socket1);
		});

		// 代理连接出现错误时的处理
		proxy.on('error', function (err) {
			console.log(err);
		});
	});

	// 客户端连接出现错误时的处理
	socket1.on('error', function (err) {
		console.log(err);
	});
}).listen(socketPort); // 代理服务器监听的端口号为3000




//配置跨域
app.all('*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "*");
	res.header("Access-Control-Allow-Methods", "*");
	res.header("X-Powered-By", ' 3.2.1');
	next();
});

//每日计划日程（每天凌晨进行一次扫描当天的日程）
// let cronJob = new CronJob('01 00 00 * * *', function () { 
// 	let dateTime = moment().format('YYYY-MM-DD')
// 	console.log(dateTime)
// 	//调用日程函数
// 	date_schedule(dateTime)
// }, null, true);

//个人信息
app.use('/personalinfo', Router1)
//登录
app.use('/login', Router2)
//患者就诊相关（专家）
app.use('/patientdiag', Router3)
//推荐内容
app.use('/recommend', Router4)
//医疗信息相关（机构管理）
app.use('/', Router5)
//患者治疗（医生）
app.use('/patienttreatment', Router6)
//上传
app.use('/upload', Router7)
//聊天信息
app.use('/chatinfo', Router8)
//表格
app.use('/table', Router9)
//查房管理（护士）
app.use('/operationmanage', Router10)
//随访管理
app.use('/followmanage', Router11)
//患者信息
app.use('/patientinfo', Router12)
//会诊
app.use('/groupconsultation', Router13)
//视频会诊
app.use('/video_groupconsultation', Router14)
//医疗信息管理
app.use('/medicalinfo_manage', Router15)
//医疗机构和专家团队
app.use('/hospital_expert', Router16)
//专家信息查询
app.use('/infodesc', Router17)
app.use('/wearable',Router18)

//systemInfo.start();


//socket相关
var usocket = {}
var user = [];
//将socketid与用户建立关系{socketid:username}
var socket_name = {}

//消息群发（本消息群发为对相同账号的异地登录进行消息群发）
/**
 *主要的操作是对每个账号绑定的socket进行群发，将相同账号的用户上线后加入同一个房间
 对房间进行广播则可以进行多端通知的目的
 */

//离线消息存储

/**
 * 
 * @param {socket包} socket 
 * @param {发送人}} fromid 
 * @param {接受消息对象} toid 
 * @param {发送的消息，string格式} message 
 * @param {发送请求头} request_head 
 * @param {就诊ID} pid 
 * @param {聊天格式类型} type 
 * @param {是否为聊天，聊天的话为chat} chat 
 * @param {会诊ID} groupConsultationID 
 * @param {会诊类型，普通会诊/视频会诊} consultationType 
 */
let offlineMessage = (socket, fromid, toid, message, request_head, pid, type, chat, groupConsultationID, consultationType) => {
	let offlineSql = `insert into message 
	(	
		fromid,
		toid,
		res_datetime,
		message,
		type,
		is_read,
		request_head,
		chat,
		pid,
		GroupConsultationID,
		consultationType
		)  
	values 
	(
		'${fromid}',
		'${toid}',
		'${moment().format('YYYY-MM-DD HH:mm:ss')}',
		'${message}',
		'${type}',
		'1',
		'${request_head}',
		'${chat}',
		'${pid}',
		'${groupConsultationID}',
		'${consultationType}'
	);`
	exec(offlineSql).then(re => {
		socket.emit(request_head, {
			msg: "对方暂时不在线,消息已存储,等待对方上线处理",
			status: 203
		})
	}).catch(err => {
		socket.emit(request_head, {
			msg: "对方暂时不在线,消息存储失败" + err,
			status: 203
		})
	})

}
//socket通信
io.on('connection', (socket) => {
	//登录操作（将登录的用户加入房间，向房间广播离线的消息）
	socket.on('login1', (username) => {
		// 强制下线登陆的代码
		// socket_name[socket.id] = username
		// if(!(username in usocket)) {
		// //如果之前用户不在线
		// socket.username = username;
		// usocket[username] = socket;  
		// user.push(username);
		// let login_obj = {
		// 	status:200,
		// 	msg:username+" 用户登陆成功"
		// }
		// socket.emit('login' ,login_obj);
		// socket.emit('login' , user + " login在线");
		// var sql = `select fromid,toid,message,res_datetime,req_datetime,type,pid,request_head from message where toid = "${username}" and is_read = 1`
		// exec(sql).then(result => {
		// 	if(result.length !== 0){
		// 		console.log(result)
		// 		socket.emit('temp_message', result);
		// 		var sql2 = `update message set is_read = 0 where toid = "${username}";`
		// 		exec(sql2).catch(err=>{
		// 			console.log(err)
		// 		})
		// 	}else{
		// 		socket.emit('temp_message', []);
		// 	}
		// })
		// //socket.broadcast.emit('user joined',username,(user.length-1));
		// console.log(user);
		// }else{
		// let login_obj = {
		// 	status:0,
		// 	msg:username+"用户已经被强制下线"
		// }
		// usocket[username].emit('login' , login_obj);
		// socket_name[usocket[username].id] = 'repeatline'
		// delete(usocket[username]);
		// socket.username = username;
		// usocket[username] = socket;  
		// socket.emit('login' , user + "login在线");
		// var sql = `select fromid,toid,message,res_datetime,req_datetime,type,pid 
		// from message where toid = "${username}" and is_read = 1`
		// exec(sql).then(result => {
		// 	if(result.length !== 0){
		// 		console.log(result)
		// 		socket.emit('temp_message', result);
		// 		var sql2 = `update message set is_read = 0 where toid = "${username}";`
		// 		exec(sql2).catch(err=>{
		// 			console.log(err)
		// 		})
		// 	}else{
		// 		socket.emit('temp_message', []);
		// 	}
		// })
		// console.log(user);
		// } 
	})
	socket.on('login', (username) => {
		// 强制下线登陆的代码
		socket_name[socket.id] = username
		if (!(username in usocket)) {
			//如果之前用户不在线
			socket.username = username;
			usocket[username] = socket;
			user.push(username);
			let login_obj = {
				status: 200,
				msg: username + " 用户登陆成功"
			}
			socket.emit('login', login_obj);
			socket.emit('login', user + " login在线");
			var sql = `select fromid,toid,message,res_datetime,req_datetime,type,pid,request_head from message where toid = "${username}" and is_read = 1`
			exec(sql).then(result => {
				if (result.length !== 0) {
					console.log(result)
					socket.emit('temp_message', result);
					var sql2 = `update message set is_read = 0 where toid = "${username}";`
					exec(sql2).catch(err => {
						console.log(err)
					})
				} else {
					socket.emit('temp_message', []);
				}
			})
			//socket.broadcast.emit('user joined',username,(user.length-1));
			console.log(user);
		} else {
			let login_obj = {
				status: 0,
				msg: username + "用户已经被强制下线"
			}
			usocket[username].emit('login', login_obj);
			socket_name[usocket[username].id] = 'repeatline'
			delete (usocket[username]);
			socket.username = username;
			usocket[username] = socket;
			socket.emit('login', user + "login在线");
			var sql = `select fromid,toid,message,res_datetime,req_datetime,type,pid 
		from message where toid = "${username}" and is_read = 1`
			exec(sql).then(result => {
				if (result.length !== 0) {
					console.log(result)
					socket.emit('temp_message', result);
					var sql2 = `update message set is_read = 0 where toid = "${username}";`
					exec(sql2).catch(err => {
						console.log(err)
					})
				} else {
					socket.emit('temp_message', []);
				}
			})
			console.log(user);
		}
	})
	//聊天消息
	socket.on('instantMsg', function (req) {
		var res = req
		async function message() {
			if (res.toid in usocket) {
				var sql1 = `insert into message 
			(
				fromid,
				toid,
				req_datetime,
				res_datetime,
				message,
				type,
				is_read,
				pid,
				request_head,
				chat,
				GroupConsultationID,
				consultationType
				)  
				values (
				'${res.fromid}',
				'${res.toid}',
				'${moment().format('YYYY-MM-DD HH:mm:ss')}',
				'${moment().format('YYYY-MM-DD HH:mm:ss')}',
				'${res.message}',
				'${res.type}',
				'0',
				'${res.pid}',
				'instantMsg',
				'chat',
				'${res.GroupConsultationID}',
				'${res.consultationType}'
				);`
				await exec(sql1).catch(err => {
					console.log("消息插入失败: ", err)
				})
				//io.to(usocket[res.to].id).emit('message',res)
				usocket[res.toid].emit('instantMsg', res);
			} else {
				//如果用户不在线，存入数据库
				console.log("存入数据库", "fromid:", res.fromid, "toid:", res.toid, "type:", res.type)
				offlineMessage(socket, res.fromid, res.toid, res.message, 'instantMsg', res.pid, res.type, 'chat', res.GroupConsultationID, res.consultationType)
			}
		}
		message();
	});
	socket.on('yangyutest', function (req) {
		let res = req
		if (res.toid in usocket) {
			usocket[res.toid].emit('yangyutest', res);
		} else {
			socket.emit('yangyutest', '对方不在线')
		}
	});
	//文件下载
	socket.on('file_download', function (req) {
		var res = req;
		var file = res.url.splite("=")[1]
		fileName = path.resolve(__dirname, "./chatfil/4f7388bc402b2d21443025cbe24ad58e.jpg")
		//读取文件内容
		fs.readFile(fileName, (err, data) => {
			if (err) {
				console.error(err)
				socket.emit('file_download', "文件读取失败");
			} else {
				socket.emit('file_download', data);
			}
		})
	})
	//添加联系人
	socket.on('addrelative', async function (req) {
		var res = JSON.parse(req);
		console.log(res);
		//查看账号是否注册过
		var sql8 = `select UserID from users where UserID = ${res.FamilyMemberID};`
		isFamilyMemberID = await exec(sql8)
		if (isFamilyMemberID.length == 0) {
			//添加的账号还未注册
			let re = {
				msg: "要添加的账号暂时还未注册",
				status: 201
			}
			socket.emit('addrelative', re
			);
		} else {
			//查看添加账号的身份
			var sql9 = `select RoleID from user_role where UserID = ${res.FamilyMemberID};`
			isRoleID = await exec(sql9)
			//如果对方的身份不是患者家属，无法添加
			if (isRoleID[0].RoleID > 5) {
				let re = {
					msg: "要添加的账号身份不是患者家属，无法添加",
					status: 202
				}
				socket.emit('addrelative', re);
			} else {
				var sql10 = `insert into patient_relative (PatientID,FamilyMemberID,RelationTypeName,FamilyMemberName,IsAuthoritied)
				values ('${res.PatientID}','${res.FamilyMemberID}','${res.RelationTypeName}','${res.FamilyMemberName}',0);`
				await exec(sql10)
				//所有的条件都允许之后判断对方是否在线
				if (res.toid in usocket) {
					//发送给家属
					res['status'] = 205
					usocket[res.toid].emit('addrelative', res);
					let re = {
						msg: "请求发送成功，等待家属确认",
						status: 200
					}
					socket.emit('addrelative', re);
				} else {
					//如果用户不在线，存入数据库
					offlineMessage(socket, res.PatientID, res.FamilyMemberID, req, 'addrelative', '', '', '', '', '')
				}
			}
		}
	})
	//同意添加亲属
	socket.on('agreeAddRelative', async function (req) {
		var res = JSON.parse(req);
		console.log(res);
		//同意添加好友
		if (res.IsAuthoritied === 1) {
			sql11 = `update patient_relative set IsAuthoritied = 1 where PatientID = '${res.PatientID}' and FamilyMemberID = '${res.FamilyMemberID}';`
			exec(sql11).then(re => {
				socket.emit('agreeAddRelative', "添加成功")
				//判断添加的对象是否在线
				if (res.PatientID in usocket) {
					var str = res.FamilyMemberID + '添加好友成功'
					usocket[res.PatientID].emit('agreeAddRelative', str);
				} else {
					var sql13 = `insert into message (fromid,toid,req_datetime,res_datetime,message,request_head,is_read)  
					values ('${res.FamilyMemberID}','${res.PatientID}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${res.FamilyMemberID}','agreeAddRelative','1');`
					exec(sql13)
				}
			}).catch(err => {
				socket.emit('agreeAddRelative', "添加失败")
			})
		} else if (res.IsAuthoritied === 2) {
			sql12 = `update patient_relative set IsAuthoritied = 2 where PatientID = '${res.PatientID}' and FamilyMemberID = '${res.FamilyMemberID}';`
			exec(sql12).then(re => {
				var str = res.FamilyMemberID + '拒绝了您的好友申请'
				socket.emit('agreeAddRelative', "拒绝成功")
				usocket[res.PatientID].emit('agreeAddRelative', str);
			}).catch(err => {
				socket.emit('agreeAddRelative', "拒绝失败")
			})
		} else {
			socket.emit('agreeAddRelative', "IsAuthoritied格式有误，无法添加")
		}
	})
	//患者就诊申请接口
	socket.on('seekMedical', async function (req) {
		var res = JSON.parse(req);
		console.log(res);
		// console.log(res.toid);
		/**
		 * {
		 * 		familyID : 182              //家属的ID
		 * 		fromid:186                //患者的ID(要帮助提交患者的ID)
		 * 		toid:[101001,101002]      //发送的医生ID
		 * 		huizhen：'putong'         //会诊类型
		 * 		guahaoTime:"2022-01-03"   //挂号时间
		 * }
		 */
		//res.toid in usocket
		async function seekmedicaldoctor() {
			// 同步写法
			try {
				if ("familyID" in res) {
					// if(res['familyID'] === 'undefined'){
					// 	res['familyID'] = res['fromid']
					// }
				} else {
					res['familyID'] = ''
				}
				//查询患者姓名
				let sql17 = `select Name from users where UserID = ${res.fromid};`
				let Name = await exec(sql17)
				//查询患者症状
				let sql18 = `select SymptomName from symptomrelation 
					where UserID = "${res.fromid}" and SeekMedicalAdviceID is null`
				let SymptomName = await exec(sql18)
				let symptom = [];
				let symptom_map = {}
				for (let SymptomName_i = 0; SymptomName_i < SymptomName.length; SymptomName_i++) {
					symptom.push(SymptomName[SymptomName_i].SymptomName)
					symptom_map[SymptomName[SymptomName_i].SymptomName] = true
				}
				//查询问卷的症状
				let sql19 = `select b.QuestionnaireSymptom
					from question_relation as a left join questionnaire_survey as b
					on a.QuestionID = b.QuestionnaireID 
					where a.UserID = "${res.fromid}" and a.SeekMedicalAdviceID is null`
				let question_symptom = await exec(sql19)
				for (let question_symptom_i = 0; question_symptom_i < question_symptom.length; question_symptom_i++) {
					symptom.push(question_symptom[question_symptom_i].QuestionnaireSymptom)
				}
				//插入就诊号
				var sql = `
                    insert into seekmedicaladvice (
                        GUID,
                        PatientID,
						PatientName,
						Symptom,
                        MedicalAdviceApplicationDateTime,
						ApplySeekMedicalDateTime,
						SeekMedicalAdviceStatus,
						FamilyID,
						IsGroupConsultation) 
						values
                        ((UUID()),
                        "${res.fromid}",
						"${Name[0].Name}",
						'${symptom}',
						'${res.guahaoTime || moment().format('YYYY-MM-DD')}',
                        '${moment().format('YYYY-MM-DD HH:mm:ss')}',
						"申请中",
						'${res.familyID}',
						'${res.huizhen}'
                        )
                    `
				var inserted = await exec(sql)


				//遍历音频ID,插入数据
				let sql1 = `update seekmedicalaudio set SeekMedicalAdviceID = '${inserted.insertId}'
                        where UserID = '${res.fromid}' and SeekMedicalAdviceID is null`
				await exec(sql1)

				//遍历视频ID,插入数据

				let sql2 = `update seekmedicalvideo set SeekMedicalAdviceID = '${inserted.insertId}'
                        where UserID = '${res.fromid}' and SeekMedicalAdviceID is null`
				await exec(sql2)

				//遍历检查结果ID,插入数据

				let sql3 = `update medicalexamination set SeekMedicalAdviceID = '${inserted.insertId}'
                        where UserID = '${res.fromid}' and SeekMedicalAdviceID is null`
				await exec(sql3)

				//插入症状
				let sql4 = `update symptomrelation set SeekMedicalAdviceID = '${inserted.insertId}'
                        where UserID = "${res.fromid}" and SeekMedicalAdviceID is null`
				await exec(sql4)
				//插入问卷
				let sql5 = `update question_relation set SeekMedicalAdviceID = '${inserted.insertId}'
                        where UserID = "${res.fromid}" and SeekMedicalAdviceID is null`
				await exec(sql5)

				// 患者脑电图
				let sql6 = `update seekmedical_eeg set 
					SeekMedicalAdviceID = '${inserted.insertId}'
				    where UserID = "${res.fromid}"
					and SeekMedicalAdviceID is null;`
				await exec(sql6)   

				var sql7 = `select 
					SeekMedicalAdviceID as pid,
					SeekMedicalAdviceStatus as API_state,
					MedicalAdviceApplicationDateTime as API_date,
					PatientName as API_name,
					Symptom as API_symptom
					from seekmedicaladvice where SeekMedicalAdviceID = '${inserted.insertId}' and PatientID = '${res.fromid}' 
					`
				var SeekMedicalAdvice = await exec(sql7)
				//讲音视频信息提前推送给专家下载
				//var sql9 = `select AudioAddress from seekmedicalaudio where SeekMedicalAdviceID = '${inserted.insertId}'`
				var sql10 = `select VideoAddress from seekmedicalvideo where SeekMedicalAdviceID = '${inserted.insertId}'`
				//var audiourl = await exec(sql9)
				var videourl = await exec(sql10)
				//console.log(videourl)
				//查询就诊信息返回
				for (let toid_i = 0; toid_i < res.toid.length; toid_i++) {
					Doctorid = res.toid[toid_i]
					var sql15 = `insert into seekmedical_tempdoctor 
						(SeekMedicalAdviceID,DoctorID,SeekMedicalState)
						values (${inserted.insertId},${Doctorid},"申请中")`
					await exec(sql15)
					if (Doctorid in usocket) {
						//对方在线的情况
						let obj = {
							msg: "请求就诊消息发送成功",
							status: 200
						}
						//console.log(Doctorid)
						usocket[Doctorid].emit('seekMedical', SeekMedicalAdvice[0]);
						socket.emit('seekMedical', obj)
						for (let videourl_i in videourl) {
							usocket[Doctorid].emit('seekMedical_file_download', videourl[videourl_i].VideoAddress)
						}

					} else {
						var SeekMedicalAdvice1 = JSON.stringify(SeekMedicalAdvice[0])
						var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
							values ('${res.fromid}','${Doctorid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${SeekMedicalAdvice1}','1','seekmedical');`
						await exec(sql8)
						for (let videourl_i in videourl) {
							var sql11 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
								values ('${res.fromid}','${Doctorid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${videourl[videourl_i].VideoAddress}','1','seekMedical_file_download');`
							await exec(sql11)
						}
						let obj = {
							msg: "对方暂时不在线",
							status: 200
						}
						//usocket[res.fromid].emit('message',"对方不在线")
						socket.emit('seekMedical', obj)
					}
					//查询当天已经的挂号数
					let sql5 = `select 
						count(SeekMedicalAdviceID) as subscribeCount
						from seekmedical_registered 
						where 
						ExpertID = '${Doctorid}'
						and SeekmedicalDateTime = '${moment().format('YYYY-MM-DD')}'
						and
						(SeekmedicalTempState = '等待就诊' or SeekmedicalTempState = '等待专家同意')
						;`
					let subscribeCount = await exec(sql5)
					//将信息添加到挂号表
					let sql4 = `insert into seekmedical_registered
						(   
							ExpertID,
							SeekmedicalDateTime,
							SubscribeDateTime,
							SeekmedicalNumber,
							PatinetID,
							SeekmedicalTempState,
							SeekMedicalAdviceID
						) 
							values 
						(
							'${Doctorid}',
							'${res.guahaoTime || moment().format('YYYY-MM-DD')}',
							'${moment().format('YYYY-MM-DD HH:mm:ss')}',
							'${subscribeCount[0].subscribeCount + 1}',
							'${res.fromid}',
							'等待专家同意',
							'${inserted.insertId}'
						);`
					await exec(sql4)
				}
				//通知患者(如果是家属发起的，就通知患者，这里判断提交的familyID是不是和本人的是一样的)
				if (res.fromid !== res.familyID || res.familyID === '' || res.familyID === 'undefined') {
					let obj1 = {
						msg: "家属" + res.familyID + "给您发起了一次就诊",
						status: 200
					}
					//判断患者是否在线
					if (res.fromid in usocket) {
						usocket[res.fromid].emit('seekMedical_family', obj1)
					} else {
						var unreadmessage = JSON.stringify(obj1)
						let sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
							values ('${res.familyID}','${res.fromid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"seekMedical_family");`
					    await exec(sql8)
					}
				}
				// 智能诊断接口调用
				async function ai(){
					let sql18 = `select SymptomName from symptomrelation 
						where UserID = "${res.fromid}" and SeekMedicalAdviceID = "${inserted.insertId}"`
					let SymptomName = await exec(sql18)
					let symptom = [];
					let symptom_map = {}
					for (let SymptomName_i = 0; SymptomName_i < SymptomName.length; SymptomName_i++) {
						symptom.push(SymptomName[SymptomName_i].SymptomName)
						symptom_map[SymptomName[SymptomName_i].SymptomName] = true
					}
					// 症状
					let sql22 = `select SymptomID,SymptomName 
					from symptom_copy1 
					where SymptomName IS NOT NULL
					order by SymptomID;
					`
					let symptom_index = await exec(sql22)
					let symptom_ai = []
					for (let symptom_index_i = 0; symptom_index_i < symptom_index.length; symptom_index_i++) {
						if(!(symptom_map[symptom_index[symptom_index_i].SymptomName])){
							// 没值的时候往数组里面添加0
							symptom_ai.push(0)
						}else{
							// 当存在ai症状里面的值时，把此位置症状置为1
							symptom_ai.push(1)
						}
					}
					console.log(symptom_ai,SymptomName)
					// 查询病史对照数组
					let sql23 = `select DiseaseHistoryName,HistoryType from illness_history_index;`
					let history_index = await exec(sql23)
					let history_map = {}
					for(let history_index_i=0;history_index_i<history_index.length;history_index_i++){
						history_map[history_index[history_index_i].DiseaseHistoryName] = history_index[history_index_i].HistoryType
					}
					// 查询患者的病史
					let sql24 = `select 
					FamilyHistory as API_familyHistory,
					AllergyHistory as API_allergyHistory,
					GerenHistory as API_GerenHistory,
					PatientHistory as API_patientHistory from patient_history 
					where UserID = "${res.fromid}"`
					let API_history = await exec(sql24)
					let history_ai = new Array(19).fill(0)
					console.log(API_history)
					for(let history_i=0;history_i<API_history.length;history_i++){
						// 家族史
						let familyHistory = (API_history[history_i].API_familyHistory==null?[]:API_history[history_i].API_familyHistory.split(','))
						for(let f_i=0;f_i<familyHistory.length;f_i++){
							if(!!(history_map[familyHistory[f_i]])){
								history_ai[parseInt(history_map[familyHistory[f_i]])-1] = 1
							}
						}
						// 既往史
						let patientHistory = (API_history[history_i].API_patientHistory==null?[]:API_history[history_i].API_patientHistory.split(','))
						for(let p_i=0;p_i<patientHistory.length;p_i++){
							if(!!(history_map[patientHistory[p_i]])){
								history_ai[parseInt(history_map[patientHistory[p_i]])-1] = 1
							}
						}
						// 个人史
						let gerenHistory = (API_history[history_i].API_GerenHistory==null?[]:API_history[history_i].API_GerenHistory.split(','))
						for(let g_i=0;g_i<gerenHistory.length;g_i++){
							if(!!(history_map[gerenHistory[g_i]])){
								history_ai[parseInt(history_map[gerenHistory[g_i]])-1] = 1
							}
						}
					}
					let sql25 = `select 
					Gender,
					TIMESTAMPDIFF(YEAR, Birthday, CURDATE()) as Age,
					Hunyinshi
					from users
					where UserID = '${res.fromid}';`
					let userInfo = await exec(sql25)
					console.log(userInfo)
					let infoai = new Array(4).fill(0)
					if(userInfo.length){
						switch (userInfo[0].Gender) {
							case "男":
								infoai[2] = 1
								break;
							case "女":
								infoai[2] = 2
								break;
							default:
								break;
						}
						infoai[1] = userInfo[0].Age?userInfo[0].Age:''
						switch (userInfo[0].Hunyinshi) {
							case "已婚":
								infoai[0] = 1
								break;
							case "未婚":
								infoai[0] = 2
								break;
							case "离婚":
								infoai[0] = 4
								break;
							case "丧偶":
								infoai[0] = 3
								break;
							default:
								break;
						}
					}
					console.log(symptom_ai.length,history_ai.length)
					infoai[3] = 30 - (symptom_ai.shift()*5) - (symptom_ai.shift()*5) -(symptom_ai.shift()*5)
					let ai_arr1 = infoai.concat(symptom_ai,history_ai)
					console.log(ai_arr1)
					request({
						url: "http://106.52.223.96:5252/dementia",
						method: "POST",
						headers: {
							"content-type": "application/json",
						},
						body: JSON.stringify({
							"dementia1":ai_arr1
						}),
						timeout:30*1000
					}, function(error, response, data) {
						if (!error && response.statusCode == 200) {
							console.log("ai_result:",JSON.parse(data))
							let re = JSON.parse(data)
							let res2 = []
							if(infoai[1] < 50){
								let res1 = re.dementia_severity_re
								let Wegiht = [1,0,0,0]
								for(let i=0;i<4;i++){
									res2[i] = (res1[i] + Wegiht[i])/2
								}
							}else{
									res2 = re.dementia_severity_re
							}
							let res3 = res2.slice()
							res3[2] += res3.pop()
							let sql28 = `update seekmedicaladvice set 
							DementiaSeverityResult = '${res2}',
							DementiaResult = '${res3}'
							where SeekMedicalAdviceID = "${inserted.insertId}";
							`
							exec(sql28)
						}else{
							let sql28 = `update seekmedicaladvice set 
							DementiaSeverityResult = "${[0,0,0,0]}",
							DementiaResult = "${[0,0,0]}"
							where SeekMedicalAdviceID = "${inserted.insertId}";
							`
							exec(sql28)
							console.log(error)
						}
					}); 
				}
				ai()
			} catch (err) {
				console.log(err)
			}
		}
		seekmedicaldoctor();
	})
	//转诊为临时发起的就诊，专家发起的换一个专家诊断，最后转发到seekMedical请求头
	socket.on('seekMedical_temp', async function (req) {
		let res = req
		/**
		 * {
			fromid:req.user.UserID,
			toid:experts[experts_i].expId,
			msg:"新的就诊申请",
			pid:referralInfo[0].SeekMedicalAdviceID,      
			referralReason:referralInfo[0].ReferralReason  //转诊理由
		}
		 */
		//res.toid in usocket
		async function seekMedical_temp() {
			// 同步写法
			try {
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('seekMedical', res)
				} else {
					let unreadmessage = JSON.stringify(obj)
					let sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"seekMedical");`
					exec(sql8)
				}
			} catch (err) {
				console.log(err)
			}
		}
		seekMedical_temp();
	})
	//同意就诊申请消息接口
	socket.on('seekmedicalreply', async function (replymessage) {
		// replymessage:{
		// 	doctorID:101001,
		// 	pid:100,
		// 	API_state:"未完成"
		// }
		console.log("replymessage:", replymessage)
		async function seekmedicalreply() {
			// 同步写法
			try {
				var sql = `select DoctorID from seekmedical_tempdoctor where 
				SeekMedicalAdviceID = ${replymessage.pid};`
				var DoctorID = await exec(sql)
				//遍历发送消息的医生列表，告知剩余医生消息已经撤销
				for (let seekmeidcalreply_i = 0; seekmeidcalreply_i < DoctorID.length; seekmeidcalreply_i++) {
					console.log(DoctorID[seekmeidcalreply_i].DoctorID)
					if (DoctorID[seekmeidcalreply_i].DoctorID === replymessage.doctorID) {
						let sql13 = `update seekmedicaladvice set 
						CureDoctorID = ${replymessage.doctorID},
						SeekMedicalAdviceStatus = "未完成"
						where SeekMedicalAdviceID = ${replymessage.pid}`
						await exec(sql13)
						let sql16 = `update seekmedical_tempdoctor set 
						SeekMedicalState = "已同意"
						where SeekMedicalAdviceID = ${replymessage.pid} and DoctorID = ${replymessage.doctorID}`
						await exec(sql16)
						let repeal_reply = {
							pid: replymessage.pid,
							API_state: "已同意"
						}
						console.log(repeal_reply)
						socket.emit("seekmedicalreply", repeal_reply)
					} else {
						//向其他医生发送撤销申请
						//在线和不在线的情况
						let repeal_reply = {
							pid: replymessage.pid,
							API_state: "已撤销"
						}
						let sql27 = `update seekmedical_tempdoctor set 
						SeekMedicalState = "已撤销"
						where SeekMedicalAdviceID = ${replymessage.pid} and DoctorID = ${DoctorID[seekmeidcalreply_i].DoctorID}`
						await exec(sql27)
						if (DoctorID[seekmeidcalreply_i].DoctorID in usocket) {
							usocket[DoctorID[seekmeidcalreply_i].DoctorID].emit('seekmedicalreply', repeal_reply);
						} else {
							let sql14 = `insert into message (toid,res_datetime,message,is_read,request_head)  
							values ('${DoctorID[seekmeidcalreply_i].DoctorID}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${repeal_reply}','1','seekmedicalreply');`
							exec(sql14).catch(err => {
								console.log("未读消息插入失败: ", err)
							})
						}
						//将其他的挂号的医生记录记为取消
						let sql20 = `update seekmedical_registered set 
						SeekmedicalTempState = "已撤销"
						where SeekMedicalAdviceID = ${replymessage.pid} and ExpertID = '${DoctorID[seekmeidcalreply_i].DoctorID}'`
						await exec(sql20)
					}
				}
				//更新此医生状态为等待就诊
				let sql1 = `update seekmedical_registered set 
				SeekmedicalTempState = "等待就诊"
				where SeekMedicalAdviceID = ${replymessage.pid} and ExpertID = '${replymessage.doctorID}'`
				await exec(sql1)
				let sql18 = `select a.PatientID,a.FamilyID from seekmedicaladvice as a where a.SeekMedicalAdviceID = ${replymessage.pid};`
				let patient_id = await exec(sql18)
				console.log("patient_id:", patient_id)
				//家属号为空，undefined，的情况为患者自己发起的
				if (patient_id[0].FamilyID !== patient_id[0].PatientID && patient_id[0].FamilyID !== 'undefined' && patient_id[0].FamilyID !== '') {
					let sql19 = `select Name from users where UserID = '${patient_id[0].FamilyID}';`
					let name = await exec(sql19)
					var seekmedicalreply = {
						msg: "专家已接受了" + name[0].Name + "为您发起的就诊请求",
						status: 200
					}
				} else {
					var seekmedicalreply = {
						msg: "专家已接受了您发起的就诊请求",
						status: 200
					}
				}
				//console.log("seekmedicalreply",seekmedicalreply)
				if (patient_id[0].PatientID in usocket) {
					usocket[patient_id[0].PatientID].emit('seekmedicalreply', seekmedicalreply);
				} else {
					let unreadmessage = JSON.stringify(seekmedicalreply)
					let sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
					values ('${replymessage.doctorID}','${patient_id[0].PatientID}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"seekmedicalreply");`
					exec(sql8)
				}
			} catch (err) {
				console.log(err)
			}
		}
		seekmedicalreply()
	})
	//患者发起的转诊 
	socket.on('referral', async function (req) {
		let res = req
		console.log(res);
		/**
		 * {
		 * 		fromid:186                //你自己的ID
		 * 		toid:101001               //转诊后的医生ID
		 * 		pid:123                   //就诊ID
		 * 		guahaoTime:2020-01-02     //挂号的时间（就诊日期）
		 * }
		 */
		//res.toid in usocket
		async function referraldoctor() {
			// 同步写法
			try {
				//查询此次就诊能否转诊
				let sql1 = `select GUID from seekmedicaladvice
					where SeekMedicalAdviceID = "${res.pid}" and PatientID = "${res.fromid}" 
					and SeekMedicalAdviceStatus = '申请中';`
				let jiuzhenData = await exec(sql1)
				if (jiuzhenData.length === 0) {
					let obj = {
						msg: "转诊失败，就诊正在进行中，暂时无法转诊!",
						status: 0
					}
					socket.emit('referral', obj)
					return;
				}
				//删除原有的就诊申请记录
				let sql2 = `delete from seekmedical_tempdoctor where SeekMedicalAdviceID = "${res.pid}"`
				await exec(sql2)
				//插入就诊专家
				let sql = `
					insert into seekmedical_tempdoctor
					(SeekMedicalAdviceID,DoctorID,SeekMedicalState)
					values
					("${res.pid}","${res.toid}","申请中");
					`
				await exec(sql)
				//删除之前的的挂号信息
				let sql3 = `delete from seekmedical_registered where SeekMedicalAdviceID = "${res.pid}"`
				await exec(sql3)
				//查询挂号当天已经的挂号数
				let sql5 = `select 
					count(SeekMedicalAdviceID) as subscribeCount
					from seekmedical_registered 
					where 
					ExpertID = '${res.toid}'
					and SeekmedicalDateTime = '${res.guahaoTime || moment().format('YYYY-MM-DD')}'
					and
					(SeekmedicalTempState = '等待就诊' or SeekmedicalTempState = '等待专家同意')
					;`
				let subscribeCount = await exec(sql5)
				//将信息添加到挂号表
				let sql4 = `insert into seekmedical_registered
					(   
						ExpertID,
						SeekmedicalDateTime,
						SubscribeDateTime,
						SeekmedicalNumber,
						PatinetID,
						SeekmedicalTempState,
						SeekMedicalAdviceID
					) 
						values 
					(
						'${res.toid}',
						'${res.guahaoTime || moment().format('YYYY-MM-DD')}',
						'${moment().format('YYYY-MM-DD HH:mm:ss')}',
						'${subscribeCount[0].subscribeCount + 1}',
						'${res.fromid}',
						'等待专家同意',
						'${res.pid}'
					);`
				await exec(sql4)
				let sql7 = `
					select 
					SeekMedicalAdviceID as pid,
					SeekMedicalAdviceStatus as API_state,
					MedicalAdviceApplicationDateTime as API_date,
					PatientName as API_name,
					Symptom as API_symptom
					from seekmedicaladvice where SeekMedicalAdviceID = "${res.pid}" 
					`
				let SeekMedicalAdvice = await exec(sql7)
				//console.log(SeekMedicalAdvice)
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					var obj = {
						msg: "请求转诊消息发送成功",
						status: 200
					}
					usocket[res.toid].emit('seekMedical', SeekMedicalAdvice[0]);
					socket.emit('referral', obj)
				} else {
					var SeekMedicalAdvice1 = JSON.stringify(SeekMedicalAdvice[0])
					var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${SeekMedicalAdvice1}','1','referral');`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
					var obj = {
						msg: "对方暂时不在线",
						status: 200
					}
					//usocket[res.from].emit('message',"对方不在线")
					socket.emit('referral', obj)
				}
			} catch (err) {
				console.log(err)
				socket.emit('referral', "提交失败")
			}
		}
		referraldoctor();


	})
	//医生发起的转诊，通知患者
	socket.on('referral_message', async function (req) {
		let res = req
		/**
		 * {
					fromid:req.user.UserID, 
					toid:seekMedicalAdviceInfo[0].PatientID,
					msg:'医生' + seekMedicalAdviceInfo[0].Name + '为您的就诊号为' + req.body.pid + '重新推荐了医生'
				}
		 */
		//res.toid in usocket
		async function referral_message() {
			// 同步写法
			try {
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('referral_message', res)
				} else {
					let unreadmessage = JSON.stringify(obj)
					let sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"referral_message");`
					exec(sql8)
				}
			} catch (err) {
				console.log(err)
			}
		}
		referral_message

	})
	//医生发起的转诊，通知原来的医生(患者同意或者拒绝)
	socket.on('agree_referral', async function (req) {
		let res = req
		/**
		 * {
		 * 				pid:referralInfo[0].SeekMedicalAdviceID,
						toid:referralInfo[0].BeforeUserID,
						msg:"患者已经同意pid为"+referralInfo[0].SeekMedicalAdviceID+"的转诊申请"
			}
		 */
		//res.toid in usocket
		async function agree_referral() {
			// 同步写法
			try {
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('agree_referral', res)
				} else {
					let unreadmessage = JSON.stringify(obj)
					let sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"agree_referral");`
					exec(sql8)
				}
			} catch (err) {
				console.log(err)
				socket.emit('agree_referral', "提交失败")
			}
		}
		agree_referral();
	})

	//后续治疗消息进行通知(护士的通知)
	socket.on('after_treatment_request', async function (req) {
		var res = req
		/**
		 * {
		 * 		
		 * 		toid:101001               //后续评估的护士ID
		 * 		fromid:101001               //患者ID
		 * }
		 */
		//res.toid in usocket
		async function after_treatment_request() {
			// 同步写法
			try {
				var obj = {
					msg: res.fromid + "患者请求入院评估",
					status: 200
				}
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('after_treatment_request', obj)
				} else {
					var unreadmessage = JSON.stringify(obj)
					var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"after_treatment_request");`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
				}
			} catch (err) {
				console.log(err)
				socket.emit('after_treatment_request', "提交失败")
			}
		}
		after_treatment_request();
	})
	//医生确定患者入院通知
	//后续治疗消息对医生进行通知
	socket.on('doctor_confirm_tohospital', async function (req) {
		var res = req
		console.log(doctor_confirm_tohospital)
		console.log(res)
		/**
		 * {
		 * 		
		 * 		toid:101001               //发送的医生ID
		 * 		fromid:103001              //评估护士得ID
		 * }
		 */
		//res.toid in usocket
		async function doctor_confirm_tohospital() {
			// 同步写法
			try {
				var obj = {
					msg: res.fromid + "患者评估已完成，等待医生确认入院请求",
					status: 200
				}
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('doctor_confirm_tohospital', obj)
				} else {
					var unreadmessage = JSON.stringify(obj)
					var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"doctor_confirm_tohospital");`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
				}
			} catch (err) {
				console.log(err)
				socket.emit('doctor_confirm_tohospital', "提交失败")
			}
		}
		doctor_confirm_tohospital();


	})

	//后续治疗消息对医生护士进行通知
	socket.on('confirm_tohospital', async function (req) {
		var res = req

		/**
		 * {
		 * 		
		 * 		toid:101001               //发送的医生/护士ID
		 * 		fromid:103001              //医生得ID
		 * }
		 */
		//res.toid in usocket
		async function confirm_tohospital() {
			// 同步写法
			try {
				var obj = {
					msg: res.fromid + "患者入院请求完成",
					status: 200
				}
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('confirm_tohospital', obj)
				} else {
					var unreadmessage = JSON.stringify(obj)
					var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"confirm_tohospital");`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
				}
			} catch (err) {
				console.log(err)
				socket.emit('confirm_tohospital', "提交失败")
			}
		}
		confirm_tohospital();


	})

	//出院治疗消息对医生护士进行通知
	socket.on('confirm_endhospital', async function (req) {
		var res = req

		/**
		 * {
		 * 		
		 * 		toid:101001               //发送的医生/护士ID
		 * 		fromid:103001              //医生得ID
		 * }
		 */
		//res.toid in usocket
		async function confirm_endhospital() {
			// 同步写法
			try {
				var obj = {
					msg: res.fromid + "患者出院通知",
					status: 200
				}
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('confirm_endhospital', obj)
				} else {
					var unreadmessage = JSON.stringify(obj)
					var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"confirm_tohospital");`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
				}
			} catch (err) {
				console.log(err)
				socket.emit('confirm_endhospital', "提交失败")
			}
		}
		confirm_endhospital();


	})

	//住院期间医生治疗通知患者
	socket.on('doctor_treatment', async function (req) {
		var res = req
		/**
		 * {
		 * 		
		 * 		toid:183               //患者的ID
		 * 		fromid:103001              //医生得ID
		 * }
		 */
		//res.toid in usocket
		async function doctor_treatment() {
			console.log("doctor_treatment",res)
			// 同步写法
			try {
				var obj = {
					fromid:res.fromid,
					msg: res.fromid + " 新的住院治疗消息",
					status: 200,
					HospitalID:res.HospitalID,
                    pid:res.pid
				}
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('doctor_treatment', obj)
				} else {
					let unreadmessage = JSON.stringify(obj)
					let sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"doctor_treatment");`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
				}
			} catch (err) {
				console.log(err)
				socket.emit('doctor_treatment', "提交失败")
			}
		}
		doctor_treatment();
	})


	//住院期间护士护理通知患者
	socket.on('nurse_Nursing', async function (req) {
		var res = req
		/**
		 * {
		 * 		toid:101001               //患者ID
		 * 		fromid:103001              //护士的ID
		 * }
		 */
		//res.toid in usocket
		async function nurse_Nursing() {
			console.log("nurse_Nursing",res)
			// 同步写法
			try {
				var obj = {
					fromid:res.fromid,
					msg: res.fromid + " 新的护理消息",
					status: 200,
					HospitalID:res.HospitalID,
                    pid:res.pid
				}
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('nurse_Nursing', obj)
				} else {
					let unreadmessage = JSON.stringify(obj)
					let sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"nurse_Nursing");`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
				}
			} catch (err) {
				console.log(err)
				socket.emit('nurse_Nursing', "提交失败")
			}
		}
		nurse_Nursing();
	})


	//住院期间护士护理通知患者
	socket.on('nurse_pinggu', async function (req) {
		var res = req
		/**
		 * {
		 * 		toid:101001               //患者ID
		 * 		fromid:103001              //护士的ID
		 * }
		 */
		//res.toid in usocket
		async function nurse_pinggu() {
			console.log("nurse_pinggu",res)
			// 同步写法
			try {
				var obj = {
					fromid:res.fromid,
					msg: res.fromid + " 新的护士评估消息",
					status: 200,
					HospitalID:res.HospitalID,
                    pid:res.pid
				}
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('nurse_pinggu', obj)
				} else {
					let unreadmessage = JSON.stringify(obj)
					let sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"nurse_pinggu");`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
				}
			} catch (err) {
				console.log(err)
				socket.emit('nurse_pinggu', "提交失败")
			}
		}
		nurse_pinggu();
	})

	//新会诊发起通知（患者，医生）
	socket.on('newGroupConsultation', function (req) {
		var res = req

		/**
			  var obj = {
					fromid:req.user.UserID,
					fromname:req.user.Name,
					pid:pid,
					toid:patient_info[0].PatientID,
					msg:"新的会诊参与请求通知"
				}
					}
		 */
		//res.toid in usocket
		async function newGroupConsultation() {
			// 同步写法
			try {
				var newGroupConsultation_content = res
				//查询就诊信息返回
				console.log(newGroupConsultation_content)
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('newGroupConsultation', newGroupConsultation_content)
				} else {
					var unreadmessage = JSON.stringify(newGroupConsultation_content)
					var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"newGroupConsultation");`
					await exec(sql8)
				}
			} catch (err) {
				console.log(err)
				socket.emit('newGroupConsultation', "提交失败")
			}
		}
		newGroupConsultation();
	})
	//会诊中有成员发表新内容通知
	socket.on('newGroupConsultation_content', function (req) {
		var res = req

		/**
			  var newGroupConsultation_content = {
						fromid:req.user.UserID,
						toid:GroupConsultationDoctors[GroupConsultationDoctors_i].DoctorID,
						gid:GroupConsultationDoctors[GroupConsultationDoctors_i].GroupConsultationID,
						msg:'新的会诊消息'
					}
		 */
		//res.toid in usocket
		async function newGroupConsultation_content() {
			// 同步写法
			try {
				var newGroupConsultation_content = res
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('newGroupConsultation_content', newGroupConsultation_content)
				} else {
					var unreadmessage = JSON.stringify(newGroupConsultation_content)
					var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"newGroupConsultation_content");`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
				}
			} catch (err) {
				console.log(err)
				socket.emit('newGroupConsultation_content', "提交失败")
			}
		}
		newGroupConsultation_content();
	})
	//结束会诊通知
	socket.on('endGroupConsultation', function (req) {
		var res = req
		/**
			  var endGroupConsultation = {
						fromid:req.user.UserID,
						toid:GroupConsultationDoctors[GroupConsultationDoctors_i].DoctorID,
						gid:GroupConsultationDoctors[GroupConsultationDoctors_i].GroupConsultationID,
						msg:'新的会诊消息'
					}
		 */
		//res.toid in usocket
		async function endGroupConsultation() {
			// 同步写法
			try {
				var endGroupConsultation = res
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('endGroupConsultation', endGroupConsultation)
				} else {
					var unreadmessage = JSON.stringify(endGroupConsultation)
					var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"endGroupConsultation");`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
				}
			} catch (err) {
				console.log(err)
				socket.emit('endGroupConsultation', "提交失败")
			}
		}
		endGroupConsultation();
	})
	//医生同意或者拒绝视频会诊通知
	socket.on('agreeVideoConsultation', function (req) {
		var res = req
		/**
			  var endGroupConsultation = {
						fromid:req.user.UserID,
						toid:GroupConsultationDoctors[GroupConsultationDoctors_i].DoctorID,
						gid:GroupConsultationDoctors[GroupConsultationDoctors_i].GroupConsultationID,
						msg:'新的会诊消息'
					}
		 */
		//res.toid in usocket
		async function agreeVideoConsultation() {
			// 同步写法
			try {
				var agreeVideoConsultation = res
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('agreeVideoConsultation', agreeVideoConsultation)
				} else {
					var unreadmessage = JSON.stringify(agreeVideoConsultation)
					var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"agreeVideoConsultation");`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
				}
			} catch (err) {
				console.log(err)
				socket.emit('agreeVideoConsultation', "提交失败")
			}
		}
		agreeVideoConsultation();
	})
	//当天的日程通知
	socket.on('schedule_message', function (req) {
		var res = req
		/**
			  var endGroupConsultation = {
				currentTime: 2020-12-13 06:27:25 ,
				contentStartTime: '1607841450000',
				content: '主持会诊号为318的视频会诊',
				toid: '101001'
			}
		 */
		//res.toid in usocket
		async function schedule_message() {
			// 同步写法
			try {
				var schedule_message = req
				//查询就诊信息返回
				if (res.toid in usocket) {
					//对方在线的情况
					usocket[res.toid].emit('schedule_message', schedule_message)
				} else {
					var unreadmessage = JSON.stringify(schedule_message)
					var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
						values ('${res.fromid}','${res.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"schedule_message");`
					exec(sql8).catch(err => {
						console.log("未读消息插入失败: ", err)
					})
				}
			} catch (err) {
				console.log(err)
				socket.emit('schedule_message', "提交失败")
			}
		}
		schedule_message();
	})

	//就诊结束通知
	socket.on('seekmedical_end', function (req) {
		console.log(req.toid)
		//console.log("专家已给出诊断结论")
		if (req.toid in usocket) {
			usocket[req.toid].emit("seekmedical_end", req)
		} else {
			var unreadmessage = JSON.stringify(req)
			var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
			values ('${req.fromid}','${req.toid}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"seekmedical_end");`
			exec(sql8).catch(err => {
				console.log("未读消息插入失败: ", err)
			})
		}
	})

	//出院申请
	socket.on('apply_outhospital', async function (req) {
		console.log("apply_outhospital:", req)
		let pid = req.pid
		let outHospitalReason = req.outHospitalReason
		let outHospitalDate = req.outHospitalDate || moment().format('YYYY-MM-DD HH:mm:ss')
		let sql = `insert into out_hospital_apply 
		(SeekMedicalAdviceID,PatientID,OutHospitalReason,OutHospitalTime)
		values
		('${pid}','${req.fromid}','${outHospitalReason}','${outHospitalDate}')`
		await exec(sql)
		let apply_outHospital = {
			pid: pid,
			patientID: req.fromid,
			outHospitalReason: outHospitalReason,
			outHospitalDate: outHospitalDate
		}
		//遍历所有的医生
		let sql1 = `select RecommendDoctorID from seekmedical_after_treatment_doctor where SeekMedicalAdviceID = '${pid}';`
		let doctorlist = await exec(sql1)
		//向医生发送出院申请的消息
		for (let doctorlist_i = 0; doctorlist_i < doctorlist; doctorlist_i++) {
			if (doctorlist[doctorlist_i] in usocket) {
				usocket[doctorlist[doctorlist_i]].emit("apply_outhospital", apply_outHospital)
			} else {
				var unreadmessage = JSON.stringify(apply_outHospital)
				var sql8 = `insert into message (fromid,toid,res_datetime,message,is_read,request_head)  
				values ('${req.fromid}','${doctorlist[doctorlist_i]}','${moment().format('YYYY-MM-DD HH:mm:ss')}','${unreadmessage}','1',"apply_outhospital");`
				exec(sql8).catch(err => {
					console.log("未读消息插入失败: ", err)
				})
			}
		}
	})
	//强行离线
	socket.on('offline', function (req) {
		//移除
		console.log(req, "下线")
		if (req in usocket) {
			delete (usocket[req]);
			user.splice(user.indexOf(req), 1);
		}
		console.log(user);
	})
	//正常退出
	socket.on('disconnect', function () {
		console.log(socket.id, socket.username, "正常下线");
		//移除
		if (socket.id in socket_name) {
			if (socket_name[socket.id] === 'repeatline') {
				//用户为重复登陆的将不用清除user表里面的用户
				delete (socket_name[socket.id]);
			} else {
				delete (usocket[socket_name[socket.id]]);
				user.splice(user.indexOf(socket.username), 1);
				delete (socket_name[socket.id]);
			}
		}
		console.log('下线后的用户', user)

	})
});

//获取流数据
app.get('/readload', (req, res) => {
	//console.log("拉流")
	var fileName = path.resolve(__dirname, req.query.url)
	console.log(fileName)
	var stream = fs.createReadStream(fileName)
	stream.pipe(res)
})

//下载数据
app.get('/download', (req, res) => {
	console.log(req.query.url)
	res.download(`${req.query.url}`)
})

//更新护士名字，格式为护士＋护士ID（慎用）
app.get('/abc20', async (req, res) => {
	let sql = `select * from user_role where RoleID = 20;`
	let list = await exec(sql)
	for (let list_i = 0; list_i < list.length; list_i++) {
		let name = '护士' + list[list_i].UserID
		let sql1 = `update users set Name = '${name}' where UserID = '${list[list_i].UserID}'`
		let sql2 = `select Name from users where UserID = '${list[list_i].UserID}';`
		await exec(sql1)
		list2 = await exec(sql2)
		console.log(list2)
	}
	//console.log(list)
	res.json({
		list2
	})
})

//更新医生名字，格式为医生＋医生ID（慎用）
app.get('/abc40', async (req, res) => {
	let sql = `select * from user_role where RoleID = 40;`
	let list = await exec(sql)
	for (let list_i = 0; list_i < list.length; list_i++) {
		let name = '医生' + list[list_i].UserID
		let sql1 = `update users set Name = '${name}' where UserID = '${list[list_i].UserID}'`
		let sql2 = `select Name from users where UserID = '${list[list_i].UserID}';`
		await exec(sql1)
		list2 = await exec(sql2)
		console.log(list2)
	}
	//console.log(list)
	res.json({
		list2
	})
})




