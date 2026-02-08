const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');

// Get all work logs (with filters)
const getAllWorkLogs = async (req, res) => {
    try {
        const { project_id, phase_id, start_date, end_date, user_id } = req.query;

        let query = `
            SELECT 
                wl.*,
                u.full_name as user_name,
                u.email as user_email,
                p.name as project_name,
                ph.phase_name
            FROM work_logs wl
            LEFT JOIN users u ON wl.user_id = u.id
            LEFT JOIN projects p ON wl.project_id = p.id
            LEFT JOIN phases ph ON wl.phase_id = ph.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        // Filter by project
        if (project_id) {
            query += ` AND wl.project_id = $${paramCount}`;
            params.push(project_id);
            paramCount++;
        }

        // Filter by phase
        if (phase_id) {
            query += ` AND wl.phase_id = $${paramCount}`;
            params.push(phase_id);
            paramCount++;
        }

        // Filter by user
        if (user_id) {
            query += ` AND wl.user_id = $${paramCount}`;
            params.push(user_id);
            paramCount++;
        }

        // Filter by date range
        if (start_date) {
            query += ` AND wl.log_date >= $${paramCount}`;
            params.push(start_date);
            paramCount++;
        }

        if (end_date) {
            query += ` AND wl.log_date <= $${paramCount}`;
            params.push(end_date);
            paramCount++;
        }

        query += ` ORDER BY wl.log_date DESC, wl.created_at DESC`;

        const workLogs = await pool.query(query, params);

        return successResponse(res, 200, 'Work logs retrieved successfully', {
            workLogs: workLogs.rows,
            count: workLogs.rows.length
        });

    } catch (err) {
        console.error('Get work logs error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Get single work log by ID
const getWorkLogById = async (req, res) => {
    try {
        const { id } = req.params;

        const workLog = await pool.query(`
            SELECT 
                wl.*,
                u.full_name as user_name,
                u.email as user_email,
                p.name as project_name,
                ph.phase_name
            FROM work_logs wl
            LEFT JOIN users u ON wl.user_id = u.id
            LEFT JOIN projects p ON wl.project_id = p.id
            LEFT JOIN phases ph ON wl.phase_id = ph.id
            WHERE wl.id = $1
        `, [id]);

        if (workLog.rows.length === 0) {
            return errorResponse(res, 404, 'Work log not found');
        }

        return successResponse(res, 200, 'Work log retrieved successfully', {
            workLog: workLog.rows[0]
        });

    } catch (err) {
        console.error('Get work log error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Get work logs by current user
const getMyWorkLogs = async (req, res) => {
    try {
        const { start_date, end_date, project_id } = req.query;

        let query = `
            SELECT 
                wl.*,
                p.name as project_name,
                ph.phase_name
            FROM work_logs wl
            LEFT JOIN projects p ON wl.project_id = p.id
            LEFT JOIN phases ph ON wl.phase_id = ph.id
            WHERE wl.user_id = $1
        `;

        const params = [req.user.id];
        let paramCount = 2;

        if (project_id) {
            query += ` AND wl.project_id = $${paramCount}`;
            params.push(project_id);
            paramCount++;
        }

        if (start_date) {
            query += ` AND wl.log_date >= $${paramCount}`;
            params.push(start_date);
            paramCount++;
        }

        if (end_date) {
            query += ` AND wl.log_date <= $${paramCount}`;
            params.push(end_date);
            paramCount++;
        }

        query += ` ORDER BY wl.log_date DESC, wl.created_at DESC`;

        const workLogs = await pool.query(query, params);

        // Calculate total hours
        const totalHours = workLogs.rows.reduce((sum, log) =>
            sum + (parseFloat(log.hours_spent) || 0), 0
        );

        return successResponse(res, 200, 'Your work logs retrieved successfully', {
            workLogs: workLogs.rows,
            count: workLogs.rows.length,
            totalHours: totalHours.toFixed(2)
        });

    } catch (err) {
        console.error('Get my work logs error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Create work log
const createWorkLog = async (req, res) => {
    try {
        const {
            project_id,
            phase_id,
            log_date,
            work_description,
            hours_spent,
            notes
        } = req.body;

        // Validation
        if (!project_id || !work_description) {
            return errorResponse(res, 400, 'Project and work description are required');
        }

        if (hours_spent && (hours_spent < 0 || hours_spent > 24)) {
            return errorResponse(res, 400, 'Hours spent must be between 0 and 24');
        }

        // Verify project exists
        const projectExists = await pool.query(
            'SELECT id FROM projects WHERE id = $1',
            [project_id]
        );

        if (projectExists.rows.length === 0) {
            return errorResponse(res, 404, 'Project not found');
        }

        // Verify phase belongs to project (if phase provided)
        if (phase_id) {
            const phaseExists = await pool.query(
                'SELECT id FROM phases WHERE id = $1 AND project_id = $2',
                [phase_id, project_id]
            );

            if (phaseExists.rows.length === 0) {
                return errorResponse(res, 404, 'Phase not found or does not belong to this project');
            }
        }

        // Create work log
        const newWorkLog = await pool.query(
            `INSERT INTO work_logs 
            (user_id, project_id, phase_id, log_date, work_description, hours_spent, notes) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *`,
            [
                req.user.id,
                project_id,
                phase_id || null,
                log_date || new Date().toISOString().split('T')[0],
                work_description.trim(),
                hours_spent || null,
                notes ? notes.trim() : null
            ]
        );

        return successResponse(res, 201, 'Work log created successfully', {
            workLog: newWorkLog.rows[0]
        });

    } catch (err) {
        console.error('Create work log error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Update work log
const updateWorkLog = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            project_id,
            phase_id,
            log_date,
            work_description,
            hours_spent,
            notes
        } = req.body;

        // Check if work log exists and belongs to user
        const existingLog = await pool.query(
            'SELECT * FROM work_logs WHERE id = $1',
            [id]
        );

        if (existingLog.rows.length === 0) {
            return errorResponse(res, 404, 'Work log not found');
        }

        // Authorization: Only owner can update their work log
        if (existingLog.rows[0].user_id !== req.user.id) {
            return errorResponse(res, 403, 'You can only update your own work logs');
        }

        // Validation
        if (hours_spent && (hours_spent < 0 || hours_spent > 24)) {
            return errorResponse(res, 400, 'Hours spent must be between 0 and 24');
        }

        // Verify phase belongs to project (if both provided)
        if (phase_id && project_id) {
            const phaseExists = await pool.query(
                'SELECT id FROM phases WHERE id = $1 AND project_id = $2',
                [phase_id, project_id]
            );

            if (phaseExists.rows.length === 0) {
                return errorResponse(res, 404, 'Phase does not belong to this project');
            }
        }

        // Build update query dynamically
        const updates = [];
        const params = [];
        let paramCount = 1;

        if (project_id !== undefined) {
            updates.push(`project_id = $${paramCount}`);
            params.push(project_id);
            paramCount++;
        }

        if (phase_id !== undefined) {
            updates.push(`phase_id = $${paramCount}`);
            params.push(phase_id);
            paramCount++;
        }

        if (log_date !== undefined) {
            updates.push(`log_date = $${paramCount}`);
            params.push(log_date);
            paramCount++;
        }

        if (work_description !== undefined) {
            updates.push(`work_description = $${paramCount}`);
            params.push(work_description.trim());
            paramCount++;
        }

        if (hours_spent !== undefined) {
            updates.push(`hours_spent = $${paramCount}`);
            params.push(hours_spent);
            paramCount++;
        }

        if (notes !== undefined) {
            updates.push(`notes = $${paramCount}`);
            params.push(notes ? notes.trim() : null);
            paramCount++;
        }

        if (updates.length === 0) {
            return errorResponse(res, 400, 'No fields to update');
        }

        params.push(id);
        const query = `UPDATE work_logs SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

        const updatedLog = await pool.query(query, params);

        return successResponse(res, 200, 'Work log updated successfully', {
            workLog: updatedLog.rows[0]
        });

    } catch (err) {
        console.error('Update work log error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Delete work log
const deleteWorkLog = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if work log exists and belongs to user
        const existingLog = await pool.query(
            'SELECT * FROM work_logs WHERE id = $1',
            [id]
        );

        if (existingLog.rows.length === 0) {
            return errorResponse(res, 404, 'Work log not found');
        }

        // Authorization: Only owner can delete their work log
        if (existingLog.rows[0].user_id !== req.user.id) {
            return errorResponse(res, 403, 'You can only delete your own work logs');
        }

        await pool.query('DELETE FROM work_logs WHERE id = $1', [id]);

        return successResponse(res, 200, 'Work log deleted successfully');

    } catch (err) {
        console.error('Delete work log error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Get work log statistics (dashboard data)
const getWorkLogStats = async (req, res) => {
    try {
        const { user_id, start_date, end_date } = req.query;

        let targetUserId = user_id || req.user.id;

        // Base query
        let statsQuery = `
            SELECT 
                COUNT(*) as total_logs,
                COALESCE(SUM(hours_spent), 0) as total_hours,
                COUNT(DISTINCT project_id) as projects_worked_on,
                COUNT(DISTINCT DATE(log_date)) as days_logged
            FROM work_logs
            WHERE user_id = $1
        `;

        const params = [targetUserId];
        let paramCount = 2;

        if (start_date) {
            statsQuery += ` AND log_date >= $${paramCount}`;
            params.push(start_date);
            paramCount++;
        }

        if (end_date) {
            statsQuery += ` AND log_date <= $${paramCount}`;
            params.push(end_date);
            paramCount++;
        }

        const stats = await pool.query(statsQuery, params);

        // Get breakdown by project
        let projectBreakdown = `
            SELECT 
                p.id,
                p.name as project_name,
                COUNT(wl.id) as log_count,
                COALESCE(SUM(wl.hours_spent), 0) as total_hours
            FROM work_logs wl
            JOIN projects p ON wl.project_id = p.id
            WHERE wl.user_id = $1
        `;

        const projectParams = [targetUserId];
        let projectParamCount = 2;

        if (start_date) {
            projectBreakdown += ` AND wl.log_date >= $${projectParamCount}`;
            projectParams.push(start_date);
            projectParamCount++;
        }

        if (end_date) {
            projectBreakdown += ` AND wl.log_date <= $${projectParamCount}`;
            projectParams.push(end_date);
            projectParamCount++;
        }

        projectBreakdown += ` GROUP BY p.id, p.name ORDER BY total_hours DESC`;

        const projectStats = await pool.query(projectBreakdown, projectParams);

        return successResponse(res, 200, 'Work log statistics retrieved successfully', {
            stats: {
                ...stats.rows[0],
                total_hours: parseFloat(stats.rows[0].total_hours).toFixed(2)
            },
            projectBreakdown: projectStats.rows.map(p => ({
                ...p,
                total_hours: parseFloat(p.total_hours).toFixed(2)
            }))
        });

    } catch (err) {
        console.error('Get work log stats error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Get work logs by specific user ID
const getWorkLogsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const { start_date, end_date, project_id, phase_id } = req.query;

        // Verify user exists
        const userExists = await pool.query(
            'SELECT id, full_name, email, role FROM users WHERE id = $1',
            [userId]
        );

        if (userExists.rows.length === 0) {
            return errorResponse(res, 404, 'User not found');
        }

        let query = `
            SELECT 
                wl.*,
                p.name as project_name,
                ph.phase_name
            FROM work_logs wl
            LEFT JOIN projects p ON wl.project_id = p.id
            LEFT JOIN phases ph ON wl.phase_id = ph.id
            WHERE wl.user_id = $1
        `;

        const params = [userId];
        let paramCount = 2;

        // Filter by project
        if (project_id) {
            query += ` AND wl.project_id = $${paramCount}`;
            params.push(project_id);
            paramCount++;
        }

        // Filter by phase
        if (phase_id) {
            query += ` AND wl.phase_id = $${paramCount}`;
            params.push(phase_id);
            paramCount++;
        }

        // Filter by date range
        if (start_date) {
            query += ` AND wl.log_date >= $${paramCount}`;
            params.push(start_date);
            paramCount++;
        }

        if (end_date) {
            query += ` AND wl.log_date <= $${paramCount}`;
            params.push(end_date);
            paramCount++;
        }

        query += ` ORDER BY wl.log_date DESC, wl.created_at DESC`;

        const workLogs = await pool.query(query, params);

        // Calculate total hours
        const totalHours = workLogs.rows.reduce((sum, log) =>
            sum + (parseFloat(log.hours_spent) || 0), 0
        );

        return successResponse(res, 200, 'Work logs retrieved successfully', {
            user: userExists.rows[0],
            workLogs: workLogs.rows,
            count: workLogs.rows.length,
            totalHours: totalHours.toFixed(2)
        });

    } catch (err) {
        console.error('Get work logs by user error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

module.exports = {
    getAllWorkLogs,
    getWorkLogById,
    getMyWorkLogs,
    getWorkLogsByUserId,
    createWorkLog,
    updateWorkLog,
    deleteWorkLog,
    getWorkLogStats
};
