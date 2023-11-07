import os
import numpy as np
import cv2
import face_recognition

from mongo_client import get_users_collections_and_fs

users_collections, fs = get_users_collections_and_fs()


def get_formatted_image(image):
        # Convert to numpy array
        image_array = np.frombuffer(image, np.uint8)

        # Decode the image using OpenCV
        image_array = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        # Convert BGR to RGB (OpenCV loads images in BGR)
        image_array = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)

        # Ensure data type is uint8
        image_array = np.asarray(image_array, dtype=np.uint8)

        return image_array


def compare_faces(image, email):
    """
    Process the given image and perform facial recognition.

    Args:
        image_path (str): Path to the input image.

    Returns:
        dict: A dictionary containing the results of facial recognition.
    """
    result = {}

    try:
        #get the user details for particular email
        user = users_collections.find_one({'email': email})

        original_image = fs.get(user['original_photo_id']).read()
        
        original_image = get_formatted_image(original_image)

        current_image = get_formatted_image(image)

        # Encode the face in the reference image
        face_encoding1 = face_recognition.face_encodings(original_image)[0]

        # Encode the face in the input image
        face_encoding2 = face_recognition.face_encodings(current_image)[0]

        # Compare the two face encodings to determine if they match
        results = face_recognition.compare_faces([face_encoding1], face_encoding2)

        distance = face_recognition.face_distance([face_encoding1], face_encoding2)

        if distance < 0.50:
            result['match'] = True
            result['detected'] = True
            result['distance'] = distance.tolist()
        else:
            result['match'] = False
            result['detected'] = True
            result['distance'] = distance.tolist()
    except IndexError as e:
            print(e)
        # Handle the case where no face is detected in the input image
            result['detected'] = False

    return result


