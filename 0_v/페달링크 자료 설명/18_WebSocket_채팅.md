# WebSocket 채팅 — STOMP 실시간 메시지

## 이 프로젝트에서 쓰인 곳
- 파티 채팅 (파티 도크의 미니 채팅 탭, `/chat` 전용 페이지)
- 크루 채팅 (크루 상세 화면)
- 두 채팅은 **엔드포인트도 테이블도 완전히 분리**돼 있다

관련 코드
- 백엔드 `Config/WebSocketConfig.java`, `controller/ChatController.java`, `controller/CrewChatController.java`
- 프론트 `hooks/useChat.js`, `api/chat.js`, `pages/ChatPage.jsx`

---

## 왜 REST 로는 안 되는가

REST 는 **클라이언트가 물어봐야 서버가 답한다.** 새 메시지가 왔는지 알려면 계속 물어봐야 한다(폴링).

```
[폴링]  브라우저 →「새 메시지 있어?」→ 서버  (1초마다 반복)
        대부분의 요청이 "없음" 을 받고 끝남 — 낭비
```

WebSocket 은 연결을 **한 번 열어두고 양쪽이 아무 때나** 보낸다.

```
[WebSocket]  브라우저 ⟷ 서버   (연결 유지)
             서버가 먼저 보낼 수 있음 → 즉시 도착
```

실시간 위치 공유는 폴링(3초)을 쓰는데 채팅은 WebSocket 을 쓰는 이유는 **지연 허용치가 다르기** 때문이다.
위치는 3초 늦어도 되지만, 채팅이 3초 늦으면 대화가 안 된다.

---

## STOMP 란

WebSocket 은 "연결" 만 제공할 뿐 **메시지 형식이 없다.** 누가 누구에게 보내는지 약속이 필요하다.

STOMP 는 그 약속이다. 핵심은 두 가지뿐이다.

| 개념 | 뜻 | 이 프로젝트 |
|------|-----|------------|
| **구독(subscribe)** | 이 주소로 오는 메시지를 받겠다 | `/topic/chat/3` |
| **발행(publish)** | 이 주소로 메시지를 보내겠다 | `/app/chat/3/send` |

우편함에 비유하면 구독은 "이 주소로 오는 편지를 받겠다", 발행은 "이 주소로 편지를 보내겠다" 에 해당한다.

---

## 설정 — WebSocketConfig

`my-app-backend/src/main/java/com/example/demo/Config/WebSocketConfig.java`

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");               // 구독 prefix
        registry.setApplicationDestinationPrefixes("/app");   // 발신 prefix
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
```

| 설정 | 의미 |
|------|------|
| `enableSimpleBroker("/topic")` | `/topic/...` 으로 오는 메시지를 **스프링 내장 브로커**가 구독자에게 뿌린다 |
| `setApplicationDestinationPrefixes("/app")` | `/app/...` 은 브로커로 바로 가지 않고 **컨트롤러를 거친다** |
| `addEndpoint("/ws")` | 연결을 시작하는 주소 |

> **왜 prefix 를 나누나.** `/app` 은 "서버 코드가 처리할 것", `/topic` 은 "그냥 뿌릴 것" 이다.
> 채팅은 DB 저장이 필요하므로 `/app` 으로 받아 컨트롤러에서 저장한 뒤 `/topic` 으로 내보낸다.

---

## 메시지 흐름

```
[A 브라우저]
   publish → /app/chat/3/send
                  ↓
        ChatController.send()          ← @MessageMapping
                  ↓
        chat_messages 테이블 저장
                  ↓
        /topic/chat/3 로 브로드캐스트
                  ↓
[A·B·C 브라우저]  구독 중이던 모두가 즉시 수신
```

보낸 사람도 `/topic` 구독자이므로 **자기 메시지를 서버를 거쳐 되받는다.**
화면에 바로 그리지 않고 서버 응답을 기다리는 구조라, 저장 실패 시 화면에도 안 뜬다.

---

## 컨트롤러

`controller/ChatController.java`

```java
@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessagingTemplate messaging;
    private final ChatMessageRepository chatRepo;

    @MessageMapping("/chat/{roomId}/send")
    public void send(@DestinationVariable Long roomId, @Payload ChatMessage msg) {
        msg.setRoomId(roomId);
        msg.setSentAt(LocalDateTime.now().toString());

        ChatMessageEntity entity = new ChatMessageEntity();
        entity.setRoomId(roomId);
        entity.setSenderId(msg.getSenderId());
        entity.setSenderName(msg.getSenderName());
        entity.setContent(msg.getContent());
        entity.setType(msg.getType() != null ? msg.getType() : "TEXT");
        entity.setCreatedAt(LocalDateTime.now());
        chatRepo.save(entity);

        messaging.convertAndSend("/topic/chat/" + roomId, msg);
    }

    @GetMapping("/api/chat/{roomId}/history")
    @ResponseBody
    public List<ChatMessageEntity> history(@PathVariable Long roomId) {
        return chatRepo.findByRoomIdOrderByCreatedAtAsc(roomId);
    }
}
```

| 애노테이션 | 역할 |
|-----------|------|
| `@MessageMapping` | STOMP 발행을 받는다 (REST 의 `@PostMapping` 에 해당) |
| `@DestinationVariable` | 주소의 `{roomId}` 를 꺼낸다 (`@PathVariable` 에 해당) |
| `@Payload` | 메시지 본문을 객체로 변환 |
| `SimpMessagingTemplate` | 서버가 **먼저** 메시지를 보낼 때 쓰는 도구 |

**과거 기록(`/history`)은 REST 로 따로 받는다.** WebSocket 은 "앞으로 올 메시지" 만 전달하므로,
방에 들어간 시점의 이전 대화는 조회해서 채워야 한다.

---

## ⚠️ 파티 채팅과 크루 채팅이 분리된 이유

두 채팅은 코드 구조가 거의 같지만 **테이블이 다르다.**

| | 파티 채팅 | 크루 채팅 |
|---|---|---|
| 발행 | `/app/chat/{roomId}/send` | `/app/crew-chat/{crewId}/send` |
| 구독 | `/topic/chat/{roomId}` | `/topic/crew-chat/{crewId}` |
| 내역 | `/api/chat/{roomId}/history` | `/api/crew-chat/{crewId}/history` |
| 테이블 | `chat_messages` | `crew_chat_messages` |

원인은 **외래키 제약**이다.

```sql
-- 001_chat_messages.sql
room_id BIGINT NOT NULL REFERENCES parties(id) ON DELETE CASCADE
```

`chat_messages.room_id` 가 `parties(id)` 를 참조하므로, 여기에 크루 ID 를 넣으면
**"그런 파티가 없다" 며 거부된다.** 그래서 테이블을 따로 판 것이다.

> 나중에 동호회가 더 늘어나면 `chat_rooms` 테이블을 하나 두고 방 종류를 컬럼으로 구분하는 편이
> 확장에 유리하다. 지금은 두 종류뿐이라 분리가 더 단순하다.

---

## 프론트 — useChat 훅

`my-app-front/src/hooks/useChat.js`

파티·크루 양쪽이 같은 훅을 쓴다. `channel` 인자로 주소만 바꾼다.

```js
export function useChat(roomId, user, channel = 'chat') {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;

    // 1) 이전 내역을 REST 로 먼저 채운다
    getChatHistory(roomId, channel).then(setMessages);

    // 2) WebSocket 연결 후 구독
    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 3000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/${channel}/${roomId}`, (frame) => {
          setMessages((prev) => [...prev, JSON.parse(frame.body)]);
        });
      },
    });
    client.activate();
    clientRef.current = client;

    return () => client.deactivate();   // 화면을 떠나면 연결 정리
  }, [roomId, channel]);
  ...
}
```

`reconnectDelay: 3000` 은 연결이 끊기면 3초마다 재시도한다는 뜻이다.
터널이 잠깐 불안정해도 알아서 복구된다.

---

## 주소 만들기 — SockJS 를 건너뛴 이유

`my-app-front/src/api/chat.js`

```js
const wsOrigin = API_BASE
  ? API_BASE.replace(/^http/, 'ws')
  : window.location.origin.replace(/^http/, 'ws');

export const WS_URL = `${wsOrigin}/ws/websocket`;
```

**두 가지 처리가 들어 있다.**

**① `/websocket` 을 붙여 SockJS 를 우회한다**

백엔드가 `.withSockJS()` 로 설정돼 있지만, 프론트는 SockJS 라이브러리를 쓰지 않는다.
`sockjs-client` 가 Node 의 `global` 객체를 참조해 Vite(브라우저) 환경에서 모듈 로드 중에 죽기 때문이다.
SockJS 엔드포인트의 **raw WebSocket 트랜스포트**(`/ws/websocket`)를 직접 부르면 라이브러리 없이 연결된다.

**② `http` → `ws` 변환**

WebSocket 은 `ws://` (또는 `wss://`) 스킴을 쓴다.
`API_BASE` 가 비어 있으면(Nginx 뒤 배포) 현재 페이지 주소에서 가져오는데,
**페이지가 https 면 자동으로 `wss` 가 되어** 혼합 콘텐츠 차단도 피한다.

---

## 메시지 타입

`dto/ChatMessage.java`

```java
private String type;   // TEXT | CODE | JOIN | LEAVE
```

현재 화면에서 실제로 쓰는 것은 `TEXT` 와 `CODE` 두 가지다.
입력이 ``` 로 시작하면 프론트가 `CODE` 로 표시해 보내고, 받는 쪽은 코드 블록으로 렌더링한다.

---

## 확인 방법

백엔드 기동 로그에 1분마다 통계가 찍힌다.

```
WebSocketMessageBrokerStats : WebSocketSession[2 current WS(2)-HttpStream(0)-HttpPoll(0),
                              5 total, 0 closed abnormally ...]
                              stompSubProtocol[processed CONNECT(5)-CONNECTED(5)-DISCONNECT(3)]
```

| 값 | 의미 |
|---|---|
| `current WS(2)` | 지금 연결된 세션 2개 |
| `closed abnormally` | 비정상 종료 — 0 이 정상 |
| `CONNECT / CONNECTED` | 숫자가 같아야 정상 (연결 시도 = 성공) |

**혼자 테스트하려면** 브라우저 탭 두 개에서 같은 방을 열고 한쪽에서 보내면 된다.

---

## 관련 문서
- [12_파티_링크_기능.md](12_파티_링크_기능.md) — 채팅이 붙는 파티 구조
- [19_크루_동호회.md](19_크루_동호회.md) — 크루 채팅 쪽 맥락
- [09_REST_API_설계.md](09_REST_API_설계.md) — `/history` 엔드포인트
