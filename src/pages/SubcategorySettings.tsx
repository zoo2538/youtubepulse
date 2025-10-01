import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Filter } from "lucide-react";
import { categories, subCategories } from "@/lib/subcategories";

const SubcategorySettings = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/system')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                시스템으로 돌아가기
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">세부카테고리 설정</h1>
                <p className="text-sm text-muted-foreground">모든 카테고리와 세부카테고리를 확인하고 관리합니다</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* 안내 메시지 */}
        <div className="p-3 mb-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 text-center">
            💡 <code className="bg-yellow-100 px-2 py-0.5 rounded font-medium">src/lib/subcategories.ts</code> 에서 수정
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="text-center">
              <p className="text-sm text-blue-600 font-medium mb-2">총 카테고리</p>
              <p className="text-4xl font-bold text-blue-900">{categories.length}</p>
              <p className="text-xs text-blue-600 mt-1">개</p>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
            <div className="text-center">
              <p className="text-sm text-green-600 font-medium mb-2">총 세부카테고리</p>
              <p className="text-4xl font-bold text-green-900">
                {Object.values(subCategories).reduce((sum, subs) => sum + subs.length, 0)}
              </p>
              <p className="text-xs text-green-600 mt-1">개</p>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="text-center">
              <p className="text-sm text-purple-600 font-medium mb-2">평균 세부카테고리</p>
              <p className="text-4xl font-bold text-purple-900">
                {Math.round(Object.values(subCategories).reduce((sum, subs) => sum + subs.length, 0) / categories.length)}
              </p>
              <p className="text-xs text-purple-600 mt-1">개 / 카테고리</p>
            </div>
          </Card>
        </div>

        {/* 세부카테고리 목록 */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Filter className="w-5 h-5 text-pink-600" />
            <h2 className="text-xl font-semibold text-foreground">전체 세부카테고리 목록</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.entries(subCategories).map(([category, subs]) => (
              <Card key={category} className="p-4 border-2 hover:border-primary/50 transition-colors">
                <div className="mb-3">
                  <h3 className="font-bold text-lg text-foreground mb-1">{category}</h3>
                  <p className="text-xs text-muted-foreground">총 {subs.length}개 세부카테고리</p>
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {subs.map((sub, index) => (
                    <div 
                      key={index} 
                      className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded hover:bg-muted transition-colors"
                    >
                      <span className="text-primary font-medium">{index + 1}.</span> {sub}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
};

export default SubcategorySettings;

