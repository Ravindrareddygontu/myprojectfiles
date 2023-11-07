# Use an official Python image from the Docker Hub
FROM tiangolo/uvicorn-gunicorn-fastapi:python3.9

RUN apt-get update && apt-get install -y libgl1-mesa-glx

# Make a directory for the app
WORKDIR /app

COPY . /app

RUN pip --version
RUN pip install --no-cache-dir -r requirements.txt

# Set environment variables (Optional: These can also be passed at runtime)
ENV MONGO_CONNECTION_STRING="mongodb://host.docker.internal:27017"

ENV DB_NAME="oneable_user_monitoring_database"

ENV COLLECTION_NAME="users"

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]