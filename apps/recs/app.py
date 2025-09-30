from flask import Flask, request, jsonify

app = Flask(__name__)

@app.get('/health')
def health():
    return jsonify({"ok": True})

@app.post('/ingest/events')
def ingest_events():
    # Placeholder accepts list of events
    events = request.get_json(force=True, silent=True) or []
    return jsonify({"received": len(events)})

@app.get('/recommendations')
def recommendations():
    user_id = request.args.get('userId')
    product_id = request.args.get('productId')
    k = int(request.args.get('k', '8'))
    # Placeholder: return dummy ids
    items = [{"productId": f"p{i}", "score": 1.0 - i*0.05} for i in range(k)]
    return jsonify({"items": items})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
