import '../styles/chat.css';

import { useEffect, useRef, useState } from 'react';

import BrandLogo from '../components/BrandLogo';
import { useChat } from '../hooks/useChat';
import { displayTime } from '../utils/chat';

export default function ChatPage({ user, partyId, onMoveHome, onMoveParty, onOpenMap, onMoveBrowse }) {
  const { messages, connected, historyError, sendMessage } = useChat(partyId, user);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chatPage">
      <nav className="navbar chatNav" aria-label="메뉴">
        <a className="brand" href="/" onClick={onMoveHome}><BrandLogo className="brandLogo" />PedalLink</a>
        <div className="navLinks">
          <a href="/browse" onClick={onMoveBrowse}>둘러보기</a>
          <a href="/party" onClick={onMoveParty}>파티</a>
          <a href="/map" onClick={onOpenMap}>코스 만들기</a>
        </div>
      </nav>

      {!user ? (
        <div className="chatEmptyState">
          <p>채팅을 이용하려면 로그인이 필요합니다.</p>
        </div>
      ) : !partyId ? (
        <div className="chatEmptyState">
          <p>채팅방을 열 파티를 먼저 선택해주세요.</p>
          <a className="partyPrimaryBtn" href="/party" onClick={onMoveParty}>파티 목록으로</a>
        </div>
      ) : (
        <main className="chatLayout">
          <header className="chatHeader">
            <h1>파티 채팅방 <span className="chatRoomId">#{partyId}</span></h1>
            <span className={`chatStatus ${connected ? 'isOn' : 'isOff'}`}>
              {connected ? '● 연결됨' : '○ 연결 중…'}
            </span>
          </header>

          {historyError && <p className="chatError">{historyError}</p>}

          <div className="chatMessages">
            {messages.length === 0 && <p className="chatEmpty">아직 메시지가 없습니다. 첫 메시지를 보내보세요!</p>}
            {messages.map((msg, i) => {
              const mine = msg.senderId === user.id;
              return (
                <div key={msg.id ?? i} className={`chatBubbleRow ${mine ? 'isMine' : ''}`}>
                  <div className="chatBubble">
                    {!mine && <div className="chatSender">{msg.senderName}</div>}
                    {msg.type === 'CODE' ? (
                      <pre className="chatCode"><code>{msg.content.replace(/```[\w]*\n?/, '').replace(/```$/, '')}</code></pre>
                    ) : (
                      <p className="chatContent">{msg.content}</p>
                    )}
                    <div className="chatTime">{displayTime(msg)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="chatInputRow">
            <textarea
              className="chatInput"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요… (```로 시작하면 코드 블록)"
              rows={2}
            />
            <button type="button" className="chatSendBtn" onClick={send} disabled={!connected || !input.trim()}>
              전송
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
