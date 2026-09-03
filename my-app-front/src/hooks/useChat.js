import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { getChatHistory, WS_URL } from '../api/chat';

// 파티 채팅 하나를 붙이는 훅 — 채팅 전용 페이지와 파티 도크의 미니 채팅 탭이 함께 쓴다.
// 히스토리(REST) 로드 + WebSocket 구독/발행을 한 곳에서 관리한다.
export function useChat(roomId, user) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const clientRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    setMessages([]);
    setHistoryError('');

    getChatHistory(roomId)
      .then((history) => { if (alive) setMessages(history || []); })
      .catch(() => { if (alive) setHistoryError('이전 대화 내역을 불러오지 못했습니다.'); });

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 3000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/chat/${roomId}`, (frame) => {
          const msg = JSON.parse(frame.body);
          setMessages((prev) => [...prev, msg]);
        });
      },
      onDisconnect: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
    });
    client.activate();
    clientRef.current = client;

    return () => {
      alive = false;
      client.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, [roomId]);

  const sendMessage = (content) => {
    const trimmed = content.trim();
    if (!trimmed || !clientRef.current?.connected || !user) return;
    clientRef.current.publish({
      destination: `/app/chat/${roomId}/send`,
      body: JSON.stringify({
        senderId: user.id,
        senderName: user.name,
        content: trimmed,
        type: trimmed.startsWith('```') ? 'CODE' : 'TEXT',
      }),
    });
  };

  return { messages, connected, historyError, sendMessage };
}
