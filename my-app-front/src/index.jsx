import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// 유틸리티는 페이지별 CSS보다 뒤에 와야 하므로 App import 이후에 둔다.
import './styles/utilities.css';
import { installDemoGeo } from './utils/demoGeo';

// 시연 모드면 GPS 대신 서버의 가상 위치를 쓴다 (아니면 진짜 GPS 그대로) — 화면이 위치를 읽기 전에 설치한다
installDemoGeo();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
