// Database connection helper for Netlify Functions
// Supports both Netlify DB (Neon) and Supabase as fallback

import pkg from 'pg';
const { Pool } = pkg;

// Database connection setup
let dbPool;

// Initialize database connection
const initDB = () => {
    if (dbPool) return dbPool;
    
    // Try Netlify DB first, then fallback to Supabase
    const connectionString = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
    
    if (!connectionString) {
        throw new Error('No database connection string found. Please set NETLIFY_DATABASE_URL or DATABASE_URL');
    }
    
    dbPool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
    
    return dbPool;
};

// Database query helper
export const query = async (text, params = []) => {
    const pool = initDB();
    const client = await pool.connect();
    
    try {
        const result = await client.query(text, params);
        return result;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    } finally {
        client.release();
    }
};

// Helper functions for common database operations

// Get quiz state
export const getQuizState = async () => {
    const result = await query(`
        SELECT * FROM quiz_state 
        ORDER BY id DESC 
        LIMIT 1
    `);
    
    if (result.rows.length === 0) {
        // Initialize quiz state
        await query(`
            INSERT INTO quiz_state (is_started, current_question, total_questions) 
            VALUES (false, 0, 20)
        `);
        return {
            is_started: false,
            current_question: 0,
            total_questions: 20,
            question_start_time: null
        };
    }
    
    return result.rows[0];
};

// Update quiz state
export const updateQuizState = async (updates) => {
    const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');
    
    const values = Object.values(updates);
    
    await query(`
        UPDATE quiz_state 
        SET ${setClause}, updated_at = NOW()
        WHERE id = (SELECT id FROM quiz_state ORDER BY id DESC LIMIT 1)
    `, values);
};

// Get registered teams
export const getRegisteredTeams = async () => {
    const result = await query('SELECT team_id FROM registered_teams');
    return result.rows.map(row => row.team_id);
};

// Check if team is registered
export const isTeamRegistered = async (teamId) => {
    const result = await query(
        'SELECT 1 FROM registered_teams WHERE team_id = $1',
        [teamId]
    );
    return result.rows.length > 0;
};

// Add attendee
export const addAttendee = async (teamId) => {
    await query(`
        INSERT INTO attendees (team_id, joined_at) 
        VALUES ($1, NOW()) 
        ON CONFLICT (team_id) DO NOTHING
    `, [teamId]);
};

// Check if team already answered question
export const hasTeamAnswered = async (teamId, questionNumber) => {
    const result = await query(`
        SELECT 1 FROM responses 
        WHERE team_id = $1 AND question_number = $2
    `, [teamId, questionNumber]);
    return result.rows.length > 0;
};

// Get question by number
export const getQuestion = async (questionNumber) => {
    const result = await query(
        'SELECT * FROM questions WHERE id = $1',
        [questionNumber]
    );
    return result.rows[0] || null;
};

// Submit answer
export const submitAnswer = async (teamId, questionNumber, answer, responseTime) => {
    const question = await getQuestion(questionNumber);
    if (!question) return false;
    
    const isCorrect = answer === question.correct_answer;
    
    await query(`
        INSERT INTO responses (team_id, question_number, answer, response_time, is_correct, submitted_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (team_id, question_number) DO NOTHING
    `, [teamId, questionNumber, answer, responseTime, isCorrect]);
    
    // Update leaderboard
    await updateLeaderboard();
    return true;
};

// Update leaderboard
export const updateLeaderboard = async () => {
    await query(`
        INSERT INTO leaderboard (team_id, score, avg_response_time, updated_at)
        SELECT 
            team_id,
            SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as score,
            ROUND(AVG(response_time), 2) as avg_response_time,
            NOW()
        FROM responses
        GROUP BY team_id
        ON CONFLICT (team_id) DO UPDATE SET
            score = EXCLUDED.score,
            avg_response_time = EXCLUDED.avg_response_time,
            updated_at = EXCLUDED.updated_at
    `);
};

// Get leaderboard
export const getLeaderboard = async (limit = 100) => {
    const result = await query(`
        SELECT 
            ROW_NUMBER() OVER (ORDER BY score DESC, avg_response_time ASC) as rank,
            team_id,
            score,
            avg_response_time
        FROM leaderboard
        ORDER BY score DESC, avg_response_time ASC
        LIMIT $1
    `, [limit]);
    
    return result.rows;
};

// Get dashboard data for host
export const getHostDashboardData = async () => {
    const [attendeesResult, currentAnswersResult, quizState] = await Promise.all([
        query('SELECT COUNT(*) as count FROM attendees'),
        query(`
            SELECT COUNT(*) as count FROM responses 
            WHERE question_number = (
                SELECT current_question FROM quiz_state 
                ORDER BY id DESC LIMIT 1
            )
        `),
        getQuizState()
    ]);
    
    return {
        participantCount: parseInt(attendeesResult.rows[0].count),
        currentAnswers: parseInt(currentAnswersResult.rows[0].count),
        remainingQuestions: quizState.total_questions - quizState.current_question,
        currentQuestion: quizState.current_question,
        isStarted: quizState.is_started
    };
};

// Export data functions
export const exportAttendees = async () => {
    const result = await query(`
        SELECT team_id as "Team ID", 
               joined_at as "Join Time"
        FROM attendees 
        ORDER BY joined_at
    `);
    
    return {
        data: result.rows,
        filename: 'quiz_attendees.csv'
    };
};

export const exportResponses = async () => {
    const result = await query(`
        SELECT 
            team_id as "Team ID",
            question_number as "Question",
            answer as "Answer",
            response_time as "Response Time (s)",
            is_correct as "Correct",
            submitted_at as "Submitted At"
        FROM responses 
        ORDER BY team_id, question_number
    `);
    
    return {
        data: result.rows,
        filename: 'quiz_responses.csv'
    };
};

export const exportLeaderboard = async () => {
    const result = await query(`
        SELECT 
            ROW_NUMBER() OVER (ORDER BY score DESC, avg_response_time ASC) as "Rank",
            team_id as "Team ID",
            score as "Score",
            avg_response_time as "Avg Response Time (s)"
        FROM leaderboard
        ORDER BY score DESC, avg_response_time ASC
    `);
    
    return {
        data: result.rows,
        filename: 'quiz_leaderboard.csv'
    };
};

// Convert data to CSV format
export const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => 
        headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma or quote
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
};

// Initialize database tables (run once during setup)
export const initializeTables = async () => {
    try {
        // Create tables if they don't exist
        await query(`
            CREATE TABLE IF NOT EXISTS registered_teams (
                team_id VARCHAR(5) PRIMARY KEY,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        await query(`
            CREATE TABLE IF NOT EXISTS attendees (
                team_id VARCHAR(5) PRIMARY KEY REFERENCES registered_teams(team_id),
                joined_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        await query(`
            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                question TEXT NOT NULL,
                option_a TEXT NOT NULL,
                option_b TEXT NOT NULL,  
                option_c TEXT NOT NULL,
                option_d TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        await query(`
            CREATE TABLE IF NOT EXISTS quiz_state (
                id SERIAL PRIMARY KEY,
                is_started BOOLEAN DEFAULT FALSE,
                current_question INTEGER DEFAULT 0,
                total_questions INTEGER DEFAULT 20,
                question_start_time TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        await query(`
            CREATE TABLE IF NOT EXISTS responses (
                id SERIAL PRIMARY KEY,
                team_id VARCHAR(5) REFERENCES registered_teams(team_id),
                question_number INTEGER NOT NULL,
                answer TEXT,
                response_time INTEGER,
                is_correct BOOLEAN,
                submitted_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(team_id, question_number)
            )
        `);
        
        await query(`
            CREATE TABLE IF NOT EXISTS leaderboard (
                team_id VARCHAR(5) PRIMARY KEY REFERENCES registered_teams(team_id),
                score INTEGER DEFAULT 0,
                avg_response_time DECIMAL(5,2) DEFAULT 0,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        console.log('Database tables initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing database tables:', error);
        throw error;
    }
};