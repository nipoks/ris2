import * as workerController from './controller.js';
import express from 'express';

const appRouter = express.Router()

appRouter.post('/internal/api/worker/hash/crack/task', workerController.postNewTask)
appRouter.get('/internal/api/worker/progress/:requestId', workerController.getTaskStatus)

export const AppRoutes = appRouter;
