import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    // 백엔드 WebConfig 의 CORS 허용 오리진이 http://localhost:3000 하드코딩이라
    // Vite 기본 포트(5173) 대신 3000 을 그대로 쓴다. 포트가 막혀 있으면 조용히
    // 다른 포트로 넘어가지 않도록 strictPort 로 실패시킨다.
    port: 3000,
    strictPort: true,

    // cloudflared 터널로 외부에 공개할 때 필요하다.
    // Vite 는 모르는 Host 헤더로 들어온 요청을 막는데(DNS 리바인딩 방어),
    // 터널 주소(https://xxx.trycloudflare.com)가 여기 없으면 "Blocked request" 가 뜬다.
    // CRA 의 DANGEROUSLY_DISABLE_HOST_CHECK 에 해당하지만, 도메인을 한정해서 더 안전하다.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      // 이전 CRA 의 package.json "proxy": "https://dapi.kakao.com" 를 대체한다.
      // MapPage 의 장소 검색이 자기 origin 으로 /v2/local/... 을 부른다.
      '/v2/local': {
        target: 'https://dapi.kakao.com',
        changeOrigin: true,
      },
    },
  },

  // CRA 와 같은 출력 폴더를 유지한다 (배포 스크립트·문서가 build/ 를 가리킴).
  build: { outDir: 'build' },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
  },
});
