import React, { useState } from 'react';
import './UnRegisteredEmailForm.css';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';

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

        const data = { email: `${email}` }

        axios.post(`http://${localStorage.getItem('server_socket')}/check_email_and_generate_otp`, data).then(async (result) => {
            console.log(result);
            if (result.data.message === 'not_registered') {
                localStorage.setItem('email', email)
                navigate('/upload-photo')
            }
            else {
               const result =  await promptReRegister() 
               if(result === 'yes') {
                localStorage.setItem('email', email)
                navigate('/upload-photo')
               }
            }
            setError()
        }
        ).catch((error) => {
            // console.log(error.response.data.message);
            setError(error.response.data.detail)
            console.error(error);
        })

        console.log(`Email submitted: ${email}`);
    };

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
