"""Single-instance production entry point; migrate only after the volume is mounted."""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from .database import make_engine


def validate_environment(environment: dict[str, str]) -> tuple[str, bool, int]:
    database_url = environment.get('DATABASE_URL', '')
    url = make_url(database_url)
    root = Path(environment.get('PERSISTENT_DATA_DIR', ''))
    if not environment.get('PERSISTENT_DATA_DIR') or not root.is_absolute() or not root.is_dir():
        raise ValueError('PERSISTENT_DATA_DIR must be an existing absolute mounted directory')
    path = Path(url.database or '')
    if url.drivername != 'sqlite' or url.query or url.host or not path.is_absolute() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('DATABASE_URL must point to an absolute SQLite file inside PERSISTENT_DATA_DIR')
    origins = json.loads(environment.get('CORS_ORIGINS', '[]'))
    if not isinstance(origins, list) or not origins:
        raise ValueError('CORS_ORIGINS must contain the public frontend HTTPS origin')
    for origin in origins:
        parsed = urlsplit(origin) if isinstance(origin, str) else None
        if not parsed or parsed.scheme != 'https' or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password or parsed.hostname in {'localhost', '127.0.0.1'}:
            raise ValueError('CORS_ORIGINS must contain exact HTTPS origins without paths or wildcards')
        if '*' in origin:
            raise ValueError('Wildcard CORS origins are not supported')
    seed_flag = environment.get('SEED_ON_START', 'false').lower()
    if seed_flag not in {'true', 'false'}:
        raise ValueError('SEED_ON_START must be true or false')
    port = int(environment.get('PORT', '8000'))
    if not 1 <= port <= 65535:
        raise ValueError('PORT must be between 1 and 65535')
    return database_url, seed_flag == 'true', port


def prepare_database(database_url: str, seed_on_start: bool = False) -> None:
    from .seed import seed

    Path(make_url(database_url).database).parent.mkdir(parents=True, exist_ok=True)
    engine = make_engine(database_url)
    try:
        config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
        with engine.connect() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, 'head')
            connection.commit()
        if seed_on_start:
            with sessionmaker(engine, expire_on_commit=False)() as session:
                print(f'Seeded {seed(session)} meetings (existing meetings preserved).', flush=True)
    finally:
        engine.dispose()


def main() -> None:
    import uvicorn

    database_url, seed_on_start, port = validate_environment(dict(os.environ))
    prepare_database(database_url, seed_on_start)
    uvicorn.run('app.main:app', host='0.0.0.0', port=port, workers=1)


if __name__ == '__main__':
    main()
