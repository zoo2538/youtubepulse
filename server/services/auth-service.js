// 인증 서비스 (데스크탑 앱과 동일한 기능)
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    
    // 메모리 기반 사용자 저장소 (실제로는 데이터베이스 사용)
    this.users = new Map();
    this.sessions = new Map();
    
    // 기본 관리자 계정 생성
    this.createDefaultAdmin();
  }

  // 기본 관리자 계정 생성
  async createDefaultAdmin() {
    const adminEmail = 'ju9511503@gmail.com';
    const adminPassword = 'admin123';
    
    if (!this.users.has(adminEmail)) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      this.users.set(adminEmail, {
        id: 'admin_001',
        email: adminEmail,
        password: hashedPassword,
        name: '관리자',
        role: 'admin',
        createdAt: new Date().toISOString(),
        lastLogin: null
      });
      
      console.log('✅ 기본 관리자 계정 생성 완료');
    }
  }

  // 사용자 등록
  async register({ email, password, name }) {
    try {
      // 이메일 중복 확인
      if (this.users.has(email)) {
        throw new Error('이미 존재하는 이메일입니다.');
      }

      // 비밀번호 해시화
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // 사용자 생성
      const user = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email,
        password: hashedPassword,
        name,
        role: 'user',
        createdAt: new Date().toISOString(),
        lastLogin: null
      };
      
      this.users.set(email, user);
      
      console.log(`✅ 사용자 등록 완료: ${email}`);
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt
      };
    } catch (error) {
      console.error('사용자 등록 오류:', error);
      throw error;
    }
  }

  // 사용자 로그인
  async login({ email, password }) {
    try {
      // 사용자 존재 확인
      const user = this.users.get(email);
      if (!user) {
        throw new Error('존재하지 않는 이메일입니다.');
      }

      // 비밀번호 확인
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('비밀번호가 일치하지 않습니다.');
      }

      // JWT 토큰 생성
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role 
        },
        this.jwtSecret,
        { expiresIn: this.jwtExpiresIn }
      );

      // 로그인 시간 업데이트
      user.lastLogin = new Date().toISOString();
      this.users.set(email, user);

      // 세션 저장
      this.sessions.set(token, {
        userId: user.id,
        email: user.email,
        role: user.role,
        loginTime: new Date().toISOString()
      });

      console.log(`✅ 로그인 성공: ${email}`);
      
      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          lastLogin: user.lastLogin
        }
      };
    } catch (error) {
      console.error('로그인 오류:', error);
      throw error;
    }
  }

  // 토큰 검증
  async verifyToken(token) {
    try {
      // 세션 확인
      const session = this.sessions.get(token);
      if (!session) {
        throw new Error('유효하지 않은 토큰입니다.');
      }

      // JWT 토큰 검증
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // 사용자 정보 조회
      const user = this.users.get(decoded.email);
      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      };
    } catch (error) {
      console.error('토큰 검증 오류:', error);
      throw error;
    }
  }

  // 비밀번호 변경
  async changePassword({ email, currentPassword, newPassword }) {
    try {
      // 사용자 존재 확인
      const user = this.users.get(email);
      if (!user) {
        throw new Error('존재하지 않는 이메일입니다.');
      }

      // 현재 비밀번호 확인
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('현재 비밀번호가 일치하지 않습니다.');
      }

      // 새 비밀번호 해시화
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      // 비밀번호 업데이트
      user.password = hashedNewPassword;
      this.users.set(email, user);

      console.log(`✅ 비밀번호 변경 완료: ${email}`);
      
      return {
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.'
      };
    } catch (error) {
      console.error('비밀번호 변경 오류:', error);
      throw error;
    }
  }

  // 비밀번호 재설정 요청
  async forgotPassword(email) {
    try {
      // 사용자 존재 확인
      const user = this.users.get(email);
      if (!user) {
        // 보안을 위해 존재하지 않는 이메일이어도 성공 메시지 반환
        return {
          success: true,
          message: '비밀번호 재설정 이메일을 발송했습니다.'
        };
      }

      // 실제로는 이메일 발송 로직이 필요하지만, 여기서는 시뮬레이션
      console.log(`📧 비밀번호 재설정 이메일 발송: ${email}`);
      
      return {
        success: true,
        message: '비밀번호 재설정 이메일을 발송했습니다.'
      };
    } catch (error) {
      console.error('비밀번호 재설정 요청 오류:', error);
      throw error;
    }
  }

  // 사용자 정보 조회
  async getUserProfile(token) {
    try {
      const verification = await this.verifyToken(token);
      
      return {
        id: verification.user.id,
        email: verification.user.email,
        name: verification.user.name,
        role: verification.user.role
      };
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error);
      throw error;
    }
  }

  // 사용자 정보 업데이트
  async updateUserProfile(token, { name, email }) {
    try {
      const verification = await this.verifyToken(token);
      const user = this.users.get(verification.user.email);
      
      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      // 정보 업데이트
      if (name) user.name = name;
      if (email && email !== user.email) {
        // 이메일 변경 시 중복 확인
        if (this.users.has(email)) {
          throw new Error('이미 존재하는 이메일입니다.');
        }
        
        // 기존 이메일로 저장된 사용자 삭제
        this.users.delete(user.email);
        
        // 새 이메일로 저장
        user.email = email;
        this.users.set(email, user);
      }

      console.log(`✅ 사용자 정보 업데이트 완료: ${user.email}`);
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };
    } catch (error) {
      console.error('사용자 정보 업데이트 오류:', error);
      throw error;
    }
  }

  // 로그아웃
  async logout(token) {
    try {
      // 세션에서 토큰 제거
      this.sessions.delete(token);
      
      console.log('✅ 로그아웃 완료');
      
      return {
        success: true,
        message: '로그아웃이 완료되었습니다.'
      };
    } catch (error) {
      console.error('로그아웃 오류:', error);
      throw error;
    }
  }

  // 모든 사용자 조회 (관리자용)
  async getAllUsers() {
    try {
      const users = Array.from(this.users.values()).map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }));
      
      return users;
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error);
      throw error;
    }
  }

  // 사용자 삭제 (관리자용)
  async deleteUser(email) {
    try {
      if (!this.users.has(email)) {
        throw new Error('존재하지 않는 사용자입니다.');
      }

      this.users.delete(email);
      
      console.log(`✅ 사용자 삭제 완료: ${email}`);
      
      return {
        success: true,
        message: '사용자가 삭제되었습니다.'
      };
    } catch (error) {
      console.error('사용자 삭제 오류:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
