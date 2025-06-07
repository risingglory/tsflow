import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors({
  origin: 'http://localhost:3000'
}));

app.use(express.json());

// Proxy endpoint for Tailscale API
app.use('/api/v2', async (req, res) => {
  try {
    const apiKey = process.env.TAILSCALE_ACCESS_TOKEN;
    const tailnet = process.env.TAILSCALE_TAILNET;
    
    if (!apiKey || !tailnet) {
      return res.status(500).json({ 
        error: 'API key or tailnet not configured' 
      });
    }

    const tailscaleUrl = `https://api.tailscale.com/api/v2${req.url}`;
    
    const response = await fetch(tailscaleUrl, {
      method: req.method,
      headers: {
        'Authorization': `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`API proxy server running on http://localhost:${PORT}`);
});