# PedalLink 설계 문서(../PedalLink_설계.html)를 만든다.
#   ER 관계도  — 로컬 DB(Pedal_link)의 실제 스키마(테이블·컬럼·NOT NULL·PK·FK)를 읽어 그린다.
#                코드에서만 연결되는 논리 참조와 테이블 설명·배치는 아래 설정에 적는다.
#   데이터 흐름·아키텍처·워크플로 — archify 로 만든 HTML 3개를 그대로 넣는다(탭을 열 때 풀어서 보여 줌).
#
# 순서
#   1) archify 로 다이어그램 3개를 만든다 (README.md 참고)  → build/arch.html, build/flow.html, build/wf.html
#   2) python build_design.py                              → ../PedalLink_설계.html
#      DB 접속: PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE (기본 localhost:5432 postgres/pass/Pedal_link)
#      다른 위치의 다이어그램을 쓰려면 --arch --flow --wf 로 경로를 준다.
import argparse
import base64
import datetime
import html
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))

GROUPS = [  # (키, 범례 이름)
    ('user', '사용자'), ('course', '코스'), ('ai', 'AI 분석'), ('party', '파티'), ('crew', '크루'), ('geo', '지리'),
]

# 테이블 → (묶음, 한 줄 설명)
TABLES = {
    'routes': ('course', '저장 코스 — [게시물 올리기]하면 피드 공개(published_at) · 경로·경유지·지역'),
    'cycleways': ('geo', '서울 자전거도로 (GeoJSON 임포트)'),
    'route_likes': ('course', '피드 좋아요'),
    'route_bookmarks': ('course', '피드 북마크 — 남의 코스를 내 코스 목록에 저장'),
    'ride_records': ('course', '라이딩 기록 (상승고도는 routes 조인, 탄 거리만큼)'),
    'seoul_gu': ('geo', '서울 구 경계 — 코스 지역 판정'),
    'users': ('user', '회원 · 프로필 · 위치 공유 설정'),
    'ride_insights': ('ai', 'AI 라이딩 리포트 — 사용자당 1행, 기록이 바뀌면 다시 분석'),
    'ride_tips': ('ai', '통계 카드 한마디 조언 — 통계가 바뀌면 새로 작성'),
    'parties': ('party', '파티(링크) 모집 · 라이딩 — 크루 라이딩도 파티로 진행'),
    'party_members': ('party', '파티 참여·신청 (pending · joined · rejected · kicked)'),
    'chat_messages': ('party', '파티 채팅'),
    'match_requests': ('party', '근처 라이더 1:1 매칭 신청'),
    'crews': ('crew', '크루(동호회) — 가입 방식 approval · open · closed'),
    'crew_members': ('crew', '크루 가입'),
    'crew_chat_messages': ('crew', '크루 채팅 (RIDE_INVITE 카드 포함)'),
    'crew_events': ('crew', '크루 라이딩 (이번주 라이딩) — 끝남은 연결 파티로 판단'),
    'crew_event_members': ('crew', '초대 · 참여 응답 · 토큰 · 인원 체크'),
}

# 화면 배치 — 열마다 위에서 아래로. 관계선이 짧게 나오도록 서로 많이 잇는 테이블을 이웃 열에 둔다.
LAYOUT = [
    ['routes', 'cycleways'],
    ['route_likes', 'route_bookmarks', 'ride_records', 'seoul_gu'],
    ['users', 'ride_insights', 'ride_tips'],
    ['parties', 'party_members', 'chat_messages', 'match_requests'],
    ['crews', 'crew_members', 'crew_chat_messages'],
    ['crew_events', 'crew_event_members'],
]

# 코드에서만 연결되는 참조 (엔티티가 @ManyToOne 대신 숫자 id 만 들고 있어 DB 에 FK 가 없다)
LOGICAL = [
    ('routes', 'user_id', 'users'),
    ('route_likes', 'route_id', 'routes'), ('route_likes', 'user_id', 'users'),
    ('ride_records', 'user_id', 'users'), ('ride_records', 'route_id', 'routes'), ('ride_records', 'party_id', 'parties'),
    ('ride_insights', 'last_ride_id', 'ride_records'),
    ('match_requests', 'party_id', 'parties'),
    ('chat_messages', 'room_id', 'parties'), ('chat_messages', 'sender_id', 'users'),
    ('crew_events', 'route_id', 'routes'), ('crew_events', 'party_id', 'parties'),
    ('crew_chat_messages', 'crew_id', 'crews'), ('crew_chat_messages', 'sender_id', 'users'),
]

NOTES = [
    ('논리 참조가 많은 이유',
     '엔티티가 <code>@ManyToOne</code> 대신 <code>Long routeId</code> 처럼 숫자 id 만 들고 있는 곳은 FK 제약이 생기지 않는다. '
     '코스·라이딩 기록·채팅이 해당 — 지워진 코스를 가리켜도 DB 가 막지 않으므로 서비스 코드가 null 을 처리한다. '
     '<code>ride_insights.last_ride_id</code> 는 "어느 기록까지 분석했는지" 표시용이다.'),
    ('DB 에 없는 데이터',
     '실시간 위치는 테이블이 아니라 서버 메모리(<code>LiveLocationService</code>, 15초 만료)에 있다. 위치 공유를 끄면 즉시 지워진다. '
     'AI 분석용 API 키는 <code>my-app-backend/.env</code> 에만 있고 저장소·DB 에 넣지 않는다.'),
    ('정리한 테이블',
     '<code>posts · comments · likes · hashtags · post_images · saved_posts</code> 는 예전 설계의 흔적(0건, 연결된 엔티티 없음)이라 '
     '마이그레이션 011 에서 지웠다. <code>spatial_ref_sys</code> 는 PostGIS 시스템 테이블이라 그리지 않았다.'),
    ('마이그레이션',
     '005 <code>seoul_gu</code> · 006 <code>routes.waypoints</code> · 007 크루 라이딩 · 008 인덱스 · 009 <code>ride_insights</code> · '
     '010 <code>ride_tips</code> · 011 안 쓰는 테이블 삭제 · 012 <code>route_bookmarks</code> · 013 <code>routes.published_at</code> · '
     '014 멈춘 크루 라이딩 정리. VM 은 <code>ddl-auto=validate</code> 라 006·007·009·010·012·013 필수.'),
]


def load_schema(path=None):
    if path:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    env = dict(os.environ)
    env.setdefault('PGPASSWORD', 'pass')
    env['PGCLIENTENCODING'] = 'UTF8'
    cmd = ['psql', '-h', env.get('PGHOST', 'localhost'), '-p', env.get('PGPORT', '5432'),
           '-U', env.get('PGUSER', 'postgres'), '-d', env.get('PGDATABASE', 'Pedal_link'),
           '-tA', '-f', os.path.join(HERE, 'schema.sql')]
    out = subprocess.run(cmd, env=env, capture_output=True, check=True)
    return json.loads(out.stdout.decode('utf-8'))


def esc(s):
    return html.escape(str(s), quote=True)


def table_html(t, fks, logical):
    group, desc = TABLES[t['name']]
    rows = []
    for c in t['cols']:
        name = c['name']
        badges = ''
        if name in (t['pk'] or []):
            badges += '<span class="b pk">PK</span>'
        if (t['name'], name) in fks:
            badges += f'<span class="b fk" title="→ {esc(fks[(t["name"], name)])}">FK</span>'
        elif (t['name'], name) in logical:
            badges += f'<span class="b logical" title="→ {esc(logical[(t["name"], name)])}">ref</span>'
        nn = '<span class="nn" title="NOT NULL">*</span>' if c['notnull'] else ''
        rows.append(f'<li data-col="{esc(name)}"><span class="cn">{esc(name)}{nn}</span>{badges}<span class="ty">{esc(c["type"])}</span></li>')
    label = dict(GROUPS)[group]
    return (f'<article class="tbl g-{group}" id="t-{esc(t["name"])}" data-table="{esc(t["name"])}">'
            f'<header><strong>{esc(t["name"])}</strong><span class="grp">{esc(label)}</span></header>'
            f'<p class="desc">{esc(desc)}</p><ul>{"".join(rows)}</ul>'
            f'<footer>{len(t["cols"])} columns</footer></article>')


def build(args):
    schema = load_schema(args.schema)
    tables = {t['name']: t for t in schema['tables']}

    # 설정과 실제 DB 가 어긋나면 바로 알린다 (테이블이 생기거나 사라졌을 때 문서가 조용히 틀리지 않게)
    db_names, cfg_names = set(tables), set(TABLES)
    placed = [n for col in LAYOUT for n in col]
    problems = []
    if db_names - cfg_names: problems.append(f'설정에 없는 테이블: {sorted(db_names - cfg_names)}')
    if cfg_names - db_names: problems.append(f'DB 에 없는 테이블: {sorted(cfg_names - db_names)}')
    if sorted(placed) != sorted(cfg_names): problems.append('LAYOUT 과 TABLES 목록이 다르다')
    cols = {(t, c['name']) for t, v in tables.items() for c in v['cols']}
    for f, c, to in LOGICAL:
        if (f, c) not in cols: problems.append(f'논리 참조 컬럼 없음: {f}.{c}')
    if problems:
        raise SystemExit('설정 확인 필요:\n- ' + '\n- '.join(problems))

    fks = {(f['from'], f['col']): f['to'] for f in schema['fks']}
    logical = {(f, c): to for f, c, to in LOGICAL if (f, c) not in fks}
    rels = [{'from': f, 'col': c, 'to': to, 'kind': 'fk'} for (f, c), to in fks.items()]
    rels += [{'from': f, 'col': c, 'to': to, 'kind': 'logical'} for (f, c), to in logical.items()]

    columns = ''.join('<div class="col">' + ''.join(table_html(tables[n], fks, logical) for n in col) + '</div>' for col in LAYOUT)
    legend = '\n      '.join(f'<span><span class="dot" style="background:var(--g-{k})"></span>{esc(v)}</span>' for k, v in GROUPS)
    notes = '\n      '.join(f'<div class="note"><strong>{esc(t)}</strong>{body}</div>' for t, body in NOTES)
    summary = (f'테이블 {len(tables)}개 · FK 제약 {len(fks)}개 · 논리 참조 {len(logical)}개 — '
               '테이블에 마우스를 올리면(탭하면) 그 테이블의 관계만 강조됩니다.')
    meta = f'{args.date} · {esc(args.branch)} 기준 · DB 스키마는 로컬 Pedal_link 에서 추출'

    def embed(path):
        with open(path, 'rb') as f:
            return base64.b64encode(f.read()).decode('ascii')

    with open(os.path.join(HERE, 'shell.template.html'), encoding='utf-8') as f:
        page = f.read()
    for key, value in [('<!--META-->', meta), ('<!--ER_SUMMARY-->', summary), ('<!--LEGEND_GROUPS-->', legend),
                       ('<!--ER_COLUMNS-->', columns), ('<!--NOTES-->', notes),
                       ('/*RELS*/[]', json.dumps(rels, ensure_ascii=False)),
                       ('__FLOW__', embed(args.flow)), ('__ARCH__', embed(args.arch)), ('__WF__', embed(args.wf))]:
        assert page.count(key) == 1, key
        page = page.replace(key, value)
    with open(args.out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(page)
    print(f'saved {os.path.normpath(args.out)}  ({len(tables)} tables, {len(fks)} FK, {len(logical)} logical, {len(page):,} chars)')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--schema', help='psql 대신 미리 뽑아 둔 schema.json 을 쓴다')
    p.add_argument('--arch', default=os.path.join(HERE, 'build', 'arch.html'))
    p.add_argument('--flow', default=os.path.join(HERE, 'build', 'flow.html'))
    p.add_argument('--wf', default=os.path.join(HERE, 'build', 'wf.html'))
    p.add_argument('--out', default=os.path.join(HERE, '..', 'PedalLink_설계.html'))
    p.add_argument('--date', default=datetime.date.today().isoformat())
    p.add_argument('--branch', default='main 브랜치(khs·ys 머지 후)')
    build(p.parse_args())
