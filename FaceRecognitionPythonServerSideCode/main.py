from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
from mongo_client import get_users_collections_and_fs
from compare_faces_for_recognition import compare_faces  # Assuming these modules are compatible with FastAPI
import base64
import traceback
import datetime
from fastapi import Request
from token_validation import check_and_update_token


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

CURRENT_DATE = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# Configure logging
LOG_FILENAME = 'app_logs.log'
logging.basicConfig(filename=LOG_FILENAME, level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

#getting the users collections and gridFS for storing more than 16mb documents(example:video)
users_collection, fs = get_users_collections_and_fs()

@app.post("/check_email_and_generate_otp")  # Using app.get instead of app.route
async def check_email(data: dict, request: Request):  # Directly getting the 'email' from request parameters

    try:
        check_token = check_and_update_token(request)
        if check_token == 400:
            raise Exception('session has expired')
        logging.info(f"Received email: {data['email']}")
        # print(request.headers, request.json)
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

@app.post("/uploads")
async def uploads(data: dict, request: Request):
    try:
        check_token = check_and_update_token(request)
        if check_token == 400:
            raise Exception('session has expired')
        
        email = data.get('email', None)
        if not email:
            raise ValueError("No email provided.")
        if email not in [user['email'] for user in users_collection.find()]:
            raise ValueError("Not a Valid Email, Email is not known by Organization")

        video = data.get('video', None)
        photo = data.get('photo', None)

        if video:
            video_id = fs.put(base64.b64decode(video))
            users_collection.update_one({'email': email}, {'$set': {'registered_video_id': video_id, 'registered': True}})

        if photo:
            photo = base64.b64decode(photo)
            result = compare_faces(photo, email)
            print(result)
            registering_photo_id = fs.put(photo)
            print('res', registering_photo_id)
            users_collection.update_one({'email': email}, {'$set': {'registered_photo_id': registering_photo_id}})
            print(email)

            if not result['detected']:
                raise ValueError('Face is not Detected Properly')

            if result['distance'][0] > 0.4:
                return {'message': 'photo is not matched'}

            return {'message': 'photo is matched'}

        return {'message': 'success'}

    except ValueError as ve:
        logging.error(ve)
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")

@app.post("/save_photo")
async def save_photo(data: dict, request: Request):
    """
    Endpoint to save photos received in base64 format to MongoDB GridFS.

    The endpoint expects a JSON payload with keys 'smiled_image' and 'eye_blinked_image'.
    It saves the provided images to MongoDB.
    """
    check_token = check_and_update_token(request)

    if check_token == 400:
        raise HTTPException(status_code=400, detail="session has expired")
    
    email = data.get('email', None)
    eye_blinked_image = data.get('eye_blinked_image', None)
    smiled_image = data.get('smiled_image', None)


    
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided")

    if not smiled_image or not eye_blinked_image:
        raise HTTPException(status_code=400, detail='smiled or eyeblinked photo not provided')
    
    if smiled_image:
        try:
            smiled_image_id = fs.put(base64.b64decode(smiled_image))
            update_data = {
                '$push': {
                    'smiled_photos': {
                        'photo_id': smiled_image_id,
                        'date': CURRENT_DATE
                    }
                }
            }
            users_collection.update_one({'email': email}, update_data)
            logger.info('Smiled image saved successfully.')
        except Exception as e:
            logger.error(f"Failed to save smiled image. Error: {e}")
            raise HTTPException(status_code=500, detail="Failed to save smiled image")

    
    if eye_blinked_image:
        try:
            eye_blinked_image_id = fs.put(base64.b64decode(eye_blinked_image))
            update_data = {
                '$push': {
                    'eye_blinked_photos': {
                        'photo_id': eye_blinked_image_id,
                        'date': CURRENT_DATE
                    }
                }
            }
            users_collection.update_one({'email': email}, update_data)
            logger.info('Eye blinked image saved successfully.')
        except Exception as e:
            logger.error(f"Failed to save eye blinked image. Error: {e}")
            raise HTTPException(status_code=500, detail="Failed to save eye blinked image")
    
    return {"message": "Images saved successfully"}


@app.post("/get_photo")
async def get_photo(data: dict, request: Request):
    """
    API endpoint to retrieve photos from MongoDB GridFS and return them in base64 format.

    The endpoint expects a JSON payload with keys 'original_image', 'smiled_image', and 'eye_blinked_image'.
    Depending on the provided keys, it fetches the corresponding images from MongoDB, encodes them to base64, and returns them.
    """
    check_token = check_and_update_token(request)
    if check_token == 400:
        raise HTTPException(status_code=400, detail="session has expired")
    
    email = data.get('email', None)
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided")

    user = users_collection.find_one({'email': email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    response_data = {}
    try:
        # Filter out today's smiled photos and eye-blinked photos
        if 'original_image' in data:
            original_image_id = user.get('original_photo_id', None)
            print(original_image_id)
            if original_image_id:
                original_image_data = fs.get(original_image_id).read()
                response_data['original_image'] = base64.b64encode(original_image_data).decode('utf-8')

        if 'smiled_image' in data:
            smiled_image_id = user.get('smiled_photos')[-1].get('photo_id')  # last one
            if smiled_image_id:
                smiled_image_data = fs.get(smiled_image_id).read()
                response_data['smiled_image'] = base64.b64encode(smiled_image_data).decode('utf-8')

        if 'eye_blinked_image' in data:
            eye_blinked_image_id = user.get('eye_blinked_photos')[-1].get('photo_id')  # last one
            if eye_blinked_image_id:
                eye_blinked_image_data = fs.get(eye_blinked_image_id).read()
                response_data['eye_blinked_image'] = base64.b64encode(eye_blinked_image_data).decode('utf-8')
        
        return response_data
    
    except Exception as e:
        raise e





