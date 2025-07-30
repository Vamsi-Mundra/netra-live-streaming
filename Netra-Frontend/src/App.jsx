import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignUp from './pages/SignUp';
import SignIn from './pages/SignIn';
import Gallery from './pages/Gallery';
import Stream from './pages/Stream';
import Viewer from './pages/Viewer';
import CameraTest from './pages/CameraTest';
import Status from './pages/Status';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<SignIn />} />
        <Route path="/videos" element={<Gallery />} />
        <Route path="/stream" element={<Stream />} />
        <Route path="/viewer/:roomId" element={<Viewer />} />
        <Route path="/camera-test" element={<CameraTest />} />
        <Route path="/status" element={<Status />} />
        <Route path="/" element={<Status />} />
      </Routes>
    </Router>
  );
}

export default App;
