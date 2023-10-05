import React, { useState } from 'react';
import './RegisteredEmailForm.css';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { sendRequestToServer } from '../../apiUtils';

/**
 * EmailForm Component: Collects the email from a registered user.
 */
function RegisteredEmailForm() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);

    const navigate = useNavigate()


    // Function to handle email submission
    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('validing with server');

        sendRequestToServer(email)
            .then(result => {
                console.log(result.detail);
                setError(result.detail);

                if (result.message === 'registered') {
                    localStorage.setItem('email', email);
                    navigate('/liveness-check');
                }
                if(result.message === 'not_registered'){
                    setError('not registered yet')
                }
            })
            .catch(error => {
                setError(error);
                console.error(error);
            });
    };


    const goToHome = () => {
        navigate('/')
    }

    return (
        <div className="email-form-container">
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit}>
                <label htmlFor="email">Enter your email:</label>
                <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@domain.com"
                />
                <button type="submit">Submit</button>
            </form>
            <button onClick={goToHome}>Go Back</button>
        </div>
    );
}

export default RegisteredEmailForm;
