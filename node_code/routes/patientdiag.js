var express = require('express');
var app = express();
var router = express.Router();
const { exec } = require('../db/config.js');
const passport = require('passport');
const query = require('../db/mysql.js');
var moment = require('moment');

//获取添加病历函数（添加症状描述，诊断结论，治疗方案）
const { add_symptom, add_diagnosis, add_Treatment } = require('../diagrelation/add_diag.js')
//获取本地时区
moment.locale('zh-cn');
//获取字符串拼音
const Alphabetize = require('chinese-alphabetize')
//调用socke客户端
var SOCKET_IP = require("../utils/server_IP.js").SOCKET_IP;
var socket_options = require("../utils/server_IP.js").socket_options;
//var socket = require('socket.io-client')('https://www.nowhealth.top:3000');  
var socket = require('socket.io-client')('https://47.111.146.85:3000',socket_options); 
socket.on('connect', function () {
    console.log("已连接到socket服务器 3000端口")
});
socket.on('disconnect', function () {
    console.log("服务器连接关闭")
});

// JWT鉴权
var jwtConfig = require("../utils/jwtAuth.js").jwtConfigAuth;
passport.use(jwtConfig);

//查询今日患者
router.get('/todaypatients',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function todaypatientsData() {
            // 同步写法
            try {
                //查询今日患者内容
                //当前患者里面返回所有就诊的 未完成、申请中，今天完成的
                var sql1 = `
              select 
              distinct a.SeekMedicalAdviceID as pid,
              a.SeekMedicalAdviceStatus as API_state,
              a.PatientName as API_name,
              a.ApplySeekMedicalDateTime as API_date,
              a.Symptom as API_symptom,
              a.MedicalAdviceApplicationDateTime,
              c.ReferralState as referralState
              from seekmedicaladvice as a left join seekmedical_tempdoctor as b
              on b.SeekMedicalAdviceID = a.SeekMedicalAdviceID
              left join seekmedical_referral as c
              on a.SeekMedicalAdviceID = c.SeekMedicalAdviceID and a.CureDoctorID = c.BeforeUserID
              where b.DoctorID = "${req.user.UserID}" and a.SeekMedicalAdviceStatus = "申请中"
              order by MedicalAdviceApplicationDateTime desc;
              `
                /*
                之前的限制条件，现在改了，如果后面要改回来直接用下面的代码
                where ((b.DoctorID = "${req.user.UserID}" and a.SeekMedicalAdviceStatus = "申请中")
                or (a.CureDoctorID = "${req.user.UserID}" and a.SeekMedicalAdviceStatus = "未完成")
                or (a.CureDoctorID = "${req.user.UserID}" and a.SeekMedicalAdviceStatus = "已完成" 
                and a.MedicalAdviceApplicationDateTime >= "${moment().format('YYYY-MM-DD')}"))
                 */
                var seekmedicaladvicedata = await exec(sql1)
                //console.log(seekmedicaladvicedata)
                res.json({
                    status: 200,
                    seekmedicaladvicedata
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "暂时无法显示"
                })
            }
        }
        todaypatientsData();
    })

//查询历史患者
router.get('/historypatients',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function todaypatientsData() {
            // 同步写法
            try {
                //查询历史患者内容
                //历史患者里面只返回 今天以前，已完成的
                var sql1 = `
              select 
              distinct SeekMedicalAdviceID as pid,
              SeekMedicalAdviceStatus as API_state,
              ApplySeekMedicalDateTime as API_date,
              MedicalAdviceFinishDateTime as API_Diagdate,
              PatientName as API_name,
              Symptom as API_symptom
              from seekmedicaladvice where 
              CureDoctorID = "${req.user.UserID}" and SeekMedicalAdviceStatus = "已完成"
              and MedicalAdviceApplicationDateTime <= "${moment().format('YYYY-MM-DD')}"
              `
                var seekmedicaladvicedata = await exec(sql1)
                //console.log(seekmedicaladvicedata)
                res.json({
                    status: 200,
                    seekmedicaladvicedata
                })

            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "暂时无法显示"
                })
            }
        }
        todaypatientsData();
    })


function gettodaypatientsdata(data, callback) {
    data.forEach((item, index, arr) => {
        var sql2 = `select 
    Name as API_name,
    Gender as API_gender,
    Birthday as API_birthday,
    Address as API_address,
    Phone as API_tel
    from users where UserID = "${item.PatientID}";`
        exec(sql2).then((Patientdata) => {
            //console.log(Patientdata)
            Patientdata[0].API_pic = ""
            Patientdata[0].API_date = item.MedicalAdviceApplicationDateTime
            //console.log(Patientdata)
            todaypatientsdata[index] = {
                Patientdata
            }
            datacount++;
            if (arr.length === datacount) {
                //console.log(newarray)
                callback(todaypatientsdata)
            }
        })

    })
}




//处理医学检查结果
function MedicalExaminationDeal(arrmedical) {
    obj3 = {}
    arr1 = []
    arr2 = []
    count = 0
    datacount = 0
    for (j = 0; j < arrmedical.length; j++) {
        item = arrmedical[j]
        obj2 = {}
        obj1 = {
            API_type: "",
            API_ID: "",
            API_title: "",
            API_aiResult: "",
            API_date: "",
            API_hospital: "",
            API_img: "",
            API_table: {
                API_data: []
            }
        }

        //arr2设置为已有的存在医学检查结果ID得数组，如果存在医学检查结果ID,则直接添加到该ID下，如果没有则先创建
        if (!(arr2.includes(item.MedicalExaminationID))) {
            obj1["API_type"] = item.MedicalExaminationType
            obj1["API_ID"] = item.MedicalExaminationID
            obj1["API_title"] = item.MedicalExaminationName
            obj1["API_aiResult"] = item.MedicalExaminationResult,
            obj1["API_date"] = item.MedicalExaminationDateTime
            obj1["API_img"] = item.MedicalExaminationImage
            obj1["API_hospital"] = item.HospitalName
            //如果没有详细得医学检查结果，只有图片则不添加table数据
            if (item.MedicalExaminationDetailName !== null && item.MedicalExaminationDetailResult !== null) {

                obj1["API_table"]["API_data"].push({
                    API_item: item.MedicalExaminationDetailName,
                    API_result: item.MedicalExaminationDetailResult,
                    API_unit: item.MedicalExaminationDetailUnit,
                    API_rangeBottom: item.MedicalExaminationDetailRangeBottom,
                    API_rangeTop: item.MedicalExaminationDetailRangeTop
                })
            }
            obj3[item.MedicalExaminationID] = obj1
        } else {
            if (item.MedicalExaminationDetailName !== null && item.MedicalExaminationDetailResult !== null) {

                obj3[item.MedicalExaminationID]["API_table"]["API_data"].push({
                    API_item: item.MedicalExaminationDetailName,
                    API_result: item.MedicalExaminationDetailResult,
                    API_unit: item.MedicalExaminationDetailUnit,
                    API_rangeBottom: item.MedicalExaminationDetailRangeBottom,
                    API_rangeTop: item.MedicalExaminationDetailRangeTop
                })
            }
        }
        //datacount++;
        count++;
        //console.log(obj3["1"].API_table)
        arr2.push(item.MedicalExaminationID)
        //医学检查结果遍历完成
        if (arrmedical.length == count) {
            //数组去重函数
            function dedupe(array) {
                return Array.from(new Set(array));
            }
            var arr3 = dedupe(arr2)
            for (arr3_count = 0; arr3_count < arr3.length; arr3_count++) {
                arr1.push(obj3[arr3[arr3_count]])
            }
            //console.log(arr1)
            return arr1
        }

    }

}

//查询患者信息
router.get('/patient/:SeekMedicalAdviceID',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        const SeekMedicalAdviceID = req.params.SeekMedicalAdviceID
        //console.log(PatientID)          
        async function patientsData() {
            // 同步写法
            try {
                //查询患者诊断基本信息
                var sql2 = `
                select SeekMedicalAdviceID,
                SeekMedicalAdviceStatus,
                SeekMedicalState,
                Symptom,
                PatientID,
                MedicalAdviceApplicationDateTime,
                RecommendAfter,
                IsGroupConsultation,
                NaodianResult,
                DementiaResult,
                DementiaSeverityResult,
                IsGroupConsultationState
                from seekmedicaladvice where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
                const patientdiaginfo = await exec(sql2)
                //console.log(patientdiaginfo)
                if (patientdiaginfo.length == 0) {
                    res.json({
                        //没有就诊号的情况下是没有其他信息,所以直接返回空的信息
                        API_basicInfo: "",
                        API_state: "false",
                        API_illState: {
                            API_description: [],
                            API_audio: [],
                            API_video: []
                        },
                        API_history: [],
                        API_examResult: [],
                        API_diagInfo: {
                            //诊断结论
                            API_diagResult: "",
                            nandianFileURL: '',
                            NaodianResult: '',
                            DementiaResult: '',
                            DementiaSeverityResult: '',
                            //治疗方案
                            API_treatment: {
                                API_description: "",
                                API_prescription: {
                                } //处方
                            },
                            // 推荐医疗机构/医师/护士
                            API_: {
                                API_org: {
                                    API_orgId: "",
                                    API_orgName: ""
                                },
                                API_doc: {
                                    API_docId: "",
                                    API_docName: ""
                                },
                                API_nur: {
                                    API_nurId: "",
                                    API_nurName: ""
                                }
                            }
                        }
                    })
                } else {
                    //查询患者基本信息
                    var sql1 = `select 
                    UserID as API_UserID,
                    Name as API_name,
                    Gender as API_gender,
                    Birthday as API_birthday,
                    Address as API_address,
                    Phone as API_tel,
                    Image as API_pic
                    from users where UserID = "${patientdiaginfo[0].PatientID}";`
                    const patientinfo = await exec(sql1)
                    //else的情况是存在申请就诊号的情况，使用就诊号可以查询用户上传的以及医生的诊断信息等结论      
                    //sql3,sql4查询患者上传的音视频
                    var sql3 = `
                    select AudioName API_name,
                    a.AudioID as API_audioID,
                    a.AudioType as API_type,
                    a.AudioAddress as url,
                    a.AudioString as src,
                    a.AudioDate as API_date,
                    a.AudioDuration as API_time,
                    b.QuestionID as API_QuestionID,
                    b.Question as API_Question
                    from seekmedicalaudio as a left join seekmedical_question as b
                    on a.QuestionID = b.QuestionID
                    where SeekMedicalAdviceID = ${SeekMedicalAdviceID}
                    `
                    var sql4 = `
                    select VideoName API_name,
                    a.VideoID API_videoID,
                    a.VideoType as API_type,
                    a.VideoAddress as url,
                    a.VideoString as src,
                    a.VideoDate as API_date,
                    a.VideoDuration as API_time,
                    b.QuestionID as API_QuestionID,
                    b.Question as API_Question
                    from seekmedicalvideo as a left join seekmedical_question as b
                    on a.QuestionID = b.QuestionID
                    where SeekMedicalAdviceID = ${SeekMedicalAdviceID}
                    `
                    const patientaudioinfo = await exec(sql3)
                    const patientvedioinfo = await exec(sql4)

                    //问题ID数组
                    let QuestionID_Arr = []

                    let Video = []
                    //问题的一个对象
                    let patientvedio = {}
                    //处理视频
                    for (patientvedioinfo_i = 0; patientvedioinfo_i < patientvedioinfo.length; patientvedioinfo_i++) {
                        //如果问题ID已经存在数组中直接把该视频或者音频推入已有的结构中

                        if (QuestionID_Arr.includes(patientvedioinfo[patientvedioinfo_i].API_QuestionID)) {

                            Video1["API_video"].push(patientvedioinfo[patientvedioinfo_i].url)

                        } else {//不存在则新建问题ID的结构
                            var Video1 = {
                                API_Question: "",
                                API_text: "",
                                API_date: "",
                                API_time: "",
                                API_name: "",
                                API_type: "",
                                API_video: []
                            }
                            QuestionID_Arr.push(patientvedioinfo[patientvedioinfo_i].API_QuestionID)
                            Video1["API_Question"] = patientvedioinfo[patientvedioinfo_i].API_Question
                            Video1["API_text"] = patientvedioinfo[patientvedioinfo_i].API_text
                            Video1["API_date"] = patientvedioinfo[patientvedioinfo_i].API_date
                            Video1["API_time"] = patientvedioinfo[patientvedioinfo_i].API_time
                            Video1["API_name"] = patientvedioinfo[patientvedioinfo_i].API_name
                            Video1["API_type"] = patientvedioinfo[patientvedioinfo_i].API_type
                            Video1["API_video"].push(patientvedioinfo[patientvedioinfo_i].url)
                            patientvedio[patientvedioinfo[patientvedioinfo_i].API_QuestionID] = Video1
                        }
                        console.log(patientvedio)
                        Video.push(patientvedio[patientvedioinfo[patientvedioinfo_i].API_QuestionID])
                    }
                    //数组去重函数
                    function norepeat(arr) {
                        for (var i = 0; i < arr.length - 1; i++) {
                            for (var j = i + 1; j < arr.length; j++) {
                                if (arr[i] == arr[j]) {
                                    arr.splice(j, 1);
                                    j--;
                                }
                            }
                        }
                        return arr;
                    }
                    Video = norepeat(Video)
                    console.log(Video)
                    //处理音频
                    let QuestionID_Audio_Arr = []
                    let Audio = []
                    //问题的一个对象
                    let patientaudio = {}
                    //console.log(patientaudioinfo)
                    for (let patientaudioinfo_i = 0; patientaudioinfo_i < patientaudioinfo.length; patientaudioinfo_i++) {
                        //如果问题ID已经存在数组中直接把该视频或者音频推入已有的结构中

                        if (QuestionID_Audio_Arr.includes(patientaudioinfo[patientaudioinfo_i].API_QuestionID)) {
                            audio1["API_audio"].push(patientaudioinfo[patientaudioinfo_i].url)


                        } else {//不存在则新建问题ID的结构
                            var audio1 = {
                                API_Question: "",
                                API_text: "",
                                API_date: "",
                                API_time: "",
                                API_name: "",
                                API_type: "",
                                API_audio: []
                            }
                            QuestionID_Audio_Arr.push(patientaudioinfo[patientaudioinfo_i].API_QuestionID)
                            audio1["API_Question"] = patientaudioinfo[patientaudioinfo_i].API_Question
                            audio1["API_text"] = patientaudioinfo[patientaudioinfo_i].API_text
                            audio1["API_date"] = patientaudioinfo[patientaudioinfo_i].API_date
                            audio1["API_time"] = patientaudioinfo[patientaudioinfo_i].API_time
                            audio1["API_name"] = patientaudioinfo[patientaudioinfo_i].API_name
                            audio1["API_type"] = patientaudioinfo[patientaudioinfo_i].API_type
                            audio1["API_audio"].push(patientaudioinfo[patientaudioinfo_i].url)
                            patientaudio[patientaudioinfo[patientaudioinfo_i].API_QuestionID] = audio1
                        }
                        //console.log(patientaudio)
                        Audio.push(patientaudio[patientaudioinfo[patientaudioinfo_i].API_QuestionID])
                    }
                    Audio = norepeat(Audio)
                    //console.log(patientinfo)
                    //console.log(patientdiaginfo)
                    //获取用户的申请就诊时间
                    patientinfo[0]["API_date"] = patientdiaginfo[0].MedicalAdviceApplicationDateTime
                    //查询影像学检查结果
                    let sql5 = `select 
                    ImageExaminationName as API_title,
                    ImageExaminationType as API_type,
                    ImageAddress as API_img,
                    ImageExaminationExplain as API_aiResult,
                    HospitalName as API_hospitalname,
                    ExaminationDateTime as API_date
                    from imageexamination
                    where SeekMedicalAdviceID = ${patientdiaginfo[0].SeekMedicalAdviceID}
                    `
                    const ImageExaminationinfo = await exec(sql5)
                    // 获取脑电文件
                    let sql15 = `select 
                    NaodianFileURL
                    from seekmedical_eeg 
                    where SeekMedicalAdviceID = "${patientdiaginfo[0].SeekMedicalAdviceID}"`
                    let EEGinfo = await exec(sql15)
                    let naodianFileURL = ''
                    if (EEGinfo.length !== 0) {
                        naodianFileURL = EEGinfo[EEGinfo.length - 1].NaodianFileURL
                    }
                    //console.log(ImageExaminationinfo)
                    //查询医学检查结果，其中的MedicalExaminationID为某一项检查的ID,MedicalExaminationdetail表中包含了详细的检查项目数值
                    sql6 = `select 
                    a.MedicalExaminationName,
                    a.MedicalExaminationType,
                    a.MedicalExaminationID,
                    a.MedicalExaminationDateTime,
                    a.HospitalName,
                    a.MedicalExaminationImage,
                    a.MedicalExaminationResult,
                    b.MedicalExaminationDetailName,
                    b.MedicalExaminationDetailResult,
                    b.MedicalExaminationDetailUnit,
                    b.MedicalExaminationDetailRangeBottom,
                    b.MedicalExaminationDetailRangeTop
                    from medicalexamination as a left join medicalexaminationdetail as b on a.MedicalExaminationID = b.MedicalExaminationID 
                    where SeekMedicalAdviceID = ${patientdiaginfo[0].SeekMedicalAdviceID}`
                    const MedicalExaminationinfo = await exec(sql6)
                    //console.log(MedicalExaminationinfo)  
                    var API_examResult = []
                    //医学检查不存在得情况
                    if (MedicalExaminationinfo.length !== 0) {
                        //处理医学检查结果和影像学检查结果的的函数，转为前端所获取的格式
                        var MedicalExaminationinfo_deal = MedicalExaminationDeal(MedicalExaminationinfo)
                        //将医学检查结果推入API_examResult
                        for (MedicalExaminationinfo_deal_count = 0; MedicalExaminationinfo_deal_count < MedicalExaminationinfo_deal.length; MedicalExaminationinfo_deal_count++) {
                            API_examResult.push(MedicalExaminationinfo_deal[MedicalExaminationinfo_deal_count])
                        }
                    }
                    //将影像学检查结果推入API_examResult
                    for (ImageExaminationinfo_count = 0; ImageExaminationinfo_count < ImageExaminationinfo.length; ImageExaminationinfo_count++) {
                        API_examResult.push(ImageExaminationinfo[ImageExaminationinfo_count])
                    }
                    //console.log(API_examResult)
                    //console.log(API_examResult)    
                    //诊断结论信息查询,如果没有信息直接返回空
                    var sql7 = `
                    select DiagnosisDescription
                    from diagnosis where SeekMedicalAdviceID = ${patientdiaginfo[0].SeekMedicalAdviceID};
                    `
                    var DiagnosisInfo = await exec(sql7)
                    var API_DiagnosisInfo = []
                    //判断诊断结论是否存在，不存在返回空
                    if (DiagnosisInfo.length !== 0) {
                        for (j = 0; j < DiagnosisInfo.length; j++) {
                            API_DiagnosisInfo.push(DiagnosisInfo[j].DiagnosisDescription)
                        }
                    } else {
                        API_DiagnosisInfo = []
                    }

                    //治疗方案查询
                    var sql8 = `
                    select TreatmentDescription as API_treatmentdescription,
                    TreatmentDateTime as API_treatmentDateTime,
                    TreatmentID
                    from treatment where SeekMedicalAdviceID = ${patientdiaginfo[0].SeekMedicalAdviceID};
                    `
                    var API_treatment = await exec(sql8)
                    //判断治疗方案的是否存在
                    var treatment = []
                    if (API_treatment.length !== 0) {
                        var sql11 = `
                            select TreamentPlanName
                            from treatment_plan_relation where TreatmentID = "${API_treatment[0].TreatmentID}"
                        `
                        var TreatmentPlanName = await exec(sql11)
                        //console.log(TreatmentPlanName)
                        for (k = 0; k < TreatmentPlanName.length; k++) {
                            treatment.push(TreatmentPlanName[k].TreamentPlanName)
                        }
                    } else {
                        var treatment = []
                    }
                    //查询治疗药物情况
                    if (API_treatment.length !== 0) {
                        var sql9 = `
                            select DrugsName as API_drugsName,
                            DrugsNumber as API_drugsNumber,
                            DrugsNumberUnits as API_drugsNumberUnits,
                            DrugsUsage as API_drugsUsage,
                            UseFrequency as API_useFrequency,
                            DrugsManufacturer as API_manufacturer,
                            DosageOfDrugsUnits as API_drugsSpecification,
                            UseTime as API_useTime
                            from treatmentdrugrelation where TreatmentID = "${API_treatment[0].TreatmentID}"
                        `
                        var Drugs = await exec(sql9)
                    } else {
                        var Drugs = []
                    }
                    // 查询患者症状
                    var sql10 = `select SymptomName from symptomrelation where SeekMedicalAdviceID = ${patientdiaginfo[0].SeekMedicalAdviceID}`
                    var API_description = await exec(sql10)
                    //查询问卷
                    var sql19 = `select a.Questionnaire,a.QuestionnaireSymptom from questionnaire_survey as a left join
                    question_relation as b on a.QuestionnaireID = b.QuestionID 
                    where b.SeekMedicalAdviceID = ${patientdiaginfo[0].SeekMedicalAdviceID} `
                    var QuestionnaireSymptom = await exec(sql19)
                    //console.log(QuestionnaireSymptom)
                    var symptomarr = []
                    //判断查询的症状是否存在，不存在返回空
                    if (API_description !== 0) {
                        for (i = 0; i < API_description.length; i++) {
                            symptomarr.push(API_description[i].SymptomName)
                        }
                    }
                    var Questionnaire = []
                    for (let QuestionnaireSymptom_i = 0; QuestionnaireSymptom_i < QuestionnaireSymptom.length; QuestionnaireSymptom_i++) {
                        Questionnaire.push(QuestionnaireSymptom[QuestionnaireSymptom_i])
                    }
                    // 查询患者历史症状,过敏史,家族史
                    var sql11 = `select FamilyHistory as API_familyHistory,
                    AllergyHistory as API_allergyHistory,
                    GerenHistory as API_GerenHistory,
                    PatientHistory as API_patientHistory from patient_history 
                    where UserID = "${patientdiaginfo[0].PatientID}"`
                    var API_history = await exec(sql11)
                    //console.log(API_history)
                    if (API_history.length == 0) {
                        API_history[0] = {
                            "API_familyHistory": "",
                            "API_allergyHistory": "",
                            "API_patientHistory": "",
                            "API_GerenHistory":""
                        }
                    }
                    var API_after = JSON.parse(patientdiaginfo[0].RecommendAfter)
                    
                    let DementiaResult
                    if(!!patientdiaginfo[0].DementiaResult){
                        console.log(patientdiaginfo[0].DementiaResult)
                        let dementiaResult = patientdiaginfo[0].DementiaResult.split(',')
                        DementiaResult = {
                            '正常': Math.floor(dementiaResult[0] * 100000) / 1000 + "%",
                            '轻度认知障碍': Math.floor(dementiaResult[1] * 100000) / 1000 + "%",
                            '痴呆症': Math.floor(dementiaResult[2] * 100000) / 1000 + "%",
                        }
                        console.log(dementiaResult)
                    }else{
                        DementiaResult = {
                            '正常': 0,
                            '轻度认知障碍':  0,
                            '痴呆症': 0
                        }
                    }
                    let DementiaSeverityResult
                    if(!!patientdiaginfo[0].DementiaSeverityResult){
                        let dementiaSeverityResult = patientdiaginfo[0].DementiaSeverityResult.split(',')
                        DementiaSeverityResult = {
                            '正常': Math.floor(dementiaSeverityResult[0] * 100000) / 1000 + "%",
                            '非常轻微痴呆': Math.floor(dementiaSeverityResult[1] * 100000) / 1000 + "%",
                            '轻度痴呆': Math.floor(dementiaSeverityResult[2] * 100000) / 1000 + "%",
                            '中度痴呆': Math.floor(dementiaSeverityResult[3] * 100000) / 1000 + "%",
                        }
                    }else{
                        DementiaSeverityResult = {
                            '正常': 0,
                            '非常轻微痴呆': 0,
                            '轻度痴呆': 0,
                            '中度痴呆': 0
                        }
                    }
                    res.json({
                        API_basicInfo: patientinfo[0],
                        API_state: patientdiaginfo[0].SeekMedicalAdviceStatus,
                        API_isGroupConsultation: patientdiaginfo[0].IsGroupConsultation,
                        API_IsGroupConsultationState: patientdiaginfo[0].IsGroupConsultationState,
                        API_illState: {
                            API_description: symptomarr,
                            API_questionnaire: Questionnaire,
                            API_audio: Audio,
                            API_video: Video,
                        },
                        API_history: API_history[0],
                        API_examResult: API_examResult,
                        API_diagInfo: {
                            //诊断结论
                            API_diagResult: API_DiagnosisInfo,
                            //脑电的结果
                            naodianFileURL,
                            NaodianResult: patientdiaginfo[0].NaodianResult,
                            //痴呆的结果
                            DementiaResult ,
                            DementiaSeverityResult,
                            //治疗方案
                            API_treatment: {
                                API_description: treatment,
                                API_prescription: Drugs //处方
                            },
                            // 推荐医疗机构/医师/护士
                            API_after: API_after
                        }
                    })
                }
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "暂时无法显示该患者信息"
                })
            }
        }
        patientsData();
    })

//诊断患者或得出诊断结论  
router.post('/patient/:SeekMedicalAdviceID',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function patientsdiagData() {
            // 同步写法
            try {
                //处理body数据
                console.log(req.body,req.params)
                var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID
                var API_diagInfo = req.body.API_diagInfo
                var API_illState = req.body.API_illState
                let naodianResult = req.body.API_diagInfo.NaodianResult || ''
                //添加症状
                add_symptom(API_illState.API_description, SeekMedicalAdviceID, req.user.UserID)
                //添加诊断结论
                add_diagnosis(API_diagInfo.API_diagResult, SeekMedicalAdviceID, req.user.UserID)
                //添加治疗记录    
                add_Treatment(API_diagInfo.API_treatment, SeekMedicalAdviceID, req.user.UserID, '就诊治疗')

                //console.log(API_diagInfo.API_after)
                let after = API_diagInfo.API_after
                //转换未json格式直接存入数据库
                for (let after_i = 0; after_i < after.length; after_i++) {
                    after[after_i].orgName
                    after[after_i].orgId
                    let sql12 = `select Image from hospital where HospitalID = ${after[after_i].orgId}`
                    let hos_Image = await exec(sql12)
                    after[after_i]["orgImage"] = hos_Image[0].Image
                    for (let doc_i = 0; doc_i < after[after_i].doctors.length; doc_i++) {
                        let sql13 = `select Image,ResearchExperienceInfo from users
                        where UserID = '${after[after_i].doctors[doc_i].docId}'`
                        let doc_info = await exec(sql13)
                        after[after_i].doctors[doc_i]["Image"] = doc_info[0].Image
                        after[after_i].doctors[doc_i]["ResearchExperienceInfo"] = doc_info[0].ResearchExperienceInfo
                    }
                    for (let nur_i = 0; nur_i < after[after_i].nurses.length; nur_i++) {
                        let sql14 = `select Image,ResearchExperienceInfo from users
                        where UserID = '${after[after_i].nurses[nur_i].nurId}'`
                        let nur_info = await exec(sql14)
                        after[after_i].nurses[nur_i]["Image"] = nur_info[0].Image
                        after[after_i].nurses[nur_i]["ResearchExperienceInfo"] = nur_info[0].ResearchExperienceInfo
                    }
                }
                var after1 = JSON.stringify(after)
                console.log("state:", req.body.API_state)
                //推荐医生，护士，机构等信息
                var sql6 = `update seekmedicaladvice set 
                SeekMedicalAdviceStatus = "已完成",
                Symptom = "${API_illState.API_description}",
                RecommendAfter = '${after1}',
                NaodianResult = '${naodianResult}',
                SeekMedicalState = "${req.body.API_state}",
                MedicalAdviceFinishDateTime = '${moment().format('YYYY-MM-DD HH:mm:ss')}'
                where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"
                `
                await exec(sql6)
                //发送socket给患者端通知
                var sql20 = `select a.PatientID,a.FamilyID,a.MedicalAdviceApplicationDateTime,b.Name 
                from seekmedicaladvice as a left join users as b
                on a.CureDoctorID = b.UserID
                where SeekMedicalAdviceID = "${SeekMedicalAdviceID}" and PatientID is not null`
                var patientid = await exec(sql20)
                if (patientid[0].PatientID === patientid[0].FamilyID) {
                    //自己发起的
                    var res_obj = {
                        toid: patientid[0].PatientID,
                        msg: '您在' + patientid[0].MedicalAdviceApplicationDateTime + '发起的就诊，专家' + patientid[0].Name + '已给出诊断结论'
                    }
                } else {
                    //家属发起的
                    var res_obj = {
                        toid: patientid[0].PatientID,
                        msg: '您的家属' + patientid[0].FamilyID + '在' + patientid[0].MedicalAdviceApplicationDateTime + '发起的就诊，专家' + patientid[0].Name + '已给出诊断结论'
                    }
                }
                console.log(res_obj)
                socket.emit("seekmedical_end", res_obj)
                //更新挂号表的状态
                let sql21 = `update seekmedical_registered
                set SeekmedicalTempState = '就诊结束'
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
                await exec(sql21)
                res.json({
                    msg: "成功",
                    after,
                    status: 200
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "暂时无法更新该患者信息"
                })
            }
        }
        patientsdiagData();
    })

//获取症状拼音首字母
router.get('/stateoptions',
    //passport.authenticate("jwt", { session: false }), 
    (req, res) => {
        // 同步写法
        async function stateoption() {
            try {
                var stateOptions = []
                var sql = `select SymptomIndexName from symptom_index where SymptomIndexName != ""`
                var SymptomDetails = await exec(sql)
                //console.log(SymptomDetails)
                for (i = 0; i < SymptomDetails.length; i++) {
                    var obj = {}
                    //console.log(Alphabetize.getCamelChars(SymptomDetails[i].SymptomDetails))
                    obj["pinyin"] = Alphabetize.getCamelChars(SymptomDetails[i].SymptomIndexName)
                    obj["value"] = SymptomDetails[i].SymptomIndexName
                    stateOptions.push(obj)
                }
                res.json({
                    stateOptions
                })
            } catch (err) {
                res.json({
                    error: err,
                    status: 0
                })
            }
        }
        stateoption()
    })

//获取结果拼音首字母
router.get('/resultoptions',
    //passport.authenticate("jwt", { session: false }), 
    (req, res) => {
        //同步写法
        async function resultoption() {
            try {
                var resultoptions = []
                var resultoptions1 = []
                var sql = `select DiagnosisIndexName from diagnosis_index where DiagnosisIndexName != ""`
                var DiagnosisDescription = await exec(sql)
                //console.log(DiagnosisDescription)
                //数组去重
                function unique(arr) {
                    return Array.from(new Set(arr))
                }
                for (j = 0; j < DiagnosisDescription.length; j++) {
                    resultoptions.push(DiagnosisDescription[j].DiagnosisIndexName)
                }
                //console.log(resultoptions)
                resultoptions = unique(resultoptions)
                //console.log(resultoptions)
                for (i = 0; i < resultoptions.length; i++) {
                    var obj = {}
                    //console.log(Alphabetize.getCamelChars(resultoptions[i].DiagnosisIndexName))
                    obj["pinyin"] = Alphabetize.getCamelChars(resultoptions[i])
                    obj["value"] = resultoptions[i]
                    resultoptions1.push(obj)
                }
                resultoptions = resultoptions1
                res.json({
                    resultoptions1
                })
            } catch (err) {
                console.log(err)
                res.json({
                    error: err,
                    status: 0
                })
            }
        }
        resultoption()
    })


//数组去重
function unique(arr) {
    return Array.from(new Set(arr))
}
//获取治疗方案拼音首字母
router.get('/treatmentoptions',
    //passport.authenticate("jwt", { session: false }), 
    (req, res) => {
        // 同步写法
        async function treatmentOption() {
            try {
                var treatmentOptions = []
                var treatmentOptions1 = []
                var sql = `select TreatmentName from treatment_index where TreatmentName != ""`
                var TreatmentName = await exec(sql)
                //console.log(TreatmentName)

                for (j = 0; j < TreatmentName.length; j++) {
                    treatmentOptions.push(TreatmentName[j].TreatmentName)
                }
                //console.log(resultoptions)
                treatmentOptions = unique(treatmentOptions)
                //console.log(resultoptions)
                for (i = 0; i < treatmentOptions.length; i++) {
                    var obj = {}
                    //console.log(Alphabetize.getCamelChars(SymptomDetails[i].SymptomDetails))
                    obj["pinyin"] = Alphabetize.getCamelChars(treatmentOptions[i])
                    obj["value"] = treatmentOptions[i]
                    treatmentOptions1.push(obj)
                }
                treatmentOptions = treatmentOptions1
                res.json({
                    treatmentOptions
                })
            } catch (err) {
                console.log(err)
                res.json({
                    error: err,
                    status: 0
                })
            }
        }
        treatmentOption()
    })

//获取某医生的所有病历诊断结论
router.get('/diaghistory',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        // 同步写法
        async function diaghistory() {
            try {
                //
                var diagHistory = []
                var sql = `select SeekMedicalAdviceID from seekmedicaladvice where CureDoctorID = "${req.user.UserID}"`
                var SeekMedicalAdviceID = await exec(sql)
                for (i = 0; i < SeekMedicalAdviceID.length; i++) {
                    //console.log(SeekMedicalAdviceID[i].SeekMedicalAdviceID)
                    var sql1 = `select DiagnosisDescription from diagnosis where SeekMedicalAdviceID = "${SeekMedicalAdviceID[i].SeekMedicalAdviceID}" and DiagnosisDescription != ""
                    order by rand() limit 5`
                    var DiagnosisDescription = await exec(sql1)
                    //console.log(DiagnosisDescription)
                    var arr = []
                    for (j = 0; j < DiagnosisDescription.length; j++) {
                        arr.push(DiagnosisDescription[j].DiagnosisDescription)
                    }
                    if (arr.length != 0) {
                        diagHistory.push(arr)
                    }
                }
                diagHistory = diagHistory.splice(-5)
                res.json({
                    diagHistory
                })
            } catch (err) {
                console.log(err)
                res.json({
                    error: err,
                    status: 0
                })
            }
        }
        diaghistory()
    })

//获取某医生的所有治疗方案
router.get('/treathistory',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        // 同步写法
        async function treathistory() {
            try {
                //
                var treatHistory = []
                var sql = `select SeekMedicalAdviceID from seekmedicaladvice where CureDoctorID = "${req.user.UserID}"`
                var SeekMedicalAdviceID = await exec(sql)
                for (i = 0; i < SeekMedicalAdviceID.length; i++) {
                    //console.log(SeekMedicalAdviceID[i].SeekMedicalAdviceID)
                    var sql1 = `select TreatmentID from treatment where SeekMedicalAdviceID = "${SeekMedicalAdviceID[i].SeekMedicalAdviceID}" and TreatmentID != ""
                    `
                    var Treatment = await exec(sql1)
                    //排除暂时没有治疗结果的查询
                    if (Treatment.length != 0) {
                        var treatmentID = Treatment[0].TreatmentID
                        var treatment = []
                        var sql2 = `
                        select TreamentPlanName
                        from treatment_plan_relation where TreatmentID = "${treatmentID}"
                        `
                        var TreatmentPlanName = await exec(sql2)
                        //获取治疗方案构造成数组的格式
                        for (k = 0; k < TreatmentPlanName.length; k++) {
                            treatment.push(TreatmentPlanName[k].TreamentPlanName)
                        }
                        //查询该治疗方案的治疗药物
                        var sql3 = `
                        select DrugsName as API_drugsName,
                        DrugsNumber as API_drugsNumber,
                        DrugsNumberUnits as API_drugsNumberUnits,
                        DrugsUsage as API_drugsUsage,
                        UseFrequency as API_useFrequency,
                        DrugsManufacturer as API_manufacturer,
                        DosageOfDrugsUnits as API_drugsSpecification,
                        UseTime as API_useTime
                        from treatmentdrugrelation where TreatmentID = "${treatmentID}"
                        `
                        var Drugs = await exec(sql3)
                        //console.log(Drugs)
                        //console.log(treatment)
                        var obj = {}
                        //治疗方案为空的话直接忽略
                        if (treatment.length !== 0) {
                            obj["API_description"] = treatment
                            obj["API_prescription"] = Drugs
                            if (obj != "") {
                                treatHistory.push(obj)
                            }
                        }
                    }
                }
                //返回最后五个元素，代表最近五个病历
                treatHistory = treatHistory.splice(-5)
                res.json({
                    treatHistory
                })
            } catch (err) {
                console.log(err)
                res.json({
                    error: err,
                    status: 0
                })
            }
        }
        treathistory()
    })

//获取某医院医生信息
router.get('/medicalinfo',
    //passport.authenticate("jwt", { session: false }), 
    (req, res) => {
        // 同步写法
        async function medicalinfo() {
            try {
                var medicalinfo = []
                var sql = `select HospitalID,HospitalName,Image from hospital`
                //var sql2 = `select RoleID from user_role where UserID = "${UserID}"`
                var Hospital = await exec(sql)
                console.log(Hospital.length)
                //查不但医院直接返回
                if (Hospital.length == 0) {
                    res.json({
                        medicalinfo
                    })
                } else {
                    //遍历每个医院的医生
                    for (i1 = 0; i1 < Hospital.length; i1++) {
                        var obj = {}
                        var sql1 = `select 
                    a.Name,
                    a.Image,
                    a.UserID,
                    b.RoleID 
                    from users as a left join user_role as b
                    on a.UserID = b.UserID 
                    where a.HospitalID = "${Hospital[i1].HospitalID}";`
                        var User = await exec(sql1)
                        var doctors = []
                        var nurses = []
                        //遍历医生的角色，查看是护士还是医生
                        for (j = 0; j < User.length; j++) {
                            var doctorsobj = {}
                            if (User[j].RoleID == 40) {
                                doctorsobj["docId"] = User[j].UserID
                                doctorsobj["docName"] = User[j].Name
                                doctorsobj["docPic"] = User[j].Image
                                doctors.push(doctorsobj)
                            } else if (User[j].RoleID == 20) {
                                doctorsobj["nurId"] = User[j].UserID
                                doctorsobj["nurName"] = User[j].Name
                                doctorsobj["nurPic"] = User[j].Image
                                nurses.push(doctorsobj)
                            }
                        }
                        //如果该医院没有医生
                        obj["orgId"] = Hospital[i1].HospitalID
                        obj["orgName"] = Hospital[i1].HospitalName
                        obj["orgPic"] = Hospital[i1].Image
                        obj["doctors"] = doctors
                        obj["nurses"] = nurses
                        medicalinfo.push(obj)
                    }
                }
                res.json({
                    medicalinfo
                })
            } catch (err) {
                console.log(err)
                res.json({
                    error: err,
                    status: 0
                })
            }
        }
        medicalinfo()
    })


//获取专家团队专家信息
router.get('/medicalinfo/expert_hospital',
    //passport.authenticate("jwt", { session: false }), 
    (req, res) => {
        // 同步写法
        async function expert_hospital() {
            try {
                var sql = `select ExpertID,ExpertName as groupName,ExpertImage as groupPic from expert_team`
                var ExpertID = await exec(sql)
                var groupInfo = []
                for (ExpertID_i in ExpertID) {
                    let obj = {}
                    var sql2 = `select a.UserID as expId,b.Name as expName,b.Image as expPic
                from expert_user as a left join users as b
                on a.UserID = b.UserID where a.ExpertID = '${ExpertID[ExpertID_i].ExpertID}'`
                    var User_info = await exec(sql2)
                    obj["groupName"] = ExpertID[ExpertID_i].groupName
                    obj["groupPic"] = ExpertID[ExpertID_i].groupPic
                    obj["experts"] = User_info
                    groupInfo.push(obj)
                }
                res.json({
                    groupInfo,
                    status: 200
                })
            } catch (err) {
                console.log(err)
                res.json({
                    error: err,
                    status: 0
                })
            }
        }
        expert_hospital()
    })

//药品
router.post('/durgsearch',
    //passport.authenticate("jwt", { session: false }), 
    (req, res) => {
        //console.log(req.user)
        // 同步写法
        // {
        //     name:"曲马多",//名称
        //     page:"1",//第几页
        // }
        async function durgsearch() {
            try {
                //console.log(req.body)
                //console.log(JSON.parse(req.body))
                const num = 3;
                //console.log(req.body.name)
                var p = /[a-z]/i; var b = p.test(req.body.name)
                //console.log(b)
                if (b) {
                    var sql = `select Drug_Registration_Name as name,
                 Drug_Registration_Specifications as specification,
                 Drug_List_Dosage_Form as type,
                 Pic,
                 Approval_Number as approvalNumber,
                 Production_Units as manufacturer,
                 Drug_Code as standardCode
                 from drugs where Mnemonic_Code like "%${req.body.name}%" and Drugs_delete = '1'
                 limit ${(req.body.page - 1) * num},${num};`
                    var sql1 = `select count(drugsID) as maxNum
                 from drugs where Mnemonic_Code like "%${req.body.name}%" and Drugs_delete = '1'
                 `
                } else {
                    var sql = `select Drug_Registration_Name as name,
                 Drug_Registration_Specifications as specification,
                 Drug_List_Dosage_Form as type,
                 Pic,
                 Approval_Number as approvalNumber,
                 Production_Units as manufacturer,
                 Drug_Code as standardCode
                 from drugs where Drug_Registration_Name like "%${req.body.name}%" and Drugs_delete = '1'
                 limit ${(req.body.page - 1) * num},${num};`
                    var sql1 = `select count(drugsID) as maxNum
                 from drugs where Drug_Registration_Name like "%${req.body.name}%" and Drugs_delete = '1'
                 `
                }
                let data = await exec(sql)
                let maxNum = await exec(sql1)
                //console.log(maxNum)
                res.json({
                    data,
                    maxNum: maxNum[0].maxNum,
                    status: 200
                })
            } catch (err) {
                console.log(err)
                res.json({
                    error: err,
                    status: 0
                })
            }
        }
        durgsearch()
    })



//获取某医生的所有治疗方案
router.post('/prescriptionhistory',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        // 同步写法
        async function treathistory() {
            try {
                let page = req.body.page
                //查询治疗药物
                var sql3 = `
                    select DrugsName as API_drugsName,
                    treatmentdrugrelation.DrugsNumber as API_drugsNumber,
                    treatmentdrugrelation.DrugsNumberUnits as API_drugsNumberUnits,
                    treatmentdrugrelation.DrugsManufacturer as API_manufacturer,
                    treatmentdrugrelation.DrugsUsage as API_drugsUsage,
                    treatmentdrugrelation.UseFrequency as API_useFrequency,
                    treatmentdrugrelation.UseTime as API_useTime,
                    treatmentdrugrelation.DosageOfDrugsUnits as API_drugsSpecification,
                    treatmentdrugrelation.treatmentID as API_treatmentID,
                    treatment.TreatmentDescription,
                    treatment.treatmentID,
                    treatment.SeekMedicalAdviceID
                    from treatmentdrugrelation left join treatment
                    on treatmentdrugrelation.treatmentID = treatment.treatmentID
                    order by API_treatmentID desc
                    `
                let Drugs = await exec(sql3)
                //console.log(Drugs)
                let prescriptionHistory = []
                let treatmentID_arr = []
                let Drugs_obj = {}
                for (let Drugs_i = 0; Drugs_i < Drugs.length; Drugs_i++) {
                    var drugsobj = {
                        TreatmentDescription: "",
                        DiagnosisDescription: "",
                        prescription: []
                    }
                    //如果该治疗ID已经存在了
                    if (treatmentID_arr.includes(Drugs[Drugs_i].treatmentID)) {
                        Drugs_obj[Drugs[Drugs_i].treatmentID]["prescription"].push({
                            API_drugsName: Drugs[Drugs_i].API_drugsName,
                            API_drugsNumber: Drugs[Drugs_i].API_drugsNumber,
                            API_drugsNumberUnits: Drugs[Drugs_i].API_drugsNumberUnits,
                            API_drugsUsage: Drugs[Drugs_i].API_drugsUsage,
                            API_useFrequency: Drugs[Drugs_i].API_useFrequency,
                            API_useTime: Drugs[Drugs_i].API_useTime,
                            API_manufacturer: Drugs[Drugs_i].API_manufacturer,
                            API_drugsSpecification: Drugs[Drugs_i].API_drugsSpecification
                        })
                    } else {
                        let sql = `select DiagnosisDescription from diagnosis 
                        where SeekMedicalAdviceID = ${Drugs[Drugs_i].SeekMedicalAdviceID}`
                        let DiagnosisDescription = await exec(sql)
                        let DiagnosisDescription_arr = []
                        for (DiagnosisDescription_i = 0; DiagnosisDescription_i < DiagnosisDescription.length; DiagnosisDescription_i++) {
                            DiagnosisDescription_arr.push(DiagnosisDescription[DiagnosisDescription_i].DiagnosisDescription)
                        }
                        drugsobj["DiagnosisDescription"] = DiagnosisDescription_arr
                        drugsobj["TreatmentDescription"] = Drugs[Drugs_i].TreatmentDescription
                        drugsobj["prescription"].push({
                            API_drugsName: Drugs[Drugs_i].API_drugsName,
                            API_drugsNumber: Drugs[Drugs_i].API_drugsNumber,
                            API_drugsNumberUnits: Drugs[Drugs_i].API_drugsNumberUnits,
                            API_drugsUsage: Drugs[Drugs_i].API_drugsUsage,
                            API_useFrequency: Drugs[Drugs_i].API_useFrequency,
                            API_useTime: Drugs[Drugs_i].API_useTime,
                            API_manufacturer: Drugs[Drugs_i].API_manufacturer,
                            API_drugsSpecification: Drugs[Drugs_i].API_drugsSpecification
                        })
                        Drugs_obj[Drugs[Drugs_i].treatmentID] = drugsobj
                        treatmentID_arr.push(Drugs[Drugs_i].treatmentID)
                    }
                    prescriptionHistory.push(Drugs_obj[Drugs[Drugs_i].treatmentID])
                }
                //console.log(prescriptionHistory.slice(1*page-1,1*page+2))   
                Maxnum = prescriptionHistory.length
                prescriptionHistory = prescriptionHistory.slice(1 * page - 1, 1 * page + 4),
                    res.json({
                        prescriptionHistory,
                        Maxnum
                    })
            } catch (err) {
                console.log(err)
                res.json({
                    error: err,
                    status: 0
                })
            }
        }
        treathistory()
    })


//转诊申请
router.post('/referral',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        // 同步写法
        async function referral() {
            /**
             *  {
             *  "pid":123,
                "reason": "理由1",
                "person": {
                    "groups": [
                        {
                            "groupName": "2",
                            "groupPic": "2",
                            "experts": [
                                {
                                    "expId": "101001",
                                    "expName": "4xm"
                                    "expPic": "2",
                                },
                                {
                                    "expId": "101002",
                                    "expName": "5xm"
                                    "expPic": "2",
                                }
                            ]
                        }
                    ]
                }
            }
             */
            try {
                let reason = req.body.reason
                let person = req.body.person
                let sql = `insert into seekmedical_referral 
                (SeekMedicalAdviceID,BeforeUserID,ReferralReason,ReferralState,ReferralDoctors) 
                values 
                ('${req.body.pid}','${req.user.UserID}','${reason}','等待患者确认','${JSON.stringify(person)}')`
                exec(sql)
                //通知患者转诊信息
                let sql1 = `select a.PatientID,b.Name
                from seekmedicaladvice as a left join users as b
                on a.CureDoctorID = b.UserID
                where SeekMedicalAdviceID = '${req.body.pid}'`
                let seekMedicalAdviceInfo = await exec(sql1)
                //console.log(seekMedicalAdviceInfo)
                let referral_message = {
                    fromid: req.user.UserID,
                    toid: seekMedicalAdviceInfo[0].PatientID,
                    msg: '医生' + seekMedicalAdviceInfo[0].Name + '为您的就诊号为' + req.body.pid + '重新推荐了医生'
                }
                socket.emit('referral_message', referral_message)
                res.json({
                    msg: '转诊消息发送成功,等待患者确认',
                    status: 200
                })
            } catch (err) {
                console.log(err)
                res.json({
                    error: err,
                    status: 0
                })
            }
        }
        referral()
    })

//转诊状态获取
// router.get('/referral_state/:referralID', 
// passport.authenticate("jwt", { session: false }), 
// (req, res) => {    
//         // 同步写法
//         async function referral_state() {
//             try{

//                 let sql = `select ReferralState from seekmedical_referral
//                 where ReferralID = '${req.params.referralID}';`
//                 let referralState = await exec(sql)
//                 if(referralState.length === 0){
//                     res.json({
//                         msg:'查不到转诊信息'
//                     })
//                 }else if(referralState[0].ReferralState === '已同意'){
//                     res.json({
//                         msg:'患者已同意'
//                     })
//                 }else if(referralState[0].ReferralState === '已拒绝'){
//                     res.json({
//                         msg:'患者已拒绝'
//                     })
//                 }

//                 }catch(err) {
//                     console.log(err)
//                     res.json({
//                         error:err,
//                         status:0
//                     })
//                 } 
//             }     
//             referral_state()        
// })

//专家团队讨论列表
router.get('/discussionpatients',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function todaypatientsData() {
            // 同步写法
            try {
                //从专家团队里面查当前用户所在的专家团队
                let sql = `select ExpertID from expert_user where UserID = "${req.user.UserID}";`
                let expert_info = await exec(sql)
                console.log(expert_info)
                if (expert_info.length === 0) {
                    return res.json({
                        status: 0,
                        msg: "所查的用户不存在于专家团队中"
                    })
                }
                //当前患者里面返回所有就诊的 未完成
                var sql1 = `
              select 
              distinct a.SeekMedicalAdviceID as pid,
              a.SeekMedicalAdviceStatus as API_state,
              a.PatientName as API_name,
              a.MedicalAdviceApplicationDateTime as API_date,
              a.Symptom as API_symptom,
              a.CureDoctorID as expertID,
              e.Name as expertName,
              c.ReferralState as referralState
              from seekmedicaladvice as a left join seekmedical_tempdoctor as b
              on b.SeekMedicalAdviceID = a.SeekMedicalAdviceID
              left join seekmedical_referral as c
              on a.SeekMedicalAdviceID = c.SeekMedicalAdviceID and a.CureDoctorID = c.BeforeUserID
              left join expert_user as d
              on d.UserID = a.CureDoctorID
              left join users as e
              on a.CureDoctorID = e.UserID
              where  d.ExpertID = "${expert_info[0].ExpertID}" and a.SeekMedicalAdviceStatus = "未完成"
              order by MedicalAdviceApplicationDateTime desc;
              `
                var seekmedicaladvicedata = await exec(sql1)
                //console.log(seekmedicaladvicedata)
                res.json({
                    status: 200,
                    seekmedicaladvicedata
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "暂时无法显示"
                })
            }
        }
        todaypatientsData();
    })

//提交就诊讨论意见（专家）
router.post('/discussion/:SeekMedicalAdviceID',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function discussion() {
            try {
                //处理输入的数据
                var pid = req.params.SeekMedicalAdviceID
                var content = req.body.content
                //插入讨论的内容
                var sql = `insert into expert_user_discuss 
                (SeekMedicalAdviceID,DoctorID,Content,DateTime)
                values
                ('${pid}','${req.user.UserID}','${content}','${moment().format('YYYY-MM-DD HH:mm:ss')}');`
                await exec(sql)
                res.json({
                    status: 200,
                    msg: "创建成功"
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "失败，服务器报错",
                    err
                })
            }
        }
        discussion();
    })

//获取一次就诊的讨论内容
router.get('/discussion/:SeekMedicalAdviceID',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function discussion() {
            try {
                //处理输入的数据
                var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID
                var sql1 = `select 
                a.Content,
                a.DoctorID,
                b.Name,
                b.Image,
                DateTime as contentDateTime
                from expert_user_discuss as a left join users as b
                on a.DoctorID = b.UserID
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}'`
                let discussion = await exec(sql1)
                res.json({
                    status: 200,
                    discussion
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "失败，服务器报错",
                    err
                })
            }
        }
        discussion();
    })

//获取此时就诊里包含的会诊的状态
router.get('/getputonghuizhenstate/:SeekMedicalAdviceID',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function getputonghuizhenstate() {
            try {
                //处理输入的数据
                var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID
                var sql1 = `select 
                GroupConsutationStatus,
                GroupConsutationType,
                GroupConsultationStartDateTime,
                GroupConsultationEndDateTime
                from groupconsultation
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}'
                `
                let discussion = await exec(sql1)
                //查询是否在转诊过程中
                var sql2 = `select ReferralState
                from seekmedical_referral
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}'
                `
                let referralState = await exec(sql2)
                //console.log(SeekMedicalAdviceID,referralState)
                if (referralState.length === 0) {
                    var referral_State = 0
                } else {
                    var referral_State = 1
                }
                let state = 0
                //如果没有会议，则直接返回
                if (discussion.length === 0) {
                    return res.json({
                        status: 200,
                        huizhenState: state,
                        referralState: referral_State

                    })
                }
                if (
                    //视频会诊等待患者确认
                    discussion[discussion.length - 1].GroupConsutationStatus === '等待患者确认'
                    &&
                    discussion[discussion.length - 1].GroupConsutationType === '视频会诊'
                ) {
                    state = 5
                } else if (
                    //患者已经同意但是主持人还没确认
                    discussion[discussion.length - 1].GroupConsutationStatus === '待确认'
                    &&
                    discussion[discussion.length - 1].GroupConsutationType === '视频会诊'
                ) {
                    state = 6
                } else if (
                    //主持人确认了某次视频会诊，但是还没到开始视频会诊的时间
                    discussion[discussion.length - 1].GroupConsutationStatus === '未开始'
                    &&
                    discussion[discussion.length - 1].GroupConsutationType === '视频会诊'
                ) {
                    state = 7
                } else if (
                    //视频会议过程中
                    discussion[discussion.length - 1].GroupConsutationStatus === '会诊中'
                    &&
                    discussion[discussion.length - 1].GroupConsutationType === '视频会诊'
                ) {
                    state = 8
                } else if (
                    //会议已经结束了但是还没到结束时间，处于待总结状态
                    discussion[discussion.length - 1].GroupConsutationStatus === '待总结'
                    &&
                    discussion[discussion.length - 1].GroupConsutationType === '视频会诊'
                ) {
                    state = 9
                } else if (
                    //视频会诊已结束
                    discussion[discussion.length - 1].GroupConsutationStatus === '会诊已结束'
                    &&
                    discussion[discussion.length - 1].GroupConsutationType === '视频会诊'
                ) {
                    state = 10
                } else if (
                    //医生发起等待患者同意此次会诊的过程
                    discussion[discussion.length - 1].GroupConsutationStatus === '等待患者确认'
                    &&
                    discussion[discussion.length - 1].GroupConsutationType === '普通会诊'
                ) {
                    state = 1
                } else if (
                    //患者已经同意了直接进入会诊中
                    discussion[discussion.length - 1].GroupConsutationStatus === '会诊中'
                    &&
                    discussion[discussion.length - 1].GroupConsutationType === '普通会诊'
                ) {
                    state = 2
                } else if (
                    //普通会诊时间已经结束，但是还未总结
                    discussion[discussion.length - 1].GroupConsutationStatus === '待总结'
                    &&
                    discussion[discussion.length - 1].GroupConsutationType === '普通会诊'
                ) {
                    state = 3
                } else if (
                    //患者已经同意但是主持人还没确认
                    discussion[discussion.length - 1].GroupConsutationStatus === '会诊已结束'
                    &&
                    discussion[discussion.length - 1].GroupConsutationType === '普通会诊'
                ) {
                    state = 4
                }

                res.json({
                    status: 200,
                    huizhenState: state,
                    referralState: referral_State
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "失败，服务器报错",
                    err
                })
            }
        }
        getputonghuizhenstate();
    })

//设置挂号限额
router.post('/guahaonumber',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function guahaonumber() {
            try {
                //这个接口是为了限制挂号的数量，默认是所有的号都被允许（数据库设计的最多的是50个号）
                /*req.body:{
                    limitNumber:30        //限制此日期的挂号数0~50
                } */
                //查询该天的专家挂号详情
                if (req.body.limitNumber > 50 || req.body.limitNumber < 0) {
                    return res.json({
                        msg: '设置的挂号限额不满足要求,请设置0-50的挂号数字',
                        status: 0
                    })
                }
                let sql = `update users set 
                SeekmedicalNumber = ${req.body.limitNumber}
                where UserID = '${req.user.UserID}';
                `
                await exec(sql)
                // //删除当天的专家挂号记录表，重新插入新的专家表
                // let sql = `delete from seekmedical_number where 
                // ExpertID = '${req.user.UserID}'
                // and Date = '${req.body.Date}'`
                // await exec(sql)
                // //锁定不用的挂号
                // let start_number = req.body.limitNumber+1
                // let end_number = 50
                // let SQLstr = ''
                // let SQLstr1 = ''
                // while (start_number <= end_number) {
                //     let tempstr = ',' + 'Number' + start_number
                //     SQLstr += tempstr
                //     SQLstr1 += ', -1'
                //     start_number ++ 
                // }
                // let sql1 = `insert into seekmedical_number 
                // (ExpertID,Date ${SQLstr}) 
                // values
                // ('${req.user.UserID}','${req.body.Date}'${SQLstr1});`
                // await exec(sql1)
                res.json({
                    status: 200,
                    mgs: '设置成功'
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "失败，服务器报错",
                    err
                })
            }
        }
        guahaonumber();
    })

//提交挂号到表单
router.post('/submit_seekmedical_number',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function submit_seekmedical_number() {
            try {
                /*req.body:{
                    PatientID:18370662607       //想挂号的患者ID
                    Date:2021-04-21       //时间 （YYYY-MM-DD格式）
                    pid:1234              //就诊号
                } */
                //先查询该天的专家号被挂了多少号，比如某天已经挂了15个号，返回15
                let sql = `select 
                count(SeekMedicalAdviceID) as subscribeCount
                from seekmedical_registered 
                where 
                ExpertID = '${req.user.UserID}'
                and SeekmedicalDateTime = '${req.body.Date}'
                ;`
                let subscribeCount = await exec(sql)
                console.log(subscribeCount)
                //当天挂号数到达了上限50个
                if (subscribeCount[0].subscribeCount >= 50) {
                    return res.json({
                        msg: '当日的挂号数已经达到上限数50，无法进行挂号',
                        status: 0
                    })
                }
                //查询当天的挂号数是否还能被挂，比如上面已经已经挂了15个号，查询第16个号能否被挂
                let tempstr = 'Number' + (subscribeCount[0].subscribeCount + 1)
                let sql1 = `select
                ${tempstr} as subscribeState
                from seekmedical_number 
                where 
                ExpertID = '${req.user.UserID}'
                and Date = '${req.body.Date}'
                ;`
                let subscribeState = await exec(sql1)
                console.log(subscribeState)
                //如果subscribeState的状态为1，代表已经号已经被挂，
                //如果状态为-1，代表此号不能被挂，
                //如果状态为0，代表此号可挂 ， 
                //subscribeState为空数组的情况为未创建当日日程表
                if (subscribeState.length === 0) {
                    let sql2 = `insert into seekmedical_number
                    (   
                        ExpertID,
                        Date,
                        ${tempstr}
                    ) 
                        values 
                    (
                        '${req.user.UserID}',
                        '${req.body.Date}',
                        1
                    );`
                    await exec(sql2)
                } else if (subscribeState[0].subscribeState === 1) {
                    return res.json({
                        msg: '相同的就诊号当日已经存在,请勿重复挂号，更换新的就诊号',
                        status: 0
                    })
                } else if (subscribeState[0].subscribeState === -1) {
                    return res.json({
                        msg: '当日的挂号数已经达到上限数' + subscribeCount[0].subscribeCount + '请重新设置挂号限额',
                        status: 0
                    })
                } else {
                    //更新挂号表的状态
                    let sql3 = `update seekmedical_number set 
                    ${tempstr} = 1
                    where 
                    ExpertID = '${req.user.UserID}'
                    and Date = '${req.body.Date}'
                    ;`
                    await exec(sql3)
                }
                //说明此号可以被用户订阅，将患者所挂的号插入挂号就诊表
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
                    '${req.user.UserID}',
                    '${req.body.Date}',
                    '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                    '${subscribeCount[0].subscribeCount + 1}',
                    '${req.body.PatientID}',
                    '等待就诊',
                    '${req.body.pid}'
                );`
                await exec(sql4)
                res.json({
                    status: 200,
                    msg: "提交成功"
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "服务器出现错误"
                })
            }
        }
        submit_seekmedical_number();
    })


//查询今日待诊患者（包含之前未诊断的患者）
router.get('/todaydaizhen',
    passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function todaydaizhen() {
            // 同步写法
            try {
                //查询今日患者内容
                //当前患者里面返回所有就诊的 未完成、申请中，今天完成的
                var sql1 = `
              select 
              distinct c.SeekMedicalAdviceID as pid,
              a.SeekMedicalAdviceStatus as API_state,
              a.PatientName as API_name,
              a.ApplySeekMedicalDateTime as API_date,
              a.Symptom as API_symptom,
              c.SubscribeDateTime as API_guahaoDate,
              c.PatinetID as API_patientID,
              c.SeekmedicalNumber as API_number
              from seekmedical_registered as c left join seekmedicaladvice as a 
              on c.SeekMedicalAdviceID = a.SeekMedicalAdviceID
              where
              c.ExpertID = "${req.user.UserID}"
              and 
              ((c.SeekmedicalTempState = '等待就诊' and c.SeekmedicalDateTime <= "${moment().format('YYYY-MM-DD')}")
              or (c.SeekmedicalTempState = '就诊结束' and c.SeekmedicalDateTime >= "${moment().format('YYYY-MM-DD')}"))
              order by c.SubscribeDateTime desc ;
              `
                var seekmedicaladvicedata = await exec(sql1)
                res.json({
                    status: 200,
                    seekmedicaladvicedata
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "暂时无法显示"
                })
            }
        }
        todaydaizhen();
    })

//拒绝此次就诊中的会诊
router.get('/jujuehuizhen/:SeekMedicalAdviceID',
    //passport.authenticate("jwt", { session: false }),
    (req, res) => {
        async function jujuehuizhen() {
            try {
                //处理输入的数据
                var SeekMedicalAdviceID = req.params.SeekMedicalAdviceID
                var sql1 = `update seekmedicaladvice 
                set IsGroupConsultationState = '已拒绝'
                where SeekMedicalAdviceID = '${SeekMedicalAdviceID}'
                `
                await exec(sql1)
                res.json({
                    status: 200,
                    msg: '成功'
                })
            } catch (err) {
                console.log(err)
                res.json({
                    status: 0,
                    msg: "失败，服务器报错",
                    err
                })
            }
        }
        jujuehuizhen();
    })





module.exports = router;