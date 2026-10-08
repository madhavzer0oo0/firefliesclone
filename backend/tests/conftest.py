from pathlib import Path
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from app.database import get_db, make_engine
from app.main import app


@pytest.fixture
def database(tmp_path):
    engine = make_engine(f'sqlite:///{(tmp_path / "test.db").as_posix()}')
    config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
    with engine.connect() as connection:
        config.attributes['connection'] = connection
        command.upgrade(config, 'head')
        connection.commit()
    yield engine, sessionmaker(engine, expire_on_commit=False), config
    engine.dispose()


@pytest.fixture
def client(database):
    _, sessions, _ = database

    def override():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def meeting(client):
    response = client.post('/api/v1/meetings', json={
        'title': 'Search planning', 'started_at': '2026-10-01T10:00:00+05:30',
        'duration_seconds': 60,
        'participants': [{'name': 'Priya', 'email': 'PRIYA@example.com'}, {'name': 'Arjun', 'email': 'arjun@example.com'}],
    })
    assert response.status_code == 201, response.text
    return response.json()
