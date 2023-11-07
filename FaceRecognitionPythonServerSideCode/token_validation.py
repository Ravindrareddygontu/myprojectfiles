from pymongo.collection import ReturnDocument
from datetime import datetime, timedelta
import logging
from mongo_client import mongodb_connection

# Initialize MongoDB connection and logging
mongodb = mongodb_connection()
tokens_collection = mongodb['tokens']
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_and_update_token(request):
    header_token = request.get_header("x-access-token")
    
    if header_token:
        query = {"token": header_token}
        
        # Calculate expiry time
        expiry_time = datetime.utcnow() + timedelta(minutes=20)
        
        update = {
            "$set": {
                "modifiedTime": datetime.utcnow(),
                "expiry": expiry_time
            }
        }
        
        # Find and modify the token document
        modified_token = tokens_collection.find_one_and_update(
            query,
            update,
            return_document=ReturnDocument.AFTER
        )

        if modified_token is None:
            logger.error(f"Session has expired, x-access-token is {header_token}")
            return 400
    else:
        raise Exception('Token is not there in the request')
        

