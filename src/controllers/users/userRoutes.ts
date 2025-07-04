import { Hono } from 'hono';
import { getAllUsersController, registerStudentController, } from './usersController.js';

const users = new Hono()
  .get('/getAllUsers', getAllUsersController)
  .post('/registerStudent', registerStudentController)

export default users;

