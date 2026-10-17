# PedalLink 팜플렛 뒷면용 설계 도식 3장(SVG)을 만든다.
#   architecture.svg  시스템 구성   179.7 x 75 mm
#   flow.svg          라이딩 흐름   179.7 x 35 mm
#   data.svg          데이터 구조   113.7 x 74 mm
# 단위는 mm(viewBox), 글자 크기는 pt 로 적고 pt() 로 mm 로 바꾼다. 색은 팜플렛 테마와 같다.
# 실행: python make_diagrams.py  → 같은 폴더에 SVG 3개. PNG 는 브라우저(Edge)로 4배 렌더링해서 만든다.
import os

HERE = os.path.dirname(os.path.abspath(__file__))

INK, MUTED, LINE, BG2 = '#0C1B27', '#5B7180', '#E5EEF3', '#F4F9FC'
SKY, SKY_L, NAVY, SUN, GREEN = '#0284C7', '#0EA5E9', '#0369A1', '#FFCC4D', '#10B981'
KIND = {  # 채움, 테두리, 강조 글자
    'front': ('#E6F4FD', SKY_L, NAVY),
    'infra': ('#FFF6D9', '#E5A800', '#8A6100'),
    'back': ('#E6F7F0', GREEN, '#047857'),
    'db': ('#E8EFF7', NAVY, NAVY),
    'ext': (BG2, '#9FB1BE', '#334A5A'),
}
SANS = "'Malgun Gothic','맑은 고딕',sans-serif"
MONO = "Consolas,'Courier New',monospace"


def pt(v):
    return round(v * 0.35278, 3)


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


class Svg:
    def __init__(self, w, h):
        self.w, self.h, self.items = w, h, []

    def add(self, s):
        self.items.append(s)

    def rect(self, x, y, w, h, fill, stroke, sw=0.3, r=1.6, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def text(self, x, y, s, size, fill=INK, weight=400, anchor='middle', family=SANS):
        self.add(f'<text x="{x}" y="{y}" font-size="{pt(size)}" font-weight="{weight}" fill="{fill}" '
                 f'text-anchor="{anchor}" dominant-baseline="central" font-family="{family}">{esc(s)}</text>')

    def line(self, pts, color=MUTED, sw=0.35, arrow=True, dash=None):
        p = ' '.join(f'{x},{y}' for x, y in pts)
        m = ' marker-end="url(#arr)"' if arrow else ''
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<polyline points="{p}" fill="none" stroke="{color}" stroke-width="{sw}" '
                 f'stroke-linejoin="round"{d}{m}/>')

    def label(self, x, y, s, size=5.6, fill=MUTED, bg='#FFFFFF', anchor='middle'):
        # 선 위에 얹는 작은 글자 — 뒤에 흰 바탕을 깔아 선과 겹쳐도 읽힌다
        wmm = sum(pt(size) * (1.0 if ord(c) > 0x2E80 else 0.56) for c in s) + 1.2
        x0 = x - wmm / 2 if anchor == 'middle' else (x - 0.6 if anchor == 'start' else x - wmm + 0.6)
        self.add(f'<rect x="{x0:.2f}" y="{y - pt(size) * 0.62:.2f}" width="{wmm:.2f}" height="{pt(size) * 1.24:.2f}" rx="0.6" fill="{bg}"/>')
        self.text(x, y, s, size, fill, 600, anchor)

    def box(self, x, y, w, h, kind, lines, r=1.6):
        """lines: [(글자, pt, 굵기, 색|None, 폰트|None)] — 세로 가운데 정렬"""
        fill, stroke, _ = KIND[kind]
        self.rect(x, y, w, h, fill, stroke, 0.35, r)
        gaps = [pt(sz) * 1.32 for _, sz, *_ in lines]
        total = sum(gaps)
        cy = y + (h - total) / 2
        for (s, sz, wt, col, fam), g in zip(lines, gaps):
            self.text(x + w / 2, cy + g / 2, s, sz, col or INK, wt, 'middle', fam or SANS)
            cy += g

    def save(self, name):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}mm" height="{self.h}mm" '
                f'viewBox="0 0 {self.w} {self.h}">'
                '<defs><marker id="arr" viewBox="0 0 6 6" refX="5.4" refY="3" markerWidth="2.1" markerHeight="2.1" '
                f'markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="{MUTED}"/></marker>'
                '<marker id="arrS" viewBox="0 0 6 6" refX="5.4" refY="3" markerWidth="2.4" markerHeight="2.4" '
                f'markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="{SKY}"/></marker></defs>')
        with open(os.path.join(HERE, name), 'w', encoding='utf-8') as f:
            f.write(head + '\n'.join(self.items) + '</svg>\n')


def T(s, size, weight=400, color=None, family=None):
    return (s, size, weight, color, family)


# ───────── 1) 시스템 구성 ─────────
def architecture():
    g = Svg(179.7, 75)
    # 서버(VM) 영역
    g.rect(45, 3, 132.7, 52, '#FFFFFF', '#B9C7D1', 0.35, 2.4, '1.2 0.9')
    g.text(48, 7.2, 'Rocky Linux 서버 (VM)', 6.4, MUTED, 700, 'start')

    # 연결선 (상자보다 먼저 그려서 상자 뒤로)
    y = 30
    g.line([(38, y), (49.6, y)])
    g.label(43.6, y - 2.6, 'HTTPS', 5.4)
    g.line([(74.2, y), (80.6, y)])
    g.line([(104.2, y), (111.6, y)])
    g.label(107.9, y - 2.6, '프록시', 5.2)
    g.line([(147.2, y), (153.1, y)])
    g.label(150.1, y - 2.6, 'SQL', 5.2)
    # 브라우저 → 외부 서비스 (브라우저가 직접 부른다)
    g.line([(20, 43), (20, 58), (16, 58), (16, 60.6)])
    g.line([(20, 58), (47, 58), (47, 60.6)])
    g.line([(47, 58), (78, 58), (78, 60.6)])
    g.label(31.5, 58, '화면에서 바로 호출', 5.2, bg='#FFFFFF')
    # 백엔드 → Claude
    g.line([(129.5, 51), (129.5, 60.6)])
    g.label(140.6, 57.9, '통계 숫자 → 요약·조언', 5.2)

    g.box(2, 17, 36, 26, 'front', [T('사용자 브라우저', 8, 700), T('PC · 모바일', 6, 400, MUTED),
                                   T('React 19 · Vite', 6.4, 600, NAVY), T('Leaflet 지도', 6.4, 600, NAVY)])
    g.box(50, 19, 24.2, 22, 'infra', [T('Cloudflare', 7.6, 700), T('Tunnel', 7.6, 700), T('외부 공개 HTTPS', 5.8, 400, MUTED)])
    g.box(81, 19, 23.2, 22, 'infra', [T('Nginx', 8, 700), T('화면 파일 제공', 5.8, 400, MUTED), T('/api · /ws 연결', 5.8, 400, MUTED)])

    # 백엔드 — 안쪽 기능 칩
    fill, stroke, accent = KIND['back']
    g.rect(112, 9, 35.2, 42, fill, stroke, 0.35, 1.6)
    g.text(129.6, 14.2, 'Spring Boot 4', 8, INK, 700)
    g.text(129.6, 18.6, 'Java 21', 6, MUTED)
    for i, s in enumerate(['REST API', 'STOMP 실시간 채팅', '실시간 위치 · 메모리 15초', 'JPA · Hibernate Spatial']):
        cy = 22.2 + i * 6.8
        g.rect(114.6, cy, 30, 5.2, '#FFFFFF', '#A7E3CB', 0.25, 1.1)
        g.text(129.6, cy + 2.6, s, 5.9, accent, 600)

    g.box(153.5, 17, 22.6, 26, 'db', [T('PostgreSQL 18', 7.2, 700), T('+ PostGIS', 6.6, 600, NAVY),
                                     T('테이블 18개', 5.8, 400, MUTED), T('공간 쿼리', 5.8, 400, MUTED)])

    # 외부 서비스
    for x, t1, t2 in [(2, 'BRouter', '자전거 경로 · 상승고도'), (33, '카카오 로컬', '장소 검색'), (64, 'OpenStreetMap', '지도 타일')]:
        g.box(x, 61, 28, 12, 'ext', [T(t1, 7, 700), T(t2, 5.6, 400, MUTED)])
    g.box(112, 61, 35.2, 12, 'ext', [T('Claude API (Anthropic)', 7, 700), T('AI 라이딩 리포트 · 한마디 조언', 5.6, 400, MUTED)])

    # 범례
    lx, ly = 154, 59.4
    for i, (k, s) in enumerate([('front', '화면'), ('infra', '서버 연결'), ('back', '백엔드'), ('db', '데이터베이스'), ('ext', '외부 서비스')]):
        fill, stroke, _ = KIND[k]
        yy = ly + i * 3.1
        g.rect(lx, yy - 1, 3.2, 2, fill, stroke, 0.3, 0.5)
        g.text(lx + 4.4, yy, s, 5.4, MUTED, 600, 'start')
    g.save('architecture.svg')


# ───────── 2) 라이딩 흐름 ─────────
def flow():
    g = Svg(179.7, 35)
    steps = [
        ('코스 만들기', '출발 · 경유 · 도착 지정', 'BRouter 경로 · 상승고도', 'routes'),
        ('함께 모이기', '220m 근처 파티 · 매칭', '크루 초대 · 인원 체크', 'parties · crew_events'),
        ('함께 달리기', '실시간 위치 3초 공유', '채팅 · 근접 알림', '메모리 · chat_messages'),
        ('기록 남기기', '거리 · 시간 · 상승고도', '탄 거리만큼 인정', 'ride_records'),
        ('돌아보기', 'AI 리포트 · 한마디 조언', '피드 공유 · 북마크', 'ride_insights · ride_tips'),
    ]
    w, gap = 32.5, (179.7 - 5 * 32.5) / 4
    for i, (title, l1, l2, store) in enumerate(steps):
        x = i * (w + gap)
        g.rect(x + 0.2, 0.6, w - 0.4, 23.4, '#FFFFFF', '#BFE3F7', 0.35, 1.8)
        g.add(f'<circle cx="{x + 5}" cy="6.2" r="2.6" fill="{SKY}"/>')
        g.text(x + 5, 6.25, f'{i + 1:02d}', 5.6, '#FFFFFF', 700)
        g.text(x + 9.2, 6.3, title, 8.2, INK, 700, 'start')
        g.text(x + w / 2, 13.4, l1, 6.1, INK, 400)
        g.text(x + w / 2, 18.4, l2, 6.1, MUTED, 400)
        # 저장되는 곳
        fill, stroke, accent = KIND['db']
        g.line([(x + w / 2, 24), (x + w / 2, 27)], NAVY, 0.3, arrow=False, dash='0.6 0.5')
        g.rect(x + 1.2, 27.2, w - 2.4, 5.6, fill, '#B7CBDE', 0.3, 1.2)
        g.text(x + w / 2, 30.05, store, 5.5, accent, 600, 'middle', MONO if '메모리' not in store else SANS)
        if i < 4:
            cx = x + w + gap / 2
            g.add(f'<path d="M{cx - 0.9},9.6 L{cx + 1.1},12.3 L{cx - 0.9},15" fill="none" stroke="{SKY}" '
                  'stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"/>')
    g.save('flow.svg')


# ───────── 3) 데이터 구조 (테이블 18개를 5묶음으로) ─────────
def data():
    g = Svg(113.7, 74)

    def group(x, y, w, h, kind, title, chips, cols=1, colw=None):
        fill, stroke, accent = KIND[kind]
        g.rect(x, y, w, h, fill, stroke, 0.35, 1.8)
        g.text(x + 2.2, y + 3.6, title, 7, accent, 700, 'start')
        colw = colw or [(w - 4.4 - (cols - 1) * 1.2) / cols] * cols
        for i, c in enumerate(chips):
            col, row = i % cols, i // cols
            cx = x + 2.2 + sum(colw[:col]) + col * 1.2
            cy = y + 7.2 + row * 5.5
            g.rect(cx, cy, colw[col], 4.5, '#FFFFFF', stroke, 0.25, 0.9)
            g.text(cx + 1.4, cy + 2.27, c, 5.5, INK, 600, 'start', MONO)

    # 연결선 (users 에서 네 묶음으로, 상자 뒤에 깔린다)
    hub = (56.85, 37)
    for gx, gy in [(22, 13), (91.7, 13), (22, 61), (91.7, 61)]:
        g.line([hub, (gx, gy)], '#9FB1BE', 0.45, arrow=False)
    # 지도 데이터 → 코스 (구 판정)
    g.line([(17.8, 30.6), (17.8, 25.4)], MUTED, 0.35)
    g.label(25.6, 28.1, '구 판정', 5.2, bg='#FFFFFF')
    # 기록 → 코스 (탄 코스)
    g.line([(70.5, 9.6), (43.6, 9.6)], MUTED, 0.35)
    g.label(57, 7.1, '탄 코스 연결', 5.2, bg='#FFFFFF')
    # 크루 라이딩 → 파티
    g.line([(70.5, 65.5), (43.6, 65.5)], MUTED, 0.35)
    g.label(57, 62.9, '크루 라이딩 시작', 5.2, bg='#FFFFFF')
    g.label(57, 68.2, '= 파티 생성', 5.2, bg='#FFFFFF')
    # 실시간 위치 → 파티·크루 판정
    g.line([(95.9, 43.6), (95.9, 48.4)], MUTED, 0.35, dash='0.8 0.6')

    group(0.8, 1, 42.4, 24.4, 'front', '코스 · 게시물', ['routes', 'route_likes', 'route_bookmarks'])
    group(70.5, 1, 42.4, 24.4, 'back', '라이딩 기록 · AI 분석', ['ride_records', 'ride_insights', 'ride_tips'])
    group(0.8, 48.6, 42.4, 24.4, 'infra', '파티 · 매칭', ['parties', 'party_members', 'chat_messages', 'match_requests'], 2, [16.4, 20.4])
    group(70.5, 48.6, 42.4, 24.4, 'db', '크루', ['crews', 'crew_event_members', 'crew_members', 'crew_chat_messages', 'crew_events'], 2, [15, 21.8])

    # 지도 데이터
    fill, stroke, accent = KIND['ext']
    g.rect(0.8, 30.6, 34, 12.8, fill, stroke, 0.35, 1.6)
    g.text(3, 34, '지도 데이터', 7, accent, 700, 'start')
    for i, c in enumerate(['cycleways', 'seoul_gu']):
        cx = 3 + i * 15.4
        g.rect(cx, 36.8, [14.4, 13][i], 4.5, '#FFFFFF', stroke, 0.25, 0.9)
        g.text(cx + 1.3, 39.07, c, 5.5, INK, 600, 'start', MONO)

    # 실시간 위치 (DB 아님)
    g.rect(78.9, 30.6, 34, 12.8, '#FFFFFF', '#9FB1BE', 0.35, 1.6, '1 0.7')
    g.text(81, 34, '실시간 위치', 7, '#334A5A', 700, 'start')
    g.text(81, 38.6, 'DB 아님 · 서버 메모리 15초', 5.6, MUTED, 400, 'start')
    g.text(81, 41.4, '220m 판정에 사용', 5.6, MUTED, 400, 'start')

    # users (가운데)
    g.rect(44.6, 30.6, 24.5, 12.8, '#FFFFFF', INK, 0.45, 1.8)
    g.text(56.85, 35, 'users', 8, INK, 700, 'middle', MONO)
    g.text(56.85, 39.6, '회원 · 프로필', 5.8, MUTED)
    g.save('data.svg')


if __name__ == '__main__':
    architecture()
    flow()
    data()
    print('saved: architecture.svg, flow.svg, data.svg')
