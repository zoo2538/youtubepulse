import { createClient } from '@supabase/supabase-js';

// Supabase 설정
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

const DATE_RANGE_DAYS = 14;

// 데이터베이스 서비스 클래스
export class SupabaseService {
  // 채널 데이터 저장
  async saveChannels(channels: any[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('channels')
        .upsert(channels, { onConflict: 'channel_id' });
      
      if (error) throw error;
      console.log('✅ 채널 데이터 저장 완료:', channels.length);
    } catch (error) {
      console.error('❌ 채널 데이터 저장 실패:', error);
      throw error;
    }
  }

  // 비디오 데이터 저장
  async saveVideos(videos: any[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('videos')
        .upsert(videos, { onConflict: 'video_id' });
      
      if (error) throw error;
      console.log('✅ 비디오 데이터 저장 완료:', videos.length);
    } catch (error) {
      console.error('❌ 비디오 데이터 저장 실패:', error);
      throw error;
    }
  }

  // 일별 통계 저장
  async saveDailyStats(stats: any[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('daily_stats')
        .insert(stats);
      
      if (error) throw error;
      console.log('✅ 일별 통계 저장 완료:', stats.length);
    } catch (error) {
      console.error('❌ 일별 통계 저장 실패:', error);
      throw error;
    }
  }

  // 카테고리 저장
  async saveCategories(categories: Record<string, string[]>): Promise<void> {
    try {
      // 기존 카테고리 삭제
      await supabase.from('categories').delete().neq('id', 0);
      
      // 새 카테고리 저장
      const categoryEntries = Object.entries(categories).map(([name, subCategories]) => ({
        category_name: name,
        sub_categories: subCategories
      }));

      const { error } = await supabase
        .from('categories')
        .insert(categoryEntries);
      
      if (error) throw error;
      console.log('✅ 카테고리 저장 완료');
    } catch (error) {
      console.error('❌ 카테고리 저장 실패:', error);
      throw error;
    }
  }

  // 카테고리 로드
  async loadCategories(): Promise<Record<string, string[]> | null> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*');
      
      if (error) throw error;
      
      if (!data || data.length === 0) return null;
      
      const categories: Record<string, string[]> = {};
      data.forEach(item => {
        categories[item.category_name] = item.sub_categories;
      });
      
      console.log('✅ 카테고리 로드 완료:', categories);
      return categories;
    } catch (error) {
      console.error('❌ 카테고리 로드 실패:', error);
      return null;
    }
  }

  // 분류된 데이터 로드
  async loadClassifiedData(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .not('category', 'is', null)
        .not('sub_category', 'is', null);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ 분류된 데이터 로드 실패:', error);
      return [];
    }
  }

  // 미분류 데이터 로드
  async loadUnclassifiedData(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .or('category.is.null,sub_category.is.null');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ 미분류 데이터 로드 실패:', error);
      return [];
    }
  }

  // 오래된 데이터 정리 (DATE_RANGE_DAYS일 이상)
  async cleanupOldData(retentionDays: number = DATE_RANGE_DAYS): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const { error: videosError } = await supabase
        .from('videos')
        .delete()
        .lt('collected_at', cutoffDate.toISOString());
      
      const { error: statsError } = await supabase
        .from('daily_stats')
        .delete()
        .lt('created_at', cutoffDate.toISOString());
      
      if (videosError) throw videosError;
      if (statsError) throw statsError;
      
      console.log(`✅ ${retentionDays}일 이상 된 데이터 정리 완료`);
      return 0; // 삭제된 개수는 별도로 계산 필요
    } catch (error) {
      console.error('❌ 데이터 정리 실패:', error);
      return 0;
    }
  }

  // 실시간 구독 (카테고리 변경 감지)
  subscribeToCategories(callback: (categories: Record<string, string[]>) => void) {
    return supabase
      .channel('categories')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'categories' },
        async () => {
          const categories = await this.loadCategories();
          if (categories) callback(categories);
        }
      )
      .subscribe();
  }
}

export const supabaseService = new SupabaseService();
