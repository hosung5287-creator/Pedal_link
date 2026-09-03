import { api, API_BASE } from './client';

export async function getChatHistory(roomId) {
  return api.get(`/api/chat/${roomId}/history`);
}

// sockjs-client 는 Node 의 global 객체를 참조해서 Vite(브라우저) 환경에서 그대로 쓰면
// 모듈 로드 시점에 죽어버린다(백엔드도 IE 폴백이 필요 없어 .withSockJS() 의 raw websocket
// 트랜스포트만 바로 사용). http(s) -> ws(s) 로 바꾸고 /websocket 을 붙여서 SockJS 를 거치지 않는다.
export const WS_URL = `${API_BASE.replace(/^http/, 'ws')}/ws/websocket`;
