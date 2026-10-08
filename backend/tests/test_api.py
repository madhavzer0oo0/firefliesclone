import pytest
from sqlalchemy import func, inspect, select, text
from alembic import command
from app import models as m
from app.seed import seed

BASE = '/api/v1/meetings'


def segment(meeting, **changes):
    return {'speaker_id': meeting['participants'][0]['id'], 'position': 0,
            'start_seconds': 0, 'end_seconds': 30, 'text': 'Discuss literal 50% search and pagination.', **changes}


def test_meeting_crud_and_persistence(client, meeting, database):
    assert meeting['started_at'] == '2026-10-01T04:30:00Z'
    assert meeting['participants'][0]['email'] == 'priya@example.com'
    path = f'{BASE}/{meeting["id"]}'
    assert client.get(path).json() == meeting
    response = client.patch(path, json={'title': 'Updated planning'})
    assert response.status_code == 200
    with database[1]() as db:
        assert db.get(m.Meeting, meeting['id']).title == 'Updated planning'
    assert client.delete(path).status_code == 204
    assert client.get(path).status_code == 404


@pytest.mark.parametrize('payload', [
    {'title': ' '}, {'duration_seconds': -1}, {'status': 'unknown'}, {'title': None},
    {'started_at': None}, {'participants': None}, {'started_at': '2026-10-01T00:00:00'},
    {'participants': [{'name': 'A', 'email': 'a@b.com'}, {'name': 'B', 'email': 'A@b.com'}]},
    {'participants': [{'name': 'A', 'email': 'invalid'}]}, {'unexpected': True},
])
def test_invalid_meeting_updates(client, meeting, payload):
    assert client.patch(f'{BASE}/{meeting["id"]}', json=payload).status_code == 422


def test_transcript_validation_atomic_replace_and_search(client, meeting):
    path = f'{BASE}/{meeting["id"]}/transcript'
    original = [segment(meeting)]
    assert client.put(path, json=original).status_code == 200
    assert client.get(path, params={'q': 'PAGINATION'}).json()[0]['speaker']['name'] == 'Priya'
    assert client.get(path, params={'q': 'absent'}).json() == []
    invalid = [segment(meeting), segment(meeting, position=1, speaker_id=999, start_seconds=30, end_seconds=60)]
    assert client.put(path, json=invalid).status_code == 422
    assert len(client.get(path).json()) == 1
    for items in ([segment(meeting, end_seconds=61)], [segment(meeting), segment(meeting)],
                  [segment(meeting), segment(meeting, position=1, start_seconds=20, end_seconds=50)],
                  [segment(meeting, end_seconds=0)]):
        assert client.put(path, json=items).status_code == 422
    assert client.patch(f'{BASE}/{meeting["id"]}', json={'duration_seconds': 10}).status_code == 422
    assert client.patch(f'{BASE}/{meeting["id"]}', json={'participants': []}).status_code == 422
    assert client.put(path, json=[]).json() == []


def test_summary_chapters(client, meeting):
    path = f'{BASE}/{meeting["id"]}'
    assert client.get(f'{path}/summary').status_code == 404
    response = client.put(f'{path}/summary', json={'overview': 'We agreed on search.', 'notes': 'Ship Friday.'})
    assert response.status_code == 200
    summary_id = response.json()['id']
    assert client.put(f'{path}/summary', json={'overview': 'Updated decision'}).json()['id'] == summary_id
    assert client.get(f'{path}/summary').json()['notes'] == ''
    chapter = {'position': 0, 'title': 'Planning', 'start_seconds': 0, 'end_seconds': 60}
    assert client.put(f'{path}/chapters', json=[chapter]).status_code == 200
    assert client.put(f'{path}/chapters', json=[{**chapter, 'end_seconds': 61}]).status_code == 422
    assert len(client.get(f'{path}/chapters').json()) == 1
    assert client.put(f'{path}/chapters', json=[]).json() == []


def test_action_crud_cross_meeting_validation(client, meeting, database):
    path = f'{BASE}/{meeting["id"]}/action-items'
    assert client.post(path, json={'text': 'Ship search', 'assignee_id': 999}).status_code == 422
    item = client.post(path, json={'text': 'Ship search', 'assignee_id': meeting['participants'][0]['id'], 'due_date': '2026-10-09'}).json()
    assert item['status'] == 'open'
    item_path = f'{path}/{item["id"]}'
    response = client.patch(item_path, json={'status': 'completed', 'assignee_id': None, 'due_date': None})
    assert response.status_code == 200
    assert response.json()['assignee_id'] is None
    assert client.get(item_path).json()['status'] == 'completed'
    # A new database session observes committed completion, independent of HTTP/UI state.
    with database[1]() as db:
        assert db.get(m.ActionItem, item['id']).status == 'completed'
    assert len(client.get(path, params={'status': 'completed'}).json()) == 1
    assert client.get(path, params={'status': 'open'}).json() == []
    edited = client.patch(item_path, json={'text': 'Ship and document search'}).json()
    assert edited['text'] == 'Ship and document search'
    assert edited['status'] == 'completed'
    assert client.patch(item_path, json={'status': 'open'}).json()['status'] == 'open'
    with database[1]() as db:
        persisted = db.get(m.ActionItem, item['id'])
        assert persisted.text == 'Ship and document search'
        assert persisted.status == 'open'
    assert client.patch(item_path, json={'text': None}).status_code == 422
    other = client.post(BASE, json={'title': 'Other', 'started_at': '2026-10-02T00:00:00Z'}).json()
    assert client.get(f'{BASE}/{other["id"]}/action-items/{item["id"]}').status_code == 404
    assert client.post(f'{BASE}/{other["id"]}/action-items', json={'text': 'Wrong assignee', 'assignee_id': meeting['participants'][0]['id']}).status_code == 422
    assert client.delete(item_path).status_code == 204
    assert client.get(item_path).status_code == 404
    with database[1]() as db:
        assert db.get(m.ActionItem, item['id']) is None


def test_search_filter_sort_and_pagination(client, meeting):
    client.put(f'{BASE}/{meeting["id"]}/transcript', json=[segment(meeting)])
    other = client.post(BASE, json={'title': 'Alpha review', 'started_at': '2026-10-03T00:00:00Z', 'status': 'processing'}).json()
    assert client.get(BASE).json()['items'][0]['id'] == other['id']
    assert client.get(BASE, params={'q': 'pagination'}).json()['total'] == 1
    assert client.get(BASE, params={'q': '50%'}).json()['total'] == 1
    assert client.get(BASE, params={'q': '%'}).json()['total'] == 1
    assert client.get(BASE, params={'participant': 'PRIYA'}).json()['total'] == 1
    assert client.get(BASE, params={'participant': 'arjun@example.com'}).json()['total'] == 1
    assert client.get(BASE, params={'status': 'processing'}).json()['total'] == 1
    assert client.get(BASE, params={'date_from': '2026-10-02T00:00:00Z'}).json()['total'] == 1
    assert client.get(BASE, params={'date_to': '2026-10-01T10:00:00+05:30'}).json()['total'] == 1
    assert client.get(BASE, params={'sort': 'title', 'order': 'asc'}).json()['items'][0]['title'] == 'Alpha review'
    page = client.get(BASE, params={'limit': 1, 'offset': 1}).json()
    assert page['total'] == 2 and len(page['items']) == 1 and page['offset'] == 1
    for params in ({'sort': 'unsafe'}, {'limit': 101}, {'offset': -1}, {'date_from': '2026-10-01T00:00:00'},
                   {'date_from': '2026-10-04T00:00:00Z', 'date_to': '2026-10-01T00:00:00Z'}):
        assert client.get(BASE, params=params).status_code == 422


def test_library_search_participant_or_title_and_preview(client, meeting):
    path = f'{BASE}/{meeting["id"]}'
    client.put(f'{path}/summary', json={'overview': 'Ship literal matching with pagination.'})
    client.put(f'{path}/transcript', json=[segment(meeting, text='Transcript-only keyword: zebras')])
    for query in ('Priya', 'ARJUN@EXAMPLE.COM', 'planning'):
        page = client.get(BASE, params={'q': query, 'search_scope': 'library'}).json()
        assert page['total'] == 1
        assert page['items'][0]['preview'] == 'Ship literal matching with pagination.'
    assert client.get(BASE, params={'q': 'zebras', 'search_scope': 'library'}).json()['total'] == 0
    assert client.get(BASE, params={'q': 'zebras'}).json()['total'] == 1
    assert client.get(BASE, params={'search_scope': 'invalid'}).status_code == 422
    assert client.get(BASE, params={'q': 'Priya', 'search_scope': 'library', 'participant': 'absent'}).json()['total'] == 0


def test_seed_complete_cascade_and_shared_participants(client, database):
    with database[1]() as db:
        assert seed(db) == 7
        assert seed(db) == 0
        assert db.scalar(select(func.count()).select_from(m.TranscriptSegment)) == 70
        assert db.execute(text('PRAGMA foreign_key_check')).all() == []
    meetings = client.get(BASE).json()['items']
    assert len(meetings) == 7
    for meeting in meetings:
        path = f'{BASE}/{meeting["id"]}'
        segments = client.get(f'{path}/transcript').json()
        assert len(segments) == 10
        assert segments[0]['start_seconds'] == 0
        assert segments[-1]['end_seconds'] == meeting['duration_seconds']
        assert len({segment['speaker_id'] for segment in segments}) >= 3
        assert client.get(f'{path}/summary').status_code == 200
        assert len(client.get(f'{path}/chapters').json()) == 3
        assert len(client.get(f'{path}/action-items').json()) == 2
    deleted_id = meetings[0]['id']
    assert client.delete(f'{BASE}/{deleted_id}').status_code == 204
    with database[1]() as db:
        for model in (m.TranscriptSegment, m.Summary, m.Chapter, m.ActionItem, m.MeetingParticipant):
            assert db.scalar(select(func.count()).select_from(model).where(model.meeting_id == deleted_id)) == 0
        assert db.scalar(select(func.count()).select_from(m.Participant)) == 5
        assert db.scalar(select(func.count()).select_from(m.Meeting)) == 6


def test_migrations_roundtrip(database):
    engine, _, config = database
    with engine.connect() as connection:
        config.attributes['connection'] = connection
        command.check(config)
        command.downgrade(config, 'base')
        connection.commit()
        assert set(inspect(connection).get_table_names()) == {'alembic_version'}
        command.upgrade(config, 'head')
        connection.commit()
        assert len(inspect(connection).get_table_names()) == 8
        assert connection.execute(text('PRAGMA foreign_keys')).scalar() == 1


def test_cors_and_missing_routes(client):
    assert client.get('/health').json() == {'status': 'ok'}
    response = client.options(BASE, headers={'Origin': 'http://localhost:3000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type'})
    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == 'http://localhost:3000'
    response = client.options(BASE, headers={'Origin': 'https://untrusted.example', 'Access-Control-Request-Method': 'POST'})
    assert response.status_code == 400
    for route in ('', '/transcript', '/summary', '/chapters', '/action-items'):
        assert client.get(f'{BASE}/999{route}').status_code == 404
