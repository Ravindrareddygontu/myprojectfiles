import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import HomeContent from './components/Home/Home';
import RegisteredEmailForm from './components/RegisteredEmailForm/RegisteredEmailForm';
import UnRegisteredEmailForm from './components/UnRegisteredEmailForm/UnRegisteredEmailForm';
import LivenessCheck from './components/LivenessCheck/LivenessCheck';
import FaceCompareAndTracking from './components/FaceCompareAndTracking/FaceCompareAndTracking';
import UploadPhoto from './components/UploadPhoto/UploadPhoto';
import UploadVideo from './components/UploadVideo/UploadVideo';
// import Footer from './components/Footer';

function App() {
  return (
    <>    
    {/* <Navbar/> */}
    <React.StrictMode>

    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeContent />} />
        <Route path="/unregistered-email-form" element={<UnRegisteredEmailForm />} />
        <Route path="/registered-email-form" element={<RegisteredEmailForm />} />
        <Route path='/liveness-check' element={<LivenessCheck/>} />
        <Route path='/face-compare-and-tracking' element={<FaceCompareAndTracking/>}/>
        <Route path='/upload-photo' element={<UploadPhoto/>}/>
        <Route path='/upload-video' element={<UploadVideo/>}/>
        <Route />
      </Routes>
    </BrowserRouter>
    </React.StrictMode>
        </>

  );
}

export default App;
