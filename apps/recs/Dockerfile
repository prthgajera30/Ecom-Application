FROM python:3.11-slim
WORKDIR /usr/src/app
COPY apps/recs/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/recs ./
EXPOSE 5000
CMD ["flask","--app","app.py","run","--host=0.0.0.0","--port=5000"]
