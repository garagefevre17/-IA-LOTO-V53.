import tempfile
import unittest
from pathlib import Path
from code_integrity import FILES, snapshot, check


class CodeBaselineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name in FILES:
            p = self.root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(name.encode())

    def test_valid_baseline(self):
        self.assertTrue(check(self.root, snapshot(self.root)))

    def test_modified_code_fails(self):
        baseline = snapshot(self.root)
        (self.root / 'app.js').write_text('changed')
        self.assertFalse(check(self.root, baseline))

    def test_missing_code_fails(self):
        baseline = snapshot(self.root)
        (self.root / 'index.html').unlink()
        self.assertFalse(check(self.root, baseline))

    def test_mutable_csv_does_not_invalidate_code(self):
        baseline = snapshot(self.root)
        (self.root / 'loto_201911.csv').write_text('new draw')
        self.assertTrue(check(self.root, baseline))

    def test_changed_baseline_fails(self):
        baseline = snapshot(self.root)
        baseline['sha256']['app.js'] = '0'*64
        self.assertFalse(check(self.root, baseline))
