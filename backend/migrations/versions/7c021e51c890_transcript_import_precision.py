"""Preserve fractional transcript timestamps and import provenance."""
from alembic import op
import sqlalchemy as sa

revision = '7c021e51c890'
down_revision = '1f63c5f77976'
branch_labels = None
depends_on = None


def upgrade():
    # SQLite batch reflection omits unnamed CHECKs; explicitly retain the frozen checks.
    with op.batch_alter_table('transcript_segments', table_args=(
        sa.CheckConstraint('position >= 0'),
        sa.CheckConstraint('start_seconds >= 0 AND end_seconds > start_seconds'),
        sa.CheckConstraint("timing_source IN ('provided', 'inferred_end', 'estimated')"),
    )) as batch:
        batch.alter_column('start_seconds', existing_type=sa.Integer(), type_=sa.Float(), existing_nullable=False)
        batch.alter_column('end_seconds', existing_type=sa.Integer(), type_=sa.Float(), existing_nullable=False)
        batch.add_column(sa.Column('speaker_label', sa.String(120), nullable=True))
        batch.add_column(sa.Column('timing_source', sa.String(20), nullable=False, server_default='provided'))


def downgrade():
    with op.batch_alter_table('transcript_segments', table_args=(
        sa.CheckConstraint('position >= 0'),
        sa.CheckConstraint('start_seconds >= 0 AND end_seconds > start_seconds'),
    )) as batch:
        batch.drop_column('timing_source')
        batch.drop_column('speaker_label')
        batch.alter_column('start_seconds', existing_type=sa.Float(), type_=sa.Integer(), existing_nullable=False)
        batch.alter_column('end_seconds', existing_type=sa.Float(), type_=sa.Integer(), existing_nullable=False)
