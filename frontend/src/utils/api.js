// import axios from "axios";

// const API_BASE_URL = process.env.REACT_APP_API_URL + "/api/canvas";

// export const updateCanvas = async (canvasId, elements) => {
//   const token = localStorage.getItem("whiteboard_user_token");
//   try {
//     const response = await axios.put(
//       `${API_BASE_URL}/update`,
//       { canvasId, elements },
//       {
//         headers: {
//           Authorization: token,
//         },
//       }
//     );
//     console.log("Canvas updated successfully in the database!", response.data);
//     return response.data;
//   } catch (error) {
//     console.error("Error updating canvas:", error);
//   }
// };

// export const fetchInitialCanvasElements = async (canvasId) => {
//   const token = localStorage.getItem("whiteboard_user_token");
//   try {
//     const response = await axios.get(`${API_BASE_URL}/load/${canvasId}`, {
//       headers: {
//         Authorization: token,
//       },
//     });
//     return response.data.elements;
//   } catch (error) {
//     console.error("Error fetching initial canvas elements:", error);
//   }
// };
