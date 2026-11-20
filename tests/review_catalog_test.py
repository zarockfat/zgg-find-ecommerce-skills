"""Verify that upstream changes cannot silently replace reviewed catalog entries."""
import copy
import hashlib
import importlib.util
import pathlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('review_catalog', pathlib.Path(__file__).resolve().parents[1] / 'scripts/review_catalog.py')
reviewer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reviewer)


class RefreshReviewsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        reviewer.ROOT = pathlib.Path(self.temp.name)
        self.commit = 'a' * 40
        self.path = reviewer.ROOT / '.cache/repository-snapshots/vendor--skills' / self.commit / 'sample/SKILL.md'
        self.path.parent.mkdir(parents=True)
        self.path.write_text('---\nname: sample\ndescription: A reviewed workflow.\n---\nNew instructions.\n')
        self.digest = hashlib.sha256(self.path.read_bytes()).hexdigest()
        self.source = dict(path='sample/SKILL.md', source_commit=self.commit, content_sha256=self.digest,
                           source_url=f'https://github.com/vendor/skills/blob/{self.commit}/sample/SKILL.md')
        self.repos = {'vendor/skills': dict(repo='vendor/skills', source_commit=self.commit, license='MIT', licenses={'LICENSE': 'MIT'}, candidates=[self.source])}
        self.row = dict(id='vendor--sample', repo='vendor/skills', path='sample/SKILL.md', name='sample',
                        title='保留的中文介绍', tested=False, source_commit='b' * 40, content_sha256='c' * 64)
        self.review = dict(repo='vendor/skills', path='sample/SKILL.md', source_commit=self.commit,
                           content_sha256=self.digest, previous_content_sha256='c' * 64, reviewed_at='2026-11-21')

    def test_exact_review_refreshes_source_without_changing_identity(self):
        accepted, rejected = reviewer.refresh_reviewed([self.row], self.repos, [self.review])
        self.assertFalse(rejected)
        self.assertEqual(self.row['source_commit'], self.commit)
        self.assertEqual(self.row['id'], 'vendor--sample')
        self.assertEqual(self.row['title'], '保留的中文介绍')
        self.assertFalse(self.row['tested'])
        self.assertIn(self.commit, self.row['license_url'])
        self.assertTrue(accepted[0]['content_changed'])
        again, _ = reviewer.refresh_reviewed([self.row], self.repos, [self.review])
        self.assertTrue(again[0]['content_changed'], 'Replaying a review must preserve its historical change count')

    def test_new_unreviewed_commit_keeps_published_snapshot(self):
        before = copy.deepcopy(self.row)
        self.review['source_commit'] = 'd' * 40
        accepted, rejected = reviewer.refresh_reviewed([self.row], self.repos, [self.review])
        self.assertFalse(accepted)
        self.assertEqual(rejected[0]['reason'], 'review-snapshot-mismatch')
        self.assertEqual(self.row, before)

    def test_tampered_document_cannot_use_old_review(self):
        before = copy.deepcopy(self.row)
        self.path.write_text(self.path.read_text() + 'Unreviewed change.')
        accepted, rejected = reviewer.refresh_reviewed([self.row], self.repos, [self.review])
        self.assertFalse(accepted)
        self.assertEqual(rejected[0]['reason'], 'hash-mismatch')
        self.assertEqual(self.row, before)

    def test_rename_needs_separate_identity_review(self):
        self.row['name'] = 'old-name'
        accepted, rejected = reviewer.refresh_reviewed([self.row], self.repos, [self.review])
        self.assertFalse(accepted)
        self.assertEqual(rejected[0]['reason'], 'review-name-changed')

    def test_refresh_cannot_create_duplicate_content(self):
        other = dict(self.row, id='other--sample', repo='other/skills', content_sha256=self.digest)
        accepted, rejected = reviewer.refresh_reviewed([self.row, other], self.repos, [self.review])
        self.assertFalse(accepted)
        self.assertEqual(rejected[0]['reason'], 'duplicate-content')


if __name__ == '__main__':
    unittest.main()
