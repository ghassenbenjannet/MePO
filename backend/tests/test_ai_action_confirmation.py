from __future__ import annotations

import sys
import unittest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes_ai_actions import execute
from app.core.database import Base
from app.schemas.ai import ActionExecuteRequest


class AIActionConfirmationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db = self.SessionLocal()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_action_execution_requires_explicit_confirmation(self) -> None:
        response = execute(
            ActionExecuteRequest(action_id="action-1", action_type="create_ticket", confirmed=False, payload={}),
            db=self.db,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Confirmation utilisateur obligatoire", response.body.decode())

    def test_action_execution_requires_action_id(self) -> None:
        response = execute(
            ActionExecuteRequest(action_type="create_ticket", confirmed=True, payload={}),
            db=self.db,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("action_id obligatoire", response.body.decode())


if __name__ == "__main__":
    unittest.main()
