import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getKoreanDateString } from "@/lib/utils";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  UserCheck, 
  UserX, 
  Shield, 
  ShieldCheck,
  ArrowLeft,
  Users,
  Calendar,
  Mail,
  Clock,
  AlertTriangle,
  Plus,
  Edit,
  X
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive' | 'pending';
  joinDate: string;
  lastLogin: string;
  startDate?: string; // 사용기간 시작일
  endDate?: string; // 사용기간 종료일
}

const UserManagement = () => {
  const { isLoggedIn, userEmail, userRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");

  // 관리자 권한 확인
  useEffect(() => {
    const checkAdminStatus = () => {
      const isAdminUser = userRole === 'admin';
      setIsAdmin(isAdminUser);
    };

    checkAdminStatus();
  }, [userRole]);

  // 사용자 데이터 로드
  useEffect(() => {
    // 기본 관리자 계정
    const defaultAdmin: User = {
      id: "admin-1",
      name: "관리자",
      email: "ju9511503@gmail.com",
      role: "admin",
      status: "active",
      joinDate: "2025-01-01",
      lastLogin: "2025-01-10",
      startDate: "2025-01-01",
      endDate: "2025-12-31"
    };

    // 로컬 스토리지에서 사용자 데이터 가져오기
    const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');
    
    // 테스트용 일반 사용자 추가 (실제 데이터가 없을 때만)
    const testPendingUser = storedUsers.length === 0 ? {
      id: "test-1",
      name: "테스트 사용자",
      email: "test@example.com",
      password: "test123",
      role: "user",
      status: "active",
      joinDate: getKoreanDateString(),
      lastLogin: "",
      startDate: getKoreanDateString(),
      endDate: (() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
      })() // 30일 후 (한국 시간)
    } : null;
    
    const allUsers = [defaultAdmin, ...storedUsers, ...(testPendingUser ? [testPendingUser] : [])];
    
    // 테스트 사용자가 있으면 localStorage에 저장
    if (testPendingUser) {
      localStorage.setItem('users', JSON.stringify([testPendingUser]));
    }
    
    setUsers(allUsers);
    setFilteredUsers(allUsers);

    // 페이지 로드 시 만료된 사용자 체크 (관리자 제외, 한국 시간 기준)
    setTimeout(() => {
      const today = getKoreanDateString();
      const updatedUsers = allUsers.map(user => {
        // 관리자는 만료 체크에서 제외
        if (user.role === 'admin') return user;
        
        if (user.endDate && user.endDate < today && user.status === 'active') {
          return { ...user, status: 'inactive' as const };
        }
        return user;
      });
      
      const hasExpired = updatedUsers.some(user => 
        user.role !== 'admin' && user.endDate && user.endDate < today && user.status === 'inactive'
      );
      
      if (hasExpired) {
        setUsers(updatedUsers);
        setFilteredUsers(updatedUsers);
        
        // 로컬 스토리지 업데이트
        const storedUsers = updatedUsers.filter(user => user.id !== 'admin-1');
        localStorage.setItem('users', JSON.stringify(storedUsers));
        
        setTimeout(() => {
          alert('만료된 사용자가 자동으로 비활성화되었습니다.');
        }, 100);
      }
    }, 100);
  }, []);

  // 필터링 로직
  useEffect(() => {
    let filtered = users;

    // 검색어 필터링
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 상태 필터링
    if (statusFilter !== "all") {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    // 역할 필터링
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, statusFilter, roleFilter]);

  const handleRoleChange = (userId: string, newRole: User['role']) => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, role: newRole } : user
    ));
  };

  const handleStatusChange = (userId: string, newStatus: 'active' | 'inactive' | 'pending') => {
    const updatedUsers = users.map(user => 
      user.id === userId ? { ...user, status: newStatus } : user
    );
    setUsers(updatedUsers);
    setFilteredUsers(updatedUsers);
    
    // 로컬 스토리지 업데이트
    const storedUsers = updatedUsers.filter(user => user.id !== 'admin-1');
    localStorage.setItem('users', JSON.stringify(storedUsers));
  };

  const handleApproveUser = (userId: string) => {
    console.log(`✅ 사용자 승인: ${userId}`);
    handleStatusChange(userId, 'active');
  };

  const handleRejectUser = (userId: string) => {
    console.log(`❌ 사용자 거부: ${userId}`);
    handleStatusChange(userId, 'inactive');
  };

  // 사용기간 설정 모달 열기
  const handleSetPeriod = (user: User) => {
    setSelectedUser(user);
    setPeriodStartDate(user.startDate || '');
    setPeriodEndDate(user.endDate || '');
    setShowPeriodModal(true);
  };

  // 사용기간 저장
  const handleSavePeriod = () => {
    if (!selectedUser) return;

    const updatedUsers = users.map(user => 
      user.id === selectedUser.id 
        ? { ...user, startDate: periodStartDate, endDate: periodEndDate }
        : user
    );
    
    setUsers(updatedUsers);
    setFilteredUsers(updatedUsers);
    
    // 로컬 스토리지 업데이트
    const storedUsers = updatedUsers.filter(user => user.id !== 'admin-1');
    localStorage.setItem('users', JSON.stringify(storedUsers));
    
    setShowPeriodModal(false);
    setSelectedUser(null);
    setPeriodStartDate('');
    setPeriodEndDate('');
  };

  // 사용기간 연장 (30일)
  const handleExtendPeriod = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user || !user.endDate) return;

    const currentEndDate = new Date(user.endDate);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + 30);

    const updatedUsers = users.map(u => 
      u.id === userId 
        ? { ...u, endDate: newEndDate.toISOString().split('T')[0] }
        : u
    );
    
    setUsers(updatedUsers);
    setFilteredUsers(updatedUsers);
    
    // 로컬 스토리지 업데이트
    const storedUsers = updatedUsers.filter(u => u.id !== 'admin-1');
    localStorage.setItem('users', JSON.stringify(storedUsers));
  };

  // 사용기간 만료 체크 (한국 시간 기준)
  const checkExpiredUsers = useCallback(() => {
    const today = getKoreanDateString();
    
    setUsers(currentUsers => {
      const updatedUsers = currentUsers.map(user => {
        // 관리자는 만료 체크에서 제외
        if (user.role === 'admin') return user;
        
        if (user.endDate && user.endDate < today && user.status === 'active') {
          return { ...user, status: 'inactive' as const };
        }
        return user;
      });
      
      const hasExpired = updatedUsers.some(user => 
        user.role !== 'admin' && user.endDate && user.endDate < today && user.status === 'inactive'
      );
      
      if (hasExpired) {
        // 로컬 스토리지 업데이트
        const storedUsers = updatedUsers.filter(user => user.id !== 'admin-1');
        localStorage.setItem('users', JSON.stringify(storedUsers));
        
        setTimeout(() => {
          alert('만료된 사용자가 자동으로 비활성화되었습니다.');
        }, 100);
      }
      
      return updatedUsers;
    });
    
    setFilteredUsers(currentFiltered => {
      const updatedFiltered = currentFiltered.map(user => {
        // 관리자는 만료 체크에서 제외
        if (user.role === 'admin') return user;
        
        if (user.endDate && user.endDate < today && user.status === 'active') {
          return { ...user, status: 'inactive' as const };
        }
        return user;
      });
      return updatedFiltered;
    });
  }, []);

  // 사용기간 상태 확인
  const getPeriodStatus = (user: User) => {
    try {
      // 관리자는 영구 사용
      if (user.role === 'admin') {
        return { status: 'permanent', message: '영구', color: 'text-purple-400' };
      }
      
      if (!user.endDate) return { status: 'none', message: '미설정', color: 'text-gray-400' };
      
      const today = new Date();
      const endDate = new Date(user.endDate);
      const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft < 0) {
        return { status: 'expired', message: '만료됨', color: 'text-red-400' };
      } else if (daysLeft <= 7) {
        return { status: 'warning', message: `${daysLeft}일 남음`, color: 'text-yellow-400' };
      } else {
        return { status: 'active', message: `${daysLeft}일 남음`, color: 'text-green-400' };
      }
    } catch (error) {
      console.error('getPeriodStatus 오류:', error);
      return { status: 'error', message: '오류', color: 'text-red-400' };
    }
  };

  const getStatusBadge = (status: User['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 text-white">활성</Badge>;
      case 'inactive':
        return <Badge className="bg-red-500 text-white">비활성</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-white">대기중</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-500 text-white">관리자</Badge>;
      case 'user':
        return <Badge className="bg-blue-500 text-white">사용자</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  // 관리자가 아닌 경우 접근 거부
  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-purple-800 flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-md border-white/20 max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Shield className="w-16 h-16 text-red-400 mx-auto" />
              <h2 className="text-2xl font-bold text-white">접근 권한 없음</h2>
              <p className="text-gray-300">
                이 페이지는 관리자만 접근할 수 있습니다.
              </p>
              <div className="pt-4 space-y-2">
                <Link to="/system">
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                    시스템으로 돌아가기
                  </Button>
                </Link>
                <Link to="/">
                  <Button variant="outline" className="w-full bg-transparent border-white/30 text-white hover:bg-white/10">
                    홈으로 돌아가기
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-purple-800 p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link to="/system">
              <Button variant="outline" size="sm" className="bg-transparent border-white/30 text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                시스템으로 돌아가기
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center">
                <Users className="w-8 h-8 mr-3" />
                회원 관리
              </h1>
              <p className="text-gray-300">사용자 계정을 관리하고 권한을 설정하세요</p>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">총 사용자</p>
                  <p className="text-2xl font-bold text-white">{users.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">활성 사용자</p>
                  <p className="text-2xl font-bold text-white">
                    {users.filter(u => u.status === 'active').length}
                  </p>
                </div>
                <UserCheck className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">대기중</p>
                  <p className="text-2xl font-bold text-white">
                    {users.filter(u => u.status === 'pending').length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">관리자</p>
                  <p className="text-2xl font-bold text-white">
                    {users.filter(u => u.role === 'admin').length}
                  </p>
                </div>
                <ShieldCheck className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">만료 예정</p>
                  <p className="text-2xl font-bold text-white">
                    {users.filter(u => {
                      if (!u.endDate) return false;
                      const today = new Date();
                      const endDate = new Date(u.endDate);
                      const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      return daysLeft <= 7 && daysLeft > 0;
                    }).length}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 필터 및 검색 */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="사용자 이름 또는 이메일로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-white/40"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    <SelectItem value="active">활성</SelectItem>
                    <SelectItem value="inactive">비활성</SelectItem>
                    <SelectItem value="pending">대기중</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="역할" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 역할</SelectItem>
                    <SelectItem value="admin">관리자</SelectItem>
                    <SelectItem value="user">사용자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 사용자 테이블 */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white">사용자 목록</CardTitle>
            <CardDescription className="text-gray-300">
              총 {filteredUsers.length}명의 사용자가 표시됩니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/20">
                    <TableHead className="text-white">사용자</TableHead>
                    <TableHead className="text-white">역할</TableHead>
                    <TableHead className="text-white">상태</TableHead>
                    <TableHead className="text-white">사용기간</TableHead>
                    <TableHead className="text-white">가입일</TableHead>
                    <TableHead className="text-white">마지막 로그인</TableHead>
                    <TableHead className="text-white">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="border-white/20 hover:bg-white/5">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {user.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-medium">{user.name}</p>
                            <p className="text-gray-400 text-sm flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(user.status)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {user.role === 'admin' ? (
                            <div className="flex items-center space-x-2">
                              <Shield className="w-3 h-3" />
                              <span className={`text-xs ${getPeriodStatus(user).color}`}>
                                {getPeriodStatus(user).message}
                              </span>
                            </div>
                          ) : user.endDate ? (
                            <div className="flex items-center space-x-2">
                              <Clock className="w-3 h-3" />
                              <span className={`text-xs ${getPeriodStatus(user).color}`}>
                                {getPeriodStatus(user).message}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">미설정</span>
                          )}
                          {user.role !== 'admin' && user.endDate && (
                            <div className="text-xs text-gray-400">
                              ~{user.endDate}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {user.joinDate}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {user.lastLogin}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.status === 'pending' && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => handleApproveUser(user.id)}
                                >
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  승인
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleRejectUser(user.id)}
                                >
                                  <UserX className="w-4 h-4 mr-2" />
                                  거부
                                </DropdownMenuItem>
                              </>
                            )}
                            {user.status !== 'pending' && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => handleStatusChange(user.id, 'active')}
                                  disabled={user.status === 'active'}
                                >
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  활성화
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleStatusChange(user.id, 'inactive')}
                                  disabled={user.status === 'inactive'}
                                >
                                  <UserX className="w-4 h-4 mr-2" />
                                  비활성화
                                </DropdownMenuItem>
                              </>
                            )}
                            {user.role !== 'admin' && (
                              <DropdownMenuItem 
                                onClick={() => handleRoleChange(user.id, 'admin')}
                              >
                                <Shield className="w-4 h-4 mr-2" />
                                관리자로 승격
                              </DropdownMenuItem>
                            )}
                            {user.role === 'admin' && user.email !== 'ju9511503@gmail.com' && (
                              <DropdownMenuItem 
                                onClick={() => handleRoleChange(user.id, 'user')}
                              >
                                <Shield className="w-4 h-4 mr-2" />
                                사용자로 변경
                              </DropdownMenuItem>
                            )}
                            {user.role !== 'admin' && (
                              <DropdownMenuItem 
                                onClick={() => handleSetPeriod(user)}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                사용기간 설정
                              </DropdownMenuItem>
                            )}
                            {user.role !== 'admin' && user.endDate && (
                              <DropdownMenuItem 
                                onClick={() => handleExtendPeriod(user.id)}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                30일 연장
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* 사용기간 설정 모달 */}
        {showPeriodModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="bg-white/10 backdrop-blur-md border-white/20 max-w-md w-full mx-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">사용기간 설정</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowPeriodModal(false)}
                    className="text-white hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <CardDescription className="text-gray-300">
                  {selectedUser.name} ({selectedUser.email})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">시작일</label>
                  <Input
                    type="date"
                    value={periodStartDate}
                    onChange={(e) => setPeriodStartDate(e.target.value)}
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">종료일</label>
                  <Input
                    type="date"
                    value={periodEndDate}
                    onChange={(e) => setPeriodEndDate(e.target.value)}
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
                {periodStartDate && periodEndDate && periodStartDate > periodEndDate && (
                  <div className="flex items-center space-x-2 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>종료일은 시작일보다 늦어야 합니다.</span>
                  </div>
                )}
                <div className="flex space-x-2 pt-4">
                  <Button 
                    onClick={handleSavePeriod}
                    disabled={!periodStartDate || !periodEndDate || periodStartDate > periodEndDate}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    저장
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPeriodModal(false)}
                    className="flex-1 bg-transparent border-white/30 text-white hover:bg-white/10"
                  >
                    취소
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;






