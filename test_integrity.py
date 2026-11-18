import json
import tempfile
import unittest
from pathlib import Path
from integrity import REQUIRED, inventory, verify


class IntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in REQUIRED:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(name.encode())

    def test_complete_inventory(self):
        self.assertTrue(verify(self.root, inventory(self.root)))

    def test_detects_tampering(self):
        report = inventory(self.root)
        (self.root / 'app.js').write_text('tampered')
        self.assertFalse(verify(self.root, report))

    def test_detects_missing_file(self):
        report = inventory(self.root)
        (self.root / 'index.html').unlink()
        self.assertFalse(verify(self.root, report))

    def test_rejects_modified_manifest(self):
        report = json.loads(json.dumps(inventory(self.root)))
        report['files'][0]['sha256'] = '0' * 64
        self.assertFalse(verify(self.root, report))

    def test_rejects_unrecognized_schema(self):
        report = inventory(self.root)
        report['schema'] = 2
        self.assertFalse(verify(self.root, report))
