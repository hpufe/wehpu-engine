var crypto = require('crypto');
var config = require('../config');
var cheerio = require('cheerio');
var HPUUrpLogin = require('../vendor/HPUUrpLogin');
var handleClassroom = require('../common/classroom');

var User = require('../models/user');

/**
 * 查询空教室
 * @param {String} building 教学楼
 * @param {String} weekly 周次
 * @param {String} section 节次
 * @param {String} week 周
 * @param {String} [openId] 包含在token中的openId
 */
exports.classroom = function (req, res, next) {
  var openId = req.jwtPayload.openId;
  var currentTerm = req.calendar.currentTerm;

  var building = req.body.building;
  var weekly = req.body.weekly;
  var section = req.body.section;
  var week = req.body.week;

  // 检验参数
  var _section = section.split(',');
  var validator = (!!building && !!weekly && !!section && !!week) && (parseInt(building) > 0 && parseInt(building) < 19) && (parseInt(weekly) > 0 && parseInt(weekly) < 30) && (parseInt(week) > 0 && parseInt(week) < 8) && (parseInt(section) > 0 && parseInt(section) < 11);

  if (!validator) {
    res.status(400).json({
      statusCode: 400,
      errMsg: '请求格式错误'
    });
  }

  // 访问资源
  Promise.resolve(
      User.findOne({
        openId: openId
      })
    )
    .then(person => {
      if (person) {
        // 解密
        var decipher = crypto.createDecipher(
          config.commonAlgorithm,
          config.commonSecret
        );

        var userInfo = {
          studentId: person.studentId,
          vpnPassWord: decipher.update(person.vpnPassWord, 'hex', 'utf8'),
          jwcPassWord: decipher.update(person.jwcPassWord, 'hex', 'utf8')
        };

        return userInfo;
      } else {
        res.status(403).json({
          statusCode: 403,
          errMsg: '空教室查询失败'
        });
      }
    })
    .then(userInfo => {
      return Promise.resolve(HPUUrpLogin.login({
        studentId: userInfo.studentId,
        vpnPassWord: userInfo.vpnPassWord,
        jwcPassWord: userInfo.jwcPassWord,
        method: 'post'
      }))
    })
    .then(agent => {
      return Promise.resolve(handleClassroom.classroom({
        agent: agent,
        building: building,
        weekly: weekly,
        section: section,
        week: week,
        currentTerm: currentTerm
      }));
    })
    .then(classroomsRes => {
      res.status(200).json({
        statusCode: 200,
        msg: '获取空教室成功',
        data: classroomsRes
      });
    })
    .catch(err => {
      res.status(404).json({
        statusCode: 404,
        errMsg: '获取空教室失败'
      });
      // console.log(err);
    })
}