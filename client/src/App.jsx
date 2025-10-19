import { Outlet } from "react-router-dom";
import "./assets/App.css"; 

// This component acts as the main layout for the app.
// <Outlet /> will render the active child route (e.g., Login, Register).
function App() {
  return (
    <div className="app-wrapper">
      {/* later adding permanent Navbar or Header here */}
      <main>
        <Outlet />
      </main>
      {/* later adding permanent Footer here */}
    </div>
  );
}

export default App;