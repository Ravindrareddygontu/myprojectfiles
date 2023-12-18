import axios from "axios";
import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import './UploadPhoto.css'

function UploadPhoto() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const videoRef = useRef(null)
    const [isPhotoTaken, setIsPhotoTaken] = useState(false)
    const [isLoading, setIsLoading] = useState(false);


    const path = process.env.PUBLIC_URL + 'gestureImages/Blink_Eyes.jpg'
    console.log(path);


    const handleUploadPhoto = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Convert file to Base64 and store in local storage for demo purposes
            const reader = new FileReader();
            reader.onloadend = async () => {
                // console.log(reader.result);
                const dataUrl = reader.result.split(',')[1]
                // console.log(dataUrl);
                const data = { photo: dataUrl, email: localStorage.getItem('email') }
                setIsLoading(true);
                sendPhotoToServer(data)
            };
            reader.readAsDataURL(file);
        }
    };

    const sendPhotoToServer = async (data) => {
        await axios.post('http://localhost:8000/uploads', data).then(async (response) => {
            console.log(response);
            setIsLoading(false);
            if (response.data.message === 'photo is matched') {
                await Swal.fire({
                    title: 'Sucess',
                    text: 'Photo Uploading successful, continue with video',
                    icon: 'success',
                    confirmButtonText: 'OK'
                });
                if (videoRef.current && videoRef.current.srcObject) {
                    videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
                }
                navigate('/upload-video')
            }
            else {
                Swal.fire({
                    title: 'Error!',
                    text: 'Photo Uploading Unsuccessful, provide clarity photo of you',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
        }).catch((error) => {
            console.log(error);
            throw new Error(error)
        })
    }

    const handleTakePhoto = async () => {

        let stream
        if (videoRef.current.srcObject) {
            const dataUrl = getCanvasPhoto()
            const data = { photo: dataUrl, email: localStorage.getItem('email') }
            setIsLoading(true);
            sendPhotoToServer(data)
        }
        else {
            stream = await navigator.mediaDevices.getUserMedia({ video: true })
            videoRef.current.srcObject = stream
            videoRef.current.play()
            setIsPhotoTaken(true)
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
        canvasContext.drawImage(videoRef.current, 150, 75, videoWidth, videoHeight);

        const dataUrl = canvas.toDataURL()
        return dataUrl.split(',')[1]
    }


    const handleCancelRegistration = async () => {
        await Swal.fire({
            title: 'Are you sure',
            text: "Confirm to Cancel Registration",
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
                }
                navigate('/');
            }
        })
    };

    return (
        <div>
            <h1>Upload Photo Section</h1>
            <video ref={videoRef}></video>
            {/* Hidden file input for photo upload */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadPhoto}
                style={{ display: "none" }}
                accept="image/*"
            />
            {isLoading && (
                <div className="overlay">
                    <div className="spinner"></div>
                    <p className="loading-text">Validating photo...</p>
                </div>
            )}

            <button onClick={() => fileInputRef.current.click()}>Upload Photo</button>
            <button onClick={handleTakePhoto}>
                {isPhotoTaken ? "Capture and Upload" : "Take Photo Now"}
            </button>
            <button onClick={handleCancelRegistration}>Cancel Registration</button>
        </div>
    );
}

export default UploadPhoto;
