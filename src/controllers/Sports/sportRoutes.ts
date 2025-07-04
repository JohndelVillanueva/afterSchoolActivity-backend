import { Hono } from 'hono';
import { createSportController, getAllSportsController, uploadPhotoController, getEnrolledStudentsController, getActivityByIdController, markAttendanceAndDeductController, getTodayAttendanceController, getAllAttendanceTransactionsController } from './sportController.js';

const sports = new Hono()
  .post('/createSport', createSportController)
  .get('/getAllSports', getAllSportsController)
  .post('/uploadPhoto', uploadPhotoController)
  .get('/activities/:id/enrolled-students', getEnrolledStudentsController)
  .get('/getActivityById/:id', getActivityByIdController)
  .post('/markAttendanceAndDeduct', markAttendanceAndDeductController)
  .get('/getTodayAttendance', getTodayAttendanceController)
  .get('/getAllAttendanceTransactions', getAllAttendanceTransactionsController);

export default sports; 