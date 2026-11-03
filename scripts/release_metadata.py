#!/usr/bin/env python3
"""Generate the release manifest after the final APK has been signed."""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
ANDROID = '{http://schemas.android.com/apk/res/android}'
manifest = ET.parse(ROOT / 'android/AndroidManifest.xml').getroot()
version = manifest.get(ANDROID + 'versionName')
apk = ROOT / 'dist' / f'FlipClock-{version}.apk'
sha = hashlib.sha256(apk.read_bytes()).hexdigest()
metadata = {'versionCode': int(manifest.get(ANDROID + 'versionCode')),
            'versionName': version, 'minSdk': 26, 'apk': apk.name, 'sha256': sha}
(apk.parent / 'update.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
(apk.parent / 'SHA256SUMS.txt').write_text(f'{sha}  {apk.name}\n')
print(f'Release assets: {apk.name}, update.json, SHA256SUMS.txt')
