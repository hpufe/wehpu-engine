var cheerio = require('cheerio')
var util = require('../common/util')

// 请求资源配置
var agentConfig = {
  commonHeader: {
    Host: 'vpn.hpu.edu.cn',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:55.0) Gecko/20100101 Firefox/55.0',
    Connection: 'Keep-Alive'
  }
}

// cheerio配置
var cheerioConfig = {
  // True 屏蔽urp不规范源码
  xmlMode: true,
  decodeEntities: true,
  lowerCaseTags: true,
  lowerCaseAttributeNames: true,
  ignoreWhitespace: true
}

/**
 * @param  {*} val 待处理教室编号
 */
function getFlag (val) {
  if (Number.isNaN(parseInt(val))) {
    return val.charAt(0)
  } else {
    var roomNum = parseInt(val).toString()
    if (roomNum.length === 3) {
      return roomNum.charAt(0)
    } else if (roomNum.length === 4) {
      return roomNum.charAt(1)
    } else if (roomNum.length === 0) {
      return val
    } else {
      return val.charAt(0)
    }
  }
}

/**
 * @param  {Array} arr 待处理数组
 * @param  {Array} res 结果数组
 */
function sortRooms (arr, res) {
  // 相同元素
  var same = []
  // 不同元素
  var diff = []
  var length = arr.length

  // 以第一个元素为标志
  same.push(arr[0])

  // 筛选
  for (var i = 1; i < length; i++) {
    if (getFlag(arr[i].room) === getFlag(same[0].room)) {
      same.push(arr[i])
    } else {
      diff.push(arr[i])
    }
  }

  // 返回结果
  res.push(same)

  // 递归
  if (diff.length) {
    sortRooms(diff, res)
  }
}

/**
 * 数组去重
 * @param {Array} arr 原始数组
 * @param {String} flag 匹配标志
 */
// function unique (arr, flag) {
//   var hash = {}
//   var temp = []
//   for (let i = 0; i < arr.length; i++) {
//     var key = flag ? arr[i][flag] : arr[i]
//     if (!hash[key]) {
//       hash[key] = true
//       temp.push(arr[i])
//     }
//   }
//   return temp
// }

/**
 * 处理空教室
 * @param {Object} params
 * @return {Promise} 处理结果
 */
exports.classroom = function (params) {
  return new Promise((resolve, reject) => {
    var agent = params.agent
    // 结果
    var classrooms = []

    // 获取当前学期
    Promise
      .resolve(util.getCalendar())
      .then(calendar => {
        params.currentTerm = calendar.currentTerm
      })
      .then(() => {
        // 必要的试探性请求
        return agent.post('https://vpn.hpu.edu.cn/web/1/http/2/218.196.240.97/xszxcxAction.do?oper=xszxcx_lb')
          .set(agentConfig.commonHeader)
          .set({
            Referer: 'https://vpn.hpu.edu.cn/web/1/http/1/218.196.240.97/loginAction.do'
          })
          .type('form')
          .send({
            'zxxnxq': params.currentTerm,
            'zxXaq': '01'
          })
      })
      // 发起请求
      .then(() => {
        return agent.post('https://vpn.hpu.edu.cn/web/1/http/2/218.196.240.97/xszxcxAction.do?oper=tjcx')
          .set(agentConfig.commonHeader)
          .set({
            Referer: 'https://vpn.hpu.edu.cn/web/1/http/2/218.196.240.97/xszxcxAction.do?oper=ld&xqh=01&jxlh=18'
          })
          .type('form')
          .send({
            'zxxnxq': params.currentTerm,
            'zxXaq': '01',
            'zxJxl': params.building,
            'zxZc': params.weekly,
            'zxxq': params.week,
            'zxJc': params.section,
            'pageSize': '100',
            'page': '1',
            'currentPage': '1'
          })
          .charset('gbk')
      })
      // 处理空教室
      .then(urpContent => {
        // console.log(urpContent);

        // 处理空教室信息
        var $ = cheerio.load(urpContent.text, cheerioConfig)

        // step1 获取包含空教室的<table>块
        var userElem = $('#user').html()

        // 获取教室列表
        var _$ = cheerio.load(userElem, cheerioConfig)
        _$('tr')
          .filter((i, elem) => {
            return $(elem).attr('class') === 'even' || $(elem).attr('class') === 'odd'
          })
          .each((i, elem) => {
            var q = $(elem).children('td')

            classrooms.push({
              // 教学楼
              building: q.eq(2).text().trim(),
              // 教室
              room: q.eq(3).text().replace('(多)', '').trim(),
              // 教室容量
              volume: q.eq(5).text().trim()
            })
          })

        if (classrooms.length > 0) {
          var sorted = []
          sortRooms(classrooms, sorted)
          resolve(sorted)
        } else {
          reject(new Error('处理空教室出错'))
        }
      })
      .catch(err => {
        reject(err)
      })
  })
}
