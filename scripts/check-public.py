"""Read-only public deployment smoke check. Does not create or delete demo data."""
import argparse
import json
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--frontend', required=True, help='Actual HTTPS frontend origin')
    parser.add_argument('--backend', required=True, help='Actual HTTPS backend origin')
    args = parser.parse_args()
    for value in (args.frontend, args.backend):
        parsed = urlsplit(value)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.path not in {'', '/'} or parsed.query or parsed.fragment or parsed.username or parsed.password:
            parser.error('Provide HTTPS origins without paths, queries, or credentials')
    frontend, backend = args.frontend.rstrip('/'), args.backend.rstrip('/')

    def read(url, json_body=False):
        with urlopen(Request(url, headers={'Origin': frontend}), timeout=30) as response:
            if url.startswith(backend) and response.headers.get('Access-Control-Allow-Origin') != frontend:
                raise RuntimeError(f'CORS does not allow the frontend at {url}')
            payload = response.read()
            return json.loads(payload) if json_body else payload.decode('utf-8')

    assert read(f'{backend}/ready', True)['status'] == 'ready'
    meetings = read(f'{backend}/api/v1/meetings?limit=1', True)
    assert meetings['items'], 'Seed the empty deployment before submission'
    meeting = meetings['items'][0]
    for path in ('/meetings', '/meetings/new', '/settings', f'/meetings/{meeting["id"]}'):
        assert '<html' in read(frontend + path).lower(), f'Invalid frontend HTML at {path}'
    for collection in ('summary', 'chapters', 'transcript', 'action-items'):
        assert read(f'{backend}/api/v1/meetings/{meeting["id"]}/{collection}', True), f'Missing seed content: {collection}'
    request = Request(f'{backend}/api/v1/meetings/import', method='OPTIONS', headers={
        'Origin': frontend, 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
    })
    with urlopen(request, timeout=30) as response:
        assert response.headers.get('Access-Control-Allow-Origin') == frontend
        assert 'POST' in response.headers.get('Access-Control-Allow-Methods', '')
    print('PASS: public HTML routes, direct detail route, API readiness, seed content, and CORS.')
    print('Still verify browser CRUD and persistence after a hosting restart/redeploy; this check is read-only.')


if __name__ == '__main__':
    main()
