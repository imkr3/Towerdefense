"""Ensure both APKs contain the exact web sources tested by this checkout."""
from pathlib import Path
from zipfile import ZipFile
import json

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
for build in ('debug', 'release'):
    apk = root / f'android/app/build/outputs/apk/{build}/app-{build}.apk'
    with ZipFile(apk) as z:
        sources = [root / name for name in ('index.html', 'manifest.json', 'icon.svg')]
        sources += list((root / 'js').rglob('*.js')) + list((root / 'css').rglob('*.css'))
        for src in sources:
            embedded = 'assets/www/' + src.relative_to(root).as_posix()
            assert z.read(embedded) == src.read_bytes(), f'{build}: stale/missing {embedded}'
        assert 'assets/www/sw.js' not in z.namelist(), 'WebView must not package the service worker'
    print(f'{apk.name}: {len(sources)} source files match, version {version}, {apk.stat().st_size:,} bytes')
