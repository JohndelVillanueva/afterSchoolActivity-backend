import sportsRoutes from './Sports/sportRoutes.js';
import usersRoutes from './users/userRoutes.js'; // <-- add this

export const routes = [sportsRoutes, usersRoutes] as const; // <-- add usersRoutes here

export type AppRouter = (typeof routes)[number];