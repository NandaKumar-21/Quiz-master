// Participant API endpoints for Quiz Master
// Handles participant authentication, question retrieval, and answer submission

import { 
    isTeamRegistered,
    addAttendee,
    getQuizState,
    getQuestion,
    hasTeamAnswered,
    submitAnswer
} from './db.js';

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
            case 'join':
                return await joinQuiz(body);
            
            case 'getCurrentQuestion':
                return await getCurrentQuestion(body);
            
            case 'submitAnswer':
                return await submitParticipantAnswer(body);
            
            default:
                return jsonResponse({ success: false, message: 'Invalid action' }, 400);
        }
    } catch (error) {
        console.error('Participant API error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Internal server error' 
        }, 500);
    }
};

// Join quiz as participant
const joinQuiz = async ({ teamId }) => {
    try {
        // Validate team ID format
        if (!teamId || !/^\d{5}$/.test(teamId)) {
            return jsonResponse({ 
                success: false, 
                message: 'Team ID must be exactly 5 digits' 
            }, 400);
        }

        // Check if team is registered
        const isRegistered = await isTeamRegistered(teamId);
        if (!isRegistered) {
            return jsonResponse({ 
                success: false, 
                message: 'Team ID not registered for this quiz' 
            }, 403);
        }

        // Add to attendees (will ignore if already exists due to ON CONFLICT)
        await addAttendee(teamId);

        return jsonResponse({ 
            success: true, 
            message: 'Successfully joined the quiz!' 
        });
    } catch (error) {
        console.error('Join quiz error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Failed to join quiz' 
        }, 500);
    }
};

// Get current question for participant
const getCurrentQuestion = async ({ teamId }) => {
    try {
        if (!teamId) {
            return jsonResponse({ 
                success: false, 
                message: 'Team ID required' 
            }, 400);
        }

        const quizState = await getQuizState();
        
        // Check if quiz has started and there's a current question
        if (!quizState.is_started || quizState.current_question === 0) {
            return jsonResponse({ 
                success: true, 
                data: { 
                    hasQuestion: false,
                    message: 'Waiting for quiz to start or next question'
                } 
            });
        }

        // Check if team has already answered this question
        const alreadyAnswered = await hasTeamAnswered(teamId, quizState.current_question);
        if (alreadyAnswered) {
            return jsonResponse({ 
                success: true, 
                data: { 
                    hasQuestion: false,
                    alreadyAnswered: true,
                    message: 'Already answered this question. Waiting for next question.'
                } 
            });
        }

        // Get the current question
        const question = await getQuestion(quizState.current_question);
        if (!question) {
            return jsonResponse({ 
                success: false, 
                message: 'Question not found' 
            }, 404);
        }

        // Calculate time remaining (60 seconds from question start)
        const questionStartTime = new Date(quizState.question_start_time);
        const currentTime = new Date();
        const elapsedSeconds = Math.floor((currentTime - questionStartTime) / 1000);
        const timeRemaining = Math.max(0, 60 - elapsedSeconds);

        // If time has expired, don't show the question
        if (timeRemaining === 0) {
            return jsonResponse({ 
                success: true, 
                data: { 
                    hasQuestion: false,
                    message: 'Time expired for this question'
                } 
            });
        }

        return jsonResponse({ 
            success: true, 
            data: {
                hasQuestion: true,
                questionNumber: quizState.current_question,
                question: {
                    question: question.question,
                    options: [
                        question.option_a,
                        question.option_b,
                        question.option_c,
                        question.option_d
                    ]
                },
                timeRemaining,
                startTime: quizState.question_start_time
            }
        });
    } catch (error) {
        console.error('Get current question error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Failed to get current question' 
        }, 500);
    }
};

// Submit participant answer
const submitParticipantAnswer = async ({ teamId, questionNumber, answer, responseTime }) => {
    try {
        if (!teamId || !questionNumber) {
            return jsonResponse({ 
                success: false, 
                message: 'Team ID and question number required' 
            }, 400);
        }

        // Validate team is registered
        const isRegistered = await isTeamRegistered(teamId);
        if (!isRegistered) {
            return jsonResponse({ 
                success: false, 
                message: 'Team not registered' 
            }, 403);
        }

        // Check if team has already answered this question
        const alreadyAnswered = await hasTeamAnswered(teamId, questionNumber);
        if (alreadyAnswered) {
            return jsonResponse({ 
                success: false, 
                message: 'Answer already submitted for this question' 
            }, 400);
        }

        // Get quiz state to verify this is the current question
        const quizState = await getQuizState();
        if (questionNumber !== quizState.current_question) {
            return jsonResponse({ 
                success: false, 
                message: 'This question is no longer active' 
            }, 400);
        }

        // Check if time limit has been exceeded
        if (quizState.question_start_time) {
            const questionStartTime = new Date(quizState.question_start_time);
            const currentTime = new Date();
            const elapsedSeconds = Math.floor((currentTime - questionStartTime) / 1000);
            
            if (elapsedSeconds > 60) {
                return jsonResponse({ 
                    success: false, 
                    message: 'Time limit exceeded for this question' 
                }, 400);
            }
        }

        // Submit the answer
        const success = await submitAnswer(teamId, questionNumber, answer, responseTime || 60);
        
        if (success) {
            return jsonResponse({ 
                success: true, 
                message: 'Answer submitted successfully' 
            });
        } else {
            return jsonResponse({ 
                success: false, 
                message: 'Failed to submit answer' 
            }, 500);
        }
    } catch (error) {
        console.error('Submit answer error:', error);
        return jsonResponse({ 
            success: false, 
            message: 'Failed to submit answer' 
        }, 500);
    }
};