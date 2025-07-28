// Quiz Master - Frontend JavaScript
// This file handles all frontend interactions for both host and participant interfaces

// Global variables
let currentUserType = '';
let teamId = '';
let pollInterval = null;
let questionTimer = null;
let currentQuestionStartTime = null;

// Utility functions
const $ = (id) => document.getElementById(id);
const hide = (element) => element.classList.add('hidden');
const show = (element) => element.classList.remove('hidden');

// API call helper
const apiCall = async (endpoint, data = {}) => {
    try {
        const response = await fetch(`/.netlify/functions/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        return { success: false, message: 'Network error occurred' };
    }
};

// Show error message
const showError = (elementId, message) => {
    const element = $(elementId);
    if (element) {
        element.textContent = message;
        show(element);
        setTimeout(() => hide(element), 5000);
    }
};

// HOST FUNCTIONS
// ===============

// Host authentication
const authenticateHost = async () => {
    const password = $('hostPassword').value.trim();
    if (!password) {
        showError('loginError', 'Please enter password');
        return;
    }

    const result = await apiCall('host', { action: 'authenticate', password });
    
    if (result.success) {
        currentUserType = 'host';
        hide($('loginModal'));
        show($('dashboard'));
        startHostPolling();
    } else {
        showError('loginError', result.message || 'Invalid password');
    }
};

// Start quiz
const startQuiz = async () => {
    const result = await apiCall('host', { action: 'start' });
    
    if (result.success) {
        $('quizStatus').textContent = 'Quiz Started!';
        $('quizStatus').className = 'ml-4 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm';
        $('startQuizBtn').disabled = true;
        $('pushQuestionBtn').disabled = false;
    } else {
        alert(result.message || 'Failed to start quiz');
    }
};

// Push next question
const pushNextQuestion = async () => {
    const result = await apiCall('host', { action: 'pushQuestion' });
    
    if (result.success) {
        if (result.finished) {
            $('quizStatus').textContent = 'Quiz Completed!';
            $('quizStatus').className = 'ml-4 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm';
            $('pushQuestionBtn').disabled = true;
            alert('All questions have been completed!');
        } else {
            $('quizStatus').textContent = `Question ${result.questionNumber} Active`;
            $('quizStatus').className = 'ml-4 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm';
            $('currentQuestionNum').textContent = result.questionNumber;
        }
    } else {
        alert(result.message || 'Failed to push question');
    }
};

// Host polling for dashboard updates
const startHostPolling = () => {
    if (pollInterval) clearInterval(pollInterval);
    updateHostDashboard();
    pollInterval = setInterval(updateHostDashboard, 3000);
};

const updateHostDashboard = async () => {
    try {
        const dashboardData = await apiCall('host', { action: 'getDashboard' });
        const leaderboardData = await apiCall('common', { action: 'getLeaderboard' });
        
        if (dashboardData.success) {
            $('participantCount').textContent = dashboardData.data.participantCount || 0;
            $('currentAnswers').textContent = dashboardData.data.currentAnswers || 0;
            $('remainingQuestions').textContent = dashboardData.data.remainingQuestions || 20;
            $('currentQuestionNum').textContent = dashboardData.data.currentQuestion || 0;
        }
        
        if (leaderboardData.success) {
            updateLeaderboardDisplay(leaderboardData.data);
        }
    } catch (error) {
        console.error('Dashboard update failed:', error);
    }
};

// Export data function
const exportData = async (dataType) => {
    try {
        const result = await apiCall('host', { action: 'export', dataType });
        
        if (result.success) {
            // Create and download CSV file
            const blob = new Blob([result.data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            alert(result.message || 'Export failed');
        }
    } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed due to network error');
    }
};

// PARTICIPANT FUNCTIONS
// ====================

// Join quiz as participant
const joinQuiz = async () => {
    const teamIdInput = $('teamIdInput').value.trim();
    
    if (!teamIdInput || teamIdInput.length !== 5 || !/^\d{5}$/.test(teamIdInput)) {
        showError('joinError', 'Please enter a valid 5-digit Team ID');
        return;
    }

    const result = await apiCall('participant', { action: 'join', teamId: teamIdInput });
    
    if (result.success) {
        teamId = teamIdInput;
        currentUserType = 'participant';
        hide($('loginScreen'));
        show($('quizScreen'));
        $('teamIdDisplay').textContent = `Team: ${teamId}`;
        startParticipantPolling();
    } else {
        showError('joinError', result.message || 'Failed to join quiz');
    }
};

// Start participant polling
const startParticipantPolling = () => {
    if (pollInterval) clearInterval(pollInterval);
    updateParticipantScreen();
    pollInterval = setInterval(updateParticipantScreen, 3000);
};

const updateParticipantScreen = async () => {
    try {
        const questionData = await apiCall('participant', { action: 'getCurrentQuestion', teamId });
        const leaderboardData = await apiCall('common', { action: 'getLeaderboard' });
        
        if (questionData.success) {
            if (questionData.data.hasQuestion && !questionData.data.alreadyAnswered) {
                displayQuestion(questionData.data);
            } else if (questionData.data.alreadyAnswered) {
                showSubmittedMessage();
            } else {
                showWaitingMessage();
            }
        }
        
        if (leaderboardData.success) {
            updateLeaderboardDisplay(leaderboardData.data);
        }
    } catch (error) {
        console.error('Participant update failed:', error);
    }
};

const showWaitingMessage = () => {
    hide($('questionCard'));
    show($('waitingMessage'));
    $('quizStatus').textContent = 'Waiting for next question...';
};

const showSubmittedMessage = () => {
    hide($('questionCard'));
    hide($('waitingMessage'));
    // Could add a "submitted" state here
};

const displayQuestion = (questionData) => {
    hide($('waitingMessage'));
    show($('questionCard'));
    
    const question = questionData.question;
    $('questionNumber').textContent = `Question ${questionData.questionNumber}`;
    $('questionText').textContent = question.question;
    $('quizStatus').textContent = 'Answer the current question';
    
    // Display options
    const optionsContainer = $('optionsContainer');
    optionsContainer.innerHTML = '';
    
    const optionLabels = ['A', 'B', 'C', 'D'];
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'option-button w-full p-4 text-left bg-gray-50 hover:bg-emerald-50 rounded-lg border-2 border-transparent hover:border-emerald-200 transition duration-200';
        button.innerHTML = `<span class="font-semibold">${optionLabels[index]}.</span> ${option}`;
        button.onclick = () => submitAnswer(option, questionData.questionNumber);
        optionsContainer.appendChild(button);
    });
    
    // Start timer
    startQuestionTimer(questionData.timeRemaining, questionData.questionNumber);
    currentQuestionStartTime = new Date(questionData.startTime);
};

const startQuestionTimer = (timeRemaining, questionNumber) => {
    if (questionTimer) clearInterval(questionTimer);
    
    let timeLeft = timeRemaining;
    const timerElement = $('timer');
    
    const updateTimer = () => {
        timerElement.textContent = `${timeLeft}s`;
        
        if (timeLeft <= 10) {
            timerElement.className = 'px-4 py-2 bg-red-100 text-red-700 rounded-lg font-bold timer-warning';
        } else {
            timerElement.className = 'px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold';
        }
        
        if (timeLeft <= 0) {
            clearInterval(questionTimer);
            submitAnswer(null, questionNumber); // Auto-submit when time runs out
        }
        
        timeLeft--;
    };
    
    updateTimer();
    questionTimer = setInterval(updateTimer, 1000);
};

const submitAnswer = async (answer, questionNumber) => {
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    // Calculate response time
    const responseTime = currentQuestionStartTime ? 
        Math.floor((new Date() - currentQuestionStartTime) / 1000) : 60;
    
    const result = await apiCall('participant', {
        action: 'submitAnswer',
        teamId,
        questionNumber,
        answer,
        responseTime
    });
    
    if (result.success) {
        // Hide question and show submitted message
        hide($('questionCard'));
        const submittedDiv = document.createElement('div');
        submittedDiv.className = 'text-center py-16';
        submittedDiv.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-6">
                <svg class="mx-auto h-12 w-12 text-green-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <h3 class="text-lg font-semibold text-green-800">Answer Submitted!</h3>
                <p class="text-green-600 mt-2">Waiting for the next question...</p>
            </div>
        `;
        $('questionArea').appendChild(submittedDiv);
        
        setTimeout(() => {
            submittedDiv.remove();
            showWaitingMessage();
        }, 3000);
    } else {
        alert(result.message || 'Failed to submit answer');
    }
};

// SHARED FUNCTIONS
// ===============

const updateLeaderboardDisplay = (leaderboardData) => {
    const tbody = $('leaderboardBody');
    
    if (!leaderboardData || leaderboardData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No scores yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = leaderboardData.slice(0, 100).map((team, index) => {
        const isCurrentTeam = currentUserType === 'participant' && team.teamId === teamId;
        const rowClass = isCurrentTeam ? 'bg-emerald-50 font-semibold' : '';
        
        return `
            <tr class="leaderboard-row ${rowClass}">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${index + 1}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">${team.teamId}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${team.score}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${team.avgResponseTime}s</td>
            </tr>
        `;
    }).join('');
};

// Event listeners for enter key
document.addEventListener('DOMContentLoaded', () => {
    // Host password enter key
    const hostPasswordInput = $('hostPassword');
    if (hostPasswordInput) {
        hostPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                authenticateHost();
            }
        });
    }
    
    // Team ID enter key
    const teamIdInput = $('teamIdInput');
    if (teamIdInput) {
        teamIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                joinQuiz();
            }
        });
        
        // Only allow numbers in team ID input
        teamIdInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
});

// Clean up intervals when page unloads
window.addEventListener('beforeunload', () => {
    if (pollInterval) clearInterval(pollInterval);
    if (questionTimer) clearInterval(questionTimer);
});