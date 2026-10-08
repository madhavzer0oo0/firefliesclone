import json
import pytest
from sqlalchemy import func, inspect, select
from app import models as m

BASE = '/api/v1/meetings'


def payload(content, format='txt', **changes):
    return {'title': 'Imported planning', 'started_at': '2026-10-08T09:30:00+05:30',
            'duration_seconds': 60, 'participants': [{'name': 'Priya', 'email': 'priya@import.example'}],
            'transcript': {'format': format, 'filename': f'meeting.{format}', 'content': content}, **changes}


@pytest.mark.parametrize('format,content,start,end,label', [
    ('txt', '[00:00.500] Priya: First point\nA continuation.\n[00:15.250] Alex: Next point', .5, 15.25, 'Priya'),
    ('vtt', 'WEBVTT\n\ncue-1\n00:00.500 --> 00:15.250 align:start\n<v Priya><b>First point</b></v>\n\n00:20.000 --> 00:30.750\n<v Alex>Next point &amp; follow-up</v>', .5, 15.25, 'Priya'),
    ('json', json.dumps([{'speaker': 'Alex', 'start_seconds': 20, 'end_seconds': 30.75, 'text': 'Next point'}, {'speaker': 'Priya', 'start_seconds': '00:00.500', 'end_seconds': 15.25, 'text': 'First point'}]), .5, 15.25, 'Priya'),
    ('txt', 'Plain text without known speakers.\nSecond line of notes.', 0, 30, 'Unknown speaker'),
    ('txt', 'Priya: First point\nAlex: Next point', 0, 30, 'Priya'),
])
def test_import_formats_persist(client, database, format, content, start, end, label):
    response = client.post(f'{BASE}/import', json=payload(content, format))
    assert response.status_code == 201, response.text
    result = response.json()
    meeting = result['meeting']
    assert meeting['started_at'] == '2026-10-08T04:00:00Z'
    assert result['segment_count'] == 2
    segments = client.get(f'{BASE}/{meeting["id"]}/transcript').json()
    assert segments[0]['start_seconds'] == start
    assert segments[0]['end_seconds'] == end
    assert segments[0]['speaker_label'] == label
    assert segments[0]['timing_source'] == ('estimated' if not content.startswith(('[', 'WEBVTT')) and format == 'txt' else 'inferred_end' if format == 'txt' else 'provided')
    assert client.get(f'{BASE}/{meeting["id"]}').json() == meeting
    with database[1]() as db:
        saved = db.scalars(select(m.TranscriptSegment).where(m.TranscriptSegment.meeting_id == meeting['id']).order_by(m.TranscriptSegment.position)).all()
        assert len(saved) == 2
        assert saved[0].start_seconds == start
        assert saved[0].speaker_label == label
        checks = inspect(db.get_bind()).get_check_constraints('transcript_segments')
        assert any('end_seconds > start_seconds' in check['sqltext'] for check in checks)
        assert any('timing_source' in check['sqltext'] for check in checks)
    if label == 'Unknown speaker':
        assert any('estimated' in warning for warning in result['warnings'])
        unknown = next(person for person in meeting['participants'] if person['name'] == label)
        assert unknown['email'].endswith('@transcript.invalid')
        assert all(segment['speaker_id'] == unknown['id'] for segment in segments)


def test_json_notes_actions_inference_and_request_override(client, database):
    document = {'segments': [{'speaker': 'Priya', 'start_seconds': 2.75, 'text': 'Ship the plan.'}],
                'summary': {'overview': 'Plan approved.', 'notes': 'Ship this week.'},
                'action_items': [{'text': 'Ship plan', 'assignee': 'priya@import.example', 'status': 'completed', 'due_date': '2026-10-10'}]}
    result = client.post(f'{BASE}/import', json=payload(json.dumps(document), 'json')).json()
    path = f'{BASE}/{result["meeting"]["id"]}'
    assert client.get(path + '/transcript').json()[0]['end_seconds'] == 60
    assert client.get(path + '/transcript').json()[0]['timing_source'] == 'inferred_end'
    assert client.get(path + '/summary').json()['notes'] == 'Ship this week.'
    item = client.get(path + '/action-items').json()[0]
    assert item['status'] == 'completed'
    assert item['assignee_id'] == result['meeting']['participants'][0]['id']
    with database[1]() as db:
        assert db.get(m.ActionItem, item['id']).status == 'completed'
    response = client.post(f'{BASE}/import', json=payload(json.dumps(document), 'json', summary={'overview': 'Override'}, action_items=[]))
    assert response.status_code == 201
    path = f'{BASE}/{response.json()["meeting"]["id"]}'
    assert client.get(path + '/summary').json()['overview'] == 'Override'
    assert client.get(path + '/action-items').json() == []


@pytest.mark.parametrize('format,content,fragment', [
    ('txt', ' ', 'at least'), ('txt', '[00:99] Priya: Invalid', 'invalid minute'),
    ('txt', '[00:00] Priya: First\n[00:00] Priya: Same start', 'end must exceed'),
    ('txt', '[01:00] Priya: Too late', 'end must exceed'),
    ('vtt', '00:00.000 --> 00:10.000\nText', 'WEBVTT'),
    ('vtt', 'WEBVTT\n\n00:00.000 --> 00:10.000\n', 'text must contain'),
    ('vtt', 'WEBVTT\n\n00:00.000 --> 00:20.000\nFirst\n\n00:10.000 --> 00:25.000\nSecond', 'overlap'),
    ('vtt', 'WEBVTT\n\n00:00.000 --> 00:61.000\nLate', 'invalid minute'),
    ('vtt', 'WEBVTT\n\n00:00.000 --> 00:10.000\n<v Priya>A</v><v Alex>B</v>', 'multiple speakers'),
    ('json', '{broken', 'valid array'), ('json', '[]', 'nonempty'),
    ('json', '[{"text":"Missing timestamp"}]', 'requires start_seconds'),
    ('json', '[{"text":"Bad","start_seconds":true}]', 'must be seconds'),
    ('json', '[{"text":"Bad","start_seconds":NaN}]', 'finite'),
    ('json', '[{"text":"Bad","start_seconds":0,"end_seconds":70}]', 'duration'),
    ('json', '{"segments":[{"text":"Good","start_seconds":0}],"action_items":[{"text":"Bad owner","assignee":"Nobody"}]}', 'must match'),
    ('json', '{"segments":[{"text":"Good","start_seconds":0}],"summary":{"overview":""}}', 'summary'),
    ('txt', 'binary\u0000data', 'binary control'),
])
def test_invalid_transcripts_are_atomic(client, database, format, content, fragment):
    response = client.post(f'{BASE}/import', json=payload(content, format))
    assert response.status_code == 422, response.text
    assert fragment in response.text
    with database[1]() as db:
        for model in (m.Meeting, m.Participant, m.TranscriptSegment, m.Summary, m.ActionItem):
            assert db.scalar(select(func.count()).select_from(model)) == 0


@pytest.mark.parametrize('changes', [
    {'title': ''}, {'started_at': '2026-10-08T09:30:00'}, {'duration_seconds': 0}, {'participants': []},
    {'participants': [{'name': 'Priya', 'email': 'invalid'}]},
    {'participants': [{'name': 'Priya', 'email': 'one@example.com'}, {'name': 'priya', 'email': 'two@example.com'}]},
    {'transcript': {'format': 'pdf', 'content': 'text', 'filename': 'file.pdf'}},
    {'transcript': {'format': 'txt', 'content': 'text', 'filename': 'file.exe'}},
    {'transcript': {'format': 'txt', 'content': 'é' * 524289}},
])
def test_invalid_metadata_and_files(client, changes):
    response = client.post(f'{BASE}/import', json=payload('Text', **changes))
    assert response.status_code == 422
    assert client.get(BASE).json()['total'] == 0


@pytest.mark.parametrize('field', ['title', 'started_at', 'duration_seconds', 'participants', 'transcript'])
def test_missing_required_fields(client, field):
    data = payload('Transcript')
    del data[field]
    assert client.post(f'{BASE}/import', json=data).status_code == 422


def test_vtt_header_notes_and_unattributed_speaker(client):
    text = 'WEBVTT\nKind: captions\n\nNOTE Ignore this\n\nSTYLE\n::cue {color: white;}\n\n00:00.125 --> 00:02.875\nUnattributed text.'
    response = client.post(f'{BASE}/import', json=payload(text, 'vtt'))
    assert response.status_code == 201, response.text
    segment = client.get(f'{BASE}/{response.json()["meeting"]["id"]}/transcript').json()[0]
    assert segment['start_seconds'] == .125
    assert segment['end_seconds'] == 2.875
    assert segment['speaker_label'] == 'Unknown speaker'
    assert segment['timing_source'] == 'provided'
