// src/lib/db-migrator.js

import pg from 'pg';

const { Pool } = pg;



export async function runDatabaseMigrations() {
  // DATABASE_URL이 없으면 마이그레이션 스킵
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL이 설정되지 않아 마이그레이션을 스킵합니다.');
    return;
  }

  // DATABASE_URL 처리 (server.js와 동일한 로직)
  let databaseUrl = process.env.DATABASE_URL;
  
  // SSL 설정 처리
  if (databaseUrl.includes('sslmode=require')) {
    databaseUrl = databaseUrl.replace('sslmode=require', 'sslmode=disable');
  } else if (!databaseUrl.includes('sslmode=')) {
    databaseUrl = databaseUrl + '?sslmode=disable';
  }
  
  // 강제로 sslmode=disable 적용
  if (databaseUrl.includes('sslmode=')) {
    databaseUrl = databaseUrl.replace(/sslmode=[^&]*/, 'sslmode=disable');
  } else {
    databaseUrl = databaseUrl + '?sslmode=disable';
  }

  const pool = new Pool({
    connectionString: databaseUrl
  });



  const client = await pool.connect();

  

  try {

    console.log('🔄 데이터베이스 스키마 점검 및 업데이트 시작...');



    // 1. 테이블이 없으면 생성

    await client.query(`

      CREATE TABLE IF NOT EXISTS video_ai_insights (

        video_id VARCHAR(50) PRIMARY KEY,

        summary TEXT,

        viral_reason TEXT,

        clickbait_score INTEGER,

        keywords TEXT[],

        sentiment VARCHAR(20),

        created_at TIMESTAMP DEFAULT NOW()

      );

    `);



    // 2. 새로운 컬럼들 추가 (없을 때만)

    const newColumns = [

      { name: 'target_audience', type: 'TEXT' },

      { name: 'intro_hook', type: 'TEXT' },

      { name: 'plot_structure', type: 'TEXT' },

      { name: 'emotional_trigger', type: 'TEXT' }

    ];



    for (const column of newColumns) {

      // 컬럼 존재 여부 확인

      const columnExists = await client.query(`

        SELECT column_name 

        FROM information_schema.columns 

        WHERE table_name = 'video_ai_insights' 

        AND column_name = $1;

      `, [column.name]);



      if (columnExists.rows.length === 0) {

        // 컬럼이 없으면 추가

        await client.query(`

          ALTER TABLE video_ai_insights 

          ADD COLUMN ${column.name} ${column.type};

        `);

        console.log(`✅ 컬럼 추가: ${column.name}`);

      } else {

        console.log(`ℹ️  컬럼 이미 존재: ${column.name}`);

      }

    }



    console.log('🎉 데이터베이스 마이그레이션 완료!');

  } catch (error) {

    console.error('❌ 데이터베이스 마이그레이션 실패:', error);

    throw error;

  } finally {

    client.release();

    await pool.end();

  }

}

