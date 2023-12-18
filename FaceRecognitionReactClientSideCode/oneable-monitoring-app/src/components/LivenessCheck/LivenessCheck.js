import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import './LivenessCheck.css'
import { GestureRecognizer, FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import Swal from "sweetalert2";
import axios from "axios";

const LivenessCheck = () => {
    const videoRef = useRef(null);
    const streamRef = useRef(null)
    const [cameraButton, setCameraButton] = useState('start camera')
    const [instruction, setInstruction] = useState('click "start camera" button if you are ready')
    const [distanceOfUser, setDistanceOfUser] = useState()
    const [livenessButton, setLivenessButton] = useState(false)
    const [gestureImagePath, setGestureImagePath] = useState("")
    const userVisibility = useRef(false)
    const animationId = useRef(null)
    const distance = useRef(0)
    const indexofOfGesturesList = useRef(0)
    const gestureName = useRef("")
    const livenessCheckAllowedChances = useRef(3)
    const livenessCheckTimeLimitPerChance = useRef(0)
    const previousTime = useRef()
    const currentTime = useRef()
    const livenessChecking = useRef(false)

    let faceLandmarker
    let gestureRecognizer
    const widthOfFace = 6.8
    const focalLength = 800

    let navigate = useNavigate()

    async function loadModels() {
        await createGestureRecognizer()
        await createFaceLandmarker()
        console.log('models loaded');
    }

    // Function to create the GestureRecognizer
    const createGestureRecognizer = async () => {
        try {
            // Load the vision tasks using the FilesetResolver from the specified URL
            const gestureVision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            // Create the GestureRecognizer using the loaded vision tasks and options
            gestureRecognizer = await GestureRecognizer.createFromOptions(gestureVision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"
                },
                runningMode: 'VIDEO',
                numHands: 2
            });

            console.log("Gesture recognizer model loaded successfully.");
        } catch (error) {
            console.error("Error creating gesture recognizer:", error);
        }
    };

    // Function to create the FaceLandmarker
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
        }
    };


    const startCamera = async () => {
        if (navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
                if (!videoRef.current.srcObject) {
                    videoRef.current.srcObject = streamRef.current
                    videoRef.current.onloadedmetadata = async () => {
                        await videoRef.current.play()
                    }
                }
            } catch (error) {
                console.error("Error accessing camera:", error);
                throw new Error(error)
            }
        } else {
            console.error("MediaDevices API not supported in this browser");
        }



        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true })

    }

    const loadModelsAndStartCamera = async () => {
        console.log(userVisibility.current);
        if (!userVisibility.current) {
            await loadModels()
            await startCamera()
        }
        else {
            if (!livenessChecking.current) {
                await loadModels()
                await Swal.fire({
                    title: 'Important Instruction',
                    text: "You have 3 chances to perform gestures that are suggested by it with only single hand. Each chance have time limit of 15 seconds",
                    icon: 'info',
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Understood'
                })
                startLivenessCheck()
            }
            else {
                await Swal.fire('Ongoing', 'liveness checking is on', 'info')
            }

        }
    }

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
            // console.log('yes landmarks', faceLandmarks);
            const leftIrisCentroid = computeCentroid(FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, landmarks);
            const rightIrisCentroid = computeCentroid(FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, landmarks);

            let distance = Math.sqrt(Math.pow(rightIrisCentroid.x - leftIrisCentroid.x, 2) + Math.pow(rightIrisCentroid.y - leftIrisCentroid.y, 2));
            // console.log(distance);
            distance = ((widthOfFace * focalLength) / (distance * 1000)).toFixed(2)
            // console.log(distance, 'cms');
            return Math.round(distance)
        }
    }

    const checkUserVisibility = async () => {
        let milliseconds = Date.now()
        const faceLandmarksDetections = await faceLandmarker.detectForVideo(videoRef.current, milliseconds)
        if (faceLandmarksDetections.faceLandmarks[0]) {
            // Getting the Distance(Depth) of the user and displaying
            distance.current = getDistanceOfTheUser(faceLandmarksDetections.faceLandmarks)
            setDistanceOfUser('Distance: ' + distance.current + 'cms')
            if (distance.current > 60) {
                await Swal.fire('Please make sure you maintain 60 cms from camera')
            }
            userVisibility.current = true
            setCameraButton("start liveness check")
            setInstruction("click 'start liveness check' button to perform gestures")
        }
        else {
            await Swal.fire('instruction', 'Please make sure you infront of the camera', 'info')
        }
        if (!userVisibility.current) {
            requestAnimationFrame(checkUserVisibility)
        }
    }

    let gestures = ['Open_Palm', 'Thumb_Up', 'Thumb_Down', 'Victory', 'Closed_Fist', 'Blink_Eyes', 'Smile']

    function shuffle(array) {
        let currentIndex = array.length, randomIndex;

        // While there remain elements to shuffle.
        while (currentIndex !== 0) {

            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    const shuffledGestures = shuffle(gestures);


    // Function to check liveness using GestureRecognizer and FaceLandmarker
    async function startLivenessCheck() {
        try {
            if (livenessCheckTimeLimitPerChance.current < 20 && livenessCheckAllowedChances.current > 0) {
                setGestureImagePath(process.env.PUBLIC_URL + '/gestureImages/' + shuffledGestures[indexofOfGesturesList.current] + '.jpg')

                // Get the current timestamp in milliseconds
                let mins = Date.now();

                livenessChecking.current = true

                gestureName.current = shuffledGestures[indexofOfGesturesList.current]
                console.log(gestureName.current);

                // Use GestureRecognizer to recognize gestures in the video
                const gestureResults = await gestureRecognizer.recognizeForVideo(videoRef.current, mins);

                // Use FaceLandmarker to detect face landmarks in the video
                const faceLandmarksResults = await faceLandmarker.detectForVideo(videoRef.current, mins);

                // Check if any gestures are recognized
                if (gestureResults.gestures.length > 0) {
                    if (gestureResults.gestures.length > 1) {
                        await Swal.fire('info', 'Two Hands Detected, please perform with only one hand', 'info')
                    }
                    let gestureCategory = gestureResults.gestures[0][0].categoryName;
                    // Check if the recognized gesture matches the displayed gestureName
                    if (gestureCategory === gestureName.current) {                 // Increment the indexofOfGesturesList and update the gestureName with the next gesture
                        indexofOfGesturesList.current += 1;
                        gestureName.current = (shuffledGestures[indexofOfGesturesList.current])
                    }
                }
                // Check if face landmarks are detected
                if (faceLandmarksResults.faceLandmarks[0]) {
                    const faceBlendshapes = faceLandmarksResults.faceBlendshapes[0];

                    // Getting the Distance(Depth) of the user and displaying
                    let distance = 'Distance: ' + getDistanceOfTheUser(faceLandmarksResults.faceLandmarks) + 'cms'

                    setDistanceOfUser(distance)
                    // Check blinkPercent and update gestureName and save the photo to the files
                    if (faceBlendshapes && faceBlendshapes.categories[9].score > 0.2) {
                        if (gestureName.current === "Blink_Eyes") {
                            indexofOfGesturesList.current += 1;
                            await sendPhotoToServer('blinked')
                            gestureName.current = (shuffledGestures[indexofOfGesturesList.current])
                        }
                    }

                    // Check smilePercent and update gestureName if needed
                    if (faceBlendshapes && faceBlendshapes.categories[44].score > 0.2) {
                        if (gestureName.current === "Smile") {
                            indexofOfGesturesList.current += 1;

                            await sendPhotoToServer('smiled')

                            gestureName.current = (shuffledGestures[indexofOfGesturesList.current])
                        }
                    }
                }
                else {
                    Swal.fire('info', 'please make face visible to the camera', 'info')
                }

                // Check if liveness detection is successful
                if (indexofOfGesturesList.current > 6) {
                    // Update gestureName and perform necessary UI actions
                    gestureName.current = ("liveness Detection successful");
                    await Swal.fire('liveness check successful', 'ready for face recognition', 'success')
                    setDistanceOfUser("")
                    cancelAnimationFrame(animationId.current)
                    console.log('success');
                    navigate('/face-compare-and-tracking')
                }

                // Continue checking for liveness in the next animation frame
                if (gestureName.current !== "liveness Detection successful") {
                    currentTime.current = new Date().getSeconds()
                    if (previousTime.current !== currentTime.current) {
                        livenessCheckTimeLimitPerChance.current += 1
                        previousTime.current = currentTime.current
                    }
                    animationId.current = requestAnimationFrame(startLivenessCheck);
                }
            }
            else {
                if (livenessCheckAllowedChances.current <= 0) {
                    await Swal.fire('Failed a Chance', `You Exhausted Your Chances Try Again after 2 hours`, 'error')
                }
                else {
                    console.log('Liveness Detection failed, Try Again');
                    setGestureImagePath(null)
                    livenessCheckTimeLimitPerChance.current = 0
                    setInstruction('liveness failed, click "Start Again" to start again')
                    setCameraButton('Start Again')
                    indexofOfGesturesList.current = 0
                    livenessCheckAllowedChances.current -= 1
                    Swal.fire('Failed a Chance', `Try Your ${livenessCheckAllowedChances.current} chance out of 3 chances, click "Start Again"`, 'error')
                    livenessChecking.current = false
                }
            }
        }
        catch (error) {
            console.error("Error during liveness detection:", error);
            throw new Error(error)
        }
    }

    function getCanvasPhoto() {
        const canvas = document.createElement('canvas')
        const canvasContext = canvas.getContext('2d')

        const videoWidth = videoRef.current.videoWidth;
        const videoHeight = videoRef.current.videoHeight;

        canvas.width = videoWidth + 300;
        canvas.height = videoHeight + 150;

        // Calculate the center position for the video on the canvas
        const xCentered = (canvas.width - videoWidth) / 2;
        const yCentered = (canvas.height - videoHeight) / 2;

        // Draw the video frame centered on the canvas
        canvasContext.drawImage(videoRef.current, xCentered, yCentered, videoWidth, videoHeight);

        const dataUrl = canvas.toDataURL()
        return dataUrl.split(',')[1]
    }

    async function sendPhotoToServer(imageType) {
        let data 
        const dataUrl = getCanvasPhoto()
        console.log('images created');
        if (imageType === 'smiled') {
            data = { smiled_image: dataUrl,email:localStorage.getItem('email') }
        }
        else {
            data = { eye_blinked_image: dataUrl, email:localStorage.getItem('email') }
        }
        console.log(data);
        await axios.post(`http://${localStorage.getItem('server_socket')}/save_photo`, data).then((response) => {
            console.log(response);
        }).catch((response) => {
            console.log(response);
            throw new Error('photo is not saved')
        })
    }

    const goBack = async () => {
        cancelAnimationFrame(animationId.current)

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
        <div className="liveness-check-container">
            <p>{instruction}</p>
            <p>{distanceOfUser}</p>
            <div>
                <video ref={videoRef} className="liveness-video" onPlay={checkUserVisibility}></video>
                <img src={gestureImagePath} alt="Gesture" height={120} width={150}></img>
            </div>
            <button onClick={loadModelsAndStartCamera}>{cameraButton}</button>
            <button onClick={goBack}>Go Back</button>
        </div>
    );
}

export default LivenessCheck;
