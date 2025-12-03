// Router File (e.g., users.ts)

import { Hono } from 'hono';
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
} from './usersController.js';

const users = new Hono()
  .get('/getAllUsers', getAllUsersController)
  .get('/getAllStudents', getAllStudentsController)
  .get('/getAllCoaches', getAllCoachesController)
  .post('/createCoach', createCoachController)
  // 👇 ADDED ROUTES FOR STUDENT CREATION AND ENROLLMENT
  .post('/createStudent', createStudentController) // Step 1: Create base user
  .post('/registerStudent', createUserController)   // Step 2: Enroll and set isEnrolledInAfterSchool = true
  .get('/getStudentsByActivity/:activityId', getStudentsByActivityController)
  .get('/getUserSessions/:userId', getUserSessionsController)
  .get('/getUserSessionsByRfid/:rfid', getUserSessionsByRfidController)
  .post('/api/auth/login', loginController)
  .get('/api/auth/me', verifyTokenMiddleware, getCurrentUserController)
  .post('/api/auth/logout', logoutController)

export default users;