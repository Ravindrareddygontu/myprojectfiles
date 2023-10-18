from pymongo import MongoClient
import logging
import traceback
import gridfs
from fastapi import HTTPException

LOG_FILENAME = 'app_logs.log'

logging.basicConfig(filename=LOG_FILENAME, level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def mongodb_connection():
    try:
        mongodb = MongoClient('mongodb://localhost:27017/')
        mongodb.server_info()  # This line will throw an exception if MongoDB is not running
        return mongodb
    except Exception as e:
        logging.error("Unable to connect to MongoDB")
        logging.error(traceback.format_exc())  # Add traceback log
        raise e

def get_users_collections_and_fs():
    mongodb = mongodb_connection()
    try:
        db = mongodb['oneable_user_monitoring_database']
        if 'oneable_user_monitoring_database' not in mongodb.list_database_names():
            raise ValueError('Database not found')
        users_collection = db['users']
        fs = gridfs.GridFS(db)
        return users_collection, fs
    except ValueError as ve:
        logging.error(ve)
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Database not found.")
    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
