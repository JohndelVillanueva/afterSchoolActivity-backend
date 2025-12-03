import sportsRoutes from './Sports/sportRoutes.js';
import usersRoutes from './users/userRoutes.js'; // <-- add this
import activitiesRoutes from './activities/activityRoutes.js';

export const routes = [sportsRoutes, usersRoutes, activitiesRoutes] as const; // <-- add usersRoutes here

export type AppRouter = (typeof routes)[number];