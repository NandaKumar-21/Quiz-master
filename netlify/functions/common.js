// Common API endpoints for Quiz Master
// Handles shared functionality like leaderboard that both host and participants need

import { getLeaderboard } from './db.js';

// Helper to create JSON response
const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
};

// Handle preflight OPTIONS requests
const handleOptions = () => {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
};

// Main handler function
export default async (request, context) => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
        return handleOptions();
    }

    if (request.method !== 'POST') {
        return jsonResponse({ success: false, message: 'Method not allowed' }, 405);
    }

    try {
        const body = await request.json();
        const { action } = body;

        switch (action) {
            case 'getLeaderboard':
                return await getLeaderboardData(body);
            
            case 'health':
                return await healthCheck();
            
            default:
                return jsonResponse({ success: false, message: 'Invalid action' }, 400);
        }
    } catch (error) {
        console.error('Common API error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Internal server error' 
        }, 500);
    }
};

// Get leaderboard data
const getLeaderboardData = async ({ limit = 100 }) => {
    try {
        const leaderboard = await getLeaderboard(limit);
        
        return jsonResponse({ 
            success: true, 
            data: leaderboard 
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Failed to get leaderboard' 
        }, 500);
    }
};

// Health check endpoint
const healthCheck = async () => {
    return jsonResponse({ 
        success: true, 
        message: 'API is healthy',
        timestamp: new Date().toISOString()
    });
};