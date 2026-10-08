"""Text-only import. Estimated timing is explicit; no audio or identity inference."""
from dataclasses import dataclass
from html import unescape
import json
import math
import re
from pydantic import ValidationError
from . import schemas as s

UNKNOWN = 'Unknown speaker'


class ImportProblem(ValueError):
    pass


@dataclass
class Segment:
    speaker: str
    start_seconds: float
    end_seconds: float | None
    text: str
    timing_source: str = 'provided'


def timestamp(value, label='Timestamp'):
    if isinstance(value, bool):
        raise ImportProblem(f'{label} must be seconds or MM:SS / HH:MM:SS with optional milliseconds')
    if isinstance(value, (float, int)):
        seconds = float(value)
    elif isinstance(value, str) and re.fullmatch(r'\d+(?:\.\d{1,3})?', value.strip()):
        seconds = float(value)
    elif isinstance(value, str) and re.fullmatch(r'(?:\d+:)?\d{2}:\d{2}(?:\.\d{1,3})?', value.strip()):
        parts = value.strip().split(':')
        if float(parts[-1]) >= 60 or int(parts[-2]) >= 60:
            raise ImportProblem(f'{label} contains an invalid minute or second value')
        seconds = float(parts[-1]) + int(parts[-2]) * 60 + (int(parts[0]) * 3600 if len(parts) == 3 else 0)
    else:
        raise ImportProblem(f'{label} must be seconds or MM:SS / HH:MM:SS with optional milliseconds')
    if not math.isfinite(seconds) or seconds < 0:
        raise ImportProblem(f'{label} must be finite and nonnegative')
    return seconds


def label_and_text(text):
    match = re.match(r'^([^:\n]{1,120}):\s*(.+)$', text, re.S)
    return (match[1].strip(), match[2].strip()) if match else (UNKNOWN, text.strip())


def parse_txt(content, duration):
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    segments = []
    has_timestamps = any(re.match(r'^\[?\d+:', line) for line in lines)
    if has_timestamps:
        for index, line in enumerate(lines, 1):
            match = re.match(r'^\[?((?:\d+:)?\d{2}:\d{2}(?:\.\d{1,3})?)\]?\s+(.+)$', line)
            if match:
                speaker, text = label_and_text(match[2])
                segments.append(Segment(speaker, timestamp(match[1], f'Line {index} timestamp'), None, text, 'inferred_end'))
            elif re.match(r'^\[?\d+:', line) or not segments:
                raise ImportProblem(f'Line {index}: use [MM:SS] Speaker: text or HH:MM:SS Speaker: text')
            else:
                segments[-1].text += '\n' + line
        warnings = ['Text start timestamps are preserved; each end is inferred from the next start or meeting duration.']
    else:
        for index, line in enumerate(lines):
            speaker, text = label_and_text(line)
            segments.append(Segment(speaker, duration * index / len(lines), duration * (index + 1) / len(lines), text, 'estimated'))
        warnings = ['No timestamps were supplied. Nonempty lines are spaced evenly across the duration; all timing is estimated.']
    return segments, warnings


def parse_vtt(content):
    content = content.replace('\r\n', '\n').replace('\r', '\n').lstrip('\ufeff')
    blocks = re.split(r'\n\s*\n', content.strip())
    if not blocks or not re.fullmatch(r'WEBVTT(?:[ \t].*)?', blocks[0].splitlines()[0]):
        raise ImportProblem('VTT files must start with WEBVTT and a blank line before the cues')
    if '-->' in blocks[0]:
        raise ImportProblem('VTT requires a blank line after the WEBVTT header')
    segments = []
    for block in blocks[1:]:
        lines = block.splitlines()
        if re.match(r'^(NOTE(?:\s|$)|STYLE$|REGION$)', lines[0]):
            continue
        timing_index = 0 if '-->' in lines[0] else 1
        if timing_index >= len(lines):
            raise ImportProblem(f'VTT cue {len(segments) + 1} is missing its timestamp range')
        match = re.fullmatch(r'(\S+)\s+-->\s+(\S+)(?:\s+.*)?', lines[timing_index])
        if not match:
            raise ImportProblem(f'VTT cue {len(segments) + 1} has an invalid timestamp range')
        raw_text = '\n'.join(lines[timing_index + 1:]).strip()
        voices = re.findall(r'<v(?:\.[^ >]+)*\s+([^>]+)>', raw_text)
        if len(set(voices)) > 1:
            raise ImportProblem('VTT cues with multiple speakers must be split into separate cues')
        text = unescape(re.sub(r'<[^>]*>', '', raw_text)).strip()
        speaker, text = (unescape(voices[0]).strip(), text) if voices else label_and_text(text)
        segments.append(Segment(speaker, timestamp(match[1], 'VTT cue start'), timestamp(match[2], 'VTT cue end'), text))
    return segments


def parse_json(content):
    try:
        document = json.loads(content)
    except (ValueError, RecursionError) as error:
        raise ImportProblem('JSON must be a valid array of segments or an object with a segments array') from error
    summary, actions = None, None
    if isinstance(document, dict):
        if set(document) - {'segments', 'summary', 'action_items'}:
            raise ImportProblem('JSON object supports only segments, summary, and action_items')
        rows = document.get('segments')
        try:
            if document.get('summary') is not None:
                summary = s.SummaryInput.model_validate(document['summary'])
            if document.get('action_items') is not None:
                if not isinstance(document['action_items'], list) or len(document['action_items']) > 500:
                    raise ImportProblem('JSON action_items must be an array of at most 500 items')
                actions = [s.ImportedAction.model_validate(item) for item in document['action_items']]
        except ValidationError as error:
            raise ImportProblem(f'Invalid JSON summary/action items: {error.errors()[0]["msg"]}') from error
    else:
        rows = document
    if not isinstance(rows, list) or not rows or len(rows) > 2000:
        raise ImportProblem('JSON segments must be a nonempty array of at most 2000 items')
    segments = []
    for index, row in enumerate(rows, 1):
        if not isinstance(row, dict) or set(row) - {'speaker', 'start_seconds', 'end_seconds', 'text'}:
            raise ImportProblem(f'JSON segment {index}: supported fields are speaker, start_seconds, end_seconds, and text')
        if 'start_seconds' not in row or not isinstance(row.get('text'), str) or not isinstance(row.get('speaker', UNKNOWN), str):
            raise ImportProblem(f'JSON segment {index} requires start_seconds and text; speaker must be a label')
        end = row.get('end_seconds')
        segments.append(Segment(row.get('speaker', UNKNOWN).strip(), timestamp(row['start_seconds'], f'Segment {index} start'), timestamp(end, f'Segment {index} end') if end is not None else None, row['text'].strip(), 'provided' if end is not None else 'inferred_end'))
    return segments, summary, actions


def parse_transcript(payload: s.TranscriptImport, duration: int):
    content = payload.content.lstrip('\ufeff').strip()
    warnings, summary, actions = [], None, None
    if payload.format == 'txt':
        segments, warnings = parse_txt(content, duration)
    elif payload.format == 'vtt':
        segments = parse_vtt(content)
    else:
        segments, summary, actions = parse_json(content)
    if not segments or len(segments) > 2000:
        raise ImportProblem('Transcript must contain between 1 and 2000 nonempty segments')
    segments.sort(key=lambda segment: segment.start_seconds)
    previous_end = 0
    for index, segment in enumerate(segments):
        if not segment.speaker or len(segment.speaker) > 120:
            raise ImportProblem(f'Segment {index + 1}: speaker label must contain 1–120 characters')
        if not segment.text or len(segment.text) > 50000:
            raise ImportProblem(f'Segment {index + 1}: text must contain 1–50000 characters')
        if segment.end_seconds is None:
            segment.end_seconds = segments[index + 1].start_seconds if index + 1 < len(segments) else duration
        if segment.end_seconds <= segment.start_seconds or segment.end_seconds > duration:
            raise ImportProblem(f'Segment {index + 1}: end must exceed start and fit within the meeting duration')
        if segment.start_seconds < previous_end:
            raise ImportProblem(f'Segment {index + 1}: timestamp ranges overlap; split overlapping cues before importing')
        previous_end = segment.end_seconds
    if payload.format == 'json' and any(segment.timing_source == 'inferred_end' for segment in segments):
        warnings.append('JSON start timestamps are preserved; omitted ends are inferred from the next start or duration.')
    if any(segment.speaker == UNKNOWN for segment in segments):
        warnings.append('Unlabeled text is stored as Unknown speaker; no participant identity is inferred.')
    return segments, summary, actions, warnings
