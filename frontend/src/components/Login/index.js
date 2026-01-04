import React, { useState, useContext, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import styles from "./index.module.css";
import boardContext from "../../store/board-context";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { isUserLoggedIn, setUserLoginStatus } = useContext(boardContext);

  useEffect(() => {
    const token = localStorage.getItem("whiteboard_user_token");
    if (token) {
      navigate("/");
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/users/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("whiteboard_user_token", data.token);
        setUserLoginStatus(true);
        // Disconnect and reload to ensure socket and API use new token
        import("../../utils/socket").then(({ default: socket }) => {
          if (socket && socket.connected) {
            socket.disconnect();
          }
          window.location.reload();
        });
      } else {
        alert(data.message || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("An error occurred during login");
    }
  };

  return (
    <>
      <div className={styles.loginBackground}></div>
      <div className={styles.loginOverlay}></div>
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginTitle}>Sign in to Whiteboard</div>
          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Login</button>
          </form>
          <Link to="/register" className={styles.loginLink}>
            Don't have an account? Register here
          </Link>
        </div>
      </div>
    </>
  );
};

export default Login;
