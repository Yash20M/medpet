import { Request, Response } from 'express';
import { DashboardService } from './dashboard.service';
import { sendSuccess } from '../../shared/utils/response';

export const DashboardController = {
  async summary(_req: Request, res: Response): Promise<void> {
    const data = await DashboardService.summary();
    sendSuccess(res, { message: 'Dashboard summary fetched.', data });
  },
};
