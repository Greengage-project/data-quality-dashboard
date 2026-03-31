import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const DRUID_URL = process.env.DRUID_URL || 'https://your-druid-host/druid/v2/';
const DRUID_AUTHORIZATION = process.env.DRUID_AUTHORIZATION || 'Basic your_druid_basic_auth_username:your_druid_basic_auth_password'

const druidRouter = express.Router();

druidRouter.post('/sql', async (req: Request, res: Response) => {
    try {
        const response = await axios.post(DRUID_URL + 'sql', req.body, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': DRUID_AUTHORIZATION,
            },
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Error proxying request to Druid SQL endpoint:', error);
        if (axios.isAxiosError(error) && error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

druidRouter.post('/', async (req: Request, res: Response) => {
    try {
        const response = await axios.post(DRUID_URL, req.body, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': DRUID_AUTHORIZATION,
            },
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Error proxying request to Druid:', error);
        if (axios.isAxiosError(error) && error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

app.use('/druid/v2', druidRouter);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
