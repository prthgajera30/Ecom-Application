import json
from app import app

def test_health():
    client = app.test_client()
    resp = client.get('/health')
    assert resp.status_code == 200
    assert resp.get_json().get('ok') is True

def test_ingest_events():
    client = app.test_client()
    data = [{"userId":"u1","productId":"p1","eventType":"view","ts":0}]
    resp = client.post('/ingest/events', data=json.dumps(data), content_type='application/json')
    assert resp.status_code == 200
    assert resp.get_json().get('received') == 1

def test_recommendations():
    client = app.test_client()
    resp = client.get('/recommendations?userId=u1&productId=p1&k=3')
    assert resp.status_code == 200
    items = resp.get_json().get('items')
    assert isinstance(items, list) and len(items) == 3
