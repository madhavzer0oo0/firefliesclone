from sqlalchemy import text

BASE = '/api/v1/meetings'


def test_membership_edit_persistence_and_referenced_removal_atomicity(client, meeting, database):
    path = f'{BASE}/{meeting["id"]}'
    priya = meeting['participants'][0]
    assert client.put(f'{path}/transcript', json=[{
        'position': 0, 'speaker_id': priya['id'], 'start_seconds': 0,
        'end_seconds': 60, 'text': 'Persistent discussion.',
    }]).status_code == 200
    addition = {'name': 'New attendee', 'email': 'new@example.com'}
    saved = client.patch(path, json={'title': 'Edited meeting', 'participants': [{'name': priya['name'], 'email': priya['email']}, addition]})
    assert saved.status_code == 200, saved.text
    assert [p['email'] for p in saved.json()['participants']] == ['priya@example.com', 'new@example.com']
    assert client.get(path).json()['title'] == 'Edited meeting'
    failed = client.patch(path, json={'title': 'Must roll back', 'participants': [{'name': 'Rollback', 'email': 'rollback@example.com'}]})
    assert failed.status_code == 422
    assert client.get(path).json() == saved.json()
    with database[1]() as db:
        assert db.scalar(text("SELECT count(*) FROM participants WHERE email='rollback@example.com'")) == 0
        assert db.scalar(text('SELECT title FROM meetings WHERE id=:id'), {'id': meeting['id']}) == 'Edited meeting'


def test_delete_cascades_all_owned_records_and_preserves_shared_contacts(client, meeting, database):
    path = f'{BASE}/{meeting["id"]}'
    person = meeting['participants'][0]
    other = client.post(BASE, json={'title': 'Other meeting', 'started_at': meeting['started_at'], 'duration_seconds': 60, 'participants': [{'name': person['name'], 'email': person['email']}]}).json()
    assert client.put(f'{path}/transcript', json=[{'position': 0, 'speaker_id': person['id'], 'start_seconds': 0, 'end_seconds': 60, 'text': 'Discuss deletion.'}]).status_code == 200
    assert client.put(f'{path}/summary', json={'overview': 'Summary'}).status_code == 200
    assert client.put(f'{path}/chapters', json=[{'position': 0, 'title': 'Chapter', 'start_seconds': 0, 'end_seconds': 60}]).status_code == 200
    assert client.post(f'{path}/action-items', json={'text': 'Task', 'assignee_id': person['id']}).status_code == 201
    assert client.delete(path).status_code == 204
    assert client.delete(path).status_code == 404
    with database[1]() as db:
        for table in ('meeting_participants', 'transcript_segments', 'summaries', 'chapters', 'action_items'):
            assert db.scalar(text(f'SELECT count(*) FROM {table} WHERE meeting_id=:id'), {'id': meeting['id']}) == 0
        assert db.scalar(text('SELECT count(*) FROM participants WHERE id=:id'), {'id': person['id']}) == 1
    assert client.get(f'{BASE}/{other["id"]}').json()['participants'][0]['id'] == person['id']


def test_combined_filters_recency_and_literal_global_snippets(client, meeting):
    path = f'{BASE}/{meeting["id"]}'
    segments = [{'position': i, 'speaker_id': meeting['participants'][0]['id'], 'speaker_label': 'Priya lead', 'start_seconds': start, 'end_seconds': end, 'text': value}
                for i, start, end, value in [(0, .25, 20, 'First literal %_ discussion.'), (1, 20, 60, 'Second literal %_ discussion.')]]
    response = client.put(f'{path}/transcript', json=segments)
    assert response.status_code == 200, response.text
    assert client.get(BASE, params={'q': '%_', 'search_scope': 'library'}).json()['total'] == 0
    result = client.get(BASE, params={'q': '%_', 'search_scope': 'everywhere', 'title': 'planning', 'participant': 'PRIYA', 'date_from': '2026-10-01T00:00:00Z', 'date_to': '2026-10-01T23:59:59Z'}).json()
    assert result['total'] == 1
    match = result['items'][0]['match']
    assert match['segment_id'] == response.json()[0]['id']
    assert match['start_seconds'] == .25
    assert match['speaker_label'] == 'Priya lead'
    assert match['snippet'] == 'First literal %_ discussion.'
    assert client.get(BASE, params={'title': 'unmatched', 'participant': 'Priya'}).json()['total'] == 0
    assert client.get(BASE, params={'q': 'arjun', 'search_scope': 'everywhere'}).json()['total'] == 1
    newer = client.post(BASE, json={'title': 'Newer', 'started_at': '2026-10-02T00:00:00Z', 'duration_seconds': 60}).json()
    assert [m['id'] for m in client.get(BASE, params={'order': 'asc'}).json()['items']] == [meeting['id'], newer['id']]
    assert [m['id'] for m in client.get(BASE, params={'order': 'desc'}).json()['items']] == [newer['id'], meeting['id']]
