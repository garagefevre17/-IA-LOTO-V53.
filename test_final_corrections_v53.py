"""Regression checks for first-run publication and orphan data rejection."""
import subprocess
import tempfile
import unittest
from pathlib import Path
from evaluate import reject_orphan_assessments

class FinalCorrectionsTests(unittest.TestCase):
    def test_production_stages_only_automation_outputs(self):
        workflow = Path('.github/workflows/ia-loto-autonome.yml').read_text()
        self.assertIn('git add -- automatisation/', workflow)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(['git', 'init', '-q'], cwd=root, check=True)
            (root/'loto_201911.csv').write_text('example')
            (root/'automatisation').mkdir()
            (root/'automatisation'/'tableau.json').write_text('{}')
            subprocess.run(['git','add','--','automatisation/'],cwd=root,check=True)
            tracked = subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root,text=True)
            self.assertEqual(tracked.splitlines(), ['automatisation/tableau.json'])
    def test_orphan_result_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); (root/'results').mkdir()
            (root/'results'/'loto-2026-11-21.json').write_text('{}')
            with self.assertRaisesRegex(ValueError, 'Orphan assessment'):
                reject_orphan_assessments(root)
            (root/'loto-2026-11-21.json').write_text('{}')
            reject_orphan_assessments(root)

if __name__=='__main__': unittest.main()
