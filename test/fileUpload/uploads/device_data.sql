/*
SQLyog Professional v12.08 (32 bit)
MySQL - 5.7.29 : Database - device_data
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`device_data` /*!40100 DEFAULT CHARACTER SET utf8 */;

USE `device_data`;

/*Table structure for table `blood_pressure` */

DROP TABLE IF EXISTS `blood_pressure`;

CREATE TABLE `blood_pressure` (
  `blood_pressure_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '穿戴式设备血压数据',
  `phone` varchar(50) DEFAULT NULL COMMENT '电话号码(通过那个电话号码申请的数据)',
  `SeekMedicalAdviceID` int(11) DEFAULT NULL COMMENT '对应就诊号，对应是那个患者的数据',
  `pulse` int(11) DEFAULT NULL COMMENT '脉搏',
  `sbp` int(11) DEFAULT NULL COMMENT '收缩压(高压)mmHg',
  `dbp` int(11) DEFAULT NULL COMMENT '舒张压(低压)',
  `dateTime` datetime DEFAULT NULL COMMENT '采集血压时间',
  PRIMARY KEY (`blood_pressure_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `blood_pressure` */

/*Table structure for table `eeg_data` */

DROP TABLE IF EXISTS `eeg_data`;

CREATE TABLE `eeg_data` (
  `eeg_data_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'EEG数据采集',
  `phone` varchar(50) DEFAULT NULL COMMENT '电话号码(通过那个电话号码申请的数据)',
  `SeekMedicalAdviceID` int(11) DEFAULT NULL COMMENT '对应就诊号，对应是那个患者的数据',
  `data` varchar(100) DEFAULT NULL COMMENT 'EGG数据["0.6","1.2","0.9","0.8","0.8" ,"1.2","1.1","0.5"]',
  `type` int(11) DEFAULT NULL COMMENT '值为几就是几通道',
  `datetime` datetime DEFAULT NULL COMMENT '数据采集日期',
  PRIMARY KEY (`eeg_data_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf32;

/*Data for the table `eeg_data` */

/*Table structure for table `gps` */

DROP TABLE IF EXISTS `gps`;

CREATE TABLE `gps` (
  `gps_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '获取用户的gps位置',
  `phone` varchar(50) DEFAULT NULL COMMENT '电话号码(通过那个电话号码申请的数据)',
  `SeekMedicalAdviceID` int(11) DEFAULT NULL COMMENT '对应就诊号，对应是那个患者的数据',
  `longitude` float DEFAULT NULL COMMENT '经度',
  `latitude` float DEFAULT NULL COMMENT '纬度',
  `datetime` datetime DEFAULT NULL COMMENT '采集时间',
  PRIMARY KEY (`gps_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `gps` */

/*Table structure for table `wearable_device` */

DROP TABLE IF EXISTS `wearable_device`;

CREATE TABLE `wearable_device` (
  `wearable_device_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '穿戴式设备数据采集(血糖，胆固醇,智慧衣)',
  `phone` varchar(50) DEFAULT NULL COMMENT '电话号码(通过那个电话号码申请的数据)',
  `SeekMedicalAdviceID` int(11) DEFAULT NULL COMMENT '对应就诊号，对应是那个患者的数据',
  `data` float DEFAULT NULL COMMENT '对应血糖或胆固醇，单位mmol/L，或温度℃',
  `type` int(11) DEFAULT NULL COMMENT '类别(1代表血糖，2代表胆固醇，3代表智慧衣)',
  `datetime` datetime DEFAULT NULL COMMENT '采集数据的时间',
  PRIMARY KEY (`wearable_device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `wearable_device` */

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
