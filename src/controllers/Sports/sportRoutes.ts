import { Hono } from 'hono';
import { 
  createSportController, 
  getAllSportsController, 
  uploadPhotoController, 
  getEnrolledStudentsController, 
  getActivityByIdController, 
  markAttendanceAndDeductController, 
  getTodayAttendanceController, 
  getAllAttendanceTransactionsController,
  updateSportController,  // Add this
  deleteSportController,
  getStudentsWithSessionsController,
  getWeeklyScheduleController

} from './sportController.js';

const sports = new Hono()
  .post('/createSport', createSportController)
  .get('/getAllSports', getAllSportsController)
  .post('/uploadPhoto', uploadPhotoController)
  .get('/activities/:id/enrolled-students', getEnrolledStudentsController)
  .get('/getActivityById/:id', getActivityByIdController)
  .post('/markAttendanceAndDeduct', markAttendanceAndDeductController)
  .get('/getTodayAttendance', getTodayAttendanceController)
  .get('/getAllAttendanceTransactions', getAllAttendanceTransactionsController)
  .put('/updateSport', updateSportController)           // Add this line
  .delete('/deleteSport/:id', deleteSportController)  // Add this line
  .get('/activities/:id/students-with-sessions', getStudentsWithSessionsController)
  .get('/getWeeklySchedule', getWeeklyScheduleController);

export default sports;