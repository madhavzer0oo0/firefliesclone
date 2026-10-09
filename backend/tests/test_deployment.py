import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db, make_engine
from app.deployment import prepare_database, validate_environment
from app.main import app
from app.models import Meeting


def environment(tmp_path):
    return {
        'DATABASE_URL': f'sqlite:///{(tmp_path / "persistent.db").as_posix()}',
        'PERSISTENT_DATA_DIR': str(tmp_path),
        'CORS_ORIGINS': '["https://example.vercel.app"]',
        'SEED_ON_START': 'true',
        'PORT': '8080',
    }


def test_deployment_migrates_and_preserves_edits_across_fresh_processes(tmp_path):
    values = environment(tmp_path)
    assert validate_environment(values) == (values['DATABASE_URL'], True, 8080)
    prepare_database(values['DATABASE_URL'], True)
    engine = make_engine(values['DATABASE_URL'])
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Meeting)) == 7
        meeting = session.scalar(select(Meeting).order_by(Meeting.id))
        meeting.title = 'Persisted deployment edit'
        session.commit()
    engine.dispose()
    # A fresh process runs the real migration and seed path against the same disk.
    subprocess.run([
        sys.executable, '-c',
        'import sys; from app.deployment import prepare_database; prepare_database(sys.argv[1], True)',
        values['DATABASE_URL'],
    ], cwd=Path(__file__).resolve().parents[1], check=True, capture_output=True, text=True)
    engine = make_engine(values['DATABASE_URL'])
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Meeting)) == 7
        assert session.scalar(select(Meeting.title).order_by(Meeting.id)) == 'Persisted deployment edit'
    engine.dispose()


def test_deployment_can_migrate_without_seeding(tmp_path):
    url = environment(tmp_path)['DATABASE_URL']
    prepare_database(url)
    engine = make_engine(url)
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Meeting)) == 0
    engine.dispose()


@pytest.mark.parametrize('key,value', [
    ('DATABASE_URL', 'sqlite:///ephemeral.db'),
    ('DATABASE_URL', 'sqlite:///:memory:'),
    ('PERSISTENT_DATA_DIR', ''),
    ('CORS_ORIGINS', '[]'),
    ('CORS_ORIGINS', '["*"]'),
    ('CORS_ORIGINS', '["https://*.vercel.app"]'),
    ('CORS_ORIGINS', '["http://localhost:3000"]'),
    ('CORS_ORIGINS', '["https://example.vercel.app/meetings"]'),
    ('CORS_ORIGINS', '["https://example.vercel.app/"]'),
    ('CORS_ORIGINS', '["https://user:secret@example.vercel.app"]'),
    ('SEED_ON_START', 'yes'),
    ('PORT', '0'),
])
def test_deployment_rejects_unsafe_or_incomplete_configuration(tmp_path, key, value):
    values = environment(tmp_path)
    values[key] = value
    with pytest.raises(ValueError):
        validate_environment(values)


def test_deployment_rejects_database_outside_volume_and_missing_mount(tmp_path):
    values = environment(tmp_path)
    values['DATABASE_URL'] = f'sqlite:///{(tmp_path / ".." / "outside.db").as_posix()}'
    with pytest.raises(ValueError, match='inside PERSISTENT_DATA_DIR'):
        validate_environment(values)
    values = environment(tmp_path)
    values['PERSISTENT_DATA_DIR'] = str(tmp_path / 'not-mounted')
    with pytest.raises(ValueError, match='mounted directory'):
        validate_environment(values)
    assert not (tmp_path / 'not-mounted').exists()


def test_deployment_rejects_sqlite_uri_options(tmp_path):
    values = environment(tmp_path)
    values['DATABASE_URL'] += '?mode=memory&uri=true'
    with pytest.raises(ValueError, match='absolute SQLite file'):
        validate_environment(values)


def test_readiness_requires_application_tables(client, tmp_path):
    assert client.get('/ready').json() == {'status': 'ready'}
    engine = make_engine(f'sqlite:///{(tmp_path / "unmigrated.db").as_posix()}')

    def unmigrated():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = unmigrated
    try:
        response = client.get('/ready')
        assert response.status_code == 503
        assert response.json() == {'status': 'unavailable'}
        assert client.get('/health').status_code == 200
    finally:
        engine.dispose()
