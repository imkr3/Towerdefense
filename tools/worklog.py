#!/usr/bin/env python3
"""WORKLOG.md 의 6절(버전별 상세 · README 변경 기록) · 7절(커밋 기록 전체)을 다시 뽑는다.

1~5절(사람이 쓰는 요약 · 작업 일지)은 그대로 두고, 그 뒤만 README 와 git log 에서 새로 만든다.
쓰기:  python3 tools/worklog.py
"""
import os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAILERS = ('Co-Authored-By', 'Claude-Session', 'Generated with', 'https://claude.ai/code')


def sh(*a):
    return subprocess.run(a, cwd=ROOT, capture_output=True, text=True).stdout


def commits():
    raw = sh('git', 'log', '--reverse', '--format=%x1e%h%x1f%ad%x1f%s%x1f%b', '--date=short')
    out = []
    for rec in raw.split('\x1e'):
        if not rec.strip():
            continue
        h, d, s, b = (rec.split('\x1f') + ['', '', '', ''])[:4]
        body = [l.rstrip() for l in b.splitlines() if l.strip() and not any(t in l for t in TRAILERS)]
        out.append((h, d, s, body))
    return out


def notes_at(h):
    """그 커밋 때의 릴리스 노트 맨 앞 판 (본문 없는 릴리스 커밋에 붙인다)"""
    lines = []
    for i, l in enumerate(sh('git', 'show', h + ':.github/release-notes.md').splitlines()):
        if i > 0 and re.match(r'^## .*의 내용', l):
            break
        if l.strip():
            lines.append(l)
    return lines


def readme_sections():
    rd = open(os.path.join(ROOT, 'README.md'), encoding='utf-8').read().splitlines()
    start = next(i for i, l in enumerate(rd) if re.match(r'^## \d+\.\d+(\.\d+)? — ', l))
    secs, cur = [], None
    for l in rd[start:]:
        if l.startswith('## '):
            cur = [l]
            secs.append(cur)
        elif cur is not None:
            cur.append(l)
    secs.reverse()                      # 오래된 것부터
    return secs


def main():
    path = os.path.join(ROOT, 'WORKLOG.md')
    text = open(path, encoding='utf-8').read()
    cut = text.find('\n---\n\n## 6.')
    head = (text[:cut] if cut >= 0 else text).rstrip()
    o = [head + '\n', '\n---\n\n## 6. 버전별 상세 기록 (README 변경 기록, 오래된 것부터)\n',
         '3.2.1 이후 버전마다 README 에 남긴 설명을 그대로 옮겼다. 그보다 앞선 1.x~3.2 는 아래 7번(커밋 기록)에 자세히 있다.\n']
    for s in readme_sections():
        o.append('\n### ' + s[0][3:])
        o.extend('#' + l if l.startswith('### ') else l for l in s[1:])
    cs = commits()
    rn = set(sh('git', 'log', '--format=%h', '--', '.github/release-notes.md').split())
    o.append('\n---\n\n## 7. 커밋 기록 전체 (오래된 것부터, %d개)\n' % len(cs))
    o.append('커밋마다 날짜 · 해시 · 제목 · 본문. 본문이 없는 릴리스 커밋은 그때의 릴리스 노트를 붙였다.\n')
    last = None
    for h, d, s, body in cs:
        if d != last:
            o.append('\n### ' + d)
            last = d
        o.append('\n- **' + s + '** (`' + h + '`)')
        if body:
            o.extend('  ' + (l if l.lstrip().startswith('-') else '  ' + l) for l in body)
        elif h in rn:
            n = notes_at(h)
            if n:
                o.append('  - (그때의 릴리스 노트)')
                o.extend('    ' + re.sub(r'^#+ ', '■ ', l) for l in n)
    open(path, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
    print('WORKLOG.md: README %d절 · 커밋 %d개' % (len(readme_sections()), len(cs)))


if __name__ == '__main__':
    main()
