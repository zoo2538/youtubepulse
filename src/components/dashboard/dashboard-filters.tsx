import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { subCategories, categoryColors } from "@/lib/subcategories";

// 하드코딩된 카테고리 순서 사용 (subcategories.ts에서)
const categories = Object.keys(subCategories);

export function DashboardFilters() {
  // 동적 카테고리 로드 제거 - 항상 subcategories.ts 순서 사용
  useEffect(() => {
    console.log('📊 하드코딩된 카테고리 순서 사용:', categories);
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
            <div className="grid grid-cols-9 gap-2">
              {categories.map((category) => (
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