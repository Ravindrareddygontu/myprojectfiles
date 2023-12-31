from pymongo import MongoClient
import logging
import traceback
import gridfs
from fastapi import HTTPException
import os

LOG_FILENAME = 'app_logs.log'

logging.basicConfig(filename=LOG_FILENAME, level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def mongodb_connection():
    try:
        mongodb_uri = os.environ['MONGO_CONNECTION_STRING']  
        # mongodb_uri = 'mongodb://localhost:27017/'
        mongodb = MongoClient(mongodb_uri)
        mongodb.server_info()
        return mongodb
    except KeyError:
        logging.error("error occured connecting to database")
        raise HTTPException(status_code=500, detail="error occured connecting to database")
    except Exception as e:
        logging.error("Unable to connect to MongoDB")
        logging.error(traceback.format_exc())
        raise e

def get_users_collections_and_fs():
    mongodb = mongodb_connection()
    try:
        db_name = os.environ['DB_NAME']   
        collection_name = os.environ['COLLECTION_NAME']
        # db_name = 'oneable_user_monitoring_database'
        # collection_name = 'users'
        db = mongodb[db_name]
        
        if db_name not in mongodb.list_database_names():
            raise ValueError('Database not found')
        
        users_collection = db[collection_name]
        print(users_collection)
        fs = gridfs.GridFS(db)
        return users_collection, fs
    except KeyError as ke:
        logging.error(f"Environment variable {ke} is not set")
        raise HTTPException(status_code=500, detail=f"{ke} not set")
    except ValueError as ve:
        logging.error(ve)
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Database not found.")
    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
