#!/usr/bin/env python3
"""Book verifier.

Usage: python3 tools/verify_book.py <pinned harness checkout>

Checks, failing with a non-zero exit on any problem:
  1. appendix/citations.generated.md equals a fresh run of tools/citations.py.
  2. Every reference-style citation `[text][id]` in book/ and appendix/ has a definition block
     identical to what tools/refdefs.py would write (no unknown or stale ids).
  3. Every relative Markdown link points at an existing file, and every `#anchor` into a
     book file exists as an explicit `<a id>` or a heading slug.
  4. Every pinned GitHub permalink names the pinned SHA, an existing file in the checkout,
     and a line range inside that file.
"""
import re, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHA = 'fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159'
PERMA = re.compile(r'https://github\.com/deepseek-ai/deepseek-harness/(?:blob|tree)/([0-9a-f]{40})/([^)#\s`]*)(?:#L(\d+)(?:-L(\d+))?)?')
LINK = re.compile(r'(?<!!)\[[^\]]*\]\(([^)\s]+)\)')

def md_files():
    files = [ROOT / 'README.md', ROOT / 'labs' / 'README.md']
    files += sorted((ROOT / 'book').glob('*.md')) + sorted((ROOT / 'appendix').glob('*.md'))
    files += sorted((ROOT / 'story').glob('*.md'))
    files += sorted((ROOT / 'labs').rglob('*.md'))
    return list(dict.fromkeys(files))

def slug(heading):
    s = heading.strip().lower()
    s = re.sub(r'[^\w\- ઀-૿]', '', s)
    return s.replace(' ', '-')

def anchors(path):
    text = path.read_text(encoding='utf-8')
    ids = set(re.findall(r'<a id="([^"]+)"', text))
    for line in text.splitlines():
        m = re.match(r'#{1,6} (.+)', line)
        if m:
            ids.add(slug(m.group(1)))
    return ids

def main():
    harness = pathlib.Path(sys.argv[1]).resolve()
    errors = []

    fresh = subprocess.run([sys.executable, str(ROOT / 'tools' / 'citations.py'), str(harness)], capture_output=True, text=True)
    if fresh.returncode != 0:
        errors.append(f'citations.py failed: {fresh.stderr.strip()}')
    elif fresh.stdout != (ROOT / 'appendix' / 'citations.generated.md').read_text(encoding='utf-8'):
        errors.append('appendix/citations.generated.md is stale; regenerate it')

    chapters = sorted((ROOT / 'book').glob('*.md')) + sorted((ROOT / 'appendix').glob('*.md')) + sorted((ROOT / 'story').glob('*.md'))
    before = {p: p.read_text(encoding='utf-8') for p in chapters}
    rd = subprocess.run([sys.executable, str(ROOT / 'tools' / 'refdefs.py'), *map(str, chapters)], capture_output=True, text=True)
    if rd.returncode != 0:
        errors.append(f'refdefs.py: {rd.stderr.strip()}')
    for p, old in before.items():
        if p.read_text(encoding='utf-8') != old:
            errors.append(f'{p.relative_to(ROOT)}: citation block was stale (now rewritten; review and commit)')

    citations = 0
    links = 0
    for path in md_files():
        text = path.read_text(encoding='utf-8')
        body = re.sub(r'```.*?```', '', text, flags=re.S)
        for target in LINK.findall(body):
            if target.startswith(('http://', 'https://', 'mailto:')):
                continue
            links += 1
            file_part, _, anchor = target.partition('#')
            dest = (path.parent / file_part).resolve() if file_part else path
            if not dest.exists():
                errors.append(f'{path.relative_to(ROOT)}: missing link target {target}')
                continue
            if anchor and dest.suffix == '.md' and anchor not in anchors(dest):
                errors.append(f'{path.relative_to(ROOT)}: missing anchor #{anchor} in {dest.relative_to(ROOT)}')
        for m in PERMA.finditer(text):
            citations += 1
            sha, rel, a, b = m.group(1), m.group(2), m.group(3), m.group(4)
            if sha != SHA:
                errors.append(f'{path.relative_to(ROOT)}: permalink uses {sha[:7]}, not the pinned SHA')
                continue
            target = harness / rel
            if rel and not target.exists():
                errors.append(f'{path.relative_to(ROOT)}: permalink file missing in checkout: {rel}')
                continue
            if a:
                n = len(target.read_text(encoding='utf-8').splitlines())
                lo, hi = int(a), int(b or a)
                if not (1 <= lo <= hi <= n):
                    errors.append(f'{path.relative_to(ROOT)}: {rel}#L{a}-L{b} outside 1..{n}')

    for e in errors:
        print('ERROR', e)
    print(f'verify_book: {len(md_files())} files, {links} relative links, {citations} permalinks, {len(errors)} error(s)')
    sys.exit(1 if errors else 0)

if __name__ == '__main__':
    main()
