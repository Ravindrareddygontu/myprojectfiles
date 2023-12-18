from pymongo import MongoClient
import gridfs

mongo_connection_string = 'mongodb://localhost:27017'

mongodb = MongoClient(mongo_connection_string)

db = mongodb['oneable_user_monitoring_database']

fs = gridfs.GridFS(db)

users_emails = []
for email in users_emails:
    #this is folder of all photos of the employees stored
    photo_path = 'OneAbleTeamPhotos/%s.jpg'%email
    with open(photo_path, 'rb') as f:
        photo_id = fs.put(f.read())
    user_data = {
        'email': email,
        'registered': False,
        'original_photo_id': photo_id,
        'registered_video_id': None,
        'registered_photo_id': None,
        'smiled_photos': [],
        'eye_blinked_photos': []
    }
    db['users'].insert_one(user_data)