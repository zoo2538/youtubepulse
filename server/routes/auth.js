import express from 'express';
import { authService } from '../services/auth-service.js';

const router = express.Router();

// 사용자 등록
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: '이메일, 비밀번호, 이름이 필요합니다.'
      });
    }

    const result = await authService.register({ email, password, name });
    
    res.json({
      success: true,
      data: result,
      message: '회원가입이 완료되었습니다.'
    });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({
      success: false,
      message: '회원가입 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '이메일과 비밀번호가 필요합니다.'
      });
    }

    const result = await authService.login({ email, password });
    
    res.json({
      success: true,
      data: result,
      message: '로그인이 완료되었습니다.'
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그인 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 토큰 검증
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: '토큰이 필요합니다.'
      });
    }

    const result = await authService.verifyToken(token);
    
    res.json({
      success: true,
      data: result,
      message: '토큰이 유효합니다.'
    });
  } catch (error) {
    console.error('토큰 검증 오류:', error);
    res.status(500).json({
      success: false,
      message: '토큰 검증 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 비밀번호 변경
router.post('/change-password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '이메일, 현재 비밀번호, 새 비밀번호가 필요합니다.'
      });
    }

    const result = await authService.changePassword({ email, currentPassword, newPassword });
    
    res.json({
      success: true,
      data: result,
      message: '비밀번호가 변경되었습니다.'
    });
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 변경 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 비밀번호 재설정 요청
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: '이메일이 필요합니다.'
      });
    }

    const result = await authService.forgotPassword(email);
    
    res.json({
      success: true,
      data: result,
      message: '비밀번호 재설정 이메일을 발송했습니다.'
    });
  } catch (error) {
    console.error('비밀번호 재설정 요청 오류:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 재설정 요청 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자 정보 조회
router.get('/profile', async (req, res) => {
  try {
    const { token } = req.headers;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 필요합니다.'
      });
    }

    const result = await authService.getUserProfile(token);
    
    res.json({
      success: true,
      data: result,
      message: '사용자 정보를 조회했습니다.'
    });
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 정보 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자 정보 업데이트
router.put('/profile', async (req, res) => {
  try {
    const { token } = req.headers;
    const { name, email } = req.body;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 필요합니다.'
      });
    }

    const result = await authService.updateUserProfile(token, { name, email });
    
    res.json({
      success: true,
      data: result,
      message: '사용자 정보를 업데이트했습니다.'
    });
  } catch (error) {
    console.error('사용자 정보 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 정보 업데이트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 로그아웃
router.post('/logout', async (req, res) => {
  try {
    const { token } = req.headers;
    
    if (token) {
      await authService.logout(token);
    }
    
    res.json({
      success: true,
      message: '로그아웃이 완료되었습니다.'
    });
  } catch (error) {
    console.error('로그아웃 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그아웃 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
