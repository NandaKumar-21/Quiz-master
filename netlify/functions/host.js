// Host API endpoints for Quiz Master
// Handles host authentication, quiz control, and data export

import { 
    getQuizState, 
    updateQuizState, 
    getQuestion,
    getHostDashboardData,
    exportAttendees,
    exportResponses,
    exportLeaderboard,
    convertToCSV
} from './db.js';

// Host password (should be set as environment variable in production)
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'admin123';

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
            case 'authenticate':
                return await authenticateHost(body);
            
            case 'start':
                return await startQuiz(body);
            
            case 'pushQuestion':
                return await pushNextQuestion(body);
            
            case 'getDashboard':
                return await getDashboardData(body);
            
            case 'export':
                return await exportData(body);
            
            default:
                return jsonResponse({ success: false, message: 'Invalid action' }, 400);
        }
    } catch (error) {
        console.error('Host API error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Internal server error' 
        }, 500);
    }
};

// Authenticate host with password
const authenticateHost = async ({ password }) => {
    if (!password) {
        return jsonResponse({ 
            success: false, 
            message: 'Password required' 
        }, 400);
    }

    if (password === HOST_PASSWORD) {
        return jsonResponse({ 
            success: true, 
            message: 'Authentication successful' 
        });
    } else {
        return jsonResponse({ 
            success: false, 
            message: 'Invalid password' 
        }, 401);
    }
};

// Start the quiz
const startQuiz = async () => {
    try {
        const quizState = await getQuizState();
        
        if (quizState.is_started) {
            return jsonResponse({ 
                success: false, 
                message: 'Quiz already started' 
            }, 400);
        }

        await updateQuizState({
            is_started: true,
            current_question: 0
        });

        return jsonResponse({ 
            success: true, 
            message: 'Quiz started successfully' 
        });
    } catch (error) {
        console.error('Start quiz error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Failed to start quiz' 
        }, 500);
    }
};

// Push next question
const pushNextQuestion = async () => {
    try {
        const quizState = await getQuizState();
        
        if (!quizState.is_started) {
            return jsonResponse({ 
                success: false, 
                message: 'Quiz not started yet' 
            }, 400);
        }

        const nextQuestionNumber = quizState.current_question + 1;
        
        if (nextQuestionNumber > quizState.total_questions) {
            return jsonResponse({ 
                success: true, 
                finished: true,
                message: 'All questions completed' 
            });
        }

        // Get the question to validate it exists
        const question = await getQuestion(nextQuestionNumber);
        if (!question) {
            return jsonResponse({ 
                success: false, 
                message: `Question ${nextQuestionNumber} not found` 
            }, 404);
        }

        await updateQuizState({
            current_question: nextQuestionNumber,
            question_start_time: new Date()
        });

        return jsonResponse({ 
            success: true, 
            finished: false,
            questionNumber: nextQuestionNumber,
            message: `Question ${nextQuestionNumber} pushed successfully` 
        });
    } catch (error) {
        console.error('Push question error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Failed to push question' 
        }, 500);
    }
};

// Get dashboard data
const getDashboardData = async () => {
    try {
        const dashboardData = await getHostDashboardData();
        
        return jsonResponse({ 
            success: true, 
            data: dashboardData 
        });
    } catch (error) {
        console.error('Get dashboard error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Failed to get dashboard data' 
        }, 500);
    }
};

// Export data (attendees, responses, or leaderboard)
const exportData = async ({ dataType }) => {
    try {
        let exportResult;
        
        switch (dataType) {
            case 'attendees':
                exportResult = await exportAttendees();
                break;
            case 'responses':
                exportResult = await exportResponses();
                break;
            case 'leaderboard':
                exportResult = await exportLeaderboard();
                break;
            default:
                return jsonResponse({ 
                    success: false, 
                    message: 'Invalid export type' 
                }, 400);
        }

        if (!exportResult.data || exportResult.data.length === 0) {
            return jsonResponse({ 
                success: false, 
                message: 'No data available for export' 
            }, 404);
        }

        const csvData = convertToCSV(exportResult.data);
        
        return jsonResponse({ 
            success: true, 
            data: csvData,
            filename: exportResult.filename
        });
    } catch (error) {
        console.error('Export data error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Failed to export data' 
        }, 500);
    }
};