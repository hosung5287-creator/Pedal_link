# Pedal Link 개발 환경 설정 가이드

> 처음 개발 환경을 세팅하는 분을 위해 최대한 자세하게 작성했습니다.
> 순서대로 따라 하면 됩니다.

---

## Step 1. JDK 21 설치

1. 브라우저에서 https://www.oracle.com/java/technologies/downloads/#java21 접속
2. 페이지 중간의 **Windows** 탭 클릭
3. **x64 Installer** 항목의 다운로드 버튼 클릭 (파일명: `jdk-21_windows-x64_bin.exe`)
4. 오라클 계정 로그인 요구 시 → 무료 계정 생성 후 다운로드
5. 다운로드된 `.exe` 파일 실행
6. 설치 마법사에서 **Next** 계속 누르기 (경로 변경 없이 기본값 유지)
   - 기본 설치 경로: `C:\Program Files\Java\jdk-21.x.x`
7. 설치 완료 후 **Close** 클릭

---

## Step 2. JAVA_HOME 환경 변수 설정

> 이 작업을 안 하면 백엔드 실행 시 `java: command not found` 오류가 납니다.

1. 키보드에서 `윈도우키 + S` 눌러 검색창 열기
2. `시스템 환경 변수 편집` 입력 후 클릭
3. 오른쪽 아래 `환경 변수(N)...` 버튼 클릭
4. 아래쪽 **시스템 변수** 영역에서 `새로 만들기(W)...` 클릭
5. 다음과 같이 입력:
   ```
   변수 이름: JAVA_HOME
   변수 값:   C:\Program Files\Java\jdk-21.0.10
   ```
   > 설치된 JDK 버전에 따라 끝자리 숫자가 다를 수 있음.
   > `C:\Program Files\Java\` 폴더를 탐색기로 열어서 폴더명 확인 후 입력.
6. 확인 클릭
7. 다시 **시스템 변수** 목록에서 `Path` 찾아 클릭 → `편집(I)...` 클릭
8. 오른쪽 위 `새로 만들기(N)` 클릭 후 입력:
   ```
   %JAVA_HOME%\bin
   ```
9. 확인 → 확인 → 확인 (창 3개 모두 닫기)
10. **터미널을 완전히 닫고 새로 열기** (환경 변수는 터미널 재시작해야 적용됨)
11. 새 터미널에서 확인:
    ```bash
    java -version
    ```
    아래처럼 출력되면 성공:
    ```
    java version "21.0.10" ...
    ```

---

## Step 3. Node.js 설치

1. https://nodejs.org 접속
2. 왼쪽의 **LTS** 버전 다운로드 버튼 클릭
3. 다운로드된 `.msi` 파일 실행
4. 설치 마법사에서 **Next** 계속 누르기 (기본값 유지)
5. `Automatically install the necessary tools` 체크박스가 나오면 **체크 해제** (없어도 됨)
6. 설치 완료 후 터미널 새로 열고 확인:
   ```bash
   node -v
   npm -v
   ```
   버전 숫자가 출력되면 성공.

---

## Step 4. PostgreSQL + PostGIS 설치

### PostgreSQL 설치
1. https://www.postgresql.org/download/windows/ 접속
2. `Download the installer` 링크 클릭
3. **16.x** 버전의 Windows x86-64 다운로드
4. 다운로드된 `.exe` 실행
5. 설치 경로는 기본값 유지, **Next**
6. 설치할 컴포넌트 선택 화면 → 모두 체크된 상태 유지, **Next**
7. 데이터 저장 경로 → 기본값 유지, **Next**
8. **비밀번호 입력 화면이 중요:**
   ```
   Password: pass
   ```
   > 반드시 `pass` 로 설정. 다른 비밀번호로 하면 프로젝트 접속이 안 됨.
9. 포트: `5432` (기본값 유지), **Next**
10. Locale: 기본값 유지, **Next**
11. **Next** → **Finish**

### PostGIS 설치 (Stack Builder 사용)
12. 설치 완료 후 `Stack Builder may be used...` 체크박스가 있으면 **체크 유지** → Finish
13. Stack Builder 창이 열리면:
    - 드롭다운에서 `PostgreSQL 16 on port 5432` 선택 → **Next**
    - 목록에서 `Spatial Extensions` 카테고리 펼치기
    - `PostGIS 3.x for PostgreSQL 16` 체크 → **Next**
    - 다운로드 완료 후 **Next** → PostGIS 설치 마법사 따라 진행
    - 설치 중 `Create spatial database` 물어보면 **No** 선택
14. Stack Builder가 안 떴다면:
    - 윈도우 시작메뉴 → `Stack Builder` 검색 → 직접 실행 후 동일하게 진행

---

## Step 5. GDAL (ogr2ogr) 설치

> 지도 데이터를 DB에 넣을 때 사용하는 도구입니다.

1. https://trac.osgeo.org/osgeo4w/ 접속
2. 페이지에서 **OSGeo4W Network Installer (64 bit)** 다운로드
3. 다운로드된 `osgeo4w-setup.exe` 실행
   > "이 앱이 변경을 허용하겠습니까?" → 예
4. `Express Install (few required packages)` 선택 → **Next**
5. 패키지 목록에서 **`gdal`** 찾아서 클릭해 설치 표시 → **Next**
   > 검색창에 `gdal` 입력하면 바로 찾을 수 있음
6. 라이선스 동의 → **Next** → 설치 진행 (시간이 걸림)
7. 설치 완료 후 **윈도우 시작메뉴에서 `OSGeo4W Shell` 검색** → 실행
8. OSGeo4W Shell에서 확인:
   ```bash
   ogr2ogr --version
   ```
   `GDAL 3.x.x` 출력되면 성공.
   > ogr2ogr는 일반 터미널(Git Bash, PowerShell)에서는 안 될 수 있음.
   > **반드시 OSGeo4W Shell에서 실행**해야 함.

---

## Step 6. Git 설치

1. https://git-scm.com 접속
2. 오른쪽의 **Download for Windows** 클릭
3. 다운로드된 `.exe` 실행
4. 모든 옵션 기본값 유지하며 **Next** 계속 → **Install** → **Finish**
5. 터미널(Git Bash)에서 확인:
   ```bash
   git --version
   ```

---

## Step 7. 프로젝트 클론

1. 원하는 폴더를 탐색기로 열기 (예: `C:\Users\본인이름\projects`)
2. 빈 곳에서 **우클릭 → Git Bash Here** 클릭
3. 아래 명령어 입력:
   ```bash
   git clone https://github.com/hosung5287-creator/Pedal_link.git
   ```
4. 다운로드 완료 후 폴더 진입:
   ```bash
   cd Pedal_link
   ```
5. 브랜치 확인:
   ```bash
   git branch -a
   ```

---

## Step 8. DB 생성 + 테이블 생성

### psql 접속 방법
1. 윈도우 시작메뉴 → `SQL Shell (psql)` 검색 → 실행
2. 아래 항목들이 차례로 뜨는데 **엔터 4번** (기본값 유지):
   ```
   Server [localhost]:         ← 엔터
   Database [postgres]:        ← 엔터
   Port [5432]:                ← 엔터
   Username [postgres]:        ← 엔터
   Password for user postgres: ← pass 입력 후 엔터 (입력해도 화면에 안 보이는 게 정상)
   ```
3. `postgres=#` 프롬프트가 뜨면 접속 성공

### SQL 실행 (아래 내용을 순서대로 복사 붙여넣기)

```sql
CREATE DATABASE "Pedal_link";
```
엔터 후 `CREATE DATABASE` 출력되면 성공.

```sql
\c Pedal_link
```
`You are now connected to database "Pedal_link"` 출력되면 성공.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
`CREATE EXTENSION` 출력되면 성공.

```sql
CREATE TABLE cycleways (
  id       BIGSERIAL PRIMARY KEY,
  name     VARCHAR,
  gu       VARCHAR NOT NULL,
  highway  VARCHAR NOT NULL,
  bicycle  VARCHAR,
  surface  VARCHAR,
  oneway   VARCHAR,
  geom     geometry(LineString, 4326) NOT NULL
);
```
`CREATE TABLE` 출력되면 성공.

```sql
CREATE INDEX idx_cycleways_gu ON cycleways (gu);
```
`CREATE INDEX` 출력되면 성공.

테이블 확인:
```sql
\dt
```
`cycleways` 가 목록에 보이면 완료.

psql 종료:
```sql
\q
```

---

## Step 9. 지도 데이터 임포트 (ogr2ogr)

> **OSGeo4W Shell** 을 사용해야 합니다. 일반 터미널에서는 ogr2ogr를 인식 못할 수 있습니다.

1. 윈도우 시작메뉴 → `OSGeo4W Shell` 실행
2. 프로젝트 루트 폴더로 이동 (클론 받은 위치에 맞게 경로 수정):
   ```bash
   cd C:/Users/본인이름/projects/Pedal_link
   ```
3. 아래 명령어 실행 (한 줄로 입력):
   ```bash
   ogr2ogr -f "PostgreSQL" "PG:host=localhost dbname=Pedal_link user=postgres password=pass" "my-app-front/public/data/seoul_cycleway.geojson" -nln cycleways -nlt LINESTRING -t_srs EPSG:4326 -lco GEOMETRY_NAME=geom -lco FID=id -append
   ```
4. 아무 메시지 없이 프롬프트로 돌아오면 성공
5. psql에서 확인:
   ```sql
   \c Pedal_link
   SELECT COUNT(*) FROM cycleways;
   ```
   `2673` 이 출력되면 성공.

---

## Step 10. 프론트엔드 의존성 설치

Git Bash 또는 일반 터미널에서:

```bash
cd C:/Users/본인이름/projects/Pedal_link/my-app-front
npm install
```

> `node_modules` 폴더가 생기고 터미널이 프롬프트로 돌아오면 완료.
> 시간이 1~3분 걸릴 수 있음. 중간에 경고(warn) 메시지는 무시해도 됨.

---

## Step 11. 백엔드 + 프론트엔드 실행

> 터미널을 **2개** 열어서 각각 실행해야 합니다.

### 터미널 1 — 백엔드

```bash
cd C:/Users/본인이름/projects/Pedal_link/my-app-backend
gradlew bootRun
```

> `my-app-backend` 폴더 안에서 실행하는 거라 `./` 없이 `gradlew bootRun` 만 써도 됩니다.
> 처음 실행 시 Gradle이 의존성을 다운로드해서 3~5분 걸릴 수 있음.
> 아래 메시지가 나오면 성공:
> ```
> Started MyAppBackendApplication in x.xxx seconds
> ```
> 이 터미널은 닫지 말고 그대로 두기.

### 터미널 2 — 프론트엔드

```bash
cd C:/Users/본인이름/projects/Pedal_link/my-app-front
npm start
```

> 잠시 후 브라우저가 자동으로 열리며 http://localhost:3000 접속됨.
> 브라우저가 안 열리면 직접 http://localhost:3000 으로 접속.

---

## 접속 주소

| 구분 | 주소 |
|---|---|
| 프론트엔드 | http://localhost:3000 |
| 백엔드 API | http://localhost:8080 |

---

## 자주 발생하는 오류

| 오류 메시지 | 원인 | 해결 방법 |
|---|---|---|
| `java: command not found` | JAVA_HOME 미설정 | Step 2 다시 확인 |
| `password authentication failed` | DB 비밀번호 불일치 | PostgreSQL 비밀번호를 `pass`로 재설정 |
| `ogr2ogr: command not found` | 일반 터미널 사용 | OSGeo4W Shell에서 실행 |
| `Address already in use: 8080` | 백엔드 이미 실행 중 | 기존 터미널 종료 후 재시작 |
| `npm install` 후 `Module not found` | 의존성 설치 실패 | `npm install` 재실행 |
