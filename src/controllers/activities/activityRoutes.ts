// In your routes file (e.g., index.ts or routes.ts)
import { Hono } from 'hono';
import { 
  getAllActivitiesController,
  getActivityByIdController,
//   createActivityController,
  updateActivityController,
  deleteActivityController
} from './activityController.js';

// Add these routes
const activities = new Hono()
.get('/getAllActivities', getAllActivitiesController)
.get('/activity/:id', getActivityByIdController)
// .post('/createActivity', createActivityController)
.put('/updateActivity/:id', updateActivityController)
.delete('/deleteActivity/:id', deleteActivityController)

export default activities;