# Face detection service — InsightFace + onnxruntime on CPU.
FROM python:3.11-slim

# OpenCV runtime libs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY python/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY python/detect_faces.py ./python/detect_faces.py

# Cache the buffalo_l model under a mounted volume so it downloads once.
ENV INSIGHTFACE_HOME=/app/volumes/insightface-cache

CMD ["python", "python/detect_faces.py"]
