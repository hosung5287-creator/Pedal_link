# 피드 mock 사진

홈 화면 "둘러보기" 섹션(FeedMarquee)과 피드 미리보기에 쓰는 샘플 사진입니다.
실제 사용자 업로드가 아니라 화면을 채우기 위한 고정 이미지입니다.

## 넣는 법

아래 이름으로 저장하세요. constants.js 의 homeFeedSamples 가 이 경로를 참조합니다.

| 파일명                 | 내용                          |
|-----------------------|-------------------------------|
| hanriver-sunset.jpg   | 한강 자전거도로 일몰 (라이더 뒷모습) |
| cafe-stop.jpg         | 카페 앞 자전거 2대 + 아이스커피     |
| mountain-view.jpg     | 산 전망대에 세워둔 로드바이크      |
| hanriver-bridge.jpg   | 한강 다리 배경 하늘색 로드바이크    |
| mtb-ridge.jpg         | 능선 위 오렌지 MTB              |

## 용량

public/ 은 git 에 커밋되므로 **한 장당 300KB 이하**로 줄여서 넣으세요.
긴 변 1280px, JPEG 품질 75 정도면 충분합니다.
(피드 업로드 기능이 쓰는 src/utils/image.js 와 같은 기준입니다)
