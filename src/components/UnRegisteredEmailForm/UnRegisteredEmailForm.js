import React, { useState } from 'react';
import './UnRegisteredEmailForm.css';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { sendRequestToServer } from '../../apiUtils';


/**
 * EmailForm Component: Collects the email from a registered user.
 */
function UnRegisteredEmailForm() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);

    const navigate = useNavigate()
    

    // Function to handle email submission
    const handleSubmit = (e) => {
        e.preventDefault();
        
        sendRequestToServer(email)
            .then(result => {
                console.log(result.detail);
                setError(result.detail);
                if (result.message === 'not_registered') {
                    localStorage.setItem('email', email);
                    navigate('/upload-photo');
                } 
                if(result.message === 'registered'){
                    promptReRegister().then(response => {
                        if(response === 'yes') {
                            localStorage.setItem('email', email);
                            navigate('/upload-photo');
                        }
                    });
                }
            })
            .catch(error => {
                setError(error);
                console.error(error);
            });
    }
        

    async function promptReRegister() {
        let returnValue = ''
        await Swal.fire({
            title: 'Are you sure',
            text: "You are already registered, want to re-register?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes'
          }).then((result) => {
            if (result.isConfirmed) {
                console.log(result);
                returnValue = 'yes'
            }
          })
        console.log('returning', returnValue);
        return returnValue
    }

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

export default UnRegisteredEmailForm;
