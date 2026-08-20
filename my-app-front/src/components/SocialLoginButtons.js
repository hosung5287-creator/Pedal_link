import { text } from '../constants';

// 로그인/회원가입 페이지에서 함께 쓰는 소셜 로그인 버튼.
//
// ⚠️ 현재 백엔드에 OAuth2(Spring Security oauth2-client) 설정이 없어서
//    /oauth2/authorization/{provider} 를 호출하면 404가 난다.
//    그래서 버튼은 보여주되 비활성 상태로 둔다.
//    백엔드가 준비되면 disabled 를 제거하고
//    onClick={() => startSocialLogin('google')} 을 다시 연결하면 된다.
//    (startSocialLogin 은 api/auth.js 에 그대로 남아있다)
export default function SocialLoginButtons() {
  return (
    <>
      <div className="signupDivider"><span>{text.signupSocialDivider}</span></div>

      <div className="signupSocial">
        <button
          className="socialButton socialGoogle"
          type="button"
          disabled
          title={text.socialPreparing}
        >
          <span className="socialIcon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          </span>
          {text.signupGoogle}
        </button>

        <button
          className="socialButton socialNaver"
          type="button"
          disabled
          title={text.socialPreparing}
        >
          <span className="socialIcon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#ffffff">
              <path d="M16.27 12.85 7.55 0H0v24h7.73V11.15L16.45 24H24V0h-7.73v12.85z"/>
            </svg>
          </span>
          {text.signupNaver}
        </button>
      </div>

      <p className="socialNote">{text.socialPreparing}</p>
    </>
  );
}
