import '../styles/partyroom.css';

import { useEffect, useRef, useState } from 'react';
import { partyRoom as t, text } from '../constants';
import { approveRequest, rejectRequest, leaveParty, deleteParty, startPartyRide, setPartyReady } from '../api/parties';
import { getRouteById } from '../api/routes';
import { useChat } from '../hooks/useChat';
import { displayTime } from '../utils/chat';
import { markRead } from '../utils/chatUnread';
import RouteMapThumbnail from './RouteMapThumbnail';

const letterOf = (name) => (name || '?').trim().charAt(0);

// 제어판·탭에서 쓰는 아이콘. 외부 아이콘 라이브러리를 새로 넣지 않고
// lucide 스타일의 24x24 stroke 패스만 여기에 모아둔다.
const ICONS = {
  x: 'M18 6 6 18M6 6l12 12',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  check: 'M20 6 9 17l-5-5',
  play: 'M6 3v18l15-9z',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3',
  userPlus: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M19 8v6M22 11h-6',
  logOut: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  radar: 'M20 12a8 8 0 1 1-8-8M12 12l6-6M12 12a4 4 0 1 0 4 4',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
};

function Ico({ name, size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

// 홈페이지 등 어느 화면 위에도 띄울 수 있는 파티 룸 오버레이.
// 내가 속한 방이 여러 개면 위쪽 채팅 탭으로 바로 갈아탄다(별도 목록 화면 없음).
export default function PartyRoom({ rooms, user, onClose, onRoomsChange, onStartRide, initialRoomId }) {
  const [localRooms, setLocalRooms] = useState(rooms);
  const [selectedId, setSelectedId] = useState(initialRoomId ?? rooms[0]?.id ?? null);

  useEffect(() => {
    setLocalRooms(rooms);
    // 보고 있던 방이 사라졌을 때만 첫 방으로 되돌린다
    if (selectedId == null || !rooms.some((r) => r.id === selectedId)) {
      setSelectedId(rooms[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);

  const party = localRooms.find((r) => r.id === selectedId) || null;

  const updateRoom = (updated) => {
    setLocalRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    onRoomsChange?.(updated);
  };

  if (!party) return null;

  return (
    <div className="prBackdrop" onClick={onClose}>
      <PartyRoomPanel
        key={party.id}
        party={party}
        rooms={localRooms}
        user={user}
        onSelectRoom={setSelectedId}
        onClose={onClose}
        onUpdate={updateRoom}
        onStartRide={onStartRide}
      />
    </div>
  );
}

// 채팅 탭 — 내가 속한 방을 오픈채팅처럼 갈아탄다.
// '근처 채팅'은 방 id 가 파티에 묶여 있어 아직 서버가 지원하지 않는다(비활성).
function ChatTabs({ rooms, currentId, onSelect }) {
  return (
    <div className="prChatTabs">
      {rooms.map((r) => (
        <button
          key={r.id}
          type="button"
          className={`prChatTab${r.id === currentId ? ' isActive' : ''}`}
          onClick={() => onSelect(r.id)}
        >
          <Ico name="users" size={14} />
          {r.title}
        </button>
      ))}
      <span className="prChatTab isSoon" title={t.nearChatHint}>
        <Ico name="radar" size={14} />
        {t.nearChatTab}
        <span className="prSoonBadge">{t.soonBadge}</span>
      </span>
    </div>
  );
}

// 파티 코스 미니 지도. 파티 응답에는 좌표가 없어 경로를 따로 한 번 불러온다.
function RouteCard({ party }) {
  const [path, setPath] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!party.routeId) { setPath(null); return undefined; }
    getRouteById(party.routeId)
      .then((r) => { if (alive) setPath(r?.bikeRoute?.length ? r.bikeRoute : null); })
      .catch(() => { if (alive) setPath(null); });
    return () => { alive = false; };
  }, [party.routeId]);

  return (
    <div className="prRouteCard">
      {path ? <RouteMapThumbnail path={path} /> : <div className="prRouteFallback" aria-hidden="true" />}
      <div className="prRouteCaption">
        <strong>{party.routeName || party.title}</strong>
        <span>
          {party.distanceKm != null ? `${party.distanceKm} km` : `${party.fromLabel} → ${party.toLabel}`}
        </span>
      </div>
    </div>
  );
}

// 실제 채팅+멤버+제어판 3단 화면.
// 모달(PartyRoom) 과 파티 페이지가 같이 쓴다.
// - onClose 를 주지 않으면 닫기 버튼이 사라진다(페이지에 붙일 때).
// - inline: 배경/그림자를 걷어내고 페이지 안에 카드처럼 놓는다.
export function PartyRoomPanel({ party, rooms, user, onSelectRoom, onClose, onUpdate, onRemove, onStartRide, inline = false }) {
  const [showRequests, setShowRequests] = useState(false);
  const [confirming, setConfirming] = useState(null); // 'leave' | 'delete' | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef(null);

  const { messages, connected, sendMessage } = useChat(party.id, user);
  const [input, setInput] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    // 이 방을 보고 있으므로 여기까지 읽은 것으로 표시 → 파티 탭 뱃지가 줄어든다
    markRead(party.id, messages);
  }, [messages, party.id]);

  const isHost = party.hostId === user.id;
  const members = party.participants || [];
  const pending = party.pendingRequests || [];
  const emptySlots = Math.max(0, (party.maxMembers || 0) - members.length);
  const inviteUrl = `${window.location.origin}/party?id=${party.id}`;

  const runAction = async (fn) => {
    setBusy(true);
    setError('');
    try {
      onUpdate(await fn());
      setConfirming(null);
    } catch {
      setError(t.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  // 클립보드는 https 나 localhost 에서만 동작한다. 실패하면 조용히 넘어간다.
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* 무시 */ }
  };

  // 이미 시작된 라이딩이면 서버 호출 없이 바로 지도 화면으로 이동만 한다
  const handleStartRide = async () => {
    if (party.rideStartedAt) {
      onStartRide?.(party.id);
      return;
    }
    setBusy(true);
    setError('');
    try {
      onUpdate(await startPartyRide(party.id, user.id));
      onStartRide?.(party.id);
    } catch {
      setError(t.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      className={`prRoom${inline ? ' isInline' : ''}`}
      role={inline ? undefined : 'dialog'}
      aria-label={party.title}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="prHead">
        <div className="prHeadText">
          <p className="prEyebrow">{t.waitingRoom}</p>
          <h2>{party.title}</h2>
        </div>
        <span className="prMemberPill">
          <Ico name="users" size={15} />
          {members.length} / {party.maxMembers}{text.partyMembers}
        </span>
        {onClose && (
          <button type="button" className="prClose" onClick={onClose} aria-label="닫기">
            <Ico name="x" size={16} />
          </button>
        )}
      </header>

      <div className="prInviteBar">
        <Ico name="link" size={16} />
        <strong>{t.inviteLabel}</strong>
        <span className="prInviteField">{inviteUrl}</span>
        <button type="button" className="prCopyBtn" onClick={copyInvite}>
          <Ico name="copy" size={14} />
          {copied ? t.inviteCopied : t.inviteCopy}
        </button>
      </div>

      <div className="prBody">
        {/* 채팅방 */}
        <section className="prCol prColChat">
          <h3 className="prColTitle">{t.chatTitle}</h3>
          <ChatTabs rooms={rooms} currentId={party.id} onSelect={onSelectRoom} />

          <div className="prChatCard">
            <div className="prChatMessages">
              {messages.length === 0 && <p className="prHint">아직 메시지가 없어요.</p>}
              {messages.map((msg, i) => {
                const mine = msg.senderId === user.id;
                return (
                  <div key={msg.id ?? i} className={`prBubbleRow${mine ? ' isMine' : ''}`}>
                    {!mine && <span className="prAvatar prAvatarSm" aria-hidden="true">{letterOf(msg.senderName)}</span>}
                    <div className="prBubbleCol">
                      {!mine && <div className="prSender">{msg.senderName}</div>}
                      <div className="prBubble">
                        <p className="prContent">{msg.content}</p>
                      </div>
                      <div className="prTime">{displayTime(msg)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="prInputRow">
              <input
                type="text"
                className="prInput"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요…"
              />
              <button type="button" className="prSendBtn" onClick={send} disabled={!connected || !input.trim()}>
                <Ico name="send" size={15} />
                전송
              </button>
            </div>
          </div>
        </section>

        {/* 참가자 목록 */}
        <section className="prCol prColMembers">
          <h3 className="prColTitle">{t.memberListTitle}</h3>
          <ul className="prMembers">
            {members.map((m) => {
              const me = m.userId === user.id;
              return (
                <li key={m.userId} className={`prMember${me ? ' isMe' : ''}`}>
                  <span className="prAvatarWrap">
                    <span className="prAvatar" aria-hidden="true">{letterOf(m.name)}</span>
                    {m.ready && <span className="prReadyDot" aria-hidden="true"><Ico name="check" size={9} /></span>}
                  </span>
                  <span className="prMemberInfo">
                    <span className="prMemberName">
                      {m.name}
                      {m.userId === party.hostId && <span className="prTag prTagHost">{text.partyHost}</span>}
                      {me && <span className="prTag">나</span>}
                    </span>
                    <span className={`prMemberState${m.ready ? ' isReady' : ''}`}>
                      {m.ready ? t.readyDone : t.readyWaiting}
                    </span>
                  </span>
                  {me && (
                    <button
                      type="button"
                      className={`prReadyBtn${m.ready ? ' isReady' : ''}`}
                      disabled={busy}
                      onClick={() => runAction(() => setPartyReady(party.id, user.id, !m.ready))}
                    >
                      {m.ready ? t.readyCancel : t.readyDone}
                    </button>
                  )}
                </li>
              );
            })}
            {Array.from({ length: emptySlots }, (_, i) => (
              <li key={`empty-${i}`} className="prMember prMemberEmpty">
                <span className="prAvatarWrap"><span className="prAvatar prAvatarEmpty" aria-hidden="true" /></span>
                <span className="prMemberInfo"><span className="prMemberName">{t.emptySlot}</span></span>
              </li>
            ))}
          </ul>
        </section>

        {/* 방장 제어판 / 참가자 메뉴 */}
        <section className="prCol prColControl">
          <h3 className="prColTitle">{isHost ? t.controlTitle : t.memberOnlyPanel}</h3>

          {error && <p className="prError">{error}</p>}

          <div className="prControlCard">
            {(isHost || party.rideStartedAt) && (
              <button type="button" className="prPrimaryBtn" disabled={busy} onClick={handleStartRide}>
                <Ico name="play" size={19} />
                {party.rideStartedAt ? t.goToRide : t.startRide}
              </button>
            )}

            <div className="prLower">
              <RouteCard party={party} />

              <div className="prMenuList">
                {isHost ? (
                  <>
                    <button type="button" className="prMenuBtn" disabled title={t.settingsSoonHint}>
                      <Ico name="settings" /><span>{t.settingsSoon}</span><span className="prSoonBadge">{t.soonBadge}</span>
                    </button>
                    <button type="button" className="prMenuBtn" disabled title={t.editRouteSoonHint}>
                      <Ico name="map" /><span>{t.editRouteSoon}</span><span className="prSoonBadge">{t.soonBadge}</span>
                    </button>
                    <button type="button" className="prMenuBtn" disabled title={t.voiceSoonHint}>
                      <Ico name="mic" /><span>{t.voiceChat}</span><span className="prSoonBadge">{t.soonBadge}</span>
                    </button>
                    <button type="button" className="prMenuBtn" onClick={() => setShowRequests((v) => !v)}>
                      <Ico name="userPlus" /><span>{t.manageRequests}</span>
                      {pending.length > 0 && <span className="prCountBadge">{pending.length}</span>}
                    </button>
                    <button type="button" className="prMenuBtn isDanger" onClick={() => setConfirming('delete')}>
                      <Ico name="trash" /><span>{t.deleteRoom}</span>
                    </button>
                  </>
                ) : (
                  <button type="button" className="prMenuBtn isDanger" onClick={() => setConfirming('leave')}>
                    <Ico name="logOut" /><span>{t.leaveRoom}</span>
                  </button>
                )}
              </div>
            </div>

            {showRequests && (
              <ul className="prRequests">
                {pending.length === 0 && <li className="prHint">{t.noPendingShort}</li>}
                {pending.map((p) => (
                  <li key={p.userId} className="prRequestRow">
                    <span>{p.name}</span>
                    <span className="prRequestActions">
                      <button type="button" className="prApproveBtn" disabled={busy}
                        onClick={() => runAction(() => approveRequest(party.id, p.userId))}>
                        {text.partyApprove}
                      </button>
                      <button type="button" className="prRejectBtn" disabled={busy}
                        onClick={() => runAction(() => rejectRequest(party.id, p.userId))}>
                        {text.partyReject}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {confirming && (
              <div className="prConfirmBox">
                <p>{confirming === 'delete' ? t.deleteConfirm : t.leaveConfirm}</p>
                <div className="prConfirmActions">
                  <button type="button" className="prGhostBtn" onClick={() => setConfirming(null)}>{t.confirmNo}</button>
                  <button
                    type="button"
                    className="prDangerBtn"
                    disabled={busy}
                    onClick={() => runAction(async () => {
                      const gone = confirming === 'delete'
                        ? (await deleteParty(party.id, user.id), party)
                        : await leaveParty(party.id, user.id);
                      // 페이지에 붙였을 때는 닫을 모달이 없으므로 목록에서 빼달라고만 알린다
                      onRemove?.(party.id);
                      onClose?.();
                      return gone;
                    })}
                  >
                    {t.confirmYes}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
