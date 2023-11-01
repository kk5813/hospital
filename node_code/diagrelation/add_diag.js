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

//添加病情描述
/**
 * 
 * @param {症状描述，专业的名词描述症状,是一个数组} API_description 
 * @param {就诊ID} SeekMedicalAdviceID 
 * @param {专家ID} ExpertID 
 */
async function add_symptom(API_description,SeekMedicalAdviceID,ExpertID) {
    //先删除原有的该疾病的描述
    let sql1 = `delete from symptomrelation where SeekMedicalAdviceID = "${SeekMedicalAdviceID}"`
    await exec(sql1)
    //插入新的疾病描述
    for(i=0;i<API_description.length;i++){
        //将症状插入数据库
        let sql2 = `insert into symptomrelation 
        (symptomName,SeekMedicalAdviceID,ExpertID)
        values 
        ("${API_description[i]}","${SeekMedicalAdviceID}","${ExpertID}")
        `
        await exec(sql2)
    }
}


//添加诊断结论
/**
 * 
 * @param {诊断结论，以数组的形式存在，遍历数组插入诊断结论到数据库} API_diagResult 
 * @param {就诊ID} SeekMedicalAdviceID 
 * @param {专家ID} ExpertID 
 */
async function add_diagnosis(API_diagResult,SeekMedicalAdviceID,ExpertID) {
    //删除原有的诊断结论
    let sql3 = `delete from diagnosis where SeekMedicalAdviceID = "${SeekMedicalAdviceID}";`
    await exec(sql3)
    //插入诊断结果数组
    for(let i=0;i<API_diagResult.length;i++){
        let sql4 = `insert into diagnosis (DiagnosisDescription,DiagnosisDateTime,SeekMedicalAdviceID,DoctorID) values
        ("${API_diagResult[i]}","${moment().format('YYYY-MM-DD HH:mm:ss')}","${SeekMedicalAdviceID}","${ExpertID}")`
        await exec(sql4)
    }
}

/**
 * 添加处方
 * @param {治疗记录ID} treatmentID 
 * @param {处方，数组 } API_prescription 
 * {
 *      API_drugsName: "含曲林片",
        API_drugsNumberUnits: "盒",
        API_drugsNumber: "2",
        API_drugsUsage: "一次两粒",
        API_useFrequency: "一天一次",
        API_useTime: "饭后",
        API_isEditable: false,
        API_days: "7"
 * }
 */
async function add_Prescription(treatmentID,API_prescription){
    //更新所有药物信息
    let sql3 = `
    delete from treatmentdrugrelation where TreatmentID = "${treatmentID}" 
    `
    await exec(sql3)
    for(i=0;i<API_prescription.length;i++){
            //将药物直接插入数据库
            let sql4 = `insert into treatmentdrugrelation 
            (DrugsName,TreatmentID,DrugsNumber,DrugsNumberUnits,DrugsUsage,UseFrequency,UseTime,DosageOfDrugsUnits,DrugsManufacturer)
            values 
            ("${API_prescription[i].API_drugsName}","${treatmentID}",
            "${API_prescription[i].API_drugsNumber}","${API_prescription[i].API_drugsNumberUnits}",
            "${API_prescription[i].API_drugsUsage}","${API_prescription[i].API_useFrequency}",
            "${API_prescription[i].API_useTime}","${API_prescription[i].API_drugsSpecification}","${API_prescription[i].API_manufacturer}")
            `
            await exec(sql4)
    }
}



//添加治疗方案
/**
 * 
 * @param {治疗方案} API_treatment = {
 * API_description:治疗方案
 * API_prescription:药物详情
 * }
 * @param {就诊ID} SeekMedicalAdviceID 
 * @param {给出治疗方案的医生} UserID 
 * @param {治疗方案给出时的状态：就诊治疗，入院前治疗，住院时治疗，住院后治疗} seekMedicalState 
 */
async function add_Treatment(API_treatment,SeekMedicalAdviceID,UserID,seekMedicalState) {
    let sql = `insert into treatment 
        (TreatmentDescription,TreatmentDateTime,SeekMedicalAdviceID,DoctorID,TreatmentPhase) 
        values
        ("${API_treatment.API_description}","${moment().format('YYYY-MM-DD HH:mm:ss')}","${SeekMedicalAdviceID}","${UserID}",'${seekMedicalState}') `
    let Treatment = await exec(sql)
    //将治疗方案详情插入数据库的treatment_plan_relation
    let sql1 = `
    delete from treatment_plan_relation where TreatmentID = "${Treatment.insertId}" 
    `
    await exec(sql1)
    //治疗方案详情
    let API_description = API_treatment.API_description
    for(i=0;i<API_description.length;i++){
        //将治疗方案插入数据库
        let sql2 = `insert into treatment_plan_relation 
        (TreamentPlanName,TreatmentID,TreatmentDate,DoctorID)
        values 
        ("${API_description[i]}","${Treatment.insertId}","${moment().format('YYYY-MM-DD HH:mm:ss')}","${UserID}")
        `
        await exec(sql2)
    }
    let API_prescription = API_treatment.API_prescription
    add_Prescription(Treatment.insertId,API_prescription)
}


/**
 * 
 * @param {治疗方案} API_treatment = {
 * API_prescription:药物方案
 * API_treatment:治疗方案详情
 * API_patientState:患者状态
 * }
 * @param {就诊ID} SeekMedicalAdviceID 
 * @param {给出治疗方案的医生} UserID 
 * @param {治疗方案给出时的状态：就诊治疗，入院前治疗，住院时治疗，住院后治疗} seekMedicalState 
 */
async function add_DoctorTreatment(API_Treatment,SeekMedicalAdviceID,UserID,seekMedicalState) {
    let API_prescription = API_Treatment.API_prescription
    let API_treatment = API_Treatment.API_treatment
    let sql = `insert into treatment 
        (TreatmentDescription,TreatmentResults,TreatmentDateTime,SeekMedicalAdviceID,DoctorID,TreatmentPhase) 
        values
        ("${API_Treatment.API_treatment}","${API_Treatment.API_patientState}","${moment().format('YYYY-MM-DD HH:mm:ss')}","${SeekMedicalAdviceID}","${UserID}",'${seekMedicalState}') `
    let Treatment = await exec(sql)
    //将治疗方案详情插入数据库的treatment_plan_relation
    let sql1 = `
    delete from treatment_plan_relation where TreatmentID = "${Treatment.insertId}" 
    `
    await exec(sql1)
    //治疗方案详情
    for(i=0;i<API_treatment.length;i++){
        //将治疗方案插入数据库
        let sql2 = `insert into treatment_plan_relation 
        (TreamentPlanName,TreatmentID,TreatmentDate,DoctorID)
        values 
        ("${API_treatment[i]}","${Treatment.insertId}","${moment().format('YYYY-MM-DD HH:mm:ss')}","${UserID}")
        `
        await exec(sql2)
    }
    add_Prescription(Treatment.insertId,API_prescription)
}





module.exports = {
    add_symptom,
    add_diagnosis,
    add_Treatment,
    add_DoctorTreatment,
    add_Prescription
}