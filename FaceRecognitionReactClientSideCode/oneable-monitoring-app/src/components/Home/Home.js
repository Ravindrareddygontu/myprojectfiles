import React from 'react';
import './Home.css'
import { useNavigate } from 'react-router-dom';
import './Home.css'

/**
 * MainContent Component: Display the main content with user options.
 */
function HomeContent() {
    const navigate = useNavigate()
    localStorage.setItem('server_socket','localhost:8000')
    console.log(process.env.REACT_APP_NOT_SECRET_CODE);
    const handleButtonClick = (type) => {
        if (type === "registered") {
            navigate('registered-email-form')
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
