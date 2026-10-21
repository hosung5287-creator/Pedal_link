# PedalLink 설계 문서 원본

`../PedalLink_설계.html`(ER 관계도 · 데이터 흐름 · 아키텍처 · 워크플로 4탭)을 다시 만들 때 쓰는 원본이다.

| 파일 | 내용 |
|---|---|
| `build_design.py` | 설계 HTML 을 만드는 스크립트. ER 은 로컬 DB 스키마를 읽어 그리고, 나머지 3탭은 archify 결과를 넣는다 |
| `shell.template.html` | 설계 HTML 의 틀(탭·ER 화면·스타일). `<!--...-->` 자리를 스크립트가 채운다 |
| `schema.sql` | DB 에서 테이블·컬럼·NOT NULL·PK·FK 를 뽑는 쿼리 |
| `architecture.json` | 아키텍처 탭 archify 원본 |
| `dataflow.json` | 데이터 흐름 탭 archify 원본 |
| `workflow.json` | 워크플로 탭 archify 원본 |

## 다시 만들기

1. 다이어그램 3개를 archify 로 만든다. archify 는 Claude Code 스킬(`~/.claude/skills/archify`)이다.
   ```bash
   cd ~/.claude/skills/archify
   node bin/archify.mjs deliver architecture <원본>/architecture.json <원본>/build/arch.html --quality showcase
   node bin/archify.mjs deliver dataflow     <원본>/dataflow.json     <원본>/build/flow.html --quality showcase
   node bin/archify.mjs deliver workflow     <원본>/workflow.json     <원본>/build/wf.html   --quality showcase
   ```
   JSON 을 고쳤으면 먼저 `node bin/archify.mjs validate <type> <json> --quality showcase` 로 확인한다.
2. 로컬 DB(PostgreSQL `Pedal_link`)가 켜진 상태에서 실행한다.
   ```bash
   python build_design.py
   ```
   - DB 접속은 `PGHOST`·`PGUSER`·`PGPASSWORD`·`PGDATABASE` 환경변수(기본 localhost · postgres · pass · Pedal_link).
   - 테이블이 생기거나 사라지면 스크립트가 멈추고 알려 준다. `build_design.py` 위쪽의 `TABLES`(묶음·설명) · `LAYOUT`(배치) · `LOGICAL`(코드에서만 잇는 참조)에 추가하면 된다.
   - `build/` 는 만들어지는 결과물이라 지워도 된다.

## 참고

- archify 화면의 버튼 글자(Guided views, Play story, Export 등)는 영어로 고정이다. archify 가 한국어 화면 문구를 지원하지 않는다(영어·중국어만). 다이어그램 안 글자는 한국어다.
- ER 의 행 수는 넣지 않는다. 개발 DB 의 행 수(더미 데이터 포함)는 설계 정보가 아니고 금방 틀린 값이 된다.
