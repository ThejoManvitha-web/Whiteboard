import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import "./index.min.css";
import { useNavigate } from "react-router-dom";
import boardContext from "../../store/board-context";
import { useParams } from "react-router-dom";
import socket from "../../utils/socket";

const API_BASE_URL = process.env.REACT_APP_API_URL;

const Sidebar = () => {
  const [canvases, setCanvases] = useState([]);
  const token = localStorage.getItem("whiteboard_user_token");
  const { canvasId, setCanvasId, isUserLoggedIn, setUserLoginStatus } =
    useContext(boardContext);

  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { id } = useParams();

  const [editingCanvasId, setEditingCanvasId] = useState(null);
  const [newCanvasName, setNewCanvasName] = useState("");
  const editInputRef = useRef(null);

  // Get current user ID from token
  const getCurrentUserId = () => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.userId;
    } catch {
      return null;
    }
  };

  const currentUserId = getCurrentUserId();

  // Ensure Sidebar always joins the correct socket room for the current canvas
  useEffect(() => {
    if (!canvasId) return;
    socket.emit("joinCanvas", { canvasId });
    console.log("Sidebar joined canvas room:", canvasId);
    return () => {
      socket.emit("leaveCanvas", { canvasId });
      console.log("Sidebar left canvas room:", canvasId);
    };
  }, [canvasId]);

  useEffect(() => {
    if (isUserLoggedIn) {
      fetchCanvases();
    }
  }, [isUserLoggedIn]);

  useEffect(() => {
    // Redirect to first canvas if none selected
    if (canvases.length > 0 && !id) {
      navigate(`/${canvases[0]._id}`);
    }
  }, [canvases, id, navigate]);

  useEffect(() => {
    // Listen for canvas name updates
    const handleCanvasNameUpdated = ({ canvasId, name }) => {
      setCanvases((prevCanvases) =>
        prevCanvases.map((canvas) =>
          canvas._id === canvasId ? { ...canvas, name } : canvas
        )
      );
    };
    socket.on("canvasNameUpdated", handleCanvasNameUpdated);
    return () => {
      socket.off("canvasNameUpdated", handleCanvasNameUpdated);
    };
  }, []);

  // Handle outside click to cancel edit
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        editInputRef.current &&
        !editInputRef.current.contains(event.target)
      ) {
        setEditingCanvasId(null);
        setNewCanvasName("");
      }
    }
    if (editingCanvasId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editingCanvasId]);

  const fetchCanvases = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/canvas/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCanvases(response.data);

      if (response.data.length === 0) {
        handleCreateCanvas();
      } else if (!id) {
        setCanvasId(response.data[0]._id);
        navigate(`/${response.data[0]._id}`);
      }
    } catch (error) {
      console.error("Error fetching canvases:", error);
    }
  };

  const handleCreateCanvas = async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/canvas/create`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      fetchCanvases();
      setCanvasId(response.data.canvasId);
      navigate(`/${response.data.canvasId}`);
    } catch (error) {
      console.error("Error creating canvas:", error);
    }
  };

  const handleDeleteCanvas = async (id, isOwner) => {
    if (!isOwner) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/canvas/delete/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCanvases();

      // Navigate to first canvas if available
      if (canvases.length > 1) {
        const nextCanvas = canvases.find((canvas) => canvas._id !== id);
        navigate(`/${nextCanvas._id}`);
      } else {
        handleCreateCanvas();
      }
    } catch (error) {
      setError(error.response?.data?.error || "Failed to delete canvas");
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleCanvasClick = (id) => {
    setCanvasId(id);
    navigate(`/${id}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("whiteboard_user_token");
    setCanvases([]);
    setUserLoginStatus(false);
    navigate("/login");
  };

  const handleLogin = () => {
    navigate("/login");
  };

  const handleShare = async () => {
    if (!email.trim()) {
      setError("Please enter an email.");
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await axios.put(
        `${API_BASE_URL}/api/canvas/share/${canvasId}`,
        { email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(response.data.message);
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to share canvas.");
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleUpdateName = async (canvasId, isOwner) => {
    if (!isOwner) return;
    try {
      await axios.put(
        `${API_BASE_URL}/api/canvas/update-name`,
        { canvasId, name: newCanvasName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingCanvasId(null);
      setNewCanvasName("");
      // The socket event will update the UI
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update name");
      setTimeout(() => setError(""), 5000);
    }
  };

  return (
    <div className="sidebar">
      <button
        className="create-button"
        onClick={handleCreateCanvas}
        disabled={!isUserLoggedIn}
      >
        + Create New Canvas
      </button>

      <ul className="canvas-list">
        {canvases.map((canvas) => {
          const isOwner = canvas.owner.toString() === currentUserId;
          const isSelected = canvas._id === canvasId;
          return (
            <li
              key={canvas._id}
              className={`canvas-item${isSelected ? " selected" : ""}`}
            >
              {editingCanvasId === canvas._id ? (
                <div className="name-edit-container" ref={editInputRef}>
                  <input
                    type="text"
                    value={newCanvasName}
                    onChange={(e) => setNewCanvasName(e.target.value)}
                    maxLength={20}
                    className="name-edit-input"
                    autoFocus
                  />
                  <button
                    onClick={() => handleUpdateName(canvas._id, isOwner)}
                    className="save-name-button"
                    disabled={!isOwner}
                    title={!isOwner ? "Only owner can edit canvas" : ""}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingCanvasId(null);
                      setNewCanvasName("");
                    }}
                    className="cancel-name-button"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className="canvas-name"
                    onClick={() => handleCanvasClick(canvas._id)}
                  >
                    {canvas.name || `Canvas ${canvases.indexOf(canvas) + 1}`}
                  </span>
                  <div className="canvas-actions">
                    <button
                      className={`edit-button${!isOwner ? " disabled" : ""}`}
                      onClick={() => {
                        setEditingCanvasId(canvas._id);
                        setNewCanvasName(canvas.name);
                      }}
                      disabled={!isOwner}
                      title={
                        !isOwner ? "Only owner can edit canvas" : "Edit name"
                      }
                    >
                      ✏️
                    </button>
                    <button
                      className={`delete-button${!isOwner ? " disabled" : ""}`}
                      onClick={() => handleDeleteCanvas(canvas._id, isOwner)}
                      disabled={!isOwner}
                      title={
                        !isOwner
                          ? "Only owner can delete canvas"
                          : "Delete canvas"
                      }
                    >
                      ×
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="share-container">
        <input
          type="email"
          placeholder="Enter email to share"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          className="share-button"
          onClick={handleShare}
          disabled={!isUserLoggedIn}
        >
          Share
        </button>
        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}
      </div>

      {isUserLoggedIn ? (
        <button className="auth-button logout-button" onClick={handleLogout}>
          Logout
        </button>
      ) : (
        <button className="auth-button login-button" onClick={handleLogin}>
          Login
        </button>
      )}
    </div>
  );
};

export default Sidebar;
