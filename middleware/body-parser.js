/**
 * JSON 바디 파서 미들웨어
 * Express의 기본 json() 미들웨어를 래핑
 */

const express = require('express');

/**
 * JSON 바디 파싱 미들웨어
 * 크기 제한: 100MB
 */
const parseJsonBody = express.json({ limit: '100mb' });

module.exports = {
  parseJsonBody
};

