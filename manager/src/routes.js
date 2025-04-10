import express from 'express';
import * as managerController from './controller.js';

const appRouter = express.Router()

appRouter.get('/api/hash/status', managerController.getTaskStatus)
appRouter.post('/api/hash/crack', managerController.postTaskToWorkers)
appRouter.patch('/internal/api/manager/hash/crack/request', managerController.patchTaskFromWorkers)

export const AppRoutes = appRouter;