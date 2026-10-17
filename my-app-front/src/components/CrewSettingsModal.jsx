import { useEffect, useRef, useState } from 'react';
import { crew as t } from '../constants';
import { approveMember, rejectMember, updateCrewSettings } from '../api/crews';
import { errorMessage } from '../api/client';

// 크루 상세(CrewPage)의 "크루 설정"·"크루 나가기" 창. 스타일은 크루 만들기 창(crewCreate*)을 같이 쓴다.

const POLICIES = [
  { value: 'approval', label: t.joinPolicyApproval, hint: t.joinPolicyApprovalHint },
  { value: 'open', label: t.joinPolicyOpen, hint: t.joinPolicyOpenHint },
  { value: 'closed', label: t.joinPolicyClosed, hint: t.joinPolicyClosedHint },
];

// ESC 로 닫기 + 열리면 firstRef 에 포커스, 닫히면 원래 누른 버튼으로 포커스를 돌려준다.
// onClose 는 렌더마다 새로 만들어져서 ref 로 받는다 (UserProfileModal 과 같은 방식).
function useModalKeys(onClose, firstRef) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    firstRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [firstRef]);
}

// 크루 설정 (리더만) — 가입 신청 받기 방식 + 들어온 가입 요청 수락·거절.
// 수락·거절은 누르는 즉시 반영하고, 가입 방식은 저장 버튼으로 바꾼다.
export function CrewSettingsModal({ crew, user, onClose, onUpdate }) {
  const current = crew.joinPolicy || 'approval';
  const pending = crew.pendingRequests || [];
  const [policy, setPolicy] = useState(current);
  const [saving, setSaving] = useState(false);
  const [reqBusy, setReqBusy] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef(null);

  const busy = saving || reqBusy;
  const close = () => { if (!busy) onClose(); };
  useModalKeys(close, firstRef);

  const runRequest = async (fn) => {
    setReqBusy(true);
    setError('');
    try {
      onUpdate(await fn());
    } catch (err) {
      setError(errorMessage(err, t.requestActionFailed));
    } finally {
      setReqBusy(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (busy || policy === current) return;
    setSaving(true);
    setError('');
    try {
      onUpdate(await updateCrewSettings(crew.id, user.id, { joinPolicy: policy }));
      onClose();
    } catch (err) {
      setError(errorMessage(err, t.settingsFailed));
      setSaving(false);
    }
  };

  return (
    <div className="crewCreateBackdrop" onClick={close} role="presentation">
      <div className="crewCreateModal" role="dialog" aria-modal="true" aria-labelledby="crew-settings-title"
           onClick={(e) => e.stopPropagation()}>
        <h2 id="crew-settings-title">{t.settings}</h2>

        <form onSubmit={save}>
          <fieldset className="crewPolicyGroup" disabled={busy}>
            <legend>{t.joinPolicyTitle}</legend>
            {POLICIES.map((p) => (
              <label key={p.value} className={`crewPolicyOption${policy === p.value ? ' isSelected' : ''}`}>
                <input
                  type="radio" name="joinPolicy" value={p.value}
                  checked={policy === p.value}
                  onChange={() => setPolicy(p.value)}
                  ref={p.value === current ? firstRef : undefined}
                />
                <span className="crewPolicyText">
                  <strong>{p.label}</strong>
                  <span>{p.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <section className="crewSettingsSection" aria-labelledby="crew-requests-title">
            <h3 id="crew-requests-title" className="crewSettingsHead">
              {t.requestsTitle}
              {pending.length > 0 && <span className="crewCountBadge">{pending.length}</span>}
            </h3>
            <p className="crewSettingsHint">{t.requestsKeepHint}</p>
            <ul className="crewRequests">
              {pending.length === 0 && <li className="crewEmptyRow">{t.noPending}</li>}
              {pending.map((p) => (
                <li key={p.userId} className="crewRequestRow">
                  <span>{p.name}</span>
                  <span className="crewRequestActions">
                    <button
                      type="button" className="crewApproveBtn" disabled={busy}
                      onClick={() => runRequest(() => approveMember(crew.id, p.userId, user.id))}
                    >
                      {t.approve}
                    </button>
                    <button
                      type="button" className="crewRejectBtn" disabled={busy}
                      onClick={() => runRequest(() => rejectMember(crew.id, p.userId, user.id))}
                    >
                      {t.reject}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {error && <p className="crewError" role="alert">{error}</p>}

          <div className="crewCreateActions">
            <button type="button" className="crewCreateCancelBtn" onClick={close} disabled={busy}>{t.close}</button>
            <button type="submit" className="crewCreatePrimaryBtn" disabled={busy || policy === current}>
              {saving ? t.saving : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 크루 나가기 확인 창. 리더는 나갈 수 없어서 안내만 보여준다 (백엔드도 막는다).
// onLeave 가 성공하면 부모가 상세 화면을 닫으면서 이 창도 같이 사라진다.
export function LeaveCrewModal({ crew, isLeader, onClose, onLeave }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef(null);

  const close = () => { if (!busy) onClose(); };
  useModalKeys(close, firstRef);

  const leave = async () => {
    setBusy(true);
    setError('');
    try {
      await onLeave(crew.id);
    } catch (err) {
      setError(errorMessage(err, t.leaveFailed));
      setBusy(false);
    }
  };

  return (
    <div className="crewCreateBackdrop" onClick={close} role="presentation">
      <div className="crewCreateModal crewConfirmModal" role="alertdialog" aria-modal="true"
           aria-labelledby="crew-leave-title" aria-describedby="crew-leave-desc"
           onClick={(e) => e.stopPropagation()}>
        <h2 id="crew-leave-title">{isLeader ? t.leaderCantLeave : t.leaveConfirm(crew.name)}</h2>
        <p id="crew-leave-desc" className="crewConfirmText">{isLeader ? t.leaderCantLeaveDetail : t.leaveDetail}</p>

        {error && <p className="crewError" role="alert">{error}</p>}

        <div className="crewCreateActions">
          {isLeader ? (
            <button type="button" ref={firstRef} className="crewCreatePrimaryBtn" onClick={onClose}>{t.close}</button>
          ) : (
            <>
              {/* 실수로 나가지 않게 처음 포커스는 취소에 둔다 */}
              <button type="button" ref={firstRef} className="crewCreateCancelBtn" onClick={close} disabled={busy}>{t.cancel}</button>
              <button type="button" className="crewDangerBtn" onClick={leave} disabled={busy}>
                {busy ? t.leaving : t.leave}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
