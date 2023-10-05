from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import logging
import os
from compare_faces_for_recognition import compare_faces  # Assuming these modules are compatible with FastAPI
from multiple_faces_recognition import recognize_faces
import base64
import traceback


app = FastAPI()

# CORS Configuration
origins = [
    "http://localhost",  # You can add other origins if needed
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Ensure upload directory exists
UPLOAD_DIR = 'uploads'
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Configure logging
LOG_FILENAME = 'app_logs.log'
logging.basicConfig(filename=LOG_FILENAME, level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    mongodb = MongoClient('mongodb://localhost:27017/')
    mongodb.server_info()  # This line will throw an exception if MongoDB is not running
except Exception as e:
    logging.error("Unable to connect to MongoDB")
    logging.error(traceback.format_exc())  # Add traceback log
    raise e

try:
    db = mongodb['oneable_user_monitoring_database']
    if 'oneable_user_monitoring_database' not in mongodb.list_database_names():
        raise ValueError('Database not found')
    users_collection = db['users']
except ValueError as ve:
    logging.error(ve)
    logging.error(traceback.format_exc())  # Add traceback log
    raise HTTPException(status_code=500, detail="Database not found.")
except Exception as e:
    logging.error(f"An error occurred: {str(e)}")
    logging.error(traceback.format_exc())  # Add traceback log
    raise HTTPException(status_code=500, detail="An unexpected error occurred.")

# TODO: Add FastAPI routes here

@app.post("/check_email_and_generate_otp")  # Using app.get instead of app.route
async def check_email_and_generate_otp(data: dict):  # Directly getting the 'email' from request parameters
    """
    API endpoint to check if the email is valid and generate an OTP.

    Expects a JSON body with an "email" key.

    If the email is valid and the user is already registered, returns a JSON response with a "message" key
    indicating that the user is already registered.

    If the email is invalid or not provided, returns a JSON response with a "message" key and an appropriate error message.

    If any other error occurs, returns a JSON response with an "error" key and a message indicating that an unexpected error occurred.
       """
    try:
        logging.info(f"Received email: {data['email']}")
        print([user['email'] for user in users_collection.find()])
        if data['email'] not in [user['email'] for user in users_collection.find()]:
            raise ValueError('Invalid Email,Not in the database')
        
        user = users_collection.find_one({'email': data['email']})
        if user['registered'] == True:
            return {'message': 'registered'}

        return {'message': 'not_registered'}

    except ValueError as ve:
        logging.error(ve)
        logging.error(traceback.format_exc())  # Add traceback log
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        logging.error(traceback.format_exc())  # Add traceback log
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")


def save_base64_data(file_name, base64_data):
    # Decode and save base64 data to the specified file
    with open(file_name, 'wb') as f:
        f.write(base64.b64decode(base64_data))


@app.post("/uploads")
async def uploads(data: dict):
    """
    API endpoint to handle uploads.

    The endpoint expects a JSON payload with keys 'email', 'video', and 'photo'.
    Depending on the provided data, it will save videos and photos, and then perform face recognition.
    """
    try:
        email = data.get('email', None)
        if not email:
            raise ValueError("No email provided.")

        # Check if the provided email is known by the organization
        if email not in [user['email'] for user in users_collection.find()]:
            raise ValueError("Not a Valid Email, Email is not known by Organization")
        
        # Create a directory for the user if it doesn't exist
        user_dir = os.path.join(UPLOAD_DIR, email)
        if not os.path.exists(user_dir):
            os.makedirs(user_dir)

        video = data.get('video', None)

        if video:
            # Save the video file to the user's directory
            file_name = os.path.join(user_dir, 'registered_video.webm')
            save_base64_data(file_name, video)
            # Update the user's registration status in the database
            users_collection.update_one({'email': email}, {'$set': {'registered': True}})

        photo = data.get('photo', None)
        if photo:
            # Save the photo file to the user's directory
            image_file_path = os.path.join(user_dir, 'registered_photo.jpg')
            save_base64_data(image_file_path, photo)

            # Perform face comparison
            result = compare_faces(image_file_path, email)

            # Check if the face is detected properly
            if not result['detected']:
                raise ValueError('Face is not Detected Properly')

            # Check the similarity distance for face matching
            if result['distance'][0] > 0.4:
                return {'message': 'photo is not matched'}

            return {'message': 'photo is matched'}

        return {'message': 'success'}

    except ValueError as ve:
        logging.error(ve)
        logging.error(traceback.format_exc())  # Add traceback log
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        logging.error(traceback.format_exc())  # Add traceback log
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")

@app.post("/save_photo")
async def save_photo(data: dict):
    """
    Endpoint to save photos received in base64 format.

    The endpoint expects a JSON payload with keys 'smiled_image' and 'eye_blinked_image'.
    It saves the provided images to the server.
    """
    smiled_image = data.get('smiled_image', None)
    if smiled_image:
        try:
            # Save the smiled image to the specified location
            file_name = os.path.join(UPLOAD_DIR, data["email"], 'smiled_image.jpg')
            save_base64_data(file_name, smiled_image)
            logger.info('Smiled image saved successfully.')
        except Exception as e:
            logger.error(f"Failed to save smiled image. Error: {e}")
            raise HTTPException(status_code=500, detail="Failed to save smiled image")

    eye_blinked_image = data.get('eye_blinked_image', None)
    if eye_blinked_image:
        try:
            # Save the eye blinked image to the specified location
            file_name = os.path.join(UPLOAD_DIR, data['email'], 'eye_blinked_image.jpg')
            save_base64_data(file_name, eye_blinked_image)
            logger.info('Eye blinked image saved successfully.')
        except Exception as e:
            logger.error(f"Failed to save smiled image. Error: {e}")
            logger.error(traceback.format_exc())  # Add traceback log
            raise HTTPException(status_code=500, detail="Failed to save smiled image")

    return {"message": "Images saved successfully"}


@app.post("/get_photo")
async def get_photo(data: dict):
    """
    API endpoint to retrieve photos and return them in base64 format.

    The endpoint expects a JSON payload with keys 'original_image', 'smiled_image', and 'eye_blinked_image'.
    Depending on the provided keys, it fetches the corresponding images, encodes them to base64, and returns them.
    """

    if not data:
        raise HTTPException(status_code=400, detail="No data received")

    response_data = {}
    # Retrieve the original image
    if 'original_image' in data:
        file_name = f'uploads/{data["email"]}/registered_photo.jpg'
        try:
            with open(file_name, 'rb') as image:
                base64_data = base64.b64encode(image.read()).decode('utf-8')
                response_data['original_image'] = base64_data
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"File not found: {file_name}")

    # Retrieve the smiled image
    if 'smiled_image' in data:
        file_name = f'uploads/{data["email"]}/smiled_image.jpg'
        try:
            with open(file_name, 'rb') as image:
                base64_data = base64.b64encode(image.read()).decode('utf-8')
                response_data['smiled_image'] = base64_data
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"File not found: {file_name}")

    # Retrieve the eye blinked image
    if 'eye_blinked_image' in data:
        file_name = f'uploads/{data["email"]}/eye_blinked_image.jpg'
        try:
            with open(file_name, 'rb') as image:
                base64_data = base64.b64encode(image.read()).decode('utf-8')
                response_data['eye_blinked_image'] = base64_data
        except FileNotFoundError:
            logger.error(f"Failed to save smiled image. Error: {e}")
            logger.error(traceback.format_exc())  # Add traceback log
            raise HTTPException(status_code=404, detail=f"File not found: {file_name}")

    return response_data


@app.post("/recognize_multiple_faces")
async def recognize_faces(data: dict):
    """
    Endpoint to recognize multiple faces from an image.
    """
    if 'image' not in data:
        logger.error("Invalid input: 'image' not found in request")
        logger.error(traceback.format_exc())  # Add traceback log
        raise HTTPException(status_code=400, detail="Invalid input: 'image' not found in request")

    file_name = 'uploads/images/multi_face_image.jpg'

    try:
        save_base64_data(file_name, data['image'])
        logger.info('Received multi person image')
    except Exception as e:
        logger.error(f"Error saving image: {e}")
        logger.error(traceback.format_exc())  # Add traceback log
        raise HTTPException(status_code=500, detail="Internal server error")

    try:
        recognized_faces = recognize_faces(file_name)
        logger.info(f"Recognized faces: {recognized_faces}")
    except Exception as e:
        logger.error(f"Error recognizing faces: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")

    # Check the confidence values
    if all(value > 0.2 for value in recognized_faces.values()):
        return {'message': "authorized users", 'users': recognized_faces}
    else:
        raise HTTPException(status_code=403, detail="unauthorized user came")



