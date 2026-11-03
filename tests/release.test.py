import hashlib
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent.parent
class ReleaseTest(unittest.TestCase):
    def test_signed_asset_metadata_matches_current_sources(self):
        metadata=json.loads((ROOT/'dist/update.json').read_text())
        apk=ROOT/'dist'/metadata['apk']
        self.assertEqual(hashlib.sha256(apk.read_bytes()).hexdigest(),metadata['sha256'])
        manifest=ET.parse(ROOT/'android/AndroidManifest.xml').getroot()
        self.assertEqual(int(manifest.get('{http://schemas.android.com/apk/res/android}versionCode')), metadata['versionCode'])
        with zipfile.ZipFile(apk) as z:
            self.assertIsNone(z.testzip())
            self.assertIn('classes.dex',z.namelist())
            for name in ['app.js','index.html','style.css']:
                self.assertEqual(z.read('assets/'+name),(ROOT/'web'/name).read_bytes())
            self.assertFalse(any('.signing' in n or '.p12' in n or 'password' in n for n in z.namelist()))
if __name__=='__main__': unittest.main()
