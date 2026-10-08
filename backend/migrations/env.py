from alembic import context
from app.database import Base, engine
from app import models  # noqa: F401 -- register model metadata

if context.is_offline_mode():
    from app.config import settings
    context.configure(url=settings.database_url, target_metadata=Base.metadata, literal_binds=True, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    def run(connection):
        context.configure(connection=connection, target_metadata=Base.metadata, render_as_batch=True, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
    supplied_connection = context.config.attributes.get('connection')
    if supplied_connection is not None:
        run(supplied_connection)
    else:
        with engine.connect() as connection:
            run(connection)
