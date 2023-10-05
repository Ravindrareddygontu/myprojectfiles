import React from 'react';
import './Home.css'
import { useNavigate } from 'react-router-dom';
import './Home.css'

/**
 * MainContent Component: Display the main content with user options.
 */
function HomeContent() {
    // useNavigate hook for navigation
    const navigate = useNavigate()
    // Set server_socket in local storage
    localStorage.setItem('server_socket','localhost:8000')

    // Function to handle button click events
    const handleButtonClick = (type) => {
        // Navigate to registered-email-form if type is "registered"
        if (type === "registered") {
            navigate('registered-email-form')
        // Navigate to unregistered-email-form if type is "notRegistered"
        } else if (type === "notRegistered") {
            navigate('unregistered-email-form')
        }
    };


    return (
        <div className="main-content animate__animated animate__fadeIn">
            <div className="header">
                <h1>Welcome to Oneable</h1>
                <p>We ensure Security</p>
            </div>
            <div className="btn-group">
                <button className="btn registered hvr-grow-shadow" onClick={() => handleButtonClick("registered")}>
                    Registered
                </button>
                <button className="btn not-registered hvr-grow-shadow" onClick={() => handleButtonClick("notRegistered")}>
                    Not Registered / Re-Register
                </button>
            </div>
        </div>
    );
}

export default HomeContent;
