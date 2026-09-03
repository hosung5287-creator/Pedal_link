# Spring Boot WebSocket 채팅 구현 계획

## 기술 스택

| 구분 | 기술 |
|------|------|
| 백엔드 | Spring Boot WebSocket + STOMP |
| 프론트 | @stomp/stompjs + sockjs-client |
| DB | PostgreSQL (채팅 내역 저장) |
| 인증 | 기존 localStorage 유저 객체 재사용 |

---

## 1단계 — 백엔드 의존성 추가

`my-app-backend/build.gradle`

```groovy
implementation 'org.springframework.boot:spring-boot-starter-websocket'
```

---

## 2단계 — WebSocket 설정

`WebSocketConfig.java`

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");      // 구독 prefix
        registry.setApplicationDestinationPrefixes("/app"); // 발신 prefix
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS(); // 브라우저 호환 폴백
    }
}
```

---

## 3단계 — 채팅 엔티티

`ChatMessage.java`

```java
@Entity @Table(name = "chat_messages") @Data
public class ChatMessage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long roomId;       // 파티 ID와 연결
    private Long senderId;
    private String senderName;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String type;       // TEXT | CODE | JOIN | LEAVE

    private LocalDateTime createdAt = LocalDateTime.now();
}
```

---

## 4단계 — Repository

`ChatMessageRepository.java`

```java
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByRoomIdOrderByCreatedAtAsc(Long roomId);
}
```

---

## 5단계 — 컨트롤러

`ChatController.java`

```java
@Controller
@RequiredArgsConstructor
public class ChatController {

    private final ChatMessageRepository chatRepo;
    private final SimpMessagingTemplate messaging;

    // 메시지 수신 → DB 저장 → 방 전원 브로드캐스트
    @MessageMapping("/chat/{roomId}/send")
    public void send(@DestinationVariable Long roomId,
                     @Payload ChatMessage msg) {
        msg.setRoomId(roomId);
        msg.setCreatedAt(LocalDateTime.now());
        chatRepo.save(msg);
        messaging.convertAndSend("/topic/chat/" + roomId, msg);
    }

    // 이전 채팅 내역 조회
    @GetMapping("/api/chat/{roomId}/history")
    @ResponseBody
    public List<ChatMessage> history(@PathVariable Long roomId) {
        return chatRepo.findByRoomIdOrderByCreatedAtAsc(roomId);
    }
}
```

---

## 6단계 — 프론트 패키지 설치

```bash
npm install @stomp/stompjs sockjs-client highlight.js
```

---

## 7단계 — ChatPage.jsx 구조

```jsx
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export default function ChatPage({ user, roomId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const clientRef = useRef(null);

  useEffect(() => {
    // 이전 내역 불러오기
    fetch(`/api/chat/${roomId}/history`)
      .then(r => r.json())
      .then(setMessages);

    // WebSocket 연결
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      onConnect: () => {
        client.subscribe(`/topic/chat/${roomId}`, (frame) => {
          const msg = JSON.parse(frame.body);
          setMessages(prev => [...prev, msg]);
        });
      },
    });
    client.activate();
    clientRef.current = client;

    return () => client.deactivate();
  }, [roomId]);

  const send = () => {
    if (!input.trim()) return;
    clientRef.current.publish({
      destination: `/app/chat/${roomId}/send`,
      body: JSON.stringify({
        senderId: user.id,
        senderName: user.name,
        content: input,
        type: input.startsWith('```') ? 'CODE' : 'TEXT',
      }),
    });
    setInput('');
  };

  return ( /* UI 렌더링 */ );
}
```

---

## 전체 흐름

```
[사용자 A 전송]
      ↓
/app/chat/{roomId}/send  (STOMP 발행)
      ↓
ChatController.send()
      ↓
DB 저장 (chat_messages 테이블)
      ↓
/topic/chat/{roomId} 브로드캐스트
      ↓
[구독 중인 사용자 B, C 실시간 수신]
```

---

## 코드 블록 렌더링

메시지 `type === 'CODE'` 이면 highlight.js로 렌더링:

```jsx
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

function MessageBubble({ msg }) {
  if (msg.type === 'CODE') {
    const code = msg.content.replace(/```[\w]*\n?/, '').replace(/```$/, '');
    const html = hljs.highlightAuto(code).value;
    return (
      <pre><code dangerouslySetInnerHTML={{ __html: html }} /></pre>
    );
  }
  return <p>{msg.content}</p>;
}
```

---

## 확장 기능 (선택)

| 기능 | 구현 방법 |
|------|----------|
| 파티별 채팅방 | roomId = partyId 로 연결 |
| 입장/퇴장 알림 | type: JOIN / LEAVE 메시지 |
| 읽지 않은 알림 | 마지막 읽은 시간 저장 후 카운트 |
| 모바일 앱 | React Native + @stomp/stompjs (동일 코드) |
| Android 네이티브 | OkHttp WebSocket |
| iOS 네이티브 | Starscream + StompClientLib |

---

## 터널 사용 시 주의사항

cloudflared 터널로 외부 공개 시 WebSocket 주소도 변경 필요:

```javascript
// 로컬
new SockJS('http://localhost:8080/ws')

// 터널 사용 시
new SockJS('https://xxx.trycloudflare.com/ws')
```

`VITE_API_BASE` 환경변수와 동일한 주소를 사용하면 됩니다.
