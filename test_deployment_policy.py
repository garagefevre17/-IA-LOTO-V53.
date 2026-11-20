"""Prevent regressions in production-gating/deployment policy without PyYAML dependency."""
import unittest
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[1] / '.github/workflows/ia-loto-autonome.yml'

class DeploymentPolicyTests(unittest.TestCase):
    def test_production_requires_explicit_repo_variable(self):
        text = WORKFLOW.read_text(encoding='utf-8')
        self.assertIn("vars.IA_LOTO_PRODUCTION_ENABLED == 'true'", text)
        self.assertIn("github.ref == 'refs/heads/main'", text)
        self.assertIn('contents: write', text)

    def test_validation_mode_cannot_publish(self):
        text = WORKFLOW.read_text(encoding='utf-8')
        section = text.split('\n  validation-reelle:', 1)[1].split('\n  production:', 1)[0]
        self.assertIn("inputs.mode == 'validation'", section)
        self.assertIn('persist-credentials: false', section)
        self.assertNotIn('git push', section)
        self.assertNotIn('contents: write', section)

if __name__ == '__main__':
    unittest.main()
