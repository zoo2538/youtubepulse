import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { subCategories, categoryColors } from "@/lib/subcategories";
import { indexedDBService } from "@/lib/indexeddb-service";

// 중앙화된 카테고리 및 색상 사용
const defaultCategories = Object.keys(subCategories);

export function DashboardFilters() {
  const [dynamicCategories, setDynamicCategories] = useState<string[]>(defaultCategories);

  // 카테고리 데이터 로드
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const savedCategories = await indexedDBService.loadCategories();
        if (savedCategories) {
          setDynamicCategories(Object.keys(savedCategories));
        }
      } catch (error) {
        console.error('📊 카테고리 로드 실패:', error);
      }
    };

    loadCategories();

    // 카테고리 업데이트 이벤트 리스너
    const handleCategoriesUpdated = () => {
      loadCategories();
    };

    window.addEventListener('categoriesUpdated', handleCategoriesUpdated);

    return () => {
      window.removeEventListener('categoriesUpdated', handleCategoriesUpdated);
    };
  }, []);

  return (
    <Card className="p-6 mb-6">
      <div className="space-y-4">
        {/* 카테고리 선택 */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              카테고리
            </label>
            <div className="grid grid-cols-8 gap-2">
              {dynamicCategories.map((category) => (
                <Link key={category} to={`/category/${encodeURIComponent(category)}`}>
                  <Badge
                    className="cursor-pointer transition-all duration-200 w-full text-center text-sm py-2 text-muted-foreground hover:text-white hover:shadow-lg"
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = categoryColors[category as keyof typeof categoryColors];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {category}
                  </Badge>
                </Link>
              ))}
            </div>
            
            {/* 카테고리 설명 */}
            <p className="text-xs text-muted-foreground mt-2">
              💡 카테고리를 클릭하면 해당 카테고리의 채널 순위를 확인할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}