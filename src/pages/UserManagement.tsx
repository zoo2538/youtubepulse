import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Mail
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive' | 'pending';
  joinDate: string;
  lastLogin: string;
}

const UserManagement = () => {
  const { isLoggedIn } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isAdmin, setIsAdmin] = useState(false);

  // 관리자 권한 확인
  useEffect(() => {
    const checkAdminStatus = () => {
      const userEmail = localStorage.getItem('userEmail');
      const isAdminUser = userEmail === 'ju9511503@gmail.com';
      setIsAdmin(isAdminUser);
    };

    checkAdminStatus();
  }, []);

  // 목업 사용자 데이터
  useEffect(() => {
    const mockUsers: User[] = [
      {
        id: "1",
        name: "관리자",
        email: "ju9511503@gmail.com",
        role: "admin",
        status: "active",
        joinDate: "2025-01-01",
        lastLogin: "2025-01-10"
      },
      {
        id: "2",
        name: "김유저",
        email: "user1@example.com",
        role: "user",
        status: "active",
        joinDate: "2025-01-05",
        lastLogin: "2025-01-09"
      },
      {
        id: "3",
        name: "이사용자",
        email: "user2@example.com",
        role: "user",
        status: "pending",
        joinDate: "2025-01-08",
        lastLogin: "2025-01-08"
      },
      {
        id: "4",
        name: "박테스터",
        email: "user3@example.com",
        role: "user",
        status: "inactive",
        joinDate: "2025-01-03",
        lastLogin: "2025-01-05"
      }
    ];
    setUsers(mockUsers);
    setFilteredUsers(mockUsers);
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

  const handleStatusChange = (userId: string, newStatus: User['status']) => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, status: newStatus } : user
    ));
  };

  const handleRoleChange = (userId: string, newRole: User['role']) => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, role: newRole } : user
    ));
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
                <Link to="/dashboard">
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                    대시보드로 돌아가기
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
            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="bg-transparent border-white/30 text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                대시보드로 돌아가기
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
      </div>
    </div>
  );
};

export default UserManagement;

