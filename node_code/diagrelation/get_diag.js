var express = require('express');
var app = express();
var router = express.Router();
const {exec} = require('../db/config.js');
const passport = require('passport');
const query = require('../db/mysql.js');
var moment = require('moment');
//获取本地时区
moment.locale('zh-cn');
//获取字符串拼音
const Alphabetize = require('chinese-alphabetize')
//转换时间格式函数
const formatDate = require('../time/formatetime.js');

/**
 * 获取某次就诊的病情概况
 * @param {症状描述，专业的名词描述症状,是一个数组}
 * return API_description 
 * @param {就诊ID} SeekMedicalAdviceID 
 */
async function get_symptom(SeekMedicalAdviceID) {
    let API_description = []
    let sql = `select symptomName from symptomrelation where SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
    let description = await exec(sql)
    for(let description_i=0;description_i<description.length;description_i++){
        API_description.push(description[description_i].symptomName)
    }
    return API_description
}

diagnosis (DiagnosisDescription,DiagnosisDateTime,SeekMedicalAdviceID,DoctorID)

async function get_diagnosis(SeekMedicalAdviceID) {
    let API_description = []
    let sql = `select DiagnosisDescription,DoctorID from symptomrelation where SeekMedicalAdviceID = '${SeekMedicalAdviceID}';`
    let diagnosis = await exec(sql)
    for(let description_i=0;description_i<description.length;description_i++){
        API_description.push(description[description_i].symptomName)
    }
    return API_description
}