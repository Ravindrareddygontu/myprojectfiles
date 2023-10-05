import axios from "axios";
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import * as faceapi from 'face-api.js'
import './UploadVideo.css'

const UploadVideo = () => {
    const videoRef = useRef(null);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [distance, setDistance] = useState(0)
    const [instruction, setInstruction] = useState("Maintain Below 80 cms Distance from Camera and Follow Instructions")
    const chunksRef = useRef([]);
    const navigate = useNavigate();
    const recorderRef = useRef(null); // Using ref for the recorder
    const faceDetectedRef = useRef(true); // Using ref for the faceDetected flag
    const [isRecordingStarted, setIsRecordingStarted] = useState(false)
    const [recordingStatus, setRecordingStatus] = useState(false)
    const clickedRecordingButton = useRef(false)
    const [seconds, setSeconds] = useState()
    const sec = useRef(10)

    const widthOfFace = 6.8
    const focalLength = 800
    const MODEL_URL = process.env.PUBLIC_URL + '/models';
    let faceLandmarker = FaceLandmarker

    const loadModels = async () => {
        if (clickedRecordingButton.current) {
            Swal.fire('On the Process', 'Loading the camera', 'info');
        }
        else {
            clickedRecordingButton.current = true
            await createFaceLandmarker()
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
            console.log('models loaded');
            storeVideoFrames()
        }

    }

    const createFaceLandmarker = async () => {
        try {
            // Load the vision tasks using the FilesetResolver from the specified URL
            const landmarkVision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            // Create the FaceLandmarker using the loaded vision tasks and options
            faceLandmarker = await FaceLandmarker.createFromOptions(landmarkVision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
                },
                outputFaceBlendshapes: true,
                runningMode: 'VIDEO',
                numFaces: 2
            });

            // Log success message if the FaceLandmarker is created successfully
            console.log("Face landmarker model loaded successfully.");
        } catch (error) {
            console.error("Error creating face landmarker:", error);
            throw error
        }
    };
    // Hypothetical function to get the x, y coordinates given an index.
    function getCoordinates(index, landmarks) {
        return landmarks[index];
    }

    function computeCentroid(connections, landmarks) {
        let sumX = 0;
        let sumY = 0;
        let totalPoints = connections.length * 2;  // 8 points for each iris
        for (let i = 0; i < connections.length; i++) {
            let startCoords = getCoordinates(connections[i].start, landmarks);
            let endCoords = getCoordinates(connections[i].end, landmarks);
            sumX += startCoords.x + endCoords.x;
            sumY += startCoords.y + endCoords.y;
        }
        return {
            x: sumX / totalPoints,
            y: sumY / totalPoints
        };
    }

    function getDistanceOfTheUser(faceLandmarks) {
        for (const landmarks of faceLandmarks) {
            const leftIrisCentroid = computeCentroid(FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, landmarks);
            const rightIrisCentroid = computeCentroid(FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, landmarks);

            let distance = Math.sqrt(Math.pow(rightIrisCentroid.x - leftIrisCentroid.x, 2) + Math.pow(rightIrisCentroid.y - leftIrisCentroid.y, 2));
            // console.log(distance);
            distance = ((widthOfFace * focalLength) / (distance * 1000)).toFixed(2)
            return Math.round(distance)
        }
    }

    async function fetchImageFromServer(imageType) {
        try {
            let data
            if (imageType === 'original_image') {
                data = { original_image: true, email: localStorage.getItem('email') }
            } else {
                throw 'argument image type is not matched , it has to be "original_image"'
            }
            let registered_image
            await axios.post(`http://${localStorage.getItem('server_socket')}/get_photo`, data).then((response) => {
                console.log('response came',response);
                const base64 = response.data[imageType]
                const image = new Image()
                image.src = `data:image/png;base64,${base64}`
                console.log('returing image');
                registered_image = image
                // return image
            }).catch((error) => {
                throw new Error(error.response.data.detail)
            });
            return registered_image
        } catch (error) {
            console.error(`Error fetching image from server: ${error}`);
            throw error;
        }
    }

    async function compareFaces(image) {
        try {
            // Always compare with the original reference image.
            const originalImage = await fetchImageFromServer('original_image')
            console.log('original photo got',originalImage);

            // Detect faces and face descriptors for the provided image and the original reference image.
            const liveImageDetection = await faceapi.detectAllFaces(image).withFaceLandmarks().withFaceDescriptors();
            console.log('starting validation 2');
            const originalImageDetection = await faceapi.detectAllFaces(originalImage).withFaceLandmarks().withFaceDescriptors();

            const distance = faceapi.euclideanDistance(liveImageDetection[0].descriptor, originalImageDetection[0].descriptor)
            console.log('starting validation 2');

            if (!liveImageDetection[0]) {
                alert('face is not detected')
                throw 'face is not detected, try again'
            }
            console.log(distance);

            // Decide if the images match.
            const threshold = 0.45;
            const isMatch = distance < threshold;

            if (isMatch) {
                console.log('Same person who has logged in.');
                return true;
            } else {
                console.log('Person is not the same who has logged in.');
                return false;
            }

        } catch (error) {
            const errorMessage = `Error during face comparison: ${error}`;
            console.error(errorMessage);
            // logMessage('error', errorMessage);
            return false;
        }
    }

    function getCanvasPhoto() {
        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        const dataURL = canvas.toDataURL('image/png')
        const image = new Image()
        image.src = dataURL
        return image
    }

    let animationId
    let message

    const startDetection = async () => {
        let ms = performance.now();
        const detectedFaceLandmarks = await faceLandmarker.detectForVideo(videoRef.current, ms);
        const distanceOfUser = getDistanceOfTheUser(detectedFaceLandmarks.faceLandmarks)
        setDistance(distanceOfUser)

        // Only set the instructions once
        if (!message) {
            // Instruct user to turn head right after 3 seconds
            const instructions = [
                { message: 'Turn your head right', delay: 2000 },
                { message: 'Turn your head left', delay: 4000 },
                { message: 'Move your head up', delay: 6000 },
                { message: 'smile', delay: 8000 }
            ];

            instructions.forEach((instruction) => {
                setTimeout(() => {
                        setInstruction(instruction.message);
                }, instruction.delay);
            });
        } 

        if (detectedFaceLandmarks.faceLandmarks[0] && distanceOfUser < 80) {
            faceDetectedRef.current = true;
            animationId = requestAnimationFrame(startDetection);
        } else {
            clickedRecordingButton.current = false
            clearInterval(secondsInterval)
            cancelAnimationFrame(animationId)
            console.log('No face detected. Stopping the recording.');
            faceDetectedRef.current = false;
            setIsRecordingStarted(true)
            setRecordingStatus(false)
            setInstruction('Recording Failed Due To No Face Detected Or User Out of 80cms Away, click "Start Recording Again" to start again')
            recorderRef.current.stop();
        }
    };
    let secondsInterval
    
    // Function to store video frames for face recognition
    const storeVideoFrames = async () => {
        try {
            setRecordingStatus(true)
            // Get video stream from user's camera
            const stream = await navigator.mediaDevices.getUserMedia({ video: {height: 250, width: 400} });
            // Set the source of the video element to the stream
            videoRef.current.srcObject = stream;

            await videoRef.current.play();
            // Capture the stream from the video element
            const videoStream = videoRef.current.captureStream()
            // Get a snapshot of the video frame as an image
            const livePhoto = getCanvasPhoto()
            // Compare the live photo with the stored face
            const compareResult = await compareFaces(livePhoto)

            if (compareResult === false) {
                clickedRecordingButton.current = false
                setIsRecordingStarted(false)
                await Swal.fire({
                    title: 'Stopped!',
                    text: 'Face Validation is Unsuccessful, Place Your Face Middle of the Camera and Start Recording Again',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
                cancelAnimationFrame(animationId)
                message = 'try again'

            }
            // If the faces match
            else {
                // Show a message to the user to start the recording
                await Swal.fire({
                    title: 'Starting the Recording',
                    text: 'Place Your Face Middle of the Camera and Follow Instructions',
                    icon: 'info',
                    confirmButtonText: 'OK'
                });
                // Start the face detection
                startDetection();
                // Start a countdown for the recording
                secondsInterval = setInterval(() => {
                    sec.current -= 1
                    setSeconds(sec.current)
                }, 1000);

                // Create a new MediaRecorder instance and assign it to the recorderRef
                recorderRef.current = new MediaRecorder(videoStream);
                // Update the state of mediaRecorder with the new MediaRecorder instance
                setMediaRecorder(recorderRef.current);

                // Event listener for when data is available for the MediaRecorder instance
                recorderRef.current.ondataavailable = (event) => {
                    // Push the data into the chunksRef array
                    chunksRef.current.push(event.data)
                };

                // Event listener for when the MediaRecorder instance stops
                recorderRef.current.onstop = async () => {
                    // If a face was detected
                    if (faceDetectedRef.current) {
                        // Cancel the animation frame
                        cancelAnimationFrame(animationId)
                        // Create a new Blob instance with the data from chunksRef
                        const blob = new Blob(chunksRef.current, { 'type': 'video/webm' });
                        console.log(blob);
                        // Convert the Blob instance to a data URL
                        const dataURL = await blobToDataURL(blob);
                        // Create a data object with the data URL and the user's email
                        const data = { video: dataURL, email: localStorage.getItem('email') };
                        // Send a POST request to the server with the data object
                        const response = await axios.post(`http://${localStorage.getItem('server_socket')}/uploads`, data);
                        console.log(response);
                        if (response.status === 200) {
                            clearInterval(secondsInterval)
                            await Swal.fire({
                                title: 'Successful!',
                                text: 'video Uploaded Successfully',
                                icon: 'success',
                                timer: 1500,
                                position: 'top-end'
                            });
                            // Get the tracks from the video element's source object
                            const tracks = await videoRef.current.srcObject.getTracks();
                            // Stop each track
                            await tracks.forEach(track => track.stop());
                            // Set the video element's source object to null
                            videoRef.current.srcObject = null;
                            // Stop each track in the stream
                            stream.getTracks().forEach(track => track.stop())
                            // Clear the interval for the secondsInterval
                            

                            await Swal.fire({
                                title: 'FeedBack',
                                icon: 'success',
                                html: 'Rate the Registraction Process ',
                                showCloseButton: true,
                                showCancelButton: true,
                                focusConfirm: false,
                                confirmButtonText: 'Great!',
                                cancelButtonText: 'Not Good',
                            })
                            // Navigate to the home page
                            navigate('/');
                        }
                    } else {
                        // If no face was detected, show an error message to the user
                        await Swal.fire({
                            title: 'Stopped!',
                            text: 'Recording stopped as no face was detected. Please try again.',
                            icon: 'info',
                            confirmButtonText: 'OK'
                        });
                    }
                };
                // Reset the chunks array
                chunksRef.current = [];

                // Start the MediaRecorder instance
                recorderRef.current.start();

                // Stop the MediaRecorder instance after 10 seconds
                setTimeout(() => {
                    recorderRef.current.stop();
                }, 10000);
            }
        } catch (error) {
            // Log any errors that occur when accessing the camera
            console.error('Error accessing the camera:', error);
            throw error
        }
    };
    const blobToDataURL = (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = (error) => {
                reject(new Error("Failed to convert Blob to Data URL: ", error));
            };
            reader.readAsDataURL(blob);
        });
    };

    return (
        <div>
            <h3>Instruction: {instruction}</h3>
            <p>{seconds ? `Recording Ended in ${seconds} seconds` : ''}</p>
            <video ref={videoRef} height={300} width={300}></video>
            <p>
                {recordingStatus ? 'Started Recording' : 'Recording is Not Started'}
            </p>
            <p>{distance ? `distance: ${distance}`: ''}</p>

            <button onClick={loadModels}>
                {isRecordingStarted ? 'Start Recording Again' : 'Click Here To Start Recording'}
            </button>
        </div>
    );
};

export default UploadVideo;
