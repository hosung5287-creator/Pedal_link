import '../styles/partyroom.css';

import { useEffect, useRef, useState } from 'react';
import { partyRoom as t, text } from '../constants';
import { approveRequest, rejectRequest, leaveParty, deleteParty, startPartyRide, setPartyReady } from '../api/parties';
import { useChat } from '../hooks/useChat';
import { displayTime } from '../utils/chat';

const letterOf = (name) => (name || '?').trim().charAt(0);

// 홈페이지 등 어느 화면 위에도 띄울 수 있는 파티 룸 오버레이.
// rooms 가 여러 개면 먼저 목록을 보여주고, 하나를 고르면(또는 애초에 하나뿐이면)
// 채팅방 / 참가자 목록 / 방장 제어판(호스트만) 3단 화면으로 들어간다.
export default function PartyRoom({ rooms, user, onClose, onRoomsChange, onStartRide, initialRoomId }) {
  const [localRooms, setLocalRooms] = useState(rooms);
  const [selectedId, setSelectedId] = useState(
    initialRoomId ?? (rooms.length === 1 ? rooms[0].id : null),
  );

  useEffect(() => {
    setLocalRooms(rooms);
    if (rooms.length === 1) {
      setSelectedId(rooms[0].id);
    } else if (selectedId != null && !rooms.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);

  const party = localRooms.find((r) => r.id === selectedId) || null;

  const updateRoom = (updated) => {
    setLocalRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    onRoomsChange?.(updated);
  };

  return (
    <div className="prBackdrop" onClick={onClose}>
      {party ? (
        <PartyRoomView
          party={party}
          user={user}
          showBack={localRooms.length > 1}
          onBack={() => setSelectedId(null)}
          onClose={onClose}
          onUpdate={updateRoom}
          onStartRide={onStartRide}
        />
      ) : (
        <div className="prRoom prRoomListShell" role="dialog" aria-label={t.waitingRoom} onClick={(e) => e.stopPropagation()}>
          <header className="prHead">
            <div>
              <p className="prEyebrow">{t.waitingRoom}</p>
              <h2>{t.pickRoom}</h2>
            </div>
            <button type="button" className="prClose" onClick={onClose} aria-label="닫기">✕</button>
          </header>
          <ul className="prRoomList">
            {localRooms.map((r) => (
              <li key={r.id}>
                <button type="button" className="prRoomCard" onClick={() => setSelectedId(r.id)}>
                  <span className="prAvatar" aria-hidden="true">{letterOf(r.title)}</span>
                  <span className="prRoomCardInfo">
                    <strong>{r.title}</strong>
                    <span>{r.fromLabel} → {r.toLabel}</span>
                    <span className="prPartyCardMeta">{r.participants.length}/{r.maxMembers}{text.partyMembers} · {r.hostName}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// 실제 채팅+멤버+제어판 3단 화면 (방 하나를 골랐을 때)
function PartyRoomView({ party, user, showBack, onBack, onClose, onUpdate, onStartRide }) {
  const [showRequests, setShowRequests] = useState(false);
  const [confirming, setConfirming] = useState(null); // 'leave' | 'delete' | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const { messages, connected, sendMessage } = useChat(party.id, user);
  const [input, setInput] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isHost = party.hostId === user.id;
  const members = party.participants || [];
  const pending = party.pendingRequests || [];

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
    <div className="prRoom" role="dialog" aria-label={party.title} onClick={(e) => e.stopPropagation()}>
      <header className="prHead">
        <div>
          {showBack && (
            <button type="button" className="prBack" onClick={onBack}>← {t.pickRoom}</button>
          )}
          <p className="prEyebrow">{t.waitingRoom}</p>
          <h2>{party.title}</h2>
        </div>
        <button type="button" className="prClose" onClick={onClose} aria-label="닫기">✕</button>
      </header>

      <div className="prBody">
        {/* 채팅방 */}
        <section className="prCol prColChat">
          <h3 className="prColTitle">{t.chatTitle}</h3>
          <div className="prChatMessages">
            {messages.length === 0 && <p className="prHint">아직 메시지가 없어요.</p>}
            {messages.map((msg, i) => {
              const mine = msg.senderId === user.id;
              return (
                <div key={msg.id ?? i} className={`prBubbleRow${mine ? ' isMine' : ''}`}>
                  <div className="prBubble">
                    {!mine && <div className="prSender">{msg.senderName}</div>}
                    <p className="prContent">{msg.content}</p>
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
              전송
            </button>
          </div>
        </section>

        {/* 참가자 목록 */}
        <section className="prCol prColMembers">
          <h3 className="prColTitle">{t.memberListTitle} ({members.length}/{party.maxMembers})</h3>
          <ul className="prMembers">
            {members.map((m) => (
              <li key={m.userId} className="prMember">
                <span className="prMemberIdentity">
                  <span className="prAvatar" aria-hidden="true">{letterOf(m.name)}</span>
                  <span className="prMemberName">
                    {m.name}
                    {m.userId === party.hostId && <span className="prTag prTagHost">{text.partyHost}</span>}
                    {m.userId === user.id && <span className="prTag">나</span>}
                  </span>
                </span>
                {m.userId === user.id ? (
                  <button
                    type="button"
                    className={`prReadyBtn${m.ready ? ' isReady' : ''}`}
                    disabled={busy}
                    onClick={() => runAction(() => setPartyReady(party.id, user.id, !m.ready))}
                  >
                    {m.ready ? `✓ ${t.readyDone}` : t.readyWaiting}
                  </button>
                ) : (
                  <span className={`prReadyTag${m.ready ? ' isReady' : ''}`}>
                    {m.ready ? `✓ ${t.readyDone}` : t.readyWaiting}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* 방장 제어판 / 참가자 메뉴 */}
        <section className="prCol prColControl">
          <h3 className="prColTitle">{isHost ? t.controlTitle : t.memberOnlyPanel}</h3>

          {error && <p className="prError">{error}</p>}

          {isHost ? (
            <div className="prActions">
              <button
                type="button"
                className="prPrimaryBtn"
                disabled={busy}
                onClick={handleStartRide}
              >
                {party.rideStartedAt ? t.goToRide : t.startRide}
              </button>

              <button type="button" className="prGhostBtn" disabled title={t.settingsSoonHint}>
                {t.settingsSoon}
              </button>
              <button type="button" className="prGhostBtn" disabled title={t.editRouteSoonHint}>
                {t.editRouteSoon}
              </button>

              <button type="button" className="prGhostBtn" onClick={() => setShowRequests((v) => !v)}>
                {t.manageRequests} ({t.waitingCount} {pending.length})
              </button>

              {showRequests && (
                <ul className="prRequests">
                  {pending.length === 0 && <li className="prHint">{t.noPendingShort}</li>}
                  {pending.map((p) => (
                    <li key={p.userId} className="prRequestRow">
                      <span>{p.name}</span>
                      <span className="prRequestActions">
                        <button
                          type="button"
                          className="prApproveBtn"
                          disabled={busy}
                          onClick={() => runAction(() => approveRequest(party.id, p.userId))}
                        >
                          {text.partyApprove}
                        </button>
                        <button
                          type="button"
                          className="prRejectBtn"
                          disabled={busy}
                          onClick={() => runAction(() => rejectRequest(party.id, p.userId))}
                        >
                          {text.partyReject}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {confirming === 'delete' ? (
                <div className="prConfirmBox">
                  <p>{t.deleteConfirm}</p>
                  <div className="prConfirmActions">
                    <button type="button" className="prGhostBtn" onClick={() => setConfirming(null)}>{t.confirmNo}</button>
                    <button
                      type="button"
                      className="prDangerBtn"
                      disabled={busy}
                      onClick={() => runAction(async () => { await deleteParty(party.id, user.id); onClose(); return party; })}
                    >
                      {t.confirmYes}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="prDangerBtn" onClick={() => setConfirming('delete')}>
                  {t.deleteRoom}
                </button>
              )}
            </div>
          ) : (
            <div className="prActions">
              {party.rideStartedAt && (
                <button type="button" className="prPrimaryBtn" onClick={() => onStartRide?.(party.id)}>
                  {t.goToRide}
                </button>
              )}
              {confirming === 'leave' ? (
                <div className="prConfirmBox">
                  <p>{t.leaveConfirm}</p>
                  <div className="prConfirmActions">
                    <button type="button" className="prGhostBtn" onClick={() => setConfirming(null)}>{t.confirmNo}</button>
                    <button
                      type="button"
                      className="prDangerBtn"
                      disabled={busy}
                      onClick={() => runAction(async () => { const r = await leaveParty(party.id, user.id); onClose(); return r; })}
                    >
                      {t.confirmYes}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="prDangerBtn" onClick={() => setConfirming('leave')}>
                  {t.leaveRoom}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
