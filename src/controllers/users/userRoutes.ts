// Router File (e.g., users.ts)

import { Hono } from "hono";
import {
  getAllUsersController,
  getAllStudentsController,
  getAllCoachesController,
  createCoachController,
  // 💡 New Imports
  createStudentController,
  createUserController,
  getStudentsByActivityController,
  getUserSessionsController,
  getUserSessionsByRfidController,
  loginController,
  logoutController,
  verifyTokenMiddleware,
  getCurrentUserController, // Used for /registerStudent
  getStudentDetailsController,
  updateStudentController,
  getStudentSessionsController,
  updateStudentSessionsController,
  checkRfidController,
  getCoachById,
  assignActivityToCoach,
  removeActivityFromCoach,
  updateCoach,
} from "./usersController.js";

const users = new Hono()
  .get("/getAllUsers", getAllUsersController)
  .get("/getAllStudents", getAllStudentsController)
  .post("/createCoach", createCoachController)
  // 👇 ADDED ROUTES FOR STUDENT CREATION AND ENROLLMENT
  .post("/createStudent", createStudentController) // Step 1: Create base user
  .post("/registerStudent", createUserController) // Step 2: Enroll and set isEnrolledInAfterSchool = true
  .get("/getStudentsByActivity/:activityId", getStudentsByActivityController)
  .get("/getUserSessions/:userId", getUserSessionsController)
  .get("/getUserSessionsByRfid/:rfid", getUserSessionsByRfidController)
  .post("/api/auth/login", loginController)
  .get("/api/auth/me", verifyTokenMiddleware, getCurrentUserController)
  .post("/api/auth/logout", logoutController)
  .get("/getStudentDetails/:id", getStudentDetailsController)
  .put("/updateStudent/:id", updateStudentController)
  .get("/getStudentSessions/:id", getStudentSessionsController)
  .put("/updateStudentSessions/:id", updateStudentSessionsController)
  .get('/checkRfid/:rfid', checkRfidController)
  .get("/getAllCoaches", getAllCoachesController)
  .get('/getCoachById/:id', getCoachById)
  .put('/updateCoach/:id', updateCoach)
  .post('/assignActivityToCoach', assignActivityToCoach)
  .delete('/removeActivityFromCoach', removeActivityFromCoach); 

export default users;
