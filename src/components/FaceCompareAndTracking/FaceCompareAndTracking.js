import React, { useEffect, useRef, useState } from "react";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import * as faceapi from "face-api.js"
import './FaceCompareAndTracking.css'
import axios from "axios";


function FaceCompareAndTracking() {
    const [instruction, setInstruction] = useState("Please put Your Face middle in the camera and click 'validate and start tracking' button ")
    const [validateChances, setValidateChances] = useState(0)
    const videoRef = useRef(null);
    const streamRef = useRef(null);  // Use a ref to store the stream
    const cameraSection = useRef(null)
    let faceDetector = FaceDetector
    let originalImage

    // Function to create the GestureRecognizer
    const createFaceDetector = async () => {
        try {
            // Load the vision tasks using the FilesetResolver from the specified URL
            const gestureVision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            // Create the GestureRecognizer using the loaded vision tasks and options
            faceDetector = await FaceDetector.createFromOptions(gestureVision, {
                baseOptions: {
                    modelAssetPath:
                        `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`
                },
                runningMode: 'VIDEO',
                numHands: 2
            });

            console.log("Gesture recognizer model loaded successfully.");
        } catch (error) {
            console.error("Error creating gesture recognizer:", error);
        }
    };

    // Monkey patch for specifying the Canvas property of faceapi.env to use HTMLCanvasElement
    faceapi.env.monkeyPatch({
        Canvas: HTMLCanvasElement,

        // provide a canvas implementation tailored to your specific needs.
        createCanvasElement: () => document.createElement('canvas')
    });

    const MODEL_URL = process.env.PUBLIC_URL + '/models';

    async function loadModels() {
        await createFaceDetector()
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
        console.log('models loaded');
    }

    useEffect(() => {
        // Log when face comparison starts
        console.log('face compare is started');
        // Start the camera
        startCamera()

        // Cleanup function to stop the camera and animation frame when the component unmounts
        return async () => {
            try {
                // Cancel the animation frame
                cancelAnimationFrame(animationId)
                // If the streamRef is defined, stop all tracks
                if (streamRef.current) {
                    console.log('returing');
                    await streamRef.current.getTracks().forEach((track) => track.stop())
                }
                // If the videoRef is defined and has a srcObject, stop all tracks
                if (videoRef.current && videoRef.current.srcObject) {
                    await videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                }
            } catch (error) {
                // Log any errors that occur during cleanup
                console.error("Error during cleanup:", error);
            }
        }
    }, [])

    const navigate = useNavigate();

    const startCamera = async () => {
        try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = streamRef.current;
                await loadModels()
                videoRef.current.play();
            }
        } catch (error) {
            console.error("Error accessing the camera:", error);
            // Handle the error appropriately. Maybe show a message to the user.
        }
    };

    // Function to start face validation
    async function startFaceValidation() {
        // Check if the video is not paused
        if (!videoRef.current.paused) {
            setInstruction('validating...')
            // Get the live image from the canvas
            const liveImage = getCanvasPhoto()
            let count
            // Check if the validation chances are less than 4
            if (validateChances < 4) {

                // Compare the live image with the stored images
                const validationResult = await compareFaces(liveImage, ['live', 'eyeBlinked', 'smiled'])
                // If the validation is successful
                if (validationResult === true) {
                    Swal.fire({
                        title: "Succeed",
                        text: "Your Face Authentication Successful",
                        icon: "success"
                    })
                    // Create the face detector
                    await createFaceDetector()
                    setInstruction('tracking is on')
                    // Start face tracking
                    startFaceTracking()
                }
                // If the validation is unsuccessful
                if (validationResult === false) {
                    // Increase the validation chances
                    setValidateChances(validateChances + 1)
                    console.log('validation chance no: ', validateChances);
                    // Show an error message
                    await Swal.fire('error', 'Face Validation Unsuccessful , Try Again', 'error')
                    setInstruction("Put Your Face Middle of the Screen and Try Again")
                }
            } else {
                // If the validation chances are exhausted
                await Swal.fire('info', 'You exhausted Your 3 chances of the day, try tommorrow buddy', 'info')
            }
        }
        else {
            // If the video is paused, show an info message
            await Swal.fire({
                title: "Camera is Not Started",
                text: "Please wait, it will take few seconds",
                icon: "info"
            })
        }
    }

    /**
     * This function compares the live photo and original photo and photo captured in the time of liveness detection
     * It will findout euclidean distance between the two photos, the less the distance value the more similar photos are
     * @param {HTMLImageElement} image - The input image containing a face.
     * @returns {Promise<boolean>} - A Promise that resolves to true if the faces match, false otherwise.
    **/
    async function compareFaces(image, comparisonTypes) {
        try {
            if (!originalImage) {
                // Always compare with the original reference image.
                originalImage = await fetchImageFromServer('original_image')
            }
            console.log('original photo got');
            // Load additional images based on the comparison types.
            let eyesBlinkedImage, smiledImage;
            if (comparisonTypes.includes('eyeBlinked')) {
                eyesBlinkedImage = await fetchImageFromServer('eye_blinked_image');
                console.log('got eye blinked image');
            }
            if (comparisonTypes.includes('smiled')) {
                smiledImage = await fetchImageFromServer('smiled_image');
                console.log('got smiled image');
            }

            // Detect faces and face descriptors for the provided image and the original reference image.
            const liveImageDetection = await faceapi.detectAllFaces(image).withFaceLandmarks().withFaceDescriptors();
            console.log('starting validation 2');
            const originalImageDetection = await faceapi.detectAllFaces(originalImage).withFaceLandmarks().withFaceDescriptors();
            // Store distances in an object for easy lookup.
            const distances = {};

            if (!liveImageDetection[0]) {
                resetNoFaceTimeout()
                await Swal.fire({
                    title: "face is not detecting properly",
                    text: "Please make sure your face is placed properly",
                    icon: "warning"
                })
                clearInterval(noFaceTimeout)
            }

            distances['live'] = faceapi.euclideanDistance(originalImageDetection[0].descriptor, liveImageDetection[0].descriptor);

            // Calculate distances for additional images if needed.
            if (eyesBlinkedImage) {
                const eyesBlinkedImageDetection = await faceapi.detectAllFaces(eyesBlinkedImage).withFaceLandmarks().withFaceDescriptors();
                distances['eyeblinked'] = faceapi.euclideanDistance(liveImageDetection[0].descriptor, eyesBlinkedImageDetection[0].descriptor);
                console.log('checked with eyes blinked image');
            }

            if (smiledImage) {
                const smiledImageDetection = await faceapi.detectAllFaces(smiledImage).withFaceLandmarks().withFaceDescriptors();
                distances['smiled'] = faceapi.euclideanDistance(liveImageDetection[0].descriptor, smiledImageDetection[0].descriptor);
                console.log('checked with smiled image');

            }

            // Log the distances.
            for (let key in distances) {
                console.log(`${distances[key]} with ${key} image distance`);
            }

            // Decide if the images match.
            const threshold = 0.45;
            const isMatch = Object.values(distances).every(distance => distance < threshold);

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

    // Helper function to fetch image data from the Flask server.
    // Function to fetch image data from the server.
    async function fetchImageFromServer(imageType) {
        try {
            // Initialize data object with the user's email.
            let data = { email: localStorage.getItem('email') }
            // Check the image type and set the corresponding property in the data object.
            if (imageType === 'eye_blinked_image') {
                data['eye_blinked_image'] = true
            }
            if (imageType === 'smiled_image') {
                data['smiled_image'] = true
            }
            if (imageType === 'original_image') {
                data['original_image'] = true
            }
            console.log(data, localStorage.getItem('server_socket'));
            // Send a POST request to the server with the data object.
            const response = await axios.post(`http://${localStorage.getItem('server_socket')}/get_photo`, data)
               
            
                // console.log('response');
            // Extract the base64 image data from the response.
            const base64 = response.data[imageType]
            // Create a new image and set its source to the base64 data.
            const image = new Image()

            image.src = `data:image/png;base64,${base64}`

            // Return the image.
            return image
        } catch (error) {
            // Log any errors that occur and rethrow them.
            console.error(`Error fetching image from server: ${error}`);
            throw error;
        }
    }

    function getCanvasPhoto(data) {
        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        const dataURL = canvas.toDataURL('image/png')
        if (data === 'dataURL') {
            console.log('returmisdfgyhijkoljhiugyfd');
            return dataURL.split(',')[1]
        }
        const image = new Image()
        image.src = dataURL
        return image
    }

    let countdown = 0;

    let currentDetectedFaces = 0;
    let previousDetectedFaces = 1;

    let noOfComparisions = 0
    let detectedFaces = 0
    let detectedConfidence = 0
    let faceDetected = false

    let noFaceTimeout; // when no face is detected then to start the timeout

    var children = []; // For storing and deleting Drawing elements like rectangle box and name on top of it


    function resetNoFaceTimeout() {
        clearTimeout(noFaceTimeout);
        noFaceTimeout = setTimeout(() => {
            cancelAnimationFrame(animationId)
            videoRef.current.pause()
            showCountdownAlert(5); // Start the countdown from 5 seconds
        }, 5000); // 5 seconds
    }

    async function showCountdownAlert(secondsLeft) {
        let timerInterval;

        const result = await Swal.fire({
            title: "You are not there!",
            text: `Window will close in ${secondsLeft} seconds...`,
            timer: secondsLeft * 1000,
            willOpen: () => {
                timerInterval = setInterval(() => {
                    secondsLeft--;
                    if (secondsLeft > 0) {
                        Swal.fire.textContent = `Window will close in ${secondsLeft} seconds...`;
                    }
                }, 1000);
            },
            willClose: () => {
                clearInterval(timerInterval);
            }
        });

        if (!result.isConfirmed) { // If the alert was closed because of the timer
            console.log('user time completed');
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            navigate('/');
        } else {
            videoRef.current.play()        // Otherwise, if the user clicked "OK", just close the alert and continue
            startFaceTracking()
        }
    }

    let lastCompareTimestamp = 0;
    let cancelLoop = false; // to ensure compareFaces isn't called while it's already running

    /*
     This function for the face tracking and multiple faces validation and restrict UnAuthenticated Acess
     */
    async function startFaceTracking() {
        try {
            let ms = performance.now();
            let faceDetectionResults = await faceDetector.detectForVideo(videoRef.current, ms).detections;
            // When at least one face is detected
            if (faceDetectionResults.length > 0) {
                clearInterval(noFaceTimeout); // Clear any previously set no-face timeout
                faceDetected = true;  // Update face detection status

                detectedConfidence = (faceDetectionResults[0]['categories'][0].score * 100).toFixed(2);
                // videoInstruction.innerText = 'Tracking is going on';

                currentDetectedFaces = faceDetectionResults.length;

                // When more faces are detected than in the previous frame
                if (currentDetectedFaces > previousDetectedFaces) {
                    // videoInstruction.innerText = 'Multiple Faces Detected';

                    countdown++;
                    setInstruction('Multiple Faces Detected')

                    // When consecutive detection of multiple faces reaches a certain threshold
                    if (countdown > 30) {
                        console.log('sending to the model');
                        const base64Data = getCanvasPhoto('dataURL')
                        const data = { image: base64Data }
                        const response = await axios.post(`http://${localStorage.getItem('server_socket')}/recognize_multiple_faces`, data)
                        console.log(response);
                        countdown = 0; // Reset count
                        previousDetectedFaces = currentDetectedFaces
                    }
                } else {
                    // Validate a single face against a known image for authorization
                    // if ((detectedFaces === 0 && detectedConfidence > 92) || Date.now() - lastCompareTimestamp >= 10000) {
                    if (detectedFaces === 0 && detectedConfidence > 92) {

                        const image = getCanvasPhoto();
                        const comparedResult = await compareFaces(image, ['live']);

                        if (!comparedResult) { // If comparison failed
                            noOfComparisions++;
                            if (noOfComparisions === 3) { // After 3 unsuccessful comparisons
                                noOfComparisions = 0;
                                cancelAnimationFrame(animationId)
                                cancelLoop = true
                                // logMessage('warning', 'Unauthorized user detected thrice consecutively');
                                await alertUnauthorizedUser()
                            }
                        } else {
                            noOfComparisions = 0;
                            detectedFaces = faceDetectionResults.length;
                            // lastCompareTimestamp = Date.now()
                        }
                    }
                    countdown = 0;
                    previousDetectedFaces = faceDetectionResults.length;
                }
                clearTimeout(noFaceTimeout);
            } else {
                // When no face is detected and a face was detected in the previous frame
                setInstruction('No One Detected')
                if (faceDetected) {
                    resetNoFaceTimeout();
                    faceDetected = false;
                }
                detectedFaces = faceDetectionResults.length;
            }

            displayFaceDetections(faceDetectionResults);


            if (!cancelLoop) {
                animationId = requestAnimationFrame(startFaceTracking);
            }

        } catch (error) {
            console.error(error);
            throw new Error(error)
        }
    }

    const alertUnauthorizedUser = async () => {
        cancelAnimationFrame(animationId)
        await Swal.fire({
            title: "Unauthorized User Detected",
            text: "You have entered into the screen without authorization. The window will be closed.",
            icon: "warning",
            timer: 3000
        }).then(async () => {
            console.log('closing window');
            if (videoRef.current && videoRef.current.srcObject) {
                await videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                await streamRef.current.getTracks().forEach(track => track.stop())
            }
            navigate('/')
        });
    }

    let animationId
    /*
     This function will display the detections on the face adding 'highlighter' as rectangular box and 'p'  as
    user name on top of it 
    */
    function displayFaceDetections(detections) {
        // Remove any highlighting from previous frame.
        for (let child of children) {
            cameraSection.current.removeChild(child);
        }
        children.splice(0);

        // Iterate through predictions and draw them to the live view
        for (let detection of detections) {
            const p = document.createElement("p");
            p.innerText = `ravindra:[${detectedConfidence}]`;
            p.setAttribute('class', 'confidence-score')
            p.style =
                "left: " + (detection.boundingBox.originX) + "px;" +
                "top: " + (detection.boundingBox.originY + 10) + "px; " +
                "width: " + (detection.boundingBox.width) + "px;";

            const highlighter = document.createElement("div");
            highlighter.setAttribute("class", "highlighter");

            highlighter.style =
                "left: " + (detection.boundingBox.originX) + "px;" +
                "top: " + (detection.boundingBox.originY + 50) + "px;" +
                "width: " + (detection.boundingBox.width - 10) + "px;" +
                "height: " + (detection.boundingBox.height - 10) + "px;";

            cameraSection.current.appendChild(highlighter);
            cameraSection.current.appendChild(p);

            // Store drawn objects in memory for the next call
            children.push(highlighter);
            children.push(p);
        }
    }

    const goBack = async () => {
        cancelAnimationFrame(animationId)

        await Swal.fire({
            title: 'Are you sure',
            text: "Confirm to Go Home",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Confirm'
        }).then(async (result) => {
            if (result.isConfirmed) {
                cancelAnimationFrame(animationId)
                console.log(result);
                if (videoRef.current && videoRef.current.srcObject) {
                    await videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                    await streamRef.current.getTracks().forEach(track => track.stop())
                }
                navigate('/');
            }
        })
    };

    return (
        <div>
            <h2>{instruction}</h2>
            <div ref={cameraSection}>
                <video ref={videoRef}></video>
            </div>
            <button onClick={startFaceValidation}>Validate and Start Tracking</button>
            <button onClick={goBack}>Go to Home</button>
        </div>
    );
}

export default FaceCompareAndTracking