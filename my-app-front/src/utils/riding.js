// 라이딩 화면(RidingRoom)은 우측 하단 플로팅 도크(PartyDock)가 띄운다.
// 파티 페이지처럼 도크 바깥에서도 같은 화면을 열 수 있도록 이벤트로 신호만 보낸다.
// (지도 페이지로 이동하는 대신, 도크의 초록 버튼을 눌렀을 때와 똑같은 오버레이가 뜬다)
export const OPEN_RIDING_EVENT = 'pedallink:openriding';

export function openRidingRoom(partyId) {
  window.dispatchEvent(new CustomEvent(OPEN_RIDING_EVENT, { detail: { partyId } }));
}
