FROM python:3.10-slim

# Set working directory to /code as required by Hugging Face Spaces
WORKDIR /code

# Install system dependencies (ffmpeg is typically required for openai-whisper)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt first to leverage Docker cache
COPY requirements.txt /code/requirements.txt

# Install Python dependencies with memory-optimized flags
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy the rest of the application code
COPY . /code

# Hugging Face Spaces strictly requires Port 7860
EXPOSE 7860

# Command to run the FastAPI app via Uvicorn on port 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--proxy-headers", "--forwarded-allow-ips", "*"]
