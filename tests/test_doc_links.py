"""Repo docs: every relative link and file path in the Markdown resolves.

    python3 -m unittest discover -s tests        # from the repo root
"""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_doc_links  # noqa: E402


class DocLinks(unittest.TestCase):
    def test_repo_has_no_broken_links(self):
        self.assertEqual(check_doc_links.broken_links(), [])

    def test_checker_catches_broken_links(self):
        with tempfile.TemporaryDirectory() as d:
            md = Path(d) / "x.md"
            md.write_text(
                "See [the plan](docs/missing-plan.md) and `docs/Gone Summary.pdf`.\n"
                "Fine: [readme](README.md), [site](https://example.org), [anchor](#top), `app/data/terrain.bin`.\n"
                "```\nignored: `docs/in-a-code-block.md`\n```\n"
            )
            (Path(d) / "README.md").write_text("hi")
            bad = check_doc_links.broken_links([md])
        self.assertEqual(len(bad), 2, bad)
        self.assertTrue(any("missing-plan.md" in b for b in bad))
        self.assertTrue(any("Gone Summary.pdf" in b for b in bad))


if __name__ == "__main__":
    unittest.main()
